import { INITIAL_ISSUERS } from "../../lib/data";

let _client = null;

async function getRedis() {
  if (process.env.REDIS_URL) {
    if (!_client) {
      const Redis = (await import("ioredis")).default;
      _client = new Redis(process.env.REDIS_URL);
    }
    return {
      get: async (key) => {
        const val = await _client.get(key);
        return val ? JSON.parse(val) : null;
      },
      set: async (key, value) => {
        await _client.set(key, JSON.stringify(value));
      }
    };
  }
  // In-memory fallback for local dev
  let store = null;
  return {
    get: async () => store,
    set: async (_, v) => { store = v; }
  };
}

export default async function handler(req, res) {
  const db = await getRedis();

  if (req.method === "GET") {
    const data = await db.get("issuers");
    return res.status(200).json(data || INITIAL_ISSUERS);
  }

  if (req.method === "POST") {
    const { issuerId, covenants, fechaEEFF } = req.body;
    let data = await db.get("issuers") || INITIAL_ISSUERS;
    data = data.map(iss => {
      if (iss.id !== issuerId) return iss;
      const updatedCovenants = iss.covenants.map(cov => {
        const extracted = covenants.find(e => e.name === cov.name);
        if (!extracted || extracted.actual === null) return cov;
        return { ...cov, actual: extracted.actualStr, act: extracted.actual, holgura: extracted.holguraStr };
      });
      return { ...iss, covenants: updatedCovenants, fechaEEFF: fechaEEFF || iss.fechaEEFF };
    });
    await db.set("issuers", data);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    await db.set("issuers", req.body);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}