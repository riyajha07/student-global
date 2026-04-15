import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, getDoc, updateDoc, collection,
  query, where, getDocs, addDoc, deleteDoc, serverTimestamp, orderBy
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

/* ─── helpers ─────────────────────────────────────────────────────── */
function makeAvatar(idx) {
  const hues = [200,180,220,260,160,280,140,300,170,240];
  const h = hues[idx % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="hsl(${h},70%,12%)"/><circle cx="32" cy="26" r="12" fill="hsl(${h},80%,55%)"/><ellipse cx="32" cy="48" rx="16" ry="10" fill="hsl(${h},80%,45%)"/><circle cx="32" cy="26" r="10" fill="hsl(${h},60%,75%)"/><rect x="24" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/><rect x="36" y="28" width="4" height="3" rx="1" fill="hsl(${h},30%,20%)"/><path d="M27 34 Q32 38 37 34" stroke="hsl(${h},30%,20%)" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
function getAvatarSrc(a) { const i=parseInt((a||"0").replace(/\D/g,""))-1; return makeAvatar(isNaN(i)?0:i); }
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function fmtRelative(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return fmtDate(ts);
}
const PRIORITY_META = {
  high:   { label:"High",   color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.25)" },
  medium: { label:"Medium", color:"#fbbf24", bg:"rgba(251,191,36,0.1)",  border:"rgba(251,191,36,0.25)"  },
  low:    { label:"Low",    color:"#4ade80", bg:"rgba(74,222,128,0.1)",  border:"rgba(74,222,128,0.25)"  },
};
const STATUS_META = {
  todo:        { label:"To Do",       color:"#94a3b8", dot:"#94a3b8" },
  in_progress: { label:"In Progress", color:"#38bdf8", dot:"#38bdf8" },
  in_review:   { label:"In Review",   color:"#a78bfa", dot:"#a78bfa" },
  done:        { label:"Done",        color:"#4ade80", dot:"#4ade80" },
};

const LANG_COLORS = {
  js: "#f7df1e", ts: "#3178c6", py: "#3572A5", html: "#e34c26",
  css: "#563d7c", json: "#292929", md: "#083fa1", txt: "#888",
  jsx: "#61dafb", tsx: "#3178c6", cpp: "#f34b7d", c: "#555555",
  java: "#b07219", rs: "#dea584", go: "#00ADD8", rb: "#701516",
};
function getLangColor(filename) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  return LANG_COLORS[ext] || "#00e5ff";
}
function getLangLabel(filename) {
  return filename?.split(".").pop()?.toUpperCase() || "TXT";
}

/* ─── CSS ─────────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --bg: #020c18;
    --bg2: #041022;
    --surface: #071428;
    --surface2: #0a1a36;
    --surface3: #0d2044;
    --border: rgba(0,180,255,0.12);
    --border2: rgba(0,180,255,0.07);
    --border-cyan: rgba(0,229,255,0.25);
    --text: #e2f0ff;
    --muted: #6a8aaa;
    --muted2: #3a5070;
    --cyan: #00e5ff;
    --cyan2: #00b4d8;
    --cyan-dim: rgba(0,229,255,0.15);
    --blue: #1e90ff;
    --blue-dim: rgba(30,144,255,0.12);
    --green: #00e676;
    --green-dim: rgba(0,230,118,0.1);
    --amber: #ffab40;
    --red: #ff5252;
    --purple: #9c88ff;
    --accent: #00e5ff;
    --font-ui: 'Space Grotesk', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
    --glow-cyan: 0 0 20px rgba(0,229,255,0.15), 0 0 40px rgba(0,229,255,0.05);
    --glow-border: 0 0 0 1px rgba(0,229,255,0.2);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 80% 50% at 20% -10%, rgba(0,100,200,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 110%, rgba(0,200,255,0.08) 0%, transparent 60%),
      linear-gradient(180deg, #020c18 0%, #041022 100%);
    color: var(--text);
    font-family: var(--font-ui);
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.15); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.3); }

  /* GRID BACKGROUND */
  .sc-shell { display: flex; flex-direction: column; min-height: 100vh; position: relative; }
  .sc-shell::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(0,229,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,255,0.025) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* TOP NAV */
  .sc-nav {
    position: sticky; top: 0; z-index: 200;
    height: 52px; display: flex; align-items: center;
    padding: 0 1.25rem; gap: 14px;
    background: rgba(2,12,24,0.92);
    border-bottom: 1px solid var(--border-cyan);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .sc-nav::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent);
  }

  /* LOGO */
  .sc-logo {
    display: flex; align-items: center; gap: 2px;
    font-family: var(--font-mono);
    font-size: 14px; font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--cyan);
    text-shadow: 0 0 10px rgba(0,229,255,0.6), 0 0 20px rgba(0,229,255,0.3);
    flex-shrink: 0;
    user-select: none;
  }
  .sc-logo-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--cyan);
    box-shadow: 0 0 8px var(--cyan);
    margin: 0 4px;
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--cyan); }
    50% { opacity: 0.6; box-shadow: 0 0 4px var(--cyan); }
  }

  .sc-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12.5px; min-width: 0; overflow: hidden; }
  .sc-breadcrumb-sep { color: var(--muted2); }
  .sc-breadcrumb-link { color: var(--cyan2); cursor: pointer; font-weight: 500; opacity: 0.8; }
  .sc-breadcrumb-link:hover { opacity: 1; color: var(--cyan); }
  .sc-breadcrumb-current { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .sc-nav-spacer { flex: 1; }

  .sc-nav-icon-btn {
    width: 30px; height: 30px; border-radius: 6px;
    border: 1px solid var(--border-cyan);
    background: var(--cyan-dim);
    color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; flex-shrink: 0;
  }
  .sc-nav-icon-btn:hover { background: rgba(0,229,255,0.2); color: var(--cyan); box-shadow: var(--glow-cyan); }

  .sc-av-btn {
    width: 30px; height: 30px; border-radius: 50%;
    overflow: hidden;
    border: 1px solid var(--border-cyan);
    cursor: pointer; background: none; padding: 0; flex-shrink: 0;
    box-shadow: 0 0 8px rgba(0,229,255,0.2);
  }
  .sc-av-btn img { width: 100%; height: 100%; object-fit: cover; }

  /* MOBILE HAMBURGER */
  .sc-hamburger {
    display: none; width: 30px; height: 30px; border-radius: 6px;
    border: 1px solid var(--border-cyan); background: var(--cyan-dim);
    color: var(--muted); cursor: pointer; align-items: center; justify-content: center;
    transition: all 0.2s; flex-shrink: 0;
  }
  .sc-hamburger:hover { color: var(--cyan); }
  @media(max-width: 768px) { .sc-hamburger { display: flex; } }

  /* BODY LAYOUT */
  .sc-body { display: flex; flex: 1; min-height: 0; position: relative; z-index: 1; }

  /* SIDEBAR DRAWER */
  .sc-sidebar {
    width: 220px; flex-shrink: 0;
    border-right: 1px solid var(--border);
    padding: 1rem 0; display: flex; flex-direction: column;
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    background: rgba(4,16,34,0.6);
  }
  @media(max-width: 768px) {
    .sc-sidebar {
      position: fixed; top: 52px; left: 0; bottom: 0; z-index: 300;
      background: rgba(4,16,34,0.98);
      backdrop-filter: blur(20px);
      border-right: 1px solid var(--border-cyan);
      transform: translateX(-100%);
      width: 260px;
    }
    .sc-sidebar.open { transform: translateX(0); }
  }

  .sc-sidebar-overlay {
    display: none;
    position: fixed; inset: 0; z-index: 299;
    background: rgba(0,0,0,0.6);
  }
  @media(max-width: 768px) { .sc-sidebar-overlay.open { display: block; } }

  .sc-sidebar-section { margin-bottom: 1.25rem; }
  .sc-sidebar-label {
    font-size: 10px; font-weight: 700; color: var(--cyan);
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 0 1rem; margin-bottom: 4px;
    opacity: 0.7;
  }
  .sc-sidebar-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 1rem; font-size: 13px; font-weight: 500; color: var(--muted);
    cursor: pointer; border: none; background: transparent; width: 100%; text-align: left;
    border-left: 2px solid transparent;
    transition: all 0.15s; position: relative;
  }
  .sc-sidebar-item:hover { color: var(--text); background: var(--cyan-dim); }
  .sc-sidebar-item.active {
    color: var(--cyan); font-weight: 600;
    border-left-color: var(--cyan);
    background: rgba(0,229,255,0.06);
    text-shadow: 0 0 10px rgba(0,229,255,0.4);
  }
  .sc-sidebar-count {
    margin-left: auto; font-size: 10px; font-family: var(--font-mono);
    background: var(--surface3); color: var(--cyan); padding: 1px 6px;
    border-radius: 10px; border: 1px solid var(--border-cyan);
  }

  .sc-sidebar-info { padding: 0 1rem; }
  .sc-sidebar-info-row {
    display: flex; justify-content: space-between; font-size: 11px;
    padding: 4px 0; border-bottom: 1px solid var(--border2); color: var(--muted);
  }
  .sc-sidebar-info-val { color: var(--text); text-align: right; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* MAIN CONTENT */
  .sc-content { flex: 1; min-width: 0; padding: 1.5rem; overflow-y: auto; max-height: calc(100vh - 52px); }
  @media(max-width: 768px) { .sc-content { padding: 1rem; } }

  /* PAGE HEADER */
  .sc-page-header { margin-bottom: 1.5rem; }
  .sc-page-title {
    font-size: 18px; font-weight: 700; color: var(--text);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .sc-page-title svg { color: var(--cyan); }
  .sc-page-meta { display: flex; align-items: center; gap: 1rem; margin-top: 6px; flex-wrap: wrap; }
  .sc-page-meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }

  /* BADGE */
  .sc-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 700; font-family: var(--font-mono);
    padding: 2px 8px; border-radius: 12px; border: 1px solid;
    white-space: nowrap; letter-spacing: 0.06em;
  }
  .sc-badge-cyan { color: var(--cyan); background: var(--cyan-dim); border-color: var(--border-cyan); }
  .sc-badge-green { color: var(--green); background: var(--green-dim); border-color: rgba(0,230,118,0.3); }
  .sc-badge-amber { color: var(--amber); background: rgba(255,171,64,0.1); border-color: rgba(255,171,64,0.3); }
  .sc-badge-red { color: var(--red); background: rgba(255,82,82,0.1); border-color: rgba(255,82,82,0.3); }

  /* STAT STRIP */
  .sc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 1.5rem; }
  @media(max-width: 640px) { .sc-stats { grid-template-columns: repeat(2, 1fr); } }
  .sc-stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative; overflow: hidden;
  }
  .sc-stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent);
  }
  .sc-stat-card:hover { border-color: var(--border-cyan); box-shadow: var(--glow-cyan); }
  .sc-stat-label { font-size: 10px; color: var(--muted); font-weight: 600; letter-spacing: 0.08em; margin-bottom: 6px; text-transform: uppercase; }
  .sc-stat-val { font-size: 24px; font-weight: 700; color: var(--text); font-family: var(--font-mono); line-height: 1; }
  .sc-stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* PROGRESS */
  .sc-progress-wrap { margin-bottom: 1.5rem; }
  .sc-progress-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .sc-progress-title { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .sc-progress-pct { font-size: 13px; font-family: var(--font-mono); color: var(--cyan); font-weight: 600; }
  .sc-progress-bar { height: 6px; border-radius: 3px; background: var(--surface3); overflow: hidden; }
  .sc-progress-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, var(--blue) 0%, var(--cyan) 100%);
    box-shadow: 0 0 10px rgba(0,229,255,0.4);
    transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
  }
  .sc-progress-segments { display: flex; gap: 2px; margin-top: 8px; }
  .sc-progress-seg { height: 3px; border-radius: 2px; min-width: 4px; }

  /* TABS */
  .sc-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; gap: 0; overflow-x: auto; }
  .sc-tab {
    padding: 8px 16px; font-size: 13px; font-weight: 500; color: var(--muted);
    cursor: pointer; background: transparent; border: none; border-bottom: 2px solid transparent;
    display: flex; align-items: center; gap: 7px; white-space: nowrap;
    transition: color 0.15s; margin-bottom: -1px; font-family: var(--font-ui);
  }
  .sc-tab:hover { color: var(--text); }
  .sc-tab.active { color: var(--cyan); border-bottom-color: var(--cyan); text-shadow: 0 0 8px rgba(0,229,255,0.4); }
  .sc-tab-count { font-size: 10px; background: var(--surface3); color: var(--cyan); padding: 1px 6px; border-radius: 10px; font-family: var(--font-mono); }

  /* TOOLBAR */
  .sc-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap; }
  .sc-search {
    flex: 1; min-width: 160px; max-width: 300px;
    display: flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 7px;
    padding: 0 10px; height: 34px; transition: border-color 0.2s;
  }
  .sc-search:focus-within { border-color: var(--border-cyan); box-shadow: 0 0 0 2px rgba(0,229,255,0.06); }
  .sc-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-size: 13px; font-family: var(--font-ui); }
  .sc-search input::placeholder { color: var(--muted2); }
  .sc-search svg { color: var(--muted2); flex-shrink: 0; }
  .sc-select {
    height: 34px; padding: 0 28px 0 10px; border-radius: 7px;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    font-size: 12.5px; font-family: var(--font-ui); outline: none; cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236a8aaa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    transition: border-color 0.2s;
  }
  .sc-select:focus { border-color: var(--border-cyan); }

  .sc-btn {
    height: 34px; padding: 0 14px; border-radius: 7px;
    font-size: 12.5px; font-weight: 600; font-family: var(--font-ui);
    cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;
    transition: all 0.15s; border: 1px solid;
  }
  .sc-btn-primary {
    background: linear-gradient(135deg, rgba(0,180,255,0.15), rgba(0,229,255,0.1));
    border-color: var(--border-cyan); color: var(--cyan);
    box-shadow: 0 0 12px rgba(0,229,255,0.08);
  }
  .sc-btn-primary:hover { background: rgba(0,229,255,0.2); box-shadow: var(--glow-cyan); }
  .sc-btn-ghost { background: transparent; color: var(--text); border-color: var(--border); }
  .sc-btn-ghost:hover { background: var(--surface2); border-color: var(--border-cyan); color: var(--cyan); }
  .sc-btn-danger { background: transparent; color: var(--red); border-color: rgba(255,82,82,0.3); }
  .sc-btn-danger:hover { background: rgba(255,82,82,0.08); }
  .sc-btn-success { background: linear-gradient(135deg, rgba(0,230,118,0.15), rgba(0,200,100,0.1)); border-color: rgba(0,230,118,0.3); color: var(--green); }
  .sc-btn-success:hover { background: rgba(0,230,118,0.2); }
  .sc-btn-sm { height: 28px; padding: 0 10px; font-size: 11.5px; border-radius: 5px; }

  /* ISSUE LIST */
  .sc-issue-list { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .sc-issue-list-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; background: var(--surface);
    border-bottom: 1px solid var(--border); font-size: 12.5px;
  }
  .sc-issue-row {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 14px; border-bottom: 1px solid var(--border2);
    transition: background 0.1s;
  }
  .sc-issue-row:last-child { border-bottom: none; }
  .sc-issue-row:hover { background: rgba(0,229,255,0.03); }
  .sc-issue-check {
    width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border-cyan);
    background: transparent; cursor: pointer; flex-shrink: 0; margin-top: 1px;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .sc-issue-check.checked { background: var(--cyan); border-color: var(--cyan); box-shadow: 0 0 6px rgba(0,229,255,0.5); }
  .sc-issue-icon { width: 18px; height: 18px; flex-shrink: 0; }
  .sc-issue-body { flex: 1; min-width: 0; }
  .sc-issue-title { font-size: 13.5px; font-weight: 500; color: var(--text); cursor: pointer; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sc-issue-title:hover .sc-issue-title-text { color: var(--cyan); }
  .sc-issue-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-issue-sub { font-size: 11.5px; color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sc-issue-num { font-family: var(--font-mono); }
  .sc-issue-label { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 10px; border: 1px solid; letter-spacing: 0.04em; }
  .sc-issue-actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  .sc-issue-row:hover .sc-issue-actions { opacity: 1; }
  .sc-issue-action-btn {
    background: transparent; border: none; color: var(--muted); cursor: pointer;
    padding: 4px; border-radius: 5px; display: flex; align-items: center;
    transition: color 0.15s, background 0.15s;
  }
  .sc-issue-action-btn:hover { color: var(--cyan); background: var(--cyan-dim); }

  /* KANBAN */
  .sc-kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: start; }
  @media(max-width: 700px) { .sc-kanban { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 440px) { .sc-kanban { grid-template-columns: 1fr; } }
  .sc-col { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .sc-col-header { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
  .sc-col-title { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
  .sc-col-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 4px currentColor; }
  .sc-col-count { font-size: 10px; font-family: var(--font-mono); color: var(--muted); background: var(--surface3); padding: 1px 6px; border-radius: 10px; }
  .sc-col-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 60px; }
  .sc-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 7px; padding: 10px 12px; cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .sc-card:hover { border-color: var(--border-cyan); box-shadow: var(--glow-cyan); transform: translateY(-1px); }
  .sc-card-title { font-size: 12.5px; font-weight: 500; color: var(--text); line-height: 1.4; margin-bottom: 8px; }
  .sc-card-footer { display: flex; align-items: center; justify-content: space-between; }
  .sc-card-num { font-size: 10px; font-family: var(--font-mono); color: var(--muted2); }
  .sc-card-priority { width: 8px; height: 8px; border-radius: 2px; box-shadow: 0 0 5px currentColor; }
  .sc-col-add-btn { width: 100%; padding: 8px; background: transparent; border: none; border-top: 1px solid var(--border2); color: var(--muted); font-size: 11.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s; font-family: var(--font-ui); }
  .sc-col-add-btn:hover { background: var(--cyan-dim); color: var(--cyan); }

  /* CODE EDITOR */
  .sc-editor-wrap { display: flex; flex-direction: column; height: calc(100vh - 160px); min-height: 400px; }
  .sc-editor-toolbar {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: var(--surface); border: 1px solid var(--border);
    border-bottom: none; border-radius: 10px 10px 0 0;
    flex-wrap: wrap;
  }
  .sc-editor-filename-input {
    flex: 1; min-width: 120px; max-width: 220px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 5px;
    padding: 4px 10px; color: var(--text); font-size: 12.5px;
    font-family: var(--font-mono); outline: none; transition: border-color 0.2s;
  }
  .sc-editor-filename-input:focus { border-color: var(--border-cyan); }
  .sc-editor-lang { font-size: 10px; font-family: var(--font-mono); font-weight: 700; padding: 2px 8px; border-radius: 10px; border: 1px solid; background: transparent; }
  .sc-editor-area {
    flex: 1; width: 100%; background: #010a15;
    border: 1px solid var(--border); border-top: none;
    border-radius: 0 0 0 0;
    padding: 16px; color: #a8d8f0; font-family: var(--font-mono);
    font-size: 13px; line-height: 1.7; outline: none; resize: none;
    tab-size: 2; caret-color: var(--cyan);
    transition: border-color 0.2s;
  }
  .sc-editor-area:focus { border-color: var(--border-cyan); }
  .sc-commit-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; background: var(--surface);
    border: 1px solid var(--border); border-top: 1px solid rgba(0,229,255,0.15);
    border-radius: 0 0 10px 10px; flex-wrap: wrap;
  }
  .sc-commit-input {
    flex: 1; min-width: 200px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 12px;
    color: var(--text); font-size: 12.5px; font-family: var(--font-ui); outline: none;
    transition: border-color 0.2s;
  }
  .sc-commit-input:focus { border-color: rgba(0,229,255,0.4); }
  .sc-commit-input::placeholder { color: var(--muted2); }

  /* PROJECT FILES TAB */
  .sc-files-grid { display: flex; flex-direction: column; gap: 8px; }
  .sc-file-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px;
    transition: all 0.15s; cursor: pointer;
  }
  .sc-file-row:hover { border-color: var(--border-cyan); background: rgba(0,229,255,0.03); }
  .sc-file-icon {
    width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center;
    justify-content: center; font-size: 10px; font-weight: 700; font-family: var(--font-mono);
    flex-shrink: 0; border: 1px solid;
  }
  .sc-file-name { font-size: 13.5px; font-weight: 500; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-file-meta { font-size: 11px; color: var(--muted); font-family: var(--font-mono); white-space: nowrap; }
  .sc-file-actions { display: flex; gap: 5px; opacity: 0; transition: opacity 0.15s; }
  .sc-file-row:hover .sc-file-actions { opacity: 1; }

  /* COMMIT HISTORY */
  .sc-commit-history { margin-top: 1.5rem; }
  .sc-commit-timeline { display: flex; flex-direction: column; gap: 0; }
  .sc-commit-item { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; position: relative; }
  .sc-commit-item:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 28px; bottom: -4px; width: 1px; background: var(--border); }
  .sc-commit-dot {
    width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0; border: 1px solid var(--border-cyan);
    background: var(--surface2); font-size: 10px;
    box-shadow: 0 0 6px rgba(0,229,255,0.15);
  }
  .sc-commit-body { flex: 1; min-width: 0; }
  .sc-commit-msg { font-size: 13px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-commit-meta { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: var(--font-mono); }
  .sc-commit-hash { font-size: 10px; font-family: var(--font-mono); color: var(--cyan); background: var(--cyan-dim); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-cyan); white-space: nowrap; }

  /* ASSETS / GALLERY */
  .sc-assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  @media(max-width: 480px) { .sc-assets-grid { grid-template-columns: repeat(2, 1fr); } }
  .sc-asset-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; cursor: pointer;
    transition: all 0.2s; position: relative;
  }
  .sc-asset-card:hover { border-color: var(--border-cyan); box-shadow: var(--glow-cyan); transform: translateY(-2px); }
  .sc-asset-thumb {
    width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block;
    background: var(--surface2);
  }
  .sc-asset-thumb-placeholder {
    width: 100%; aspect-ratio: 4/3;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--surface2), var(--surface3));
    font-size: 28px;
  }
  .sc-asset-info { padding: 8px 10px; }
  .sc-asset-name { font-size: 11px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-asset-size { font-size: 10px; color: var(--muted); margin-top: 2px; font-family: var(--font-mono); }
  .sc-asset-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    opacity: 0; transition: opacity 0.2s;
  }
  .sc-asset-card:hover .sc-asset-overlay { opacity: 1; }

  .sc-upload-zone {
    border: 2px dashed var(--border-cyan); border-radius: 12px;
    padding: 2.5rem; text-align: center; cursor: pointer;
    transition: all 0.2s; background: var(--cyan-dim);
    margin-bottom: 1.5rem;
  }
  .sc-upload-zone:hover, .sc-upload-zone.drag { border-color: var(--cyan); background: rgba(0,229,255,0.1); box-shadow: var(--glow-cyan); }
  .sc-upload-zone-icon { font-size: 32px; margin-bottom: 10px; }
  .sc-upload-zone-text { font-size: 13px; color: var(--muted); }
  .sc-upload-zone-text strong { color: var(--cyan); }

  /* NOTES */
  .sc-notes-area {
    width: 100%; min-height: 260px; background: #010a15;
    border: 1px solid var(--border); border-radius: 10px;
    padding: 16px; color: #a8d8f0; font-family: var(--font-mono);
    font-size: 13.5px; line-height: 1.7; outline: none; resize: vertical;
    transition: border-color 0.2s;
  }
  .sc-notes-area:focus { border-color: var(--border-cyan); }

  /* ACTIVITY */
  .sc-activity { display: flex; flex-direction: column; gap: 0; }
  .sc-activity-item { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; position: relative; }
  .sc-activity-item:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 32px; bottom: 0; width: 1px; background: var(--border); }
  .sc-activity-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-cyan); background: var(--surface2); font-size: 11px; }
  .sc-activity-body { flex: 1; min-width: 0; }
  .sc-activity-text { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .sc-activity-text strong { color: var(--text); font-weight: 600; }
  .sc-activity-time { font-size: 11px; color: var(--muted2); margin-top: 2px; font-family: var(--font-mono); }

  /* CONTRIBUTION GRAPH */
  .sc-contrib { margin-bottom: 1.5rem; }
  .sc-contrib-grid { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 4px; }
  .sc-contrib-week { display: flex; flex-direction: column; gap: 3px; }
  .sc-contrib-day { width: 12px; height: 12px; border-radius: 2px; background: var(--surface3); transition: background 0.2s; }
  .sc-contrib-day:hover { outline: 1px solid rgba(0,229,255,0.4); }
  .sc-contrib-day.l1 { background: rgba(0,229,255,0.15); }
  .sc-contrib-day.l2 { background: rgba(0,229,255,0.3); }
  .sc-contrib-day.l3 { background: rgba(0,229,255,0.55); }
  .sc-contrib-day.l4 { background: var(--cyan); box-shadow: 0 0 4px rgba(0,229,255,0.5); }
  .sc-contrib-months { display: flex; font-size: 10px; color: var(--muted2); gap: 0; margin-bottom: 4px; font-family: var(--font-mono); overflow: hidden; }

  /* MODAL */
  .sc-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
  .sc-modal {
    background: var(--surface); border: 1px solid var(--border-cyan);
    border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh;
    overflow-y: auto; box-shadow: 0 24px 80px rgba(0,0,0,0.6), var(--glow-cyan);
  }
  .sc-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .sc-modal-title { font-size: 15px; font-weight: 700; color: var(--text); }
  .sc-modal-close { background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: 5px; display: flex; align-items: center; transition: all 0.15s; }
  .sc-modal-close:hover { color: var(--cyan); background: var(--cyan-dim); }
  .sc-modal-body { padding: 20px; }
  .sc-field { margin-bottom: 16px; }
  .sc-field-label { font-size: 10.5px; font-weight: 700; color: var(--muted); margin-bottom: 6px; display: block; letter-spacing: 0.08em; text-transform: uppercase; }
  .sc-field-input {
    width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px;
    padding: 8px 12px; color: var(--text); font-size: 13.5px; font-family: var(--font-ui); outline: none;
    transition: border-color 0.2s;
  }
  .sc-field-input:focus { border-color: var(--border-cyan); box-shadow: 0 0 0 2px rgba(0,229,255,0.06); }
  .sc-field-select { appearance: none; cursor: pointer; }
  .sc-field-textarea { min-height: 80px; resize: vertical; line-height: 1.5; }
  .sc-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border); }

  /* TOAST */
  .sc-toast-wrap { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 900; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
  .sc-toast { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 8px; border: 1px solid; font-size: 13px; font-weight: 500; pointer-events: auto; animation: toast-in 0.25s cubic-bezier(0.4,0,0.2,1); }
  .sc-toast-success { background: rgba(0,230,118,0.1); border-color: rgba(0,230,118,0.3); color: var(--green); }
  .sc-toast-info { background: var(--cyan-dim); border-color: var(--border-cyan); color: var(--cyan); }
  .sc-toast-error { background: rgba(255,82,82,0.1); border-color: rgba(255,82,82,0.3); color: var(--red); }
  @keyframes toast-in { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: none; } }

  /* PROFILE MENU */
  .sc-profile-menu { position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); border: 1px solid var(--border-cyan); border-radius: 10px; min-width: 200px; box-shadow: 0 8px 32px rgba(0,0,0,0.5), var(--glow-cyan); z-index: 300; overflow: hidden; }
  .sc-profile-header { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .sc-profile-name { font-size: 13px; font-weight: 700; color: var(--text); }
  .sc-profile-email { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .sc-profile-item { display: block; width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; color: var(--muted); font-size: 13px; font-family: var(--font-ui); cursor: pointer; transition: all 0.12s; }
  .sc-profile-item:hover { color: var(--cyan); background: var(--cyan-dim); }
  .sc-profile-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .sc-nav-avatar-wrap { position: relative; }

  /* TWO-COL OVERVIEW */
  .sc-two-col { display: grid; grid-template-columns: 1fr 300px; gap: 1.25rem; align-items: start; }
  @media(max-width: 860px) { .sc-two-col { grid-template-columns: 1fr; } }

  /* SECTION */
  .sc-section-title { font-size: 11px; font-weight: 700; color: var(--cyan); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
  .sc-section-action { font-size: 12px; color: var(--muted); cursor: pointer; font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 1; }
  .sc-section-action:hover { color: var(--cyan); }

  /* DETAIL PANEL */
  .sc-detail-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
  .sc-detail-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--border2); font-size: 12.5px; }
  .sc-detail-row:last-child { border-bottom: none; }
  .sc-detail-key { color: var(--muted); font-weight: 500; }
  .sc-detail-val { color: var(--text); text-align: right; max-width: 60%; }

  /* EMPTY */
  .sc-empty { text-align: center; padding: 3rem 1rem; color: var(--muted); font-size: 14px; }
  .sc-empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.5; }

  /* LOADING */
  .sc-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; }
  .sc-spinner { width: 32px; height: 32px; border: 2px solid rgba(0,229,255,0.15); border-top-color: var(--cyan); border-radius: 50%; animation: spin 0.8s linear infinite; box-shadow: 0 0 12px rgba(0,229,255,0.2); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sc-spinner-label { font-size: 12px; color: var(--muted); font-family: var(--font-mono); }

  /* INLINE FORM */
  .sc-inline-form { background: var(--surface3); border: 1px solid var(--border-cyan); border-radius: 7px; padding: 10px; margin: 4px 8px 8px; }
  .sc-inline-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 7px 10px; color: var(--text); font-size: 13px; font-family: var(--font-ui); outline: none; margin-bottom: 8px; }
  .sc-inline-input:focus { border-color: var(--border-cyan); }
  .sc-inline-form-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  /* COMMIT STATS BAR */
  .sc-commit-stats { display: flex; align-items: center; gap: 1rem; padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; flex-wrap: wrap; }
  .sc-commit-stat-item { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
  .sc-commit-stat-val { font-family: var(--font-mono); font-weight: 700; color: var(--cyan); }
  .sc-commit-stat-label { color: var(--muted); }

  /* ASSET FILTER BAR */
  .sc-asset-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 1rem; }
  .sc-filter-chip { padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: var(--font-ui); }
  .sc-filter-chip:hover { border-color: var(--border-cyan); color: var(--text); }
  .sc-filter-chip.active { border-color: var(--cyan); color: var(--cyan); background: var(--cyan-dim); }
