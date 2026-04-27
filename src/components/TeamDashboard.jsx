/**
 * TeamDashboard.jsx — v5.0
 * Route: /team-dashboard/:projectId
 *
 * FIXES:
 * 1. File upload from PC (FileReader + Firestore storage)
 * 2. Input focus/cursor glitch fixed (controlled inputs with stable refs)
 * 3. Mentor "Go to Dashboard" → /mentor/dashboard
 * 4. Fully responsive, refined non-AI aesthetic
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, getDoc, updateDoc, collection, getDocs,
  query, where, onSnapshot, addDoc, serverTimestamp, orderBy,
  arrayUnion
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

/* ─── Firebase ─────────────────────────────────────────────────── */
const FB = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyAeapcTRJDlShvPsBOFH0HsbySqSf7ZkU4",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "global-student-collaboration.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "global-student-collaboration",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "global-student-collaboration.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "519101802897",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:519101802897:web:d75bee7f31c9a882559230",
};
const app  = getApps().length ? getApps()[0] : initializeApp(FB);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─── Helpers ───────────────────────────────────────────────────── */
function makeAvatar(idx) {
  const hues = [200,180,220,260,160,280,140,300,170,240];
  const h = hues[(idx || 0) % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="hsl(${h},60%,10%)"/>
    <circle cx="32" cy="26" r="12" fill="hsl(${h},70%,50%)"/>
    <ellipse cx="32" cy="48" rx="16" ry="10" fill="hsl(${h},70%,40%)"/>
    <circle cx="32" cy="26" r="10" fill="hsl(${h},50%,68%)"/>
    <rect x="25" y="28" width="4" height="3" rx="1" fill="hsl(${h},25%,18%)"/>
    <rect x="35" y="28" width="4" height="3" rx="1" fill="hsl(${h},25%,18%)"/>
    <path d="M27 34 Q32 38 37 34" stroke="hsl(${h},25%,18%)" fill="none" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const getAv = (avatarField, photoURL) => {
  if (photoURL) return photoURL;
  const i = parseInt((avatarField || "0").replace(/\D/g, "")) - 1;
  return makeAvatar(isNaN(i) ? 0 : i);
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

async function logActivity(pid, uid, name, cat, desc, ref = "") {
  try {
    await addDoc(collection(db, "teamProjects", pid, "activity"), {
      uid, name, cat, desc, ref, createdAt: serverTimestamp()
    });
  } catch (_) {}
}

const KB_COLS = [
  { id: "todo",       label: "To Do",       color: "#6b7280", dot: "#9ca3af" },
  { id: "inprogress", label: "In Progress", color: "#0369a1", dot: "#0ea5e9" },
  { id: "review",     label: "In Review",   color: "#92400e", dot: "#f59e0b" },
  { id: "done",       label: "Done",        color: "#065f46", dot: "#10b981" },
];

async function callClaude(systemPrompt, userPrompt, maxTokens = 600) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "API error");
  return data.content?.map(b => b.text || "").join("") || "";
}

/* ─── File size formatter ──────────────────────────────────────── */
const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileExt = (name = "") => name.split(".").pop()?.toLowerCase() || "file";
const getFileIcon = (name = "") => {
  const ext = getFileExt(name);
  const map = { js:"JS", ts:"TS", jsx:"JSX", tsx:"TSX", py:"PY", html:"HTM", css:"CSS",
    json:"JSN", md:"MD", txt:"TXT", pdf:"PDF", png:"PNG", jpg:"IMG", jpeg:"IMG",
    gif:"GIF", svg:"SVG", zip:"ZIP", csv:"CSV", xlsx:"XLS", docx:"DOC" };
  return map[ext] || ext.slice(0,3).toUpperCase();
};

/* ─── Tabs ──────────────────────────────────────────────────────── */
const STUDENT_TABS = [
  { id: "overview",   icon: "⊞", label: "Overview",      group: "PROJECT" },
  { id: "tasks",      icon: "✓", label: "Tasks",          group: "PROJECT" },
  { id: "board",      icon: "⋮⋮", label: "Kanban Board",  group: "PROJECT" },
  { id: "files",      icon: "⊡", label: "Files",          group: "PROJECT" },
  { id: "code",       icon: "<>", label: "Code Editor",   group: "PROJECT" },
  // { id: "aitools",    icon: "✦", label: "AI Tools",       group: "TOOLS" },
  { id: "addmentor",  icon: "+", label: "Add Mentor",     group: "MENTOR" },
  { id: "qa",         icon: "?", label: "Ask Mentor",     group: "MENTOR", badge: true },
  { id: "feedback",   icon: "◈", label: "My Feedback",   group: "MENTOR" },
  { id: "sessions",   icon: "◷", label: "Sessions",       group: "COMMS" },
  { id: "call",       icon: "▷", label: "Voice & Video",  group: "COMMS" },
  { id: "activity",   icon: "∿", label: "Activity",       group: "COMMS" },
];

const MENTOR_TABS = [
  { id: "moverview",    icon: "⊞", label: "Team Overview",  group: "PROJECT" },
  { id: "mtasks",       icon: "✓", label: "Team Tasks",      group: "PROJECT" },
  { id: "mqa",          icon: "?", label: "Questions",       group: "MENTOR", badge: true },
  { id: "msuggestions", icon: "◈", label: "Suggestions",    group: "MENTOR" },
  { id: "mfeedback",    icon: "✦", label: "Give Feedback",  group: "MENTOR" },
  { id: "msessions",    icon: "◷", label: "Sessions",        group: "COMMS" },
  { id: "call",         icon: "▷", label: "Voice & Video",   group: "COMMS" },
  { id: "mactivity",    icon: "∿", label: "Activity",        group: "COMMS" },
];

/* ─── Global CSS ────────────────────────────────────────────────── */
const TEAM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body { font-family: 'Sora', sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
button { cursor: pointer; font-family: inherit; }
input, textarea, select { font-family: inherit; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--sb-thumb); border-radius: 4px; }

@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes popIn  { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes slideIn{ from { opacity: 0; transform: translateX(5px); } to { opacity: 1; transform: none; } }
@keyframes blink  { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

/* ── STUDENT (deep navy / electric blue) ── */
:root {
  --bg:       #0d1117;
  --bg2:      #161b22;
  --bg3:      #1c2330;
  --surface:  #1c2330;
  --surface2: #232d3f;
  --border:   rgba(255,255,255,0.07);
  --border2:  rgba(255,255,255,0.13);
  --text:     #e6edf3;
  --muted:    #8b949e;
  --dim:      #484f58;
  --accent:   #58a6ff;
  --accent2:  #79c0ff;
  --accent-bg:rgba(88,166,255,0.1);
  --accent-br:rgba(88,166,255,0.25);
  --green:    #3fb950;
  --teal:     #39d353;
  --amber:    #d29922;
  --red:      #f85149;
  --purple:   #bc8cff;
  --sb-w:     220px;
  --sb-c:     52px;
  --top-h:    52px;
  --sb-thumb: rgba(255,255,255,0.1);
  --sh-sm:    0 1px 3px rgba(0,0,0,0.3);
  --sh-md:    0 4px 16px rgba(0,0,0,0.4);
  --sh-lg:    0 8px 32px rgba(0,0,0,0.5);
  --rad:      10px;
  --radlg:    14px;
}

/* ── MENTOR (warm cream / teal) ── */
.mentor-mode {
  --bg:       #fafaf8;
  --bg2:      #f4f1ec;
  --bg3:      #ede8e0;
  --surface:  #ffffff;
  --surface2: #f9f7f3;
  --border:   rgba(0,0,0,0.07);
  --border2:  rgba(0,0,0,0.13);
  --text:     #1a1a1a;
  --muted:    #5a5a5a;
  --dim:      #999;
  --accent:   #0d7377;
  --accent2:  #14a085;
  --accent-bg:rgba(13,115,119,0.08);
  --accent-br:rgba(13,115,119,0.25);
  --green:    #0d7377;
  --teal:     #0d7377;
  --amber:    #b45309;
  --red:      #dc2626;
  --purple:   #7c3aed;
  --sb-thumb: rgba(0,0,0,0.12);
}
.mentor-mode .t-sb         { background: #1a2e2e; }
.mentor-mode .t-sb::before { background: linear-gradient(90deg,#0d7377,#14a085,#0d7377); }
.mentor-mode .t-sb-mark    { background: rgba(13,115,119,0.3); color: #5ee7d0; border-color: rgba(13,115,119,0.5); }
.mentor-mode .t-sb-lsub    { color: #5ee7d0; }
.mentor-mode .t-sb-grp     { color: rgba(94,231,208,0.3); }
.mentor-mode .t-sb-item.act{ background: rgba(13,115,119,0.2); border-color: rgba(13,115,119,0.35); }
.mentor-mode .t-sb-item.act .t-sb-ico,
.mentor-mode .t-sb-item:hover .t-sb-ico { color: #5ee7d0; }
.mentor-mode .t-sb-item.act .t-sb-lbl  { color: #5ee7d0; }
.mentor-mode .t-sb-urole   { color: #5ee7d0; }
.mentor-mode .t-sb-bdg     { background: rgba(13,115,119,0.3); color: #5ee7d0; }
.mentor-mode .t-abtn       { background: linear-gradient(135deg,#0d7377,#14a085); box-shadow: 0 2px 10px rgba(13,115,119,0.3); }
.mentor-mode .t-abtn:hover { box-shadow: 0 4px 18px rgba(13,115,119,0.4); }
.mentor-mode .t-student-pill { border-color: rgba(13,115,119,0.3); background: rgba(13,115,119,0.08); color: #0d7377; }
.mentor-mode .t-dot        { background: #0d7377; }

/* ── SHELL ── */
.t-shell { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }

/* ── SIDEBAR ── */
.t-sb {
  width: var(--sb-w); flex-shrink: 0;
  background: #0a0f1a;
  display: flex; flex-direction: column;
  transition: width 0.2s cubic-bezier(0.4,0,0.2,1);
  overflow: hidden; position: relative; z-index: 120;
  border-right: 1px solid var(--border);
}
.t-sb.col { width: var(--sb-c); }
.t-sb::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #58a6ff, #a5f3fc, #58a6ff);
  background-size: 200% 100%; animation: shimGrad 4s linear infinite; z-index: 1;
}
@keyframes shimGrad { 0%{background-position:0% 0} 100%{background-position:200% 0} }

@media (max-width: 768px) {
  .t-sb { position: fixed; top: 0; left: 0; bottom: 0; width: 260px !important; transform: translateX(-100%); z-index: 200; transition: transform 0.25s ease; }
  .t-sb.mob { transform: translateX(0); }
  .t-sb-cbtn { display: none !important; }
}
.t-mob-ov { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 190; backdrop-filter: blur(4px); }
@media (max-width: 768px) { .t-mob-ov.open { display: block; } }

.t-sb-logo {
  height: var(--top-h); display: flex; align-items: center; gap: 10px;
  padding: 0 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.t-sb-mark {
  width: 28px; height: 28px; background: rgba(88,166,255,0.15);
  border-radius: 8px; display: grid; place-items: center;
  font-size: 0.65rem; font-weight: 800; color: #79c0ff;
  border: 1px solid rgba(88,166,255,0.3); flex-shrink: 0;
}
.t-sb-ltxt {
  font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.88);
  letter-spacing: 0.02em; white-space: nowrap;
  transition: opacity 0.18s, width 0.18s;
}
.t-sb-lsub { font-family: 'JetBrains Mono', monospace; font-size: 0.42rem; color: #58a6ff; letter-spacing: 0.15em; display: block; }
.t-sb.col .t-sb-ltxt, .t-sb.col .t-sb-lsub { opacity: 0; width: 0; }

.t-sb-cbtn {
  position: absolute; right: -11px; top: 28px; width: 22px; height: 22px;
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 50%; display: grid; place-items: center;
  font-size: 0.55rem; color: var(--muted); z-index: 5;
  box-shadow: var(--sh-sm); transition: all 0.15s;
}
.t-sb-cbtn:hover { background: var(--surface2); }

.t-sb-scroll { flex: 1; overflow-y: auto; padding: 10px 8px; }
.t-sb-grp {
  font-family: 'JetBrains Mono', monospace; font-size: 0.42rem;
  letter-spacing: 0.18em; color: rgba(255,255,255,0.18);
  padding: 10px 10px 4px; text-transform: uppercase;
  transition: opacity 0.18s;
}
.t-sb.col .t-sb-grp { opacity: 0; }

.t-sb-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  border: 1px solid transparent; margin-bottom: 1px;
  cursor: pointer; transition: all 0.15s; user-select: none;
}
.t-sb-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.06); }
.t-sb-item.act { background: rgba(88,166,255,0.12); border-color: rgba(88,166,255,0.25); }

.t-sb-ico {
  width: 20px; text-align: center; font-size: 0.85rem; flex-shrink: 0;
  color: rgba(255,255,255,0.28); transition: color 0.15s; line-height: 1;
}
.t-sb-item.act .t-sb-ico, .t-sb-item:hover .t-sb-ico { color: #79c0ff; }

.t-sb-lbl {
  font-size: 0.76rem; font-weight: 500; color: rgba(255,255,255,0.45);
  white-space: nowrap; overflow: hidden;
  transition: opacity 0.18s, color 0.15s; width: 140px;
}
.t-sb-item.act .t-sb-lbl { color: #a5d6ff; font-weight: 600; }
.t-sb-item:hover .t-sb-lbl { color: rgba(255,255,255,0.85); }
.t-sb.col .t-sb-lbl { opacity: 0; width: 0; }
@media (max-width: 768px) { .t-sb-lbl { opacity: 1 !important; width: 140px !important; } }

.t-sb-bdg {
  margin-left: auto; font-family: 'JetBrains Mono', monospace;
  font-size: 0.48rem; font-weight: 700; padding: 2px 7px;
  border-radius: 10px; background: rgba(88,166,255,0.2); color: #79c0ff;
  flex-shrink: 0; border: 1px solid rgba(88,166,255,0.3);
}
.t-sb.col .t-sb-bdg { opacity: 0; }
.t-sb-sep { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 10px; }

.t-sb-foot { padding: 12px 10px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.t-sb-user { display: flex; align-items: center; gap: 9px; }
.t-sb-uav {
  width: 30px; height: 30px; border-radius: 50%; overflow: hidden;
  flex-shrink: 0; border: 1.5px solid rgba(88,166,255,0.4);
}
.t-sb-uav img { width: 100%; height: 100%; object-fit: cover; }
.t-sb-uinfo { overflow: hidden; transition: opacity 0.18s, width 0.18s; width: 120px; }
.t-sb.col .t-sb-uinfo { opacity: 0; width: 0; }
.t-sb-uname { font-size: 0.74rem; font-weight: 700; color: rgba(255,255,255,0.88); white-space: nowrap; }
.t-sb-urole { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: #58a6ff; margin-top: 2px; }

/* ── MAIN ── */
.t-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.t-topbar {
  height: var(--top-h); background: var(--bg2);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 clamp(14px,3vw,22px);
  gap: 10px; flex-shrink: 0; z-index: 10;
}
.t-mmb {
  display: none; background: none; border: 1px solid var(--border2);
  border-radius: 8px; width: 34px; height: 34px;
  align-items: center; justify-content: center; font-size: 1rem; color: var(--muted);
}
@media (max-width: 768px) { .t-mmb { display: flex; } }

.t-crumb {
  font-family: 'JetBrains Mono', monospace; font-size: 0.6rem;
  color: var(--muted); display: flex; align-items: center; gap: 6px; min-width: 0;
}
.t-crumb-r { cursor: pointer; transition: color 0.15s; }
.t-crumb-r:hover { color: var(--text); }
.t-crumb-c { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: clamp(80px,22vw,220px); }

.t-student-pill {
  display: flex; align-items: center; gap: 5px; padding: 4px 12px;
  border-radius: 20px; border: 1px solid var(--accent-br);
  background: var(--accent-bg); font-family: 'JetBrains Mono', monospace;
  font-size: 0.5rem; color: var(--accent); font-weight: 600; white-space: nowrap;
}
.t-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: pulse 2.5s ease-in-out infinite; }
.t-spacer { flex: 1; }
.t-content { flex: 1; overflow-y: auto; background: var(--bg); }
.t-page { padding: clamp(16px,4vw,28px); animation: fadeUp 0.25s ease; }

/* ── PAGE HEADER ── */
.t-ph { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; gap: 12px; flex-wrap: wrap; }
.t-ph-title {
  font-size: clamp(1.1rem,3vw,1.45rem); font-weight: 800; color: var(--text);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.2;
}
.t-ph-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: var(--dim); margin-top: 5px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }

/* ── PILLS / TAGS ── */
.t-pill { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; font-weight: 700; padding: 3px 9px; border-radius: 20px; border: 1px solid; white-space: nowrap; }
.t-pill-s { border-color: var(--accent-br); background: var(--accent-bg); color: var(--accent); }
.t-pill-a { border-color: rgba(13,163,148,0.25); background: rgba(13,163,148,0.08); color: #3fb950; }
.t-pill-m { border-color: rgba(210,153,34,0.3); background: rgba(210,153,34,0.07); color: var(--amber); }
.t-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; padding: 2px 8px; border-radius: 5px; border: 1px solid rgba(88,166,255,0.2); background: rgba(88,166,255,0.06); color: var(--accent); }
.t-tag.g { border-color: rgba(63,185,80,0.25); background: rgba(63,185,80,0.06); color: var(--green); }
.t-tag.a { border-color: rgba(210,153,34,0.25); background: rgba(210,153,34,0.07); color: var(--amber); }
.t-tag.r { border-color: rgba(248,81,73,0.25); background: rgba(248,81,73,0.06); color: var(--red); }
.t-tags { display: flex; flex-wrap: wrap; gap: 4px; }

/* ── STATS ── */
.t-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: clamp(8px,2vw,12px); margin-bottom: clamp(16px,4vw,22px); }
@media (max-width: 720px) { .t-stats-grid { grid-template-columns: repeat(2,1fr); } }
.t-stat {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radlg); padding: clamp(14px,3vw,20px);
  position: relative; overflow: hidden; transition: all 0.2s;
}
.t-stat:hover { box-shadow: var(--sh-md); transform: translateY(-1px); }
.t-stat-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.t-stat-lbl { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; letter-spacing: 0.12em; color: var(--dim); margin-bottom: 8px; text-transform: uppercase; }
.t-stat-val { font-size: clamp(1.6rem,3vw,2.1rem); font-weight: 800; color: var(--text); line-height: 1; }
.t-stat-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--muted); margin-top: 6px; }

/* ── SECTION HEADER ── */
.t-sh {
  font-family: 'JetBrains Mono', monospace; font-size: 0.5rem;
  color: var(--dim); letter-spacing: 0.16em; text-transform: uppercase;
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
}
.t-sh::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* ── CARDS ── */
.t-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radlg); padding: clamp(14px,3vw,20px); }
.t-two { display: grid; grid-template-columns: 1fr 280px; gap: clamp(12px,2vw,16px); margin-bottom: 22px; }
@media (max-width: 900px) { .t-two { grid-template-columns: 1fr; } }

/* ── PROGRESS ── */
.t-prog-row { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.t-prog-lbl { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: var(--muted); min-width: 90px; display: flex; align-items: center; gap: 6px; }
.t-prog-track { flex: 1; height: 5px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
.t-prog-fill { height: 100%; border-radius: 3px; transition: width 0.9s cubic-bezier(0.25,0.46,0.45,0.94); }
.t-prog-pct { font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; font-weight: 700; min-width: 34px; text-align: right; }

/* ── MEMBERS ── */
.t-mem-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,190px),1fr)); gap: 9px; }
.t-mem-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radlg); padding: 13px; display: flex; gap: 10px; transition: all 0.15s; }
.t-mem-card:hover { border-color: var(--border2); box-shadow: var(--sh-sm); }
.t-mem-av { width: 38px; height: 38px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--border2); }
.t-mem-av img { width: 100%; height: 100%; object-fit: cover; }
.t-mem-name { font-size: 0.75rem; font-weight: 700; color: var(--text); }
.t-mem-role { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: var(--dim); margin: 2px 0 6px; }
.t-mem-p { height: 3px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
.t-mem-pf { height: 100%; background: linear-gradient(90deg, var(--accent), #a5f3fc); border-radius: 2px; }
.t-mem-pl { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; color: var(--dim); margin-top: 4px; }

/* ── TASKS ── */
.t-task-row {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 9px; padding: 10px 13px; flex-wrap: wrap;
  transition: all 0.15s; margin-bottom: 5px;
}
.t-task-row:hover { border-color: var(--border2); box-shadow: var(--sh-sm); }
.t-task-row.done { opacity: 0.45; }
.t-chk { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid; display: grid; place-items: center; flex-shrink: 0; cursor: pointer; transition: all 0.15s; }
.t-chk.done { background: var(--green); border-color: var(--green); }
.t-chk.open { border-color: var(--border2); }
.t-chk.open:hover { border-color: var(--green); }
.t-task-txt { flex: 1; font-size: 0.8rem; color: var(--text); min-width: 80px; }
.t-task-txt.done { text-decoration: line-through; color: var(--dim); }
.t-task-who { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--muted); white-space: nowrap; }
.t-pri { font-family: 'JetBrains Mono', monospace; font-size: 0.44rem; padding: 2px 7px; border-radius: 4px; border: 1px solid; flex-shrink: 0; }
.t-pri-h { border-color: rgba(248,81,73,0.3); background: rgba(248,81,73,0.06); color: var(--red); }
.t-pri-m { border-color: rgba(210,153,34,0.3); background: rgba(210,153,34,0.07); color: var(--amber); }
.t-pri-l { border-color: rgba(63,185,80,0.25); background: rgba(63,185,80,0.06); color: var(--green); }

/* ── KANBAN ── */
.t-kb { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
@media (max-width: 900px) { .t-kb { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 500px) { .t-kb { grid-template-columns: 1fr; } }
.t-kb-col { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radlg); display: flex; flex-direction: column; min-height: 160px; }
.t-kb-hd { padding: 10px 13px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }
.t-kb-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.t-kb-title { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
.t-kb-cnt { font-family: 'JetBrains Mono', monospace; font-size: 0.46rem; padding: 1px 7px; border-radius: 10px; background: var(--bg); color: var(--dim); margin-left: auto; border: 1px solid var(--border); }
.t-kb-body { flex: 1; padding: 7px; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; }
.t-kb-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px; animation: slideIn 0.2s ease; }
.t-kb-ct { font-size: 0.74rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.t-kb-cm { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.t-kb-cav { width: 15px; height: 15px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border); }
.t-kb-cav img { width: 100%; height: 100%; object-fit: cover; }
.t-kb-cn { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: var(--dim); }

/* ── FILES ── */
.t-file-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 9px; padding: 11px 14px; margin-bottom: 7px; transition: all 0.15s;
}
.t-file-row:hover { border-color: var(--border2); box-shadow: var(--sh-sm); }
.t-file-ico {
  width: 34px; height: 34px; border-radius: 8px;
  background: var(--accent-bg); border: 1px solid var(--accent-br);
  display: grid; place-items: center; font-family: 'JetBrains Mono', monospace;
  font-size: 0.48rem; color: var(--accent); flex-shrink: 0; font-weight: 700;
}
.t-file-name { font-size: 0.8rem; font-weight: 600; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-file-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--dim); white-space: nowrap; }

/* ── Q&A ── */
.t-q-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radlg); padding: 14px 16px; margin-bottom: 10px; animation: slideIn 0.2s ease; }
.t-q-item.has-r { border-left: 3px solid var(--green); }
.t-q-item.unanswered { border-left: 3px solid var(--amber); }
.t-q-text { font-size: 0.84rem; font-weight: 600; color: var(--text); margin-bottom: 5px; line-height: 1.55; }
.t-q-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: var(--dim); display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 9px; }
.t-q-reply { background: rgba(63,185,80,0.05); border: 1px solid rgba(63,185,80,0.18); border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
.t-q-rby { font-family: 'JetBrains Mono', monospace; font-size: 0.48rem; color: var(--green); font-weight: 700; margin-bottom: 4px; }
.t-q-rtxt { font-size: 0.74rem; color: var(--muted); line-height: 1.65; }

/* ── FEEDBACK ── */
.t-fb-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--teal); border-radius: 0 10px 10px 0; padding: 13px 15px; margin-bottom: 10px; }
.t-fb-from { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--teal); font-weight: 700; margin-bottom: 5px; }
.t-fb-txt { font-size: 0.76rem; color: var(--muted); line-height: 1.65; }
.t-fb-rat { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--amber); margin-top: 5px; }

