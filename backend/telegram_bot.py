"""
MediLead Hospital — Telegram Bot
=================================
Connects Telegram users directly to your existing FastAPI /chat endpoint.
Every Telegram user is saved as a lead in Supabase with channel = "telegram".

HOW IT WORKS:
  User messages Telegram bot
       ↓
  Bot creates a guest patient_id (telegram_<user_id>)
       ↓
  Calls your existing POST /chat endpoint
       ↓
  Gets AI reply + lead_data + show_booking flag
       ↓
  Sends reply back to Telegram user
       ↓
  If show_booking → shows doctor selection buttons
"""

import os
import uuid
import httpx
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")        # Your Telegram bot token
BACKEND_URL        = os.getenv("BACKEND_URL", "https://medi-lead.onrender.com")  # Your FastAPI URL

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ─── In-memory session store ──────────────────────────────────────────────────
# Stores per-user: conversation_history, patient_id, patient_name, pending booking state
sessions: dict = {}

def get_session(user_id: int, full_name: str) -> dict:
    if user_id not in sessions:
        sessions[user_id] = {
            "patient_id":           f"telegram_{user_id}",
            "patient_name":         full_name,
            "patient_mobile":       "",
            "conversation_history": [],
            # Booking state
            "pending_service":      None,
            "pending_doctors":      [],
            "pending_slots":        [],
            "selected_doctor":      None,
        }
    return sessions[user_id]


