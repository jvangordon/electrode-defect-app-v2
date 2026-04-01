"""
Seed script for Electrode Defect Reduction System v2.

Creates the electrode_v2 database, all tables, and populates with realistic
manufacturing data that tells a coherent story:
  - Furnace BF-3 shows degradation over recent months
  - High car decks (8-9) produce ~70% more downstream defects
  - Edge positions in graphite (1-2, 13-14) have ~3x defect rate
  - ~10% of lots are high-risk with 15-20% defect rates
  - Sensor data for bad runs shows higher variability
  - Mix of open/in-progress/closed investigations with overdue actions
"""

import os
import sys
import random
import hashlib
import logging
from datetime import datetime, timedelta
from contextlib import contextmanager

import numpy as np
import psycopg2
import psycopg2.extras

# Reproducible
np.random.seed(42)
random.seed(42)

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = "electrode_v2"

BAKE_FURNACES = [f"BF-{i}" for i in range(1, 7)]       # BF-1..BF-6
GRAPHITE_FURNACES = [f"CT-{i}" for i in range(1, 12)]   # CT-1..CT-11
DEGRADING_FURNACE = "BF-3"

START_DATE = datetime(2024, 10, 1)
END_DATE = datetime(2026, 3, 31)

BAKE_CURVES = ["STD-A", "STD-B", "SLOW-C", "FAST-D"]
GRAPHITE_PROFILES = ["P1-Standard", "P2-Extended", "P3-HighPower", "P4-LowEnergy"]
LOAD_CONFIGS = ["Full-14", "Partial-10", "Mixed-12", "Full-14-HD"]
DIAMETERS = [300, 350, 400, 450, 500, 550, 600]
COKE_BLENDS = ["Premium-A", "Standard-B", "Economy-C", "Blend-D"]

DEFECT_CODES = ["CR-1", "CR-2", "SP-1", "SP-2", "BK-1", "LN-1", "PR-1", "SFC-1"]
DEFECT_NAMES = {
    "CR-1": "Longitudinal crack",
    "CR-2": "Transverse crack",
    "SP-1": "Surface spalling",
    "SP-2": "Deep spalling",
    "BK-1": "Breakage",
    "LN-1": "Longitudinal notch",
    "PR-1": "Porosity excess",
    "SFC-1": "Surface contamination",
}

ROOT_CAUSE_CATEGORIES = ["furnace", "material", "process", "equipment", "unknown"]
PROCESS_STEPS = [
    "Plant A Extrusion", "Plant A Bake", "Plant A PI", "Plant A Rebake",
    "Plant B Bake", "Plant B PI", "Plant B Rebake", "Plant B Graphite",
    "Plant B Finishing", "Plant B Assembly",
]

PEOPLE = [
    "J. Martinez", "S. Kowalski", "R. Chen", "A. Patel",
    "M. Johansson", "T. Nakamura", "L. Dubois", "K. Singh",
]


def connect_postgres():
    return psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, dbname="postgres")


def connect_db():
    return psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, dbname=DB_NAME)


def create_database():
    conn = connect_postgres()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
    if not cur.fetchone():
        cur.execute(f"CREATE DATABASE {DB_NAME}")
        print(f"Created database {DB_NAME}")
    else:
        print(f"Database {DB_NAME} already exists")
    cur.close()
    conn.close()


