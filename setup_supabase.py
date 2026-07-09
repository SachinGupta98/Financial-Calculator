"""
FinFlap — Supabase Setup & Migration Script
===========================================
Run this ONCE to:
  1. Test the Supabase PostgreSQL connection
  2. Create all 8 required tables in Supabase
  3. Optionally migrate existing local SQLite data to Supabase

HOW TO USE:
  1. Fill in your Supabase DB password in .env
     DATABASE_URL=postgresql://postgres.icsllvglxudkkkgzadze:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

  2. Run: python setup_supabase.py

  3. Done! Your Supabase DB is ready.
"""

import os
import sys
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL", "")
if not db_url or "[YOUR-DB-PASSWORD]" in db_url:
    print("ERROR: DATABASE_URL is not set or still has [YOUR-DB-PASSWORD] placeholder.")
    print("   Edit your .env file and replace [YOUR-DB-PASSWORD] with your Supabase database password.")
    print("   Find it at: https://supabase.com/dashboard/project/icsllvglxudkkkgzadze/settings/database")
    sys.exit(1)

print(f"Connecting to: {db_url[:60]}...")

# Fix legacy URL scheme
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Boot Flask app
from app import app, db, User, Expense, Goal, Asset, Settings, CustomCategory, CategoryLimit, RecurringExpense

with app.app_context():
    # STEP 1: Test connection
    print("\nTesting Supabase connection...")
    try:
        result = db.session.execute(db.text("SELECT version()")).fetchone()
        print(f"Connected! PostgreSQL version: {result[0][:60]}")
    except Exception as e:
        print(f"Connection FAILED: {e}")
        print("\nTroubleshooting:")
        print("  1. Check your password in .env")
        print("     Get it from: Supabase Dashboard > Settings > Database > Database password")
        print("  2. Try Direct Connection (port 5432) instead of Transaction Pooler (port 6543)")
        sys.exit(1)

    # STEP 2: Create all tables
    print("\nCreating all FinFlap tables in Supabase...")
    db.create_all()
    print("All 8 tables created (or already exist):")
    for t in ['user', 'settings', 'expense', 'goal', 'asset', 'custom_category', 'category_limit', 'recurring_expense']:
        print(f"  - {t}")

    # STEP 3: Check for local SQLite data
    sqlite_path = os.path.join(os.path.dirname(__file__), 'instance', 'database.db')
    if not os.path.exists(sqlite_path):
        print(f"\nNo local SQLite file found. Skipping migration.")
        print("Supabase is ready! Start the app with: python app.py")
        sys.exit(0)

    migrate = input(f"\nFound local SQLite database. Migrate data to Supabase? (y/N): ").strip().lower()
    if migrate != 'y':
        print("Skipping migration. Supabase is ready!")
        sys.exit(0)

    # STEP 4: Migrate data
    print("\nStarting migration from SQLite to Supabase...\n")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    cur = sqlite_conn.cursor()

    migrated = 0
    skipped = 0

    def migrate_table(model, query, builder):
        global migrated, skipped
        try:
            cur.execute(query)
        except Exception:
            print(f"  Table for {model.__name__} not found in SQLite, skipping.")
            return
        rows = cur.fetchall()
        print(f"  {model.__name__}: {len(rows)} records found...")
        for row in rows:
            if db.session.get(model, row['id']):
                skipped += 1
                continue
            try:
                obj = builder(row)
                db.session.add(obj)
                migrated += 1
            except Exception as e:
                print(f"  Skipped row id={row['id']}: {e}")
                skipped += 1
        try:
            db.session.commit()
            print(f"  {model.__name__} done.")
        except Exception as e:
            db.session.rollback()
            print(f"  {model.__name__} commit failed: {e}")

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(User, "SELECT * FROM user", lambda r: User(**{
        'id': r['id'], 'username': r['username'], 'email': r['email'],
        'password_hash': r['password_hash'],
        'created_at': datetime.fromisoformat(r['created_at']) if r['created_at'] else datetime.now()
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(Settings, "SELECT * FROM settings", lambda r: Settings(**{
        'id': r['id'], 'user_id': r['user_id'],
        'monthly_income': r['monthly_income'], 'monthly_budget': r['monthly_budget']
    }))

    # pyrefly: ignore [unexpected-keyword]
    # pyrefly: ignore [unexpected-keyword]
    migrate_table(Expense, "SELECT * FROM expense", lambda r: Expense(**{
        'id': r['id'], 'user_id': r['user_id'], 'description': r['description'],
        'amount': r['amount'], 'date': r['date'], 'category': r['category']
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(Goal, "SELECT * FROM goal", lambda r: Goal(**{
        'id': r['id'], 'user_id': r['user_id'], 'name': r['name'],
        'target_amount': r['target_amount'], 'saved_amount': r['saved_amount'],
        'target_date': r['target_date'], 'category': r['category']
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(Asset, "SELECT * FROM asset", lambda r: Asset(**{
        'id': r['id'], 'user_id': r['user_id'], 'name': r['name'],
        'asset_type': r['asset_type'], 'invested_amount': r['invested_amount'],
        'current_value': r['current_value']
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(CustomCategory, "SELECT * FROM custom_category", lambda r: CustomCategory(**{
        'id': r['id'], 'user_id': r['user_id'], 'name': r['name'],
        'emoji': r['emoji'], 'color': r['color']
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(CategoryLimit, "SELECT * FROM category_limit", lambda r: CategoryLimit(**{
        'id': r['id'], 'user_id': r['user_id'], 'category': r['category'],
        'monthly_limit': r['monthly_limit']
    }))

    # pyrefly: ignore [unexpected-keyword]
    migrate_table(RecurringExpense, "SELECT * FROM recurring_expense", lambda r: RecurringExpense(**{
        'id': r['id'], 'user_id': r['user_id'], 'description': r['description'],
        'amount': r['amount'], 'category': r['category'],
        'day_of_month': r['day_of_month'], 'last_logged': r['last_logged']
    }))

    sqlite_conn.close()

    # STEP 5: Reset PostgreSQL Sequences
    print("\nResetting PostgreSQL auto-increment sequences...")
    tables = [
        'user', 'settings', 'expense', 'goal', 'asset', 
        'custom_category', 'category_limit', 'recurring_expense'
    ]
    for table in tables:
        try:
            query = f"""
            SELECT setval(
                pg_get_serial_sequence('"{table}"', 'id'), 
                COALESCE((SELECT MAX(id) FROM "{table}"), 1), 
                max(id) IS NOT null
            ) FROM "{table}";
            """
            db.session.execute(db.text(query))
        except Exception as e:
            db.session.rollback()
            print(f"  Warning: Could not reset sequence for '{table}': {e}")
    try:
        db.session.commit()
        print("Sequences reset successfully.")
    except Exception as e:
        print(f"  Warning: Error committing sequence resets: {e}")

    print(f"\nMigration complete!")
    print(f"  Migrated : {migrated} records")
    print(f"  Skipped  : {skipped} records (already existed)")
    print(f"\nFinFlap is now connected to Supabase! Start the app with:")
    print(f"  python app.py")
