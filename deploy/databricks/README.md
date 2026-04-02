# Deploying to Databricks Apps with Lakebase

## Prerequisites

- Databricks workspace on AWS or Azure
- Databricks CLI v0.285+ (`databricks --version`)
- A Lakebase project with a database created
- A Databricks App created (`databricks apps create`)

## What's Different from Local

The app runs locally against a standard PostgreSQL database. On Databricks Apps, it connects to Lakebase (Postgres-compatible) using OAuth tokens from the app's service principal. Three files need to be swapped:

| File | Local Version | Databricks Version |
|------|--------------|-------------------|
| `backend/db.py` | Connects via `DATABASE_URL` | Connects via Lakebase OAuth (SDK token refresh) |
| `app.yaml` | Just starts uvicorn | Starts uvicorn + sets Lakebase env vars |
| `requirements.txt` | No SDK dependency | Adds `databricks-sdk` for OAuth |

## Step-by-Step

### 1. Copy Databricks-specific files over the local versions

```bash
cp deploy/databricks/db.py backend/db.py
cp deploy/databricks/app.yaml app.yaml
cp deploy/databricks/requirements.txt requirements.txt
```

### 2. Edit app.yaml with your Lakebase details

Open `app.yaml` and replace the placeholder values:

```yaml
env:
  - name: PGHOST
    value: "YOUR_LAKEBASE_ENDPOINT_HOST"  # e.g., ep-xxxxx.database.us-east-1.cloud.databricks.com
  - name: PGDATABASE
    value: "YOUR_DATABASE_NAME"           # e.g., tokai_app
```

To find your Lakebase endpoint host:
```bash
databricks postgres list-endpoints projects/YOUR_PROJECT/branches/production -p YOUR_PROFILE -o json | jq -r '.[0].status.hosts.host'
```

### 3. Seed the database

Run the seed script locally against the Lakebase database ONCE before deploying:

```bash
# Get connection details
HOST=$(databricks postgres list-endpoints projects/YOUR_PROJECT/branches/production -p YOUR_PROFILE -o json | jq -r '.[0].status.hosts.host')
TOKEN=$(databricks postgres generate-database-credential projects/YOUR_PROJECT/branches/production/endpoints/primary -p YOUR_PROFILE -o json | jq -r '.token')
EMAIL=$(databricks current-user me -p YOUR_PROFILE -o json | jq -r '.userName')

# Run seed against Lakebase
DATABASE_URL="postgresql://${EMAIL}:${TOKEN}@${HOST}:5432/YOUR_DATABASE_NAME?sslmode=require" python -m backend.seed
```

Note: The seed script creates the database locally but on Lakebase the database must already exist. Create it first:
```bash
PGPASSWORD=$TOKEN psql "host=$HOST port=5432 dbname=postgres user=$EMAIL sslmode=require" -c "CREATE DATABASE your_database_name;"
```

### 4. Create the Lakebase role for the app's service principal

The app runs as a service principal that needs its own Lakebase role:

```bash
# Get the app's service principal client ID
SP_CLIENT_ID=$(databricks apps get YOUR_APP_NAME -p YOUR_PROFILE -o json | jq -r '.service_principal_client_id')

# Create the role
databricks postgres create-role projects/YOUR_PROJECT/branches/production \
  --role-id app-sp-role \
  --json "{\"spec\": {\"auth_method\": \"LAKEBASE_OAUTH_V1\", \"identity_type\": \"SERVICE_PRINCIPAL\", \"membership_roles\": [\"DATABRICKS_SUPERUSER\"], \"postgres_role\": \"$SP_CLIENT_ID\"}}" \
  --no-wait -p YOUR_PROFILE
```

### 5. Upload to workspace and deploy

```bash
PROFILE=YOUR_PROFILE
APP_NAME=YOUR_APP_NAME
WS_PATH="/Users/YOUR_EMAIL/YOUR_APP_PATH"

# Create workspace directory
databricks workspace mkdirs $WS_PATH -p $PROFILE

# Upload backend
for f in $(find backend -name "*.py" -type f | grep -v __pycache__ | grep -v tests); do
  dir=$(dirname "$f")
  databricks workspace mkdirs "$WS_PATH/$dir" -p $PROFILE
  databricks workspace import "$WS_PATH/$f" --file "$f" --format AUTO --overwrite -p $PROFILE
done

# Upload static
databricks workspace mkdirs "$WS_PATH/static/assets" -p $PROFILE
for f in $(find static -type f); do
  databricks workspace import "$WS_PATH/$f" --file "$f" --format AUTO --overwrite -p $PROFILE
done

# Upload top-level files
for f in app.yaml requirements.txt; do
  databricks workspace import "$WS_PATH/$f" --file "$f" --format AUTO --overwrite -p $PROFILE
done

# Deploy
databricks apps deploy $APP_NAME --source-code-path "/Workspace$WS_PATH" -p $PROFILE
```

### 6. Verify

```bash
# Check deployment status
databricks apps get $APP_NAME -p $PROFILE -o json | jq '.active_deployment.status'

# Check logs if it fails
databricks apps logs $APP_NAME --tail-lines 50 -p $PROFILE
```

## Common Issues

**"No module named 'routers'"** — The import paths differ between local (`from db import`) and Databricks (`from backend.db import`). The db.py in this directory handles both via try/except. If you add new routers, use the same pattern:
```python
try:
    from backend.db import get_cursor
except ImportError:
    from db import get_cursor
```

**"password authentication failed"** — The app service principal's username is resolved via `WorkspaceClient().current_user.me().user_name`, NOT the client ID UUID. The db.py handles this automatically.

**"column X does not exist"** — If you update the frontend to reference new columns, add them via the migration in `main.py` `@app.on_event("startup")`. The app runs as the service principal which owns the tables, so it can ALTER them.

**Seed connects to localhost** — The seed.py is designed for local Postgres. Don't include it in the app.yaml startup command. Seed once manually (step 3 above).

**OAuth token expires** — Tokens last ~60 minutes. The db.py refreshes every 40 minutes automatically via a cached token with expiry tracking.