DDL = """
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS corrective_actions CASCADE;
DROP TABLE IF EXISTS investigation_notes CASCADE;
DROP TABLE IF EXISTS investigations CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS electrodes CASCADE;
DROP TABLE IF EXISTS runs CASCADE;
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS equipment_monthly CASCADE;
DROP TABLE IF EXISTS risk_factors CASCADE;
DROP TABLE IF EXISTS compounding_rates CASCADE;
DROP TABLE IF EXISTS composition_risk CASCADE;

CREATE TABLE lots (
    lot_id TEXT PRIMARY KEY,
    lot_defect_rate REAL,
    lot_electrode_count INTEGER,
    lot_defect_count INTEGER,
    risk_tier TEXT DEFAULT 'normal'
);

CREATE TABLE runs (
    run_number TEXT PRIMARY KEY,
    department TEXT NOT NULL,
    furnace TEXT NOT NULL,
    profile TEXT,
    load_config TEXT,
    car_deck INTEGER,
    total_pieces INTEGER,
    total_weight REAL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    cooling_end_time TIMESTAMP,
    duration_hours REAL,
    actual_kwh REAL,
    total_downtime REAL DEFAULT 0,
    defect_count INTEGER DEFAULT 0,
    defect_rate REAL DEFAULT 0,
    risk_score TEXT
);

CREATE TABLE electrodes (
    gpn TEXT PRIMARY KEY,
    lot TEXT REFERENCES lots(lot_id),
    mo_name TEXT,
    diameter INTEGER,
    coke_blend TEXT,
    weight_kg REAL,
    run_number_ob TEXT REFERENCES runs(run_number),
    car_deck_ob INTEGER,
    load_order_ob INTEGER,
    defect_code_ob TEXT,
    run_number_og TEXT REFERENCES runs(run_number),
    furnace_og TEXT,
    position_og INTEGER,
    profile_og TEXT,
    defect_code_og TEXT,
    defect_code_of TEXT,
    er REAL,
    ad REAL
);

CREATE TABLE sensor_readings (
    id SERIAL PRIMARY KEY,
    run_number TEXT REFERENCES runs(run_number),
    tag_name TEXT,
    timestamp TIMESTAMP,
    value REAL
);

CREATE TABLE equipment_monthly (
    id SERIAL PRIMARY KEY,
    furnace TEXT,
    month DATE,
    department TEXT,
    defect_rate REAL,
    avg_kwh REAL,
    avg_run_time REAL,
    avg_downtime REAL,
    avg_car_deck REAL,
    run_count INTEGER,
    trend_slope REAL,
    trend_pvalue REAL
);

CREATE TABLE risk_factors (
    id SERIAL PRIMARY KEY,
    factor_name TEXT,
    factor_level TEXT,
    risk_group TEXT,
    defect_rate REAL,
    n_electrodes INTEGER,
    p_value REAL
);

CREATE TABLE compounding_rates (
    n_factors INTEGER PRIMARY KEY,
    defect_rate REAL,
    n_electrodes INTEGER,
    pct_of_defects REAL
);

CREATE TABLE composition_risk (
    quintile TEXT PRIMARY KEY,
    avg_defect_rate REAL,
    probability_high_defect_event REAL,
    run_count INTEGER
);

CREATE TABLE investigations (
    investigation_id SERIAL PRIMARY KEY,
    gpn TEXT,
    run_number TEXT,
    defect_code TEXT,
    defect_site TEXT,
    root_cause_category TEXT,
    root_cause_detail TEXT,
    corrective_action TEXT,
    status TEXT DEFAULT 'open',
    assigned_to TEXT,
    due_date DATE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    effectiveness_notes TEXT
);

CREATE TABLE investigation_notes (
    note_id SERIAL PRIMARY KEY,
    investigation_id INTEGER REFERENCES investigations(investigation_id),
    author TEXT,
    note_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE corrective_actions (
    action_id SERIAL PRIMARY KEY,
    investigation_id INTEGER REFERENCES investigations(investigation_id),
    title TEXT,
    description TEXT,
    action_type TEXT,
    assigned_to TEXT,
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    status TEXT DEFAULT 'open',
    expected_savings REAL,
    actual_savings REAL,
    completed_at TIMESTAMP,
    verified_at TIMESTAMP,
    verification_notes TEXT
);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_electrodes_lot ON electrodes(lot);
CREATE INDEX idx_electrodes_run_ob ON electrodes(run_number_ob);
CREATE INDEX idx_electrodes_run_og ON electrodes(run_number_og);
CREATE INDEX idx_sensor_readings_run ON sensor_readings(run_number);
CREATE INDEX idx_equipment_monthly_furnace ON equipment_monthly(furnace);
CREATE INDEX idx_runs_department ON runs(department);
CREATE INDEX idx_runs_furnace ON runs(furnace);
CREATE INDEX idx_investigations_status ON investigations(status);
"""


_gpn_counter = 0

def _gen_gpn(run_idx: int, pos: int) -> str:
    global _gpn_counter
    _gpn_counter += 1
    h = hashlib.md5(f"gpn-{run_idx}-{pos}-{_gpn_counter}".encode()).hexdigest()[:10].upper()
    return f"GPN-{h}"


def _gen_run_number(dept: str, idx: int) -> str:
    prefix = "BK" if dept == "bake" else "GR"
    return f"{prefix}-{idx:05d}"


def _months_between(start: datetime, end: datetime):
    months = []
    current = start.replace(day=1)
    while current <= end:
        months.append(current)
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    return months


def seed_lots(cur):
    print("Seeding lots...")
    lots = []
    for i in range(200):
        lot_id = f"LOT-{i+1:04d}"
        is_high_risk = i < 20  # first 20 are high-risk
        if is_high_risk:
            defect_rate = np.random.uniform(0.10, 0.22)
            count = np.random.randint(80, 200)
        else:
            defect_rate = np.random.uniform(0.01, 0.05)
            count = np.random.randint(80, 200)
        defect_count = int(round(count * defect_rate))
        risk_tier = "high" if is_high_risk else "normal"
        lots.append((lot_id, round(defect_rate, 4), count, defect_count, risk_tier))
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO lots (lot_id, lot_defect_rate, lot_electrode_count, lot_defect_count, risk_tier) VALUES %s",
        lots,
    )
    print(f"  {len(lots)} lots created ({sum(1 for l in lots if l[4] == 'high')} high-risk)")
    return lots