/* ── INPUTS — FIX: stable, no re-render flicker ── */
.t-input {
  flex: 1; min-width: 120px; padding: 9px 13px;
  background: var(--surface2); border: 1px solid var(--border2);
  border-radius: 9px; color: var(--text); font-size: 0.8rem;
  outline: none; transition: border-color 0.18s, box-shadow 0.18s;
  appearance: none; -webkit-appearance: none;
}
.t-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,166,255,0.12); }
.t-input::placeholder { color: var(--dim); }

.t-sel {
  padding: 9px 11px; background: var(--surface2); border: 1px solid var(--border2);
  border-radius: 9px; color: var(--text); font-size: 0.72rem;
  outline: none; cursor: pointer; transition: border-color 0.18s;
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b949e'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
}
.t-sel:focus { border-color: var(--accent); }
.t-sel option { background: var(--surface); }

.t-ta {
  width: 100%; min-height: 82px; padding: 10px 13px;
  background: var(--surface2); border: 1px solid var(--border2);
  border-radius: 9px; color: var(--text); font-size: 0.8rem;
  outline: none; resize: vertical; transition: border-color 0.18s, box-shadow 0.18s;
  line-height: 1.7; appearance: none;
}
.t-ta:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,166,255,0.12); }
.t-ta::placeholder { color: var(--dim); }

