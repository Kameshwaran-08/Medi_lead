/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import axios from "axios";
import API from "./api";
export default function Profile({ user }) {
  const [apts, setApts]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchApts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fetchApts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/patient-appointments/${user.id}`);
      setApts(res.data.appointments);
    } catch (e) {
      console.error("Failed to load appointments:", e);
    }
    setLoading(false);
  };
  return (
    <div className="profile-page">
      <h2>My Appointments</h2>
      <div className="pf-card">
        <div className="pf-head">🧑 Patient Profile</div>
        <div className="pf-body">
          <div className="pf-info-row">
            <div className="pf-info-item"><div className="pf-lbl">Full Name</div><div className="pf-val">{user.name}</div></div>
            <div className="pf-info-item"><div className="pf-lbl">Mobile</div><div className="pf-val">+91 {user.mobile}</div></div>
            {user.email && <div className="pf-info-item"><div className="pf-lbl">Email</div><div className="pf-val">{user.email}</div></div>}
          </div>
        </div>
      </div>
      <div className="pf-card">
        <div className="pf-head">📅 Appointment History</div>
        <div className="pf-body">
          {loading ? (
            <div style={{display:"flex",justifyContent:"center",padding:"2rem"}}>
              <div className="spin" />
            </div>
          ) : !apts.length ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              No appointments yet. Chat with MediBot to book one!
            </div>
          ) : apts.map(apt => (
            <div key={apt.id} className="apt-item">
              <div className="apt-info">
                <div className="apt-title">👨‍⚕️ {apt.doctor_name || "Doctor TBD"}</div>
                <div className="apt-meta">
                  🏥 {apt.service?.charAt(0).toUpperCase() + apt.service?.slice(1)}&nbsp;&nbsp;·&nbsp;&nbsp;
                  📅 {apt.slot}&nbsp;&nbsp;·&nbsp;&nbsp;
                  🔖 #{apt.id?.slice(0, 8)}
                </div>
              </div>
              <span className={`apt-stat ${apt.status}`}>{apt.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
