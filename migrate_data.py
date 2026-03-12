"""
FinFlap: One-Time SQLite → PostgreSQL Data Migration Script
===========================================================
Run this ONCE after setting up your PostgreSQL database.

HOW TO USE:
1. Make sure your PostgreSQL DATABASE_URL is set in your .env file.
2. Make sure the old SQLite 'instance/database.db' file still exists.
3. Run: python migrate_data.py
4. Done! All your data is now in PostgreSQL.
"""

import os
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── STEP 1: Connect to OLD SQLite database ──────────────────────────────────
SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'database.db')

if not os.path.exists(SQLITE_PATH):
    print(f"❌ SQLite database not found at: {SQLITE_PATH}")
    print("   Make sure your old database.db file is in the 'instance' folder.")
    exit(1)

print(f"✅ Found SQLite database at: {SQLITE_PATH}")
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
cur = sqlite_conn.cursor()

# ── STEP 2: Boot Flask app with PostgreSQL (new DATABASE_URL from .env) ──────
from app import app, db, User, Expense, Goal, Asset, Settings, CustomCategory, CategoryLimit, RecurringExpense

with app.app_context():
    print("\n🐘 Connected to PostgreSQL. Creating all tables...")
    db.create_all()
    print("✅ Schema created.\n")

    # ── Users ──────────────────────────────────────────────────────────────
    cur.execute("SELECT * FROM user")
    users_raw = cur.fetchall()
    print(f"📦 Migrating {len(users_raw)} users...")

    for row in users_raw:
        if User.query.get(row['id']):
            continue  # Skip if already exists
        u = User(
            id=row['id'],
            username=row['username'],
            email=row['email'],
            password_hash=row['password_hash'],
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.utcnow()
        )
        db.session.add(u)
    db.session.commit()
    print("✅ Users migrated.")

    # ── Settings ───────────────────────────────────────────────────────────
    cur.execute("SELECT * FROM settings")
    for row in cur.fetchall():
        if Settings.query.get(row['id']): continue
        db.session.add(Settings(id=row['id'], user_id=row['user_id'],
            monthly_income=row['monthly_income'], monthly_budget=row['monthly_budget']))
    db.session.commit()
    print("✅ Settings migrated.")

    # ── Expenses ───────────────────────────────────────────────────────────
    cur.execute("SELECT * FROM expense")
    rows = cur.fetchall()
    print(f"📦 Migrating {len(rows)} expenses...")
    for row in rows:
        if Expense.query.get(row['id']): continue
        db.session.add(Expense(id=row['id'], user_id=row['user_id'],
            description=row['description'], amount=row['amount'],
            date=row['date'], category=row['category']))
    db.session.commit()
    print("✅ Expenses migrated.")

    # ── Goals ──────────────────────────────────────────────────────────────
    cur.execute("SELECT * FROM goal")
    rows = cur.fetchall()
    print(f"📦 Migrating {len(rows)} goals...")
    for row in rows:
        if Goal.query.get(row['id']): continue
        db.session.add(Goal(id=row['id'], user_id=row['user_id'],
            name=row['name'], target_amount=row['target_amount'],
            saved_amount=row['saved_amount'], target_date=row['target_date'],
            category=row['category']))
    db.session.commit()
    print("✅ Goals migrated.")

    # ── Assets ─────────────────────────────────────────────────────────────
    cur.execute("SELECT * FROM asset")
    rows = cur.fetchall()
    print(f"📦 Migrating {len(rows)} assets...")
    for row in rows:
        if Asset.query.get(row['id']): continue
        db.session.add(Asset(id=row['id'], user_id=row['user_id'],
            name=row['name'], asset_type=row['asset_type'],
            invested_amount=row['invested_amount'], current_value=row['current_value']))
    db.session.commit()
    print("✅ Assets migrated.")

    # ── Custom Categories ──────────────────────────────────────────────────
    cur.execute("SELECT * FROM custom_category")
    for row in cur.fetchall():
        if CustomCategory.query.get(row['id']): continue
        db.session.add(CustomCategory(id=row['id'], user_id=row['user_id'],
            name=row['name'], emoji=row['emoji'], color=row['color']))
    db.session.commit()
    print("✅ Custom categories migrated.")

    # ── Category Limits ────────────────────────────────────────────────────
    cur.execute("SELECT * FROM category_limit")
    for row in cur.fetchall():
        if CategoryLimit.query.get(row['id']): continue
        db.session.add(CategoryLimit(id=row['id'], user_id=row['user_id'],
            category=row['category'], monthly_limit=row['monthly_limit']))
    db.session.commit()
    print("✅ Category limits migrated.")

    # ── Recurring Expenses ─────────────────────────────────────────────────
    cur.execute("SELECT * FROM recurring_expense")
    for row in cur.fetchall():
        if RecurringExpense.query.get(row['id']): continue
        db.session.add(RecurringExpense(id=row['id'], user_id=row['user_id'],
            description=row['description'], amount=row['amount'],
            category=row['category'], day_of_month=row['day_of_month'],
            last_logged=row['last_logged']))
    db.session.commit()
    print("✅ Recurring expenses migrated.")

sqlite_conn.close()
print("\n🎉 Migration complete! All data is now in PostgreSQL.")
print("   You can now delete 'instance/database.db' once you've verified everything works.")
