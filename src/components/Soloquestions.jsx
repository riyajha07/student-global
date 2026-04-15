import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, collection } from "firebase/firestore";
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
  :root{
    --bg:#020817;--bg2:#040f24;--navy:#071a3e;
    --blue:#0ea5e9;--cyan:#06d6f5;--glow:rgba(14,165,233,0.15);
    --accent:#00ffc8;--text:#e2f0ff;--muted:#7ba3c8;--err:#f87171;
    --font-h:'Orbitron',monospace;--font-b:'Rajdhani',sans-serif;--font-m:'Share Tech Mono',monospace;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--font-b);min-height:100vh}
  .sq-wrap{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem 3rem;position:relative;overflow:hidden}
  .sq-grid{position:fixed;inset:0;background:linear-gradient(rgba(6,214,245,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,214,245,0.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .sq-glow{position:fixed;width:600px;height:400px;background:radial-gradient(circle,rgba(14,165,233,0.07),transparent 70%);top:-100px;left:50%;transform:translateX(-50%);pointer-events:none}
  .sq-card{position:relative;z-index:1;background:rgba(4,15,36,0.9);border:1px solid rgba(14,165,233,0.2);border-radius:16px;width:100%;max-width:620px;padding:2rem 2.5rem;box-shadow:0 0 60px rgba(6,214,245,0.06)}
  @media(max-width:500px){.sq-card{padding:1.5rem 1.25rem}}
  .sq-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.75rem}
  .sq-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-family:var(--font-m);font-size:0.7rem;color:var(--muted);letter-spacing:0.08em;transition:color 0.2s;padding:0}
  .sq-back:hover{color:var(--cyan)}
  .sq-badge{font-family:var(--font-m);font-size:0.65rem;color:var(--accent);background:rgba(0,255,200,0.07);border:1px solid rgba(0,255,200,0.2);border-radius:4px;padding:3px 10px;letter-spacing:0.1em}
  /* Step bar */
  .sq-steps{display:flex;gap:6px;margin-bottom:1.75rem}
  .sq-step{flex:1;height:3px;border-radius:2px;background:rgba(14,165,233,0.12);transition:all 0.4s}
  .sq-step.done{background:var(--cyan)}
  .sq-step.active{background:linear-gradient(90deg,var(--cyan),var(--blue))}
  /* Header */
  .sq-sub{font-family:var(--font-m);font-size:0.68rem;color:var(--blue);letter-spacing:0.12em;margin-bottom:6px}
  .sq-h1{font-family:var(--font-h);font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;color:var(--text);letter-spacing:-0.01em;margin-bottom:1.5rem}
  .sq-h1 span{color:rgba(14,165,233,0.3)}
  /* Fields */
  .sq-label{display:block;font-family:var(--font-m);font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;margin-bottom:6px}
  .sq-field{margin-bottom:1.1rem}
  .sq-input,.sq-select,.sq-textarea{
    width:100%;padding:0.7rem 1rem;
    background:rgba(7,26,62,0.6);border:1px solid rgba(14,165,233,0.18);
    border-radius:6px;color:var(--text);font-family:var(--font-b);font-size:0.95rem;
    outline:none;transition:all 0.2s;
  }
  .sq-input:focus,.sq-select:focus,.sq-textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 2px rgba(6,214,245,0.08)}
  .sq-select option{background:#071a3e}
  .sq-textarea{min-height:90px;resize:vertical}
  /* Tags */
  .sq-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:1.1rem}
  .sq-tag{font-family:var(--font-m);font-size:0.65rem;padding:6px 12px;border-radius:4px;cursor:pointer;border:1px solid rgba(14,165,233,0.2);color:var(--muted);background:rgba(7,26,62,0.4);transition:all 0.2s;letter-spacing:0.06em}
  .sq-tag.on{border-color:var(--cyan);color:var(--cyan);background:rgba(6,214,245,0.08)}
  /* Duration */
  .sq-units{display:flex;gap:8px;margin-bottom:1rem}
  .sq-unit{flex:1;padding:0.65rem;border-radius:8px;cursor:pointer;border:1px solid rgba(14,165,233,0.18);background:rgba(7,26,62,0.4);text-align:center;transition:all 0.2s}
  .sq-unit.on{border-color:var(--cyan);background:rgba(6,214,245,0.08)}
  .sq-unit-emoji{font-size:1.2rem;display:block;margin-bottom:3px}
  .sq-unit-label{font-family:var(--font-m);font-size:0.63rem;color:var(--muted);letter-spacing:0.08em}
  .sq-unit.on .sq-unit-label{color:var(--cyan)}
  .sq-dur-pills{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:0.75rem}
  .sq-pill{font-family:var(--font-m);font-size:0.65rem;padding:6px 14px;border-radius:4px;cursor:pointer;border:1px solid rgba(14,165,233,0.18);color:var(--muted);background:rgba(7,26,62,0.4);transition:all 0.2s;letter-spacing:0.06em}
  .sq-pill.on{border-color:var(--blue);color:var(--blue);background:rgba(14,165,233,0.1)}
  .sq-chip{display:inline-flex;align-items:center;gap:8px;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:6px;padding:7px 14px;margin-top:6px}
  .sq-chip-txt{font-family:var(--font-m);font-size:0.7rem;color:var(--blue)}
  /* Nav */
  .sq-nav{display:flex;gap:10px;margin-top:1.5rem}
  .sq-btn{flex:1;padding:0.75rem;border-radius:8px;cursor:pointer;font-family:var(--font-h);font-size:0.72rem;font-weight:700;letter-spacing:0.08em;border:none;transition:all 0.25s}
  .sq-btn-ghost{background:transparent;border:1px solid rgba(14,165,233,0.2);color:var(--muted)}
  .sq-btn-ghost:hover{border-color:var(--blue);color:var(--blue)}
  .sq-btn-primary{background:linear-gradient(135deg,#0ea5e9,#06d6f5);color:#020817;box-shadow:0 0 20px rgba(6,214,245,0.2)}
  .sq-btn-primary:hover:not(:disabled){box-shadow:0 0 30px rgba(6,214,245,0.4);transform:translateY(-1px)}
  .sq-btn-primary:disabled{opacity:0.5;cursor:not-allowed}
  .sq-saving{display:flex;align-items:center;gap:10px;justify-content:center;padding:0.75rem}
  .sq-ring{width:22px;height:22px;border-radius:50%;border:2px solid rgba(6,214,245,0.2);border-top-color:var(--cyan);animation:sq-spin 0.7s linear infinite}
  @keyframes sq-spin{to{transform:rotate(360deg)}}
  .sq-err{font-family:var(--font-m);font-size:0.7rem;color:var(--err);margin-top:0.75rem;text-align:center}
`;

const PURPOSE_OPTS = ["Practice","College Project","Final Year Project","Startup Idea","Client Project","Other"];
const STACK_OPTS = ["MERN","MEAN","Java Full Stack","Python","React Native",".NET","Flutter","Other"];
const TYPE_OPTS = ["Frontend","Backend","Full Stack","Mobile App","AI/ML","IoT","DevOps","Other"];
const AI_OPTS = ["Yes","No","Sometimes"];
const DOMAIN_OPTS = ["Healthcare","Traffic","Cybersecurity","Education","Entertainment","E-Commerce","Finance","Software","Other"];
const DUR = { Days:[1,3,5,7,10,"Other"], Weeks:[1,2,3,4,6,8,"Other"], Months:[1,2,3,6,12,"Other"] };

function Field({ label, children }) {
  return <div className="sq-field"><label className="sq-label">{label}</label>{children}</div>;
}

function SelectField({ label, value, onChange, opts }) {
  return (
    <Field label={label}>
      <select className="sq-select" value={value} onChange={onChange}>
        <option value="">— select —</option>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function Tags({ label, opts, selected, toggle }) {
  return (
    <div className="sq-field">
      <label className="sq-label">{label}</label>
      <div className="sq-tags">
        {opts.map(o => (
          <div key={o} className={`sq-tag ${selected === o || (Array.isArray(selected) && selected.includes(o)) ? "on" : ""}`} onClick={() => toggle(o)}>{o}</div>
        ))}
      </div>
    </div>
  );
}

export default function SoloQuestions() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    purpose:"", purposeOther:"",
    stack:"", stackOther:"",
    projectType:"", projectTypeOther:"",
    aiUsage:"",
    domain:"", domainOther:"",
    title:"", description:"", problem:"",
    functional:"", nonFunctional:"",
    durationUnit:"", durationValue:"", durationOther:"",
  });

  useEffect(() => {
    const unsub = getAuth(app).onAuthStateChanged(u => { if (!u) nav("/login"); else setUser(u); });
    return unsub;
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const STEPS = [
    { tag:"01", title:"Basic Info", sub:"solo_project.init()" },
    { tag:"02", title:"Project Info", sub:"solo_project.describe()" },
    { tag:"03", title:"Requirements", sub:"solo_project.define()" },
    { tag:"04", title:"Timeline", sub:"solo_project.schedule()" },
  ];

  const handleSave = async () => {
    if (!form.title.trim()) { setErr("Project title is required."); return; }
    setSaving(true); setErr("");
    try {
      const projRef = doc(collection(db, "soloProjects"));
      const pid = projRef.id;
      await setDoc(projRef, {
        ...form,
        uid: user.uid,
        projectId: pid,
        createdAt: new Date().toISOString(),
        status: "active",
      });
      nav(`/solo-dashboard/${pid}`);
    } catch (e) {
      setErr("Failed to save. " + e.message);
      setSaving(false);
    }
  };

  const durFinal = form.durationValue === "Other" ? form.durationOther : form.durationValue;

  return (
    <>
      <style>{css}</style>
      <div className="sq-wrap">
        <div className="sq-grid" />
        <div className="sq-glow" />
        <div className="sq-card">
          <div className="sq-topbar">
            <button className="sq-back" onClick={() => step > 0 ? setStep(s => s-1) : nav("/dashboard")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              back
            </button>
            <span className="sq-badge">SOLO_MODE</span>
          </div>

          {/* Step bar */}
          <div className="sq-steps">
            {STEPS.map((_, i) => (
              <div key={i} className={`sq-step ${i < step ? "done" : i === step ? "active" : ""}`} />
            ))}
          </div>

          <div className="sq-sub">{STEPS[step].sub}</div>
          <h1 className="sq-h1"><span>{STEPS[step].tag}_</span>{STEPS[step].title}</h1>

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <SelectField label="PURPOSE" value={form.purpose} onChange={e => set("purpose", e.target.value)} opts={PURPOSE_OPTS} />
              {form.purpose === "Other" && <Field label="SPECIFY PURPOSE"><input className="sq-input" value={form.purposeOther} onChange={e => set("purposeOther", e.target.value)} /></Field>}
              <SelectField label="TECH STACK" value={form.stack} onChange={e => set("stack", e.target.value)} opts={STACK_OPTS} />
              {form.stack === "Other" && <Field label="SPECIFY STACK"><input className="sq-input" value={form.stackOther} onChange={e => set("stackOther", e.target.value)} /></Field>}
              <SelectField label="PROJECT TYPE" value={form.projectType} onChange={e => set("projectType", e.target.value)} opts={TYPE_OPTS} />
              <Tags label="AI USAGE" opts={AI_OPTS} selected={form.aiUsage} toggle={v => set("aiUsage", v)} />
              <SelectField label="DOMAIN" value={form.domain} onChange={e => set("domain", e.target.value)} opts={DOMAIN_OPTS} />
              {form.domain === "Other" && <Field label="SPECIFY DOMAIN"><input className="sq-input" value={form.domainOther} onChange={e => set("domainOther", e.target.value)} /></Field>}
            </>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <Field label="PROJECT TITLE *">
                <input className="sq-input" placeholder="e.g. SmartAttend AI..." value={form.title} onChange={e => set("title", e.target.value)} />
              </Field>
              <Field label="PROJECT DESCRIPTION *">
                <textarea className="sq-textarea" placeholder="Describe what your project does..." value={form.description} onChange={e => set("description", e.target.value)} />
              </Field>
              <Field label="PROBLEM STATEMENT">
                <textarea className="sq-textarea" placeholder="What problem does it solve?..." value={form.problem} onChange={e => set("problem", e.target.value)} />
              </Field>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <Field label="FUNCTIONAL REQUIREMENTS">
                <textarea className="sq-textarea" style={{ minHeight:"110px" }} placeholder="What the system must do... (optional)" value={form.functional} onChange={e => set("functional", e.target.value)} />
              </Field>
              <Field label="NON-FUNCTIONAL REQUIREMENTS">
                <textarea className="sq-textarea" style={{ minHeight:"110px" }} placeholder="Performance, security, scalability... (optional)" value={form.nonFunctional} onChange={e => set("nonFunctional", e.target.value)} />
              </Field>
            </>
          )}

          {/* STEP 3 — Timeline */}
          {step === 3 && (
            <>
              <label className="sq-label">DURATION UNIT</label>
              <div className="sq-units">
                {[{u:"Days",e:"📅"},{u:"Weeks",e:"🗓️"},{u:"Months",e:"🌙"}].map(({u,e}) => (
                  <div key={u} className={`sq-unit ${form.durationUnit===u?"on":""}`} onClick={() => { set("durationUnit",u); set("durationValue",""); set("durationOther",""); }}>
                    <span className="sq-unit-emoji">{e}</span>
                    <span className="sq-unit-label">{u.toUpperCase()}</span>
                  </div>
                ))}
              </div>
              {form.durationUnit && (
                <>
                  <label className="sq-label">HOW MANY {form.durationUnit.toUpperCase()}?</label>
                  <div className="sq-dur-pills">
                    {DUR[form.durationUnit].map(o => (
                      <div key={o} className={`sq-pill ${form.durationValue==o?"on":""}`} onClick={() => { set("durationValue",String(o)); if(o!=="Other") set("durationOther",""); }}>
                        {o==="Other"?"Custom":o}
                      </div>
                    ))}
                  </div>
                  {form.durationValue==="Other" && (
                    <Field label={`CUSTOM ${form.durationUnit.toUpperCase()} COUNT`}>
                      <input className="sq-input" type="number" min="1" placeholder={`Number of ${form.durationUnit.toLowerCase()}...`} value={form.durationOther} onChange={e => set("durationOther",e.target.value)} />
                    </Field>
                  )}
                  {durFinal && (
                    <div className="sq-chip">
                      <span>⏱️</span>
                      <span className="sq-chip-txt">{durFinal} {form.durationUnit}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {err && <div className="sq-err">⚠ {err}</div>}

          <div className="sq-nav">
            {step > 0 && (
              <button className="sq-btn sq-btn-ghost" onClick={() => setStep(s => s-1)}>← prev()</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="sq-btn sq-btn-primary" onClick={() => setStep(s => s+1)}>next() →</button>
            ) : (
              saving ? (
                <div className="sq-saving" style={{flex:1}}>
                  <div className="sq-ring" />
                  <span style={{fontFamily:"var(--font-m)",fontSize:"0.72rem",color:"var(--muted)"}}>CREATING PROJECT…</span>
                </div>
              ) : (
                <button className="sq-btn sq-btn-primary" onClick={handleSave} disabled={!form.title.trim()}>
                  save_and_launch() ⚡
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}