def seed_runs_and_electrodes(cur, lots):
    print("Seeding runs and electrodes...")
    all_runs = []
    all_electrodes = []
    months = _months_between(START_DATE, END_DATE)

    bake_idx = 1
    graphite_idx = 1
    lot_ids = [l[0] for l in lots]
    high_risk_lots = [l[0] for l in lots if l[4] == "high"]
    normal_lots = [l[0] for l in lots if l[4] == "normal"]

    # --- BAKE RUNS ---
    for month in months:
        for furnace in BAKE_FURNACES:
            runs_this_month = np.random.randint(2, 5)
            for r in range(runs_this_month):
                run_number = _gen_run_number("bake", bake_idx)
                bake_idx += 1

                day = np.random.randint(1, 28)
                start = month.replace(day=day, hour=np.random.randint(6, 18))
                duration = np.random.uniform(180, 320)
                end = start + timedelta(hours=duration)
                cooling_end = end + timedelta(hours=np.random.uniform(48, 120))

                car_deck = np.random.randint(1, 10)
                # BF-3 degradation: trending toward higher car decks over time
                if furnace == DEGRADING_FURNACE:
                    months_elapsed = (month.year - START_DATE.year) * 12 + month.month - START_DATE.month
                    car_deck = min(9, max(1, int(np.random.normal(4 + months_elapsed * 0.25, 1.5))))

                pieces = np.random.randint(20, 55)
                weight_per_piece = np.random.uniform(120, 280)
                total_weight = round(pieces * weight_per_piece, 1)
                curve = random.choice(BAKE_CURVES)
                kwh = round(np.random.uniform(8000, 18000), 0)
                downtime = round(max(0, np.random.normal(4, 3)), 1)

                # Base defect probability from car deck position
                deck_defect_prob = 0.015 + (car_deck / 9.0) * 0.045
                if furnace == DEGRADING_FURNACE:
                    degradation_factor = 1.0 + months_elapsed * 0.04
                    deck_defect_prob *= degradation_factor

                electrodes_in_run = []
                defect_count = 0
                for pos in range(1, pieces + 1):
                    gpn = _gen_gpn(bake_idx * 1000, pos)
                    lot = random.choice(high_risk_lots if np.random.random() < 0.08 else normal_lots)
                    diameter = random.choice(DIAMETERS)
                    blend = random.choice(COKE_BLENDS)
                    weight = round(diameter * np.random.uniform(0.35, 0.65), 1)

                    # Defect probability compounds: deck + lot risk
                    lot_data = next(l for l in lots if l[0] == lot)
                    lot_risk_add = lot_data[1] * 0.3
                    prob = min(0.4, deck_defect_prob + lot_risk_add)
                    has_defect = np.random.random() < prob
                    defect_code = random.choice(DEFECT_CODES) if has_defect else None
                    if has_defect:
                        defect_count += 1

                    er = round(np.random.normal(5.5, 0.8), 2) if not has_defect else round(np.random.normal(6.5, 1.2), 2)
                    ad = round(np.random.normal(1.68, 0.03), 3) if not has_defect else round(np.random.normal(1.62, 0.05), 3)

                    electrodes_in_run.append((
                        gpn, lot, f"MO-{bake_idx:04d}", diameter, blend, weight,
                        run_number, car_deck, pos, defect_code,
                        None, None, None, None, None, None,
                        er, ad,
                    ))

                defect_rate = round(defect_count / pieces, 4) if pieces > 0 else 0

                all_runs.append((
                    run_number, "bake", furnace, curve, None,
                    car_deck, pieces, total_weight,
                    start, end, cooling_end, round(duration, 1),
                    kwh, downtime, defect_count, defect_rate, None,
                ))
                all_electrodes.extend(electrodes_in_run)

    # --- GRAPHITE RUNS ---
    for month in months:
        for furnace in GRAPHITE_FURNACES:
            runs_this_month = np.random.randint(1, 4)
            for r in range(runs_this_month):
                run_number = _gen_run_number("graphite", graphite_idx)
                graphite_idx += 1

                day = np.random.randint(1, 28)
                start = month.replace(day=day, hour=np.random.randint(0, 23))
                duration = np.random.uniform(60, 140)
                end = start + timedelta(hours=duration)
                cooling_end = end + timedelta(hours=np.random.uniform(24, 72))

                pieces = np.random.randint(8, 15)
                profile = random.choice(GRAPHITE_PROFILES)
                config = random.choice(LOAD_CONFIGS)
                kwh = round(np.random.uniform(15000, 45000), 0)
                downtime = round(max(0, np.random.normal(2, 2)), 1)
                weight_per_piece = np.random.uniform(150, 350)
                total_weight = round(pieces * weight_per_piece, 1)

                # For graphite, composition drives defects, not furnace params
                selected_lots = [random.choice(lot_ids) for _ in range(pieces)]
                high_risk_count = sum(1 for l in selected_lots if l in high_risk_lots)
                composition_risk_base = 0.02 + (high_risk_count / max(pieces, 1)) * 0.15

                # Risk quintile
                if composition_risk_base < 0.025:
                    risk_score = "Q1"
                elif composition_risk_base < 0.04:
                    risk_score = "Q2"
                elif composition_risk_base < 0.055:
                    risk_score = "Q3"
                elif composition_risk_base < 0.07:
                    risk_score = "Q4"
                else:
                    risk_score = "Q5"

                electrodes_in_run = []
                defect_count = 0
                for pos in range(1, pieces + 1):
                    gpn = _gen_gpn(graphite_idx * 10000, pos)
                    lot = selected_lots[pos - 1]
                    diameter = random.choice(DIAMETERS)
                    blend = random.choice(COKE_BLENDS)
                    weight = round(diameter * np.random.uniform(0.35, 0.65), 1)

                    # Position effect: edge positions (1,2,13,14) have ~3x defect rate
                    position_factor = 3.0 if pos in (1, 2, pieces - 1, pieces) else 1.0
                    lot_data = next(l for l in lots if l[0] == lot)
                    lot_risk = lot_data[1]

                    prob = min(0.35, composition_risk_base * position_factor + lot_risk * 0.2)
                    has_defect_g = np.random.random() < prob
                    defect_code_g = random.choice(DEFECT_CODES) if has_defect_g else None

                    # Some also defect at finishing
                    has_defect_f = np.random.random() < (prob * 0.4)
                    defect_code_f = random.choice(DEFECT_CODES[:4]) if has_defect_f else None

                    if has_defect_g or has_defect_f:
                        defect_count += 1

                    er = round(np.random.normal(5.5, 0.6), 2)
                    ad = round(np.random.normal(1.68, 0.03), 3)

                    # Link to a random bake run (simulating upstream)
                    bake_run_idx = np.random.randint(1, max(bake_idx - 1, 2))
                    bake_run_num = _gen_run_number("bake", bake_run_idx)
                    bake_deck = np.random.randint(1, 10)

                    electrodes_in_run.append((
                        gpn, lot, f"MO-{graphite_idx:04d}", diameter, blend, weight,
                        bake_run_num, bake_deck, np.random.randint(1, 55),
                        None,  # bake defect code (most pass bake)
                        run_number, furnace, pos, profile,
                        defect_code_g, defect_code_f,
                        er, ad,
                    ))

                defect_rate = round(defect_count / pieces, 4) if pieces > 0 else 0

                all_runs.append((
                    run_number, "graphite", furnace, profile, config,
                    None, pieces, total_weight,
                    start, end, cooling_end, round(duration, 1),
                    kwh, downtime, defect_count, defect_rate, risk_score,
                ))
                all_electrodes.extend(electrodes_in_run)

    # Bulk insert runs
    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO runs (run_number, department, furnace, profile, load_config,
           car_deck, total_pieces, total_weight, start_time, end_time, cooling_end_time,
           duration_hours, actual_kwh, total_downtime, defect_count, defect_rate, risk_score)
           VALUES %s""",
        all_runs,
    )
    print(f"  {len(all_runs)} runs created")

    # Bulk insert electrodes
    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO electrodes (gpn, lot, mo_name, diameter, coke_blend, weight_kg,
           run_number_ob, car_deck_ob, load_order_ob, defect_code_ob,
           run_number_og, furnace_og, position_og, profile_og,
           defect_code_og, defect_code_of, er, ad)
           VALUES %s""",
        all_electrodes,
    )
    print(f"  {len(all_electrodes)} electrodes created")
    return all_runs, all_electrodes