/* ── BUTTONS ── */
.t-btn {
  padding: 9px 16px; border: none; border-radius: 9px;
  background: var(--surface2); border: 1px solid var(--border2);
  color: var(--text); font-size: 0.72rem; font-weight: 600;
  transition: all 0.15s; white-space: nowrap;
}
.t-btn:hover { background: var(--bg3); border-color: var(--border2); }
.t-btn:disabled { opacity: 0.45; cursor: default; }

.t-abtn {
  padding: 9px 18px; border: none; border-radius: 9px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: #fff; font-size: 0.74rem; font-weight: 700;
  transition: all 0.18s; box-shadow: 0 2px 10px rgba(37,99,235,0.3);
  white-space: nowrap;
}
.t-abtn:hover { box-shadow: 0 4px 18px rgba(37,99,235,0.45); transform: translateY(-1px); }
.t-abtn:disabled { opacity: 0.45; transform: none; cursor: default; }

/* ── ACTIVITY ── */
.t-act-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.t-act-item:last-child { border-bottom: none; }
.t-act-av { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1px solid var(--border2); }
.t-act-av img { width: 100%; height: 100%; object-fit: cover; }
.t-act-chip { font-family: 'JetBrains Mono', monospace; font-size: 0.42rem; padding: 2px 7px; border-radius: 4px; margin-left: auto; align-self: flex-start; flex-shrink: 0; border: 1px solid; white-space: nowrap; }
.t-chip-task  { background: rgba(88,166,255,0.06); border-color: rgba(88,166,255,0.2); color: var(--accent); }
.t-chip-file  { background: rgba(188,140,255,0.06); border-color: rgba(188,140,255,0.2); color: var(--purple); }
.t-chip-code  { background: rgba(63,185,80,0.06); border-color: rgba(63,185,80,0.2); color: var(--green); }
.t-chip-mentor{ background: rgba(210,153,34,0.06); border-color: rgba(210,153,34,0.2); color: var(--amber); }

/* ── TOAST ── */
.t-toast {
  position: fixed; bottom: 20px; right: clamp(12px,4vw,20px);
  background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 10px; padding: 11px 18px;
  font-family: 'JetBrains Mono', monospace; font-size: 0.64rem;
  color: var(--text); z-index: 400; animation: popIn 0.2s ease;
  max-width: calc(100vw - 24px); box-shadow: var(--sh-lg);
}

/* ── MODAL ── */
.t-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  z-index: 300; display: flex; align-items: center; justify-content: center;
  padding: 16px; backdrop-filter: blur(6px);
}
.t-modal {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 16px; padding: clamp(18px,4vw,28px);
  width: 100%; max-width: 520px; position: relative;
  max-height: 90vh; overflow-y: auto; animation: popIn 0.18s ease;
  box-shadow: var(--sh-lg);
}
.t-modal-title { font-size: 1rem; font-weight: 800; color: var(--text); margin-bottom: 4px; }
.t-modal-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; color: var(--dim); margin-bottom: 18px; }
.t-modal-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: var(--muted); font-size: 1.2rem; transition: color 0.15s; }
.t-modal-close:hover { color: var(--text); }
.t-modal-lbl { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--dim); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 5px; }
.t-modal-inp {
  width: 100%; padding: 10px 13px;
  background: var(--bg); border: 1px solid var(--border2);
  border-radius: 9px; color: var(--text); font-size: 0.82rem;
  outline: none; margin-bottom: 14px; transition: border-color 0.18s, box-shadow 0.18s;
  appearance: none;
}
.t-modal-inp:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,166,255,0.12); }
.t-modal-inp::placeholder { color: var(--dim); }
.t-modal-sub-btn {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #a5d6ff);
  color: var(--bg); font-size: 0.78rem; font-weight: 800;
  transition: all 0.15s; cursor: pointer;
}
.t-modal-sub-btn:hover { box-shadow: var(--sh-md); }
.t-modal-sub-btn:disabled { opacity: 0.5; cursor: default; }

/* ── EMPTY / SPINNER ── */
.t-empty { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: var(--dim); text-align: center; padding: clamp(20px,5vw,36px); }
.t-spinner { width: 22px; height: 22px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }

/* ── CODE EDITOR ── */
.code-editor-wrap { background: #090d14; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; }
.code-editor-header { background: #0d1321; padding: 8px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.code-editor-dots { display: flex; gap: 5px; }
.code-editor-dot { width: 10px; height: 10px; border-radius: 50%; }
.code-editor-tab { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: var(--muted); padding: 3px 10px; border-radius: 5px; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.code-editor-tab.active { color: #e6edf3; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
.code-editor-textarea { width: 100%; min-height: 300px; max-height: 520px; padding: 16px; background: transparent; border: none; outline: none; color: #e6edf3; font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; line-height: 1.75; resize: vertical; caret-color: #58a6ff; }
.code-editor-footer { background: #0d1321; padding: 7px 14px; display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.06); }
.code-preview-pre { color: #e6edf3; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; line-height: 1.7; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto; margin: 0; }

/* ── MENTOR ── */
.mentor-discover-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,256px),1fr)); gap: 12px; }
.mentor-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radlg); padding: 16px; transition: all 0.15s; }
.mentor-card:hover { border-color: var(--border2); box-shadow: var(--sh-sm); }
.mentor-card-av { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border2); }
.mentor-card-av img { width: 100%; height: 100%; object-fit: cover; }
.mentor-card-name { font-size: 0.82rem; font-weight: 700; color: var(--text); }
.mentor-card-role { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--dim); margin: 3px 0 7px; }
.mentor-card-bio { font-size: 0.72rem; color: var(--muted); line-height: 1.6; margin-bottom: 12px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* ── VC ── */
.vc-outer-grid { display: grid; grid-template-columns: 1fr 300px; gap: 14px; }
@media (max-width: 900px) { .vc-outer-grid { grid-template-columns: 1fr !important; } }

/* ── AI TOOLS ── */
.ai-result-pre { padding: 16px; font-family: inherit; font-size: 0.78rem; color: var(--text); line-height: 1.85; white-space: pre-wrap; word-break: break-word; max-height: 480px; overflow-y: auto; margin: 0; }

/* ── SUGGESTION ── */
.suggestion-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; padding: 14px 16px; margin-bottom: 10px; animation: slideIn 0.2s ease; }
.suggestion-card.resolved { opacity: 0.5; border-left-color: var(--green); }
.suggestion-from { font-family: 'JetBrains Mono', monospace; font-size: 0.5rem; color: var(--accent); font-weight: 700; margin-bottom: 4px; }
.suggestion-txt { font-size: 0.78rem; color: var(--text); line-height: 1.65; }

