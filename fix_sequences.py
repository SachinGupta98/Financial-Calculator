import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
db_url = os.getenv("DATABASE_URL", "")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url or 'sqlite:///database.db'
db = SQLAlchemy(app)

def fix_sequences():
    with app.app_context():
        tables = [
            'user', 'expense', 'goal', 'asset', 'settings', 
            'custom_category', 'category_limit', 'recurring_expense'
        ]
        
        for table in tables:
            try:
                # Get the sequence name and set it to the max id
                query = f"""
                SELECT setval(
                    pg_get_serial_sequence('"{table}"', 'id'), 
                    COALESCE((SELECT MAX(id) FROM "{table}"), 1), 
                    max(id) IS NOT null
                ) FROM "{table}";
                """
                db.session.execute(db.text(query))
                print(f"Sequence for '{table}' successfully reset.")
            except Exception as e:
                db.session.rollback()
                print(f"Could not reset sequence for '{table}': {e}")
        
        try:
            db.session.commit()
            print("\nAll sequences have been updated successfully! Your /register endpoint should work now.")
        except Exception as e:
            print(f"\nError committing changes: {e}")

if __name__ == '__main__':
    fix_sequences()