def seed_sensor_readings(cur, all_runs):
    print("Seeding sensor readings...")
    graphite_runs = [r for r in all_runs if r[1] == "graphite"]
    recent_runs = sorted(graphite_runs, key=lambda r: r[8])[-100:]

    TAGS = [
        "push_displacement_left", "push_displacement_right", "push_displacement_avg",
        "push_displacement_roc", "resistance_rate", "push_roc_mm_min", "downtime_minutes",
    ]

    readings = []
    for run in recent_runs:
        run_number = run[0]
        start_time = run[8]
        duration_h = run[11]
        defect_rate = run[15]

        # Higher defect runs get more variable sensor data
        variability = 1.0 + defect_rate * 5.0

        for tag in TAGS:
            base_values = {
                "push_displacement_left": (12.0, 2.0),
                "push_displacement_right": (11.5, 2.0),
                "push_displacement_avg": (11.75, 1.5),
                "push_displacement_roc": (0.15, 0.05),
                "resistance_rate": (0.85, 0.1),
                "push_roc_mm_min": (0.08, 0.03),
                "downtime_minutes": (0.0, 1.0),
            }
            mean, std = base_values[tag]
            std *= variability

            for i in range(50):
                t = start_time + timedelta(hours=duration_h * i / 49)
                # Add some trend and noise
                trend = (i / 49) * mean * 0.1
                value = round(np.random.normal(mean + trend, std), 4)
                if tag == "downtime_minutes":
                    value = round(max(0, value), 2)
                readings.append((run_number, tag, t, value))

    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO sensor_readings (run_number, tag_name, timestamp, value) VALUES %s",
        readings,
        page_size=5000,
    )
    print(f"  {len(readings)} sensor readings created")


