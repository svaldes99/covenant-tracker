// Temporary seed endpoint — call once to populate the DB with sample data
// DELETE this file after seeding

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  // Simple auth check
  if (req.headers["x-seed-key"] !== "link-capital-seed-2025") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const issuers = [
    {
      id: "empresas-cmpc-001",
      name: "Empresas CMPC S.A.",
      sector: "Industrial",
      clasificacion: "AA",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 3.5, limite: "3,50 x (veces)", unidad: "x (veces)", actual: "2,31 x (veces)", act: 2.31, holgura: 1.19, actualStr: "2,31 x (veces)", holguraStr: "1,19 x (veces)" },
        { name: "Cobertura GFN", tipo: "flujo", op: ">=", lim: 3.0, limite: "3,00 x (veces)", unidad: "x (veces)", actual: "4,82 x (veces)", act: 4.82, holgura: 1.82, actualStr: "4,82 x (veces)", holguraStr: "1,82 x (veces)" },
        { name: "DFN / Patrimonio", tipo: "stock", op: "<=", lim: 0.8, limite: "0,80 x (veces)", unidad: "x (veces)", actual: "0,61 x (veces)", act: 0.61, holgura: 0.19, actualStr: "0,61 x (veces)", holguraStr: "0,19 x (veces)" }
      ]
    },
    {
      id: "enel-generacion-002",
      name: "Enel Generación Chile S.A.",
      sector: "Energía",
      clasificacion: "AA-",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "Deuda Financiera / EBITDA", tipo: "flujo", op: "<=", lim: 4.0, limite: "4,00 x (veces)", unidad: "x (veces)", actual: "3,91 x (veces)", act: 3.91, holgura: 0.09, actualStr: "3,91 x (veces)", holguraStr: "0,09 x (veces)" },
        { name: "Patrimonio Mínimo", tipo: "stock", op: ">=", lim: 800000, limite: "800.000 MM CLP", unidad: "MM CLP", actual: "1.243.000 MM CLP", act: 1243000, holgura: 443000, actualStr: "1.243.000 MM CLP", holguraStr: "443.000 MM CLP" },
        { name: "Leverage", tipo: "stock", op: "<=", lim: 1.5, limite: "1,50 x (veces)", unidad: "x (veces)", actual: "0,98 x (veces)", act: 0.98, holgura: 0.52, actualStr: "0,98 x (veces)", holguraStr: "0,52 x (veces)" }
      ]
    },
    {
      id: "latam-airlines-003",
      name: "LATAM Airlines Group S.A.",
      sector: "Transporte",
      clasificacion: "BBB",
      fechaEEFF: "sep-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 4.5, limite: "4,50 x (veces)", unidad: "x (veces)", actual: "5,12 x (veces)", act: 5.12, holgura: -0.62, actualStr: "5,12 x (veces)", holguraStr: "-0,62 x (veces)" },
        { name: "Cobertura Gastos Financieros", tipo: "flujo", op: ">=", lim: 2.5, limite: "2,50 x (veces)", unidad: "x (veces)", actual: "1,87 x (veces)", act: 1.87, holgura: -0.63, actualStr: "1,87 x (veces)", holguraStr: "-0,63 x (veces)" }
      ]
    },
    {
      id: "cencosud-004",
      name: "Cencosud S.A.",
      sector: "Retail",
      clasificacion: "A+",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 3.5, limite: "3,50 x (veces)", unidad: "x (veces)", actual: "2,18 x (veces)", act: 2.18, holgura: 1.32, actualStr: "2,18 x (veces)", holguraStr: "1,32 x (veces)" },
        { name: "Patrimonio / Activos Totales", tipo: "stock", op: ">=", lim: 0.30, limite: "0,30 x (veces)", unidad: "x (veces)", actual: "0,38 x (veces)", act: 0.38, holgura: 0.08, actualStr: "0,38 x (veces)", holguraStr: "0,08 x (veces)" },
        { name: "Cobertura GFN", tipo: "flujo", op: ">=", lim: 3.0, limite: "3,00 x (veces)", unidad: "x (veces)", actual: "3,74 x (veces)", act: 3.74, holgura: 0.74, actualStr: "3,74 x (veces)", holguraStr: "0,74 x (veces)" }
      ]
    },
    {
      id: "colbun-005",
      name: "Colbún S.A.",
      sector: "Energía",
      clasificacion: "AA-",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 4.0, limite: "4,00 x (veces)", unidad: "x (veces)", actual: "2,64 x (veces)", act: 2.64, holgura: 1.36, actualStr: "2,64 x (veces)", holguraStr: "1,36 x (veces)" },
        { name: "Cobertura de Cargos Fijos", tipo: "flujo", op: ">=", lim: 2.0, limite: "2,00 x (veces)", unidad: "x (veces)", actual: "3,41 x (veces)", act: 3.41, holgura: 1.41, actualStr: "3,41 x (veces)", holguraStr: "1,41 x (veces)" },
        { name: "Endeudamiento Financiero Neto", tipo: "stock", op: "<=", lim: 60, limite: "60,00 %", unidad: "%", actual: "38,20 %", act: 38.20, holgura: 21.80, actualStr: "38,20 %", holguraStr: "21,80 %" }
      ]
    },
    {
      id: "mall-plaza-006",
      name: "Mall Plaza S.A.",
      sector: "Inmobiliario",
      clasificacion: "AA",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 8.0, limite: "8,00 x (veces)", unidad: "x (veces)", actual: "6,43 x (veces)", act: 6.43, holgura: 1.57, actualStr: "6,43 x (veces)", holguraStr: "1,57 x (veces)" },
        { name: "Loan to Value (LTV)", tipo: "stock", op: "<=", lim: 50, limite: "50,00 %", unidad: "%", actual: "41,30 %", act: 41.30, holgura: 8.70, actualStr: "41,30 %", holguraStr: "8,70 %" },
        { name: "Cobertura de Intereses", tipo: "flujo", op: ">=", lim: 1.5, limite: "1,50 x (veces)", unidad: "x (veces)", actual: "1.98 x (veces)", act: 1.98, holgura: 0.48, actualStr: "1,98 x (veces)", holguraStr: "0,48 x (veces)" }
      ]
    },
    {
      id: "entel-007",
      name: "Entel S.A.",
      sector: "Telecomunicaciones",
      clasificacion: "A+",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 3.5, limite: "3,50 x (veces)", unidad: "x (veces)", actual: "2,89 x (veces)", act: 2.89, holgura: 0.61, actualStr: "2,89 x (veces)", holguraStr: "0,61 x (veces)" },
        { name: "Cobertura GFN", tipo: "flujo", op: ">=", lim: 2.5, limite: "2,50 x (veces)", unidad: "x (veces)", actual: "3,12 x (veces)", act: 3.12, holgura: 0.62, actualStr: "3,12 x (veces)", holguraStr: "0,62 x (veces)" }
      ]
    },
    {
      id: "ripley-corp-008",
      name: "Ripley Corp S.A.",
      sector: "Retail",
      clasificacion: "BBB+",
      fechaEEFF: "sep-24",
      covenants: [
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 4.0, limite: "4,00 x (veces)", unidad: "x (veces)", actual: "4.31 x (veces)", act: 4.31, holgura: -0.31, actualStr: "4,31 x (veces)", holguraStr: "-0,31 x (veces)" },
        { name: "Patrimonio Neto Mínimo", tipo: "stock", op: ">=", lim: 300000, limite: "300.000 MM CLP", unidad: "MM CLP", actual: "412.300 MM CLP", act: 412300, holgura: 112300, actualStr: "412.300 MM CLP", holguraStr: "112.300 MM CLP" }
      ]
    },
    {
      id: "aguas-andinas-009",
      name: "Aguas Andinas S.A.",
      sector: "Servicios",
      clasificacion: "AA+",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "Endeudamiento", tipo: "stock", op: "<=", lim: 1.8, limite: "1,80 x (veces)", unidad: "x (veces)", actual: "1,23 x (veces)", act: 1.23, holgura: 0.57, actualStr: "1,23 x (veces)", holguraStr: "0,57 x (veces)" },
        { name: "DFN / EBITDA", tipo: "flujo", op: "<=", lim: 5.0, limite: "5,00 x (veces)", unidad: "x (veces)", actual: "3,87 x (veces)", act: 3.87, holgura: 1.13, actualStr: "3,87 x (veces)", holguraStr: "1,13 x (veces)" },
        { name: "Cobertura de Deuda", tipo: "flujo", op: ">=", lim: 1.2, limite: "1,20 x (veces)", unidad: "x (veces)", actual: "1,89 x (veces)", act: 1.89, holgura: 0.69, actualStr: "1,89 x (veces)", holguraStr: "0,69 x (veces)" }
      ]
    },
    {
      id: "parque-arauco-010",
      name: "Parque Arauco S.A.",
      sector: "Inmobiliario",
      clasificacion: "AA-",
      fechaEEFF: "dic-24",
      covenants: [
        { name: "DFN / EBITDA Ajustado", tipo: "flujo", op: "<=", lim: 9.0, limite: "9,00 x (veces)", unidad: "x (veces)", actual: "7,12 x (veces)", act: 7.12, holgura: 1.88, actualStr: "7,12 x (veces)", holguraStr: "1,88 x (veces)" },
        { name: "LTV Consolidado", tipo: "stock", op: "<=", lim: 55, limite: "55,00 %", unidad: "%", actual: "46,80 %", act: 46.80, holgura: 8.20, actualStr: "46,80 %", holguraStr: "8,20 %" },
        { name: "Cobertura de Intereses", tipo: "flujo", op: ">=", lim: 1.3, limite: "1,30 x (veces)", unidad: "x (veces)", actual: "1,72 x (veces)", act: 1.72, holgura: 0.42, actualStr: "1,72 x (veces)", holguraStr: "0,42 x (veces)" }
      ]
    }
  ];

  // Save to Redis via the existing issuers API logic
  let _client = null;
  async function getRedis() {
    if (process.env.REDIS_URL) {
      if (!_client) {
        const Redis = (await import("ioredis")).default;
        _client = new Redis(process.env.REDIS_URL);
      }
      return {
        get: async (key) => { const val = await _client.get(key); return val ? JSON.parse(val) : null; },
        set: async (key, value) => { await _client.set(key, JSON.stringify(value)); }
      };
    }
    return null;
  }

  const db = await getRedis();
  if (!db) return res.status(500).json({ error: "No Redis connection" });

  const existing = await db.get("issuers") || [];
  const existingIds = new Set(existing.map(i => i.id));
  const newOnes = issuers.filter(i => !existingIds.has(i.id));
  const merged = [...existing, ...newOnes];
  await db.set("issuers", merged);

  // Also seed history for each issuer (3 historical periods)
  const periods = ["jun-23", "dic-23", "jun-24"];
  for (const issuer of newOnes) {
    const history = periods.map((fecha, idx) => {
      // Simulate slight variation per period
      const factor = 0.85 + idx * 0.07;
      return {
        fecha,
        ts: Date.now() - (3 - idx) * 180 * 24 * 3600 * 1000,
        covenants: issuer.covenants.filter(c => c.act != null).map(c => {
          const simAct = +(c.act * (factor + (Math.random() - 0.5) * 0.08)).toFixed(2);
          const simHolgura = c.op === "<=" ? +(c.lim - simAct).toFixed(2) : +(simAct - c.lim).toFixed(2);
          const status = c.op === "<=" ? (simAct <= c.lim ? (simAct > c.lim * 0.9 ? "warning" : "ok") : "breach")
                                       : (simAct >= c.lim ? (simAct < c.lim * 1.1 ? "warning" : "ok") : "breach");
          return { name: c.name, act: simAct, lim: c.lim, op: c.op, unidad: c.unidad, holgura: simHolgura, status };
        })
      };
    });
    await db.set(`history:${issuer.id}`, history);
  }

  return res.status(200).json({
    ok: true,
    added: newOnes.length,
    skipped: issuers.length - newOnes.length,
    total: merged.length,
    issuers: newOnes.map(i => i.name)
  });
}
