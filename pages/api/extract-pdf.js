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
    const calculateExtra = fields.calculateExtra ? JSON.parse(Array.isArray(fields.calculateExtra) ? fields.calculateExtra[0] : fields.calculateExtra) : [];
    if (!file) return res.status(400).json({ error: "No se subió ningún archivo PDF" });

    try {
      const pdfBuffer = fs.readFileSync(file.filepath);
      let base64PDF = pdfBuffer.toString("base64");
      if (base64PDF.length > MAX_B64_CHARS) base64PDF = base64PDF.substring(0, MAX_B64_CHARS);

      const covenantList = covenants.map(c =>
        `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`
      ).join("\n");

      const extraList = calculateExtra.length > 0
        ? "\n\nADEMÁS, calcula estos covenants adicionales solicitados por el usuario:\n" +
          calculateExtra.map(c => `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`).join("\n")
        : "";

      const prompt = `Eres analista financiero experto en bonos corporativos chilenos.
Se te entrega documentación financiera de "${issuerName}".

TAREA: Extraer o calcular los valores actuales de los siguientes covenants financieros DE BONOS (no créditos bancarios):
${covenantList}${extraList}

DÓNDE BUSCAR (en orden de prioridad):
1. Notas a los EEFF con títulos como: "Restricciones financieras", "Resguardos financieros", "Covenants de bonos", "Contingencias y restricciones", "Bonos y obligaciones", "Ratios financieros de bonos", o cualquier nota que mencione bonos en circulación o líneas de bonos.
2. Si los ratios están calculados explícitamente en alguna tabla de esa nota, úsalos directamente.
3. Si no están explícitos, calcúlalos desde los estados financieros consolidados:
   - DFN = Pasivos financieros con costo (bonos + préstamos bancarios) - Efectivo y equivalentes de efectivo
   - EBITDA = Resultado operacional (EBIT) + Depreciación y amortización del período
   - GFN = Costos financieros - Ingresos financieros
   - Patrimonio = Total patrimonio atribuible a los propietarios de la controladora
   - DF = Total pasivos financieros con costo
   - Leverage = DF / Patrimonio
   - Cobertura = EBITDA / GFN

REGLAS IMPORTANTES:
- Solo considera covenants de BONOS. Ignora covenants de créditos bancarios o líneas de crédito.
- Si un covenant NO se puede calcular porque faltan datos, usa null con una razón breve.
- Para la holgura: si op="<=", holgura = límite - actual. Si op=">=", holgura = actual - límite.

Responde ÚNICAMENTE con este JSON (sin texto antes ni después):
{
  "fechaEEFF": "mmm-aa",
  "encontrados": true,
  "covenants": [
    {
      "name": "nombre exacto de la lista",
      "actual": 1.23,
      "actualStr": "1,23x",
      "holgura": 0.45,
      "holguraStr": "0,45x",
      "encontrado": true,
      "nota": "encontrado en nota X / calculado desde balance"
    }
  ],
  "resumen": "Breve descripción de dónde se encontraron los datos"
}

Para covenants no encontrados usa: actual: null, holgura: null, encontrado: false, nota: "razón por la que no se pudo calcular".`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
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
        return res.status(400).json({ error: "El PDF es demasiado extenso. Sube solo las páginas del balance general, estado de resultados y notas de bonos (máx ~80 páginas). Puedes dividirlo en ilovepdf.com." });
      }
      return res.status(500).json({ error: e.message });
    }
  });
}