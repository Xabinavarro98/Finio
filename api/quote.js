// Función serverless de Vercel.
// Ruta: /api/quote?ticker=IWDA.UK  (por ejemplo)
// Devuelve el último precio de cierre usando Stooq (CSV, sin API key).
//
// Stooq se consulta desde el servidor, así que NO hay problema de CORS aquí.
// Formato de ticker Stooq: minúsculas y sufijo de mercado, p.ej. "iwda.uk", "aapl.us".
// Este endpoint acepta el ticker tal cual y lo pasa en minúsculas.

export default async function handler(req, res) {
  const { ticker } = req.query;

  if (!ticker) {
    res.status(400).json({ error: "Falta el parámetro 'ticker'. Ej: /api/quote?ticker=aapl.us" });
    return;
  }

  const symbol = String(ticker).toLowerCase().trim();
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Stooq respondió " + r.status);
    const csv = await r.text();

    // csv: cabecera + una línea de datos.
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("Sin datos");

    const headers = lines[0].split(",");
    const values = lines[1].split(",");
    const row = {};
    headers.forEach((h, i) => { row[h.trim().toLowerCase()] = values[i]; });

    const close = parseFloat(row["close"]);
    if (!isFinite(close)) {
      res.status(404).json({ error: "Ticker no encontrado o sin cotización", ticker: symbol });
      return;
    }

    // Cache 10 min en el edge de Vercel para no saturar Stooq.
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({
      ticker: symbol,
      date: row["date"] || null,
      close,
      open: parseFloat(row["open"]) || null,
      high: parseFloat(row["high"]) || null,
      low: parseFloat(row["low"]) || null,
      volume: parseFloat(row["volume"]) || null,
    });
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener la cotización", detail: String(err) });
  }
}
