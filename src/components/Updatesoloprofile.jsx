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
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share Tech Mono&display=swap');
  :root{--bg:#020817;--navy:#071a3e;--blue:#0ea5e9;--cyan:#06d6f5;--accent:#00ffc8;--text:#e2f0ff;--muted:#7ba3c8;--err:#f87171;--font-h:'Orbitron',monospace;--font-b:'Rajdhani',sans-serif;--font-m:'Share Tech Mono',monospace}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--font-b);min-height:100vh}
  .usp-wrap{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem 3rem;position:relative;overflow:hidden}
  .usp-grid{position:fixed;inset:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .usp-card{position:relative;z-index:1;background:rgba(4,15,36,0.9);border:1px solid rgba(14,165,233,0.2);border-radius:16px;width:100%;max-width:620px;padding:2rem 2.5rem;box-shadow:0 0 60px rgba(6,214,245,0.06)}
  @media(max-width:500px){.usp-card{padding:1.5rem 1.25rem}}
  .usp-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.75rem}
  .usp-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-family:var(--font-m);font-size:0.7rem;color:var(--muted);transition:color 0.2s;padding:0}
  .usp-back:hover{color:var(--cyan)}
  .usp-badge{font-family:var(--font-m);font-size:0.65rem;color:var(--blue);background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.2);border-radius:4px;padding:3px 10px;letter-spacing:0.1em}
  .usp-sub{font-family:var(--font-m);font-size:0.68rem;color:var(--blue);letter-spacing:0.12em;margin-bottom:6px}
  .usp-h1{font-family:var(--font-h);font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;color:var(--text);margin-bottom:1.5rem}
  .usp-h1 span{color:rgba(14,165,233,0.3)}
  .usp-label{display:block;font-family:var(--font-m);font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;margin-bottom:6px}
  .usp-field{margin-bottom:1.1rem}
  .usp-input,.usp-select,.usp-textarea{width:100%;padding:0.7rem 1rem;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.18);border-radius:6px;color:var(--text);font-family:var(--font-b);font-size:0.95rem;outline:none;transition:all 0.2s}
  .usp-input:focus,.usp-select:focus,.usp-textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.08)}
  .usp-select option{background:#071a3e}
  .usp-textarea{min-height:90px;resize:vertical}
  .usp-btn{width:100%;padding:0.8rem;border-radius:8px;cursor:pointer;font-family:var(--font-h);font-size:0.75rem;font-weight:700;letter-spacing:0.08em;border:none;background:linear-gradient(135deg,#0ea5e9,#06d6f5);color:#020817;box-shadow:0 0 20px rgba(6,214,245,0.2);transition:all 0.25s;margin-top:0.5rem}
  .usp-btn:hover:not(:disabled){box-shadow:0 0 30px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .usp-btn:disabled{opacity:0.5;cursor:not-allowed}
  .usp-success{text-align:center;padding:0.75rem;font-family:var(--font-m);font-size:0.72rem;color:var(--accent);margin-top:0.5rem}
  .usp-err{text-align:center;padding:0.75rem;font-family:var(--font-m);font-size:0.72rem;color:var(--err);margin-top:0.5rem}
  .usp-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem}
  .usp-spin{width:34px;height:34px;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--cyan);border-radius:50%;animation:usp-spin 0.7s linear infinite}
  @keyframes usp-spin{to{transform:rotate(360deg)}}
`;

export default function UpdateSoloProfile() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    title:"", description:"", problem:"", functional:"", nonFunctional:"",
    stack:"", projectType:"", domain:"", purpose:"", aiUsage:"", status:"active",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db,"soloProjects",projectId));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          title: d.title || "",
          description: d.description || "",
          problem: d.problem || "",
          functional: d.functional || "",
          nonFunctional: d.nonFunctional || "",
          stack: d.stack || "",
          projectType: d.projectType || "",
          domain: d.domain || "",
          purpose: d.purpose || "",
          aiUsage: d.aiUsage || "",
          status: d.status || "active",
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    setSaving(true); setErr(""); setSuccess(false);
    try {
      await updateDoc(doc(db,"soloProjects",projectId), {
        ...form,
        updatedAt: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => nav(`/solo-dashboard/${projectId}`), 1200);
    } catch(e) {
      setErr("Failed to save. " + e.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <><style>{css}</style>
      <div className="usp-loading"><div className="usp-spin" /></div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="usp-wrap">
        <div className="usp-grid" />
        <div className="usp-card">
          <div className="usp-topbar">
            <button className="usp-back" onClick={() => nav(`/solo-dashboard/${projectId}`)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              back
            </button>
            <span className="usp-badge">EDIT PROJECT</span>
          </div>

          <div className="usp-sub">solo_project.update()</div>
          <h1 className="usp-h1"><span>EDIT</span> · Solo Project</h1>

          <div className="usp-field">
            <label className="usp-label">PROJECT TITLE *</label>
            <input className="usp-input" value={form.title} onChange={e => set("title",e.target.value)} placeholder="Project title..." />
          </div>
          <div className="usp-field">
            <label className="usp-label">DESCRIPTION</label>
            <textarea className="usp-textarea" value={form.description} onChange={e => set("description",e.target.value)} placeholder="Project description..." />
          </div>
          <div className="usp-field">
            <label className="usp-label">PROBLEM STATEMENT</label>
            <textarea className="usp-textarea" value={form.problem} onChange={e => set("problem",e.target.value)} placeholder="What problem does it solve?" />
          </div>
          <div className="usp-field">
            <label className="usp-label">FUNCTIONAL REQUIREMENTS</label>
            <textarea className="usp-textarea" value={form.functional} onChange={e => set("functional",e.target.value)} placeholder="Functional requirements..." />
          </div>
          <div className="usp-field">
            <label className="usp-label">NON-FUNCTIONAL REQUIREMENTS</label>
            <textarea className="usp-textarea" value={form.nonFunctional} onChange={e => set("nonFunctional",e.target.value)} placeholder="Non-functional requirements..." />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div className="usp-field">
              <label className="usp-label">TECH STACK</label>
              <input className="usp-input" value={form.stack} onChange={e => set("stack",e.target.value)} placeholder="e.g. MERN" />
            </div>
            <div className="usp-field">
              <label className="usp-label">PROJECT TYPE</label>
              <input className="usp-input" value={form.projectType} onChange={e => set("projectType",e.target.value)} placeholder="e.g. Full Stack" />
            </div>
          </div>
          <div className="usp-field">
            <label className="usp-label">STATUS</label>
            <select className="usp-select" value={form.status} onChange={e => set("status",e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {err && <div className="usp-err">⚠ {err}</div>}
          {success && <div className="usp-success">✓ Project updated! Redirecting…</div>}

          <button className="usp-btn" onClick={handleSave} disabled={saving || success}>
            {saving ? "SAVING…" : "UPDATE PROJECT ⚡"}
          </button>
        </div>
      </div>
    </>
  );
}