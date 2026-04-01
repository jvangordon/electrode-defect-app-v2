import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres@localhost:5432/electrode_v2",
)


def _parse_dsn(url: str) -> dict:
    from urllib.parse import urlparse
    p = urlparse(url)
    return {
        "host": p.hostname or "localhost",
        "port": p.port or 5432,
        "user": p.username or "postgres",
        "password": p.password or "",
        "dbname": p.path.lstrip("/") or "electrode_v2",
    }


def get_connection():
    params = _parse_dsn(DATABASE_URL)
    return psycopg2.connect(**params)


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor(commit: bool = False):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit:
            conn.commit()
        else:
            conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
