# EDRS — Electrode Defect Reduction System

A production-quality web application for graphite electrode manufacturers to reduce defective weight across multi-step manufacturing processes. Built for process engineers, department managers, reliability engineers, and maintenance managers who need to prevent defects, investigate problems, and track equipment health daily.

![Operations Dashboard](docs/screenshots/dashboard.png)

## Overview

Graphite electrodes are manufactured through a 10-step process across two plants. Defects can originate at one step but only be detected later — a crack introduced during baking may not show up until graphitization or finishing. This application provides the tools to trace, compare, detect, and investigate defects across the entire manufacturing lifecycle.

### Key Capabilities

- **Run Comparison** — Side-by-side comparison of furnace runs with process parameters, electrode position maps, and sensor data overlays
- **Anomaly Detection** — SPC control charts for bake operations, composition-based risk scoring (Q1-Q5) for graphite operations
- **Equipment Trending** — 18-month performance trending with degradation detection and cross-equipment comparison
- **Investigation Workflow** — Full electrode lifecycle tracing, root cause investigation, corrective action tracking

## Screenshots

### Run Comparison
Compare a high-defect run (BK-00311, BF-3, 11.4%) against a clean run (BK-00305, BF-1, 2.5%). Position maps show spatial patterns — defects cluster at specific furnace positions.

![Run Comparison](docs/screenshots/run-comparison.png)

### Anomaly Detection
SPC control charts with UCL/LCL boundaries flag runs where car deck position or other parameters exceed statistical control limits.

![Anomaly Detection](docs/screenshots/anomaly-detection.png)

### Equipment Trending
BF-3 showing degradation trend — defect rate increasing at 0.227%/month with supporting charts for kWh, downtime, run time, and car deck assignment.

![Equipment Trending](docs/screenshots/equipment-trending.png)

### Investigation Detail
Investigation workflow with notes thread, corrective actions, status progression, and cost estimates.

![Investigation Detail](docs/screenshots/investigation-detail.png)

### Electrode Lifecycle
10-step manufacturing lifecycle timeline showing where defects were introduced. Risk factor attribution and sibling analysis for spatial pattern detection.

![Electrode Lifecycle](docs/screenshots/electrode-lifecycle.png)

## How to Use the App

### Daily Workflow

The app is designed around a natural investigation workflow. Here's how each persona typically uses it:

#### 1. Start at the Operations Dashboard

The dashboard is your morning check-in. Open the app and scan:
- **KPI row** at the top — 90-day defect rate, total defects, electrodes produced, open investigations, equipment alerts
- **Defect Rate Trend** — is the overall trend going up or down over the last 6 months?
- **Furnace Status Grid** — every furnace color-coded by recent defect rate. Green is healthy, amber needs watching, red needs action. Each tile shows the furnace name, department, defect rate, and run count.
- **Recent High-Defect Runs** — the right panel lists recent runs above the defect threshold with risk quintile badges (Q1-Q5 for graphite runs)
- **Investigation status** — how many open, in progress, closed, and verified investigations exist

#### 2. Investigate a Bad Run (Run Comparison)

When you spot a high-defect run on the dashboard:
1. Click **Run Comparison** in the sidebar
2. Select the department tab (**Bake** or **Graphite**) and optionally filter by furnace
3. The run table shows all recent runs with defect rates color-coded — red rows have high defect rates
4. Click two runs to select them (numbered badges 1 and 2 appear). Pick one bad run and one clean run on the same furnace for the best comparison.
5. Click the **Compare** button
6. The side-by-side view shows:
   - **Run headers** — each run's furnace, pieces, defects, kWh at a glance
   - **Parameter Comparison** — every process parameter side by side with deviation percentages. Significant deviations are highlighted in amber.
   - **Position Maps** — visual grids showing electrode positions in each furnace. Green squares are clean electrodes, red squares are defective (with defect codes shown). Look for spatial patterns — do defects cluster in certain positions?
   - **Sensor Data Overlay** — if sensor data exists, toggle between sensor tags to see time-series from both runs overlaid on the same chart. Deviations in temperature, push displacement, or resistance rate become immediately visible.
7. Click **← Back to run list** to compare different runs

#### 3. Check for Anomalies (Anomaly Detection)

Click **Anomaly Detection** in the sidebar. Two tabs:

**Bake — SPC tab:**
- **SPC Control Chart (Car Deck Position)** — each dot is a run plotted by its car deck position. The dashed lines are the Upper and Lower Control Limits (UCL/LCL). Red dots exceed control limits — these are statistically anomalous.
- **Defect Rate by Run** — a time-series of defect rates with the mean line shown. Spikes above the red dashed line are out-of-control runs.
- **Flagged Anomalous Runs table** — every flagged run with severity (low/medium/high/critical), car deck, defect rate, and the specific deviations that triggered the flag (e.g., "car deck: 1.59σ high, duration hours: 1.7σ high").

