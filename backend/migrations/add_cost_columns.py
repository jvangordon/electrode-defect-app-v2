"""
Migration: Add cost columns to electrodes and runs tables.

Adds:
  - electrodes.cost_per_defect REAL
  - runs.defect_cost REAL DEFAULT 0
  - runs.defect_weight_kg REAL DEFAULT 0

Populates cost_per_defect from diameter mapping, then computes
defect_cost and defect_weight_kg for each run.

Idempotent — safe to run multiple times.
"""

import psycopg2
import psycopg2.extras

COST_PER_DEFECT = {
    300: 450,
    350: 652,
    400: 1414,
    450: 2316,
    500: 2652,
    550: 2900,
    600: 3121,
}


def run_migration():
    conn = psycopg2.connect(
        host="localhost", port=5432, user="postgres", password="", dbname="electrode_v2"
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Add columns (IF NOT EXISTS via DO block)
        print("Adding columns...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'electrodes' AND column_name = 'cost_per_defect'
                ) THEN
                    ALTER TABLE electrodes ADD COLUMN cost_per_defect REAL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'runs' AND column_name = 'defect_cost'
                ) THEN
                    ALTER TABLE runs ADD COLUMN defect_cost REAL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'runs' AND column_name = 'defect_weight_kg'
                ) THEN
                    ALTER TABLE runs ADD COLUMN defect_weight_kg REAL DEFAULT 0;
                END IF;
            END $$;
        """)
        print("  Columns added (or already exist)")

        # 2. Populate cost_per_defect on all electrodes
        print("Populating cost_per_defect on electrodes...")
        cur.execute("""
            UPDATE electrodes SET cost_per_defect = CASE
                WHEN diameter = 300 THEN 450
                WHEN diameter = 350 THEN 652
                WHEN diameter = 400 THEN 1414
                WHEN diameter = 450 THEN 2316
                WHEN diameter = 500 THEN 2652
                WHEN diameter = 550 THEN 2900
                WHEN diameter = 600 THEN 3121
                ELSE 0
            END
        """)
        print(f"  Updated {cur.rowcount} electrodes")

        # 3. Populate defect_cost and defect_weight_kg on runs
        print("Populating defect_cost and defect_weight_kg on runs...")
        cur.execute("""
            UPDATE runs SET defect_cost = COALESCE(sub.total_cost, 0),
                           defect_weight_kg = COALESCE(sub.total_weight, 0)
            FROM (
                SELECT run_number_og as run_number,
                       SUM(cost_per_defect) as total_cost,
                       SUM(weight_kg) as total_weight
                FROM electrodes
                WHERE defect_code_ob IS NOT NULL
                   OR defect_code_og IS NOT NULL
                   OR defect_code_of IS NOT NULL
                GROUP BY run_number_og
            ) sub
            WHERE runs.run_number = sub.run_number
        """)
        print(f"  Updated {cur.rowcount} runs with graphite-linked costs")

        # Also update bake runs via run_number_ob
        cur.execute("""
            UPDATE runs SET defect_cost = GREATEST(runs.defect_cost, COALESCE(sub.total_cost, 0)),
                           defect_weight_kg = GREATEST(runs.defect_weight_kg, COALESCE(sub.total_weight, 0))
            FROM (
                SELECT run_number_ob as run_number,
                       SUM(cost_per_defect) as total_cost,
                       SUM(weight_kg) as total_weight
                FROM electrodes
                WHERE defect_code_ob IS NOT NULL
                GROUP BY run_number_ob
            ) sub
            WHERE runs.run_number = sub.run_number
              AND runs.defect_cost < COALESCE(sub.total_cost, 0)
        """)
        print(f"  Updated {cur.rowcount} bake runs with costs")

        conn.commit()
        print("\nMigration complete!")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run_migration()
