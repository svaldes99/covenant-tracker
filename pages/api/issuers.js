import { INITIAL_ISSUERS } from "../../lib/data";

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
  let store = {};
  return {
    get: async (key) => store[key] || null,
    set: async (key, value) => { store[key] = value; }
  };
}

export default async function handler(req, res) {
  const db = await getRedis();

  if (req.method === "GET") {
    const data = await db.get("issuers");
    return res.status(200).json(data || INITIAL_ISSUERS);
  }

  // POST: update covenants for one issuer (and snapshot history)
  if (req.method === "POST") {
    const { issuerId, covenants, fechaEEFF, replaceAll } = req.body;
    let data = await db.get("issuers") || INITIAL_ISSUERS;

    data = data.map(iss => {
      if (iss.id !== issuerId) return iss;
      let updated;
      if (replaceAll) {
        updated = { ...iss, covenants, fechaEEFF: fechaEEFF || iss.fechaEEFF };
      } else {
        const updatedCovenants = iss.covenants.map(cov => {
          const extracted = covenants.find(e => e.name === cov.name);
          if (!extracted || extracted.actual === null) return cov;
          return { ...cov, actual: extracted.actualStr, act: extracted.actual, holgura: extracted.holguraStr };
        });
        updated = { ...iss, covenants: updatedCovenants, fechaEEFF: fechaEEFF || iss.fechaEEFF };
      }
      return updated;
    });

    await db.set("issuers", data);

    // Save snapshot for history (if fechaEEFF provided)
    if (fechaEEFF) {
      const histKey = `history:${issuerId}`;
      const history = await db.get(histKey) || [];
      const issuerNow = data.find(i => i.id === issuerId);
      const snapshot = {
        fecha: fechaEEFF,
        ts: Date.now(),
        covenants: (issuerNow?.covenants || []).filter(c => c.act != null).map(c => ({
          name: c.name, act: c.act, lim: c.lim, op: c.op, unidad: c.unidad || "x",
          holgura: c.holgura, status: c.act != null && c.lim != null
            ? (c.op === "<=" ? (c.act <= c.lim ? "ok" : "breach") : (c.act >= c.lim ? "ok" : "breach"))
            : "na"
        }))
      };
      // Avoid duplicate periods
      const filtered = history.filter(h => h.fecha !== fechaEEFF);
      filtered.push(snapshot);
      filtered.sort((a, b) => a.ts - b.ts);
      // Keep last 24 snapshots
      await db.set(histKey, filtered.slice(-24));
    }

    return res.status(200).json({ ok: true });
  }

  // PATCH: update issuer metadata
  if (req.method === "PATCH") {
    const { issuerId, name, sector, clasificacion } = req.body;
    let data = await db.get("issuers") || INITIAL_ISSUERS;
    data = data.map(iss => {
      if (iss.id !== issuerId) return iss;
      return { ...iss, name: name || iss.name, sector: sector || iss.sector, clasificacion: clasificacion || iss.clasificacion };
    });
    await db.set("issuers", data);
    return res.status(200).json({ ok: true });
  }

  // PUT: replace full dataset
  if (req.method === "PUT") {
    await db.set("issuers", req.body);
    return res.status(200).json({ ok: true });
  }

  // DELETE: remove issuer
  if (req.method === "DELETE") {
    const { issuerId } = req.body;
    let data = await db.get("issuers") || INITIAL_ISSUERS;
    data = data.filter(iss => iss.id !== issuerId);
    await db.set("issuers", data);
    // Clean up history too
    await db.set(`history:${issuerId}`, []);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