**Graphite — Composition Risk tab:**
- Shows graphite runs scored by pre-load composition risk (Q1 lowest risk through Q5 highest risk)
- Click any run to see the composition breakdown — which electrodes were loaded, their upstream lot history, and why the risk score is what it is
- Q4-Q5 runs in red deserve pre-load inspection or electrode redistribution

#### 4. Track Equipment Health (Equipment Trending)

Click **Equipment Trending** in the sidebar:
- The left panel lists all furnaces sorted by defect rate. Each shows the rate, run frequency, and a trend indicator (stable/degrading).
- Click any furnace to see its **18-month trend charts**:
  - **Defect Rate Trend** — monthly defect rates with a dashed trend line. If the trend is statistically significant, the furnace is flagged as "Degrading" in red at the top.
  - **Avg kWh**, **Avg Downtime**, **Avg Run Time**, **Avg Car Deck** — supporting operational metrics that may explain the defect trend
- The **Cross-Equipment Comparison** bar chart at the bottom shows all furnaces ranked by current defect rate — useful for prioritizing maintenance spend.
- Toggle between **Bake** and **Graphite** department views in the top-right.

#### 5. Investigate a Defect (Investigation Workflow)

Click **Investigations** in the sidebar:

**Finding an electrode:**
- Use the **search bar** to search by GPN (electrode ID), lot number, or run number
- Or browse existing investigations in the table, filtering by status (All, Open, In Progress, Closed, Verified)
- Overdue investigations are highlighted with red due dates

**Viewing an investigation:**
- Click any row to open the investigation detail
- See: investigation status, assigned engineer, defect code, root cause category, due date
- **Notes thread** — chronological notes from team members. Add your own with the text input at the bottom.
- **Corrective Actions** — each action shows title, priority, assigned person, due date, estimated cost savings, and status. Click the status button to advance it (open → in progress → completed).
- Click **View Electrode** to see the full electrode detail
- Click **Move to [next status]** to advance the investigation workflow

**Viewing an electrode:**
- **Manufacturing Lifecycle** — a horizontal 10-step timeline showing every process step (Plant A Extrusion → Plant A Bake → Plant A PI → Plant A Rebake → Plant B Bake → Plant B PI → Plant B Rebake → Plant B Graphite → Plant B Finishing → Plant B Assembly). Each step is color-coded: green = clean, red = defect detected (with defect code), gray = no data. This tells you at a glance where the defect was introduced and what steps the electrode passed through.
- **Risk Factor Attribution** — shows the 5 validated risk factors (furnace, position, profile, blend, diameter) with high/medium/low risk badges for this electrode
- **Sibling Electrodes** — all other electrodes from the same run, their positions, lots, and defect status. Reveals spatial patterns (e.g., 4 of 5 defective siblings were in edge positions).
- **Existing Investigations** — if this electrode already has investigations, they're linked here

### Tips

- **Color coding is consistent everywhere:** Green = good/low risk, Amber = watch/medium, Red = action needed/high risk
- **Monospace numbers** are used throughout for data alignment — this is intentional for scan-readability
- **Click the sidebar collapse arrow** (bottom-left) to maximize content area on smaller screens
- **The app is optimized for 1920px and 1366px monitors** — the typical display sizes in manufacturing control rooms

---

## FAQ

**Q: What is defective weight and why does it matter?**
Defective weight is the total weight of electrodes that fail quality inspection at any manufacturing step. Since graphite electrodes are high-value products used in electric arc furnaces for steel recycling, each defective electrode represents significant material and processing cost. Reducing defective weight by even a few percentage points can save hundreds of thousands of dollars annually.

**Q: What are the 10 process steps?**
Plant A Extrusion → Plant A Bake → Plant A PI (Post-Impregnation) → Plant A Rebake → Plant B Bake → Plant B PI → Plant B Rebake → Plant B Graphite → Plant B Finishing → Plant B Assembly. An electrode may pass through all or a subset of these steps depending on the product specification.

**Q: What do the defect codes mean?**
Defect codes indicate the type of defect found during inspection. Common codes include CR (crack), PR (porosity), SP (spalling), BK (breakage), LN (longitudinal crack), SFC (surface crack), DI (dimensional), and OX (oxidation). Each code has sub-variants (e.g., CR-1, CR-2) indicating severity or location.

**Q: What is car deck position and why does it matter?**
In bake furnaces (tunnel kilns), electrodes are loaded onto car decks that move through the furnace. The deck number (1-9) determines the electrode's position in the thermal gradient. Historical data shows that high-numbered decks (8-9) produce approximately 70% more downstream defects than low-numbered decks (4-5), likely due to thermal non-uniformity at the rear of the kiln.

