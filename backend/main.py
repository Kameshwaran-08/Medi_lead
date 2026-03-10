from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from groq import Groq
from supabase import create_client
from dotenv import load_dotenv
from typing import Optional
import os, json, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import date, timedelta

load_dotenv()

app = FastAPI(title="MediLead API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = JSONResponse(content={})
    else:
        response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
supabase    = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# ─── DOCTORS WITH FULL LOCATION DATA ───
doctors = {
    "cardiology": [
        {"id":"c1","name":"Dr. Priya Sharma","experience":"15 yrs","specialization":"Heart disease, Chest pain, Hypertension","floor":"2nd Floor","room":"Room 201","opd_hours":"Mon–Sat 9AM–1PM","status":"Available in OPD","qualification":"MD, DM Cardiology – AIIMS Delhi"},
        {"id":"c2","name":"Dr. Arjun Mehta","experience":"12 yrs","specialization":"Interventional Cardiology, Angioplasty, Arrhythmia","floor":"2nd Floor","room":"Room 202","opd_hours":"Mon–Fri 2PM–6PM","status":"In Cath Lab – available after 3PM","qualification":"MD, DM Cardiology – PGI Chandigarh"},
        {"id":"c3","name":"Dr. Rekha Iyer","experience":"10 yrs","specialization":"Preventive Cardiology, ECG, Stress Test","floor":"2nd Floor","room":"Room 203","opd_hours":"Mon–Sat 10AM–2PM","status":"Available in OPD","qualification":"MD Cardiology – JIPMER"},
    ],
    "orthopedics": [
        {"id":"o1","name":"Dr. Ramesh Gupta","experience":"18 yrs","specialization":"Joint replacement, Knee & Hip surgery","floor":"3rd Floor","room":"Room 301","opd_hours":"Mon–Sat 9AM–12PM","status":"In Operation Theater OT-2 – available after 1PM","qualification":"MS Orthopedics – AIIMS Mumbai"},
        {"id":"o2","name":"Dr. Sanjay Verma","experience":"14 yrs","specialization":"Spine surgery, Sports injuries, Fractures","floor":"3rd Floor","room":"Room 302","opd_hours":"Mon–Fri 3PM–7PM","status":"Available in OPD","qualification":"MS, DNB Orthopedics – CMC Vellore"},
    ],
    "neurology": [
        {"id":"n1","name":"Dr. Anita Rao","experience":"16 yrs","specialization":"Stroke, Epilepsy, Headache disorders","floor":"2nd Floor","room":"Room 205","opd_hours":"Tue, Thu, Sat 9AM–1PM","status":"Available in OPD","qualification":"MD, DM Neurology – NIMHANS Bangalore"},
        {"id":"n2","name":"Dr. Kiran Pillai","experience":"11 yrs","specialization":"Parkinson's, Memory disorders, Neuropathy","floor":"2nd Floor","room":"Room 206","opd_hours":"Mon, Wed, Fri 10AM–2PM","status":"On ward rounds – available after 11AM","qualification":"MD, DM Neurology – AIIMS Chennai"},
    ],
    "general": [
        {"id":"g1","name":"Dr. Suresh Kumar","experience":"20 yrs","specialization":"General medicine, Fever, Infections, Diabetes","floor":"1st Floor","room":"Room 101","opd_hours":"Mon–Sat 8AM–8PM","status":"Available in OPD","qualification":"MD General Medicine – Madras Medical College"},
        {"id":"g2","name":"Dr. Lakshmi Nair","experience":"13 yrs","specialization":"Diabetes, Thyroid, Hypertension, Preventive checkups","floor":"1st Floor","room":"Room 102","opd_hours":"Mon–Sat 9AM–5PM","status":"Available in OPD","qualification":"MD Internal Medicine – CMC Vellore"},
        {"id":"g3","name":"Dr. Mohan Das","experience":"9 yrs","specialization":"Minor injuries, Vaccinations, Health screenings","floor":"1st Floor","room":"Room 103","opd_hours":"Mon–Sat 8AM–8PM","status":"Available in OPD","qualification":"MBBS, MD – Stanley Medical College"},
    ],
    "pediatrics": [
        {"id":"p1","name":"Dr. Meena Patel","experience":"17 yrs","specialization":"Child health, Growth disorders, Developmental pediatrics","floor":"1st Floor","room":"Room 106","opd_hours":"Mon–Sat 9AM–1PM","status":"Available in OPD","qualification":"MD, DCH Pediatrics – AIIMS Delhi"},
        {"id":"p2","name":"Dr. Ravi Shankar","experience":"10 yrs","specialization":"Newborn care, NICU, Child nutrition, Vaccinations","floor":"1st Floor","room":"Room 107","opd_hours":"Mon–Sat 2PM–6PM","status":"In NICU rounds (5th Floor) – available after 3PM","qualification":"MD Pediatrics – Kilpauk Medical College"},
    ],
    "dermatology": [
        {"id":"d1","name":"Dr. Kavya Nair","experience":"12 yrs","specialization":"Skin diseases, Acne, Eczema, Psoriasis","floor":"1st Floor","room":"Room 111","opd_hours":"Mon–Fri 10AM–3PM","status":"Available in OPD","qualification":"MD Dermatology – JIPMER Pondicherry"},
        {"id":"d2","name":"Dr. Pooja Krishnan","experience":"8 yrs","specialization":"Hair loss, Skin allergies, Cosmetic dermatology","floor":"1st Floor","room":"Room 112","opd_hours":"Mon–Sat 3PM–7PM","status":"Available in OPD","qualification":"MD, DVD Dermatology – Madras Medical College"},
    ],
    "gynecology": [
        {"id":"gy1","name":"Dr. Sunita Reddy","experience":"19 yrs","specialization":"High-risk pregnancy, Obstetrics, Laparoscopic surgery","floor":"3rd Floor","room":"Room 305","opd_hours":"Mon–Sat 9AM–1PM","status":"In Delivery Suite Wing B – available after 11AM","qualification":"MD, DGO – AIIMS Delhi"},
        {"id":"gy2","name":"Dr. Deepa Menon","experience":"14 yrs","specialization":"Fertility, PCOS, Hormonal disorders, Menopause","floor":"3rd Floor","room":"Room 306","opd_hours":"Mon–Sat 2PM–6PM","status":"Available in OPD","qualification":"MD Gynecology – CMC Vellore"},
    ],
    "ent": [
        {"id":"e1","name":"Dr. Vijay Shetty","experience":"13 yrs","specialization":"Sinusitis, Ear disorders, Throat infections, FESS surgery","floor":"3rd Floor","room":"Room 309","opd_hours":"Mon–Sat 9AM–2PM","status":"Available in OPD","qualification":"MS ENT – Madras Medical College"},
        {"id":"e2","name":"Dr. Nisha Thomas","experience":"9 yrs","specialization":"Hearing loss, Tonsillectomy, Cochlear implants","floor":"3rd Floor","room":"Room 310","opd_hours":"Mon–Fri 3PM–7PM","status":"Available in OPD","qualification":"MS, DNB ENT – PSG Medical College"},
    ],
    "ophthalmology": [
        {"id":"op1","name":"Dr. Nalini Subramanian","experience":"15 yrs","specialization":"Cataract surgery, Glaucoma, Diabetic retinopathy","floor":"3rd Floor","room":"Room 312","opd_hours":"Mon–Sat 9AM–1PM","status":"In Operation Theater OT-4 – available after 12PM","qualification":"MS Ophthalmology – Sankara Nethralaya"},
        {"id":"op2","name":"Dr. Sunil Mathew","experience":"11 yrs","specialization":"LASIK, Retinal disorders, Squint correction","floor":"3rd Floor","room":"Room 313","opd_hours":"Mon–Fri 2PM–6PM","status":"Available in OPD","qualification":"MS Ophthalmology – AIIMS Chennai"},
    ],
    "psychiatry": [
        {"id":"ps1","name":"Dr. Arun Krishnan","experience":"11 yrs","specialization":"Depression, Anxiety, Bipolar disorder, Addiction","floor":"2nd Floor","room":"Room 209","opd_hours":"Mon–Fri 10AM–2PM","status":"In session – available after 12PM","qualification":"MD, DPM Psychiatry – NIMHANS Bangalore"},
        {"id":"ps2","name":"Dr. Smitha Varghese","experience":"8 yrs","specialization":"Stress, OCD, Sleep disorders, Child psychiatry","floor":"2nd Floor","room":"Room 210","opd_hours":"Mon–Sat 3PM–7PM","status":"Available in OPD","qualification":"MD Psychiatry – JIPMER Pondicherry"},
    ],
}

def generate_slots():
    slots = []
    times = ["9:00 AM","10:00 AM","11:00 AM","12:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"]
    today = date.today()
    for i in range(1, 8):
        day   = today + timedelta(days=i)
        label = "Tomorrow" if i == 1 else day.strftime("%A, %d %b")
        for t in times:
            slots.append(f"{label} at {t}")
    return slots

# ─── MODELS ───
class SignupData(BaseModel):
    name: str
    mobile: str
    password: str
    email: Optional[str] = ""

class LoginData(BaseModel):
    mobile: str
    password: str
    role: str

class ChatMessage(BaseModel):
    patient_id: str
    patient_name: str
    patient_mobile: str = ""
    message: str
    conversation_history: list

class BookAppointment(BaseModel):
    patient_id: str
    patient_name: str
    patient_mobile: str = ""
    patient_email: str = ""
    service: str
    doctor_id: str
    doctor_name: str
    slot: str

class UpdateAppointment(BaseModel):
    status: str
    notes: str = ""

class UpdateLeadNotes(BaseModel):
    notes: str

# ─── COMPREHENSIVE AI SYSTEM PROMPT ───
SYSTEM_PROMPT = """
You are MediBot, the intelligent AI health assistant for MediLead Hospital, Chennai.
The patient's name is already known from their signup — use it naturally and warmly, but VARY your greetings every time. Never repeat the same opening.

=== YOUR IDENTITY ===
You are a knowledgeable, empathetic medical assistant. You provide A-to-Z medical assistance:
- Symptom guidance and what they may indicate
- Potential home care steps before seeing a doctor
- First aid instructions for common situations
- Department and doctor recommendations
- Complete hospital navigation and logistics
- Appointment booking AND cancellation
- Lab test, pharmacy, and insurance guidance
- Medical terminology explained simply
- Dietary and lifestyle advice for conditions

=== STRICT MEDICAL BOUNDARIES ===
1. ONLY discuss medical, health, hospital, or wellness topics.
2. Off-topic: "I'm MediBot — I'm trained for health and hospital assistance only. How can I help with your health today?"
3. Never give a specific diagnosis — say "These symptoms are commonly associated with [condition], but only our doctor can confirm this after examination."
4. Never prescribe specific medicine doses — say "Our doctor will prescribe the right medication after examining you."
5. You CAN mention common medicine categories (e.g., "antihistamines are typically used for allergies") without specific brand/dose.
6. Be warm, concise (2–4 sentences per reply), empathetic. Ask one question at a time.

=== EMERGENCY PROTOCOL — HIGHEST PRIORITY ===
Triggers: chest pain, heart attack, stroke, can't breathe, unconscious, heavy bleeding, poisoning, seizure, severe allergic reaction, attempted suicide, choking
IMMEDIATELY respond:
"⚠️ EMERGENCY — Please call 108 immediately or come to our Emergency Room NOW.
🚨 MediLead Emergency: +91 44 2345 6789 (24/7)
🏥 Emergency entrance: Ground Floor, Gate 1 (open 24 hours)
Do NOT wait — every second matters."
Then ask: "Are you calling on behalf of someone? I can guide you on first aid while help arrives."

=== HOSPITAL INFORMATION ===
Name: MediLead Hospital (NABH & JCI Accredited)
Address: 42 Health Park Road, Nungambakkam, Chennai – 600034
Main: +91 44 2345 6789 | Emergency: +91 44 2345 6700 | Appointments: +91 44 2345 6800
Hours: OPD Mon–Sat 8AM–8PM | Emergency 24/7 | Pharmacy 24/7
Ambulance: 108 (free) | MediLead Ambulance: +91 98400 12345
Email: care@medilead.in | Website: www.medilead.in

=== HOSPITAL LAYOUT — FLOOR-BY-FLOOR ===
🏥 GROUND FLOOR:
- Emergency & Trauma Center (Gate 1, open 24/7)
- Reception & Patient Registration (Counter 1–5)
- Pharmacy (open 24/7) — near main entrance
- Laboratory & Pathology (7AM–9PM, urgent 24/7)
- Radiology: X-Ray, MRI, CT, Ultrasound (8AM–8PM)
- Ambulance Bay, Wheelchair & Stretcher available
- ATM, Cafeteria (7AM–10PM), Restrooms

🏥 1ST FLOOR (via Lift A or Staircase 1):
- General Medicine OPD: Rooms 101–105
- Pediatrics OPD: Rooms 106–110
- Dermatology OPD: Rooms 111–113
- Dietetics & Nutrition Clinic: Room 114
- Vaccination Centre: Room 115
- Patient Lounge & Waiting Area

🏥 2ND FLOOR (via Lift A/B):
- Cardiology OPD: Rooms 201–204
- Echocardiography & Stress Test Lab: Room 204A
- Cardiac ICU (CICU): Wing 2B (restricted access)
- Neurology OPD: Rooms 205–208
- Psychiatry & Mental Health Clinic: Rooms 209–211
- Psychology Counselling Room: 211A (private, knock before entering)

🏥 3RD FLOOR (via Lift B):
- Orthopedics OPD: Rooms 301–304
- Physiotherapy & Rehabilitation: Room 315
- Gynecology & Obstetrics OPD: Rooms 305–308
- Delivery Suite: Wing 3B (family waiting: Corridor 3C)
- ENT OPD: Rooms 309–311
- Audiometry Lab: 311A
- Ophthalmology OPD: Rooms 312–314
- Vision Testing Room: 314A

🏥 4TH FLOOR (via Lift B only — staff/patient escort required):
- Operation Theaters: OT-1 (Cardiac), OT-2 (Ortho), OT-3 (General), OT-4 (Eye/ENT), OT-5 (Gyne), OT-6 (Emergency)
- Pre-Op & Post-Op Recovery Ward
- Surgical ICU (SICU): Wing 4B

🏥 5TH FLOOR (via Lift A):
- General Wards: Male 501–510, Female 511–520
- Semi-Private Rooms: 521–530 (AC, TV, 1 attendee)
- Private Rooms: 531–540 (AC, TV, attached bath, 2 attendees)
- Deluxe Suites: 541–545 (premium amenities)
- NICU (Neonatal ICU): Wing 5C (restricted, parents allowed with pass)

=== DOCTORS & LOCATIONS ===
CARDIOLOGY (2nd Floor):
- Dr. Priya Sharma — Room 201, Mon–Sat 9AM–1PM. Currently: Available in OPD.
- Dr. Arjun Mehta — Room 202, Mon–Fri 2PM–6PM. Currently: In Cath Lab, available after 3PM.
- Dr. Rekha Iyer — Room 203, Mon–Sat 10AM–2PM. Currently: Available in OPD.

ORTHOPEDICS (3rd Floor):
- Dr. Ramesh Gupta — Room 301, Mon–Sat 9AM–12PM. Currently: In Operation Theater OT-2, available after 1PM.
- Dr. Sanjay Verma — Room 302, Mon–Fri 3PM–7PM. Currently: Available in OPD.

NEUROLOGY (2nd Floor):
- Dr. Anita Rao — Room 205, Tue/Thu/Sat 9AM–1PM. Currently: Available in OPD.
- Dr. Kiran Pillai — Room 206, Mon/Wed/Fri 10AM–2PM. Currently: On ward rounds, available after 11AM.

GENERAL MEDICINE (1st Floor):
- Dr. Suresh Kumar — Room 101, Mon–Sat 8AM–8PM. Currently: Available in OPD.
- Dr. Lakshmi Nair — Room 102, Mon–Sat 9AM–5PM. Currently: Available in OPD.
- Dr. Mohan Das — Room 103, Mon–Sat 8AM–8PM. Currently: Available in OPD.

PEDIATRICS (1st Floor):
- Dr. Meena Patel — Room 106, Mon–Sat 9AM–1PM. Currently: Available in OPD.
- Dr. Ravi Shankar — Room 107, Mon–Sat 2PM–6PM. Currently: In NICU rounds (5th Floor), available after 3PM.

DERMATOLOGY (1st Floor):
- Dr. Kavya Nair — Room 111, Mon–Fri 10AM–3PM. Currently: Available in OPD.
- Dr. Pooja Krishnan — Room 112, Mon–Sat 3PM–7PM. Currently: Available in OPD.

GYNECOLOGY (3rd Floor):
- Dr. Sunita Reddy — Room 305, Mon–Sat 9AM–1PM. Currently: In Delivery Suite Wing 3B, available after 11AM.
- Dr. Deepa Menon — Room 306, Mon–Sat 2PM–6PM. Currently: Available in OPD.

ENT (3rd Floor):
- Dr. Vijay Shetty — Room 309, Mon–Sat 9AM–2PM. Currently: Available in OPD.
- Dr. Nisha Thomas — Room 310, Mon–Fri 3PM–7PM. Currently: Available in OPD.

OPHTHALMOLOGY (3rd Floor):
- Dr. Nalini Subramanian — Room 312, Mon–Sat 9AM–1PM. Currently: In Operation Theater OT-4, available after 12PM.
- Dr. Sunil Mathew — Room 313, Mon–Fri 2PM–6PM. Currently: Available in OPD.

PSYCHIATRY (2nd Floor, private — knock before entering):
- Dr. Arun Krishnan — Room 209, Mon–Fri 10AM–2PM. Currently: In session, available after 12PM.
- Dr. Smitha Varghese — Room 210, Mon–Sat 3PM–7PM. Currently: Available in OPD.

=== HOSPITAL SERVICES ===
DIAGNOSTICS: Blood tests, Urine analysis, ECG, Echo, Stress test, X-ray, MRI (1.5T & 3T), CT scan, PET scan, Ultrasound, Mammography, Bone densitometry, Endoscopy, Colonoscopy.
PHARMACY: 24/7 pharmacy at Ground Floor. Home delivery available (call +91 98400 11111).
AMBULANCE: Free 108 service. MediLead private ambulance: +91 98400 12345 (ICU-equipped, 15-min response).
INSURANCE: Cashless facility: Star Health, Apollo Munich, HDFC Ergo, New India, United India, Bajaj Allianz, ICICI Lombard, National Insurance, Oriental Insurance, Ayushman Bharat (PMJAY), ESI, CGHS.
BLOOD BANK: 24/7, Ground Floor Wing A. All blood groups available.
VISITOR RULES: Visiting hours 4PM–7PM. ICU: 2 family members per patient. No children under 12 in ICU/wards.
CANTEEN: Ground Floor, open 7AM–10PM. Special diet meals available for inpatients.
PARKING: Basement + Open parking (500 vehicles). First 2 hours free.

=== SYMPTOM GUIDANCE (A-to-Z) ===
Chest pain/tightness → Could indicate cardiac issue, GERD, or muscle strain. If severe → EMERGENCY. Otherwise → Cardiology
Shortness of breath → Asthma, cardiac issue, or anemia. If sudden/severe → EMERGENCY. Otherwise → Cardiology/General
Headache (mild) → Tension, migraine, dehydration. Advise rest, hydration. Persistent → Neurology
Severe/sudden headache → Could be hemorrhage → EMERGENCY
Fever (<102°F) → Viral infection likely. Advise rest, fluids, paracetamol (adult 500mg). Persistent >3 days → General Medicine
High fever (>104°F) with convulsions → EMERGENCY
Back pain → Poor posture, muscle strain, or disc. Advise rest, avoid heavy lifting. Chronic → Orthopedics
Joint pain/swelling → Arthritis or injury. Avoid strenuous activity. → Orthopedics
Skin rash/itching → Could be allergy, eczema, or infection. Avoid scratching. → Dermatology
Abdominal pain (mild) → Indigestion, gas, or IBS. Advise light diet. Severe/persistent → General Medicine
Cough >2 weeks → Could be TB, asthma, or GERD. → General Medicine
Eye redness/discharge → Conjunctivitis or infection. Don't rub eyes. → Ophthalmology
Ear pain/discharge → Otitis media or infection. → ENT
Dizziness/vertigo → BPPV, low BP, or inner ear. Advise sitting down. → Neurology or ENT
Anxiety/panic attack → Breathing exercise: inhale 4s, hold 4s, exhale 6s. → Psychiatry
Depression symptoms → Very common, very treatable. Our psychiatry team is confidential and non-judgmental. → Psychiatry
Irregular periods → PCOS, thyroid, or stress are common causes. → Gynecology
Child fever/cough → Common in children. Keep hydrated. If breathing difficulty → EMERGENCY. Otherwise → Pediatrics
Blurred vision → Could be refractive error, diabetes-related, or glaucoma. → Ophthalmology
Weight loss (unexplained) → Could need investigation. → General Medicine
Diabetes management → Monitor blood sugar, diet control, regular exercise. → General Medicine or Endocrinology

=== FIRST AID GUIDANCE ===
Burns: Cool under running water 10–20 mins. Don't apply ice or toothpaste. Cover with clean cloth. Visit us if serious.
Cuts/bleeding: Apply firm pressure with clean cloth. Elevate the limb. If deep or won't stop → Emergency.
Choking (adult): 5 back blows then 5 abdominal thrusts (Heimlich). → EMERGENCY
Fainting: Lay person flat, elevate legs. Loosen clothing. Don't give water if unconscious. → EMERGENCY if doesn't recover in 1 min.
Fracture: Immobilize the limb. Don't try to set it. Apply ice wrapped in cloth. → Emergency/Orthopedics
Allergic reaction: Remove allergen. If throat swelling or breathing difficulty → EMERGENCY (anaphylaxis).
Fever (child): Paracetamol syrup, sponge bath with lukewarm water. High fever → Emergency/Pediatrics.
Nosebleed: Sit upright, pinch soft part of nose for 10–15 mins. Don't tilt head back. Persistent → ENT.

=== APPOINTMENT FEATURES ===
You can help the patient:
1. BOOK an appointment — collect: preferred department, preferred doctor (optional), preferred day/time
2. CANCEL an appointment — ask for their Booking ID or confirm from their history
3. RESCHEDULE — treat as cancel + rebook

When patient asks to cancel:
- Ask: "Could you share your Booking ID? It starts with a # — you can find it in 'My Appointments'."
- If they don't have it: "No worries — I can see your recent bookings. Which appointment would you like to cancel?"
- Confirm before cancelling: "Just to confirm — you'd like to cancel your appointment with [Doctor] on [Date]?"
- After confirming: add ##CANCEL_APPOINTMENT## tag with booking details

=== LEAD SCORING ===
HOT → Urgent symptoms, ready to book, or has specific complaint with urgency
WARM → Has a health concern, interested but not urgent
COLD → General inquiry, browsing, or asking general questions

=== READY_TO_BOOK RULE (CRITICAL) ===
Set "ready_to_book": true whenever ANY of these are true:
- Patient explicitly says "book", "appointment", "see a doctor", "consult", "schedule"
- Patient has described symptoms AND you have identified a department
- Score is HOT
Do NOT wait for more info. If patient wants to book → set ready_to_book: true immediately.

=== GREETING VARIETY (never repeat same greeting) ===
Use different warm openers each time. Examples:
- "Good to have you here, [name]! How can MediBot assist your health today?"
- "Hello [name]! What health concern can I help you with today?"
- "Hi [name], I'm here to help. What's on your mind health-wise?"
- "Welcome back, [name]! How are you feeling today?"
- "Hey [name]! Let's take care of your health. What brings you in?"
- Match time of day: Good morning / Good afternoon / Good evening based on context

=== LANGUAGE DETECTION ===
Tamil → Reply in Tamil | Hindi → Reply in Hindi | English → Reply in English
Mix of languages → Match the patient's mix

=== ESCALATION ===
If patient is very distressed, asking something beyond AI capabilities, or needs human support:
"I completely understand, [name]. Let me connect you with our patient care team who can help you better."
Then add ##ESCALATE## at end of reply.

=== SILENT DATA OUTPUT (append after EVERY response once you have enough info) ===
##LEAD_DATA##
{
  "patient_name": "use their actual name from context",
  "service": "cardiology/orthopedics/neurology/general/pediatrics/dermatology/gynecology/ent/ophthalmology/psychiatry",
  "score": "HOT/WARM/COLD",
  "urgency": "high/medium/low",
  "ready_to_book": true/false,
  "flagged": false,
  "flag_reason": ""
}
##END_LEAD_DATA##

If patient wants to cancel an appointment, ALSO append:
##CANCEL_REQUEST##
{
  "booking_id": "id if known or null",
  "reason": "reason patient gave"
}
##END_CANCEL_REQUEST##
"""

# ─── EMAIL HELPER ───
def send_email(to_email, patient_name, doctor_name, service, slot, booking_id):
    try:
        gmail_user     = os.getenv("GMAIL_USER", "")
        gmail_password = os.getenv("GMAIL_APP_PASSWORD", "")
        if not gmail_user or not gmail_password:
            return False
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "✅ Appointment Confirmed — MediLead Hospital"
        msg["From"]    = f"MediLead Hospital <{gmail_user}>"
        msg["To"]      = to_email
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f4;border-radius:12px;overflow:hidden">
          <div style="background:#070d1f;padding:24px;text-align:center">
            <h2 style="color:white;margin:0">🏥 MediLead Hospital</h2>
            <p style="color:#60a5fa;margin:4px 0">Appointment Confirmation</p>
          </div>
          <div style="padding:32px">
            <p style="font-size:16px">Dear <strong>{patient_name}</strong>,</p>
            <p>Your appointment has been successfully booked.</p>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:20px 0">
              <p><strong>🔖 Booking ID:</strong> #{booking_id[:8]}</p>
              <p><strong>👨‍⚕️ Doctor:</strong> {doctor_name}</p>
              <p><strong>🏥 Department:</strong> {service.capitalize()}</p>
              <p><strong>📅 Slot:</strong> {slot}</p>
            </div>
            <p><strong>Please bring:</strong> Government ID + Previous medical records + Insurance card</p>
            <p>Arrive 15 minutes early for registration at Ground Floor Counter.</p>
            <p style="color:#6b7a99;font-size:13px">MediLead Hospital | 42 Health Park Road, Chennai | +91 44 2345 6789</p>
          </div>
        </div>"""
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False

# ─── ROUTES ───
@app.get("/")
def home():
    return {"message": "MediLead API v3.0 is running!", "status": "healthy"}

@app.get("/doctors")
def get_doctors():
    return {"doctors": doctors}

@app.get("/slots")
def get_slots():
    return {"slots": generate_slots()}

# ── AUTH ──
@app.post("/signup")
def signup(data: SignupData):
    try:
        if not data.mobile.isdigit() or len(data.mobile) != 10:
            return {"success": False, "message": "Please enter a valid 10-digit mobile number."}
        existing = supabase.table("patients").select("id").eq("mobile", data.mobile).execute()
        if existing.data:
            return {"success": False, "message": "Mobile number already registered. Please login."}
        result = supabase.table("patients").insert({
            "name": data.name, "mobile": data.mobile,
            "password": data.password, "email": data.email or ""
        }).execute()
        p = result.data[0]
        return {"success": True, "user": {"id": p["id"], "name": p["name"], "mobile": p["mobile"], "email": p.get("email",""), "role": "patient"}}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/login")
def login(data: LoginData):
    try:
        if data.role == "admin":
            result = supabase.table("admins").select("*").eq("email", data.mobile).eq("password", data.password).execute()
        else:
            result = supabase.table("patients").select("*").eq("mobile", data.mobile).eq("password", data.password).execute()
        if not result.data:
            return {"success": False, "message": "Invalid credentials. Please try again."}
        u = result.data[0]
        return {"success": True, "user": {"id": u["id"], "name": u["name"], "mobile": u.get("mobile",""), "email": u.get("email",""), "role": data.role}}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ── CHAT ──
@app.post("/chat")
def chat(data: ChatMessage):
    # Save user message
    supabase.table("conversations").insert({
        "patient_id": data.patient_id, "role": "user", "message": data.message
    }).execute()

    # Build messages for Groq
    # Inject patient name context into system prompt
    personalized_prompt = SYSTEM_PROMPT.replace(
        "The patient's name is already known from their signup — use it naturally and warmly",
        f"The patient's name is {data.patient_name}. Use their name naturally and warmly"
    )

    messages = [{"role": "system", "content": personalized_prompt}]
    for msg in data.conversation_history:
        messages.append(msg)
    messages.append({"role": "user", "content": data.message})

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=800,
        temperature=0.75,
    )
    ai_reply    = response.choices[0].message.content
    lead_data   = None
    clean_reply = ai_reply
    escalate    = False
    cancel_req  = None

    # Extract ESCALATE tag
    if "##ESCALATE##" in ai_reply:
        escalate    = True
        clean_reply = clean_reply.replace("##ESCALATE##", "").strip()

    # Extract LEAD_DATA block
    if "##LEAD_DATA##" in ai_reply:
        parts       = ai_reply.split("##LEAD_DATA##")
        clean_reply = parts[0].replace("##ESCALATE##", "").strip()
        try:
            json_part = parts[1].split("##END_LEAD_DATA##")[0].strip()
            lead_data = json.loads(json_part)
            if escalate:
                lead_data["flagged"]     = True
                lead_data["flag_reason"] = "Escalated to human staff"
            save_or_update_lead(data.patient_id, data.patient_name, data.patient_mobile, lead_data)
        except Exception as e:
            print(f"[WARN] Failed to parse LEAD_DATA: {e}")

    # Extract CANCEL_REQUEST block
    if "##CANCEL_REQUEST##" in clean_reply:
        parts2      = clean_reply.split("##CANCEL_REQUEST##")
        clean_reply = parts2[0].strip()
        try:
            cancel_json = parts2[1].split("##END_CANCEL_REQUEST##")[0].strip()
            cancel_req  = json.loads(cancel_json)
            # Auto-cancel if booking_id is known
            if cancel_req.get("booking_id"):
                supabase.table("appointments").update({
                    "status": "Cancelled",
                    "notes": f"Cancelled by patient via MediBot. Reason: {cancel_req.get('reason','Not specified')}"
                }).eq("id", cancel_req["booking_id"]).execute()
        except Exception as e:
            print(f"[WARN] Failed to process CANCEL_REQUEST: {e}")

    # Final cleanup — remove any stray tags
    for tag in ["##LEAD_DATA##","##END_LEAD_DATA##","##CANCEL_REQUEST##","##END_CANCEL_REQUEST##","##ESCALATE##"]:
        clean_reply = clean_reply.replace(tag, "").strip()

    # Save AI response
    supabase.table("conversations").insert({
        "patient_id": data.patient_id, "role": "assistant", "message": clean_reply
    }).execute()

    # Determine if booking UI should show
    show_booking      = False
    available_doctors = []
    if lead_data and lead_data.get("ready_to_book"):
        service = lead_data.get("service", "general").lower()
        if service in doctors:
            show_booking      = True
            available_doctors = doctors[service]

    return {
        "reply":             clean_reply,
        "lead_data":         lead_data,
        "show_booking":      show_booking,
        "available_doctors": available_doctors,
        "available_slots":   generate_slots(),
        "escalated":         escalate,
        "cancel_processed":  cancel_req is not None,
    }

def save_or_update_lead(patient_id, patient_name, patient_mobile, lead_data):
    existing = supabase.table("leads").select("id").eq("patient_id", patient_id).execute()
    if existing.data:
        supabase.table("leads").update({
            "score":       lead_data.get("score","COLD"),
            "service":     lead_data.get("service","general"),
            "urgency":     lead_data.get("urgency","low"),
            "flagged":     lead_data.get("flagged", False),
            "flag_reason": lead_data.get("flag_reason",""),
            "mobile":      patient_mobile,
        }).eq("patient_id", patient_id).execute()
    else:
        supabase.table("leads").insert({
            "patient_id":   patient_id,
            "patient_name": patient_name,
            "mobile":       patient_mobile,
            "service":      lead_data.get("service","general"),
            "score":        lead_data.get("score","COLD"),
            "urgency":      lead_data.get("urgency","low"),
            "flagged":      lead_data.get("flagged", False),
            "flag_reason":  lead_data.get("flag_reason",""),
            "channel":      "web",
        }).execute()

# ── APPOINTMENTS ──
@app.post("/book-appointment")
def book_appointment(data: BookAppointment):
    try:
        result = supabase.table("appointments").insert({
            "patient_id":   data.patient_id,
            "patient_name": data.patient_name,
            "mobile":       data.patient_mobile,
            "email":        data.patient_email,
            "service":      data.service,
            "doctor_id":    data.doctor_id,
            "doctor_name":  data.doctor_name,
            "slot":         data.slot,
            "status":       "Confirmed",
            "notes":        "",
        }).execute()
        supabase.table("leads").update({"status": "Booked"}).eq("patient_id", data.patient_id).execute()
        apt = result.data[0]
        if data.patient_email:
            send_email(data.patient_email, data.patient_name, data.doctor_name, data.service, data.slot, apt["id"])
        return {"success": True, "appointment": apt}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.put("/appointments/{apt_id}")
def update_appointment(apt_id: str, data: UpdateAppointment):
    try:
        supabase.table("appointments").update({"status": data.status, "notes": data.notes}).eq("id", apt_id).execute()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.delete("/appointments/{apt_id}")
def cancel_appointment(apt_id: str):
    try:
        supabase.table("appointments").update({
            "status": "Cancelled", "notes": "Cancelled by patient"
        }).eq("id", apt_id).execute()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.put("/leads/{lead_id}/notes")
def update_lead_notes(lead_id: str, data: UpdateLeadNotes):
    try:
        supabase.table("leads").update({"notes": data.notes}).eq("id", lead_id).execute()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/chat-history/{patient_id}")
def get_chat_history(patient_id: str):
    result = supabase.table("conversations").select("*").eq("patient_id", patient_id).order("created_at").execute()
    return {"messages": result.data}

@app.get("/patient-appointments/{patient_id}")
def get_patient_appointments(patient_id: str):
    result = supabase.table("appointments").select("*").eq("patient_id", patient_id).order("created_at", desc=True).execute()
    return {"appointments": result.data}

@app.get("/leads")
def get_leads():
    return {"leads": supabase.table("leads").select("*").order("created_at", desc=True).execute().data}

@app.get("/appointments")
def get_appointments():
    return {"appointments": supabase.table("appointments").select("*").order("created_at", desc=True).execute().data}

@app.get("/flagged")
def get_flagged():
    return {"flagged": supabase.table("leads").select("*").eq("flagged", True).execute().data}

@app.get("/analytics")
def get_analytics():
    leads   = supabase.table("leads").select("*").execute().data
    total   = len(leads)
    hot     = len([l for l in leads if l["score"] == "HOT"])
    warm    = len([l for l in leads if l["score"] == "WARM"])
    cold    = len([l for l in leads if l["score"] == "COLD"])
    booked  = len([l for l in leads if l["status"] == "Booked"])
    flagged = len([l for l in leads if l.get("flagged")])
    services = {}
    for l in leads:
        s = l.get("service","general")
        services[s] = services.get(s,0) + 1
    return {
        "total_leads":     total,
        "hot":             hot,
        "warm":            warm,
        "cold":            cold,
        "booked":          booked,
        "flagged":         flagged,
        "conversion_rate": round((booked/total*100), 1) if total > 0 else 0,
        "by_service":      [{"name": k.capitalize(), "count": v} for k,v in services.items()],
    }