import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Max base64 size ~25MB = ~100 pages roughly
const MAX_B64_CHARS = 25 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const form = new IncomingForm({ maxFileSize: 100 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Error al procesar el archivo" });
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    const issuerName = Array.isArray(fields.issuerName) ? fields.issuerName[0] : fields.issuerName;
    const covenants = JSON.parse(Array.isArray(fields.covenants) ? fields.covenants[0] : fields.covenants);
    if (!file) return res.status(400).json({ error: "No se subió ningún archivo PDF" });

    try {
      const pdfBuffer = fs.readFileSync(file.filepath);
      let base64PDF = pdfBuffer.toString("base64");

      // If PDF is too large, truncate (Claude will still read what it can)
      if (base64PDF.length > MAX_B64_CHARS) {
        base64PDF = base64PDF.substring(0, MAX_B64_CHARS);
      }

      const covenantList = covenants.map(c =>
        `- "${c.name}" (tipo: ${c.tipo}, op: ${c.op}, límite: ${c.lim})`
      ).join("\n");

      const prompt = `Eres analista financiero experto en bonos corporativos chilenos.
Se te entrega el EEFF de la empresa "${issuerName}".
Extrae los valores actuales para calcular estos covenants financieros:
${covenantList}

Instrucciones:
- Busca en el balance general, estado de resultados y notas financieras
- Calcula cada ratio con los valores que encuentres
- Si no encuentras un valor, usa null

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{
  "fechaEEFF": "mmm-aa",
  "covenants": [
    { "name": "nombre exacto del covenant", "actual": 1.23, "actualStr": "1,23x", "holgura": 0.45, "holguraStr": "0,45x" }
  ]
}
Usa punto decimal (.) para números, no coma.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64PDF } },
          { type: "text", text: prompt }
        ]}]
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Claude no pudo extraer los datos del PDF. Intenta con un PDF más pequeño.");
      const extracted = JSON.parse(jsonMatch[0]);
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(200).json(extracted);
    } catch (e) {
      try { fs.unlinkSync(file.filepath); } catch {}
      if (e.message?.includes("100 PDF pages") || e.message?.includes("too long")) {
        return res.status(400).json({
          error: "El PDF es demasiado extenso. Por favor sube solo las páginas del balance general y estado de resultados (máx ~50 páginas). Puedes dividir el PDF en ilovepdf.com."
        });
      }
      return res.status(500).json({ error: e.message });
    }
  });
}