**Q: What are risk quintiles (Q1-Q5)?**
For graphite furnace runs, each run receives a pre-load risk score based on the composition of electrodes being loaded — which lots they came from, their upstream defect history, and lot-level risk tiers. Q1 (lowest risk) historically produces ~1% defect rates, while Q5 (highest risk) historically produces ~8% defect rates with a high probability of a significant defect event. Operators can use this to redistribute high-risk electrodes or flag runs for closer inspection.

**Q: What makes an SPC flag trigger?**
The SPC (Statistical Process Control) system flags bake runs where process parameters deviate beyond 2 standard deviations from the mean. The primary parameters monitored are car deck position, duration hours, actual kWh, and total downtime. The sigma value shown (e.g., "1.7σ high") indicates how many standard deviations from the mean the parameter falls. Runs with multiple parameters beyond 1.5σ are flagged as higher severity.

**Q: How does the equipment degradation detection work?**
Monthly defect rates are computed for each furnace over 18 months. A linear regression (trend line) is fitted to this data. If the slope is positive (defect rate increasing) and the p-value is below a significance threshold, the furnace is flagged as "Degrading." The slope value tells you the rate of degradation in percentage points per month.

**Q: Can I create a new investigation from the app?**
Yes. From the Investigations list view, you can create new investigations. From any electrode detail view, you can see existing investigations linked to that electrode. The investigation workflow follows: Open → In Progress → Closed → Verified.

**Q: How do corrective actions work?**
Each investigation can have multiple corrective actions. Actions have a title, description, assigned person, priority (low/medium/high/critical), due date, and estimated cost savings. Actions follow the workflow: Open → In Progress → Completed. Overdue actions are highlighted in red. The expected vs actual savings fields allow tracking whether the corrective action delivered its projected ROI.

**Q: What data is simulated vs real?**
In the current deployment, all data is simulated but designed to tell a coherent manufacturing story — BF-3 shows a degradation trend, high car decks produce more defects, edge positions in graphite furnaces have ~3x defect rates, and high-risk lots correlate with downstream quality issues. In production, the seed data would be replaced with live data from Databricks Lakebase via a SQL connector.

**Q: How would this connect to real production data?**
The backend uses standard PostgreSQL queries via psycopg2. In production on Databricks, the database layer would switch to Lakebase (fully Postgres-compatible), and a Databricks SQL connector could be added for analytical queries against the lakehouse. The `backend/db.py` module is designed to make this swap straightforward — change the connection string and optionally add a secondary connector for heavy analytical queries.

---

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend:** Python FastAPI
- **Database:** PostgreSQL (Lakebase-compatible for Databricks deployment)
- **Deployment:** Databricks Apps (port 8000)

## Data Model

| Table | Records | Description |
|-------|---------|-------------|
| `runs` | ~716 | Furnace runs across bake and graphite departments |
| `electrodes` | ~16,375 | Individual electrodes with full lifecycle tracking |
| `sensor_readings` | ~35,000 | Time-series sensor data (push displacement, resistance rate) |
| `lots` | ~200 | Lot-level quality summaries with risk tiers |
| `equipment_monthly` | ~306 | Pre-computed monthly equipment performance metrics |
| `risk_factors` | 26 | Validated categorical risk factors |
| `composition_risk` | 5 | Pre-load risk quintile definitions (Q1-Q5) |
| `investigations` | ~25 | Root cause investigations with status workflow |
| `investigation_notes` | ~75 | Timestamped investigation notes |
| `corrective_actions` | ~35 | Actions with priority, savings tracking, status |

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# Clone the repo
git clone https://github.com/jvangordon/electrode-defect-app-v2.git
cd electrode-defect-app-v2

# Create database
createdb electrode_v2

# Install backend dependencies
pip install fastapi uvicorn psycopg2-binary

# Seed the database
python -m backend.seed

# Start the backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# In another terminal — install frontend dependencies
cd frontend
npm install

# Start the frontend dev server
npm run dev
```

The app will be available at `http://localhost:5173` with API proxy to port 8000.

### Databricks Apps Deployment

```yaml
# app.yaml
command: ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build the frontend (`npm run build` in `frontend/`) and the static files will be served from `static/`.

## Design Philosophy

- **Industrial professional** — dark theme with amber accents, inspired by furnace control room aesthetics
- **Domain-specific visualizations** — furnace position maps, SPC control charts, electrode lifecycle timelines
- **Data-dense** — engineers want to see the numbers; information is presented in dense tables and charts, not hidden behind interactions
- **Workflow-oriented** — every click leads to the next logical step in the defect investigation workflow

## Personas Served

| Persona | Primary Views |
|---------|--------------|
| Process Engineer | Run Comparison, Anomaly Detection, Investigations |
| Operator | Anomaly Detection (pre-load risk scoring) |
| Department Manager | Dashboard, Equipment Trending |
| Reliability Engineer | Equipment Trending |
| Maintenance Manager | Equipment Trending, Dashboard |
