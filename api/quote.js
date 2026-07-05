// Función serverless de Vercel.
// Precio actual e histórico de un instrumento vía Yahoo Finance (sin API key).
//
// Uso:
//   /api/quote?ticker=AAPL              -> precio actual
//   /api/quote?ticker=IWDA.L&range=1y   -> precio actual + histórico 1 año
//   /api/quote?ticker=EUNL.DE&range=6mo&history=1
//
// Formato de ticker = el de Yahoo Finance:
//   AAPL (EE.UU.), IWDA.L (Londres), EUNL.DE (Xetra), SAN.MC (Madrid)...
//   Búscalo en finance.yahoo.com si no lo conoces.
//
// Se llama desde el servidor (esta función), así que NO hay problema de CORS.

const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"];

export default async function handler(req, res) {
  const { ticker, range = "1y", history } = req.query;

  if (!ticker) {
    res.status(400).json({ error: "Falta el parámetro 'ticker'. Ej: /api/quote?ticker=AAPL" });
    return;
  }

  const symbol = String(ticker).trim().toUpperCase();
  const rng = RANGES.includes(range) ? range : "1y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rng}&interval=1d`;

  try {
    const r = await fetch(url, {
      headers: {
        // Yahoo rechaza peticiones sin un User-Agent de navegador.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!r.ok) throw new Error("Yahoo respondió " + r.status);

    const data = await r.json();
    const result = data?.chart?.result?.[0];

    if (!result || !result.meta) {
      res.status(404).json({ error: "Ticker no encontrado en Yahoo Finance", ticker: symbol });
      return;
    }

    const meta = result.meta;
    const precio = meta.regularMarketPrice;
    const previo = meta.chartPreviousClose ?? meta.previousClose ?? null;

    const respuesta = {
      ticker: symbol,
      nombre: meta.longName || meta.shortName || symbol,
      moneda: meta.currency || null,
      precio: typeof precio === "number" ? precio : null,
      cierreAnterior: previo,
      variacionPct: (typeof precio === "number" && typeof previo === "number" && previo !== 0)
        ? ((precio - previo) / previo) * 100
        : null,
      mercado: meta.exchangeName || null,
      fecha: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    };

    // Histórico opcional (solo si se pide con history=1), para no engordar la respuesta.
    if (history === "1" && Array.isArray(result.timestamp)) {
      const closes = result.indicators?.quote?.[0]?.close || [];
      respuesta.historico = result.timestamp
        .map((ts, i) => ({
          fecha: new Date(ts * 1000).toISOString().slice(0, 10),
          cierre: closes[i],
        }))
        .filter((p) => typeof p.cierre === "number");
    }

    // Cache 10 min en el edge de Vercel.
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json(respuesta);
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener la cotización", detail: String(err) });
  }
}
