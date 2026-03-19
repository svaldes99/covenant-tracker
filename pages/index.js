import { useState, useEffect, useMemo } from "react";
import { getStatus, issuerStatus, isStale } from "../lib/data";

const AZ = "rgb(55,81,114)";
const L = {
  ok: "rgb(101,169,124)", okBg: "rgba(101,169,124,0.12)",
  warn: "rgb(214,158,46)", warnBg: "rgba(214,158,46,0.12)",
  danger: "rgb(210,70,80)", dangerBg: "rgba(210,70,80,0.1)",
  sub: "#7a7f9a", border: "rgba(0,0,0,0.07)", bg: "#f0f2f5",
};

function Dot({ status, size = 8 }) {
  const c = { ok: L.ok, warning: L.warn, breach: L.danger, na: "#ccc" };
  return <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%", background:c[status]||"#ccc", flexShrink:0 }} />;
}

function Pill({ status }) {
  const st = { ok:{background:L.okBg,color:"rgb(40,120,70)"}, warning:{background:L.warnBg,color:"rgb(150,110,20)"}, breach:{background:L.dangerBg,color:"rgb(170,40,50)"}, na:{background:"#f0f0f0",color:L.sub} };
  const lb = { ok:"Cumple", warning:"En riesgo", breach:"Incumple", na:"S/D" };
  return <span style={{ ...st[status]||st.na, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:500 }}>{lb[status]||"S/D"}</span>;
}

