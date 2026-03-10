import { useState, useEffect } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import Profile from "./components/Profile";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("ml_patient")) || null; } catch { return null; }
  });
  const [page, setPage] = useState("chat");
  const [theme, setTheme] = useState(() => localStorage.getItem("ml_theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ml_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");
  const handleLogin  = u => { sessionStorage.setItem("ml_patient", JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { sessionStorage.removeItem("ml_patient"); setUser(null); setPage("chat"); };

  if (!user) return <Auth onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;

  return (
    <div className="app">
      <nav className="topnav">
        <div className="topnav-logo">
          <span className="logo-pulse">🏥</span>
          <span>Medi<em className="accent">Lead</em></span>
        </div>
        <div className="topnav-center">
          <button className={`nav-tab${page==="chat"?" active":""}`} onClick={() => setPage("chat")}>💬 Chat</button>
          <button className={`nav-tab${page==="profile"?" active":""}`} onClick={() => setPage("profile")}>📅 My Appointments</button>
        </div>
        <div className="topnav-right">
          <span className="user-pill">Hi, {user.name.split(" ")[0]} 👋</span>
          <button className="icon-btn" onClick={toggleTheme}>{theme === "light" ? "🌙" : "☀️"}</button>
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </nav>
      <main className="app-body">
        {page === "chat"    && <Chat    user={user} />}
        {page === "profile" && <Profile user={user} />}
      </main>
    </div>
  );
}
