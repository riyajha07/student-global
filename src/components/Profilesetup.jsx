import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
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

// Generate avatar SVG data URLs (16 unique pixel-art-style avatars)
function makeAvatar(seed, idx) {
  const hues = [200, 180, 220, 260, 160, 280, 140, 300, 170, 240, 190, 210, 150, 270, 230, 195];
  const h = hues[idx % hues.length];
  const shapes = [
    `<circle cx="32" cy="32" r="30" fill="hsl(${h},70%,12%)"/>
     <circle cx="32" cy="26" r="12" fill="hsl(${h},80%,55%)"/>
     <ellipse cx="32" cy="48" rx="16" ry="10" fill="hsl(${h},80%,45%)"/>
     <circle cx="32" cy="26" r="10" fill="hsl(${h},60%,75%)"/>
     <rect x="24" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
     <rect x="36" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
     <path d="M27 34 Q32 38 37 34" stroke="hsl(${h},30%,20%)" fill="none" stroke-width="1.5" stroke-linecap="round"/>`,

    `<rect width="64" height="64" rx="4" fill="hsl(${h},70%,10%)"/>
     <circle cx="32" cy="24" r="11" fill="hsl(${h},75%,60%)"/>
     <rect x="16" y="40" width="32" height="16" rx="8" fill="hsl(${h},65%,45%)"/>
     <circle cx="32" cy="24" r="9" fill="hsl(${h},55%,78%)"/>
     <rect x="24" y="26" width="5" height="4" rx="1" fill="hsl(${h},30%,25%)"/>
     <rect x="35" y="26" width="5" height="4" rx="1" fill="hsl(${h},30%,25%)"/>
     <path d="M26 33 Q32 37 38 33" stroke="hsl(${h},30%,25%)" fill="none" stroke-width="1.5" stroke-linecap="round"/>`,

    `<polygon points="32,2 62,56 2,56" fill="hsl(${h},70%,12%)"/>
     <circle cx="32" cy="26" r="11" fill="hsl(${h},80%,55%)"/>
     <circle cx="32" cy="26" r="9" fill="hsl(${h},55%,80%)"/>
     <rect x="24" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
     <rect x="36" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/>
     <path d="M28 34 Q32 37 36 34" stroke="hsl(${h},30%,20%)" fill="none" stroke-width="1.2"/>`,
  ];
  const shape = shapes[idx % shapes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${shape}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const AVATARS = Array.from({ length: 16 }, (_, i) => ({
  id: `avatar${i + 1}.png`,
  src: makeAvatar(i, i),
  label: `Avatar ${i + 1}`,
}));

const STEPS = [
  { id: 1, title: "BASIC INFO", hint: "Tell us about yourself" },
  { id: 2, title: "EDUCATION", hint: "Your academic background" },
  { id: 3, title: "EXPERTISE", hint: "Domain & experience" },
  { id: 4, title: "PROFILE", hint: "Bio & social links" },
  { id: 5, title: "AVATAR", hint: "Choose your identity" },
];

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const COUNTRIES = ["India","United States","United Kingdom","Canada","Australia","Germany","Singapore","UAE","Brazil","Others"];
const EDUCATION_LEVELS = ["High School","Diploma","Bachelor's","Master's","PhD","Bootcamp / Self-taught"];
const COURSES = ["Computer Science","Information Technology","Electronics","Mechanical Engineering","Civil Engineering","Electrical Engineering","Data Science","Cybersecurity","AI / ML","Robotics","Other"];
const DOMAINS = ["Web Development","Mobile Apps","AI / ML","Cloud & DevOps","Cybersecurity","Data Engineering","Blockchain","Embedded Systems","Game Development","UI/UX Design","Other"];
const ROLES = ["Student","Intern","Junior Developer","Freelancer","Researcher","Teaching Assistant","Hobbyist / Self-learner"];
const EXPERIENCE = ["Beginner (< 6 months)","Intermediate (6–18 months)","Advanced (1.5–3 years)","Expert (3+ years)"];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  :root{
    --c-bg:#020817;--c-bg2:#040f24;--c-navy:#071a3e;
    --c-blue:#0ea5e9;--c-cyan:#06d6f5;--c-glow:#0ea5e940;
    --c-text:#e2f0ff;--c-muted:#7ba3c8;--c-accent:#00ffc8;
    --c-err:#f87171;
    --font-head:'Orbitron',monospace;--font-body:'Rajdhani',sans-serif;--font-mono:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);min-height:100vh;overflow-x:hidden}
  .ps-bg{position:fixed;inset:0;z-index:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;}
  .ps-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
  .ps-wrap{position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;}

  .ps-shell{width:100%;max-width:540px}

  /* logo */
  .ps-logo{font-family:var(--font-head);font-size:0.85rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.15em;text-shadow:0 0 20px var(--c-cyan);text-align:center;margin-bottom:1.5rem}

  /* step rail */
  .ps-rail{display:flex;gap:4px;margin-bottom:1rem}
  .ps-rail-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.08);transition:background 0.4s}
  .ps-rail-seg.done{background:var(--c-accent)}
  .ps-rail-seg.active{background:var(--c-cyan);box-shadow:0 0 8px var(--c-cyan)}

  /* step meta */
  .ps-step-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
  .ps-step-label{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-muted)}
  .ps-step-name{font-family:var(--font-head);font-size:0.75rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.1em}

  /* card */
  .ps-card{
    background:rgba(4,15,36,0.88);
    border:1px solid rgba(6,214,245,0.18);
    border-radius:12px;padding:2rem;
    backdrop-filter:blur(20px);
    box-shadow:0 0 50px rgba(6,214,245,0.05);
    position:relative;overflow:hidden;
    animation:cardIn 0.4s ease both;
  }
  @keyframes cardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .ps-card::before{content:'';position:absolute;left:0;right:0;height:1px;top:0;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:0.3}
  .ps-scan{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  .ps-scan::after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:0.15;animation:scan 6s linear infinite;}
  @keyframes scan{0%{top:-1px}100%{top:100%}}

  .ps-card-title{font-family:var(--font-head);font-size:1.15rem;font-weight:700;color:var(--c-text);letter-spacing:0.05em;margin-bottom:0.35rem}
  .ps-card-hint{font-size:0.88rem;color:var(--c-muted);margin-bottom:1.75rem}

  /* form */
  .ps-group{margin-bottom:1.1rem}
  .ps-label{display:block;font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--c-muted);letter-spacing:0.08em;margin-bottom:0.35rem}
  .ps-input,.ps-select,.ps-textarea{
    width:100%;padding:0.72rem 1rem;
    background:rgba(7,26,62,0.6);
    border:1px solid rgba(14,165,233,0.2);
    border-radius:6px;color:var(--c-text);
    font-family:var(--font-body);font-size:1rem;
    outline:none;transition:all 0.2s;
  }
  .ps-select{cursor:pointer}
  .ps-select option{background:#040f24}
  .ps-textarea{resize:vertical;min-height:90px}
  .ps-input:focus,.ps-select:focus,.ps-textarea:focus{border-color:var(--c-cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.1)}
  .ps-input.err,.ps-select.err{border-color:var(--c-err)!important}
  .ps-err{font-family:var(--font-mono);font-size:0.7rem;color:var(--c-err);margin-top:0.3rem}
  .ps-alert{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:0.7rem 1rem;font-size:0.83rem;color:var(--c-err);margin-bottom:1rem;font-family:var(--font-mono);}

  /* nav */
  .ps-nav{display:flex;gap:0.75rem;margin-top:1.75rem}
  .ps-btn-back{
    padding:0.75rem 1.25rem;border-radius:6px;
    background:transparent;border:1px solid rgba(14,165,233,0.25);
    color:var(--c-muted);font-family:var(--font-body);font-size:0.95rem;font-weight:600;
    cursor:pointer;transition:all 0.2s;letter-spacing:0.04em;
  }
  .ps-btn-back:hover{border-color:var(--c-blue);color:var(--c-blue)}
  .ps-btn-next{
    flex:1;padding:0.8rem;border:none;border-radius:6px;
    background:linear-gradient(135deg,#0ea5e9,#06d6f5);
    color:#020817;font-family:var(--font-head);font-size:0.82rem;
    font-weight:700;letter-spacing:0.1em;cursor:pointer;transition:all 0.25s;
  }
  .ps-btn-next:hover:not(:disabled){box-shadow:0 0 25px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .ps-btn-next:disabled{opacity:0.5;cursor:not-allowed}

  /* AVATAR GRID */
  .av-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:0.5rem}
  @media(max-width:400px){.av-grid{grid-template-columns:repeat(3,1fr)}}
  .av-item{
    aspect-ratio:1;border-radius:8px;overflow:hidden;
    border:2px solid rgba(14,165,233,0.15);
    cursor:pointer;transition:all 0.2s;
    background:rgba(7,26,62,0.5);
    display:flex;align-items:center;justify-content:center;
    position:relative;
  }
  .av-item:hover{border-color:rgba(6,214,245,0.5);transform:scale(1.05)}
  .av-item.selected{border-color:var(--c-cyan);box-shadow:0 0 16px rgba(6,214,245,0.5)}
  .av-item.selected::after{content:'';position:absolute;inset:0;background:rgba(6,214,245,0.1)}
  .av-img{width:80%;height:80%;object-fit:contain}
  .av-check{
    position:absolute;top:4px;right:4px;
    width:16px;height:16px;border-radius:50%;
    background:var(--c-cyan);display:flex;align-items:center;justify-content:center;
    font-size:10px;color:#020817;font-weight:700;
    opacity:0;transition:opacity 0.2s;
  }
  .av-item.selected .av-check{opacity:1}
  .av-hint{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-muted);text-align:center}

  /* loading */
  .ps-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem}
  .ps-spin{width:36px;height:36px;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--c-cyan);border-radius:50%;animation:spin 0.7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .ps-spin-text{font-family:var(--font-mono);font-size:0.8rem;color:var(--c-muted)}

  @media(max-width:500px){.ps-card{padding:1.5rem 1.1rem}}