def seed_equipment_monthly(cur, all_runs):
    print("Seeding equipment monthly metrics...")
    from collections import defaultdict

    # Group runs by (furnace, month)
    groups = defaultdict(list)
    for run in all_runs:
        furnace = run[2]
        dept = run[1]
        start = run[8]
        month_key = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        groups[(furnace, month_key, dept)].append(run)

    rows = []
    # Compute trends per furnace
    furnace_monthly = defaultdict(list)

    for (furnace, month, dept), runs in sorted(groups.items()):
        defect_rates = [r[15] for r in runs]
        avg_defect = np.mean(defect_rates)
        avg_kwh = np.mean([r[12] for r in runs])
        avg_duration = np.mean([r[11] for r in runs])
        avg_downtime = np.mean([r[13] for r in runs])
        avg_deck = np.mean([r[5] for r in runs if r[5] is not None]) if dept == "bake" else None

        furnace_monthly[furnace].append((month, avg_defect))

        rows.append((
            furnace, month.date(), dept,
            float(round(avg_defect, 4)), float(round(avg_kwh, 1)), float(round(avg_duration, 1)),
            float(round(avg_downtime, 1)),
            float(round(avg_deck, 2)) if avg_deck is not None else None,
            len(runs), None, None,
        ))

    # Compute trend slopes per furnace
    final_rows = []
    for row in rows:
        furnace = row[0]
        monthly_data = furnace_monthly[furnace]
        if len(monthly_data) >= 3:
            sorted_data = sorted(monthly_data, key=lambda x: x[0])
            x = np.arange(len(sorted_data), dtype=float)
            y = np.array([d[1] for d in sorted_data])
            if np.std(y) > 0:
                slope = np.polyfit(x, y, 1)[0]
                # Approximate p-value from correlation
                corr = np.corrcoef(x, y)[0, 1]
                n = len(x)
                if abs(corr) < 1.0 and n > 2:
                    t_stat = corr * np.sqrt((n - 2) / (1 - corr**2))
                    # Rough p-value approximation
                    p_value = min(1.0, 2.0 * np.exp(-0.5 * t_stat**2))
                else:
                    p_value = 0.001
            else:
                slope = 0.0
                p_value = 1.0
        else:
            slope = 0.0
            p_value = 1.0

        final_rows.append(row[:9] + (float(round(slope, 6)), float(round(p_value, 4))))

    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO equipment_monthly (furnace, month, department,
           defect_rate, avg_kwh, avg_run_time, avg_downtime, avg_car_deck,
           run_count, trend_slope, trend_pvalue)
           VALUES %s""",
        final_rows,
    )
    print(f"  {len(final_rows)} monthly records created")


def seed_risk_factors(cur):
    print("Seeding risk factors...")
    factors = [
        # Furnace risk
        ("furnace", "BF-1", "low", 0.025, 4200, 0.001),
        ("furnace", "BF-2", "low", 0.028, 3900, 0.001),
        ("furnace", "BF-3", "high", 0.062, 4100, 0.001),
        ("furnace", "BF-4", "medium", 0.038, 3800, 0.012),
        ("furnace", "BF-5", "low", 0.022, 4300, 0.001),
        ("furnace", "BF-6", "low", 0.030, 3700, 0.003),
        # Position risk (car deck)
        ("position", "Deck 1-3", "low", 0.018, 7500, 0.001),
        ("position", "Deck 4-5", "low", 0.022, 5100, 0.001),
        ("position", "Deck 6-7", "medium", 0.035, 5000, 0.005),
        ("position", "Deck 8-9", "high", 0.058, 4900, 0.001),
        # Profile risk
        ("profile", "STD-A", "low", 0.025, 6200, 0.002),
        ("profile", "STD-B", "low", 0.027, 6000, 0.004),
        ("profile", "SLOW-C", "medium", 0.033, 5800, 0.015),
        ("profile", "FAST-D", "high", 0.048, 5500, 0.001),
        # Blend risk
        ("blend", "Premium-A", "low", 0.020, 6500, 0.001),
        ("blend", "Standard-B", "low", 0.028, 6400, 0.002),
        ("blend", "Economy-C", "medium", 0.042, 6200, 0.001),
        ("blend", "Blend-D", "high", 0.055, 5800, 0.001),
        # Config risk (graphite)
        ("config", "Full-14", "low", 0.030, 3200, 0.008),
        ("config", "Partial-10", "medium", 0.038, 2100, 0.020),
        ("config", "Mixed-12", "medium", 0.035, 2800, 0.012),
        ("config", "Full-14-HD", "high", 0.052, 1500, 0.002),
        # Diameter risk
        ("diameter", "300mm", "low", 0.022, 4200, 0.003),
        ("diameter", "400mm", "low", 0.026, 4500, 0.005),
        ("diameter", "500mm", "medium", 0.035, 4100, 0.008),
        ("diameter", "600mm", "high", 0.048, 3800, 0.001),
    ]
    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO risk_factors (factor_name, factor_level, risk_group, defect_rate, n_electrodes, p_value)
           VALUES %s""",
        factors,
    )
    print(f"  {len(factors)} risk factors created")