function EditModal({ issuer, onClose, onSuccess }) {
  const [values, setValues] = useState(() => {
    const v = {};
    issuer.covenants.forEach(c => { v[c.name] = String(c.act ?? ""); });
    return v;
  });
  const [fechaEEFF, setFechaEEFF] = useState(issuer.fechaEEFF || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const covenants = issuer.covenants.map(c => {
        const num = parseFloat(String(values[c.name]).replace(",", "."));
        if (isNaN(num)) return { name:c.name, actual:null, actualStr:null, holgura:null, holguraStr:null };
        const holgura = c.op === "<=" ? c.lim - num : num - c.lim;
        const fmt = n => n.toFixed(2).replace(".", ",") + "x";
        return { name:c.name, actual:num, actualStr:fmt(num), holgura, holguraStr:fmt(holgura) };
      });
      const res = await fetch("/api/issuers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id, covenants, fechaEEFF }) });
      if (!res.ok) throw new Error("Error guardando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });
  const inp = { border:`1px solid ${L.border}`, borderRadius:4, padding:"6px 8px", fontSize:12, fontFamily:"inherit", outline:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:620, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:AZ }}>{issuer.name}</div>
            <div style={{ fontSize:12, color:L.sub }}>Editar covenants manualmente</div>
          </div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, color:L.sub, display:"block", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Período EEFF</label>
            <input style={{ ...inp, width:160 }} placeholder="ej: dic-24" value={fechaEEFF} onChange={e => setFechaEEFF(e.target.value)} />
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>{["Covenant","Límite","Op.","Valor actual","Holgura"].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"7px 10px", background:AZ, color:"#fff", fontSize:10, fontWeight:500 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {issuer.covenants.map((c, i) => {
                const num = parseFloat(String(values[c.name]).replace(",", "."));
                const st = !isNaN(num) && c.lim !== null ? getStatus({...c, act:num}) : "na";
                const holgura = !isNaN(num) && c.lim !== null ? (c.op === "<=" ? c.lim - num : num - c.lim) : null;
                return (
                  <tr key={i} style={{ background: i%2===0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}`, fontWeight:500, fontSize:11, maxWidth:200 }}>{c.name}</td>
                    <td style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}`, color:L.sub }}>{c.limite}</td>
                    <td style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}`, color:L.sub, textAlign:"center" }}>{c.op}</td>
                    <td style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}` }}>
                      <input style={{ ...inp, width:90, borderColor: st==="breach"?L.danger:st==="warning"?L.warn:L.border }}
                        placeholder="ej: 2.50" value={values[c.name]}
                        onChange={e => setValues(prev => ({...prev, [c.name]: e.target.value}))} />
                    </td>
                    <td style={{ padding:"8px 10px", borderBottom:`1px solid ${L.border}` }}>
                      {holgura !== null
                        ? <span style={{ color:st==="breach"?L.danger:st==="warning"?L.warn:L.sub, fontWeight:500 }}>{holgura.toFixed(2).replace(".",",")}x</span>
                        : <span style={{ color:"#ccc" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error && <p style={{ color:L.danger, fontSize:12, marginTop:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading} style={{ ...btn(), flex:2 }}>{loading ? "Guardando..." : "✓ Guardar cambios"}</button>
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
  const [error, setError] = useState("");

  async function handleExtract() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("pdf", file); fd.append("issuerName", issuer.name); fd.append("covenants", JSON.stringify(issuer.covenants));
      const res = await fetch("/api/extract-pdf", { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch("/api/issuers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ issuerId:issuer.id, covenants:result.covenants, fechaEEFF:result.fechaEEFF }) });
      if (!res.ok) throw new Error("Error guardando");
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const btn = (bg=AZ, col="#fff") => ({ background:bg, color:col, border:"none", borderRadius:4, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:540, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${L.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:15, fontWeight:600, color:AZ }}>{issuer.name}</div><div style={{ fontSize:12, color:L.sub }}>Actualizar desde EEFF</div></div>
          <button onClick={onClose} style={{ ...btn("#f0f0f0","#666"), padding:"6px 12px" }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          {!result ? (
            <>
              <div style={{ border:`2px dashed ${L.border}`, borderRadius:6, padding:32, textAlign:"center", marginBottom:16, background:file?"rgba(55,81,114,0.03)":"#fafafa" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                <p style={{ color:AZ, fontWeight:500, marginBottom:8 }}>{file ? file.name : "Sube el PDF del EEFF"}</p>
                <p style={{ color:L.sub, fontSize:12, marginBottom:16 }}>Balance general o estado de resultados (máx ~80 págs)</p>
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} style={{ display:"none" }} id="pdf-input" />
                <label htmlFor="pdf-input" style={{ ...btn("#f0f0f0",AZ), cursor:"pointer" }}>{file ? "Cambiar" : "Seleccionar PDF"}</label>
              </div>
              {error && <p style={{ color:L.danger, fontSize:12, marginBottom:12, background:L.dangerBg, padding:"8px 12px", borderRadius:4 }}>⚠ {error}</p>}
              <button onClick={handleExtract} disabled={!file||loading} style={{ ...btn(file&&!loading?AZ:"#ccc"), width:"100%" }}>
                {loading ? "⏳ Analizando con Claude AI..." : "✨ Extraer covenants con IA"}
              </button>
            </>
          ) : (
            <>
              <div style={{ background:"rgba(101,169,124,0.08)", border:`1px solid ${L.ok}`, borderRadius:6, padding:12, marginBottom:16, fontSize:12 }}>✓ Período: <strong>{result.fechaEEFF}</strong></div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:16 }}>
                <thead><tr>{["Covenant","Límite","Nuevo valor","Estado"].map(h => <th key={h} style={{ textAlign:"left", padding:"7px 10px", background:AZ, color:"#fff", fontSize:10, fontWeight:500 }}>{h}</th>)}</tr></thead>
                <tbody>{issuer.covenants.map((cov, i) => { const ex = result.covenants.find(e => e.name===cov.name); const st = ex?.actual!=null?getStatus({...cov,act:ex.actual}):"na"; return (<tr key={i} style={{ background:i%2===0?"#fff":"#fafafa" }}><td style={{ padding:"7px 10px", borderBottom:`1px solid ${L.border}` }}>{cov.name}</td><td style={{ padding:"7px 10px", borderBottom:`1px solid ${L.border}`, color:L.sub }}>{cov.limite}</td><td style={{ padding:"7px 10px", borderBottom:`1px solid ${L.border}`, fontWeight:600, color:st==="breach"?L.danger:st==="warning"?L.warn:"#2d3142" }}>{ex?.actualStr||"—"}</td><td style={{ padding:"7px 10px", borderBottom:`1px solid ${L.border}` }}><Pill status={st}/></td></tr>); })}</tbody>
              </table>
              {error && <p style={{ color:L.danger, fontSize:12, marginBottom:12 }}>⚠ {error}</p>}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setResult(null); setFile(null); }} style={{ ...btn("#f0f0f0","#666"), flex:1 }}>← Volver</button>
                <button onClick={handleSave} disabled={loading} style={{ ...btn(), flex:2 }}>{loading?"Guardando...":"✓ Guardar"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selId, setSelId] = useState(null);
  const [uploadIssuer, setUploadIssuer] = useState(null);
  const [editIssuer, setEditIssuer] = useState(null);
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
  const stats = useMemo(() => ({ issuers:issuers.length, ok:allCovs.filter(c=>c.status==="ok").length, warning:allCovs.filter(c=>c.status==="warning").length, breach:allCovs.filter(c=>c.status==="breach").length }), [allCovs, issuers]);
  const sectors = useMemo(() => ["all", ...new Set(issuers.map(i => i.sector))].sort(), [issuers]);
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

  function Header({ title, sub }) {
    return (<div style={{ marginBottom:24 }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}><div><h1 style={{ fontSize:21, fontWeight:600, color:AZ, marginBottom:3 }}>{title}</h1>{sub && <p style={{ fontSize:12, color:L.sub }}>{sub}</p>}</div><div style={{ display:"flex", gap:8, alignItems:"center" }}><button style={s.btn("#f0f2f5","#666")} onClick={loadData}>↻ Actualizar</button>{lastUpdate && <span style={{ fontSize:10, color:L.sub }}>Actualizado {lastUpdate}</span>}</div></div><div style={{ height:2, background:AZ, marginTop:10, borderRadius:1 }} /></div>);
  }

  if (loading) return (<div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:L.bg, flexDirection:"column", gap:12 }}><div style={{ width:32, height:32, border:"3px solid rgba(55,81,114,0.2)", borderTopColor:AZ, borderRadius:"50%", animation:"spin 1s linear infinite" }} /><p style={{ color:AZ, fontWeight:500 }}>Cargando...</p><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>);

  const Dashboard = () => {
    const sd = useMemo(() => { const m = {}; issuers.forEach(iss => { if (!m[iss.sector]) m[iss.sector]={ok:0,warning:0,breach:0,total:0}; const st=issuerStatus(iss); m[iss.sector][st]=(m[iss.sector][st]||0)+1; m[iss.sector].total++; }); return Object.entries(m).sort((a,b)=>(b[1].breach+b[1].warning)-(a[1].breach+a[1].warning)).slice(0,8); }, []);
    return (<div><Header title="Dashboard de Covenants" sub={`${stats.issuers} emisores · ${allCovs.filter(c=>c.status!=="na").length} covenants`} />
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>{[["Emisores",stats.issuers,"#7a7f9a"],["✓ Cumple",stats.ok,L.ok],["⚠ En riesgo",stats.warning,L.warn],["✗ Incumple",stats.breach,L.danger]].map(([l,v,col])=>(<div key={l} style={{ flex:1, background:"#fff", borderRadius:6, padding:"16px 20px", border:`1px solid ${L.border}`, borderTop:`3px solid ${col}` }}><div style={{ fontSize:28, fontWeight:700, color:col }}>{v}</div><div style={{ fontSize:10, color:L.sub, marginTop:5, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div></div>))}</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={s.card}><p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Estado por sector</p>{sd.map(([sector,d])=>(<div key={sector} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}><div style={{ width:130, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{sector}</div><div style={{ flex:1, height:8, background:"#eee", borderRadius:2, overflow:"hidden", display:"flex" }}>{d.breach>0&&<div style={{ width:`${(d.breach/d.total)*100}%`, background:L.danger }}/>}{d.warning>0&&<div style={{ width:`${(d.warning/d.total)*100}%`, background:L.warn }}/>}{d.ok>0&&<div style={{ width:`${(d.ok/d.total)*100}%`, background:L.ok }}/>}</div><div style={{ fontSize:10, color:L.sub, width:18, textAlign:"right" }}>{d.total}</div></div>))}</div>
        <div style={s.card}><p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Alertas principales</p>{alertCovs.length===0?<div style={{ textAlign:"center", padding:24, color:L.ok }}>✓ Todos en cumplimiento</div>:alertCovs.slice(0,7).map((c,i)=>(<div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${L.border}` }}><div><span style={{ fontWeight:600, color:AZ, cursor:"pointer", fontSize:12 }} onClick={()=>{setSelId(c.issuerId);setView("emisores");}}>{c.issuerName}</span><div style={{ color:L.sub, fontSize:11 }}>{c.name}</div></div><Pill status={c.status}/></div>))}</div>
      </div></div>);
  };

  const Emisores = () => (<div><Header title="Emisores" sub="Haz clic en un emisor para ver detalles" />
    <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}><input style={{ ...s.inp, width:200 }} placeholder="Buscar emisor..." value={search} onChange={e=>setSearch(e.target.value)}/><select style={s.sel} value={filterSector} onChange={e=>setFilterSector(e.target.value)}><option value="all">Todos los sectores</option>{sectors.filter(x=>x!=="all").map(x=><option key={x} value={x}>{x}</option>)}</select><select style={s.sel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">Todos los estados</option><option value="ok">✓ Cumple</option><option value="warning">⚠ En riesgo</option><option value="breach">✗ Incumple</option></select></div>
    <div style={s.card}><table style={s.tbl}><thead><tr>{["","Emisor","Sector","Clasificación","EEFF","Covenants","Estado","Acciones"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
    <tbody>{filteredIssuers.map((iss,i)=>{const st=issuerStatus(iss);const bk={breach:iss.covenants.filter(c=>getStatus(c)==="breach").length,warning:iss.covenants.filter(c=>getStatus(c)==="warning").length,ok:iss.covenants.filter(c=>getStatus(c)==="ok").length};return(<tr key={iss.id} style={{ background:i%2===0?"#fff":"#fafafa", cursor:"pointer" }} onClick={()=>setSelId(iss.id)}><td style={{ ...s.td, width:14 }}><Dot status={st}/></td><td style={{ ...s.td, fontWeight:600, color:AZ }}>{iss.name}</td><td style={{ ...s.td, color:L.sub }}>{iss.sector}</td><td style={{ ...s.td, fontWeight:600, color:AZ }}>{iss.clasificacion}</td><td style={{ ...s.td, color:isStale(iss.fechaEEFF)?L.warn:L.sub }}>{iss.fechaEEFF}{isStale(iss.fechaEEFF)?" ⚠":""}</td><td style={s.td}>{iss.covenants.length}</td><td style={s.td}><div style={{ display:"flex", gap:4 }}>{bk.breach>0&&<span style={{ background:L.dangerBg,color:"rgb(170,40,50)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>✗ {bk.breach}</span>}{bk.warning>0&&<span style={{ background:L.warnBg,color:"rgb(150,110,20)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>⚠ {bk.warning}</span>}{bk.ok>0&&<span style={{ background:L.okBg,color:"rgb(40,120,70)",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500 }}>✓ {bk.ok}</span>}</div></td><td style={s.td} onClick={e=>e.stopPropagation()}><div style={{ display:"flex", gap:4 }}><button style={{ ...s.btn("#f0f2f5",AZ), fontSize:11 }} onClick={()=>setUploadIssuer(iss)}>📄 PDF</button><button style={{ ...s.btn("rgba(55,81,114,0.1)",AZ), fontSize:11 }} onClick={()=>setEditIssuer(iss)}>✏ Manual</button></div></td></tr>);})}</tbody></table></div></div>);

  const Detalle = () => {
    if (!sel) return null;
    return (<div><div style={{ display:"flex", gap:8, marginBottom:16 }}><button style={s.btn("#f0f2f5","#666")} onClick={()=>setSelId(null)}>← Volver</button><button style={s.btn()} onClick={()=>setUploadIssuer(sel)}>📄 Subir EEFF</button><button style={{ ...s.btn("rgba(55,81,114,0.1)",AZ) }} onClick={()=>setEditIssuer(sel)}>✏ Editar manual</button></div>
      <Header title={sel.name} sub={`${sel.sector} · ${sel.clasificacion} · EEFF ${sel.fechaEEFF}${isStale(sel.fechaEEFF)?" ⚠ desactualizado":""}`}/>
      {["flujo","stock"].map(tipo=>{const covs=sel.covenants.filter(c=>c.tipo===tipo);if(!covs.length)return null;return(<div key={tipo} style={{ ...s.card, marginBottom:16 }}><p style={{ fontSize:11, fontWeight:600, color:AZ, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>Covenants de {tipo==="flujo"?"flujo":"balance"}</p><table style={s.tbl}><thead><tr>{["Covenant","Límite","Actual","Holgura","Estado"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{covs.map((c,i)=>{const st=getStatus(c);const bg=st==="breach"?"rgba(210,70,80,0.05)":st==="warning"?"rgba(214,158,46,0.05)":i%2===0?"#fff":"#fafafa";return(<tr key={i} style={{ background:bg }}><td style={{ ...s.td, fontWeight:500 }}>{c.name}</td><td style={{ ...s.td, color:L.sub }}>{c.limite}</td><td style={{ ...s.td, fontWeight:600, color:st==="breach"?L.danger:st==="warning"?L.warn:"#2d3142", fontSize:13 }}>{c.actual}</td><td style={{ ...s.td, color:st==="breach"?L.danger:st==="warning"?L.warn:L.sub }}>{c.holgura}</td><td style={s.td}><div style={{ display:"flex", alignItems:"center", gap:6 }}><Dot status={st}/><Pill status={st}/></div></td></tr>);})}</tbody></table></div>);})}</div>);
  };

  const Alertas = () => (<div><Header title="Alertas de Cumplimiento" sub={`${alertCovs.length} covenants requieren atención`}/>{alertCovs.length===0?<div style={{ ...s.card, textAlign:"center", padding:48, color:L.ok }}><div style={{ fontSize:32 }}>✓</div><p style={{ fontWeight:600, marginTop:8 }}>Todos en cumplimiento</p></div>:["breach","warning"].map(lvl=>{const items=alertCovs.filter(c=>c.status===lvl);if(!items.length)return null;const col=lvl==="breach"?L.danger:L.warn;return(<div key={lvl} style={{ ...s.card, marginBottom:16, borderLeft:`4px solid ${col}`, borderRadius:"0 6px 6px 0" }}><p style={{ fontSize:11, fontWeight:600, color:col, marginBottom:14, textTransform:"uppercase", letterSpacing:0.5 }}>{lvl==="breach"?"✗ Incumplimiento":"⚠ En riesgo"} — {items.length} covenants</p><table style={s.tbl}><thead><tr>{["Emisor","Clasificación","Covenant","Límite","Actual","Estado",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{items.map((c,i)=>{const iss=issuers.find(x=>x.id===c.issuerId);return(<tr key={i} style={{ background:i%2===0?"#fff":"#fafafa" }}><td style={{ ...s.td, fontWeight:600, color:AZ, cursor:"pointer" }} onClick={()=>{setSelId(c.issuerId);setView("emisores");}}>{c.issuerName}</td><td style={{ ...s.td, color:AZ, fontWeight:600 }}>{iss?.clasificacion}</td><td style={s.td}>{c.name}</td><td style={{ ...s.td, color:L.sub }}>{c.limite}</td><td style={{ ...s.td, fontWeight:600, color:col }}>{c.actual}</td><td style={s.td}><Pill status={c.status}/></td><td style={s.td}><button style={{ ...s.btn("#f0f2f5",AZ), fontSize:10 }} onClick={()=>setEditIssuer(issuers.find(x=>x.id===c.issuerId))}>✏ Editar</button></td></tr>);})}</tbody></table></div>);})}</div>);

  return (<><style>{"*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif}@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    <div style={s.app}>
      <div style={s.sidebar}>
        <div style={{ padding:"22px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}><div style={{ color:"rgba(255,255,255,0.45)", fontSize:9, letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>Link Capital Partners</div><div style={{ color:"#fff", fontSize:15, fontWeight:600, lineHeight:1.3 }}>Covenant<br/>Tracker</div></div>
        <div style={{ padding:"16px 18px 6px", color:"rgba(255,255,255,0.3)", fontSize:9, letterSpacing:1.5, textTransform:"uppercase" }}>Monitoreo</div>
        {[["dashboard","Dashboard"],["emisores","Emisores"],["alertas","Alertas"]].map(([v,l])=>(<button key={v} style={s.nav(view===v&&!selId)} onClick={()=>{setView(v);setSelId(null);}}>{l}</button>))}
        <div style={{ marginTop:"auto", padding:"16px 18px", borderTop:"1px solid rgba(255,255,255,0.1)" }}><div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Alertas activas</div><div style={{ color:stats.breach>0?L.danger:stats.warning>0?L.warn:"rgba(255,255,255,0.6)", fontSize:26, fontWeight:700, marginTop:4 }}>{stats.breach+stats.warning}</div>{stats.breach>0&&<div style={{ color:L.danger, fontSize:10 }}>✗ {stats.breach} incumplimiento{stats.breach>1?"s":""}</div>}</div>
      </div>
      <div style={s.main}>{view==="dashboard"&&!selId&&<Dashboard/>}{view==="emisores"&&!selId&&<Emisores/>}{view==="emisores"&&selId&&<Detalle/>}{view==="alertas"&&!selId&&<Alertas/>}</div>
    </div>
    {uploadIssuer&&<UploadModal issuer={uploadIssuer} onClose={()=>setUploadIssuer(null)} onSuccess={()=>{setUploadIssuer(null);loadData();}}/>}
    {editIssuer&&<EditModal issuer={editIssuer} onClose={()=>setEditIssuer(null)} onSuccess={()=>{setEditIssuer(null);loadData();}}/>}
  </>);
}