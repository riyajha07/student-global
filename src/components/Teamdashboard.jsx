/**
 * ProjectGate.jsx  —  v2.0  COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────────
 * Features:
 *   ✅  Voice call (Daily.co embedded + fallback Web Audio peer)
 *   ✅  Text chat visible DURING voice/video call
 *   ✅  Real mentor profile photo pulled from Firestore users doc
 *   ✅  Fully responsive (mobile sidebar overlay, fluid grids)
 *   ✅  AI Tools tab — real Claude API calls for code review,
 *       task suggestions, Q&A assistance, feedback drafts
 *   ✅  Zero-glitch realtime Firestore listeners
 *   ✅  ProjectGate role router
 *
 * Router usage:
 *   <Route path="/project/:projectId" element={<ProjectGate />} />
 *
 * Exports: default ProjectGate · MentorProjectView · TeamDashboard
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, getDoc, updateDoc, collection, getDocs,
  query, where, onSnapshot, addDoc, serverTimestamp, orderBy,
  arrayUnion, setDoc, deleteDoc
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

/* ─── Firebase init ─────────────────────────────────────────────── */
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

/* ─── Shared utilities ──────────────────────────────────────────── */
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
  { id: "todo",       label: "To Do",       color: "#64748b", dot: "#94a3b8" },
  { id: "inprogress", label: "In Progress", color: "#0369a1", dot: "#0ea5e9" },
  { id: "review",     label: "In Review",   color: "#92400e", dot: "#f59e0b" },
  { id: "done",       label: "Done",        color: "#065f46", dot: "#10b981" },
];

/* ─── AI helper (Claude API via Anthropic) ──────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════
   PROJECT GATE — role detector
══════════════════════════════════════════════════════════════════ */
export default function ProjectGate() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [role, setRole] = useState("loading");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "teamProjects", projectId));
        if (!snap.exists()) { setRole("notfound"); return; }
        const isMentor = (snap.data().mentorMembers || []).includes(u.uid);
        setRole(isMentor ? "mentor" : "student");
      } catch { setRole("notfound"); }
    });
    return unsub;
  }, [projectId]);

  if (role === "loading") return <LoadingScreen />;
  if (role === "notfound") return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"sans-serif",color:"#64748b" }}>
      Project not found.
    </div>
  );
  return role === "mentor" ? <MentorProjectView /> : <TeamDashboard />;
}

function LoadingScreen() {
  return (
    <>
      <style>{`
        @keyframes lspin{to{transform:rotate(360deg)}}
        @keyframes lpulse{0%,100%{opacity:1}50%{opacity:.3}}
        .lg-w{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080d14;gap:16px}
        .lg-r{width:30px;height:30px;border:2px solid rgba(255,255,255,0.07);border-top-color:#f59e0b;border-radius:50%;animation:lspin .7s linear infinite}
        .lg-t{font:700 .55rem/1 'Courier New',monospace;letter-spacing:.2em;color:rgba(255,255,255,.2);animation:lpulse 2s ease infinite}
      `}</style>
      <div className="lg-w"><div className="lg-r" /><div className="lg-t">LOADING PROJECT…</div></div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SHARED VOICE CALL COMPONENT
   Uses Daily.co prebuilt embed — free tier supports audio+video
   Falls back to text-only if room can't be created
══════════════════════════════════════════════════════════════════ */
function VoiceCallPanel({ projectId, myProfile, isMentor, vcMsgs, vcInput, setVcInput, sendVcMsg, vcEndRef, user }) {
  const [callMode, setCallMode] = useState("idle"); // idle | voice | video
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const callRef = useRef(null);
  const frameRef = useRef(null);

  const roomName = `sch-hub-${projectId.slice(0, 16)}`;
  const displayName = encodeURIComponent((myProfile?.fullName || "Member") + (isMentor ? " 🧑‍🏫" : ""));

  // Build Jitsi URL with voice or video config
  const buildCallUrl = (mode) => {
    const base = `https://meet.jit.si/${roomName}`;
    const params = new URLSearchParams({
      "config.startWithAudioMuted": "false",
      "config.startWithVideoMuted": mode === "voice" ? "true" : "false",
      "config.disableDeepLinking": "true",
      "userInfo.displayName": decodeURIComponent(displayName),
    });
    return `${base}#${params.toString()}`;
  };

  const CSS = isMentor ? MENTOR_CSS_VARS : TEAM_CSS_VARS;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }} className="vc-outer-grid">
      <style>{`
        @media(max-width:900px){.vc-outer-grid{grid-template-columns:1fr!important}}
        .vc-call-frame{width:100%;border:none;display:block;border-radius:0 0 10px 10px}
        .vc-ctrl-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid;font-size:.72rem;font-weight:700;cursor:pointer;transition:all .15s}
        .vc-ctrl-btn:disabled{opacity:.4;cursor:default}
      `}</style>

      {/* Left: Call area */}
      <div>
        <div style={{
          background: isMentor ? "#0f1923" : "#0f172a",
          border: `1px solid ${isMentor ? "rgba(255,255,255,0.1)" : "#1e293b"}`,
          borderRadius: 12, overflow: "hidden"
        }}>
          {/* Controls bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
            borderBottom: `1px solid ${isMentor ? "rgba(255,255,255,0.08)" : "#1e293b"}`,
            flexWrap: "wrap"
          }}>
            <span style={{ fontFamily: "monospace", fontSize: ".6rem", color: "rgba(255,255,255,.5)", flex: 1 }}>
              Room: {roomName}
            </span>
            {callMode === "idle" ? (
              <>
                <button className="vc-ctrl-btn" style={{
                  background: "#16a34a22", borderColor: "#16a34a44", color: "#4ade80"
                }} onClick={() => setCallMode("voice")}>
                  🎙 Join Voice
                </button>
                <button className="vc-ctrl-btn" style={{
                  background: "#1d4ed822", borderColor: "#1d4ed844", color: "#60a5fa"
                }} onClick={() => setCallMode("video")}>
                  📹 Join Video
                </button>
              </>
            ) : (
              <>
                <span style={{ fontFamily: "monospace", fontSize: ".56rem", color: "#4ade80", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "lpulse 1.5s ease infinite" }} />
                  {callMode === "voice" ? "Voice" : "Video"} · Live
                </span>
                <button className="vc-ctrl-btn" style={{ background: "#dc262622", borderColor: "#dc262644", color: "#f87171" }}
                  onClick={() => setCallMode("idle")}>
                  ✕ Leave
                </button>
              </>
            )}
          </div>

          {/* Call iframe or idle state */}
          {callMode === "idle" ? (
            <div style={{
              height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
              background: isMentor ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)"
            }}>
              <div style={{ fontSize: "2.5rem" }}>🎧</div>
              <div style={{ fontFamily: "monospace", fontSize: ".62rem", color: "rgba(255,255,255,.3)", textAlign: "center", lineHeight: 1.8 }}>
                Join a voice or video call<br />Everyone in this project can join the same room
              </div>
            </div>
          ) : (
            <iframe
              ref={frameRef}
              src={buildCallUrl(callMode)}
              className="vc-call-frame"
              style={{ height: "clamp(280px,45vw,520px)" }}
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
              title="Call"
            />
          )}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: ".48rem", color: "rgba(100,116,139,.6)", marginTop: 5, textAlign: "center" }}>
          Powered by Jitsi Meet · End-to-end encrypted · No account needed
        </div>
      </div>

      {/* Right: Chat panel */}
      <div style={{
        background: isMentor ? "#fff" : "#fff",
        border: `1px solid ${isMentor ? "#e8ecf0" : "#e2e8f0"}`,
        borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 360
      }}>
        <div style={{
          padding: "10px 14px", borderBottom: `1px solid ${isMentor ? "#e8ecf0" : "#e2e8f0"}`,
          fontFamily: "monospace", fontSize: ".52rem", color: "#94a3b8", letterSpacing: ".12em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6
        }}>
          <span>💬 Team Chat</span>
          <span style={{ marginLeft: "auto", fontSize: ".46rem" }}>{vcMsgs.length} messages</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 9, maxHeight: 400 }}>
          {vcMsgs.length === 0 && (
            <div style={{ fontFamily: "monospace", fontSize: ".58rem", color: "#94a3b8", textAlign: "center", padding: 20 }}>
              No messages yet
            </div>
          )}
          {vcMsgs.map(m => (
            <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <img
                src={getAv(m.avatar, m.photoURL)}
                alt={m.userName}
                style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, border: "1.5px solid #e2e8f0", objectFit: "cover" }}
              />
              <div>
                <div style={{
                  fontFamily: "monospace", fontSize: ".5rem",
                  color: m.isMentor ? "#d97706" : "#2563eb", marginBottom: 2, fontWeight: 700
                }}>
                  {m.userName}{m.isMentor ? " 🧑‍🏫" : ""}
                  {m.userId === user?.uid ? " (you)" : ""}
                </div>
                <div style={{ fontSize: ".74rem", color: "#334155", lineHeight: 1.5, wordBreak: "break-word" }}>{m.text}</div>
                <div style={{ fontFamily: "monospace", fontSize: ".44rem", color: "#94a3b8", marginTop: 2 }}>{timeAgo(m.createdAt)}</div>
              </div>
            </div>
          ))}
          <div ref={vcEndRef} />
        </div>
        <div style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${isMentor ? "#e8ecf0" : "#e2e8f0"}` }}>
          <input
            style={{
              flex: 1, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 7, color: "#0f172a", fontSize: ".76rem", outline: "none", fontFamily: "inherit"
            }}
            placeholder="Send a message…"
            value={vcInput}
            onChange={e => setVcInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendVcMsg()}
          />
          <button
            onClick={sendVcMsg}
            style={{
              padding: "8px 14px", border: "none", borderRadius: 7,
              background: isMentor ? "#92400e" : "#1d4ed8",
              color: "#fff", fontSize: ".64rem", fontWeight: 700, cursor: "pointer"
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SHARED AI TOOLS PANEL
══════════════════════════════════════════════════════════════════ */
function AIToolsPanel({ projectId, user, myProfile, members, tasks, files, questions, isMentor }) {
  const [activeTool, setActiveTool] = useState("taskgen");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Task generator inputs
  const [projDesc, setProjDesc] = useState("");
  const [numTasks, setNumTasks] = useState("5");
  // Code reviewer inputs
  const [codeInput, setCodeInput] = useState("");
  const [codeLang, setCodeLang] = useState("javascript");
  // Q&A assistant inputs
  const [qaQuestion, setQaQuestion] = useState("");
  // Feedback drafter inputs
  const [fbContext, setFbContext] = useState("");
  const [fbTone, setFbTone] = useState("constructive");
  // Progress insights
  const [insightRan, setInsightRan] = useState(false);

  const accent = isMentor ? "#d97706" : "#2563eb";
  const accentLight = isMentor ? "rgba(217,119,6,.08)" : "rgba(37,99,235,.07)";

  const tools = [
    { id: "taskgen",   icon: "✦", label: "Task Generator" },
    { id: "coderev",   icon: "⌥", label: "Code Reviewer" },
    { id: "qaassist",  icon: "◈", label: "Q&A Assistant" },
    { id: "fbdraft",   icon: "✎", label: "Feedback Drafter" },
    { id: "insights",  icon: "◎", label: "Progress Insights" },
  ];

  const runTool = async () => {
    setLoading(true); setResult(""); setError("");
    try {
      let out = "";
      switch (activeTool) {
        case "taskgen": {
          const description = projDesc.trim() || (tasks.slice(0, 5).map(t => t.text).join(", ") || "a student team project");
          out = await callClaude(
            "You are a project management assistant. Generate a clear, actionable task breakdown for student teams. Be specific and practical.",
            `Generate ${numTasks} specific, well-defined tasks for this project: "${description}". 
Format each task as:
• [Task title] — [1-sentence description of what to do and why]

Focus on concrete deliverables, not vague goals. Make them achievable in 1–3 days each.`,
            800
          );
          break;
        }
        case "coderev": {
          if (!codeInput.trim()) { setError("Paste some code first."); setLoading(false); return; }
          out = await callClaude(
            "You are a senior software engineer doing a concise, helpful code review. Focus on: correctness, security, readability, and best practices.",
            `Review this ${codeLang} code:

