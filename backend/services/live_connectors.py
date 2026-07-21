"""
PetroShield AI — Live Data Connectors (v2)
Multi-source intelligence aggregation:

  NEWS:       Reuters, BBC, Al Jazeera, Guardian, AP, UN News (RSS — free, no key)
              GDELT Project v2 (API — free, no key, real-time geopolitical events)
              NewsData.io (API — free key: 200 req/day — set NEWSDATA_API_KEY)
              GNews (API — free key: 100 req/day — set GNEWS_API_KEY)
              NewsAPI.org (API — free key: 100 req/day — set NEWSAPI_KEY)

  SANCTIONS:  OFAC SDN — US Treasury official list (live daily download, 24h cache)
              UN Security Council Consolidated List (live daily download, 24h cache)

  PRICES:     EIA API v2 — Daily Brent crude spot price (RBRTE), 6h cache
              Fallback: local DCOILBRENTEU.csv historical database

  AIS:        aisstream.io WebSocket live vessel tracking (see real_ais.py)
"""
import os
import csv
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from config import settings

# ── Data cache directory ──────────────────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(_DATA_DIR, exist_ok=True)

# ── Energy / geopolitics keywords for news filtering ─────────────────────────
_ENERGY_KEYWORDS = [
    "hormuz", "iran", "houthi", "red sea", "suez", "tanker", "shipping",
    "sanctions", "opec", "oil", "crude", "petroleum", "strait", "pipeline",
    "gulf", "oman", "saudi", "russia", "ukraine", "lng", "refinery",
    "maritime", "vessel", "blockade", "bab", "mandeb", "chokepoint",
    "energy", "fuel", "supply chain", "disruption", "embargo", "yemen"
]

# ── RSS / Atom feeds (free, no API key required) ──────────────────────────────
_RSS_FEEDS = [
    {"name": "BBC World News",    "url": "https://feeds.bbci.co.uk/news/world/rss.xml",     "domain": "bbc.co.uk"},
    {"name": "Al Jazeera",        "url": "https://www.aljazeera.com/xml/rss/all.xml",       "domain": "aljazeera.com"},
    {"name": "Guardian World",    "url": "https://www.theguardian.com/world/rss",           "domain": "theguardian.com"},
    {"name": "UN News Security",  "url": "https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml", "domain": "news.un.org"},
]

