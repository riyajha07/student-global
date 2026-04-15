import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
const storage = getStorage(app);

function DotsCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId, dots = [];
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const N = Math.floor((window.innerWidth*window.innerHeight)/10000);
    for(let i=0;i<N;i++) dots.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+0.6,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,opacity:Math.random()*0.3+0.12});
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      dots.forEach((d,i)=>{
        d.x+=d.vx;d.y+=d.vy;
        if(d.x<0||d.x>canvas.width)d.vx*=-1;if(d.y<0||d.y>canvas.height)d.vy*=-1;
        ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fillStyle=`rgba(99,179,237,${d.opacity})`;ctx.fill();
        dots.forEach((d2,j)=>{
          if(j<=i)return;
          const dx=d.x-d2.x,dy=d.y-d2.y,dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<100){ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d2.x,d2.y);ctx.strokeStyle=`rgba(99,179,237,${0.08*(1-dist/100)})`;ctx.lineWidth=0.5;ctx.stroke();}
        });
      });
      animId=requestAnimationFrame(draw);
    };
    draw();
    return()=>{cancelAnimationFrame(animId);window.removeEventListener("resize",resize);};
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}} />;
}

const AVATARS = ["👨‍💼","👩‍💼","👨‍🔬","👩‍🔬","👨‍💻","👩‍💻","👨‍🏫","👩‍🏫","👨‍⚕️","👩‍⚕️","👨‍🚀","👩‍🚀","👨‍⚖️","👩‍⚖️","🧑‍💼","🧑‍🔬","🧑‍💻","🧑‍🏫","🧔","👱","🧑‍🎓","👨‍🎓","👩‍🎓","🧑‍🚀","🧑‍⚕️"];
const COUNTRIES = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Canada","Chile","China","Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kenya","South Korea","Malaysia","Mexico","Morocco","Netherlands","New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Singapore","South Africa","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Vietnam","Others"];
const DOMAINS = ["Software Engineering","Data Science & AI","Product Management","UI/UX Design","Business & Entrepreneurship","Marketing & Growth","Finance & FinTech","Biotech & Life Sciences","Mechanical Engineering","Civil Engineering","Electrical Engineering","Law & Compliance","Healthcare","Education & EdTech","Research & Academia","Creative Arts & Media","Supply Chain & Operations","Cybersecurity","Blockchain & Web3","Others"];

