let _client = null;

async function getRedis() {
  if (process.env.REDIS_URL) {
    if (!_client) {
      const Redis = (await import("ioredis")).default;
      _client = new Redis(process.env.REDIS_URL);
    }
    return {
      get: async (key) => { const val = await _client.get(key); return val ? JSON.parse(val) : null; },
    };
  }
  return { get: async () => null };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { issuerId } = req.query;
  if (!issuerId) return res.status(400).json({ error: "issuerId required" });
  const db = await getRedis();
  const history = await db.get(`history:${issuerId}`) || [];
  return res.status(200).json(history);
}
