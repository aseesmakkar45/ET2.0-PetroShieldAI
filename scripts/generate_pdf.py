import sys
import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch

# Define page size
PAGE_WIDTH, PAGE_HEIGHT = landscape(letter)  # 792 x 612 points

# Paths to images
LOGO_PATH = r"C:\Users\lenovo\.gemini\antigravity-ide\brain\34f5b795-a471-451a-90a5-e0aead946c92\petroshield_logo_1784288841857.png"
SCREENSHOT_PATH = r"C:\Users\lenovo\.gemini\antigravity-ide\brain\34f5b795-a471-451a-90a5-e0aead946c92\dashboard_page_1784275696018.png"
VULN_MAP_PATH = r"C:\Users\lenovo\.gemini\antigravity-ide\brain\34f5b795-a471-451a-90a5-e0aead946c92\vulnerability_map_1784290870643.png"

def draw_top_bar(c, title):
    # Header background (deep navy dark bar)
    c.setFillColor(colors.HexColor("#080c14"))
    c.rect(0, 550, PAGE_WIDTH, 62, fill=True, stroke=False)
    
    # Bottom orange/blue accent lines
    c.setFillColor(colors.HexColor("#ef4444"))
    c.rect(0, 547, PAGE_WIDTH / 2, 3, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#3b82f6"))
    c.rect(PAGE_WIDTH / 2, 547, PAGE_WIDTH / 2, 3, fill=True, stroke=False)
    
    # Logo text
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30, 575, "PETROSHIELD AI")
    
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(PAGE_WIDTH / 2, 570, title)
    
    # Header subtitles
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(PAGE_WIDTH - 30, 575, "HACK2SKILL 2026")
    c.drawRightString(PAGE_WIDTH - 30, 562, "TEAM LUNAR ARCANA")