const Field = ({ label, children }) => (
  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
    <label style={{color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em"}}>{label}</label>
    {children}
  </div>
);

const inputStyle = { background:"rgba(15,30,70,0.7)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"0.7rem",padding:"0.7rem 0.9rem",color:"#e2e8f0",fontSize:"0.9rem",outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit" };

export default function UpdateMentorProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("identity");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName:"",gender:"",country:"",age:"",education:"",domain:"",experience:"",
    orgName:"",currentRole:"",exRole:"",whyMentor:"",biggestChallenge:"",
    mentoringDuration:"",helpOffer:"",mentorStyle:"",teamSize:"",availability:"",
    successMetric:"",pastMentoring:"",linkedIn:"",portfolio:"",github:"",
    languages:"",tags:"",avatar:"",bio:"",price:"",currency:"USD",
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [certFile, setCertFile] = useState(null);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/mentor/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "mentors", u.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          fullName: d.fullName||"", gender: d.gender||"", country: d.country||"", age: d.age||"",
          education: d.education||"", domain: d.domain||"", experience: d.experience||"",
          orgName: d.orgName||"", currentRole: d.currentRole||"", exRole: d.exRole||"",
          whyMentor: d.whyMentor||"", biggestChallenge: d.biggestChallenge||"",
          mentoringDuration: d.mentoringDuration||"", helpOffer: d.helpOffer||"",
          mentorStyle: d.mentorStyle||"", teamSize: d.teamSize||"", availability: d.availability||"",
          successMetric: d.successMetric||"", pastMentoring: d.pastMentoring||"",
          linkedIn: d.linkedIn||"", portfolio: d.portfolio||"", github: d.github||"",
          languages: d.languages||"", tags: d.tags||"",
          avatar: d.avatar||"", bio: d.bio||"", price: d.price||"", currency: d.currency||"USD",
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [navigate]);

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const updates = { ...form, age: parseInt(form.age)||0, experience: parseInt(form.experience)||0, price: parseFloat(form.price)||0, updatedAt: serverTimestamp(), profileComplete: true };
      if (resumeFile) updates.resumeUrl = await uploadFile(resumeFile, `mentors/${user.uid}/resume`);
      if (certFile) updates.certUrl = await uploadFile(certFile, `mentors/${user.uid}/certification`);
      await setDoc(doc(db, "mentors", user.uid), updates, { merge: true });
      setSuccess(true);
      setTimeout(() => navigate("/mentor/dashboard"), 1500);
    } catch (err) {
      setError("Failed to save changes. Please try again."); console.error(err);
    }
    setSaving(false);
  };

  const sections = [
    { id:"identity", label:"Identity", icon:"👤" },
    { id:"career", label:"Career", icon:"💼" },
    { id:"mentoring", label:"Mentoring", icon:"🎯" },
    { id:"docs", label:"Docs & Links", icon:"🔗" },
    { id:"profile", label:"Profile & Price", icon:"⚙️" },
  ];

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#050d1a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <DotsCanvas />
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",border:"3px solid rgba(99,179,237,0.2)",borderTop:"3px solid #63b3ed",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 1rem"}} />
        <div style={{color:"#64748b"}}>Loading profile...</div>
      </div>
    </div>
  );

  return (
    <div style={styles.root}>
      <DotsCanvas />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} select option{background:#0a1f3d;color:#e2e8f0}`}</style>

      {/* Nav */}
      <nav style={styles.nav}>
        <Link to="/mentor/dashboard" style={styles.backBtn}>← Back to Dashboard</Link>
        <div style={styles.navCenter}>
          <span style={{fontSize:"1rem"}}>🎓</span>
          <span style={styles.navTitle}>Update Profile</span>
        </div>
        <button onClick={handleSave} disabled={saving} style={styles.saveNavBtn}>
          {saving ? <span style={styles.spinner} /> : success ? "✓ Saved!" : "Save Changes"}
        </button>
      </nav>

      <div style={styles.layout}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.avatarPreview}>
            <span style={{fontSize:"3rem"}}>{form.avatar||"👨‍💼"}</span>
            <div>
              <div style={{color:"#e2e8f0",fontWeight:700,fontSize:"0.95rem"}}>{form.fullName||"Your Name"}</div>
              <div style={{color:"#64748b",fontSize:"0.8rem"}}>{form.currentRole||"Role"}</div>
            </div>
          </div>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{...styles.sideTab, ...(activeSection===s.id ? styles.sideTabActive : {})}}>
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main style={styles.content}>
          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>✓ Profile updated successfully! Redirecting...</div>}

          {activeSection === "identity" && (
            <Section title="Identity & Personal Info">
              <div style={styles.grid2}>
                <div style={{gridColumn:"1/-1"}}><Field label="Full Name"><input style={inputStyle} value={form.fullName} onChange={e=>set("fullName")(e.target.value)} placeholder="Dr. Jane Smith" /></Field></div>
                <Field label="Gender">
                  <select style={inputStyle} value={form.gender} onChange={e=>set("gender")(e.target.value)}>
                    <option value="">Select...</option>
                    {["Male","Female","Non-binary","Prefer not to say"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Age"><input style={inputStyle} type="number" value={form.age} onChange={e=>set("age")(e.target.value)} placeholder="30" /></Field>
                <Field label="Country">
                  <select style={inputStyle} value={form.country} onChange={e=>set("country")(e.target.value)}>
                    <option value="">Select...</option>
                    {COUNTRIES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Domain">
                  <select style={inputStyle} value={form.domain} onChange={e=>set("domain")(e.target.value)}>
                    <option value="">Select...</option>
                    {DOMAINS.map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          {activeSection === "career" && (
            <Section title="Education & Career">
              <div style={styles.grid2}>
                <div style={{gridColumn:"1/-1"}}>
                  <Field label="Highest Education">
                    <select style={inputStyle} value={form.education} onChange={e=>set("education")(e.target.value)}>
                      <option value="">Select...</option>
                      {["High School","Bachelor's Degree","Master's Degree","MBA","PhD","Post-Doctoral","Professional Certification","Self-Taught","Other"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Organisation"><input style={inputStyle} value={form.orgName} onChange={e=>set("orgName")(e.target.value)} placeholder="Google, MIT..." /></Field>
                <Field label="Current Role"><input style={inputStyle} value={form.currentRole} onChange={e=>set("currentRole")(e.target.value)} placeholder="Senior Engineer" /></Field>
                <Field label="Previous Role(s)"><input style={inputStyle} value={form.exRole} onChange={e=>set("exRole")(e.target.value)} placeholder="Junior Dev at XYZ" /></Field>
                <Field label="Years of Experience"><input style={inputStyle} type="number" value={form.experience} onChange={e=>set("experience")(e.target.value)} placeholder="8" /></Field>
                <div style={{gridColumn:"1/-1"}}><Field label="Why do you mentor?"><textarea style={{...inputStyle,resize:"vertical"}} rows={3} value={form.whyMentor} onChange={e=>set("whyMentor")(e.target.value)} placeholder="Your motivation..." /></Field></div>
                <div style={{gridColumn:"1/-1"}}><Field label="Biggest challenge student teams face"><textarea style={{...inputStyle,resize:"vertical"}} rows={2} value={form.biggestChallenge} onChange={e=>set("biggestChallenge")(e.target.value)} placeholder="Based on experience..." /></Field></div>
              </div>
            </Section>
          )}

          {activeSection === "mentoring" && (
            <Section title="Mentoring Approach">
              <div style={{display:"flex",flexDirection:"column",gap:"1.1rem"}}>
                <Field label="Preferred Mentoring Duration">
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.6rem"}}>
                    {["3 days","9 days","15 days","30 days"].map(d=>(
                      <button key={d} type="button" onClick={()=>set("mentoringDuration")(d)}
                        style={{...chipStyle, ...(form.mentoringDuration===d?chipActiveStyle:{})}}>{d}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Mentoring Style">
                  <select style={inputStyle} value={form.mentorStyle} onChange={e=>set("mentorStyle")(e.target.value)}>
                    <option value="">Select...</option>
                    {["Hands-on (do together)","Advisory (guide & review)","Socratic (question-led)","Structured (curriculum-based)","Flexible (adapt to team)"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Help You Offer"><textarea style={{...inputStyle,resize:"vertical"}} rows={3} value={form.helpOffer} onChange={e=>set("helpOffer")(e.target.value)} placeholder="Code reviews, architecture, presentations..." /></Field>
                <div style={styles.grid2}>
                  <Field label="Preferred Team Size">
                    <select style={inputStyle} value={form.teamSize} onChange={e=>set("teamSize")(e.target.value)}>
                      <option value="">Select...</option>
                      {["1-2 members","3-5 members","6-10 members","Any size"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Weekly Availability">
                    <select style={inputStyle} value={form.availability} onChange={e=>set("availability")(e.target.value)}>
                      <option value="">Select...</option>
                      {["1-2 hours/week","3-5 hours/week","5-10 hours/week","10+ hours/week"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="How do you measure team success?"><textarea style={{...inputStyle,resize:"vertical"}} rows={2} value={form.successMetric} onChange={e=>set("successMetric")(e.target.value)} /></Field>
                <Field label="Past mentoring experience"><textarea style={{...inputStyle,resize:"vertical"}} rows={2} value={form.pastMentoring} onChange={e=>set("pastMentoring")(e.target.value)} /></Field>
              </div>
            </Section>
          )}

          {activeSection === "docs" && (
            <Section title="Documents & Online Presence">
              <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                <Field label="Upload New Resume (optional)">
                  <label style={fileLabel}><span>{resumeFile ? `✓ ${resumeFile.name}` : "📄 Click to upload PDF / DOCX"}</span><input type="file" accept=".pdf,.doc,.docx" onChange={e=>setResumeFile(e.target.files[0])} style={{display:"none"}} /></label>
                </Field>
                <Field label="Upload New Certification (optional)">
                  <label style={fileLabel}><span>{certFile ? `✓ ${certFile.name}` : "🏆 Click to upload PDF / image"}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setCertFile(e.target.files[0])} style={{display:"none"}} /></label>
                </Field>
                <Field label="LinkedIn URL"><input style={inputStyle} value={form.linkedIn} onChange={e=>set("linkedIn")(e.target.value)} placeholder="https://linkedin.com/in/..." /></Field>
                <Field label="Portfolio / Website"><input style={inputStyle} value={form.portfolio} onChange={e=>set("portfolio")(e.target.value)} placeholder="https://yoursite.com" /></Field>
                <Field label="GitHub"><input style={inputStyle} value={form.github} onChange={e=>set("github")(e.target.value)} placeholder="https://github.com/..." /></Field>
                <Field label="Languages"><input style={inputStyle} value={form.languages} onChange={e=>set("languages")(e.target.value)} placeholder="English, Hindi, Spanish..." /></Field>
                <Field label="Skills / Tags"><input style={inputStyle} value={form.tags} onChange={e=>set("tags")(e.target.value)} placeholder="React, ML, Leadership..." /></Field>
              </div>
            </Section>
          )}

          {activeSection === "profile" && (
            <Section title="Profile & Pricing">
              <div style={{display:"flex",flexDirection:"column",gap:"1.2rem"}}>
                <Field label="Choose Avatar">
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginTop:"0.2rem"}}>
                    {AVATARS.map((av,i) => (
                      <button key={i} type="button" onClick={() => set("avatar")(av)}
                        style={{fontSize:"1.8rem",background:form.avatar===av?"rgba(99,179,237,0.2)":"rgba(15,30,70,0.5)",border:form.avatar===av?"2px solid #63b3ed":"2px solid rgba(99,179,237,0.15)",borderRadius:"0.5rem",padding:"0.3rem 0.4rem",cursor:"pointer",transition:"all 0.15s"}}>
                        {av}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Bio"><textarea style={{...inputStyle,resize:"vertical"}} rows={5} value={form.bio} onChange={e=>set("bio")(e.target.value)} placeholder="Write a compelling bio..." /></Field>
                <div style={styles.grid2}>
                  <Field label="Mentoring Fee (per session)"><input style={inputStyle} type="number" value={form.price} onChange={e=>set("price")(e.target.value)} placeholder="50" /></Field>
                  <Field label="Currency">
                    <select style={inputStyle} value={form.currency} onChange={e=>set("currency")(e.target.value)}>
                      {["USD","EUR","GBP","INR","CAD","AUD","SGD","Free"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </Section>
          )}

          <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? <span style={styles.spinner} /> : success ? "✓ Saved! Redirecting..." : "💾 Save All Changes"}
          </button>
        </main>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div>
    <h2 style={{fontSize:"1.1rem",fontWeight:800,background:"linear-gradient(90deg,#90cdf4,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:"1.2rem"}}>{title}</h2>
    {children}
  </div>
);

const chipStyle = { background:"rgba(15,30,70,0.7)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"2rem",padding:"0.4rem 1rem",color:"#94a3b8",cursor:"pointer",fontSize:"0.88rem",transition:"all 0.2s" };
const chipActiveStyle = { background:"rgba(99,179,237,0.2)",border:"1px solid #63b3ed",color:"#63b3ed",fontWeight:700 };
const fileLabel = { display:"block",background:"rgba(15,30,70,0.5)",border:"2px dashed rgba(99,179,237,0.3)",borderRadius:"0.7rem",padding:"0.9rem",textAlign:"center",color:"#64748b",cursor:"pointer",fontSize:"0.88rem" };

const styles = {
  root: { minHeight:"100vh",background:"linear-gradient(135deg,#050d1a 0%,#071428 40%,#0a1f3d 100%)",fontFamily:"'Sora','Nunito',sans-serif",position:"relative" },
  nav: { position:"sticky",top:0,zIndex:100,background:"rgba(5,13,26,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(99,179,237,0.12)",padding:"0 1.5rem",height:"56px",display:"flex",alignItems:"center",gap:"1rem" },
  navCenter: { flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem" },
  navTitle: { fontSize:"1rem",fontWeight:700,color:"#e2e8f0" },
  backBtn: { color:"#63b3ed",textDecoration:"none",fontSize:"0.85rem",fontWeight:600,whiteSpace:"nowrap" },
  saveNavBtn: { background:"linear-gradient(135deg,#2b6cb0,#553c9a)",border:"none",borderRadius:"0.5rem",padding:"0.4rem 1rem",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:"0.85rem",display:"flex",alignItems:"center",gap:"0.3rem",whiteSpace:"nowrap" },
  layout: { display:"grid",gridTemplateColumns:"200px 1fr",minHeight:"calc(100vh - 56px)",position:"relative",zIndex:1 },
  sidebar: { background:"rgba(5,13,26,0.7)",borderRight:"1px solid rgba(99,179,237,0.1)",padding:"1.5rem 1rem",display:"flex",flexDirection:"column",gap:"0.4rem",backdropFilter:"blur(12px)" },
  avatarPreview: { display:"flex",gap:"0.8rem",alignItems:"center",padding:"1rem",background:"rgba(10,25,60,0.5)",borderRadius:"0.8rem",marginBottom:"1rem",border:"1px solid rgba(99,179,237,0.12)" },
  sideTab: { background:"none",border:"none",borderRadius:"0.5rem",padding:"0.6rem 0.8rem",color:"#64748b",cursor:"pointer",fontSize:"0.85rem",fontWeight:600,display:"flex",alignItems:"center",gap:"0.5rem",textAlign:"left",transition:"all 0.2s" },
  sideTabActive: { background:"rgba(99,179,237,0.1)",color:"#90cdf4",borderLeft:"2px solid #63b3ed" },
  content: { padding:"2rem 1.5rem",maxWidth:"700px" },
  grid2: { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem" },
  errorBox: { background:"rgba(245,101,101,0.12)",border:"1px solid rgba(245,101,101,0.3)",color:"#fc8181",borderRadius:"0.7rem",padding:"0.7rem 1rem",fontSize:"0.85rem",marginBottom:"1rem" },
  successBox: { background:"rgba(104,211,145,0.12)",border:"1px solid rgba(104,211,145,0.3)",color:"#68d391",borderRadius:"0.7rem",padding:"0.7rem 1rem",fontSize:"0.85rem",marginBottom:"1rem" },
  saveBtn: { background:"linear-gradient(135deg,#2b6cb0,#553c9a)",border:"none",borderRadius:"0.7rem",padding:"0.85rem 2rem",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:"0.95rem",marginTop:"2rem",display:"flex",alignItems:"center",gap:"0.4rem" },
  spinner: { width:"16px",height:"16px",border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block" },
};