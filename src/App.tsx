import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, onSnapshot, doc,
  setDoc, deleteDoc, getDoc, getDocs, serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKRg4-P4GEF95DyD-hOQrLXIVeXp2p-pQ",
  authDomain: "rca---bhp.firebaseapp.com",
  projectId: "rca---bhp",
  storageBucket: "rca---bhp.firebasestorage.app",
  messagingSenderId: "823571019737",
  appId: "1:823571019737:web:ff7a1838d1432f10128bc8",
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const COLUMNS = [
  { id:"problemas", title:"¿Qué Problema Tuvimos?",                    color:"#FFF176", header:"#F9A825", placeholder:"Describe el problema..." },
  { id:"mejorar",   title:"¿Qué Podríamos Mejorar?",                   color:"#C8E6C9", header:"#66BB6A", placeholder:"¿Qué se podría hacer diferente?" },
  { id:"bien",      title:"¿Qué Hicimos Bien?",                        color:"#BBDEFB", header:"#42A5F5", placeholder:"¿Qué funcionó correctamente?" },
  { id:"lecciones", title:"¿Qué Lecciones Aplican a Otros Proyectos?", color:"#F8BBD0", header:"#EC407A", placeholder:"Lección transferible..." },
];
const IMPACT        = ["🔴 Alto","🟡 Medio","🟢 Bajo"];
const AREAS         = ["Planificación","Ejecución","Comunicación","Recursos","Técnico","Seguridad","Otro"];
const ANALYZE_COLS  = ["problemas","mejorar"];
const VOTES_PER_COL = 2;
const ALL_PHASES    = ["board","votar","porques","acciones","resumen"];
const PHASE_LABELS: Record<string,string> = {
  board:"📝 Board", votar:"🗳️ Votar", porques:"🔍 5 Porqués",
  acciones:"✅ Acciones", resumen:"📊 Resumen"
};

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }

type Draft = { text: string; area: string; impact: string };

