import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    --c-warn: #f97316;
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
    overflow-x: hidden;
  }

  /* GRID BACKGROUND */
  .land-bg {
    position: fixed; inset: 0; z-index: 0;
    background:
      linear-gradient(rgba(6,214,245,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,214,245,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  /* NAV */
  .land-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2.5rem;
    background: rgba(2,8,23,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(6,214,245,0.12);
  }
  .land-logo {
    font-family: var(--font-head);
    font-size: 1rem; font-weight: 700;
    color: var(--c-cyan);
    letter-spacing: 0.1em;
    text-shadow: 0 0 20px var(--c-cyan);
  }
  .land-logo span { color: var(--c-accent); }
  .land-nav-links { display: flex; gap: 1rem; align-items: center; }
  .land-nav-btn {
    font-family: var(--font-body); font-size: 0.95rem; font-weight: 600;
    padding: 0.5rem 1.4rem; border-radius: 4px; cursor: pointer;
    letter-spacing: 0.05em; transition: all 0.2s; border: none;
    text-decoration: none; display: inline-block;
  }
  .land-nav-login {
    background: transparent;
    border: 1px solid var(--c-blue);
    color: var(--c-blue);
  }
  .land-nav-login:hover { background: var(--c-glow); box-shadow: 0 0 14px var(--c-blue); }
  .land-nav-reg {
    background: linear-gradient(135deg, #0ea5e9, #06d6f5);
    color: #020817;
  }
  .land-nav-reg:hover { box-shadow: 0 0 20px var(--c-cyan); transform: translateY(-1px); }

  /* HERO */
  .land-hero {
    position: relative; z-index: 1;
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 7rem 1.5rem 4rem;
    overflow: hidden;
  }

  .land-hero-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    animation: orbFloat 8s ease-in-out infinite;
  }
  .land-hero-orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(6,214,245,0.18), transparent 70%);
    top: -100px; left: 50%; transform: translateX(-50%);
  }
  .land-hero-orb-2 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(14,165,233,0.15), transparent 70%);
    bottom: 100px; right: -50px;
    animation-delay: -3s;
  }
  @keyframes orbFloat {
    0%,100% { transform: translateY(0) translateX(-50%); }
    50% { transform: translateY(-30px) translateX(-50%); }
  }

  .land-badge {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: var(--font-mono); font-size: 0.75rem;
    color: var(--c-accent); letter-spacing: 0.15em;
    border: 1px solid rgba(0,255,200,0.3);
    padding: 0.35rem 1rem; border-radius: 2px;
    margin-bottom: 2rem;
    background: rgba(0,255,200,0.05);
    animation: fadeSlideDown 0.8s ease both;
  }
  .land-badge::before {
    content: '';
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--c-accent);
    box-shadow: 0 0 8px var(--c-accent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .land-h1 {
    font-family: var(--font-head);
    font-size: clamp(2rem, 5vw, 4rem);
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--c-text);
    margin-bottom: 1.5rem;
    animation: fadeSlideDown 0.9s 0.1s ease both;
  }
  .land-h1 .hl { color: var(--c-cyan); text-shadow: 0 0 30px var(--c-cyan); }

  .land-sub {
    font-size: 1.2rem; font-weight: 400;
    color: var(--c-muted); max-width: 560px;
    line-height: 1.6; margin-bottom: 2.5rem;
    animation: fadeSlideDown 1s 0.2s ease both;
  }

  .land-cta-row {
    display: flex; gap: 1rem; flex-wrap: wrap;
    justify-content: center;
    animation: fadeSlideDown 1.1s 0.3s ease both;
  }
  .land-cta-primary {
    font-family: var(--font-body); font-size: 1rem; font-weight: 700;
    padding: 0.85rem 2.2rem; border-radius: 4px; cursor: pointer;
    background: linear-gradient(135deg, #0ea5e9, #06d6f5);
    color: #020817; border: none; letter-spacing: 0.08em;
    transition: all 0.25s;
  }
  .land-cta-primary:hover { box-shadow: 0 0 30px var(--c-cyan); transform: translateY(-2px); }
  .land-cta-sec {
    font-family: var(--font-body); font-size: 1rem; font-weight: 600;
    padding: 0.85rem 2.2rem; border-radius: 4px; cursor: pointer;
    background: transparent; color: var(--c-text);
    border: 1px solid rgba(255,255,255,0.2); letter-spacing: 0.05em;
    transition: all 0.25s;
  }
  .land-cta-sec:hover { border-color: var(--c-blue); color: var(--c-blue); }

  /* TICKER */
  .land-ticker {
    position: relative; z-index: 1;
    overflow: hidden;
    border-top: 1px solid rgba(6,214,245,0.1);
    border-bottom: 1px solid rgba(6,214,245,0.1);
    padding: 0.75rem 0;
    background: rgba(4,15,36,0.6);
  }
  .land-ticker-inner {
    display: flex; gap: 4rem;
    animation: ticker 22s linear infinite;
    white-space: nowrap;
  }
  .land-ticker-item {
    font-family: var(--font-mono); font-size: 0.78rem;
    color: var(--c-cyan); letter-spacing: 0.1em; opacity: 0.7;
    flex-shrink: 0;
  }
  @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

  /* PROBLEMS SECTION */
  .land-section {
    position: relative; z-index: 1;
    padding: 5rem 1.5rem;
    max-width: 1100px; margin: 0 auto;
  }
  .land-section-tag {
    font-family: var(--font-mono); font-size: 0.72rem;
    color: var(--c-accent); letter-spacing: 0.2em;
    margin-bottom: 1rem; text-transform: uppercase;
  }
  .land-section-h2 {
    font-family: var(--font-head); font-size: clamp(1.5rem, 3vw, 2.4rem);
    font-weight: 700; line-height: 1.2; margin-bottom: 1rem;
    color: var(--c-text);
  }
  .land-section-h2 .hl { color: var(--c-cyan); }
  .land-section-p {
    color: var(--c-muted); font-size: 1.05rem; max-width: 560px;
    line-height: 1.7; margin-bottom: 3rem;
  }

  .land-pain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }
  .land-pain-card {
    background: rgba(7,26,62,0.5);
    border: 1px solid rgba(14,165,233,0.15);
    border-radius: 8px;
    padding: 1.5rem;
    transition: all 0.3s;
    position: relative; overflow: hidden;
  }
  .land-pain-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--c-blue), transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .land-pain-card:hover::before { opacity: 1; }
  .land-pain-card:hover {
    border-color: rgba(14,165,233,0.4);
    background: rgba(7,26,62,0.8);
    transform: translateY(-3px);
  }
  .land-pain-icon {
    font-size: 1.6rem; margin-bottom: 0.75rem;
    display: block;
  }
  .land-pain-title {
    font-family: var(--font-head); font-size: 0.85rem;
    font-weight: 700; color: var(--c-text); letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  .land-pain-desc {
    font-size: 0.9rem; color: var(--c-muted); line-height: 1.6;
  }

  /* COLLAB SECTION */
  .land-collab-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;
    margin-top: 3rem;
  }
  @media(max-width:700px){ .land-collab-grid { grid-template-columns:1fr; } }
  .land-collab-card {
    border: 1px solid rgba(6,214,245,0.18);
    border-radius: 10px; padding: 2rem;
    background: rgba(4,15,36,0.6);
    position: relative; overflow: hidden;
  }
  .land-collab-card::after {
    content: '';
    position: absolute; bottom: 0; right: 0;
    width: 120px; height: 120px;
    background: radial-gradient(circle, var(--c-glow), transparent 70%);
    pointer-events: none;
  }
  .land-collab-num {
    font-family: var(--font-head); font-size: 3rem;
    font-weight: 900; color: rgba(6,214,245,0.12);
    letter-spacing: -0.02em; line-height: 1;
    margin-bottom: 1rem;
  }
  .land-collab-h {
    font-family: var(--font-head); font-size: 0.95rem;
    font-weight: 700; color: var(--c-cyan);
    letter-spacing: 0.08em; margin-bottom: 0.75rem;
  }
  .land-collab-p {
    font-size: 0.95rem; color: var(--c-muted); line-height: 1.7;
  }
  .land-collab-tags {
    display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 1rem;
  }
  .land-tag {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--c-accent); border: 1px solid rgba(0,255,200,0.25);
    padding: 0.2rem 0.6rem; border-radius: 3px;
    background: rgba(0,255,200,0.05);
  }

  /* CTA BOTTOM */
  .land-cta-bottom {
    position: relative; z-index: 1;
    text-align: center; padding: 5rem 1.5rem;
    background: linear-gradient(180deg, transparent, rgba(6,214,245,0.04), transparent);
  }
  .land-cta-bottom h2 {
    font-family: var(--font-head); font-size: clamp(1.5rem, 3vw, 2.2rem);
    font-weight: 700; color: var(--c-text); margin-bottom: 1rem;
  }
  .land-cta-bottom p { color: var(--c-muted); margin-bottom: 2rem; font-size: 1.05rem; }

  /* FOOTER */
  .land-footer {
    position: relative; z-index: 1;
    border-top: 1px solid rgba(6,214,245,0.1);
    padding: 1.5rem 2rem;
    display: flex; align-items: center; justify-content: space-between;
    font-family: var(--font-mono); font-size: 0.72rem;
    color: rgba(123,163,200,0.5);
    flex-wrap: wrap; gap: 0.5rem;
  }

  @keyframes fadeSlideDown {
    from { opacity: 0; transform: translateY(-18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media(max-width:600px){
    .land-nav { padding: 1rem; }
    .land-nav-links { gap: 0.5rem; }
    .land-nav-btn { padding: 0.4rem 0.9rem; font-size: 0.85rem; }
    .land-footer { flex-direction: column; text-align: center; }
  }
`;

const PAINS = [
  { icon: "🔧", title: "HARDWARE HEADACHES", desc: "Tired of buying expensive hardware for every new project idea? We move your workspace to the cloud." },
  { icon: "📦", title: "DEPENDENCY HELL", desc: "Stop wasting weekends setting up environments. Pre-configured dev stacks ready in seconds." },
  { icon: "☁️", title: "CLOUD CHAOS", desc: "Juggling GDrive, GitHub, OneDrive? Centralized secure storage with smart project versioning." },
  { icon: "🤝", title: "GOING SOLO", desc: "The best projects happen in teams. Find collaborators who complement your exact skill set." },
  { icon: "📡", title: "KNOWLEDGE SILOS", desc: "Learning alone from fragmented resources. Curated, peer-verified learning paths for every domain." },
  { icon: "⏰", title: "WASTED TIME", desc: "Rebuilding wheels others already built. Reuse, remix, and build on open student projects." },
];

const TICKER_ITEMS = [
  "ENGINEERING MADE EASY", "COLLABORATE · BUILD · SHIP", "500+ DOMAINS",
  "CLOUD-FIRST WORKFLOW", "ZERO HARDWARE NEEDED", "PEER-TO-PEER LEARNING",
  "ENGINEERING MADE EASY", "COLLABORATE · BUILD · SHIP", "500+ DOMAINS",
  "CLOUD-FIRST WORKFLOW", "ZERO HARDWARE NEEDED", "PEER-TO-PEER LEARNING",
];

export default function Landing() {
  const nav = useNavigate();
  const canvasRef = useRef(null);

  // Animated particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.2,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,214,245,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      // connect nearby particles
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(6,214,245,${0.08 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        });
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="land-bg" />
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* NAV */}
      <nav className="land-nav">
        <div className="land-logo">SCH<span></span>HUB</div>
        <div className="land-nav-links">
          {/* <a href="#why" className="land-nav-btn" style={{ color: "var(--c-muted)", textDecoration: "none", fontSize: "0.9rem" }}>About</a> */}
          <button className="land-nav-btn land-nav-login" onClick={() => nav("/login")}>Student Login</button>
          {/* <button className="land-nav-btn land-nav-reg" onClick={() => nav("/register")}>Register</button> */}
          <button className="land-nav-btn land-nav-login" onClick={() => nav("/mentor/register")}>Mentor Login</button>

          
          
        </div>
      </nav>

      {/* HERO */}
      <section className="land-hero">
        <div className="land-hero-orb land-hero-orb-1" />
        <div className="land-hero-orb land-hero-orb-2" />

        <div className="land-badge">STUDENT COLLABORATION HUB · EST. 2026</div>
        <h1 className="land-h1">
          Engineering Made<br />
          <span className="hl">Engineering Easy.</span>
        </h1>
        <p className="land-sub">
          The cloud-native workspace where CS & IT students build, collaborate, and ship real projects — no hardware, no chaos.
        </p>
        <div className="land-cta-row">
          <button className="land-cta-primary" onClick={() => nav("/register")}>Start Building Free →</button>
          <button className="land-cta-sec" onClick={() => nav("/login")}>Already a member</button>
        </div>
      </section>

      {/* TICKER */}
      <div className="land-ticker">
        <div className="land-ticker-inner">
          {TICKER_ITEMS.map((t, i) => (
            <span key={i} className="land-ticker-item">// {t}</span>
          ))}
        </div>
      </div>

      {/* PAIN POINTS */}
      <section className="land-section" id="why">
        <div className="land-section-tag">// THE PROBLEM</div>
        <h2 className="land-section-h2">Bored of the same old <span className="hl">student struggles?</span></h2>
        <p className="land-section-p">
          Every semester is the same: huge hardware setups, environment nightmares, solo struggles, and projects that never leave your laptop.
        </p>
        <div className="land-pain-grid">
          {PAINS.map((p, i) => (
            <div key={i} className="land-pain-card">
              <span className="land-pain-icon">{p.icon}</span>
              <div className="land-pain-title">{p.title}</div>
              <div className="land-pain-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COLLAB ADVANTAGES */}
      <section className="land-section">
        <div className="land-section-tag">// THE SOLUTION</div>
        <h2 className="land-section-h2">Solo focus. <span className="hl">Team power.</span></h2>
        <p className="land-section-p">
          Whether you're a lone-wolf coder or a team player, SCH·HUB gives you the right environment for every project style.
        </p>
        <div className="land-collab-grid">
          <div className="land-collab-card">
            <div className="land-collab-num">01</div>
            <div className="land-collab-h">SOLO PROJECT MODE</div>
            <div className="land-collab-p">Your personal secure sandbox. Full cloud IDE, version history, auto-deploy previews. Build without limits — no teammate coordination needed.</div>
            <div className="land-collab-tags">
              <span className="land-tag">CLOUD IDE</span>
              <span className="land-tag">AUTO DEPLOY</span>
              <span className="land-tag">VERSIONING</span>
              <span className="land-tag">SECURE</span>
            </div>
          </div>
          <div className="land-collab-card">
            <div className="land-collab-num">02</div>
            <div className="land-collab-h">TEAM COLLABORATION</div>
            <div className="land-collab-p">Smart matchmaking connects you with peers who have the skills you lack. Real-time co-coding, task boards, and shared cloud storage — built for student teams.</div>
            <div className="land-collab-tags">
              <span className="land-tag">SMART MATCH</span>
              <span className="land-tag">REAL-TIME</span>
              <span className="land-tag">TASK BOARDS</span>
              <span className="land-tag">SHARED STORAGE</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BOTTOM */}
      <div className="land-cta-bottom">
        <h2>Ready to build something <span style={{ color: "var(--c-cyan)" }}>real?</span></h2>
        <p>Join thousands of engineering students who stopped struggling and started shipping.</p>
        <button className="land-cta-primary" onClick={() => nav("/register")}>Create Free Account →</button>
      </div>

      {/* FOOTER */}
      <footer className="land-footer">
        <span>© 2025 Student Collaboration Hub · Global</span>
        <span>ENGINEERING MADE ENGINEERING EASY</span>
        <span style={{ cursor: "pointer" }} onClick={() => nav("/login")}>Login / Register</span>
      </footer>
    </>
  );
}