def seed_compounding_rates(cur):
    print("Seeding compounding rates...")
    rates = [
        (0, 0.012, 8500, 0.05),
        (1, 0.028, 7200, 0.12),
        (2, 0.048, 4800, 0.18),
        (3, 0.078, 2600, 0.22),
        (4, 0.125, 1200, 0.20),
        (5, 0.185, 450, 0.15),
        (6, 0.260, 120, 0.08),
    ]
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO compounding_rates (n_factors, defect_rate, n_electrodes, pct_of_defects) VALUES %s",
        rates,
    )
    print(f"  {len(rates)} compounding rates created")


def seed_composition_risk(cur):
    print("Seeding composition risk quintiles...")
    quintiles = [
        ("Q1", 0.012, 0.02, 45),
        ("Q2", 0.025, 0.05, 52),
        ("Q3", 0.042, 0.12, 48),
        ("Q4", 0.065, 0.25, 38),
        ("Q5", 0.098, 0.55, 30),
    ]
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO composition_risk (quintile, avg_defect_rate, probability_high_defect_event, run_count) VALUES %s",
        quintiles,
    )
    print(f"  {len(quintiles)} quintiles created")


def seed_investigations(cur, all_electrodes, all_runs):
    print("Seeding investigations...")
    # Pick electrodes with defects for investigations
    defective = [e for e in all_electrodes if e[9] or e[14] or e[15]]
    sample = random.sample(defective, min(25, len(defective)))

    investigations = []
    for i, elec in enumerate(sample):
        gpn = elec[0]
        run_number = elec[6] or elec[10]
        defect_code = elec[9] or elec[14] or elec[15]
        defect_site = "bake" if elec[9] else ("graphite" if elec[14] else "finishing")

        status_choices = ["open", "in_progress", "closed", "verified"]
        weights = [0.25, 0.30, 0.30, 0.15]
        status = random.choices(status_choices, weights=weights, k=1)[0]

        category = random.choice(ROOT_CAUSE_CATEGORIES)
        details = {
            "furnace": "Temperature gradient exceeds specification in rear positions",
            "material": "Lot exhibits elevated porosity from raw material variability",
            "process": "Cooling rate too aggressive for electrode diameter",
            "equipment": "Heating element degradation causing uneven thermal distribution",
            "unknown": "Root cause under investigation — multiple factors suspected",
        }

        days_ago = np.random.randint(1, 120)
        created_at = END_DATE - timedelta(days=days_ago)
        due_date = created_at + timedelta(days=np.random.randint(7, 45))
        closed_at = None
        if status in ("closed", "verified"):
            closed_at = created_at + timedelta(days=np.random.randint(5, 30))

        investigations.append((
            gpn, run_number, defect_code, defect_site,
            category, details[category],
            f"Review and address {category} factors for {defect_site} operations",
            status, random.choice(PEOPLE), due_date.date(),
            random.choice(PEOPLE), created_at, closed_at,
            "Defect rate reduced after correction" if status == "verified" else None,
        ))

    for inv in investigations:
        cur.execute(
            """INSERT INTO investigations (gpn, run_number, defect_code, defect_site,
               root_cause_category, root_cause_detail, corrective_action,
               status, assigned_to, due_date, created_by, created_at, closed_at,
               effectiveness_notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               RETURNING investigation_id""",
            inv,
        )
        inv_id = cur.fetchone()[0]

        # Add notes
        n_notes = np.random.randint(1, 5)
        for n in range(n_notes):
            note_date = inv[11] + timedelta(days=np.random.randint(0, 15))
            note_texts = [
                "Initial review completed. Collecting process data from the run.",
                "Cross-referenced with lot history — elevated risk tier confirmed.",
                "Furnace thermocouple data reviewed. Temperature gradient within spec but borderline.",
                "Discussed with shift supervisor. Position assignment was manual override.",
                "Sibling electrodes from same run show similar pattern at adjacent positions.",
                "Requested maintenance review of furnace heating elements.",
                "Root cause confirmed: thermal gradient at edge positions exceeded tolerance.",
                "Corrective action implemented. Monitoring next 3 runs for effectiveness.",
            ]
            cur.execute(
                "INSERT INTO investigation_notes (investigation_id, author, note_text, created_at) VALUES (%s,%s,%s,%s)",
                (inv_id, random.choice(PEOPLE), random.choice(note_texts), note_date),
            )

        # Add corrective actions
        n_actions = np.random.randint(1, 3)
        for a in range(n_actions):
            action_status_map = {
                "open": ["open", "open"],
                "in_progress": ["in_progress", "open"],
                "closed": ["completed", "in_progress"],
                "verified": ["completed", "completed"],
            }
            possible = action_status_map[inv[7]]
            a_status = random.choice(possible)
            a_due = inv[9] + timedelta(days=np.random.randint(-5, 15))
            # Make some actions overdue
            is_overdue = a_status in ("open", "in_progress") and a_due < END_DATE.date()

            action_titles = [
                "Review position assignment algorithm",
                "Inspect furnace heating elements",
                "Adjust cooling profile for edge positions",
                "Update lot risk scoring model",
                "Schedule maintenance for affected furnace",
                "Implement position rotation policy",
                "Calibrate temperature sensors",
                "Review raw material specifications with supplier",
            ]
            cur.execute(
                """INSERT INTO corrective_actions (investigation_id, title, description,
                   action_type, assigned_to, priority, due_date, status,
                   expected_savings, actual_savings, completed_at, verified_at, verification_notes)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    inv_id,
                    random.choice(action_titles),
                    f"Address {inv[4]} factors contributing to defect at {inv[3]}",
                    random.choice(["preventive", "corrective", "containment"]),
                    random.choice(PEOPLE),
                    random.choice(["low", "medium", "high", "critical"]),
                    a_due,
                    a_status,
                    round(np.random.uniform(5000, 50000), 0),
                    round(np.random.uniform(3000, 45000), 0) if a_status == "completed" else None,
                    inv[11] + timedelta(days=np.random.randint(5, 25)) if a_status == "completed" else None,
                    inv[11] + timedelta(days=np.random.randint(20, 40)) if a_status == "completed" and inv[7] == "verified" else None,
                    "Effectiveness confirmed through reduced defect rate" if inv[7] == "verified" else None,
                ),
            )

    print(f"  {len(investigations)} investigations created with notes and actions")


def seed_app_settings(cur):
    print("Seeding app_settings...")
    settings = [
        ('spc_z_threshold', '1.5', 'Z-score threshold for SPC anomaly flagging on bake runs. Parameters exceeding this many standard deviations are flagged.'),
        ('defect_rate_anomaly_threshold', '0.05', 'Defect rate above which a run is considered anomalous (0.05 = 5%)'),
        ('car_deck_high_risk_cutoff', '7', 'Car deck number at or above which an electrode is considered high-risk position'),
        ('lot_high_risk_defect_rate', '0.05', 'Lot defect rate at or above which a lot is classified as high-risk tier (0.05 = 5%)'),
    ]
    for key, value, desc in settings:
        cur.execute(
            "INSERT INTO app_settings (key, value, description) VALUES (%s, %s, %s)",
            (key, value, desc),
        )
    print(f"  {len(settings)} settings created")


def add_search_vectors(cur):
    """Add tsvector columns and GIN indexes for full-text search."""
    print("Adding search vectors and GIN indexes...")

    # investigations
    cur.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS search_vector tsvector")
    cur.execute("""
        UPDATE investigations SET search_vector =
          to_tsvector('english',
            coalesce(root_cause_detail, '') || ' ' ||
            coalesce(corrective_action, '') || ' ' ||
            coalesce(effectiveness_notes, '') || ' ' ||
            coalesce(defect_code, '') || ' ' ||
            coalesce(defect_site, '')
          )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_investigations_search ON investigations USING GIN(search_vector)")

    # investigation_notes
    cur.execute("ALTER TABLE investigation_notes ADD COLUMN IF NOT EXISTS search_vector tsvector")
    cur.execute("UPDATE investigation_notes SET search_vector = to_tsvector('english', coalesce(note_text, ''))")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_notes_search ON investigation_notes USING GIN(search_vector)")

    # corrective_actions
    cur.execute("ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS search_vector tsvector")
    cur.execute("""
        UPDATE corrective_actions SET search_vector =
          to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(verification_notes, '')
          )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_actions_search ON corrective_actions USING GIN(search_vector)")

    # Add triggers to keep search_vector updated
    cur.execute("""
        CREATE OR REPLACE FUNCTION investigations_search_trigger() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := to_tsvector('english',
            coalesce(NEW.root_cause_detail, '') || ' ' ||
            coalesce(NEW.corrective_action, '') || ' ' ||
            coalesce(NEW.effectiveness_notes, '') || ' ' ||
            coalesce(NEW.defect_code, '') || ' ' ||
            coalesce(NEW.defect_site, '')
          );
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)
    cur.execute("DROP TRIGGER IF EXISTS trig_investigations_search ON investigations")
    cur.execute("""
        CREATE TRIGGER trig_investigations_search
        BEFORE INSERT OR UPDATE ON investigations
        FOR EACH ROW EXECUTE FUNCTION investigations_search_trigger()
    """)

    cur.execute("""
        CREATE OR REPLACE FUNCTION notes_search_trigger() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := to_tsvector('english', coalesce(NEW.note_text, ''));
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)
    cur.execute("DROP TRIGGER IF EXISTS trig_notes_search ON investigation_notes")
    cur.execute("""
        CREATE TRIGGER trig_notes_search
        BEFORE INSERT OR UPDATE ON investigation_notes
        FOR EACH ROW EXECUTE FUNCTION notes_search_trigger()
    """)

    cur.execute("""
        CREATE OR REPLACE FUNCTION actions_search_trigger() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := to_tsvector('english',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.description, '') || ' ' ||
            coalesce(NEW.verification_notes, '')
          );
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)
    cur.execute("DROP TRIGGER IF EXISTS trig_actions_search ON corrective_actions")
    cur.execute("""
        CREATE TRIGGER trig_actions_search
        BEFORE INSERT OR UPDATE ON corrective_actions
        FOR EACH ROW EXECUTE FUNCTION actions_search_trigger()
    """)

    print("  Search vectors and triggers created")


