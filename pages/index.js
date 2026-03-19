import { useState, useEffect, useMemo, useRef } from "react";
import { getStatus, issuerStatus, isStale } from "../lib/data";

const AZ = "rgb(55,81,114)";
const L = {
  ok: "rgb(101,169,124)", okBg: "rgba(101,169,124,0.12)",
  warn: "rgb(214,158,46)", warnBg: "rgba(214,158,46,0.12)",
  danger: "rgb(210,70,80)", dangerBg: "rgba(210,70,80,0.1)",
  sub: "#7a7f9a", border: "rgba(0,0,0,0.07)", bg: "#f0f2f5",
};
const CHART_COLORS = [
  "#3751729e","rgb(101,169,124)","rgb(214,158,46)","rgb(210,70,80)",
  "#7c5cbf","#e07b39","#3ba8c4","#c45b8a","#5b8a5b","#c4a43b"
];
const DEFAULT_UNITS = ["x (veces)", "%", "UF", "CLP", "USD", "EUR", "MM CLP", "MM UF"];
const DEFAULT_SECTORS = [
  "Agroindustria","Alimentos","Construcción","Educación","Energía","Financiero",
  "Industrial","Inmobiliario","Minería","Retail","Salud","Servicios",
  "Tecnología","Telecomunicaciones","Transporte"
];

function fmtNum(n, suffix = "x") {
  if (n === null || n === undefined || isNaN(n)) return null;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + intFmt + "," + decPart + (suffix ? " " + suffix : "");
}
function parseNum(s) {
  if (!s && s !== 0) return NaN;
  const str = String(s).trim();
  if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", "."));
  return parseFloat(str);
}

function Dot({ status, size = 8 }) {
  const c = { ok: L.ok, warning: L.warn, breach: L.danger, na: "#ccc" };
  return <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%", background:c[status]||"#ccc", flexShrink:0 }} />;
}
function Pill({ status }) {
  const st = { ok:{background:L.okBg,color:"rgb(40,120,70)"}, warning:{background:L.warnBg,color:"rgb(150,110,20)"}, breach:{background:L.dangerBg,color:"rgb(170,40,50)"}, na:{background:"#f0f0f0",color:L.sub} };
  const lb = { ok:"Cumple", warning:"En riesgo", breach:"Incumple", na:"S/D" };
  return <span style={{ ...st[status]||st.na, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:500 }}>{lb[status]||"S/D"}</span>;
}

// Sparkline chart (inline SVG)
function Sparkline({ data, width = 80, height = 28, color = AZ }) {
  if (!data || data.length < 2) return <span style={{ color:L.sub, fontSize:10 }}>sin datos</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r={3} fill={color} />
    </svg>
  );
}

// Line chart for covenant evolution
function CovenantChart({ history, covenantName, issuer }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ textAlign:"center", padding:"32px 0", color:L.sub, fontSize:12 }}>
        <div style={{ fontSize:24, marginBottom:8 }}>📊</div>
        Se necesitan al menos 2 períodos de datos para mostrar la evolución.<br/>
        Carga más EEFF para construir el historial.
      </div>
    );
  }

  const cov = issuer.covenants.find(c => c.name === covenantName);
  const lim = cov?.lim;
  const unit = cov?.unidad || "x";

  // Build series
  const points = history.map(h => {
    const snap = h.covenants.find(c => c.name === covenantName);
    return { fecha: h.fecha, val: snap?.act ?? null, status: snap?.status || "na" };
  }).filter(p => p.val !== null);

  if (points.length < 2) return (
    <div style={{ textAlign:"center", padding:"32px 0", color:L.sub, fontSize:12 }}>
      Sin suficientes datos históricos para este covenant.
    </div>
  );

  const allVals = points.map(p => p.val);
  if (lim != null) allVals.push(lim);
  const minV = Math.min(...allVals) * 0.85;
  const maxV = Math.max(...allVals) * 1.15;
  const range = maxV - minV || 1;

  const W = 520, H = 180, PAD = { top:16, right:16, bottom:32, left:48 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const toX = i => PAD.left + (i / (points.length - 1)) * cw;
  const toY = v => PAD.top + ch - ((v - minV) / range) * ch;

  const linePts = points.map((p, i) => `${toX(i)},${toY(p.val)}`).join(" ");
  const limY = lim != null ? toY(lim) : null;

  // Y axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i) / ticks);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke={L.border} strokeWidth={1} />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize={9} fill={L.sub}>
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {/* Limit line */}
      {limY != null && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={limY} y2={limY} stroke={L.danger} strokeWidth={1.5} strokeDasharray="5,4" />
          <text x={W - PAD.right + 4} y={limY + 4} fontSize={9} fill={L.danger}>Límite</text>
        </g>
      )}
      {/* Area fill */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={AZ} stopOpacity="0.18" />
          <stop offset="100%" stopColor={AZ} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon
        points={`${PAD.left},${PAD.top + ch} ${linePts} ${W - PAD.right},${PAD.top + ch}`}
        fill="url(#areaGrad)" />
      {/* Line */}
      <polyline points={linePts} fill="none" stroke={AZ} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {points.map((p, i) => {
        const col = p.status === "breach" ? L.danger : p.status === "warning" ? L.warn : L.ok;
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.val)} r={5} fill="#fff" stroke={col} strokeWidth={2} />
            <text x={toX(i)} y={toY(p.val) - 10} textAnchor="middle" fontSize={9} fill={col} fontWeight="600">
              {p.val.toFixed(2).replace(".", ",")}
            </text>
          </g>
        );
      })}
      {/* X axis labels */}
      {points.map((p, i) => (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={L.sub}>{p.fecha}</text>
      ))}
    </svg>
  );
}

