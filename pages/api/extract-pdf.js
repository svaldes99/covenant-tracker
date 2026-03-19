import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const form = new IncomingForm({ maxFileSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Error al procesar el archivo" });
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    const issuerName = Array.isArray(fields.issuerName) ? fields.issuerName[0] : fields.issuerName;
    const covenants = JSON.parse(Array.isArray(fields.covenants) ? fields.covenants[0] : fields.covenants);
    if (!file) return res.status(400).json({ error: "No se subió ningún archivo PDF" });

    // Check file size - PDFs over ~10MB likely have >100 pages
    const stats = fs.statSync(file.filepath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 15) {
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(400).json({ 
        error: "El PDF es demasiado grande (" + fileSizeMB.toFixed(1) + "MB). Por favor sube solo las páginas relevantes del EEFF (balance, resultados). Claude acepta máximo 100 páginas." 
      });
    }

    try {
      const pdfBuffer = fs.readFileSync(file.filepath);
      const base64PDF = pdfBuffer.toString("base64");
      const covenantList = covenants.map(c => `- "${c.name}" (tipo: ${c.tipo}, op: ${c.op}, límite: ${c.lim})`).join("\n");
      const prompt = `Eres analista financiero experto en bonos corporativos chilenos.
Se te entrega el EEFF de la empresa "${issuerName}".
Extrae los valores actuales para calcular estos covenants:
${covenantList}

Responde ÚNICAMENTE con JSON válido:
{
  "fechaEEFF": "mmm-aa",
  "covenants": [
    { "name": "nombre exacto del covenant", "actual": 1.23, "actualStr": "1,23x", "holgura": 0.45, "holguraStr": "0,45x" }
  ]
}
Si no puedes calcular un covenant usa null. Usa punto decimal (.) no coma para números.`;

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
      if (!jsonMatch) throw new Error("No se pudo extraer la información del PDF");
      const extracted = JSON.parse(jsonMatch[0]);
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(200).json(extracted);
    } catch (e) {
      try { fs.unlinkSync(file.filepath); } catch {}
      // Handle Anthropic specific errors with friendly messages
      if (e.message?.includes("100 PDF pages")) {
        return res.status(400).json({ error: "El PDF tiene más de 100 páginas. Por favor extrae solo las páginas del balance general y estado de resultados (generalmente 5-20 páginas)." });
      }
      return res.status(500).json({ error: e.message });
    }
  });
}