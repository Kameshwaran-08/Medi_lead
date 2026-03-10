# MediLead — AI Hospital Appointment Agent

A conversational AI agent that talks to patients, qualifies them, and books doctor appointments automatically.

---

## What This Project Does

When a patient visits the hospital website, instead of filling a form, they chat with an AI bot called **MediBot**.

The bot:
1. Asks the patient what they need (chest pain, knee issue, skin problem, etc.)
2. Figures out how urgent it is
3. Classifies them as **HOT**, **WARM**, or **COLD**
4. If HOT → automatically shows doctors and books an appointment
5. Sends a confirmation email to the patient
6. Saves everything to a database for the hospital admin to review

---

## Tools & Technologies Used

| What | Why |
|------|-----|
| **FastAPI** (Python) | Backend server — handles all the logic |
| **Groq + LLaMA 3.3 70B** | The AI brain — powers the chatbot |
| **Supabase** | Database — stores patients, leads, appointments |
| **Gmail SMTP** | Sends booking confirmation emails |
| **React** | Frontend chat widget (separate) |

---

## How to Run It

### Step 1 — Install dependencies
```bash
pip install fastapi uvicorn supabase python-dotenv groq
```

### Step 2 — Create a `.env` file in the project folder
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GROQ_API_KEY=your_groq_key
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

### Step 3 — Start the server
```bash
uvicorn main:app --reload
```

The API will run at `http://localhost:8000`

---

## Database Setup (Supabase)

Go to your Supabase project → SQL Editor → paste and run this:

```sql
create table patients (
  id uuid primary key default gen_random_uuid(),
  name text, mobile text unique, password text, email text,
  created_at timestamptz default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  name text, email text unique, password text
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid, role text, message text,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid, patient_name text, mobile text,
  service text, score text, urgency text,
  status text default 'Active',
  flagged boolean default false, flag_reason text,
  channel text, notes text,
  created_at timestamptz default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid, patient_name text, mobile text, email text,
  service text, doctor_id text, doctor_name text,
  slot text, slot_date text, slot_time text,
  status text default 'Confirmed', notes text,
  created_at timestamptz default now()
);
```

---

## API Endpoints (Quick Reference)

### Patient
| Action | Method | URL |
|--------|--------|-----|
| Register | POST | `/signup` |
| Login | POST | `/login` |
| Chat with bot | POST | `/chat` |
| View chat history | GET | `/chat-history/{patient_id}` |
| View my appointments | GET | `/patient-appointments/{patient_id}` |

### Booking
| Action | Method | URL |
|--------|--------|-----|
| Get available slots | GET | `/slots` |
| Get slots for 60 days | GET | `/slots?days_ahead=60` |
| Get slots for a date range | GET | `/slots?from_date=2025-09-01&to_date=2025-09-30` |
| Get doctors | GET | `/doctors` |
| Get doctors by department | GET | `/doctors?service=cardiology` |
| Book appointment | POST | `/book-appointment` |
| Cancel appointment | DELETE | `/appointments/{id}` |

### Admin
| Action | Method | URL |
|--------|--------|-----|
| View all leads | GET | `/leads` |
| View all appointments | GET | `/appointments` |
| View flagged/emergency cases | GET | `/flagged` |
| View analytics | GET | `/analytics` |

---

## Lead Classification Logic

After chatting with the patient, the AI scores them:

| Score | Meaning | What Happens |
|-------|---------|--------------|
| 🔴 HOT | Urgent, has insurance, ready to book | Booking UI shown immediately |
| 🟡 WARM | Has a need but not urgent | Follow-up suggested |
| 🔵 COLD | Just browsing or exploring | General info provided |

---

## Appointment Slot System

- Slots are available **Monday to Saturday, 9AM to 6PM**
- Sundays are automatically blocked
- Past dates are rejected
- By default, the next **30 days** of slots are shown
- The frontend can request any date range using `from_date` and `to_date`

---

## Departments and Doctors

The system has real doctor profiles for 10 departments:

Cardiology, Orthopedics, Neurology, General Medicine, Pediatrics, Dermatology, Gynecology, ENT, Ophthalmology, Psychiatry

Each doctor has: name, qualification, specialization, room number, OPD hours, and current availability status.

---

## Emergency Handling

If a patient mentions keywords like **chest pain, stroke, can't breathe, unconscious** — the bot immediately:
- Gives the emergency number (+91 44 2345 6789)
- Asks if first aid guidance is needed
- Flags the lead for hospital staff
- Stops the normal chat flow

---

## Project Files

```
medilead-backend/
├── main.py       ← entire backend (routes + AI logic)
├── .env          ← your secret keys (never share this)
└── README.md
```

---

## Key Features Summary

- AI chatbot powered by LLaMA 3.3 (via Groq)
- Automatic lead scoring (HOT / WARM / COLD)
- Real-time appointment booking
- Email confirmation on booking
- Emergency detection and escalation
- Flexible date-based slot generation
- Admin panel data (leads, appointments, analytics)
- Supports Tamil, Hindi, and English conversations