// Excel export using SheetJS (loaded from CDN)
async function exportToExcel(issuer, history) {
  // Dynamically load xlsx
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");

  const wb = XLSX.utils.book_new();

  // Sheet 1: Current covenants
  const covData = [
    ["Covenant", "Tipo", "Operador", "Límite", "Unidad", "Valor Actual", "Holgura", "Estado"],
    ...issuer.covenants.map(c => [
      c.name, c.tipo, c.op, c.lim, c.unidad || "x",
      c.act ?? "N/D", c.holgura ?? "N/D",
      getStatus(c) === "ok" ? "Cumple" : getStatus(c) === "warning" ? "En riesgo" : getStatus(c) === "breach" ? "Incumple" : "S/D"
    ])
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(covData);
  ws1["!cols"] = [{ wch:30 }, { wch:8 }, { wch:10 }, { wch:10 }, { wch:10 }, { wch:12 }, { wch:12 }, { wch:12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Covenants actuales");

  // Sheet 2: Historical data (pivot: fechas as columns, covenants as rows)
  if (history && history.length > 0) {
    const allPeriods = [...new Set(history.map(h => h.fecha))];
    const allCovNames = [...new Set(history.flatMap(h => h.covenants.map(c => c.name)))];

    const histHeader = ["Covenant", "Límite", "Operador", ...allPeriods];
    const histRows = allCovNames.map(name => {
      const cov = issuer.covenants.find(c => c.name === name);
      const row = [name, cov?.lim ?? "", cov?.op ?? ""];
      allPeriods.forEach(p => {
        const snap = history.find(h => h.fecha === p);
        const val = snap?.covenants.find(c => c.name === name)?.act ?? "";
        row.push(val);
      });
      return row;
    });

    const ws2 = XLSX.utils.aoa_to_sheet([histHeader, ...histRows]);
    ws2["!cols"] = [{ wch:30 }, { wch:10 }, { wch:10 }, ...allPeriods.map(() => ({ wch:12 }))];
    XLSX.utils.book_append_sheet(wb, ws2, "Evolución histórica");
  }

  // Sheet 3: Issuer info
  const infoData = [
    ["Emisor", issuer.name],
    ["Sector", issuer.sector],
    ["Clasificación", issuer.clasificacion],
    ["Último EEFF", issuer.fechaEEFF],
    ["Total covenants", issuer.covenants.length],
    ["En cumplimiento", issuer.covenants.filter(c => getStatus(c) === "ok").length],
    ["En riesgo", issuer.covenants.filter(c => getStatus(c) === "warning").length],
    ["Incumplimiento", issuer.covenants.filter(c => getStatus(c) === "breach").length],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(infoData);
  ws3["!cols"] = [{ wch:20 }, { wch:30 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Información");

  XLSX.writeFile(wb, `${issuer.name.replace(/\s+/g, "_")}_covenants.xlsx`);
}

// CreatableSelect component
function CreatableSelect({ value, onChange, options, placeholder = "Seleccionar...", width = "100%" }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVal, setNewVal] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sinp = { border:`1px solid ${L.border}`, borderRadius:4, padding:"7px 10px", fontSize:12, fontFamily:"inherit", outline:"none", width:"100%" };
  return (
    <div ref={ref} style={{ position:"relative", width }}>
      <div onClick={() => setOpen(p => !p)} style={{ ...sinp, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", userSelect:"none" }}>
        <span style={{ color: value ? "#2d3142" : L.sub }}>{value || placeholder}</span>
        <span style={{ color:L.sub, fontSize:10 }}>▾</span>
      </div>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:3000, background:"#fff", border:`1px solid ${L.border}`, borderRadius:5, boxShadow:"0 6px 20px rgba(0,0,0,0.12)", maxHeight:200, overflow:"auto" }}>
          {options.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false); }}
              style={{ padding:"8px 12px", cursor:"pointer", fontSize:12, color:o===value?AZ:"#2d3142", background:o===value?"rgba(55,81,114,0.06)":"#fff", fontWeight:o===value?600:400 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(55,81,114,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = o===value ? "rgba(55,81,114,0.06)" : "#fff"}>
              {o}
            </div>
          ))}
          {!creating && (
            <div onClick={() => setCreating(true)}
              style={{ padding:"8px 12px", cursor:"pointer", fontSize:12, color:AZ, fontWeight:600, borderTop:`1px solid ${L.border}`, display:"flex", alignItems:"center", gap:6 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(55,81,114,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <span>＋</span> Crear nuevo...
            </div>
          )}
          {creating && (
            <div style={{ padding:"8px 10px", borderTop:`1px solid ${L.border}`, display:"flex", gap:6 }}>
              <input autoFocus value={newVal} onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newVal.trim()) { onChange(newVal.trim()); setOpen(false); setCreating(false); setNewVal(""); }
                  if (e.key === "Escape") { setCreating(false); setNewVal(""); }
                }}
                placeholder="Nuevo valor..."
                style={{ border:`1px solid ${L.border}`, borderRadius:4, padding:"5px 8px", fontSize:11, fontFamily:"inherit", outline:"none", flex:1 }} />
              <button onClick={() => { if (newVal.trim()) { onChange(newVal.trim()); setOpen(false); setCreating(false); setNewVal(""); } }}
                style={{ background:AZ, color:"#fff", border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>✓</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// CovenantPicker
function CovenantPicker({ issuer, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [all, setAll] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    fetch("/api/issuers").then(r => r.json()).then(list => {
      const seen = new Set(); const covs = []; const cnt = {};
      list.forEach(iss => iss.covenants.forEach(c => { cnt[c.name] = (cnt[c.name] || 0) + 1; }));
      list.forEach(iss => {
        if (iss.id === issuer?.id) return;
        iss.covenants.forEach(c => {
          const k = c.name + "||" + c.tipo + "||" + c.op;
          if (!seen.has(k)) { seen.add(k); covs.push({ name:c.name, tipo:c.tipo, op:c.op, _count:cnt[c.name]||1 }); }
        });
      });
      covs.sort((a, b) => b._count - a._count || a.name.localeCompare(b.name));
      setAll(covs);
    });
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = all.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const sinp = { border:`1px solid ${L.border}`, borderRadius:4, padding:"5px 8px", fontSize:12, outline:"none", fontFamily:"inherit", width:"100%" };
  return (
    <div ref={ref} style={{ position:"absolute", top:"100%", right:0, zIndex:2000, background:"#fff", border:`1px solid ${L.border}`, borderRadius:6, boxShadow:"0 8px 30px rgba(0,0,0,0.15)", width:340, maxHeight:280, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}` }}>
        <input autoFocus placeholder="Buscar covenant..." value={search} onChange={e => setSearch(e.target.value)} style={sinp} />
      </div>
      <div style={{ overflowY:"auto", flex:1 }}>
        <div onClick={() => onSelect(null)} style={{ padding:"8px 12px", cursor:"pointer", borderBottom:`1px solid ${L.border}`, background:"rgba(55,81,114,0.04)", display:"flex", alignItems:"center", gap:6 }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(55,81,114,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(55,81,114,0.04)"}>
          <span style={{ fontSize:13, color:AZ }}>＋</span>
          <span style={{ fontSize:12, fontWeight:600, color:AZ }}>Crear covenant nuevo</span>
        </div>
        {filtered.length === 0 && <div style={{ padding:"14px 12px", color:L.sub, fontSize:12, textAlign:"center" }}>Sin resultados</div>}
        {filtered.map((c, i) => (
          <div key={i} onClick={() => onSelect(c)} style={{ padding:"7px 12px", cursor:"pointer", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f8f9fb"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
            <div>
              <div style={{ fontSize:12, fontWeight:500 }}>{c.name} <span style={{ color:L.sub, fontWeight:400 }}>{c.op}</span></div>
              <div style={{ fontSize:10, color:L.sub, marginTop:1 }}>{c.tipo} · {c._count} emisor{c._count !== 1 ? "es" : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// CovRow component
function CovRow({ r, isNew, onUpdate, onRemove, allUnits, setAllUnits }) {
  const sinp = (w) => ({ border:`1px solid ${L.border}`, borderRadius:4, padding:"4px 6px", fontSize:11, fontFamily:"inherit", outline:"none", width:w||"100%" });
  const num = parseNum(r.actualVal);
  const lim = r.lim !== null && r.lim !== undefined ? r.lim : parseNum(r.limite);
  const st = !isNaN(num) && !isNaN(lim) ? getStatus({...r, act:num, lim}) : "na";
  const holgura = !isNaN(num) && !isNaN(lim) ? (r.op === "<=" ? lim - num : num - lim) : null;
  const unit = r.unidad || "x (veces)";
  return (
    <tr style={{ background: isNew ? "rgba(55,81,114,0.04)" : "transparent" }}>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><input style={sinp(160)} placeholder="ej: DFN/EBITDA" value={r.name} onChange={e => onUpdate(r._id, "name", e.target.value)} /></td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(62)} value={r.tipo} onChange={e => onUpdate(r._id, "tipo", e.target.value)}><option value="flujo">flujo</option><option value="stock">stock</option></select></td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(48)} value={r.op} onChange={e => onUpdate(r._id, "op", e.target.value)}><option value="<=">≤</option><option value=">=">≥</option></select></td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><input style={sinp(65)} placeholder="ej: 3,50" value={r.limite} onChange={e => { onUpdate(r._id, "limite", e.target.value); onUpdate(r._id, "lim", parseNum(e.target.value)); }} /></td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}`, minWidth:100 }}>
        <CreatableSelect value={unit} onChange={v => { onUpdate(r._id, "unidad", v); if (!allUnits.includes(v)) setAllUnits(p => [...p, v]); }} options={allUnits} placeholder="Unidad" width="95px" />
      </td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><input style={{ ...sinp(75), borderColor: st==="breach"?L.danger:st==="warning"?L.warn:L.border }} placeholder="ej: 2,50" value={r.actualVal} onChange={e => onUpdate(r._id, "actualVal", e.target.value)} /></td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}`, whiteSpace:"nowrap" }}>{holgura !== null ? <span style={{ color:st==="breach"?L.danger:st==="warning"?L.warn:L.sub, fontWeight:500, fontSize:11 }}>{fmtNum(holgura, unit)}</span> : <span style={{ color:"#ccc" }}>—</span>}</td>
      <td style={{ padding:"4px 5px", borderBottom:`1px solid ${L.border}` }}><button onClick={() => onRemove(r._id)} style={{ background:L.dangerBg, color:"rgb(170,40,50)", border:"none", borderRadius:4, padding:"3px 7px", cursor:"pointer", fontSize:10 }}>✕</button></td>
    </tr>
  );
}

function buildCovenant(r) {
  const num = parseNum(r.actualVal);
  const lim = r.lim !== null && r.lim !== undefined ? r.lim : parseNum(r.limite);
  const unit = r.unidad || "x (veces)";
  if (isNaN(num)) return { name:r.name, tipo:r.tipo||"flujo", op:r.op||">=", lim:isNaN(lim)?null:lim, limite:r.limite||"", unidad:unit, actual:null, act:null, holgura:null, actualStr:null, holguraStr:null };
  const holgura = r.op === "<=" ? lim - num : num - lim;
  return { name:r.name, tipo:r.tipo||"flujo", op:r.op||">=", lim:isNaN(lim)?null:lim, limite:r.limite||fmtNum(lim,unit), unidad:unit, actual:fmtNum(num,unit), act:num, holgura:isNaN(holgura)?null:holgura, actualStr:fmtNum(num,unit), holguraStr:fmtNum(holgura,unit) };
}

function EditIssuerModal({ issuer, onClose, onSuccess, allIssuers }) {
  const [name, setName] = useState(issuer.name || "");
  const [sector, setSector] = useState(issuer.sector || "");
  const [clasificacion, setClasificacion] = useState(issuer.clasificacion || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const existingSectors = useMemo(() => {
    const s = new Set(DEFAULT_SECTORS);
    (allIssuers || []).forEach(i => { if (i.sector && i.sector !== "Sin sector") s.add(i.sector); });
    return [...s].sort();
  }, [allIssuers]);
  async function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/issuers", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id, name:name.trim(), sector:sector||issuer.sector, clasificacion:clasificacion||issuer.clasificacion }) });
      if (!res.ok) throw new Error("Error guardando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });
  const inp = { border:`1px solid ${L.border}`, borderRadius:4, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%" };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:600, color:AZ }}>Editar emisor</div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
          <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Nombre *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Sector / Industria</label><CreatableSelect value={sector||undefined} onChange={v => setSector(v)} options={existingSectors} placeholder="Seleccionar o crear sector..." /></div>
          <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Clasificación</label><input style={inp} placeholder="ej: AA, AA-, A+" value={clasificacion} onChange={e => setClasificacion(e.target.value)} /></div>
          {error && <p style={{ color:L.danger, fontSize:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4, margin:0 }}>⚠ {error}</p>}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading} style={{ ...btn(), flex:2 }}>{loading ? "Guardando..." : "✓ Guardar cambios"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteIssuerModal({ issuer, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function handleDelete() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/issuers", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id }) });
      if (!res.ok) throw new Error("Error eliminando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}` }}><div style={{ fontSize:15, fontWeight:600, color:L.danger }}>Eliminar emisor</div></div>
        <div style={{ padding:24 }}>
          <p style={{ fontSize:13, color:"#2d3142", marginBottom:8 }}>¿Estás seguro que quieres eliminar <strong>{issuer.name}</strong>?</p>
          <p style={{ fontSize:12, color:L.sub, marginBottom:20 }}>Esta acción eliminará el emisor y todos sus covenants. No se puede deshacer.</p>
          {error && <p style={{ color:L.danger, fontSize:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4, marginBottom:12 }}>⚠ {error}</p>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>Cancelar</button>
            <button onClick={handleDelete} disabled={loading} style={{ ...btn(L.danger), flex:2 }}>{loading ? "Eliminando..." : "🗑 Eliminar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewIssuerModal({ onClose, onSuccess, allIssuers }) {
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [clasificacion, setClasificacion] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState([]);
  const [fechaEEFF, setFechaEEFF] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState("direct");
  const [allUnits, setAllUnits] = useState([...DEFAULT_UNITS]);
  const existingSectors = useMemo(() => {
    const s = new Set(DEFAULT_SECTORS);
    (allIssuers || []).forEach(i => { if (i.sector && i.sector !== "Sin sector") s.add(i.sector); });
    return [...s].sort();
  }, [allIssuers]);
  async function handleExtract() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("pdf", file); fd.append("issuerName", name.trim() || "Nuevo emisor");
      fd.append("covenants", JSON.stringify([])); fd.append("detectMode", "true");
      if (mode === "smart") fd.append("smartMode", "true");
      const res = await fetch("/api/extract-pdf", { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const found = (data.covenants || []).map(c => ({ ...c, tipo:c.tipo||"flujo", op:c.op||">=", lim:c.lim||null, limite:c.limite||"", unidad:c.unidad||"x (veces)", actualVal:c.act!=null?String(c.act):"", _id:Math.random(), _needsInput:c.actual===null }));
      setDetected(found); setFechaEEFF(data.fechaEEFF || ""); setStep("review");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  function addExtra(template) { setShowPicker(false); setDetected(prev => [...prev, { _id:Math.random(), name:template?.name||"", tipo:template?.tipo||"flujo", op:template?.op||">=", lim:null, limite:"", unidad:"x (veces)", actual:null, act:null, actualVal:"", _isExtra:true, _needsInput:true }]); }
  function removeDetected(id) { setDetected(prev => prev.filter(r => r._id !== id)); }
  function updateDetected(id, field, val) { setDetected(prev => prev.map(r => r._id !== id ? r : { ...r, [field]: val })); }
  async function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true); setError("");
    try {
      const listRes = await fetch("/api/issuers"); const list = await listRes.json();
      const covenants = detected.filter(r => r.name.trim()).map(buildCovenant);
      const newIssuer = { id:name.trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")+"-"+Date.now(), name:name.trim(), sector:sector||"Sin sector", clasificacion:clasificacion||"—", fechaEEFF:fechaEEFF||"—", covenants };
      const res = await fetch("/api/issuers", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify([...list, newIssuer]) });
      if (!res.ok) throw new Error("Error guardando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });
  const inp = { border:`1px solid ${L.border}`, borderRadius:4, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%" };
  const sinp = (w) => ({ border:`1px solid ${L.border}`, borderRadius:4, padding:"5px 7px", fontSize:11, fontFamily:"inherit", outline:"none", width:w||"100%" });
  const missingRequired = detected.filter(r => r.name.trim() && r._needsInput && !parseNum(r.actualVal));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:step==="review"?820:480, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:600, color:AZ }}>{step==="form"?"Nuevo emisor":step==="eeff"?"Cargar EEFF":`Covenants — ${name}`}</div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          {step === "form" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Nombre *</label><input style={inp} placeholder="ej: Empresas Copec S.A." value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
              <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Sector / Industria</label><CreatableSelect value={sector||undefined} onChange={v => setSector(v)} options={existingSectors} placeholder="Seleccionar o crear sector..." /></div>
              <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Clasificación</label><input style={inp} placeholder="ej: AA, AA-, A+" value={clasificacion} onChange={e => setClasificacion(e.target.value)} /></div>
              {error && <p style={{ color:L.danger, fontSize:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4, margin:0 }}>⚠ {error}</p>}
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>Cancelar</button>
                <button onClick={() => { if (!name.trim()) { setError("El nombre es obligatorio"); return; } setError(""); setStep("eeff"); }} style={{ ...btn("rgba(55,81,114,0.1)",AZ), flex:1, fontSize:12 }}>Sin EEFF →</button>
                <button onClick={() => { if (!name.trim()) { setError("El nombre es obligatorio"); return; } setError(""); setStep("eeff"); }} style={{ ...btn(), flex:2 }}>📄 Cargar EEFF →</button>
              </div>
            </div>
          )}
          {step === "eeff" && (
            <>
              <div style={{ display:"flex", gap:0, marginBottom:14, border:`1px solid ${L.border}`, borderRadius:6, overflow:"hidden" }}>
                {[["direct","📄 PDF directo","< 80 págs"],["smart","🧠 Modo inteligente","Cualquier tamaño"]].map(([m,label,sub]) => (
                  <button key={m} onClick={() => { setMode(m); setFile(null); setError(""); }} style={{ flex:1, padding:"9px 12px", border:"none", cursor:"pointer", fontFamily:"inherit", background:mode===m?AZ:"#f8f9fb", color:mode===m?"#fff":"#2d3142", borderRight:m==="direct"?`1px solid ${L.border}`:"none", textAlign:"center" }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{label}</div><div style={{ fontSize:10, opacity:0.7, marginTop:1 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ border:`2px dashed ${L.border}`, borderRadius:6, padding:28, textAlign:"center", marginBottom:14, background:file?"rgba(55,81,114,0.03)":"#fafafa" }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{mode==="smart"?"🧠":"📄"}</div>
                <p style={{ color:AZ, fontWeight:600, marginBottom:4 }}>{name}</p>
                {file && <p style={{ color:AZ, fontSize:12, fontWeight:500, marginBottom:8 }}>✓ {file.name}</p>}
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} style={{ display:"none" }} id="new-pdf-input" />
                <label htmlFor="new-pdf-input" style={{ ...btn("#f0f0f0",AZ), cursor:"pointer", fontSize:12 }}>{file?"Cambiar archivo":"Seleccionar PDF"}</label>
              </div>
              {error && <p style={{ color:L.danger, fontSize:12, marginBottom:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setStep("form"); setError(""); }} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>← Volver</button>
                <button onClick={() => { setDetected([]); setStep("review"); }} style={{ ...btn("rgba(55,81,114,0.1)",AZ), flex:1, fontSize:12 }}>Sin EEFF →</button>
                <button onClick={handleExtract} disabled={!file||loading} style={{ ...btn(file&&!loading?AZ:"#ccc"), flex:2, fontSize:12 }}>{loading?"⏳ Analizando...":"✨ Detectar covenants"}</button>
              </div>
            </>
          )}
          {step === "review" && (
            <>
              <div style={{ background:"rgba(55,81,114,0.06)", border:`1px solid rgba(55,81,114,0.2)`, borderRadius:6, padding:"10px 14px", marginBottom:12, fontSize:12 }}>
                {detected.length > 0 ? <><strong>Claude detectó {detected.length} covenant{detected.length!==1?"s":""}</strong>{fechaEEFF && <span style={{ color:L.sub }}> · Período: {fechaEEFF}</span>}</> : <span style={{ color:L.sub }}>Sin covenants detectados. Agrégalos manualmente.</span>}
              </div>
              {missingRequired.length > 0 && <div style={{ background:L.warnBg, border:`1px solid ${L.warn}`, borderRadius:5, padding:"7px 12px", marginBottom:10, fontSize:11, color:"rgb(120,90,10)" }}>⚠ Completa {missingRequired.length} campo{missingRequired.length!==1?"s":""} faltante{missingRequired.length!==1?"s":""} antes de guardar.</div>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:3, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Período EEFF</label><input style={sinp(140)} placeholder="ej: dic-24" value={fechaEEFF} onChange={e => setFechaEEFF(e.target.value)} /></div>
                <div style={{ position:"relative" }}><button onClick={() => setShowPicker(p=>!p)} style={{ ...btn("rgba(55,81,114,0.1)",AZ), fontSize:12 }}>＋ Agregar covenant</button>{showPicker && <CovenantPicker issuer={{id:"__new__"}} onSelect={addExtra} onClose={() => setShowPicker(false)} />}</div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:700 }}>
                  <thead><tr>{["Covenant","Tipo","Op.","Límite","Unidad","Valor actual","Holgura",""].map(h => <th key={h} style={{ textAlign:"left", padding:"6px 8px", background:AZ, color:"#fff", fontSize:10, fontWeight:500 }}>{h}</th>)}</tr></thead>
                  <tbody>{detected.map(r => <CovRow key={r._id} r={r} isNew={!!r._isExtra} onUpdate={updateDetected} onRemove={removeDetected} allUnits={allUnits} setAllUnits={setAllUnits} />)}</tbody>
                </table>
              </div>
              {detected.length === 0 && <div style={{ textAlign:"center", padding:"14px 0", color:L.sub, fontSize:12 }}>Sin covenants.</div>}
              {error && <p style={{ color:L.danger, fontSize:12, marginTop:8, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button onClick={() => setStep("eeff")} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>← Volver</button>
                <button onClick={handleSave} disabled={loading||missingRequired.length>0} style={{ ...btn(missingRequired.length>0?"#ccc":AZ), flex:2, cursor:missingRequired.length>0?"not-allowed":"pointer" }}>
                  {loading?"Guardando...":missingRequired.length>0?`Completa ${missingRequired.length} campo${missingRequired.length!==1?"s":""} faltante${missingRequired.length!==1?"s":""}` :"✓ Crear emisor"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditModal({ issuer, onClose, onSuccess }) {
  const [rows, setRows] = useState(() => issuer.covenants.map(c => ({ ...c, actualVal:c.act!=null?String(c.act):"", unidad:c.unidad||"x (veces)", _id:Math.random() })));
  const [fechaEEFF, setFechaEEFF] = useState(issuer.fechaEEFF || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [allUnits, setAllUnits] = useState([...DEFAULT_UNITS]);
  function addRow(template) { setShowPicker(false); setRows(prev => [...prev, { ...(template||{}), name:template?.name||"", tipo:template?.tipo||"flujo", op:template?.op||">=", lim:null, limite:"", unidad:"x (veces)", actual:null, act:null, holgura:null, actualVal:"", _id:Math.random() }]); }
  function removeRow(id) { setRows(prev => prev.filter(r => r._id !== id)); }
  function updateRow(id, field, value) { setRows(prev => prev.map(r => r._id !== id ? r : { ...r, [field]: value })); }
  async function handleSave() {
    setLoading(true); setError("");
    try {
      const covenants = rows.filter(r => r.name.trim()).map(buildCovenant);
      const res = await fetch("/api/issuers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id, covenants, fechaEEFF, replaceAll:true }) });
      if (!res.ok) throw new Error("Error guardando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"7px 14px", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit" });
  const sinp = (w) => ({ border:`1px solid ${L.border}`, borderRadius:4, padding:"5px 7px", fontSize:11, fontFamily:"inherit", outline:"none", width:w||"100%" });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:860, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:15, fontWeight:600, color:AZ }}>{issuer.name}</div><div style={{ fontSize:12, color:L.sub }}>Editar covenants</div></div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div><label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:3, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Período EEFF</label><input style={sinp(150)} placeholder="ej: dic-24" value={fechaEEFF} onChange={e => setFechaEEFF(e.target.value)} /></div>
            <div style={{ position:"relative" }}><button onClick={() => setShowPicker(p=>!p)} style={{ ...btn("rgba(55,81,114,0.1)",AZ) }}>＋ Agregar covenant</button>{showPicker && <CovenantPicker issuer={issuer} onSelect={addRow} onClose={() => setShowPicker(false)} />}</div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:720 }}>
              <thead><tr>{["Nombre","Tipo","Op.","Límite","Unidad","Valor actual","Holgura",""].map(h => <th key={h} style={{ textAlign:"left", padding:"6px 8px", background:AZ, color:"#fff", fontSize:10, fontWeight:500 }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(r => <CovRow key={r._id} r={r} isNew={!issuer.covenants.find(c=>c.name===r.name)} onUpdate={updateRow} onRemove={removeRow} allUnits={allUnits} setAllUnits={setAllUnits} />)}</tbody>
            </table>
          </div>
          {rows.length === 0 && <div style={{ textAlign:"center", padding:"16px 0", color:L.sub, fontSize:12 }}>Sin covenants.</div>}
          {error && <p style={{ color:L.danger, fontSize:12, marginTop:10, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading} style={{ ...btn(), flex:2 }}>{loading?"Guardando...":"✓ Guardar cambios"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ issuer, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [extraRows, setExtraRows] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("upload");
  const [showPicker, setShowPicker] = useState(false);
  const [fechaEEFF, setFechaEEFF] = useState("");
  const [mode, setMode] = useState("direct");
  const [allUnits, setAllUnits] = useState([...DEFAULT_UNITS]);
  async function handleExtract() {
    if (!file) return; setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("pdf", file); fd.append("issuerName", issuer.name); fd.append("covenants", JSON.stringify(issuer.covenants));
      if (mode === "smart") fd.append("smartMode", "true");
      const res = await fetch("/api/extract-pdf", { method:"POST", body:fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      const detectedMap = {}; (data.covenants || []).forEach(c => { detectedMap[c.name] = c; });
      const existingUpdated = issuer.covenants.map(cov => { const d = detectedMap[cov.name]; return { ...cov, unidad:cov.unidad||"x (veces)", actualVal:d?.actual!=null?String(d.actual):"", _found:d?.actual!=null, _nota:d?.nota||"", _isNew:false, _id:Math.random() }; });
      const newlyDetected = (data.covenants || []).filter(c => !issuer.covenants.find(x => x.name===c.name) && c.actual!=null).map(c => ({ name:c.name, tipo:c.tipo||"flujo", op:c.op||">=", lim:c.lim||null, limite:c.limite||"", unidad:c.unidad||"x (veces)", actualVal:String(c.actual), _found:true, _nota:c.nota||"detectado en PDF", _isNew:true, _id:Math.random() }));
      setRows([...existingUpdated, ...newlyDetected]); setFechaEEFF(data.fechaEEFF || ""); setResult(data); setStep("confirm");
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }
  async function handleCalculateExtra() {
    if (!file || extraRows.filter(r=>r.name.trim()).length===0) return;
    setCalculating(true); setError("");
    try {
      const fd = new FormData(); fd.append("pdf", file); fd.append("issuerName", issuer.name); fd.append("covenants", JSON.stringify([]));
      fd.append("calculateExtra", JSON.stringify(extraRows.filter(r=>r.name.trim()).map(r=>({name:r.name,tipo:r.tipo||"flujo",op:r.op||">=",lim:parseNum(r.limite)}))));
      const res = await fetch("/api/extract-pdf", { method:"POST", body:fd }); const data = await res.json(); if (!res.ok) throw new Error(data.error);
      const calcMap = {}; (data.covenants || []).forEach(c => { calcMap[c.name] = c; });
      setExtraRows(prev => prev.map(r => { const calc = calcMap[r.name.trim()]; if (calc) return { ...r, actual:calc.actual, actualStr:calc.actualStr, actualVal:calc.actual!=null?String(calc.actual):"", holgura:calc.holgura, holguraStr:calc.holguraStr }; return r; }));
    } catch(e) { setError(e.message); } finally { setCalculating(false); }
  }
  function updateRow(id, field, val) { setRows(prev => prev.map(r => r._id!==id?r:{...r,[field]:val})); }
  function removeRow(id) { setRows(prev => prev.filter(r => r._id!==id)); }
  function addExtra(template) { setShowPicker(false); setExtraRows(prev => [...prev, { ...(template||{}), name:template?.name||"", tipo:template?.tipo||"flujo", op:template?.op||">=", lim:null, limite:"", unidad:"x (veces)", actual:null, actualStr:null, actualVal:"", holgura:null, holguraStr:null, _id:Math.random() }]); }
  function removeExtra(id) { setExtraRows(prev => prev.filter(r => r._id!==id)); }
  function updateExtra(id, field, val) { setExtraRows(prev => prev.map(r => r._id!==id?r:{...r,[field]:val})); }
  async function handleSave() {
    setLoading(true);
    try {
      const allCovs = [...rows, ...extraRows].filter(r => r.name?.trim()).map(buildCovenant);
      const res = await fetch("/api/issuers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id, covenants:allCovs, fechaEEFF, replaceAll:true }) });
      if (!res.ok) throw new Error("Error guardando"); onSuccess();
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }
  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });
  const sinp = (w) => ({ border:`1px solid ${L.border}`, borderRadius:4, padding:"4px 7px", fontSize:11, fontFamily:"inherit", outline:"none", width:w||"100%" });
  const newlyFound = rows.filter(r => r._isNew); const notFound = rows.filter(r => !r._found && !r._isNew);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:step==="confirm"?900:540, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:15, fontWeight:600, color:AZ }}>{issuer.name}</div><div style={{ fontSize:12, color:L.sub }}>{step==="upload"?"Subir EEFF":"Confirmar covenants detectados"}</div></div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          {step === "upload" && (
            <>
              <div style={{ display:"flex", gap:0, marginBottom:14, border:`1px solid ${L.border}`, borderRadius:6, overflow:"hidden" }}>
                {[["direct","📄 PDF directo","< 80 págs"],["smart","🧠 Modo inteligente","Cualquier tamaño"]].map(([m,label,sub]) => (
                  <button key={m} onClick={() => { setMode(m); setFile(null); setError(""); }} style={{ flex:1, padding:"10px 12px", border:"none", cursor:"pointer", fontFamily:"inherit", background:mode===m?AZ:"#f8f9fb", color:mode===m?"#fff":"#2d3142", borderRight:m==="direct"?`1px solid ${L.border}`:"none", textAlign:"center" }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{label}</div><div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              {mode==="direct" && <div style={{ background:"rgba(55,81,114,0.05)", borderRadius:5, padding:"7px 12px", marginBottom:12, fontSize:11, color:L.sub }}>Sube un PDF de <strong>máximo 80 páginas</strong>. Recomendado: balance + EERR + notas de bonos.</div>}
              {mode==="smart" && <div style={{ background:"rgba(101,169,124,0.08)", border:`1px solid ${L.ok}`, borderRadius:5, padding:"7px 12px", marginBottom:12, fontSize:11, color:"rgb(40,100,60)" }}>Sube el <strong>EEFF completo</strong>. El sistema detecta automáticamente las páginas relevantes.</div>}
              <div style={{ border:`2px dashed ${L.border}`, borderRadius:6, padding:26, textAlign:"center", marginBottom:12, background:file?"rgba(55,81,114,0.03)":"#fafafa" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{mode==="smart"?"🧠":"📄"}</div>
                <p style={{ color:AZ, fontWeight:500, marginBottom:6 }}>{file?file.name:mode==="smart"?"Sube el EEFF completo":"Sube el PDF del EEFF"}</p>
                <p style={{ color:L.sub, fontSize:11, marginBottom:12 }}>{mode==="smart"?"Cualquier tamaño — se extraerán páginas relevantes automáticamente":"Balance + EERR + notas de bonos (máx 80 págs)"}</p>
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} style={{ display:"none" }} id="pdf-input" />
                <label htmlFor="pdf-input" style={{ ...btn("#f0f0f0",AZ), cursor:"pointer", fontSize:12 }}>{file?"Cambiar archivo":"Seleccionar PDF"}</label>
              </div>
              {error && <p style={{ color:L.danger, fontSize:12, marginBottom:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
              <button onClick={handleExtract} disabled={!file||loading} style={{ ...btn(file&&!loading?AZ:"#ccc"), width:"100%" }}>{loading?(mode==="smart"?"⏳ Extrayendo páginas relevantes...":"⏳ Analizando con Claude AI..."):(mode==="smart"?"🧠 Analizar PDF completo":"✨ Extraer covenants con IA")}</button>
            </>
          )}
          {step === "confirm" && (
            <>
              <div style={{ background:"rgba(55,81,114,0.06)", border:`1px solid rgba(55,81,114,0.2)`, borderRadius:6, padding:"10px 14px", marginBottom:12, fontSize:12 }}>
                <strong>Período: {fechaEEFF}</strong>
                {result?._smartInfo && <span style={{ color:L.sub, marginLeft:8, fontSize:11 }}>📄 {result._smartInfo.totalPages} págs → {result._smartInfo.selectedCount} analizadas</span>}
                {newlyFound.length > 0 && <span style={{ color:"rgb(40,120,70)", marginLeft:8 }}>✓ {newlyFound.length} nuevo{newlyFound.length!==1?"s":""}</span>}
                {notFound.length > 0 && <span style={{ color:L.warn, marginLeft:8 }}>⚠ {notFound.length} no encontrado{notFound.length!==1?"s":""}</span>}
              </div>
              {newlyFound.length > 0 && <div style={{ background:"rgba(101,169,124,0.08)", border:`1px solid ${L.ok}`, borderRadius:5, padding:"7px 12px", marginBottom:10, fontSize:12 }}><strong style={{ color:"rgb(40,120,70)" }}>✓ Nuevos covenants: </strong>{newlyFound.map(r=>r.name).join(", ")}</div>}
              {notFound.length > 0 && <div style={{ background:L.warnBg, border:`1px solid ${L.warn}`, borderRadius:5, padding:"7px 12px", marginBottom:10, fontSize:12 }}><strong style={{ color:"rgb(120,90,10)" }}>⚠ Sin datos: </strong>{notFound.map(r=>r.name).join(", ")}<div style={{ color:L.sub, marginTop:3, fontSize:11 }}>Ingrésalos manualmente.</div></div>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <p style={{ fontSize:11, fontWeight:600, color:AZ, textTransform:"uppercase", letterSpacing:0.5 }}>Lista completa de covenants</p>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}><label style={{ fontSize:10, color:L.sub }}>Período:</label><input style={sinp(90)} value={fechaEEFF} onChange={e => setFechaEEFF(e.target.value)} /></div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:760, marginBottom:12 }}>
                  <thead><tr>{["Covenant","Tipo","Op.","Límite","Unidad","Valor","Holgura","Fuente",""].map(h => <th key={h} style={{ textAlign:"left", padding:"6px 8px", background:AZ, color:"#fff", fontSize:10, fontWeight:500 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.map(r => {
                      const num = parseNum(r.actualVal); const lim = r.lim!==null&&r.lim!==undefined?r.lim:parseNum(r.limite);
                      const st = !isNaN(num)&&!isNaN(lim)?getStatus({...r,act:num,lim}):"na";
                      const holgura = !isNaN(num)&&!isNaN(lim)?(r.op==="<="?lim-num:num-lim):null;
                      const unit = r.unidad||"x (veces)";
                      return (
                        <tr key={r._id} style={{ background:r._isNew?"rgba(101,169,124,0.06)":!r._found?"rgba(255,200,0,0.05)":"transparent" }}>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}`, fontWeight:500, fontSize:11 }}>{r.name}{r._isNew && <span style={{ marginLeft:4, fontSize:9, background:"rgba(101,169,124,0.2)", color:"rgb(40,120,70)", borderRadius:3, padding:"1px 4px" }}>NUEVO</span>}</td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(58)} value={r.tipo||"flujo"} onChange={e=>updateRow(r._id,"tipo",e.target.value)}><option value="flujo">flujo</option><option value="stock">stock</option></select></td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(44)} value={r.op||">="} onChange={e=>updateRow(r._id,"op",e.target.value)}><option value="<=">≤</option><option value=">=">≥</option></select></td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}` }}><input style={sinp(60)} placeholder="ej: 3,5" value={r.limite||""} onChange={e=>{updateRow(r._id,"limite",e.target.value);updateRow(r._id,"lim",parseNum(e.target.value));}}/></td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}`, minWidth:95 }}><CreatableSelect value={unit} onChange={v=>{updateRow(r._id,"unidad",v);if(!allUnits.includes(v))setAllUnits(p=>[...p,v]);}} options={allUnits} placeholder="Unidad" width="90px"/></td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}` }}><input style={{ ...sinp(70), borderColor:!r._found&&!parseNum(r.actualVal)?"rgb(214,158,46)":st==="breach"?L.danger:st==="warning"?L.warn:L.border }} placeholder={!r._found?"manual":"valor"} value={r.actualVal} onChange={e=>updateRow(r._id,"actualVal",e.target.value)}/></td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}`, whiteSpace:"nowrap" }}>{holgura!==null?<span style={{ color:st==="breach"?L.danger:st==="warning"?L.warn:L.sub, fontWeight:500, fontSize:11 }}>{fmtNum(holgura,unit)}</span>:<span style={{ color:"#ccc" }}>—</span>}</td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}`, fontSize:10, color:L.sub, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r._nota||(!r._found?"sin datos":"—")}</td>
                          <td style={{ padding:"4px 7px", borderBottom:`1px solid ${L.border}` }}><button onClick={()=>removeRow(r._id)} style={{ background:L.dangerBg, color:"rgb(170,40,50)", border:"none", borderRadius:4, padding:"3px 6px", cursor:"pointer", fontSize:10 }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ borderTop:`1px solid ${L.border}`, paddingTop:12, marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:AZ, textTransform:"uppercase", letterSpacing:0.5 }}>Agregar covenant adicional</p>
                  <div style={{ position:"relative" }}><button onClick={() => setShowPicker(p=>!p)} style={{ background:"rgba(55,81,114,0.1)", color:AZ, border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer", fontSize:11, fontWeight:500 }}>＋ Agregar</button>{showPicker && <CovenantPicker issuer={issuer} onSelect={addExtra} onClose={() => setShowPicker(false)} />}</div>
                </div>
                {extraRows.length > 0 && (
                  <>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, marginBottom:8, minWidth:620 }}>
                        <thead><tr>{["Nombre","Tipo","Op.","Límite","Unidad","Calculado",""].map(h=><th key={h} style={{ textAlign:"left", padding:"5px 8px", background:"#f5f6fa", color:AZ, fontSize:10, fontWeight:600 }}>{h}</th>)}</tr></thead>
                        <tbody>{extraRows.map(r => (<tr key={r._id}><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}` }}><input style={sinp(140)} placeholder="ej: DFN/EBITDA" value={r.name} onChange={e=>updateExtra(r._id,"name",e.target.value)}/></td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(58)} value={r.tipo} onChange={e=>updateExtra(r._id,"tipo",e.target.value)}><option value="flujo">flujo</option><option value="stock">stock</option></select></td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}` }}><select style={sinp(44)} value={r.op} onChange={e=>updateExtra(r._id,"op",e.target.value)}><option value="<=">≤</option><option value=">=">≥</option></select></td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}` }}><input style={sinp(60)} placeholder="ej: 3,50" value={r.limite} onChange={e=>updateExtra(r._id,"limite",e.target.value)}/></td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}`, minWidth:90 }}><CreatableSelect value={r.unidad||"x (veces)"} onChange={v=>{updateExtra(r._id,"unidad",v);if(!allUnits.includes(v))setAllUnits(p=>[...p,v]);}} options={allUnits} placeholder="Unidad" width="85px"/></td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}`, fontWeight:500, color:r.actual!=null?L.sub:"#ccc" }}>{r.actualStr||<span style={{ fontSize:10, color:"#ccc" }}>pendiente</span>}</td><td style={{ padding:"4px 6px", borderBottom:`1px solid ${L.border}` }}><button onClick={()=>removeExtra(r._id)} style={{ background:L.dangerBg, color:"rgb(170,40,50)", border:"none", borderRadius:4, padding:"3px 7px", cursor:"pointer", fontSize:10 }}>✕</button></td></tr>))}</tbody>
                      </table>
                    </div>
                    <button onClick={handleCalculateExtra} disabled={calculating||!file} style={{ background:"rgba(55,81,114,0.1)", color:AZ, border:"none", borderRadius:4, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:500, marginBottom:8 }}>{calculating?"⏳ Calculando...":"⚡ Calcular desde el PDF"}</button>
                  </>
                )}
              </div>
              {error && <p style={{ color:L.danger, fontSize:12, marginTop:6, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button onClick={() => { setStep("upload"); setResult(null); setRows([]); setExtraRows([]); setShowPicker(false); }} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>← Volver</button>
                <button onClick={handleSave} disabled={loading} style={{ ...btn(), flex:2 }}>{loading?"Guardando...":"✓ Confirmar y guardar"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selId, setSelId] = useState(null);
  const [uploadIssuer, setUploadIssuer] = useState(null);
  const [editIssuer, setEditIssuer] = useState(null);
  const [editIssuerMeta, setEditIssuerMeta] = useState(null);
  const [deleteIssuer, setDeleteIssuer] = useState(null);
  const [newIssuerOpen, setNewIssuerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadData() {
    setLoading(true);
    try { const res = await fetch("/api/issuers"); const data = await res.json(); setIssuers(data); setLastUpdate(new Date().toLocaleTimeString("es-CL")); }
    catch(e) { console.error(e); } finally { setLoading(false); }
  }
  useEffect(() => { loadData(); }, []);

  const allCovs = useMemo(() => issuers.flatMap(iss => iss.covenants.map(c => ({ ...c, issuerName:iss.name, issuerId:iss.id, status:getStatus(c) }))), [issuers]);
  const stats = useMemo(() => ({ issuers:issuers.length, ok:allCovs.filter(c=>c.status==="ok").length, warning:allCovs.filter(c=>c.status==="warning").length, breach:allCovs.filter(c=>c.status==="breach").length, na:allCovs.filter(c=>c.status==="na").length }), [allCovs, issuers]);
  const sectors = useMemo(() => ["all", ...new Set(issuers.map(i => i.sector).filter(Boolean))].sort(), [issuers]);
  const alertCovs = allCovs.filter(c => c.status==="breach" || c.status==="warning");
  const filteredIssuers = useMemo(() => {
    let list = issuers;
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (filterSector !== "all") list = list.filter(i => i.sector === filterSector);
    if (filterStatus !== "all") list = list.filter(i => issuerStatus(i) === filterStatus);
    return [...list].sort((a, b) => { const ord = { breach:0, warning:1, ok:2, na:3 }; return ord[issuerStatus(a)] - ord[issuerStatus(b)] || a.name.localeCompare(b.name); });
  }, [issuers, search, filterSector, filterStatus]);
  const sel = issuers.find(i => i.id === selId);

  const s = {
    app: { display:"flex", minHeight:"100vh", fontFamily:"'Segoe UI',Arial,sans-serif", background:L.bg, color:"#2d3142", fontSize:13 },
    sidebar: { width:200, background:AZ, display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh" },
    nav: a => ({ display:"block", width:"100%", textAlign:"left", border:"none", background:a?"rgba(255,255,255,0.13)":"transparent", color:a?"#fff":"rgba(255,255,255,0.55)", padding:"10px 18px", cursor:"pointer", fontSize:12, fontFamily:"inherit", borderLeft:a?"3px solid rgba(255,255,255,0.7)":"3px solid transparent" }),
    main: { flex:1, padding:"28px 32px", overflow:"auto" },
    card: { background:"#fff", borderRadius:6, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", border:`1px solid ${L.border}` },
    tbl: { width:"100%", borderCollapse:"collapse", fontSize:12 },
    th: { textAlign:"left", padding:"8px 12px", background:AZ, color:"#fff", fontSize:10, fontWeight:500, letterSpacing:0.5, textTransform:"uppercase", whiteSpace:"nowrap" },
    td: { padding:"8px 12px", borderBottom:`1px solid ${L.border}`, verticalAlign:"middle" },
    inp: { border:`1px solid ${L.border}`, borderRadius:4, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit", color:"#2d3142", background:"#fff" },
    sel: { border:`1px solid ${L.border}`, borderRadius:4, padding:"7px 10px", fontSize:12, background:"#fff", cursor:"pointer", fontFamily:"inherit" },
    btn: (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"7px 14px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:500 }),
  };

  function Header({ title, sub, action }) {
    return (<div style={{ marginBottom:24 }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}><div><h1 style={{ fontSize:21, fontWeight:600, color:AZ, marginBottom:3 }}>{title}</h1>{sub && <p style={{ fontSize:12, color:L.sub }}>{sub}</p>}</div><div style={{ display:"flex", gap:8, alignItems:"center" }}>{action}<button style={s.btn("#f0f2f5","#666")} onClick={loadData}>↻ Actualizar</button>{lastUpdate && <span style={{ fontSize:10, color:L.sub }}>Actualizado {lastUpdate}</span>}</div></div><div style={{ height:2, background:AZ, marginTop:10, borderRadius:1 }} /></div>);
  }

  if (loading) return (<div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:L.bg, flexDirection:"column", gap:12 }}><div style={{ width:32, height:32, border:"3px solid rgba(55,81,114,0.2)", borderTopColor:AZ, borderRadius:"50%", animation:"spin 1s linear infinite" }} /><p style={{ color:AZ, fontWeight:500 }}>Cargando...</p><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>);

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  const Dashboard = () => {
    const sectorData = useMemo(() => {
      const m = {};
      issuers.forEach(iss => {
        if (!m[iss.sector]) m[iss.sector] = { ok:0, warning:0, breach:0, na:0, total:0 };
        const st = issuerStatus(iss);
        m[iss.sector][st] = (m[iss.sector][st] || 0) + 1;
        m[iss.sector].total++;
      });
      return Object.entries(m).sort((a,b) => (b[1].breach+b[1].warning)-(a[1].breach+a[1].warning));
    }, []);

    const topAlerts = alertCovs.slice(0, 8);
    const totalCovs = allCovs.filter(c => c.status !== "na").length;
    const compRate = totalCovs > 0 ? Math.round((stats.ok / totalCovs) * 100) : 0;

    // Donut chart data
    const donutData = [
      { label:"Cumple", value:stats.ok, color:L.ok },
      { label:"En riesgo", value:stats.warning, color:L.warn },
      { label:"Incumple", value:stats.breach, color:L.danger },
    ].filter(d => d.value > 0);
    const total = donutData.reduce((s, d) => s + d.value, 0);

    let cumAngle = -Math.PI / 2;
    const donutPaths = donutData.map(d => {
      const angle = (d.value / total) * 2 * Math.PI;
      const x1 = 50 + 36 * Math.cos(cumAngle);
      const y1 = 50 + 36 * Math.sin(cumAngle);
      cumAngle += angle;
      const x2 = 50 + 36 * Math.cos(cumAngle);
      const y2 = 50 + 36 * Math.sin(cumAngle);
      const large = angle > Math.PI ? 1 : 0;
      return { ...d, path:`M 50 50 L ${x1} ${y1} A 36 36 0 ${large} 1 ${x2} ${y2} Z` };
    });

    return (
      <div>
        <Header title="Dashboard de Covenants" sub={`${stats.issuers} emisores · ${totalCovs} covenants monitoreados`} />

        {/* KPI Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"Emisores", value:stats.issuers, color:"#7a7f9a", icon:"🏢" },
            { label:"Cumplimiento", value:`${compRate}%`, color:L.ok, icon:"✓" },
            { label:"Cumple", value:stats.ok, color:L.ok, icon:"✓" },
            { label:"En riesgo", value:stats.warning, color:L.warn, icon:"⚠" },
            { label:"Incumple", value:stats.breach, color:L.danger, icon:"✗" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} style={{ background:"#fff", borderRadius:6, padding:"14px 16px", border:`1px solid ${L.border}`, borderTop:`3px solid ${color}` }}>
              <div style={{ fontSize:22, fontWeight:700, color, marginBottom:2 }}>{value}</div>
              <div style={{ fontSize:10, color:L.sub, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
          {/* Donut chart */}
          <div style={{ ...s.card, display:"flex", flexDirection:"column", alignItems:"center" }}>
            <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5, alignSelf:"flex-start" }}>Estado general</p>
            <svg width={100} height={100} style={{ marginBottom:10 }}>
              {donutPaths.map((d, i) => <path key={i} d={d.path} fill={d.color} />)}
              <circle cx={50} cy={50} r={22} fill="#fff" />
              <text x={50} y={54} textAnchor="middle" fontSize={14} fontWeight="700" fill={compRate >= 80 ? L.ok : compRate >= 60 ? L.warn : L.danger}>{compRate}%</text>
            </svg>
            <div style={{ display:"flex", flexDirection:"column", gap:6, width:"100%" }}>
              {donutData.map(d => (
                <div key={d.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:L.sub }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sector breakdown */}
          <div style={{ ...s.card }}>
            <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Por sector</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {sectorData.slice(0, 7).map(([sector, d]) => {
                const pct = Math.round((d.ok / d.total) * 100);
                return (
                  <div key={sector}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>{sector}</span>
                      <span style={{ fontSize:10, color:L.sub }}>{d.ok}/{d.total}</span>
                    </div>
                    <div style={{ height:6, background:"#eee", borderRadius:3, overflow:"hidden", display:"flex" }}>
                      {d.breach>0 && <div style={{ width:`${(d.breach/d.total)*100}%`, background:L.danger }} />}
                      {d.warning>0 && <div style={{ width:`${(d.warning/d.total)*100}%`, background:L.warn }} />}
                      {d.ok>0 && <div style={{ width:`${(d.ok/d.total)*100}%`, background:L.ok }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top alerts */}
          <div style={{ ...s.card }}>
            <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Alertas principales</p>
            {topAlerts.length === 0
              ? <div style={{ textAlign:"center", padding:"20px 0", color:L.ok }}><div style={{ fontSize:24 }}>✓</div><p style={{ fontSize:12, marginTop:6 }}>Todos en cumplimiento</p></div>
              : topAlerts.map((c, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${L.border}` }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, color:AZ, fontSize:12, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                      onClick={() => { setSelId(c.issuerId); setView("emisores"); }}>{c.issuerName}</div>
                    <div style={{ color:L.sub, fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                  </div>
                  <Pill status={c.status} />
                </div>
              ))
            }
          </div>
        </div>

        {/* Issuers table with sparklines */}
        <div style={s.card}>
          <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Emisores — vista rápida</p>
          <table style={s.tbl}>
            <thead><tr>{["Emisor","Sector","Clasificación","EEFF","Estado","Cvts","Cumpl.",""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {issuers.slice().sort((a,b) => { const ord = {breach:0,warning:1,ok:2,na:3}; return ord[issuerStatus(a)]-ord[issuerStatus(b)]; }).slice(0,10).map((iss, i) => {
                const st = issuerStatus(iss);
                const okCount = iss.covenants.filter(c => getStatus(c)==="ok").length;
                const totalC = iss.covenants.filter(c => getStatus(c)!=="na").length;
                const pct = totalC > 0 ? Math.round((okCount/totalC)*100) : null;
                return (
                  <tr key={iss.id} style={{ background:i%2===0?"#fff":"#fafafa", cursor:"pointer" }} onClick={() => { setSelId(iss.id); setView("emisores"); }}>
                    <td style={{ ...s.td, fontWeight:600, color:AZ }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><Dot status={st} size={7}/>{iss.name}</div></td>
                    <td style={{ ...s.td, color:L.sub, fontSize:11 }}>{iss.sector}</td>
                    <td style={{ ...s.td, fontWeight:600, color:AZ, fontSize:11 }}>{iss.clasificacion}</td>
                    <td style={{ ...s.td, color:isStale(iss.fechaEEFF)?L.warn:L.sub, fontSize:11 }}>{iss.fechaEEFF}{isStale(iss.fechaEEFF)?" ⚠":""}</td>
                    <td style={s.td}><Pill status={st}/></td>
                    <td style={{ ...s.td, color:L.sub, fontSize:11 }}>{iss.covenants.length}</td>
                    <td style={s.td}>
                      {pct !== null ? (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ width:50, height:6, background:"#eee", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ width:`${pct}%`, height:"100%", background:pct===100?L.ok:pct>=70?L.warn:L.danger }} />
                          </div>
                          <span style={{ fontSize:10, color:L.sub }}>{pct}%</span>
                        </div>
                      ) : <span style={{ color:"#ccc", fontSize:10 }}>S/D</span>}
                    </td>
                    <td style={{ ...s.td }} onClick={e => e.stopPropagation()}>
                      <button style={{ ...s.btn("rgba(55,81,114,0.08)",AZ), fontSize:10, padding:"4px 8px" }} onClick={() => { setSelId(iss.id); setView("emisores"); }}>Ver detalle →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {issuers.length > 10 && <p style={{ fontSize:11, color:L.sub, marginTop:10, textAlign:"center" }}>Mostrando top 10 por alerta · Ve a "Emisores" para ver todos</p>}
        </div>
      </div>
    );
  };

  // ── EMISORES LIST ─────────────────────────────────────────────────────────
  const Emisores = () => (
    <div>
      <Header title="Emisores" sub="Haz clic en un emisor para ver detalle con gráficos" action={<button style={s.btn()} onClick={() => setNewIssuerOpen(true)}>＋ Nuevo emisor</button>} />
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input style={{ ...s.inp, width:200 }} placeholder="Buscar emisor..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.sel} value={filterSector} onChange={e => setFilterSector(e.target.value)}><option value="all">Todos los sectores</option>{sectors.filter(x=>x!=="all").map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select style={s.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Todos los estados</option><option value="ok">✓ Cumple</option><option value="warning">⚠ En riesgo</option><option value="breach">✗ Incumple</option></select>
      </div>
      <div style={s.card}>
        <table style={s.tbl}>
          <thead><tr>{["","Emisor","Sector","Clasificación","EEFF","Cvts","Estado","Acciones"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{filteredIssuers.map((iss, i) => {
            const st = issuerStatus(iss);
            const bk = { breach:iss.covenants.filter(c=>getStatus(c)==="breach").length, warning:iss.covenants.filter(c=>getStatus(c)==="warning").length, ok:iss.covenants.filter(c=>getStatus(c)==="ok").length };
            return (
              <tr key={iss.id} style={{ background:i%2===0?"#fff":"#fafafa", cursor:"pointer" }} onClick={() => setSelId(iss.id)}>
                <td style={{ ...s.td, width:14 }}><Dot status={st}/></td>
                <td style={{ ...s.td, fontWeight:600, color:AZ }}>{iss.name}</td>
                <td style={{ ...s.td, color:L.sub }}>{iss.sector}</td>
                <td style={{ ...s.td, fontWeight:600, color:AZ }}>{iss.clasificacion}</td>
                <td style={{ ...s.td, color:isStale(iss.fechaEEFF)?L.warn:L.sub }}>{iss.fechaEEFF}{isStale(iss.fechaEEFF)?" ⚠":""}</td>
                <td style={s.td}>{iss.covenants.length}</td>
                <td style={s.td}><div style={{ display:"flex", gap:4 }}>{bk.breach>0&&<span style={{ background:L.dangerBg,color:"rgb(170,40,50)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>✗ {bk.breach}</span>}{bk.warning>0&&<span style={{ background:L.warnBg,color:"rgb(150,110,20)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>⚠ {bk.warning}</span>}{bk.ok>0&&<span style={{ background:L.okBg,color:"rgb(40,120,70)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>✓ {bk.ok}</span>}</div></td>
                <td style={s.td} onClick={e => e.stopPropagation()}>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    <button style={{ ...s.btn("#f0f2f5",AZ), fontSize:11 }} onClick={() => setUploadIssuer(iss)}>📄 PDF</button>
                    <button style={{ ...s.btn("rgba(55,81,114,0.1)",AZ), fontSize:11 }} onClick={() => setEditIssuer(iss)}>✏ Cvts</button>
                    <button style={{ ...s.btn("rgba(55,81,114,0.08)",AZ), fontSize:11 }} onClick={() => setEditIssuerMeta(iss)}>⚙ Datos</button>
                    <button style={{ background:L.dangerBg, color:"rgb(170,40,50)", border:"none", borderRadius:4, padding:"5px 8px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:500 }} onClick={() => setDeleteIssuer(iss)}>🗑</button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );

  // ── DETALLE EMISOR con gráficos ──────────────────────────────────────────
  const Detalle = () => {
    const [history, setHistory] = useState(null);
    const [selectedCov, setSelectedCov] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
      if (!sel) return;
      fetch(`/api/history?issuerId=${sel.id}`)
        .then(r => r.json())
        .then(data => {
          setHistory(data);
          // Auto-select first covenant with history
          if (data.length > 0 && sel.covenants.length > 0) {
            const first = sel.covenants.find(c => data.some(h => h.covenants.find(hc => hc.name === c.name)));
            setSelectedCov(first?.name || sel.covenants[0]?.name || null);
          } else if (sel.covenants.length > 0) {
            setSelectedCov(sel.covenants[0].name);
          }
        })
        .catch(() => setHistory([]));
    }, [sel?.id]);

    async function handleExport() {
      setExporting(true);
      try { await exportToExcel(sel, history); }
      catch(e) { console.error(e); alert("Error exportando: " + e.message); }
      finally { setExporting(false); }
    }

    if (!sel) return null;

    const st = issuerStatus(sel);
    const okC = sel.covenants.filter(c => getStatus(c)==="ok").length;
    const warnC = sel.covenants.filter(c => getStatus(c)==="warning").length;
    const breachC = sel.covenants.filter(c => getStatus(c)==="breach").length;
    const totalC = sel.covenants.filter(c => getStatus(c)!=="na").length;
    const compPct = totalC > 0 ? Math.round((okC/totalC)*100) : null;

    return (
      <div>
        {/* Top bar */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <button style={s.btn("#f0f2f5","#666")} onClick={() => setSelId(null)}>← Volver</button>
          <button style={s.btn()} onClick={() => setUploadIssuer(sel)}>📄 Subir EEFF</button>
          <button style={{ ...s.btn("rgba(55,81,114,0.1)",AZ) }} onClick={() => setEditIssuer(sel)}>✏ Editar cvts</button>
          <button style={{ ...s.btn("rgba(55,81,114,0.08)",AZ) }} onClick={() => setEditIssuerMeta(sel)}>⚙ Editar datos</button>
          <button style={{ ...s.btn("rgba(101,169,124,0.15)","rgb(40,120,70)") }} onClick={handleExport} disabled={exporting}>{exporting?"⏳ Exportando...":"⬇ Descargar Excel"}</button>
          <button style={{ background:L.dangerBg, color:"rgb(170,40,50)", border:"none", borderRadius:4, padding:"7px 14px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:500 }} onClick={() => setDeleteIssuer(sel)}>🗑 Eliminar</button>
        </div>

        {/* Issuer header */}
        <div style={{ ...s.card, marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:AZ, margin:0 }}>{sel.name}</h2>
              <Pill status={st} />
            </div>
            <div style={{ fontSize:12, color:L.sub }}>
              {sel.sector} · Clasificación <strong style={{ color:AZ }}>{sel.clasificacion}</strong> · EEFF <strong style={{ color:isStale(sel.fechaEEFF)?L.warn:AZ }}>{sel.fechaEEFF}{isStale(sel.fechaEEFF)?" ⚠":""}</strong>
            </div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            {[["✓ Cumple", okC, L.ok, L.okBg],["⚠ Riesgo", warnC, L.warn, L.warnBg],["✗ Incumple", breachC, L.danger, L.dangerBg]].map(([lbl, val, col, bg]) => (
              <div key={lbl} style={{ background:bg, borderRadius:6, padding:"8px 14px", textAlign:"center", minWidth:70 }}>
                <div style={{ fontSize:22, fontWeight:700, color:col }}>{val}</div>
                <div style={{ fontSize:10, color:col }}>{lbl}</div>
              </div>
            ))}
            {compPct !== null && (
              <div style={{ background:"rgba(55,81,114,0.06)", borderRadius:6, padding:"8px 14px", textAlign:"center", minWidth:70 }}>
                <div style={{ fontSize:22, fontWeight:700, color:AZ }}>{compPct}%</div>
                <div style={{ fontSize:10, color:L.sub }}>Cumplimiento</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          {/* Covenant table */}
          <div style={{ ...s.card }}>
            <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:12, textTransform:"uppercase", letterSpacing:0.5 }}>Covenants actuales</p>
            <table style={{ ...s.tbl, fontSize:11 }}>
              <thead><tr>{["Covenant","Límite","Actual","Holgura","Estado"].map(h => <th key={h} style={{ ...s.th, fontSize:9, padding:"6px 10px" }}>{h}</th>)}</tr></thead>
              <tbody>
                {sel.covenants.map((c, i) => {
                  const cst = getStatus(c);
                  const bg = cst==="breach"?"rgba(210,70,80,0.05)":cst==="warning"?"rgba(214,158,46,0.05)":i%2===0?"#fff":"#fafafa";
                  const isSelected = c.name === selectedCov;
                  return (
                    <tr key={i} style={{ background:isSelected?"rgba(55,81,114,0.08)":bg, cursor:"pointer" }} onClick={() => setSelectedCov(c.name)}>
                      <td style={{ ...s.td, fontWeight:isSelected?600:400, padding:"6px 10px", fontSize:11, color:isSelected?AZ:"#2d3142" }}>{c.name}</td>
                      <td style={{ ...s.td, color:L.sub, padding:"6px 10px", fontSize:11 }}>{c.limite}</td>
                      <td style={{ ...s.td, fontWeight:600, color:cst==="breach"?L.danger:cst==="warning"?L.warn:"#2d3142", padding:"6px 10px", fontSize:12 }}>{c.actual}</td>
                      <td style={{ ...s.td, color:cst==="breach"?L.danger:cst==="warning"?L.warn:L.sub, padding:"6px 10px", fontSize:11 }}>{c.holgura}</td>
                      <td style={{ ...s.td, padding:"6px 10px" }}><Pill status={cst}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sel.covenants.length === 0 && <div style={{ textAlign:"center", padding:"20px 0", color:L.sub, fontSize:12 }}>Sin covenants registrados.</div>}
          </div>

          {/* Chart panel */}
          <div style={{ ...s.card }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <p style={{ fontSize:11, fontWeight:600, color:AZ, textTransform:"uppercase", letterSpacing:0.5 }}>Evolución histórica</p>
              {sel.covenants.length > 0 && (
                <select value={selectedCov||""} onChange={e => setSelectedCov(e.target.value)}
                  style={{ border:`1px solid ${L.border}`, borderRadius:4, padding:"4px 8px", fontSize:11, fontFamily:"inherit", background:"#fff", color:AZ, maxWidth:200 }}>
                  {sel.covenants.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>
            {history === null ? (
              <div style={{ textAlign:"center", padding:"32px 0", color:L.sub, fontSize:12 }}>⏳ Cargando historial...</div>
            ) : selectedCov ? (
              <CovenantChart history={history} covenantName={selectedCov} issuer={sel} />
            ) : (
              <div style={{ textAlign:"center", padding:"32px 0", color:L.sub, fontSize:12 }}>Selecciona un covenant para ver su evolución.</div>
            )}
            {history && history.length > 0 && (
              <div style={{ marginTop:10, fontSize:10, color:L.sub, textAlign:"right" }}>
                {history.length} período{history.length!==1?"s":""} en el historial
              </div>
            )}
          </div>
        </div>

        {/* History table */}
        {history && history.length > 1 && (
          <div style={s.card}>
            <p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:12, textTransform:"uppercase", letterSpacing:0.5 }}>Tabla histórica de covenants</p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", fontSize:11, minWidth:400 }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, padding:"6px 12px", position:"sticky", left:0, zIndex:1 }}>Covenant</th>
                    <th style={{ ...s.th, padding:"6px 12px" }}>Límite</th>
                    {history.map(h => <th key={h.fecha} style={{ ...s.th, padding:"6px 12px", whiteSpace:"nowrap" }}>{h.fecha}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sel.covenants.map((cov, i) => (
                    <tr key={i} style={{ background:i%2===0?"#fff":"#fafafa" }}>
                      <td style={{ ...s.td, fontWeight:500, padding:"5px 12px", position:"sticky", left:0, background:i%2===0?"#fff":"#fafafa" }}>{cov.name}</td>
                      <td style={{ ...s.td, color:L.sub, padding:"5px 12px" }}>{cov.limite}</td>
                      {history.map(h => {
                        const snap = h.covenants.find(c => c.name === cov.name);
                        const col = snap?.status === "breach" ? L.danger : snap?.status === "warning" ? L.warn : snap?.status === "ok" ? L.ok : L.sub;
                        return (
                          <td key={h.fecha} style={{ ...s.td, padding:"5px 12px", color:col, fontWeight:snap?.act!=null?600:400, textAlign:"center" }}>
                            {snap?.act != null ? snap.act.toFixed(2).replace(".",",") : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── ALERTAS ───────────────────────────────────────────────────────────────
  const Alertas = () => (
    <div>
      <Header title="Alertas de Cumplimiento" sub={`${alertCovs.length} covenants requieren atención`} />
      {alertCovs.length === 0
        ? <div style={{ ...s.card, textAlign:"center", padding:48, color:L.ok }}><div style={{ fontSize:32 }}>✓</div><p style={{ fontWeight:600, marginTop:8 }}>Todos en cumplimiento</p></div>
        : ["breach","warning"].map(lvl => {
            const items = alertCovs.filter(c => c.status === lvl);
            if (!items.length) return null;
            const col = lvl==="breach"?L.danger:L.warn;
            return (
              <div key={lvl} style={{ ...s.card, marginBottom:16, borderLeft:`4px solid ${col}`, borderRadius:"0 6px 6px 0" }}>
                <p style={{ fontSize:11, fontWeight:600, color:col, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>{lvl==="breach"?"✗ Incumplimiento":"⚠ En riesgo"} — {items.length} covenants</p>
                <table style={s.tbl}>
                  <thead><tr>{["Emisor","Clasificación","Covenant","Límite","Actual","Estado",""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>{items.map((c, i) => {
                    const iss = issuers.find(x => x.id === c.issuerId);
                    return (
                      <tr key={i} style={{ background:i%2===0?"#fff":"#fafafa" }}>
                        <td style={{ ...s.td, fontWeight:600, color:AZ, cursor:"pointer" }} onClick={() => { setSelId(c.issuerId); setView("emisores"); }}>{c.issuerName}</td>
                        <td style={{ ...s.td, color:AZ, fontWeight:600 }}>{iss?.clasificacion}</td>
                        <td style={s.td}>{c.name}</td>
                        <td style={{ ...s.td, color:L.sub }}>{c.limite}</td>
                        <td style={{ ...s.td, fontWeight:600, color:col }}>{c.actual}</td>
                        <td style={s.td}><Pill status={c.status}/></td>
                        <td style={s.td}><button style={{ ...s.btn("#f0f2f5",AZ), fontSize:10 }} onClick={() => setEditIssuer(issuers.find(x=>x.id===c.issuerId))}>✏ Editar</button></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            );
          })
      }
    </div>
  );

  return (
    <>
      <style>{"*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif}@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={s.app}>
        <div style={s.sidebar}>
          <div style={{ padding:"22px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:9, letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>Link Capital Partners</div>
            <div style={{ color:"#fff", fontSize:15, fontWeight:600, lineHeight:1.3 }}>Covenant<br/>Tracker</div>
          </div>
          <div style={{ padding:"16px 18px 6px", color:"rgba(255,255,255,0.3)", fontSize:9, letterSpacing:1.5, textTransform:"uppercase" }}>Monitoreo</div>
          {[["dashboard","📊 Dashboard"],["emisores","🏢 Emisores"],["alertas","⚠ Alertas"]].map(([v,l]) => (
            <button key={v} style={s.nav(view===v&&!selId)} onClick={() => { setView(v); setSelId(null); }}>{l}</button>
          ))}
          <div style={{ marginTop:"auto", padding:"16px 18px", borderTop:"1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Alertas activas</div>
            <div style={{ color:stats.breach>0?L.danger:stats.warning>0?L.warn:"rgba(255,255,255,0.6)", fontSize:26, fontWeight:700, marginTop:4 }}>{stats.breach+stats.warning}</div>
            {stats.breach > 0 && <div style={{ color:L.danger, fontSize:10 }}>✗ {stats.breach} incumplimiento{stats.breach>1?"s":""}</div>}
            {stats.warning > 0 && <div style={{ color:L.warn, fontSize:10 }}>⚠ {stats.warning} en riesgo</div>}
          </div>
        </div>
        <div style={s.main}>
          {view==="dashboard" && !selId && <Dashboard/>}
          {view==="emisores" && !selId && <Emisores/>}
          {view==="emisores" && selId && <Detalle/>}
          {view==="alertas" && !selId && <Alertas/>}
        </div>
      </div>
      {uploadIssuer && <UploadModal issuer={uploadIssuer} onClose={() => setUploadIssuer(null)} onSuccess={() => { setUploadIssuer(null); loadData(); }}/>}
      {editIssuer && <EditModal issuer={editIssuer} onClose={() => setEditIssuer(null)} onSuccess={() => { setEditIssuer(null); loadData(); }}/>}
      {editIssuerMeta && <EditIssuerModal issuer={editIssuerMeta} onClose={() => setEditIssuerMeta(null)} onSuccess={() => { setEditIssuerMeta(null); loadData(); }} allIssuers={issuers}/>}
      {deleteIssuer && <DeleteIssuerModal issuer={deleteIssuer} onClose={() => setDeleteIssuer(null)} onSuccess={() => { setDeleteIssuer(null); setSelId(null); loadData(); }}/>}
      {newIssuerOpen && <NewIssuerModal onClose={() => setNewIssuerOpen(false)} onSuccess={() => { setNewIssuerOpen(false); loadData(); }} allIssuers={issuers}/>}
    </>
  );
}
