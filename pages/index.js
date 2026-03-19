import { useState, useEffect, useMemo } from "react";
import { getStatus, issuerStatus, isStale } from "../lib/data";

const AZ = "rgb(55,81,114)";
const L = {
  ok: "rgb(101,169,124)", okBg: "rgba(101,169,124,0.12)",
  warn: "rgb(214,158,46)", warnBg: "rgba(214,158,46,0.12)",
  danger: "rgb(210,70,80)", dangerBg: "rgba(210,70,80,0.1)",
  sub: "#7a7f9a", border: "rgba(0,0,0,0.07)", bg: "#f0f2f5",
};

function fmtNum(n, suffix = "x") {
  if (n === null || n === undefined || isNaN(n)) return null;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + intFmt + "," + decPart + suffix;
}

function parseNum(s) {
  if (!s && s !== 0) return NaN;
  const str = String(s);
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