import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function AdminAuth({ onLogin, theme, toggleTheme }) {
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const login = async () => {
    setErr("");
    if (!email || !pass) { setErr("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/login`, { mobile: email, password: pass, role: "admin" });
      if (res.data.success) onLogin(res.data.user);
      else setErr(res.data.message);
    } catch { setErr("Connection failed. Make sure the backend is running."); }
    setLoading(false);
  };

  return (
    <div className="admin-auth">
      {/* Floating orbs */}
      <div className="admin-auth-orb admin-auth-orb-1" />
      <div className="admin-auth-orb admin-auth-orb-2" />

      {/* Subtle grid overlay */}
      <div style={{
        position:"absolute",inset:0,
        backgroundImage:`linear-gradient(rgba(43,124,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(43,124,255,.03) 1px,transparent 1px)`,
        backgroundSize:"44px 44px",
        pointerEvents:"none",zIndex:1
      }}/>

      <div className="admin-auth-card">
        {/* Decorative top accent */}
        <div style={{
          position:"absolute",top:0,left:"10%",right:"10%",height:2,
          background:"linear-gradient(90deg,transparent,#2b7cff,#06b6d4,transparent)",
          borderRadius:"0 0 8px 8px",opacity:.7
        }}/>

        <div className="auth-top-row">
          <div className="auth-logo-wrap">
            <span className="auth-logo-icon">🏥</span>
            <span className="auth-logo-text">Medi<em>Lead</em></span>
          </div>
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>

        <div className="badge-admin">🔐 Admin Portal</div>
        <h2>Welcome back</h2>
        <p className="sub">Sign in to the hospital command centre</p>

        {err && <div className="err">⚠️ {err}</div>}

        <div className="form-group">
          <label>Admin Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="admin@medilead.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
          />
        </div>

        <button className="submit-btn" onClick={login} disabled={loading}>
          {loading ? (
            <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
              <span style={{
                display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.4)",
                borderTopColor:"#fff",borderRadius:"50%",
                animation:"spin .7s linear infinite"
              }}/>
              Signing in…
            </span>
          ) : "Sign in to Dashboard →"}
        </button>

        <div className="admin-hint">Default: admin@citycare.com / admin123</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
