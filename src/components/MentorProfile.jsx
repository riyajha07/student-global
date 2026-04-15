import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
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
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const N = Math.floor((window.innerWidth * window.innerHeight) / 9000);
    for (let i = 0; i < N; i++) dots.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 + 0.8, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, opacity: Math.random() * 0.45 + 0.15 });
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d, i) => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,179,237,${d.opacity})`; ctx.fill();
        dots.forEach((d2, j) => {
          if (j <= i) return;
          const dx = d.x - d2.x, dy = d.y - d2.y, dist = Math.sqrt(dx*dx+dy*dy);
          if (dist < 110) { ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d2.x,d2.y); ctx.strokeStyle = `rgba(99,179,237,${0.1*(1-dist/110)})`; ctx.lineWidth=0.5; ctx.stroke(); }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none" }} />;
}

const AVATARS = [
  "👨‍💼","👩‍💼","👨‍🔬","👩‍🔬","👨‍💻","👩‍💻","👨‍🏫","👩‍🏫","👨‍⚕️","👩‍⚕️",
  "👨‍🚀","👩‍🚀","👨‍⚖️","👩‍⚖️","🧑‍💼","🧑‍🔬","🧑‍💻","🧑‍🏫","🧔","👱",
  "🧑‍🎓","👨‍🎓","👩‍🎓","🧑‍🚀","🧑‍⚕️"
];

const COUNTRIES = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Canada","Chile","China","Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kenya","South Korea","Malaysia","Mexico","Morocco","Netherlands","New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Singapore","South Africa","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Vietnam","Others"];

const DOMAINS = ["Software Engineering","Data Science & AI","Product Management","UI/UX Design","Business & Entrepreneurship","Marketing & Growth","Finance & FinTech","Biotech & Life Sciences","Mechanical Engineering","Civil Engineering","Electrical Engineering","Law & Compliance","Healthcare","Education & EdTech","Research & Academia","Creative Arts & Media","Supply Chain & Operations","Cybersecurity","Blockchain & Web3","Others"];

const STEP_LABELS = ["Identity","Education & Career","Mentoring Style","Documents & Links","Profile & Pricing"];

const InputField = ({ label, type = "text", value, onChange, placeholder, required }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:"0.35rem" }}>
    <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em" }}>{label}{required && <span style={{color:"#f687b3"}}> *</span>}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required}
      style={{ background:"rgba(15,30,70,0.7)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"0.7rem",padding:"0.7rem 0.9rem",color:"#e2e8f0",fontSize:"0.9rem",outline:"none",width:"100%",boxSizing:"border-box" }}
      onFocus={e=>e.target.style.borderColor="#63b3ed"} onBlur={e=>e.target.style.borderColor="rgba(99,179,237,0.25)"} />
  </div>
);

const SelectField = ({ label, value, onChange, options, required }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:"0.35rem" }}>
    <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em" }}>{label}{required && <span style={{color:"#f687b3"}}> *</span>}</label>
    <select value={value} onChange={e=>onChange(e.target.value)} required={required}
      style={{ background:"rgba(15,30,70,0.9)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"0.7rem",padding:"0.7rem 0.9rem",color: value ? "#e2e8f0" : "#64748b",fontSize:"0.9rem",outline:"none",width:"100%",boxSizing:"border-box" }}
      onFocus={e=>e.target.style.borderColor="#63b3ed"} onBlur={e=>e.target.style.borderColor="rgba(99,179,237,0.25)"}>
      <option value="" disabled>Select...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const TextareaField = ({ label, value, onChange, placeholder, rows = 3, required }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:"0.35rem" }}>
    <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em" }}>{label}{required && <span style={{color:"#f687b3"}}> *</span>}</label>
    <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} rows={rows}
      style={{ background:"rgba(15,30,70,0.7)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"0.7rem",padding:"0.7rem 0.9rem",color:"#e2e8f0",fontSize:"0.9rem",outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit" }}
      onFocus={e=>e.target.style.borderColor="#63b3ed"} onBlur={e=>e.target.style.borderColor="rgba(99,179,237,0.25)"} />
  </div>
);

export default function MentorProfile() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Step 1 - Identity
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");

  // Step 2 - Education & Career
  const [education, setEducation] = useState("");
  const [domain, setDomain] = useState("");
  const [experience, setExperience] = useState("");
  const [orgName, setOrgName] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [exRole, setExRole] = useState("");
  const [whyMentor, setWhyMentor] = useState("");
  const [biggestChallenge, setBiggestChallenge] = useState("");

  // Step 3 - Mentoring Style
  const [mentoringDuration, setMentoringDuration] = useState("");
  const [helpOffer, setHelpOffer] = useState("");
  const [mentorStyle, setMentorStyle] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [availability, setAvailability] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [pastMentoring, setPastMentoring] = useState("");

  // Step 4 - Documents & Links
//   const [resumeFile, setResumeFile] = useState(null);
//   const [certFile, setCertFile] = useState(null);
  const [linkedIn, setLinkedIn] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [github, setGithub] = useState("");

  // Step 5 - Profile & Pricing
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [languages, setLanguages] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/mentor/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "mentors", u.uid));
      if (snap.exists() && snap.data().profileComplete) navigate("/mentor/dashboard");
    });
    return unsub;
  }, [navigate]);

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const handleSubmit = async () => {
    if (!avatar) { setError("Please choose an avatar."); return; }
    if (!bio.trim()) { setError("Please write a short bio."); return; }
    setSaving(true); setError("");
    try {
    //   const resumeUrl = await uploadFile(resumeFile, `mentors/${user.uid}/resume`);
    //   const certUrl = await uploadFile(certFile, `mentors/${user.uid}/certification`);
      await setDoc(doc(db, "mentors", user.uid), {
        uid: user.uid, email: user.email,
        fullName, gender, country, age: parseInt(age),
        education, domain, experience: parseInt(experience), orgName, currentRole, exRole,
        whyMentor, biggestChallenge,
        mentoringDuration, helpOffer, mentorStyle, teamSize, availability, successMetric, pastMentoring,
         linkedIn, portfolio, github,
        avatar, bio, price: parseFloat(price) || 0, currency, languages, tags,
        profileComplete: true, updatedAt: serverTimestamp(),
      }, { merge: true });
      navigate("/mentor/dashboard");
    } catch (err) {
      setError("Failed to save profile. Please try again.");
      console.error(err);
    }
    setSaving(false);
  };

  const canNext = () => {
    if (step === 0) return fullName && gender && country && age;
    if (step === 1) return education && domain && experience && orgName && currentRole && whyMentor;
    if (step === 2) return mentoringDuration && helpOffer && mentorStyle;
    if (step === 3) return linkedIn;
    return true;
  };

  const stepContent = [
    // Step 0 - Identity
    <div key="s0" style={styles.grid2}>
      <div style={{ gridColumn:"1/-1" }}>
        <InputField label="Full Name" value={fullName} onChange={setFullName} placeholder="Dr. Jane Smith" required />
      </div>
      <SelectField label="Gender" value={gender} onChange={setGender} options={["Male","Female","Non-binary","Prefer not to say"]} required />
      <SelectField label="Country" value={country} onChange={setCountry} options={COUNTRIES} required />
      <InputField label="Age" type="number" value={age} onChange={setAge} placeholder="30" required />
      <SelectField label="Domain / Field" value={domain} onChange={setDomain} options={DOMAINS} required />
    </div>,

    // Step 1 - Education & Career
    <div key="s1" style={styles.grid2}>
      <div style={{ gridColumn:"1/-1" }}>
        <SelectField label="Highest Education" value={education} onChange={setEducation}
          options={["High School","Bachelor's Degree","Master's Degree","MBA","PhD","Post-Doctoral","Professional Certification","Self-Taught","Other"]} required />
      </div>
      <InputField label="Current Organisation" value={orgName} onChange={setOrgName} placeholder="Google, MIT, etc." required />
      <InputField label="Current Role" value={currentRole} onChange={setCurrentRole} placeholder="Senior Engineer" required />
      <InputField label="Previous Role(s)" value={exRole} onChange={setExRole} placeholder="Junior Developer at XYZ" />
      <InputField label="Years of Experience" type="number" value={experience} onChange={setExperience} placeholder="8" required />
      <div style={{ gridColumn:"1/-1" }}>
        <TextareaField label="Why do you want to mentor student teams?" value={whyMentor} onChange={setWhyMentor}
          placeholder="Share your motivation and what drives you to give back..." required rows={3} />
      </div>
      <div style={{ gridColumn:"1/-1" }}>
        <TextareaField label="What is the biggest challenge student teams face in your domain?" value={biggestChallenge} onChange={setBiggestChallenge}
          placeholder="Based on your experience, what do most student teams struggle with?" rows={3} />
      </div>
    </div>,

    // Step 2 - Mentoring Style
    <div key="s2" style={styles.grid2}>
      <div style={{ gridColumn:"1/-1" }}>
        <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em",display:"block",marginBottom:"0.5rem" }}>Preferred Mentoring Duration <span style={{color:"#f687b3"}}>*</span></label>
        <div style={{ display:"flex",flexWrap:"wrap",gap:"0.6rem" }}>
          {["3 days","9 days","15 days","30 days"].map(d => (
            <button key={d} type="button" onClick={() => setMentoringDuration(d)}
              style={{ ...styles.chip, ...(mentoringDuration === d ? styles.chipActive : {}) }}>{d}</button>
          ))}
        </div>
      </div>
      <div style={{ gridColumn:"1/-1" }}>
        <TextareaField label="What specific help will you offer to the team?" value={helpOffer} onChange={setHelpOffer}
          placeholder="e.g., Code reviews, architecture design, presentation coaching, career guidance..." required rows={3} />
      </div>
      <SelectField label="Your Mentoring Style" value={mentorStyle} onChange={setMentorStyle}
        options={["Hands-on (do together)","Advisory (guide & review)","Socratic (question-led)","Structured (curriculum-based)","Flexible (adapt to team)"]} required />
      <SelectField label="Preferred Team Size" value={teamSize} onChange={setTeamSize}
        options={["1-2 members","3-5 members","6-10 members","Any size"]} />
      <SelectField label="Weekly Availability" value={availability} onChange={setAvailability}
        options={["1-2 hours/week","3-5 hours/week","5-10 hours/week","10+ hours/week"]} />
      <div style={{ gridColumn:"1/-1" }}>
        <TextareaField label="How do you measure a team's success?" value={successMetric} onChange={setSuccessMetric}
          placeholder="What outcomes or milestones define success for a mentored team?" rows={2} />
      </div>
      <div style={{ gridColumn:"1/-1" }}>
        <TextareaField label="Describe any past mentoring or teaching experience" value={pastMentoring} onChange={setPastMentoring}
          placeholder="Include hackathons, bootcamps, university, corporate training, etc." rows={2} />
      </div>
    </div>,

    // Step 3 - Documents & Links
    <div key="s3" style={{ display:"flex",flexDirection:"column",gap:"1rem" }}>
      {/* <div style={styles.fileUpload}>
        <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em",display:"block",marginBottom:"0.4rem" }}>Upload Resume / CV</label>
        <label style={styles.fileLabel}>
          <span>{resumeFile ? `✓ ${resumeFile.name}` : "📄 Click to upload PDF or DOCX"}</span>
          <input type="file" accept=".pdf,.doc,.docx" onChange={e=>setResumeFile(e.target.files[0])} style={{ display:"none" }} />
        </label>
      </div>
      <div style={styles.fileUpload}>
        <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em",display:"block",marginBottom:"0.4rem" }}>Upload Certifications (optional)</label>
        <label style={styles.fileLabel}>
          <span>{certFile ? `✓ ${certFile.name}` : "🏆 Click to upload PDF or image"}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setCertFile(e.target.files[0])} style={{ display:"none" }} />
        </label> */}
      {/* </div> */}
      <InputField label="LinkedIn Profile URL" value={linkedIn} onChange={setLinkedIn} placeholder="https://linkedin.com/in/yourname" required />
      <InputField label="Portfolio / Personal Website" value={portfolio} onChange={setPortfolio} placeholder="https://yourportfolio.com" />
      <InputField label="GitHub Profile" value={github} onChange={setGithub} placeholder="https://github.com/yourusername" />
      <InputField label="Languages you can mentor in" value={languages} onChange={setLanguages} placeholder="English, Hindi, Spanish..." />
      <InputField label="Tags / Skills (comma separated)" value={tags} onChange={setTags} placeholder="React, Machine Learning, Leadership, Agile..." />
    </div>,

    // Step 4 - Profile & Pricing
    <div key="s4" style={{ display:"flex",flexDirection:"column",gap:"1.2rem" }}>
      <div>
        <label style={{ color:"#90cdf4",fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em",display:"block",marginBottom:"0.6rem" }}>Choose Your Avatar <span style={{color:"#f687b3"}}>*</span></label>
        <div style={{ display:"flex",flexWrap:"wrap",gap:"0.5rem" }}>
          {AVATARS.map((av, i) => (
            <button key={i} type="button" onClick={() => setAvatar(av)}
              style={{ fontSize:"2rem",background: avatar===av ? "rgba(99,179,237,0.2)" : "rgba(15,30,70,0.5)", border: avatar===av ? "2px solid #63b3ed" : "2px solid rgba(99,179,237,0.15)", borderRadius:"0.6rem", padding:"0.35rem 0.5rem", cursor:"pointer", transition:"all 0.15s" }}>
              {av}
            </button>
          ))}
        </div>
      </div>
      <TextareaField label="Your Bio" value={bio} onChange={setBio} required rows={4}
        placeholder="Write a compelling bio that showcases your expertise and what makes you a great mentor. This is what students will see first..." />
      <div style={styles.grid2}>
        <InputField label="Mentoring Fee (per session)" type="number" value={price} onChange={setPrice} placeholder="50" />
        <SelectField label="Currency" value={currency} onChange={setCurrency} options={["USD","EUR","GBP","INR","CAD","AUD","SGD","Free"]} />
      </div>
      <div style={styles.infoBox}>
        <span style={{fontSize:"1.1rem"}}>💡</span>
        <span style={{color:"#90cdf4",fontSize:"0.85rem"}}>Setting a competitive price helps attract serious student teams. You can always update this later from your dashboard.</span>
      </div>
    </div>,
  ];

  return (
    <div style={styles.root}>
      <DotsCanvas />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={{fontSize:"1.4rem"}}>🎓</span>
            <span style={styles.logoText}>MentorHub — Profile Setup</span>
          </div>
          <h1 style={styles.heading}>
            {["Tell Us About Yourself","Your Journey & Career","Your Mentoring Approach","Documents & Online Presence","Finalize Your Profile"][step]}
          </h1>
          <p style={styles.sub}>Step {step+1} of 5 — {STEP_LABELS[step]}</p>
        </div>

        {/* Progress Bar */}
        <div style={styles.progressWrap}>
          {STEP_LABELS.map((l, i) => (
            <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:"center",flex:1 }}>
              <div style={{ ...styles.stepDot, background: i <= step ? "linear-gradient(135deg,#63b3ed,#a78bfa)" : "rgba(99,179,237,0.15)", border: i === step ? "2px solid #63b3ed" : "2px solid transparent" }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize:"0.65rem",color: i <= step ? "#90cdf4" : "#4a5568",marginTop:"0.25rem",textAlign:"center",display: window.innerWidth < 500 ? "none" : "block" }}>{l}</span>
              {i < 4 && <div style={{ position:"absolute",left:"50%",top:"50%",width:"100%",height:"1px" }} />}
            </div>
          ))}
        </div>
        <div style={styles.progressBarOuter}>
          <div style={{ ...styles.progressBarInner, width: `${(step / 4) * 100}%` }} />
        </div>

        {/* Card */}
        <div style={styles.card}>
          {error && <div style={styles.errorBox}>{error}</div>}
          {stepContent[step]}

          <div style={styles.btnRow}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={styles.backBtn}>← Back</button>
            )}
            {step < 4 ? (
              <button onClick={() => { if (canNext()) { setError(""); setStep(s=>s+1); } else setError("Please fill in all required fields."); }}
                style={{ ...styles.nextBtn, marginLeft: step === 0 ? "auto" : undefined }}>
                Continue →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                style={{ ...styles.nextBtn, marginLeft:"auto", background:"linear-gradient(135deg,#276749,#2b6cb0)", minWidth:"160px" }}>
                {saving ? <span style={styles.spinner} /> : "🚀 Launch Profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight:"100vh",background:"linear-gradient(135deg,#050d1a 0%,#071428 40%,#0a1f3d 100%)",fontFamily:"'Sora','Nunito',sans-serif",padding:"1rem",position:"relative",display:"flex",justifyContent:"center" },
  container: { position:"relative",zIndex:1,width:"100%",maxWidth:"680px",paddingBottom:"3rem" },
  header: { textAlign:"center",paddingTop:"2rem",marginBottom:"1.5rem" },
  logoRow: { display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem",marginBottom:"0.8rem" },
  logoText: { fontSize:"1rem",fontWeight:700,background:"linear-gradient(90deg,#63b3ed,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" },
  heading: { fontSize:"clamp(1.3rem,4vw,1.9rem)",fontWeight:800,margin:"0 0 0.3rem",background:"linear-gradient(90deg,#90cdf4,#a78bfa,#f687b3)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" },
  sub: { color:"#64748b",fontSize:"0.88rem" },
  progressWrap: { display:"flex",justifyContent:"space-between",position:"relative",marginBottom:"0.6rem",padding:"0 0.5rem" },
  stepDot: { width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,color:"#fff",transition:"all 0.3s" },
  progressBarOuter: { height:"4px",background:"rgba(99,179,237,0.12)",borderRadius:"2px",marginBottom:"1.5rem",overflow:"hidden" },
  progressBarInner: { height:"100%",background:"linear-gradient(90deg,#63b3ed,#a78bfa)",borderRadius:"2px",transition:"width 0.4s ease" },
  card: { background:"rgba(10,25,60,0.82)",border:"1px solid rgba(99,179,237,0.18)",borderRadius:"1.3rem",padding:"2rem 1.5rem",backdropFilter:"blur(18px)",boxShadow:"0 8px 60px rgba(0,0,0,0.4)" },
  grid2: { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"1rem" },
  chip: { background:"rgba(15,30,70,0.7)",border:"1px solid rgba(99,179,237,0.25)",borderRadius:"2rem",padding:"0.4rem 1rem",color:"#94a3b8",cursor:"pointer",fontSize:"0.88rem",transition:"all 0.2s" },
  chipActive: { background:"rgba(99,179,237,0.2)",border:"1px solid #63b3ed",color:"#63b3ed",fontWeight:700 },
  fileUpload: {},
  fileLabel: { display:"block",background:"rgba(15,30,70,0.5)",border:"2px dashed rgba(99,179,237,0.3)",borderRadius:"0.7rem",padding:"1rem",textAlign:"center",color:"#64748b",cursor:"pointer",transition:"border-color 0.2s",fontSize:"0.9rem" },
  infoBox: { display:"flex",gap:"0.6rem",background:"rgba(99,179,237,0.07)",border:"1px solid rgba(99,179,237,0.15)",borderRadius:"0.7rem",padding:"0.8rem 1rem",alignItems:"flex-start" },
  btnRow: { display:"flex",gap:"0.8rem",marginTop:"1.8rem",alignItems:"center" },
  backBtn: { background:"rgba(15,30,70,0.6)",border:"1px solid rgba(99,179,237,0.2)",borderRadius:"0.7rem",padding:"0.7rem 1.2rem",color:"#90cdf4",cursor:"pointer",fontWeight:600,fontSize:"0.9rem" },
  nextBtn: { background:"linear-gradient(135deg,#2b6cb0,#553c9a)",border:"none",borderRadius:"0.7rem",padding:"0.75rem 1.8rem",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:"0.95rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem" },
  errorBox: { background:"rgba(245,101,101,0.12)",border:"1px solid rgba(245,101,101,0.3)",color:"#fc8181",borderRadius:"0.7rem",padding:"0.7rem 1rem",fontSize:"0.85rem",marginBottom:"1rem" },
  spinner: { width:"18px",height:"18px",border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block" },
};