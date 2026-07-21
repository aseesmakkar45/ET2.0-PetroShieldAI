"""
Event Intelligence Service — uses Groq to convert raw text or article URLs into
structured EventIntelligence objects. This is the brain of Agent 1.

Design principles:
- Groq ONLY performs understanding and extraction — never numerical forecasting
- All numerical outputs (probability, supply_loss) are Groq's qualitative estimates
  converted to ranges, then used as INPUTS to the deterministic scoring engine
- Falls back to enhanced keyword extraction when Groq is unavailable
- Supports both raw text signals and live article URLs
"""
import re
import json
import logging
import html
import urllib.request
import urllib.error
from html.parser import HTMLParser
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("uvicorn.error")

# ── Groq model to use for event understanding ──────────────────────────────
_GROQ_MODEL = "groq-2.0-flash"

# ── Known entity vocabularies for enhanced fallback extraction ────────────────
_CHOKEPOINTS = {
    "hormuz": "cp_hormuz", "strait of hormuz": "cp_hormuz",
    "bab el mandeb": "cp_bab_el_mandeb", "bab-el-mandeb": "cp_bab_el_mandeb",
    "red sea": "cp_bab_el_mandeb", "suez": "cp_suez", "suez canal": "cp_suez",
    "malacca": "cp_malacca", "strait of malacca": "cp_malacca",
    "cape of good hope": "cape_good_hope", "cape route": "cape_good_hope",
    "gulf of aden": "cp_bab_el_mandeb",
}

_SUPPLIERS = {
    "saudi": "sa_saudi", "saudi arabia": "sa_saudi", "aramco": "sa_saudi",
    "iraq": "sa_iraq", "basra": "sa_iraq", "rumaila": "sa_iraq",
    "russia": "sa_russia", "rosneft": "sa_russia", "urals": "sa_russia",
    "uae": "sa_uae", "abu dhabi": "sa_uae", "adnoc": "sa_uae", "murban": "sa_uae",
    "iran": "sa_iran", "iranian": "sa_iran",
    "nigeria": "sa_nigeria", "bonny": "sa_nigeria",
    "kuwait": "sa_kuwait",
    "angola": "sa_angola",
    "usa": "sa_usa", "us crude": "sa_usa", "permian": "sa_usa", "wti": "sa_usa",
}

_EVENT_TYPE_KEYWORDS = {
    "MILITARY_CONFLICT": [
        "blockade", "conflict", "strike", "attack", "military", "missile",
        "war", "naval", "combat", "siege", "mine", "explosion", "drone"
    ],
    "SANCTIONS": [
        "sanctions", "embargo", "ofac", "blacklist", "freeze", "ban", "restricted"
    ],
    "OPEC_DECISION": [
        "opec", "production cut", "quota", "supply cut", "output", "cartel"
    ],
    "INFRASTRUCTURE_FAILURE": [
        "force majeure", "pipeline", "leak", "explosion", "fire", "shutdown", "outage"
    ],
    "WEATHER_EVENT": [
        "cyclone", "hurricane", "storm", "typhoon", "flooding", "earthquake"
    ],
    "SHIPPING_DISRUPTION": [
        "piracy", "houthi", "tanker attack", "cargo ship", "diversion", "rerouting"
    ],
}


class _HTMLStripper(HTMLParser):
    """Minimal HTML stripper using stdlib only — no external dependencies."""
    def __init__(self):
        super().__init__()
        self._chunks: List[str] = []
        self._skip_tags = {"script", "style", "nav", "header", "footer",
                           "aside", "form", "meta", "link", "noscript",
                           "button", "iframe", "advertisement"}
        self._in_skip = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self._skip_tags:
            self._in_skip = True

    def handle_endtag(self, tag):
        if tag.lower() in self._skip_tags:
            self._in_skip = False

    def handle_data(self, data):
        if not self._in_skip:
            stripped = data.strip()
            if stripped:
                self._chunks.append(stripped)

    def get_text(self) -> str:
        return " ".join(self._chunks)