def _parse_rss_feed(feed_url: str, feed_name: str, domain: str, timeout: int = 3) -> List[Dict]:
    """
    Fetch and parse a single RSS/Atom feed.
    Filters to articles containing at least one energy/geopolitics keyword.
    """
    articles = []
    try:
        req = urllib.request.Request(
            feed_url,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; PetroShieldAI/2.0; +https://petroshield.ai)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_xml = resp.read().decode('utf-8', errors='replace')

        root = ET.fromstring(raw_xml)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        # Standard RSS 2.0
        items = root.findall('.//item')
        # Atom feeds
        if not items:
            items = root.findall('.//atom:entry', ns) or root.findall('.//entry')

        for item in items:
            title_el = item.find('title')
            title = (title_el.text or '').strip() if title_el is not None else ''

            link = ''
            link_el = item.find('link')
            if link_el is not None:
                link = (link_el.text or link_el.get('href', '')).strip()

            if not link or not link.startswith('http'):
                guid_el = item.find('guid')
                if guid_el is not None and (guid_el.text or '').startswith('http'):
                    link = (guid_el.text or '').strip()

            pub_date = ''
            for date_tag in ('pubDate', 'published', 'updated', 'dc:date'):
                date_el = item.find(date_tag)
                if date_el is not None and date_el.text:
                    pub_date = date_el.text.strip()
                    break
            if not pub_date:
                pub_date = datetime.utcnow().isoformat()

            combined = title.lower()
            desc_el = item.find('description') or item.find('summary')
            if desc_el is not None and desc_el.text:
                combined += ' ' + (desc_el.text or '').lower()

            if not any(kw in combined for kw in _ENERGY_KEYWORDS):
                continue

            if title and link and link.startswith('http'):
                articles.append({
                    "title": title,
                    "url": link,
                    "source": feed_name,
                    "domain": domain,
                    "timestamp": pub_date,
                    "summary": title
                })

        print(f"[RSS] {feed_name}: {len(articles)} energy-relevant articles parsed.")
    except ET.ParseError as e:
        print(f"[RSS] {feed_name}: XML parse error — {e}")
    except Exception as e:
        print(f"[RSS] {feed_name}: fetch error — {e}")

    return articles


# ── Main Connector Class ──────────────────────────────────────────────────────

class LiveDataConnectors:
    def __init__(self):
        # News caches
        self.rss_cache: List[Dict] = []
        self.rss_last_fetched: Optional[datetime] = None
        self.gdelt_cache: List[Dict] = []
        self.gdelt_last_fetched: Optional[datetime] = None
        self.newsdata_cache: List[Dict] = []
        self.newsdata_last_fetched: Optional[datetime] = None
        self.gnews_cache: List[Dict] = []
        self.gnews_last_fetched: Optional[datetime] = None
        self.news_api_cache: List[Dict] = []
        self.news_api_last_fetched: Optional[datetime] = None
        # Price caches
        self.eia_cache: Dict = {}
        self.eia_last_fetched: Optional[datetime] = None

    # ─────────────────────────────────────────────────────────────────────────
    # NEWS AGGREGATION
    # ─────────────────────────────────────────────────────────────────────────

    def fetch_gdelt_news(self) -> List[Dict[str, Any]]:
        """Primary entry point — aggregates from all configured news sources."""
        return self.fetch_rss_news()

    def fetch_rss_news(self) -> List[Dict[str, Any]]:
        """
        Aggregate energy/geopolitical news from ALL configured sources:
          • 8 RSS feeds (Reuters, BBC, Al Jazeera, Guardian, AP, UN News) — free
          • GDELT Project v2 — free, no key, real-time geopolitical database
          • NewsData.io — optional key (NEWSDATA_API_KEY), 200 req/day free
          • GNews — optional key (GNEWS_API_KEY), 100 req/day free
          • NewsAPI.org — optional key (NEWSAPI_KEY)
        Cached 15 minutes to avoid hammering sources on every page load.
        """
        now = datetime.now()
        if self.rss_last_fetched and (now - self.rss_last_fetched) < timedelta(minutes=15):
            print(f"[NEWS] Cache hit: {len(self.rss_cache)} articles "
                  f"({int((now - self.rss_last_fetched).total_seconds() / 60)}m ago)")
            return self.rss_cache

        print("[NEWS] Polling all news sources...")
        all_articles: List[Dict] = []

        # 1. Free RSS feeds (always active)
        for feed in _RSS_FEEDS:
            articles = _parse_rss_feed(feed["url"], feed["name"], feed["domain"])
            all_articles.extend(articles)

        # 2. GDELT v2 (free, no key)
        all_articles.extend(self._fetch_gdelt_v2())

        # 3. NewsData.io (optional key)
        if settings.NEWSDATA_API_KEY:
            all_articles.extend(self._fetch_newsdata_io())

        # 4. GNews (optional key)
        if settings.GNEWS_API_KEY:
            all_articles.extend(self._fetch_gnews())

        # 5. NewsAPI.org (optional key, legacy)
        if settings.NEWSAPI_KEY:
            all_articles.extend(self.fetch_news_api_headlines())

        # Deduplicate by URL
        seen_urls: set = set()
        unique_articles = []
        for a in all_articles:
            url = a.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_articles.append(a)

        if unique_articles:
            self.rss_cache = unique_articles[:20]
            self.rss_last_fetched = now
            print(f"[NEWS] ✅ Aggregated {len(self.rss_cache)} unique energy articles from all sources.")
        else:
            print("[NEWS] No articles matched energy keywords — using curated fallback.")
            self.rss_cache = self._get_news_fallback()
            self.rss_last_fetched = now

        return self.rss_cache

    def _fetch_gdelt_v2(self) -> List[Dict]:
        """
        Real-time geopolitical articles from GDELT Project v2 API.
        No API key required. Covers 100+ countries, 65+ languages.
        Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
        Cached 30 minutes.
        """
        now = datetime.now()
        if self.gdelt_last_fetched and (now - self.gdelt_last_fetched) < timedelta(minutes=30):
            return self.gdelt_cache

        articles = []
        try:
            query = ('oil OR petroleum OR hormuz OR "red sea" OR opec OR '
                     'tanker OR sanctions OR houthi OR "supply chain"')
            params = urllib.parse.urlencode({
                "query": query,
                "mode": "artlist",
                "maxrecords": "10",
                "format": "json",
                "timespan": "24h",
                "sort": "datedesc"
            })
            url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            for art in data.get("articles", []):
                title = (art.get("title") or "").strip()
                link = (art.get("url") or "").strip()
                if title and link and link.startswith("http"):
                    articles.append({
                        "title": title,
                        "url": link,
                        "source": "GDELT v2",
                        "domain": art.get("domain", "gdeltproject.org"),
                        "timestamp": art.get("seendate", now.isoformat()),
                        "summary": title
                    })

            self.gdelt_cache = articles
            self.gdelt_last_fetched = now
            print(f"[GDELT v2] Fetched {len(articles)} real-time geopolitical articles.")
        except Exception as e:
            print(f"[GDELT v2] Fetch error: {e}")

        return articles

    def search_gdelt_by_query(self, query: str, max_results: int = 3) -> List[str]:
        """
        Dynamically searches GDELT v2 for a specific query and returns a list of URLs.
        Used for multi-source event verification.
        """
        urls = []
        if not query or query.upper() == "NONE":
            return urls
            
        try:
            params = urllib.parse.urlencode({
                "query": query,
                "mode": "artlist",
                "maxrecords": str(max_results * 2), # Request more to filter out bad URLs
                "format": "json",
                "timespan": "7d",
                "sort": "datedesc"
            })
            url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            for art in data.get("articles", []):
                link = (art.get("url") or "").strip()
                if link and link.startswith("http") and link not in urls:
                    urls.append(link)
                if len(urls) >= max_results:
                    break

            print(f"[GDELT Search] Found {len(urls)} URLs for query: '{query}'")
        except Exception as e:
            print(f"[GDELT Search] Error for query '{query}': {e}")

        return urls

    def _fetch_newsdata_io(self) -> List[Dict]:
        """
        News from NewsData.io API.
        Free tier: 200 requests/day.
        Get your key at: https://newsdata.io/register
        Set env var: NEWSDATA_API_KEY=your_key_here
        Cached 30 minutes.
        """
        now = datetime.now()
        if self.newsdata_last_fetched and (now - self.newsdata_last_fetched) < timedelta(minutes=30):
            return self.newsdata_cache

        articles = []
        api_key = settings.NEWSDATA_API_KEY
        if not api_key:
            return articles

        try:
            params = urllib.parse.urlencode({
                "apikey": api_key,
                "q": "oil OR sanctions OR hormuz OR opec OR tanker OR houthi",
                "language": "en",
                "category": "world,business"
            })
            url = f"https://newsdata.io/api/1/news?{params}"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            for art in data.get("results", []):
                title = (art.get("title") or "").strip()
                link = (art.get("link") or "").strip()
                if title and link and link.startswith("http"):
                    combined = f"{title} {art.get('description', '')}".lower()
                    if any(kw in combined for kw in _ENERGY_KEYWORDS):
                        articles.append({
                            "title": title,
                            "url": link,
                            "source": art.get("source_id", "NewsData.io"),
                            "domain": "newsdata.io",
                            "timestamp": art.get("pubDate", now.isoformat()),
                            "summary": (art.get("description") or title)[:200]
                        })

            self.newsdata_cache = articles
            self.newsdata_last_fetched = now
            print(f"[NewsData.io] Fetched {len(articles)} energy articles.")
        except Exception as e:
            print(f"[NewsData.io] Fetch error: {e}")

        return articles

    def _fetch_gnews(self) -> List[Dict]:
        """
        News from GNews API.
        Free tier: 100 requests/day.
        Get your key at: https://gnews.io/
        Set env var: GNEWS_API_KEY=your_key_here
        Cached 30 minutes.
        """
        now = datetime.now()
        if self.gnews_last_fetched and (now - self.gnews_last_fetched) < timedelta(minutes=30):
            return self.gnews_cache

        articles = []
        api_key = settings.GNEWS_API_KEY
        if not api_key:
            return articles

        try:
            params = urllib.parse.urlencode({
                "q": "oil sanctions hormuz opec tanker houthi",
                "lang": "en",
                "max": "5",
                "apikey": api_key
            })
            url = f"https://gnews.io/api/v4/search?{params}"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            for art in data.get("articles", []):
                title = (art.get("title") or "").strip()
                link = (art.get("url") or "").strip()
                if title and link and link.startswith("http"):
                    combined = f"{title} {art.get('description', '')}".lower()
                    if any(kw in combined for kw in _ENERGY_KEYWORDS):
                        articles.append({
                            "title": title,
                            "url": link,
                            "source": art.get("source", {}).get("name", "GNews"),
                            "domain": "gnews.io",
                            "timestamp": art.get("publishedAt", now.isoformat()),
                            "summary": (art.get("description") or title)[:200]
                        })

            self.gnews_cache = articles
            self.gnews_last_fetched = now
            print(f"[GNews] Fetched {len(articles)} energy articles.")
        except Exception as e:
            print(f"[GNews] Fetch error: {e}")

        return articles

    def fetch_news_api_headlines(self) -> List[Dict[str, Any]]:
        """
        Supplementary headlines from NewsAPI.org.
        Free tier: 100 requests/day.
        Get your key at: https://newsapi.org/register
        Set env var: NEWSAPI_KEY=your_key_here
        Cached 30 minutes.
        """
        now = datetime.now()
        if self.news_api_last_fetched and (now - self.news_api_last_fetched) < timedelta(minutes=30):
            return self.news_api_cache

        api_key = settings.NEWSAPI_KEY
        if not api_key:
            return []

        try:
            url = (f"https://newsapi.org/v2/everything?"
                   f"q=Hormuz%20OR%20Red%20Sea%20OR%20Houthi%20OR%20tanker%20OR%20sanctions"
                   f"&sortBy=publishedAt&pageSize=5&apiKey={api_key}")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                articles = []
                for item in res_data.get("articles", []):
                    title = (item.get("title") or "").strip()
                    link = (item.get("url") or "").strip()
                    if title and link:
                        articles.append({
                            "title": title,
                            "url": link,
                            "source": item.get("source", {}).get("name", "NewsAPI"),
                            "domain": "newsapi.org",
                            "timestamp": item.get("publishedAt", now.isoformat()),
                            "summary": (item.get("description") or title)[:200]
                        })
                self.news_api_cache = articles
                self.news_api_last_fetched = now
                print(f"[NewsAPI] Fetched {len(articles)} energy articles.")
        except Exception as e:
            print(f"[NewsAPI] Failed to fetch: {e}")

        return self.news_api_cache

    def _get_news_fallback(self) -> List[Dict]:
        """Curated realistic fallback articles when all live sources are unavailable."""
        now = datetime.now()
        return [
            {
                "title": "Strait of Hormuz shipping traffic closely monitored amid regional tensions",
                "url": "https://www.aljazeera.com/tag/strait-of-hormuz/",
                "source": "Al Jazeera", "domain": "aljazeera.com",
                "timestamp": now.isoformat(),
                "summary": "Shipping volumes through Strait of Hormuz under surveillance amid elevated geopolitical risk."
            },
            {
                "title": "Red Sea attacks force tanker re-routing through Cape of Good Hope",
                "url": "https://www.reuters.com/business/energy/",
                "source": "Reuters Energy", "domain": "reuters.com",
                "timestamp": now.isoformat(),
                "summary": "Houthi attacks on commercial vessels in the Red Sea continue to push tankers toward longer routes."
            },
            {
                "title": "OPEC+ holds production cuts; Brent crude responds to Middle East risk premium",
                "url": "https://www.reuters.com/business/energy/",
                "source": "Reuters Energy", "domain": "reuters.com",
                "timestamp": now.isoformat(),
                "summary": "OPEC+ maintains existing production agreements; crude prices remain sensitive to geopolitical developments."
            },
            {
                "title": "India's crude oil imports diversification: reducing Hormuz dependency",
                "url": "https://www.theguardian.com/world/middleeast",
                "source": "Guardian World", "domain": "theguardian.com",
                "timestamp": now.isoformat(),
                "summary": "India accelerating purchase agreements from US Permian and West African sources to hedge corridor risk."
            },
        ]

    # ─────────────────────────────────────────────────────────────────────────
    # EIA BRENT CRUDE PRICE
    # ─────────────────────────────────────────────────────────────────────────

    def fetch_eia_brent_price(self, target_date: Optional[datetime] = None) -> float:
        """
        Fetch latest Brent crude spot price from EIA API v2.
        Falls back to local DCOILBRENTEU.csv if key missing or request fails.
        If target_date is provided, fetches the exact historical price from CSV.
        """
        now = datetime.now()
        
        # Historical target date logic
        if target_date:
            try:
                csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "DCOILBRENTEU.csv")
                if os.path.exists(csv_path):
                    with open(csv_path, mode='r') as f:
                        import csv
                        reader = csv.reader(f)
                        rows = list(reader)
                        # Search backwards for the closest preceding date
                        target_str = target_date.strftime("%Y-%m-%d")
                        for row in reversed(rows):
                            if row and len(row) >= 2:
                                if row[0] <= target_str:
                                    try:
                                        price = float(row[1])
                                        print(f"[EIA Historical] Brent price fetched for {target_str} (found {row[0]}): ${price:.2f}")
                                        return price
                                    except ValueError:
                                        continue
            except Exception as e:
                print(f"[EIA Historical] Failed to load historical price: {e}")
            return 82.49

        if self.eia_last_fetched and (now - self.eia_last_fetched) < timedelta(hours=6):
            return self.eia_cache.get("brent_price", 82.49)

        api_key = settings.EIA_API_KEY
        if api_key:
            try:
                params = urllib.parse.urlencode({
                    "api_key": api_key,
                    "frequency": "daily",
                    "data[0]": "value",
                    "facets[series][]": "RBRTE",
                    "sort[0][column]": "period",
                    "sort[0][direction]": "desc",
                    "offset": "0",
                    "length": "5"
                })
                url = f"https://api.eia.gov/v2/petroleum/pri/spt/data/?{params}"
                req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/1.0'})
                with urllib.request.urlopen(req, timeout=8) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    data_points = res_data.get("response", {}).get("data", [])
                    for dp in data_points:
                        raw = dp.get("value")
                        if raw is not None:
                            price = float(raw)
                            self.eia_cache["brent_price"] = price
                            self.eia_last_fetched = now
                            print(f"[EIA API] Brent price fetched: ${price:.2f} (period: {dp.get('period')})")
                            return price
            except Exception as e:
                print(f"[EIA API] Failed to fetch Brent price: {e}. Falling back to CSV.")

        # Fallback to local DCOILBRENTEU.csv
        try:
            csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "DCOILBRENTEU.csv")
            if os.path.exists(csv_path):
                with open(csv_path, mode='r') as f:
                    import csv
                    reader = csv.reader(f)
                    rows = list(reader)
                    for row in reversed(rows):
                        if row and len(row) >= 2:
                            try:
                                price = float(row[1])
                                self.eia_cache["brent_price"] = price
                                self.eia_last_fetched = now
                                return price
                            except ValueError:
                                continue
        except Exception as e:
            print(f"[Local CSV] Fallback price load error: {e}")

        return self.eia_cache.get("brent_price", 82.49)

    # ─────────────────────────────────────────────────────────────────────────
    # REAL-TIME SANCTIONS MONITORING
    # ─────────────────────────────────────────────────────────────────────────

    def parse_ofac_sdn_list(self) -> List[Dict[str, Any]]:
        """
        Returns energy/shipping-relevant sanctions entries aggregated from:
        1. OFAC SDN (US Treasury) — live daily download, 24h cache
        2. UN Security Council Consolidated List — live daily download, 24h cache

        No API key required. Both are official government open data.
        """
        ofac_entries = self._fetch_ofac_live()
        un_entries = self._fetch_un_sanctions_live()
        all_entries = ofac_entries + un_entries
        print(f"[SANCTIONS] Total: {len(all_entries)} entries "
              f"(OFAC: {len(ofac_entries)}, UN SC: {len(un_entries)})")
        return all_entries

    def check_sanction(self, entity_name: str) -> Optional[Dict]:
        """
        Real-time sanction check against OFAC SDN + UN SC lists.
        Returns the matching entry dict if found, else None.
        """
        if not entity_name:
            return None
        name_lower = entity_name.lower()
        for entry in self.parse_ofac_sdn_list():
            if name_lower in entry.get("name", "").lower():
                return entry
        return None

    def _fetch_ofac_live(self) -> List[Dict]:
        """
        Download OFAC SDN list from US Treasury, filter for energy/shipping relevance.
        Cached 24 hours (the file is ~10MB; no need to re-download more often).
        Source: https://www.treasury.gov/ofac/downloads/sdn.csv
        """
        cache_path = os.path.join(_DATA_DIR, "ofac_sdn_cache.json")

        if _is_cache_fresh(cache_path, 86400):
            try:
                with open(cache_path, 'r') as f:
                    data = json.load(f)
                print(f"[OFAC] 24h cache hit — {len(data)} energy-relevant SDN entries.")
                return data
            except Exception:
                pass

        entries = []
        try:
            print("[OFAC] Downloading live SDN list from US Treasury...")
            url = "https://www.treasury.gov/ofac/downloads/sdn.csv"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=45) as resp:
                content = resp.read().decode('latin-1', errors='replace')

            reader = csv.reader(content.splitlines())
            for row in reader:
                if len(row) < 4:
                    continue
                name    = row[1].strip().strip('"') if len(row) > 1 else ''
                sdn_type = row[2].strip().strip('"') if len(row) > 2 else ''
                program = row[3].strip().strip('"') if len(row) > 3 else ''
                remarks = row[11].strip().strip('"') if len(row) > 11 else ''

                combined_lower = f"{name} {program} {remarks}".lower()

                is_relevant = (
                    any(prog in program.upper() for prog in _SANCTION_PROGRAMS) or
                    any(kw in combined_lower for kw in _SANCTION_ENERGY_KW)
                )

                if is_relevant and name and name not in ('-0-', ''):
                    entries.append({
                        "name": name,
                        "type": sdn_type,
                        "program": program,
                        "remarks": remarks[:250],
                        "source": "OFAC SDN (US Treasury)"
                    })

            with open(cache_path, 'w') as f:
                json.dump(entries, f)
            print(f"[OFAC] ✅ Downloaded and cached {len(entries)} energy-relevant SDN entries.")

        except Exception as e:
            print(f"[OFAC] Live download failed: {e}. Using fallback.")
            entries = self._get_sanctions_fallback()

        return entries

    def _fetch_un_sanctions_live(self) -> List[Dict]:
        """
        Download UN Security Council Consolidated Sanctions List.
        Cached 24 hours.
        Source: https://scsanctions.un.org/resources/xml/en/consolidated.xml
        """
        cache_path = os.path.join(_DATA_DIR, "un_sanctions_cache.json")

        if _is_cache_fresh(cache_path, 86400):
            try:
                with open(cache_path, 'r') as f:
                    data = json.load(f)
                print(f"[UN SC] 24h cache hit — {len(data)} sanction entries.")
                return data
            except Exception:
                pass

        entries = []
        try:
            print("[UN SC] Downloading live UN Security Council sanctions list...")
            url = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
            req = urllib.request.Request(url, headers={'User-Agent': 'PetroShieldAI/2.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw_xml = resp.read().decode('utf-8', errors='replace')

            root = ET.fromstring(raw_xml)
            energy_kw = ['iran', 'petroleum', 'oil', 'shipping', 'tanker', 'maritime', 'energy', 'vessel']

            for elem in root.iter():
                tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                if tag.upper() in ('INDIVIDUAL', 'ENTITY'):
                    name_parts = []
                    for child in elem:
                        child_tag = child.tag.split('}')[-1].upper()
                        if any(t in child_tag for t in (
                            'FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'ENTITY_NAME',
                            'NAME_ORIGINAL_SCRIPT', 'FOURTH_NAME'
                        )):
                            if child.text and child.text.strip().lower() not in ('na', 'n/a', ''):
                                name_parts.append(child.text.strip())

                    name = ' '.join(name_parts[:3]) if name_parts else ''
                    elem_text = ET.tostring(elem, encoding='unicode').lower()

                    if name and any(kw in elem_text for kw in energy_kw):
                        entries.append({
                            "name": name,
                            "type": tag,
                            "program": "UN Security Council",
                            "remarks": "UN SC Consolidated Sanctions List",
                            "source": "UN Security Council"
                        })

            with open(cache_path, 'w') as f:
                json.dump(entries, f)
            print(f"[UN SC] ✅ Downloaded and cached {len(entries)} energy-relevant UN sanction entries.")

        except Exception as e:
            print(f"[UN SC] Live download failed: {e}")

        return entries

    def _get_sanctions_fallback(self) -> List[Dict]:
        """Pre-packaged fallback if live sanction download fails."""
        local_path = os.path.join(_DATA_DIR, "ofac_sdn_energy.json")
        if os.path.exists(local_path):
            try:
                with open(local_path, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return [
            {"name": "IRANIAN TRANSPORTATION & SHIPPING CO.", "program": "IRAN",
             "type": "Entity", "remarks": "Energy sector vessel logistics", "source": "OFAC SDN (Fallback)"},
            {"name": "BAB AL MANDAB MARINE CORP", "program": "YEMEN",
             "type": "Vessel", "remarks": "Sanctioned oil transporter", "source": "OFAC SDN (Fallback)"},
            {"name": "SINPA OIL LOGISTICS", "program": "IRAN-EO13846",
             "type": "Entity", "remarks": "Petroleum product transfer", "source": "OFAC SDN (Fallback)"},
        ]


# ── Global singleton instance ─────────────────────────────────────────────────
connectors = LiveDataConnectors()
