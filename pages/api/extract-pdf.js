import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_B64_CHARS = 25 * 1024 * 1024; // ~80 pages

// Keywords to identify relevant pages for smart extraction
const KEYWORDS = [
  // Covenants / resguardos
  "resguardo","covenant","restriccion financiera","restricción financiera",
  "financial covenant","ratio de bonos","obligaciones financieras","covenants de bonos",
  // Balance sheet
  "balance general","estado de situacion financiera","estado de situación financiera",
  "activos corrientes","pasivos corrientes","patrimonio neto","total patrimonio",
  "pasivos financieros","deuda financiera","efectivo y equivalentes",
  // Income statement
  "estado de resultados","resultado operacional","ingresos de actividades",
  "ganancia bruta","ebitda","depreciacion","depreciación","amortizacion","amortización",
  "costos financieros","ingresos financieros","resultado antes",
  // Debt notes
  "obligaciones con el publico","bonos en circulacion","bonos en circulación",
  "linea de bonos","línea de bonos","emisiones de bonos","instrumentos financieros",
  "deuda neta","dfn","leverage","cobertura de gastos"
];

function scorePageText(text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of KEYWORDS) {
    if (lower.includes(kw)) score += kw.length > 10 ? 3 : 1;
  }
  return score;
}

async function extractSmartPages(pdfBuffer) {
  let pdfParse;
  try { pdfParse = (await import("pdf-parse")).default; } catch(e) { return null; }

  const data = await pdfParse(pdfBuffer);
  const totalPages = data.numpages;
  if (totalPages <= 80) return null; // no need to filter

  // Parse page by page
  const pageScores = [];
  for (let p = 1; p <= totalPages; p++) {
    const pageData = await pdfParse(pdfBuffer, { max: p });
    const prevData = p > 1 ? await pdfParse(pdfBuffer, { max: p - 1 }) : { text: "" };
    const pageText = pageData.text.slice(prevData.text.length);
    pageScores.push({ page: p, score: scorePageText(pageText), text: pageText });
  }

  // Sort by score, take top pages up to 70, always include first 5 pages (cover/index)
  const firstPages = pageScores.slice(0, 5);
  const rest = pageScores.slice(5).sort((a,b) => b.score - a.score).slice(0, 65);
  const selected = [...firstPages, ...rest].sort((a,b) => a.page - b.page);
  
  return { selected, totalPages, selectedCount: selected.length };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const form = new IncomingForm({ maxFileSize: 100 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Error al procesar el archivo" });
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    const issuerName = Array.isArray(fields.issuerName) ? fields.issuerName[0] : fields.issuerName;
    const covenants = JSON.parse(Array.isArray(fields.covenants) ? fields.covenants[0] : fields.covenants);
    const calculateExtra = fields.calculateExtra ? JSON.parse(Array.isArray(fields.calculateExtra) ? fields.calculateExtra[0] : fields.calculateExtra) : [];
    const detectMode = fields.detectMode === "true" || fields.detectMode?.[0] === "true";
    const smartMode = fields.smartMode === "true" || fields.smartMode?.[0] === "true";
    if (!file) return res.status(400).json({ error: "No se subió ningún archivo PDF" });

    try {
      const pdfBuffer = fs.readFileSync(file.filepath);
      let base64PDF = pdfBuffer.toString("base64");
      let smartInfo = null;

      if (smartMode) {
        // Smart extraction: find relevant pages
        try {
          const smart = await extractSmartPages(pdfBuffer);
          if (smart) {
            // Rebuild PDF with only selected pages using pdf-parse text
            // Since we can't rebuild PDF easily, we send the text content directly
            const combinedText = smart.selected.map(p => `--- Página ${p.page} ---\n${p.text}`).join("\n\n");
            smartInfo = { totalPages: smart.totalPages, selectedCount: smart.selectedCount };
            // Encode combined text as a plain text approach
            base64PDF = Buffer.from(combinedText).toString("base64");
            // Flag to use text instead of PDF
            res._smartText = combinedText;
            res._smartInfo = smartInfo;
          }
        } catch(e) {
          console.error("Smart extraction failed, falling back to truncation:", e.message);
        }
      }

      // Truncate if still too large
      if (base64PDF.length > MAX_B64_CHARS) {
        base64PDF = base64PDF.substring(0, MAX_B64_CHARS);
      }

      const covenantList = covenants.map(c =>
        `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`
      ).join("\n");

      const extraList = calculateExtra.length > 0
        ? "\n\nADEMÁS calcula estos covenants adicionales:\n" +
          calculateExtra.map(c => `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`).join("\n")
        : "";

      const detectInstructions = detectMode
        ? `TAREA ESPECIAL: Este es un emisor nuevo. Detecta TODOS los covenants de bonos que encuentres en el documento (resguardos financieros, restricciones de bonos, ratios exigidos). Para cada uno identifica: nombre del ratio, tipo (flujo/stock), operador (<=/>= ), límite numérico y valor actual.`
        : `Extrae o calcula los valores actuales de estos covenants financieros DE BONOS:\n${covenantList}${extraList}`;

      const prompt = `Eres analista financiero experto en bonos corporativos chilenos.
Se te entrega documentación financiera de "${issuerName}".
${smartInfo ? `(PDF de ${smartInfo.totalPages} páginas — se analizaron ${smartInfo.selectedCount} páginas relevantes con balance, EERR y notas de bonos)` : ""}

${detectInstructions}

DÓNDE BUSCAR:
1. Notas con títulos: "Restricciones financieras", "Resguardos financieros", "Covenants de bonos", "Contingencias y restricciones", "Bonos y obligaciones"
2. Si no están explícitos, calcula desde los EEFF:
   - DFN = Pasivos financieros con costo - Efectivo y equivalentes
   - EBITDA = Resultado operacional + Depreciación y amortización
   - GFN = Costos financieros - Ingresos financieros
   - Patrimonio = Total patrimonio atribuible a controladores
   - Leverage = DF / Patrimonio
   - Cobertura = EBITDA / GFN
3. SOLO covenants de BONOS. Ignora créditos bancarios.
4. Para holgura: op="<=" → holgura = límite - actual. op=">=" → holgura = actual - límite.

Responde ÚNICAMENTE con JSON válido:
{
  "fechaEEFF": "mmm-aa",
  "encontrados": true,
  "resumen": "descripción de dónde se encontraron los datos",
  "covenants": [
    {
      "name": "nombre exacto",
      "tipo": "flujo o stock",
      "op": "<= o >=",
      "lim": 3.5,
      "limite": "3,50x",
      "actual": 1.23,
      "actualStr": "1,23x",
      "holgura": 0.45,
      "holguraStr": "0,45x",
      "encontrado": true,
      "nota": "fuente del dato"
    }
  ]
}`;

      const messageContent = res._smartText
        ? [{ type:"text", text: `Contenido del EEFF (páginas relevantes extraídas):\n\n${res._smartText}\n\n${prompt}` }]
        : [
            { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64PDF } },
            { type:"text", text: prompt }
          ];

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role:"user", content: messageContent }]
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Claude no pudo extraer los datos del PDF.");
      const extracted = JSON.parse(jsonMatch[0]);
      if (smartInfo) extracted._smartInfo = smartInfo;
      try { fs.unlinkSync(file.filepath); } catch {}
      return res.status(200).json(extracted);
    } catch (e) {
      try { fs.unlinkSync(file.filepath); } catch {}
      if (e.message?.includes("100 PDF pages") || e.message?.includes("too long") || e.message?.includes("tokens")) {
        return res.status(400).json({ error: "El PDF es demasiado extenso para el modo directo. Usa el modo inteligente (🧠) que extrae automáticamente las páginas relevantes." });
      }
      return res.status(500).json({ error: e.message });
    }
  });
}