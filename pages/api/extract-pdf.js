import Anthropic from "@anthropic-ai/sdk";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_B64_CHARS = 25 * 1024 * 1024;

const KEYWORDS = [
  "resguardo","covenant","restriccion financiera","restricción financiera",
  "financial covenant","ratio de bonos","obligaciones financieras","covenants de bonos",
  "balance general","estado de situacion financiera","estado de situación financiera",
  "activos corrientes","pasivos corrientes","patrimonio neto","total patrimonio",
  "pasivos financieros","deuda financiera","efectivo y equivalentes",
  "estado de resultados","resultado operacional","ingresos de actividades",
  "ganancia bruta","ebitda","depreciacion","depreciación","amortizacion","amortización",
  "costos financieros","ingresos financieros","resultado antes",
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
  if (totalPages <= 80) return null;
  const pageScores = [];
  for (let p = 1; p <= totalPages; p++) {
    const pageData = await pdfParse(pdfBuffer, { max: p });
    const prevData = p > 1 ? await pdfParse(pdfBuffer, { max: p - 1 }) : { text: "" };
    const pageText = pageData.text.slice(prevData.text.length);
    pageScores.push({ page: p, score: scorePageText(pageText), text: pageText });
  }
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
      let smartText = null;

      if (smartMode) {
        try {
          const smart = await extractSmartPages(pdfBuffer);
          if (smart) {
            const combinedText = smart.selected.map(p => `--- Página ${p.page} ---\n${p.text}`).join("\n\n");
            smartInfo = { totalPages: smart.totalPages, selectedCount: smart.selectedCount };
            smartText = combinedText;
          }
        } catch(e) {
          console.error("Smart extraction failed:", e.message);
        }
      }

      if (!smartText && base64PDF.length > MAX_B64_CHARS) {
        base64PDF = base64PDF.substring(0, MAX_B64_CHARS);
      }

      const covenantList = covenants.map(c =>
        `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`
      ).join("\n");

      const extraList = calculateExtra.length > 0
        ? "\n\nADEMÁS calcula estos covenants adicionales:\n" +
          calculateExtra.map(c => `- "${c.name}" | tipo: ${c.tipo} | operador: ${c.op} | límite: ${c.lim}`).join("\n")
        : "";

      // IMPROVED PROMPT: always try to calculate, mark explicitly when not possible
      const detectInstructions = detectMode
        ? `TAREA: Este es un emisor NUEVO. Haz DOS cosas:
1. Detecta TODOS los covenants de bonos (resguardos financieros, restricciones, ratios exigidos).
2. Para CADA covenant detectado, SIEMPRE intenta calcular o encontrar el valor actual en el EEFF.
   - Primero busca si está calculado explícitamente en las notas de resguardos.
   - Si no, calcula tú mismo usando los estados financieros (balance + EERR).
   - Solo marca "no_calculado": true si definitivamente no hay datos suficientes en el documento.`
        : `TAREA: Para CADA covenant de la lista, SIEMPRE intenta calcular o encontrar el valor actual.
   - Primero busca si está calculado explícitamente en las notas de resguardos del PDF.
   - Si no aparece directamente, calcula tú mismo usando balance general + EERR.
   - Solo deja "actual": null si definitivamente no hay datos suficientes en el PDF.

Covenants a actualizar:
${covenantList}${extraList}`;

      const prompt = `Eres analista financiero senior experto en bonos corporativos chilenos y análisis de EEFF.
Se te entrega documentación financiera de "${issuerName}".
${smartInfo ? `(PDF de ${smartInfo.totalPages} páginas — se analizaron ${smartInfo.selectedCount} páginas relevantes)` : ""}

${detectInstructions}

INSTRUCCIONES DE CÁLCULO (usa estas fórmulas si el valor no está explícito):
- DFN (Deuda Financiera Neta) = Pasivos financieros con costo (corrientes + no corrientes) - Efectivo y equivalentes al efectivo
- EBITDA = Resultado operacional (EBIT) + Depreciación del período + Amortización del período
- GFN (Gastos Financieros Netos) = Costos financieros - Ingresos financieros
- Cobertura de GFN = EBITDA / GFN
- Leverage = Deuda Financiera Total / Patrimonio total atribuible a controladores
- DFN/EBITDA = DFN / EBITDA
- DFN/Patrimonio = DFN / Patrimonio
- Patrimonio = Total patrimonio atribuible a controladores (no incluir interés minoritario)

DÓNDE BUSCAR:
1. Notas tituladas: "Restricciones financieras", "Resguardos financieros", "Covenants", "Contingencias"
2. Estado de Situación Financiera (Balance) → para activos, pasivos, patrimonio, deuda financiera
3. Estado de Resultados → para ingresos, costos, resultado operacional, gastos financieros
4. Notas de depreciación/amortización → para calcular EBITDA
5. IMPORTANTE: Usa los valores del período más reciente del EEFF (no comparativos)

REGLAS:
- SOLO covenants de BONOS. Ignora líneas de crédito bancario.
- Si encuentras el valor directamente en las notas de resguardos, úsalo tal como está.
- Si lo calculas tú mismo, indica en "nota" qué cifras usaste y dónde las encontraste.
- Si NO puedes calcular (falta información), pon "actual": null, "no_calculado": true, "razon_no_calculado": "descripción específica de qué dato falta".
- Redondea a 2 decimales.
- Formato numérico chileno: usa punto para miles y coma para decimales.

Responde ÚNICAMENTE con JSON válido (sin texto adicional):
{
  "fechaEEFF": "mmm-aa",
  "encontrados": true,
  "resumen": "descripción breve de qué se encontró y qué se calculó",
  "covenants": [
    {
      "name": "nombre exacto del covenant",
      "tipo": "flujo o stock",
      "op": "<= o >=",
      "lim": 3.5,
      "limite": "3,50 x",
      "actual": 1.23,
      "actualStr": "1,23 x",
      "holgura": 2.27,
      "holguraStr": "2,27 x",
      "encontrado": true,
      "nota": "encontrado directamente en nota de resguardos / calculado: EBITDA=X, GFN=Y de pág Z",
      "no_calculado": false,
      "razon_no_calculado": null
    },
    {
      "name": "covenant sin datos",
      "tipo": "flujo",
      "op": ">=",
      "lim": 2.0,
      "limite": "2,00 x",
      "actual": null,
      "actualStr": null,
      "holgura": null,
      "holguraStr": null,
      "encontrado": false,
      "nota": null,
      "no_calculado": true,
      "razon_no_calculado": "No se encontró el estado de resultados ni las notas de gastos financieros en el PDF"
    }
  ]
}`;

      const messageContent = smartText
        ? [{ type:"text", text: `Contenido del EEFF (páginas relevantes extraídas):\n\n${smartText}\n\n${prompt}` }]
        : [
            { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64PDF } },
            { type:"text", text: prompt }
          ];

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
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