def add_defect_rate_columns(cur):
    """Add defect_rate_before/after to corrective_actions and populate for verified actions."""
    print("Adding defect_rate_before/after to corrective_actions...")

    cur.execute("ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS defect_rate_before REAL")
    cur.execute("ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS defect_rate_after REAL")

    # Populate for completed/verified actions
    cur.execute("""
        SELECT a.action_id, a.investigation_id, a.completed_at,
               i.run_number
        FROM corrective_actions a
        JOIN investigations i ON a.investigation_id = i.investigation_id
        WHERE (a.status = 'completed' OR a.verified_at IS NOT NULL)
          AND i.run_number IS NOT NULL
    """)
    actions = [dict(r) for r in cur.fetchall()]

    for action in actions:
        run_number = action["run_number"]
        # Get the defect_rate of the triggering run
        cur.execute("SELECT defect_rate, furnace, start_time FROM runs WHERE run_number = %s", (run_number,))
        run_row = cur.fetchone()
        if not run_row:
            continue
        defect_rate_before = run_row["defect_rate"]
        furnace = run_row["furnace"]
        start_time = run_row["start_time"]

        # Get next 5 runs on same furnace after the action's run
        cur.execute("""
            SELECT defect_rate FROM runs
            WHERE furnace = %s AND start_time > %s
            ORDER BY start_time
            LIMIT 5
        """, (furnace, start_time))
        next_runs = cur.fetchall()

        defect_rate_after = None
        if next_runs:
            defect_rate_after = round(sum(r["defect_rate"] for r in next_runs) / len(next_runs), 4)

        cur.execute(
            "UPDATE corrective_actions SET defect_rate_before = %s, defect_rate_after = %s WHERE action_id = %s",
            (defect_rate_before, defect_rate_after, action["action_id"]),
        )

    print(f"  Updated {len(actions)} corrective actions with before/after rates")