@dataclass
class EventIntelligence:
    """
    Structured intelligence extracted from a geopolitical event.
    This is the single source of truth fed into all downstream agents.
    """
    event_type: str = "UNKNOWN"
    summary: str = ""
    countries: List[str] = field(default_factory=list)
    organizations: List[str] = field(default_factory=list)
    ports: List[str] = field(default_factory=list)
    suppliers: List[str] = field(default_factory=list)       # KG node IDs
    chokepoints: List[str] = field(default_factory=list)     # KG node IDs
    shipping_routes: List[str] = field(default_factory=list)
    sanctions: List[str] = field(default_factory=list)
    conflict_level: float = 0.0          # 0–10 scale extracted by Groq
    expected_duration_days: int = 30     # Groq's estimate
    predicted_supply_loss_mbpd: float = 0.0   # Groq's estimate (used as hint only)
    confidence: float = 0.5              # Groq's extraction confidence
    supporting_evidence: List[str] = field(default_factory=list)
    uncertainties: List[str] = field(default_factory=list)
    raw_text_used: str = ""              # The source text that was analyzed
    extraction_method: str = "UNKNOWN"  # GROQ | KEYWORD_FALLBACK

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def fetch_article_content(url: str, timeout: int = 12) -> str:
    """
    Download and extract clean readable text from a URL.
    Uses stdlib only — no BeautifulSoup, no Trafilatura.
    Returns empty string on failure.
    """
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "cross-site",
                "Cache-Control": "max-age=0"
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_html = resp.read().decode("utf-8", errors="replace")

        # Strip HTML
        stripper = _HTMLStripper()
        stripper.feed(html.unescape(raw_html))
        text = stripper.get_text()

        # Clean up whitespace and deduplicate lines
        lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 40]
        seen = set()
        unique_lines = []
        for ln in lines:
            if ln not in seen:
                seen.add(ln)
                unique_lines.append(ln)

        clean = "\n".join(unique_lines[:120])  # Cap at ~120 meaningful lines
        logger.info(f"[EventIntel] Article fetched from {url}: {len(clean)} chars extracted.")
        return clean

    except urllib.error.HTTPError as e:
        logger.warning(f"[EventIntel] HTTP {e.code} fetching {url}: {e.reason}")
        return ""
    except Exception as e:
        logger.warning(f"[EventIntel] Failed to fetch article from {url}: {e}")
        return ""


def _extract_with_groq(text: str, api_key: str) -> Optional[EventIntelligence]:
    """
    Use Groq to extract structured EventIntelligence from text.
    """
    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        # Truncate text to avoid token limits while keeping key content
        truncated = text[:6000] if len(text) > 6000 else text

        prompt = f"""
You are an expert geopolitical and energy market analyst.
Extract key risk intelligence from the following text and return the output STRICTLY as valid JSON without any markdown formatting.

Text to analyze:
"{truncated}"

Expected JSON format:
{{
  "event_type": "One of: MILITARY_CONFLICT | SANCTIONS | OPEC_DECISION | INFRASTRUCTURE_FAILURE | WEATHER_EVENT | SHIPPING_DISRUPTION | PRICE_MOVEMENT | UNKNOWN",
  "summary": "2-3 sentence factual summary of what happened and its energy supply implications",
  "countries": ["List of countries mentioned"],
  "organizations": ["List of organizations, companies, alliances mentioned"],
  "ports": ["List of port or terminal names mentioned"],
  "suppliers": ["List of oil supplier countries or companies mentioned: e.g. Saudi Arabia, Rosneft, ADNOC, NNPC"],
  "chokepoints": ["List of maritime chokepoints mentioned: e.g. Strait of Hormuz, Red Sea, Suez Canal, Bab el-Mandeb, Strait of Malacca"],
  "shipping_routes": ["List of specific shipping routes or corridors mentioned"],
  "sanctions": ["List of specific sanctions programs or entities sanctioned, if any"],
  "conflict_level": <integer 0-10 where 0=no conflict, 5=regional tension, 10=active military blockade>,
  "expected_duration_days": <integer estimate of how long disruption may last, e.g. 30>,
  "predicted_supply_loss_mbpd": <float estimate of global supply loss in million barrels per day, e.g. 2.4>,
  "confidence": <float 0.0-1.0 representing your confidence in this extraction based on information clarity>,
  "supporting_evidence": ["2-4 specific facts from the text that support the risk assessment"],
  "uncertainties": ["2-3 key unknowns or factors that could change the assessment"]
}}"""

        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=500
        )
        raw = response.choices[0].message.content.strip()

        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)

        data = json.loads(raw.strip())

        # Map free-text chokepoints/suppliers to KG node IDs
        text_lower = text.lower()
        kg_chokepoints = _map_chokepoints(data.get("chokepoints", []))
        kg_suppliers = _map_suppliers(data.get("suppliers", []))

        intel = EventIntelligence(
            event_type=data.get("event_type", "UNKNOWN"),
            summary=data.get("summary", ""),
            countries=data.get("countries", []),
            organizations=data.get("organizations", []),
            ports=data.get("ports", []),
            suppliers=kg_suppliers,
            chokepoints=kg_chokepoints,
            shipping_routes=data.get("shipping_routes", []),
            sanctions=data.get("sanctions", []),
            conflict_level=float(data.get("conflict_level", 0)),
            expected_duration_days=int(data.get("expected_duration_days", 30)),
            predicted_supply_loss_mbpd=float(data.get("predicted_supply_loss_mbpd", 0.0)),
            confidence=float(data.get("confidence", 0.5)),
            supporting_evidence=data.get("supporting_evidence", []),
            uncertainties=data.get("uncertainties", []),
            raw_text_used=text[:500],
            extraction_method="GROQ",
        )
        logger.info(
            f"[EventIntel] Groq extraction successful: "
            f"event_type={intel.event_type}, conflict_level={intel.conflict_level}, "
            f"chokepoints={intel.chokepoints}, suppliers={intel.suppliers}"
        )
        return intel

    except json.JSONDecodeError as e:
        logger.error(f"[EventIntel] Groq returned non-JSON response: {e}")
        return None
    except Exception as e:
        logger.error(f"[EventIntel] Groq extraction failed: {e}")
        return None


