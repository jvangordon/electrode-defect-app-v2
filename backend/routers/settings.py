from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List
from db import get_cursor

router = APIRouter(tags=["settings"])

# Original default values for reset
DEFAULTS = {
    "spc_z_threshold": "1.5",
    "defect_rate_anomaly_threshold": "0.05",
    "car_deck_high_risk_cutoff": "7",
    "lot_high_risk_defect_rate": "0.05",
}

ORIGINAL_COMPOSITION_RISK = [
    ("Q1", 0.012, 0.02, 45),
    ("Q2", 0.025, 0.05, 52),
    ("Q3", 0.042, 0.12, 48),
    ("Q4", 0.065, 0.25, 38),
    ("Q5", 0.098, 0.55, 30),
]

ORIGINAL_RISK_FACTORS = [
    ("furnace", "BF-1", "low"), ("furnace", "BF-2", "low"), ("furnace", "BF-3", "high"),
    ("furnace", "BF-4", "medium"), ("furnace", "BF-5", "low"), ("furnace", "BF-6", "low"),
    ("position", "Deck 1-3", "low"), ("position", "Deck 4-5", "low"),
    ("position", "Deck 6-7", "medium"), ("position", "Deck 8-9", "high"),
    ("profile", "STD-A", "low"), ("profile", "STD-B", "low"),
    ("profile", "SLOW-C", "medium"), ("profile", "FAST-D", "high"),
    ("blend", "Premium-A", "low"), ("blend", "Standard-B", "low"),
    ("blend", "Economy-C", "medium"), ("blend", "Blend-D", "high"),
    ("config", "Full-14", "low"), ("config", "Partial-10", "medium"),
    ("config", "Mixed-12", "medium"), ("config", "Full-14-HD", "high"),
    ("diameter", "300mm", "low"), ("diameter", "400mm", "low"),
    ("diameter", "500mm", "medium"), ("diameter", "600mm", "high"),
]


class CompositionRiskUpdate(BaseModel):
    quintile: int = Field(ge=1, le=5)
    avg_defect_rate: float = Field(ge=0.0, le=1.0)
    probability_high_defect_event: float = Field(ge=0.0, le=1.0)


class RiskFactorUpdate(BaseModel):
    id: int
    risk_group: str = Field(pattern=r'^(low|medium|high)$')


class SettingsUpdate(BaseModel):
    spc_z_threshold: Optional[float] = Field(None, ge=0.5, le=5.0)
    defect_rate_anomaly_threshold: Optional[float] = Field(None, ge=0.001, le=1.0)
    car_deck_high_risk_cutoff: Optional[int] = Field(None, ge=1, le=9)
    lot_high_risk_defect_rate: Optional[float] = Field(None, ge=0.001, le=1.0)
    composition_risk: Optional[List[CompositionRiskUpdate]] = None
    risk_factors: Optional[List[RiskFactorUpdate]] = None


@router.get("/settings")
def get_settings():
    with get_cursor() as cur:
        cur.execute("SELECT key, value, description, updated_at FROM app_settings")
        rows = cur.fetchall()
        settings = {r["key"]: {"value": r["value"], "description": r["description"], "updated_at": r["updated_at"]} for r in rows}

        cur.execute("SELECT * FROM composition_risk ORDER BY quintile")
        composition_risk = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT id, factor_name, factor_level, risk_group, defect_rate, n_electrodes, p_value FROM risk_factors ORDER BY factor_name, factor_level")
        risk_factors = [dict(r) for r in cur.fetchall()]

    return {
        "settings": settings,
        "composition_risk": composition_risk,
        "risk_factors": risk_factors,
    }


@router.patch("/settings")
def update_settings(body: SettingsUpdate):
    data = body.model_dump(exclude_unset=True)
    with get_cursor(commit=True) as cur:
        # Update app_settings key-value pairs
        for key in DEFAULTS:
            if key in data:
                cur.execute(
                    "UPDATE app_settings SET value = %s, updated_at = NOW() WHERE key = %s",
                    (str(data[key]), key),
                )

        # Update composition_risk rows
        if "composition_risk" in data and data["composition_risk"]:
            for row in data["composition_risk"]:
                cur.execute(
                    "UPDATE composition_risk SET avg_defect_rate = %s, probability_high_defect_event = %s WHERE quintile = %s",
                    (row["avg_defect_rate"], row["probability_high_defect_event"], row["quintile"]),
                )

        # Update risk_factors
        if "risk_factors" in data and data["risk_factors"]:
            for row in data["risk_factors"]:
                cur.execute(
                    "UPDATE risk_factors SET risk_group = %s WHERE id = %s",
                    (row["risk_group"], row["id"]),
                )

    return {"ok": True}


@router.post("/settings/reset")
def reset_settings():
    with get_cursor(commit=True) as cur:
        # Reset app_settings
        for key, value in DEFAULTS.items():
            cur.execute("UPDATE app_settings SET value = %s, updated_at = NOW() WHERE key = %s", (value, key))

        # Reset composition_risk
        for q, avg_dr, prob, rc in ORIGINAL_COMPOSITION_RISK:
            cur.execute(
                "UPDATE composition_risk SET avg_defect_rate = %s, probability_high_defect_event = %s, run_count = %s WHERE quintile = %s",
                (avg_dr, prob, rc, q),
            )

        # Reset risk_factors
        for factor_name, factor_level, risk_group in ORIGINAL_RISK_FACTORS:
            cur.execute(
                "UPDATE risk_factors SET risk_group = %s WHERE factor_name = %s AND factor_level = %s",
                (risk_group, factor_name, factor_level),
            )

    return {"ok": True}
