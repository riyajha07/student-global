import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  doc, updateDoc, getDoc, arrayUnion, setDoc
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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  :root{--bg:#020817;--navy:#071a3e;--blue:#0ea5e9;--cyan:#06d6f5;--accent:#00ffc8;--text:#e2f0ff;--muted:#7ba3c8;--err:#f87171;--warn:#fbbf24;--font-h:'Orbitron',monospace;--font-b:'Rajdhani',sans-serif;--font-m:'Share Tech Mono',monospace}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--font-b);min-height:100vh}
  .nf-bg{position:fixed;inset:0;background:linear-gradient(rgba(6,214,245,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .nf-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0.9rem 2rem;background:rgba(2,8,23,0.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(6,214,245,0.1)}
  .nf-logo{font-family:var(--font-h);font-size:0.8rem;font-weight:700;color:var(--cyan);letter-spacing:0.15em;text-shadow:0 0 14px var(--cyan)}
  .nf-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-family:var(--font-m);font-size:0.68rem;color:var(--muted);transition:color 0.2s;padding:0}
  .nf-back:hover{color:var(--cyan)}
  .nf-main{position:relative;z-index:1;padding:5.5rem 1.5rem 3rem;max-width:720px;margin:0 auto}
  @media(max-width:500px){.nf-main{padding:5rem 1rem 2rem}}
  .nf-hdr{margin-bottom:2rem}
  .nf-hdr-tag{font-family:var(--font-m);font-size:0.68rem;color:var(--accent);letter-spacing:0.12em;margin-bottom:4px}
  .nf-hdr-h{font-family:var(--font-h);font-size:clamp(1.1rem,3vw,1.5rem);font-weight:700;color:var(--text)}
  .nf-hdr-h span{color:var(--cyan)}
  .nf-tabs{display:flex;gap:6px;margin-bottom:1.5rem;border-bottom:1px solid rgba(14,165,233,0.1);padding-bottom:0}
  .nf-tab{font-family:var(--font-m);font-size:0.7rem;color:var(--muted);cursor:pointer;padding:0.5rem 1rem;border:none;background:none;letter-spacing:0.08em;border-bottom:2px solid transparent;transition:all 0.2s;margin-bottom:-1px}
  .nf-tab.on{color:var(--cyan);border-bottom-color:var(--cyan)}
  .nf-list{display:flex;flex-direction:column;gap:10px}
  .nf-item{background:rgba(4,15,36,0.8);border:1px solid rgba(14,165,233,0.15);border-radius:10px;padding:1.1rem 1.4rem;transition:all 0.2s;position:relative}
  .nf-item.unread{border-color:rgba(0,255,200,0.25);background:rgba(0,255,200,0.03)}
  .nf-item:hover{border-color:rgba(6,214,245,0.3)}
  .nf-item-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px}
  .nf-item-type{font-family:var(--font-m);font-size:0.6rem;letter-spacing:0.1em;padding:3px 8px;border-radius:3px}
  .nf-item-type.invite{color:var(--accent);background:rgba(0,255,200,0.07);border:1px solid rgba(0,255,200,0.2)}
  .nf-item-type.system{color:var(--blue);background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.2)}
  .nf-item-time{font-family:var(--font-m);font-size:0.6rem;color:var(--muted)}
  .nf-item-msg{font-size:0.95rem;color:var(--text);line-height:1.5;margin-bottom:0.75rem}
  .nf-item-msg strong{color:var(--accent)}
  .nf-dot{position:absolute;top:1rem;right:1rem;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent)}
  .nf-actions{display:flex;gap:8px;flex-wrap:wrap}
  .nf-btn-accept{padding:0.45rem 1rem;border:none;border-radius:5px;background:linear-gradient(135deg,#00c896,#06d6f5);color:#020817;font-family:var(--font-h);font-size:0.65rem;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.06em}
  .nf-btn-accept:hover{box-shadow:0 0 12px rgba(0,255,200,0.35)}
  .nf-btn-decline{padding:0.45rem 1rem;border:1px solid rgba(248,113,113,0.3);border-radius:5px;background:transparent;color:rgba(248,113,113,0.7);font-family:var(--font-h);font-size:0.65rem;cursor:pointer;transition:all 0.2s;letter-spacing:0.06em}
  .nf-btn-decline:hover{border-color:#f87171;color:#f87171}
  .nf-btn-view{padding:0.45rem 1rem;border:1px solid rgba(14,165,233,0.25);border-radius:5px;background:transparent;color:var(--blue);font-family:var(--font-h);font-size:0.65rem;cursor:pointer;transition:all 0.2s;letter-spacing:0.06em}
  .nf-btn-view:hover{border-color:var(--cyan);color:var(--cyan)}
  .nf-empty{text-align:center;padding:3rem;font-family:var(--font-m);font-size:0.78rem;color:var(--muted)}
  .nf-loading{min-height:60vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem}
  .nf-spin{width:34px;height:34px;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--cyan);border-radius:50%;animation:nf-spin 0.7s linear infinite}
  @keyframes nf-spin{to{transform:rotate(360deg)}}
  .nf-spin-txt{font-family:var(--font-m);font-size:0.75rem;color:var(--muted)}
`;

export default function Notifications() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all"); // all | unread | invites

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { nav("/login"); return; }
      setUser(u);
      await loadNotifs(u.uid);
      setLoading(false);
    });
    return unsub;
  }, []);

  const loadNotifs = async (uid) => {
    const q = query(collection(db,"notifications"), where("toUid","==",uid));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    setNotifs(list);
  };

  const markRead = async (notifId) => {
    await updateDoc(doc(db,"notifications",notifId), { read: true });
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const handleAccept = async (notif) => {
    if (!notif.projectId) return;
    // Add user to team members
    await updateDoc(doc(db,"teamProjects",notif.projectId), {
      members: arrayUnion(user.uid),
      pendingMembers: (await getDoc(doc(db,"teamProjects",notif.projectId))).data()?.pendingMembers?.filter(id => id !== user.uid) || [],
    });
    await markRead(notif.id);
    nav(`/team-dashboard/${notif.projectId}`);
  };

  const handleDecline = async (notif) => {
    await markRead(notif.id);
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, declined: true } : n));
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  };

  const filtered = notifs.filter(n => {
    if (tab === "unread") return !n.read;
    if (tab === "invites") return n.type === "team_invite";
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <>
      <style>{css}</style>
      <div className="nf-bg" />
      <nav className="nf-nav">
        <button className="nf-back" onClick={() => nav("/dashboard")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Dashboard
        </button>
        <div className="nf-logo">SCH·HUB</div>
      </nav>

      <main className="nf-main">
        <div className="nf-hdr">
          <div className="nf-hdr-tag">// NOTIFICATIONS · {unreadCount} UNREAD</div>
          <h1 className="nf-hdr-h">Your <span>Alerts</span></h1>
        </div>

        <div className="nf-tabs">
          {[{k:"all",l:"ALL"},{ k:"unread",l:`UNREAD (${unreadCount})`},{k:"invites",l:"TEAM INVITES"}].map(t => (
            <button key={t.k} className={`nf-tab ${tab===t.k?"on":""}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>

        {loading ? (
          <div className="nf-loading"><div className="nf-spin" /><div className="nf-spin-txt">LOADING…</div></div>
        ) : filtered.length === 0 ? (
          <div className="nf-empty">
            {tab === "all" ? "No notifications yet." : tab === "unread" ? "All caught up! ✓" : "No team invites."}
          </div>
        ) : (
          <div className="nf-list">
            {filtered.map(n => (
              <div key={n.id} className={`nf-item ${!n.read?"unread":""}`} onClick={() => !n.read && markRead(n.id)}>
                {!n.read && <div className="nf-dot" />}
                <div className="nf-item-top">
                  <span className={`nf-item-type ${n.type==="team_invite"?"invite":"system"}`}>
                    {n.type === "team_invite" ? "TEAM INVITE" : "SYSTEM"}
                  </span>
                  <span className="nf-item-time">{fmtTime(n.createdAt)}</span>
                </div>
                <div className="nf-item-msg">
                  {n.type === "team_invite" && (
                    <><strong>{n.fromName}</strong> invited you to join <strong>{n.teamName}</strong> — working on <strong>{n.projectName}</strong>.</>
                  )}
                  {n.type !== "team_invite" && (n.message || "You have a new notification.")}
                </div>
                {n.type === "team_invite" && !n.declined && !n.read && (
                  <div className="nf-actions">
                    <button className="nf-btn-accept" onClick={e => { e.stopPropagation(); handleAccept(n); }}>✓ Accept & Join</button>
                    <button className="nf-btn-decline" onClick={e => { e.stopPropagation(); handleDecline(n); }}>✗ Decline</button>
                  </div>
                )}
                {n.type === "team_invite" && n.read && !n.declined && (
                  <div className="nf-actions">
                    <button className="nf-btn-view" onClick={e => { e.stopPropagation(); nav(`/team-dashboard/${n.projectId}`); }}>View Project →</button>
                  </div>
                )}
                {n.declined && (
                  <div style={{fontFamily:"var(--font-m)",fontSize:"0.65rem",color:"var(--err)"}}>Declined</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}