# PetroShield AI: Master Project Documentation
**AI-Driven Energy Supply Chain Resilience for Import Dependent Economies**

**Team Name:** aseesmakkar45
**Team Members:** Asees Jot Singh, Ashir Chugh, Abhishta Gyanda (DTU)

---

## 1. Executive Summary & The Problem

India imports over 85% of its crude oil, making its national energy security highly dependent on global supply chains. Disruptions at key maritime chokepoints—such as the Strait of Hormuz, the Suez Canal, or the Bab-el-Mandeb Strait—can trigger severe cascading effects including supply shortages, extreme price spikes, and crippling refinery shutdowns.

**Current Limitations (The Problem):**
*   **Reactive Policies:** Actions are typically taken only after the supply shortfall manifests at port terminals or crude price spikes hit the market.
*   **Siloed Excel Analysis:** Disjointed manual calculations of freight rates, port wait days, and crude compatibilities slow down emergency response.
*   **Binary Risks:** 'Risk / No Risk' alerts fail to model prior probabilities or confidence intervals accurately.
*   **No Automated Auditing:** Manual validation of intelligence reports slows down Cabinet Secretary approvals.

---

## 2. The Solution: PetroShield AI

PetroShield AI is an autonomous, pre-emptive digital twin that protects India's oil supply chain by continuously linking global geopolitical events, shipping logistics, refinery operations, and strategic petroleum reserves (SPR).

Unlike conventional systems that rely solely on Large Language Models (LLMs) which often hallucinate numerical outputs, or spreadsheet models which lack contextual geopolitical understanding, PetroShield combines the strengths of both in a **Dual-Layer Hybrid Architecture (Math + AI)**.

At its core, the system features a highly advanced **Semantic RAG (Retrieval-Augmented Generation) Engine**. It doesn't just read news; it deeply understands the semantic context of unstructured data and maps it mathematically to physical supply chain nodes.

### The 3-Pillar AI Architecture:
1.  **Graph-RAG Semantic Mapping (The Brain):** The system models India's entire energy import network (ports, shipping lanes, caverns, refineries) as a directed semantic graph in NetworkX. Natural language news (from GDELT and other resource data) is resolved dynamically via a Graph-RAG pipeline, matching raw text entities directly to physical graph nodes. It extracts conflict severity, affected targets, and durations, converting unstructured news into structured variables.
2.  **Scenario Modeller (The Forecast):** A Python mathematical engine that runs a 5,000-path Monte Carlo Geometric Brownian Motion (GBM) simulation, calibrated against historical US EIA and FRED volatility data to project dynamic price trajectories.
3.  **Procurement Orchestrator (The Action):** A SciPy Linear Programming (LP) optimization engine that computes optimal alternative cargo allocations (e.g., Russian Urals vs. WTI Midland). It minimizes freight costs and transit times while adhering strictly to refinery API gravity and sulfur limits.

---

## 3. System Architecture & The 6-Stage Autonomous Cascade

PetroShield AI's backend is powered by FastAPI, utilizing asynchronous WebSockets to push live calculations to a Next.js (App Router) React dashboard. 

The core innovation is the **6-Stage Autonomous Pipeline**:

1.  **Ingestion Layer:** The Autonomous Brain continuously polls the GDELT Project API, Open-Meteo marine weather, and AIS telemetry to detect geopolitical trigger events.
2.  **Bayesian Risk Scoring Engine:** Agent 1 (Risk Intel) extracts conflict severity and affected targets.
3.  **Decision Gating & Auditing:** Agent 1.5 (Groq Risk Auditor) independently validates the LLM’s predicted supply disruption volume to eliminate hallucinations.
4.  **Mitigation Engines:** Agents 2, 3, and 4 (Scenario Modeller, Procurement Orchestrator, and SPR Advisor) execute deterministic SciPy and NumPy logic to optimize rerouting and cavern drawdown schedules.
5.  **Groq Executive Auditor (Agent 6):** An adversarial supervisor agent reviews the generated plain-language Cabinet Briefing against the raw physical capacity limits to ensure 100% accuracy.
6.  **Digital Twin Dashboard:** The Geospatial map (Leaflet) flashes red, the Digital Twin node graph severs the impacted chokepoint, and the terminal streams live WebSocket logs to the human operators.

---

## 4. Unique Selling Propositions (USPs)

*   **Semantic Data Grounding (Graph-RAG):** The system excels at semantic understanding. It bypasses static templates by continuously ingesting unstructured news feeds and using natural language comprehension to map threats directly onto a mathematical supply chain graph.
*   **Dual-Layer Hybridization:** Fuses LLM natural language understanding with deterministic mathematical solvers (SciPy, NetworkX, GBM) to eliminate hallucinations.
*   **Pre-emptive Response Horizon:** Simulates supply deficits and price impacts weeks before delayed cargo ships reach affected zones.
*   **Physical Capacity Auditing:** Decisions are not just compiled; they are strictly audited by a supervisory agent against physical capacity limits in the directed energy graph before recommendations are published.

---

## 5. Commercial Feasibility & Market Potential

**Target Market Segments:**
*   **Sovereign Agencies:** Ministry of Petroleum & Natural Gas, Indian Strategic Petroleum Reserves Limited (ISPRL), National Defense Intelligence.
*   **Commodity Trading Desks:** Global oil trading desks needing real-time price volatility projections to execute hedges.
*   **Private Refiner Conglomerates:** Enterprise giants (e.g., Reliance, Nayara, Shell, BP) seeking to optimize cargo imports.

**Monetization Pathways:**
1.  **Sovereign Licensing:** Long-term custom command center development contracts with annual OPEX maintenance fees.
2.  **Enterprise B2B SaaS:** Annual subscription model calculated per active refinery site, giving access to the SciPy LP Solver and crude-grade matching APIs.
3.  **Data API Feeds:** Subscription-based developer keys to access clean, resolved chokepoint threat databases and AIS vessel delay alerts.

---

## 6. Future Scope & Scalability

1.  **Phase 1: Satellite SAR Integration (Dark Vessel Tracking):** Integrate Synthetic Aperture Radar (SAR) to detect "dark" tankers that disable their AIS transponders near chokepoints to bypass sanctions.
2.  **Phase 2: Automated Global Sanctions Verification:** Connect the NetworkX supply chain graph to live OFAC, EU, and international trade registries to automatically exclude sanctioned suppliers.
3.  **Phase 3: Adaptive Neural Sourcing Optimizers (DRL):** Replace static Linear Programming with Deep Reinforcement Learning (DRL) agents to optimize maritime routing under dynamic weather, canal tariffs, and piracy threats simultaneously.

---
*Generated by PetroShield AI Command Center*
