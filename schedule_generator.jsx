import { useState } from "react";

// ═══════════════════════════════════════════════
// CONSTANTS & UTILS
// ═══════════════════════════════════════════════
const DAYS_ALL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16",
  "#06b6d4","#a78bfa","#fb923c","#4ade80","#f472b6",
];
const uid = () => Math.random().toString(36).slice(2, 8);
const toMins = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function calcDailyHrs(start, end, breaks) {
  const total = toMins(end) - toMins(start);
  const brk = breaks.reduce((s, b) => s + Math.max(0, toMins(b.end) - toMins(b.start)), 0);
  return Math.max(0, (total - brk) / 60);
}

// Build ordered timeline (class slots + breaks) for display
function buildTimeline(start, end, breaks) {
  const items = [];
  let cur = toMins(start);
  const e = toMins(end);
  const bps = [...breaks]
    .map((b) => ({ start: toMins(b.start), end: toMins(b.end) }))
    .sort((a, b) => a.start - b.start);
  let slotIdx = 0;
  while (cur < e) {
    const breakHere = bps.find((b) => b.start === cur);
    if (breakHere) {
      items.push({ type: "break", start: cur, end: breakHere.end, label: `${toTime(cur)} – ${toTime(breakHere.end)}` });
      cur = breakHere.end;
      continue;
    }
    const nb = bps.find((b) => b.start > cur);
    const slotEnd = nb && nb.start < cur + 60 ? nb.start : Math.min(cur + 60, e);
    if (slotEnd > cur) {
      items.push({ type: "slot", slotIdx: slotIdx++, start: cur, end: slotEnd, label: `${toTime(cur)} – ${toTime(slotEnd)}` });
      cur = slotEnd;
    } else break;
  }
  return items;
}

const getSlots = (s, e, b) => buildTimeline(s, e, b).filter((i) => i.type === "slot");

// ═══════════════════════════════════════════════
// SCHEDULE GENERATOR ALGORITHM
// ═══════════════════════════════════════════════
function generateSchedule(groups, subjects, groupSubjects, cfg, teachers) {
  const { selectedDays, startTime, endTime, breaks } = cfg;
  const slots = getSlots(startTime, endTime, breaks);
  const result = {};

  for (const group of groups) {
    const subIds = groupSubjects[group.id] || [];
    const groupSubs = subIds.map((id) => subjects.find((s) => s.id === id)).filter(Boolean);

    const grid = {};
    for (const day of selectedDays) grid[day] = new Array(slots.length).fill(null);

    // Build queue interleaved for even distribution
    const bySubject = {};
    for (const sub of groupSubs) {
      const hrs = Math.max(1, sub.hoursPerWeek || 2);
      const teacher = teachers.find((t) => (t.subjectIds || []).includes(sub.id)) || null;
      bySubject[sub.id] = Array(hrs).fill({ subject: sub, teacher });
    }
    const maxLen = Math.max(...Object.values(bySubject).map((a) => a.length), 0);
    const interleaved = [];
    for (let i = 0; i < maxLen; i++)
      for (const items of Object.values(bySubject))
        if (items[i]) interleaved.push(items[i]);

    // Fill grid round-robin by day
    let di = 0;
    for (const item of interleaved) {
      for (let attempt = 0; attempt < selectedDays.length * slots.length; attempt++) {
        const day = selectedDays[di % selectedDays.length];
        const si = grid[day].findIndex((s) => s === null);
        if (si !== -1) {
          grid[day][si] = { subject: item.subject, teacher: item.teacher };
          di = (di + 1) % selectedDays.length;
          break;
        }
        di++;
      }
    }
    result[group.id] = grid;
  }
  return result;
}

// ═══════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════
const C = {
  bg: "#07101f",
  surface: "rgba(12,24,44,0.92)",
  surfaceAlt: "rgba(8,16,30,0.7)",
  border: "rgba(99,102,241,0.18)",
  borderHover: "rgba(99,102,241,0.45)",
  primary: "#6366f1",
  primaryLight: "#a5b4fc",
  muted: "#546280",
  text: "#dde4f0",
  textDim: "#8a9ab5",
};

