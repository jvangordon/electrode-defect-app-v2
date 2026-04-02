# Partner Implementation Guide

## Overview

This app is a defective weight reduction solution for a graphite electrode manufacturer. It was built as an RFP response and deployed on Databricks Apps with Lakebase (PostgreSQL) as the transactional database.

The customer manufactures graphite electrodes through a 10-step process across two plants. Each electrode is tracked by a unique serial number (GPN). Defects can originate at one step but only be detected later — a crack introduced during baking may not show up until finishing inspection.

## Architecture

- **Frontend:** React 19 + TypeScript + Tailwind 4 + Recharts 3
- **Backend:** FastAPI + psycopg2
- **Database:** PostgreSQL (Lakebase in production)
- **Deployment:** Databricks Apps
- **GenAI:** Mock responses grounded in real data patterns (swap for Foundation Model API in production)
- **Genie:** AI/BI Dashboard with Genie room embedded via iframe

## Setup

```bash
# Prerequisites: PostgreSQL running locally
git clone <repo>
cd electrode-defect-app-v2

# Seed database
pip install -r requirements.txt
python -m backend.seed

# Run backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Run frontend (dev)
cd frontend && npm install && npm run dev
```

## Data Model

### Core Tables

| Table | Grain | Description |
|-------|-------|-------------|
| runs | One row per furnace run | Process parameters: furnace, profile, load config, kWh, run time, cooling, downtime, defect count/rate |
| electrodes | One row per electrode (GPN) | Full lifecycle: linked to bake run (run_number_ob) and graphite run (run_number_og) with position, defect codes at each step, finishing measurements (ER, AD) |
| lots | One row per material lot | Lot-level defect history and risk tier (normal/high) |
| sensor_readings | One row per sensor reading | Time-series data per run: 7 sensor tags with timestamps |

### Analytical Tables

| Table | Description |
|-------|-------------|
| equipment_monthly | Pre-computed monthly metrics per furnace: defect rate, avg kWh, run time, downtime, trend slope + p-value |
| risk_factors | The 6 validated categorical risk factors with defect rates and p-values |
| compounding_rates | Defect rate by number of high-risk factors (0-6) |
| composition_risk | Risk quintile definitions (Q1-Q5) for pre-load scoring |

### Workflow Tables

| Table | Description |
|-------|-------------|
| investigations | Root cause investigations linked to electrodes and runs |
| investigation_notes | Timestamped notes on investigations |
| corrective_actions | Actions with status workflow: open → in_progress → completed → verified |
| app_settings | Configurable quality thresholds |

### Key Relationships

```
lots (lot_id) ←── electrodes (lot)
runs (run_number) ←── electrodes (run_number_ob)  [bake step]
runs (run_number) ←── electrodes (run_number_og)  [graphite step]
runs (run_number) ←── sensor_readings (run_number)
investigations ←── investigation_notes (investigation_id)
investigations ←── corrective_actions (investigation_id)
```

An electrode has TWO run references — this is critical for cross-department tracing. The bake run captures where upstream conditions were set. The graphite run captures where defects are detected. Joining these is what enables the composition-based risk scoring.

## RFP Requirements Mapping

### Day-One Must-Haves

| # | RFP Requirement | App Feature | Page |
|---|----------------|-------------|------|
| 1 | Well-defined process for defective weight reduction (joint effort, not just tool training) | Full workflow: detect anomaly → compare runs → investigate root cause → assign corrective action → verify improvement. CLCA loop captures institutional knowledge. | All pages together form the workflow |
| 2 | Process comparisons (batch-to-batch, run-to-run) | Side-by-side run comparison with parameter diff, position maps, sensor overlay. Multi-run trending per furnace. | Run Comparison |
| 3 | Detection and flagging of anomalous process runs and conditions | Bake: SPC on car deck + load parameters. Graphite: composition-based pre-load risk scoring using upstream electrode history. | Anomaly Detection |
| 4 | Equipment performance comparisons (changes over time) | Monthly trending per furnace with regression, degradation detection, cross-equipment comparison. | Equipment Trending |

### Phase 2 Desired

| # | RFP Requirement | How Addressed |
|---|----------------|---------------|
| 5 | Correlation analysis between process parameters and defects | 6 validated categorical risk factors (all p<0.0001). Visible in Investigation risk attribution and Anomaly Detection. |
| 6 | Causal modeling with explainability | AI Analysis in Investigation view: natural language root cause summary with contributing factors and prescriptive recommendation. |

### Additional RFP Capabilities

