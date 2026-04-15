import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc } from "firebase/firestore";
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

function makeAvatar(idx) {
  const hues = [200,180,220,260,160,280,140,300,170,240,190,210,150,270,230,195];
  const h = hues[idx % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="hsl(${h},70%,12%)"/>
    <circle cx="32" cy="26" r="12" fill="hsl(${h},80%,55%)"/>
    <ellipse cx="32" cy="48" rx="16" ry="10" fill="hsl(${h},80%,45%)"/>
    <circle cx="32" cy="26" r="10" fill="hsl(${h},60%,75%)"/>
    <rect x="24" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
    <rect x="36" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
    <path d="M27 34 Q32 38 37 34" stroke="hsl(${h},30%,20%)" fill="none" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
function getAvatarSrc(avatarId) {
  if (!avatarId) return makeAvatar(0);
  const idx = parseInt(avatarId.replace(/\D/g,"")) - 1;
  return makeAvatar(isNaN(idx) ? 0 : idx);
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  :root{
    --bg:#020817;--navy:#071a3e;--blue:#0ea5e9;--cyan:#06d6f5;
    --accent:#00ffc8;--text:#e2f0ff;--muted:#7ba3c8;--err:#f87171;
    --font-h:'Orbitron',monospace;--font-b:'Rajdhani',sans-serif;--font-m:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--font-b)}
  .tq-wrap{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem 3rem;position:relative;overflow-x:hidden}
  .tq-grid{position:fixed;inset:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .tq-glow{position:fixed;width:600px;height:400px;background:radial-gradient(circle,rgba(0,255,200,0.06),transparent 70%);top:-100px;left:50%;transform:translateX(-50%);pointer-events:none}
  .tq-card{position:relative;z-index:1;background:rgba(4,15,36,0.92);border:1px solid rgba(0,255,200,0.15);border-radius:16px;width:100%;max-width:660px;padding:2rem 2.5rem;box-shadow:0 0 60px rgba(0,255,200,0.04)}
  @media(max-width:500px){.tq-card{padding:1.5rem 1.25rem}}
  .tq-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.75rem}
  .tq-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-family:var(--font-m);font-size:0.7rem;color:var(--muted);letter-spacing:0.08em;transition:color 0.2s;padding:0}
  .tq-back:hover{color:var(--accent)}
  .tq-badge{font-family:var(--font-m);font-size:0.65rem;color:var(--accent);background:rgba(0,255,200,0.07);border:1px solid rgba(0,255,200,0.2);border-radius:4px;padding:3px 10px;letter-spacing:0.1em}
  .tq-steps{display:flex;gap:6px;margin-bottom:1.75rem}
  .tq-step{flex:1;height:3px;border-radius:2px;background:rgba(0,255,200,0.1);transition:all 0.4s}
  .tq-step.done{background:var(--accent)}
  .tq-step.active{background:linear-gradient(90deg,var(--accent),var(--cyan))}
  .tq-sub{font-family:var(--font-m);font-size:0.68rem;color:var(--accent);letter-spacing:0.12em;margin-bottom:6px}
  .tq-h1{font-family:var(--font-h);font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;color:var(--text);margin-bottom:1.5rem}
  .tq-h1 span{color:rgba(0,255,200,0.3)}
  .tq-label{display:block;font-family:var(--font-m);font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;margin-bottom:6px}
  .tq-field{margin-bottom:1.1rem}
  .tq-input,.tq-select,.tq-textarea{width:100%;padding:0.7rem 1rem;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.18);border-radius:6px;color:var(--text);font-family:var(--font-b);font-size:0.95rem;outline:none;transition:all 0.2s}
  .tq-input:focus,.tq-select:focus,.tq-textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(0,255,200,0.07)}
  .tq-select option{background:#071a3e}
  .tq-textarea{min-height:90px;resize:vertical}
  .tq-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:480px){.tq-row{grid-template-columns:1fr}}
  .tq-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:1rem}
  .tq-tag{font-family:var(--font-m);font-size:0.65rem;padding:6px 12px;border-radius:4px;cursor:pointer;border:1px solid rgba(14,165,233,0.2);color:var(--muted);background:rgba(7,26,62,0.4);transition:all 0.2s;letter-spacing:0.06em}
  .tq-tag.on{border-color:var(--accent);color:var(--accent);background:rgba(0,255,200,0.07)}
  /* Member picker */
  .tq-members-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;max-height:320px;overflow-y:auto;padding-right:4px;margin-bottom:1rem}
  @media(max-width:400px){.tq-members-grid{grid-template-columns:1fr 1fr}}
  .tq-member-card{border:1px solid rgba(14,165,233,0.15);border-radius:10px;padding:0.85rem;cursor:pointer;transition:all 0.2s;background:rgba(7,26,62,0.35);position:relative}
  .tq-member-card:hover{border-color:rgba(0,255,200,0.3);background:rgba(0,255,200,0.04)}
  .tq-member-card.sel{border-color:var(--accent);background:rgba(0,255,200,0.07)}
  .tq-member-card.sel::after{content:'✓';position:absolute;top:6px;right:8px;font-size:0.7rem;color:var(--accent);font-weight:700}
  .tq-m-av{width:42px;height:42px;border-radius:50%;margin-bottom:7px;border:2px solid rgba(14,165,233,0.2)}
  .tq-m-name{font-family:var(--font-h);font-size:0.65rem;color:var(--text);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tq-m-country{font-family:var(--font-m);font-size:0.58rem;color:var(--muted);margin-bottom:5px}
  .tq-m-stack{display:flex;flex-wrap:wrap;gap:3px}
  .tq-m-st{font-family:var(--font-m);font-size:0.55rem;color:var(--accent);border:1px solid rgba(0,255,200,0.2);padding:2px 5px;border-radius:2px}
  .tq-sel-count{font-family:var(--font-m);font-size:0.68rem;color:var(--cyan);margin-bottom:0.75rem}
  .tq-loading{text-align:center;padding:1.5rem;font-family:var(--font-m);font-size:0.72rem;color:var(--muted)}
  .tq-nav{display:flex;gap:10px;margin-top:1.5rem}
  .tq-btn{flex:1;padding:0.75rem;border-radius:8px;cursor:pointer;font-family:var(--font-h);font-size:0.72rem;font-weight:700;letter-spacing:0.08em;border:none;transition:all 0.25s}
  .tq-btn-ghost{background:transparent;border:1px solid rgba(14,165,233,0.2);color:var(--muted)}
  .tq-btn-ghost:hover{border-color:var(--blue);color:var(--blue)}
  .tq-btn-primary{background:linear-gradient(135deg,#00c896,#06d6f5);color:#020817;box-shadow:0 0 20px rgba(0,255,200,0.15)}
  .tq-btn-primary:hover:not(:disabled){box-shadow:0 0 30px rgba(0,255,200,0.35);transform:translateY(-1px)}
  .tq-btn-primary:disabled{opacity:0.5;cursor:not-allowed}
  .tq-saving{display:flex;align-items:center;gap:10px;justify-content:center;padding:0.75rem;flex:1}
  .tq-ring{width:22px;height:22px;border-radius:50%;border:2px solid rgba(0,255,200,0.2);border-top-color:var(--accent);animation:tq-spin 0.7s linear infinite}
  @keyframes tq-spin{to{transform:rotate(360deg)}}
  .tq-err{font-family:var(--font-m);font-size:0.7rem;color:var(--err);margin-top:0.75rem;text-align:center}
  .tq-leader-box{background:rgba(0,255,200,0.05);border:1px solid rgba(0,255,200,0.2);border-radius:8px;padding:0.85rem;margin-bottom:1rem;display:flex;align-items:center;gap:10px}
  .tq-leader-txt{font-family:var(--font-m);font-size:0.68rem;color:var(--accent)}
`;

const DOMAIN_OPTS = ["Healthcare","Education","E-Commerce","Finance","Cybersecurity","Entertainment","Transport","AI/ML","IoT","Other"];
const SKILL_OPTS = ["React","Node.js","Python","Java","Flutter","ML/AI","UI/UX","DevOps","Blockchain","Other"];
const TECH_OPTS = ["MERN","MEAN","Java Full Stack","Python/Django","Flutter",".NET","React Native","Next.js","Other"];
const COLLAB_OPTS = ["Async (flexible)","Daily standups","Sprint-based","Casual/Hackathon"];
const TZ_OPTS = ["UTC-8 (PST)","UTC-5 (EST)","UTC+0 (GMT)","UTC+1 (CET)","UTC+3 (EAT)","UTC+5:30 (IST)","UTC+8 (SGT)","UTC+9 (JST)","UTC+10 (AEST)"];

export default function TeamQuestions() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [form, setForm] = useState({
    teamName:"", projectName:"", domain:"", description:"",
    skills:[], techStack:[], collabStyle:"", timezone:"",
    teamSize:3,
  });
  const [selectedMembers, setSelectedMembers] = useState([]);

  const STEPS = [
    { tag:"01", title:"Team Info", sub:"team_project.init()" },
    { tag:"02", title:"Project Details", sub:"team_project.describe()" },
    { tag:"03", title:"Skills & Stack", sub:"team_project.configure()" },
    { tag:"04", title:"Collaboration", sub:"team_project.sync()" },
    { tag:"05", title:"Add Members", sub:"team_project.invite()" },
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setUserProfile(snap.data());
    });
    return unsub;
  }, []);

  // Load users for member picking on step 4
  useEffect(() => {
    if (step === 4) {
      setLoadingUsers(true);
      getDocs(collection(db, "users")).then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u2 => u2.id !== user?.uid);
        setAllUsers(list);
        setLoadingUsers(false);
      }).catch(() => setLoadingUsers(false));
    }
  }, [step, user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k, v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]
  }));
  const toggleMember = (uid) => setSelectedMembers(prev =>
    prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
  );

  const handleSave = async () => {
    if (!form.teamName.trim() || !form.projectName.trim()) { setErr("Team name and project name are required."); return; }
    setSaving(true); setErr("");
    try {
      const projRef = doc(collection(db, "teamProjects"));
      const pid = projRef.id;
      const teamData = {
        ...form,
        projectId: pid,
        createdBy: user.uid,
        teamLeader: user.uid,
        teamLeaderName: userProfile?.fullName || user.displayName || "Leader",
        members: [user.uid],
        pendingMembers: selectedMembers,
        createdAt: new Date().toISOString(),
        status: "active",
      };
      await setDoc(projRef, teamData);

      // Send join requests as notifications to selected members
      for (const uid of selectedMembers) {
        const notifRef = doc(collection(db, "notifications"));
        await setDoc(notifRef, {
          toUid: uid,
          fromUid: user.uid,
          fromName: userProfile?.fullName || user.displayName || "A student",
          type: "team_invite",
          projectId: pid,
          projectName: form.projectName,
          teamName: form.teamName,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      nav(`/team-dashboard/${pid}`);
    } catch (e) {
      setErr("Failed to save. " + e.message);
      setSaving(false);
    }
  };

  const stackArr = Array.isArray(form.techStack) ? form.techStack : [];
  const skillsArr = Array.isArray(form.skills) ? form.skills : [];

  return (
    <>
      <style>{css}</style>
      <div className="tq-wrap">
        <div className="tq-grid" />
        <div className="tq-glow" />
        <div className="tq-card">
          <div className="tq-topbar">
            <button className="tq-back" onClick={() => step > 0 ? setStep(s => s-1) : nav("/dashboard")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              back
            </button>
            <span className="tq-badge">TEAM_MODE</span>
          </div>

          <div className="tq-steps">
            {STEPS.map((_, i) => (
              <div key={i} className={`tq-step ${i < step ? "done" : i === step ? "active" : ""}`} />
            ))}
          </div>

          <div className="tq-sub">{STEPS[step].sub}</div>
          <h1 className="tq-h1"><span>{STEPS[step].tag}_</span>{STEPS[step].title}</h1>

          {/* STEP 0 — Team Info */}
          {step === 0 && (
            <>
              <div className="tq-field">
                <label className="tq-label">TEAM NAME *</label>
                <input className="tq-input" placeholder="e.g. NightOwl Labs" value={form.teamName} onChange={e => set("teamName",e.target.value)} />
              </div>
              <div className="tq-field">
                <label className="tq-label">PROJECT NAME *</label>
                <input className="tq-input" placeholder="e.g. DevSync" value={form.projectName} onChange={e => set("projectName",e.target.value)} />
              </div>
              <div className="tq-field">
                <label className="tq-label">DOMAIN</label>
                <select className="tq-select" value={form.domain} onChange={e => set("domain",e.target.value)}>
                  <option value="">Select domain...</option>
                  {DOMAIN_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {/* Team leader auto-set */}
              {userProfile && (
                <div className="tq-leader-box">
                  <img src={getAvatarSrc(userProfile.avatar)} alt="you" style={{width:30,height:30,borderRadius:"50%"}} />
                  <div>
                    <div className="tq-leader-txt">👑 TEAM LEADER (default: you)</div>
                    <div style={{fontFamily:"var(--font-h)",fontSize:"0.68rem",color:"var(--text)",marginTop:2}}>{userProfile.fullName || user?.displayName}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 1 — Project Details */}
          {step === 1 && (
            <>
              <div className="tq-field">
                <label className="tq-label">PROJECT DESCRIPTION *</label>
                <textarea className="tq-textarea" placeholder="What are you building? What problem does it solve?" value={form.description} onChange={e => set("description",e.target.value)} />
              </div>
              <div className="tq-field">
                <label className="tq-label">TEAM SIZE</label>
                <div style={{textAlign:"center",padding:"0.5rem 0"}}>
                  <div style={{fontFamily:"var(--font-h)",fontSize:"2.5rem",fontWeight:900,color:"var(--accent)",lineHeight:1}}>{form.teamSize}</div>
                  <div style={{fontFamily:"var(--font-m)",fontSize:"0.68rem",color:"var(--muted)",marginBottom:"0.75rem"}}>members</div>
                  <input type="range" min="2" max="10" value={form.teamSize} onChange={e => set("teamSize",Number(e.target.value))}
                    style={{width:"100%",accentColor:"var(--accent)"}} />
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-m)",fontSize:"0.62rem",color:"var(--muted)",marginTop:4}}>
                    <span>2</span><span>10</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — Skills & Stack */}
          {step === 2 && (
            <>
              <div className="tq-field">
                <label className="tq-label">SKILLS NEEDED ({skillsArr.length} selected)</label>
                <div className="tq-tags">
                  {SKILL_OPTS.map(s => (
                    <div key={s} className={`tq-tag ${skillsArr.includes(s)?"on":""}`} onClick={() => toggle("skills",s)}>{s}</div>
                  ))}
                </div>
              </div>
              <div className="tq-field">
                <label className="tq-label">TECH STACK ({stackArr.length} selected)</label>
                <div className="tq-tags">
                  {TECH_OPTS.map(t => (
                    <div key={t} className={`tq-tag ${stackArr.includes(t)?"on":""}`} onClick={() => toggle("techStack",t)}>{t}</div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* STEP 3 — Collaboration */}
          {step === 3 && (
            <>
              <div className="tq-field">
                <label className="tq-label">PRIMARY TIMEZONE</label>
                <select className="tq-select" value={form.timezone} onChange={e => set("timezone",e.target.value)}>
                  <option value="">Select timezone...</option>
                  {TZ_OPTS.map(tz => <option key={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="tq-field">
                <label className="tq-label">COLLABORATION STYLE</label>
                <div className="tq-tags">
                  {COLLAB_OPTS.map(c => (
                    <div key={c} className={`tq-tag ${form.collabStyle===c?"on":""}`} onClick={() => set("collabStyle",c)}>{c}</div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* STEP 4 — Add Members */}
          {step === 4 && (
            <>
              <div className="tq-sel-count">{selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected — requests will be sent</div>
              {loadingUsers ? (
                <div className="tq-loading">
                  <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid rgba(0,255,200,0.2)",borderTopColor:"var(--accent)",animation:"tq-spin 0.7s linear infinite",margin:"0 auto 8px"}} />
                  Loading members…
                </div>
              ) : (
                <div className="tq-members-grid">
                  {allUsers.map(u2 => {
                    const isSel = selectedMembers.includes(u2.id);
                    const techList = u2.techStack ? (Array.isArray(u2.techStack) ? u2.techStack : [u2.techStack]) : (u2.domain ? [u2.domain] : []);
                    return (
                      <div key={u2.id} className={`tq-member-card ${isSel?"sel":""}`} onClick={() => toggleMember(u2.id)}>
                        <img src={getAvatarSrc(u2.avatar)} alt={u2.fullName} className="tq-m-av" />
                        <div className="tq-m-name">{u2.fullName || "Student"}</div>
                        <div className="tq-m-country">🌍 {u2.country || "Unknown"}</div>
                        <div className="tq-m-stack">
                          {techList.slice(0,3).map(t => <span key={t} className="tq-m-st">{t}</span>)}
                        </div>
                      </div>
                    );
                  })}
                  {allUsers.length === 0 && (
                    <div style={{gridColumn:"1/-1",fontFamily:"var(--font-m)",fontSize:"0.72rem",color:"var(--muted)",textAlign:"center",padding:"1.5rem"}}>
                      No other members found in database.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {err && <div className="tq-err">⚠ {err}</div>}

          <div className="tq-nav">
            {step > 0 && (
              <button className="tq-btn tq-btn-ghost" onClick={() => setStep(s => s-1)}>← prev()</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="tq-btn tq-btn-primary" onClick={() => setStep(s => s+1)}>next() →</button>
            ) : (
              saving ? (
                <div className="tq-saving">
                  <div className="tq-ring" />
                  <span style={{fontFamily:"var(--font-m)",fontSize:"0.72rem",color:"var(--muted)"}}>CREATING TEAM…</span>
                </div>
              ) : (
                <button className="tq-btn tq-btn-primary" onClick={handleSave}>
                  launch_team() 🚀
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}