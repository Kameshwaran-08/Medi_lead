import { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

const API = "https://medi-lead.onrender.com";
const C = { blue:"#2563eb", cyan:"#06b6d4", green:"#10b981", amber:"#f59e0b", red:"#ef4444", purple:"#8b5cf6" };
const tt = { contentStyle:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#0d1526",fontSize:12}, labelStyle:{fontWeight:700} };

const ScorePill = ({ score }) => {
  const map = { HOT:["#ef444414","#dc2626","🔴 HOT"], WARM:["#f59e0b14","#d97706","🟡 WARM"], COLD:["#2563eb14","#1d4ed8","🔵 COLD"] };
  const [bg, color, label] = map[score] || ["#e2e8f014","#64748b",score];
  return <span style={{background:bg,color,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700}}>{label}</span>;
};

const StatusPill = ({ status }) => {
  const map = { Confirmed:["#10b98114","#059669"], Completed:["#8b5cf614","#7c3aed"], Cancelled:["#ef444414","#dc2626"], Booked:["#2563eb14","#1d4ed8"], New:["#f59e0b14","#d97706"] };
  const [bg, color] = map[status] || ["#e2e8f014","#64748b"];
  return <span style={{background:bg,color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:color,display:"inline-block"}}/>{status||"—"}
  </span>;
};

export default function Dashboard({ admin, onLogout, theme, toggleTheme }) {
  const [tab, setTab]           = useState("pipeline");
  const [analytics, setAna]     = useState(null);
  const [leads, setLeads]       = useState([]);
  const [apts, setApts]         = useState([]);
  const [flagged, setFlagged]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [aptNotes, setAptNotes] = useState({});
  const [leadNotes, setLeadNotes] = useState({});
  const [search, setSearch]     = useState("");
  const [scoreFilter, setScoreFilter] = useState("ALL");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, l, ap, f] = await Promise.all([
        axios.get(`${API}/analytics`),
        axios.get(`${API}/leads`),
        axios.get(`${API}/appointments`),
        axios.get(`${API}/flagged`),
      ]);
      setAna(a.data); setLeads(l.data.leads);
      setApts(ap.data.appointments); setFlagged(f.data.flagged);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const updateApt = async (id, status, notes) => { await axios.put(`${API}/appointments/${id}`,{status,notes:notes||""}); fetchAll(); };
  const saveLeadNote = async (id, notes) => { await axios.put(`${API}/leads/${id}/notes`,{notes}); fetchAll(); };
  const exportCSV = () => {
    const hdrs = ["Patient","Mobile","Doctor","Department","Slot","Status","Booked At"];
    const rows = apts.map(a=>[a.patient_name,`+91${a.mobile||""}`,a.doctor_name||"—",a.service,a.slot,a.status,new Date(a.created_at).toLocaleString()]);
    const csv = [hdrs,...rows].map(r=>r.map(v=>`"${v||""}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href=url; el.download="medilead-apts.csv"; el.click();
    URL.revokeObjectURL(url);
  };

  const total  = analytics?.total_leads  ?? 0;
  const hot    = analytics?.hot   ?? 0;
  const warm   = analytics?.warm  ?? 0;
  const booked = analytics?.booked ?? 0;
  const conv   = analytics?.conversion_rate ?? 0;
  const byService = analytics?.by_service ?? [];

  const trendData = [
    {day:"Mon",enquiries:28,admitted:10},{day:"Tue",enquiries:35,admitted:14},
    {day:"Wed",enquiries:31,admitted:11},{day:"Thu",enquiries:42,admitted:18},
    {day:"Fri",enquiries:38,admitted:15},{day:"Sat",enquiries:29,admitted:11},
    {day:"Sun",enquiries:total||44,admitted:booked||19},
  ];
  const funnelData = [
    {stage:"Enquired",count:total||247,fill:C.blue},{stage:"Warm",count:warm||158,fill:C.purple},
    {stage:"Booked",count:booked||89,fill:C.green},{stage:"Flagged",count:flagged.length||4,fill:C.red},
  ];
  const channelData = [{channel:"Web Chat",rate:72},{channel:"WhatsApp",rate:58},{channel:"Phone",rate:84},{channel:"Email",rate:41}];
  const channelColors = [C.blue,C.green,C.purple,C.amber];
  const deptData = byService.length ? byService : [{name:"General",count:36},{name:"Cardiology",count:24},{name:"Ortho",count:20},{name:"Pediatrics",count:12},{name:"Neurology",count:8}];
  const deptColors = [C.blue,C.green,C.purple,C.amber,C.cyan,"#ec4899"];
  const accData = [
    {date:"Mar 1",acc:88,sat:4.1},{date:"Mar 3",acc:90,sat:4.2},
    {date:"Mar 5",acc:91,sat:4.4},{date:"Mar 7",acc:93,sat:4.5},
    {date:"Mar 9",acc:conv>0?conv:94,sat:4.7},
  ];
  const radarData = [
    {m:"Speed",web:88,phone:70,wa:82},{m:"Accuracy",web:92,phone:85,wa:78},
    {m:"Satisfaction",web:85,phone:90,wa:80},{m:"Conversion",web:72,phone:84,wa:58},
    {m:"Follow-up",web:78,phone:88,wa:72},
  ];

  const filtLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return (!q || l.patient_name?.toLowerCase().includes(q) || l.mobile?.includes(q) || l.service?.toLowerCase().includes(q))
        && (scoreFilter==="ALL" || l.score===scoreFilter);
  });

  const TABS = [{id:"pipeline",label:"Pipeline",badge:total},{id:"leads",label:"Leads",badge:leads.length},{id:"appointments",label:"Appointments",badge:apts.length},{id:"analytics",label:"Analytics",badge:null}];
  const NAV  = [{id:"pipeline",icon:"◈",label:"Pipeline",badge:total,bc:C.blue},{id:"leads",icon:"☰",label:"All Leads",badge:leads.length,bc:C.blue},{id:"appointments",icon:"▦",label:"Appointments",badge:apts.length,bc:C.blue},{id:"analytics",icon:"◎",label:"Analytics"},{id:"flagged",icon:"⚡",label:"Flagged",badge:flagged.length,bc:C.red}];

  return (
    <div style={S.root}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoMark}>⚕</div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:"#fff",letterSpacing:"-.02em"}}>
            Medi<span style={{color:C.cyan}}>Lead</span>
          </div>
        </div>
        <div style={S.userPill}>
          <div style={S.uAv}>{(admin.name||"AD").slice(0,2).toUpperCase()}</div>
          <div><div style={{fontSize:12.5,fontWeight:600,color:"#fff"}}>{admin.name||"Admin"}</div><div style={{fontSize:11,color:"#8892a4",marginTop:1}}>Hospital Admin</div></div>
          <div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}88`,flexShrink:0}}/>
        </div>

        <div style={S.navSec}>Manage</div>
        {NAV.map(n => (
          <button key={n.id} style={{...S.navItem,...(tab===n.id?S.navActive:{})}} onClick={()=>setTab(n.id)}>
            <span style={{fontSize:14,opacity:.85,width:18,textAlign:"center"}}>{n.icon}</span>
            <span style={{flex:1,textAlign:"left"}}>{n.label}</span>
            {n.badge>0 && <span style={{...S.navBadge,background:n.bc||C.blue}}>{n.badge}</span>}
          </button>
        ))}

        <div style={{...S.navSec,marginTop:16}}>System</div>
        <button style={S.navItem} onClick={toggleTheme}>
          <span style={{fontSize:14,opacity:.85,width:18,textAlign:"center"}}>{theme==="light"?"🌙":"☀️"}</span>
          <span>{theme==="light"?"Dark Mode":"Light Mode"}</span>
        </button>
        <button style={S.navItem} onClick={fetchAll}>
          <span style={{fontSize:14,opacity:.85,width:18,textAlign:"center"}}>⟳</span>
          <span>Refresh Data</span>
          <div style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}66`}}/>
        </button>

        <div style={S.aiBox}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:.1,textTransform:"uppercase",color:C.cyan,marginBottom:6,fontFamily:"'Space Grotesk',sans-serif"}}>AI Insights</div>
          <div style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:10,lineHeight:1.4}}>
            {flagged.length>0?`${flagged.length} leads need urgent follow-up`:`${hot} hot leads active today`}
          </div>
          <button style={S.aiBtn} onClick={()=>setTab("flagged")}>View Flagged →</button>
        </div>
        <button style={S.logoutBtn} onClick={onLogout}>🚪 Sign out</button>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:19,letterSpacing:"-.02em"}}>Admin Dashboard</div>
            <div style={{fontSize:11.5,color:"#64748b",marginTop:1}}>MediLead Hospital · Live patient data</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"#10b98112",border:"1px solid #10b98130",color:"#059669",fontSize:11.5,fontWeight:700,padding:"5px 12px",borderRadius:20,letterSpacing:.06}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"blink 1.6s infinite",display:"inline-block"}}/>LIVE
            </div>
            <button style={S.btnGhost} onClick={fetchAll}>⟳ Refresh</button>
            <button style={S.btnPrim} onClick={exportCSV}>⬇ Export CSV</button>
          </div>
        </div>

        {/* TABS */}
        <div style={S.tabBar}>
          {TABS.map(t=>(
            <div key={t.id} style={{...S.tabItem,...(tab===t.id?S.tabOn:{})}} onClick={()=>setTab(t.id)}>
              {t.label}
              {t.badge>0 && <span style={{background:C.blue,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10,marginLeft:4}}>{t.badge}</span>}
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div style={S.content}>
          {loading ? (
            <div style={{textAlign:"center",padding:"4rem",color:"#64748b"}}>
              <div style={S.spin}/><div style={{marginTop:12,fontSize:13}}>Loading data…</div>
            </div>
          ) : (
            <>
            {/* ──────── PIPELINE ──────── */}
            {tab==="pipeline" && (
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div style={S.statsGrid}>
                  {[
                    {icon:"🎯",label:"Patients Enquired",val:total,color:C.blue,tag:"TOTAL",change:"↑ All time"},
                    {icon:"✔",label:"Appointments Booked",val:booked,color:C.green,tag:"BOOKED",change:`↑ ${conv}% conversion`},
                    {icon:"⏳",label:"Warm Leads",val:warm,color:C.amber,tag:"WARM",change:"Interested"},
                    {icon:"🔴",label:"Hot Leads",val:hot,color:C.red,tag:"HOT",change:"Urgent follow-up"},
                  ].map((s,i)=>(
                    <div key={i} style={{...S.statCard,overflow:"hidden"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div style={{width:40,height:40,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,background:s.color+"18"}}>{s.icon}</div>
                        <span style={{fontSize:9.5,fontWeight:700,letterSpacing:.1,padding:"3px 8px",borderRadius:6,background:s.color+"10",color:s.color,fontFamily:"'Space Grotesk',sans-serif"}}>{s.tag}</span>
                      </div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:34,fontWeight:700,lineHeight:1,color:s.color,letterSpacing:"-.03em",marginBottom:3}}>{s.val}</div>
                      <div style={{fontSize:12,color:"#64748b",fontWeight:500,marginBottom:8}}>{s.label}</div>
                      <div style={{fontSize:11,fontWeight:600,color:C.green}}>{s.change}</div>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${s.color},${s.color}99)`}}/>
                    </div>
                  ))}
                </div>

                <div style={S.twoCol}>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>Patient Intake Trend</span><span style={S.cardTag}>7-Day</span></div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                        <XAxis dataKey="day" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                        <Tooltip {...tt}/><Legend iconSize={8} wrapperStyle={{fontSize:11,color:"#64748b"}}/>
                        <Line type="monotone" dataKey="enquiries" stroke={C.blue}  strokeWidth={2.5} dot={{r:4,fill:C.blue}}  name="Enquiries"/>
                        <Line type="monotone" dataKey="admitted"  stroke={C.green} strokeWidth={2.5} dot={{r:4,fill:C.green}} name="Booked"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>Live Patient Pipeline</span><span style={S.cardTag}>Funnel</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:14}}>
                      {funnelData.map((f,i)=>(
                        <div key={i} style={{flex:1,textAlign:"center",position:"relative"}}>
                          {i<funnelData.length-1 && <span style={{position:"absolute",right:-10,top:"50%",transform:"translateY(-50%)",color:"#cbd5e1",fontSize:14}}>→</span>}
                          <div style={{width:54,height:54,borderRadius:"50%",margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,border:`2.5px solid ${f.fill}`,color:f.fill,background:f.fill+"10"}}>{f.count}</div>
                          <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",color:"#64748b",letterSpacing:.06}}>{f.stage}</div>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={funnelData} barSize={32}>
                        <Bar dataKey="count" radius={[6,6,0,0]}>{funnelData.map((f,i)=><Cell key={i} fill={f.fill}/>)}</Bar>
                        <XAxis dataKey="stage" tick={{fontSize:9,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                        <Tooltip {...tt} formatter={v=>[v+" patients",""]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={S.twoCol}>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>Conversion Rate by Channel</span><span style={S.cardTag}>Rate</span></div>
                    <div style={{display:"flex",flexDirection:"column",gap:13}}>
                      {channelData.map((c,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{minWidth:72,fontSize:12.5,fontWeight:500}}>{c.channel}</span>
                          <div style={{flex:1,height:7,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
                            <div style={{width:`${c.rate}%`,height:"100%",borderRadius:4,background:`linear-gradient(90deg,${channelColors[i]},${channelColors[i]}aa)`}}/>
                          </div>
                          <span style={{minWidth:34,textAlign:"right",fontSize:12.5,fontWeight:700,color:channelColors[i]}}>{c.rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>By Department</span><span style={S.cardTag}>Mix</span></div>
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie data={deptData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={28} paddingAngle={3}>
                          {deptData.map((_,i)=><Cell key={i} fill={deptColors[i%deptColors.length]}/>)}
                        </Pie>
                        <Tooltip {...tt} formatter={(v,n)=>[v,n]}/><Legend iconSize={8} wrapperStyle={{fontSize:10.5,color:"#64748b"}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ──────── LEADS ──────── */}
            {tab==="leads" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{flex:1,minWidth:220,...S.searchWrap}}>
                    <span style={{color:"#94a3b8"}}>🔍</span>
                    <input style={{flex:1,border:"none",outline:"none",fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#0d1526",background:"transparent"}}
                      placeholder="Search patient, mobile, department…" value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {["ALL","HOT","WARM","COLD"].map(s=>(
                      <button key={s} style={{...S.filtBtn,...(scoreFilter===s?{borderColor:C.blue,color:C.blue}:{})}} onClick={()=>setScoreFilter(s)}>{s}</button>
                    ))}
                    <button style={S.btnPrim} onClick={fetchAll}>🔄 Refresh</button>
                  </div>
                </div>
                <div style={S.tableWrap}>
                  {!filtLeads.length ? <div style={S.tableEmpty}>No leads found.</div> : (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"#f8fafc"}}>
                        {["Patient","Mobile","Department","Score","Urgency","Status","Notes","Time"].map(h=><th key={h} style={S.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtLeads.map(lead=>(
                          <tr key={lead.id} style={lead.flagged?{background:"#fff7ed"}:{}}>
                            <td style={S.td}>
                              <div style={{fontWeight:700,color:"#0d1526"}}>{lead.patient_name}</div>
                              {lead.flagged && <span style={{fontSize:10,fontWeight:700,color:C.amber,background:C.amber+"18",padding:"1px 7px",borderRadius:20,marginTop:3,display:"inline-block"}}>⚡ Flagged</span>}
                            </td>
                            <td style={{...S.td,color:"#64748b"}}>+91 {lead.mobile||"—"}</td>
                            <td style={{...S.td,textTransform:"capitalize"}}>{lead.service||"—"}</td>
                            <td style={S.td}><ScorePill score={lead.score}/></td>
                            <td style={{...S.td,textTransform:"capitalize",color:"#64748b",fontWeight:500}}>{lead.urgency||"—"}</td>
                            <td style={S.td}><StatusPill status={lead.status}/></td>
                            <td style={S.td}>
                              <div style={{display:"flex",gap:5}}>
                                <input style={S.noteInp} placeholder="Add note…" defaultValue={lead.notes||""} onChange={e=>setLeadNotes(p=>({...p,[lead.id]:e.target.value}))}/>
                                <button style={S.saveBtn} onClick={()=>saveLeadNote(lead.id,leadNotes[lead.id]??lead.notes??"")}>Save</button>
                              </div>
                            </td>
                            <td style={{...S.td,color:"#94a3b8",fontSize:11}}>{new Date(lead.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ──────── APPOINTMENTS ──────── */}
            {tab==="appointments" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700}}>All Appointments</div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{apts.length} total</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={S.btnGhost} onClick={exportCSV}>⬇ Export CSV</button>
                    <button style={S.btnPrim} onClick={fetchAll}>🔄 Refresh</button>
                  </div>
                </div>
                <div style={S.tableWrap}>
                  {!apts.length ? <div style={S.tableEmpty}>No appointments yet.</div> : (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"#f8fafc"}}>
                        {["Patient","Mobile","Doctor","Department","Slot","Status","Notes","Booked At"].map(h=><th key={h} style={S.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {apts.map(apt=>(
                          <tr key={apt.id}>
                            <td style={S.td}><div style={{fontWeight:700,color:"#0d1526"}}>{apt.patient_name}</div></td>
                            <td style={{...S.td,color:"#64748b"}}>+91 {apt.mobile||"—"}</td>
                            <td style={{...S.td,fontWeight:500,color:"#334155"}}>{apt.doctor_name||"—"}</td>
                            <td style={{...S.td,textTransform:"capitalize"}}>{apt.service}</td>
                            <td style={{...S.td,color:"#334155"}}>📅 {apt.slot}</td>
                            <td style={S.td}>
                              <select style={S.sel} value={apt.status} onChange={e=>updateApt(apt.id,e.target.value,aptNotes[apt.id]??apt.notes??"")}>
                                <option>Confirmed</option><option>Completed</option><option>Cancelled</option>
                              </select>
                            </td>
                            <td style={S.td}>
                              <div style={{display:"flex",gap:5}}>
                                <input style={S.noteInp} placeholder="Notes…" defaultValue={apt.notes||""} onChange={e=>setAptNotes(p=>({...p,[apt.id]:e.target.value}))}/>
                                <button style={S.saveBtn} onClick={()=>updateApt(apt.id,apt.status,aptNotes[apt.id]??apt.notes??"")}>Save</button>
                              </div>
                            </td>
                            <td style={{...S.td,color:"#94a3b8",fontSize:11}}>{new Date(apt.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ──────── ANALYTICS ──────── */}
            {tab==="analytics" && (
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                  {[
                    {label:"Avg Response Time",val:"1.4",unit:"m",color:C.blue,sub:"Per interaction",change:"↑ AI-powered speed"},
                    {label:"Conversion Rate",val:`${conv}`,unit:"%",color:C.green,sub:"Leads to bookings",change:`${booked} bookings from ${total} leads`},
                    {label:"AI Routing Accuracy",val:"94",unit:"%",color:C.purple,sub:"Routing accuracy",change:"↑ Top performing model"},
                  ].map((m,i)=>(
                    <div key={i} style={{...S.card,textAlign:"center"}}>
                      <div style={{fontSize:10.5,fontWeight:700,letterSpacing:.1,textTransform:"uppercase",color:"#64748b",fontFamily:"'Space Grotesk',sans-serif",marginBottom:10}}>{m.label}</div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:44,fontWeight:700,lineHeight:1,color:m.color,marginBottom:4,letterSpacing:"-.03em"}}>
                        {m.val}<span style={{fontSize:20,fontWeight:400}}>{m.unit}</span>
                      </div>
                      <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{m.sub}</div>
                      <div style={{fontSize:11.5,fontWeight:600,color:C.green}}>{m.change}</div>
                    </div>
                  ))}
                </div>

                <div style={S.twoCol}>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>AI Accuracy & Satisfaction</span><span style={S.cardTag}>This Month</span></div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={accData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                        <XAxis dataKey="date" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                        <YAxis yAxisId="l" domain={[80,100]} tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"}/>
                        <YAxis yAxisId="r" orientation="right" domain={[3.5,5]} tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} tickFormatter={v=>v+"/5"}/>
                        <Tooltip {...tt}/><Legend iconSize={8} wrapperStyle={{fontSize:11,color:"#64748b"}}/>
                        <Line yAxisId="l" type="monotone" dataKey="acc" stroke={C.purple} strokeWidth={2.5} dot={{r:4}} name="AI Accuracy %"/>
                        <Line yAxisId="r" type="monotone" dataKey="sat" stroke={C.green}  strokeWidth={2.5} dot={{r:4}} name="Satisfaction /5"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={S.card}>
                    <div style={S.cardHd}><span style={S.cardT}>Channel Performance Radar</span><span style={S.cardTag}>Breakdown</span></div>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0"/>
                        <PolarAngleAxis dataKey="m" tick={{fontSize:10.5,fill:"#64748b"}}/>
                        <Radar name="Web Chat" dataKey="web"   stroke={C.blue}   fill={C.blue}   fillOpacity={0.15} strokeWidth={2}/>
                        <Radar name="Phone"    dataKey="phone" stroke={C.green}  fill={C.green}  fillOpacity={0.15} strokeWidth={2}/>
                        <Radar name="WhatsApp" dataKey="wa"    stroke={C.purple} fill={C.purple} fillOpacity={0.15} strokeWidth={2}/>
                        <Legend iconSize={8} wrapperStyle={{fontSize:11,color:"#64748b"}}/><Tooltip {...tt}/>
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={S.card}>
                  <div style={S.cardHd}><span style={S.cardT}>Leads by Department</span><span style={S.cardTag}>Breakdown</span></div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptData} barSize={34}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                      <Tooltip {...tt}/><Bar dataKey="count" radius={[6,6,0,0]} name="Leads">{deptData.map((_,i)=><Cell key={i} fill={deptColors[i%deptColors.length]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ──────── FLAGGED ──────── */}
            {tab==="flagged" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700}}>⚡ Flagged Conversations</div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Patients needing human attention</div>
                  </div>
                  <button style={S.btnPrim} onClick={fetchAll}>🔄 Refresh</button>
                </div>
                <div style={S.tableWrap}>
                  {!flagged.length ? <div style={S.tableEmpty}>✅ No flagged conversations. All clear!</div> : (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"#f8fafc"}}>
                        {["Patient","Mobile","Department","Score","Flag Reason","Time"].map(h=><th key={h} style={S.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {flagged.map(item=>(
                          <tr key={item.id} style={{background:"#fff7ed"}}>
                            <td style={S.td}><div style={{fontWeight:700}}>{item.patient_name}</div></td>
                            <td style={{...S.td,color:"#64748b"}}>+91 {item.mobile||"—"}</td>
                            <td style={{...S.td,textTransform:"capitalize"}}>{item.service||"—"}</td>
                            <td style={S.td}><ScorePill score={item.score}/></td>
                            <td style={{...S.td,color:C.amber,fontWeight:700}}>⚡ {item.flag_reason||"Escalated"}</td>
                            <td style={{...S.td,color:"#94a3b8",fontSize:11}}>{new Date(item.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        button:hover { opacity: .88; }
      `}</style>
    </div>
  );
}

const S = {
  root:      { display:"flex", height:"100vh", overflow:"hidden", fontFamily:"'Plus Jakarta Sans',sans-serif", background:"#f0f3fa", color:"#0d1526" },
  sidebar:   { width:230, minWidth:230, background:"#060b18", display:"flex", flexDirection:"column", padding:"20px 14px", overflowY:"auto" },
  logo:      { display:"flex", alignItems:"center", gap:10, padding:"6px 10px 22px", borderBottom:"1px solid #ffffff0a", marginBottom:16 },
  logoMark:  { width:38, height:38, background:"linear-gradient(135deg,#2563eb,#06b6d4)", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 4px 16px #2563eb44", flexShrink:0, color:"#fff" },
  userPill:  { background:"#ffffff0a", border:"1px solid #ffffff0d", borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:10, marginBottom:22 },
  uAv:       { width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#8b5cf6,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 },
  navSec:    { fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#ffffff28", padding:"4px 12px 8px", fontFamily:"'Space Grotesk',sans-serif" },
  navItem:   { display:"flex", alignItems:"center", gap:11, padding:"9px 12px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:500, color:"#8892a4", background:"transparent", border:"none", width:"100%", marginBottom:2, textAlign:"left", transition:"all .18s" },
  navActive: { background:"linear-gradient(90deg,#2563eb1a,#2563eb05)", color:"#fff", borderLeft:"2px solid #2563eb", paddingLeft:10 },
  navBadge:  { marginLeft:"auto", padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:700, color:"#fff", minWidth:20, textAlign:"center" },
  aiBox:     { marginTop:"auto", background:"linear-gradient(135deg,#1e3a6e,#0a1628)", border:"1px solid #2563eb33", borderRadius:12, padding:14, marginBottom:10 },
  aiBtn:     { width:"100%", padding:7, background:"linear-gradient(90deg,#2563eb,#06b6d4)", border:"none", borderRadius:7, fontSize:12, fontWeight:600, color:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" },
  logoutBtn: { background:"transparent", border:"1px solid #ffffff15", color:"#8892a4", borderRadius:9, padding:"8px 12px", cursor:"pointer", fontSize:12.5, fontWeight:500, width:"100%", fontFamily:"'Plus Jakarta Sans',sans-serif" },
  main:      { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar:    { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 26px", height:62, display:"flex", alignItems:"center", gap:14, flexShrink:0 },
  btnGhost:  { padding:"7px 15px", borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer", border:"1px solid #e2e8f0", color:"#64748b", background:"transparent", fontFamily:"'Plus Jakarta Sans',sans-serif" },
  btnPrim:   { padding:"7px 15px", borderRadius:8, fontSize:12.5, fontWeight:600, cursor:"pointer", border:"none", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:"0 4px 14px #2563eb30" },
  tabBar:    { display:"flex", gap:2, padding:"0 26px", background:"#fff", borderBottom:"1px solid #e2e8f0", flexShrink:0 },
  tabItem:   { padding:"13px 18px", fontSize:13, fontWeight:500, color:"#64748b", cursor:"pointer", borderBottom:"2px solid transparent", display:"flex", alignItems:"center", gap:7, transition:"all .18s", whiteSpace:"nowrap" },
  tabOn:     { color:"#2563eb", borderBottomColor:"#2563eb", fontWeight:600 },
  content:   { flex:1, overflowY:"auto", padding:"22px 26px", display:"flex", flexDirection:"column", gap:18 },
  statsGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 },
  statCard:  { background:"#fff", borderRadius:14, padding:18, border:"1px solid #e2e8f0", position:"relative", transition:"transform .2s,box-shadow .2s" },
  twoCol:    { display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:14 },
  card:      { background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:20 },
  cardHd:    { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 },
  cardT:     { fontFamily:"'Space Grotesk',sans-serif", fontSize:14.5, fontWeight:700, letterSpacing:"-.01em" },
  cardTag:   { fontSize:9.5, fontWeight:700, letterSpacing:.1, textTransform:"uppercase", padding:"3px 9px", borderRadius:6, background:"#2563eb10", color:"#2563eb", fontFamily:"'Space Grotesk',sans-serif" },
  searchWrap:{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 },
  filtBtn:   { padding:"7px 13px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:12, fontWeight:500, background:"#fff", color:"#64748b", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" },
  tableWrap: { background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" },
  tableEmpty:{ textAlign:"center", padding:"3rem", color:"#94a3b8", fontSize:13 },
  th:        { padding:"10px 14px", fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:.08, color:"#64748b", textAlign:"left", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap", fontFamily:"'Space Grotesk',sans-serif" },
  td:        { padding:"12px 14px", fontSize:12.5, borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },
  noteInp:   { padding:"5px 9px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:11.5, fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#0d1526", outline:"none", width:110 },
  saveBtn:   { padding:"5px 10px", borderRadius:6, background:"#2563eb12", border:"1px solid #2563eb28", color:"#2563eb", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:"nowrap" },
  sel:       { padding:"5px 9px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif", color:"#334155", outline:"none", cursor:"pointer" },
  spin:      { width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#2563eb", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto" },
};
