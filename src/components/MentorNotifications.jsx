import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDocs
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
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── helpers ─────────────────────────────────────────────────── */
function DotsCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    let id, dots = [];
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const N = Math.floor((window.innerWidth * window.innerHeight) / 12000);
    for (let i = 0; i < N; i++)
      dots.push({ x: Math.random()*c.width, y: Math.random()*c.height,
        r: Math.random()*1.5+0.5, vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
        o: Math.random()*.25+.05 });
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x<0||d.x>c.width) d.vx*=-1;
        if (d.y<0||d.y>c.height) d.vy*=-1;
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
        ctx.fillStyle = `rgba(6,214,245,${d.o})`; ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}/>;
}

const timeAgo = (ts) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const s = (Date.now()-d.getTime())/1000;
  if (s<60) return "just now";
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  if (s<604800) return `${Math.floor(s/86400)}d ago`;
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
};

/* 
  Notification schema in Firestore (collection: "notifications"):
  {
    uid: string,          ← recipient user ID
    type: "request"|"message"|"session"|"review"|"system"|"task"|"commit",
    icon: string,
    title: string,
    body: string,
    projectId?: string,
    requestId?: string,
    read: boolean,
    createdAt: Timestamp
  }

  To create notifications from other parts of the app:
  await addDoc(collection(db,"notifications"), {
    uid: targetUserId,
    type: "request",
    icon: "👥",
    title: "New Mentorship Request",
    body: `Team '${teamName}' wants your mentorship`,
    projectId,
    read: false,
    createdAt: serverTimestamp()
  });
*/

const TYPE_META = {
  request: { color:"#06d6f5", label:"Requests" },
  message: { color:"#10b981", label:"Messages" },
  session: { color:"#8b5cf6", label:"Sessions" },
  review:  { color:"#f59e0b", label:"Reviews"  },
  system:  { color:"#f43f5e", label:"System"   },
  task:    { color:"#3b82f6", label:"Tasks"    },
  commit:  { color:"#06d6f5", label:"Commits"  },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
:root {
  --bg:    #050d1a;
  --bg2:   #071428;
  --bg3:   #0a1f3d;
  --panel: #0b1929;
  --border:#1a3050;
  --border2:#214060;
  --cyan:  #06d6f5;
  --teal:  #10b981;
  --blue:  #3b82f6;
  --red:   #ef4444;
  --text:  #e2f0ff;
  --muted: #5a8aaa;
  --dim:   #2a4a6a;
  --fh: 'Sora', sans-serif;
  --fm: 'JetBrains Mono', monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--fh);font-size:14px;min-height:100vh;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px;}

.root{min-height:100vh;position:relative;}

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(5,13,26,.94);
  backdrop-filter:blur(20px);border-bottom:1px solid rgba(6,214,245,.12);
  padding:0 1.5rem;height:60px;display:flex;align-items:center;gap:1rem;}
.nav-left{min-width:120px;}
.nav-center{flex:1;display:flex;align-items:center;justify-content:center;gap:.6rem;}
.nav-right{min-width:120px;display:flex;justify-content:flex-end;gap:.5rem;}
.nav-title{font-size:1rem;font-weight:700;color:var(--text);}
.back-btn{color:var(--cyan);text-decoration:none;font-size:.82rem;font-weight:600;
  display:flex;align-items:center;gap:4px;transition:opacity .15s;}
.back-btn:hover{opacity:.75;}
.unread-badge{background:rgba(239,68,68,.18);color:#fc8181;border:1px solid rgba(239,68,68,.3);
  border-radius:20px;padding:2px 9px;font-family:var(--fm);font-size:.6rem;font-weight:700;}
.mark-all-btn{background:rgba(6,214,245,.08);border:1px solid rgba(6,214,245,.2);border-radius:6px;
  padding:5px 12px;color:var(--muted);font-size:.72rem;font-weight:600;cursor:pointer;transition:all .15s;}
.mark-all-btn:hover{color:var(--cyan);border-color:var(--cyan);}

/* MAIN */
.main{max-width:760px;margin:0 auto;padding:1.5rem 1rem 4rem;position:relative;z-index:1;}

