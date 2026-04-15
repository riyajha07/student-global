import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
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

/* ─── helpers ─── */
function makeAvatar(idx) {
  const hues = [200, 180, 220, 260, 160, 280, 140, 300, 170, 240];
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

/* ─── CSS ─── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');

  :root {
    --c-bg: #020817;
    --c-bg2: #040f24;
    --c-navy: #071a3e;
    --c-blue: #0ea5e9;
    --c-cyan: #06d6f5;
    --c-glow: #0ea5e940;
    --c-text: #e2f0ff;
    --c-muted: #7ba3c8;
    --c-accent: #00ffc8;
    --c-accent2: #f59e0b;
    --font-head: 'Orbitron', monospace;
    --font-body: 'Rajdhani', sans-serif;
    --font-mono: 'Share Tech Mono', monospace;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--font-body);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* BACKGROUND GRID */
  .yp-bg {
    position: fixed; inset: 0; z-index: 0;
    background:
      linear-gradient(rgba(6,214,245,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,214,245,0.025) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .yp-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

  /* NAV */
  .yp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.9rem 2rem;
    background: rgba(2,8,23,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(6,214,245,0.12);
  }
  @media(max-width:480px) { .yp-nav { padding: 0.75rem 1rem; } }
  .yp-nav-logo {
    font-family: var(--font-head); font-size: 0.85rem; font-weight: 700;
    color: var(--c-cyan); letter-spacing: 0.15em;
    text-shadow: 0 0 16px var(--c-cyan);
  }
  .yp-nav-right { display: flex; align-items: center; gap: 0.75rem; }

  /* BACK BUTTON */
  .yp-back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0.42rem 1rem; border-radius: 5px;
    background: transparent;
    border: 1px solid rgba(14,165,233,0.25);
    color: var(--c-muted); font-family: var(--font-mono);
    font-size: 0.7rem; letter-spacing: 0.08em;
    cursor: pointer; transition: all 0.2s;
  }
  .yp-back-btn:hover {
    border-color: var(--c-cyan); color: var(--c-cyan);
    box-shadow: 0 0 12px rgba(6,214,245,0.2);
  }

  /* MAIN */
  .yp-main {
    position: relative; z-index: 1;
    padding: 5.5rem 1.5rem 3rem;
    max-width: 1100px; margin: 0 auto;
  }
  @media(max-width:500px) { .yp-main { padding: 5rem 1rem 2rem; } }

  /* HERO BANNER */
  .yp-hero {
    background: rgba(4,15,36,0.7);
    border: 1px solid rgba(6,214,245,0.15);
    border-radius: 12px; padding: 2rem; margin-bottom: 2.5rem;
    position: relative; overflow: hidden;
  }
  .yp-hero::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--c-cyan), transparent);
  }
  .yp-hero::after {
    content: ''; position: absolute; bottom: 0; right: 0;
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(6,214,245,0.04), transparent 70%);
    pointer-events: none;
  }
  .yp-hero-tag {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--c-accent); letter-spacing: 0.15em; margin-bottom: 0.5rem;
  }
  .yp-hero-h {
    font-family: var(--font-head); font-size: clamp(1.2rem, 3vw, 1.8rem);
    font-weight: 700; color: var(--c-text); margin-bottom: 0.5rem;
  }
  .yp-hero-h span { color: var(--c-cyan); }
  .yp-hero-p { color: var(--c-muted); font-size: 1rem; max-width: 480px; }
  .yp-hero-stats {
    display: flex; gap: 2rem; margin-top: 1.25rem; flex-wrap: wrap;
  }
  .yp-stat {
    display: flex; flex-direction: column; gap: 2px;
  }
  .yp-stat-num {
    font-family: var(--font-head); font-size: 1.6rem; font-weight: 900;
    color: var(--c-cyan); line-height: 1;
    text-shadow: 0 0 20px rgba(6,214,245,0.4);
  }
  .yp-stat-label {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--c-muted); letter-spacing: 0.1em;
  }

  /* TOGGLE */
  .yp-toggle-wrap {
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 2.5rem;
  }
  .yp-toggle-track {
    position: relative;
    display: grid; grid-template-columns: 1fr 1fr;
    background: rgba(7,26,62,0.6);
    border: 1px solid rgba(14,165,233,0.2);
    border-radius: 10px; padding: 5px; gap: 0;
    width: 340px; overflow: hidden;
  }
  @media(max-width:400px) { .yp-toggle-track { width: 100%; } }
  .yp-toggle-glider {
    position: absolute; top: 5px; bottom: 5px;
    width: calc(50% - 5px);
    border-radius: 7px;
    transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: none;
  }
  .yp-toggle-glider.solo {
    background: linear-gradient(135deg, #0ea5e9, #06d6f5);
    box-shadow: 0 0 20px rgba(6,214,245,0.35);
    transform: translateX(0);
  }
  .yp-toggle-glider.team {
    background: linear-gradient(135deg, #00c896, #06d6f5);
    box-shadow: 0 0 20px rgba(0,255,200,0.3);
    transform: translateX(calc(100% + 10px));
  }
  .yp-toggle-btn {
    position: relative; z-index: 1;
    padding: 0.7rem 1rem; border: none; background: transparent;
    font-family: var(--font-head); font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.08em; cursor: pointer; border-radius: 7px;
    transition: color 0.25s; display: flex; align-items: center;
    justify-content: center; gap: 7px;
  }
  .yp-toggle-btn.active { color: #020817; }
  .yp-toggle-btn.inactive { color: var(--c-muted); }
  .yp-toggle-btn.inactive:hover { color: var(--c-text); }

  /* SECTION LABEL */
  .yp-sec-label {
    font-family: var(--font-mono); font-size: 0.72rem;
    color: var(--c-accent); letter-spacing: 0.15em; margin-bottom: 1.25rem;
  }

  /* GRID */
  .yp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  @media(max-width:500px) { .yp-grid { grid-template-columns: 1fr; } }

  /* SOLO CARD */
  .yp-solo-card {
    background: rgba(4,15,36,0.8);
    border: 1px solid rgba(14,165,233,0.18);
    border-radius: 10px; padding: 1.6rem;
    position: relative; overflow: hidden;
    transition: all 0.3s; cursor: pointer;
    display: flex; flex-direction: column; gap: 0.85rem;
  }
  .yp-solo-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #0ea5e9 40%, #06d6f5, transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .yp-solo-card:hover {
    border-color: rgba(6,214,245,0.4);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(6,214,245,0.08);
  }
  .yp-solo-card:hover::before { opacity: 1; }
  .yp-solo-card::after {
    content: ''; position: absolute; bottom: 0; right: 0;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(14,165,233,0.06), transparent 70%);
    pointer-events: none;
  }

  .yp-card-type {
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.15em; display: flex; align-items: center; gap: 6px;
  }
  .yp-card-type-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .yp-card-type.solo .yp-card-type-dot { background: var(--c-blue); box-shadow: 0 0 6px var(--c-blue); }
  .yp-card-type.solo { color: var(--c-blue); }
  .yp-card-type.team .yp-card-type-dot { background: var(--c-accent); box-shadow: 0 0 6px var(--c-accent); }
  .yp-card-type.team { color: var(--c-accent); }

  .yp-card-title {
    font-family: var(--font-head); font-size: 0.92rem; font-weight: 700;
    color: var(--c-text); line-height: 1.3; letter-spacing: 0.04em;
  }

  .yp-card-domain {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--c-muted); letter-spacing: 0.08em;
    display: flex; align-items: center; gap: 6px;
  }

  .yp-stack-row {
    display: flex; flex-wrap: wrap; gap: 0.35rem;
  }
  .yp-stack-tag {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--c-cyan); border: 1px solid rgba(6,214,245,0.2);
    padding: 0.18rem 0.55rem; border-radius: 3px;
    background: rgba(6,214,245,0.04);
  }

  /* TEAM CARD */
  .yp-team-card {
    background: rgba(4,15,36,0.8);
    border: 1px solid rgba(0,200,150,0.18);
    border-radius: 10px; padding: 1.6rem;
    position: relative; overflow: hidden;
    transition: all 0.3s; cursor: pointer;
    display: flex; flex-direction: column; gap: 0.85rem;
  }
  .yp-team-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #00c896 40%, #06d6f5, transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .yp-team-card:hover {
    border-color: rgba(0,255,200,0.4);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,255,200,0.07);
  }
  .yp-team-card:hover::before { opacity: 1; }
  .yp-team-card::after {
    content: ''; position: absolute; bottom: 0; right: 0;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(0,200,150,0.06), transparent 70%);
    pointer-events: none;
  }

  .yp-team-name {
    font-family: var(--font-head); font-size: 1rem; font-weight: 900;
    color: var(--c-accent); letter-spacing: 0.06em;
    text-shadow: 0 0 16px rgba(0,255,200,0.25);
  }
  .yp-team-project {
    font-family: var(--font-head); font-size: 0.82rem; font-weight: 700;
    color: var(--c-text); line-height: 1.3;
  }
  .yp-team-leader {
    display: flex; align-items: center; gap: 0.6rem;
    font-family: var(--font-mono); font-size: 0.68rem; color: var(--c-muted);
  }
  .yp-leader-avatar {
    width: 26px; height: 26px; border-radius: 50%; overflow: hidden;
    border: 1px solid rgba(0,255,200,0.25); flex-shrink: 0;
  }
  .yp-leader-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .yp-leader-name { color: var(--c-text); font-weight: 600; }

  /* OPEN BUTTON */
  .yp-open-btn {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: auto; padding: 0.55rem 1rem; border-radius: 5px;
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.06em;
    border: none; cursor: pointer; transition: all 0.2s;
    align-self: flex-start;
  }
  .yp-open-solo {
    background: rgba(14,165,233,0.1); border: 1px solid rgba(14,165,233,0.25);
    color: var(--c-blue);
  }
  .yp-open-solo:hover {
    background: rgba(6,214,245,0.15); border-color: var(--c-cyan);
    color: var(--c-cyan); box-shadow: 0 0 12px rgba(6,214,245,0.2);
  }
  .yp-open-team {
    background: rgba(0,200,150,0.08); border: 1px solid rgba(0,255,200,0.2);
    color: var(--c-accent);
  }
  .yp-open-team:hover {
    background: rgba(0,255,200,0.15); border-color: var(--c-accent);
    box-shadow: 0 0 12px rgba(0,255,200,0.2);
  }

  /* EMPTY STATE */
  .yp-empty {
    grid-column: 1/-1;
    display: flex; flex-direction: column; align-items: center;
    gap: 1rem; padding: 4rem 2rem;
    border: 1px dashed rgba(14,165,233,0.15);
    border-radius: 10px;
    background: rgba(4,15,36,0.4);
  }
  .yp-empty-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(14,165,233,0.06);
    border: 1px solid rgba(14,165,233,0.15);
    display: flex; align-items: center; justify-content: center;
  }
  .yp-empty-title {
    font-family: var(--font-head); font-size: 0.9rem;
    color: var(--c-text); letter-spacing: 0.06em;
  }
  .yp-empty-sub {
    font-family: var(--font-mono); font-size: 0.72rem;
    color: var(--c-muted); text-align: center; max-width: 300px; line-height: 1.7;
  }
  .yp-empty-cta {
    padding: 0.6rem 1.4rem; border-radius: 6px;
    background: linear-gradient(135deg, #0ea5e9, #06d6f5);
    color: #020817; font-family: var(--font-head);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
    border: none; cursor: pointer; transition: all 0.2s;
  }
  .yp-empty-cta:hover { box-shadow: 0 0 20px rgba(6,214,245,0.4); }

  /* LOADING */
  .yp-loading {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; flex-direction: column; gap: 1rem;
  }
  .yp-spin {
    width: 36px; height: 36px;
    border: 2px solid rgba(6,214,245,0.2);
    border-top-color: var(--c-cyan);
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .yp-spin-text {
    font-family: var(--font-mono); font-size: 0.8rem; color: var(--c-muted);
  }

  /* SKELETON */
  .yp-skeleton {
    background: rgba(14,165,233,0.06);
    border: 1px solid rgba(14,165,233,0.1);
    border-radius: 10px; padding: 1.6rem;
    display: flex; flex-direction: column; gap: 0.75rem;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
  .yp-skel-line {
    height: 12px; border-radius: 3px;
    background: rgba(14,165,233,0.1);
  }
  .yp-skel-line.short { width: 40%; }
  .yp-skel-line.med { width: 65%; }
  .yp-skel-line.long { width: 90%; }

  /* FADE IN ANIMATION */
  .yp-fade-in {
    animation: fadeUp 0.4s ease both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

/* ─── Skeleton Loader ─── */
function SkeletonCard() {
  return (
    <div className="yp-skeleton">
      <div className="yp-skel-line short" />
      <div className="yp-skel-line med" />
      <div className="yp-skel-line long" />
      <div className="yp-skel-line short" />
    </div>
  );
}

/* ─── Solo Card ─── */
function SoloCard({ project, idx, onClick }) {
  const stackArr = Array.isArray(project.stack)
    ? project.stack
    : (project.stack || "").split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div
      className="yp-solo-card yp-fade-in"
      style={{ animationDelay: `${idx * 0.07}s` }}
      onClick={onClick}
    >
      <div className="yp-card-type solo">
        <span className="yp-card-type-dot" />
        SOLO PROJECT
      </div>
      <div className="yp-card-title">{project.title || project.projectTitle || "Untitled Project"}</div>
      {project.domain && (
        <div className="yp-card-domain">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {project.domain}
        </div>
      )}
      {stackArr.length > 0 && (
        <div className="yp-stack-row">
          {stackArr.slice(0, 5).map(s => (
            <span key={s} className="yp-stack-tag">{s}</span>
          ))}
        </div>
      )}
      <button className="yp-open-btn yp-open-solo">
        Open Project
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
}

/* ─── Team Card ─── */
function TeamCard({ project, idx, onClick }) {
  const avatarSrc = makeAvatar(
    project.teamName ? project.teamName.charCodeAt(0) % 10 : idx
  );

  return (
    <div
      className="yp-team-card yp-fade-in"
      style={{ animationDelay: `${idx * 0.07}s` }}
      onClick={onClick}
    >
      <div className="yp-card-type team">
        <span className="yp-card-type-dot" />
        TEAM PROJECT
      </div>
      <div className="yp-team-name">{project.teamName || "Unnamed Team"}</div>
      <div className="yp-team-project">{project.projectName || project.title || "Untitled Project"}</div>
      <div className="yp-team-leader">
        <div className="yp-leader-avatar">
          <img src={avatarSrc} alt="leader" />
        </div>
        <span>Led by&nbsp;<span className="yp-leader-name">{project.teamLeaderName || "Unknown"}</span></span>
      </div>
      <button className="yp-open-btn yp-open-team">
        Open Project
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
}

/* ─── Main Component ─── */
export default function YourProjects() {
  const nav = useNavigate();
  const canvasRef = useRef(null);

  const [user, setUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [mode, setMode] = useState("solo"); // "solo" | "team"

  const [soloProjects, setSoloProjects] = useState([]);
  const [teamProjects, setTeamProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  /* Canvas particle animation */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pts = Array.from({ length: 35 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() + 0.2,
      dx: (Math.random() - 0.5) * 0.18,
      dy: (Math.random() - 0.5) * 0.18,
      a: Math.random() * 0.3 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,214,245,${p.a})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Auth guard */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      setPageLoading(false);
    });
    return unsub;
  }, []);

  /* Fetch projects once user is known */
  useEffect(() => {
    if (!user || fetched) return;
    const fetchProjects = async () => {
      setProjectsLoading(true);
      try {
        const [soloSnap, teamSnap] = await Promise.all([
          getDocs(query(collection(db, "soloProjects"), where("uid", "==", user.uid))),
          getDocs(query(collection(db, "teamProjects"), where("members", "array-contains", user.uid))),
        ]);
        setSoloProjects(soloSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTeamProjects(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
      setProjectsLoading(false);
      setFetched(true);
    };
    fetchProjects();
  }, [user, fetched]);

  const handleSoloOpen = (project) => {
    nav(`/solo-dashboard/${project.id}`);
  };

  const handleTeamOpen = (project) => {
    nav(`/team-dashboard/${project.id}`);
  };

  const currentProjects = mode === "solo" ? soloProjects : teamProjects;

  if (pageLoading) return (
    <>
      <style>{css}</style>
      <div className="yp-loading">
        <div className="yp-spin" />
        <div className="yp-spin-text">LOADING PROJECTS…</div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="yp-bg" />
      <canvas ref={canvasRef} className="yp-canvas" />

      {/* NAV */}
      <nav className="yp-nav">
        <div className="yp-nav-logo">SCH·HUB</div>
        <div className="yp-nav-right">
          <button className="yp-back-btn" onClick={() => nav("/dashboard")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            BACK TO DASHBOARD
          </button>
        </div>
      </nav>

      <main className="yp-main">

        {/* HERO */}
        <div className="yp-hero">
          <div className="yp-hero-tag">
            // YOUR PROJECTS — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
          </div>
          <div className="yp-hero-h">
            Your <span>Build History</span>
          </div>
          <div className="yp-hero-p">
            Every project you've started or joined — solo sandboxes and live team sessions, all in one place.
          </div>
          <div className="yp-hero-stats">
            <div className="yp-stat">
              <div className="yp-stat-num">{soloProjects.length}</div>
              <div className="yp-stat-label">SOLO PROJECTS</div>
            </div>
            <div className="yp-stat">
              <div className="yp-stat-num">{teamProjects.length}</div>
              <div className="yp-stat-label">TEAM PROJECTS</div>
            </div>
            <div className="yp-stat">
              <div className="yp-stat-num">{soloProjects.length + teamProjects.length}</div>
              <div className="yp-stat-label">TOTAL PROJECTS</div>
            </div>
          </div>
        </div>

        {/* TOGGLE */}
        <div className="yp-toggle-wrap">
          <div className="yp-toggle-track">
            <div className={`yp-toggle-glider ${mode}`} />
            <button
              className={`yp-toggle-btn ${mode === "solo" ? "active" : "inactive"}`}
              onClick={() => setMode("solo")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              SOLO
            </button>
            <button
              className={`yp-toggle-btn ${mode === "team" ? "active" : "inactive"}`}
              onClick={() => setMode("team")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              TEAM
            </button>
          </div>
        </div>

        {/* SECTION LABEL */}
        <div className="yp-sec-label" style={{ marginBottom: "1.5rem" }}>
          // {mode === "solo" ? "SOLO" : "TEAM"} PROJECTS — {currentProjects.length} FOUND
        </div>

        {/* GRID */}
        <div className="yp-grid">
          {projectsLoading ? (
            [1, 2, 3].map(i => <SkeletonCard key={i} />)
          ) : currentProjects.length === 0 ? (
            <div className="yp-empty">
              <div className="yp-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(14,165,233,0.5)" strokeWidth="1.5">
                  {mode === "solo"
                    ? <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>
                    : <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>
                  }
                </svg>
              </div>
              <div className="yp-empty-title">
                NO {mode === "solo" ? "SOLO" : "TEAM"} PROJECTS YET
              </div>
              <div className="yp-empty-sub">
                {mode === "solo"
                  ? "You haven't created any solo projects. Start building your first private workspace."
                  : "You haven't joined any team projects. Create one or wait to be invited."
                }
              </div>
              <button
                className="yp-empty-cta"
                onClick={() => nav(mode === "solo" ? "/solo-questions" : "/team-questions")}
              >
                + CREATE {mode === "solo" ? "SOLO" : "TEAM"} PROJECT
              </button>
            </div>
          ) : mode === "solo" ? (
            soloProjects.map((p, i) => (
              <SoloCard key={p.id} project={p} idx={i} onClick={() => handleSoloOpen(p)} />
            ))
          ) : (
            teamProjects.map((p, i) => (
              <TeamCard key={p.id} project={p} idx={i} onClick={() => handleTeamOpen(p)} />
            ))
          )}
        </div>
      </main>
    </>
  );
}