import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const QUICK = [
  "I have chest pain 😰",
  "Book an appointment",
  "Where is the pharmacy?",
  "Cancel my appointment",
  "I have a fever",
  "What insurance do you accept?",
];

function TypingDots() {
  return (
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  );
}

function MsgBubble({ msg }) {
  const isBot = msg.role === "bot";
  return (
    <div className={`msg-row ${isBot ? "bot-row" : "user-row"}`}>
      {isBot && <div className="msg-avatar bot-av">🏥</div>}
      <div className="msg-col">
        <div className={`bubble ${isBot ? "bot-bubble" : "user-bubble"}${msg.emergency ? " emergency-bubble" : ""}`}>
          {msg.text.split("\n").map((l, i, arr) => (
            <span key={i}>{l}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        {msg.escalated && (
          <div className="escalation-tag">⚡ Flagged for our care team — they'll reach out shortly.</div>
        )}
      </div>
      {!isBot && <div className="msg-avatar user-av">👤</div>}
    </div>
  );
}

export default function Chat({ user }) {
  const getGreeting = () => {
    const h = new Date().getHours();
    const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const greetings = [
      `${time}, ${user.name.split(" ")[0]}! 👋 I'm MediBot. How can I help your health today?`,
      `Hi ${user.name.split(" ")[0]}! Welcome to MediLead Hospital. What brings you in today?`,
      `${time}, ${user.name.split(" ")[0]}! I'm here to help with anything health-related. What's on your mind?`,
      `Hello ${user.name.split(" ")[0]}! 😊 I'm MediBot, your health assistant. How are you feeling today?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  const [messages, setMessages]         = useState([{ role: "bot", text: getGreeting() }]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [history, setHistory]           = useState([]);
  const [leadData, setLeadData]         = useState(null);
  const [booking, setBooking]           = useState(null);
  const [selDoc, setSelDoc]             = useState(null);
  const [selSlot, setSelSlot]           = useState(null);
  const [booked, setBooked]             = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const [rec, setRec]                   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const srRef     = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { loadAppointments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAppointments = async () => {
    try {
      const res = await axios.get(`/patient-appointments/${user.id}`);
      setAppointments(res.data.appointments.filter(a => a.status === "Confirmed"));
    } catch {}
  };

  const send = useCallback(async (txt) => {
    const text = (txt || input).trim();
    if (!text || loading) return;

    setMessages(p => [...p, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setBooking(null);
    setSelDoc(null);
    setSelSlot(null);
    setShowCancelPicker(false);

    const newHist = [...history, { role: "user", content: text }];

    try {
      const res = await axios.post("/chat", {
        patient_id:           user.id,
        patient_name:         user.name,
        patient_mobile:       user.mobile || "",
        message:              text,
        conversation_history: history,
      });

      const { reply, lead_data, show_booking, available_doctors, available_slots, escalated, cancel_processed } = res.data;
      const isEmergency = reply.includes("⚠️") || reply.includes("108") || reply.includes("EMERGENCY");

      setMessages(p => [...p, { role: "bot", text: reply, emergency: isEmergency, escalated }]);
      setHistory([...newHist, { role: "assistant", content: reply }]);

      if (lead_data)    setLeadData(lead_data);
      if (show_booking) setBooking({ doctors: available_doctors, slots: available_slots, service: lead_data?.service });
      if (cancel_processed) { loadAppointments(); setBooked(null); }

      const lower = reply.toLowerCase();
      if ((lower.includes("cancel") || lower.includes("booking id")) &&
          (lower.includes("which") || lower.includes("confirm"))) {
        setShowCancelPicker(true);
      }
    } catch {
      setMessages(p => [...p, { role: "bot", text: "⚠️ Connection issue. Please make sure the backend is running." }]);
    }
    setLoading(false);
  }, [input, history, loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmBooking = async () => {
    if (!selDoc || !selSlot) return;
    setBooking(null);
    setLoading(true);
    try {
      const res = await axios.post("/book-appointment", {
        patient_id:    user.id,
        patient_name:  user.name,
        patient_mobile: user.mobile || "",
        patient_email:  user.email || "",
        service:        leadData?.service || "general",
        doctor_id:      selDoc.id,
        doctor_name:    selDoc.name,
        slot:           selSlot,
      });
      if (res.data.success) {
        const apt = res.data.appointment;
        setBooked(apt);
        setLeadData(p => p ? { ...p, status: "Booked" } : p);
        loadAppointments();
        setMessages(p => [...p, {
          role: "bot",
          text: `✅ Appointment Confirmed!\n\n👨‍⚕️ ${selDoc.name}\n📍 ${selDoc.floor}, ${selDoc.room}\n📋 ${(leadData?.service||"general").charAt(0).toUpperCase()+(leadData?.service||"general").slice(1)}\n📅 ${selSlot}\n🔖 ID: #${apt.id?.slice(0,8)}\n\nArrive 15 mins early. Bring your Government ID and prior medical records.`,
        }]);
      } else {
        setMessages(p => [...p, { role: "bot", text: `❌ Booking failed: ${res.data.message || "Please try again."}` }]);
      }
    } catch {
      setMessages(p => [...p, { role: "bot", text: "❌ Booking failed. Please try again." }]);
    }
    setLoading(false);
    setSelDoc(null);
    setSelSlot(null);
  };

  const cancelAppointment = async (apt) => {
    setShowCancelPicker(false);
    setLoading(true);
    try {
      await axios.delete(`/appointments/${apt.id}`);
      loadAppointments();
      setMessages(p => [...p, {
        role: "bot",
        text: `✅ Appointment with ${apt.doctor_name} on ${apt.slot} has been cancelled.\n\nBooking #${apt.id?.slice(0,8)} is now cancelled. Would you like to book a new one?`
      }]);
      setHistory(h => [...h, { role: "assistant", content: `Cancelled appointment with ${apt.doctor_name}.` }]);
    } catch {
      setMessages(p => [...p, { role: "bot", text: "❌ Could not cancel. Please call +91 44 2345 6800." }]);
    }
    setLoading(false);
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome."); return; }
    if (rec) { srRef.current?.stop(); setRec(false); return; }
    const sr = new SR();
    sr.lang = "en-IN"; sr.interimResults = false;
    sr.onresult = e => { setInput(e.results[0][0].transcript); setRec(false); setTimeout(() => inputRef.current?.focus(), 100); };
    sr.onerror = () => setRec(false);
    sr.onend   = () => setRec(false);
    srRef.current = sr;
    sr.start(); setRec(true);
  };

  const lastBotIdx = [...messages].map((m,i) => m.role==="bot"?i:-1).filter(i=>i>=0).pop();

  return (
    <div className="chat-layout">

      {/* ── CHAT PANEL ── */}
      <div className="chat-panel">

        {/* Header */}
        <div className="chat-header">
          <div className="ch-avatar">🤖</div>
          <div className="ch-info">
            <div className="ch-name">MediBot</div>
            <div className="ch-status"><span className="online-dot" />AI Health Assistant · MediLead Hospital</div>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-body">

          {/* Quick chips — only at start */}
          {messages.length === 1 && !loading && (
            <div className="quick-wrap">
              <p className="quick-label">Quick options</p>
              <div className="quick-chips">
                {QUICK.map((q, i) => (
                  <button key={i} className="quick-chip" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <MsgBubble msg={msg} />

              {/* Booking widget after last bot message */}
              {msg.role === "bot" && i === lastBotIdx && booking && (
                <div className="widget-wrap">
                  {/* Doctor picker */}
                  <div className="widget-section">
                    <div className="widget-title">👨‍⚕️ Choose your doctor</div>
                    {booking.doctors.map(doc => (
                      <div key={doc.id} className={`doc-card${selDoc?.id===doc.id?" sel":""}`}
                        onClick={() => { setSelDoc(doc); setSelSlot(null); }}>
                        <div style={{flex:1}}>
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-qual">{doc.qualification}</div>
                          <div className="doc-loc">📍 {doc.floor}, {doc.room} · ⏰ {doc.opd_hours}</div>
                          <div className={`doc-avail ${doc.status.includes("Available")?"avail":"busy"}`}>
                            {doc.status.includes("Available") ? "🟢" : "🟡"} {doc.status}
                          </div>
                        </div>
                        {selDoc?.id===doc.id && <span className="doc-check">✓</span>}
                      </div>
                    ))}
                  </div>

                  {/* Slot picker */}
                  {selDoc && (
                    <div className="widget-section">
                      <div className="widget-title">📅 Choose a time slot</div>
                      <div className="slot-grid">
                        {booking.slots.slice(0,27).map((s,si) => (
                          <button key={si} className={`slot-btn${selSlot===s?" sel":""}`}
                            onClick={() => setSelSlot(s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selDoc && selSlot && (
                    <button className="confirm-btn" onClick={confirmBooking} disabled={loading}>
                      ✅ Confirm Appointment
                    </button>
                  )}
                </div>
              )}

              {/* Cancel picker */}
              {msg.role === "bot" && i === lastBotIdx && showCancelPicker && appointments.length > 0 && (
                <div className="widget-wrap">
                  <div className="widget-section">
                    <div className="widget-title">🗑️ Select appointment to cancel</div>
                    {appointments.map(apt => (
                      <div key={apt.id} className="cancel-card" onClick={() => cancelAppointment(apt)}>
                        <div>
                          <div className="doc-name">👨‍⚕️ {apt.doctor_name || "Doctor"}</div>
                          <div className="doc-qual">🏥 {apt.service?.charAt(0).toUpperCase()+apt.service?.slice(1)} · 📅 {apt.slot}</div>
                          <div className="doc-qual">🔖 #{apt.id?.slice(0,8)}</div>
                        </div>
                        <span className="cancel-x">✕ Cancel</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg-row bot-row">
              <div className="msg-avatar bot-av">🏥</div>
              <div className="bot-bubble typing-bubble"><TypingDots /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-footer">
          <button className={`mic-btn${rec?" rec":""}`} onClick={toggleVoice} title={rec?"Stop":"Voice"}>
            {rec ? "🔴" : "🎙️"}
          </button>
          <input
            ref={inputRef}
            className="chat-input"
            placeholder={rec ? "Listening… speak now" : "Ask anything about your health or hospital…"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
            disabled={loading}
          />
          <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── SIDEBAR PANEL ── */}
      <div className="side-panel">

        {/* Visit Summary */}
        <div className="side-card">
          <div className="side-card-head">📋 Visit Summary</div>
          <div className="side-card-body">
            {!leadData ? (
              <div className="side-empty">
                <span className="side-empty-icon">💬</span>
                <span>Your visit details will appear here as we chat…</span>
              </div>
            ) : (
              <>
                <div className="info-row"><span className="info-lbl">Patient</span><span className="info-val">{user.name}</span></div>
                <div className="info-row"><span className="info-lbl">Mobile</span><span className="info-val">+91 {user.mobile}</span></div>
                <div className="info-row">
                  <span className="info-lbl">Department</span>
                  <span className="info-val" style={{textTransform:"capitalize"}}>{leadData.service||"—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Priority</span>
                  <span className={`score-badge score-${leadData.score}`}>
                    {leadData.score==="HOT" && "🔴 Urgent"}
                    {leadData.score==="WARM" && "🟡 Soon"}
                    {leadData.score==="COLD" && "🔵 Routine"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Urgency</span>
                  <span className="info-val" style={{textTransform:"capitalize"}}>{leadData.urgency||"—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Appointment</span>
                  <span className="info-val">
                    {booked ? "✅ Confirmed" : leadData.ready_to_book ? "⏳ Ready" : "Not yet"}
                  </span>
                </div>
                {booked && (
                  <div className="info-row"><span className="info-lbl">Booking ID</span><span className="info-val">#{booked.id?.slice(0,8)}</span></div>
                )}
                {leadData.flagged && (
                  <div className="info-row"><span className="info-lbl">Status</span><span style={{color:"var(--warm)",fontWeight:700,fontSize:".81rem"}}>⚡ Escalated</span></div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Active Appointments */}
        {appointments.length > 0 && (
          <div className="side-card">
            <div className="side-card-head">📅 Active Appointments</div>
            <div className="side-card-body">
              {appointments.map(apt => (
                <div key={apt.id} className="apt-mini">
                  <div className="apt-mini-doc">{apt.doctor_name || "Doctor TBD"}</div>
                  <div className="apt-mini-slot">📅 {apt.slot}</div>
                  <div className="apt-mini-footer">
                    <span className="apt-mini-id">#{apt.id?.slice(0,8)}</span>
                    <button className="cancel-mini-btn" onClick={() => cancelAppointment(apt)}>✕ Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hospital info */}
        <div className="side-card">
          <div className="side-card-head">🏥 Quick Info</div>
          <div className="side-card-body">
            <div className="qinfo-item">📞 <strong>Main:</strong> +91 44 2345 6789</div>
            <div className="qinfo-item">🚨 <strong>Emergency:</strong> 108 / +91 44 2345 6700</div>
            <div className="qinfo-item">⏰ <strong>OPD:</strong> Mon–Sat 8AM–8PM</div>
            <div className="qinfo-item">💊 <strong>Pharmacy:</strong> 24/7 Ground Floor</div>
          </div>
        </div>

      </div>
    </div>
  );
}
