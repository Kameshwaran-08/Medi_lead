import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print(f"API Key loaded: {key[:10]}..." if key else "ERROR: GEMINI_API_KEY not found in .env!")

genai.configure(api_key=key)

try:
    model = genai.GenerativeModel("gemini-2.0-flash-exp")
    r = model.generate_content("say hello in one sentence")
    print("SUCCESS:", r.text)
except Exception as e:
    print("FAILED:", e)
