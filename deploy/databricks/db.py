"""Database connection - local PostgreSQL or Databricks Lakebase."""
import os, time, threading, psycopg2, psycopg2.extras
from contextlib import contextmanager

LAKEBASE_MODE = os.environ.get("LAKEBASE_MODE", "").lower() == "true"
_token_lock = threading.Lock()
_cached_token = None
_token_expiry = 0.0
_cached_user = None

def _get_lakebase_token():
    global _cached_token, _token_expiry
    with _token_lock:
        now = time.time()
        if _cached_token and now < _token_expiry: return _cached_token
        from databricks.sdk.core import Config
        cfg = Config()
        headers = cfg.authenticate()
        token = headers["Authorization"].replace("Bearer ", "")
        _cached_token = token
        _token_expiry = now + 2400
        print("[db] Refreshed Lakebase OAuth token")
        return token

def _get_lakebase_user():
    global _cached_user
    if _cached_user: return _cached_user
    try:
        from databricks.sdk import WorkspaceClient
        _cached_user = WorkspaceClient().current_user.me().user_name
        print(f"[db] Lakebase user: {_cached_user}")
        return _cached_user
    except Exception as e:
        f = os.environ.get("PGUSER", "")
        print(f"[db] SDK user failed ({e}), PGUSER={f}")
        return f

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres@localhost:5432/electrode_v2")

def _local_params():
    from urllib.parse import urlparse
    p = urlparse(DATABASE_URL)
    return {"host": p.hostname or "localhost", "port": p.port or 5432, "user": p.username or "postgres", "password": p.password or "", "dbname": p.path.lstrip("/") or "electrode_v2"}

def _lakebase_params():
    return {"host": os.environ.get("PGHOST",""), "port": int(os.environ.get("PGPORT","5432")), "dbname": os.environ.get("PGDATABASE","tokai_app"), "user": _get_lakebase_user(), "password": _get_lakebase_token(), "sslmode": "require"}

def get_connection():
    return psycopg2.connect(**(_lakebase_params() if LAKEBASE_MODE else _local_params()))

@contextmanager
def get_db():
    conn = get_connection()
    try: yield conn
    finally: conn.close()

@contextmanager
def get_cursor(commit=False):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit: conn.commit()
        else: conn.rollback()
    except Exception: conn.rollback(); raise
    finally: conn.close()
