import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API || "http://localhost:8000"; // ← ADD THIS

const QUICK = [
  { label: "Chest pain", icon: "❤️" },
  { label: "Book appointment", icon: "📅" },
  { label: "Find pharmacy", icon: "💊" },
  { label: "Cancel appointment", icon: "✕" },
  { label: "I have a fever", icon: "🌡️" },
  { label: "Insurance info", icon: "🛡️" },
];

function TypingDots() {
  return (
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  );
}

function MsgBubble({ msg, isNew }) {
  const isBot = msg.role === "bot";
  return (
    <div className={`msg-row ${isBot ? "bot-row" : "user-row"} ${isNew ? "msg-animate" : ""}`}>
      {isBot && (
        <div className="bot-av-wrap">
          <div className="bot-av">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
        </div>
      )}
      <div className="msg-col">
        <div className={`bubble ${isBot ? "bot-bubble" : "user-bubble"}${msg.emergency ? " emergency-bubble" : ""}`}>
          {msg.text.split("\n").map((l, i, arr) => (
            <span key={i}>{l}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        {msg.escalated && (
          <div className="escalation-tag">⚡ Flagged for our care team</div>
        )}
      </div>
      {!isBot && <div className="user-av">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </div>}
    </div>
  );
}

export default function Chat({ user }) {
  const getGreeting = () => {
    const h = new Date().getHours();
    const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const name = user.name.split(" ")[0];
    const greetings = [
      `${time}, ${name}! 👋 I'm MediBot, your health assistant. How can I help you today?`,
      `Hi ${name}! Welcome to MediLead. What brings you in today?`,
      `${time}, ${name}! I'm here whenever you need health guidance. What's on your mind?`,
      `Hello ${name}! 😊 How are you feeling today? I'm here to help.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  const [messages, setMessages]               = useState([{ role: "bot", text: getGreeting() }]);
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [history, setHistory]                 = useState([]);
  const [leadData, setLeadData]               = useState(null);
  const [booking, setBooking]                 = useState(null);
  const [selDoc, setSelDoc]                   = useState(null);
  const [selSlot, setSelSlot]                 = useState(null);
  const [booked, setBooked]                   = useState(null);
  const [appointments, setAppointments]       = useState([]);
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const [rec, setRec]                         = useState(false);
  const [showQuick, setShowQuick]             = useState(true);
  const [newMsgIdx, setNewMsgIdx]             = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const srRef     = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = async () => {
    try {
      const res = await axios.get(`${API}/patient-appointments/${user.id}`)
      setAppointments(res.data.appointments.filter(a => a.status === "Confirmed"));
    } catch {}
  };

  const send = useCallback(async (txt) => {
    const text = (txt || input).trim();
    if (!text || loading) return;

    setShowQuick(false);
    setMessages(p => [...p, { role: "user", text }]);
    setNewMsgIdx(null);
    setInput("");
    setLoading(true);
    setBooking(null);
    setSelDoc(null);
    setSelSlot(null);
    setShowCancelPicker(false);

    const newHist = [...history, { role: "user", content: text }];

    try {
      const res = await axios.post(`${API}/chat`,{
        patient_id:           user.id,
        patient_name:         user.name,
        patient_mobile:       user.mobile || "",
        message:              text,
        conversation_history: history,
      });

      const { reply, lead_data, show_booking, available_doctors, available_slots, escalated, cancel_processed } = res.data;
      const isEmergency = reply.includes("⚠️") || reply.includes("108") || reply.includes("EMERGENCY");

      setMessages(p => {
        const next = [...p, { role: "bot", text: reply, emergency: isEmergency, escalated }];
        setNewMsgIdx(next.length - 1);
        return next;
      });
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
  }, [input, history, loading, user]);

  const confirmBooking = async () => {
    if (!selDoc || !selSlot) return;
    setBooking(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/book-appointment`, {
        patient_id:     user.id,
        patient_name:   user.name,
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
          text: `✅ Appointment Confirmed!\n\n👨‍⚕️ ${selDoc.name}\n📍 ${selDoc.floor}, ${selDoc.room}\n🏥 ${(leadData?.service||"general").charAt(0).toUpperCase()+(leadData?.service||"general").slice(1)}\n📅 ${selSlot}\n🔖 ID: #${apt.id?.slice(0,8)}\n\nArrive 15 mins early with your Government ID and prior medical records.`,
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
      axios.delete(`${API}/appointments/${apt.id}`)
      loadAppointments();
      setMessages(p => [...p, {
        role: "bot",
        text: `✅ Cancelled your appointment with ${apt.doctor_name} on ${apt.slot}.\n\nBooking #${apt.id?.slice(0,8)} removed. Would you like to book a new one?`
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
    srRef.current = sr;
    sr.lang = "en-IN"; sr.interimResults = false;
    sr.onresult = e => { setInput(e.results[0][0].transcript); setRec(false); setTimeout(() => inputRef.current?.focus(), 100); };
    sr.onerror = () => setRec(false);
    sr.onend   = () => setRec(false);
    sr.start(); setRec(true);
  };

  const lastBotIdx = messages.reduce((acc, m, i) => m.role === "bot" ? i : acc, -1);

  return (
    <div className="chat-layout">

      {/* ── CHAT PANEL ── */}
      <div className="chat-panel">

        {/* Messages */}
        <div className="chat-messages">

          {/* Quick chips — first message only */}
          {showQuick && (
            <div className="quick-wrap">
              <div className="quick-label">Quick actions</div>
              <div className="quick-chips">
                {QUICK.map((q, i) => (
                  <button key={i} className="qchip" onClick={() => send(q.label)}>
                    <span className="qchip-icon">{q.icon}</span>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <MsgBubble msg={msg} isNew={i === newMsgIdx} />

              {/* Booking widget */}
              {msg.role === "bot" && i === lastBotIdx && booking && (
                <div className="widget-card">
                  <div className="widget-head">
                    <span className="widget-head-icon">👨‍⚕️</span>
                    Choose your doctor
                  </div>
                  <div className="widget-body">
                    {booking.doctors.map(doc => (
                      <div key={doc.id}
                        className={`doc-card ${selDoc?.id === doc.id ? "doc-sel" : ""}`}
                        onClick={() => { setSelDoc(doc); setSelSlot(null); }}>
                        <div className="doc-card-inner">
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-qual">{doc.qualification}</div>
                          <div className="doc-meta">
                            <span className="doc-loc-tag">📍 {doc.floor} · {doc.room}</span>
                            <span className="doc-hours-tag">⏰ {doc.opd_hours}</span>
                          </div>
                          <div className={`doc-status ${doc.status.includes("Available") ? "status-avail" : "status-busy"}`}>
                            <span className="status-dot" />
                            {doc.status}
                          </div>
                        </div>
                        {selDoc?.id === doc.id && <span className="doc-tick">✓</span>}
                      </div>
                    ))}
                  </div>

                  {selDoc && (
                    <>
                      <div className="widget-divider" />
                      <div className="widget-head">
                        <span className="widget-head-icon">📅</span>
                        Choose a time slot
                      </div>
                      <div className="widget-body">
                        <div className="slot-grid">
                          {booking.slots.slice(0, 27).map((s, si) => (
                            <button key={si}
                              className={`slot-btn ${selSlot === s ? "slot-sel" : ""}`}
                              onClick={() => setSelSlot(s)}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {selDoc && selSlot && (
                    <div className="widget-footer">
                      <div className="confirm-summary">
                        <span>👨‍⚕️ {selDoc.name}</span>
                        <span>·</span>
                        <span>📅 {selSlot}</span>
                      </div>
                      <button className="confirm-btn" onClick={confirmBooking} disabled={loading}>
                        Confirm Appointment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel picker */}
              {msg.role === "bot" && i === lastBotIdx && showCancelPicker && appointments.length > 0 && (
                <div className="widget-card">
                  <div className="widget-head cancel-head">
                    <span className="widget-head-icon">🗑️</span>
                    Select appointment to cancel
                  </div>
                  <div className="widget-body">
                    {appointments.map(apt => (
                      <div key={apt.id} className="cancel-card" onClick={() => cancelAppointment(apt)}>
                        <div>
                          <div className="doc-name">👨‍⚕️ {apt.doctor_name || "Doctor"}</div>
                          <div className="doc-qual">🏥 {apt.service?.charAt(0).toUpperCase()+apt.service?.slice(1)} · 📅 {apt.slot}</div>
                          <div className="doc-qual" style={{marginTop:2}}>🔖 #{apt.id?.slice(0,8)}</div>
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
              <div className="bot-av-wrap">
                <div className="bot-av">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
              </div>
              <div className="bot-bubble typing-bubble"><TypingDots /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-footer">
          <div className="input-row">
            <button className={`mic-btn ${rec ? "rec" : ""}`} onClick={toggleVoice} title={rec ? "Stop" : "Voice input"}>
              {rec
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              }
            </button>
            <input
              ref={inputRef}
              className="chat-input"
              placeholder={rec ? "Listening… speak now" : "Ask anything about your health…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              disabled={loading}
            />
            <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div className="footer-note">MediBot · AI health assistant · Not a substitute for medical advice</div>
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div className="side-panel">

        {/* Visit Summary */}
        <div className="side-card">
          <div className="side-card-head">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Visit Summary
          </div>
          <div className="side-card-body">
            {!leadData ? (
              <div className="side-empty">
                <div className="side-empty-icon">💬</div>
                <div>Your visit details appear here as we chat</div>
              </div>
            ) : (
              <div className="info-list">
                <div className="info-row">
                  <span className="info-lbl">Patient</span>
                  <span className="info-val">{user.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Mobile</span>
                  <span className="info-val">+91 {user.mobile}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Department</span>
                  <span className="info-val" style={{textTransform:"capitalize"}}>{leadData.service || "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Priority</span>
                  <span className={`score-badge score-${leadData.score}`}>
                    {leadData.score === "HOT" && "🔴 Urgent"}
                    {leadData.score === "WARM" && "🟡 Soon"}
                    {leadData.score === "COLD" && "🔵 Routine"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Appointment</span>
                  <span className="info-val">
                    {booked ? "✅ Confirmed" : leadData.ready_to_book ? "⏳ Ready" : "Not yet"}
                  </span>
                </div>
                {booked && (
                  <div className="info-row">
                    <span className="info-lbl">Booking ID</span>
                    <span className="info-val mono">#{booked.id?.slice(0,8)}</span>
                  </div>
                )}
                {leadData.flagged && (
                  <div className="info-row">
                    <span className="info-lbl">Status</span>
                    <span className="flagged-tag">⚡ Escalated</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Appointments */}
        {appointments.length > 0 && (
          <div className="side-card">
            <div className="side-card-head">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              My Appointments
            </div>
            <div className="side-card-body">
              {appointments.map(apt => (
                <div key={apt.id} className="apt-mini">
                  <div className="apt-mini-top">
                    <div className="apt-mini-doc">{apt.doctor_name || "Doctor TBD"}</div>
                    <div className="apt-mini-dept">{apt.service?.charAt(0).toUpperCase()+apt.service?.slice(1)}</div>
                  </div>
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

        {/* Quick Info */}
        <div className="side-card">
          <div className="side-card-head">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Quick Info
          </div>
          <div className="side-card-body">
            <div className="qinfo-item">
              <span className="qinfo-label">Main</span>
              <span>+91 44 2345 6789</span>
            </div>
            <div className="qinfo-item emergency-info">
              <span className="qinfo-label">Emergency</span>
              <span>108 · +91 44 2345 6700</span>
            </div>
            <div className="qinfo-item">
              <span className="qinfo-label">OPD Hours</span>
              <span>Mon–Sat 8AM–8PM</span>
            </div>
            <div className="qinfo-item">
              <span className="qinfo-label">Pharmacy</span>
              <span>Ground Floor · 24/7</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
