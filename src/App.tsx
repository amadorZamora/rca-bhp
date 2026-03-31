import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, onSnapshot,
  doc, setDoc, deleteDoc, updateDoc, increment
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
const db = getFirestore(app);

const COLUMNS = [
  { id: "problemas", title: "¿Qué Problema Tuvimos?",                    color: "#FFF176", header: "#F9A825", placeholder: "Describe el problema..." },
  { id: "mejorar",   title: "¿Qué Podríamos Mejorar?",                   color: "#C8E6C9", header: "#66BB6A", placeholder: "¿Qué se podría haber hecho diferente?" },
  { id: "bien",      title: "¿Qué Hicimos Bien?",                        color: "#BBDEFB", header: "#42A5F5", placeholder: "¿Qué funcionó correctamente?" },
  { id: "lecciones", title: "¿Qué Lecciones Aplican a Otros Proyectos?", color: "#F8BBD0", header: "#EC407A", placeholder: "Lección transferible..." },
];
const IMPACT  = ["🔴 Alto", "🟡 Medio", "🟢 Bajo"];
const AREAS   = ["Planificación", "Ejecución", "Comunicación", "Recursos", "Técnico", "Seguridad", "Otro"];
const ADMIN_PW = "bhp2024";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function App() {
  const [userName,      setUserName]      = useState("");
  const [nameSet,       setNameSet]       = useState(false);
  const [tab,           setTab]           = useState("board");
  const [notes,         setNotes]         = useState<Record<string, Record<string, any>>>({});
  const [actions,       setActions]       = useState<Record<string, any>>({});
  const [voted,         setVoted]         = useState<Record<string, boolean>>({});
  const [saving,        setSaving]        = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Firestore listeners
  useEffect(() => {
    const unsubs = COLUMNS.map(col =>
      onSnapshot(collection(db, "notes", col.id, "items"), snap => {
        const items: Record<string, any> = {};
        snap.forEach(d => { items[d.id] = { id: d.id, ...d.data() }; });
        setNotes(prev => ({ ...prev, [col.id]: items }));
      })
    );
    const unsubAct = onSnapshot(collection(db, "actions"), snap => {
      const items: Record<string, any> = {};
      snap.forEach(d => { items[d.id] = { id: d.id, ...d.data() }; });
      setActions(items);
    });
    return () => { unsubs.forEach(u => u()); unsubAct(); };
  }, []);

  // Note helpers
  const addNote = async (colId: string) => {
    const id = uid();
    await setDoc(doc(db, "notes", colId, "items", id), {
      text: "", author: userName, impact: "", area: "", votes: 0, createdAt: Date.now(),
    });
  };

  const updateNote = async (colId: string, id: string, field: string, val: string) => {
    setSaving(true);
    await setDoc(doc(db, "notes", colId, "items", id), { [field]: val }, { merge: true });
    setSaving(false);
  };

  const removeNote = async (colId: string, id: string) => {
    await deleteDoc(doc(db, "notes", colId, "items", id));
  };

  const voteNote = async (colId: string, id: string) => {
    const key = `${colId}-${id}`;
    if (voted[key]) return;
    setVoted(v => ({ ...v, [key]: true }));
    await updateDoc(doc(db, "notes", colId, "items", id), { votes: increment(1) });
  };

  // Action helpers
  const addAction = async () => {
    const id = uid();
    await setDoc(doc(db, "actions", id), { what: "", who: "", when: "", priority: "🔴 Alta", createdAt: Date.now() });
  };

  const updateAction = async (id: string, field: string, val: string) => {
    await setDoc(doc(db, "actions", id), { [field]: val }, { merge: true });
  };

  const removeAction = async (id: string) => {
    await deleteDoc(doc(db, "actions", id));
  };

  // Admin
  const unlockAdmin = () => {
    const pwd = prompt("Ingresa la contraseña para acceder:");
    if (pwd === ADMIN_PW) setAdminUnlocked(true);
    else alert("Contraseña incorrecta.");
  };

  const clearAll = async () => {
    const pwd = prompt("Contraseña para limpiar el board:");
    if (pwd !== ADMIN_PW) return alert("Contraseña incorrecta.");
    if (!confirm("¿Seguro? Esto borrará TODAS las notas y acciones.")) return;
    for (const col of COLUMNS) {
      for (const id of Object.keys(notes[col.id] || {})) {
        await deleteDoc(doc(db, "notes", col.id, "items", id));
      }
    }
    for (const id of Object.keys(actions)) {
      await deleteDoc(doc(db, "actions", id));
    }
    setVoted({});
    alert("✅ Board limpiado correctamente.");
  };

  // Derived
  const allNotes = COLUMNS.flatMap(c => Object.values(notes[c.id] || {}).map((n: any) => ({ ...n, col: c.id })));
  const filled   = allNotes.filter((n: any) => n.text?.trim());
  const topVoted = [...filled].sort((a: any, b: any) => b.votes - a.votes).slice(0, 5);
  const byArea   = AREAS.map(a => ({ area: a, count: filled.filter((n: any) => n.area === a).length })).filter(x => x.count > 0);
  const byImpact = IMPACT.map(i => ({ impact: i, count: filled.filter((n: any) => n.impact === i).length }));
  const actList  = Object.values(actions).sort((a: any, b: any) => a.createdAt - b.createdAt);

  const PROTECTED = ["votar", "acciones", "resumen", "porques"];

  // 5 Porqués helpers
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [porques, setPorques] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "porques"), snap => {
      const items: Record<string, any> = {};
      snap.forEach(d => { items[d.id] = { id: d.id, ...d.data() }; });
      setPorques(items as any);
    });
    return () => unsub();
  }, []);

  const savePorque = async (problemId: string, index: number, val: string) => {
    const ref = doc(db, "porques", problemId);
    const current = (porques as any)[problemId]?.whys || ["", "", "", "", ""];
    const updated = [...current];
    updated[index] = val;
    await setDoc(ref, { problemId, whys: updated }, { merge: true });
  };

  // ── Login screen ─────────────────────────────────────────────
  if (!nameSet) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, maxWidth: 400, width: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🪨</div>
          <h2 style={{ margin: "0 0 6px", color: "#1a237e" }}>RCA – Lecciones Aprendidas</h2>
          <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>
            Proyecto BHP · Completa este board <strong>antes de la reunión</strong>
          </p>
          <input
            placeholder="Tu nombre o iniciales"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && userName.trim() && setNameSet(true)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #90CAF9", fontSize: 15, boxSizing: "border-box", marginBottom: 14 }}
          />
          <button
            onClick={() => userName.trim() && setNameSet(true)}
            style={{ background: "#1565C0", color: "#fff", border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 15, cursor: "pointer", width: "100%" }}
          >
            Entrar al Board →
          </button>
        </div>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1565C0", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700 }}>🪨 RCA · Lecciones Aprendidas</span>
          <span style={{ marginLeft: 12, opacity: 0.7, fontSize: 13 }}>BHP Project Review</span>
          {saving && <span style={{ marginLeft: 12, fontSize: 11, opacity: 0.7 }}>💾 guardando...</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 14px", fontSize: 13 }}>👤 {userName}</span>
          {([["board", "📝 Board"], ["votar", "🗳️ Votar"], ["porques", "🔍 5 Porqués"], ["acciones", "✅ Acciones"], ["resumen", "📊 Resumen"]] as [string, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? "#fff" : "rgba(255,255,255,0.15)", color: tab === t ? "#1565C0" : "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 13, cursor: "pointer", fontWeight: tab === t ? 700 : 400 }}>
              {t === "porques" ? "🔍 5 Porqués" : label}{PROTECTED.includes(t) && !adminUnlocked ? " 🔒" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Banners */}
      {tab === "board" && (
        <div style={{ background: "#E3F2FD", borderLeft: "4px solid #1565C0", margin: "16px 24px 0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#0D47A1" }}>
          📋 <strong>Antes de la reunión:</strong> Agrega tus notas en cada columna. Indica el área y nivel de impacto. Sé específico — esto hará la discusión presencial mucho más rica.
        </div>
      )}
      {tab === "votar" && adminUnlocked && (
        <div style={{ background: "#FFF8E1", borderLeft: "4px solid #F9A825", margin: "16px 24px 0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#E65100" }}>
          🗳️ <strong>Votación (reunión presencial):</strong> Dale 👍 a los puntos más críticos. 1 voto por nota por persona.
        </div>
      )}
      {tab === "acciones" && adminUnlocked && (
        <div style={{ background: "#E8F5E9", borderLeft: "4px solid #388E3C", margin: "16px 24px 0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#1B5E20" }}>
          ✅ <strong>Plan de Acción (al final de la reunión):</strong> Cada acción debe tener un responsable y fecha.
        </div>
      )}

      <div style={{ padding: "16px 24px" }}>

        {/* Lock screen */}
        {PROTECTED.includes(tab) && !adminUnlocked && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 48, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", maxWidth: 380 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🔒</div>
              <h3 style={{ margin: "0 0 8px", color: "#1a237e" }}>Sección bloqueada</h3>
              <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
                Esta sección está reservada para la <strong>reunión presencial</strong>.<br />
                Por ahora solo puedes completar el <strong>Board</strong>.
              </p>
              <button onClick={unlockAdmin}
                style={{ background: "#1565C0", color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 15, cursor: "pointer", width: "100%" }}>
                Soy facilitador — Ingresar contraseña
              </button>
            </div>
          </div>
        )}

        {/* BOARD */}
        {tab === "board" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {COLUMNS.map(col => {
              const colNotes = Object.values(notes[col.id] || {}).sort((a: any, b: any) => a.createdAt - b.createdAt);
              return (
                <div key={col.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                  <div style={{ background: col.header, padding: "12px 16px", textAlign: "center", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                    {col.title}
                    <span style={{ marginLeft: 8, background: "rgba(255,255,255,0.3)", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>
                      {colNotes.filter((n: any) => n.text?.trim()).length}
                    </span>
                  </div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                    {(colNotes as any[]).map(note => (
                      <div key={note.id} style={{ background: col.color, borderRadius: 8, padding: 10, boxShadow: "2px 2px 6px rgba(0,0,0,0.1)", position: "relative" }}>
                        <button onClick={() => removeNote(col.id, note.id)}
                          style={{ position: "absolute", top: 4, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#999" }}>×</button>
                        <textarea rows={3} defaultValue={note.text} placeholder={col.placeholder}
                          onBlur={e => updateNote(col.id, note.id, "text", e.target.value)}
                          style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, resize: "none", fontFamily: "inherit", outline: "none", marginBottom: 6 }} />
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <select defaultValue={note.area} onChange={e => updateNote(col.id, note.id, "area", e.target.value)}
                            style={{ fontSize: 10, borderRadius: 4, border: "1px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.6)", padding: "2px 4px", flex: 1 }}>
                            <option value="">Área...</option>
                            {AREAS.map(a => <option key={a}>{a}</option>)}
                          </select>
                          <select defaultValue={note.impact} onChange={e => updateNote(col.id, note.id, "impact", e.target.value)}
                            style={{ fontSize: 10, borderRadius: 4, border: "1px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.6)", padding: "2px 4px", flex: 1 }}>
                            <option value="">Impacto...</option>
                            {IMPACT.map(i => <option key={i}>{i}</option>)}
                          </select>
                        </div>
                        {note.author && <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>✍️ {note.author}</div>}
                      </div>
                    ))}
                    <button onClick={() => addNote(col.id)}
                      style={{ background: "rgba(0,0,0,0.05)", border: "2px dashed rgba(0,0,0,0.15)", borderRadius: 8, padding: 8, cursor: "pointer", fontSize: 13, color: "#555" }}>
                      + Agregar nota
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VOTAR */}
        {tab === "votar" && adminUnlocked && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {COLUMNS.map(col => {
              const colNotes = Object.values(notes[col.id] || {}).filter((n: any) => n.text?.trim()).sort((a: any, b: any) => b.votes - a.votes);
              return (
                <div key={col.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                  <div style={{ background: col.header, padding: "10px 16px", textAlign: "center", fontWeight: 700, fontSize: 13, color: "#fff" }}>{col.title}</div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 560, overflowY: "auto" }}>
                    {colNotes.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 20 }}>Sin notas aún</p>}
                    {(colNotes as any[]).map(note => {
                      const key = `${col.id}-${note.id}`;
                      return (
                        <div key={note.id} style={{ background: col.color, borderRadius: 8, padding: 10, boxShadow: "2px 2px 6px rgba(0,0,0,0.08)" }}>
                          <p style={{ margin: "0 0 6px", fontSize: 13 }}>{note.text}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              {note.area   && <span style={{ fontSize: 10, background: "rgba(0,0,0,0.1)", borderRadius: 4, padding: "1px 6px" }}>{note.area}</span>}
                              {note.impact && <span style={{ fontSize: 10, background: "rgba(0,0,0,0.1)", borderRadius: 4, padding: "1px 6px" }}>{note.impact}</span>}
                            </div>
                            <button onClick={() => voteNote(col.id, note.id)}
                              style={{ background: voted[key] ? "#1565C0" : "rgba(255,255,255,0.6)", color: voted[key] ? "#fff" : "#333", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 20, padding: "3px 12px", cursor: voted[key] ? "default" : "pointer", fontSize: 12, fontWeight: 700 }}>
                              👍 {note.votes}
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

        {/* ACCIONES */}
        {tab === "acciones" && adminUnlocked && (
          <div>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <div style={{ background: "#388E3C", color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 15 }}>✅ Plan de Acción — ¿Qué haremos diferente?</div>
              <div style={{ padding: 16, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F1F8E9" }}>
                      {["#", "Acción concreta", "Responsable", "Fecha límite", "Prioridad", ""].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #C8E6C9", color: "#2E7D32", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(actList as any[]).map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #E8F5E9", background: a.fromCause ? "#F3E5F5" : "white" }}>
                        <td style={{ padding: "8px 12px", color: "#aaa", fontWeight: 700 }}>
                          {i + 1}{a.fromCause && <span title="Generada desde causa raíz" style={{ marginLeft: 4, fontSize: 11 }}>🔍</span>}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <input defaultValue={a.what} onBlur={e => updateAction(a.id, "what", e.target.value)} placeholder="¿Qué se va a hacer exactamente?"
                            style={{ width: "100%", border: "none", borderBottom: "1.5px solid #C8E6C9", outline: "none", fontSize: 13, padding: "4px 0", background: "transparent" }} />
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <input defaultValue={a.who} onBlur={e => updateAction(a.id, "who", e.target.value)} placeholder="Nombre"
                            style={{ width: 120, border: "none", borderBottom: "1.5px solid #C8E6C9", outline: "none", fontSize: 13, padding: "4px 0", background: "transparent" }} />
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <input type="date" defaultValue={a.when} onChange={e => updateAction(a.id, "when", e.target.value)}
                            style={{ border: "none", borderBottom: "1.5px solid #C8E6C9", outline: "none", fontSize: 13, padding: "4px 0", background: "transparent" }} />
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <select defaultValue={a.priority} onChange={e => updateAction(a.id, "priority", e.target.value)}
                            style={{ border: "1px solid #C8E6C9", borderRadius: 6, fontSize: 12, padding: "3px 6px", background: "#fff" }}>
                            <option>🔴 Alta</option>
                            <option>🟡 Media</option>
                            <option>🟢 Baja</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <button onClick={() => removeAction(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e57373", fontSize: 16 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addAction}
                  style={{ margin: "12px 0 4px", background: "#E8F5E9", border: "2px dashed #66BB6A", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, color: "#2E7D32" }}>
                  + Agregar acción
                </button>
              </div>
            </div>
            {topVoted.length > 0 && (
              <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                <h4 style={{ margin: "0 0 10px", color: "#333", fontSize: 14 }}>🔥 Temas más votados — prioriza acciones aquí</h4>
                {(topVoted as any[]).map((n, i) => (
                  <div key={n.id} style={{ background: "#FFF8E1", borderRadius: 6, padding: "6px 12px", fontSize: 13, display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>{i + 1}. {n.text.slice(0, 80)}{n.text.length > 80 ? "..." : ""}</span>
                    <span style={{ fontWeight: 700, color: "#F9A825" }}>👍 {n.votes}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5 PORQUÉS */}
        {tab === "porques" && adminUnlocked && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>

            {/* Lista de problemas top votados */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin: "0 0 14px", color: "#333" }}>🔥 Problemas para analizar</h4>
              <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Selecciona un problema para aplicar los 5 Porqués</p>
              {filled.filter((n: any) => n.col === "problemas" && n.text?.trim()).sort((a: any, b: any) => b.votes - a.votes).length === 0 && (
                <p style={{ color: "#aaa", fontSize: 13 }}>No hay problemas registrados aún.</p>
              )}
              {filled.filter((n: any) => n.col === "problemas" && n.text?.trim()).sort((a: any, b: any) => b.votes - a.votes).map((n: any) => {
                const isSelected = selectedProblem?.id === n.id;
                const hasWhys = (porques as any)[n.id]?.whys?.some((w: string) => w?.trim());
                return (
                  <div key={n.id} onClick={() => setSelectedProblem(n)}
                    style={{ background: isSelected ? "#E3F2FD" : "#FFF9C4", border: isSelected ? "2px solid #1565C0" : "2px solid transparent", borderRadius: 8, padding: 10, marginBottom: 8, cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400 }}>{n.text.slice(0, 80)}{n.text.length > 80 ? "..." : ""}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#888" }}>{n.area}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#F9A825" }}>👍 {n.votes} {hasWhys ? "· ✅ analizado" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Panel 5 Porqués */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              {!selectedProblem ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", color: "#aaa" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
                  <p style={{ fontSize: 14 }}>Selecciona un problema para comenzar el análisis</p>
                </div>
              ) : (
                <>
                  <div style={{ background: "#FFF9C4", borderRadius: 8, padding: 12, marginBottom: 20, borderLeft: "4px solid #F9A825" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>PROBLEMA A ANALIZAR</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedProblem.text}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[1, 2, 3, 4, 5].map(i => {
                      const whys = (porques as any)[selectedProblem.id]?.whys || ["", "", "", "", ""];
                      const prevFilled = i === 1 || whys[i - 2]?.trim();
                      return (
                        <div key={i} style={{ opacity: prevFilled ? 1 : 0.4, transition: "opacity 0.3s" }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <div style={{ background: prevFilled ? "#1565C0" : "#ccc", color: "#fff", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{i}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: "#555", marginBottom: 4, fontWeight: 600 }}>
                                {i === 1 ? "¿Por qué ocurrió el problema?" : `¿Por qué ${whys[i - 2]?.slice(0, 40) || "..."}?`}
                              </div>
                              <textarea
                                rows={2}
                                disabled={!prevFilled}
                                defaultValue={whys[i - 1] || ""}
                                onBlur={e => savePorque(selectedProblem.id, i - 1, e.target.value)}
                                placeholder={prevFilled ? "Escribe la respuesta aquí..." : "Completa el porqué anterior primero"}
                                style={{ width: "100%", border: "1.5px solid #E3F2FD", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", background: prevFilled ? "#F8FBFF" : "#f5f5f5", boxSizing: "border-box" }}
                              />
                            </div>
                          </div>
                          {i < 5 && <div style={{ marginLeft: 16, width: 2, height: 10, background: "#E3F2FD", marginTop: 4 }} />}
                        </div>
                      );
                    })}
                  </div>
                  {/* Causa raíz + botón crear acción */}
                  {(() => {
                    const whys = (porques as any)[selectedProblem.id]?.whys || [];
                    const lastFilled = [...whys].reverse().find((w: string) => w?.trim());
                    const alreadyCreated = actList.some((a: any) => a.fromCause === selectedProblem.id);
                    return lastFilled ? (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ background: "#E8F5E9", borderRadius: 8, padding: 14, borderLeft: "4px solid #388E3C", marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: "#2E7D32", fontWeight: 700, marginBottom: 4 }}>🎯 CAUSA RAÍZ IDENTIFICADA</div>
                          <div style={{ fontSize: 14, color: "#1B5E20" }}>{lastFilled}</div>
                        </div>
                        {alreadyCreated ? (
                          <div style={{ background: "#E3F2FD", borderRadius: 8, padding: 10, fontSize: 13, color: "#1565C0", textAlign: "center" }}>
                            ✅ Ya existe una acción creada desde esta causa raíz — revísala en <strong>✅ Acciones</strong>
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              const id = uid();
                              await setDoc(doc(db, "actions", id), {
                                what: `[Causa raíz] ${lastFilled}`,
                                who: "",
                                when: "",
                                priority: "🔴 Alta",
                                createdAt: Date.now(),
                                fromCause: selectedProblem.id,
                                problem: selectedProblem.text.slice(0, 60),
                              });
                              setTab("acciones");
                            }}
                            style={{ width: "100%", background: "#1565C0", color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                            ➕ Crear acción desde esta causa raíz → ir a Acciones
                          </button>
                        )}
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {/* RESUMEN */}
        {tab === "resumen" && adminUnlocked && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                { label: "Notas totales",     val: filled.length,                                                         icon: "📝", color: "#E3F2FD" },
                { label: "Participantes",      val: [...new Set(filled.map((n: any) => n.author).filter(Boolean))].length, icon: "👥", color: "#E8F5E9" },
                { label: "Acciones definidas", val: actList.filter((a: any) => a.what?.trim()).length,                     icon: "✅", color: "#FFF8E1" },
                { label: "Votos emitidos",     val: filled.reduce((s: number, n: any) => s + n.votes, 0),                 icon: "🗳️", color: "#FCE4EC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.color, borderRadius: 12, padding: "16px 20px", textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 28 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#1a237e" }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin: "0 0 14px", color: "#333" }}>📊 Notas por categoría</h4>
              {COLUMNS.map(col => {
                const cnt = Object.values(notes[col.id] || {}).filter((n: any) => n.text?.trim()).length;
                const max = Math.max(...COLUMNS.map(c => Object.values(notes[c.id] || {}).filter((n: any) => n.text?.trim()).length), 1);
                return (
                  <div key={col.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span>{col.title}</span><span style={{ fontWeight: 700 }}>{cnt}</span>
                    </div>
                    <div style={{ background: "#eee", borderRadius: 4, height: 8 }}>
                      <div style={{ background: col.header, height: 8, borderRadius: 4, width: `${(cnt / max) * 100}%`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin: "0 0 14px", color: "#333" }}>🏗️ Áreas con más incidencias</h4>
              {byArea.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>Asigna áreas a las notas para ver este gráfico.</p>}
              {[...byArea].sort((a, b) => b.count - a.count).map(({ area, count }) => (
                <div key={area} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, minWidth: 90 }}>{area}</span>
                  <div style={{ flex: 1, background: "#eee", borderRadius: 4, height: 10 }}>
                    <div style={{ background: "#5C6BC0", height: 10, borderRadius: 4, width: `${(count / filled.length) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin: "0 0 14px", color: "#333" }}>🎯 Distribución por impacto</h4>
              {byImpact.map(({ impact, count }) => (
                <div key={impact} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, minWidth: 80 }}>{impact}</span>
                  <div style={{ flex: 1, background: "#eee", borderRadius: 4, height: 10 }}>
                    <div style={{ background: impact.includes("Alto") ? "#e53935" : impact.includes("Medio") ? "#FFA726" : "#66BB6A", height: 10, borderRadius: 4, width: `${(count / Math.max(filled.length, 1)) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h4 style={{ margin: "0 0 14px", color: "#333" }}>🏆 Top 5 puntos más votados</h4>
              {topVoted.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>Aún no hay votos.</p>}
              {(topVoted as any[]).map((n, i) => {
                const col = COLUMNS.find(c => c.id === n.col);
                return (
                  <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ background: col?.header, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13 }}>{n.text.slice(0, 100)}{n.text.length > 100 ? "..." : ""}</p>
                      <span style={{ fontSize: 11, color: "#888" }}>{n.area} · {n.impact}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: "#F9A825", fontSize: 14 }}>👍{n.votes}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ gridColumn: "1/-1", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={clearAll}
                style={{ background: "#ffebee", border: "1.5px solid #e57373", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13, color: "#c62828", fontWeight: 700 }}>
                🗑️ Limpiar todo el board (admin)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}