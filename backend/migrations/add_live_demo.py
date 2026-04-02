import psycopg2


def main():
    conn = psycopg2.connect(dbname="electrode_v2", user="postgres", host="localhost")
    cur = conn.cursor()
    cur.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS is_live_demo BOOLEAN DEFAULT false")
    cur.execute("UPDATE runs SET is_live_demo = true WHERE run_number = 'GR-00366'")
    conn.commit()
    cur.close()
    conn.close()
    print("Done: is_live_demo column added, GR-00366 flagged")


if __name__ == "__main__":
    main()