`;

/* ─── Icons ────────────────────────────────────────────────────────── */
const Icon = {
  logo: () => (
    <span style={{ display:"flex", alignItems:"center", gap:2, fontFamily:"'JetBrains Mono', monospace", fontSize:13, fontWeight:700, color:"#00e5ff", letterSpacing:"0.15em", textShadow:"0 0 10px rgba(0,229,255,0.7),0 0 20px rgba(0,229,255,0.3)" }}>
      SCH<span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:"#00e5ff", boxShadow:"0 0 8px #00e5ff", margin:"0 4px" }} />HUB
    </span>
  ),
  issue: (open) => open
    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="#00e676"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 11-2 0 1 1 0 012 0zm-.25 5.25a.75.75 0 01-1.5 0V7a.75.75 0 011.5 0v3.25z"/></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" fill="#ff5252"><path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"/><path fillRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>,
  check: () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#020c18" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  x: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bell: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  settings: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  doc: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  board: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="9"/><rect x="14" y="16" width="7" height="5"/></svg>,
  activity: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  code: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  folder: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  image: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  download: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  commit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>,
  upload: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  menu: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

/* ─── Toast ────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="sc-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`sc-toast sc-toast-${t.type}`}>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── ContribGraph ─────────────────────────────────────────────────── */
function ContribGraph({ tasks }) {
  const weeks = 18; const days = 7;
  const now = new Date();
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    const wk = [];
    for (let d = 0; d < days; d++) {
      const level = Math.random() < 0.35 ? Math.ceil(Math.random() * 4) : 0;
      wk.push(level);
    }
    cells.push(wk);
  }
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels = [];
  for (let i = 0; i < weeks; i += 4) {
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks - 1 - i) * 7);
    monthLabels.push({ label: months[date.getMonth()], offset: i });
  }
  return (
    <div className="sc-contrib">
      <div className="sc-section-title">Contribution Activity</div>
      <div className="sc-contrib-months">
        {monthLabels.map((m, i) => (
          <span key={i} style={{ flex: i < monthLabels.length - 1 ? `0 0 ${(monthLabels[i+1].offset - m.offset) * 15}px` : "1", minWidth: 0 }}>{m.label}</span>
        ))}
      </div>
      <div className="sc-contrib-grid">
        {cells.map((wk, wi) => (
          <div key={wi} className="sc-contrib-week">
            {wk.map((level, di) => (
              <div key={di} className={`sc-contrib-day ${level > 0 ? `l${level}` : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── IssueRow ─────────────────────────────────────────────────────── */
function IssueRow({ task, onToggle, onDelete, onEdit, idx }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const sm = STATUS_META[task.status || (task.done ? "done" : "todo")];
  return (
    <div className="sc-issue-row">
      <button className={`sc-issue-check ${task.done ? "checked" : ""}`} onClick={() => onToggle(task.id)}>
        {task.done && <Icon.check />}
      </button>
      <span className="sc-issue-icon"><Icon.issue open={!task.done} /></span>
      <div className="sc-issue-body">
        <div className="sc-issue-title" onClick={() => onEdit(task)}>
          <span className="sc-issue-title-text">{task.text || task.title}</span>
          <span className="sc-issue-label" style={{ color: pm.color, background: pm.bg, borderColor: pm.border }}>{pm.label}</span>
          {sm && <span className="sc-issue-label" style={{ color: sm.color, background: `${sm.color}18`, borderColor: `${sm.color}44` }}>{sm.label}</span>}
        </div>
        <div className="sc-issue-sub">
          <span className="sc-issue-num">#{String(idx + 1).padStart(3,"0")}</span>
          {task.createdAt && <span>opened {fmtRelative(task.createdAt)}</span>}
          {task.dueDate && <span>· due {task.dueDate}</span>}
        </div>
      </div>
      <div className="sc-issue-actions">
        <button className="sc-issue-action-btn" onClick={() => onEdit(task)} title="Edit"><Icon.edit /></button>
        <button className="sc-issue-action-btn" onClick={() => onDelete(task.id)} title="Delete"><Icon.trash /></button>
      </div>
    </div>
  );
}

/* ─── TaskModal ────────────────────────────────────────────────────── */
function TaskModal({ task, onClose, onSave }) {
  const isNew = !task.id;
  const [form, setForm] = useState({ text: task.text || task.title || "", priority: task.priority || "medium", status: task.status || "todo", dueDate: task.dueDate || "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="sc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-modal">
        <div className="sc-modal-header">
          <div className="sc-modal-title">{isNew ? "New Task" : "Edit Task"}</div>
          <button className="sc-modal-close" onClick={onClose}><Icon.x /></button>
        </div>
        <div className="sc-modal-body">
          <div className="sc-field">
            <label className="sc-field-label">Title</label>
            <input className="sc-field-input" value={form.text} onChange={e => set("text", e.target.value)} placeholder="Task title…" autoFocus />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="sc-field">
              <label className="sc-field-label">Priority</label>
              <select className="sc-field-input sc-field-select" value={form.priority} onChange={e => set("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="sc-field">
              <label className="sc-field-label">Status</label>
              <select className="sc-field-input sc-field-select" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="sc-field">
            <label className="sc-field-label">Due Date (optional)</label>
            <input type="date" className="sc-field-input" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
          </div>
        </div>
        <div className="sc-modal-footer">
          <button className="sc-btn sc-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sc-btn sc-btn-primary" onClick={() => onSave({ ...task, ...form })}>
            {isNew ? "Create task" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AssetPreviewModal ────────────────────────────────────────────── */
function AssetPreviewModal({ asset, onClose, onDelete }) {
  const isImage = asset.type?.startsWith("image/");
  const isAudio = asset.type?.startsWith("audio/");
  return (
    <div className="sc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-modal" style={{ maxWidth: 600 }}>
        <div className="sc-modal-header">
          <div className="sc-modal-title" style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>{asset.name}</div>
          <div style={{ display:"flex", gap:6 }}>
            <button className="sc-btn sc-btn-danger sc-btn-sm" onClick={() => { onDelete(asset.id); onClose(); }}><Icon.trash /> Delete</button>
            <button className="sc-modal-close" onClick={onClose}><Icon.x /></button>
          </div>
        </div>
        <div className="sc-modal-body">
          {isImage && asset.dataUrl && <img src={asset.dataUrl} alt={asset.name} style={{ width:"100%", borderRadius:8, border:"1px solid var(--border)" }} />}
          {isAudio && asset.dataUrl && <audio controls src={asset.dataUrl} style={{ width:"100%", marginTop:8 }} />}
          {!isImage && !isAudio && (
            <div style={{ textAlign:"center", padding:"2rem", color:"var(--muted)", fontSize:48 }}>📎</div>
          )}
          <div style={{ marginTop:12, display:"flex", gap:16, fontSize:12, color:"var(--muted)" }}>
            <span>Size: <strong style={{ color:"var(--text)" }}>{asset.size}</strong></span>
            <span>Type: <strong style={{ color:"var(--cyan)" }}>{asset.type || "Unknown"}</strong></span>
            <span>Added: <strong style={{ color:"var(--text)" }}>{fmtRelative(asset.addedAt)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */
export default function SoloDashboard() {
  const { projectId } = useParams();
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  // Editor state
  const [editorFiles, setEditorFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [editorCode, setEditorCode] = useState("// Start coding here…\n");
  const [editorFilename, setEditorFilename] = useState("main.js");
  const [commitMsg, setCommitMsg] = useState("");
  const [commits, setCommits] = useState([]);
  const [editingExistingFile, setEditingExistingFile] = useState(false);

  // Assets state
  const [assets, setAssets] = useState([]);
  const [assetFilter, setAssetFilter] = useState("all");
  const [previewAsset, setPreviewAsset] = useState(null);
  const [dragging, setDragging] = useState(false);
  const uploadInputRef = useRef(null);

  const [activeSection, setActiveSection] = useState("overview");
  const [activeTab, setActiveTab] = useState("open");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskModal, setTaskModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [projectFilesTab, setProjectFilesTab] = useState("files"); // 'files' | 'commits'

  const menuRef = useRef(null);

  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  /* ── Auth + Data ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      try {
        const [pSnap, prSnap] = await Promise.all([
          getDoc(doc(db, "soloProjects", projectId)),
          getDoc(doc(db, "users", u.uid)),
        ]);
        if (pSnap.exists()) {
          const data = pSnap.data();
          setProject(data);
          const t = (data.tasks || []).map(tk => ({ ...tk, priority: tk.priority || "medium", status: tk.status || (tk.done ? "done" : "todo") }));
          setTasks(t);
          setNotes(data.notes || "");
          setEditorFiles(data.editorFiles || []);
          setCommits(data.commits || []);
          setAssets(data.assets || []);
        }
        if (prSnap.exists()) setProfile(prSnap.data());
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const persistAll = async (updates) => {
    await updateDoc(doc(db, "soloProjects", projectId), updates);
  };

  /* ── Task helpers ── */
  const persistTasks = async (updated) => { setTasks(updated); await persistAll({ tasks: updated }); };
  const handleToggleTask = async (id) => {
    const updated = tasks.map(t => { if (t.id !== id) return t; const done = !t.done; return { ...t, done, status: done ? "done" : "todo" }; });
    await persistTasks(updated); toast("Task updated");
  };
  const handleDeleteTask = async (id) => { await persistTasks(tasks.filter(t => t.id !== id)); toast("Task deleted"); };
  const handleSaveTask = async (form) => {
    let updated;
    if (!form.id) {
      updated = [...tasks, { id: Date.now(), text: form.text, done: form.status === "done", priority: form.priority, status: form.status, dueDate: form.dueDate, createdAt: Date.now() }];
      toast("Task created");
    } else {
      updated = tasks.map(t => t.id === form.id ? { ...t, ...form, done: form.status === "done" } : t);
      toast("Task saved");
    }
    await persistTasks(updated); setTaskModal(null);
  };
  const saveNotes = async () => { await persistAll({ notes }); setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500); toast("Notes saved"); };

  /* ── Editor / File helpers ── */
  const handleSaveFile = async () => {
    if (!editorFilename.trim()) { toast("Enter a filename", "error"); return; }
    let updated;
    if (editingExistingFile && activeFileId) {
      updated = editorFiles.map(f => f.id === activeFileId ? { ...f, name: editorFilename, code: editorCode, updatedAt: Date.now() } : f);
      toast(`Saved ${editorFilename}`);
    } else {
      const newFile = { id: Date.now(), name: editorFilename, code: editorCode, createdAt: Date.now(), updatedAt: Date.now() };
      updated = [...editorFiles, newFile];
      setActiveFileId(newFile.id);
      setEditingExistingFile(true);
      toast(`Created ${editorFilename}`);
    }
    setEditorFiles(updated);
    await persistAll({ editorFiles: updated });
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) { toast("Enter a commit message", "error"); return; }
    const hash = Math.random().toString(36).slice(2,9);
    const commit = { id: Date.now(), message: commitMsg, hash, timestamp: Date.now(), file: editorFilename };
    const updated = [commit, ...commits];
    setCommits(updated);
    setCommitMsg("");
    await persistAll({ commits: updated });
    toast(`Committed: ${commitMsg}`, "info");
  };

  const handleOpenFileInEditor = (file) => {
    setActiveFileId(file.id);
    setEditorFilename(file.name);
    setEditorCode(file.code);
    setEditingExistingFile(true);
    setActiveSection("editor");
    toast(`Opened ${file.name}`, "info");
  };

  const handleDeleteFile = async (id) => {
    const updated = editorFiles.filter(f => f.id !== id);
    setEditorFiles(updated);
    if (activeFileId === id) { setActiveFileId(null); setEditingExistingFile(false); setEditorCode("// Start coding here…\n"); setEditorFilename("main.js"); }
    await persistAll({ editorFiles: updated });
    toast("File deleted");
  };

  const handleDownloadFile = (file) => {
    const blob = new Blob([file.code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    toast(`Downloaded ${file.name}`, "info");
  };

  /* ── Assets ── */
  const handleAssetUpload = (files) => {
    const newAssets = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const asset = {
          id: Date.now() + processed++,
          name: file.name,
          type: file.type,
          size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`,
          dataUrl: e.target.result,
          addedAt: Date.now(),
        };
        setAssets(prev => {
          const updated = [...prev, asset];
          persistAll({ assets: updated });
          return updated;
        });
        toast(`Uploaded ${file.name}`, "info");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteAsset = async (id) => {
    const updated = assets.filter(a => a.id !== id);
    setAssets(updated);
    await persistAll({ assets: updated });
    toast("Asset deleted");
  };

  /* ── Derived ── */
  const done = tasks.filter(t => t.done).length;
  const donePct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const highCount = tasks.filter(t => t.priority === "high" && !t.done).length;
  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.done).length;
  const statusGroups = {
    todo: tasks.filter(t => (t.status || "todo") === "todo"),
    in_progress: tasks.filter(t => (t.status || "todo") === "in_progress"),
    in_review: tasks.filter(t => (t.status || "todo") === "in_review"),
    done: tasks.filter(t => (t.status || (t.done ? "done" : "todo")) === "done"),
  };
  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || (t.text || t.title || "").toLowerCase().includes(search.toLowerCase());
    const matchPri = filterPriority === "all" || t.priority === filterPriority;
    const matchSt = filterStatus === "all" || (t.status || (t.done ? "done" : "todo")) === filterStatus;
    return matchSearch && matchPri && matchSt;
  });
  const openFiltered = filteredTasks.filter(t => !t.done);
  const closedFiltered = filteredTasks.filter(t => t.done);

  const filteredAssets = assets.filter(a => {
    if (assetFilter === "all") return true;
    if (assetFilter === "images") return a.type?.startsWith("image/");
    if (assetFilter === "audio") return a.type?.startsWith("audio/");
    return true;
  });

  /* ── Render guards ── */
  if (loading) return (
    <><style>{css}</style>
      <div className="sc-loading">
        <div className="sc-spinner" />
        <div className="sc-spinner-label">Loading project…</div>
      </div>
    </>
  );
  if (!project) return (
    <><style>{css}</style>
      <div className="sc-loading"><div className="sc-spinner-label">Project not found or access denied.</div></div>
    </>
  );

  const navItems = [
    { key:"overview", label:"Overview", icon:<Icon.info /> },
    { key:"tasks", label:"Tasks", icon:<Icon.issue open />, count: tasks.filter(t=>!t.done).length },
    { key:"board", label:"Board", icon:<Icon.board /> },
    { key:"editor", label:"Editor", icon:<Icon.code /> },
    { key:"project-files", label:"Project Files", icon:<Icon.folder /> },
    { key:"assets", label:"Assets", icon:<Icon.image />, count: assets.length },
    { key:"notes", label:"Notes", icon:<Icon.doc /> },
    { key:"activity", label:"Activity", icon:<Icon.activity /> },
  ];

  return (
    <>
      <style>{css}</style>
      <Toast toasts={toasts} />
      {taskModal && <TaskModal task={taskModal} onClose={() => setTaskModal(null)} onSave={handleSaveTask} />}
      {previewAsset && <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} onDelete={handleDeleteAsset} />}

      <div className="sc-shell">
        {/* ── NAV ── */}
        <nav className="sc-nav">
          <button className="sc-hamburger" onClick={() => setSidebarOpen(v => !v)}><Icon.menu /></button>
          <div className="sc-logo"><Icon.logo /></div>
          <div className="sc-breadcrumb">
            <span className="sc-breadcrumb-sep">/</span>
            <span className="sc-breadcrumb-link" onClick={() => nav("/dashboard")}>Dashboard</span>
            <span className="sc-breadcrumb-sep">/</span>
            <span className="sc-breadcrumb-current">{project.title || "Untitled"}</span>
          </div>
          <div className="sc-nav-spacer" />
          <button className="sc-nav-icon-btn" onClick={() => nav("/notifications")} title="Notifications"><Icon.bell /></button>
          <div className="sc-nav-avatar-wrap" ref={menuRef}>
            <button className="sc-av-btn" onClick={() => setMenuOpen(v => !v)}>
              <img src={getAvatarSrc(profile?.avatar)} alt="avatar" />
            </button>
            {menuOpen && (
              <div className="sc-profile-menu">
                <div className="sc-profile-header">
                  <div className="sc-profile-name">{profile?.name || user?.email}</div>
                  <div className="sc-profile-email">{user?.email}</div>
                </div>
                <button className="sc-profile-item" onClick={() => { setMenuOpen(false); nav(`/update-solo-profile/${projectId}`); }}>Edit project</button>
                <button className="sc-profile-item" onClick={() => { setMenuOpen(false); nav("/notifications"); }}>Notifications</button>
                <div className="sc-profile-divider" />
                <button className="sc-profile-item" onClick={() => { setMenuOpen(false); nav("/dashboard"); }}>← Back to dashboard</button>
              </div>
            )}
          </div>
        </nav>

        <div className="sc-body">
          {/* Mobile overlay */}
          <div className={`sc-sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

          {/* ── SIDEBAR ── */}
          <aside className={`sc-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="sc-sidebar-section">
              <div className="sc-sidebar-label">Navigation</div>
              {navItems.map(item => (
                <button key={item.key} className={`sc-sidebar-item ${activeSection === item.key ? "active" : ""}`}
                  onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}>
                  {item.icon}
                  {item.label}
                  {item.count != null && <span className="sc-sidebar-count">{item.count}</span>}
                </button>
              ))}
            </div>
            <div className="sc-sidebar-section">
              <div className="sc-sidebar-label">Project Info</div>
              <div className="sc-sidebar-info">
                {[["Stack",project.stack],["Type",project.projectType],["Domain",project.domain],["AI",project.aiUsage]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} className="sc-sidebar-info-row">
                    <span>{k}</span>
                    <span className="sc-sidebar-info-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <main className="sc-content">

            {/* ═══ OVERVIEW ═══ */}
            {activeSection === "overview" && (
              <>
                <div className="sc-page-header">
                  <div className="sc-page-title">
                    {project.title || "Untitled Project"}
                    <span className="sc-badge sc-badge-green"><span style={{ width:5, height:5, borderRadius:"50%", background:"currentColor", display:"inline-block" }} />Active</span>
                  </div>
                  <div className="sc-page-meta">
                    <span className="sc-page-meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      Created {fmtDate(project.createdAt)}
                    </span>
                    <span className="sc-page-meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      {donePct}% complete
                    </span>
                  </div>
                </div>

                <div className="sc-stats">
                  <div className="sc-stat-card">
                    <div className="sc-stat-label">Total Tasks</div>
                    <div className="sc-stat-val">{tasks.length}</div>
                    <div className="sc-stat-sub">{done} completed</div>
                  </div>
                  <div className="sc-stat-card">
                    <div className="sc-stat-label">Open</div>
                    <div className="sc-stat-val" style={{ color:"var(--cyan)" }}>{tasks.length - done}</div>
                    <div className="sc-stat-sub">{statusGroups.in_progress.length} in progress</div>
                  </div>
                  <div className="sc-stat-card">
                    <div className="sc-stat-label">High Priority</div>
                    <div className="sc-stat-val" style={{ color: highCount > 0 ? "var(--red)" : "var(--text)" }}>{highCount}</div>
                    <div className="sc-stat-sub">open tasks</div>
                  </div>
                  <div className="sc-stat-card">
                    <div className="sc-stat-label">Commits</div>
                    <div className="sc-stat-val" style={{ color:"var(--purple)" }}>{commits.length}</div>
                    <div className="sc-stat-sub">{editorFiles.length} files</div>
                  </div>
                </div>

                <div className="sc-progress-wrap">
                  <div className="sc-progress-label">
                    <span className="sc-progress-title">Overall Progress</span>
                    <span className="sc-progress-pct">{donePct}%</span>
                  </div>
                  <div className="sc-progress-bar">
                    <div className="sc-progress-fill" style={{ width:`${donePct}%` }} />
                  </div>
                  <div className="sc-progress-segments">
                    {["todo","in_progress","in_review","done"].map(s => (
                      <div key={s} className="sc-progress-seg" style={{ background:STATUS_META[s].dot, opacity:0.7, flex:statusGroups[s].length || 0 }} />
                    ))}
                  </div>
                </div>

                <div className="sc-two-col">
                  <div>
                    <ContribGraph tasks={tasks} />
                    {project.description && (
                      <div style={{ marginBottom:"1.25rem" }}>
                        <div className="sc-section-title">About</div>
                        <div style={{ fontSize:13.5, color:"var(--muted)", lineHeight:1.7, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 16px" }}>{project.description}</div>
                      </div>
                    )}
                    {(project.problem || project.functional) && (
                      <div>
                        <div className="sc-section-title">Project Details</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          {[["Problem Statement",project.problem],["Functional Requirements",project.functional],["Non-Functional Requirements",project.nonFunctional]].filter(([,v])=>v).map(([k,v])=>(
                            <div key={k} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 16px" }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"var(--cyan)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, opacity:0.8 }}>{k}</div>
                              <div style={{ fontSize:13.5, color:"var(--text)", lineHeight:1.65 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                    <div>
                      <div className="sc-section-title">Recent Tasks <span className="sc-section-action" onClick={() => setActiveSection("tasks")}>View all →</span></div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {tasks.slice(0,5).map((t) => {
                          const pm = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                          return (
                            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, padding:"7px 10px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:7 }}>
                              <div style={{ width:7, height:7, borderRadius:"50%", background:t.done?"var(--muted2)":STATUS_META[t.status||"todo"].dot, flexShrink:0, boxShadow:`0 0 4px ${t.done?"transparent":STATUS_META[t.status||"todo"].dot}` }} />
                              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:t.done?"var(--muted)":"var(--text)", textDecoration:t.done?"line-through":"none" }}>{t.text}</span>
                              <span style={{ fontSize:9.5, fontWeight:700, color:pm.color, background:pm.bg, border:`1px solid ${pm.border}`, borderRadius:8, padding:"1px 5px", flexShrink:0 }}>{pm.label}</span>
                            </div>
                          );
                        })}
                        {tasks.length === 0 && <div style={{ fontSize:13, color:"var(--muted)", padding:"8px 0" }}>No tasks yet.</div>}
                      </div>
                    </div>

                    <div>
                      <div className="sc-section-title">Status Breakdown</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {Object.entries(STATUS_META).map(([k,m]) => (
                          <div key={k} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5 }}>
                            <div style={{ width:7, height:7, borderRadius:"50%", background:m.dot, flexShrink:0, boxShadow:`0 0 4px ${m.dot}` }} />
                            <span style={{ flex:1, color:"var(--muted)" }}>{m.label}</span>
                            <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text)", fontWeight:600 }}>{statusGroups[k]?.length || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="sc-section-title">Quick Actions</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        <button className="sc-btn sc-btn-primary" style={{ width:"100%", justifyContent:"center" }} onClick={() => setTaskModal({})}><Icon.plus /> New task</button>
                        <button className="sc-btn sc-btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={() => setActiveSection("editor")}><Icon.code /> Open editor</button>
                        <button className="sc-btn sc-btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={() => setActiveSection("board")}><Icon.board /> Open board</button>
                        <button className="sc-btn sc-btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={() => nav(`/update-solo-profile/${projectId}`)}><Icon.settings /> Edit project</button>
                      </div>
                    </div>

                    {commits.length > 0 && (
                      <div>
                        <div className="sc-section-title">Recent Commits <span className="sc-section-action" onClick={() => { setActiveSection("project-files"); setProjectFilesTab("commits"); }}>View all →</span></div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          {commits.slice(0,3).map(c => (
                            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:7 }}>
                              <span style={{ fontSize:10, color:"var(--cyan)", fontFamily:"var(--font-mono)", background:"var(--cyan-dim)", padding:"1px 5px", borderRadius:4, flexShrink:0 }}>{c.hash}</span>
                              <span style={{ fontSize:12, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ═══ TASKS ═══ */}
            {activeSection === "tasks" && (
              <>
                <div className="sc-page-header">
                  <div className="sc-page-title"><Icon.issue open={true} /> Tasks</div>
                </div>
                <div className="sc-toolbar">
                  <div className="sc-search"><Icon.search /><input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} /></div>
                  <select className="sc-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select className="sc-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                  <button className="sc-btn sc-btn-primary" onClick={() => setTaskModal({})}><Icon.plus /> New task</button>
                </div>
                <div className="sc-tabs">
                  <button className={`sc-tab ${activeTab === "open" || activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("open")}>
                    <Icon.issue open /> Open <span className="sc-tab-count">{openFiltered.length}</span>
                  </button>
                  <button className={`sc-tab ${activeTab === "closed" ? "active" : ""}`} onClick={() => setActiveTab("closed")}>
                    <Icon.issue open={false} /> Closed <span className="sc-tab-count">{closedFiltered.length}</span>
                  </button>
                </div>
                <div className="sc-issue-list">
                  <div className="sc-issue-list-header">
                    <span style={{ color:"var(--text)", fontWeight:600, fontSize:13 }}>{activeTab === "closed" ? closedFiltered.length : openFiltered.length} {activeTab === "closed" ? "closed" : "open"} tasks</span>
                    <span style={{ fontSize:12, color:"var(--muted)" }}>Sort: Newest</span>
                  </div>
                  {(activeTab === "closed" ? closedFiltered : openFiltered).length === 0 ? (
                    <div className="sc-empty"><div className="sc-empty-icon">📋</div><div>No tasks found.</div></div>
                  ) : (
                    (activeTab === "closed" ? closedFiltered : openFiltered).map((t, i) => (
                      <IssueRow key={t.id} task={t} idx={tasks.indexOf(t)} onToggle={handleToggleTask} onDelete={handleDeleteTask} onEdit={t => setTaskModal(t)} />
                    ))
                  )}
                </div>
              </>
            )}

            {/* ═══ BOARD ═══ */}
            {activeSection === "board" && (
              <>
                <div className="sc-page-header">
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div className="sc-page-title"><Icon.board /> Board</div>
                    <button className="sc-btn sc-btn-primary" onClick={() => setTaskModal({})}><Icon.plus /> New task</button>
                  </div>
                </div>
                <div className="sc-kanban">
                  {Object.entries(STATUS_META).map(([status, meta]) => {
                    const col = statusGroups[status] || [];
                    return (
                      <div key={status} className="sc-col">
                        <div className="sc-col-header">
                          <div className="sc-col-title">
                            <div className="sc-col-dot" style={{ background:meta.dot, boxShadow:`0 0 6px ${meta.dot}` }} />
                            <span style={{ color:meta.color }}>{meta.label}</span>
                          </div>
                          <span className="sc-col-count">{col.length}</span>
                        </div>
                        <div className="sc-col-body">
                          {col.map(t => {
                            const pm = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                            return (
                              <div key={t.id} className="sc-card" onClick={() => setTaskModal(t)}>
                                <div className="sc-card-title">{t.text || t.title}</div>
                                <div className="sc-card-footer">
                                  <span className="sc-card-num">#{String(tasks.indexOf(t)+1).padStart(3,"0")}</span>
                                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                                    {t.dueDate && <span style={{ fontSize:10, color:new Date(t.dueDate)<new Date()?"var(--red)":"var(--muted)" }}>{t.dueDate}</span>}
                                    <div className="sc-card-priority" style={{ background:pm.color, boxShadow:`0 0 4px ${pm.color}` }} title={pm.label} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {col.length === 0 && <div style={{ fontSize:12, color:"var(--muted2)", textAlign:"center", padding:"12px 0" }}>No tasks</div>}
                        </div>
                        <button className="sc-col-add-btn" onClick={() => setTaskModal({ status })}><Icon.plus /> Add task</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ═══ CODE EDITOR ═══ */}
            {activeSection === "editor" && (
              <>
                <div className="sc-page-header">
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                    <div className="sc-page-title"><Icon.code /> Code Editor</div>
                    <button className="sc-btn sc-btn-ghost sc-btn-sm" onClick={() => { setEditingExistingFile(false); setActiveFileId(null); setEditorCode("// Start coding here…\n"); setEditorFilename("new-file.js"); }}>
                      <Icon.plus /> New file
                    </button>
                  </div>
                </div>
                <div className="sc-editor-wrap">
                  <div className="sc-editor-toolbar">
                    <input className="sc-editor-filename-input" value={editorFilename} onChange={e => setEditorFilename(e.target.value)} placeholder="filename.js" spellCheck={false} />
                    <span className="sc-editor-lang" style={{ color:getLangColor(editorFilename), borderColor:`${getLangColor(editorFilename)}44`, background:`${getLangColor(editorFilename)}12` }}>
                      {getLangLabel(editorFilename)}
                    </span>
                    <div style={{ flex:1 }} />
                    <button className="sc-btn sc-btn-success sc-btn-sm" onClick={handleSaveFile}>💾 Save file</button>
                  </div>
                  <textarea
                    className="sc-editor-area"
                    value={editorCode}
                    onChange={e => setEditorCode(e.target.value)}
                    spellCheck={false}
                    onKeyDown={e => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const s = e.target.selectionStart;
                        const val = e.target.value;
                        e.target.value = val.substring(0,s)+"  "+val.substring(e.target.selectionEnd);
                        e.target.selectionStart = e.target.selectionEnd = s+2;
                        setEditorCode(e.target.value);
                      }
                    }}
                  />
                  <div className="sc-commit-bar">
                    <span style={{ fontSize:12, color:"var(--muted)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}><Icon.commit /> Commit:</span>
                    <input className="sc-commit-input" value={commitMsg} onChange={e => setCommitMsg(e.target.value)} placeholder="Describe what you changed…" onKeyDown={e => { if (e.key==="Enter" && commitMsg.trim()) handleCommit(); }} />
                    <button className="sc-btn sc-btn-primary sc-btn-sm" onClick={handleCommit} style={{ whiteSpace:"nowrap" }}>
                      <Icon.commit /> Commit
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ═══ PROJECT FILES ═══ */}
            {activeSection === "project-files" && (
              <>
                <div className="sc-page-header">
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                    <div className="sc-page-title"><Icon.folder /> Project Files</div>
                    <button className="sc-btn sc-btn-primary sc-btn-sm" onClick={() => setActiveSection("editor")}><Icon.plus /> New file</button>
                  </div>
                </div>

                {/* Commit stats bar */}
                <div className="sc-commit-stats">
                  <div className="sc-commit-stat-item">
                    <span className="sc-commit-stat-val">{editorFiles.length}</span>
                    <span className="sc-commit-stat-label">files</span>
                  </div>
                  <div style={{ width:1, height:20, background:"var(--border)" }} />
                  <div className="sc-commit-stat-item">
                    <span className="sc-commit-stat-val">{commits.length}</span>
                    <span className="sc-commit-stat-label">commits</span>
                  </div>
                  {commits.length > 0 && (
                    <>
                      <div style={{ width:1, height:20, background:"var(--border)" }} />
                      <div className="sc-commit-stat-item">
                        <span className="sc-commit-stat-val">{commits[0]?.hash}</span>
                        <span className="sc-commit-stat-label">latest</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="sc-tabs">
                  <button className={`sc-tab ${projectFilesTab === "files" ? "active" : ""}`} onClick={() => setProjectFilesTab("files")}>
                    <Icon.folder /> Files <span className="sc-tab-count">{editorFiles.length}</span>
                  </button>
                  <button className={`sc-tab ${projectFilesTab === "commits" ? "active" : ""}`} onClick={() => setProjectFilesTab("commits")}>
                    <Icon.commit /> Commits <span className="sc-tab-count">{commits.length}</span>
                  </button>
                </div>

                {projectFilesTab === "files" && (
                  <div className="sc-files-grid">
                    {editorFiles.length === 0 ? (
                      <div className="sc-empty">
                        <div className="sc-empty-icon">📁</div>
                        <div>No files yet. Open the editor to create files.</div>
                      </div>
                    ) : editorFiles.map(file => {
                      const langColor = getLangColor(file.name);
                      return (
                        <div key={file.id} className="sc-file-row" onClick={() => handleOpenFileInEditor(file)}>
                          <div className="sc-file-icon" style={{ color:langColor, borderColor:`${langColor}44`, background:`${langColor}12` }}>
                            {getLangLabel(file.name)}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div className="sc-file-name">{file.name}</div>
                            <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                              {file.code?.split("\n").length} lines · updated {fmtRelative(file.updatedAt)}
                            </div>
                          </div>
                          <div className="sc-file-actions" onClick={e => e.stopPropagation()}>
                            <button className="sc-btn sc-btn-ghost sc-btn-sm" onClick={() => handleDownloadFile(file)} title="Download"><Icon.download /></button>
                            <button className="sc-btn sc-btn-ghost sc-btn-sm" onClick={() => handleOpenFileInEditor(file)} title="Edit"><Icon.edit /></button>
                            <button className="sc-btn sc-btn-danger sc-btn-sm" onClick={() => handleDeleteFile(file.id)} title="Delete"><Icon.trash /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {projectFilesTab === "commits" && (
                  <div className="sc-commit-history">
                    {commits.length === 0 ? (
                      <div className="sc-empty"><div className="sc-empty-icon">🔖</div><div>No commits yet. Save and commit files in the editor.</div></div>
                    ) : (
                      <div className="sc-commit-timeline">
                        {commits.map((c, i) => (
                          <div key={c.id} className="sc-commit-item">
                            <div className="sc-commit-dot">🔖</div>
                            <div className="sc-commit-body">
                              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                <span className="sc-commit-msg">{c.message}</span>
                                <span className="sc-commit-hash">{c.hash}</span>
                              </div>
                              <div className="sc-commit-meta">
                                {c.file && <span style={{ color:"var(--cyan)", marginRight:8 }}>{c.file}</span>}
                                {fmtRelative(c.timestamp)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ═══ ASSETS ═══ */}
            {activeSection === "assets" && (
              <>
                <div className="sc-page-header">
                  <div className="sc-page-title"><Icon.image /> Assets</div>
                  <div className="sc-page-meta">
                    <span className="sc-page-meta-item">{assets.length} files stored</span>
                  </div>
                </div>

                {/* Upload zone */}
                <div
                  className={`sc-upload-zone ${dragging ? "drag" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleAssetUpload(e.dataTransfer.files); }}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <input ref={uploadInputRef} type="file" multiple style={{ display:"none" }} accept="image/*,audio/*,.pdf,.txt,.zip,.json"
                    onChange={e => handleAssetUpload(e.target.files)} />
                  <div className="sc-upload-zone-icon">📁</div>
                  <div className="sc-upload-zone-text">
                    <strong>Click to upload</strong> or drag and drop files here
                  </div>
                  <div style={{ marginTop:6, fontSize:11, color:"var(--muted2)" }}>Images, audio, documents, archives</div>
                </div>

                {/* Filter chips */}
                <div className="sc-asset-filter">
                  {["all","images","audio"].map(f => (
                    <button key={f} className={`sc-filter-chip ${assetFilter === f ? "active" : ""}`} onClick={() => setAssetFilter(f)}>
                      {f === "all" ? "All" : f === "images" ? "🖼 Images" : "🎵 Audio"}
                      <span style={{ marginLeft:4, fontSize:11, opacity:0.7 }}>
                        ({f === "all" ? assets.length : f === "images" ? assets.filter(a=>a.type?.startsWith("image/")).length : assets.filter(a=>a.type?.startsWith("audio/")).length})
                      </span>
                    </button>
                  ))}
                </div>

                {filteredAssets.length === 0 ? (
                  <div className="sc-empty"><div className="sc-empty-icon">🖼</div><div>No assets yet. Upload files above.</div></div>
                ) : (
                  <div className="sc-assets-grid">
                    {filteredAssets.map(asset => {
                      const isImage = asset.type?.startsWith("image/");
                      const isAudio = asset.type?.startsWith("audio/");
                      return (
                        <div key={asset.id} className="sc-asset-card" onClick={() => setPreviewAsset(asset)}>
                          {isImage && asset.dataUrl
                            ? <img src={asset.dataUrl} alt={asset.name} className="sc-asset-thumb" />
                            : <div className="sc-asset-thumb-placeholder">{isAudio ? "🎵" : "📄"}</div>
                          }
                          <div className="sc-asset-info">
                            <div className="sc-asset-name">{asset.name}</div>
                            <div className="sc-asset-size">{asset.size}</div>
                          </div>
                          <div className="sc-asset-overlay">
                            <button className="sc-btn sc-btn-ghost sc-btn-sm" style={{ border:"1px solid rgba(255,255,255,0.2)" }} onClick={e => { e.stopPropagation(); handleDeleteAsset(asset.id); }}><Icon.trash /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ═══ NOTES ═══ */}
            {activeSection === "notes" && (
              <>
                <div className="sc-page-header">
                  <div className="sc-page-title"><Icon.doc /> Notes</div>
                  <div className="sc-page-meta"><span className="sc-page-meta-item">Markdown-friendly · click save to persist</span></div>
                </div>
                <textarea className="sc-notes-area" placeholder="Jot down ideas, links, architecture notes, API references…" value={notes} onChange={e => setNotes(e.target.value)} rows={16} />
                <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
                  <button className="sc-btn sc-btn-primary" onClick={saveNotes}>{notesSaved ? "✓ Saved" : "Save notes"}</button>
                  <span style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{notes.length} chars</span>
                </div>
              </>
            )}

            {/* ═══ ACTIVITY ═══ */}
            {activeSection === "activity" && (
              <>
                <div className="sc-page-header">
                  <div className="sc-page-title"><Icon.activity /> Activity</div>
                </div>
                <ContribGraph tasks={tasks} />
                <div className="sc-activity">
                  {[
                    { icon:"🟢", text:<><strong>{project.title}</strong> project created</>, time:project.createdAt },
                    ...commits.slice(0,5).map(c => ({ icon:"🔖", text:<>Committed: <strong>{c.message}</strong></>, time:c.timestamp })),
                    ...tasks.slice().reverse().slice(0,8).map(t => ({
                      icon: t.done?"✅":"📋",
                      text: t.done ? <><strong>{t.text}</strong> marked as done</> : <>Task <strong>{t.text}</strong> added</>,
                      time: t.createdAt,
                    })),
                    ...assets.slice(0,4).map(a => ({ icon:"🖼", text:<>Asset <strong>{a.name}</strong> uploaded</>, time:a.addedAt })),
                  ].sort((a,b) => (b.time||0)-(a.time||0)).slice(0,15).map((item,i) => (
                    <div key={i} className="sc-activity-item">
                      <div className="sc-activity-dot">{item.icon}</div>
                      <div className="sc-activity-body">
                        <div className="sc-activity-text">{item.text}</div>
                        <div className="sc-activity-time">{fmtRelative(item.time)}</div>
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && commits.length === 0 && (
                    <div style={{ fontSize:13, color:"var(--muted)", padding:"1rem 0" }}>No activity yet.</div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}