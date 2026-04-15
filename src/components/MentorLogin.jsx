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

// Animated dots background
function DotsCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    let dots = [];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const N = Math.floor((window.innerWidth * window.innerHeight) / 8000);
    for (let i = 0; i < N; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.2 + 0.8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d, i) => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,179,237,${d.opacity})`;
        ctx.fill();
        dots.forEach((d2, j) => {
          if (j <= i) return;
          const dx = d.x - d2.x, dy = d.y - d2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d2.x, d2.y);
            ctx.strokeStyle = `rgba(99,179,237,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

export default function MentorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "mentors", user.uid));
        if (snap.exists() && snap.data().profileComplete) {
          navigate("/mentor/dashboard");
        } else if (snap.exists()) {
          navigate("/mentor/profile");
        } else {
          navigate("/mentor/profile");
        }
      }
    });
    return unsub;
  }, [navigate]);

  const handleEmail = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getFriendlyError(err.code));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(getFriendlyError(err.code));
    }
    setLoading(false);
  };

  const getFriendlyError = (code) => {
    const map = {
      "auth/user-not-found": "No mentor account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    };
    return map[code] || "Something went wrong. Please try again.";
  };

  return (
    <div style={styles.root}>
      <DotsCanvas />
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>🎓</span>
          <span style={styles.logoText}>MentorHub</span>
        </div>
        <h1 style={styles.heading}>Mentor Portal</h1>
        <p style={styles.sub}>Sign in to guide the next generation of collaborative teams.</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleEmail} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = "#63b3ed"}
              onBlur={e => e.target.style.borderColor = "rgba(99,179,237,0.25)"}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.passWrap}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ ...styles.input, paddingRight: "3rem" }}
                onFocus={e => e.target.style.borderColor = "#63b3ed"}
                onBlur={e => e.target.style.borderColor = "rgba(99,179,237,0.25)"}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}>
            {loading ? <span style={styles.spinner} /> : "Sign In"}
          </button>
        </form>

        <div style={styles.divider}><span style={styles.dividerText}>or continue with</span></div>

        <button onClick={handleGoogle} disabled={loading} style={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.4 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.5 39.4 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C37 37.3 44 32 44 24c0-1.3-.1-2.6-.4-3.9z" />
          </svg>
          Continue with Google
        </button>

        <p style={styles.switchText}>
          New mentor?{" "}
          <Link to="/mentor/register" style={styles.link}>Create an account</Link>
        </p>
        <p style={styles.switchText}>
          <Link to="/mentor/register" style={{ ...styles.link, fontSize: "0.8rem", opacity: 0.7 }}>Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #050d1a 0%, #071428 40%, #0a1f3d 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Sora', 'Nunito', sans-serif",
    padding: "1rem",
    position: "relative",
  },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(10,25,60,0.85)",
    border: "1px solid rgba(99,179,237,0.18)",
    borderRadius: "1.5rem",
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 8px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.08)",
    backdropFilter: "blur(18px)",
  },
  logoRow: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.2rem" },
  logoIcon: { fontSize: "1.6rem" },
  logoText: {
    fontSize: "1.1rem", fontWeight: 700,
    background: "linear-gradient(90deg, #63b3ed, #a78bfa)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    letterSpacing: "0.04em",
  },
  heading: {
    fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, color: "#e2e8f0",
    margin: "0 0 0.3rem",
    background: "linear-gradient(90deg, #90cdf4, #a78bfa, #f687b3)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  sub: { color: "#94a3b8", fontSize: "0.88rem", marginBottom: "1.5rem", lineHeight: 1.5 },
  errorBox: {
    background: "rgba(245,101,101,0.12)", border: "1px solid rgba(245,101,101,0.35)",
    color: "#fc8181", borderRadius: "0.7rem", padding: "0.7rem 1rem",
    fontSize: "0.85rem", marginBottom: "1rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label: { color: "#90cdf4", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.06em" },
  input: {
    background: "rgba(15,30,70,0.7)", border: "1px solid rgba(99,179,237,0.25)",
    borderRadius: "0.7rem", padding: "0.75rem 1rem", color: "#e2e8f0",
    fontSize: "0.95rem", outline: "none", width: "100%", boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  passWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#63b3ed",
    padding: 0,
  },
  btn: {
    background: "linear-gradient(135deg, #2b6cb0, #553c9a)",
    border: "none", borderRadius: "0.7rem", padding: "0.85rem",
    color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
    marginTop: "0.3rem", transition: "opacity 0.2s, transform 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center",
    letterSpacing: "0.03em",
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  spinner: {
    width: "18px", height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  divider: {
    display: "flex", alignItems: "center", gap: "0.7rem",
    margin: "1.2rem 0",
    "::before": { content: '""', flex: 1, height: "1px", background: "rgba(99,179,237,0.15)" },
    "::after": { content: '""', flex: 1, height: "1px", background: "rgba(99,179,237,0.15)" },
  },
  dividerText: { color: "#4a5568", fontSize: "0.78rem", whiteSpace: "nowrap" },
  googleBtn: {
    background: "rgba(15,30,70,0.6)", border: "1px solid rgba(99,179,237,0.2)",
    borderRadius: "0.7rem", padding: "0.75rem 1rem", color: "#e2e8f0",
    fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", fontWeight: 600, transition: "background 0.2s",
    width: "100%",
  },
  switchText: { textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginTop: "1rem" },
  link: { color: "#63b3ed", textDecoration: "none", fontWeight: 600 },
};