`;

export default function ProfileSetup() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [form, setForm] = useState({
    fullName: "", gender: "", country: "",
    educationLevel: "", course: "", college: "",
    domain: "", role: "", experience: "",
    bio: "", linkedin: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      setForm(f => ({ ...f, fullName: u.displayName || "" }));
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pts = Array.from({ length: 35 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() + 0.2, dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2, a: Math.random() * 0.3 + 0.1 }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(6,214,245,${p.a})`; ctx.fill(); p.x += p.dx; p.y += p.dy; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0; });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const hc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const REQUIRED = {
    1: ["fullName", "gender", "country"],
    2: ["educationLevel", "course", "college"],
    3: ["domain", "role", "experience"],
    4: [],
    5: [],
  };

  const validateStep = () => {
    const errs = {};
    (REQUIRED[step] || []).forEach(k => { if (!form[k]) errs[k] = "Required"; });
    if (step === 5 && !selectedAvatar) errs.avatar = "Please choose an avatar";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 5) setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true); setError("");
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...form, avatar: selectedAvatar, uid: user.uid,
        email: user.email, profileComplete: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      nav("/dashboard");
    } catch (e) { setError("Failed to save profile. Please try again."); }
    finally { setSaving(false); }
  };

  const fe = k => fieldErr[k] ? " err" : "";

  if (authLoading) return (
    <>
      <style>{css}</style>
      <div className="ps-loading">
        <div className="ps-spin" />
        <div className="ps-spin-text">AUTHENTICATING…</div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="ps-bg" />
      <canvas ref={canvasRef} className="ps-canvas" />

      <div className="ps-wrap">
        <div className="ps-shell">
          <div className="ps-logo">SCH·HUB — PROFILE SETUP</div>

          {/* Rail */}
          <div className="ps-rail">
            {STEPS.map(s => (
              <div key={s.id} className={`ps-rail-seg${s.id < step ? " done" : s.id === step ? " active" : ""}`} />
            ))}
          </div>

          {/* Step meta */}
          <div className="ps-step-meta">
            <span className="ps-step-label">STEP {step} OF {STEPS.length}</span>
            <span className="ps-step-name">{STEPS[step - 1].title}</span>
          </div>

          {/* Card */}
          <div className="ps-card" key={step}>
            <div className="ps-scan" />
            <div className="ps-card-title">{STEPS[step - 1].title}</div>
            <div className="ps-card-hint">{STEPS[step - 1].hint}</div>

            {error && <div className="ps-alert">⚠ {error}</div>}

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="ps-group">
                  <label className="ps-label">FULL NAME *</label>
                  <input name="fullName" className={`ps-input${fe("fullName")}`} placeholder="Your full name" value={form.fullName} onChange={hc} />
                  {fieldErr.fullName && <div className="ps-err">▲ {fieldErr.fullName}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">GENDER *</label>
                  <select name="gender" className={`ps-select${fe("gender")}`} value={form.gender} onChange={hc}>
                    <option value="">Select gender</option>
                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                  {fieldErr.gender && <div className="ps-err">▲ {fieldErr.gender}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">COUNTRY *</label>
                  <select name="country" className={`ps-select${fe("country")}`} value={form.country} onChange={hc}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {fieldErr.country && <div className="ps-err">▲ {fieldErr.country}</div>}
                </div>
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <>
                <div className="ps-group">
                  <label className="ps-label">EDUCATION LEVEL *</label>
                  <select name="educationLevel" className={`ps-select${fe("educationLevel")}`} value={form.educationLevel} onChange={hc}>
                    <option value="">Select level</option>
                    {EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}
                  </select>
                  {fieldErr.educationLevel && <div className="ps-err">▲ {fieldErr.educationLevel}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">COURSE / DEGREE *</label>
                  <select name="course" className={`ps-select${fe("course")}`} value={form.course} onChange={hc}>
                    <option value="">Select course</option>
                    {COURSES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {fieldErr.course && <div className="ps-err">▲ {fieldErr.course}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">COLLEGE / UNIVERSITY *</label>
                  <input name="college" className={`ps-input${fe("college")}`} placeholder="e.g. IIT Bombay / MIT" value={form.college} onChange={hc} />
                  {fieldErr.college && <div className="ps-err">▲ {fieldErr.college}</div>}
                </div>
              </>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <>
                <div className="ps-group">
                  <label className="ps-label">PRIMARY DOMAIN *</label>
                  <select name="domain" className={`ps-select${fe("domain")}`} value={form.domain} onChange={hc}>
                    <option value="">Select domain</option>
                    {DOMAINS.map(d => <option key={d}>{d}</option>)}
                  </select>
                  {fieldErr.domain && <div className="ps-err">▲ {fieldErr.domain}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">CURRENT ROLE *</label>
                  <select name="role" className={`ps-select${fe("role")}`} value={form.role} onChange={hc}>
                    <option value="">Select role</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                  {fieldErr.role && <div className="ps-err">▲ {fieldErr.role}</div>}
                </div>
                <div className="ps-group">
                  <label className="ps-label">EXPERIENCE LEVEL *</label>
                  <select name="experience" className={`ps-select${fe("experience")}`} value={form.experience} onChange={hc}>
                    <option value="">Select level</option>
                    {EXPERIENCE.map(ex => <option key={ex}>{ex}</option>)}
                  </select>
                  {fieldErr.experience && <div className="ps-err">▲ {fieldErr.experience}</div>}
                </div>
              </>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <>
                <div className="ps-group">
                  <label className="ps-label">BIO <span style={{ color: "var(--c-muted)", fontWeight: 400 }}>(optional)</span></label>
                  <textarea name="bio" className="ps-textarea"
                    placeholder="A short intro — what you build, what you're looking for…"
                    value={form.bio} onChange={hc} />
                </div>
                <div className="ps-group">
                  <label className="ps-label">LINKEDIN URL <span style={{ color: "var(--c-muted)", fontWeight: 400 }}>(optional)</span></label>
                  <input name="linkedin" className="ps-input" placeholder="https://linkedin.com/in/yourname" value={form.linkedin} onChange={hc} />
                </div>
              </>
            )}

            {/* STEP 5 — AVATAR */}
            {step === 5 && (
              <>
                <div className="av-grid">
                  {AVATARS.map(av => (
                    <div
                      key={av.id}
                      className={`av-item${selectedAvatar === av.id ? " selected" : ""}`}
                      onClick={() => { setSelectedAvatar(av.id); setFieldErr(p => ({ ...p, avatar: "" })); }}
                    >
                      <img src={av.src} alt={av.label} className="av-img" />
                      <div className="av-check">✓</div>
                    </div>
                  ))}
                </div>
                {fieldErr.avatar && <div className="ps-err" style={{ textAlign: "center", marginBottom: "0.5rem" }}>▲ {fieldErr.avatar}</div>}
                <div className="av-hint">{selectedAvatar ? `Selected: ${selectedAvatar}` : "Tap an avatar to select"}</div>
              </>
            )}

            {/* Navigation */}
            <div className="ps-nav">
              {step > 1 && <button className="ps-btn-back" onClick={() => setStep(s => s - 1)}>← BACK</button>}
              {step < 5 ? (
                <button className="ps-btn-next" onClick={handleNext}>CONTINUE →</button>
              ) : (
                <button className="ps-btn-next" onClick={handleSubmit} disabled={saving || !selectedAvatar}>
                  {saving ? "SAVING…" : "COMPLETE PROFILE →"}
                </button>
              )}
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "rgba(123,163,200,0.4)", marginTop: "1rem", fontFamily: "var(--font-mono)" }}>
            Your information is private and only shown to matched collaborators.
          </p>
        </div>
      </div>
    </>
  );
}