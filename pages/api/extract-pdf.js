import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

      if (base64PDF.length > MAX_B64_CHARS) {
        base64PDF = base64PDF.substring(0, MAX_B64_CHARS);
      }

      const covenantList = covenants.map(c =>
        `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim} | actual actual: ${c.act}`
      ).join("\n");

      const prompt = `Eres analista financiero experto en bonos corporativos chilenos.
Se te entrega documentación financiera de la empresa "${issuerName}".

Necesito que extraigas o calcules los valores ACTUALES de estos covenants financieros:
${covenantList}

INSTRUCCIONES (en orden de prioridad):
1. PRIMERO busca si el documento incluye una sección de "Covenants", "Restricciones financieras", "Financial covenants" o similar — si los valores están ahí directamente, úsalos.
2. SEGUNDO si no están explícitos, calcula cada ratio usando los estados financieros:
   - DFN (Deuda Financiera Neta) = Deuda financiera total - Caja y equivalentes
   - EBITDA = Resultado operacional + Depreciación + Amortización
   - GFN (Gastos Financieros Netos) = Costos financieros - Ingresos financieros
   - Patrimonio = Total patrimonio neto
3. Para la holgura: si operador es "<=", holgura = límite - actual. Si ">=", holgura = actual - límite.
4. Si no encuentras suficiente información para calcular un covenant, usa null.

Responde ÚNICAMENTE con este JSON válido (sin texto adicional antes ni después):
{
  "fechaEEFF": "mmm-aa",
  "covenants": [
    {
      "name": "nombre EXACTO del covenant como aparece en la lista de arriba",
      "actual": 1.23,
      "actualStr": "1,23x",
      "holgura": 0.45,
      "holguraStr": "0,45x"
    }
  ]
}

IMPORTANTE:
- El campo "name" debe coincidir EXACTAMENTE con los nombres de la lista de arriba
- Usa punto decimal (.) para números, no coma
- Para holgura negativa usa número negativo: -0.11 → "-0,11x"
- Incluye TODOS los covenants de la lista, aunque sean null`;

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
      if (!jsonMatch) throw new Error("Claude no pudo extraer los datos del PDF.");
      const extracted = JSON.parse(jsonMatch[0]);
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(200).json(extracted);
    } catch (e) {
      try { fs.unlinkSync(file.filepath); } catch {}
      if (e.message?.includes("100 PDF pages") || e.message?.includes("too long") || e.message?.includes("tokens")) {
        return res.status(400).json({
          error: "El PDF es demasiado extenso. Sube solo las páginas del balance general, estado de resultados y notas de deuda (máx ~80 páginas). Puedes dividirlo en ilovepdf.com."
        });
      }
      return res.status(500).json({ error: e.message });
    }
  });
}