async def call_chat_api(session: dict, user_message: str) -> dict:
    """Call your existing FastAPI /chat endpoint."""
    payload = {
        "patient_id":           session["patient_id"],
        "patient_name":         session["patient_name"],
        "patient_mobile":       session["patient_mobile"],
        "message":              user_message,
        "conversation_history": session["conversation_history"],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{BACKEND_URL}/chat", json=payload)
        response.raise_for_status()
        return response.json()


async def call_book_api(session: dict, doctor: dict, slot: str) -> dict:
    """Call your existing /book-appointment endpoint."""
    payload = {
        "patient_id":   session["patient_id"],
        "patient_name": session["patient_name"],
        "patient_mobile": session["patient_mobile"],
        "patient_email": "",
        "service":      session["pending_service"],
        "doctor_id":    doctor["id"],
        "doctor_name":  doctor["name"],
        "slot":         slot,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(f"{BACKEND_URL}/book-appointment", json=payload)
        response.raise_for_status()
        return response.json()


# ─── Handlers ─────────────────────────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user    = update.effective_user
    session = get_session(user.id, user.full_name or "Patient")

    keyboard = [
        [
            InlineKeyboardButton("📅 Book Appointment", callback_data="quick_book"),
            InlineKeyboardButton("🚑 Emergency Info",   callback_data="quick_emergency"),
        ],
        [
            InlineKeyboardButton("👨‍⚕️ Find a Doctor",   callback_data="quick_doctor"),
            InlineKeyboardButton("🏥 Hospital Info",    callback_data="quick_info"),
        ],
    ]
    await update.message.reply_text(
        f"👋 Welcome to *MediLead Hospital*, {user.first_name}!\n\n"
        "I'm *MediBot* — your AI health assistant.\n"
        "I can help you with appointments, doctor info, symptoms, and more.\n\n"
        "How can I help you today?",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user         = update.effective_user
    session      = get_session(user.id, user.full_name or "Patient")
    user_message = update.message.text

    # Show typing...
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    # Update conversation history
    session["conversation_history"].append({"role": "user", "content": user_message})

    try:
        result = await call_chat_api(session, user_message)
    except Exception as e:
        logger.error(f"Backend error: {e}")
        await update.message.reply_text(
            "⚠️ I'm having trouble connecting right now.\n"
            "Please call us directly: *+91 44 2345 6789*",
            parse_mode="Markdown"
        )
        return

    ai_reply  = result.get("reply", "Sorry, I couldn't process that.")
    lead_data = result.get("lead_data")
    escalated = result.get("escalated", False)

    # Update conversation history with AI reply
    session["conversation_history"].append({"role": "assistant", "content": ai_reply})

    # Keep last 10 messages to avoid token bloat
    session["conversation_history"] = session["conversation_history"][-10:]

    # Send the AI reply
    await update.message.reply_text(ai_reply, parse_mode="Markdown")

    # If escalated → notify
    if escalated:
        await update.message.reply_text(
            "👩‍⚕️ I'm connecting you with our patient care team.\n"
            "📞 You can also call us at *+91 44 2345 6789*",
            parse_mode="Markdown"
        )

    # If ready_to_book → show doctor selection
    if result.get("show_booking") and result.get("available_doctors"):
        service = lead_data.get("service", "general") if lead_data else "general"
        session["pending_service"] = service
        session["pending_doctors"] = result["available_doctors"]
        session["pending_slots"]   = result.get("available_slots", [])

        keyboard = []
        for doc in result["available_doctors"]:
            keyboard.append([
                InlineKeyboardButton(
                    f"👨‍⚕️ {doc['name']} ({doc['opd_hours']})",
                    callback_data=f"doc_{doc['id']}"
                )
            ])
        keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel_booking")])

        await update.message.reply_text(
            f"🏥 *Available {service.capitalize()} Doctors:*\n"
            "Please select a doctor to continue:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    user    = query.from_user
    session = get_session(user.id, user.full_name or "Patient")
    data    = query.data

    # ── Quick menu buttons ──
    quick_map = {
        "quick_book":      "I want to book an appointment.",
        "quick_emergency": "What should I do in an emergency?",
        "quick_doctor":    "Can you help me find a doctor?",
        "quick_info":      "Tell me about the hospital services.",
    }
    if data in quick_map:
        await query.edit_message_text("⏳ Getting response...", parse_mode="Markdown")
        session["conversation_history"].append({"role": "user", "content": quick_map[data]})
        try:
            result   = await call_chat_api(session, quick_map[data])
            ai_reply = result.get("reply", "")
            session["conversation_history"].append({"role": "assistant", "content": ai_reply})
            await query.edit_message_text(ai_reply, parse_mode="Markdown")

            # Show booking UI if triggered
            if result.get("show_booking") and result.get("available_doctors"):
                lead_data = result.get("lead_data", {})
                service   = lead_data.get("service", "general") if lead_data else "general"
                session["pending_service"] = service
                session["pending_doctors"] = result["available_doctors"]
                session["pending_slots"]   = result.get("available_slots", [])
                keyboard = []
                for doc in result["available_doctors"]:
                    keyboard.append([InlineKeyboardButton(
                        f"👨‍⚕️ {doc['name']}", callback_data=f"doc_{doc['id']}"
                    )])
                keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel_booking")])
                await context.bot.send_message(
                    chat_id=query.message.chat_id,
                    text=f"🏥 *Available {service.capitalize()} Doctors:*",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
        except Exception as e:
            logger.error(f"Quick button error: {e}")
            await query.edit_message_text("⚠️ Sorry, something went wrong. Please try again.")
        return

    # ── Doctor selected ──
    if data.startswith("doc_"):
        doc_id  = data[4:]
        doctors = session.get("pending_doctors", [])
        doctor  = next((d for d in doctors if d["id"] == doc_id), None)
        if not doctor:
            await query.edit_message_text("❌ Doctor not found. Please try again.")
            return

        session["selected_doctor"] = doctor

        # Show first 8 slots as buttons
        slots    = session.get("pending_slots", [])[:8]
        keyboard = []
        for i, slot in enumerate(slots):
            keyboard.append([InlineKeyboardButton(f"🕐 {slot}", callback_data=f"slot_{i}")])
        keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel_booking")])

        await query.edit_message_text(
            f"✅ *{doctor['name']}* selected!\n"
            f"📍 {doctor.get('floor','')} — {doctor.get('room','')}\n\n"
            "Please choose a time slot:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return

    # ── Slot selected → Book ──
    if data.startswith("slot_"):
        slot_index = int(data[5:])
        slots      = session.get("pending_slots", [])
        doctor     = session.get("selected_doctor")

        if not doctor or slot_index >= len(slots):
            await query.edit_message_text("❌ Invalid selection. Please try again.")
            return

        selected_slot = slots[slot_index]
        await query.edit_message_text("⏳ Booking your appointment...")

        try:
            result = await call_book_api(session, doctor, selected_slot)
            if result.get("success"):
                apt = result.get("appointment", {})
                booking_id = str(apt.get("id", ""))[:8]
                await query.edit_message_text(
                    f"✅ *Appointment Confirmed!*\n\n"
                    f"🔖 Booking ID: `#{booking_id}`\n"
                    f"👨‍⚕️ Doctor: {doctor['name']}\n"
                    f"🏥 {doctor.get('floor','')} — {doctor.get('room','')}\n"
                    f"📅 Slot: {selected_slot}\n\n"
                    f"Please arrive *15 minutes early* with your ID.\n"
                    f"📞 Queries: +91 44 2345 6789",
                    parse_mode="Markdown"
                )
                # Clear booking state
                session["pending_service"] = None
                session["selected_doctor"] = None
            else:
                await query.edit_message_text(
                    f"❌ Booking failed: {result.get('message','Unknown error')}\n"
                    "Please call: +91 44 2345 6789"
                )
        except Exception as e:
            logger.error(f"Booking error: {e}")
            await query.edit_message_text("❌ Booking failed. Please call: +91 44 2345 6789")
        return

    # ── Cancel booking ──
    if data == "cancel_booking":
        session["pending_service"] = None
        session["selected_doctor"] = None
        await query.edit_message_text(
            "❌ Booking cancelled.\n\nFeel free to ask me anything else! 😊"
        )
        return


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id in sessions:
        sessions[user_id]["conversation_history"] = []
    await update.message.reply_text("✅ Conversation cleared! How can I help you?")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🏥 *MediLead Hospital Bot*\n\n"
        "Commands:\n"
        "/start — Main menu\n"
        "/reset — Clear chat history\n"
        "/help  — Show this help\n\n"
        "Just type your health question and I'll assist you!\n\n"
        "📞 *Direct line:* +91 44 2345 6789\n"
        "🚑 *Emergency:*  108",
        parse_mode="Markdown"
    )


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN is not set in .env")

    print("🏥 MediLead Telegram Bot starting...")
    print(f"   Backend URL : {BACKEND_URL}")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help",  help_command))
    app.add_handler(CommandHandler("reset", reset_command))
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("✅ Bot is live! Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()