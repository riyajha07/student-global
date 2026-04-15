import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAeapcTRJDlShvPsBOFH0HsbySqSf7ZkU4",
  authDomain: "global-student-collaboration.firebaseapp.com",
  projectId: "global-student-collaboration",
  storageBucket: "global-student-collaboration.firebasestorage.app",
  messagingSenderId: "519101802897",
  appId: "1:519101802897:web:d75bee7f31c9a882559230",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  :root{--bg:#020817;--navy:#071a3e;--blue:#0ea5e9;--cyan:#06d6f5;--accent:#00ffc8;--text:#e2f0ff;--muted:#7ba3c8;--err:#f87171;--font-h:'Orbitron',monospace;--font-b:'Rajdhani',sans-serif;--font-m:'Share Tech Mono',monospace}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--font-b);min-height:100vh}
  .utp-wrap{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem 3rem;position:relative;overflow:hidden}
  .utp-grid{position:fixed;inset:0;background:linear-gradient(rgba(6,214,245,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .utp-card{position:relative;z-index:1;background:rgba(4,15,36,0.92);border:1px solid rgba(0,255,200,0.18);border-radius:16px;width:100%;max-width:640px;padding:2rem 2.5rem;box-shadow:0 0 60px rgba(0,255,200,0.04)}
  @media(max-width:500px){.utp-card{padding:1.5rem 1.25rem}}
  .utp-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.75rem}
  .utp-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-family:var(--font-m);font-size:0.7rem;color:var(--muted);transition:color 0.2s;padding:0}
  .utp-back:hover{color:var(--accent)}
  .utp-badge{font-family:var(--font-m);font-size:0.65rem;color:var(--accent);background:rgba(0,255,200,0.07);border:1px solid rgba(0,255,200,0.2);border-radius:4px;padding:3px 10px;letter-spacing:0.1em}
  .utp-sub{font-family:var(--font-m);font-size:0.68rem;color:var(--accent);letter-spacing:0.12em;margin-bottom:6px}
  .utp-h1{font-family:var(--font-h);font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;color:var(--text);margin-bottom:1.5rem}
  .utp-h1 span{color:rgba(0,255,200,0.3)}
  .utp-label{display:block;font-family:var(--font-m);font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;margin-bottom:6px}
  .utp-field{margin-bottom:1.1rem}
  .utp-input,.utp-select,.utp-textarea{width:100%;padding:0.7rem 1rem;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.18);border-radius:6px;color:var(--text);font-family:var(--font-b);font-size:0.95rem;outline:none;transition:all 0.2s}
  .utp-input:focus,.utp-select:focus,.utp-textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(0,255,200,0.07)}
  .utp-select option{background:#071a3e}
  .utp-textarea{min-height:90px;resize:vertical}
  .utp-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:480px){.utp-row{grid-template-columns:1fr}}
  /* Leader picker */
  .utp-leader-list{display:flex;flex-direction:column;gap:7px;max-height:200px;overflow-y:auto;margin-bottom:1rem}
  .utp-leader-item{display:flex;align-items:center;gap:10px;padding:0.6rem 0.85rem;border-radius:7px;cursor:pointer;border:1px solid rgba(14,165,233,0.15);background:rgba(7,26,62,0.3);transition:all 0.2s}
  .utp-leader-item:hover{border-color:rgba(0,255,200,0.3)}
  .utp-leader-item.sel{border-color:var(--accent);background:rgba(0,255,200,0.06)}
  .utp-leader-name{font-family:var(--font-h);font-size:0.7rem;color:var(--text)}
  .utp-leader-role{font-family:var(--font-m);font-size:0.6rem;color:var(--muted)}
  .utp-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:0.5rem}
  .utp-tag{font-family:var(--font-m);font-size:0.65rem;padding:5px 11px;border-radius:4px;cursor:pointer;border:1px solid rgba(14,165,233,0.2);color:var(--muted);background:rgba(7,26,62,0.4);transition:all 0.2s}
  .utp-tag.on{border-color:var(--accent);color:var(--accent);background:rgba(0,255,200,0.07)}
  .utp-btn{width:100%;padding:0.8rem;border-radius:8px;cursor:pointer;font-family:var(--font-h);font-size:0.75rem;font-weight:700;letter-spacing:0.08em;border:none;background:linear-gradient(135deg,#00c896,#06d6f5);color:#020817;box-shadow:0 0 20px rgba(0,255,200,0.15);transition:all 0.25s;margin-top:0.5rem}
  .utp-btn:hover:not(:disabled){box-shadow:0 0 30px rgba(0,255,200,0.35);transform:translateY(-1px)}
  .utp-btn:disabled{opacity:0.5;cursor:not-allowed}
  .utp-success{text-align:center;padding:0.75rem;font-family:var(--font-m);font-size:0.72rem;color:var(--accent)}
  .utp-err{text-align:center;padding:0.75rem;font-family:var(--font-m);font-size:0.72rem;color:var(--err)}
  .utp-loading{min-height:100vh;display:flex;align-items:center;justify-content:center}
  .utp-spin{width:34px;height:34px;border:2px solid rgba(0,255,200,0.2);border-top-color:var(--accent);border-radius:50%;animation:utp-spin 0.7s linear infinite}
  @keyframes utp-spin{to{transform:rotate(360deg)}}
  .utp-notice{font-family:var(--font-m);font-size:0.65rem;color:var(--err);text-align:center;padding:1rem}
`;

const DOMAIN_OPTS = ["Healthcare","Education","E-Commerce","Finance","Cybersecurity","Entertainment","Transport","AI/ML","IoT","Other"];
const COLLAB_OPTS = ["Async (flexible)","Daily standups","Sprint-based","Casual/Hackathon"];
const TZ_OPTS = ["UTC-8 (PST)","UTC-5 (EST)","UTC+0 (GMT)","UTC+1 (CET)","UTC+3 (EAT)","UTC+5:30 (IST)","UTC+8 (SGT)","UTC+9 (JST)","UTC+10 (AEST)"];

export default function UpdateTeamProfile() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");
  const [isLeader, setIsLeader] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [form, setForm] = useState({
    teamName:"", projectName:"", domain:"", description:"",
    collabStyle:"", timezone:"", status:"active", teamLeader:"",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db,"teamProjects",projectId));
      if (snap.exists()) {
        const d = snap.data();
        if (d.teamLeader !== u.uid) { setLoading(false); return; }
        setIsLeader(true);
        setForm({
          teamName: d.teamName || "",
          projectName: d.projectName || "",
          domain: d.domain || "",
          description: d.description || "",
          collabStyle: d.collabStyle || "",
          timezone: d.timezone || "",
          status: d.status || "active",
          teamLeader: d.teamLeader || "",
        });
        // Load member profiles for leader transfer
        const members = d.members || [];
        const profiles = await Promise.all(
          members.map(async uid => {
            const ps = await getDoc(doc(db,"users",uid));
            return ps.exists() ? { id: uid, ...ps.data() } : { id: uid, fullName: "Member" };
          })
        );
        setMemberProfiles(profiles);
      }
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleSave = async () => {
    if (!form.teamName.trim() || !form.projectName.trim()) { setErr("Team and project name are required."); return; }
    setSaving(true); setErr(""); setSuccess(false);
    try {
      await updateDoc(doc(db,"teamProjects",projectId), {
        ...form,
        updatedAt: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => nav(`/team-dashboard/${projectId}`), 1200);
    } catch(e) {
      setErr("Failed to save. " + e.message);
    }
    setSaving(false);
  };

  if (loading) return (<><style>{css}</style><div className="utp-loading"><div className="utp-spin" /></div></>);

  if (!isLeader) return (
    <><style>{css}</style>
      <div className="utp-loading">
        <div className="utp-notice">Only the team leader can edit project info.</div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="utp-wrap">
        <div className="utp-grid" />
        <div className="utp-card">
          <div className="utp-topbar">
            <button className="utp-back" onClick={() => nav(`/team-dashboard/${projectId}`)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              back
            </button>
            <span className="utp-badge">LEADER EDIT</span>
          </div>

          <div className="utp-sub">team_project.update()</div>
          <h1 className="utp-h1"><span>EDIT</span> · Team Project</h1>

          <div className="utp-row">
            <div className="utp-field">
              <label className="utp-label">TEAM NAME *</label>
              <input className="utp-input" value={form.teamName} onChange={e => set("teamName",e.target.value)} />
            </div>
            <div className="utp-field">
              <label className="utp-label">PROJECT NAME *</label>
              <input className="utp-input" value={form.projectName} onChange={e => set("projectName",e.target.value)} />
            </div>
          </div>

          <div className="utp-field">
            <label className="utp-label">DOMAIN</label>
            <select className="utp-select" value={form.domain} onChange={e => set("domain",e.target.value)}>
              <option value="">Select domain…</option>
              {DOMAIN_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="utp-field">
            <label className="utp-label">DESCRIPTION</label>
            <textarea className="utp-textarea" value={form.description} onChange={e => set("description",e.target.value)} />
          </div>

          <div className="utp-row">
            <div className="utp-field">
              <label className="utp-label">COLLAB STYLE</label>
              <select className="utp-select" value={form.collabStyle} onChange={e => set("collabStyle",e.target.value)}>
                <option value="">Select…</option>
                {COLLAB_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="utp-field">
              <label className="utp-label">TIMEZONE</label>
              <select className="utp-select" value={form.timezone} onChange={e => set("timezone",e.target.value)}>
                <option value="">Select…</option>
                {TZ_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="utp-field">
            <label className="utp-label">STATUS</label>
            <select className="utp-select" value={form.status} onChange={e => set("status",e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Team leader transfer */}
          {memberProfiles.length > 1 && (
            <div className="utp-field">
              <label className="utp-label">TRANSFER TEAM LEADER</label>
              <div className="utp-leader-list">
                {memberProfiles.map(m => (
                  <div key={m.id} className={`utp-leader-item ${form.teamLeader===m.id?"sel":""}`}
                    onClick={() => set("teamLeader",m.id)}>
                    <div>
                      <div className="utp-leader-name">{m.fullName || "Member"} {form.teamLeader===m.id ? "👑":""}</div>
                      <div className="utp-leader-role">{m.country || ""} · {m.role || "Member"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div className="utp-err">⚠ {err}</div>}
          {success && <div className="utp-success">✓ Project updated! Redirecting…</div>}

          <button className="utp-btn" onClick={handleSave} disabled={saving || success}>
            {saving ? "SAVING…" : "UPDATE TEAM PROJECT 🚀"}
          </button>
        </div>
      </div>
    </>
  );
}