| RFP Requirement | App Feature | Page |
|----------------|-------------|------|
| No/low-code analysis | Genie room for natural language queries against manufacturing data | Genie Explorer |
| KPI monitoring and drill-down | KPI cards, defect rate trending, furnace status grid | Dashboard |
| Contextual note-taking linked to events | Investigation notes linked to GPN, run, furnace. Knowledge search (⌘K). | Investigations |
| Equipment-condition-to-quality analysis | Furnace defect rates, car deck correlation, performance metrics | Equipment Trending |
| Maintenance prioritization by quality impact | Furnaces ranked by defect cost impact. Corrective action tracking. | Equipment Trending + Investigations |

## Persona Mapping

### Dashboard
| Persona | What They Use |
|---------|--------------|
| Department Manager | KPI cards (overall defect rate, total defects, electrode count). Defect rate trend. "Requires Attention" banner. |
| Quality Lead | Investigation status summary (open/in progress/closed/verified). Recent high-defect runs. |

### Run Comparison
| Persona | What They Use |
|---------|--------------|
| Process Engineer | Select two runs on same furnace, compare parameters side-by-side. Position maps show spatial defect patterns. Sensor overlay shows where runs diverged. Multi-run trend identifies which runs to investigate. |

### Anomaly Detection
| Persona | What They Use |
|---------|--------------|
| Process Engineer | SPC control chart for bake — which runs deviated from normal. Flagged anomaly list with severity and deviations. |
| Operator | Graphite composition risk — pre-load risk quintile (Q1-Q5) before loading a furnace. Risk factor breakdown shows which electrodes are driving the score. |

### Equipment Trending
| Persona | What They Use |
|---------|--------------|
| Reliability Engineer | Monthly defect rate, kWh, run time, downtime trends per furnace. Regression line shows if equipment is degrading. Cross-equipment bar chart for comparison. |
| Maintenance Manager | Furnaces ranked by defect rate and cost impact. Degradation alerts identify where maintenance would have the most quality impact. |

### Investigations
| Persona | What They Use |
|---------|--------------|
| Process Engineer | Search by GPN or run. Electrode lifecycle timeline (10 process steps). Sibling analysis (same-run electrodes). AI root cause analysis. |
| Quality Lead | Investigation workflow (open → in progress → closed → verified). Corrective action assignment and tracking. Similar past cases with prescriptive recommendations based on what worked before. Knowledge search across all past investigations. |

### Settings
| Persona | What They Use |
|---------|--------------|
| Quality Lead | Adjust SPC thresholds, risk quintile boundaries, car deck cutoff, lot risk threshold. Global settings that apply to all users. |

### Genie Explorer
| Persona | What They Use |
|---------|--------------|
| All | Natural language questions against manufacturing data. Ad-hoc analysis beyond what the app views provide. "Show me all electrodes from lot X that went through Furnace 5 on deck 8+." |

## Key Analytical Findings (Built Into the App)

These findings drive the app's logic. They were validated on customer data through 15 Genie Code analysis prompts.

**6 Categorical Risk Factors** (visible in Anomaly Detection and Investigation risk attribution):
- Furnace: CT10/CT11 = high risk, CT4/CT7 = low risk (8x difference)
- Position: Edge (9-14) = high, Center (1-4) = low (3x difference)
- Firing Profile: CT21 = high, CT23 = low (12x difference)
- Coke Blend: HRG blends = high, M cluster = low (8x difference)
- Load Config: 811600 L = high, 213000 H = low
- Diameter: 14-16" = high, 18"+ = low (8x difference)

**Composition Risk Model** (powers Anomaly Detection graphite tab):
- Logistic regression: lot risk + bake car deck → run-level AUC 0.803
- Q1 runs: 1.1% defect rate, Q5 runs: 7.8%
- Graphitization furnace parameters have zero predictive power — the signal is upstream

**Equipment Degradation** (visible in Equipment Trending):
- Bake Furnace 5 trending worse (+0.62%/month), correlated with high car deck assignments
- Graphite furnaces are stable — defects originate at bake, not graphite

## Databricks Deployment

For production deployment on Databricks Apps:

1. **db.py** must be updated with Lakebase OAuth support (see existing Lakebase-aware version)
2. **app.yaml** must include env vars: LAKEBASE_MODE=true, PGHOST, PGDATABASE, PGPORT
3. **requirements.txt** must include databricks-sdk
4. Seed script should be run once, then removed from the startup command
5. Genie iframe URL must point to the workspace's AI/BI dashboard embed URL

## Future Opportunities

- Connect to real customer data (existing Delta Lake tables in their workspace)
- Real GenAI via Foundation Model API (replace mock responses)
- Maintenance data integration from D365 (maintenance events overlaid on equipment trends)
- Lot screening at extrusion (predict lot risk from batch recipe before baking)
- Real-time sensor streaming for in-run anomaly detection
- Automated model retraining as CLCA data accumulates