def _map_chokepoints(raw_list: List[str]) -> List[str]:
    """Map free-text chokepoint names to KG node IDs."""
    ids = set()
    for item in raw_list:
        item_lower = item.lower().strip()
        for keyword, node_id in _CHOKEPOINTS.items():
            if keyword in item_lower:
                ids.add(node_id)
    return list(ids)


def _map_suppliers(raw_list: List[str]) -> List[str]:
    """Map free-text supplier names to KG node IDs."""
    ids = set()
    for item in raw_list:
        item_lower = item.lower().strip()
        for keyword, node_id in _SUPPLIERS.items():
            if keyword in item_lower:
                ids.add(node_id)
    return list(ids)


def _extract_with_keywords(text: str) -> EventIntelligence:
    """
    Enhanced keyword-based extraction — used ONLY as fallback when Groq is unavailable.
    Far richer than the old keyword detection in risk_intel.py:
    - Detects all entity types
    - Counts evidence signals
    - Estimates conflict level from signal density
    - Maps to KG node IDs
    This is labelled clearly as KEYWORD_FALLBACK so auditors know Groq was unavailable.
    """
    text_lower = text.lower()

    # Detect event type by keyword density
    event_type = "UNKNOWN"
    best_score = 0
    for etype, keywords in _EVENT_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            event_type = etype

    # Detect chokepoints
    chokepoints = []
    for keyword, node_id in _CHOKEPOINTS.items():
        if keyword in text_lower and node_id not in chokepoints:
            chokepoints.append(node_id)

    # Detect suppliers
    suppliers = []
    for keyword, node_id in _SUPPLIERS.items():
        if keyword in text_lower and node_id not in suppliers:
            suppliers.append(node_id)

    # Estimate conflict level (0–10) from keyword density
    conflict_keywords = _EVENT_TYPE_KEYWORDS.get("MILITARY_CONFLICT", [])
    conflict_hits = sum(1 for kw in conflict_keywords if kw in text_lower)
    conflict_level = min(10.0, conflict_hits * 1.5)

    # Estimate duration
    if "weeks" in text_lower or "month" in text_lower:
        expected_duration = 45
    elif "days" in text_lower:
        expected_duration = 15
    else:
        expected_duration = 30

    # Gather supporting evidence (sentences containing key terms)
    sentences = re.split(r'[.!?]', text)
    evidence = []
    for sent in sentences:
        if any(kw in sent.lower() for kw in ["supply", "oil", "crude", "tanker", "blockade", "sanctions"]):
            stripped = sent.strip()
            if 20 < len(stripped) < 200:
                evidence.append(stripped)
    evidence = evidence[:4]

    # Map sanctions detection
    sanctions = []
    if "sanctions" in text_lower or "ofac" in text_lower or "embargo" in text_lower:
        sanctions.append("Detected sanctions/embargo language — review OFAC registry")

    # Estimate supply loss from known chokepoint throughputs
    supply_loss = 0.0
    if "cp_hormuz" in chokepoints:
        supply_loss += 2.4  # India's approx. Hormuz exposure
    if "cp_bab_el_mandeb" in chokepoints:
        supply_loss += 0.8
    if "cp_suez" in chokepoints:
        supply_loss += 0.5
    # Scale by conflict level
    supply_loss = supply_loss * (conflict_level / 10.0) if conflict_level > 0 else supply_loss * 0.3

    confidence = min(0.85, 0.4 + len(chokepoints) * 0.1 + len(suppliers) * 0.05 + best_score * 0.05)

    intel = EventIntelligence(
        event_type=event_type,
        summary=text[:300].replace("\n", " "),
        countries=[],
        organizations=[],
        ports=[],
        suppliers=suppliers,
        chokepoints=chokepoints,
        shipping_routes=[],
        sanctions=sanctions,
        conflict_level=conflict_level,
        expected_duration_days=expected_duration,
        predicted_supply_loss_mbpd=round(supply_loss, 2),
        confidence=round(confidence, 2),
        supporting_evidence=evidence,
        uncertainties=[
            "Groq API unavailable — extraction based on keyword analysis only.",
            "Confidence reduced: qualitative context not assessed."
        ],
        raw_text_used=text[:500],
        extraction_method="KEYWORD_FALLBACK",
    )
    logger.info(
        f"[EventIntel] Keyword fallback extraction: "
        f"event_type={intel.event_type}, conflict_level={intel.conflict_level}, "
        f"chokepoints={intel.chokepoints}"
    )
    return intel