/* FILTER */
.filter-row{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem;}
.chip{background:rgba(10,25,60,.8);border:1px solid rgba(6,214,245,.15);border-radius:20px;
  padding:.35rem 1rem;color:var(--muted);cursor:pointer;font-size:.78rem;font-weight:600;transition:all .2s;}
.chip.act{background:rgba(6,214,245,.12);border-color:var(--cyan);color:var(--cyan);}

/* NOTIF LIST */
.notif-list{display:flex;flex-direction:column;gap:.6rem;}
.notif-card{background:rgba(10,25,60,.78);border:1px solid var(--border);border-radius:12px;
  padding:1rem 1.1rem;display:flex;gap:.9rem;align-items:flex-start;cursor:pointer;
  transition:all .2s;backdrop-filter:blur(12px);animation:slideIn .3s ease both;}
.notif-card:hover{border-color:var(--border2);transform:translateX(2px);}
.notif-card.unread{background:rgba(11,25,70,.88);border-color:rgba(6,214,245,.2);}
@keyframes slideIn{from{opacity:0;transform:translateX(10px);}to{opacity:1;transform:none;}}
.notif-icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;font-size:1.25rem;}
.notif-header{display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;}
.notif-title{color:var(--text);font-weight:700;font-size:.86rem;flex:1;}
.unread-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.notif-body{color:var(--muted);font-size:.78rem;line-height:1.55;margin:.15rem 0 .35rem;}
.notif-time{font-family:var(--fm);font-size:.62rem;color:var(--dim);}
.notif-project{font-family:var(--fm);font-size:.58rem;color:var(--cyan);margin-top:3px;}
.dismiss-btn{background:none;border:none;color:var(--dim);cursor:pointer;font-size:.85rem;
  padding:.1rem .2rem;transition:color .15s;flex-shrink:0;}
.dismiss-btn:hover{color:var(--red);}
.notif-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
.notif-action{padding:4px 12px;border-radius:5px;border:1px solid var(--border2);
  background:transparent;color:var(--muted);font-family:var(--fm);font-size:.6rem;
  cursor:pointer;transition:all .15s;}
.notif-action.pri{border-color:rgba(6,214,245,.3);background:rgba(6,214,245,.08);color:var(--cyan);}
.notif-action:hover{border-color:var(--cyan);color:var(--cyan);}
.notif-action.pri:hover{background:rgba(6,214,245,.16);}

/* EMPTY */
.empty-state{display:flex;flex-direction:column;align-items:center;padding:5rem 1rem;gap:.4rem;text-align:center;}
.empty-icon{font-size:3rem;margin-bottom:.5rem;}