export default function App() {
  const [screen,    setScreen]    = useState("login");
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [userName,  setUserName]  = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [loginName,    setLoginName]    = useState("");
  const [loginEmail,   setLoginEmail]   = useState("");
  const [loginPw,      setLoginPw]      = useState("");
  const [loginErr,     setLoginErr]     = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [admins,        setAdmins]        = useState<any[]>([]);
  const [newAdminName,  setNewAdminName]  = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPw,    setNewAdminPw]    = useState("");
  const [adminMsg,      setAdminMsg]      = useState("");

  const [projects,        setProjects]        = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [tab,             setTab]             = useState("board");

  const [notes,        setNotes]        = useState<Record<string,Record<string,any>>>({});
  const [actions,      setActions]      = useState<Record<string,any>>({});
  const [porques,      setPorques]      = useState<Record<string,any>>({});
  const [participants, setParticipants] = useState<any[]>([]);

  const [saving,       setSaving]       = useState(false);
  const [votesUsed,    setVotesUsed]    = useState<Record<string,number>>({});
  const [voted,        setVoted]        = useState<Record<string,boolean>>({});
  const [selectedNote, setSelectedNote] = useState<any>(null);

  const [adminTab,    setAdminTab]    = useState("projects");
  const [editingProj, setEditingProj] = useState<any>(null);
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");

  const [addingNote, setAddingNote] = useState<Record<string,boolean>>({});
  const [draftNote,  setDraftNote]  = useState<Record<string,Draft>>({});

  // ── Listeners ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db,"admins"), snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id:d.id,...d.data() }));
      setAdmins(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"projects"), snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id:d.id,...d.data() }));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      setProjects(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedProject?.id) return;
    const unsub = onSnapshot(doc(db,"projects",selectedProject.id), snap => {
      if (snap.exists()) setSelectedProject((prev: any) => ({ ...prev, ...snap.data(), id: snap.id }));
    });
    return () => unsub();
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!selectedProject?.id) return;
    const pid = selectedProject.id;
    const unsubs = COLUMNS.map(col =>
      onSnapshot(collection(db,"projects",pid,"notes",col.id,"items"), snap => {
        const items: Record<string,any> = {};
        snap.forEach(d => { items[d.id] = { id:d.id,...d.data() }; });
        setNotes(prev => ({ ...prev,[col.id]:items }));
      })
    );
    const u2 = onSnapshot(collection(db,"projects",pid,"actions"), snap => {
      const items: Record<string,any> = {};
      snap.forEach(d => { items[d.id] = { id:d.id,...d.data() }; });
      setActions(items);
    });
    const u3 = onSnapshot(collection(db,"projects",pid,"porques"), snap => {
      const items: Record<string,any> = {};
      snap.forEach(d => { items[d.id] = { id:d.id,...d.data() }; });
      setPorques(items);
    });
    const u4 = onSnapshot(collection(db,"projects",pid,"participants"), snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id:d.id,...d.data() }));
      setParticipants(list);
    });
    return () => { unsubs.forEach(u=>u()); u2(); u3(); u4(); };
  }, [selectedProject?.id]);

  // ── Auth ──────────────────────────────────────────────────
  const handleUserLogin = () => {
    setLoginErr("");
    if (!loginName.trim()) return setLoginErr("Ingresa tu nombre.");
    if (!loginEmail.trim()) return setLoginErr("Ingresa tu correo.");
    setIsAdmin(false);
    setUserName(loginName.trim());
    setUserEmail(loginEmail.trim().toLowerCase());
    setScreen("user");
  };

  const handleAdminLogin = async () => {
    setLoginErr(""); setLoginLoading(true);
    const email = loginEmail.trim().toLowerCase();
    if (!email) { setLoginErr("Ingresa tu correo."); setLoginLoading(false); return; }
    if (!loginPw) { setLoginErr("Ingresa tu contraseña."); setLoginLoading(false); return; }
    const adminDoc = await getDoc(doc(db,"admins",email));
    if (!adminDoc.exists()) { setLoginErr("Correo no registrado como administrador."); setLoginLoading(false); return; }
    const data = adminDoc.data();
    if (data.password !== loginPw && data.password !== simpleHash(loginPw)) {
      setLoginErr("Contraseña incorrecta."); setLoginLoading(false); return;
    }
    setIsAdmin(true); setUserName(data.name||email); setUserEmail(email);
    setLoginLoading(false); setScreen("admin");
  };

  const logout = () => {
    setScreen("login"); setSelectedProject(null); setIsAdmin(false);
    setUserName(""); setUserEmail(""); setLoginName("");
    setLoginEmail(""); setLoginPw(""); setLoginErr("");
    setNotes({}); setActions({}); setPorques({});
    setVoted({}); setVotesUsed({}); setSelectedNote(null);
    setTab("board"); setAdminTab("projects");
  };

  const joinProject = async (proj: any) => {
    setSelectedProject(proj);
    setNotes({}); setActions({}); setPorques({});
    setVoted({}); setVotesUsed({}); setSelectedNote(null); setTab("board");
    await setDoc(doc(db,"projects",proj.id,"participants",userEmail),{
      name:userName, email:userEmail, joinedAt:serverTimestamp()
    },{ merge:true });
  };

  // ── Admin management ──────────────────────────────────────
  const createAdmin = async () => {
    setAdminMsg("");
    if (!newAdminName.trim()||!newAdminEmail.trim()||!newAdminPw.trim()) return setAdminMsg("⚠️ Completa todos los campos.");
    const email = newAdminEmail.trim().toLowerCase();
    const existing = await getDoc(doc(db,"admins",email));
    if (existing.exists()) return setAdminMsg("⚠️ Ya existe un admin con ese correo.");
    await setDoc(doc(db,"admins",email),{
      name:newAdminName.trim(), email, password:newAdminPw.trim(),
      createdAt:serverTimestamp(), createdBy:userEmail,
    });
    setNewAdminName(""); setNewAdminEmail(""); setNewAdminPw("");
    setAdminMsg("✅ Admin creado correctamente.");
  };

  const deleteAdmin = async (email: string) => {
    if (email===userEmail) return alert("No puedes eliminarte a ti mismo.");
    if (!confirm(`¿Eliminar al admin ${email}?`)) return;
    await deleteDoc(doc(db,"admins",email));
  };

  // ── Project CRUD ──────────────────────────────────────────
  const togglePhase = async (projId: string, phase: string, current: boolean) => {
    await setDoc(doc(db,"projects",projId),{ phases:{ [phase]:!current } },{ merge:true });
  };
  const createProject = async () => {
    if (!newProjName.trim()) return;
    const id = uid();
    const phases: Record<string,boolean> = {};
    ALL_PHASES.forEach(p => { phases[p] = p==="board"; });
    await setDoc(doc(db,"projects",id),{
      name:newProjName.trim(), description:newProjDesc.trim(),
      phases, createdAt:serverTimestamp(), status:"active", createdBy:userEmail
    });
    setNewProjName(""); setNewProjDesc(""); setAdminTab("projects");
  };
  const updateProject = async () => {
    if (!editingProj) return;
    await setDoc(doc(db,"projects",editingProj.id),{
      name:editingProj.name, description:editingProj.description
    },{ merge:true });
    setEditingProj(null); setAdminTab("projects");
  };
  const deleteProject = async (id: string) => {
    if (!confirm("¿Eliminar este proyecto?")) return;
    await setDoc(doc(db,"projects",id),{ status:"deleted" },{ merge:true });
  };
  const clearProjectData = async (pid: string) => {
    if (!confirm("¿Limpiar todos los datos de este proyecto?")) return;
    for (const col of COLUMNS) {
      const snap = await getDocs(collection(db,"projects",pid,"notes",col.id,"items"));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
    for (const d of (await getDocs(collection(db,"projects",pid,"actions"))).docs) await deleteDoc(d.ref);
    for (const d of (await getDocs(collection(db,"projects",pid,"porques"))).docs) await deleteDoc(d.ref);
    alert("✅ Datos limpiados.");
  };
  const exportCSV = (proj: any) => {
    const rows = [["Categoría","Texto","Autor","Área","Impacto","Votos"]];
    COLUMNS.forEach(col => {
      Object.values(notes[col.id]||{}).filter((n:any)=>n.text?.trim()).forEach((n:any) => {
        rows.push([col.title,n.text,n.author,n.area,n.impact,n.votes]);
      });
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `RCA-${proj.name}-export.csv`; a.click();
  };

  // ── Note helpers ──────────────────────────────────────────
  const openDraft = (colId: string) => {
    setAddingNote(v=>({...v,[colId]:true}));
    setDraftNote(v=>({...v,[colId]:{text:"",area:"",impact:""}}));
  };
  const cancelDraft = (colId: string) => setAddingNote(v=>({...v,[colId]:false}));

  const draftValid = (colId: string) => {
    const d = draftNote[colId];
    return !!(d?.text?.trim() && d?.area && d?.impact);
  };

  const saveDraft = async (colId: string) => {
    if (!draftValid(colId) || !selectedProject) return;
    const draft = draftNote[colId];
    await setDoc(doc(db,"projects",selectedProject.id,"notes",colId,"items",uid()),{
      text:draft.text.trim(), author:userName,
      impact:draft.impact, area:draft.area,
      votes:0, createdAt:Date.now()
    });
    setAddingNote(v=>({...v,[colId]:false}));
  };

  const updateNote = async (colId: string, id: string, field: string, val: string) => {
    if (!selectedProject) return;
    setSaving(true);
    await setDoc(doc(db,"projects",selectedProject.id,"notes",colId,"items",id),{ [field]:val },{ merge:true });
    setSaving(false);
  };
  const removeNote = async (colId: string, id: string) => {
    if (!selectedProject) return;
    await deleteDoc(doc(db,"projects",selectedProject.id,"notes",colId,"items",id));
  };

  // ── Vote helpers ──────────────────────────────────────────
  const voteNote = async (colId: string, noteId: string) => {
    if (!selectedProject) return;
    const key = `${colId}-${noteId}`;
    if (voted[key]) return;
    const used = votesUsed[colId]||0;
    if (used >= VOTES_PER_COL) return;
    setVoted(v=>({...v,[key]:true}));
    setVotesUsed(v=>({...v,[colId]:used+1}));
    const ref = doc(db,"projects",selectedProject.id,"notes",colId,"items",noteId);
    const snap = await getDoc(ref);
    if (snap.exists()) await setDoc(ref,{ votes:(snap.data().votes||0)+1 },{ merge:true });
  };

  // ── Action helpers ────────────────────────────────────────
  const addAction = async () => {
    if (!selectedProject) return;
    await setDoc(doc(db,"projects",selectedProject.id,"actions",uid()),{
      what:"", who:"", when:"", priority:"🔴 Alta", createdAt:Date.now()
    });
  };
  const updateAction = async (id: string, field: string, val: string) => {
    if (!selectedProject) return;
    await setDoc(doc(db,"projects",selectedProject.id,"actions",id),{ [field]:val },{ merge:true });
  };
  const removeAction = async (id: string) => {
    if (!selectedProject) return;
    await deleteDoc(doc(db,"projects",selectedProject.id,"actions",id));
  };

  // ── Porqués helpers ───────────────────────────────────────
  const savePorque = async (noteId: string, index: number, val: string) => {
    if (!selectedProject) return;
    const ref = doc(db,"projects",selectedProject.id,"porques",noteId);
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().whys||["","","","",""]) : ["","","","",""];
    const updated = [...current]; updated[index] = val;
    await setDoc(ref,{ whys:updated },{ merge:true });
  };
  const createActionFromCause = async (note: any, causeText: string) => {
    if (!selectedProject) return;
    await setDoc(doc(db,"projects",selectedProject.id,"actions",uid()),{
      what:causeText, who:"", when:"", priority:"🔴 Alta",
      createdAt:Date.now(), fromCause:note.id,
      problem:note.text.slice(0,80), colOrigin:note.col
    });
    setTab("acciones");
  };

  // ── Derived ───────────────────────────────────────────────
  const allNotes     = COLUMNS.flatMap(c=>Object.values(notes[c.id]||{}).map((n:any)=>({...n,col:c.id})));
  const filled       = allNotes.filter((n:any)=>n.text?.trim());
  const topVoted     = [...filled].sort((a:any,b:any)=>b.votes-a.votes).slice(0,5);
  const actList      = Object.values(actions).sort((a:any,b:any)=>a.createdAt-b.createdAt);
  const activePhases = isAdmin ? ALL_PHASES : ALL_PHASES.filter(p=>selectedProject?.phases?.[p]);

  const hBtn = (active=false): React.CSSProperties => ({
    background:active?"#fff":"rgba(255,255,255,0.15)",
    color:active?"#1565C0":"#fff",
    border:"none", borderRadius:20, padding:"5px 14px",
    fontSize:12, cursor:"pointer", fontWeight:active?700:400
  });

  // ════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════
  if (screen==="login") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1565C0,#0D47A1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, maxWidth:420, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:52 }}>🪨</div>
          <h2 style={{ margin:"8px 0 4px", color:"#1a237e" }}>RCA Platform</h2>
          <p style={{ color:"#888", fontSize:13, margin:0 }}>Lecciones Aprendidas · BHP</p>
          <p style={{ color:"#bbb", fontSize:11, margin:"4px 0 0" }}>v{__APP_VERSION__} · {__GIT_HASH__} · {__GIT_DATE__}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:12, color:"#555", fontWeight:600 }}>Tu nombre</label>
            <input value={loginName} onChange={e=>setLoginName(e.target.value)} placeholder="Nombre completo"
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#555", fontWeight:600 }}>Correo electrónico</label>
            <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="tu@correo.com" type="email"
              onKeyDown={e=>e.key==="Enter"&&handleUserLogin()}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
          </div>
          {loginErr && <div style={{ background:"#FFEBEE", color:"#c62828", borderRadius:8, padding:"8px 12px", fontSize:13 }}>⚠️ {loginErr}</div>}
          <button onClick={handleUserLogin}
            style={{ background:"#1565C0", color:"#fff", border:"none", borderRadius:8, padding:"13px", fontSize:15, cursor:"pointer", fontWeight:700, marginTop:4 }}>
            Ingresar →
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, height:1, background:"#eee" }} />
            <span style={{ fontSize:12, color:"#bbb" }}>o</span>
            <div style={{ flex:1, height:1, background:"#eee" }} />
          </div>
          <button onClick={()=>{ setLoginErr(""); setLoginEmail(""); setLoginPw(""); setScreen("adminLogin"); }}
            style={{ background:"transparent", color:"#1a237e", border:"1.5px solid #1a237e", borderRadius:8, padding:"11px", fontSize:14, cursor:"pointer", fontWeight:600 }}>
            🔑 Acceso Administrador
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // ADMIN LOGIN
  // ════════════════════════════════════════════════════════
  if (screen==="adminLogin") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a237e,#283593)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, maxWidth:400, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44 }}>🔑</div>
          <h2 style={{ margin:"8px 0 4px", color:"#1a237e" }}>Acceso Administrador</h2>
          <p style={{ color:"#888", fontSize:13, margin:0 }}>RCA Platform · BHP</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:12, color:"#555", fontWeight:600 }}>Correo electrónico</label>
            <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="admin@correo.com" type="email"
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#555", fontWeight:600 }}>Contraseña</label>
            <input value={loginPw} onChange={e=>setLoginPw(e.target.value)} type="password" placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
          </div>
          {loginErr && <div style={{ background:"#FFEBEE", color:"#c62828", borderRadius:8, padding:"8px 12px", fontSize:13 }}>⚠️ {loginErr}</div>}
          <button onClick={handleAdminLogin} disabled={loginLoading}
            style={{ background:loginLoading?"#7986CB":"#1a237e", color:"#fff", border:"none", borderRadius:8, padding:"13px", fontSize:15, cursor:"pointer", fontWeight:700, marginTop:4 }}>
            {loginLoading?"Verificando...":"Entrar como Admin →"}
          </button>
          <button onClick={()=>{ setScreen("login"); setLoginErr(""); setLoginEmail(""); setLoginPw(""); }}
            style={{ background:"transparent", color:"#888", border:"none", fontSize:13, cursor:"pointer", padding:"6px" }}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // ADMIN PANEL
  // ════════════════════════════════════════════════════════
  if (screen==="admin") return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"#1a237e", color:"#fff", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18, fontWeight:700 }}>🪨 RCA Platform · Admin</span>
          <span style={{ fontSize:11, opacity:0.5 }}>v{__APP_VERSION__} · {__GIT_HASH__}</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:13, opacity:0.8 }}>🔑 {userName} · {userEmail}</span>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.15)", color:"#fff", border:"none", borderRadius:20, padding:"6px 16px", fontSize:13, cursor:"pointer" }}>Cerrar sesión</button>
        </div>
      </div>
      <div style={{ background:"#fff", borderBottom:"1px solid #e0e0e0", padding:"0 24px", display:"flex", gap:4 }}>
        {([["projects","📋 Proyectos"],["new","➕ Nuevo Proyecto"],["admins","👥 Gestionar Admins"]] as [string,string][]).map(([t,label])=>(
          <button key={t} onClick={()=>{ setAdminTab(t); setEditingProj(null); }}
            style={{ background:"none", border:"none", borderBottom:adminTab===t?"3px solid #1565C0":"3px solid transparent", color:adminTab===t?"#1565C0":"#555", padding:"14px 16px", fontSize:14, cursor:"pointer", fontWeight:adminTab===t?700:400 }}>
            {label}
          </button>
        ))}
        {editingProj && (
          <button style={{ background:"none", border:"none", borderBottom:"3px solid #F9A825", color:"#F9A825", padding:"14px 16px", fontSize:14, cursor:"pointer", fontWeight:700 }}>
            ✏️ Editando: {editingProj.name}
          </button>
        )}
      </div>
      <div style={{ padding:24 }}>
        {adminTab==="projects" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {projects.filter(p=>p.status!=="deleted").length===0 && (
              <div style={{ background:"#fff", borderRadius:12, padding:40, textAlign:"center", color:"#aaa" }}>No hay proyectos aún.</div>
            )}
            {projects.filter(p=>p.status!=="deleted").map(proj=>(
              <div key={proj.id} style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, flexWrap:"wrap", gap:8 }}>
                  <div>
                    <h3 style={{ margin:"0 0 4px", color:"#1a237e" }}>{proj.name}</h3>
                    <p style={{ margin:0, fontSize:13, color:"#777" }}>{proj.description||"Sin descripción"}</p>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button onClick={()=>{ setEditingProj({...proj}); setAdminTab("edit"); }}
                      style={{ background:"#E3F2FD", color:"#1565C0", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>✏️ Editar</button>
                    <button onClick={()=>{ joinProject(proj); setScreen("user"); }}
                      style={{ background:"#1a237e", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>🚀 Entrar al board</button>
                    <button onClick={()=>exportCSV(proj)}
                      style={{ background:"#E8F5E9", color:"#2E7D32", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>📥 CSV</button>
                    <button onClick={()=>clearProjectData(proj.id)}
                      style={{ background:"#FFF8E1", color:"#E65100", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>🗑️ Limpiar</button>
                    <button onClick={()=>deleteProject(proj.id)}
                      style={{ background:"#FFEBEE", color:"#c62828", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>✕ Eliminar</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:"#555", fontWeight:600, marginBottom:6 }}>FASES ACTIVAS:</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {ALL_PHASES.map(phase=>{
                      const active = proj.phases?.[phase]||false;
                      return (
                        <button key={phase} onClick={()=>togglePhase(proj.id,phase,active)}
                          style={{ background:active?"#1565C0":"#eee", color:active?"#fff":"#888", border:"none", borderRadius:20, padding:"5px 14px", fontSize:12, cursor:"pointer", fontWeight:active?700:400, transition:"all 0.2s" }}>
                          {PHASE_LABELS[phase]} {active?"✓":"○"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {adminTab==="new" && (
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:500, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 20px", color:"#1a237e" }}>➕ Crear Nuevo Proyecto</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Nombre *</label>
                <input value={newProjName} onChange={e=>setNewProjName(e.target.value)} placeholder="Ej: Mina Norte Q1 2025"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Descripción</label>
                <textarea value={newProjDesc} onChange={e=>setNewProjDesc(e.target.value)} rows={3} placeholder="Contexto del proyecto..."
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4, resize:"vertical", fontFamily:"inherit" }} />
              </div>
              <div style={{ background:"#E3F2FD", borderRadius:8, padding:12, fontSize:13, color:"#0D47A1" }}>
                💡 Se creará con solo el Board activo.
              </div>
              <button onClick={createProject} disabled={!newProjName.trim()}
                style={{ background:newProjName.trim()?"#1565C0":"#ccc", color:"#fff", border:"none", borderRadius:8, padding:"12px", fontSize:15, cursor:newProjName.trim()?"pointer":"default", fontWeight:700 }}>
                Crear Proyecto →
              </button>
            </div>
          </div>
        )}
        {adminTab==="edit" && editingProj && (
          <div style={{ background:"#fff", borderRadius:12, padding:28, maxWidth:500, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 20px", color:"#1a237e" }}>✏️ Editar Proyecto</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Nombre</label>
                <input value={editingProj.name} onChange={e=>setEditingProj({...editingProj,name:e.target.value})}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Descripción</label>
                <textarea value={editingProj.description||""} onChange={e=>setEditingProj({...editingProj,description:e.target.value})} rows={3}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4, resize:"vertical", fontFamily:"inherit" }} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={updateProject} style={{ flex:1, background:"#1565C0", color:"#fff", border:"none", borderRadius:8, padding:"12px", fontSize:14, cursor:"pointer", fontWeight:700 }}>Guardar cambios</button>
                <button onClick={()=>{ setEditingProj(null); setAdminTab("projects"); }} style={{ background:"#eee", color:"#555", border:"none", borderRadius:8, padding:"12px 20px", fontSize:14, cursor:"pointer" }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
        {adminTab==="admins" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:900 }}>
            <div style={{ background:"#fff", borderRadius:12, padding:24, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              <h3 style={{ margin:"0 0 16px", color:"#1a237e" }}>👥 Administradores activos</h3>
              {admins.length===0 && <p style={{ color:"#aaa", fontSize:13 }}>No hay admins registrados.</p>}
              {admins.map(a=>(
                <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f0f0f0" }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{a.name}</div>
                    <div style={{ fontSize:12, color:"#888" }}>{a.email}</div>
                    {a.createdBy && <div style={{ fontSize:11, color:"#bbb" }}>Creado por: {a.createdBy}</div>}
                  </div>
                  <button onClick={()=>deleteAdmin(a.email)} disabled={a.email===userEmail}
                    style={{ background:a.email===userEmail?"#f5f5f5":"#FFEBEE", color:a.email===userEmail?"#ccc":"#c62828", border:"none", borderRadius:8, padding:"5px 12px", cursor:a.email===userEmail?"default":"pointer", fontSize:12 }}>
                    {a.email===userEmail?"Tú":"✕ Eliminar"}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:24, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              <h3 style={{ margin:"0 0 16px", color:"#1a237e" }}>➕ Agregar Administrador</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Nombre completo</label>
                  <input value={newAdminName} onChange={e=>setNewAdminName(e.target.value)} placeholder="Nombre del admin"
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Correo electrónico</label>
                  <input value={newAdminEmail} onChange={e=>setNewAdminEmail(e.target.value)} placeholder="admin@correo.com" type="email"
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>Contraseña</label>
                  <input value={newAdminPw} onChange={e=>setNewAdminPw(e.target.value)} type="password" placeholder="Mínimo 6 caracteres"
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e0e0e0", fontSize:14, boxSizing:"border-box", marginTop:4 }} />
                </div>
                {adminMsg && (
                  <div style={{ background:adminMsg.startsWith("✅")?"#E8F5E9":"#FFEBEE", color:adminMsg.startsWith("✅")?"#2E7D32":"#c62828", borderRadius:8, padding:"8px 12px", fontSize:13 }}>
                    {adminMsg}
                  </div>
                )}
                <button onClick={createAdmin}
                  style={{ background:"#1a237e", color:"#fff", border:"none", borderRadius:8, padding:"12px", fontSize:14, cursor:"pointer", fontWeight:700 }}>
                  Crear Admin →
                </button>
                <div style={{ background:"#FFF8E1", borderRadius:8, padding:10, fontSize:12, color:"#E65100" }}>
                  ⚠️ Contraseña guardada en texto plano. Para producción usa Firebase Authentication.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // USER — Project selection
  // ════════════════════════════════════════════════════════
  if (!selectedProject) return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"#1565C0", color:"#fff", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:18, fontWeight:700 }}>🪨 RCA Platform</span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:13, opacity:0.8 }}>👤 {userName} · {userEmail}</span>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.15)", color:"#fff", border:"none", borderRadius:20, padding:"6px 14px", fontSize:13, cursor:"pointer" }}>Salir</button>
        </div>
      </div>
      <div style={{ padding:32, maxWidth:700, margin:"0 auto" }}>
        <h2 style={{ color:"#1a237e", marginBottom:6 }}>Hola, {userName} 👋</h2>
        <p style={{ color:"#666", marginBottom:24, fontSize:15 }}>Selecciona el proyecto en el que vas a participar:</p>
        {projects.filter(p=>p.status!=="deleted").length===0 && (
          <div style={{ background:"#fff", borderRadius:12, padding:32, textAlign:"center", color:"#aaa" }}>No hay proyectos disponibles.</div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {projects.filter(p=>p.status!=="deleted").map(proj=>(
            <div key={proj.id} onClick={()=>joinProject(proj)}
              style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)", cursor:"pointer", border:"2px solid transparent", transition:"all 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#1565C0"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <h3 style={{ margin:"0 0 4px", color:"#1a237e" }}>{proj.name}</h3>
                  <p style={{ margin:"0 0 10px", fontSize:13, color:"#777" }}>{proj.description||"Sin descripción"}</p>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {ALL_PHASES.filter(p=>proj.phases?.[p]).map(p=>(
                      <span key={p} style={{ background:"#E3F2FD", color:"#1565C0", borderRadius:12, padding:"2px 10px", fontSize:11, fontWeight:600 }}>{PHASE_LABELS[p]}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:28, color:"#1565C0" }}>→</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // BOARD
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"#1565C0", color:"#fff", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>{ setSelectedProject(null); if(isAdmin) setScreen("admin"); }} style={hBtn()}>
            {isAdmin?"← Panel Admin":"← Proyectos"}
          </button>
          <span style={{ fontSize:15, fontWeight:700 }}>🪨 {selectedProject?.name}</span>
          <span style={{ fontSize:10, opacity:0.5 }}>v{__APP_VERSION__} · {__GIT_HASH__}</span>
          {isAdmin && <span style={{ background:"#F9A825", color:"#fff", borderRadius:12, padding:"2px 10px", fontSize:11, fontWeight:700 }}>🔑 Admin</span>}
          {saving && <span style={{ fontSize:11, opacity:0.7 }}>💾 guardando...</span>}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ background:"rgba(255,255,255,0.15)", borderRadius:20, padding:"4px 12px", fontSize:12 }}>👤 {userName}</span>
          {activePhases.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={hBtn(tab===t)}>{PHASE_LABELS[t]}</button>
          ))}
          <button onClick={logout} style={hBtn()}>Salir</button>
        </div>
      </div>

      {tab==="board" && (
        <div style={{ background:"#E3F2FD", borderLeft:"4px solid #1565C0", margin:"16px 24px 0", borderRadius:8, padding:"10px 16px", fontSize:13, color:"#0D47A1" }}>
          📋 <strong>Antes de la reunión:</strong> Agrega tus notas. Todos los campos son obligatorios. Las notas se sincronizan en tiempo real con el resto del equipo. 🔄
        </div>
      )}
      {tab==="votar" && (
        <div style={{ background:"#FFF8E1", borderLeft:"4px solid #F9A825", margin:"16px 24px 0", borderRadius:8, padding:"10px 16px", fontSize:13, color:"#E65100" }}>
          🗳️ <strong>Tienes {VOTES_PER_COL} votos por categoría ({VOTES_PER_COL*4} en total).</strong>
        </div>
      )}

      <div style={{ padding:"16px 24px" }}>

        {/* BOARD */}
        {tab==="board" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
            {COLUMNS.map(col=>{
              const colNotes = Object.values(notes[col.id]||{}).sort((a:any,b:any)=>a.createdAt-b.createdAt);
              const isAdding = addingNote[col.id];
              const draft = draftNote[col.id];
              const valid = draftValid(col.id);
              const missingFields = isAdding ? [
                !draft?.text?.trim() && "descripción",
                !draft?.area && "área",
                !draft?.impact && "impacto",
              ].filter(Boolean) : [];

              return (
                <div key={col.id} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
                  <div style={{ background:col.header, padding:"12px 16px", textAlign:"center", fontWeight:700, fontSize:13, color:"#fff" }}>
                    {col.title}
                    <span style={{ marginLeft:8, background:"rgba(255,255,255,0.3)", borderRadius:10, padding:"1px 8px", fontSize:11 }}>
                      {colNotes.filter((n:any)=>n.text?.trim()).length}
                    </span>
                  </div>
                  <div style={{ padding:12, display:"flex", flexDirection:"column", gap:10, maxHeight:540, overflowY:"auto" }}>

                    {/* Saved notes */}
                    {(colNotes as any[]).map(note=>(
                      <div key={note.id} style={{ background:col.color, borderRadius:8, padding:10, position:"relative", boxShadow:"2px 2px 6px rgba(0,0,0,0.08)" }}>
                        <button onClick={()=>removeNote(col.id,note.id)} style={{ position:"absolute", top:4, right:6, background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#999" }}>×</button>
                        <textarea rows={3} defaultValue={note.text} placeholder={col.placeholder}
                          onBlur={e=>updateNote(col.id,note.id,"text",e.target.value)}
                          style={{ width:"100%", border:"none", background:"transparent", fontSize:12, resize:"none", fontFamily:"inherit", outline:"none", marginBottom:6 }} />
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          <select defaultValue={note.area} onChange={e=>updateNote(col.id,note.id,"area",e.target.value)}
                            style={{ fontSize:10, borderRadius:4, border:"1px solid rgba(0,0,0,0.15)", background:"rgba(255,255,255,0.6)", padding:"2px 4px", flex:1 }}>
                            <option value="">Área...</option>{AREAS.map(a=><option key={a}>{a}</option>)}
                          </select>
                          <select defaultValue={note.impact} onChange={e=>updateNote(col.id,note.id,"impact",e.target.value)}
                            style={{ fontSize:10, borderRadius:4, border:"1px solid rgba(0,0,0,0.15)", background:"rgba(255,255,255,0.6)", padding:"2px 4px", flex:1 }}>
                            <option value="">Impacto...</option>{IMPACT.map(i=><option key={i}>{i}</option>)}
                          </select>
                        </div>
                        {note.author && <div style={{ fontSize:10, color:"#555", marginTop:4 }}>✍️ {note.author}</div>}
                      </div>
                    ))}

                    {/* Draft form */}
                    {isAdding ? (
                      <div style={{ background:col.color, borderRadius:8, padding:12, boxShadow:"2px 2px 6px rgba(0,0,0,0.12)", border:`2px solid ${col.header}` }}>
                        {/* Text */}
                        <div style={{ marginBottom:8 }}>
                          <label style={{ fontSize:10, fontWeight:700, color:col.header, display:"block", marginBottom:3 }}>
                            DESCRIPCIÓN *
                          </label>
                          <textarea rows={3} autoFocus
                            value={draft?.text||""}
                            onChange={e=>setDraftNote(v=>({...v,[col.id]:{...v[col.id],text:e.target.value}}))}
                            placeholder={col.placeholder}
                            style={{ width:"100%", border:`1.5px solid ${draft?.text?.trim()?"rgba(0,0,0,0.2)":"#e57373"}`, borderRadius:6, background:"rgba(255,255,255,0.7)", fontSize:12, resize:"none", fontFamily:"inherit", outline:"none", padding:"6px 8px", boxSizing:"border-box" }} />
                        </div>
                        {/* Area */}
                        <div style={{ marginBottom:8 }}>
                          <label style={{ fontSize:10, fontWeight:700, color:col.header, display:"block", marginBottom:3 }}>
                            ÁREA *
                          </label>
                          <select value={draft?.area||""}
                            onChange={e=>setDraftNote(v=>({...v,[col.id]:{...v[col.id],area:e.target.value}}))}
                            style={{ width:"100%", fontSize:12, borderRadius:6, border:`1.5px solid ${draft?.area?"rgba(0,0,0,0.2)":"#e57373"}`, background:"rgba(255,255,255,0.7)", padding:"6px 8px" }}>
                            <option value="">— Selecciona un área —</option>
                            {AREAS.map(a=><option key={a}>{a}</option>)}
                          </select>
                        </div>
                        {/* Impact */}
                        <div style={{ marginBottom:10 }}>
                          <label style={{ fontSize:10, fontWeight:700, color:col.header, display:"block", marginBottom:3 }}>
                            NIVEL DE IMPACTO *
                          </label>
                          <select value={draft?.impact||""}
                            onChange={e=>setDraftNote(v=>({...v,[col.id]:{...v[col.id],impact:e.target.value}}))}
                            style={{ width:"100%", fontSize:12, borderRadius:6, border:`1.5px solid ${draft?.impact?"rgba(0,0,0,0.2)":"#e57373"}`, background:"rgba(255,255,255,0.7)", padding:"6px 8px" }}>
                            <option value="">— Selecciona el impacto —</option>
                            {IMPACT.map(i=><option key={i}>{i}</option>)}
                          </select>
                        </div>
                        {/* Validation hint */}
                        {!valid && missingFields.length > 0 && (
                          <div style={{ fontSize:10, color:"#c62828", marginBottom:8, background:"rgba(198,40,40,0.08)", borderRadius:4, padding:"4px 8px" }}>
                            ⚠️ Faltan: {missingFields.join(", ")}
                          </div>
                        )}
                        {/* Buttons */}
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={()=>saveDraft(col.id)} disabled={!valid}
                            style={{ flex:1, background:valid?col.header:"#ccc", color:"#fff", border:"none", borderRadius:6, padding:"8px", fontSize:12, cursor:valid?"pointer":"not-allowed", fontWeight:700, transition:"background 0.2s" }}>
                            ✓ Guardar nota
                          </button>
                          <button onClick={()=>cancelDraft(col.id)}
                            style={{ background:"rgba(0,0,0,0.08)", color:"#555", border:"none", borderRadius:6, padding:"8px 12px", fontSize:12, cursor:"pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>openDraft(col.id)}
                        style={{ background:"rgba(0,0,0,0.04)", border:`2px dashed ${col.header}`, borderRadius:8, padding:"10px", cursor:"pointer", fontSize:13, color:col.header, fontWeight:600 }}>
                        + Agregar nota
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VOTAR */}
        {tab==="votar" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
            {COLUMNS.map(col=>{
              const colNotes = Object.values(notes[col.id]||{}).filter((n:any)=>n.text?.trim()).sort((a:any,b:any)=>b.votes-a.votes);
              const remaining = VOTES_PER_COL-(votesUsed[col.id]||0);
              return (
                <div key={col.id} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
                  <div style={{ background:col.header, padding:"10px 16px", textAlign:"center", fontWeight:700, fontSize:13, color:"#fff" }}>
                    {col.title}
                    <div style={{ fontSize:11, marginTop:3, opacity:0.9 }}>{remaining>0?`🗳️ Te quedan ${remaining} votos`:"✅ Votos usados"}</div>
                  </div>
                  <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8, maxHeight:560, overflowY:"auto" }}>
                    {colNotes.length===0 && <p style={{ color:"#aaa", fontSize:13, textAlign:"center", padding:20 }}>Sin notas aún</p>}
                    {(colNotes as any[]).map(note=>{
                      const key=`${col.id}-${note.id}`, hasVoted=voted[key], canVote=!hasVoted&&remaining>0;
                      return (
                        <div key={note.id} style={{ background:col.color, borderRadius:8, padding:10, opacity:!canVote&&!hasVoted?0.5:1 }}>
                          <p style={{ margin:"0 0 6px", fontSize:13 }}>{note.text}</p>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div style={{ display:"flex", gap:4 }}>
                              {note.area&&<span style={{ fontSize:10, background:"rgba(0,0,0,0.1)", borderRadius:4, padding:"1px 6px" }}>{note.area}</span>}
                              {note.impact&&<span style={{ fontSize:10, background:"rgba(0,0,0,0.1)", borderRadius:4, padding:"1px 6px" }}>{note.impact}</span>}
                            </div>
                            <button onClick={()=>voteNote(col.id,note.id)} disabled={!canVote&&!hasVoted}
                              style={{ background:hasVoted?"#1565C0":canVote?"rgba(255,255,255,0.8)":"#eee", color:hasVoted?"#fff":"#333", border:"1px solid rgba(0,0,0,0.15)", borderRadius:20, padding:"3px 12px", cursor:canVote?"pointer":"default", fontSize:12, fontWeight:700 }}>
                              👍 {note.votes}{hasVoted?" ✓":""}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5 PORQUÉS */}
        {tab==="porques" && (
          <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:12, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.08)", maxHeight:700, overflowY:"auto" }}>
              <h4 style={{ margin:"0 0 10px", color:"#333", fontSize:14 }}>🔍 Notas para analizar</h4>
              {ANALYZE_COLS.map(colId=>{
                const col=COLUMNS.find(c=>c.id===colId)!;
                const colNotes=Object.values(notes[colId]||{}).filter((n:any)=>n.text?.trim()).sort((a:any,b:any)=>b.votes-a.votes);
                return (
                  <div key={colId} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:col.header, marginBottom:6, textTransform:"uppercase" }}>{col.title}</div>
                    {colNotes.length===0&&<p style={{ color:"#ccc", fontSize:12 }}>Sin notas</p>}
                    {(colNotes as any[]).map(note=>{
                      const isSel=selectedNote?.id===note.id, hasA=porques[note.id]?.whys?.some((w:string)=>w?.trim());
                      return (
                        <div key={note.id} onClick={()=>setSelectedNote({...note,col:colId})}
                          style={{ background:isSel?col.color:"#fafafa", border:`2px solid ${isSel?col.header:"#eee"}`, borderRadius:8, padding:8, marginBottom:6, cursor:"pointer" }}>
                          <div style={{ fontSize:12, fontWeight:isSel?700:400 }}>{note.text.slice(0,55)}{note.text.length>55?"...":""}</div>
                          <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                            <span style={{ fontSize:10, color:"#888" }}>{note.area}</span>
                            <span style={{ fontSize:10 }}>👍{note.votes} {hasA?"✅":""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:24, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              {!selectedNote ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", color:"#aaa" }}>
                  <div style={{ fontSize:48 }}>👈</div>
                  <p style={{ fontSize:14 }}>Selecciona una nota para aplicar los 5 Porqués</p>
                </div>
              ):(()=>{
                const col=COLUMNS.find(c=>c.id===selectedNote.col)!;
                const whys: string[]=porques[selectedNote.id]?.whys||["","","","",""];
                const lastFilled=[...whys].reverse().find((w:string)=>w?.trim());
                const alreadyCreated=actList.some((a:any)=>a.fromCause===selectedNote.id);
                return (
                  <>
                    <div style={{ background:col.color, borderRadius:8, padding:12, marginBottom:20, borderLeft:`4px solid ${col.header}` }}>
                      <div style={{ fontSize:11, color:col.header, fontWeight:700, marginBottom:4 }}>{col.title.toUpperCase()}</div>
                      <div style={{ fontSize:14, fontWeight:700 }}>{selectedNote.text}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                      {[1,2,3,4,5].map(i=>{
                        const prevFilled=i===1||whys[i-2]?.trim();
                        return (
                          <div key={i} style={{ opacity:prevFilled?1:0.4 }}>
                            <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                              <div style={{ background:prevFilled?"#1565C0":"#ccc", color:"#fff", borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, flexShrink:0 }}>{i}</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:12, color:"#555", marginBottom:4, fontWeight:600 }}>
                                  {i===1?"¿Por qué ocurrió esto?":`¿Por qué "${(whys[i-2]||"").slice(0,40)}${(whys[i-2]||"").length>40?"...":""}"?`}
                                </div>
                                <textarea rows={2} disabled={!prevFilled} defaultValue={whys[i-1]||""}
                                  onBlur={e=>savePorque(selectedNote.id,i-1,e.target.value)}
                                  placeholder={prevFilled?"Escribe la respuesta...":"Completa el porqué anterior primero"}
                                  style={{ width:"100%", border:"1.5px solid #E3F2FD", borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", background:prevFilled?"#F8FBFF":"#f5f5f5", boxSizing:"border-box" }} />
                              </div>
                            </div>
                            {i<5&&<div style={{ marginLeft:16, width:2, height:10, background:"#E3F2FD", marginTop:4 }} />}
                          </div>
                        );
                      })}
                    </div>
                    {lastFilled&&(
                      <div style={{ marginTop:20 }}>
                        <div style={{ background:"#E8F5E9", borderRadius:8, padding:14, borderLeft:"4px solid #388E3C", marginBottom:12 }}>
                          <div style={{ fontSize:11, color:"#2E7D32", fontWeight:700, marginBottom:4 }}>🎯 CAUSA RAÍZ IDENTIFICADA</div>
                          <div style={{ fontSize:14, color:"#1B5E20" }}>{lastFilled}</div>
                        </div>
                        {alreadyCreated
                          ? <div style={{ background:"#E3F2FD", borderRadius:8, padding:10, fontSize:13, color:"#1565C0", textAlign:"center" }}>✅ Ya existe una acción — revísala en ✅ Acciones</div>
                          : <button onClick={()=>createActionFromCause(selectedNote,lastFilled)}
                              style={{ width:"100%", background:"#1565C0", color:"#fff", border:"none", borderRadius:8, padding:"12px 20px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                              ➕ Crear acción desde esta causa raíz → ir a Acciones
                            </button>
                        }
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ACCIONES */}
        {tab==="acciones" && (
          <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ background:"#388E3C", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:15 }}>✅ Plan de Acción</div>
            <div style={{ padding:16, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#F1F8E9" }}>
                    {["#","Origen","Problema / Contexto","Acción concreta","Responsable","Fecha límite","Prioridad",""].map(h=>(
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", borderBottom:"2px solid #C8E6C9", color:"#2E7D32", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(actList as any[]).map((a,i)=>(
                    <tr key={a.id} style={{ borderBottom:"1px solid #E8F5E9", background:a.fromCause?"#F3E5F5":"white" }}>
                      <td style={{ padding:"8px 12px", color:"#aaa", fontWeight:700 }}>{i+1}</td>
                      <td style={{ padding:"8px 12px", fontSize:11 }}>
                        {a.fromCause
                          ? <span style={{ background:"#EDE7F6", color:"#6A1B9A", borderRadius:4, padding:"2px 6px" }}>🔍 Causa raíz</span>
                          : <span style={{ background:"#E8F5E9", color:"#2E7D32", borderRadius:4, padding:"2px 6px" }}>✍️ Manual</span>}
                      </td>
                      <td style={{ padding:"8px 12px", maxWidth:140 }}>
                        {a.problem?<span style={{ fontSize:11, background:"#FFF9C4", borderRadius:4, padding:"2px 6px", color:"#795548" }}>📌 {a.problem}</span>:<span style={{ fontSize:11, color:"#ccc" }}>—</span>}
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <input defaultValue={a.what||""} onBlur={e=>updateAction(a.id,"what",e.target.value)} placeholder="¿Qué se va a hacer?"
                          style={{ width:"100%", minWidth:160, border:"none", borderBottom:"1.5px solid #C8E6C9", outline:"none", fontSize:13, padding:"4px 0", background:"transparent" }} />
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <input defaultValue={a.who||""} onBlur={e=>updateAction(a.id,"who",e.target.value)} placeholder="Nombre"
                          style={{ width:100, border:"none", borderBottom:"1.5px solid #C8E6C9", outline:"none", fontSize:13, padding:"4px 0", background:"transparent" }} />
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <input type="date" defaultValue={a.when||""} onChange={e=>updateAction(a.id,"when",e.target.value)}
                          style={{ border:"none", borderBottom:"1.5px solid #C8E6C9", outline:"none", fontSize:13, padding:"4px 0", background:"transparent" }} />
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <select defaultValue={a.priority||"🔴 Alta"} onChange={e=>updateAction(a.id,"priority",e.target.value)}
                          style={{ border:"1px solid #C8E6C9", borderRadius:6, fontSize:12, padding:"3px 6px", background:"#fff" }}>
                          <option>🔴 Alta</option><option>🟡 Media</option><option>🟢 Baja</option>
                        </select>
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <button onClick={()=>removeAction(a.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#e57373", fontSize:16 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addAction} style={{ margin:"12px 0 4px", background:"#E8F5E9", border:"2px dashed #66BB6A", borderRadius:8, padding:"8px 20px", cursor:"pointer", fontSize:13, color:"#2E7D32" }}>
                + Agregar acción manual
              </button>
            </div>
          </div>
        )}

        {/* RESUMEN */}
        {tab==="resumen" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={{ gridColumn:"1/-1", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              {[
                { label:"Notas totales",     val:filled.length,                                                                      icon:"📝", color:"#E3F2FD" },
                { label:"Participantes",      val:participants.length,                                                                icon:"👥", color:"#E8F5E9" },
                { label:"Causas raíz",        val:Object.values(porques).filter((p:any)=>p.whys?.some((w:string)=>w?.trim())).length, icon:"🔍", color:"#EDE7F6" },
                { label:"Acciones definidas", val:actList.filter((a:any)=>a.what?.trim()).length,                                    icon:"✅", color:"#FFF8E1" },
              ].map(s=>(
                <div key={s.label} style={{ background:s.color, borderRadius:12, padding:"16px 20px", textAlign:"center", boxShadow:"0 2px 6px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:28 }}>{s.icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:"#1a237e" }}>{s.val}</div>
                  <div style={{ fontSize:12, color:"#555" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ gridColumn:"1/-1", background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin:"0 0 16px", color:"#333" }}>🔗 Trazabilidad: Problema → Causa Raíz → Acción</h4>
              {Object.values(porques).filter((p:any)=>p.whys?.some((w:string)=>w?.trim())).length===0
                ? <p style={{ color:"#aaa", fontSize:13 }}>Aún no hay análisis de 5 Porqués completados.</p>
                : ANALYZE_COLS.flatMap(colId=>
                    Object.values(notes[colId]||{}).filter((n:any)=>n.text?.trim()&&porques[n.id]?.whys?.some((w:string)=>w?.trim()))
                      .map((note:any)=>{
                        const pq=porques[note.id], causeRoot=[...(pq?.whys||[])].reverse().find((w:string)=>w?.trim());
                        const relAct=actList.find((a:any)=>a.fromCause===note.id);
                        const col=COLUMNS.find(c=>c.id===colId)!;
                        return (
                          <div key={note.id} style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto 1fr", gap:8, alignItems:"center", marginBottom:12, background:"#FAFAFA", borderRadius:8, padding:12 }}>
                            <div style={{ background:col.color, borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${col.header}` }}>
                              <div style={{ fontSize:10, color:col.header, fontWeight:700, marginBottom:2 }}>📌 PROBLEMA</div>
                              <div style={{ fontSize:12 }}>{note.text.slice(0,60)}{note.text.length>60?"...":""}</div>
                              <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>👍 {note.votes} votos</div>
                            </div>
                            <div style={{ fontSize:20, color:"#1565C0", fontWeight:700 }}>→</div>
                            <div style={{ background:"#E8F5E9", borderRadius:8, padding:"8px 12px", borderLeft:"3px solid #388E3C" }}>
                              <div style={{ fontSize:10, color:"#388E3C", fontWeight:700, marginBottom:2 }}>🎯 CAUSA RAÍZ</div>
                              <div style={{ fontSize:12 }}>{(causeRoot||"").slice(0,80)}</div>
                            </div>
                            <div style={{ fontSize:20, color:"#1565C0", fontWeight:700 }}>→</div>
                            <div style={{ background:relAct?"#EDE7F6":"#f5f5f5", borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${relAct?"#7B1FA2":"#ccc"}` }}>
                              <div style={{ fontSize:10, color:relAct?"#7B1FA2":"#aaa", fontWeight:700, marginBottom:2 }}>✅ ACCIÓN</div>
                              {relAct
                                ? <><div style={{ fontSize:12 }}>{(relAct.what||"").slice(0,60)}</div><div style={{ fontSize:10, color:"#888", marginTop:2 }}>👤 {relAct.who||"Sin responsable"} · {relAct.when||"Sin fecha"}</div></>
                                : <div style={{ fontSize:12, color:"#aaa" }}>Sin acción creada</div>}
                            </div>
                          </div>
                        );
                      })
                  )
              }
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin:"0 0 14px", color:"#333" }}>🏆 Top 5 más votados</h4>
              {topVoted.length===0&&<p style={{ color:"#aaa", fontSize:13 }}>Sin votos aún.</p>}
              {(topVoted as any[]).map((n,i)=>{
                const col=COLUMNS.find(c=>c.id===n.col);
                return (
                  <div key={n.id} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                    <span style={{ background:col?.header, color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                    <div style={{ flex:1 }}><p style={{ margin:0, fontSize:13 }}>{n.text.slice(0,80)}</p><span style={{ fontSize:11, color:"#888" }}>{n.area} · {n.impact}</span></div>
                    <span style={{ fontWeight:800, color:"#F9A825" }}>👍{n.votes}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin:"0 0 14px", color:"#333" }}>👥 Participantes</h4>
              {participants.length===0&&<p style={{ color:"#aaa", fontSize:13 }}>Sin participantes.</p>}
              {participants.map(p=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ background:"#1565C0", color:"#fff", borderRadius:"50%", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                  <div><div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div><div style={{ fontSize:11, color:"#888" }}>{p.email}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}