const S = {
  app: {
    minHeight: "100vh",
    background: `linear-gradient(160deg, ${C.bg} 0%, #0b1827 60%, #0e1020 100%)`,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: C.text,
    padding: "24px 12px 48px",
  },
  card: {
    background: C.surface,
    borderRadius: 20,
    border: `1px solid ${C.border}`,
    padding: "32px 28px",
    maxWidth: 860,
    margin: "0 auto",
    backdropFilter: "blur(20px)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.06) inset",
  },
  h1: { fontSize: 24, fontWeight: 800, color: C.primaryLight, marginBottom: 4, letterSpacing: "-0.5px" },
  sub: { fontSize: 13, color: C.muted, marginBottom: 28 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.9px" },
  input: { width: "100%", background: "rgba(4,10,22,0.7)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
  btn: { background: "linear-gradient(135deg,#6366f1,#4338ca)", color: "white", border: "none", borderRadius: 10, padding: "11px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.2px" },
  btnOutline: { background: "rgba(99,102,241,0.08)", color: C.primaryLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 26px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSm: { background: "rgba(99,102,241,0.12)", color: C.primaryLight, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 13px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  btnDanger: { background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" },
  row: { display: "flex", gap: 10, alignItems: "center" },
  sec: { marginBottom: 24 },
  statBox: { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", textAlign: "center" },
  divider: { height: 1, background: C.border, margin: "20px 0" },
};

// ═══════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════
function Stepper({ step }) {
  const labels = ["Info", "Grupos", "Materias", "Horario", "Docentes", "Resultado"];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 32, flexWrap: "wrap" }}>
      {labels.map((lbl, i) => {
        const n = i + 1, done = n < step, active = n === step;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? C.primary : active ? "linear-gradient(135deg,#818cf8,#6366f1)" : "rgba(99,102,241,0.08)",
                border: `2px solid ${done || active ? C.primary : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: done || active ? "white" : C.muted,
                transition: "all 0.35s",
              }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 10, color: active ? C.primaryLight : C.muted, fontWeight: active ? 700 : 400, letterSpacing: "0.3px" }}>{lbl}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ width: 28, height: 2, background: n < step ? C.primary : C.border, margin: "0 4px", marginBottom: 16, transition: "background 0.35s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Requester ──
function Step1({ state, upd, onNext }) {
  return (
    <div>
      <div style={S.h1}>📋 Información del Solicitante</div>
      <div style={S.sub}>Identifica quién solicita este horario</div>
      <div style={S.sec}>
        <label style={S.label}>Nombre completo</label>
        <input style={S.input} value={state.requesterName} autoFocus
          onChange={(e) => upd("requesterName", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && state.requesterName.trim() && onNext()}
          placeholder="Ej. Dra. Ana García / Coordinación Académica" />
      </div>
      <div style={{ textAlign: "right" }}>
        <button style={S.btn} onClick={onNext} disabled={!state.requesterName.trim()}>Continuar →</button>
      </div>
    </div>
  );
}

// ── Step 2: Groups ──
function Step2({ state, upd, onNext, onBack }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    upd("groups", [...state.groups, { id: uid(), name: name.trim() }]);
    setName("");
  };
  const remove = (id) => {
    upd("groups", state.groups.filter((g) => g.id !== id));
    const gs = { ...state.groupSubjects }; delete gs[id]; upd("groupSubjects", gs);
  };
  return (
    <div>
      <div style={S.h1}>👥 Grupos</div>
      <div style={S.sub}>Define los grupos que recibirán horario de clases</div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <input style={{ ...S.input, flex: 1 }} value={name} autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nombre del grupo (ej. 1°A, Grupo Matutino, 3°B...)" />
        <button style={S.btn} onClick={add}>+ Agregar</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {state.groups.map((g, i) => (
          <div key={g.id} style={{ ...S.row, background: "rgba(99,102,241,0.06)", borderRadius: 8, padding: "10px 16px", border: `1px solid ${C.border}` }}>
            <span style={{ color: C.primary, fontWeight: 800, minWidth: 24, fontSize: 13 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{g.name}</span>
            <button style={S.btnDanger} onClick={() => remove(g.id)}>✕</button>
          </div>
        ))}
        {!state.groups.length && <div style={{ color: C.muted, textAlign: "center", padding: 24, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 10 }}>Agrega al menos un grupo para continuar</div>}
      </div>
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <button style={S.btnOutline} onClick={onBack}>← Atrás</button>
        <button style={S.btn} onClick={onNext} disabled={!state.groups.length}>Continuar ({state.groups.length} grupo{state.groups.length !== 1 ? "s" : ""}) →</button>
      </div>
    </div>
  );
}

// ── Step 3: Subjects ──
function Step3({ state, upd, onNext, onBack }) {
  const [name, setName] = useState("");
  const [hrs, setHrs] = useState(2);

  const addSub = () => {
    if (!name.trim()) return;
    upd("subjects", [...state.subjects, { id: uid(), name: name.trim(), hoursPerWeek: hrs }]);
    setName(""); setHrs(2);
  };
  const removeSub = (id) => {
    upd("subjects", state.subjects.filter((s) => s.id !== id));
    const gs = {};
    for (const [k, v] of Object.entries(state.groupSubjects)) gs[k] = v.filter((s) => s !== id);
    upd("groupSubjects", gs);
  };
  const toggleGS = (gid, sid) => {
    const cur = state.groupSubjects[gid] || [];
    upd("groupSubjects", { ...state.groupSubjects, [gid]: cur.includes(sid) ? cur.filter((s) => s !== sid) : [...cur, sid] });
  };

  return (
    <div>
      <div style={S.h1}>📚 Materias</div>
      <div style={S.sub}>Define el catálogo de materias con horas semanales, luego asígnalas por grupo</div>

      <div style={{ ...S.row, marginBottom: 20, flexWrap: "wrap" }}>
        <input style={{ ...S.input, flex: 2, minWidth: 160 }} value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSub()}
          placeholder="Nombre de la materia (ej. Anatomía, Farmacología...)" />
        <div style={{ ...S.row, flex: 0 }}>
          <label style={{ ...S.label, margin: 0, whiteSpace: "nowrap" }}>Hrs/sem:</label>
          <input type="number" min={1} max={30} style={{ ...S.input, width: 70 }} value={hrs} onChange={(e) => setHrs(Number(e.target.value))} />
        </div>
        <button style={S.btn} onClick={addSub}>+ Agregar</button>
      </div>

      {!!state.subjects.length && (
        <div style={S.sec}>
          <label style={S.label}>Catálogo de materias ({state.subjects.length})</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {state.subjects.map((s, i) => (
              <div key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${PALETTE[i % PALETTE.length]}12`, border: `1px solid ${PALETTE[i % PALETTE.length]}40`, borderRadius: 20, padding: "4px 10px 4px 8px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                <span style={{ color: PALETTE[i % PALETTE.length], fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{s.hoursPerWeek}h</span>
                <button onClick={() => removeSub(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!state.groups.length && !!state.subjects.length && (
        <div style={S.sec}>
          <label style={S.label}>Asignación por grupo (haz clic para seleccionar / deseleccionar)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.groups.map((g) => {
              const selIds = state.groupSubjects[g.id] || [];
              const totalHrs = selIds.reduce((s, id) => s + (state.subjects.find((x) => x.id === id)?.hoursPerWeek || 0), 0);
              return (
                <div key={g.id} style={{ background: C.surfaceAlt, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: C.primaryLight, fontSize: 14 }}>📁 {g.name}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{selIds.length} materias · {totalHrs}h/sem</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {state.subjects.map((sub, i) => {
                      const sel = selIds.includes(sub.id);
                      return (
                        <button key={sub.id} onClick={() => toggleGS(g.id, sub.id)} style={{
                          border: `2px solid ${PALETTE[i % PALETTE.length]}${sel ? "" : "45"}`,
                          background: sel ? `${PALETTE[i % PALETTE.length]}20` : "transparent",
                          color: sel ? PALETTE[i % PALETTE.length] : C.muted,
                          borderRadius: 6, padding: "5px 13px", fontSize: 12, cursor: "pointer",
                          fontWeight: sel ? 700 : 400, transition: "all 0.18s"
                        }}>
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <button style={S.btnOutline} onClick={onBack}>← Atrás</button>
        <button style={S.btn} onClick={onNext} disabled={!state.subjects.length}>Continuar ({state.subjects.length} materias) →</button>
      </div>
    </div>
  );
}

// ── Step 4: Schedule Config ──
function Step4({ state, upd, onNext, onBack }) {
  const cfg = state.scheduleConfig;
  const updCfg = (k, v) => upd("scheduleConfig", { ...cfg, [k]: v });

  const toggleDay = (d) => {
    const newSel = cfg.selectedDays.includes(d)
      ? cfg.selectedDays.filter((x) => x !== d)
      : DAYS_ALL.filter((x) => cfg.selectedDays.includes(x) || x === d);
    updCfg("selectedDays", newSel);
  };

  const dh = calcDailyHrs(cfg.startTime, cfg.endTime, cfg.breaks);
  const wpg = dh * cfg.selectedDays.length;
  const total = wpg * state.groups.length;

  return (
    <div>
      <div style={S.h1}>🕐 Configuración de Horario</div>
      <div style={S.sub}>Define días hábiles, horario de entrada/salida y recesos</div>

      <div style={S.sec}>
        <label style={S.label}>Días de clase</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DAYS_ALL.map((d) => {
            const sel = cfg.selectedDays.includes(d);
            return (
              <button key={d} onClick={() => toggleDay(d)} style={{
                border: `2px solid ${sel ? C.primary : C.border}`,
                background: sel ? "rgba(99,102,241,0.18)" : "transparent",
                color: sel ? C.primaryLight : C.muted,
                borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: sel ? 800 : 400, transition: "all 0.18s"
              }}>
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={S.label}>Hora de inicio</label>
          <input type="time" style={S.input} value={cfg.startTime} onChange={(e) => updCfg("startTime", e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Hora de fin</label>
          <input type="time" style={S.input} value={cfg.endTime} onChange={(e) => updCfg("endTime", e.target.value)} />
        </div>
      </div>

      <div style={S.sec}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
          <label style={{ ...S.label, margin: 0 }}>Recesos</label>
          <button style={S.btnSm} onClick={() => updCfg("breaks", [...cfg.breaks, { start: "12:00", end: "12:30" }])}>+ Agregar receso</button>
        </div>
        {cfg.breaks.map((b, i) => (
          <div key={i} style={{ ...S.row, marginBottom: 8, background: C.surfaceAlt, borderRadius: 8, padding: "8px 12px", border: `1px solid rgba(249,115,22,0.18)` }}>
            <span style={{ color: "#f97316", fontSize: 11, minWidth: 50, fontWeight: 600 }}>☕ {i + 1}</span>
            <input type="time" style={{ ...S.input, flex: 1 }} value={b.start} onChange={(e) => { const nb = [...cfg.breaks]; nb[i] = { ...nb[i], start: e.target.value }; updCfg("breaks", nb); }} />
            <span style={{ color: C.muted, fontWeight: 700 }}>–</span>
            <input type="time" style={{ ...S.input, flex: 1 }} value={b.end} onChange={(e) => { const nb = [...cfg.breaks]; nb[i] = { ...nb[i], end: e.target.value }; updCfg("breaks", nb); }} />
            <button style={S.btnDanger} onClick={() => updCfg("breaks", cfg.breaks.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Hour stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
        {[["⏱️", `${dh.toFixed(1)}h`, "por día"], ["📅", `${wpg.toFixed(1)}h`, `por grupo (${cfg.selectedDays.length} días)`], ["🎯", `${total.toFixed(1)}h`, `total (${state.groups.length} grupos)`]].map(([icon, val, lbl], i) => (
          <div key={i} style={S.statBox}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: i === 2 ? C.primaryLight : C.primary }}>{val}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <button style={S.btnOutline} onClick={onBack}>← Atrás</button>
        <button style={S.btn} onClick={onNext} disabled={!cfg.selectedDays.length || dh <= 0}>Continuar →</button>
      </div>
    </div>
  );
}

// ── Step 5: Teachers ──
function Step5({ state, upd, onGenerate, onBack }) {
  const [name, setName] = useState("");
  const cfg = state.scheduleConfig;
  const dh = calcDailyHrs(cfg.startTime, cfg.endTime, cfg.breaks);
  const total = dh * cfg.selectedDays.length * state.groups.length;
  const assigned = state.teachers.reduce((s, t) => s + (t.maxHoursPerWeek || 0), 0);
  const remaining = total - assigned;

  const addT = () => { if (!name.trim()) return; upd("teachers", [...state.teachers, { id: uid(), name: name.trim(), maxHoursPerWeek: 0, subjectIds: [] }]); setName(""); };
  const removeT = (id) => upd("teachers", state.teachers.filter((t) => t.id !== id));
  const updT = (id, k, v) => upd("teachers", state.teachers.map((t) => t.id === id ? { ...t, [k]: v } : t));
  const toggleTS = (tid, sid) => upd("teachers", state.teachers.map((t) => {
    if (t.id !== tid) return t;
    const s = t.subjectIds || [];
    return { ...t, subjectIds: s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid] };
  }));

  const over = assigned > total;

  return (
    <div>
      <div style={S.h1}>👨‍🏫 Docentes</div>
      <div style={S.sub}>Registra docentes, asígnales horas semanales totales y materias que imparten</div>

      {/* Balance panel */}
      <div style={{ background: C.surfaceAlt, borderRadius: 14, padding: 18, border: `1px solid ${C.border}`, marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.9px", fontWeight: 700, marginBottom: 12 }}>Balance de Horas Semanales</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          {[["Disponibles", total.toFixed(1), C.primaryLight], ["Asignadas", assigned.toFixed(1), over ? "#f87171" : "#34d399"], ["Restantes", remaining.toFixed(1), remaining < 0 ? "#f87171" : "#fbbf24"]].map(([lbl, val, col]) => (
            <div key={lbl} style={{ flex: 1, minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: col }}>{val}h</div>
              <div style={{ fontSize: 11, color: C.muted }}>{lbl}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 6, background: "rgba(99,102,241,0.12)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (assigned / Math.max(total, 1)) * 100)}%`, background: over ? "linear-gradient(90deg,#ef4444,#dc2626)" : "linear-gradient(90deg,#6366f1,#10b981)", borderRadius: 3, transition: "width 0.4s" }} />
        </div>
        {over && <div style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>⚠️ Las horas asignadas superan las disponibles</div>}
      </div>

      <div style={{ ...S.row, marginBottom: 18 }}>
        <input style={{ ...S.input, flex: 1 }} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addT()} placeholder="Nombre del docente" />
        <button style={S.btn} onClick={addT}>+ Agregar</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {state.teachers.map((t) => (
          <div key={t.id} style={{ background: C.surfaceAlt, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>👤 {t.name}</span>
              <button style={S.btnDanger} onClick={() => removeT(t.id)}>✕ Eliminar</button>
            </div>
            <div style={{ ...S.row, marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <label style={{ ...S.label, margin: 0, whiteSpace: "nowrap" }}>Horas/semana:</label>
              <input type="number" min={0} max={Math.ceil(total) + 10} style={{ ...S.input, width: 80 }}
                value={t.maxHoursPerWeek} onChange={(e) => updT(t.id, "maxHoursPerWeek", Number(e.target.value))} />
              <div style={{ flex: 1, minWidth: 100, height: 8, background: "rgba(99,102,241,0.1)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (t.maxHoursPerWeek / Math.max(total, 1)) * 100)}%`, background: "#6366f1", borderRadius: 4, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 12, color: C.muted, minWidth: 30 }}>{((t.maxHoursPerWeek / Math.max(total, 1)) * 100).toFixed(0)}%</span>
            </div>
            {!!state.subjects.length && (
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.7px" }}>Materias que imparte</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {state.subjects.map((sub, si) => {
                    const sel = (t.subjectIds || []).includes(sub.id);
                    return (
                      <button key={sub.id} onClick={() => toggleTS(t.id, sub.id)} style={{
                        border: `1px solid ${PALETTE[si % PALETTE.length]}${sel ? "" : "45"}`,
                        background: sel ? `${PALETTE[si % PALETTE.length]}18` : "transparent",
                        color: sel ? PALETTE[si % PALETTE.length] : C.muted,
                        borderRadius: 5, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: sel ? 700 : 400, transition: "all 0.18s"
                      }}>
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {!state.teachers.length && (
          <div style={{ color: C.muted, textAlign: "center", padding: 24, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
            Agrega al menos un docente para continuar
          </div>
        )}
      </div>

      <div style={{ ...S.row, justifyContent: "space-between", marginTop: 24 }}>
        <button style={S.btnOutline} onClick={onBack}>← Atrás</button>
        <button style={{ ...S.btn, background: "linear-gradient(135deg,#10b981,#059669)", fontSize: 15 }}
          onClick={onGenerate} disabled={!state.teachers.length}>
          🎯 Generar Horario
        </button>
      </div>
    </div>
  );
}

// ── Step 6: Generated Schedule ──
function Step6({ state, schedules, onBack, onReset }) {
  const { groups, subjects, teachers, scheduleConfig: cfg, requesterName } = state;
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id);
  const timeline = buildTimeline(cfg.startTime, cfg.endTime, cfg.breaks);
  const grid = schedules[activeGroup];
  const subColor = (id) => { const i = subjects.findIndex((s) => s.id === id); return i >= 0 ? PALETTE[i % PALETTE.length] : C.primary; };
  const dh = calcDailyHrs(cfg.startTime, cfg.endTime, cfg.breaks);
  const wpg = dh * cfg.selectedDays.length;
  const total = wpg * groups.length;

  return (
    <div>
      <div style={{ ...S.row, justifyContent: "space-between", flexWrap: "wrap", marginBottom: 4 }}>
        <div style={S.h1}>📅 Horario Generado</div>
        <button style={S.btnSm} onClick={() => window.print()}>🖨️ Imprimir</button>
      </div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 22 }}>
        Solicitado por: <strong style={{ color: C.primaryLight }}>{requesterName}</strong>
        &nbsp;·&nbsp; {cfg.selectedDays.length} días/sem &nbsp;·&nbsp; {dh.toFixed(1)}h/día
        &nbsp;·&nbsp; <strong style={{ color: C.primaryLight }}>{wpg.toFixed(1)}h</strong>/grupo/sem
        &nbsp;·&nbsp; <strong style={{ color: C.primaryLight }}>{total.toFixed(1)}h</strong> total
      </div>

      {/* Group tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {groups.map((g) => {
          const active = activeGroup === g.id;
          return (
            <button key={g.id} onClick={() => setActiveGroup(g.id)} style={{
              border: `2px solid ${active ? C.primary : C.border}`,
              background: active ? "rgba(99,102,241,0.18)" : "transparent",
              color: active ? C.primaryLight : C.muted,
              borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: active ? 800 : 400
            }}>
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Timetable */}
      {grid && (
        <div style={{ overflowX: "auto", marginBottom: 28, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ background: "rgba(99,102,241,0.1)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", width: 110 }}>Hora</th>
                {cfg.selectedDays.map((d) => (
                  <th key={d} style={{ padding: "10px 8px", textAlign: "center", color: C.primaryLight, fontSize: 12, fontWeight: 800 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((item, ti) => {
                if (item.type === "break") {
                  return (
                    <tr key={`brk-${ti}`} style={{ background: "rgba(249,115,22,0.04)" }}>
                      <td style={{ padding: "6px 14px", color: "#f97316", fontSize: 11, fontWeight: 600, borderTop: "1px solid rgba(249,115,22,0.15)", fontStyle: "italic" }}>{item.label}</td>
                      <td colSpan={cfg.selectedDays.length} style={{ textAlign: "center", color: "#f97316", fontSize: 11, borderTop: "1px solid rgba(249,115,22,0.15)", fontStyle: "italic" }}>☕ Receso</td>
                    </tr>
                  );
                }
                const si = item.slotIdx;
                return (
                  <tr key={`slt-${ti}`}>
                    <td style={{ padding: "4px 14px", color: C.textDim, fontSize: 11, borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap", fontWeight: 500 }}>{item.label}</td>
                    {cfg.selectedDays.map((d) => {
                      const cell = grid[d]?.[si];
                      if (!cell) return (
                        <td key={d} style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ height: 56, background: "rgba(7,14,28,0.4)", borderRadius: 6 }} />
                        </td>
                      );
                      const col = subColor(cell.subject.id);
                      return (
                        <td key={d} style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ height: 56, background: `${col}14`, border: `1px solid ${col}40`, borderRadius: 6, padding: "5px 8px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <div style={{ color: col, fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>{cell.subject.name}</div>
                            {cell.teacher && <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{cell.teacher.name}</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={S.sec}>
        <label style={S.label}>Leyenda de Materias</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {subjects.filter((s) => (state.groupSubjects[activeGroup] || []).includes(s.id)).map((sub, i) => {
            const gi = subjects.findIndex((x) => x.id === sub.id);
            const col = PALETTE[gi % PALETTE.length];
            return (
              <div key={sub.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${col}12`, border: `1px solid ${col}35`, borderRadius: 16, padding: "4px 11px 4px 8px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
                <span style={{ color: col, fontSize: 12, fontWeight: 700 }}>{sub.name}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{sub.hoursPerWeek}h/sem</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Teachers summary */}
      <div style={S.sec}>
        <label style={S.label}>Resumen de Docentes</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 10 }}>
          {teachers.map((t) => (
            <div key={t.id} style={S.statBox}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 6 }}>👤 {t.name}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.primary }}>{t.maxHoursPerWeek}h</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>por semana</div>
              {!!(t.subjectIds || []).length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                  {(t.subjectIds || []).map((sid) => {
                    const sub = subjects.find((s) => s.id === sid);
                    const si = subjects.findIndex((s) => s.id === sid);
                    return sub ? (
                      <span key={sid} style={{ fontSize: 10, color: PALETTE[si % PALETTE.length], background: `${PALETTE[si % PALETTE.length]}15`, borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
                        {sub.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <button style={S.btnOutline} onClick={onBack}>← Editar</button>
        <button style={{ ...S.btn, background: "linear-gradient(135deg,#6366f1,#0ea5e9)" }} onClick={onReset}>+ Nuevo Horario</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
const INIT = {
  requesterName: "",
  groups: [],
  subjects: [],
  groupSubjects: {},
  scheduleConfig: {
    selectedDays: ["Lunes", "Martes", "Miércoles", "Jueves"],
    startTime: "09:00",
    endTime: "13:30",
    breaks: [{ start: "11:00", end: "11:30" }],
  },
  teachers: [],
  generatedSchedules: null,
};

export default function App() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState(INIT);
  const upd = (k, v) => setState((s) => ({ ...s, [k]: v }));

  const handleGenerate = () => {
    const sched = generateSchedule(state.groups, state.subjects, state.groupSubjects, state.scheduleConfig, state.teachers);
    setState((s) => ({ ...s, generatedSchedules: sched }));
    setStep(6);
  };

  const reset = () => { setState(INIT); setStep(1); };

  return (
    <div style={S.app}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: 700 }}>
          Sistema Generador de Horarios
        </div>
      </div>
      <Stepper step={step} />
      <div style={S.card}>
        {step === 1 && <Step1 state={state} upd={upd} onNext={() => setStep(2)} />}
        {step === 2 && <Step2 state={state} upd={upd} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3 state={state} upd={upd} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Step4 state={state} upd={upd} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <Step5 state={state} upd={upd} onGenerate={handleGenerate} onBack={() => setStep(4)} />}
        {step === 6 && state.generatedSchedules && (
          <Step6 state={state} schedules={state.generatedSchedules} onBack={() => setStep(5)} onReset={reset} />
        )}
      </div>
    </div>
  );
}