/* LOADING */
.loading{display:flex;align-items:center;justify-content:center;padding:4rem;gap:12px;}
.spinner{width:28px;height:28px;border:2px solid rgba(6,214,245,.15);border-top-color:var(--cyan);
  border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;

const FILTERS = [
  ["all","All"],["unread","Unread"],["request","Requests"],
  ["message","Messages"],["session","Sessions"],["review","Reviews"],["task","Tasks"],
];

export default function MentorNotifications() {
  const [user,   setUser]   = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading,setLoading]= useState(true);
  const navigate = useNavigate();

  /* ── auth + realtime listener ─────────────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { navigate("/mentor/login"); return; }
      setUser(u);

      /* Real-time listener on notifications collection filtered by uid */
      const q = query(
        collection(db, "notifications"),
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const unsubNotifs = onSnapshot(q, snap => {
        setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });

      return unsubNotifs;
    });
    return unsub;
  }, [navigate]);

  /* Also listen for mentor requests directed at this user and auto-create notifications */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "mentorRequests"),
      where("mentorId", "==", user.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, async snap => {
      for (const change of snap.docChanges()) {
        if (change.type === "added") {
          const req = change.doc.data();
          /* Check if notification already exists for this request */
          const existingQ = query(
            collection(db,"notifications"),
            where("uid","==",user.uid),
            where("requestId","==",change.doc.id)
          );
          const existingSnap = await getDocs(existingQ);
          if (existingSnap.empty) {
            await addDoc(collection(db,"notifications"), {
              uid: user.uid,
              type: "request",
              icon: "👥",
              title: "New Mentorship Request",
              body: `Team '${req.projectName}' (${req.studentName}) wants your mentorship. Slot: ${req.slot} via ${req.mode}.`,
              projectId: req.projectId,
              requestId: change.doc.id,
              read: false,
              createdAt: serverTimestamp(),
            });
          }
        }
      }
    });
  }, [user]);

  /* ── ops ──────────────────────────────────────────────────── */
  const markRead = async (id) => {
    await updateDoc(doc(db,"notifications",id),{read:true});
  };
  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifs.filter(n=>!n.read).forEach(n => batch.update(doc(db,"notifications",n.id),{read:true}));
    await batch.commit();
  };
  const dismiss = async (id) => {
    await deleteDoc(doc(db,"notifications",id));
  };

  /* Action: navigate to project when clicking a request notification */
  const handleAction = (notif) => {
    if (notif.projectId) navigate(`/team-dashboard/${notif.projectId}`);
  };

  const filtered = notifs.filter(n => {
    if (filter==="all") return true;
    if (filter==="unread") return !n.read;
    return n.type===filter;
  });
  const unreadCount = notifs.filter(n=>!n.read).length;

  return (
    <>
      <style>{CSS}</style>
      <div className="root">
        <DotsCanvas/>

        <nav className="nav">
          <div className="nav-left">
            <Link to="/mentor/dashboard" className="back-btn">← Dashboard</Link>
          </div>
          <div className="nav-center">
            <span style={{fontSize:"1.1rem"}}>🔔</span>
            <span className="nav-title">Notifications</span>
            {unreadCount>0&&<span className="unread-badge">{unreadCount} unread</span>}
          </div>
          <div className="nav-right">
            {unreadCount>0&&<button onClick={markAllRead} className="mark-all-btn">Mark all read</button>}
          </div>
        </nav>

        <main className="main">
          <div className="filter-row">
            {FILTERS.map(([val,label])=>(
              <button key={val} onClick={()=>setFilter(val)} className={`chip${filter===val?" act":""}`}>
                {label}
                {val==="unread"&&unreadCount>0&&` (${unreadCount})`}
              </button>
            ))}
          </div>

          {loading&&(
            <div className="loading">
              <div className="spinner"/>
              <span style={{fontFamily:"var(--fm)",fontSize:".7rem",color:"var(--muted)"}}>Loading…</span>
            </div>
          )}

          {!loading&&filtered.length===0&&(
            <div className="empty-state">
              <div className="empty-icon">🔕</div>
              <h3 style={{color:"var(--text)",margin:".4rem 0 .2rem",fontWeight:700}}>All Clear!</h3>
              <p style={{color:"var(--muted)",fontSize:".82rem"}}>
                {filter!=="all"?`No ${filter} notifications.`:"No notifications yet."}
              </p>
              {filter!=="all"&&<button onClick={()=>setFilter("all")} className="chip act" style={{marginTop:12}}>View All</button>}
            </div>
          )}

          {!loading&&filtered.length>0&&(
            <div className="notif-list">
              {filtered.map((n,i)=>{
                const meta = TYPE_META[n.type]||TYPE_META.system;
                return (
                  <div key={n.id}
                    className={`notif-card${!n.read?" unread":""}`}
                    style={{animationDelay:`${i*.04}s`}}
                    onClick={()=>markRead(n.id)}>
                    <div className="notif-icon"
                      style={{background:`${meta.color}14`,border:`1px solid ${meta.color}30`}}>
                      <span>{n.icon||"🔔"}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="notif-header">
                        <span className="notif-title">{n.title}</span>
                        {!n.read&&<span className="unread-dot" style={{background:meta.color}}/>}
                      </div>
                      <div className="notif-body">{n.body}</div>
                      {n.projectId&&(
                        <div className="notif-project">📎 Project: {n.projectName||n.projectId.slice(0,12)+"…"}</div>
                      )}
                      <div className="notif-time">{timeAgo(n.createdAt)}</div>
                      {/* Action buttons for actionable notifications */}
                      {(n.type==="request"||n.type==="session")&&n.projectId&&(
                        <div className="notif-actions">
                          <button className="notif-action pri" onClick={e=>{e.stopPropagation();handleAction(n);}}>
                            View Project →
                          </button>
                          <button className="notif-action" onClick={e=>{e.stopPropagation();markRead(n.id);}}>
                            Mark read
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="dismiss-btn"
                      onClick={e=>{e.stopPropagation();dismiss(n.id);}}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}