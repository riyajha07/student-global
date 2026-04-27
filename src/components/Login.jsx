import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getAuth, signInWithEmailAndPassword, GoogleAuthProvider,
  signInWithPopup, onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAeapcTRJDlShvPsBOFH0HsbySqSf7ZkU4",
  authDomain: "global-student-collaboration.firebaseapp.com",
  projectId: "global-student-collaboration",
  storageBucket: "global-student-collaboration.firebasestorage.app",
  messagingSenderId: "519101802897",
  appId: "1:519101802897:web:d75bee7f31c9a882559230",
  measurementId: "G-4VVPVZQSYP"
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
    --c-err:#f87171;--c-ok:#4ade80;
    --font-head:'Orbitron',monospace;--font-body:'Rajdhani',sans-serif;--font-mono:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);min-height:100vh;overflow-x:hidden}

  .login-bg{
    position:fixed;inset:0;z-index:0;
    background:linear-gradient(rgba(6,214,245,0.03) 1px,transparent 1px),
              linear-gradient(90deg,rgba(6,214,245,0.03) 1px,transparent 1px);
    background-size:40px 40px;
  }
  .login-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}

  .login-wrap{
    position:relative;z-index:1;
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    padding:1.5rem;
  }

  .login-card{
    width:100%;max-width:440px;
    background:rgba(4,15,36,0.85);
    border:1px solid rgba(6,214,245,0.2);
    border-radius:12px;
    padding:2.5rem 2rem;
    backdrop-filter:blur(20px);
    box-shadow:0 0 60px rgba(6,214,245,0.06),0 0 0 1px rgba(6,214,245,0.05);
    animation:cardIn 0.5s ease both;
  }
  @keyframes cardIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

  /* corner decorations */
  .login-card::before,.login-card::after{
    content:'';position:absolute;width:18px;height:18px;
    border-color:var(--c-cyan);border-style:solid;opacity:0.6;
  }
  .login-card::before{top:0;left:0;border-width:2px 0 0 2px;border-radius:4px 0 0 0}
  .login-card::after{bottom:0;right:0;border-width:0 2px 2px 0;border-radius:0 0 4px 0}
  .login-card{position:relative}

  .login-logo{
    font-family:var(--font-head);font-size:0.9rem;font-weight:700;
    color:var(--c-cyan);letter-spacing:0.15em;
    text-shadow:0 0 20px var(--c-cyan);
    text-align:center;margin-bottom:0.25rem;
  }
  .login-title{
    font-family:var(--font-head);font-size:1.5rem;font-weight:700;
    text-align:center;color:var(--c-text);letter-spacing:0.05em;
    margin-bottom:0.3rem;
  }
  .login-sub{text-align:center;color:var(--c-muted);font-size:0.9rem;margin-bottom:2rem}

  .login-divider{
    display:flex;align-items:center;gap:0.75rem;
    margin:1.25rem 0;
  }
  .login-divider-line{flex:1;height:1px;background:rgba(6,214,245,0.12)}
  .login-divider-text{font-family:var(--font-mono);font-size:0.68rem;color:var(--c-muted);white-space:nowrap}

  .login-group{margin-bottom:1.1rem;position:relative}
  .login-label{
    display:block;font-size:0.8rem;font-weight:600;
    color:var(--c-muted);letter-spacing:0.08em;
    margin-bottom:0.4rem;font-family:var(--font-mono);
  }
  .login-input-wrap{position:relative}
  .login-input{
    width:100%;padding:0.75rem 1rem 0.75rem 1rem;
    background:rgba(7,26,62,0.6);
    border:1px solid rgba(14,165,233,0.2);
    border-radius:6px;
    color:var(--c-text);font-family:var(--font-body);font-size:1rem;
    outline:none;transition:all 0.2s;
  }
  .login-input:focus{border-color:var(--c-cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.12)}
  .login-input.err{border-color:var(--c-err)!important}
  .login-input-pr{padding-right:2.8rem}
  .login-eye{
    position:absolute;right:0.8rem;top:50%;transform:translateY(-50%);
    background:none;border:none;cursor:pointer;
    color:var(--c-muted);font-size:1rem;
    display:flex;align-items:center;padding:0;
    transition:color 0.2s;
  }
  .login-eye:hover{color:var(--c-cyan)}

  .login-err-msg{
    font-family:var(--font-mono);font-size:0.72rem;color:var(--c-err);
    margin-top:0.35rem;display:flex;align-items:center;gap:0.3rem;
  }

  .login-alert{
    background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);
    border-radius:6px;padding:0.75rem 1rem;
    font-size:0.875rem;color:var(--c-err);margin-bottom:1rem;
    font-family:var(--font-mono);
  }

  .login-btn-main{
    width:100%;padding:0.85rem;border:none;border-radius:6px;
    background:linear-gradient(135deg,#0ea5e9,#06d6f5);
    color:#020817;font-family:var(--font-head);font-size:0.9rem;
    font-weight:700;letter-spacing:0.1em;cursor:pointer;
    transition:all 0.25s;margin-top:0.5rem;
  }
  .login-btn-main:hover:not(:disabled){box-shadow:0 0 25px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .login-btn-main:disabled{opacity:0.5;cursor:not-allowed}

  .login-btn-google{
    width:100%;padding:0.75rem;border-radius:6px;
    background:rgba(7,26,62,0.6);
    border:1px solid rgba(14,165,233,0.25);
    color:var(--c-text);font-family:var(--font-body);font-size:0.95rem;
    font-weight:600;cursor:pointer;transition:all 0.2s;
    display:flex;align-items:center;justify-content:center;gap:0.6rem;
    letter-spacing:0.03em;
  }
  .login-btn-google:hover{border-color:var(--c-blue);background:rgba(14,165,233,0.1)}

  .google-icon{
    width:18px;height:18px;flex-shrink:0;
  }

  .login-foot{
    text-align:center;margin-top:1.5rem;
    font-size:0.875rem;color:var(--c-muted);
  }
  .login-foot a{color:var(--c-cyan);text-decoration:none;font-weight:600}
  .login-foot a:hover{text-shadow:0 0 10px var(--c-cyan)}

  .login-back{
    position:fixed;top:1.2rem;left:1.5rem;z-index:100;
    font-family:var(--font-mono);font-size:0.78rem;
    color:var(--c-muted);text-decoration:none;
    display:flex;align-items:center;gap:0.4rem;
    transition:color 0.2s;
  }
  .login-back:hover{color:var(--c-cyan)}

  /* scanning line animation */
  .login-scan{
    position:absolute;inset:0;overflow:hidden;border-radius:12px;pointer-events:none;
  }
  .login-scan::after{
    content:'';position:absolute;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);
    opacity:0.3;
    animation:scan 4s linear infinite;
  }
  @keyframes scan{0%{top:-1px}100%{top:100%}}

  @media(max-width:480px){
    .login-card{padding:2rem 1.25rem}
  }
`;

const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeClosed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const GoogleIcon = () => (
  <svg className="google-icon" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.5 3.2 29.5 1 24 1 14.8 1 7 6.7 3.7 14.7l7 5.4C12.4 14 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/>
    <path fill="#FBBC05" d="M10.7 28.8A14.6 14.6 0 0 1 9.5 24c0-1.7.3-3.3.7-4.8l-7-5.4A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6z"/>
    <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-10l-8.2 6C6.2 41.7 14.4 47 24 47z"/>
  </svg>
);

export default function Login() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().profileComplete) nav("/dashboard");
        else if (snap.exists()) nav("/setup");
        else nav("/setup");
      }
    });
    return unsub;
  }, []);

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() + 0.3, dx: (Math.random() - 0.5) * 0.25, dy: (Math.random() - 0.5) * 0.25, a: Math.random() * 0.4 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,214,245,${p.a})`; ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const validate = () => {
    const errs = {};
    if (!email) errs.email = "Email required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email format";
    if (!password) errs.password = "Password required";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().profileComplete) nav("/dashboard");
      else nav("/setup");
    } catch (e) {
      const msgs = {
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/invalid-email": "Invalid email address.",
        "auth/too-many-requests": "Too many failed attempts. Please wait and try again.",
        "auth/invalid-credential": "Invalid credentials. Check email and password.",
        "auth/network-request-failed": "Network error. Check your connection.",
      };
      setError(msgs[e.code] || "Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(""); setGLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().profileComplete) nav("/dashboard");
      else nav("/setup");
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") setError("Google sign-in failed. Try again.");
    } finally { setGLoading(false); }
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-bg" />
      <canvas ref={canvasRef} className="login-canvas" />

      {/* <Link to="/" className="login-back">← BACK TO HOME</Link> */}

      <div className="login-wrap">
        <div className="login-card">
          <div className="login-scan" />
          <div className="login-logo">SCH·HUB</div>
          <div className="login-title">SYSTEM LOGIN</div>
          <div className="login-sub">Access your collaboration workspace</div>

          {/* Google */}
          <button className="login-btn-google" onClick={handleGoogle} disabled={gLoading}>
            <GoogleIcon />
            {gLoading ? "Authenticating…" : "Continue with Google"}
          </button>

          <div className="login-divider">
            <div className="login-divider-line" />
            <div className="login-divider-text">// OR WITH EMAIL</div>
            <div className="login-divider-line" />
          </div>

          {error && <div className="login-alert">⚠ {error}</div>}

          <div className="login-group">
            <label className="login-label">EMAIL ADDRESS</label>
            <input
              className={`login-input${fieldErr.email ? " err" : ""}`}
              type="email" placeholder="you@university.edu"
              value={email} onChange={e => { setEmail(e.target.value); setFieldErr(p => ({ ...p, email: "" })); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
            {fieldErr.email && <div className="login-err-msg">▲ {fieldErr.email}</div>}
          </div>

          <div className="login-group">
            <label className="login-label">PASSWORD</label>
            <div className="login-input-wrap">
              <input
                className={`login-input login-input-pr${fieldErr.password ? " err" : ""}`}
                type={showPass ? "text" : "password"} placeholder="Enter password"
                value={password} onChange={e => { setPassword(e.target.value); setFieldErr(p => ({ ...p, password: "" })); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
              <button className="login-eye" onClick={() => setShowPass(v => !v)} type="button">
                {showPass ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
            {fieldErr.password && <div className="login-err-msg">▲ {fieldErr.password}</div>}
          </div>

          <button className="login-btn-main" onClick={handleLogin} disabled={loading}>
            {loading ? "AUTHENTICATING…" : "LOGIN →"}
          </button>

          <div className="login-foot">
            No account? <Link to="/register">Register here</Link>
          </div>
             <div className="login-foot">
            <Link to="/">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  );
}