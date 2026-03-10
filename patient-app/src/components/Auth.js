import { useState } from "react";
import axios from "axios";

export default function Auth({ onLogin, theme, toggleTheme }) {
  const [tab, setTab]     = useState("login");
  const [name, setName]   = useState("");
  const [mob, setMob]     = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState("");
  const [ok, setOk]       = useState("");

  const submit = async () => {
    setErr(""); setOk("");
    if (!mob || !pass)                { setErr("Please fill in all required fields."); return; }
    if (!/^\d{10}$/.test(mob))        { setErr("Enter a valid 10-digit mobile number."); return; }
    if (tab === "signup" && !name)    { setErr("Please enter your name."); return; }
    if (pass.length < 6)             { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      if (tab === "signup") {
        const res = await axios.post("/signup", { name, mobile: mob, password: pass, email });
        if (res.data.success) { setOk("Account created! Please log in."); setTab("login"); setName(""); setMob(""); setEmail(""); setPass(""); }
        else setErr(res.data.message);
      } else {
        const res = await axios.post("/login", { mobile: mob, password: pass, role: "patient" });
        if (res.data.success) onLogin(res.data.user);
        else setErr(res.data.message);
      }
    } catch { setErr("Connection failed. Is the backend running?"); }
    setLoading(false);
  };

  const features = [
    { icon:"🤖", text:"AI Health Assistant — MediBot" },
    { icon:"📅", text:"Instant Appointment Booking" },
    { icon:"🎙️", text:"Voice & Text Chat" },
    { icon:"🌐", text:"Tamil, Hindi & English" },
    { icon:"🔒", text:"Private & Secure" },
    { icon:"⚡", text:"Emergency 24/7 Support" },
  ];

  return (
    <div className="auth-page">
      {/* LEFT PANEL */}
      <div className="auth-left">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-brand">
          <span className="auth-brand-logo">🏥</span>
          <h1>Medi<em>Lead</em></h1>
          <p>Smart AI-powered healthcare. Book appointments, get guidance — any time, any language.</p>
        </div>
        <div className="auth-features">
          {features.map((f, i) => (
            <div className="auth-feature" key={i}>
              <span className="feat-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-theme-row">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>

          <h2>{tab === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="sub">{tab === "login" ? "Sign in with your mobile number" : "Join MediLead — it's free"}</p>

          <div className="tab-row">
            <button className={`tab-btn${tab==="login"?" active":""}`} onClick={() => { setTab("login"); setErr(""); setOk(""); }}>Login</button>
            <button className={`tab-btn${tab==="signup"?" active":""}`} onClick={() => { setTab("signup"); setErr(""); setOk(""); }}>Sign Up</button>
          </div>

          {err && <div className="err">⚠️ {err}</div>}
          {ok  && <div className="ok">✅ {ok}</div>}

          {tab === "signup" && (
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Mobile Number</label>
            <div className="mob-row">
              <div className="mob-pre">🇮🇳 +91</div>
              <input className="form-input" placeholder="10-digit number" value={mob} maxLength={10}
                onChange={e => setMob(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>

          {tab === "signup" && (
            <div className="form-group">
              <label>Email <span className="opt">(optional — for appointment confirmations)</span></label>
              <input className="form-input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" placeholder="Min. 6 characters" value={pass}
              onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>

          <button className="submit-btn" onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : tab === "login" ? "Sign in →" : "Create account →"}
          </button>
        </div>
      </div>
    </div>
  );
}
