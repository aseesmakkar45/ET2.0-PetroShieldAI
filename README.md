<div align="center">

# 🛡️ PetroShield AI

### The AI Bridge to Energy Supply Chain Resilience

#### An autonomous agentic decision engine that monitors global geopolitical events, predicts supply chain disruptions, and orchestrates strategic petroleum reserves (SPR) and procurement rerouting in real-time.

<p>

[![LLM](https://img.shields.io/badge/Primary_LLM-Llama_3_70B-blue?style=for-the-badge&logo=meta&logoColor=white)]()
[![Optimization](https://img.shields.io/badge/Math-SciPy_LP-darkred?style=for-the-badge&logo=scipy&logoColor=white)]()
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)]()
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)]()
[![Realtime](https://img.shields.io/badge/Realtime-WebSockets-orange?style=for-the-badge)]()
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)]()

</p>

---

### 🚀 Built during a hackathon. Designed for national energy security.

**🌍 Autonomous Monitoring • 📊 Live Digital Twin • 🧮 SciPy Optimization • 🚢 Geospatial Intelligence • ⚡ Real-Time WebSockets**

[Features](#-core-features) •
[Architecture](#-system-architecture) •
[Installation](#-installation) •
[Roadmap](#-future-roadmap)

</div>

---

# 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Why PetroShield AI?](#-why-petroshield-ai)
- [Core Features](#-core-features)
- [System Architecture](#-system-architecture)
- [The Autonomous Agent Lifecycle](#-the-autonomous-agent-lifecycle)
- [AI & Mathematical Capabilities](#-ai--mathematical-capabilities)
- [Tech Stack](#-tech-stack)
- [Installation & Usage](#-installation--usage)
- [Engineering Decisions](#-engineering-decisions)
- [Future Roadmap](#-future-roadmap)

---

# 📖 Project Overview

PetroShield AI is an enterprise-grade, open-source AI Command Center designed for national energy bodies (like the Ministry of Petroleum and Natural Gas and ISPRL) to safeguard a country's crude oil supply chain.

Global energy supply chains are incredibly fragile. A single geopolitical event—a blockade in the Strait of Hormuz, a sudden OPEC+ production cut, or regional conflicts—can cascade into national fuel shortages and massive economic distress. Human analysts struggle to process global news feeds, run Monte Carlo simulations on oil prices, and calculate linear programming optimizations for tanker rerouting simultaneously in real-time.

PetroShield AI approaches this problem from an **agentic, autonomous perspective**. 

Instead of waiting for human input, an autonomous "brain" continuously monitors global news via the GDELT project. When a severe threat is detected, it triggers a cascade of 5 specialized AI agents. These agents don't just chat; they parse shipping lane data, run mathematical optimizations (via SciPy), simulate price volatility, and orchestrate alternative cargo routes. The result is a polished, actionable briefing delivered to a real-time Geospatial Command Center.

---

# ❓ Why PetroShield AI?

Large Language Models (LLMs) are excellent at reasoning—but national energy security requires more than just text generation. 

It requires **deterministic mathematics**, **live geospatial data**, and **multi-objective optimization**. A standard LLM cannot calculate the most cost-effective way to reroute 5 VLCC tankers around the Cape of Good Hope while minimizing port congestion at Sikka.

PetroShield AI therefore follows an **Agentic + Mathematical** architecture.

Instead of directly asking an LLM to solve the crisis, the application:
- Uses LLMs to continuously parse and score global news streams (GDELT).
- Extracts structured parameters (impacted chokepoints, volume lost).
- Feeds these parameters into deterministic Python engines (Geometric Brownian Motion for prices, SciPy Linear Programming for cargo rerouting).
- Uses LLMs again to format these raw mathematical outputs into plain-language executive briefings.

The goal is **not to replace human decision-makers.**
The goal is to provide Cabinet Secretaries and Taskforce Leaders with instant, mathematically-backed options the moment a crisis occurs, reducing response times from days to seconds.

---

# ✨ Core Features

## 🏢 Command Center Experience

| Feature | Description |
|----------|-------------|
| 🌍 Geospatial Risk Intel | Live interactive map (Leaflet) tracking global chokepoints, shipping lanes, and Indian refineries. |
| ⛈️ Real-Time Weather | Integration with Open-Meteo Marine API to track live wave heights and cyclone risks affecting tanker routes. |
| 📊 Supply Chain Digital Twin | A live visual node-graph modeling the flow of crude from global suppliers through chokepoints to domestic SPR caverns. |
| ⚡ Real-Time WebSockets | Instantly pushes detected threats and agent calculations to the dashboard without requiring a page refresh. |
| 📄 Executive Briefings | Auto-generated, 3-sentence plain-language briefings designed for Cabinet-level review. |

---

## 🤖 AI & Mathematical Capabilities

| Capability | Description |
|------------|-------------|
| 5-Agent Cascade | A modular pipeline of specialized agents (Risk Intel, Scenario, Procurement, SPR, Executive) working in sequence. |
| SciPy Linear Optimization | Multi-objective LP solver allocating alternative crude suppliers based on grade compatibility, freight costs, and port congestion. |
| Monte Carlo Price Simulation | 10,000 paths of Geometric Brownian Motion (GBM) forecasting Brent Crude spikes over a 30-day horizon. |
| GDELT Autonomous Brain | A background loop that continuously queries the GDELT database, filtering and scoring real-world news for supply chain risks. |
| Knowledge Graph Grounding | RAG-like capabilities ensuring the LLM understands the specific constraints of Indian refineries (e.g., Sikka, Jamnagar). |

---

# 🏗 System Architecture

PetroShield AI follows a highly decoupled architecture separating the React frontend from the heavy Python compute backend.

```mermaid
flowchart LR

subgraph External Feeds
GDELT["📰 GDELT News"]
Weather["⛈️ Open-Meteo"]
end

subgraph Backend (FastAPI)
Brain["🧠 Autonomous Brain Loop"]
A1["🕵️ Risk Intel Agent"]
A2["📈 Scenario Modeler"]
A3["🧮 Procurement LP Optimizer"]
A4["🛢️ SPR Advisor"]
A5["📝 Executive Briefing Agent"]
WS["⚡ WebSocket Broadcaster"]
end

subgraph Frontend (Next.js)
Map["🌍 Geospatial Map"]
Twin["📊 Digital Twin"]
Orchestrator["🛒 Procurement Orchestrator"]
end

GDELT --> Brain
Brain --> A1
A1 --> A2
A2 --> A3
A2 --> A4
A3 --> A5
A4 --> A5
A5 --> WS
Weather --> Map
WS --> Map
WS --> Twin
WS --> Orchestrator
```

---

# 🔄 The Autonomous Agent Lifecycle

The core innovation of PetroShield AI is its 5-stage agentic pipeline. Here is exactly what happens when a crisis occurs:

### 1. The Trigger (Autonomous Brain)
A background process polls GDELT every few minutes. It detects a news article: *"Rebels attack tanker in Bab-el-Mandeb Strait."* The LLM scores this a 9/10 risk and triggers the cascade.

### 2. Risk Intelligence Agent
Analyzes the event. It identifies that the Bab-el-Mandeb chokepoint is blocked. It calculates the immediate volume of crude oil delayed and flags the primary downstream victim: Sikka Port, India.

### 3. Scenario Modeler Agent
Takes the delayed volume and runs historical volatility calibrations against FRED data. It executes a Monte Carlo simulation (Geometric Brownian Motion) to predict how much Brent Crude prices will spike over the next 30 days due to this specific shortage.

### 4. Procurement Orchestrator Agent (The Math Engine)
Realizes Sikka Port will run out of oil. It formulates a Linear Programming matrix using `SciPy`. It evaluates alternative suppliers (e.g., Russian Urals via the Baltic, Saudi Yanbu pipeline) based on crude grade compatibility, freight costs, and transit times, outputting the optimal cargo rerouting plan.

### 5. SPR Advisor Agent
Calculates how many days the Jamnagar refinery can survive before the new cargo arrives. It authorizes a precise, temporary drawdown from the Padur and Mangaluru Strategic Petroleum Reserve caverns to bridge the gap.

### 6. Executive Briefing Agent
Translates all the math, vectors, and optimizations into a 3-sentence summary for the Cabinet Secretary. This brief, along with all the data, is pushed instantly via WebSockets to the Next.js frontend.

---

# ⚙ Engineering Decisions

- **Why SciPy instead of just LLMs?** LLMs are terrible at math. Asking an LLM to solve a multi-variable logistics problem results in hallucinations. We use LLMs to extract parameters, but hand the actual decision math over to deterministic linear solvers.
- **Why WebSockets?** In a national security context, hitting "refresh" is unacceptable. The frontend maintains an open WebSocket connection, allowing the backend to push alerts the millisecond the Autonomous Brain detects them.
- **Why Groq?** Speed. The 5-agent cascade requires sequential LLM calls. Using Groq's LPU inference for Llama 3 70B reduces the pipeline execution time from minutes to roughly ~5 seconds.
- **Free-Tier Resilience:** We intentionally opted for Open-Meteo and GDELT to ensure the platform requires zero paid API keys to run its core monitoring features.

---

# 💻 Installation & Usage

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Activate venv (Windows)
.\venv\Scripts\activate
# Activate venv (Mac/Linux)
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory and add your Groq API key:
```env
GROQ_API_KEYS=your_api_key_here
```

Start the backend:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*The Autonomous Brain will begin polling immediately.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000` to view the Command Center.

---

# 🔮 Future Roadmap

- **AIS Satellite Integration:** Move from simulated vessel tracks to live Automatic Identification System (AIS) transponder data for real-time tanker monitoring.
- **Predictive Weather Routing:** Connect the Open-Meteo cyclone data directly into the Procurement Agent's SciPy optimizer to automatically reject routes passing through severe storms.
- **Multi-Modal Document Parsing:** Allow users to upload PDF shipping manifests and bills of lading for the LLM to extract volumetric data automatically. 

---
<div align="center">
<i>Protecting National Energy Security through Artificial Intelligence</i>
</div>
