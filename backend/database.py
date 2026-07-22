from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SimulatedScenario(Base):
    __tablename__ = "simulated_scenarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    scenario_title = Column(String(255), index=True)
    raw_signal = Column(Text)
    source_type = Column(String(50), default="NEWS")
    
    # Calculated Metrics
    disruption_probability = Column(Float, default=0.0)
    severity = Column(String(50), default="ALERT")
    estimated_supply_impact_mbpd = Column(Float, default=0.0)
    brent_price_mean = Column(Float, default=82.5)
    gdp_impact_pct = Column(Float, default=0.0)
    import_cost_increase_usd_bn = Column(Float, default=0.0)
    spr_release_rate_mbpd = Column(Float, default=0.0)
    spr_runway_days = Column(Integer, default=34)
    
    # Audit & Narratives
    audit_verdict = Column(String(100), default="VERIFIED AND APPROVED")
    executive_narrative = Column(Text, nullable=True)
    report_json = Column(Text, nullable=True)
    pdf_filename = Column(String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if self.created_at else "",
            "date_display": self.created_at.strftime("%d %b %Y, %H:%M UTC") if self.created_at else "",
            "scenario_title": self.scenario_title,
            "raw_signal": self.raw_signal,
            "source_type": self.source_type,
            "disruption_probability": self.disruption_probability,
            "severity": self.severity,
            "estimated_supply_impact_mbpd": self.estimated_supply_impact_mbpd,
            "brent_price_mean": self.brent_price_mean,
            "gdp_impact_pct": self.gdp_impact_pct,
            "import_cost_increase_usd_bn": self.import_cost_increase_usd_bn,
            "spr_release_rate_mbpd": self.spr_release_rate_mbpd,
            "spr_runway_days": self.spr_runway_days,
            "audit_verdict": self.audit_verdict,
            "executive_narrative": self.executive_narrative,
            "report_json": self.report_json,
            "pdf_filename": self.pdf_filename
        }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _seed_initial_history_if_empty()


def _seed_initial_history_if_empty():
    """Seeds initial historic scenarios if database table is empty."""
    db = SessionLocal()
    try:
        count = db.query(SimulatedScenario).count()
        if count == 0:
            seeds = [
                SimulatedScenario(
                    created_at=datetime(2026, 5, 10, 14, 30),
                    scenario_title="Strait of Hormuz Blockade — Master Incident Briefing",
                    raw_signal="Iran blockades Strait of Hormuz naval corridor following maritime escalation.",
                    source_type="OFFICIAL_PRESS_WIRE",
                    disruption_probability=84.5,
                    severity="CRITICAL",
                    estimated_supply_impact_mbpd=1.40,
                    brent_price_mean=96.40,
                    gdp_impact_pct=-0.45,
                    import_cost_increase_usd_bn=14.20,
                    spr_release_rate_mbpd=1.15,
                    spr_runway_days=34,
                    audit_verdict="VERIFIED AND APPROVED",
                    executive_narrative="Cabinet Audit Commission verified: Disruption risk remains elevated across active corridors.",
                    pdf_filename="Master_Hormuz_Blockade_Incident_Report.pdf"
                ),
                SimulatedScenario(
                    created_at=datetime(2026, 5, 9, 10, 15),
                    scenario_title="Red Sea Bab-el-Mandeb Attack — Master Incident Briefing",
                    raw_signal="Houthi drone strikes target VLCC tankers transiting Bab-el-Mandeb corridor.",
                    source_type="INTELLIGENCE_FEED",
                    disruption_probability=74.0,
                    severity="ELEVATED",
                    estimated_supply_impact_mbpd=0.85,
                    brent_price_mean=91.20,
                    gdp_impact_pct=-0.28,
                    import_cost_increase_usd_bn=8.60,
                    spr_release_rate_mbpd=0.65,
                    spr_runway_days=42,
                    audit_verdict="VERIFIED AND APPROVED",
                    executive_narrative="Rerouting around Cape of Good Hope adds +14 days transit delay to Sikka terminals.",
                    pdf_filename="Master_RedSea_Attack_Incident_Report.pdf"
                ),
                SimulatedScenario(
                    created_at=datetime(2026, 5, 8, 18, 45),
                    scenario_title="OPEC+ Emergency Supply Cut — Master Incident Briefing",
                    raw_signal="OPEC+ announces emergency production cut of 2.0 mbpd across Gulf producers.",
                    source_type="OFFICIAL_PRESS_WIRE",
                    disruption_probability=62.0,
                    severity="MODERATE",
                    estimated_supply_impact_mbpd=0.60,
                    brent_price_mean=88.50,
                    gdp_impact_pct=-0.18,
                    import_cost_increase_usd_bn=5.40,
                    spr_release_rate_mbpd=0.35,
                    spr_runway_days=50,
                    audit_verdict="VERIFIED AND APPROVED",
                    executive_narrative="Urals heavy crude purchase allocation increased under OFAC $60/bbl price cap tier.",
                    pdf_filename="Master_OPEC_Supply_Cut_Incident_Report.pdf"
                )
            ]
            db.add_all(seeds)
            db.commit()
            print("[DB] Initial scenario history seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[DB] Error seeding scenario history: {e}")
    finally:
        db.close()
