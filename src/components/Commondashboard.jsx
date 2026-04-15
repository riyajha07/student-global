import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy } from "firebase/firestore";
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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  :root{
    --c-bg:#020817;--c-bg2:#040f24;--c-navy:#071a3e;
    --c-blue:#0ea5e9;--c-cyan:#06d6f5;--c-glow:#0ea5e940;
    --c-text:#e2f0ff;--c-muted:#7ba3c8;--c-accent:#00ffc8;
    --font-head:'Orbitron',monospace;--font-body:'Rajdhani',sans-serif;--font-mono:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);min-height:100vh;overflow-x:hidden}
  .db-bg{position:fixed;inset:0;z-index:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;}
  .db-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}

  /* NAV */
  .db-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0.9rem 2rem;background:rgba(2,8,23,0.9);backdrop-filter:blur(14px);border-bottom:1px solid rgba(6,214,245,0.1);}
  @media(max-width:480px){.db-nav{padding:0.75rem 1rem}}
  .db-nav-logo{font-family:var(--font-head);font-size:0.85rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.15em;text-shadow:0 0 16px var(--c-cyan)}
  .db-nav-right{display:flex;align-items:center;gap:0.75rem;position:relative}
  .db-nav-greet{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-muted);display:none}
  @media(min-width:600px){.db-nav-greet{display:block}}
  .db-notif-btn{position:relative;width:36px;height:36px;border-radius:50%;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;}
  .db-notif-btn:hover{border-color:var(--c-cyan);box-shadow:0 0 12px rgba(6,214,245,0.25)}
  .db-notif-btn svg{color:var(--c-muted);transition:color 0.2s}
  .db-notif-btn:hover svg{color:var(--c-cyan)}
  .db-notif-count{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;background:var(--c-accent);border-radius:8px;font-family:var(--font-mono);font-size:0.55rem;color:#020817;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;}
  .db-avatar-btn{width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid rgba(6,214,245,0.3);cursor:pointer;transition:all 0.2s;background:var(--c-navy);flex-shrink:0;padding:0;}
  .db-avatar-btn:hover{border-color:var(--c-cyan);box-shadow:0 0 12px rgba(6,214,245,0.4)}
  .db-avatar-btn img{width:100%;height:100%;object-fit:cover;display:block}
  .db-logout-btn{font-family:var(--font-mono);font-size:0.72rem;padding:0.4rem 0.9rem;border-radius:4px;cursor:pointer;background:transparent;border:1px solid rgba(248,113,113,0.3);color:rgba(248,113,113,0.7);transition:all 0.2s;letter-spacing:0.05em;}
  .db-logout-btn:hover{border-color:#f87171;color:#f87171}

  /* MAIN */
  .db-main{position:relative;z-index:1;padding:5.5rem 1.5rem 3rem;max-width:1100px;margin:0 auto}
  @media(max-width:500px){.db-main{padding:5rem 1rem 2rem}}

  /* HERO */
  .db-hero{background:rgba(4,15,36,0.7);border:1px solid rgba(6,214,245,0.15);border-radius:12px;padding:2rem;margin-bottom:2.5rem;position:relative;overflow:hidden;}
  .db-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);}
  .db-hero-tag{font-family:var(--font-mono);font-size:0.7rem;color:var(--c-accent);letter-spacing:0.15em;margin-bottom:0.5rem}
  .db-hero-h{font-family:var(--font-head);font-size:clamp(1.2rem,3vw,1.8rem);font-weight:700;color:var(--c-text);margin-bottom:0.5rem}
  .db-hero-h span{color:var(--c-cyan)}
  .db-hero-p{color:var(--c-muted);font-size:1rem;max-width:480px}

  .db-sec-label{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-accent);letter-spacing:0.15em;margin-bottom:1.25rem}
  .db-sec-h{font-family:var(--font-head);font-size:clamp(1rem,2.5vw,1.4rem);font-weight:700;color:var(--c-text);margin-bottom:0.5rem;letter-spacing:0.04em}
  .db-sec-h span{color:var(--c-cyan)}

  /* PROJECT CARDS */
  .db-proj-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:3.5rem}
  @media(max-width:680px){.db-proj-grid{grid-template-columns:1fr}}
  .db-proj-card{background:rgba(4,15,36,0.75);border:1px solid rgba(14,165,233,0.15);border-radius:10px;padding:1.75rem;position:relative;overflow:hidden;transition:all 0.3s;display:flex;flex-direction:column;}
  .db-proj-card:hover{border-color:rgba(6,214,245,0.35);transform:translateY(-3px)}
  .db-proj-card::after{content:'';position:absolute;bottom:0;right:0;width:100px;height:100px;background:radial-gradient(circle,var(--c-glow),transparent 70%);pointer-events:none}
  .db-proj-num{font-family:var(--font-head);font-size:2.5rem;font-weight:900;color:rgba(6,214,245,0.1);line-height:1;margin-bottom:0.75rem}
  .db-proj-title{font-family:var(--font-head);font-size:0.85rem;font-weight:700;color:var(--c-cyan);letter-spacing:0.08em;margin-bottom:0.6rem}
  .db-proj-desc{color:var(--c-muted);font-size:0.92rem;line-height:1.6;margin-bottom:1rem;flex:1}
  .db-proj-tags{display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:1.1rem}
  .db-tag{font-family:var(--font-mono);font-size:0.65rem;color:var(--c-accent);border:1px solid rgba(0,255,200,0.2);padding:0.18rem 0.55rem;border-radius:3px;background:rgba(0,255,200,0.04)}
  .db-proj-count{font-family:var(--font-mono);font-size:0.68rem;color:var(--c-muted);margin-bottom:0.85rem;display:flex;align-items:center;gap:6px}
  .db-proj-count-num{color:var(--c-cyan);font-weight:700}
  .db-create-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0.7rem 1.25rem;border-radius:7px;cursor:pointer;font-family:var(--font-head);font-size:0.72rem;font-weight:700;letter-spacing:0.07em;border:none;transition:all 0.25s;text-decoration:none;align-self:flex-start;}
  .db-create-solo{background:linear-gradient(135deg,#0ea5e9,#06d6f5);color:#020817;box-shadow:0 0 18px rgba(6,214,245,0.2);}
  .db-create-solo:hover{box-shadow:0 0 28px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .db-create-team{background:linear-gradient(135deg,#00c896,#06d6f5);color:#020817;box-shadow:0 0 18px rgba(0,255,200,0.15);}
  .db-create-team:hover{box-shadow:0 0 28px rgba(0,255,200,0.35);transform:translateY(-1px)}

  /* LAPTOP SIMULATION */
  .db-sim-wrap{margin-bottom:3.5rem}
  .db-laptops{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:1.5rem}
  @media(max-width:680px){.db-laptops{grid-template-columns:1fr}}
  .db-laptop{background:rgba(4,15,36,0.7);border:1px solid rgba(14,165,233,0.18);border-radius:10px;padding:1rem;position:relative;}
  .db-laptop-label{font-family:var(--font-mono);font-size:0.68rem;color:var(--c-muted);letter-spacing:0.1em;margin-bottom:0.75rem;text-align:center}
  .db-laptop-screen{background:#010b1a;border-radius:6px;padding:0.75rem;min-height:160px;font-family:var(--font-mono);font-size:0.72rem;border:1px solid rgba(6,214,245,0.1);overflow:hidden;position:relative;}
  .db-cursor{display:inline-block;width:7px;height:13px;background:var(--c-cyan);animation:blink 1s step-end infinite;vertical-align:middle;margin-left:1px}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  .db-code-line{margin-bottom:0.2rem;white-space:pre}
  .db-code-kw{color:#c678dd}.db-code-fn{color:#61afef}.db-code-str{color:#98c379}.db-code-cm{color:#5c6370}.db-code-num{color:#d19a66}.db-code-acc{color:var(--c-cyan)}
  .db-team-activity{margin-top:0.75rem;display:flex;flex-direction:column;gap:0.3rem}
  .db-team-user{display:flex;align-items:center;gap:0.5rem;font-family:var(--font-mono);font-size:0.66rem}
  .db-team-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

  /* COURSE SEARCH */
  .db-course-wrap{margin-bottom:3rem}
  .db-search-row{display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap}
  .db-search-input{flex:1;min-width:200px;padding:0.75rem 1.1rem;background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.2);border-radius:6px;color:var(--c-text);font-family:var(--font-body);font-size:1rem;outline:none;transition:all 0.2s;}
  .db-search-input:focus{border-color:var(--c-cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.1)}
  .db-search-btn{padding:0.75rem 1.5rem;border:none;border-radius:6px;background:linear-gradient(135deg,#0ea5e9,#06d6f5);color:#020817;font-family:var(--font-head);font-size:0.78rem;font-weight:700;letter-spacing:0.08em;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
  .db-search-btn:hover:not(:disabled){box-shadow:0 0 20px rgba(6,214,245,0.35)}
  .db-search-btn:disabled{opacity:0.6;cursor:not-allowed}
  .db-course-spinner{display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2.5rem}
  .db-spinner-ring{width:44px;height:44px;border-radius:50%;border:2px solid rgba(6,214,245,0.15);border-top-color:var(--c-cyan);animation:spin 0.7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .db-spinner-text{font-family:var(--font-mono);font-size:0.72rem;color:var(--c-muted)}
  .db-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.25rem}
  .db-course-card{background:rgba(4,15,36,0.8);border:1px solid rgba(14,165,233,0.18);border-radius:8px;padding:1.25rem;transition:all 0.25s;display:flex;flex-direction:column;gap:0.5rem}
  .db-course-card:hover{border-color:rgba(6,214,245,0.4);transform:translateY(-2px)}
  .db-course-platform{font-family:var(--font-mono);font-size:0.65rem;color:var(--c-accent);letter-spacing:0.1em}
  .db-course-title{font-family:var(--font-head);font-size:0.82rem;font-weight:700;color:var(--c-text);line-height:1.3}
  .db-course-desc{font-size:0.87rem;color:var(--c-muted);line-height:1.5;flex:1}
  .db-course-meta{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
  .db-course-tag{font-family:var(--font-mono);font-size:0.62rem;color:var(--c-blue);border:1px solid rgba(14,165,233,0.25);padding:0.15rem 0.45rem;border-radius:3px}
  .db-course-link{display:inline-flex;align-items:center;gap:0.3rem;padding:0.5rem 1rem;border-radius:5px;background:rgba(14,165,233,0.1);border:1px solid rgba(14,165,233,0.25);color:var(--c-blue);font-family:var(--font-body);font-size:0.88rem;font-weight:600;text-decoration:none;transition:all 0.2s;align-self:flex-start;margin-top:auto}
  .db-course-link:hover{background:rgba(6,214,245,0.15);border-color:var(--c-cyan);color:var(--c-cyan)}
  .db-course-err{font-family:var(--font-mono);font-size:0.78rem;color:rgba(248,113,113,0.8);padding:1rem;text-align:center}

  /* Profile dropdown */
  .db-profile-menu{position:absolute;top:calc(100% + 0.75rem);right:0;background:rgba(4,15,36,0.97);border:1px solid rgba(6,214,245,0.2);border-radius:8px;padding:0.75rem;min-width:200px;box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:200;backdrop-filter:blur(20px)}
  .db-menu-user{padding:0.6rem 0.75rem;border-bottom:1px solid rgba(6,214,245,0.1);margin-bottom:0.5rem}
  .db-menu-name{font-family:var(--font-head);font-size:0.75rem;color:var(--c-text);margin-bottom:0.15rem}
  .db-menu-email{font-family:var(--font-mono);font-size:0.65rem;color:var(--c-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .db-menu-item{display:block;width:100%;text-align:left;padding:0.55rem 0.75rem;border-radius:5px;background:transparent;border:none;color:var(--c-muted);cursor:pointer;font-family:var(--font-body);font-size:0.9rem;font-weight:600;transition:all 0.15s;letter-spacing:0.02em}
  .db-menu-item:hover{background:rgba(14,165,233,0.1);color:var(--c-text)}
  .db-menu-item.danger{color:rgba(248,113,113,0.7)}
  .db-menu-item.danger:hover{background:rgba(248,113,113,0.1);color:#f87171}
  .db-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem}
  .db-spin{width:36px;height:36px;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--c-cyan);border-radius:50%;animation:spin 0.7s linear infinite}
  .db-spin-text{font-family:var(--font-mono);font-size:0.8rem;color:var(--c-muted)}

  /* ══════════════════════════════════════
     POPULAR COURSES — MENTOR PUBLISHED
  ══════════════════════════════════════ */
  .pc-section { margin-bottom: 3.5rem; }
  .pc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: 1.25rem;
    margin-top: 1.25rem;
  }
  /* The card itself — hover reveals expanded details */
  .pc-card {
    position: relative;
    background: rgba(4, 15, 36, 0.82);
    border: 1px solid rgba(14, 165, 233, 0.18);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
  }
  .pc-card:hover {
    transform: translateY(-4px);
    border-color: rgba(6, 214, 245, 0.5);
    box-shadow: 0 12px 40px rgba(6, 214, 245, 0.12), 0 0 0 1px rgba(6,214,245,0.1);
  }
  /* Thumbnail / header */
  .pc-thumb {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
    background: linear-gradient(135deg, #071a3e 0%, #0ea5e9 100%);
    position: relative;
  }
  .pc-thumb-placeholder {
    width: 100%;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.8rem;
    position: relative;
  }
  .pc-level-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    font-family: var(--font-mono);
    font-size: 0.55rem;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(2, 8, 23, 0.85);
    border: 1px solid rgba(6, 214, 245, 0.3);
    color: var(--c-cyan);
    backdrop-filter: blur(4px);
  }
  .pc-ep-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(0,255,200,0.15);
    border: 1px solid rgba(0,255,200,0.3);
    color: var(--c-accent);
    backdrop-filter: blur(4px);
  }
  /* Card body */
  .pc-body { padding: 1rem; }
  .pc-category {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    color: var(--c-accent);
    letter-spacing: 0.12em;
    margin-bottom: 6px;
  }
  .pc-title {
    font-family: var(--font-head);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--c-text);
    line-height: 1.35;
    margin-bottom: 5px;
  }
  .pc-mentor-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }
  .pc-mentor-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--c-cyan); flex-shrink: 0;
  }
  .pc-mentor-name {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    color: var(--c-muted);
  }
  .pc-price-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pc-price {
    font-family: var(--font-head);
    font-size: 1rem;
    font-weight: 700;
    color: var(--c-cyan);
  }
  .pc-price-original {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--c-muted);
    text-decoration: line-through;
  }
  .pc-free-badge {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    padding: 3px 9px;
    border-radius: 4px;
    background: rgba(0,255,200,0.12);
    border: 1px solid rgba(0,255,200,0.3);
    color: var(--c-accent);
  }

  /* Hover overlay — expanded info */
  .pc-overlay {
    position: absolute;
    inset: 0;
    background: rgba(2, 8, 23, 0.97);
    border-radius: 12px;
    padding: 1.1rem;
    opacity: 0;
    transition: opacity 0.25s ease;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    pointer-events: none;
  }
  .pc-card:hover .pc-overlay {
    opacity: 1;
    pointer-events: all;
  }
  .pc-overlay-title {
    font-family: var(--font-head);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--c-cyan);
    line-height: 1.3;
  }
  .pc-overlay-sub {
    font-size: 0.82rem;
    color: var(--c-muted);
    line-height: 1.5;
  }
  .pc-overlay-section {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    color: rgba(6,214,245,0.6);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 4px;
    margin-bottom: 2px;
  }
  .pc-overlay-text {
    font-size: 0.78rem;
    color: rgba(226,240,255,0.75);
    line-height: 1.55;
  }
  .pc-overlay-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .pc-overlay-tag {
    font-family: var(--font-mono);
    font-size: 0.52rem;
    padding: 2px 7px;
    border-radius: 3px;
    background: rgba(0,255,200,0.06);
    border: 1px solid rgba(0,255,200,0.2);
    color: var(--c-accent);
  }
  .pc-overlay-price-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(6,214,245,0.12);
  }
  .pc-buy-btn {
    flex: 1;
    padding: 9px 14px;
    border: none;
    border-radius: 7px;
    background: linear-gradient(135deg, #0ea5e9, #06d6f5);
    color: #020817;
    font-family: var(--font-head);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pc-buy-btn:hover { box-shadow: 0 0 20px rgba(6,214,245,0.4); }
  .pc-buy-btn.free {
    background: linear-gradient(135deg, #00c896, #06d6f5);
  }
  .pc-overlay-price-big {
    font-family: var(--font-head);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--c-cyan);
  }
  .pc-overlay-price-orig {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--c-muted);
    text-decoration: line-through;
  }
  .pc-episodes-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 80px;
    overflow-y: auto;
  }
  .pc-ep-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.54rem;
    color: var(--c-muted);
    padding: 2px 0;
  }
  .pc-ep-num-badge {
    font-size: 0.44rem;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(14,165,233,0.12);
    border: 1px solid rgba(14,165,233,0.2);
    color: var(--c-blue);
    flex-shrink: 0;
  }
  .pc-empty {
    grid-column: 1/-1;
    text-align: center;
    padding: 3rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: rgba(123,163,200,0.4);
  }
  .pc-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--c-muted);
    padding: 1.5rem 0;
  }
  .pc-spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(6,214,245,0.15);
    border-top-color: var(--c-cyan);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  /* Category accent colors */
  .pc-thumb-placeholder.cat-prog   { background: linear-gradient(135deg,#071a3e,#0369a1); }
  .pc-thumb-placeholder.cat-design { background: linear-gradient(135deg,#1a0736,#7c3aed); }
  .pc-thumb-placeholder.cat-data   { background: linear-gradient(135deg,#052e16,#15803d); }
  .pc-thumb-placeholder.cat-ai     { background: linear-gradient(135deg,#1c1917,#d97706); }
  .pc-thumb-placeholder.cat-sec    { background: linear-gradient(135deg,#1c0606,#dc2626); }
  .pc-thumb-placeholder.cat-other  { background: linear-gradient(135deg,#0c0f1a,#334155); }
`;

// Solo project code lines animation
const SOLO_LINES = [
  { t: 0,    html: '<span class="db-code-cm">// secure_auth.js — private workspace</span>' },
  { t: 600,  html: '<span class="db-code-kw">import</span> <span class="db-code-acc">{</span> encrypt <span class="db-code-acc">}</span> <span class="db-code-kw">from</span> <span class="db-code-str">\'./vault\'</span>' },
  { t: 1200, html: '' },
  { t: 1600, html: '<span class="db-code-kw">const</span> <span class="db-code-fn">authenticate</span> = <span class="db-code-kw">async</span> (user) => <span class="db-code-acc">{</span>' },
  { t: 2300, html: '  <span class="db-code-kw">const</span> token = <span class="db-code-kw">await</span> <span class="db-code-fn">encrypt</span>(user.id);' },
  { t: 3100, html: '  <span class="db-code-cm">// 256-bit AES encryption ✓</span>' },
  { t: 3700, html: '  <span class="db-code-kw">return</span> <span class="db-code-acc">{</span> token, expires: <span class="db-code-num">3600</span> <span class="db-code-acc">}</span>;' },
  { t: 4400, html: '<span class="db-code-acc">}</span>;' },
  { t: 5400, html: '<span class="db-code-cm">// ✓ Build success · 0 vulnerabilities</span>' },
];
const TEAM_USERS = [
  { name: "Aryan",  color: "#06d6f5", action: "editing api/routes.js" },
  { name: "Priya",  color: "#00ffc8", action: "reviewing PR #14"       },
  { name: "Sam",    color: "#0ea5e9", action: "running tests…"         },
];

function SoloLaptop() {
  const [visibleLines, setVisibleLines] = useState([]);
  useEffect(() => {
    const timers = SOLO_LINES.map(l => setTimeout(() => setVisibleLines(prev => [...prev, l.html]), l.t));
    const reset = setInterval(() => setVisibleLines([]), 7000);
    return () => { timers.forEach(clearTimeout); clearInterval(reset); };
  }, []);
  return (
    <div className="db-laptop-screen">
      {visibleLines.map((html, i) => <div key={i} className="db-code-line" dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />)}
      <span className="db-cursor" />
    </div>
  );
}

function TeamLaptop() {
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setActiveIdx(i => (i + 1) % TEAM_USERS.length), 2200); return () => clearInterval(t); }, []);
  return (
    <div className="db-laptop-screen">
      <div className="db-code-line"><span className="db-code-cm">// live collaboration session</span></div>
      <div className="db-code-line">&nbsp;</div>
      <div className="db-code-line"><span className="db-code-fn">repo</span>: global-collab-app <span className="db-code-acc">·</span> <span className="db-code-str">main</span></div>
      <div className="db-code-line">&nbsp;</div>
      <div className="db-team-activity">
        {TEAM_USERS.map((u, i) => (
          <div key={u.name} className="db-team-user" style={{ opacity: i === activeIdx ? 1 : 0.4, transition: "opacity 0.4s" }}>
            <span className="db-team-dot" style={{ background: u.color, boxShadow: i === activeIdx ? `0 0 6px ${u.color}` : "none" }} />
            <span style={{ color: u.color }}>{u.name}</span>
            <span style={{ color: "rgba(123,163,200,0.7)" }}>— {u.action}</span>
          </div>
        ))}
      </div>
      <div className="db-code-line" style={{ marginTop: "0.75rem" }}><span className="db-code-cm">// {TEAM_USERS.length} devs · 0 conflicts · cloud sync ✓</span></div>
      <span className="db-cursor" />
    </div>
  );
}

async function searchCourses(topic) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a course recommendation assistant. Return ONLY a valid JSON array (no markdown, no explanation) of 6 online courses for the topic: "${topic}".
Each object must have exactly these fields:
- platform (string): e.g. "Coursera", "Udemy", "edX", "YouTube", "MIT OpenCourseWare"
- title (string): course title
- description (string): 1-2 sentence description
- level (string): "Beginner", "Intermediate", or "Advanced"
- tags (array of strings): 2-3 relevant tags
- url (string): a real, working URL to the course
Return only the JSON array. No other text.`,
      }],
    }),
  });
  const data = await response.json();
  const text = data.content?.[0]?.text || "[]";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ── Category → emoji + class map ── */
const CAT_MAP = {
  "Programming":        { emoji: "💻", cls: "cat-prog"   },
  "Design":             { emoji: "🎨", cls: "cat-design"  },
  "Data Science":       { emoji: "📊", cls: "cat-data"   },
  "AI/ML":              { emoji: "🤖", cls: "cat-ai"     },
  "Cybersecurity":      { emoji: "🔐", cls: "cat-sec"    },
  "Business":           { emoji: "📈", cls: "cat-other"  },
  "Marketing":          { emoji: "📣", cls: "cat-other"  },
  "DevOps":             { emoji: "⚙️", cls: "cat-prog"   },
  "Cloud Computing":    { emoji: "☁️", cls: "cat-data"   },
  "Mobile Development": { emoji: "📱", cls: "cat-prog"   },
  "Game Dev":           { emoji: "🎮", cls: "cat-design"  },
  "Other":              { emoji: "📚", cls: "cat-other"  },
};

/* ── Popular Course Card ── */
function PopularCourseCard({ course }) {
  const catInfo = CAT_MAP[course.category] || { emoji: "📚", cls: "cat-other" };
  const episodes = course.episodes || [];
  const isFree = course.pricingType === "free";

  return (
    <div className="pc-card">
      {/* Static face */}
      {course.thumbnailUrl ? (
        <img src={course.thumbnailUrl} alt={course.title} className="pc-thumb" />
      ) : (
        <div className={`pc-thumb-placeholder ${catInfo.cls}`}>
          <span style={{ fontSize: "2.4rem" }}>{catInfo.emoji}</span>
          {course.level && <span className="pc-level-badge">{course.level}</span>}
          {episodes.length > 0 && <span className="pc-ep-badge">{episodes.length} EP{episodes.length !== 1 ? "S" : ""}</span>}
        </div>
      )}
      {course.thumbnailUrl && (
        <>
          {course.level && <span className="pc-level-badge" style={{ position: "absolute", top: 10, right: 10 }}>{course.level}</span>}
          {episodes.length > 0 && <span className="pc-ep-badge" style={{ position: "absolute", top: 10, left: 10 }}>{episodes.length} EPS</span>}
        </>
      )}
      <div className="pc-body">
        <div className="pc-category">{course.category || "Course"}</div>
        <div className="pc-title">{course.title}</div>
        <div className="pc-mentor-row">
          <span className="pc-mentor-dot" />
          <span className="pc-mentor-name">{course.mentorName || "Mentor"}</span>
        </div>
        <div className="pc-price-row">
          {isFree ? (
            <span className="pc-free-badge">FREE</span>
          ) : (
            <>
              <span className="pc-price">{course.currency} {course.price}</span>
              {course.originalPrice && <span className="pc-price-original">{course.currency} {course.originalPrice}</span>}
            </>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="pc-overlay">
        <div className="pc-overlay-title">{course.title}</div>
        {course.subtitle && <div className="pc-overlay-sub">{course.subtitle}</div>}

        {course.description && (
          <>
            <div className="pc-overlay-section">About</div>
            <div className="pc-overlay-text">{course.description.slice(0, 160)}{course.description.length > 160 ? "…" : ""}</div>
          </>
        )}

        {course.prerequisites && (
          <>
            <div className="pc-overlay-section">Prerequisites</div>
            <div className="pc-overlay-text">{course.prerequisites.slice(0, 100)}{course.prerequisites.length > 100 ? "…" : ""}</div>
          </>
        )}

        {course.whatYouLearn && (
          <>
            <div className="pc-overlay-section">What You'll Learn</div>
            <div className="pc-overlay-text">{course.whatYouLearn.slice(0, 120)}{course.whatYouLearn.length > 120 ? "…" : ""}</div>
          </>
        )}

        {episodes.length > 0 && (
          <>
            <div className="pc-overlay-section">Episodes ({episodes.length})</div>
            <div className="pc-episodes-list">
              {episodes.slice(0, 6).map((ep, i) => (
                <div key={ep.id || i} className="pc-ep-item">
                  <span className="pc-ep-num-badge">EP {String(i + 1).padStart(2, "0")}</span>
                  <span>{ep.title || `Episode ${i + 1}`}</span>
                </div>
              ))}
              {episodes.length > 6 && <div className="pc-ep-item" style={{ color: "var(--c-cyan)" }}>+{episodes.length - 6} more…</div>}
            </div>
          </>
        )}

        {(course.tags && typeof course.tags === "string" && course.tags.trim()) && (
          <div className="pc-overlay-tags">
            {course.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
              <span key={t} className="pc-overlay-tag">{t}</span>
            ))}
          </div>
        )}

        <div className="pc-overlay-price-row">
          <div>
            {isFree ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", color: "var(--c-accent)", fontWeight: 700 }}>FREE</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="pc-overlay-price-big">{course.currency} {course.price}</span>
                {course.originalPrice && <span className="pc-overlay-price-orig">{course.currency} {course.originalPrice}</span>}
              </div>
            )}
          </div>
          <button className={`pc-buy-btn${isFree ? " free" : ""}`} onClick={e => { e.stopPropagation(); alert(isFree ? "Enrolling you for free!" : `Proceeding to purchase: ${course.currency} ${course.price}`); }}>
            {isFree ? "Enroll Free →" : "Purchase →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Popular Courses Section ── */
function PopularCoursesSection() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "mentorCourses"), where("status", "==", "published"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setCourses(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  return (
    <div className="pc-section">
      <div className="db-sec-label">// MENTOR COURSES</div>
      <div className="db-sec-h">Popular Courses <span>by Mentors</span></div>

      {loading && (
        <div className="pc-loading">
          <div className="pc-spinner" />
          <span>Loading published courses…</span>
        </div>
      )}

      {!loading && (
        <div className="pc-grid">
          {courses.length === 0 && (
            <div className="pc-empty">No courses published yet — check back soon!</div>
          )}
          {courses.map(c => <PopularCourseCard key={c.firestoreId} course={c} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   COMMON DASHBOARD
══════════════════════════════════════════════════ */
const query2 = query;

export default function CommonDashboard() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [soloCount, setSoloCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [queryStr, setQueryStr] = useState("");
  const [searching, setSearching] = useState(false);
  const [courses, setCourses] = useState(null);
  const [courseErr, setCourseErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setProfile(snap.data());
      const [soloSnap, teamSnap, notifSnap] = await Promise.all([
        getDocs(query2(collection(db,"soloProjects"), where("uid","==",u.uid))),
        getDocs(query2(collection(db,"teamProjects"), where("members","array-contains",u.uid))),
        getDocs(query2(collection(db,"notifications"), where("toUid","==",u.uid), where("read","==",false))),
      ]);
      setSoloCount(soloSnap.size);
      setTeamCount(teamSnap.size);
      setUnreadCount(notifSnap.size);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pts = Array.from({ length: 40 }, () => ({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()+0.2, dx:(Math.random()-0.5)*0.2, dy:(Math.random()-0.5)*0.2, a:Math.random()*0.3+0.1 }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(6,214,245,${p.a})`; ctx.fill(); p.x+=p.dx; p.y+=p.dy; if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0; if(p.y<0)p.y=canvas.height; if(p.y>canvas.height)p.y=0; });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => { await signOut(auth); nav("/"); };

  const handleSearch = async () => {
    if (!queryStr.trim()) return;
    setSearching(true); setCourses(null); setCourseErr("");
    const [results] = await Promise.all([
      searchCourses(queryStr.trim()).catch(() => null),
      new Promise(r => setTimeout(r, 3000))
    ]);
    if (!results) setCourseErr("Could not fetch courses. Try again.");
    else setCourses(results);
    setSearching(false);
  };

  const avatarSrc = getAvatarSrc(profile?.avatar);
  const displayName = profile?.fullName || user?.displayName || "Student";
  const firstName = displayName.split(" ")[0];

  if (loading) return (
    <><style>{css}</style>
    <div className="db-loading"><div className="db-spin" /><div className="db-spin-text">LOADING DASHBOARD…</div></div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="db-bg" />
      <canvas ref={canvasRef} className="db-canvas" />

      {/* NAV */}
      <nav className="db-nav">
        <div className="db-nav-logo">SCH·HUB</div>
        <div className="db-nav-right" ref={menuRef}>
          <span className="db-nav-greet">WELCOME, {firstName.toUpperCase()}</span>
          <button className="db-notif-btn" onClick={() => nav("/notifications")} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && <span className="db-notif-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          <button className="db-avatar-btn" onClick={() => setMenuOpen(v => !v)}>
            <img src={avatarSrc} alt="avatar" />
          </button>
          {menuOpen && (
            <div className="db-profile-menu">
              <div className="db-menu-user">
                <div className="db-menu-name">{displayName}</div>
                <div className="db-menu-email">{user?.email}</div>
              </div>
              <button className="db-menu-item" onClick={() => { setMenuOpen(false); nav("/update-profile"); }}>Edit Profile</button>
              <button className="db-menu-item" onClick={() => { setMenuOpen(false); nav("/notifications"); }}>Notifications {unreadCount > 0 && `(${unreadCount})`}</button>
              <button className="db-menu-item" onClick={() => { setMenuOpen(false); nav("/your-projects"); }}>View Projects</button>
              <button className="db-menu-item danger" onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN */}
      <main className="db-main">
        {/* HERO */}
        <div className="db-hero">
          <div className="db-hero-tag">// DASHBOARD — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</div>
          <div className="db-hero-h">Hello, <span>{firstName}</span>. Ready to build?</div>
          <div className="db-hero-p">Your cloud workspace is online. Choose a project mode and start shipping.</div>
        </div>

        {/* LAPTOP SIMULATION */}
        <div className="db-sim-wrap">
          <div className="db-sec-label">// PROJECT MODES</div>
          <div className="db-sec-h">Solo focus. <span>Team power.</span></div>
          <div className="db-laptops">
            <div className="db-laptop"><div className="db-laptop-label">// SOLO DEVELOPER — SECURE WORKSPACE</div><SoloLaptop /></div>
            <div className="db-laptop"><div className="db-laptop-label">// TEAM COLLABORATION — LIVE SESSION</div><TeamLaptop /></div>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div style={{ marginBottom: "3.5rem" }}>
          <div className="db-sec-label">// FEATURES</div>
          <div className="db-sec-h">Everything you need.</div>
          <div className="db-proj-grid" style={{ marginTop: "1.25rem" }}>
            <div className="db-proj-card">
              <div className="db-proj-num">01</div>
              <div className="db-proj-title">SOLO PROJECT MODE</div>
              <div className="db-proj-desc">Your private, secure cloud sandbox. Full version history, auto-deploy previews, and encrypted storage — build without distractions.</div>
              <div className="db-proj-tags"><span className="db-tag">CLOUD IDE</span><span className="db-tag">AUTO DEPLOY</span><span className="db-tag">VERSIONING</span><span className="db-tag">AES-256 SECURE</span></div>
              <div className="db-proj-count">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                <span className="db-proj-count-num">{soloCount}</span> solo project{soloCount !== 1 ? "s" : ""} created
              </div>
              <button className="db-create-btn db-create-solo" onClick={() => nav("/solo-questions")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Solo Project
              </button>
            </div>
            <div className="db-proj-card">
              <div className="db-proj-num">02</div>
              <div className="db-proj-title">TEAM COLLABORATION</div>
              <div className="db-proj-desc">Smart matchmaking connects you with peers by skill and domain. Real-time co-coding, shared task boards, and zero storage chaos.</div>
              <div className="db-proj-tags"><span className="db-tag">SMART MATCH</span><span className="db-tag">REAL-TIME SYNC</span><span className="db-tag">TASK BOARDS</span><span className="db-tag">ZERO HARDWARE</span></div>
              <div className="db-proj-count">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className="db-proj-count-num">{teamCount}</span> team project{teamCount !== 1 ? "s" : ""} joined
              </div>
              <button className="db-create-btn db-create-team" onClick={() => nav("/team-questions")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Team Project
              </button>
            </div>
          </div>
        </div>

        {/* ★ POPULAR COURSES — MENTOR PUBLISHED ★ */}
        <PopularCoursesSection />

        {/* COURSE SEARCH (AI) */}
        <div className="db-course-wrap">
          {/* <div className="db-sec-label">// LEARNING</div>
          <div className="db-sec-h">Search Courses <span>Suitable for You</span></div>
          <div className="db-search-row">
            <input
              className="db-search-input"
              placeholder="e.g. Blockchain, Cloud Computing, Cybersecurity, VLSI…"
              value={queryStr}
              onChange={e => setQueryStr(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !searching && handleSearch()}
            />
            <button className="db-search-btn" onClick={handleSearch} disabled={searching || !queryStr.trim()}>
              {searching ? "SEARCHING…" : "FIND COURSES"}
            </button>
          </div>
          {searching && (
            <div className="db-course-spinner">
              <div className="db-spinner-ring" />
              <div className="db-spinner-text">SCANNING COURSE DATABASES…</div>
            </div>
          )} */}
          {courseErr && <div className="db-course-err">⚠ {courseErr}</div>}
          {courses && !searching && (
            <div className="db-course-grid">
              {courses.map((c, i) => (
                <div key={i} className="db-course-card">
                  <div className="db-course-platform">{c.platform?.toUpperCase()}</div>
                  <div className="db-course-title">{c.title}</div>
                  <div className="db-course-desc">{c.description}</div>
                  <div className="db-course-meta">
                    <span className="db-course-tag">{c.level}</span>
                    {(c.tags || []).map(t => <span key={t} className="db-course-tag">{t}</span>)}
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="db-course-link">View Course →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}