def draw_footer_bar(c, slide_num):
    # Bottom accent lines
    c.setFillColor(colors.HexColor("#ef4444"))
    c.rect(0, 0, PAGE_WIDTH / 2, 8, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#3b82f6"))
    c.rect(PAGE_WIDTH / 2, 0, PAGE_WIDTH / 2, 8, fill=True, stroke=False)
    
    # Footer text
    c.setFillColor(colors.HexColor("#475569"))
    c.setFont("Helvetica", 9)
    c.drawString(30, 15, "PetroShield AI: Geopolitical Crude Oil Supply Chain Resilience Platform")
    c.drawRightString(PAGE_WIDTH - 30, 15, f"Slide {slide_num} of 10")

def build_pdf():
    pdf_path = r"C:\Users\lenovo\Desktop\ET2.0\PetroShield_AI_Presentation.pdf"
    c = canvas.Canvas(pdf_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    
    # ==================== SLIDE 1: TITLE SLIDE ====================
    c.setFillColor(colors.HexColor("#080c14"))
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=True, stroke=False)
    
    if os.path.exists(LOGO_PATH):
        try:
            c.drawImage(LOGO_PATH, PAGE_WIDTH - 280, 260, width=220, height=220, mask='auto')
        except Exception:
            pass
            
    c.setFillColor(colors.HexColor("#3b82f6"))
    c.setFont("Helvetica-Bold", 36)
    c.drawString(50, 420, "PETROSHIELD AI")
    
    c.setFillColor(colors.HexColor("#ef4444"))
    c.rect(50, 400, 250, 4, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 360, "National Energy Security Command Center")
    
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica-Oblique", 13)
    c.drawString(50, 330, "A Fully Implemented, Data-Grounded Multi-Agent Digital Twin")
    
    # Team Info card
    c.setFillColor(colors.HexColor("#1e293b"))
    c.roundRect(50, 70, 420, 210, 8, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(70, 250, "Team Name: Lunar Arcana")
    c.drawString(70, 225, "Team Leader Name: Abhishta Gyanda")
    
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(70, 195, "Our Real Engineering Upgrades & Implementation:")
    
    c.setFont("Helvetica", 9.5)
    upgrades_lines = [
        "• Semantic Ingestion: GDELT & RSS Scraping every 8 seconds.",
        "• Grounded Price Data: Live Daily spot prices fetched from US EIA API.",
        "• Optimization Solver: SciPy-powered LP alternate supplier rerouting.",
        "• Real-Time Caverns: Schedules Padur & Mangaluru releases to keep run rate above 70%."
    ]
    y_offset = 175
    for line in upgrades_lines:
        c.drawString(70, y_offset, line)
        y_offset -= 16
        
    c.setFillColor(colors.HexColor("#3b82f6"))
    c.drawString(70, 100, "Live URL: http://localhost:3000 | Backend: http://localhost:8000")
    
    draw_footer_bar(c, 1)
    c.showPage()
    
    # ==================== SLIDE 2: PROBLEM STATEMENT ====================
    draw_top_bar(c, "PROBLEM STATEMENT")
    
    # Column 1: Core Vulnerability Text
    c.setFillColor(colors.HexColor("#eff6ff"))
    c.roundRect(40, 70, 340, 425, 8, fill=True, stroke=False)
    
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, 455, "India's Crude Import Exposure")
    
    c.setFillColor(colors.HexColor("#1e293b"))
    c.setFont("Helvetica", 10)
    problem_text = [
        "• 85%+ Crude Import Dependency: India imports over 4.5",
        "  million barrels per day, sustaining national growth.",
        "• Critical Chokepoint Constraints:",
        "  - Strait of Hormuz: Carries ~60% of Persian Gulf imports.",
        "  - Red Sea / Bab-el-Mandeb: Regional conflict forces",
        "    tankers around Cape of Good Hope (+12-15 transit days).",
        "• The Engineering Gap in Existing Systems:",
        "  - Siloed spreadsheets use static templates & mock data.",
        "  - They fail to map text context, cannot resolve crude grade",
        "    compatibility, & cannot calculate cavern runways.",
        "• Our Geospatial Evidence Depth:",
        "  - Resolves raw news into latitude/longitude coordinates.",
        "  - Automatically maps blocked corridors and routes",
        "    on the Leaflet GIS digital twin map interface."
    ]
    y_offset = 425
    for line in problem_text:
        c.drawString(60, y_offset, line)
        y_offset -= 19.5
        
    # Column 2: Vulnerability Map Image
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.roundRect(400, 70, 350, 425, 8, fill=True, stroke=True)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(575, 455, "Visualizing Global Chokepoints")
    
    if os.path.exists(VULN_MAP_PATH):
        try:
            c.drawImage(VULN_MAP_PATH, 415, 85, width=320, height=340, stroke=True)
        except Exception:
            c.rect(415, 85, 320, 340, fill=False, stroke=True)
            c.drawCentredString(575, 250, "[Chokepoint Exposure Map]")
    else:
        c.rect(415, 85, 320, 340, fill=False, stroke=True)
        c.drawCentredString(575, 250, "[Chokepoint Exposure Map]")
        
    draw_footer_bar(c, 2)
    c.showPage()
    
    # ==================== SLIDE 3: SOLUTION ====================
    draw_top_bar(c, "SOLUTION")
    
    # Introducing title
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(PAGE_WIDTH / 2, 495, "PetroShield AI: Pre-emptive, Data-Grounded Decision Command Center")
    
    # Three Pillar Cards
    pillars = [
        {"title": "Pillar 1: Graph-RAG Infrastructure", "bg": "#f0fdf4", "border": "#4ade80", "color": "#166534",
         "desc": ["We modeled India's entire import network", "(suppliers, corridors, storage, refiners)", "as a directed semantic Graph. News entities", "are resolved and mapped to specific graph", "nodes dynamically in real-time."]},
        {"title": "Pillar 2: Live Simulation Engines", "bg": "#eff6ff", "border": "#60a5fa", "color": "#1e40af",
         "desc": ["Spot prices are fetched live from the US", "EIA API. Volatility parameters are", "calibrated on real FRED daily returns.", "Pricing curves are generated via 5,000", "path Monte Carlo (GBM) dynamically."]},
        {"title": "Pillar 3: Executable Mitigation Solver", "bg": "#faf5ff", "border": "#c084fc", "color": "#6b21a8",
         "desc": ["SciPy LP optimizer solves procurement", "rerouting matrices. Strategic cavern", "releases (Padur/Mangaluru) are", "scheduled to keep refineries above", "their 70% minimum operating threshold."]}
    ]
    
    card_width = 220
    card_height = 320
    gap = 25
    start_x = 55
    y = 110
    
    for idx, p in enumerate(pillars):
        x = start_x + idx * (card_width + gap)
        
        c.setFillColor(colors.HexColor(p["bg"]))
        c.setStrokeColor(colors.HexColor(p["border"]))
        c.setLineWidth(1.5)
        c.roundRect(x, y, card_width, card_height, 10, fill=True, stroke=True)
        
        c.setFillColor(colors.HexColor(p["color"]))
        c.setFont("Helvetica-Bold", 11.5)
        c.drawString(x + 15, y + 285, p["title"])
        
        c.setStrokeColor(colors.HexColor(p["border"]))
        c.line(x + 12, y + 270, x + card_width - 12, y + 270)
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 10)
        dy = y + 235
        for line in p["desc"]:
            c.drawString(x + 15, dy, line)
            dy -= 22
            
    c.setLineWidth(1)
    draw_footer_bar(c, 3)
    c.showPage()
    
    # ==================== SLIDE 4: ARCHITECTURE ====================
    draw_top_bar(c, "ARCHITECTURE")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Our Implemented Multi-Agent Architecture (The 5 Subagents)")
    
    # Diagram box
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.roundRect(40, 75, 710, 395, 8, fill=True, stroke=True)
    
    # Core Agents table
    headers = ["Subagent Name", "Core Task & Library Used", "Implemented Role in Security Pipeline"]
    agent_rows = [
        ("Agent 1: Risk Intelligence", "Entity Resolution & Bayesian Scoring (NetworkX)", "Fuses live feeds, EIA prices, and Graph topology to score risk."),
        ("Agent 2: Scenario Modeller", "5,000-path Monte Carlo price forecasting (SciPy)", "Calibrates price volatility on FRED historical Brent crude data."),
        ("Agent 3: Procurement Agent", "Linear Programming (LP) optimization (SciPy)", "Reroutes supply and reallocates imports under shipping wait times."),
        ("Agent 4: SPR Advisor", "Inventory drawdown & Refills (Graph Traversal)", "Schedules cavern releases to keep refineries above 70% run rates."),
        ("Agent 5: Executive Briefing", "Markdown Synthesis (FastAPI)", "Compiles decision briefs and commands for the Cabinet Secretary."),
        ("Agent 6: Gemini Auditor", "Supervisory validation logic (Gemini API)", "Audits all calculations and signs off briefs (Supported by key rotation).")
    ]
    
    # Draw Table
    x_coords = [50, 240, 470, 740]
    ty = 430
    
    # Draw headers
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x_coords[0], ty, headers[0])
    c.drawString(x_coords[1], ty, headers[1])
    c.drawString(x_coords[2], ty, headers[2])
    
    c.setStrokeColor(colors.HexColor("#94a3b8"))
    c.setLineWidth(1.5)
    c.line(40, ty - 8, 750, ty - 8)
    c.setLineWidth(1)
    
    ty -= 30
    for idx, r in enumerate(agent_rows):
        # Background highlight for supervisor
        if idx == 5:
            c.setFillColor(colors.HexColor("#fef2f2"))
            c.rect(42, ty - 8, 706, 26, fill=True, stroke=False)
            
        c.setFillColor(colors.HexColor("#ef4444") if idx == 5 else colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold" if idx == 5 else "Helvetica", 10)
        c.drawString(x_coords[0], ty, r[0])
        
        c.setFillColor(colors.HexColor("#1e293b"))
        c.setFont("Helvetica", 9)
        c.drawString(x_coords[1], ty, r[1])
        c.drawString(x_coords[2], ty, r[2])
        
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.line(40, ty - 8, 750, ty - 8)
        ty -= 30
        
    draw_footer_bar(c, 4)
    c.showPage()
    
    # ==================== SLIDE 5: WORKFLOW/DATA FLOW ====================
    draw_top_bar(c, "WORKFLOW/DATA FLOW")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Operational Action Loop & Data Flow Pipeline")
    
    # Draw Chevron Stages
    stages = [
        {"num": "1. Ingest", "title": "8s Polling Feed", "desc": ["RSS feeds & GDELT polled", "every 8 seconds in the", "background for alerts."]},
        {"num": "2. Extract", "title": "Gemini Pydantic", "desc": ["Parses raw articles into", "EventIntelligence schema.", "Bypasses web paywalls."]},
        {"num": "3. Gate", "title": "Decision Gate", "desc": ["Low-risk events (<35%)", "early-stop in < 200ms,", "saving system tokens."]},
        {"num": "4. Model", "title": "Monte Carlo GBM", "desc": ["Agent 2 models Brent", "price paths; Agent 3 & 4", "solve alternate sourcing."]},
        {"num": "5. Audit", "title": "Gemini Verification", "desc": ["Supervisor audits math", "against physical limits;", "generates Cabinet PDF."]}
    ]
    
    box_width = 135
    box_height = 210
    gap = 10
    start_x = 40
    y = 230
    
    for idx, s in enumerate(stages):
        bx = start_x + idx * (box_width + gap)
        
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.setStrokeColor(colors.HexColor("#3b82f6") if idx == 2 else colors.HexColor("#cbd5e1"))
        c.roundRect(bx, y, box_width, box_height, 6, fill=True, stroke=True)
        
        c.setFillColor(colors.HexColor("#1e3a8a"))
        c.setFont("Helvetica-Bold", 11.5)
        c.drawString(bx + 12, y + 185, s["num"])
        
        c.setFillColor(colors.HexColor("#ef4444"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(bx + 12, y + 165, s["title"])
        
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.line(bx + 8, y + 155, bx + box_width - 8, y + 155)
        
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont("Helvetica", 9.5)
        dy = y + 130
        for line in s["desc"]:
            c.drawString(bx + 12, dy, line)
            dy -= 20
            
    # Bottom Row: Core Performance Benchmarks
    c.setFillColor(colors.HexColor("#1e293b"))
    c.roundRect(40, 70, 710, 130, 8, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12.5)
    c.drawString(60, 170, "EVALUATION PERFORMANCE BENCHMARKS (END-TO-END)")
    
    benchmarks = [
        ("8-Second Lead Time", "Queries live RSS/GDELT feeds continuously in the background."),
        ("< 200ms Early Stop", "Low-risk signals are gated immediately to prevent downstream runs."),
        ("< 2.5s Execution", "Runs full 6-agent pipeline from raw news signal to Cabinet briefing."),
        ("Multi-Key Rotation", "Rotates active Gemini keys to completely eliminate 429 errors.")
    ]
    
    for idx, (b_title, b_desc) in enumerate(benchmarks):
        x = 60 + idx * 175
        c.setFillColor(colors.HexColor("#38bdf8"))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x, 140, b_title)
        
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont("Helvetica", 9.5)
        words = b_desc.split()
        c.drawString(x, 120, " ".join(words[:3]))
        if len(words) > 3:
            c.drawString(x, 104, " ".join(words[3:]))
            
    draw_footer_bar(c, 5)
    c.showPage()
    
    # ==================== SLIDE 6: FEATURES ====================
    draw_top_bar(c, "FEATURES")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Our Core Computational Features")
    
    # 4-Box Grid Layout
    boxes = [
        {"title": "Pydantic Event Extractor (Agent 1)", "color": "#eff6ff", "border": "#60a5fa",
         "bullets": ["• Replaced keywords with Gemini JSON schema extraction.", "• Extracts type, dates, severity, & affected corridors.", "• Resolves raw text entities dynamically to Graph IDs.", "• Built a robust local keyword parser fallback."]},
        {"title": "Grounded Monte Carlo Forecaster (Agent 2)", "color": "#faf5ff", "border": "#c084fc",
         "bullets": ["• Projects 5,000-path pricing paths using GBM.", "• Uses real spot prices from the US EIA API.", "• Volatility parameter calibrated on historical FRED data.", "• Produces explicit, testable scenario assumptions."]},
        {"title": "Adaptive LP Procurement Rerouter (Agent 3)", "color": "#f0fdf4", "border": "#4ade80",
         "bullets": ["• SciPy LP optimization solver replaces static lists.", "• Minimizes cost, transit times, & route risk.", "• Restricts allocation to active suppliers (ADNOC/US).", "• Checks API gravity & sulfur grade compatibility."]},
        {"title": "Active Cavern Planner (Agent 4)", "color": "#fff7ed", "border": "#fb923c",
         "bullets": ["• Schedules releasing caverns (Padur/Mangaluru/Vizag).", "• Keeps refiners above 70% min operating thresholds.", "• Sets replenishment triggers once price drops below ceiling:", "  Buy Price Ceiling = Peak Price * 0.90"]}
    ]
    
    positions = [
        (40, 275),   # Top Left
        (410, 275),  # Top Right
        (40, 75),    # Bottom Left
        (410, 75)    # Bottom Right
    ]
    
    for idx, (x, y) in enumerate(positions):
        b = boxes[idx]
        c.setFillColor(colors.HexColor(b["color"]))
        c.setStrokeColor(colors.HexColor(b["border"]))
        c.setLineWidth(1.5)
        c.roundRect(x, y, 340, 180, 8, fill=True, stroke=True)
        
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 12.5)
        c.drawString(x + 15, y + 150, b["title"])
        
        c.setStrokeColor(colors.HexColor(b["border"]))
        c.line(x + 12, y + 140, x + 328, y + 140)
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 9.5)
        by = y + 115
        for bullet in b["bullets"]:
            c.drawString(x + 15, by, bullet)
            by -= 22
            
    c.setLineWidth(1)
    draw_footer_bar(c, 6)
    c.showPage()
    
    # ==================== SLIDE 7: USP ====================
    draw_top_bar(c, "USP (DIFFERENCE FROM TRADITIONAL SOLUTIONS)")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(PAGE_WIDTH / 2, 495, "Why PetroShield AI is the Industry Standard")
    
    # Comparison table
    headers = ["Dimension", "Traditional Excel-Based Systems", "Our PetroShield AI Implementation"]
    rows = [
        ("Realism", "Mock Data: Fictional templates and static reports.", "Live Grounded Data: Direct EIA API + live RSS streams."),
        ("Parsing", "Keyword Match: Scanning misses negations & context.", "Gemini Pydantic: Deep semantic context extraction."),
        ("Decisions", "Siloed Worksheets: Logistics and storage separated.", "SciPy LP Solver: Fuses cost, grades & wait times in one LP."),
        ("Robustness", "Hangs on Failure: API rate limits crash the pipeline.", "Key Rotation: Alternates keys; features local fallbacks."),
        ("Safety", "Unverified: Cabinet signs briefs without verification.", "Double-Audited: Gemini AI validates physical cavern limits.")
    ]
    
    x_coords = [40, 180, 460]
    ty = 410
    
    # Headers
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 11.5)
    c.drawString(x_coords[0], ty, headers[0])
    c.drawString(x_coords[1], ty, headers[1])
    c.drawString(x_coords[2], ty, headers[2])
    
    c.setStrokeColor(colors.HexColor("#94a3b8"))
    c.setLineWidth(1.5)
    c.line(40, ty - 8, 750, ty - 8)
    c.setLineWidth(1)
    
    ty -= 32
    for r in rows:
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(x_coords[0], ty, r[0])
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 9.5)
        c.drawString(x_coords[1], ty, r[1])
        c.drawString(x_coords[2], ty, r[2])
        
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.line(40, ty - 8, 750, ty - 8)
        ty -= 35
        
    # Highlight Box at Bottom
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.roundRect(40, 70, 710, 100, 6, fill=True, stroke=True)
    c.setFillColor(colors.HexColor("#ef4444"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(60, 140, "Core Differentiation Value:")
    c.setFillColor(colors.HexColor("#1e293b"))
    c.setFont("Helvetica", 10)
    c.drawString(60, 120, "By embedding mathematical agents (Agent 1-5) underneath an Generative AI Auditor (Agent 6), PetroShield resolves")
    c.drawString(60, 102, "the classic 'Hallucination Problem' of LLMs while preserving full natural language explainability for policymakers.")
    
    draw_footer_bar(c, 7)
    c.showPage()
    
    # ==================== SLIDE 8: TECH STACK ====================
    draw_top_bar(c, "TECH STACK")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Platform Technologies Used in Our Implementation")
    
    # Three stack boxes
    stacks = [
        {"title": "Backend (Python)", "color": "#f0fdf4", "border": "#4ade80", "color_lbl": "#156534",
         "items": ["• FastAPI: High-speed REST/WS routers.", "• NetworkX: Semantic Directed Graph DB.", "• SciPy & NumPy: LP optimizer solvers.", "• Uvicorn: Async server process gateway."]},
        {"title": "Frontend (TypeScript)", "color": "#eff6ff", "border": "#60a5fa", "color_lbl": "#1e40af",
         "items": ["• Next.js 16: Server-rendered dashboard.", "• Leaflet.js: Interactive GIS mapping.", "• Recharts: Monte Carlo price graphics.", "• WebSockets: Live log/alert terminals."]},
        {"title": "AI & Data Layer", "color": "#faf5ff", "border": "#c084fc", "color_lbl": "#6b21a8",
         "items": ["• Google Gemini API: Audit & narrative briefs.", "• Multi-Key Rotation: 429 quota guard.", "• EIA API v2: Spot pricing stream.", "• AISStream WebSockets: Telemetry feeds."]}
    ]
    
    card_width = 220
    card_height = 350
    gap = 25
    start_x = 55
    y = 90
    
    for idx, s in enumerate(stacks):
        x = start_x + idx * (card_width + gap)
        
        c.setFillColor(colors.HexColor(s["bg" if "bg" in s else "color"]))
        c.setStrokeColor(colors.HexColor(s["border"]))
        c.setLineWidth(1.5)
        c.roundRect(x, y, card_width, card_height, 8, fill=True, stroke=True)
        
        c.setFillColor(colors.HexColor(s["color_lbl"]))
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x + 15, y + 315, s["title"])
        
        c.setStrokeColor(colors.HexColor(s["border"]))
        c.line(x + 12, y + 300, x + card_width - 12, y + 300)
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 10.5)
        dy = y + 260
        for line in s["items"]:
            c.drawString(x + 15, dy, line)
            dy -= 28
            
    c.setLineWidth(1)
    draw_footer_bar(c, 8)
    c.showPage()
    
    # ==================== SLIDE 9: FUTURE SCOPE ====================
    draw_top_bar(c, "FUTURE SCOPE")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Expansion Roadmap for PetroShield AI Platform")
    
    # 3 Horizontal Roadmap Rows
    roadmap_items = [
        ("Phase 1: Dark Tanker Vessel Tracking (Satellite SAR)", "Integration of synthetic-aperture radar (SAR) satellite imagery to detect and track 'dark vessels' that switch off their AIS transponders near critical chokepoints like the Strait of Hormuz.", "#eff6ff", "#1e3a8a"),
        ("Phase 2: Automated Sanctions Verification", "Direct connection to the OFAC and global compliance databases, automatically blocking imports or shipping charters involving sanctioned shipping registries or blacklisted corporate owners.", "#f0fdf4", "#166534"),
        ("Phase 3: Multi-Commodity sovereign scaling", "Expanding the NetworkX Graph database and SciPy LP optimizers to track and reroute other critical national imports, including LNG pipelines, coal maritime lanes, and EV battery minerals.", "#faf5ff", "#6b21a8")
    ]
    
    y = 350
    for idx, (p_title, p_desc, bg, text_col) in enumerate(roadmap_items):
        c.setFillColor(colors.HexColor(bg))
        c.roundRect(40, y, PAGE_WIDTH - 80, 100, 6, fill=True, stroke=False)
        
        c.setFillColor(colors.HexColor(text_col))
        c.setFont("Helvetica-Bold", 13)
        c.drawString(60, y + 70, p_title)
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 10)
        words = p_desc.split()
        line1 = " ".join(words[:14])
        line2 = " ".join(words[14:])
        c.drawString(60, y + 44, line1)
        if line2:
            c.drawString(60, y + 26, line2)
            
        y -= 130
        
    draw_footer_bar(c, 9)
    c.showPage()
    
    # ==================== SLIDE 10: SCALABILITY ====================
    draw_top_bar(c, "SCALABILITY")
    
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 495, "Commercial Feasibility & Platform Scaling Models")
    
    # 3 vertical scalability cards
    models = [
        {"title": "Sovereign Command Center", "icon": "Gov", "color": "#eff6ff", "border": "#60a5fa", "lbl": "#1e40af",
         "items": ["• Sold as custom tactical dashboards", "  for oil-importing governments.", "• Integrates direct state SCADA", "  inventories and reserve cavern", "  drawdown controllers securely."]},
        {"title": "Enterprise B2B SaaS", "icon": "Corp", "color": "#f0fdf4", "border": "#4ade80", "lbl": "#166534",
         "items": ["• Licensable to private refinery", "  giants (Reliance, Nayara, Rosneft).", "• Optimizes commercial shipping", "  logistics and manages fuel hedging", "  risk portfolios dynamically."]},
        {"title": "Cloud-Scale Simulations", "icon": "Cloud", "color": "#faf5ff", "border": "#c084fc", "lbl": "#6b21a8",
         "items": ["• Containerized deployment using", "  Kubernetes clusters.", "• Scales Monte Carlo models to", "  1,000,000 parallel path simulations", "  for global commodity trading desks."]}
    ]
    
    card_width = 220
    card_height = 350
    gap = 25
    start_x = 55
    y = 90
    
    for idx, m in enumerate(models):
        x = start_x + idx * (card_width + gap)
        
        c.setFillColor(colors.HexColor(m["color"]))
        c.setStrokeColor(colors.HexColor(m["border"]))
        c.setLineWidth(1.5)
        c.roundRect(x, y, card_width, card_height, 8, fill=True, stroke=True)
        
        c.setFillColor(colors.HexColor(m["lbl"]))
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x + 15, y + 315, m["title"])
        
        c.setStrokeColor(colors.HexColor(m["border"]))
        c.line(x + 12, y + 300, x + card_width - 12, y + 300)
        
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 10)
        dy = y + 265
        for bullet in m["items"]:
            c.drawString(x + 15, dy, bullet)
            dy -= 24
            
    c.setLineWidth(1)
    draw_footer_bar(c, 10)
    c.showPage()
    
    # Save the PDF document
    c.save()
    print(f"[SUCCESS] PDF generated at {pdf_path}")

if __name__ == "__main__":
    build_pdf()
