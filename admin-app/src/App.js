import { useState, useEffect } from "react";
import AdminAuth from "./components/AdminAuth";
import Dashboard from "./components/Dashboard";
import "./App.css";

export default function App() {
  const [admin, setAdmin] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("ml_admin")) || null; } catch { return null; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("ml_admin_theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ml_admin_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");
  const handleLogin  = a => { sessionStorage.setItem("ml_admin", JSON.stringify(a)); setAdmin(a); };
  const handleLogout = () => { sessionStorage.removeItem("ml_admin"); setAdmin(null); };

  return !admin
    ? <AdminAuth onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
    : <Dashboard admin={admin} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
}
