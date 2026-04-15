/**
 * MentorProjectView.jsx  +  MentorDashboard.jsx
 * ─────────────────────────────────────────────────────────────────
 * NEW: Course Creator tab — mentors can create courses with episodes,
 *      Save (draft) or Publish (shows in CommonDashboard Popular Courses)
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore, doc, getDoc, updateDoc, collection, getDocs,
  query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc,
  orderBy, arrayUnion, setDoc
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

/* ─── Firebase init ─── */
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || "AIzaSyAeapcTRJDlShvPsBOFH0HsbySqSf7ZkU4",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "global-student-collaboration.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "global-student-collaboration",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "global-student-collaboration.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID  || "519101802897",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "1:519101802897:web:d75bee7f31c9a882559230",
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const AI_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function callAI(endpoint, body) {
  const res = await fetch(`${AI_BASE}/api/ai/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error||`HTTP ${res.status}`); }
  return res.json();
}

/* ─── Helpers ─── */
function makeAvatar(idx) {
  const hues = [200,180,220,260,160,280,140,300,170,240];
  const h = hues[(idx||0) % hues.length];
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
const getAv   = (a) => { const i=parseInt((a||"0").replace(/\D/g,""))-1; return makeAvatar(isNaN(i)?0:i); };
const fileExt = (ext) => ({pdf:"PDF",fig:"FIG",doc:"DOC",docx:"DOC",jsx:"JSX",js:"JS",ts:"TS",json:"JSON",html:"HTML",css:"CSS",md:"MD",png:"PNG",jpg:"JPG",jpeg:"JPG",gif:"GIF",svg:"SVG",zip:"ZIP",txt:"TXT",mp4:"MP4",mp3:"MP3"})[(ext||"").toLowerCase()]||"FILE";
const timeAgo = (ts) => { if(!ts) return ""; const d=ts?.toDate?ts.toDate():new Date(ts); const s=(Date.now()-d.getTime())/1000; if(s<60) return "just now"; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };

async function logActivity(pid, uid, name, cat, desc, ref="") {
  try { await addDoc(collection(db,"teamProjects",pid,"activity"),{uid,name,cat,desc,ref,createdAt:serverTimestamp()}); } catch(_){}
}

/* ═══════════════════════════════════════════════
   MENTOR GLOBAL CSS
═══════════════════════════════════════════════ */
const MENTOR_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:       #0d1117;
  --bg2:      #161b22;
  --surface:  #1c2128;
  --surface2: #21262d;
  --border:   #30363d;
  --border2:  #3d444d;
  --violet:   #8b5cf6;
  --violet2:  #a78bfa;
  --violet3:  #6d28d9;
  --green:    #3fb950;
  --green2:   #56d364;
  --amber:    #d29922;
  --amber2:   #e3b341;
  --red:      #f85149;
  --blue:     #388bfd;
  --blue2:    #79c0ff;
  --text:     #e6edf3;
  --text2:    #c9d1d9;
  --muted:    #8b949e;
  --dim:      #484f58;
  --fh: 'Space Grotesk', 'Segoe UI', sans-serif;
  --fm: 'JetBrains Mono', 'Courier New', monospace;
  --sidebar-w: 240px;
  --topbar-h: 54px;
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
  --glow: 0 0 20px rgba(139,92,246,0.15);
}
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html, body { height:100%; overflow:hidden; }
body { background:var(--bg); color:var(--text); font-family:var(--fh); font-size:14px; -webkit-font-smoothing:antialiased; }
button { cursor:pointer; font-family:var(--fh); }
input, textarea, select { font-family:var(--fh); }
a { text-decoration:none; }
::-webkit-scrollbar { width:3px; height:3px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:4px; }

@keyframes spin    { to{transform:rotate(360deg);} }
@keyframes fadeUp  { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:none;} }
@keyframes popIn   { from{opacity:0;transform:scale(0.96);} to{opacity:1;transform:none;} }
@keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes glow    { 0%,100%{box-shadow:0 0 8px rgba(139,92,246,0.2)} 50%{box-shadow:0 0 20px rgba(139,92,246,0.5)} }

/* ── Shell ── */
.m-shell { display:flex; height:100vh; overflow:hidden; }

/* ── Sidebar ── */
.m-sb { width:var(--sidebar-w); flex-shrink:0; background:var(--bg2); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; position:relative; z-index:120; }
@media(max-width:768px){ .m-sb{position:fixed;top:0;left:0;bottom:0;transform:translateX(-100%);z-index:200;} .m-sb.open{transform:translateX(0);} }
.m-mob-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:190; }
@media(max-width:768px){ .m-mob-overlay.open{display:block;} }

.m-sb-logo { height:var(--topbar-h); display:flex; align-items:center; gap:10px; padding:0 16px; border-bottom:1px solid var(--border); flex-shrink:0; }
.m-sb-logo-mark { width:28px;height:28px;background:linear-gradient(135deg,var(--violet3),var(--violet));border-radius:8px;display:grid;place-items:center;font-size:0.75rem;font-weight:700;color:#fff;flex-shrink:0; }
.m-sb-logo-txt { font-size:0.85rem;font-weight:700;color:var(--text);letter-spacing:-0.01em; }
.m-sb-scroll { flex:1; overflow-y:auto; padding:12px 8px; }
.m-sb-group { font-family:var(--fm);font-size:0.45rem;letter-spacing:0.2em;color:var(--dim);padding:10px 10px 5px;text-transform:uppercase; }
.m-sb-item { display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;border:1px solid transparent;margin-bottom:2px;cursor:pointer;transition:all 0.15s;user-select:none; }
.m-sb-item:hover { background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.15); }
.m-sb-item.active { background:rgba(139,92,246,0.12);border-color:rgba(139,92,246,0.25); }
.m-sb-icon { font-family:var(--fm);font-size:0.68rem;font-weight:600;flex-shrink:0;width:22px;text-align:center;color:var(--dim);transition:color 0.15s; }
.m-sb-item.active .m-sb-icon,.m-sb-item:hover .m-sb-icon { color:var(--violet2); }
.m-sb-label { font-size:0.78rem;font-weight:600;color:var(--muted);white-space:nowrap;transition:color 0.15s; }
.m-sb-item.active .m-sb-label,.m-sb-item:hover .m-sb-label { color:var(--text); }
.m-sb-badge { margin-left:auto;font-family:var(--fm);font-size:0.5rem;font-weight:700;padding:1px 7px;border-radius:10px;background:rgba(139,92,246,0.2);color:var(--violet2);flex-shrink:0; }
.m-sb-sep { height:1px;background:var(--border);margin:6px 10px; }
.m-sb-footer { padding:12px 10px;border-top:1px solid var(--border);flex-shrink:0; }
.m-sb-user { display:flex;align-items:center;gap:10px; }
.m-sb-user-av { width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--violet3); }
.m-sb-user-av img { width:100%;height:100%;object-fit:cover; }
.m-sb-user-name { font-size:0.76rem;font-weight:700;color:var(--text);white-space:nowrap; }
.m-sb-user-role { font-family:var(--fm);font-size:0.5rem;color:var(--violet2);margin-top:2px; }
.mentor-indicator { display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);margin-bottom:8px; }
.mentor-indicator-dot { width:6px;height:6px;border-radius:50%;background:var(--violet2);animation:pulse 2s ease-in-out infinite; }
.mentor-indicator-txt { font-family:var(--fm);font-size:0.5rem;color:var(--violet2); }

/* ── Main ── */
.m-main { flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden; }
.m-topbar { height:var(--topbar-h);background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 clamp(14px,3vw,20px);gap:12px;flex-shrink:0; }
.m-mob-btn { display:none;background:none;border:1px solid var(--border);border-radius:7px;width:32px;height:32px;align-items:center;justify-content:center;font-size:1rem;color:var(--muted);flex-shrink:0; }
@media(max-width:768px){ .m-mob-btn{display:flex;} }
.m-topbar-crumb { font-family:var(--fm);font-size:0.6rem;color:var(--muted);display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden; }
.m-crumb-root { cursor:pointer;transition:color 0.15s; }
.m-crumb-root:hover { color:var(--violet2); }
.m-crumb-current { color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(80px,20vw,200px); }
.m-topbar-right { margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0; }
.m-mentor-pill { display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.08);font-family:var(--fm);font-size:0.52rem;color:var(--violet2); }
.m-content { flex:1;overflow-y:auto;background:var(--bg); }
.m-page { padding:clamp(16px,4vw,28px);animation:fadeUp 0.25s ease; }

/* Page header */
.m-ph { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;gap:12px;flex-wrap:wrap; }
.m-ph-title { font-size:clamp(1.1rem,3vw,1.4rem);font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.m-ph-sub { font-family:var(--fm);font-size:0.55rem;color:var(--muted);margin-top:4px;display:flex;align-items:center;gap:7px;flex-wrap:wrap; }
.m-pill { font-family:var(--fm);font-size:0.5rem;font-weight:600;padding:3px 9px;border-radius:20px;border:1px solid;white-space:nowrap; }
.m-pill-mentor { border-color:rgba(139,92,246,0.35);background:rgba(139,92,246,0.1);color:var(--violet2); }
.m-pill-active { border-color:rgba(63,185,80,0.35);background:rgba(63,185,80,0.08);color:var(--green2); }
.m-tag { font-family:var(--fm);font-size:0.5rem;padding:2px 8px;border-radius:4px;border:1px solid rgba(56,139,253,0.25);background:rgba(56,139,253,0.08);color:var(--blue2); }
.m-tags { display:flex;flex-wrap:wrap;gap:4px; }

/* Stats */
.m-stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2vw,12px);margin-bottom:clamp(18px,4vw,24px); }
@media(max-width:720px){ .m-stats-grid{grid-template-columns:repeat(2,1fr);} }
.m-stat-card { background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:clamp(12px,3vw,16px);position:relative;overflow:hidden;transition:border-color 0.2s; }
.m-stat-card:hover { border-color:var(--border2);box-shadow:var(--shadow-sm); }
.m-stat-accent { position:absolute;top:0;left:0;right:0;height:2px; }
.m-stat-lbl { font-family:var(--fm);font-size:0.45rem;letter-spacing:0.14em;color:var(--dim);margin-bottom:8px;text-transform:uppercase; }
.m-stat-val { font-size:clamp(1.4rem,3vw,1.8rem);font-weight:700;color:var(--text);line-height:1; }
.m-stat-sub { font-family:var(--fm);font-size:0.5rem;color:var(--muted);margin-top:4px; }

/* Section head */
.m-sec-head { font-family:var(--fm);font-size:0.5rem;color:var(--dim);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px; }
.m-sec-head::after { content:'';flex:1;height:1px;background:var(--border); }
.m-card { background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:clamp(14px,3vw,18px); }
.m-two-col { display:grid;grid-template-columns:1fr 280px;gap:clamp(12px,2vw,18px);margin-bottom:24px; }
@media(max-width:900px){ .m-two-col{grid-template-columns:1fr;} }

/* Suggestions */
.m-sug-types { display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap; }
.m-sug-type-btn { padding:4px 11px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:var(--fm);font-size:0.54rem;cursor:pointer;transition:all 0.15s; }
.m-sug-type-btn.sel { border-color:rgba(139,92,246,0.4);background:rgba(139,92,246,0.1);color:var(--violet2); }
.m-sug-item { display:flex;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:border-color 0.15s;margin-bottom:8px; }
.m-sug-item:hover { border-color:var(--border2); }
.m-sug-accent { width:3px;flex-shrink:0; }
.m-sug-body { padding:12px 14px;flex:1; }
.m-sug-head { display:flex;align-items:center;gap:7px;margin-bottom:7px;flex-wrap:wrap; }
.m-sug-badge { font-family:var(--fm);font-size:0.46rem;padding:2px 7px;border-radius:4px;border:1px solid; }
.m-sug-author { font-family:var(--fm);font-size:0.5rem;color:var(--muted); }
.m-sug-time { font-family:var(--fm);font-size:0.46rem;color:var(--dim);margin-left:auto; }
.m-sug-text { font-size:0.78rem;color:var(--text2);line-height:1.65; }

/* Q&A panel */
.m-qa-card { background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px;transition:border-color 0.15s; }
.m-qa-card:hover { border-color:var(--border2); }
.m-qa-card.resolved { border-left:3px solid var(--green2); }
.m-qa-card.pending  { border-left:3px solid var(--amber2); }
.m-qa-question { font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:6px; }
.m-qa-meta { font-family:var(--fm);font-size:0.5rem;color:var(--muted);margin-bottom:10px; }
.m-qa-reply-area { background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:10px 12px;margin-top:8px; }
.m-qa-reply-text { font-size:0.76rem;color:var(--text2);line-height:1.65; }
.m-qa-reply-meta { font-family:var(--fm);font-size:0.48rem;color:var(--violet2);margin-bottom:4px;font-weight:600; }
.m-notes-ta { width:100%;min-height:90px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;outline:none;resize:vertical;transition:border-color 0.2s; }
.m-notes-ta:focus { border-color:rgba(139,92,246,0.5); }
.m-notes-ta::placeholder { color:var(--dim); }

/* Files */
.m-file-row { display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;transition:border-color 0.15s;flex-wrap:wrap;margin-bottom:6px; }
.m-file-row:hover { border-color:var(--border2); }
.m-file-ext { font-family:var(--fm);font-size:0.46rem;font-weight:700;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:3px 7px;color:var(--muted);flex-shrink:0; }
.m-file-name { font-size:0.76rem;font-weight:600;color:var(--text); }
.m-file-meta { font-family:var(--fm);font-size:0.5rem;color:var(--dim); }
.m-read-only-badge { font-family:var(--fm);font-size:0.44rem;padding:2px 7px;border-radius:4px;background:rgba(63,185,80,0.08);border:1px solid rgba(63,185,80,0.2);color:var(--green2);margin-left:auto;white-space:nowrap; }

/* Activity */
.m-act-item { display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border); }
.m-act-item:last-child { border-bottom:none; }
.m-act-av { width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid var(--border2); }
.m-act-av img { width:100%;height:100%;object-fit:cover; }
.m-act-name { font-size:0.74rem;font-weight:600;color:var(--text); }
.m-act-desc { font-size:0.7rem;color:var(--muted); }
.m-act-ref { font-family:var(--fm);font-size:0.5rem;color:var(--blue2);margin-top:2px; }
.m-act-time { font-family:var(--fm);font-size:0.46rem;color:var(--dim); }
.m-act-chip { font-family:var(--fm);font-size:0.42rem;padding:2px 7px;border-radius:4px;margin-left:auto;align-self:flex-start;flex-shrink:0;white-space:nowrap;border:1px solid; }
.chip-task  { background:rgba(56,139,253,0.08);border-color:rgba(56,139,253,0.2);color:var(--blue2); }
.chip-file  { background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.2);color:var(--violet2); }
.chip-code  { background:rgba(63,185,80,0.08);border-color:rgba(63,185,80,0.2);color:var(--green2); }
.chip-mentor{ background:rgba(210,153,34,0.08);border-color:rgba(210,153,34,0.2);color:var(--amber2); }
.m-filter-row { display:flex;gap:5px;margin-bottom:12px;flex-wrap:wrap; }
.m-filter { padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--dim);font-family:var(--fm);font-size:0.52rem;cursor:pointer;transition:all 0.15s; }
.m-filter.on { background:rgba(139,92,246,0.12);border-color:rgba(139,92,246,0.3);color:var(--violet2); }

/* Video call */
.m-vc-outer { display:grid;grid-template-columns:1fr 280px;gap:14px; }
@media(max-width:900px){ .m-vc-outer{grid-template-columns:1fr;} }
.m-vc-wrap { background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden; }
.m-vc-wrap iframe { width:100%;height:clamp(240px,40vw,480px);border:none;display:block; }
.m-vc-chat { background:var(--surface);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;min-height:360px; }
.m-vc-head { padding:10px 14px;border-bottom:1px solid var(--border);font-family:var(--fm);font-size:0.5rem;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase; }
.m-vc-msgs { flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:9px;max-height:380px; }
.m-vc-msg { display:flex;gap:7px; }
.m-vc-msg-av { width:22px;height:22px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--border); }
.m-vc-msg-av img { width:100%;height:100%;object-fit:cover; }
.m-vc-msg-name { font-family:var(--fm);font-size:0.48rem;color:var(--violet2);margin-bottom:2px; }
.m-vc-msg-txt { font-size:0.72rem;color:var(--muted); }
.m-vc-msg-time { font-family:var(--fm);font-size:0.42rem;color:var(--dim); }
.m-vc-inp { display:flex;gap:6px;padding:10px;border-top:1px solid var(--border); }
.m-vc-input { flex:1;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.76rem;outline:none; }
.m-vc-input:focus { border-color:rgba(139,92,246,0.5); }
.m-vc-send { padding:7px 12px;border:none;border-radius:6px;background:var(--violet3);color:#fff;font-size:0.62rem;font-weight:700;transition:all 0.15s; }

/* AI panel */
.m-ai-panel { background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:12px 14px;font-family:var(--fm);font-size:0.68rem;color:var(--muted);line-height:1.8;white-space:pre-wrap;max-height:220px;overflow-y:auto;margin-top:10px; }

/* Requests */
.m-req-card { background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px;transition:border-color 0.15s; }
.m-req-card.pending  { border-left:3px solid var(--amber2); }
.m-req-card.accepted { border-left:3px solid var(--green2); }
.m-req-card.declined { border-left:3px solid var(--dim); }
.m-req-head { display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap; }
.m-req-name { font-weight:700;font-size:0.78rem;color:var(--text); }
.m-req-meta { font-family:var(--fm);font-size:0.52rem;color:var(--dim); }
.m-req-msg { font-size:0.74rem;color:var(--muted);margin:8px 0;line-height:1.5;font-style:italic; }
.m-req-actions { display:flex;gap:7px;margin-top:10px; }
.m-accept-btn { padding:6px 14px;border-radius:6px;border:1px solid rgba(63,185,80,0.3);background:rgba(63,185,80,0.08);color:var(--green2);font-size:0.64rem;font-weight:700;cursor:pointer;transition:all 0.15s; }
.m-accept-btn:hover { background:rgba(63,185,80,0.15); }
.m-decline-btn { padding:6px 14px;border-radius:6px;border:1px solid rgba(248,81,73,0.3);background:rgba(248,81,73,0.06);color:var(--red);font-size:0.64rem;font-weight:700;cursor:pointer;transition:all 0.15s; }
.m-decline-btn:hover { background:rgba(248,81,73,0.12); }
.m-status-tag { font-family:var(--fm);font-size:0.44rem;padding:2px 7px;border-radius:4px;border:1px solid; }
.m-status-pending  { border-color:rgba(210,153,34,0.3);background:rgba(210,153,34,0.08);color:var(--amber2); }
.m-status-accepted { border-color:rgba(63,185,80,0.3);background:rgba(63,185,80,0.08);color:var(--green2); }
.m-status-declined { border-color:rgba(72,79,88,0.5);background:rgba(72,79,88,0.1);color:var(--dim); }

/* Members */
.m-members-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:10px; }
.m-mem-card { background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;gap:10px;transition:border-color 0.15s; }
.m-mem-card:hover { border-color:var(--border2); }
.m-mem-av { width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid var(--border2); }
.m-mem-av img { width:100%;height:100%;object-fit:cover; }
.m-mem-name { font-size:0.74rem;font-weight:600;color:var(--text); }
.m-mem-role { font-family:var(--fm);font-size:0.5rem;color:var(--dim);margin-top:2px; }

/* ═══ COURSE CREATOR ═══ */
.cc-wrap { display:grid;grid-template-columns:340px 1fr;gap:18px;min-height:0; }
@media(max-width:960px){ .cc-wrap{grid-template-columns:1fr;} }

/* Left panel — course list */
.cc-list-panel { background:var(--surface);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 140px); }
.cc-list-head { padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
.cc-list-title { font-size:0.8rem;font-weight:700;color:var(--text); }
.cc-list-scroll { flex:1;overflow-y:auto;padding:10px; }
.cc-course-row { padding:10px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:all 0.15s;position:relative; }
.cc-course-row:hover { border-color:var(--border2);background:var(--surface2); }
.cc-course-row.sel { border-color:rgba(139,92,246,0.4);background:rgba(139,92,246,0.07); }
.cc-course-row-name { font-size:0.78rem;font-weight:600;color:var(--text);margin-bottom:3px; }
.cc-course-row-meta { font-family:var(--fm);font-size:0.48rem;color:var(--muted);display:flex;gap:8px; }
.cc-status-dot { width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle; }

/* Right panel — editor */
.cc-editor { background:var(--surface);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 140px); }
.cc-editor-head { padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap; }
.cc-editor-title { font-size:0.88rem;font-weight:700;color:var(--text); }
.cc-editor-scroll { flex:1;overflow-y:auto;padding:20px; }

/* Course meta form */
.cc-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px; }
@media(max-width:600px){ .cc-form-grid{grid-template-columns:1fr;} }
.cc-field { display:flex;flex-direction:column;gap:5px; }
.cc-field.full { grid-column:1/-1; }
.cc-label { font-family:var(--fm);font-size:0.48rem;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase; }
.cc-input { padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:0.82rem;outline:none;transition:border-color 0.2s;width:100%; }
.cc-input:focus { border-color:rgba(139,92,246,0.5); }
.cc-input::placeholder { color:var(--dim); }
.cc-select { padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:0.82rem;outline:none;width:100%;cursor:pointer; }
.cc-select option { background:var(--surface2); }
.cc-textarea { padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:0.82rem;outline:none;resize:vertical;width:100%;min-height:70px; }
.cc-textarea:focus { border-color:rgba(139,92,246,0.5); }
.cc-textarea::placeholder { color:var(--dim); }

/* Episode container */
.cc-ep-zone { background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px; }
.cc-ep-zone-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px; }
.cc-ep-zone-label { font-size:0.78rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px; }
.cc-ep-count { font-family:var(--fm);font-size:0.52rem;padding:2px 8px;border-radius:10px;background:rgba(139,92,246,0.12);color:var(--violet2);border:1px solid rgba(139,92,246,0.25); }

/* Episode card */
.cc-ep-card { background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;transition:border-color 0.15s; }
.cc-ep-card:hover { border-color:var(--border2); }
.cc-ep-header { display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;user-select:none; }
.cc-ep-num { font-family:var(--fm);font-size:0.56rem;font-weight:700;color:var(--violet2);background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:5px;padding:2px 8px;flex-shrink:0; }
.cc-ep-name-preview { font-size:0.76rem;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.cc-ep-chevron { font-size:0.6rem;color:var(--dim);transition:transform 0.2s;flex-shrink:0; }
.cc-ep-chevron.open { transform:rotate(90deg); }
.cc-ep-body { padding:14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px; }
.cc-ep-upload-area { border:2px dashed var(--border2);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--surface2); }
.cc-ep-upload-area:hover { border-color:var(--violet2);background:rgba(139,92,246,0.05); }
.cc-ep-upload-icon { font-size:1.6rem;margin-bottom:6px; }
.cc-ep-upload-txt { font-family:var(--fm);font-size:0.56rem;color:var(--muted); }
.cc-ep-upload-sub { font-family:var(--fm);font-size:0.5rem;color:var(--dim);margin-top:3px; }
.cc-ep-file-row { display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px; }
.cc-ep-file-name { font-size:0.74rem;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.cc-ep-file-size { font-family:var(--fm);font-size:0.48rem;color:var(--dim); }
.cc-ep-del { background:none;border:none;color:var(--dim);font-size:0.9rem;cursor:pointer;padding:2px 6px;border-radius:4px;transition:color 0.15s;flex-shrink:0; }
.cc-ep-del:hover { color:var(--red); }

/* Price tier */
.cc-price-tiers { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px; }
.cc-tier-btn { padding:7px 14px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:0.74rem;font-weight:600;cursor:pointer;transition:all 0.15s; }
.cc-tier-btn.sel { border-color:rgba(139,92,246,0.4);background:rgba(139,92,246,0.1);color:var(--violet2); }
.cc-price-row { display:flex;gap:10px;align-items:center; }
.cc-currency-select { padding:9px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:0.82rem;outline:none;width:90px; }
.cc-price-input { flex:1;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:0.82rem;outline:none;transition:border-color 0.2s; }
.cc-price-input:focus { border-color:rgba(139,92,246,0.5); }

/* Action buttons */
.cc-actions { display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface);flex-wrap:wrap; }
.cc-save-btn { padding:9px 20px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:0.78rem;font-weight:700;cursor:pointer;transition:all 0.15s; }
.cc-save-btn:hover:not(:disabled) { border-color:var(--violet2);color:var(--violet2); }
.cc-publish-btn { padding:9px 22px;border-radius:7px;border:none;background:linear-gradient(135deg,var(--violet3),var(--violet));color:#fff;font-size:0.78rem;font-weight:700;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 12px rgba(139,92,246,0.25); }
.cc-publish-btn:hover:not(:disabled) { box-shadow:0 4px 20px rgba(139,92,246,0.45);transform:translateY(-1px); }
.cc-publish-btn:disabled,.cc-save-btn:disabled { opacity:0.5;cursor:not-allowed; }
.cc-draft-badge { font-family:var(--fm);font-size:0.44rem;padding:2px 7px;border-radius:4px;background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:var(--amber2); }
.cc-live-badge { font-family:var(--fm);font-size:0.44rem;padding:2px 7px;border-radius:4px;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.3);color:var(--green2); }

/* Misc */
.m-toast { position:fixed;bottom:20px;right:clamp(12px,4vw,20px);background:var(--violet3);border-radius:8px;padding:10px 16px;font-family:var(--fm);font-size:0.64rem;color:#fff;z-index:400;animation:popIn 0.2s ease;box-shadow:var(--shadow-lg); }
.m-empty { font-family:var(--fm);font-size:0.6rem;color:var(--dim);text-align:center;padding:clamp(20px,5vw,32px); }
.m-spinner { width:22px;height:22px;border:2px solid rgba(139,92,246,0.2);border-top-color:var(--violet2);border-radius:50%;animation:spin 0.7s linear infinite; }
.m-save-btn { padding:6px 14px;border-radius:6px;background:transparent;border:1px solid var(--border2);color:var(--muted);font-family:var(--fm);font-size:0.6rem;font-weight:600;transition:all 0.15s;cursor:pointer; }
.m-save-btn:hover { border-color:var(--violet2);color:var(--violet2); }
.m-add-btn { padding:7px 14px;border:none;border-radius:7px;background:var(--violet3);color:#fff;font-size:0.7rem;font-weight:700;transition:all 0.15s;cursor:pointer; }
.m-add-btn:hover { background:var(--violet);box-shadow:var(--glow); }
.m-add-btn:disabled { opacity:0.5; }
.m-warn { background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:var(--fm);font-size:0.58rem;color:var(--amber2);line-height:1.7; }
.m-err  { background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:var(--fm);font-size:0.58rem;color:var(--red);line-height:1.7; }
.m-info { background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:var(--fm);font-size:0.58rem;color:var(--violet2);line-height:1.7; }
.cc-new-course-btn { width:100%;padding:9px;border-radius:7px;border:1px dashed var(--border2);background:transparent;color:var(--violet2);font-size:0.76rem;font-weight:600;cursor:pointer;transition:all 0.15s;margin-top:8px; }
.cc-new-course-btn:hover { border-color:var(--violet2);background:rgba(139,92,246,0.05); }
`;

const SUG_TYPES = [
  { key:"suggestion",   label:"Suggestion",   color:"#8b5cf6" },
  { key:"comment",      label:"Comment",      color:"#388bfd" },
  { key:"meeting-note", label:"Meeting Note", color:"#d29922" },
];

const MENTOR_TABS = [
  { id:"overview",    icon:"OV", label:"Overview"    },
  { id:"activity",    icon:"AC", label:"Activity"    },
  { id:"files",       icon:"FL", label:"Files"       },
  { id:"qa",          icon:"QA", label:"Q&A"         },
  { id:"suggestions", icon:"SG", label:"Suggestions" },
  { id:"videocall",   icon:"VC", label:"Video Call"  },
  { id:"requests",    icon:"RQ", label:"Requests"    },
  { id:"courses",     icon:"CR", label:"Courses"     },
];

const COURSE_LEVELS    = ["Beginner","Intermediate","Advanced","All Levels"];
const COURSE_LANGS     = ["English","Hindi","Spanish","French","German","Arabic","Portuguese","Japanese"];
const COURSE_CATEGORIES = ["Programming","Design","Data Science","Business","Marketing","DevOps","Cybersecurity","AI/ML","Cloud Computing","Mobile Development","Game Dev","Other"];
const CURRENCIES       = ["USD","EUR","GBP","INR","AUD","CAD"];

function newEpisode(num) {
  return { id: `ep_${Date.now()}_${num}`, title: `Episode ${num}`, description: "", fileName: "", fileSize: "", fileData: "" };
}

function newCourse(mentorId, mentorName) {
  return {
    id: `course_${Date.now()}`,
    title: "", subtitle: "", description: "", category: "", level: "Beginner",
    language: "English", prerequisites: "", whatYouLearn: "", targetAudience: "",
    pricingType: "paid", currency: "USD", price: "", originalPrice: "",
    thumbnailUrl: "", previewVideoUrl: "", tags: "",
    mentorId, mentorName,
    episodes: [newEpisode(1)],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enrollments: 0, rating: 0, totalDuration: "",
  };
}

/* ════════════ COURSE CREATOR COMPONENT ════════════ */
function CourseCreator({ user, myProfile, showToast }) {
  const [courses, setCourses]         = useState([]);
  const [selectedId, setSelectedId]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [publishing, setPublishing]   = useState(false);
  const [openEps, setOpenEps]         = useState({});

  const selected = courses.find(c => c.id === selectedId) || null;

  /* Load mentor's courses */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "mentorCourses"), where("mentorId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      setCourses(docs);
      if (docs.length && !selectedId) setSelectedId(docs[0].id);
    });
    return unsub;
  }, [user]);

  const updateField = (field, val) => {
    setCourses(prev => prev.map(c => c.id === selectedId ? { ...c, [field]: val } : c));
  };

  const updateEpisode = (epId, field, val) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== selectedId) return c;
      return { ...c, episodes: c.episodes.map(ep => ep.id === epId ? { ...ep, [field]: val } : ep) };
    }));
  };

  const addEpisode = () => {
    setCourses(prev => prev.map(c => {
      if (c.id !== selectedId) return c;
      const num = (c.episodes || []).length + 1;
      return { ...c, episodes: [...(c.episodes || []), newEpisode(num)] };
    }));
  };

  const removeEpisode = (epId) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== selectedId) return c;
      return { ...c, episodes: c.episodes.filter(ep => ep.id !== epId) };
    }));
  };

  const handleFileUpload = (epId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      updateEpisode(epId, "fileName", file.name);
      updateEpisode(epId, "fileSize", `${(file.size / 1024 / 1024).toFixed(1)} MB`);
      updateEpisode(epId, "fileData", e.target.result.split(",")[1]); // base64
    };
    reader.readAsDataURL(file);
  };

  const createNewCourse = () => {
    const c = newCourse(user.uid, myProfile?.fullName || "Mentor");
    setCourses(prev => [c, ...prev]);
    setSelectedId(c.id);
  };

  const saveCourse = async (publish = false) => {
    if (!selected) return;
    if (publish) setPublishing(true); else setSaving(true);
    try {
      const payload = {
        ...selected,
        status: publish ? "published" : "draft",
        updatedAt: new Date().toISOString(),
      };
      delete payload.firestoreId;
      if (selected.firestoreId) {
        await updateDoc(doc(db, "mentorCourses", selected.firestoreId), payload);
      } else {
        const ref = await addDoc(collection(db, "mentorCourses"), payload);
        setCourses(prev => prev.map(c => c.id === selected.id ? { ...c, firestoreId: ref.id } : c));
      }
      showToast(publish ? "✓ Course published! Now visible to students." : "✓ Draft saved.");
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setSaving(false); setPublishing(false);
  };

  const toggleEp = (id) => setOpenEps(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="m-page">
      <div className="m-ph">
        <div>
          <div className="m-ph-title">Course Creator</div>
          <div className="m-ph-sub">Build and publish courses · Episodes saved incrementally</div>
        </div>
      </div>

      <div className="cc-wrap">
        {/* LEFT: course list */}
        <div className="cc-list-panel">
          <div className="cc-list-head">
            <span className="cc-list-title">My Courses ({courses.length})</span>
          </div>
          <div className="cc-list-scroll">
            {courses.map(c => (
              <div key={c.id} className={`cc-course-row${selectedId === c.id ? " sel" : ""}`} onClick={() => setSelectedId(c.id)}>
                <div className="cc-course-row-name">{c.title || "Untitled Course"}</div>
                <div className="cc-course-row-meta">
                  <span>
                    <span className="cc-status-dot" style={{ background: c.status === "published" ? "var(--green2)" : "var(--amber2)" }} />
                    {c.status === "published" ? "Live" : "Draft"}
                  </span>
                  <span>{(c.episodes || []).length} ep{(c.episodes || []).length !== 1 ? "s" : ""}</span>
                  {c.price && <span>{c.currency} {c.price}</span>}
                </div>
              </div>
            ))}
            <button className="cc-new-course-btn" onClick={createNewCourse}>+ New Course</button>
          </div>
        </div>

        {/* RIGHT: editor */}
        {selected ? (
          <div className="cc-editor">
            <div className="cc-editor-head">
              <div className="cc-editor-title">{selected.title || "Untitled Course"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selected.status === "published"
                  ? <span className="cc-live-badge">● LIVE</span>
                  : <span className="cc-draft-badge">○ DRAFT</span>}
              </div>
            </div>

            <div className="cc-editor-scroll">
              {/* ── Section 1: Course Info ── */}
              <div className="m-sec-head">Course Information</div>
              <div className="cc-form-grid">
                <div className="cc-field full">
                  <label className="cc-label">Course Title *</label>
                  <input className="cc-input" placeholder="e.g. Complete React Developer Bootcamp" value={selected.title} onChange={e => updateField("title", e.target.value)} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">Subtitle</label>
                  <input className="cc-input" placeholder="Short tagline — what students will achieve" value={selected.subtitle} onChange={e => updateField("subtitle", e.target.value)} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">Description</label>
                  <textarea className="cc-textarea" placeholder="Describe what this course covers in detail…" value={selected.description} onChange={e => updateField("description", e.target.value)} style={{ minHeight: 90 }} />
                </div>
                <div className="cc-field">
                  <label className="cc-label">Category</label>
                  <select className="cc-select" value={selected.category} onChange={e => updateField("category", e.target.value)}>
                    <option value="">Select category</option>
                    {COURSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cc-field">
                  <label className="cc-label">Level</label>
                  <select className="cc-select" value={selected.level} onChange={e => updateField("level", e.target.value)}>
                    {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="cc-field">
                  <label className="cc-label">Language</label>
                  <select className="cc-select" value={selected.language} onChange={e => updateField("language", e.target.value)}>
                    {COURSE_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="cc-field">
                  <label className="cc-label">Total Duration</label>
                  <input className="cc-input" placeholder="e.g. 12 hours" value={selected.totalDuration} onChange={e => updateField("totalDuration", e.target.value)} />
                </div>
              </div>

              {/* ── Section 2: Requirements ── */}
              <div className="m-sec-head">Requirements & Outcomes</div>
              <div className="cc-form-grid">
                <div className="cc-field full">
                  <label className="cc-label">Prerequisites</label>
                  <textarea className="cc-textarea" placeholder="e.g. Basic knowledge of HTML & CSS, JavaScript fundamentals…" value={selected.prerequisites} onChange={e => updateField("prerequisites", e.target.value)} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">What You'll Learn</label>
                  <textarea className="cc-textarea" placeholder="List key outcomes, one per line…" value={selected.whatYouLearn} onChange={e => updateField("whatYouLearn", e.target.value)} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">Target Audience</label>
                  <textarea className="cc-textarea" placeholder="Who is this course for?" value={selected.targetAudience} onChange={e => updateField("targetAudience", e.target.value)} style={{ minHeight: 60 }} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">Tags (comma separated)</label>
                  <input className="cc-input" placeholder="e.g. react, javascript, frontend, hooks" value={selected.tags} onChange={e => updateField("tags", e.target.value)} />
                </div>
              </div>

              {/* ── Section 3: Pricing ── */}
              <div className="m-sec-head">Pricing</div>
              <div className="cc-price-tiers">
                {["free", "paid"].map(t => (
                  <button key={t} className={`cc-tier-btn${selected.pricingType === t ? " sel" : ""}`} onClick={() => updateField("pricingType", t)}>
                    {t === "free" ? "🎁 Free" : "💳 Paid"}
                  </button>
                ))}
              </div>
              {selected.pricingType === "paid" && (
                <div className="cc-price-row">
                  <select className="cc-currency-select cc-select" value={selected.currency} onChange={e => updateField("currency", e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="cc-price-input" placeholder="Price (e.g. 49.99)" type="number" min="0" step="0.01" value={selected.price} onChange={e => updateField("price", e.target.value)} />
                  <input className="cc-price-input" placeholder="Original / Crossed price" type="number" min="0" step="0.01" value={selected.originalPrice} onChange={e => updateField("originalPrice", e.target.value)} />
                </div>
              )}
              <div style={{ marginTop: 10, fontFamily: "var(--fm)", fontSize: "0.5rem", color: "var(--dim)" }}>
                Original price shows as crossed out — set higher than price to show discount
              </div>

              {/* ── Section 4: Media ── */}
              <div className="m-sec-head" style={{ marginTop: 18 }}>Media Links</div>
              <div className="cc-form-grid">
                <div className="cc-field full">
                  <label className="cc-label">Thumbnail Image URL</label>
                  <input className="cc-input" placeholder="https://… (image URL for course card)" value={selected.thumbnailUrl} onChange={e => updateField("thumbnailUrl", e.target.value)} />
                </div>
                <div className="cc-field full">
                  <label className="cc-label">Preview Video URL</label>
                  <input className="cc-input" placeholder="https://youtube.com/… or direct link" value={selected.previewVideoUrl} onChange={e => updateField("previewVideoUrl", e.target.value)} />
                </div>
              </div>

              {/* ── Section 5: Episodes ── */}
              <div className="m-sec-head" style={{ marginTop: 18 }}>Episode Content</div>
              <div className="cc-ep-zone">
                <div className="cc-ep-zone-head">
                  <div className="cc-ep-zone-label">
                    📦 Episode Container
                    <span className="cc-ep-count">{(selected.episodes || []).length} episodes</span>
                  </div>
                  <button className="m-add-btn" style={{ fontSize: "0.68rem", padding: "6px 14px" }} onClick={addEpisode}>+ Add Episode</button>
                </div>

                {(selected.episodes || []).map((ep, idx) => (
                  <div key={ep.id} className="cc-ep-card">
                    <div className="cc-ep-header" onClick={() => toggleEp(ep.id)}>
                      <span className="cc-ep-num">EP {String(idx + 1).padStart(2, "0")}</span>
                      <span className="cc-ep-name-preview">{ep.title || `Episode ${idx + 1}`}</span>
                      {ep.fileName && <span style={{ fontFamily: "var(--fm)", fontSize: "0.48rem", color: "var(--green2)" }}>✓ File</span>}
                      <span className="cc-ep-chevron" style={{ transform: openEps[ep.id] ? "rotate(90deg)" : "" }}>▶</span>
                      <button className="cc-ep-del" onClick={e => { e.stopPropagation(); removeEpisode(ep.id); }} title="Remove episode">✕</button>
                    </div>

                    {openEps[ep.id] && (
                      <div className="cc-ep-body">
                        <div className="cc-field">
                          <label className="cc-label">Episode Title</label>
                          <input className="cc-input" placeholder={`Episode ${idx + 1}: Introduction`} value={ep.title} onChange={e => updateEpisode(ep.id, "title", e.target.value)} />
                        </div>
                        <div className="cc-field">
                          <label className="cc-label">Episode Description</label>
                          <textarea className="cc-textarea" placeholder="What does this episode cover?" value={ep.description} onChange={e => updateEpisode(ep.id, "description", e.target.value)} style={{ minHeight: 60 }} />
                        </div>

                        {/* Upload area */}
                        {ep.fileName ? (
                          <div className="cc-ep-file-row">
                            <span style={{ fontSize: "1rem" }}>🎬</span>
                            <span className="cc-ep-file-name">{ep.fileName}</span>
                            <span className="cc-ep-file-size">{ep.fileSize}</span>
                            <button className="cc-ep-del" onClick={() => { updateEpisode(ep.id, "fileName", ""); updateEpisode(ep.id, "fileData", ""); }}>✕</button>
                          </div>
                        ) : (
                          <label className="cc-ep-upload-area">
                            <input type="file" accept="video/*,audio/*,.pdf,.zip" style={{ display: "none" }} onChange={e => handleFileUpload(ep.id, e.target.files[0])} />
                            <div className="cc-ep-upload-icon">⬆️</div>
                            <div className="cc-ep-upload-txt">Click to upload episode content</div>
                            <div className="cc-ep-upload-sub">MP4, MP3, PDF, ZIP — stored as base64 in Firestore</div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {(selected.episodes || []).length === 0 && (
                  <div className="m-empty">No episodes yet. Click "Add Episode" to start.</div>
                )}
              </div>
            </div>

            {/* Actions bar */}
            <div className="cc-actions">
              <button className="cc-save-btn" onClick={() => saveCourse(false)} disabled={saving || publishing}>
                {saving ? "Saving…" : "💾 Save Draft"}
              </button>
              <button className="cc-publish-btn" onClick={() => saveCourse(true)} disabled={saving || publishing || !selected.title.trim()}>
                {publishing ? "Publishing…" : "🚀 Publish Course"}
              </button>
              <span style={{ fontFamily: "var(--fm)", fontSize: "0.5rem", color: "var(--dim)", marginLeft: "auto", alignSelf: "center" }}>
                {selected.status === "published" ? "Live — visible to students" : "Draft — only you can see this"}
              </span>
            </div>
          </div>
        ) : (
          <div className="cc-editor" style={{ alignItems: "center", justifyContent: "center" }}>
            <div className="m-empty" style={{ padding: "60px 24px" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎓</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text2)", fontWeight: 600, marginBottom: 8 }}>No course selected</div>
              <div style={{ marginBottom: 16 }}>Select a course from the left or create a new one.</div>
              <button className="m-add-btn" onClick={createNewCourse}>Create First Course</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MentorProjectView
═══════════════════════════════════════════════ */
export function MentorProjectView({ projectId, user, project, myProfile, onExit }) {
  const nav = useNavigate();
  const [activeTab,    setActiveTab]    = useState("overview");
  const [mobSbOpen,    setMobSbOpen]    = useState(false);
  const [toast,        setToast]        = useState("");

  const [activity,     setActivity]     = useState([]);
  const [files,        setFiles]        = useState([]);
  const [questions,    setQuestions]    = useState([]);
  const [suggestions,  setSuggestions]  = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);
  const [vcMsgs,       setVcMsgs]       = useState([]);
  const [members,      setMembers]      = useState([]);

  const [replyTexts,   setReplyTexts]   = useState({});
  const [aiReplies,    setAiReplies]    = useState({});
  const [aiLoading,    setAiLoading]    = useState({});
  const [sugText,      setSugText]      = useState("");
  const [sugType,      setSugType]      = useState("suggestion");
  const [sugLoading,   setSugLoading]   = useState(false);
  const [aiSugLoading, setAiSugLoading] = useState(false);
  const [vcInput,      setVcInput]      = useState("");
  const [actFilter,    setActFilter]    = useState("all");
  const vcEndRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  useEffect(() => { if(!projectId) return; return onSnapshot(query(collection(db,"teamProjects",projectId,"activity"),orderBy("createdAt","desc")),(snap)=>setActivity(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [projectId]);
  useEffect(() => { if(!projectId) return; return onSnapshot(query(collection(db,"teamProjects",projectId,"files"),orderBy("createdAt","desc")),(snap)=>setFiles(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [projectId]);
  useEffect(() => { if(!projectId) return; return onSnapshot(query(collection(db,"teamProjects",projectId,"questions"),orderBy("createdAt","desc")),(snap)=>setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [projectId]);
  useEffect(() => { if(!projectId) return; return onSnapshot(query(collection(db,"teamProjects",projectId,"suggestions"),orderBy("createdAt","desc")),(snap)=>setSuggestions(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [projectId]);
  useEffect(() => { if(!user) return; return onSnapshot(query(collection(db,"mentorRequests"),where("mentorId","==",user.uid)),(snap)=>setIncomingReqs(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [user]);
  useEffect(() => { if(!projectId) return; return onSnapshot(query(collection(db,"teamProjects",projectId,"vcChat"),orderBy("createdAt","asc")),(snap)=>setVcMsgs(snap.docs.map(d=>({id:d.id,...d.data()})))); }, [projectId]);
  useEffect(() => { vcEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [vcMsgs]);
  useEffect(() => { document.body.style.overflow=mobSbOpen?"hidden":""; return()=>{document.body.style.overflow="";}; }, [mobSbOpen]);
  useEffect(() => {
    if (!project) return;
    const memberIds = project.members || [];
    Promise.all(memberIds.map(async id => { const s=await getDoc(doc(db,"users",id)); return s.exists()?{id,...s.data()}:{id,fullName:"Member"}; })).then(setMembers);
  }, [project]);

  const selectTab = useCallback((id)=>{ setActiveTab(id); setMobSbOpen(false); }, []);

  const postReply = async (questionId) => {
    const text=(replyTexts[questionId]||"").trim(); if(!text) return;
    await addDoc(collection(db,"teamProjects",projectId,"questions",questionId,"replies"),{text,authorId:user.uid,authorName:myProfile?.fullName||"Mentor",isMentor:true,createdAt:serverTimestamp()});
    await updateDoc(doc(db,"teamProjects",projectId,"questions",questionId),{resolved:true});
    await logActivity(projectId,user.uid,myProfile?.fullName||"Mentor","mentor","replied to a question","");
    setReplyTexts(r=>({...r,[questionId]:""}));
    showToast("Reply posted");
  };

  const generateAIReply = async (question) => {
    setAiLoading(l=>({...l,[question.id]:true}));
    try { const {answer}=await callAI("suggest-answer",{question:question.text}); setAiReplies(r=>({...r,[question.id]:answer})); setReplyTexts(r=>({...r,[question.id]:answer})); }
    catch(e) { showToast("AI failed: "+e.message); }
    setAiLoading(l=>({...l,[question.id]:false}));
  };

  const postSuggestion = async () => {
    if (!sugText.trim()) return;
    setSugLoading(true);
    await addDoc(collection(db,"teamProjects",projectId,"suggestions"),{text:sugText,type:sugType,authorId:user.uid,authorName:myProfile?.fullName||"Mentor",avatar:myProfile?.avatar||"1",createdAt:serverTimestamp()});
    await logActivity(projectId,user.uid,myProfile?.fullName||"Mentor","mentor","posted a suggestion",sugText.slice(0,40));
    setSugText(""); setSugLoading(false); showToast("Suggestion posted");
  };

  const generateAISuggestion = async () => {
    setAiSugLoading(true);
    try { const { result }=await callAI("generate-suggestion",{project}); setSugText(result); }
    catch(e) { showToast("AI failed: "+e.message); }
    setAiSugLoading(false);
  };

  const handleRequest = async (reqId, action, req) => {
    await updateDoc(doc(db,"mentorRequests",reqId),{status:action});
    if (action==="accepted") {
      const curr=project?.mentorMembers||[], joins=project?.mentorJoins||[];
      if (!curr.includes(user.uid)) {
        await updateDoc(doc(db,"teamProjects",req.projectId),{ mentorMembers:[...curr,user.uid], mentorJoins:[...joins,{mentorId:user.uid,mentorName:myProfile?.fullName||"Mentor",joinedAt:new Date().toISOString()}] });
      }
      await logActivity(req.projectId,user.uid,myProfile?.fullName||"Mentor","mentor","joined as mentor","");
      showToast("Accepted! You now have project access.");
    } else { showToast("Request declined."); }
  };

  const sendVcMsg = async () => {
    if (!vcInput.trim()) return;
    await addDoc(collection(db,"teamProjects",projectId,"vcChat"),{text:vcInput,userId:user.uid,userName:myProfile?.fullName||"Mentor",avatar:myProfile?.avatar||"1",createdAt:serverTimestamp()});
    setVcInput("");
  };

  const exitProject = async () => {
    if (!confirm("Exit this project as mentor?")) return;
    const curr=project?.mentorMembers||[];
    await updateDoc(doc(db,"teamProjects",projectId),{mentorMembers:curr.filter(x=>x!==user.uid)});
    onExit ? onExit() : nav("/mentor-dashboard");
  };

  /* ════════ PAGE COMPONENTS ════════ */
  const Overview = () => (
    <div className="m-page">
      <div className="m-ph">
        <div>
          <div className="m-ph-title">{project?.projectName||"Project"}<span className="m-pill m-pill-active">Active</span><span className="m-pill m-pill-mentor">Mentor View</span></div>
          <div className="m-ph-sub"><span>{project?.domain||"—"}</span><span>·</span><span>{members.length} students</span><span>·</span><span>{activity.length} activities</span></div>
        </div>
        <div className="m-tags">{(project?.techStack||project?.skills||[]).slice(0,3).map(t=><span key={t} className="m-tag">{t}</span>)}</div>
      </div>
      <div className="m-stats-grid">
        {[{label:"Activity",val:activity.length,sub:"total logs",accent:"#388bfd"},{label:"Files",val:files.length,sub:"uploaded by team",accent:"#8b5cf6"},{label:"Questions",val:questions.filter(q=>!q.resolved).length,sub:"awaiting reply",accent:questions.filter(q=>!q.resolved).length>0?"#f85149":"#3fb950"},{label:"Suggestions",val:suggestions.filter(s=>s.authorId===user?.uid).length,sub:"from you",accent:"#d29922"}].map((s,i)=>(
          <div key={i} className="m-stat-card"><div className="m-stat-accent" style={{background:s.accent}}/><div className="m-stat-lbl">{s.label}</div><div className="m-stat-val">{s.val}</div><div className="m-stat-sub">{s.sub}</div></div>
        ))}
      </div>
      <div className="m-two-col">
        <div>
          <div className="m-sec-head">Team Members</div>
          <div className="m-members-grid" style={{marginBottom:18}}>
            {members.map(m=>(
              <div key={m.id} className="m-mem-card"><div className="m-mem-av"><img src={getAv(m.avatar)} alt={m.fullName}/></div><div><div className="m-mem-name">{m.fullName}</div><div className="m-mem-role">{m.currentRole||"Student"}</div></div></div>
            ))}
            {members.length===0&&<div className="m-empty">No members loaded</div>}
          </div>
          <div className="m-sec-head">Recent Activity</div>
          <div className="m-card">
            {activity.slice(0,5).map(a=>(<div key={a.id} className="m-act-item"><div className="m-act-av"><img src={getAv("1")} alt=""/></div><div style={{flex:1,minWidth:0}}><div className="m-act-name">{a.name}</div><div className="m-act-desc">{a.desc}</div>{a.ref&&<div className="m-act-ref">{a.ref}</div>}<div className="m-act-time">{timeAgo(a.createdAt)}</div></div><span className={`m-act-chip chip-${a.cat||"task"}`}>{(a.cat||"task").toUpperCase()}</span></div>))}
            {activity.length===0&&<div className="m-empty">No activity yet.</div>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="m-card">
            <div className="m-sec-head">Pending Questions</div>
            {questions.filter(q=>!q.resolved).length===0&&<div className="m-empty" style={{padding:"10px 0"}}>All answered</div>}
            {questions.filter(q=>!q.resolved).slice(0,4).map(q=>(<div key={q.id} style={{padding:"8px 0",borderBottom:"1px solid var(--border)"}}><div style={{fontSize:"0.74rem",color:"var(--text2)",marginBottom:2}}>{q.text}</div><div style={{fontFamily:"var(--fm)",fontSize:"0.48rem",color:"var(--muted)"}}>{q.askedByName} · {timeAgo(q.createdAt)}</div></div>))}
            {questions.filter(q=>!q.resolved).length>0&&(<button className="m-save-btn" style={{marginTop:8,width:"100%"}} onClick={()=>selectTab("qa")}>Answer Questions →</button>)}
          </div>
          {project?.description&&(<div className="m-card"><div className="m-sec-head">About</div><div style={{fontSize:"0.74rem",color:"var(--muted)",lineHeight:1.7}}>{project.description}</div></div>)}
        </div>
      </div>
    </div>
  );

  const ActivityTab = () => {
    const filtered=actFilter==="all"?activity:activity.filter(a=>a.cat===actFilter);
    return (
      <div className="m-page">
        <div className="m-ph"><div className="m-ph-title">Activity Log</div></div>
        <div className="m-filter-row">{["all","task","file","code","mentor"].map(f=>(<button key={f} className={`m-filter${actFilter===f?" on":""}`} onClick={()=>setActFilter(f)}>{f.toUpperCase()}</button>))}</div>
        <div className="m-card">
          {filtered.length===0&&<div className="m-empty">No activity yet.</div>}
          {filtered.map(a=>(<div key={a.id} className="m-act-item"><div className="m-act-av"><img src={getAv("1")} alt=""/></div><div style={{flex:1,minWidth:0}}><div className="m-act-name">{a.name}</div><div className="m-act-desc">{a.desc}</div>{a.ref&&<div className="m-act-ref">{a.ref}</div>}<div className="m-act-time">{timeAgo(a.createdAt)}</div></div><span className={`m-act-chip chip-${a.cat||"task"}`}>{(a.cat||"task").toUpperCase()}</span></div>))}
        </div>
      </div>
    );
  };

  const FilesTab = () => (
    <div className="m-page">
      <div className="m-ph"><div><div className="m-ph-title">Project Files</div><div className="m-ph-sub"><span style={{color:"var(--green2)"}}>Read-only access</span></div></div></div>
      <div className="m-info">As mentor, you can view files but cannot upload or delete them.</div>
      {files.length===0&&<div className="m-empty">No files uploaded by the team yet.</div>}
      {files.map(f=>(<div key={f.id} className="m-file-row"><div className="m-file-ext">{fileExt(f.ext)}</div><div style={{flex:1,minWidth:0}}><div className="m-file-name">{f.name}</div><div className="m-file-meta">{f.size} · {f.upBy} · {timeAgo(f.createdAt)}</div></div><span className="m-read-only-badge">Read-only</span></div>))}
    </div>
  );

  const QATab = () => (
    <div className="m-page">
      <div className="m-ph"><div><div className="m-ph-title">Student Questions</div><div className="m-ph-sub"><span>{questions.filter(q=>!q.resolved).length} pending · {questions.filter(q=>q.resolved).length} answered</span></div></div></div>
      {questions.length===0&&<div className="m-empty">No questions posted yet.</div>}
      {questions.map(q=>(
        <div key={q.id} className={`m-qa-card ${q.resolved?"resolved":"pending"}`}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div className="m-qa-question">{q.text}</div>{q.resolved?<span className="m-status-tag m-status-accepted" style={{marginLeft:"auto"}}>Answered</span>:<span className="m-status-tag m-status-pending" style={{marginLeft:"auto"}}>Pending</span>}</div>
          <div className="m-qa-meta">{q.askedByName} · {timeAgo(q.createdAt)}</div>
          {q.resolved&&(<div className="m-qa-reply-area"><div className="m-qa-reply-meta">Your reply</div><div className="m-qa-reply-text">{replyTexts[q.id]||"Reply stored"}</div></div>)}
          {!q.resolved&&(<><textarea className="m-notes-ta" placeholder="Type your reply…" value={replyTexts[q.id]||""} onChange={e=>setReplyTexts(r=>({...r,[q.id]:e.target.value}))} style={{minHeight:80,marginTop:8}}/><div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}><button className="m-save-btn" onClick={()=>postReply(q.id)} disabled={!replyTexts[q.id]?.trim()}>Post Reply</button><button className="m-save-btn" onClick={()=>generateAIReply(q)} disabled={aiLoading[q.id]} style={{borderColor:"rgba(139,92,246,0.3)",color:"var(--violet2)"}}>{aiLoading[q.id]?"Generating…":"✦ AI Suggest"}</button></div>{aiReplies[q.id]&&<div className="m-ai-panel">{aiReplies[q.id]}</div>}</>)}
        </div>
      ))}
    </div>
  );

  const SuggestionsTab = () => (
    <div className="m-page">
      <div className="m-ph"><div className="m-ph-title">Mentor Suggestions</div></div>
      <div className="m-card" style={{marginBottom:16}}>
        <div style={{fontFamily:"var(--fm)",fontSize:"0.5rem",color:"var(--violet2)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>Post Suggestion</div>
        <div className="m-sug-types">{SUG_TYPES.map(t=>(<button key={t.key} className={`m-sug-type-btn${sugType===t.key?" sel":""}`} onClick={()=>setSugType(t.key)}>{t.label}</button>))}</div>
        <textarea className="m-notes-ta" placeholder="Share guidance, resources, or feedback…" value={sugText} onChange={e=>setSugText(e.target.value)} style={{minHeight:90}}/>
        <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
          <button className="m-save-btn" onClick={generateAISuggestion} disabled={aiSugLoading} style={{borderColor:"rgba(139,92,246,0.3)",color:"var(--violet2)"}}>{aiSugLoading?"Generating…":"✦ AI Draft"}</button>
          <button className="m-save-btn" onClick={postSuggestion} disabled={sugLoading||!sugText.trim()} style={{borderColor:"rgba(63,185,80,0.3)",color:"var(--green2)"}}>{sugLoading?"Posting…":"Post Suggestion"}</button>
        </div>
      </div>
      {suggestions.length===0&&<div className="m-empty">No suggestions yet.</div>}
      {suggestions.map(s=>{ const cfg=SUG_TYPES.find(t=>t.key===s.type)||SUG_TYPES[0]; return (<div key={s.id} className="m-sug-item"><div className="m-sug-accent" style={{background:cfg.color}}/><div className="m-sug-body"><div className="m-sug-head"><span className="m-sug-badge" style={{borderColor:`${cfg.color}40`,background:`${cfg.color}10`,color:cfg.color}}>{cfg.label}</span><span className="m-sug-author">{s.authorName}</span><span className="m-sug-time">{timeAgo(s.createdAt)}</span></div><div className="m-sug-text">{s.text}</div></div></div>); })}
    </div>
  );

  const VideoCallTab = () => {
    const roomName=`vpaas-magic-cookie-b3f1a07d85b44d11bffec8162f7f9b7b/team-${projectId.slice(0,12)}`;
    return (
      <div className="m-page">
        <div className="m-ph"><div className="m-ph-title">Video Call</div></div>
        <div className="m-vc-outer">
          <div>
            <div className="m-vc-wrap"><iframe src={`https://8x8.vc/${roomName}#userInfo.displayName="${encodeURIComponent(myProfile?.fullName||"Mentor")}"&config.startWithAudioMuted=true`} allow="camera; microphone; fullscreen; display-capture; autoplay" title="Video Call"/></div>
            <div style={{fontFamily:"var(--fm)",fontSize:"0.48rem",color:"var(--dim)",marginTop:6,textAlign:"center"}}>Room: {projectId.slice(0,12)}</div>
          </div>
          <div className="m-vc-chat">
            <div className="m-vc-head">Team Chat</div>
            <div className="m-vc-msgs">
              {vcMsgs.length===0&&<div className="m-empty">No messages yet.</div>}
              {vcMsgs.map(m=>(<div key={m.id} className="m-vc-msg"><div className="m-vc-msg-av"><img src={getAv(m.avatar||"1")} alt={m.userName}/></div><div><div className="m-vc-msg-name">{m.userName}</div><div className="m-vc-msg-txt">{m.text}</div><div className="m-vc-msg-time">{timeAgo(m.createdAt)}</div></div></div>))}
              <div ref={vcEndRef}/>
            </div>
            <div className="m-vc-inp"><input className="m-vc-input" placeholder="Message…" value={vcInput} onChange={e=>setVcInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendVcMsg()}/><button className="m-vc-send" onClick={sendVcMsg}>Send</button></div>
          </div>
        </div>
      </div>
    );
  };

  const RequestsTab = () => (
    <div className="m-page">
      <div className="m-ph"><div className="m-ph-title">Incoming Requests</div></div>
      {incomingReqs.length===0&&<div className="m-empty">No requests yet.</div>}
      {incomingReqs.map(r=>(
        <div key={r.id} className={`m-req-card ${r.status}`}>
          <div className="m-req-head"><div className="m-req-name">From: {r.studentName}</div><span className={`m-status-tag m-status-${r.status}`}>{r.status.toUpperCase()}</span></div>
          <div className="m-req-meta">{r.projectName} · {r.slot} · {r.mode} · {timeAgo(r.createdAt)}</div>
          {r.message&&<div className="m-req-msg">"{r.message}"</div>}
          {r.status==="pending"&&(<div className="m-req-actions"><button className="m-accept-btn" onClick={()=>handleRequest(r.id,"accepted",r)}>Accept</button><button className="m-decline-btn" onClick={()=>handleRequest(r.id,"declined",r)}>Decline</button></div>)}
        </div>
      ))}
    </div>
  );

  const PANELS = {
    overview:    <Overview/>,
    activity:    <ActivityTab/>,
    files:       <FilesTab/>,
    qa:          <QATab/>,
    suggestions: <SuggestionsTab/>,
    videocall:   <VideoCallTab/>,
    requests:    <RequestsTab/>,
    courses:     <CourseCreator user={user} myProfile={myProfile} showToast={showToast} />,
  };

  return (
    <><style>{MENTOR_CSS}</style>
    <div className="m-shell">
      <div className={`m-mob-overlay${mobSbOpen?" open":""}`} onClick={()=>setMobSbOpen(false)}/>
      <aside className={`m-sb${mobSbOpen?" open":""}`}>
        <div className="m-sb-logo"><div className="m-sb-logo-mark">M</div><div className="m-sb-logo-txt">Mentor View</div></div>
        <div className="m-sb-scroll">
          <div className="m-sb-group">Navigation</div>
          <div className="mentor-indicator"><div className="mentor-indicator-dot"/><div className="mentor-indicator-txt">Active Mentor</div></div>
          {MENTOR_TABS.map(t=>{
            const badge=t.id==="qa"?questions.filter(q=>!q.resolved).length||null:t.id==="requests"?incomingReqs.filter(r=>r.status==="pending").length||null:null;
            return (<div key={t.id} className={`m-sb-item${activeTab===t.id?" active":""}`} onClick={()=>selectTab(t.id)}><span className="m-sb-icon">{t.icon}</span><span className="m-sb-label">{t.label}</span>{badge&&<span className="m-sb-badge">{badge}</span>}</div>);
          })}
        </div>
        <div className="m-sb-footer"><div className="m-sb-user"><div className="m-sb-user-av"><img src={getAv(myProfile?.avatar)} alt="me"/></div><div><div className="m-sb-user-name">{myProfile?.fullName||"Mentor"}</div><div className="m-sb-user-role">Mentor</div></div></div></div>
      </aside>
      <div className="m-main">
        <div className="m-topbar">
          <button className="m-mob-btn" onClick={()=>setMobSbOpen(p=>!p)}>☰</button>
          <div className="m-topbar-crumb"><span className="m-crumb-root" onClick={()=>nav("/mentor-dashboard")}>Mentor Hub</span><span style={{color:"var(--border2)"}}>›</span><span className="m-crumb-current">{project?.projectName||"Project"}</span></div>
          <div className="m-mentor-pill"><span style={{width:5,height:5,borderRadius:"50%",background:"var(--violet2)",display:"inline-block"}}/>Mentor Mode</div>
          <div className="m-topbar-right"><button className="m-save-btn" style={{borderColor:"rgba(248,81,73,0.3)",color:"var(--red)"}} onClick={exitProject}>Exit Project</button></div>
        </div>
        <div className="m-content">{PANELS[activeTab]||<Overview/>}</div>
      </div>
    </div>
    {toast&&<div className="m-toast">{toast}</div>}
    </>
  );
}

/* ═══════════════════════════════════════════════
   MentorDashboard
═══════════════════════════════════════════════ */
const DASH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--bg:#0d1117;--bg2:#161b22;--surface:#1c2128;--surface2:#21262d;--border:#30363d;--border2:#3d444d;--violet:#8b5cf6;--violet2:#a78bfa;--violet3:#6d28d9;--green:#3fb950;--green2:#56d364;--amber:#d29922;--amber2:#e3b341;--red:#f85149;--blue:#388bfd;--blue2:#79c0ff;--text:#e6edf3;--text2:#c9d1d9;--muted:#8b949e;--dim:#484f58;--fh:'Space Grotesk','Segoe UI',sans-serif;--fm:'JetBrains Mono','Courier New',monospace;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--fh);font-size:14px;-webkit-font-smoothing:antialiased;min-height:100vh;}
button{cursor:pointer;font-family:var(--fh);}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#3d444d;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.d-nav{position:sticky;top:0;z-index:100;background:var(--bg2);border-bottom:1px solid var(--border);padding:0 clamp(16px,4vw,32px);height:54px;display:flex;align-items:center;justify-content:space-between;}
.d-brand{display:flex;align-items:center;gap:10px;}
.d-brand-mark{width:28px;height:28px;background:linear-gradient(135deg,#6d28d9,#8b5cf6);border-radius:8px;display:grid;place-items:center;font-size:0.74rem;font-weight:700;color:#fff;}
.d-brand-txt{font-size:0.88rem;font-weight:700;color:var(--text);}
.d-nav-right{display:flex;align-items:center;gap:10px;}
.d-av-btn{width:34px;height:34px;border-radius:50%;border:2px solid var(--violet3);overflow:hidden;background:var(--surface2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;color:#fff;font-weight:700;}
.d-av-btn img{width:100%;height:100%;object-fit:cover;}
.d-tabs{display:flex;gap:2px;background:var(--surface2);border-radius:8px;padding:3px;}
.d-tab{padding:5px 14px;border-radius:6px;border:none;background:transparent;color:var(--muted);font-size:0.8rem;font-weight:600;font-family:var(--fh);cursor:pointer;transition:all 0.15s;}
.d-tab.on{background:var(--surface);color:var(--text);}
.d-main{max-width:1080px;margin:0 auto;padding:clamp(16px,4vw,36px) clamp(16px,4vw,24px) 60px;}
.d-welcome{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:clamp(20px,4vw,32px);flex-wrap:wrap;}
.d-name{font-size:clamp(1.3rem,3vw,1.8rem);font-weight:700;color:var(--text);line-height:1.2;}
.d-sub{font-size:0.82rem;color:var(--muted);margin-top:4px;}
.d-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.d-chip{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:0.7rem;font-weight:600;color:var(--muted);}
.d-chip.violet{border-color:rgba(139,92,246,0.3);background:rgba(139,92,246,0.08);color:var(--violet2);}
.d-edit-btn{padding:8px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:0.76rem;font-weight:700;color:var(--violet2);cursor:pointer;white-space:nowrap;transition:all 0.15s;}
.d-edit-btn:hover{border-color:var(--violet2);background:rgba(139,92,246,0.08);}
.d-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2vw,14px);margin-bottom:clamp(20px,4vw,28px);}
@media(max-width:720px){.d-stat-grid{grid-template-columns:repeat(2,1fr);}}
.d-stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:clamp(14px,3vw,20px);border-top:2px solid;}
.d-stat-val{font-size:clamp(1.5rem,3vw,2rem);font-weight:700;color:var(--text);line-height:1;margin-bottom:6px;}
.d-stat-lbl{font-family:var(--fm);font-size:0.46rem;letter-spacing:0.14em;color:var(--dim);text-transform:uppercase;}
.d-section-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(10px,2vw,16px);}
.d-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:clamp(16px,3vw,22px);animation:fadeUp 0.3s ease;}
.d-card-title{font-family:var(--fm);font-size:0.5rem;font-weight:600;letter-spacing:0.12em;color:var(--dim);text-transform:uppercase;margin-bottom:14px;}
.d-info-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);}
.d-info-row:last-child{border-bottom:none;}
.d-info-key{font-size:0.7rem;font-weight:600;color:var(--muted);}
.d-info-val{font-size:0.78rem;font-weight:600;color:var(--text2);text-align:right;max-width:58%;}
.d-link{display:block;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;font-size:0.78rem;font-weight:600;color:var(--blue2);text-decoration:none;margin-bottom:6px;transition:border-color 0.15s;}
.d-link:hover{border-color:var(--blue);}
.d-proj-card{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:border-color 0.2s;}
.d-proj-card:hover{border-color:var(--border2);}
.d-proj-icon{width:40px;height:40px;border-radius:8px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.25);display:grid;place-items:center;font-family:var(--fm);font-size:0.6rem;font-weight:700;color:var(--violet2);flex-shrink:0;}
.d-proj-name{font-size:0.84rem;font-weight:700;color:var(--text);}
.d-proj-meta{font-family:var(--fm);font-size:0.52rem;color:var(--muted);margin-top:3px;}
.d-proj-btn{margin-left:auto;padding:7px 14px;border-radius:7px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);color:var(--violet2);font-size:0.66rem;font-weight:700;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
.d-proj-btn:hover{background:rgba(139,92,246,0.2);}
.d-empty{font-family:var(--fm);font-size:0.62rem;color:var(--dim);text-align:center;padding:clamp(40px,8vw,80px) 24px;}
.d-empty-title{font-size:1rem;font-weight:700;color:var(--text2);margin-bottom:8px;}
.d-empty-sub{font-size:0.82rem;color:var(--muted);max-width:340px;margin:0 auto;line-height:1.65;}
.d-signout{padding:7px 14px;background:none;border:1px solid rgba(248,81,73,0.25);border-radius:7px;color:var(--red);font-size:0.74rem;font-weight:600;cursor:pointer;transition:all 0.15s;}
.d-signout:hover{background:rgba(248,81,73,0.06);}
.d-spinner{width:30px;height:30px;border:2px solid rgba(139,92,246,0.2);border-top-color:var(--violet2);border-radius:50%;animation:spin 0.8s linear infinite;}
.m-accept-btn{padding:6px 14px;border-radius:6px;border:1px solid rgba(63,185,80,0.3);background:rgba(63,185,80,0.08);color:var(--green2);font-size:0.64rem;font-weight:700;cursor:pointer;transition:all 0.15s;}
.m-accept-btn:hover{background:rgba(63,185,80,0.15);}
.m-decline-btn{padding:6px 14px;border-radius:6px;border:1px solid rgba(248,81,73,0.3);background:rgba(248,81,73,0.06);color:var(--red);font-size:0.64rem;font-weight:700;cursor:pointer;transition:all 0.15s;}
`;

export default function MentorDashboard() {
  const nav = useNavigate();
  const [user,     setUser]     = useState(null);
  const [mentor,   setMentor]   = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [activeTab,setActiveTab]= useState("overview");
  const [reqCount, setReqCount] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav("/mentor/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "mentors", u.uid));
      if (!snap.exists()||!snap.data().profileComplete) { nav("/mentor/profile"); return; }
      setMentor(snap.data());
      const pq = query(collection(db,"teamProjects"), where("mentorMembers","array-contains",u.uid));
      const pSnap = await getDocs(pq);
      setProjects(pSnap.docs.map(d=>({id:d.id,...d.data()})));
      const rq = query(collection(db,"mentorRequests"),where("mentorId","==",u.uid),where("status","==","pending"));
      const rSnap = await getDocs(rq);
      setReqCount(rSnap.size);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogout = async () => { await signOut(auth); nav("/mentor/login"); };

  if (loading) return (
    <><style>{DASH_CSS}</style>
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <div className="d-spinner"/><div style={{fontFamily:"var(--fm)",fontSize:"0.62rem",color:"var(--dim)"}}>LOADING</div>
    </div></>
  );

  const TABS = [
    {id:"overview",  label:"Overview"},
    {id:"teams",     label:`Teams (${projects.length})`},
    {id:"requests",  label:`Requests${reqCount>0?` (${reqCount})`:""}`},
    {id:"earnings",  label:"Earnings"},
  ];

  const OverviewTab = () => (
    <div className="d-section-grid">
      <div className="d-card"><div className="d-card-title">Profile Details</div>{[["Education",mentor?.education],["Organisation",mentor?.orgName],["Current Role",mentor?.currentRole],["Experience",mentor?.experience?`${mentor.experience} yrs`:null],["Country",mentor?.country],["Age",mentor?.age]].filter(([,v])=>v).map(([k,v])=>(<div key={k} className="d-info-row"><span className="d-info-key">{k}</span><span className="d-info-val">{v}</span></div>))}</div>
      <div className="d-card"><div className="d-card-title">About</div><div style={{fontSize:"0.82rem",color:"var(--muted)",lineHeight:1.7,marginBottom:mentor?.helpOffer?16:0}}>{mentor?.bio||"No bio yet."}</div>{mentor?.helpOffer&&<><div style={{fontFamily:"var(--fm)",fontSize:"0.5rem",letterSpacing:"0.1em",color:"var(--dim)",textTransform:"uppercase",margin:"14px 0 8px"}}>What I Offer</div><div style={{fontSize:"0.82rem",color:"var(--muted)",lineHeight:1.7}}>{mentor.helpOffer}</div></>}</div>
      <div className="d-card"><div className="d-card-title">Mentoring Style</div>{[["Approach",mentor?.mentorStyle],["Duration",mentor?.mentoringDuration],["Team Size",mentor?.teamSize],["Availability",mentor?.availability]].filter(([,v])=>v).map(([k,v])=>(<div key={k} className="d-info-row"><span className="d-info-key">{k}</span><span className="d-info-val">{v}</span></div>))}</div>
      <div className="d-card"><div className="d-card-title">Links</div>{mentor?.linkedIn&&<a className="d-link" href={mentor.linkedIn} target="_blank" rel="noreferrer">LinkedIn →</a>}{mentor?.portfolio&&<a className="d-link" href={mentor.portfolio} target="_blank" rel="noreferrer">Portfolio →</a>}{mentor?.github&&<a className="d-link" href={mentor.github} target="_blank" rel="noreferrer">GitHub →</a>}{mentor?.resumeUrl&&<a className="d-link" href={mentor.resumeUrl} target="_blank" rel="noreferrer">Resume →</a>}{!mentor?.linkedIn&&!mentor?.portfolio&&!mentor?.github&&<div style={{fontFamily:"var(--fm)",fontSize:"0.7rem",color:"var(--dim)"}}>No links added.</div>}</div>
    </div>
  );

  const TeamsTab = () => (
    <div>
      {projects.length===0&&(<div className="d-empty"><div className="d-empty-title">No Active Projects</div><div className="d-empty-sub">When students accept your mentorship, their projects will appear here.</div></div>)}
      {projects.map(p=>(<div key={p.id} className="d-proj-card"><div className="d-proj-icon">{(p.projectName||"P").slice(0,2).toUpperCase()}</div><div style={{flex:1,minWidth:0}}><div className="d-proj-name">{p.projectName||"Untitled"}</div><div className="d-proj-meta">{p.domain||"—"} · {(p.members||[]).length} students</div></div><button className="d-proj-btn" onClick={()=>nav(`/team-dashboard/${p.id}`)}>View Project →</button></div>))}
    </div>
  );

  const RequestsTab = () => {
    const [reqs,setReqs]=useState([]);
    useEffect(()=>{ if(!user) return; const q=query(collection(db,"mentorRequests"),where("mentorId","==",user.uid),orderBy("createdAt","desc")); return onSnapshot(q,snap=>setReqs(snap.docs.map(d=>({id:d.id,...d.data()})))); },[]);
    const handle=async(id,action,req)=>{ await updateDoc(doc(db,"mentorRequests",id),{status:action}); if(action==="accepted"){const pSnap=await getDoc(doc(db,"teamProjects",req.projectId)); if(pSnap.exists()){const pd=pSnap.data();const curr=pd.mentorMembers||[],joins=pd.mentorJoins||[];if(!curr.includes(user.uid)){await updateDoc(doc(db,"teamProjects",req.projectId),{mentorMembers:[...curr,user.uid],mentorJoins:[...joins,{mentorId:user.uid,mentorName:mentor?.fullName||"Mentor",joinedAt:new Date().toISOString()}]});}}const pq=query(collection(db,"teamProjects"),where("mentorMembers","array-contains",user.uid));const pS=await getDocs(pq);setProjects(pS.docs.map(d=>({id:d.id,...d.data()})));} };
    return (
      <div>
        {reqs.length===0&&<div className="d-empty"><div className="d-empty-title">No Requests</div><div className="d-empty-sub">Student teams will send requests when they need a mentor.</div></div>}
        {reqs.map(r=>(<div key={r.id} className="d-proj-card" style={{flexDirection:"column",alignItems:"flex-start",borderLeft:`3px solid ${r.status==="accepted"?"var(--green2)":r.status==="declined"?"var(--dim)":"var(--amber2)"}`}}><div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}><div className="d-proj-name">{r.studentName} → {r.projectName}</div><span style={{marginLeft:"auto",fontFamily:"var(--fm)",fontSize:"0.46rem",padding:"2px 7px",borderRadius:4,border:"1px solid",borderColor:r.status==="accepted"?"rgba(63,185,80,0.3)":r.status==="declined"?"rgba(72,79,88,0.4)":"rgba(210,153,34,0.3)",background:r.status==="accepted"?"rgba(63,185,80,0.08)":r.status==="declined"?"rgba(72,79,88,0.08)":"rgba(210,153,34,0.08)",color:r.status==="accepted"?"var(--green2)":r.status==="declined"?"var(--dim)":"var(--amber2)"}}>{r.status.toUpperCase()}</span></div><div style={{fontFamily:"var(--fm)",fontSize:"0.52rem",color:"var(--muted)",marginTop:4}}>{r.slot} · {r.mode} · {timeAgo(r.createdAt)}</div>{r.message&&<div style={{fontStyle:"italic",fontSize:"0.74rem",color:"var(--dim)",marginTop:6}}>"{r.message}"</div>}{r.status==="pending"&&(<div style={{display:"flex",gap:6,marginTop:10}}><button className="m-accept-btn" onClick={()=>handle(r.id,"accepted",r)}>Accept</button><button className="m-decline-btn" onClick={()=>handle(r.id,"declined",r)}>Decline</button></div>)}{r.status==="accepted"&&(<button className="d-proj-btn" style={{marginTop:8}} onClick={()=>nav(`/project/${r.projectId}`)}>Open Project →</button>)}</div>))}
      </div>
    );
  };

  const EarningsTab = () => (
    <div className="d-card" style={{textAlign:"center",padding:"clamp(40px,8vw,80px) 24px"}}>
      <div className="d-empty-title">Earnings Dashboard</div>
      <div className="d-empty-sub" style={{marginTop:8}}>Your earnings will appear after completing paid sessions.</div>
      {mentor?.price>0&&<div style={{marginTop:16,fontSize:"0.9rem",fontWeight:700,color:"var(--green2)"}}>Rate: {mentor.currency||"USD"} {mentor.price} / session</div>}
    </div>
  );

  const PANELS = { overview:<OverviewTab/>, teams:<TeamsTab/>, requests:<RequestsTab/>, earnings:<EarningsTab/> };

  return (
    <><style>{DASH_CSS}</style>
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <nav className="d-nav">
        <div className="d-brand"><div className="d-brand-mark">M</div><span className="d-brand-txt">MentorHub</span></div>
        <div className="d-tabs">{TABS.map(t=><button key={t.id} className={`d-tab${activeTab===t.id?" on":""}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}</div>
        <div className="d-nav-right"><button className="d-signout" onClick={handleLogout}>Sign Out</button><button className="d-av-btn" onClick={()=>nav("/mentor/profile/update")}>{(mentor?.fullName||"M").charAt(0).toUpperCase()}</button></div>
      </nav>
      <main className="d-main">
        <div className="d-welcome">
          <div><div className="d-name">{mentor?.fullName?.split(" ")[0]},</div><div className="d-sub">{mentor?.currentRole}{mentor?.orgName?` · ${mentor.orgName}`:""}</div><div className="d-chips">{mentor?.domain&&<span className="d-chip violet">{mentor.domain}</span>}{mentor?.country&&<span className="d-chip">{mentor.country}</span>}{mentor?.price>0?<span className="d-chip">{mentor.currency} {mentor.price}/session</span>:<span className="d-chip">Free sessions</span>}</div></div>
          <button className="d-edit-btn" onClick={()=>nav("/mentor/profile/update")}>Edit Profile</button>
        </div>
        <div className="d-stat-grid">{[{label:"Active Projects",val:projects.length,accent:"var(--violet)"},{label:"Pending Requests",val:reqCount,accent:"var(--amber2)"},{label:"Avg Rating",val:"—",accent:"var(--amber)"},{label:"Sessions",val:"0",accent:"var(--green2)"}].map((s,i)=>(<div key={i} className="d-stat" style={{borderTopColor:s.accent}}><div className="d-stat-val">{s.val}</div><div className="d-stat-lbl">{s.label}</div></div>))}</div>
        {PANELS[activeTab]||<OverviewTab/>}
      </main>
    </div>
    </>
  );
}