def extract_event_intelligence(
    raw_signal: str,
    api_key: str = "",
) -> EventIntelligence:
    """
    Primary entry point for event understanding.

    Args:
        raw_signal: Either a plain text signal OR a URL (auto-detected)
        api_key: Groq API key. Falls back to keyword extraction if empty or API fails.

    Returns:
        EventIntelligence: Structured intelligence ready for downstream agents.
    """
    # Auto-detect if input is a URL
    source_text = raw_signal
    if raw_signal.strip().startswith("http://") or raw_signal.strip().startswith("https://"):
        logger.info(f"[EventIntel] URL detected — fetching article content from: {raw_signal.strip()}")
        article_content = fetch_article_content(raw_signal.strip())
        if article_content:
            source_text = article_content
            logger.info(f"[EventIntel] Article extracted successfully ({len(source_text)} chars). Proceeding to intelligence extraction.")
        else:
            logger.warning("[EventIntel] Article fetch failed — using URL string as fallback text.")
            source_text = raw_signal  # Use URL as text hint

    # Resolve API Key dynamically from rotation pool if not provided
    from config import get_groq_api_key
    resolved_key = api_key or get_groq_api_key() or ""

    # Multi-Source Event Verification (fetch supporting articles)
    combined_context = source_text
    try:
        from agents.groq_prompt_agent import groq_prompting_agent
        from services.live_connectors import connectors
        
        # 1. Ask LLM to generate a search query from the main text
        search_query = groq_prompting_agent.generate_search_query_for_event(source_text)
        
        # 2. If a valid event query is generated, search GDELT for related URLs
        if search_query != "NONE":
            related_urls = connectors.search_gdelt_by_query(search_query, max_results=3)
            
            # 3. Download the text of the related articles
            additional_texts = []
            for i, url in enumerate(related_urls):
                if url.strip() != raw_signal.strip(): # Don't fetch the exact same URL
                    logger.info(f"[EventIntel] Fetching supporting article {i+1}: {url}")
                    content = fetch_article_content(url)
                    if content:
                        additional_texts.append(f"--- Supporting Article {i+1} ---\n{content[:1500]}")
            
            # 4. Combine into a massive context block
            if additional_texts:
                combined_context = (
                    f"--- PRIMARY SOURCE ---\n{source_text}\n\n" + 
                    "\n\n".join(additional_texts)
                )
                logger.info(f"[EventIntel] Multi-source aggregation complete. Total context size: {len(combined_context)} chars.")
            else:
                logger.info("[EventIntel] No supporting articles found. Proceeding with single-source context.")
    except Exception as e:
        logger.warning(f"[EventIntel] Multi-source aggregation failed: {e}. Proceeding with single-source context.")

    # Try Groq extraction first on the combined multi-source context
    if resolved_key:
        result = _extract_with_groq(combined_context, resolved_key)
        if result is not None:
            return result
        logger.warning("[EventIntel] Groq extraction failed — falling back to keyword extraction.")

    # Fallback to enhanced keyword extraction
    return _extract_with_keywords(combined_context)