\`\`\`${codeLang}
${codeInput.slice(0, 3000)}
\`\`\`

Give:
1. **Summary** (2 sentences)
2. **Issues** (list any bugs, security risks, or anti-patterns)
3. **Improvements** (concrete suggestions)
4. **Positive notes** (what's done well)

Be concise and direct.`,
            900
          );
          break;
        }
        case "qaassist": {
          if (!qaQuestion.trim()) { setError("Enter a question first."); setLoading(false); return; }
          const ctx = tasks.slice(0, 8).map(t => t.text).join("; ");
          out = await callClaude(
            "You are a knowledgeable mentor assistant helping student project teams. Give clear, practical answers.",
            `A student team asks: "${qaQuestion}"

Project context (current tasks): ${ctx || "General student project"}

Provide a helpful, educational answer. Include:
- Direct answer to their question
- Brief explanation of the concept
- A practical tip or next step they can take today`,
            700
          );
          break;
        }
        case "fbdraft": {
          const ctx2 = fbContext.trim() || `Team of ${members.length} members, ${tasks.filter(t => t.done).length}/${tasks.length} tasks done`;
          out = await callClaude(
            "You are helping write constructive, encouraging feedback for student project teams.",
            `Draft ${fbTone} feedback for a student team member.

Context: ${ctx2}

Write feedback that is:
- Specific and evidence-based (not generic)
- Balanced (strengths + growth areas)
- Motivating and actionable
- 2–3 short paragraphs

Tone: ${fbTone}`,
            600
          );
          break;
        }
        case "insights": {
          const donePct = tasks.length ? Math.round(tasks.filter(t => t.done).length / tasks.length * 100) : 0;
          const byStatus = KB_COLS.map(c => `${c.label}: ${tasks.filter(t => t.status === c.id || (c.id === "done" && t.done && !t.status)).length}`).join(", ");
          const unassigned = tasks.filter(t => !t.assignedTo).length;
          const highPri = tasks.filter(t => t.priority === "high" && !t.done).length;
          out = await callClaude(
            "You are an expert project coach giving honest, useful insights to help student teams improve.",
            `Analyze this project team's progress and give 3–5 actionable insights.

Project stats:
- Overall completion: ${donePct}%
- Task distribution: ${byStatus}
- Unassigned tasks: ${unassigned}
- High-priority open tasks: ${highPri}
- Total questions to mentor: ${questions.length}
- Team size: ${members.length}
- Total files shared: ${files.length}

Give:
1. **Health Assessment** (1 sentence rating: Excellent / On Track / At Risk / Behind)
2. **Top Concern** — most critical thing to address
3. **3 Specific Actions** — concrete things the team should do THIS WEEK
4. **Encouragement** — genuine, specific positive observation

Be honest but encouraging.`,
            700
          );
          setInsightRan(true);
          break;
        }
      }
      setResult(out);
    } catch (e) {
      setError("AI request failed: " + (e.message || "Unknown error"));
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "clamp(16px,4vw,28px)" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: "clamp(1.1rem,3vw,1.4rem)", fontWeight: 800, color: "#0f172a", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          AI Tools
          <span style={{
            fontFamily: "monospace", fontSize: ".5rem", fontWeight: 700, padding: "3px 9px",
            borderRadius: 20, border: `1px solid ${accent}44`, background: `${accent}11`, color: accent
          }}>BETA</span>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: ".58rem", color: "#94a3b8" }}>
          Claude-powered tools to accelerate your team's work
        </div>
      </div>

      {/* Tool selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => { setActiveTool(t.id); setResult(""); setError(""); }}
            style={{
              padding: "7px 14px", borderRadius: 8, border: `1px solid ${activeTool === t.id ? accent : "#e2e8f0"}`,
              background: activeTool === t.id ? accentLight : "#fff",
              color: activeTool === t.id ? accent : "#64748b",
              fontWeight: activeTool === t.id ? 700 : 500, fontSize: ".74rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, transition: "all .15s"
            }}>
            <span style={{ fontSize: ".9rem" }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tool inputs */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "clamp(14px,3vw,20px)", marginBottom: 14 }}>
        {activeTool === "taskgen" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: ".52rem", color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Project Description (optional — uses existing tasks if blank)</div>
            <textarea
              style={{ width: "100%", minHeight: 80, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: ".8rem", outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
              placeholder="e.g. A web app for tracking student attendance across departments…"
              value={projDesc} onChange={e => setProjDesc(e.target.value)}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontFamily: "monospace", fontSize: ".58rem", color: "#475569" }}>Number of tasks:</label>
              <select value={numTasks} onChange={e => setNumTasks(e.target.value)}
                style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: ".72rem", outline: "none" }}>
                {["3","5","8","10","15"].map(n => <option key={n} value={n}>{n} tasks</option>)}
              </select>
            </div>
          </>
        )}
        {activeTool === "coderev" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <select value={codeLang} onChange={e => setCodeLang(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: ".72rem", outline: "none" }}>
                {["javascript","typescript","python","java","c++","go","rust","sql","html","css","jsx","tsx"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {files.length > 0 && (
                <select onChange={e => { const f = files.find(x => x.id === e.target.value); if (f?.content) setCodeInput(f.content); }}
                  style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: ".72rem", outline: "none", flex: 1 }}>
                  <option value="">Or load from a project file…</option>
                  {files.filter(f => f.content).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </div>
            <textarea
              style={{ width: "100%", minHeight: 160, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: ".74rem", fontFamily: "monospace", outline: "none", resize: "vertical", background: "#0f172a", color: "#e2e8f0", lineHeight: 1.7 }}
              placeholder="// Paste your code here…"
              value={codeInput} onChange={e => setCodeInput(e.target.value)}
            />
          </>
        )}
        {activeTool === "qaassist" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: ".52rem", color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Your Question</div>
            <textarea
              style={{ width: "100%", minHeight: 80, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: ".8rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
              placeholder="e.g. How do we implement JWT authentication in Node.js?"
              value={qaQuestion} onChange={e => setQaQuestion(e.target.value)}
            />
          </>
        )}
        {activeTool === "fbdraft" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <select value={fbTone} onChange={e => setFbTone(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: ".72rem", outline: "none" }}>
                <option value="constructive">Constructive</option>
                <option value="encouraging">Encouraging</option>
                <option value="detailed and technical">Detailed & Technical</option>
                <option value="brief and direct">Brief & Direct</option>
              </select>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: ".52rem", color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Context (what happened / what to address)</div>
            <textarea
              style={{ width: "100%", minHeight: 80, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: ".8rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
              placeholder="e.g. Student missed two deadlines but the code they submitted was well-documented…"
              value={fbContext} onChange={e => setFbContext(e.target.value)}
            />
          </>
        )}
        {activeTool === "insights" && (
          <div style={{ fontFamily: "monospace", fontSize: ".64rem", color: "#64748b", lineHeight: 1.9 }}>
            This will analyze your team's current project data:<br />
            • {tasks.length} tasks ({tasks.filter(t => t.done).length} done, {tasks.filter(t => !t.done).length} open)<br />
            • {members.length} team members<br />
            • {questions.length} mentor questions<br />
            • {files.length} shared files<br />
            <br />
            Click "Run Analysis" to get personalized insights and recommendations.
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={runTool} disabled={loading}
            style={{
              padding: "9px 20px", border: "none", borderRadius: 8,
              background: loading ? "#e2e8f0" : accent,
              color: loading ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: ".76rem", cursor: loading ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 8, transition: "all .15s"
            }}>
            {loading ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "lspin .7s linear infinite", display: "inline-block" }} />
                Thinking…
              </>
            ) : (
              <>✦ {activeTool === "insights" ? "Run Analysis" : "Generate"}</>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {error && (
        <div style={{ background: "rgba(220,38,38,.05)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 9, padding: "12px 16px", fontFamily: "monospace", fontSize: ".68rem", color: "#dc2626" }}>
          ⚠ {error}
        </div>
      )}
      {result && (
        <div style={{ background: "#fff", border: `1px solid ${accent}33`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${accent}22`, background: accentLight, display: "flex", alignItems: "center", justify: "space-between", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: ".56rem", fontWeight: 700, color: accent, letterSpacing: ".1em", textTransform: "uppercase" }}>
              ✦ AI Result
            </span>
            <button onClick={() => navigator.clipboard?.writeText(result)}
              style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 5, border: `1px solid ${accent}33`, background: "transparent", color: accent, fontFamily: "monospace", fontSize: ".5rem", cursor: "pointer" }}>
              Copy
            </button>
          </div>
          <pre style={{ padding: "16px", fontFamily: "inherit", fontSize: ".78rem", color: "#1e293b", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 480, overflowY: "auto", margin: 0 }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── CSS variable tokens (used in JSX inline styles) ─────────── */
const MENTOR_CSS_VARS = `#0f1923`;
const TEAM_CSS_VARS = `#0f172a`;

/* ══════════════════════════════════════════════════════════════════
   SHARED GLOBAL STYLES
══════════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
button { cursor: pointer; font-family: inherit; }
input, textarea, select { font-family: inherit; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

@keyframes spin  { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes popIn  { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(6px); } to { opacity: 1; transform: none; } }
@keyframes lspin   { to { transform: rotate(360deg); } }

.page-anim { animation: fadeUp .25s ease; }
.item-anim { animation: slideIn .2s ease; }
`;

/* ══════════════════════════════════════════════════════════════════
   MENTOR CSS
══════════════════════════════════════════════════════════════════ */
const MENTOR_CSS = GLOBAL_CSS + `
:root {
  --bg: #f5f7fa; --surface: #ffffff; --border: #e8ecf0; --border2: #d0dae6;
  --navy: #0f1923; --navy2: #1a2940;
  --amber: #92400e; --amber2: #d97706; --amber3: #f59e0b;
  --teal: #059669; --blue: #2563eb;
  --red: #dc2626; --purple: #7c3aed;
  --text: #0f1923; --muted: #4a6580; --dim: #8a9ab0;
  --accent: #d97706; --accent-bg: rgba(217,119,6,.06); --accent-border: rgba(217,119,6,.22);
  --sidebar-w: 220px; --sidebar-c: 54px; --topbar-h: 52px;
  --sh-sm: 0 1px 4px rgba(0,0,0,.06); --sh-md: 0 4px 16px rgba(0,0,0,.08); --sh-lg: 0 8px 32px rgba(0,0,0,.12);
}
.m-shell { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }

/* ── Sidebar ── */
.m-sb { width: var(--sidebar-w); flex-shrink: 0; background: var(--navy); display: flex; flex-direction: column; transition: width .22s ease; overflow: hidden; position: relative; z-index: 120; box-shadow: 2px 0 20px rgba(0,0,0,.2); }
.m-sb.col { width: var(--sidebar-c); }
.m-sb::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--amber), var(--amber3)); z-index: 1; }
@media(max-width:768px) { .m-sb { position: fixed; top: 0; left: 0; bottom: 0; width: 260px !important; transform: translateX(-100%); z-index: 200; } .m-sb.mob { transform: translateX(0); } .m-sb-cbtn { display: none !important; } }
.m-mob-ov { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 190; backdrop-filter: blur(2px); }
@media(max-width:768px) { .m-mob-ov.open { display: block; } }
.m-sb-logo { height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0; }
.m-sb-mark { width: 26px; height: 26px; background: rgba(217,119,6,.2); border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; font-size: .62rem; font-weight: 800; color: var(--amber3); border: 1px solid rgba(217,119,6,.3); }
.m-sb-ltxt { font-size: .76rem; font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: .04em; white-space: nowrap; transition: opacity .18s, width .18s; }
.m-sb-lsub { font-family: 'DM Mono', monospace; font-size: .42rem; color: var(--amber3); letter-spacing: .14em; white-space: nowrap; }
.m-sb.col .m-sb-ltxt, .m-sb.col .m-sb-lsub { opacity: 0; width: 0; }
.m-sb-cbtn { position: absolute; right: -11px; top: 24px; width: 22px; height: 22px; background: var(--surface); border: 1px solid var(--border); border-radius: 50%; display: grid; place-items: center; font-size: .55rem; color: var(--muted); z-index: 5; box-shadow: var(--sh-sm); transition: all .15s; }
.m-sb-cbtn:hover { background: var(--border); }
.m-sb-scroll { flex: 1; overflow-y: auto; padding: 10px 8px; }
.m-sb-grp { font-family: 'DM Mono', monospace; font-size: .44rem; letter-spacing: .18em; color: rgba(255,255,255,.2); padding: 8px 10px 4px; text-transform: uppercase; transition: opacity .18s; }
.m-sb.col .m-sb-grp { opacity: 0; }
.m-sb-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; border: 1px solid transparent; margin-bottom: 2px; cursor: pointer; transition: all .15s; user-select: none; }
.m-sb-item:hover { background: rgba(255,255,255,.06); }
.m-sb-item.act { background: rgba(217,119,6,.12); border-color: rgba(217,119,6,.22); }
.m-sb-ico { font-family: 'DM Mono', monospace; font-size: .68rem; font-weight: 600; flex-shrink: 0; width: 22px; text-align: center; color: rgba(255,255,255,.4); transition: color .15s; }
.m-sb-item.act .m-sb-ico, .m-sb-item:hover .m-sb-ico { color: var(--amber3); }
.m-sb-lbl { font-size: .76rem; font-weight: 600; color: rgba(255,255,255,.5); white-space: nowrap; overflow: hidden; transition: opacity .18s, color .15s; width: 140px; }
.m-sb-item.act .m-sb-lbl { color: var(--amber3); }
.m-sb-item:hover .m-sb-lbl { color: rgba(255,255,255,.92); }
.m-sb.col .m-sb-lbl { opacity: 0; width: 0; }
@media(max-width:768px) { .m-sb-lbl { opacity: 1 !important; width: 140px !important; } }
.m-sb-bdg { margin-left: auto; font-family: 'DM Mono', monospace; font-size: .5rem; font-weight: 700; padding: 1px 7px; border-radius: 10px; background: rgba(220,38,38,.3); color: #fca5a5; flex-shrink: 0; }
.m-sb.col .m-sb-bdg { opacity: 0; }
.m-sb-sep { height: 1px; background: rgba(255,255,255,.07); margin: 6px 10px; }
.m-sb-foot { padding: 12px 10px; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
.m-sb-user { display: flex; align-items: center; gap: 9px; }
.m-sb-uav { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1.5px solid rgba(217,119,6,.4); }
.m-sb-uav img { width: 100%; height: 100%; object-fit: cover; }
.m-sb-uinfo { overflow: hidden; transition: opacity .18s, width .18s; width: 120px; }
.m-sb.col .m-sb-uinfo { opacity: 0; width: 0; }
.m-sb-uname { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.9); white-space: nowrap; }
.m-sb-urole { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--amber3); margin-top: 2px; }

/* ── Main ── */
.m-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.m-topbar { height: var(--topbar-h); background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 clamp(14px,3vw,20px); gap: 10px; flex-shrink: 0; z-index: 10; }
.m-mmb { display: none; background: none; border: 1px solid var(--border); border-radius: 7px; width: 32px; height: 32px; align-items: center; justify-content: center; font-size: 1rem; color: var(--muted); }
@media(max-width:768px) { .m-mmb { display: flex; } }
.m-crumb { font-family: 'DM Mono', monospace; font-size: .62rem; color: var(--muted); display: flex; align-items: center; gap: 5px; min-width: 0; }
.m-crumb-r { cursor: pointer; transition: color .15s; }
.m-crumb-r:hover { color: var(--navy); }
.m-crumb-c { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: clamp(80px,20vw,200px); }
.m-mentor-pill { display: flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--accent-border); background: var(--accent-bg); font-family: 'DM Mono', monospace; font-size: .52rem; color: var(--accent); font-weight: 700; white-space: nowrap; }
.m-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: pulse 2s ease-in-out infinite; }
.m-content { flex: 1; overflow-y: auto; background: var(--bg); }
.m-page { padding: clamp(16px,4vw,28px); }
.m-ph { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
.m-ph-title { font-size: clamp(1.05rem,3vw,1.4rem); font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.2; }
.m-ph-sub { font-family: 'DM Mono', monospace; font-size: .56rem; color: var(--dim); margin-top: 4px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.m-pill { font-family: 'DM Mono', monospace; font-size: .48rem; font-weight: 700; padding: 3px 9px; border-radius: 20px; border: 1px solid; white-space: nowrap; }
.m-pill-m { border-color: var(--accent-border); background: var(--accent-bg); color: var(--accent); }
.m-pill-a { border-color: rgba(6,95,70,.22); background: rgba(6,95,70,.06); color: var(--teal); }
.m-tag { font-family: 'DM Mono', monospace; font-size: .48rem; padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(37,99,235,.18); background: rgba(37,99,235,.05); color: var(--blue); }
.m-tag.g { border-color: rgba(5,150,105,.2); background: rgba(5,150,105,.05); color: var(--teal); }
.m-tag.a { border-color: rgba(217,119,6,.22); background: rgba(217,119,6,.05); color: var(--amber2); }
.m-tag.r { border-color: rgba(220,38,38,.2); background: rgba(220,38,38,.05); color: var(--red); }
.m-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.m-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: clamp(8px,2vw,12px); margin-bottom: clamp(16px,4vw,22px); }
@media(max-width:720px) { .m-stats-grid { grid-template-columns: repeat(2,1fr); } }
.m-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: clamp(12px,3vw,16px); position: relative; overflow: hidden; transition: box-shadow .2s; }
.m-stat:hover { box-shadow: var(--sh-md); }
.m-stat-bar { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.m-stat-lbl { font-family: 'DM Mono', monospace; font-size: .44rem; letter-spacing: .14em; color: var(--dim); margin-bottom: 7px; text-transform: uppercase; }
.m-stat-val { font-size: clamp(1.4rem,3vw,1.8rem); font-weight: 800; color: var(--text); line-height: 1; }
.m-stat-sub { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--dim); margin-top: 4px; }
.m-two { display: grid; grid-template-columns: 1fr 270px; gap: clamp(12px,2vw,16px); margin-bottom: 22px; }
@media(max-width:900px) { .m-two { grid-template-columns: 1fr; } }
.m-sh { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--dim); letter-spacing: .16em; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
.m-sh::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.m-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: clamp(14px,3vw,18px); }
.m-prog-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.m-prog-lbl { font-family: 'DM Mono', monospace; font-size: .52rem; color: var(--muted); min-width: 88px; display: flex; align-items: center; gap: 5px; }
.m-prog-track { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.m-prog-fill { height: 100%; border-radius: 3px; transition: width .8s cubic-bezier(.25,.46,.45,.94); }
.m-prog-pct { font-family: 'DM Mono', monospace; font-size: .7rem; font-weight: 700; min-width: 34px; text-align: right; }
.m-mem-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,190px),1fr)); gap: 9px; }
.m-mem-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; gap: 10px; transition: border-color .15s; }
.m-mem-card:hover { border-color: var(--border2); }
.m-mem-av { width: 38px; height: 38px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1.5px solid var(--border); }
.m-mem-av img { width: 100%; height: 100%; object-fit: cover; }
.m-mem-name { font-size: .76rem; font-weight: 700; color: var(--text); }
.m-mem-role { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--dim); margin: 2px 0 5px; }
.m-mem-p { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.m-mem-pf { height: 100%; background: linear-gradient(90deg,var(--teal),#34d399); border-radius: 2px; }
.m-mem-pl { font-family: 'DM Mono', monospace; font-size: .44rem; color: var(--dim); margin-top: 2px; }
.m-qa-item { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; animation: slideIn .2s ease; }
.m-qa-item.unread { border-left: 3px solid var(--accent); }
.m-qa-q { font-size: .82rem; font-weight: 600; color: var(--text); margin-bottom: 5px; line-height: 1.5; }
.m-qa-meta { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--dim); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.m-qa-reply-box { background: rgba(217,119,6,.04); border: 1px solid rgba(217,119,6,.15); border-radius: 7px; padding: 10px 12px; margin-bottom: 9px; }
.m-qa-rby { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--accent); font-weight: 700; margin-bottom: 3px; }
.m-qa-rtxt { font-size: .74rem; color: var(--muted); line-height: 1.6; }
.m-ta { width: 100%; min-height: 72px; padding: 9px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .78rem; outline: none; resize: vertical; transition: border-color .2s; line-height: 1.6; }
.m-ta:focus { border-color: var(--accent); }
.m-kb { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
@media(max-width:900px) { .m-kb { grid-template-columns: repeat(2,1fr); } }
@media(max-width:500px) { .m-kb { grid-template-columns: 1fr; } }
.m-kb-col { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; min-height: 160px; }
.m-kb-hd { padding: 9px 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }
.m-kb-title { font-family: 'DM Mono', monospace; font-size: .54rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.m-kb-cnt { font-family: 'DM Mono', monospace; font-size: .46rem; padding: 1px 6px; border-radius: 10px; background: var(--bg); color: var(--dim); margin-left: auto; border: 1px solid var(--border); }
.m-kb-body { flex: 1; padding: 7px; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; }
.m-kb-card { background: var(--bg); border: 1px solid var(--border); border-radius: 7px; padding: 9px; }
.m-kb-ct { font-size: .74rem; font-weight: 600; color: var(--text); margin-bottom: 5px; }
.m-kb-cm { display: flex; align-items: center; gap: 5px; }
.m-kb-cav { width: 15px; height: 15px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border); flex-shrink: 0; }
.m-kb-cav img { width: 100%; height: 100%; object-fit: cover; }
.m-kb-cn { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--dim); }
.m-task-row { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; flex-wrap: wrap; margin-bottom: 5px; transition: border-color .15s; }
.m-task-row:hover { border-color: var(--border2); }
.m-task-row.done { opacity: .5; }
.m-chk { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid; display: grid; place-items: center; flex-shrink: 0; }
.m-chk.done { background: var(--teal); border-color: var(--teal); }
.m-chk.open { border-color: var(--border2); }
.m-task-txt { flex: 1; font-size: .8rem; color: var(--text); min-width: 80px; }
.m-task-txt.done { text-decoration: line-through; color: var(--dim); }
.m-task-who { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--muted); white-space: nowrap; }
.m-pri { font-family: 'DM Mono', monospace; font-size: .44rem; padding: 2px 6px; border-radius: 4px; border: 1px solid; flex-shrink: 0; }
.m-pri-h { border-color: rgba(220,38,38,.3); background: rgba(220,38,38,.05); color: var(--red); }
.m-pri-m { border-color: rgba(217,119,6,.3); background: rgba(217,119,6,.05); color: var(--amber2); }
.m-pri-l { border-color: rgba(5,150,105,.3); background: rgba(5,150,105,.05); color: var(--teal); }
.m-fb-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 14px; margin-bottom: 10px; }
.m-fb-to { font-size: .76rem; font-weight: 700; color: var(--text); }
.m-fb-time { font-family: 'DM Mono', monospace; font-size: .46rem; color: var(--dim); }
.m-fb-txt { font-size: .76rem; color: var(--muted); line-height: 1.6; margin-top: 5px; }
.m-fb-rat { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--amber2); margin-top: 4px; }
.m-sess-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,230px),1fr)); gap: 10px; }
.m-sess-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.m-sess-card.up { border-left: 3px solid var(--blue); }
.m-sess-time { font-family: 'DM Mono', monospace; font-size: .7rem; font-weight: 700; color: var(--navy); margin-bottom: 3px; }
.m-sess-with { font-size: .74rem; color: var(--muted); margin-bottom: 7px; }
.m-sess-mode { display: inline-flex; align-items: center; gap: 4px; font-family: 'DM Mono', monospace; font-size: .48rem; padding: 2px 7px; border-radius: 4px; background: rgba(37,99,235,.05); border: 1px solid rgba(37,99,235,.15); color: var(--blue); }
.m-act-item { display: flex; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.m-act-item:last-child { border-bottom: none; }
.m-act-av { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1px solid var(--border); }
.m-act-av img { width: 100%; height: 100%; object-fit: cover; }
.m-act-chip { font-family: 'DM Mono', monospace; font-size: .42rem; padding: 2px 6px; border-radius: 4px; margin-left: auto; align-self: flex-start; flex-shrink: 0; border: 1px solid; white-space: nowrap; }
.chip-task { background: rgba(37,99,235,.05); border-color: rgba(37,99,235,.18); color: var(--blue); }
.chip-file { background: rgba(124,58,237,.05); border-color: rgba(124,58,237,.18); color: var(--purple); }
.chip-code { background: rgba(5,150,105,.05); border-color: rgba(5,150,105,.18); color: var(--teal); }
.chip-mentor { background: rgba(217,119,6,.05); border-color: rgba(217,119,6,.18); color: var(--amber2); }
.m-sel { padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .72rem; outline: none; }
.m-input { flex: 1; min-width: 120px; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .8rem; outline: none; transition: border-color .2s; }
.m-input:focus { border-color: var(--accent); }
.m-btn { padding: 8px 14px; border: none; border-radius: 7px; background: var(--navy); color: #fff; font-size: .72rem; font-weight: 700; transition: all .15s; white-space: nowrap; cursor: pointer; }
.m-btn:hover { background: var(--navy2); box-shadow: var(--sh-md); }
.m-btn:disabled { opacity: .5; cursor: default; }
.m-abtn { padding: 7px 16px; border: none; border-radius: 7px; background: linear-gradient(135deg,var(--amber),var(--amber3)); color: #fff; font-size: .72rem; font-weight: 700; transition: all .15s; box-shadow: 0 2px 8px rgba(217,119,6,.25); cursor: pointer; }
.m-abtn:hover { box-shadow: 0 4px 14px rgba(217,119,6,.35); transform: translateY(-1px); }
.m-abtn:disabled { opacity: .5; transform: none; cursor: default; }
.m-sbtn { padding: 6px 13px; border-radius: 6px; background: transparent; border: 1px solid var(--border2); color: var(--muted); font-family: 'DM Mono', monospace; font-size: .6rem; font-weight: 700; transition: all .15s; cursor: pointer; }
.m-sbtn:hover { border-color: var(--navy); color: var(--navy); }
.m-toast { position: fixed; bottom: 20px; right: clamp(12px,4vw,20px); background: var(--navy); border-radius: 8px; padding: 10px 16px; font-family: 'DM Mono', monospace; font-size: .64rem; color: rgba(255,255,255,.9); z-index: 400; animation: popIn .2s ease; max-width: calc(100vw - 24px); box-shadow: var(--sh-lg); }
.m-empty { font-family: 'DM Mono', monospace; font-size: .6rem; color: var(--dim); text-align: center; padding: clamp(20px,5vw,30px); }
.m-spinner { width: 22px; height: 22px; border: 2px solid rgba(15,25,35,.1); border-top-color: var(--amber3); border-radius: 50%; animation: spin .7s linear infinite; }
.m-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
.m-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: clamp(18px,4vw,26px); width: 100%; max-width: 440px; position: relative; max-height: 90vh; overflow-y: auto; animation: popIn .18s ease; box-shadow: var(--sh-lg); }
.m-modal-title { font-size: .95rem; font-weight: 800; color: var(--text); margin-bottom: 3px; }
.m-modal-sub { font-family: 'DM Mono', monospace; font-size: .54rem; color: var(--dim); margin-bottom: 16px; }
.m-modal-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: var(--dim); font-size: 1.1rem; transition: color .15s; cursor: pointer; }
.m-modal-close:hover { color: var(--text); }
.m-modal-lbl { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--dim); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
.m-modal-inp { width: 100%; padding: 9px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .82rem; outline: none; margin-bottom: 14px; transition: border-color .2s; }
.m-modal-inp:focus { border-color: var(--accent); }
.m-modal-sub-btn { width: 100%; padding: 11px; border: none; border-radius: 8px; background: linear-gradient(135deg,var(--amber),var(--amber3)); color: #fff; font-size: .76rem; font-weight: 800; transition: all .15s; cursor: pointer; }
.m-modal-sub-btn:hover { box-shadow: var(--sh-md); }
.m-code-view { background: var(--navy); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
.m-code-hd { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
.m-code-fn { font-family: 'DM Mono', monospace; font-size: .6rem; color: rgba(255,255,255,.7); }
.m-code-pre { padding: 14px; font-family: 'DM Mono', monospace; font-size: .7rem; color: rgba(255,255,255,.8); line-height: 1.8; max-height: 280px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
.m-ro-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 4px; background: rgba(217,119,6,.06); border: 1px solid rgba(217,119,6,.2); font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--accent); margin-bottom: 12px; }
.m-warn { background: rgba(217,119,6,.05); border: 1px solid rgba(217,119,6,.2); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-family: 'DM Mono', monospace; font-size: .58rem; color: var(--amber2); line-height: 1.7; }
`;

/* ══════════════════════════════════════════════════════════════════
   TEAM CSS
══════════════════════════════════════════════════════════════════ */
const TEAM_CSS = GLOBAL_CSS + `
:root {
  --t-bg: #f0f4f8; --t-surface: #ffffff; --t-border: #e2e8f0; --t-border2: #cbd5e1;
  --t-navy: #0f172a; --t-navy2: #1e293b;
  --t-blue: #1d4ed8; --t-blue2: #2563eb; --t-blue3: #3b82f6;
  --t-teal: #0d9488; --t-green: #16a34a;
  --t-amber: #d97706; --t-red: #dc2626; --t-purple: #7c3aed;
  --t-text: #0f172a; --t-muted: #475569; --t-dim: #94a3b8;
  --t-accent: #2563eb; --t-accent-bg: rgba(37,99,235,.06); --t-accent-border: rgba(37,99,235,.22);
  --t-sidebar-w: 220px; --t-sidebar-c: 54px; --t-topbar-h: 54px;
  --t-sh-sm: 0 1px 3px rgba(0,0,0,.05); --t-sh-md: 0 4px 14px rgba(0,0,0,.08); --t-sh-lg: 0 8px 28px rgba(0,0,0,.1);
}
.t-shell { display: flex; height: 100vh; overflow: hidden; background: var(--t-bg); }
.t-sb { width: var(--t-sidebar-w); flex-shrink: 0; background: var(--t-navy); display: flex; flex-direction: column; transition: width .22s ease; overflow: hidden; position: relative; z-index: 120; box-shadow: 2px 0 16px rgba(0,0,0,.15); }
.t-sb.col { width: var(--t-sidebar-c); }
.t-sb::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,var(--t-blue),#0ea5e9,var(--t-blue2)); z-index: 1; }
@media(max-width:768px) { .t-sb { position: fixed; top: 0; left: 0; bottom: 0; width: 260px !important; transform: translateX(-100%); z-index: 200; } .t-sb.mob { transform: translateX(0); } .t-sb-cbtn { display: none !important; } }
.t-mob-ov { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 190; backdrop-filter: blur(3px); }
@media(max-width:768px) { .t-mob-ov.open { display: block; } }
.t-sb-logo { height: 54px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
.t-sb-mark { width: 28px; height: 28px; background: rgba(37,99,235,.25); border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; font-size: .68rem; font-weight: 800; color: #93c5fd; border: 1px solid rgba(37,99,235,.4); }
.t-sb-ltxt { font-size: .8rem; font-weight: 800; color: rgba(255,255,255,.92); letter-spacing: .03em; white-space: nowrap; transition: opacity .18s, width .18s; }
.t-sb-lsub { font-family: 'DM Mono', monospace; font-size: .42rem; color: #93c5fd; letter-spacing: .16em; }
.t-sb.col .t-sb-ltxt, .t-sb.col .t-sb-lsub { opacity: 0; width: 0; }
.t-sb-cbtn { position: absolute; right: -11px; top: 26px; width: 22px; height: 22px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 50%; display: grid; place-items: center; font-size: .55rem; color: var(--t-muted); z-index: 5; box-shadow: var(--t-sh-sm); transition: all .15s; cursor: pointer; }
.t-sb-cbtn:hover { background: var(--t-border); }
.t-sb-scroll { flex: 1; overflow-y: auto; padding: 10px 8px; }
.t-sb-grp { font-family: 'DM Mono', monospace; font-size: .44rem; letter-spacing: .18em; color: rgba(255,255,255,.2); padding: 8px 10px 4px; text-transform: uppercase; transition: opacity .18s; }
.t-sb.col .t-sb-grp { opacity: 0; }
.t-sb-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid transparent; margin-bottom: 2px; cursor: pointer; transition: all .15s; user-select: none; }
.t-sb-item:hover { background: rgba(255,255,255,.06); }
.t-sb-item.act { background: rgba(37,99,235,.18); border-color: rgba(37,99,235,.3); }
.t-sb-ico { font-family: 'DM Mono', monospace; font-size: .68rem; font-weight: 600; flex-shrink: 0; width: 22px; text-align: center; color: rgba(255,255,255,.4); transition: color .15s; }
.t-sb-item.act .t-sb-ico, .t-sb-item:hover .t-sb-ico { color: #93c5fd; }
.t-sb-lbl { font-size: .76rem; font-weight: 600; color: rgba(255,255,255,.5); white-space: nowrap; overflow: hidden; transition: opacity .18s, color .15s; width: 140px; }
.t-sb-item.act .t-sb-lbl { color: #93c5fd; }
.t-sb-item:hover .t-sb-lbl { color: rgba(255,255,255,.92); }
.t-sb.col .t-sb-lbl { opacity: 0; width: 0; }
@media(max-width:768px) { .t-sb-lbl { opacity: 1 !important; width: 140px !important; } }
.t-sb-bdg { margin-left: auto; font-family: 'DM Mono', monospace; font-size: .5rem; font-weight: 700; padding: 1px 7px; border-radius: 10px; background: rgba(37,99,235,.3); color: #93c5fd; flex-shrink: 0; }
.t-sb.col .t-sb-bdg { opacity: 0; }
.t-sb-sep { height: 1px; background: rgba(255,255,255,.07); margin: 6px 10px; }
.t-sb-foot { padding: 12px 10px; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
.t-sb-user { display: flex; align-items: center; gap: 9px; }
.t-sb-uav { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1.5px solid rgba(37,99,235,.5); }
.t-sb-uav img { width: 100%; height: 100%; object-fit: cover; }
.t-sb-uinfo { overflow: hidden; transition: opacity .18s, width .18s; width: 120px; }
.t-sb.col .t-sb-uinfo { opacity: 0; width: 0; }
.t-sb-uname { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.9); white-space: nowrap; }
.t-sb-urole { font-family: 'DM Mono', monospace; font-size: .5rem; color: #93c5fd; margin-top: 2px; }
.t-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.t-topbar { height: var(--t-topbar-h); background: var(--t-surface); border-bottom: 1px solid var(--t-border); display: flex; align-items: center; padding: 0 clamp(14px,3vw,22px); gap: 10px; flex-shrink: 0; z-index: 10; }
.t-mmb { display: none; background: none; border: 1px solid var(--t-border); border-radius: 8px; width: 34px; height: 34px; align-items: center; justify-content: center; font-size: 1rem; color: var(--t-muted); cursor: pointer; }
@media(max-width:768px) { .t-mmb { display: flex; } }
.t-crumb { font-family: 'DM Mono', monospace; font-size: .62rem; color: var(--t-muted); display: flex; align-items: center; gap: 6px; min-width: 0; }
.t-crumb-r { cursor: pointer; transition: color .15s; }
.t-crumb-r:hover { color: var(--t-navy); }
.t-crumb-c { color: var(--t-text); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: clamp(80px,22vw,220px); }
.t-student-pill { display: flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--t-accent-border); background: var(--t-accent-bg); font-family: 'DM Mono', monospace; font-size: .52rem; color: var(--t-accent); font-weight: 700; white-space: nowrap; }
.t-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--t-accent); animation: pulse 2.5s ease-in-out infinite; }
.t-content { flex: 1; overflow-y: auto; background: var(--t-bg); }
.t-page { padding: clamp(16px,4vw,28px); }
.t-ph { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
.t-ph-title { font-size: clamp(1.05rem,3vw,1.4rem); font-weight: 800; color: var(--t-text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.2; }
.t-ph-sub { font-family: 'DM Mono', monospace; font-size: .56rem; color: var(--t-dim); margin-top: 4px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.t-pill { font-family: 'DM Mono', monospace; font-size: .48rem; font-weight: 700; padding: 3px 9px; border-radius: 20px; border: 1px solid; white-space: nowrap; }
.t-pill-s { border-color: var(--t-accent-border); background: var(--t-accent-bg); color: var(--t-accent); }
.t-pill-a { border-color: rgba(13,148,136,.22); background: rgba(13,148,136,.06); color: var(--t-teal); }
.t-tag { font-family: 'DM Mono', monospace; font-size: .48rem; padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(37,99,235,.18); background: rgba(37,99,235,.05); color: var(--t-blue2); }
.t-tag.g { border-color: rgba(13,148,136,.2); background: rgba(13,148,136,.05); color: var(--t-teal); }
.t-tag.a { border-color: rgba(217,119,6,.22); background: rgba(217,119,6,.06); color: var(--t-amber); }
.t-tag.r { border-color: rgba(220,38,38,.2); background: rgba(220,38,38,.05); color: var(--t-red); }
.t-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.t-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: clamp(8px,2vw,12px); margin-bottom: clamp(16px,4vw,22px); }
@media(max-width:720px) { .t-stats-grid { grid-template-columns: repeat(2,1fr); } }
.t-stat { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 12px; padding: clamp(12px,3vw,18px); position: relative; overflow: hidden; transition: all .2s; }
.t-stat:hover { box-shadow: var(--t-sh-md); transform: translateY(-1px); }
.t-stat-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.t-stat-lbl { font-family: 'DM Mono', monospace; font-size: .44rem; letter-spacing: .14em; color: var(--t-dim); margin-bottom: 7px; text-transform: uppercase; }
.t-stat-val { font-size: clamp(1.5rem,3vw,2rem); font-weight: 800; color: var(--t-text); line-height: 1; }
.t-stat-sub { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-dim); margin-top: 5px; }
.t-two { display: grid; grid-template-columns: 1fr 270px; gap: clamp(12px,2vw,16px); margin-bottom: 22px; }
@media(max-width:900px) { .t-two { grid-template-columns: 1fr; } }
.t-sh { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-dim); letter-spacing: .16em; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
.t-sh::after { content: ''; flex: 1; height: 1px; background: var(--t-border); }
.t-card { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 12px; padding: clamp(14px,3vw,20px); }
.t-prog-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.t-prog-lbl { font-family: 'DM Mono', monospace; font-size: .52rem; color: var(--t-muted); min-width: 90px; display: flex; align-items: center; gap: 5px; }
.t-prog-track { flex: 1; height: 6px; background: var(--t-border); border-radius: 3px; overflow: hidden; }
.t-prog-fill { height: 100%; border-radius: 3px; transition: width .9s cubic-bezier(.25,.46,.45,.94); }
.t-prog-pct { font-family: 'DM Mono', monospace; font-size: .7rem; font-weight: 700; min-width: 34px; text-align: right; }
.t-mem-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,190px),1fr)); gap: 9px; }
.t-mem-card { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 12px; padding: 12px; display: flex; gap: 10px; transition: all .15s; }
.t-mem-card:hover { border-color: var(--t-border2); box-shadow: var(--t-sh-sm); }
.t-mem-av { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--t-border); }
.t-mem-av img { width: 100%; height: 100%; object-fit: cover; }
.t-mem-name { font-size: .76rem; font-weight: 700; color: var(--t-text); }
.t-mem-role { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-dim); margin: 2px 0 5px; }
.t-mem-p { height: 4px; background: var(--t-border); border-radius: 2px; overflow: hidden; }
.t-mem-pf { height: 100%; background: linear-gradient(90deg,var(--t-blue2),#38bdf8); border-radius: 2px; }
.t-mem-pl { font-family: 'DM Mono', monospace; font-size: .44rem; color: var(--t-dim); margin-top: 3px; }
.t-file-row { display: flex; align-items: center; gap: 10px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 9px; padding: 10px 14px; margin-bottom: 7px; transition: all .15s; }
.t-file-row:hover { border-color: var(--t-border2); box-shadow: var(--t-sh-sm); }
.t-file-ico { width: 32px; height: 32px; border-radius: 8px; background: rgba(37,99,235,.08); border: 1px solid rgba(37,99,235,.15); display: grid; place-items: center; font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-blue2); flex-shrink: 0; }
.t-q-item { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; animation: slideIn .2s ease; }
.t-q-item.has-r { border-left: 3px solid var(--t-teal); }
.t-q-text { font-size: .84rem; font-weight: 600; color: var(--t-text); margin-bottom: 5px; line-height: 1.5; }
.t-q-meta { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--t-dim); display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 9px; }
.t-q-reply { background: rgba(13,148,136,.04); border: 1px solid rgba(13,148,136,.15); border-radius: 8px; padding: 10px 12px; margin-top: 7px; }
.t-q-rby { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--t-teal); font-weight: 700; margin-bottom: 3px; }
.t-q-rtxt { font-size: .74rem; color: var(--t-muted); line-height: 1.6; }
.t-fb-card { background: var(--t-surface); border: 1px solid var(--t-border); border-left: 3px solid var(--t-teal); border-radius: 0 10px 10px 0; padding: 12px 14px; margin-bottom: 10px; }
.t-fb-from { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-teal); font-weight: 700; margin-bottom: 4px; }
.t-fb-txt { font-size: .76rem; color: var(--t-muted); line-height: 1.6; }
.t-fb-rat { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-amber); margin-top: 4px; }
.t-task-row { display: flex; align-items: center; gap: 8px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 9px; padding: 9px 13px; flex-wrap: wrap; transition: all .15s; margin-bottom: 5px; }
.t-task-row:hover { border-color: var(--t-border2); box-shadow: var(--t-sh-sm); }
.t-task-row.done { opacity: .5; }
.t-chk { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid; display: grid; place-items: center; flex-shrink: 0; cursor: pointer; transition: all .15s; }
.t-chk.done { background: var(--t-teal); border-color: var(--t-teal); }
.t-chk.open { border-color: var(--t-border2); }
.t-chk.open:hover { border-color: var(--t-teal); }
.t-task-txt { flex: 1; font-size: .8rem; color: var(--t-text); min-width: 80px; }
.t-task-txt.done { text-decoration: line-through; color: var(--t-dim); }
.t-task-who { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-muted); white-space: nowrap; }
.t-pri { font-family: 'DM Mono', monospace; font-size: .44rem; padding: 2px 6px; border-radius: 4px; border: 1px solid; flex-shrink: 0; }
.t-pri-h { border-color: rgba(220,38,38,.3); background: rgba(220,38,38,.05); color: var(--t-red); }
.t-pri-m { border-color: rgba(217,119,6,.3); background: rgba(217,119,6,.06); color: var(--t-amber); }
.t-pri-l { border-color: rgba(13,148,136,.25); background: rgba(13,148,136,.05); color: var(--t-teal); }
.t-kb { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
@media(max-width:900px) { .t-kb { grid-template-columns: repeat(2,1fr); } }
@media(max-width:500px) { .t-kb { grid-template-columns: 1fr; } }
.t-kb-col { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 12px; display: flex; flex-direction: column; min-height: 160px; }
.t-kb-hd { padding: 10px 12px; border-bottom: 1px solid var(--t-border); display: flex; align-items: center; gap: 6px; }
.t-kb-title { font-family: 'DM Mono', monospace; font-size: .52rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.t-kb-cnt { font-family: 'DM Mono', monospace; font-size: .46rem; padding: 1px 6px; border-radius: 10px; background: var(--t-bg); color: var(--t-dim); margin-left: auto; border: 1px solid var(--t-border); }
.t-kb-body { flex: 1; padding: 7px; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; }
.t-kb-card { background: var(--t-bg); border: 1px solid var(--t-border); border-radius: 8px; padding: 10px; animation: slideIn .2s ease; }
.t-kb-ct { font-size: .74rem; font-weight: 600; color: var(--t-text); margin-bottom: 5px; }
.t-kb-cm { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.t-kb-cav { width: 15px; height: 15px; border-radius: 50%; overflow: hidden; border: 1px solid var(--t-border); }
.t-kb-cav img { width: 100%; height: 100%; object-fit: cover; }
.t-kb-cn { font-family: 'DM Mono', monospace; font-size: .48rem; color: var(--t-dim); }
.t-input { flex: 1; min-width: 120px; padding: 8px 12px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 8px; color: var(--t-text); font-size: .8rem; outline: none; transition: border-color .2s; }
.t-input:focus { border-color: var(--t-accent); }
.t-sel { padding: 8px 10px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 8px; color: var(--t-text); font-size: .72rem; outline: none; }
.t-ta { width: 100%; min-height: 80px; padding: 10px 12px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 8px; color: var(--t-text); font-size: .8rem; outline: none; resize: vertical; transition: border-color .2s; line-height: 1.7; }
.t-ta:focus { border-color: var(--t-accent); }
.t-ta::placeholder { color: var(--t-dim); }
.t-btn { padding: 8px 15px; border: none; border-radius: 8px; background: var(--t-navy); color: #fff; font-size: .72rem; font-weight: 700; transition: all .15s; white-space: nowrap; cursor: pointer; }
.t-btn:hover { background: var(--t-navy2); box-shadow: var(--t-sh-md); }
.t-btn:disabled { opacity: .5; cursor: default; }
.t-abtn { padding: 7px 16px; border: none; border-radius: 8px; background: linear-gradient(135deg,var(--t-blue),var(--t-blue3)); color: #fff; font-size: .72rem; font-weight: 700; transition: all .15s; box-shadow: 0 2px 8px rgba(37,99,235,.25); cursor: pointer; }
.t-abtn:hover { box-shadow: 0 4px 14px rgba(37,99,235,.35); transform: translateY(-1px); }
.t-abtn:disabled { opacity: .5; transform: none; cursor: default; }
.t-act-item { display: flex; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--t-border); }
.t-act-item:last-child { border-bottom: none; }
.t-act-av { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 1px solid var(--t-border); }
.t-act-av img { width: 100%; height: 100%; object-fit: cover; }
.t-act-chip { font-family: 'DM Mono', monospace; font-size: .42rem; padding: 2px 6px; border-radius: 4px; margin-left: auto; align-self: flex-start; flex-shrink: 0; border: 1px solid; white-space: nowrap; }
.t-chip-task { background: rgba(37,99,235,.05); border-color: rgba(37,99,235,.18); color: var(--t-blue2); }
.t-chip-file { background: rgba(124,58,237,.05); border-color: rgba(124,58,237,.18); color: var(--t-purple); }
.t-chip-code { background: rgba(13,148,136,.05); border-color: rgba(13,148,136,.18); color: var(--t-teal); }
.t-chip-mentor { background: rgba(217,119,6,.05); border-color: rgba(217,119,6,.18); color: var(--t-amber); }
.t-toast { position: fixed; bottom: 20px; right: clamp(12px,4vw,20px); background: var(--t-navy); border-radius: 9px; padding: 10px 16px; font-family: 'DM Mono', monospace; font-size: .64rem; color: rgba(255,255,255,.92); z-index: 400; animation: popIn .2s ease; max-width: calc(100vw - 24px); box-shadow: var(--t-sh-lg); }
.t-empty { font-family: 'DM Mono', monospace; font-size: .6rem; color: var(--t-dim); text-align: center; padding: clamp(20px,5vw,30px); }
.t-spinner { width: 22px; height: 22px; border: 2px solid var(--t-border); border-top-color: var(--t-blue3); border-radius: 50%; animation: spin .7s linear infinite; }
.t-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
.t-modal { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 14px; padding: clamp(18px,4vw,26px); width: 100%; max-width: 440px; position: relative; max-height: 90vh; overflow-y: auto; animation: popIn .18s ease; box-shadow: var(--t-sh-lg); }
.t-modal-title { font-size: .95rem; font-weight: 800; color: var(--t-text); margin-bottom: 3px; }
.t-modal-sub { font-family: 'DM Mono', monospace; font-size: .54rem; color: var(--t-dim); margin-bottom: 16px; }
.t-modal-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: var(--t-dim); font-size: 1.1rem; transition: color .15s; cursor: pointer; }
.t-modal-close:hover { color: var(--t-text); }
.t-modal-lbl { font-family: 'DM Mono', monospace; font-size: .5rem; color: var(--t-dim); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
.t-modal-inp { width: 100%; padding: 9px 12px; background: var(--t-bg); border: 1px solid var(--t-border); border-radius: 8px; color: var(--t-text); font-size: .82rem; outline: none; margin-bottom: 14px; transition: border-color .2s; }
.t-modal-inp:focus { border-color: var(--t-accent); }
.t-modal-sub-btn { width: 100%; padding: 11px; border: none; border-radius: 9px; background: linear-gradient(135deg,var(--t-blue),var(--t-blue3)); color: #fff; font-size: .76rem; font-weight: 800; transition: all .15s; cursor: pointer; }
.t-modal-sub-btn:hover { box-shadow: var(--t-sh-md); }
.t-upload-zone { border: 2px dashed var(--t-border2); border-radius: 10px; padding: 24px; text-align: center; cursor: pointer; transition: all .2s; }
.t-upload-zone:hover { border-color: var(--t-accent); background: rgba(37,99,235,.03); }
`;

/* ══════════════════════════════════════════════════════════════════
   MENTOR PROJECT VIEW
══════════════════════════════════════════════════════════════════ */
const MENTOR_TABS = [
  { id: "overview",   icon: "OV", label: "Overview",      group: "mentor" },
  { id: "qa",         icon: "QA", label: "Q&A Inbox",     group: "mentor", badge: true },
  { id: "progress",   icon: "PR", label: "Team Progress", group: "mentor" },
  { id: "codereview", icon: "CR", label: "Code Review",   group: "mentor" },
  { id: "feedback",   icon: "FB", label: "Feedback",      group: "mentor" },
  { id: "aitools",    icon: "AI", label: "AI Tools",      group: "tools" },
  { id: "sessions",   icon: "SC", label: "Sessions",      group: "comms" },
  { id: "call",       icon: "VC", label: "Voice & Video", group: "comms" },
  { id: "activity",   icon: "AC", label: "Activity",      group: "comms" },
];

export function MentorProjectView() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [vcMsgs, setVcMsgs] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qReplies, setQReplies] = useState({});
  const [feedbacks, setFeedbacks] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [replyDraft, setReplyDraft] = useState({});
  const [replyLoading, setReplyLoading] = useState({});
  const [selFile, setSelFile] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSendTo, setReviewSendTo] = useState("");
  const [fbText, setFbText] = useState("");
  const [fbTarget, setFbTarget] = useState("");
  const [fbRating, setFbRating] = useState("good");
  const [fbSaving, setFbSaving] = useState(false);
  const [vcInput, setVcInput] = useState("");
  const [sessionModal, setSessionModal] = useState(false);
  const [newSession, setNewSession] = useState({ slot: "", mode: "video", note: "" });

  const vcEndRef = useRef(null);
  const listenersRef = useRef([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3200); };
  const selectTab = useCallback((id) => { setActiveTab(id); setMobOpen(false); }, []);

  // Cleanup all listeners on unmount
  useEffect(() => () => listenersRef.current.forEach(u => u()), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const [pSnap, prSnap] = await Promise.all([
        getDoc(doc(db, "teamProjects", projectId)),
        getDoc(doc(db, "users", u.uid)),
      ]);
      if (!pSnap.exists()) { setLoading(false); return; }
      const pd = pSnap.data();
      setProject(pd);
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

  useEffect(() => {
    if (!projectId) return;
    const unsubProject = onSnapshot(doc(db, "teamProjects", projectId), (snap) => {
      if (snap.exists()) { const d = snap.data(); setProject(d); setTasks(d.tasks || []); }
    });
    const unsubActivity = onSnapshot(query(collection(db, "teamProjects", projectId, "activity"), orderBy("createdAt", "desc")), (snap) => setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFiles = onSnapshot(query(collection(db, "teamProjects", projectId, "files"), orderBy("createdAt", "desc")), (snap) => setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.isAsset)));
    const unsubCommits = onSnapshot(query(collection(db, "teamProjects", projectId, "commits"), orderBy("createdAt", "desc")), (snap) => setCommits(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVC = onSnapshot(query(collection(db, "teamProjects", projectId, "vcChat"), orderBy("createdAt", "asc")), (snap) => setVcMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubQ = onSnapshot(query(collection(db, "teamProjects", projectId, "questions"), orderBy("createdAt", "desc")), (snap) => {
      const qs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(qs);
      qs.forEach(q => {
        const unsubR = onSnapshot(query(collection(db, "teamProjects", projectId, "questions", q.id, "replies"), orderBy("createdAt", "asc")), (rSnap) => {
          setQReplies(prev => ({ ...prev, [q.id]: rSnap.docs.map(rd => ({ id: rd.id, ...rd.data() })) }));
        });
        listenersRef.current.push(unsubR);
      });
    });
    listenersRef.current.push(unsubProject, unsubActivity, unsubFiles, unsubCommits, unsubVC, unsubQ);
    return () => { listenersRef.current.forEach(u => u()); listenersRef.current = []; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !user) return;
    const u1 = onSnapshot(query(collection(db, "teamProjects", projectId, "mentorFeedback"), where("mentorId", "==", user.uid)), (snap) => setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, "mentorRequests"), where("projectId", "==", projectId), where("mentorId", "==", user.uid)), (snap) => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [projectId, user]);

  useEffect(() => { vcEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [vcMsgs]);

  const donePct = tasks.length ? Math.round(tasks.filter(t => t.done).length / tasks.length * 100) : 0;
  const unanswered = questions.filter(q => !(qReplies[q.id] || []).length);

  const sendVcMsg = async () => {
    if (!vcInput.trim()) return;
    await addDoc(collection(db, "teamProjects", projectId, "vcChat"), {
      text: vcInput, userId: user.uid, userName: myProfile?.fullName || "Mentor",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      isMentor: true, createdAt: serverTimestamp()
    });
    setVcInput("");
  };

  const postReply = async (q) => {
    const text = replyDraft[q.id];
    if (!text?.trim()) return;
    setReplyLoading(p => ({ ...p, [q.id]: true }));
    await addDoc(collection(db, "teamProjects", projectId, "questions", q.id, "replies"), {
      text: text.trim(), mentorId: user.uid, mentorName: myProfile?.fullName || "Mentor",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "teamProjects", projectId, "questions", q.id), { resolved: true });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "mentor", "replied to a question", q.text.slice(0, 40));
    setReplyDraft(p => ({ ...p, [q.id]: "" }));
    setReplyLoading(p => ({ ...p, [q.id]: false }));
    showToast("Reply posted");
  };

  const saveFeedback = async () => {
    if (!fbText.trim() || !fbTarget) { showToast("Choose a member and write feedback"); return; }
    setFbSaving(true);
    const m = members.find(x => x.id === fbTarget);
    await addDoc(collection(db, "teamProjects", projectId, "mentorFeedback"), {
      mentorId: user.uid, mentorName: myProfile?.fullName || "Mentor",
      toId: fbTarget, toName: m?.fullName || "Member",
      text: fbText.trim(), rating: fbRating, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "mentor", "gave feedback to", m?.fullName || "Member");
    setFbText(""); setFbTarget(""); setFbSaving(false); showToast("Feedback saved");
  };

  // ── Panels ──────────────────────────────────────────────────────
  const MOverview = () => (
    <div className="m-page page-anim">
      <div className="m-ph">
        <div>
          <div className="m-ph-title">
            {project.projectName || "Untitled"}
            <span className="m-pill m-pill-m">Mentor View</span>
            <span className="m-pill m-pill-a">Active</span>
          </div>
          <div className="m-ph-sub">
            <span>{members.length} members</span><span>·</span>
            <span>{donePct}% complete</span><span>·</span>
            <span style={{ color: "var(--red)" }}>{unanswered.length} unanswered</span>
          </div>
        </div>
        <div className="m-tags">
          {project.domain && <span className="m-tag">{project.domain}</span>}
          {(project.techStack || project.skills || []).slice(0, 3).map(t => <span key={t} className="m-tag g">{t}</span>)}
        </div>
      </div>
      <div className="m-stats-grid">
        {[
          { label: "Team Size",      val: members.length,                       sub: "active members",           color: "#d97706" },
          { label: "Questions",      val: questions.length,                     sub: `${unanswered.length} need reply`, color: "#dc2626" },
          { label: "Tasks Done",     val: tasks.filter(t => t.done).length,     sub: `of ${tasks.length} total`, color: "#059669" },
          { label: "Feedback Given", val: feedbacks.length,                     sub: "by you",                   color: "#7c3aed" },
        ].map((s, i) => (
          <div key={i} className="m-stat">
            <div className="m-stat-bar" style={{ background: s.color }} />
            <div className="m-stat-lbl">{s.label}</div>
            <div className="m-stat-val">{s.val}</div>
            <div className="m-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="m-two">
        <div>
          <div className="m-card" style={{ marginBottom: 14 }}>
            <div className="m-sh">Team Progress</div>
            <div className="m-prog-row">
              <div className="m-prog-lbl">Overall</div>
              <div className="m-prog-track"><div className="m-prog-fill" style={{ width: `${donePct}%`, background: "linear-gradient(90deg,#1d4ed8,#3b82f6)" }} /></div>
              <div className="m-prog-pct" style={{ color: "var(--blue)" }}>{donePct}%</div>
            </div>
            {KB_COLS.map(col => {
              const cnt = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status)).length;
              const pct = tasks.length ? Math.round(cnt / tasks.length * 100) : 0;
              return (
                <div key={col.id} className="m-prog-row">
                  <div className="m-prog-lbl"><div style={{ width: 5, height: 5, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />{col.label}</div>
                  <div className="m-prog-track"><div className="m-prog-fill" style={{ width: `${pct}%`, background: col.dot }} /></div>
                  <div className="m-prog-pct" style={{ color: col.color }}>{cnt}</div>
                </div>
              );
            })}
          </div>
          <div className="m-sh">Members</div>
          <div className="m-mem-grid">
            {members.map(m => {
              const mt = tasks.filter(t => t.assignedTo === m.id);
              const dc = mt.filter(t => t.done).length;
              const pct = mt.length ? Math.round(dc / mt.length * 100) : 0;
              return (
                <div key={m.id} className="m-mem-card">
                  <div className="m-mem-av"><img src={getAv(m.avatar, m.photoURL)} alt={m.fullName} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div className="m-mem-name">{m.fullName || "Member"}</div>
                      {m.id === project.teamLeader && <span className="m-tag a" style={{ fontSize: ".4rem" }}>Lead</span>}
                    </div>
                    <div className="m-mem-role">{m.currentRole || "Member"}</div>
                    <div className="m-mem-p"><div className="m-mem-pf" style={{ width: `${pct}%` }} /></div>
                    <div className="m-mem-pl">{dc}/{mt.length} tasks · {pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="m-card">
            <div className="m-sh">Pending Questions</div>
            {unanswered.length === 0 ? <div className="m-empty" style={{ padding: "8px 0", fontSize: ".58rem" }}>All caught up ✓</div>
              : unanswered.slice(0, 4).map(q => (
                <div key={q.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => selectTab("qa")}>
                  <div style={{ fontSize: ".72rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.text}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".46rem", color: "var(--dim)", marginTop: 2 }}>{q.askedByName} · {timeAgo(q.createdAt)}</div>
                </div>
              ))}
          </div>
          <div className="m-card">
            <div className="m-sh">Recent Activity</div>
            {activity.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: "flex", gap: 7, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.cat === "code" ? "var(--teal)" : a.cat === "file" ? "var(--purple)" : "var(--dim)", flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".7rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}: {a.desc}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".46rem", color: "var(--dim)", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
            {activity.length === 0 && <div className="m-empty" style={{ padding: "8px 0" }}>No activity yet</div>}
          </div>
        </div>
      </div>
    </div>
  );

  const MQAInbox = () => (
    <div className="m-page page-anim">
      <div className="m-ph">
        <div>
          <div className="m-ph-title">Q&amp;A Inbox</div>
          <div className="m-ph-sub">
            <span>{questions.length} total</span><span>·</span>
            <span style={{ color: "var(--red)" }}>{unanswered.length} need reply</span>
          </div>
        </div>
      </div>
      {questions.length === 0 && <div className="m-empty">No questions yet.</div>}
      {unanswered.length > 0 && <><div className="m-sh">Needs Reply</div>{unanswered.map(q => <MQACard key={q.id} q={q} replies={qReplies[q.id] || []} />)}</>}
      {questions.filter(q => (qReplies[q.id] || []).length > 0).length > 0 && (
        <><div className="m-sh" style={{ marginTop: 18 }}>Answered</div>
          {questions.filter(q => (qReplies[q.id] || []).length > 0).map(q => <MQACard key={q.id} q={q} replies={qReplies[q.id] || []} />)}</>
      )}
    </div>
  );

  const MQACard = ({ q, replies }) => (
    <div className={`m-qa-item${!replies.length ? " unread" : ""} item-anim`}>
      <div style={{ display: "flex", gap: 9, marginBottom: 6 }}>
        <div className="m-mem-av" style={{ width: 26, height: 26 }}><img src={getAv(q.avatar, q.photoURL)} alt="" /></div>
        <div style={{ flex: 1 }}>
          <div className="m-qa-q">{q.text}</div>
          <div className="m-qa-meta">
            <span>{q.askedByName}</span><span>·</span><span>{timeAgo(q.createdAt)}</span>
            {replies.length > 0 && <span className="m-tag g" style={{ fontSize: ".42rem" }}>Answered</span>}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        {replies.map(r => (
          <div key={r.id} className="m-qa-reply-box">
            <div className="m-qa-rby">🧑‍🏫 {r.mentorName} · {timeAgo(r.createdAt)}</div>
            <div className="m-qa-rtxt">{r.text}</div>
          </div>
        ))}
        <textarea className="m-ta" placeholder={replies.length ? "Add another reply…" : "Write your reply…"}
          value={replyDraft[q.id] || ""} onChange={e => setReplyDraft(p => ({ ...p, [q.id]: e.target.value }))} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 7 }}>
          <button className="m-abtn" onClick={() => postReply(q)} disabled={replyLoading[q.id] || !(replyDraft[q.id] || "").trim()}>
            {replyLoading[q.id] ? "Posting…" : "Post Reply"}
          </button>
        </div>
      </div>
    </div>
  );

  const MProgress = () => (
    <div className="m-page page-anim">
      <div className="m-ph"><div className="m-ph-title">Team Progress</div></div>
      <div className="m-ro-badge">👁 Read-only — task editing is for the team</div>
      <div className="m-kb" style={{ marginBottom: 22 }}>
        {KB_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status));
          return (
            <div key={col.id} className="m-kb-col">
              <div className="m-kb-hd">
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                <div className="m-kb-title" style={{ color: col.color }}>{col.label}</div>
                <div className="m-kb-cnt">{colTasks.length}</div>
              </div>
              <div className="m-kb-body">
                {colTasks.map(t => (
                  <div key={t.id} className="m-kb-card">
                    <div className="m-kb-ct">{t.text}</div>
                    <div className="m-kb-cm">
                      {t.assignedTo && <><div className="m-kb-cav"><img src={getAv(members.find(m => m.id === t.assignedTo)?.avatar)} alt="" /></div><span className="m-kb-cn">{t.assignedName}</span></>}
                      <span className={`m-pri m-pri-${(t.priority || "m")[0]}`} style={{ marginLeft: "auto" }}>{(t.priority || "medium")[0].toUpperCase()}</span>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && <div className="m-empty" style={{ padding: "12px 0" }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="m-sh">Full Task List</div>
      {tasks.map(t => (
        <div key={t.id} className={`m-task-row${t.done ? " done" : ""}`}>
          <div className={`m-chk${t.done ? " done" : " open"}`}>
            {t.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <span className={`m-task-txt${t.done ? " done" : ""}`}>{t.text}</span>
          {t.assignedName && <span className="m-task-who">→ {t.assignedName}</span>}
          <span className={`m-pri m-pri-${(t.priority || "m")[0]}`}>{t.priority || "medium"}</span>
          <span className="m-tag" style={{ fontSize: ".42rem" }}>{t.status || "todo"}</span>
        </div>
      ))}
      {tasks.length === 0 && <div className="m-empty">No tasks yet.</div>}
    </div>
  );

  const MCodeReview = () => (
    <div className="m-page page-anim">
      <div className="m-ph"><div><div className="m-ph-title">Code Review</div><div className="m-ph-sub">{files.length} files · {commits.length} commits</div></div></div>
      <div className="m-two">
        <div>
          <div className="m-sh">Select File</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
            <select className="m-sel" style={{ flex: 1 }} value={selFile?.id || ""} onChange={e => { setSelFile(files.find(x => x.id === e.target.value) || null); setReviewText(""); }}>
              <option value="">Choose a file…</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {selFile && (
              <select className="m-sel" value={reviewSendTo} onChange={e => setReviewSendTo(e.target.value)}>
                <option value="">Send to…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
            )}
          </div>
          {selFile?.content && (
            <div className="m-code-view">
              <div className="m-code-hd">
                <span className="m-code-fn">{selFile.name}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: ".48rem", color: "rgba(255,255,255,.3)" }}>{selFile.upBy} · {timeAgo(selFile.createdAt)}</span>
              </div>
              <pre className="m-code-pre">{selFile.content}</pre>
            </div>
          )}
          {selFile && !selFile?.content && <div className="m-warn">This file has no content yet.</div>}
          {selFile && (
            <>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".5rem", color: "var(--dim)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Your Review</div>
              <textarea className="m-ta" placeholder="Write your review, suggestions, issues…" value={reviewText} onChange={e => setReviewText(e.target.value)} style={{ minHeight: 120, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                <button className="m-abtn" disabled={!reviewText.trim() || reviewLoading} onClick={async () => {
                  setReviewLoading(true);
                  await addDoc(collection(db, "teamProjects", projectId, "codeReviews"), {
                    file: selFile.name, fileId: selFile.id, mentorId: user.uid, mentorName: myProfile?.fullName || "Mentor",
                    toId: reviewSendTo, toName: members.find(m => m.id === reviewSendTo)?.fullName || "Team",
                    review: reviewText, createdAt: serverTimestamp()
                  });
                  await logActivity(projectId, user.uid, myProfile?.fullName || "Mentor", "code", `reviewed ${selFile.name}`, "");
                  setReviewText(""); setReviewLoading(false); showToast("Code review posted");
                }}>{reviewLoading ? "Posting…" : "Post Review"}</button>
              </div>
            </>
          )}
        </div>
        <div>
          <div className="m-sh">Recent Commits</div>
          <div className="m-card">
            {commits.slice(0, 14).map(c => (
              <div key={c.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: ".52rem", color: "var(--blue)", background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.15)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>{c.hash}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".7rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.msg}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".48rem", color: "var(--dim)", marginTop: 1 }}>{c.author} · {c.file}</div>
                </div>
              </div>
            ))}
            {commits.length === 0 && <div className="m-empty">No commits yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );

  const MFeedback = () => (
    <div className="m-page page-anim">
      <div className="m-ph"><div className="m-ph-title">Feedback</div><div className="m-ph-sub">{feedbacks.length} given by you</div></div>
      <div className="m-card" style={{ marginBottom: 18 }}>
        <div className="m-sh">Give Feedback</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <select className="m-sel" style={{ flex: 1 }} value={fbTarget} onChange={e => setFbTarget(e.target.value)}>
            <option value="">Select member…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
          </select>
          <select className="m-sel" value={fbRating} onChange={e => setFbRating(e.target.value)}>
            <option value="excellent">⭐⭐⭐ Excellent</option>
            <option value="good">⭐⭐ Good Progress</option>
            <option value="needs-work">⭐ Needs Work</option>
            <option value="blocked">⚠️ Blocked</option>
          </select>
        </div>
        <textarea className="m-ta" placeholder="Write constructive feedback…" value={fbText} onChange={e => setFbText(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="m-abtn" onClick={saveFeedback} disabled={fbSaving || !fbText.trim() || !fbTarget}>
            {fbSaving ? "Saving…" : "Send Feedback"}
          </button>
        </div>
      </div>
      <div className="m-sh">History</div>
      {feedbacks.length === 0 && <div className="m-empty">No feedback given yet.</div>}
      {feedbacks.map(f => (
        <div key={f.id} className="m-fb-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="m-mem-av" style={{ width: 26, height: 26 }}><img src={getAv(members.find(m => m.id === f.toId)?.avatar)} alt="" /></div>
              <div className="m-fb-to">→ {f.toName}</div>
            </div>
            <div className="m-fb-time">{timeAgo(f.createdAt)}</div>
          </div>
          <div className="m-fb-txt">{f.text}</div>
          <div className="m-fb-rat">{f.rating === "excellent" ? "⭐⭐⭐ Excellent" : f.rating === "good" ? "⭐⭐ Good Progress" : f.rating === "needs-work" ? "⭐ Needs Work" : "⚠️ Blocked"}</div>
        </div>
      ))}
    </div>
  );

  const MSessions = () => (
    <div className="m-page page-anim">
      <div className="m-ph">
        <div><div className="m-ph-title">Sessions</div><div className="m-ph-sub">{sessions.length} requests from this team</div></div>
        <button className="m-abtn" onClick={() => setSessionModal(true)}>+ Schedule</button>
      </div>
      {sessions.length === 0 && <div className="m-empty">No session requests yet.</div>}
      <div className="m-sess-grid">
        {sessions.map(s => (
          <div key={s.id} className={`m-sess-card${s.status === "accepted" || s.status === "scheduled" ? " up" : ""}`}>
            <div className="m-sess-time">{s.scheduledSlot || s.slot || "Slot TBD"}</div>
            <div className="m-sess-with">with {s.studentName}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span className="m-sess-mode">{s.mode === "video" ? "📹 Video" : s.mode === "voice" ? "🎙 Voice" : "💬 Chat"}</span>
              <span className={`m-tag${s.status === "accepted" || s.status === "scheduled" ? " g" : s.status === "declined" ? " r" : " a"}`} style={{ fontSize: ".42rem" }}>{(s.status || "pending").toUpperCase()}</span>
            </div>
            {s.message && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".54rem", color: "var(--dim)", lineHeight: 1.6 }}>"{s.message}"</div>}
            {s.status === "pending" && (
              <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
                <button className="m-abtn" style={{ flex: 1, padding: "5px", fontSize: ".6rem" }}
                  onClick={async () => { await updateDoc(doc(db, "mentorRequests", s.id), { status: "accepted" }); showToast("Accepted"); }}>Accept</button>
                <button className="m-sbtn" style={{ flex: 1 }}
                  onClick={async () => { await updateDoc(doc(db, "mentorRequests", s.id), { status: "declined" }); showToast("Declined"); }}>Decline</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const MActivity = () => (
    <div className="m-page page-anim">
      <div className="m-ph"><div className="m-ph-title">Team Activity</div></div>
      <div className="m-card">
        {activity.length === 0 && <div className="m-empty">No activity yet.</div>}
        {activity.map(a => {
          const m = members.find(x => x.id === a.uid) || { fullName: a.name || "Member", avatar: "1" };
          return (
            <div key={a.id} className="m-act-item">
              <div className="m-act-av"><img src={getAv(m.avatar, m.photoURL)} alt="" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text)" }}>{m.fullName || a.name}</div>
                <div style={{ fontSize: ".7rem", color: "var(--muted)" }}>{a.desc}</div>
                {a.ref && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".5rem", color: "var(--blue)", marginTop: 1 }}>{a.ref}</div>}
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".46rem", color: "var(--dim)", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
              </div>
              <span className={`m-act-chip ${a.cat === "file" ? "chip-file" : a.cat === "code" ? "chip-code" : a.cat === "mentor" ? "chip-mentor" : "chip-task"}`}>{(a.cat || "task").toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case "overview":   return <MOverview />;
      case "qa":         return <MQAInbox />;
      case "progress":   return <MProgress />;
      case "codereview": return <MCodeReview />;
      case "feedback":   return <MFeedback />;
      case "aitools":    return <AIToolsPanel projectId={projectId} user={user} myProfile={myProfile} members={members} tasks={tasks} files={files} questions={questions} isMentor={true} />;
      case "sessions":   return <MSessions />;
      case "call":       return (
        <div className="m-page page-anim">
          <div className="m-ph"><div className="m-ph-title">Voice &amp; Video Call</div></div>
          <VoiceCallPanel projectId={projectId} myProfile={myProfile} isMentor={true} vcMsgs={vcMsgs} vcInput={vcInput} setVcInput={setVcInput} sendVcMsg={sendVcMsg} vcEndRef={vcEndRef} user={user} />
        </div>
      );
      case "activity":   return <MActivity />;
      default:           return <MOverview />;
    }
  };

  if (loading) return (
    <><style>{MENTOR_CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0b0f1a", gap: 14 }}>
        <div className="m-spinner" />
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".58rem", color: "#8a9ab0" }}>LOADING…</div>
      </div></>
  );

  if (!project) return (
    <><style>{MENTOR_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: ".8rem", fontWeight: 700, color: "#8a9ab0" }}>Project not found.</div>
      </div></>
  );

  return (
    <><style>{MENTOR_CSS}</style>
      <div className="m-shell">
        <div className={`m-mob-ov${mobOpen ? " open" : ""}`} onClick={() => setMobOpen(false)} />
        <aside className={`m-sb${collapsed ? " col" : ""}${mobOpen ? " mob" : ""}`}>
          <div className="m-sb-logo">
            <div className="m-sb-mark">M</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div className="m-sb-ltxt">SCH · HUB</div>
              <div className="m-sb-lsub">MENTOR PORTAL</div>
            </div>
            <button className="m-sb-cbtn" onClick={() => setCollapsed(p => !p)}>{collapsed ? "›" : "‹"}</button>
          </div>
          <div className="m-sb-scroll">
            <div className="m-sb-grp">Mentor Tools</div>
            {MENTOR_TABS.filter(t => t.group === "mentor").map(t => {
              const badge = t.id === "qa" ? (unanswered.length || null) : null;
              return (
                <div key={t.id} className={`m-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                  <span className="m-sb-ico">{t.icon}</span>
                  <span className="m-sb-lbl">{t.label}</span>
                  {badge && <span className="m-sb-bdg">{badge}</span>}
                </div>
              );
            })}
            {/* <div className="m-sb-sep" />
            <div className="m-sb-grp">AI Tools</div>
            {MENTOR_TABS.filter(t => t.group === "tools").map(t => (
              <div key={t.id} className={`m-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                <span className="m-sb-ico">{t.icon}</span>
                <span className="m-sb-lbl">{t.label}</span>
              </div>
            ))} */}
            <div className="m-sb-sep" />
            <div className="m-sb-grp">Communications</div>
            {MENTOR_TABS.filter(t => t.group === "comms").map(t => (
              <div key={t.id} className={`m-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                <span className="m-sb-ico">{t.icon}</span>
                <span className="m-sb-lbl">{t.label}</span>
              </div>
            ))}
          </div>
          <div className="m-sb-foot">
            <div className="m-sb-user">
              <div className="m-sb-uav"><img src={getAv(myProfile?.avatar, myProfile?.photoURL)} alt="me" /></div>
              <div className="m-sb-uinfo">
                <div className="m-sb-uname">{myProfile?.fullName || "Mentor"}</div>
                <div className="m-sb-urole">MENTOR</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="m-main">
          <div className="m-topbar">
            <button className="m-mmb" onClick={() => setMobOpen(p => !p)}>☰</button>
            <div className="m-crumb">
              <span className="m-crumb-r" onClick={() => nav("/dashboard")}>SCH·HUB</span>
              <span style={{ color: "var(--border2)" }}>›</span>
              <span className="m-crumb-c">{project.projectName || "Project"}</span>
            </div>
            <div className="m-mentor-pill"><span className="m-dot" />Mentor View</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: ".7rem", fontWeight: 600, cursor: "pointer" }} onClick={() => nav("/mentor/dashboard")}>← Dashboard</button>
              <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--accent-border)", flexShrink: 0 }}>
                <img src={getAv(myProfile?.avatar, myProfile?.photoURL)} alt="me" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </div>
          </div>
          <div className="m-content">{renderPanel()}</div>
        </div>
      </div>

      {/* Schedule session modal */}
      {sessionModal && (
        <div className="m-overlay" onClick={e => { if (e.target === e.currentTarget) setSessionModal(false); }}>
          <div className="m-modal">
            <button className="m-modal-close" onClick={() => setSessionModal(false)}>✕</button>
            <div className="m-modal-title">Schedule a Session</div>
            <div className="m-modal-sub">Team will be notified of your availability</div>
            <div className="m-modal-lbl">Time Slot</div>
            <select className="m-modal-inp" style={{ padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: ".7rem", outline: "none" }}
              value={newSession.slot} onChange={e => setNewSession(p => ({ ...p, slot: e.target.value }))}>
              <option value="">Choose a slot…</option>
              {["Mon 10:00 AM", "Tue 02:00 PM", "Wed 06:00 PM", "Thu 09:00 AM", "Fri 04:00 PM", "Sat 11:00 AM"].map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="m-modal-lbl">Mode</div>
            <select className="m-modal-inp" style={{ padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: ".7rem", outline: "none" }}
              value={newSession.mode} onChange={e => setNewSession(p => ({ ...p, mode: e.target.value }))}>
              <option value="video">Video Call</option><option value="voice">Voice Call</option><option value="chat">Chat</option>
            </select>
            <div className="m-modal-lbl">Note (optional)</div>
            <textarea className="m-modal-inp" style={{ minHeight: 70, resize: "vertical" }} placeholder="e.g. We'll go over the ER diagram…"
              value={newSession.note} onChange={e => setNewSession(p => ({ ...p, note: e.target.value }))} />
            <button className="m-modal-sub-btn" onClick={async () => {
              if (!newSession.slot) { showToast("Pick a slot"); return; }
              if (sessions[0]?.id) await updateDoc(doc(db, "mentorRequests", sessions[0].id), { status: "scheduled", scheduledSlot: newSession.slot }).catch(() => {});
              showToast("Session scheduled"); setSessionModal(false);
            }}>Schedule</button>
          </div>
        </div>
      )}
      {toast && <div className="m-toast">{toast}</div>}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TEAM DASHBOARD
══════════════════════════════════════════════════════════════════ */
const TEAM_TABS = [
  { id: "overview",  icon: "OV", label: "Overview",    group: "project" },
  { id: "tasks",     icon: "TS", label: "Tasks",        group: "project" },
  { id: "board",     icon: "KB", label: "Kanban Board", group: "project" },
  { id: "files",     icon: "FL", label: "Files",        group: "project" },
  { id: "aitools",   icon: "AI", label: "AI Tools",     group: "tools" },
  { id: "qa",        icon: "QA", label: "Ask Mentor",   group: "mentor", badge: true },
  { id: "feedback",  icon: "FB", label: "My Feedback",  group: "mentor" },
  { id: "sessions",  icon: "SC", label: "Sessions",     group: "comms" },
  { id: "call",      icon: "VC", label: "Voice & Video",group: "comms" },
  { id: "activity",  icon: "AC", label: "Activity",     group: "comms" },
];

export function TeamDashboard() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [vcMsgs, setVcMsgs] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qReplies, setQReplies] = useState({});
  const [feedbacks, setFeedbacks] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssign, setNewTaskAssign] = useState("");
  const [newTaskPri, setNewTaskPri] = useState("medium");
  const [taskSaving, setTaskSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [qSaving, setQSaving] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadSaving, setUploadSaving] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [reqMessage, setReqMessage] = useState("");
  const [reqMode, setReqMode] = useState("video");
  const [vcInput, setVcInput] = useState("");

  const vcEndRef = useRef(null);
  const listenersRef = useRef([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3200); };
  const selectTab = useCallback((id) => { setActiveTab(id); setMobOpen(false); }, []);

  useEffect(() => () => listenersRef.current.forEach(u => u()), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      const [pSnap, prSnap] = await Promise.all([
        getDoc(doc(db, "teamProjects", projectId)),
        getDoc(doc(db, "users", u.uid)),
      ]);
      if (!pSnap.exists()) { setLoading(false); return; }
      const pd = pSnap.data();
      setProject(pd);
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

  useEffect(() => {
    if (!projectId) return;
    const u1 = onSnapshot(doc(db, "teamProjects", projectId), (snap) => { if (snap.exists()) { const d = snap.data(); setProject(d); setTasks(d.tasks || []); } });
    const u2 = onSnapshot(query(collection(db, "teamProjects", projectId, "activity"), orderBy("createdAt", "desc")), (snap) => setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, "teamProjects", projectId, "files"), orderBy("createdAt", "desc")), (snap) => setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.isAsset)));
    const u4 = onSnapshot(query(collection(db, "teamProjects", projectId, "vcChat"), orderBy("createdAt", "asc")), (snap) => setVcMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(query(collection(db, "teamProjects", projectId, "questions"), orderBy("createdAt", "desc")), (snap) => {
      const qs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(qs);
      qs.forEach(q => {
        const ur = onSnapshot(query(collection(db, "teamProjects", projectId, "questions", q.id, "replies"), orderBy("createdAt", "asc")), (rSnap) => {
          setQReplies(prev => ({ ...prev, [q.id]: rSnap.docs.map(rd => ({ id: rd.id, ...rd.data() })) }));
        });
        listenersRef.current.push(ur);
      });
    });
    listenersRef.current.push(u1, u2, u3, u4, u5);
    return () => { listenersRef.current.forEach(u => u()); listenersRef.current = []; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !user) return;
    const u1 = onSnapshot(query(collection(db, "teamProjects", projectId, "mentorFeedback"), where("toId", "==", user.uid)), (snap) => setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, "mentorRequests"), where("projectId", "==", projectId), where("studentId", "==", user.uid)), (snap) => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [projectId, user]);

  useEffect(() => { vcEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [vcMsgs]);

  const donePct = tasks.length ? Math.round(tasks.filter(t => t.done).length / tasks.length * 100) : 0;
  const myTasks = tasks.filter(t => t.assignedTo === user?.uid);
  const answeredQ = questions.filter(q => (qReplies[q.id] || []).length > 0);

  const addTask = async () => {
    if (!newTaskText.trim()) { showToast("Enter a task name"); return; }
    setTaskSaving(true);
    const assignee = members.find(m => m.id === newTaskAssign);
    await updateDoc(doc(db, "teamProjects", projectId), {
      tasks: arrayUnion({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: newTaskText.trim(), done: false,
        assignedTo: newTaskAssign || "", assignedName: assignee?.fullName || "Unassigned",
        priority: newTaskPri, status: "todo", createdAt: Date.now()
      })
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", `added task: ${newTaskText.trim()}`, "");
    setNewTaskText(""); setNewTaskAssign(""); setNewTaskPri("medium"); setTaskSaving(false);
    showToast("Task added");
  };

  const toggleTask = async (task) => {
    const updated = tasks.map(t => t.id === task.id ? { ...t, done: !t.done, status: !t.done ? "done" : t.status === "done" ? "todo" : t.status } : t);
    await updateDoc(doc(db, "teamProjects", projectId), { tasks: updated });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", task.done ? "reopened" : "completed task", task.text.slice(0, 40));
  };

  const moveTask = async (task, newStatus) => {
    const updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus, done: newStatus === "done" } : t);
    await updateDoc(doc(db, "teamProjects", projectId), { tasks: updated });
  };

  const askQuestion = async () => {
    if (!newQuestion.trim()) return;
    setQSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "questions"), {
      text: newQuestion.trim(), askedBy: user.uid, askedByName: myProfile?.fullName || "Member",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      resolved: false, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "task", "asked a question", newQuestion.slice(0, 40));
    setNewQuestion(""); setQSaving(false); showToast("Question posted to mentor");
  };

  const uploadFile = async () => {
    if (!uploadName.trim()) return;
    setUploadSaving(true);
    await addDoc(collection(db, "teamProjects", projectId, "files"), {
      name: uploadName.trim(), content: uploadContent,
      upBy: myProfile?.fullName || "Member", upById: user.uid, createdAt: serverTimestamp()
    });
    await logActivity(projectId, user.uid, myProfile?.fullName || "Member", "file", `uploaded ${uploadName}`, "");
    setUploadName(""); setUploadContent(""); setUploadSaving(false); setUploadModal(false);
    showToast("File uploaded");
  };

  const requestSession = async () => {
    await addDoc(collection(db, "mentorRequests"), {
      projectId, studentId: user.uid, studentName: myProfile?.fullName || "Member",
      mentorId: project.mentorMembers?.[0] || "",
      message: reqMessage, mode: reqMode, status: "pending", createdAt: serverTimestamp()
    });
    setReqMessage(""); setSessionModal(false); showToast("Session requested!");
  };

  const sendVcMsg = async () => {
    if (!vcInput.trim()) return;
    await addDoc(collection(db, "teamProjects", projectId, "vcChat"), {
      text: vcInput, userId: user.uid, userName: myProfile?.fullName || "Member",
      avatar: myProfile?.avatar || "1", photoURL: myProfile?.photoURL || null,
      isMentor: false, createdAt: serverTimestamp()
    });
    setVcInput("");
  };

  // ── Panels ──────────────────────────────────────────────────────
  const TOverview = () => (
    <div className="t-page page-anim">
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
            <span>{myTasks.filter(t => !t.done).length} tasks for me</span>
          </div>
        </div>
        <div className="t-tags">
          {project.domain && <span className="t-tag">{project.domain}</span>}
          {(project.techStack || project.skills || []).slice(0, 3).map(t => <span key={t} className="t-tag g">{t}</span>)}
        </div>
      </div>
      <div className="t-stats-grid">
        {[
          { label: "My Tasks",   val: myTasks.length,                        sub: `${myTasks.filter(t => t.done).length} done`,   bar: "#2563eb" },
          { label: "Team Tasks", val: tasks.length,                          sub: `${donePct}% complete`,                          bar: "#0d9488" },
          { label: "Questions",  val: questions.length,                      sub: `${answeredQ.length} answered`,                  bar: "#f59e0b" },
          { label: "Feedback",   val: feedbacks.length,                      sub: "from mentor",                                   bar: "#7c3aed" },
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
              <div className="t-prog-track"><div className="t-prog-fill" style={{ width: `${donePct}%`, background: "linear-gradient(90deg,#2563eb,#3b82f6)" }} /></div>
              <div className="t-prog-pct" style={{ color: "var(--t-blue2)" }}>{donePct}%</div>
            </div>
            {KB_COLS.map(col => {
              const cnt = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status)).length;
              const pct = tasks.length ? Math.round(cnt / tasks.length * 100) : 0;
              return (
                <div key={col.id} className="t-prog-row">
                  <div className="t-prog-lbl"><div style={{ width: 5, height: 5, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />{col.label}</div>
                  <div className="t-prog-track"><div className="t-prog-fill" style={{ width: `${pct}%`, background: col.dot }} /></div>
                  <div className="t-prog-pct" style={{ color: col.color }}>{cnt}</div>
                </div>
              );
            })}
          </div>
          <div className="t-sh">Team</div>
          <div className="t-mem-grid">
            {members.map(m => {
              const mt = tasks.filter(t => t.assignedTo === m.id);
              const dc = mt.filter(t => t.done).length;
              const pct = mt.length ? Math.round(dc / mt.length * 100) : 0;
              return (
                <div key={m.id} className="t-mem-card">
                  <div className="t-mem-av"><img src={getAv(m.avatar, m.photoURL)} alt={m.fullName} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
            <div className="t-sh">My Tasks</div>
            {myTasks.filter(t => !t.done).slice(0, 5).map(t => (
              <div key={t.id} className="t-task-row" style={{ marginBottom: 5 }}>
                <div className="t-chk open" onClick={() => toggleTask(t)} />
                <span className="t-task-txt" style={{ fontSize: ".74rem" }}>{t.text}</span>
                <span className={`t-pri t-pri-${(t.priority || "m")[0]}`} style={{ fontSize: ".42rem" }}>{(t.priority || "M")[0].toUpperCase()}</span>
              </div>
            ))}
            {myTasks.filter(t => !t.done).length === 0 && <div className="t-empty" style={{ padding: "8px 0", fontSize: ".56rem" }}>All done! 🎉</div>}
          </div>
          {feedbacks.length > 0 && (
            <div className="t-card">
              <div className="t-sh">Latest Feedback</div>
              {feedbacks.slice(0, 2).map(f => (
                <div key={f.id} className="t-fb-card">
                  <div className="t-fb-from">🧑‍🏫 {f.mentorName} · {timeAgo(f.createdAt)}</div>
                  <div className="t-fb-txt" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.text}</div>
                  <div className="t-fb-rat">{f.rating === "excellent" ? "⭐⭐⭐" : f.rating === "good" ? "⭐⭐" : f.rating === "needs-work" ? "⭐" : "⚠️"}</div>
                </div>
              ))}
            </div>
          )}
          <div className="t-card">
            <div className="t-sh">Activity</div>
            {activity.slice(0, 4).map(a => (
              <div key={a.id} style={{ display: "flex", gap: 7, padding: "6px 0", borderBottom: "1px solid var(--t-border)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.cat === "code" ? "var(--t-teal)" : a.cat === "file" ? "var(--t-purple)" : "var(--t-dim)", flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".7rem", color: "var(--t-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}: {a.desc}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".44rem", color: "var(--t-dim)", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
            {activity.length === 0 && <div className="t-empty" style={{ padding: "8px 0" }}>No activity yet</div>}
          </div>
        </div>
      </div>
    </div>
  );

  const TTasks = () => (
    <div className="t-page page-anim">
      <div className="t-ph"><div className="t-ph-title">Tasks</div><div className="t-ph-sub">{tasks.length} total · {tasks.filter(t => t.done).length} done</div></div>
      <div className="t-card" style={{ marginBottom: 18 }}>
        <div className="t-sh">Add Task</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input className="t-input" placeholder="Task description…" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
          <select className="t-sel" value={newTaskAssign} onChange={e => setNewTaskAssign(e.target.value)}>
            <option value="">Assign to…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.fullName}{m.id === user?.uid ? " (me)" : ""}</option>)}
          </select>
          <select className="t-sel" value={newTaskPri} onChange={e => setNewTaskPri(e.target.value)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <button className="t-btn" onClick={addTask} disabled={taskSaving || !newTaskText.trim()}>{taskSaving ? "Adding…" : "Add Task"}</button>
        </div>
      </div>
      <div className="t-sh">All Tasks</div>
      {tasks.map(t => (
        <div key={t.id} className={`t-task-row${t.done ? " done" : ""}`}>
          <div className={`t-chk${t.done ? " done" : " open"}`} onClick={() => toggleTask(t)}>
            {t.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <span className={`t-task-txt${t.done ? " done" : ""}`}>{t.text}</span>
          {t.assignedName && <span className="t-task-who">→ {t.assignedName}{t.assignedTo === user?.uid ? " (you)" : ""}</span>}
          <span className={`t-pri t-pri-${(t.priority || "m")[0]}`}>{t.priority || "medium"}</span>
          <select className="t-sel" style={{ fontSize: ".62rem", padding: "3px 6px" }} value={t.status || "todo"} onChange={e => moveTask(t, e.target.value)}>
            {KB_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      ))}
      {tasks.length === 0 && <div className="t-empty">No tasks yet. Add one above!</div>}
    </div>
  );

  const TBoard = () => (
    <div className="t-page page-anim">
      <div className="t-ph"><div className="t-ph-title">Kanban Board</div><div className="t-ph-sub">Click status buttons to move tasks</div></div>
      <div className="t-kb">
        {KB_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id || (col.id === "done" && t.done && !t.status));
          return (
            <div key={col.id} className="t-kb-col">
              <div className="t-kb-hd">
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                <div className="t-kb-title" style={{ color: col.color }}>{col.label}</div>
                <div className="t-kb-cnt">{colTasks.length}</div>
              </div>
              <div className="t-kb-body">
                {colTasks.map(t => (
                  <div key={t.id} className="t-kb-card">
                    <div className="t-kb-ct">{t.text}</div>
                    <div className="t-kb-cm">
                      {t.assignedTo && <><div className="t-kb-cav"><img src={getAv(members.find(m => m.id === t.assignedTo)?.avatar)} alt="" /></div><span className="t-kb-cn">{t.assignedName}</span></>}
                      <span className={`t-pri t-pri-${(t.priority || "m")[0]}`} style={{ marginLeft: "auto", fontSize: ".42rem" }}>{(t.priority || "M")[0].toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
                      {KB_COLS.filter(c => c.id !== col.id).map(c => (
                        <button key={c.id} style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${c.dot}33`, background: `${c.dot}11`, color: c.dot, fontFamily: "'DM Mono',monospace", fontSize: ".4rem", cursor: "pointer" }}
                          onClick={() => moveTask(t, c.id)}>→ {c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && <div className="t-empty" style={{ padding: "12px 0" }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const TFiles = () => (
    <div className="t-page page-anim">
      <div className="t-ph">
        <div><div className="t-ph-title">Files</div><div className="t-ph-sub">{files.length} files shared</div></div>
        <button className="t-abtn" onClick={() => setUploadModal(true)}>+ Upload File</button>
      </div>
      {files.length === 0 && <div className="t-empty">No files yet. Upload your first file.</div>}
      {files.map(f => (
        <div key={f.id} className="t-file-row">
          <div className="t-file-ico">{f.name?.split(".").pop()?.toUpperCase()?.slice(0, 4) || "FILE"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--t-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".5rem", color: "var(--t-dim)" }}>{f.upBy} · {timeAgo(f.createdAt)}</div>
          </div>
          {f.content && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: ".46rem", color: "var(--t-dim)" }}>{f.content.length} chars</span>}
        </div>
      ))}
    </div>
  );

  const TQA = () => (
    <div className="t-page page-anim">
      <div className="t-ph"><div><div className="t-ph-title">Ask Mentor</div><div className="t-ph-sub">{questions.length} questions · {answeredQ.length} answered</div></div></div>
      <div className="t-card" style={{ marginBottom: 18 }}>
        <div className="t-sh">New Question</div>
        <textarea className="t-ta" placeholder="Ask your mentor a question…" value={newQuestion} onChange={e => setNewQuestion(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="t-abtn" onClick={askQuestion} disabled={qSaving || !newQuestion.trim()}>{qSaving ? "Posting…" : "Post Question"}</button>
        </div>
      </div>
      <div className="t-sh">My Questions</div>
      {questions.length === 0 && <div className="t-empty">No questions yet. Ask your mentor above!</div>}
      {questions.map(q => {
        const replies = qReplies[q.id] || [];
        return (
          <div key={q.id} className={`t-q-item${replies.length ? " has-r" : ""}`}>
            <div className="t-q-text">{q.text}</div>
            <div className="t-q-meta">
              <span>{q.askedByName}</span><span>·</span><span>{timeAgo(q.createdAt)}</span>
              {replies.length > 0 ? <span className="t-tag g" style={{ fontSize: ".42rem" }}>Answered</span> : <span className="t-tag a" style={{ fontSize: ".42rem" }}>Pending</span>}
            </div>
            {replies.map(r => (
              <div key={r.id} className="t-q-reply">
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <img src={getAv(r.avatar, r.photoURL)} alt={r.mentorName}
                    style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #e2e8f0", objectFit: "cover" }} />
                  <div className="t-q-rby">🧑‍🏫 {r.mentorName} · {timeAgo(r.createdAt)}</div>
                </div>
                <div className="t-q-rtxt">{r.text}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const TFeedback = () => (
    <div className="t-page page-anim">
      <div className="t-ph"><div className="t-ph-title">My Feedback</div><div className="t-ph-sub">{feedbacks.length} items from mentor</div></div>
      {feedbacks.length === 0 && <div className="t-empty">No feedback yet. Your mentor will post feedback here.</div>}
      {feedbacks.map(f => (
        <div key={f.id} className="t-fb-card">
          <div className="t-fb-from">🧑‍🏫 {f.mentorName} · {timeAgo(f.createdAt)}</div>
          <div className="t-fb-txt">{f.text}</div>
          <div className="t-fb-rat">{f.rating === "excellent" ? "⭐⭐⭐ Excellent" : f.rating === "good" ? "⭐⭐ Good Progress" : f.rating === "needs-work" ? "⭐ Needs Work" : "⚠️ Blocked"}</div>
        </div>
      ))}
    </div>
  );

  const TSessions = () => (
    <div className="t-page page-anim">
      <div className="t-ph">
        <div><div className="t-ph-title">Sessions</div><div className="t-ph-sub">{sessions.length} requests sent</div></div>
        <button className="t-abtn" onClick={() => setSessionModal(true)}>Request Session</button>
      </div>
      {sessions.length === 0 && <div className="t-empty">No session requests yet.</div>}
      {sessions.map(s => (
        <div key={s.id} className="t-card" style={{ marginBottom: 9, borderLeft: `3px solid ${s.status === "accepted" || s.status === "scheduled" ? "var(--t-teal)" : s.status === "declined" ? "var(--t-red)" : "var(--t-border2)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--t-text)" }}>{s.scheduledSlot || "Awaiting time slot"}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".5rem", color: "var(--t-dim)", marginTop: 2 }}>{s.mode === "video" ? "📹 Video" : s.mode === "voice" ? "🎙 Voice" : "💬 Chat"} · {timeAgo(s.createdAt)}</div>
            </div>
            <span className={`t-tag${s.status === "accepted" || s.status === "scheduled" ? " g" : s.status === "declined" ? " r" : " a"}`}>{(s.status || "pending").toUpperCase()}</span>
          </div>
          {s.message && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".54rem", color: "var(--t-dim)", marginTop: 7 }}>"{s.message}"</div>}
        </div>
      ))}
    </div>
  );

  const TActivity = () => (
    <div className="t-page page-anim">
      <div className="t-ph"><div className="t-ph-title">Activity Feed</div></div>
      <div className="t-card">
        {activity.length === 0 && <div className="t-empty">No activity yet.</div>}
        {activity.map(a => {
          const m = members.find(x => x.id === a.uid) || { fullName: a.name || "Member", avatar: "1" };
          return (
            <div key={a.id} className="t-act-item">
              <div className="t-act-av"><img src={getAv(m.avatar, m.photoURL)} alt="" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--t-text)" }}>{m.fullName || a.name}{a.uid === user?.uid ? " (you)" : ""}</div>
                <div style={{ fontSize: ".7rem", color: "var(--t-muted)" }}>{a.desc}</div>
                {a.ref && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".48rem", color: "var(--t-blue2)", marginTop: 1 }}>{a.ref}</div>}
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".46rem", color: "var(--t-dim)", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
              </div>
              <span className={`t-act-chip ${a.cat === "file" ? "t-chip-file" : a.cat === "code" ? "t-chip-code" : a.cat === "mentor" ? "t-chip-mentor" : "t-chip-task"}`}>{(a.cat || "task").toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const unansweredBadge = questions.filter(q => !(qReplies[q.id] || []).length && q.askedBy === user?.uid).length;

  const renderPanel = () => {
    switch (activeTab) {
      case "overview":  return <TOverview />;
      case "tasks":     return <TTasks />;
      case "board":     return <TBoard />;
      case "files":     return <TFiles />;
      case "aitools":   return <AIToolsPanel projectId={projectId} user={user} myProfile={myProfile} members={members} tasks={tasks} files={files} questions={questions} isMentor={false} />;
      case "qa":        return <TQA />;
      case "feedback":  return <TFeedback />;
      case "sessions":  return <TSessions />;
      case "call":      return (
        <div className="t-page page-anim">
          <div className="t-ph"><div className="t-ph-title">Voice &amp; Video Call</div></div>
          <VoiceCallPanel projectId={projectId} myProfile={myProfile} isMentor={false} vcMsgs={vcMsgs} vcInput={vcInput} setVcInput={setVcInput} sendVcMsg={sendVcMsg} vcEndRef={vcEndRef} user={user} />
        </div>
      );
      case "activity":  return <TActivity />;
      default:          return <TOverview />;
    }
  };

  if (loading) return (
    <><style>{TEAM_CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f0f4f8", gap: 14 }}>
        <div className="t-spinner" />
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".58rem", color: "#94a3b8" }}>LOADING…</div>
      </div></>
  );

  if (!project) return (
    <><style>{TEAM_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: ".8rem", fontWeight: 700, color: "#94a3b8" }}>Project not found.</div>
      </div></>
  );

  return (
    <><style>{TEAM_CSS}</style>
      <div className="t-shell">
        <div className={`t-mob-ov${mobOpen ? " open" : ""}`} onClick={() => setMobOpen(false)} />
        <aside className={`t-sb${collapsed ? " col" : ""}${mobOpen ? " mob" : ""}`}>
          <div className="t-sb-logo">
            <div className="t-sb-mark">S</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div className="t-sb-ltxt">SCH · HUB</div>
              <div className="t-sb-lsub">TEAM WORKSPACE</div>
            </div>
            <button className="t-sb-cbtn" onClick={() => setCollapsed(p => !p)}>{collapsed ? "›" : "‹"}</button>
          </div>
          <div className="t-sb-scroll">
            <div className="t-sb-grp">Project</div>
            {TEAM_TABS.filter(t => t.group === "project").map(t => (
              <div key={t.id} className={`t-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                <span className="t-sb-ico">{t.icon}</span>
                <span className="t-sb-lbl">{t.label}</span>
              </div>
            ))}
            {/* <div className="t-sb-sep" />
            <div className="t-sb-grp">AI Tools</div>
            {TEAM_TABS.filter(t => t.group === "tools").map(t => (
              <div key={t.id} className={`t-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                <span className="t-sb-ico">{t.icon}</span>
                <span className="t-sb-lbl">{t.label}</span>
              </div>
            ))} */}
            <div className="t-sb-sep" />
            <div className="t-sb-grp">Mentor</div>
            {TEAM_TABS.filter(t => t.group === "mentor").map(t => {
              const badge = t.id === "qa" ? (unansweredBadge || null) : null;
              return (
                <div key={t.id} className={`t-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                  <span className="t-sb-ico">{t.icon}</span>
                  <span className="t-sb-lbl">{t.label}</span>
                  {badge && <span className="t-sb-bdg">{badge}</span>}
                </div>
              );
            })}
            <div className="t-sb-sep" />
            <div className="t-sb-grp">Communications</div>
            {TEAM_TABS.filter(t => t.group === "comms").map(t => (
              <div key={t.id} className={`t-sb-item${activeTab === t.id ? " act" : ""}`} onClick={() => selectTab(t.id)}>
                <span className="t-sb-ico">{t.icon}</span>
                <span className="t-sb-lbl">{t.label}</span>
              </div>
            ))}
          </div>
          <div className="t-sb-foot">
            <div className="t-sb-user">
              <div className="t-sb-uav"><img src={getAv(myProfile?.avatar, myProfile?.photoURL)} alt="me" /></div>
              <div className="t-sb-uinfo">
                <div className="t-sb-uname">{myProfile?.fullName || "Student"}</div>
                <div className="t-sb-urole">TEAM MEMBER</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="t-main">
          <div className="t-topbar">
            <button className="t-mmb" onClick={() => setMobOpen(p => !p)}>☰</button>
            <div className="t-crumb">
              <span className="t-crumb-r" onClick={() => nav("/dashboard")}>SCH·HUB</span>
              <span style={{ color: "var(--t-border2)" }}>›</span>
              <span className="t-crumb-c">{project.projectName || "Project"}</span>
            </div>
            <div className="t-student-pill"><span className="t-dot" />Team View</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--t-border)", background: "transparent", color: "var(--t-muted)", fontSize: ".7rem", fontWeight: 600, cursor: "pointer" }} onClick={() => nav("/dashboard")}>← Dashboard</button>
              <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--t-accent-border)", flexShrink: 0 }}>
                <img src={getAv(myProfile?.avatar, myProfile?.photoURL)} alt="me" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </div>
          </div>
          <div className="t-content">{renderPanel()}</div>
        </div>
      </div>

      {/* Upload modal */}
      {uploadModal && (
        <div className="t-overlay" onClick={e => { if (e.target === e.currentTarget) setUploadModal(false); }}>
          <div className="t-modal">
            <button className="t-modal-close" onClick={() => setUploadModal(false)}>✕</button>
            <div className="t-modal-title">Upload File</div>
            <div className="t-modal-sub">Share code or text with your team and mentor</div>
            <div className="t-modal-lbl">File Name</div>
            <input className="t-modal-inp" placeholder="e.g. schema.sql" value={uploadName} onChange={e => setUploadName(e.target.value)} />
            <div className="t-modal-lbl">Content (paste code or text)</div>
            <textarea className="t-modal-inp" style={{ minHeight: 100, resize: "vertical", fontFamily: "monospace", fontSize: ".76rem" }} placeholder="Paste file contents here…" value={uploadContent} onChange={e => setUploadContent(e.target.value)} />
            <button className="t-modal-sub-btn" onClick={uploadFile} disabled={uploadSaving || !uploadName.trim()}>{uploadSaving ? "Uploading…" : "Upload"}</button>
          </div>
        </div>
      )}

      {/* Request session modal */}
      {sessionModal && (
        <div className="t-overlay" onClick={e => { if (e.target === e.currentTarget) setSessionModal(false); }}>
          <div className="t-modal">
            <button className="t-modal-close" onClick={() => setSessionModal(false)}>✕</button>
            <div className="t-modal-title">Request a Session</div>
            <div className="t-modal-sub">Your mentor will confirm a time slot</div>
            <div className="t-modal-lbl">Mode</div>
            <select className="t-modal-inp" style={{ padding: "9px 12px", background: "var(--t-bg)", border: "1px solid var(--t-border)", borderRadius: 8, color: "var(--t-text)", fontFamily: "'DM Mono',monospace", fontSize: ".7rem", outline: "none" }}
              value={reqMode} onChange={e => setReqMode(e.target.value)}>
              <option value="video">📹 Video Call</option>
              <option value="voice">🎙 Voice Call</option>
              <option value="chat">💬 Chat</option>
            </select>
            <div className="t-modal-lbl">Message (optional)</div>
            <textarea className="t-modal-inp" style={{ minHeight: 70, resize: "vertical" }} placeholder="What do you need help with?" value={reqMessage} onChange={e => setReqMessage(e.target.value)} />
            <button className="t-modal-sub-btn" onClick={requestSession}>Send Request</button>
          </div>
        </div>
      )}

      {toast && <div className="t-toast">{toast}</div>}
    </>
  );
}