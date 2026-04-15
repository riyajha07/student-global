import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getAuth, createUserWithEmailAndPassword, GoogleAuthProvider,
  signInWithPopup, updateProfile, onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
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
  :root {
    --c-bg:#020817;--c-bg2:#040f24;--c-navy:#071a3e;
    --c-blue:#0ea5e9;--c-cyan:#06d6f5;--c-glow:#0ea5e940;
    --c-text:#e2f0ff;--c-muted:#7ba3c8;--c-accent:#00ffc8;
    --c-err:#f87171;--c-ok:#4ade80;--c-warn:#fbbf24;
    --font-head:'Orbitron',monospace;--font-body:'Rajdhani',sans-serif;--font-mono:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);min-height:100vh;overflow-x:hidden}
  .reg-bg{position:fixed;inset:0;z-index:0;background:linear-gradient(rgba(6,214,245,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.03) 1px,transparent 1px);background-size:40px 40px;}
  .reg-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
  .reg-wrap{position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:5rem 1.5rem 2rem;}
  .reg-card{
    width:100%;max-width:460px;
    background:rgba(4,15,36,0.88);
    border:1px solid rgba(6,214,245,0.2);
    border-radius:12px;padding:2.5rem 2rem;
    backdrop-filter:blur(20px);
    box-shadow:0 0 60px rgba(6,214,245,0.06);
    animation:cardIn 0.5s ease both;position:relative;
  }
  @keyframes cardIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
  .reg-card::before,.reg-card::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--c-cyan);border-style:solid;opacity:0.6;}
  .reg-card::before{top:0;left:0;border-width:2px 0 0 2px;border-radius:4px 0 0 0}
  .reg-card::after{bottom:0;right:0;border-width:0 2px 2px 0;border-radius:0 0 4px 0}
  .reg-scan{position:absolute;inset:0;overflow:hidden;border-radius:12px;pointer-events:none;}
  .reg-scan::after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:0.25;animation:scan 5s linear infinite;}
  @keyframes scan{0%{top:-1px}100%{top:100%}}
  .reg-logo{font-family:var(--font-head);font-size:0.9rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.15em;text-shadow:0 0 20px var(--c-cyan);text-align:center;margin-bottom:0.25rem;}
  .reg-title{font-family:var(--font-head);font-size:1.4rem;font-weight:700;text-align:center;color:var(--c-text);letter-spacing:0.05em;margin-bottom:0.3rem;}
  .reg-sub{text-align:center;color:var(--c-muted);font-size:0.88rem;margin-bottom:2rem}
  .reg-divider{display:flex;align-items:center;gap:0.75rem;margin:1.25rem 0;}
  .reg-divider-line{flex:1;height:1px;background:rgba(6,214,245,0.12)}
  .reg-divider-text{font-family:var(--font-mono);font-size:0.68rem;color:var(--c-muted)}
  .reg-group{margin-bottom:1rem;position:relative}
  .reg-label{display:block;font-size:0.78rem;font-weight:600;color:var(--c-muted);letter-spacing:0.08em;margin-bottom:0.35rem;font-family:var(--font-mono);}
  .reg-input-wrap{position:relative}
  .reg-input{
    width:100%;padding:0.72rem 1rem;
    background:rgba(7,26,62,0.6);
    border:1px solid rgba(14,165,233,0.2);
    border-radius:6px;color:var(--c-text);
    font-family:var(--font-body);font-size:1rem;
    outline:none;transition:all 0.2s;
  }
  .reg-input:focus{border-color:var(--c-cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.12)}
  .reg-input.err{border-color:var(--c-err)!important}
  .reg-input.ok{border-color:rgba(74,222,128,0.4)}
  .reg-input-pr{padding-right:2.8rem}
  .reg-eye{position:absolute;right:0.8rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--c-muted);display:flex;align-items:center;padding:0;transition:color 0.2s;}
  .reg-eye:hover{color:var(--c-cyan)}
  .reg-err-msg{font-family:var(--font-mono);font-size:0.7rem;color:var(--c-err);margin-top:0.3rem}
  .reg-alert{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:0.7rem 1rem;font-size:0.85rem;color:var(--c-err);margin-bottom:1rem;font-family:var(--font-mono);}

  /* PASSWORD STRENGTH */
  .pw-strength-bar{display:flex;gap:4px;margin-top:0.5rem}
  .pw-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.08);transition:background 0.3s}
  .pw-seg.s1{background:#f87171}
  .pw-seg.s2{background:#fbbf24}
  .pw-seg.s3{background:#4ade80}
  .pw-seg.s4{background:var(--c-cyan);box-shadow:0 0 6px var(--c-cyan)}
  .pw-label{font-family:var(--font-mono);font-size:0.68rem;margin-top:0.3rem}
  .pw-label.s1{color:#f87171}
  .pw-label.s2{color:#fbbf24}
  .pw-label.s3{color:#4ade80}
  .pw-label.s4{color:var(--c-cyan)}

  /* constraints list */
  .pw-constraints{list-style:none;margin-top:0.5rem;display:flex;flex-direction:column;gap:0.2rem}
  .pw-con{font-family:var(--font-mono);font-size:0.68rem;display:flex;align-items:center;gap:0.35rem;color:var(--c-muted)}
  .pw-con.met{color:var(--c-ok)}
  .pw-con-dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}

  .reg-btn-main{width:100%;padding:0.85rem;border:none;border-radius:6px;background:linear-gradient(135deg,#0ea5e9,#06d6f5);color:#020817;font-family:var(--font-head);font-size:0.85rem;font-weight:700;letter-spacing:0.1em;cursor:pointer;transition:all 0.25s;margin-top:0.75rem;}
  .reg-btn-main:hover:not(:disabled){box-shadow:0 0 25px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .reg-btn-main:disabled{opacity:0.5;cursor:not-allowed}
  .reg-btn-google{width:100%;padding:0.72rem;border-radius:6px;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.25);color:var(--c-text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:0.6rem;letter-spacing:0.03em;}
  .reg-btn-google:hover{border-color:var(--c-blue);background:rgba(14,165,233,0.1)}
  .reg-foot{text-align:center;margin-top:1.5rem;font-size:0.875rem;color:var(--c-muted);}
  .reg-foot a{color:var(--c-cyan);text-decoration:none;font-weight:600}
  .reg-foot a:hover{text-shadow:0 0 10px var(--c-cyan)}
  .reg-back{position:fixed;top:1.2rem;left:1.5rem;z-index:100;font-family:var(--font-mono);font-size:0.78rem;color:var(--c-muted);text-decoration:none;display:flex;align-items:center;gap:0.4rem;transition:color 0.2s;}
  .reg-back:hover{color:var(--c-cyan)}
  @media(max-width:480px){.reg-card{padding:2rem 1.25rem}}
`;

const EyeOpen = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeClosed = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const GoogleIcon = () => <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.5 3.2 29.5 1 24 1 14.8 1 7 6.7 3.7 14.7l7 5.4C12.4 14 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/><path fill="#FBBC05" d="M10.7 28.8A14.6 14.6 0 0 1 9.5 24c0-1.7.3-3.3.7-4.8l-7-5.4A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6z"/><path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-10l-8.2 6C6.2 41.7 14.4 47 24 47z"/></svg>;

function getPwStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const PW_LABELS = ["", "WEAK", "FAIR", "STRONG", "VERY STRONG"];
const CONSTRAINTS = [
  { label: "At least 8 characters", check: pw => pw.length >= 8 },
  { label: "One uppercase letter", check: pw => /[A-Z]/.test(pw) },
  { label: "One number", check: pw => /[0-9]/.test(pw) },
  { label: "One special character", check: pw => /[^A-Za-z0-9]/.test(pw) },
];

export default function Register() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [pwFocus, setPwFocus] = useState(false);

  const pwStr = getPwStrength(password);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async u => {
//       if (u) {
//         const snap = await getDoc(doc(db, "users", u.uid));
//         if (snap.exists() && snap.data().profileComplete) nav("/dashboard");
//         else nav("/setup");
//       }
//     });
//     return unsub;
//   }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pts = Array.from({ length: 40 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() + 0.3, dx: (Math.random() - 0.5) * 0.25, dy: (Math.random() - 0.5) * 0.25, a: Math.random() * 0.35 + 0.1 }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(6,214,245,${p.a})`; ctx.fill(); p.x += p.dx; p.y += p.dy; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0; });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Full name required";
    if (!email) errs.email = "Email required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email format";
    if (!password) errs.password = "Password required";
    else if (pwStr < 3) errs.password = "Password too weak";
    if (password !== confirm) errs.confirm = "Passwords do not match";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, email, displayName: name.trim(),
        profileComplete: false, createdAt: serverTimestamp(),
      });
      nav("/setup");
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Please use a stronger password.",
        "auth/network-request-failed": "Network error. Check your connection.",
      };
      setError(msgs[e.code] || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(""); setGLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid, email: cred.user.email,
          displayName: cred.user.displayName || "",
          profileComplete: false, createdAt: serverTimestamp(),
        });
        nav("/setup");
      } else if (snap.data().profileComplete) { nav("/dashboard"); }
      else { nav("/setup"); }
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") setError("Google sign-in failed. Try again.");
    } finally { setGLoading(false); }
  };

  const fe = (f) => fieldErr[f] ? " err" : "";

  return (
    <>
      <style>{css}</style>
      <div className="reg-bg" />
      <canvas ref={canvasRef} className="reg-canvas" />
      {/* <Link to="/" className="reg-back">← BACK TO HOME</Link> */}

      <div className="reg-wrap">
        <div className="reg-card">
          <div className="reg-scan" />
          <div className="reg-logo">SCH·HUB</div>
          <div className="reg-title">CREATE ACCOUNT</div>
          <div className="reg-sub">Join the engineering student network</div>

          <button className="reg-btn-google" onClick={handleGoogle} disabled={gLoading}>
            <GoogleIcon />
            {gLoading ? "Authenticating…" : "Register with Google"}
          </button>

          <div className="reg-divider">
            <div className="reg-divider-line" />
            <div className="reg-divider-text">// OR WITH EMAIL</div>
            <div className="reg-divider-line" />
          </div>

          {error && <div className="reg-alert">⚠ {error}</div>}

          <div className="reg-group">
            <label className="reg-label">FULL NAME</label>
            <input className={`reg-input${fe("name")}`} placeholder="Your full name" value={name}
              onChange={e => { setName(e.target.value); setFieldErr(p => ({ ...p, name: "" })); }} />
            {fieldErr.name && <div className="reg-err-msg">▲ {fieldErr.name}</div>}
          </div>

          <div className="reg-group">
            <label className="reg-label">EMAIL ADDRESS</label>
            <input className={`reg-input${fe("email")}`} type="email" placeholder="you@university.edu" value={email}
              onChange={e => { setEmail(e.target.value); setFieldErr(p => ({ ...p, email: "" })); }} />
            {fieldErr.email && <div className="reg-err-msg">▲ {fieldErr.email}</div>}
          </div>

          <div className="reg-group">
            <label className="reg-label">PASSWORD</label>
            <div className="reg-input-wrap">
              <input className={`reg-input reg-input-pr${fe("password")}`} type={showPass ? "text" : "password"}
                placeholder="Create a strong password" value={password}
                onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                onChange={e => { setPassword(e.target.value); setFieldErr(p => ({ ...p, password: "" })); }} />
              <button className="reg-eye" onClick={() => setShowPass(v => !v)} type="button">
                {showPass ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
            {/* Strength bar */}
            {password && (
              <>
                <div className="pw-strength-bar">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`pw-seg${pwStr >= i ? ` s${pwStr}` : ""}`} />
                  ))}
                </div>
                <div className={`pw-label s${pwStr}`}>{PW_LABELS[pwStr]}</div>
              </>
            )}
            {(pwFocus || password) && (
              <ul className="pw-constraints">
                {CONSTRAINTS.map((c, i) => (
                  <li key={i} className={`pw-con${c.check(password) ? " met" : ""}`}>
                    <span className="pw-con-dot" />
                    {c.label}
                  </li>
                ))}
              </ul>
            )}
            {fieldErr.password && <div className="reg-err-msg">▲ {fieldErr.password}</div>}
          </div>

          <div className="reg-group">
            <label className="reg-label">CONFIRM PASSWORD</label>
            <div className="reg-input-wrap">
              <input className={`reg-input reg-input-pr${fe("confirm")}`} type={showConf ? "text" : "password"}
                placeholder="Repeat password" value={confirm}
                onChange={e => { setConfirm(e.target.value); setFieldErr(p => ({ ...p, confirm: "" })); }} />
              <button className="reg-eye" onClick={() => setShowConf(v => !v)} type="button">
                {showConf ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
            {fieldErr.confirm && <div className="reg-err-msg">▲ {fieldErr.confirm}</div>}
          </div>

          <button className="reg-btn-main" onClick={handleRegister} disabled={loading}>
            {loading ? "CREATING ACCOUNT…" : "CREATE ACCOUNT →"}
          </button>

          <div className="reg-foot">
            Already have an account? <Link to="/login">Login here</Link>
          </div>
            <div className="reg-foot">
            <Link to="/landing">Back to Home</Link>
          </div>
        </div>
      </div>
    </>
  );
}