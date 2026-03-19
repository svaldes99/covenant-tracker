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
