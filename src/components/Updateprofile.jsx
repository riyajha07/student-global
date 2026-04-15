import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  const idx = parseInt(avatarId.replace(/\D/g, "")) - 1;
  return makeAvatar(isNaN(idx) ? 0 : idx);
}
const AVATARS = Array.from({ length: 16 }, (_, i) => ({ id: `avatar${i+1}.png`, src: makeAvatar(i) }));

const GENDERS = ["Male","Female","Non-binary","Prefer not to say"];
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
    --c-err:#f87171;--c-ok:#4ade80;
    --font-head:'Orbitron',monospace;--font-body:'Rajdhani',sans-serif;--font-mono:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);min-height:100vh;overflow-x:hidden}
  .up-bg{position:fixed;inset:0;z-index:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;}
  .up-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
  .up-wrap{position:relative;z-index:1;min-height:100vh;padding:2rem 1.5rem 3rem;max-width:680px;margin:0 auto}

  /* back */
  .up-back{display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.75rem;color:var(--c-muted);cursor:pointer;background:none;border:none;margin-bottom:1.75rem;transition:color 0.2s;margin-top:1rem}
  .up-back:hover{color:var(--c-cyan)}

  /* logo/title */
  .up-logo{font-family:var(--font-head);font-size:0.85rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.15em;text-shadow:0 0 16px var(--c-cyan);margin-bottom:0.3rem}
  .up-title{font-family:var(--font-head);font-size:1.5rem;font-weight:700;color:var(--c-text);margin-bottom:0.3rem}
  .up-sub{color:var(--c-muted);font-size:0.9rem;margin-bottom:2rem}

  /* avatar section */
  .up-av-section{
    background:rgba(4,15,36,0.8);border:1px solid rgba(6,214,245,0.15);
    border-radius:10px;padding:1.5rem;margin-bottom:1.5rem;
    display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;
  }
  .up-av-img{width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid rgba(6,214,245,0.35);flex-shrink:0}
  .up-av-img img{width:100%;height:100%;object-fit:cover}
  .up-av-info{flex:1}
  .up-av-name{font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--c-text);margin-bottom:0.15rem}
  .up-av-email{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-muted)}
  .up-av-change-btn{
    font-family:var(--font-mono);font-size:0.7rem;padding:0.35rem 0.85rem;border-radius:4px;
    background:transparent;border:1px solid rgba(6,214,245,0.25);color:var(--c-cyan);
    cursor:pointer;transition:all 0.2s;letter-spacing:0.05em;margin-top:0.5rem;
  }
  .up-av-change-btn:hover{background:rgba(6,214,245,0.1)}

  /* avatar picker */
  .up-av-picker{margin-bottom:1.5rem}
  .up-av-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:0.5rem;margin-top:0.75rem}
  @media(max-width:480px){.up-av-grid{grid-template-columns:repeat(5,1fr)}}
  .up-av-item{aspect-ratio:1;border-radius:6px;overflow:hidden;border:2px solid rgba(14,165,233,0.12);cursor:pointer;transition:all 0.2s;background:rgba(7,26,62,0.5);display:flex;align-items:center;justify-content:center;position:relative}
  .up-av-item:hover{border-color:rgba(6,214,245,0.4);transform:scale(1.06)}
  .up-av-item.selected{border-color:var(--c-cyan);box-shadow:0 0 12px rgba(6,214,245,0.4)}
  .up-av-item img{width:80%;height:80%;object-fit:contain}

  /* form card */
  .up-card{
    background:rgba(4,15,36,0.8);border:1px solid rgba(6,214,245,0.15);
    border-radius:10px;padding:1.75rem;margin-bottom:1.5rem;
    position:relative;overflow:hidden;
  }
  .up-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:0.3}
  .up-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
  .up-card-title{font-family:var(--font-head);font-size:0.82rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.1em}
  .up-edit-btn{
    display:flex;align-items:center;gap:0.35rem;
    font-family:var(--font-mono);font-size:0.68rem;
    padding:0.35rem 0.8rem;border-radius:4px;cursor:pointer;
    background:transparent;border:1px solid rgba(14,165,233,0.2);
    color:var(--c-muted);transition:all 0.2s;letter-spacing:0.05em;
  }
  .up-edit-btn:hover{border-color:var(--c-blue);color:var(--c-blue)}
  .up-edit-btn.active{border-color:var(--c-cyan);color:var(--c-cyan);background:rgba(6,214,245,0.08)}

  /* fields */
  .up-fields{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  @media(max-width:500px){.up-fields{grid-template-columns:1fr}}
  .up-field-group{position:relative}
  .up-field-label{font-family:var(--font-mono);font-size:0.68rem;color:var(--c-muted);letter-spacing:0.08em;margin-bottom:0.3rem;display:block}
  .up-field-value{font-size:0.95rem;color:var(--c-text);font-weight:500;padding:0.1rem 0;min-height:1.8rem}
  .up-input,.up-select,.up-textarea{
    width:100%;padding:0.65rem 0.85rem;
    background:rgba(7,26,62,0.7);
    border:1px solid rgba(14,165,233,0.2);
    border-radius:5px;color:var(--c-text);
    font-family:var(--font-body);font-size:0.95rem;
    outline:none;transition:all 0.2s;
  }
  .up-select option{background:#040f24}
  .up-input:focus,.up-select:focus,.up-textarea:focus{border-color:var(--c-cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.08)}
  .up-textarea{resize:vertical;min-height:80px;grid-column:1/-1}
  .up-full{grid-column:1/-1}

  /* toast */
  .up-toast{
    position:fixed;top:1.5rem;right:1.5rem;z-index:300;
    background:rgba(4,15,36,0.97);border:1px solid var(--c-accent);
    border-radius:8px;padding:0.75rem 1.25rem;
    font-family:var(--font-mono);font-size:0.8rem;
    color:var(--c-accent);
    box-shadow:0 0 20px rgba(0,255,200,0.2);
    animation:toastIn 0.3s ease;
  }
  @keyframes toastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}

  /* save button */
  .up-save-btn{
    width:100%;padding:0.85rem;border:none;border-radius:8px;
    background:linear-gradient(135deg,#0ea5e9,#06d6f5);
    color:#020817;font-family:var(--font-head);font-size:0.85rem;
    font-weight:700;letter-spacing:0.1em;cursor:pointer;transition:all 0.25s;
  }
  .up-save-btn:hover:not(:disabled){box-shadow:0 0 25px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .up-save-btn:disabled{opacity:0.5;cursor:not-allowed}

  /* loading */
  .up-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem}
  .up-spin{width:34px;height:34px;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--c-cyan);border-radius:50%;animation:spin 0.7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  .pen-icon{width:13px;height:13px}
`;

const PenIcon = () => (
  <svg className="pen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const SECTION_FIELDS = {
  "BASIC INFO": ["fullName","gender","country"],
  "EDUCATION": ["educationLevel","course","college"],
  "EXPERTISE": ["domain","role","experience"],
  "PROFILE": ["bio","linkedin"],
};

const FIELD_META = {
  fullName: { label: "Full Name", type: "input", placeholder: "Your full name" },
  gender: { label: "Gender", type: "select", options: GENDERS },
  country: { label: "Country", type: "select", options: COUNTRIES },
  educationLevel: { label: "Education Level", type: "select", options: EDUCATION_LEVELS },
  course: { label: "Course / Degree", type: "select", options: COURSES },
  college: { label: "College / University", type: "input", placeholder: "Your institution" },
  domain: { label: "Primary Domain", type: "select", options: DOMAINS },
  role: { label: "Current Role", type: "select", options: ROLES },
  experience: { label: "Experience Level", type: "select", options: EXPERIENCE },
  bio: { label: "Bio", type: "textarea", placeholder: "Short intro…", full: true },
  linkedin: { label: "LinkedIn URL", type: "input", placeholder: "https://linkedin.com/in/…", full: true },
};

export default function UpdateProfile() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [editSections, setEditSections] = useState({});
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm(d);
        setSelectedAvatar(d.avatar || "");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pts = Array.from({ length: 35 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() + 0.2, dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2, a: Math.random() * 0.25 + 0.1 }));
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

  const toggleSection = sec => setEditSections(s => ({ ...s, [sec]: !s[sec] }));

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...form,
        avatar: selectedAvatar || form.avatar || "",
        updatedAt: serverTimestamp(),
        profileComplete: true,
      }, { merge: true });
      setEditSections({});
      setShowAvatarPicker(false);
      showToast("✓ Profile updated successfully!");
    } catch (e) {
      showToast("⚠ Save failed. Please try again.");
    } finally { setSaving(false); }
  };

  const avatarSrc = getAvatarSrc(selectedAvatar || form.avatar);
  const anyEditing = Object.values(editSections).some(Boolean) || showAvatarPicker;

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="up-loading"><div className="up-spin" /><div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--c-muted)" }}>LOADING PROFILE…</div></div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="up-bg" />
      <canvas ref={canvasRef} className="up-canvas" />
      {toast && <div className="up-toast">{toast}</div>}

      <div className="up-wrap">
        <button className="up-back" onClick={() => nav("/dashboard")}>← BACK TO DASHBOARD</button>

        <div className="up-logo">SCH·HUB</div>
        <div className="up-title">YOUR PROFILE</div>
        <div className="up-sub">Click the pen icon on any section to edit. Save when done.</div>

        {/* Avatar section */}
        <div className="up-av-section">
          <div className="up-av-img"><img src={avatarSrc} alt="avatar" /></div>
          <div className="up-av-info">
            <div className="up-av-name">{form.fullName || user?.displayName || "Student"}</div>
            <div className="up-av-email">{user?.email}</div>
            <button className="up-av-change-btn" onClick={() => setShowAvatarPicker(v => !v)}>
              {showAvatarPicker ? "CLOSE PICKER" : "CHANGE AVATAR"}
            </button>
          </div>
        </div>

        {/* Avatar picker */}
        {showAvatarPicker && (
          <div className="up-av-picker">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--c-muted)", marginBottom: "0.5rem" }}>SELECT YOUR AVATAR</div>
            <div className="up-av-grid">
              {AVATARS.map(av => (
                <div key={av.id}
                  className={`up-av-item${(selectedAvatar || form.avatar) === av.id ? " selected" : ""}`}
                  onClick={() => setSelectedAvatar(av.id)}
                >
                  <img src={av.src} alt={av.id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form sections */}
        {Object.entries(SECTION_FIELDS).map(([section, fields]) => (
          <div key={section} className="up-card">
            <div className="up-card-header">
              <div className="up-card-title">// {section}</div>
              <button className={`up-edit-btn${editSections[section] ? " active" : ""}`} onClick={() => toggleSection(section)}>
                <PenIcon />
                {editSections[section] ? "DONE" : "EDIT"}
              </button>
            </div>
            <div className="up-fields">
              {fields.map(key => {
                const meta = FIELD_META[key];
                const isEditing = editSections[section];
                return (
                  <div key={key} className={`up-field-group${meta.full ? " up-full" : ""}`}>
                    <label className="up-field-label">{meta.label.toUpperCase()}</label>
                    {!isEditing ? (
                      <div className="up-field-value">{form[key] || <span style={{ color: "var(--c-muted)", opacity: 0.5 }}>—</span>}</div>
                    ) : meta.type === "input" ? (
                      <input name={key} className="up-input" value={form[key] || ""} onChange={hc} placeholder={meta.placeholder} />
                    ) : meta.type === "select" ? (
                      <select name={key} className="up-select" value={form[key] || ""} onChange={hc}>
                        <option value="">Select…</option>
                        {meta.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <textarea name={key} className="up-textarea" value={form[key] || ""} onChange={hc} placeholder={meta.placeholder} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Save button — always visible */}
        <button className="up-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "SAVING…" : "SAVE CHANGES →"}
        </button>
      </div>
    </>
  );
}