/* ── MENTOR BANNER ── */
.mentor-banner { background: linear-gradient(135deg, #0d7377, #0f4c75); border-radius: var(--radlg); padding: 18px 22px; margin-bottom: 22px; color: #fff; display: flex; align-items: center; gap: 15px; }
.mentor-banner-icon { font-size: 2rem; flex-shrink: 0; }
.mentor-banner-title { font-size: 1rem; font-weight: 800; margin-bottom: 3px; }
.mentor-banner-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; opacity: 0.8; }

/* ── FILE UPLOAD AREA ── */
.file-drop-zone {
  border: 2px dashed var(--border2); border-radius: 12px;
  padding: 28px 20px; text-align: center; cursor: pointer;
  transition: all 0.2s; background: var(--bg);
}
.file-drop-zone:hover, .file-drop-zone.drag { border-color: var(--accent); background: var(--accent-bg); }
.file-drop-icon { font-size: 2rem; margin-bottom: 8px; display: block; }
.file-drop-txt { font-size: 0.8rem; color: var(--muted); margin-bottom: 4px; }
.file-drop-hint { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: var(--dim); }
.file-selected { display: flex; align-items: center; gap: 10px; background: var(--accent-bg); border: 1px solid var(--accent-br); border-radius: 9px; padding: 10px 14px; margin-top: 10px; }
.file-selected-name { font-size: 0.78rem; font-weight: 600; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-selected-size { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: var(--dim); white-space: nowrap; }
.file-remove { background: none; border: none; color: var(--red); font-size: 1rem; cursor: pointer; flex-shrink: 0; }

/* ── RESPONSIVE ADJUSTMENTS ── */
@media (max-width: 480px) {
  .t-stats-grid { grid-template-columns: 1fr 1fr; }
  .t-stat-val { font-size: 1.4rem; }
  .t-ph-title { font-size: 1rem; }
  .t-page { padding: 14px; }
}
`;

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function TeamDashboard() {
  const { projectId } = useParams();
  const nav = useNavigate();

  const [user, setUser]           = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [project, setProject]     = useState(null);
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isMentor, setIsMentor]   = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobOpen, setMobOpen]     = useState(false);
  const [toast, setToast]         = useState("");

  // shared data
  const [tasks, setTasks]             = useState([]);
  const [activity, setActivity]       = useState([]);
  const [files, setFiles]             = useState([]);
  const [codeFiles, setCodeFiles]     = useState([]);
  const [vcMsgs, setVcMsgs]           = useState([]);
  const [questions, setQuestions]     = useState([]);
  const [qReplies, setQReplies]       = useState({});
  const [feedbacks, setFeedbacks]     = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // add mentor
  const [allMentors, setAllMentors]     = useState([]);
  const [mentorSearch, setMentorSearch] = useState("");
  const [sentRequests, setSentRequests] = useState([]);

  // tasks — use refs to avoid cursor glitch
  const newTaskTextRef   = useRef("");
  const newTaskAssignRef = useRef("");
  const newTaskPriRef    = useRef("medium");
  const [taskKey, setTaskKey]     = useState(0); // force re-render only when needed
  const [taskSaving, setTaskSaving] = useState(false);

  // Q&A
  const newQuestionRef  = useRef("");
  const [qKey, setQKey] = useState(0);
  const [qSaving, setQSaving]     = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [replySaving, setReplySaving] = useState({});

  // files — NEW: real PC file upload
  const [uploadModal, setUploadModal]       = useState(false);
  const [uploadName, setUploadName]         = useState("");
  const [uploadFile, setUploadFile]         = useState(null); // actual File object
  const [uploadContent, setUploadContent]   = useState("");   // base64 or text
  const [uploadMimeType, setUploadMimeType] = useState("");
  const [uploadSaving, setUploadSaving]     = useState(false);
  const [isDragging, setIsDragging]         = useState(false);
  const fileInputRef = useRef(null);

  // code editor
  const codeEditorRef  = useRef("");
  const [codeEditorVal, setCodeEditorVal] = useState("");
  const commitMsgRef   = useRef("");
  const [commitLang, setCommitLang]       = useState("javascript");
  const [commitSaving, setCommitSaving]   = useState(false);
  const [expandedCode, setExpandedCode]   = useState(null);

  // sessions
  const [sessionModal, setSessionModal] = useState(false);
  const [reqMessage, setReqMessage]     = useState("");
  const [reqMode, setReqMode]           = useState("video");

  // VC
  const vcInputRef = useRef("");
  const [vcInputVal, setVcInputVal] = useState("");
  const [callMode, setCallMode]     = useState("idle");
  const vcEndRef = useRef(null);
  const listenersRef = useRef([]);

  // mentor actions
  const suggestionRef   = useRef("");
  const [suggKey, setSuggKey] = useState(0);
  const [suggSaving, setSuggSaving] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [fbTarget, setFbTarget]   = useState("");
  const [fbText, setFbText]       = useState("");
  const [fbRating, setFbRating]   = useState("good");
  const [fbSaving, setFbSaving]   = useState(false);

  // AI
  // const [aiTool, setAiTool]       = useState("taskgen");
  // const [aiLoading, setAiLoading] = useState(false);
  // const [aiResult, setAiResult]   = useState("");
  // const [aiError, setAiError]     = useState("");
  const [projDesc, setProjDesc]   = useState("");
  const [numTasks, setNumTasks]   = useState("5");
  const [codeInput, setCodeInput] = useState("");
  const [codeLang, setCodeLang]   = useState("javascript");
  const [qaQuestion, setQaQuestion] = useState("");
  const [fbContext, setFbContext]   = useState("");
  const [fbTone, setFbTone]         = useState("constructive");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }, []);

  const selectTab = useCallback((id) => {
    setActiveTab(id);
    setMobOpen(false);
  }, []);

  useEffect(() => () => listenersRef.current.forEach(u => u()), []);

  // Auth + initial load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const [pSnap, prSnap, mentorSnap] = await Promise.all([
        getDoc(doc(db, "teamProjects", projectId)),
        getDoc(doc(db, "users", u.uid)),
        getDoc(doc(db, "mentors", u.uid)),
      ]);
      if (!pSnap.exists()) { setLoading(false); return; }
      const pd = pSnap.data();
      setProject(pd);
      const mentorRole  = mentorSnap.exists() && mentorSnap.data().profileComplete;
      const inMentorList = (pd.mentorMembers || []).includes(u.uid);
      const isM = mentorRole || inMentorList;
      setIsMentor(isM);
      setActiveTab(isM ? "moverview" : "overview");
      const profiles = await Promise.all(
        (pd.members || []).map(async (id) => {
          const s = await getDoc(doc(db, "users", id));
          return s.exists() ? { id, ...s.data() } : { id, fullName: "Member" };
        })
      );
      setMembers(profiles);
      if (prSnap.exists()) setMyProfile(prSnap.data());
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  // Realtime listeners
  useEffect(() => {
    if (!projectId) return;
    const u1 = onSnapshot(doc(db, "teamProjects", projectId), (snap) => {
      if (snap.exists()) { const d = snap.data(); setProject(d); setTasks(d.tasks || []); }
    });
    const u2 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "activity"), orderBy("createdAt", "desc")),
      (snap) => setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "files"), orderBy("createdAt", "desc")),
      (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.isAsset);
        setFiles(all.filter(f => !f.isCode));
        setCodeFiles(all.filter(f => f.isCode));
      }
    );
    const u4 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "vcChat"), orderBy("createdAt", "asc")),
      (snap) => setVcMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u5 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "questions"), orderBy("createdAt", "desc")),
      (snap) => {
        const qs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setQuestions(qs);
        qs.forEach(q => {
          const ur = onSnapshot(
            query(collection(db, "teamProjects", projectId, "questions", q.id, "replies"), orderBy("createdAt", "asc")),
            (rSnap) => setQReplies(prev => ({ ...prev, [q.id]: rSnap.docs.map(rd => ({ id: rd.id, ...rd.data() })) }))
          );
          listenersRef.current.push(ur);
        });
      }
    );
    const u6 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "suggestions"), orderBy("createdAt", "desc")),
      (snap) => setSuggestions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    listenersRef.current.push(u1, u2, u3, u4, u5, u6);
    return () => { listenersRef.current.forEach(u => u()); listenersRef.current = []; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !user) return;
    const u1 = onSnapshot(
      query(collection(db, "teamProjects", projectId, "mentorFeedback"), where("toId", "==", user.uid)),
      (snap) => setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(
      query(collection(db, "mentorRequests"), where("projectId", "==", projectId), where("studentId", "==", user.uid)),
      (snap) => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); };
  }, [projectId, user]);

  useEffect(() => {
    getDocs(collection(db, "mentors")).then(snap => {
      setAllMentors(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.profileComplete));
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, "mentorRequests"), where("projectId", "==", projectId));
    const unsub = onSnapshot(q, (snap) => setSentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [projectId]);

  useEffect(() => { vcEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [vcMsgs]);

  // Derived
  const donePct       = tasks.length ? Math.round(tasks.filter(t => t.done).length / tasks.length * 100) : 0;
  const myTasks       = tasks.filter(t => t.assignedTo === user?.uid);
  const answeredQ     = questions.filter(q => (qReplies[q.id] || []).length > 0);
  const unansweredBadge = isMentor
    ? questions.filter(q => !(qReplies[q.id] || []).length).length
    : questions.filter(q => !(qReplies[q.id] || []).length && q.askedBy === user?.uid).length;
  const currentMentors = project?.mentorMembers || [];

  /* ─── File Upload Helpers ─────────────────────────────────────── */
  const handleFilePick = (file) => {
    if (!file) return;
    setUploadFile(file);
    if (!uploadName) setUploadName(file.name);
    const isText = file.type.startsWith("text/") || /\.(js|ts|jsx|tsx|py|html|css|json|md|txt|csv|xml|sh|yml|yaml)$/i.test(file.name);
    if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => { setUploadContent(e.target.result); setUploadMimeType("text"); };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { setUploadContent(e.target.result); setUploadMimeType(file.type || "binary"); };
      reader.readAsDataURL(file);
    }
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFilePick(file);
  };

  const resetUploadModal = () => {
    setUploadModal(false); setUploadName(""); setUploadFile(null);
    setUploadContent(""); setUploadMimeType(""); setIsDragging(false);
  };

  /* ─── Actions ─────────────────────────────────────────────────── */
  const addTask = useCallback(async () => {
    const text = newTaskTextRef.current.trim();
    if (!text) { showToast("Enter a task name"); return; }
    setTaskSaving(true);
    const assignId   = newTaskAssignRef.current;
    const assignee   = members.find(m => m.id === assignId);
    await updateDoc(doc(db, "teamProjects", projectId), {
      tasks: arrayUnion({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text, done: false,
        assignedTo: assignId || "", assignedName: assignee?.fullName || "Unassigned",
        priority: newTaskPriRef.current || "medium", status: "todo", createdAt: Date.now()
      })
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", `added task: ${text}`, "");
    newTaskTextRef.current = "";
    newTaskAssignRef.current = "";
    newTaskPriRef.current = "medium";
    setTaskKey(k => k + 1);
    setTaskSaving(false);
    showToast("Task added ✓");
  }, [members, projectId, user, myProfile, showToast]);

  const toggleTask = useCallback(async (task) => {
    const updated = tasks.map(t => t.id === task.id
      ? { ...t, done: !t.done, status: !t.done ? "done" : t.status === "done" ? "todo" : t.status }
      : t);
    await updateDoc(doc(db, "teamProjects", projectId), { tasks: updated });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", task.done ? "reopened" : "completed task", task.text.slice(0, 40));
  }, [tasks, projectId, user, myProfile]);

  const moveTask = useCallback(async (task, newStatus) => {
    const updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus, done: newStatus === "done" } : t);
    await updateDoc(doc(db, "teamProjects", projectId), { tasks: updated });
  }, [tasks, projectId]);

  const askQuestion = useCallback(async () => {
    const text = newQuestionRef.current.trim();
    if (!text) return;
    setQSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "questions"), {
      text, askedBy: user.uid, askedByName: myProfile?.fullName || "Member",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      resolved: false, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", "asked a question", text.slice(0, 40));
    newQuestionRef.current = "";
    setQKey(k => k + 1);
    setQSaving(false);
    showToast("Question posted to mentor");
  }, [projectId, user, myProfile, showToast]);

  const replyToQuestion = useCallback(async (qId) => {
    const text = (replyTexts[qId] || "").trim();
    if (!text) return;
    setReplySaving(p => ({ ...p, [qId]: true }));
    await addDoc(collection(db, "teamProjects", projectId, "questions", qId, "replies"), {
      text, mentorName: myProfile?.fullName || "Mentor",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      mentorId: user.uid, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "mentor", "replied to a question", text.slice(0, 40));
    setReplyTexts(p => ({ ...p, [qId]: "" }));
    setReplySaving(p => ({ ...p, [qId]: false }));
    showToast("Reply posted");
  }, [replyTexts, projectId, user, myProfile, showToast]);

  const doUploadFile = useCallback(async () => {
    if (!uploadName.trim()) { showToast("Add a file name"); return; }
    if (!uploadContent && !uploadFile) { showToast("Select a file first"); return; }
    setUploadSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "files"), {
      name: uploadName.trim(),
      content: uploadContent,
      mimeType: uploadMimeType,
      fileSize: uploadFile?.size || 0,
      upBy: myProfile?.fullName || "Member",
      upById: user.uid,
      isCode: false,
      createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "file", `uploaded ${uploadName}`, "");
    setUploadSaving(false);
    resetUploadModal();
    showToast("File uploaded ✓");
  }, [uploadName, uploadContent, uploadFile, uploadMimeType, projectId, user, myProfile, showToast]);

  const commitCode = useCallback(async () => {
    const code = codeEditorRef.current;
    const msg  = commitMsgRef.current.trim();
    if (!code.trim() || !msg) { showToast("Add code and a commit message"); return; }
    setCommitSaving(true);
    const extMap = { javascript:"js", typescript:"ts", python:"py", html:"html", css:"css" };
    const fname = `${msg.replace(/\s+/g,"_").slice(0,24)}_${Date.now()}.${extMap[commitLang] || "txt"}`;
    await addDoc(collection(db, "teamProjects", projectId, "files"), {
      name: fname, content: code, commitMsg: msg,
      upBy: myProfile?.fullName || "Member", upById: user.uid,
      language: commitLang, isCode: true, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "code", `committed: ${msg}`, fname);
    commitMsgRef.current = "";
    setCodeEditorVal(v => v); // no-op just to keep state
    setCommitSaving(false);
    showToast("Code committed! ✓");
  }, [commitLang, projectId, user, myProfile, showToast]);

  const requestSession = useCallback(async () => {
    if (!currentMentors.length) { showToast("Add a mentor first"); return; }
    await addDoc(collection(db, "mentorRequests"), {
      projectId, projectName: project?.projectName || "Project",
      studentId: user.uid, studentName: myProfile?.fullName || "Member",
      mentorId: currentMentors[0], message: reqMessage,
      mode: reqMode, status: "pending", type: "session", createdAt: serverTimestamp()
    });
    setReqMessage(""); setSessionModal(false);
    showToast("Session requested!");
  }, [currentMentors, projectId, project, user, myProfile, reqMessage, reqMode, showToast]);

  const sendMentorRequest = useCallback(async (mentor) => {
    const already = sentRequests.find(r => r.mentorId === mentor.id && r.type === "join");
    if (already) { showToast("Request already sent"); return; }
    if (currentMentors.includes(mentor.id)) { showToast("Already a mentor"); return; }
    await addDoc(collection(db, "mentorRequests"), {
      projectId, projectName: project?.projectName || "Project",
      studentId: user.uid, studentName: myProfile?.fullName || "Member",
      mentorId: mentor.id, mentorName: mentor.fullName || "Mentor",
      type: "join", status: "pending", createdAt: serverTimestamp()
    });
    showToast(`Request sent to ${mentor.fullName}`);
  }, [sentRequests, currentMentors, projectId, project, user, myProfile, showToast]);

  const sendVcMsg = useCallback(async () => {
    const text = vcInputRef.current.trim();
    if (!text) return;
    await addDoc(collection(db, "teamProjects", projectId, "vcChat"), {
      text, userId: user.uid, userName: myProfile?.fullName || "Member",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      isMentor, createdAt: serverTimestamp()
    });
    vcInputRef.current = "";
    setVcInputVal("");
  }, [projectId, user, myProfile, isMentor]);

  const postSuggestion = useCallback(async () => {
    const text = suggestionRef.current.trim();
    if (!text) return;
    setSuggSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "suggestions"), {
      text, mentorId: user.uid, mentorName: myProfile?.fullName || "Mentor",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      resolved: false, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "mentor", "posted a suggestion", text.slice(0, 40));
    suggestionRef.current = "";
    setSuggKey(k => k + 1);
    setSuggSaving(false);
    showToast("Suggestion posted");
  }, [projectId, user, myProfile, showToast]);

  const markSuggestionResolved = useCallback(async (sId) => {
    await updateDoc(doc(db, "teamProjects", projectId, "suggestions", sId), { resolved: true });
    showToast("Marked resolved");
  }, [projectId, showToast]);

  const submitFeedback = useCallback(async () => {
    if (!fbText.trim() || !fbTarget) { showToast("Choose a member and write feedback"); return; }
    setFbSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "mentorFeedback"), {
      toId: fbTarget, toName: members.find(m => m.id === fbTarget)?.fullName || "Member",
      mentorId: user.uid, mentorName: myProfile?.fullName || "Mentor",
      text: fbText.trim(), rating: fbRating, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "mentor", "gave feedback", fbText.slice(0, 40));
    setFbText(""); setFbTarget(""); setFbRating("good"); setFbSaving(false); setFeedbackModal(false);
    showToast("Feedback sent ✓");
  }, [fbText, fbTarget, fbRating, members, projectId, user, myProfile, showToast]);

  // const runAI = useCallback(async () => {
  //   setAiLoading(true); setAiResult(""); setAiError("");
  //   try {
  //     let out = "";
  //     if (aiTool === "taskgen") {
  //       const description = projDesc.trim() || tasks.slice(0, 5).map(t => t.text).join(", ") || "a student team project";
  //       out = await callClaude(
  //         "You are a project management assistant. Generate clear, actionable task breakdowns for student teams.",
  //         `Generate ${numTasks} specific tasks for: "${description}". Format: • [Title] — [description]`, 800
  //       );
  //     } else if (aiTool === "coderev") {
  //       if (!codeInput.trim()) { setAiError("Paste some code first."); setAiLoading(false); return; }
  //       out = await callClaude(
  //         "You are a senior engineer doing concise code reviews.",
  //         `Review this ${codeLang} code:\n\`\`\`${codeLang}\n${codeInput.slice(0, 3000)}\n\`\`\`\nGive: 1. Summary 2. Issues 3. Improvements 4. Positives`, 900
  //       );
  //     } else if (aiTool === "qaassist") {
  //       if (!qaQuestion.trim()) { setAiError("Enter a question."); setAiLoading(false); return; }
  //       out = await callClaude(
  //         "You are a knowledgeable mentor assistant for student project teams.",
  //         `A student asks: "${qaQuestion}"\nContext: ${tasks.slice(0, 5).map(t => t.text).join("; ") || "general project"}\nGive a direct, educational answer with a practical next step.`, 700
  //       );
  //     } else if (aiTool === "fbdraft") {
  //       out = await callClaude(
  //         "You help write constructive feedback for student project teams.",
  //         `Draft ${fbTone} feedback. Context: ${fbContext || `Team of ${members.length}, ${tasks.filter(t => t.done).length}/${tasks.length} tasks done`}\nWrite 2-3 paragraphs: specific, balanced, motivating.`, 600
  //       );
  //     }
  //     setAiResult(out);
  //   } catch (e) {
  //     setAiError("AI request failed: " + (e.message || "Unknown error"));
  //   }
  //   setAiLoading(false);
  // }, [aiTool, projDesc, numTasks, codeInput, codeLang, qaQuestion, fbTone, fbContext, tasks, members]);

  /* ──────────────────────────────────────────────────────────────
     STUDENT PANELS
  ─────────────────────────────────────────────────────────────── */
  const TOverview = () => (
    <div className="t-page">
      <div className="t-ph">
        <div>
          <div className="t-ph-title">
            {project.projectName || "Untitled"}
            <span className="t-pill t-pill-s">Team View</span>
            <span className="t-pill t-pill-a">Active</span>
          </div>
          <div className="t-ph-sub">
            <span>{members.length} members</span><span>·</span>
            <span>{donePct}% complete</span><span>·</span>
            <span>{myTasks.filter(t => !t.done).length} open tasks</span>
            {currentMentors.length > 0 && <><span>·</span><span style={{ color: "var(--green)" }}>{currentMentors.length} mentor{currentMentors.length > 1 ? "s" : ""}</span></>}
          </div>
        </div>
        <div className="t-tags">
          {project.domain && <span className="t-tag">{project.domain}</span>}
          {(project.techStack || project.skills || []).slice(0, 3).map(t => <span key={t} className="t-tag g">{t}</span>)}
        </div>
      </div>

      <div className="t-stats-grid">
        {[
          { label: "My Tasks",   val: myTasks.length,   sub: `${myTasks.filter(t => t.done).length} done`,  bar: "#58a6ff" },
          { label: "Team Tasks", val: tasks.length,     sub: `${donePct}% complete`,                         bar: "#3fb950" },
          { label: "Questions",  val: questions.length, sub: `${answeredQ.length} answered`,                 bar: "#d29922" },
          { label: "Feedback",   val: feedbacks.length, sub: "from mentor",                                  bar: "#bc8cff" },
        ].map((s, i) => (
          <div key={i} className="t-stat">
            <div className="t-stat-bar" style={{ background: s.bar }} />
            <div className="t-stat-lbl">{s.label}</div>
            <div className="t-stat-val">{s.val}</div>
            <div className="t-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="t-two">
        <div>
          <div className="t-card" style={{ marginBottom: 14 }}>
            <div className="t-sh">Progress</div>
            <div className="t-prog-row">
              <div className="t-prog-lbl">Overall</div>
              <div className="t-prog-track"><div className="t-prog-fill" style={{ width: `${donePct}%`, background: "linear-gradient(90deg,#1d4ed8,#3b82f6)" }} /></div>
              <div className="t-prog-pct" style={{ color: "#58a6ff" }}>{donePct}%</div>
            </div>
            {KB_COLS.map(col => {
              const cnt = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status)).length;
              const pct = tasks.length ? Math.round(cnt / tasks.length * 100) : 0;
              return (
                <div key={col.id} className="t-prog-row">
                  <div className="t-prog-lbl">
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                    {col.label}
                  </div>
                  <div className="t-prog-track"><div className="t-prog-fill" style={{ width: `${pct}%`, background: col.dot }} /></div>
                  <div className="t-prog-pct" style={{ color: col.dot }}>{cnt}</div>
                </div>
              );
            })}
          </div>
          <div className="t-sh">Team</div>
          <div className="t-mem-grid">
            {members.map(m => {
              const mt  = tasks.filter(t => t.assignedTo === m.id);
              const dc  = mt.filter(t => t.done).length;
              const pct = mt.length ? Math.round(dc / mt.length * 100) : 0;
              return (
                <div key={m.id} className="t-mem-card">
                  <div className="t-mem-av"><img src={getAv(m.avatar, m.photoURL)} alt={m.fullName} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <div className="t-mem-name">{m.fullName || "Member"}</div>
                      {m.id === project.teamLeader && <span className="t-tag a" style={{ fontSize: ".4rem" }}>Lead</span>}
                      {m.id === user?.uid && <span className="t-tag g" style={{ fontSize: ".4rem" }}>You</span>}
                    </div>
                    <div className="t-mem-role">{m.currentRole || "Member"}</div>
                    <div className="t-mem-p"><div className="t-mem-pf" style={{ width: `${pct}%` }} /></div>
                    <div className="t-mem-pl">{dc}/{mt.length} tasks · {pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="t-card">
            <div className="t-sh">My Open Tasks</div>
            {myTasks.filter(t => !t.done).slice(0, 5).map(t => (
              <div key={t.id} className="t-task-row" style={{ marginBottom: 5 }}>
                <div className="t-chk open" onClick={() => toggleTask(t)} />
                <span className="t-task-txt" style={{ fontSize: ".74rem" }}>{t.text}</span>
                <span className={`t-pri t-pri-${(t.priority || "m")[0]}`} style={{ fontSize: ".42rem" }}>{(t.priority || "M")[0].toUpperCase()}</span>
              </div>
            ))}
            {myTasks.filter(t => !t.done).length === 0 && <div className="t-empty" style={{ padding: "8px 0", fontSize: ".56rem" }}>All done! 🎉</div>}
          </div>
          {suggestions.length > 0 && (
            <div className="t-card">
              <div className="t-sh">Mentor Suggestions</div>
              {suggestions.slice(0, 2).map(s => (
                <div key={s.id} className={`suggestion-card${s.resolved ? " resolved" : ""}`} style={{ borderLeftColor: "var(--green)" }}>
                  <div className="suggestion-from">🧑‍🏫 {s.mentorName} · {timeAgo(s.createdAt)}</div>
                  <div className="suggestion-txt">{s.text}</div>
                </div>
              ))}
            </div>
          )}
          {feedbacks.length > 0 && (
            <div className="t-card">
              <div className="t-sh">Latest Feedback</div>
              {feedbacks.slice(0, 2).map(f => (
                <div key={f.id} className="t-fb-card">
                  <div className="t-fb-from">🧑‍🏫 {f.mentorName} · {timeAgo(f.createdAt)}</div>
                  <div className="t-fb-txt" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.text}</div>
                  <div className="t-fb-rat">{f.rating === "excellent" ? "⭐⭐⭐" : f.rating === "good" ? "⭐⭐" : "⭐"}</div>
                </div>
              ))}
            </div>
          )}
          {currentMentors.length === 0 && (
            <div className="t-card" style={{ borderLeft: "3px solid var(--amber)", borderRadius: "0 12px 12px 0" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--amber)", fontWeight: 700, marginBottom: 6 }}>NO MENTOR YET</div>
              <div style={{ fontSize: ".74rem", color: "var(--muted)", marginBottom: 10 }}>Add a mentor to unlock Q&A, feedback, and sessions.</div>
              <button className="t-abtn" style={{ fontSize: ".66rem", padding: "6px 14px" }} onClick={() => selectTab("addmentor")}>Browse Mentors →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const TTasks = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Tasks</div>
        <div className="t-ph-sub">{tasks.length} total · {tasks.filter(t => t.done).length} done</div>
      </div>
      <div className="t-card" style={{ marginBottom: 18 }}>
        <div className="t-sh">Add Task</div>
        {/* FIX: uncontrolled inputs with defaultValue to avoid cursor glitch */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }} key={taskKey}>
          <input
            className="t-input"
            placeholder="Task description…"
            defaultValue=""
            onChange={e => { newTaskTextRef.current = e.target.value; }}
            onKeyDown={e => e.key === "Enter" && addTask()}
          />
          <select className="t-sel" defaultValue="" onChange={e => { newTaskAssignRef.current = e.target.value; }}>
            <option value="">Assign to…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.fullName}{m.id === user?.uid ? " (me)" : ""}</option>)}
          </select>
          <select className="t-sel" defaultValue="medium" onChange={e => { newTaskPriRef.current = e.target.value; }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="t-abtn" onClick={addTask} disabled={taskSaving}>{taskSaving ? "Adding…" : "Add Task"}</button>
        </div>
      </div>
      <div className="t-sh">All Tasks</div>
      {tasks.length === 0 && <div className="t-empty">No tasks yet — add one above</div>}
      {tasks.map(t => (
        <div key={t.id} className={`t-task-row${t.done ? " done" : ""}`}>
          <div className={`t-chk${t.done ? " done" : " open"}`} onClick={() => toggleTask(t)}>
            {t.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <span className={`t-task-txt${t.done ? " done" : ""}`}>{t.text}</span>
          {t.assignedName && <span className="t-task-who">→ {t.assignedName}{t.assignedTo === user?.uid ? " (you)" : ""}</span>}
          <span className={`t-pri t-pri-${(t.priority || "m")[0]}`}>{t.priority || "medium"}</span>
          <select className="t-sel" style={{ fontSize: ".62rem", padding: "3px 8px" }} value={t.status || "todo"}
            onChange={e => moveTask(t, e.target.value)}>
            {KB_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      ))}
    </div>
  );

  const TBoard = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Kanban Board</div><div className="t-ph-sub">{tasks.length} tasks</div></div>
      <div className="t-kb">
        {KB_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status));
          return (
            <div key={col.id} className="t-kb-col">
              <div className="t-kb-hd">
                <div className="t-kb-dot" style={{ background: col.dot }} />
                <span className="t-kb-title" style={{ color: col.dot }}>{col.label}</span>
                <span className="t-kb-cnt">{colTasks.length}</span>
              </div>
              <div className="t-kb-body">
                {colTasks.map(t => {
                  const assignee = members.find(m => m.id === t.assignedTo);
                  return (
                    <div key={t.id} className="t-kb-card">
                      <div className="t-kb-ct">{t.text}</div>
                      <div className="t-kb-cm">
                        {assignee && (
                          <><div className="t-kb-cav"><img src={getAv(assignee.avatar, assignee.photoURL)} alt="" /></div>
                          <span className="t-kb-cn">{assignee.fullName}</span></>
                        )}
                        <span className={`t-pri t-pri-${(t.priority || "m")[0]}`} style={{ marginLeft: "auto", fontSize: ".4rem" }}>{t.priority}</span>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && <div className="t-empty" style={{ fontSize: ".52rem", padding: "14px 0" }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const TFiles = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Files</div>
        <button className="t-abtn" onClick={() => setUploadModal(true)}>+ Upload File</button>
      </div>
      <div className="t-ph-sub" style={{ marginBottom: 16, marginTop: -10 }}>{files.length} files</div>
      {files.length === 0 && <div className="t-empty">No files yet — upload one</div>}
      {files.map(f => (
        <div key={f.id} className="t-file-row">
          <div className="t-file-ico">{getFileIcon(f.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-file-name">{f.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--dim)", marginTop: 2 }}>
              {f.upBy} · {timeAgo(f.createdAt)}{f.fileSize ? ` · ${fmtSize(f.fileSize)}` : ""}
            </div>
          </div>
          {f.mimeType === "text" && f.content && (
            <button className="t-btn" style={{ fontSize: ".64rem", padding: "5px 11px" }}
              onClick={() => {
                const blob = new Blob([f.content], { type: "text/plain" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a"); a.href = url; a.download = f.name; a.click();
                URL.revokeObjectURL(url);
              }}>↓ Download</button>
          )}
          {f.mimeType !== "text" && f.content && (
            <a href={f.content} download={f.name} className="t-btn" style={{ fontSize: ".64rem", padding: "5px 11px", textDecoration: "none", display: "inline-block" }}>↓ Download</a>
          )}
        </div>
      ))}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="t-overlay" onClick={e => e.target === e.currentTarget && resetUploadModal()}>
          <div className="t-modal">
            <button className="t-modal-close" onClick={resetUploadModal}>×</button>
            <div className="t-modal-title">Upload File</div>
            <div className="t-modal-sub">Choose a file from your device to share with the team</div>

            {/* Drop Zone */}
            <div
              className={`file-drop-zone${isDragging ? " drag" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropZoneDrop}
            >
              <span className="file-drop-icon">📁</span>
              <div className="file-drop-txt">Click to browse or drag & drop</div>
              <div className="file-drop-hint">Supports any file type · Text files stored as content, others as base64</div>
            </div>
            <input
              ref={fileInputRef} type="file" style={{ display: "none" }}
              onChange={e => handleFilePick(e.target.files?.[0])}
            />

            {uploadFile && (
              <div className="file-selected">
                <div className="t-file-ico" style={{ width: 28, height: 28, fontSize: ".44rem" }}>{getFileIcon(uploadFile.name)}</div>
                <span className="file-selected-name">{uploadFile.name}</span>
                <span className="file-selected-size">{fmtSize(uploadFile.size)}</span>
                <button className="file-remove" onClick={() => { setUploadFile(null); setUploadContent(""); setUploadMimeType(""); }}>×</button>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div className="t-modal-lbl">Display Name</div>
              <input
                className="t-modal-inp"
                placeholder="e.g. project-report.pdf"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
              />
            </div>

            <button className="t-modal-sub-btn" onClick={doUploadFile} disabled={uploadSaving || !uploadFile}>
              {uploadSaving ? "Uploading…" : "Upload to Project"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const TCode = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Code Editor</div>
        <div className="t-ph-sub">Write and commit code to the project</div>
      </div>
      <div className="code-editor-wrap" style={{ marginBottom: 20 }}>
        <div className="code-editor-header">
          <div className="code-editor-dots">
            <div className="code-editor-dot" style={{ background: "#ff5f57" }} />
            <div className="code-editor-dot" style={{ background: "#febc2e" }} />
            <div className="code-editor-dot" style={{ background: "#28c840" }} />
          </div>
          {["javascript","typescript","python","html","css"].map(l => (
            <div key={l} className={`code-editor-tab${commitLang === l ? " active" : ""}`}
              onClick={() => setCommitLang(l)}>{l}</div>
          ))}
        </div>
        {/* FIX: uncontrolled textarea to prevent cursor jump */}
        <textarea
          className="code-editor-textarea"
          placeholder={`// Write your ${commitLang} code here…`}
          defaultValue={codeEditorVal}
          onChange={e => { codeEditorRef.current = e.target.value; }}
          spellCheck={false}
        />
        <div className="code-editor-footer">
          <input
            className="t-input"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#e6edf3", fontSize: ".72rem" }}
            placeholder="Commit message…"
            defaultValue=""
            onChange={e => { commitMsgRef.current = e.target.value; }}
            onKeyDown={e => e.key === "Enter" && commitCode()}
          />
          <button className="t-abtn" style={{ fontSize: ".66rem" }} onClick={commitCode} disabled={commitSaving}>
            {commitSaving ? "Committing…" : "Commit →"}
          </button>
        </div>
      </div>

      {codeFiles.length > 0 && (
        <>
          <div className="t-sh">Committed Files</div>
          {codeFiles.map(f => (
            <div key={f.id} style={{ marginBottom: 8 }}>
              <div className="t-file-row" onClick={() => setExpandedCode(expandedCode === f.id ? null : f.id)} style={{ cursor: "pointer" }}>
                <div className="t-file-ico">{getFileIcon(f.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-file-name">{f.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--dim)", marginTop: 2 }}>
                    {f.upBy} · {timeAgo(f.createdAt)} {f.commitMsg ? `· "${f.commitMsg}"` : ""}
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--muted)" }}>
                  {expandedCode === f.id ? "▲ hide" : "▼ view"}
                </span>
              </div>
              {expandedCode === f.id && f.content && (
                <div style={{ background: "#090d14", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none", borderRadius: "0 0 10px 10px", padding: 14 }}>
                  <pre className="code-preview-pre">{f.content.slice(0, 2000)}</pre>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const TAITools = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">✦ AI Tools</div>
        <div className="t-ph-sub">Powered by Claude</div>
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { id: "taskgen",  label: "Task Generator" },
          { id: "coderev",  label: "Code Review" },
          { id: "qaassist", label: "Q&A Assistant" },
          { id: "fbdraft",  label: "Feedback Draft" },
        ].map(t => (
          <button key={t.id} className={aiTool === t.id ? "t-abtn" : "t-btn"}
            onClick={() => { setAiTool(t.id); setAiResult(""); setAiError(""); }}
            style={{ fontSize: ".7rem" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="t-card" style={{ marginBottom: 14 }}>
        {aiTool === "taskgen" && (
          <>
            <div className="t-sh">Generate Tasks</div>
            <div className="t-modal-lbl" style={{ marginBottom: 5 }}>Project Description</div>
            <textarea className="t-ta" placeholder="Describe your project goals…" value={projDesc} onChange={e => setProjDesc(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="t-modal-lbl" style={{ margin: 0 }}>Count:</div>
              <select className="t-sel" value={numTasks} onChange={e => setNumTasks(e.target.value)}>
                {[3,5,7,10].map(n => <option key={n} value={n}>{n} tasks</option>)}
              </select>
              <button className="t-abtn" onClick={runAI} disabled={aiLoading}>{aiLoading ? "Generating…" : "Generate"}</button>
            </div>
          </>
        )}
        {aiTool === "coderev" && (
          <>
            <div className="t-sh">Code Review</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="t-modal-lbl" style={{ margin: 0 }}>Language:</div>
              <select className="t-sel" value={codeLang} onChange={e => setCodeLang(e.target.value)}>
                {["javascript","typescript","python","html","css","java","go","rust"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <textarea className="t-ta" style={{ minHeight: 120, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: ".72rem" }}
              placeholder="Paste your code here…" value={codeInput} onChange={e => setCodeInput(e.target.value)} />
            <button className="t-abtn" onClick={runAI} disabled={aiLoading}>{aiLoading ? "Reviewing…" : "Review Code"}</button>
          </>
        )}
        {aiTool === "qaassist" && (
          <>
            <div className="t-sh">Ask a Question</div>
            <textarea className="t-ta" placeholder="What do you need help with?" value={qaQuestion} onChange={e => setQaQuestion(e.target.value)} style={{ marginBottom: 10 }} />
            <button className="t-abtn" onClick={runAI} disabled={aiLoading}>{aiLoading ? "Thinking…" : "Ask AI"}</button>
          </>
        )}
        {aiTool === "fbdraft" && (
          <>
            <div className="t-sh">Draft Feedback</div>
            <textarea className="t-ta" placeholder="Context or notes about the team…" value={fbContext} onChange={e => setFbContext(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div className="t-modal-lbl" style={{ margin: 0 }}>Tone:</div>
              <select className="t-sel" value={fbTone} onChange={e => setFbTone(e.target.value)}>
                <option value="constructive">Constructive</option>
                <option value="encouraging">Encouraging</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <button className="t-abtn" onClick={runAI} disabled={aiLoading}>{aiLoading ? "Drafting…" : "Draft Feedback"}</button>
          </>
        )}
      </div>

      {aiLoading && <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><div className="t-spinner" /></div>}
      {aiError && <div style={{ background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.25)", borderRadius: 9, padding: "12px 14px", fontSize: ".76rem", color: "var(--red)", marginBottom: 12 }}>{aiError}</div>}
      {aiResult && (
        <div className="t-card">
          <div className="t-sh">AI Result</div>
          <pre className="ai-result-pre">{aiResult}</pre>
        </div>
      )}
    </div>
  );

  const TAddMentor = () => {
    const filtered = allMentors.filter(m => {
      if (!mentorSearch) return true;
      const s = mentorSearch.toLowerCase();
      return (m.fullName || "").toLowerCase().includes(s) || (m.expertise || "").toLowerCase().includes(s);
    });
    return (
      <div className="t-page">
        <div className="t-ph">
          <div className="t-ph-title">Add Mentor</div>
          <div className="t-ph-sub">Discover and request mentors for your project</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <input className="t-input" style={{ maxWidth: 340 }} placeholder="Search by name or expertise…"
            value={mentorSearch} onChange={e => setMentorSearch(e.target.value)} />
        </div>
        {filtered.length === 0 && <div className="t-empty">No mentors found</div>}
        <div className="mentor-discover-grid">
          {filtered.map(m => {
            const alreadyReq = sentRequests.find(r => r.mentorId === m.id && r.type === "join");
            const isCurrent  = currentMentors.includes(m.id);
            return (
              <div key={m.id} className="mentor-card">
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <div className="mentor-card-av"><img src={getAv(m.avatar, m.photoURL)} alt={m.fullName} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mentor-card-name">{m.fullName}</div>
                    <div className="mentor-card-role">{m.expertise || m.currentRole || "Mentor"}</div>
                  </div>
                </div>
                {m.bio && <div className="mentor-card-bio">{m.bio}</div>}
                <div className="t-tags" style={{ marginBottom: 10 }}>
                  {(m.skills || []).slice(0, 3).map(s => <span key={s} className="t-tag g" style={{ fontSize: ".44rem" }}>{s}</span>)}
                </div>
                {isCurrent
                  ? <div className="t-pill t-pill-a" style={{ display: "inline-flex" }}>✓ Current Mentor</div>
                  : alreadyReq
                  ? <div className="t-pill t-pill-m" style={{ display: "inline-flex" }}>Request Pending</div>
                  : <button className="t-abtn" style={{ width: "100%", fontSize: ".68rem" }} onClick={() => sendMentorRequest(m)}>Request as Mentor</button>
                }
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const TQA = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Ask Mentor</div>
        <div className="t-ph-sub">{questions.length} questions · {answeredQ.length} answered</div>
      </div>
      <div className="t-card" style={{ marginBottom: 18 }}>
        <div className="t-sh">New Question</div>
        <div key={qKey}>
          <textarea
            className="t-ta"
            style={{ marginBottom: 10 }}
            placeholder="What would you like to ask your mentor?"
            defaultValue=""
            onChange={e => { newQuestionRef.current = e.target.value; }}
          />
        </div>
        <button className="t-abtn" onClick={askQuestion} disabled={qSaving}>{qSaving ? "Posting…" : "Post Question"}</button>
      </div>
      {questions.length === 0 && <div className="t-empty">No questions yet</div>}
      {questions.map(q => {
        const replies = qReplies[q.id] || [];
        return (
          <div key={q.id} className={`t-q-item${replies.length > 0 ? " has-r" : " unanswered"}`}>
            <div style={{ display: "flex", gap: 9, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid var(--border2)" }}>
                <img src={getAv(q.avatar, q.photoURL)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-q-meta">{q.askedByName} · {timeAgo(q.createdAt)}
                  {replies.length > 0
                    ? <span style={{ color: "var(--green)", fontWeight: 700 }}>✓ Answered</span>
                    : <span style={{ color: "var(--amber)", fontWeight: 700 }}>Pending</span>}
                </div>
                <div className="t-q-text">{q.text}</div>
              </div>
            </div>
            {replies.map(r => (
              <div key={r.id} className="t-q-reply">
                <div className="t-q-rby">🧑‍🏫 {r.mentorName} · {timeAgo(r.createdAt)}</div>
                <div className="t-q-rtxt">{r.text}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const TFeedback = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">My Feedback</div>
        <div className="t-ph-sub">{feedbacks.length} messages from mentor</div>
      </div>
      {feedbacks.length === 0 && <div className="t-empty">No feedback received yet</div>}
      {feedbacks.map(f => (
        <div key={f.id} className="t-fb-card">
          <div className="t-fb-from">🧑‍🏫 {f.mentorName} · {timeAgo(f.createdAt)}</div>
          <div className="t-fb-txt">{f.text}</div>
          <div className="t-fb-rat">{f.rating === "excellent" ? "⭐⭐⭐ Excellent" : f.rating === "good" ? "⭐⭐ Good" : "⭐ Needs Work"}</div>
        </div>
      ))}
    </div>
  );

  const TSessions = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Sessions</div>
        <button className="t-abtn" onClick={() => setSessionModal(true)}>+ Request Session</button>
      </div>
      {sessions.length === 0 && <div className="t-empty">No sessions yet</div>}
      {sessions.map(s => (
        <div key={s.id} className="t-card" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{s.mode === "video" ? "📹" : "🎙"} {s.mode === "video" ? "Video" : "Audio"} Session</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--dim)" }}>{timeAgo(s.createdAt)}</div>
          </div>
          <span className={`t-pill${s.status === "accepted" ? " t-pill-a" : s.status === "rejected" ? " t-pill-m" : " t-pill-s"}`} style={{ marginLeft: "auto" }}>
            {s.status}
          </span>
          {s.message && <div style={{ width: "100%", fontSize: ".72rem", color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>{s.message}</div>}
        </div>
      ))}

      {sessionModal && (
        <div className="t-overlay" onClick={e => e.target === e.currentTarget && setSessionModal(false)}>
          <div className="t-modal">
            <button className="t-modal-close" onClick={() => setSessionModal(false)}>×</button>
            <div className="t-modal-title">Request a Session</div>
            <div className="t-modal-sub">Your mentor will be notified</div>
            <div className="t-modal-lbl">Mode</div>
            <select className="t-modal-inp" value={reqMode} onChange={e => setReqMode(e.target.value)}>
              <option value="video">Video Call</option>
              <option value="audio">Audio Only</option>
              <option value="chat">Chat Only</option>
            </select>
            <div className="t-modal-lbl">Message (optional)</div>
            <textarea className="t-ta" style={{ marginBottom: 14 }} placeholder="What do you want to discuss?" value={reqMessage} onChange={e => setReqMessage(e.target.value)} />
            <button className="t-modal-sub-btn" onClick={requestSession}>Send Request</button>
          </div>
        </div>
      )}
    </div>
  );

  const TVC = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Voice & Video</div></div>
      <div className="vc-outer-grid">
        <div>
          {callMode === "idle" ? (
            <div className="t-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 14 }}>📹</div>
              <div style={{ fontSize: ".9rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Start a Call</div>
              <div style={{ fontSize: ".72rem", color: "var(--muted)", marginBottom: 18 }}>Connect with your team in real time</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="t-abtn" onClick={() => setCallMode("video")}>📹 Video Call</button>
                <button className="t-btn" onClick={() => setCallMode("audio")}>🎙 Audio Only</button>
              </div>
            </div>
          ) : (
            <div className="t-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ background: "var(--bg)", padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div className="t-dot" />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".6rem", color: "var(--green)", fontWeight: 700 }}>LIVE</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".56rem", color: "var(--muted)", marginLeft: "auto" }}>{callMode} call</span>
                <button className="t-btn" style={{ fontSize: ".62rem", padding: "4px 10px", background: "rgba(248,81,73,0.1)", borderColor: "rgba(248,81,73,0.3)", color: "var(--red)" }}
                  onClick={() => setCallMode("idle")}>End</button>
              </div>
              <iframe
                className="vc-call-frame"
                src={`https://meet.jit.si/gsc-${projectId}?config.startWithVideoMuted=${callMode === "audio"}`}
                allow="camera; microphone; fullscreen; display-capture"
                style={{ height: 400 }}
              />
            </div>
          )}
        </div>
        <div className="t-card" style={{ display: "flex", flexDirection: "column", maxHeight: 480 }}>
          <div className="t-sh">Team Chat</div>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {vcMsgs.map(m => (
              <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                  <img src={getAv(m.avatar, m.photoURL)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".48rem", color: "var(--dim)", marginBottom: 2 }}>
                    {m.userName} · {timeAgo(m.createdAt)}
                  </div>
                  <div style={{ fontSize: ".76rem", color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.5 }}>{m.text}</div>
                </div>
              </div>
            ))}
            <div ref={vcEndRef} />
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <input
              className="t-input"
              placeholder="Message…"
              value={vcInputVal}
              onChange={e => { setVcInputVal(e.target.value); vcInputRef.current = e.target.value; }}
              onKeyDown={e => e.key === "Enter" && sendVcMsg()}
            />
            <button className="t-abtn" style={{ fontSize: ".66rem", padding: "8px 12px" }} onClick={sendVcMsg}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );

  const TActivity = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Activity</div><div className="t-ph-sub">{activity.length} events</div></div>
      <div className="t-card">
        {activity.length === 0 && <div className="t-empty">No activity yet</div>}
        {activity.slice(0, 40).map(a => (
          <div key={a.id} className="t-act-item">
            <div className="t-act-av">
              <img src={getAv(members.find(m => m.id === a.uid)?.avatar, members.find(m => m.id === a.uid)?.photoURL)} alt="" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".78rem", color: "var(--text)", marginBottom: 2 }}>
                <strong style={{ color: "var(--text)" }}>{a.name}</strong> {a.desc}
                {a.ref && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".58rem", color: "var(--muted)", marginLeft: 4 }}>"{a.ref}"</span>}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".48rem", color: "var(--dim)" }}>{timeAgo(a.createdAt)}</div>
            </div>
            <div className={`t-act-chip t-chip-${a.cat || "task"}`}>{a.cat || "task"}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ──────────────────────────────────────────────────────────────
     MENTOR PANELS
  ─────────────────────────────────────────────────────────────── */
  const MOverview = () => (
    <div className="t-page">
      {/* FIX: Go to Dashboard → /mentor/dashboard */}
      <div className="mentor-banner">
        <div className="mentor-banner-icon">🧑‍🏫</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mentor-banner-title">Mentor View — {project.projectName || "Untitled"}</div>
          <div className="mentor-banner-sub">You are mentoring this team · {members.length} students</div>
        </div>
        <button className="t-btn" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", flexShrink: 0 }}
          onClick={() => nav("/mentor/dashboard")}>
          ← Dashboard
        </button>
      </div>

      <div className="t-stats-grid">
        {[
          { label: "Students",  val: members.length,   sub: "in team",                                     bar: "#0d7377" },
          { label: "Tasks",     val: tasks.length,     sub: `${donePct}% done`,                             bar: "#3fb950" },
          { label: "Questions", val: questions.filter(q => !(qReplies[q.id] || []).length).length, sub: "unanswered", bar: "#d29922" },
          { label: "Sessions",  val: sessions.length,  sub: "requested",                                    bar: "#bc8cff" },
        ].map((s, i) => (
          <div key={i} className="t-stat">
            <div className="t-stat-bar" style={{ background: s.bar }} />
            <div className="t-stat-lbl">{s.label}</div>
            <div className="t-stat-val">{s.val}</div>
            <div className="t-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="t-sh">Students</div>
      <div className="t-mem-grid">
        {members.map(m => {
          const mt  = tasks.filter(t => t.assignedTo === m.id);
          const dc  = mt.filter(t => t.done).length;
          const pct = mt.length ? Math.round(dc / mt.length * 100) : 0;
          return (
            <div key={m.id} className="t-mem-card">
              <div className="t-mem-av"><img src={getAv(m.avatar, m.photoURL)} alt={m.fullName} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-mem-name">{m.fullName || "Member"}</div>
                <div className="t-mem-role">{m.currentRole || "Student"}</div>
                <div className="t-mem-p"><div className="t-mem-pf" style={{ width: `${pct}%` }} /></div>
                <div className="t-mem-pl">{dc}/{mt.length} tasks · {pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const MTasks = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Team Tasks</div><div className="t-ph-sub">{tasks.length} total</div></div>
      {tasks.length === 0 && <div className="t-empty">No tasks yet</div>}
      {tasks.map(t => (
        <div key={t.id} className={`t-task-row${t.done ? " done" : ""}`}>
          <div className={`t-chk${t.done ? " done" : " open"}`}>
            {t.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <span className={`t-task-txt${t.done ? " done" : ""}`}>{t.text}</span>
          {t.assignedName && <span className="t-task-who">→ {t.assignedName}</span>}
          <span className={`t-pri t-pri-${(t.priority || "m")[0]}`}>{t.priority || "medium"}</span>
          <span className="t-pill" style={{ borderColor: "var(--border2)", background: "var(--bg)", color: "var(--muted)" }}>{t.status || "todo"}</span>
        </div>
      ))}
    </div>
  );

  const MQA = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Student Questions</div>
        <div className="t-ph-sub">{questions.length} total · {questions.filter(q => !(qReplies[q.id] || []).length).length} unanswered</div>
      </div>
      {questions.length === 0 && <div className="t-empty">No questions yet</div>}
      {questions.map(q => {
        const replies = qReplies[q.id] || [];
        return (
          <div key={q.id} className={`t-q-item${replies.length > 0 ? " has-r" : " unanswered"}`}>
            <div style={{ display: "flex", gap: 9, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                <img src={getAv(q.avatar, q.photoURL)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-q-meta">{q.askedByName} · {timeAgo(q.createdAt)}
                  {replies.length > 0
                    ? <span style={{ color: "var(--green)", fontWeight: 700 }}>✓ Answered</span>
                    : <span style={{ color: "var(--amber)", fontWeight: 700 }}>Needs reply</span>}
                </div>
                <div className="t-q-text">{q.text}</div>
              </div>
            </div>
            {replies.map(r => (
              <div key={r.id} className="t-q-reply">
                <div className="t-q-rby">🧑‍🏫 {r.mentorName} · {timeAgo(r.createdAt)}</div>
                <div className="t-q-rtxt">{r.text}</div>
              </div>
            ))}
            {replies.length === 0 && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  className="t-ta"
                  style={{ marginBottom: 8, minHeight: 70 }}
                  placeholder="Write your reply…"
                  value={replyTexts[q.id] || ""}
                  onChange={e => setReplyTexts(p => ({ ...p, [q.id]: e.target.value }))}
                />
                <button className="t-abtn" style={{ fontSize: ".68rem" }}
                  onClick={() => replyToQuestion(q.id)}
                  disabled={replySaving[q.id] || !(replyTexts[q.id] || "").trim()}>
                  {replySaving[q.id] ? "Posting…" : "Reply"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const MSuggestions = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Suggestions</div></div>
      <div className="t-card" style={{ marginBottom: 18 }}>
        <div className="t-sh">New Suggestion</div>
        <div key={suggKey}>
          <textarea
            className="t-ta"
            style={{ marginBottom: 10 }}
            placeholder="Share advice, resources, or recommendations for the team…"
            defaultValue=""
            onChange={e => { suggestionRef.current = e.target.value; }}
          />
        </div>
        <button className="t-abtn" onClick={postSuggestion} disabled={suggSaving}>{suggSaving ? "Posting…" : "Post Suggestion"}</button>
      </div>
      {suggestions.length === 0 && <div className="t-empty">No suggestions posted yet</div>}
      {suggestions.map(s => (
        <div key={s.id} className={`suggestion-card${s.resolved ? " resolved" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div className="suggestion-from">🧑‍🏫 {s.mentorName} · {timeAgo(s.createdAt)}</div>
            {!s.resolved && <button className="t-btn" style={{ marginLeft: "auto", fontSize: ".6rem", padding: "3px 9px" }}
              onClick={() => markSuggestionResolved(s.id)}>Mark Resolved</button>}
            {s.resolved && <span className="t-pill t-pill-a" style={{ marginLeft: "auto" }}>Resolved</span>}
          </div>
          <div className="suggestion-txt">{s.text}</div>
        </div>
      ))}
    </div>
  );

  const MGiveFeedback = () => (
    <div className="t-page">
      <div className="t-ph">
        <div className="t-ph-title">Give Feedback</div>
        <button className="t-abtn" onClick={() => setFeedbackModal(true)}>+ New Feedback</button>
      </div>
      <div className="t-ph-sub" style={{ marginBottom: 16, marginTop: -10 }}>Feedback you've given to students</div>
      {feedbacks.length === 0 && <div className="t-empty">No feedback given yet</div>}

      {feedbackModal && (
        <div className="t-overlay" onClick={e => e.target === e.currentTarget && setFeedbackModal(false)}>
          <div className="t-modal">
            <button className="t-modal-close" onClick={() => setFeedbackModal(false)}>×</button>
            <div className="t-modal-title">Give Feedback</div>
            <div className="t-modal-sub">Write personal feedback for a student</div>
            <div className="t-modal-lbl">Student</div>
            <select className="t-modal-inp" value={fbTarget} onChange={e => setFbTarget(e.target.value)}>
              <option value="">Choose student…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
            </select>
            <div className="t-modal-lbl">Feedback</div>
            <textarea className="t-ta" style={{ marginBottom: 14, minHeight: 100 }} placeholder="Write detailed, constructive feedback…" value={fbText} onChange={e => setFbText(e.target.value)} />
            <div className="t-modal-lbl">Rating</div>
            <select className="t-modal-inp" value={fbRating} onChange={e => setFbRating(e.target.value)}>
              <option value="excellent">⭐⭐⭐ Excellent</option>
              <option value="good">⭐⭐ Good</option>
              <option value="needs_work">⭐ Needs Work</option>
            </select>
            <button className="t-modal-sub-btn" onClick={submitFeedback} disabled={fbSaving}>{fbSaving ? "Sending…" : "Send Feedback"}</button>
          </div>
        </div>
      )}
    </div>
  );

  const MSessions = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Session Requests</div><div className="t-ph-sub">{sessions.length} requests</div></div>
      {sessions.length === 0 && <div className="t-empty">No session requests yet</div>}
      {sessions.map(s => (
        <div key={s.id} className="t-card" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
              {s.mode === "video" ? "📹" : "🎙"} {s.mode} session · {s.studentName}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".5rem", color: "var(--dim)" }}>{timeAgo(s.createdAt)}</div>
            {s.message && <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 5 }}>{s.message}</div>}
          </div>
          <span className={`t-pill${s.status === "accepted" ? " t-pill-a" : s.status === "rejected" ? " t-pill-m" : " t-pill-s"}`}>{s.status}</span>
        </div>
      ))}
    </div>
  );

  const MActivity = () => (
    <div className="t-page">
      <div className="t-ph"><div className="t-ph-title">Team Activity</div></div>
      <div className="t-card">
        {activity.length === 0 && <div className="t-empty">No activity yet</div>}
        {activity.slice(0, 40).map(a => (
          <div key={a.id} className="t-act-item">
            <div className="t-act-av">
              <img src={getAv(members.find(m => m.id === a.uid)?.avatar, members.find(m => m.id === a.uid)?.photoURL)} alt="" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".78rem", color: "var(--text)", marginBottom: 2 }}>
                <strong>{a.name}</strong> {a.desc}
                {a.ref && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".58rem", color: "var(--muted)", marginLeft: 4 }}>"{a.ref}"</span>}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".48rem", color: "var(--dim)" }}>{timeAgo(a.createdAt)}</div>
            </div>
            <div className={`t-act-chip t-chip-${a.cat || "task"}`}>{a.cat || "task"}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ─── Tab Routing ─────────────────────────────────────────────── */
  const renderPanel = () => {
    switch (activeTab) {
      // student
      case "overview":   return <TOverview />;
      case "tasks":      return <TTasks />;
      case "board":      return <TBoard />;
      case "files":      return <TFiles />;
      case "code":       return <TCode />;
      case "aitools":    return <TAITools />;
      case "addmentor":  return <TAddMentor />;
      case "qa":         return <TQA />;
      case "feedback":   return <TFeedback />;
      case "sessions":   return <TSessions />;
      case "call":       return <TVC />;
      case "activity":   return <TActivity />;
      // mentor
      case "moverview":    return <MOverview />;
      case "mtasks":       return <MTasks />;
      case "mqa":          return <MQA />;
      case "msuggestions": return <MSuggestions />;
      case "mfeedback":    return <MGiveFeedback />;
      case "msessions":    return <MSessions />;
      case "mactivity":    return <MActivity />;
      default:           return <div className="t-page"><div className="t-empty">Select a tab</div></div>;
    }
  };

  const TABS = isMentor ? MENTOR_TABS : STUDENT_TABS;
  const groups = [...new Set(TABS.map(t => t.group))];

  /* ─── Loading ─────────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d1117", flexDirection: "column", gap: 14 }}>
      <style>{TEAM_CSS}</style>
      <div className="t-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".62rem", color: "#484f58" }}>Loading workspace…</div>
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d1117", flexDirection: "column", gap: 10 }}>
      <style>{TEAM_CSS}</style>
      <div style={{ fontSize: "2rem" }}>🔍</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".7rem", color: "#484f58" }}>Project not found</div>
      <button className="t-btn" onClick={() => nav(-1)}>← Go Back</button>
    </div>
  );

  /* ─── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <style>{TEAM_CSS}</style>
      <div className={`t-shell${isMentor ? " mentor-mode" : ""}`}>

        {/* Mobile overlay */}
        <div className={`t-mob-ov${mobOpen ? " open" : ""}`} onClick={() => setMobOpen(false)} />

        {/* Sidebar */}
        <div className={`t-sb${collapsed ? " col" : ""}${mobOpen ? " mob" : ""}`}>
          {/* Logo */}
          <div className="t-sb-logo">
            <div className="t-sb-mark">
              <div className="t-sb-lsub">GSC</div>
            </div>
            <div>
              <div className="t-sb-ltxt">Workspace</div>
              <div className="t-sb-lsub">Team Dashboard</div>
            </div>
          </div>

          {/* Collapse toggle */}
          <button className="t-sb-cbtn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? "›" : "‹"}
          </button>

          {/* Nav */}
          <div className="t-sb-scroll">
            {groups.map(grp => (
              <div key={grp}>
                <div className="t-sb-grp">{grp}</div>
                {TABS.filter(t => t.group === grp).map(tab => (
                  <div
                    key={tab.id}
                    className={`t-sb-item${activeTab === tab.id ? " act" : ""}`}
                    onClick={() => selectTab(tab.id)}
                    title={collapsed ? tab.label : ""}
                  >
                    <div className="t-sb-ico">{tab.icon}</div>
                    <div className="t-sb-lbl">{tab.label}</div>
                    {tab.badge && unansweredBadge > 0 && <div className="t-sb-bdg">{unansweredBadge}</div>}
                  </div>
                ))}
                <div className="t-sb-sep" />
              </div>
            ))}
          </div>

          {/* User */}
          <div className="t-sb-foot">
            <div className="t-sb-user">
              <div className="t-sb-uav">
                <img src={getAv(myProfile?.avatar, myProfile?.photoURL)} alt="me" />
              </div>
              <div className="t-sb-uinfo">
                <div className="t-sb-uname">{myProfile?.fullName || "You"}</div>
                <div className="t-sb-urole">{isMentor ? "MENTOR" : "STUDENT"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="t-main">
          {/* Topbar */}
          <div className="t-topbar">
            <button className="t-mmb" onClick={() => setMobOpen(true)}>☰</button>
            <div className="t-crumb">
              <span className="t-crumb-r" onClick={() => nav(isMentor ? "/mentor/dashboard" : "/dashboard")}>Home</span>
              <span>›</span>
              <span className="t-crumb-c">{project.projectName || "Project"}</span>
            </div>
            <div className="t-spacer" />
            <div className="t-student-pill">
              <div className="t-dot" />
              {isMentor ? "Mentor View" : "Student View"}
            </div>
          </div>

          {/* Content */}
          <div className="t-content">
            {renderPanel()}
          </div>
        </div>

        {/* Toast */}
        {toast && <div className="t-toast">{toast}</div>}
      </div>
    </>
  );
}