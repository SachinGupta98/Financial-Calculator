import os
import requests
from requests.exceptions import RequestException, Timeout
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from dotenv import load_dotenv

from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from datetime import datetime

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__)

# Grab the API key you provided in the .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- DATABASE & AUTH SETUP ---
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "fallback-secret-key-12345")

# Check for a live database URL (like Postgres on Render/Railway) first, fallback to local SQLite
db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    # SQLAlchemy requires 'postgresql://' instead of 'postgres://' which Heroku/Render sometimes use
    db_url = db_url.replace("postgres://", "postgresql://", 1)
    
app.config['SQLALCHEMY_DATABASE_URI'] = db_url or 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- DATABASE MODELS ---

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    expenses = db.relationship('Expense', backref='user', lazy=True)
    goals = db.relationship('Goal', backref='user', lazy=True)
    assets = db.relationship('Asset', backref='user', lazy=True)
    settings = db.relationship('Settings', backref='user', uselist=False)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(50), nullable=False)

class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    saved_amount = db.Column(db.Float, default=0.0)
    target_date = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(50), nullable=False)

class Asset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    asset_type = db.Column(db.String(50), nullable=False)
    invested_amount = db.Column(db.Float, nullable=False)
    current_value = db.Column(db.Float, nullable=False)

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    monthly_income = db.Column(db.Float, default=0.0)
    monthly_budget = db.Column(db.Float, default=0.0)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- AUTH ROUTES ---

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'danger')
            return redirect(url_for('register'))
        if User.query.filter_by(email=email).first():
            flash('Email already registered.', 'danger')
            return redirect(url_for('register'))
            
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(username=username, email=email, password_hash=hashed_pw)
        db.session.add(new_user)
        db.session.commit()
        
        # Initialize empty settings for new user
        new_settings = Settings(user_id=new_user.id)
        db.session.add(new_settings)
        db.session.commit()
        
        flash('Account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('Login Unsuccessful. Please check email and password.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """Serves the main HTML interface."""
    # Flask looks for this inside the 'templates' folder
    return render_template('index.html')

# --- JSON API ENDPOINTS FOR FRONTEND ---

@app.route('/api/data', methods=['GET'])
@login_required
def get_data():
    user = current_user
    expenses_data = [{"id": e.id, "description": e.description, "amount": e.amount, "date": e.date, "category": e.category} for e in user.expenses]
    
    # We map Python keys back to JS expected keys (e.g. target_amount -> targetAmount)
    goals_data = [{"id": g.id, "title": g.name, "targetAmount": g.target_amount, "savedAmount": g.saved_amount, "targetDate": g.target_date, "category": g.category} for g in user.goals]
    
    assets_data = [{"id": a.id, "name": a.name, "type": a.asset_type, "invested": a.invested_amount, "current": a.current_value} for a in user.assets]
    
    settings_data = {"income": user.settings.monthly_income, "budget": user.settings.monthly_budget} if user.settings else {"income": 0, "budget": 0}
    
    return jsonify({
        "expenses": expenses_data,
        "goals": goals_data,
        "portfolio": assets_data,
        "settings": settings_data,
        "user": {"username": user.username, "email": user.email}
    })

@app.route('/api/settings', methods=['POST'])
@login_required
def update_settings():
    data = request.json
    if not current_user.settings:
        current_user.settings = Settings(user_id=current_user.id)
        db.session.add(current_user.settings)
    current_user.settings.monthly_income = float(data.get('income', 0))
    current_user.settings.monthly_budget = float(data.get('budget', 0))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/expense', methods=['POST'])
@login_required
def add_expense():
    data = request.json
    new_exp = Expense(user_id=current_user.id, description=data['description'], amount=float(data['amount']), date=data['date'], category=data['category'])
    db.session.add(new_exp)
    db.session.commit()
    return jsonify({"status": "success", "id": new_exp.id})

@app.route('/api/expense/<int:id>', methods=['DELETE'])
@login_required
def delete_expense(id):
    exp = Expense.query.get_or_404(id)
    if exp.user_id == current_user.id:
        db.session.delete(exp)
        db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/goal', methods=['POST'])
@login_required
def add_goal():
    data = request.json
    if data.get('id'):
        goal = Goal.query.get(data['id'])
        if goal and goal.user_id == current_user.id:
            goal.name = data['title']
            goal.target_amount = float(data['targetAmount'])
            goal.saved_amount = float(data['savedAmount'])
            goal.target_date = data['targetDate']
            goal.category = data['category']
    else:
        goal = Goal(user_id=current_user.id, name=data['title'], target_amount=float(data['targetAmount']), saved_amount=float(data['savedAmount']), target_date=data['targetDate'], category=data['category'])
        db.session.add(goal)
    db.session.commit()
    return jsonify({"status": "success", "id": goal.id})

@app.route('/api/goal/<int:id>', methods=['DELETE'])
@login_required
def delete_goal(id):
    goal = Goal.query.get_or_404(id)
    if goal.user_id == current_user.id:
        db.session.delete(goal)
        db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/asset', methods=['POST'])
@login_required
def add_asset():
    data = request.json
    if data.get('id'):
        asset = Asset.query.get(data['id'])
        if asset and asset.user_id == current_user.id:
            asset.name = data['name']
            asset.asset_type = data['type']
            asset.invested_amount = float(data['invested'])
            asset.current_value = float(data['current'])
    else:
        asset = Asset(user_id=current_user.id, name=data['name'], asset_type=data['type'], invested_amount=float(data['invested']), current_value=float(data['current']))
        db.session.add(asset)
    db.session.commit()
    return jsonify({"status": "success", "id": asset.id})

@app.route('/api/asset/<int:id>', methods=['DELETE'])
@login_required
def delete_asset(id):
    asset = Asset.query.get_or_404(id)
    if asset.user_id == current_user.id:
        db.session.delete(asset)
        db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/gemini', methods=['POST'])
@login_required
def get_financial_advice():
    """Secure endpoint that the frontend calls to get AI advice."""
    if not GEMINI_API_KEY:
         return jsonify({"error": "Server configuration error: Gemini API key is missing."}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON format payload"}), 400
            
        user_prompt = data.get('prompt')
        if not user_prompt or not isinstance(user_prompt, str) or len(user_prompt.strip()) == 0:
            return jsonify({"error": "A valid prompt string is required"}), 400
            
        # Truncate prompt if extremely long to avoid abusive payload lengths
        if len(user_prompt) > 2000:
            user_prompt = user_prompt[:2000]

        # Using the exact URL and structure from your cURL command
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        # We give the AI a "persona" so it acts like FinPal before answering the user
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"You are FinPal, an expert financial advisor. Provide concise, actionable financial advice tailored to the user's query. Format your response nicely in Markdown. User query: {user_prompt}"
                        }
                    ]
                }
            ]
        }

        # Make the request to Google's servers with a timeout to prevent hanging
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response.raise_for_status() # Check for HTTP errors
        
        gemini_data = response.json()
        
        # Extract the text from the Gemini response structure securely
        try:
            advice_text = gemini_data['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError) as e:
            print(f"❌ Unexpected API Response shape: {e}")
            return jsonify({"error": "The AI provided an unexpected response format. Please try again."}), 500
            
        # Send it back to our JavaScript frontend
        return jsonify({"text": advice_text})

    except Timeout:
        print("❌ Backend Error: AI request timed out.")
        return jsonify({"error": "The AI is taking too long to respond. Please try again later."}), 504
    except RequestException as e:
        print(f"❌ Backend Request Error: {e}")
        return jsonify({"error": "Network issue connecting to the AI service."}), 502
    except Exception as e:
        print(f"❌ Backend Error: {e}")
        return jsonify({"error": "I'm having trouble connecting to the AI brain right now. Please try again later."}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)