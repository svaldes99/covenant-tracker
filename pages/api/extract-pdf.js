import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Error parsing form" });
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    const issuerName = Array.isArray(fields.issuerName) ? fields.issuerName[0] : fields.issuerName;
    const covenants = JSON.parse(Array.isArray(fields.covenants) ? fields.covenants[0] : fields.covenants);
    if (!file) return res.status(400).json({ error: "No PDF file uploaded" });
    try {
      const pdfBuffer = fs.readFileSync(file.filepath);
      const base64PDF = pdfBuffer.toString("base64");
      const covenantList = covenants.map(c => `- "${c.name}" (tipo: ${c.tipo}, op: ${c.op}, límite: ${c.lim})`).join("\n");
      const prompt = `Eres analista financiero experto en bonos chilenos. EEFF de "${issuerName}". Extrae valores para:\n${covenantList}\nResponde SOLO con JSON válido:\n{"fechaEEFF":"mmm-aa","covenants":[{"name":"nombre exacto","actual":1.23,"actualStr":"1,23x","holgura":0.45,"holguraStr":"0,45x"}]}\nUsa null si no puedes calcular. Usa punto decimal.`;
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64PDF } },
          { type: "text", text: prompt }
        ]}]
      });
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const extracted = JSON.parse(jsonMatch[0]);
      fs.unlinkSync(file.filepath);
      return res.status(200).json(extracted);
    } catch (e) {
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(500).json({ error: e.message });
    }
  });
}