def main():
    env = os.environ.get("ENVIRONMENT", "development")
    if env == "production":
        print("ERROR: seed.py cannot run in production. Set ENVIRONMENT=development to override.")
        sys.exit(1)
    if env != "development":
        confirm = input(f"ENVIRONMENT={env}. Are you sure you want to seed? This will DROP ALL TABLES. Type 'yes' to confirm: ")
        if confirm.strip().lower() != 'yes':
            print("Aborted.")
            sys.exit(0)

    print("=" * 60)
    print("EDRS v2 — Seeding Database")
    print("=" * 60)

    create_database()
    conn = connect_db()
    cur = conn.cursor()

    print("\nCreating tables...")
    cur.execute(DDL)
    conn.commit()
    print("  Tables created")

    lots = seed_lots(cur)
    all_runs, all_electrodes = seed_runs_and_electrodes(cur, lots)
    seed_sensor_readings(cur, all_runs)
    seed_equipment_monthly(cur, all_runs)
    seed_risk_factors(cur)
    seed_compounding_rates(cur)
    seed_composition_risk(cur)
    seed_investigations(cur, all_electrodes, all_runs)
    seed_app_settings(cur)

    conn.commit()

    # Post-commit operations that need the data to exist
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    add_defect_rate_columns(cur)
    add_search_vectors(cur)
    conn.commit()
    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("Seeding complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
