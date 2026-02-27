import os
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__)

# Grab the API key you provided in the .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@app.route('/')
def index():
    """Serves the main HTML interface."""
    # Flask looks for this inside the 'templates' folder
    return render_template('index.html')

@app.route('/api/gemini', methods=['POST'])
def get_financial_advice():
    """Secure endpoint that the frontend calls to get AI advice."""
    try:
        data = request.get_json()
        user_prompt = data.get('prompt')

        if not user_prompt:
            return jsonify({"error": "No prompt provided"}), 400

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

        # Make the request to Google's servers
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status() # Check for HTTP errors
        
        gemini_data = response.json()
        
        # Extract the text from the Gemini response structure
        advice_text = gemini_data['candidates'][0]['content']['parts'][0]['text']
        
        # Send it back to our JavaScript frontend
        return jsonify({"text": advice_text})

    except Exception as e:
        print(f"❌ Backend Error: {e}")
        return jsonify({"error": "I'm having trouble connecting to the AI brain right now. Please try again later."}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)