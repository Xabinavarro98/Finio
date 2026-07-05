import React from "react";


/* ============================================================
   PATRIMONIO · Gestión de cartera
   Estética heredada del diseño Stitch: terminal oscura,
   acento dorado, Inter (texto) + JetBrains Mono (datos).
   Estado en memoria (useReducer). Sin backend.
   ============================================================ */

// ---- Paleta (estética clara, acento verde oliva) ----
const C = {
  bg: "#ffffff",
  surface: "#ffffff",
  panel: "#f3f3f3",
  panelLow: "#f9f9f9",
  panelHigh: "#f3f3f3",
  line: "#dadada",
  lineSoft: "#e5e7eb",
  ink: "#000000",
  dim: "#6b7280",
  faint: "#9ca3af",
  gold: "#203B2A",       // acento principal (verde oliva oscuro)
  goldDim: "#203B2A",
  goldSoft: "#2d5540",
  green: "#16a34a",
  red: "#dc2626",
  blue: "#2563eb",
};

// Paleta rotatoria para el donut (empieza por el verde de marca)
const SLICE = ["#203B2A", "#93c5fd", "#d4b483", "#2d5540", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

const eur = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "€";
const eur0 = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("es-ES", { maximumFractionDigits: 0 }) + "€";
const pct = (n, d = 1) => (isFinite(n) ? n : 0).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";

// Convierte texto con coma o punto a número. "" o inválido -> 0.
const numOf = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
};

const META_OBJETIVO_DEFAULT = 1000000;

const FRASES = [
  "El interés compuesto es la octava maravilla del mundo.",
  "No cronometres el mercado; da tiempo al mercado.",
  "Compra empresas, no cotizaciones.",
  "El riesgo viene de no saber lo que haces.",
  "La paciencia es la mayor virtud del inversor.",
  "Invierte a largo plazo; el corto plazo es ruido.",
  "Sé temeroso cuando otros son codiciosos, y codicioso cuando otros son temerosos.",
  "Ahorrar es la base; invertir es el motor.",
  "Un plan mediocre seguido con disciplina bate a un plan brillante abandonado.",
  "Tu tasa de ahorro importa más que tu rentabilidad al principio.",
];

// ---- Semilla: cartera real de julio 2026 (del Excel) ----
// invertido = cantidad aportada; rentabilidad en %; valorActual se calcula.
let _id = 0;
const nid = () => "a" + ++_id;
const seed = [];

// ---- Reducer ----
function reducer(state, action) {
  switch (action.type) {
    case "add":
      return [...state, { id: nid(), ...action.asset }];
    case "update":
      return state.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a));
    case "remove":
      return state.filter((a) => a.id !== action.id);
    default:
      return state;
  }
}

// Rentabilidad efectiva, con tres modos según los datos del activo:
//  1) Ticker: si hay ticker + precioCompra + precioActual, compara precios de mercado.
//  2) Valor actual: si hay valorHoy > 0, compara valorHoy contra invertido (Mintos, cuentas...).
//  3) Manual: en cualquier otro caso, usa el % que se haya puesto a mano.
const rentEfectiva = (a) => {
  if (a.ticker && a.precioCompra > 0 && typeof a.precioActual === "number" && a.precioActual > 0) {
    return ((a.precioActual - a.precioCompra) / a.precioCompra) * 100;
  }
  if (typeof a.valorHoy === "number" && a.valorHoy > 0 && a.invertido > 0) {
    return ((a.valorHoy - a.invertido) / a.invertido) * 100;
  }
  return a.rentabilidad || 0;
};

const valorActual = (a) => a.invertido * (1 + rentEfectiva(a) / 100);

// ---- Iconos mínimos (Material Symbols vía font si está; fallback texto) ----
const Icon = ({ name, style, size = 20 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>
);

// ============================================================
//  APP
// ============================================================
export default function App() {
  const [assets, dispatch] = React.useReducer(reducer, seed, loadInitial);
  const [view, setView] = React.useState("dashboard"); // dashboard | posiciones | add
  const [meta, setMeta] = React.useState(loadMeta);
  React.useEffect(() => { try { localStorage.setItem(META_KEY, String(meta)); } catch (e) {} }, [meta]);

  const [actualizando, setActualizando] = React.useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = React.useState(null);

  // Recorre los activos con ticker y actualiza su precioActual desde /api/quote.
  const actualizarPrecios = async () => {
    const conTicker = assets.filter((a) => a.ticker && a.ticker.trim());
    if (conTicker.length === 0) {
      alert("Ningún activo tiene ticker. Edita un activo y añade su ticker de Yahoo (ej: AAPL, IWDA.L, EUNL.DE).");
      return;
    }
    setActualizando(true);
    let ok = 0, fallos = [];
    for (const a of conTicker) {
      try {
        const r = await fetch(`/api/quote?ticker=${encodeURIComponent(a.ticker.trim())}`);
        const data = await r.json();
        if (data && typeof data.precio === "number") {
          dispatch({ type: "update", id: a.id, patch: { precioActual: data.precio, tickerNombre: data.nombre, tickerMoneda: data.moneda } });
          ok++;
        } else {
          fallos.push(a.ticker);
        }
      } catch (e) {
        fallos.push(a.ticker);
      }
    }
    setActualizando(false);
    setUltimaActualizacion(new Date());
    if (fallos.length > 0) {
      alert(`Actualizados ${ok}. No se encontraron: ${fallos.join(", ")}. Revisa que el ticker sea el de Yahoo Finance.`);
    }
  };
  React.useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(assets)); } catch (e) {} }, [assets]);

  // Tipos y plataformas crecen solos
  const tipos = React.useMemo(() => [...new Set(assets.map((a) => a.tipo).filter(Boolean))], [assets]);
  const plataformas = React.useMemo(() => [...new Set(assets.map((a) => a.plataforma).filter(Boolean))], [assets]);

  // ---- KPIs reales ----
  const kpi = React.useMemo(() => {
    const invertido = assets.reduce((s, a) => s + a.invertido, 0);
    const total = assets.reduce((s, a) => s + valorActual(a), 0);
    const beneficio = total - invertido;
    const rentMediaPond = invertido > 0
      ? assets.reduce((s, a) => s + a.invertido * rentEfectiva(a), 0) / invertido
      : 0;

    // Mejor y peor activo por rentabilidad efectiva
    let mejor = null, peor = null;
    assets.forEach((a) => {
      const r = rentEfectiva(a);
      if (!mejor || r > mejor.r) mejor = { nombre: a.nombre, r };
      if (!peor || r < peor.r) peor = { nombre: a.nombre, r };
    });

    // Exposición a renta variable (por valor actual). Detecta el tipo que contenga "variable".
    const esRV = (a) => /variable|equity|acci/i.test(a.tipo || "");
    const valorRV = assets.filter(esRV).reduce((s, a) => s + valorActual(a), 0);
    const pctRV = total > 0 ? (valorRV / total) * 100 : 0;

    return { invertido, total, beneficio, rentMediaPond, mejor, peor, pctRV };
  }, [assets]);

  // ---- Distribución por tipo (sobre valor actual) ----
  const distrib = React.useMemo(() => {
    const by = {};
    assets.forEach((a) => { by[a.tipo] = (by[a.tipo] || 0) + valorActual(a); });
    const total = Object.values(by).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(by)
      .map(([tipo, val], i) => ({ tipo, val, share: (val / total) * 100, color: SLICE[i % SLICE.length] }))
      .sort((a, b) => b.val - a.val);
  }, [assets]);

  // ---- Distribución por plataforma (sobre valor actual) ----
  const distribPlat = React.useMemo(() => {
    const by = {};
    assets.forEach((a) => { by[a.plataforma] = (by[a.plataforma] || 0) + valorActual(a); });
    const total = Object.values(by).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(by)
      .map(([tipo, val], i) => ({ tipo, val, share: (val / total) * 100, color: SLICE[i % SLICE.length] }))
      .sort((a, b) => b.val - a.val);
  }, [assets]);

  const progreso = Math.min((kpi.total / meta) * 100, 100);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Hanken Grotesk', sans-serif", paddingBottom: 96 }}>
      <FontLinks />
      <TopBar />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 16px 32px" }}>
        {view === "dashboard" && <Dashboard kpi={kpi} distrib={distrib} distribPlat={distribPlat} progreso={progreso} nPos={assets.length} meta={meta} setMeta={setMeta} onExport={() => exportJSON(assets)} onImport={() => importJSON(dispatch)} onAdd={() => setView("add")} onActualizar={actualizarPrecios} actualizando={actualizando} ultimaActualizacion={ultimaActualizacion} />}
        {view === "posiciones" && <Posiciones assets={assets} dispatch={dispatch} onAdd={() => setView("add")} />}
        {view === "add" && <AddAsset tipos={tipos} plataformas={plataformas} onSave={(asset) => { dispatch({ type: "add", asset }); setView("posiciones"); }} onCancel={() => setView("posiciones")} />}
      </main>
      <BottomNav view={view} setView={setView} />
    </div>
  );
}

// ---- Fuentes (Material Symbols + tipografías) ----
function FontLinks() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
    </>
  );
}

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const capsLabel = { fontSize: 11, letterSpacing: "0.05em", fontWeight: 700, textTransform: "uppercase", color: C.dim };
const panelStyle = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12 };

function TopBar() {
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, height: 64, zIndex: 50, background: C.surface, borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="menu" style={{ color: C.gold }} />
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: C.gold }}>PATRIMONIO</span>
      </div>
      <Icon name="notifications" style={{ color: C.gold }} />
    </nav>
  );
}

// ============================================================
//  DASHBOARD
// ============================================================
function Dashboard({ kpi, distrib, distribPlat, progreso, nPos, meta, setMeta, onExport, onImport, onAdd, onActualizar, actualizando, ultimaActualizacion }) {
  const positivo = kpi.beneficio >= 0;
  const vacio = nPos === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {vacio && (
        <div style={{ ...panelStyle, padding: 24, borderLeft: `4px solid ${C.gold}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Icon name="rocket_launch" size={28} style={{ color: C.gold }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontWeight: 600, color: C.ink }}>Tu cartera está vacía</p>
            <p style={{ margin: "4px 0 0", color: C.dim, fontSize: 14 }}>Pulsa “Nuevo activo” para registrar tu primera posición. Todo se calcula solo a partir de lo que introduzcas.</p>
          </div>
          <BtnGold icon="add" onClick={onAdd}>Nuevo activo</BtnGold>
        </div>
      )}
      {/* Hero */}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ ...capsLabel, marginBottom: 8 }}>Patrimonio total</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: C.gold, margin: 0 }}>{eur(kpi.total)}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: positivo ? C.green : C.red }}>
              <Icon name={positivo ? "trending_up" : "trending_down"} size={18} />
              <span style={{ ...mono, fontSize: 16 }}>{pct(kpi.invertido > 0 ? (kpi.beneficio / kpi.invertido) * 100 : 0)}</span>
              <span style={{ ...capsLabel, marginLeft: 8, color: C.faint }}>total</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BtnGhost icon={actualizando ? "hourglass_empty" : "refresh"} onClick={actualizando ? undefined : onActualizar}>{actualizando ? "Actualizando…" : "Actualizar precios"}</BtnGhost>
          <BtnGhost icon="upload" onClick={onImport}>Importar</BtnGhost>
          <BtnGhost icon="download" onClick={onExport}>Exportar</BtnGhost>
          <BtnGold icon="add" onClick={onAdd}>Nuevo activo</BtnGold>
        </div>
      </header>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Kpi label="Invertido" icon="account_balance_wallet" value={eur0(kpi.invertido)} sub="Capital aportado" />
        <Kpi label="Beneficio" icon={positivo ? "trending_up" : "trending_down"} value={(positivo ? "+" : "") + eur0(kpi.beneficio)} sub="Latente" color={positivo ? C.green : C.red} />
        <Kpi label="Rent. media ponderada" icon="query_stats" value={pct(kpi.rentMediaPond, 2)} sub="" color={kpi.rentMediaPond >= 0 ? C.green : C.red} />
        <Kpi label="Nº posiciones" icon="stacks" value={String(nPos)} sub="Activos abiertos" />
      </div>

      {/* KPIs adicionales */}
      {nPos > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <Kpi label="Mejor activo" icon="trophy" value={kpi.mejor ? pct(kpi.mejor.r, 2) : "—"} sub={kpi.mejor ? kpi.mejor.nombre : ""} color={C.green} />
          <Kpi label="Peor activo" icon="trending_down" value={kpi.peor ? pct(kpi.peor.r, 2) : "—"} sub={kpi.peor ? kpi.peor.nombre : ""} color={kpi.peor && kpi.peor.r < 0 ? C.red : C.dim} />
          <Kpi label="Exposición renta variable" icon="show_chart" value={pct(kpi.pctRV)} sub="del patrimonio total" color={C.blue} />
        </div>
      )}

      {/* Distribución + Objetivo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        <DistribucionPanel distrib={distrib} distribPlat={distribPlat} />

        <ObjetivoPanel kpi={kpi} progreso={progreso} meta={meta} setMeta={setMeta} />
      </div>
    </div>
  );
}

// ---- Panel de distribución con toggle tipo/plataforma ----
function DistribucionPanel({ distrib, distribPlat }) {
  const [modo, setModo] = React.useState("tipo");
  const datos = modo === "tipo" ? distrib : distribPlat;
  return (
    <div style={{ ...panelStyle, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 24px", borderBottom: `1px solid ${C.lineSoft}`, paddingBottom: 16 }}>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: C.gold, margin: 0 }}>Distribución</h3>
        <div style={{ display: "flex", background: C.panelLow, padding: 4, borderRadius: 8, border: `1px solid ${C.lineSoft}` }}>
          {["tipo", "plataforma"].map((m) => (
            <button key={m} onClick={() => setModo(m)}
              style={{ padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", textTransform: "capitalize",
                background: modo === m ? C.gold : "transparent", color: modo === m ? "#fff" : C.dim }}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <Donut distrib={datos} />
    </div>
  );
}

// ---- Panel de objetivo editable + frase motivadora ----
function ObjetivoPanel({ kpi, progreso, meta, setMeta }) {
  const [editando, setEditando] = React.useState(false);
  const [valor, setValor] = React.useState(String(meta));
  const [frase] = React.useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);

  const guardar = () => {
    const n = parseFloat(String(valor).replace(/\./g, "").replace(",", "."));
    if (isFinite(n) && n > 0) setMeta(n);
    setEditando(false);
  };

  return (
    <div style={{ ...panelStyle, padding: 24, borderLeft: `4px solid ${C.gold}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ flex: "1 1 240px" }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: C.gold, margin: 0 }}>Objetivo independencia</h3>
          <p style={{ color: C.dim, margin: "4px 0 0" }}>Meta: {eur0(meta)} (retirada 4% SWR)</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 240, flex: "1 1 240px" }}>
          <span style={{ ...mono, fontSize: 24, color: C.gold }}>{pct(progreso)}</span>
          <div style={{ width: "100%", height: 8, background: C.lineSoft, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progreso}%`, background: C.gold, transition: "width .8s" }} />
          </div>
          <span style={{ ...capsLabel, color: C.faint }}>Faltan: {eur0(Math.max(meta - kpi.total, 0))}</span>
        </div>
      </div>

      {/* Botón editar / edición inline */}
      {editando ? (
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
            style={{ ...inp, ...mono, maxWidth: 220, padding: 10 }} placeholder="Nueva meta (€)" />
          <button onClick={guardar} style={{ background: C.gold, color: "#fff", border: "none", borderRadius: 6, padding: "10px 18px", cursor: "pointer", fontWeight: 700, ...capsLabel }}>Guardar meta</button>
          <button onClick={() => { setValor(String(meta)); setEditando(false); }} style={{ ...miniBtn, flex: "0 0 auto", padding: "10px 16px" }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setEditando(true)} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", color: C.gold, ...capsLabel }}>
          <Icon name="edit" size={16} /> Editar objetivo
        </button>
      )}

      {/* Frase motivadora */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.lineSoft}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name="format_quote" size={20} style={{ color: C.gold, flexShrink: 0 }} />
        <p style={{ margin: 0, fontStyle: "italic", color: C.dim, fontSize: 14 }}>{frase}</p>
      </div>
    </div>
  );
}

function Kpi({ label, icon, value, sub, color, hideRaw }) {
  return (
    <div style={{ ...panelStyle, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={capsLabel}>{label}</span>
        <Icon name={icon} size={20} style={{ color: color || C.gold }} />
      </div>
      <p style={{ ...mono, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: color || C.ink }}>{value}</p>
      <div style={{ marginTop: 8, color: C.dim, fontSize: 12 }}>{sub}</div>
    </div>
  );
}

// ---- Donut SVG dinámico ----
function Donut({ distrib }) {
  const R = 15.9155, CIRC = 2 * Math.PI * R;
  const [hover, setHover] = React.useState(null); // índice del segmento resaltado
  let offset = 0;
  const activo = hover != null ? distrib[hover] : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 192, height: 192 }}>
        <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          {distrib.map((d, i) => {
            const len = (d.share / 100) * CIRC;
            const atenuado = hover != null && hover !== i;
            const seg = (
              <circle key={i} cx="18" cy="18" r={R} fill="none" stroke={d.color}
                strokeWidth={hover === i ? 5 : 4}
                strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-offset}
                style={{ opacity: atenuado ? 0.35 : 1, transition: "opacity .15s, stroke-width .15s", cursor: "pointer" }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", padding: 24, textAlign: "center" }}>
          {activo ? (
            <>
              <span style={{ ...mono, fontSize: 13, color: C.ink }}>{activo.tipo}</span>
              <span style={{ ...mono, fontSize: 20, color: C.gold }}>{pct(activo.share)}</span>
              <span style={{ ...mono, fontSize: 11, color: C.faint }}>{eur0(activo.val)}</span>
            </>
          ) : (
            <>
              <span style={{ ...mono, fontSize: 16 }}>{distrib.length} {distrib.length === 1 ? "tipo" : "tipos"}</span>
              <span style={{ ...mono, fontSize: 24, color: C.gold }}>100%</span>
            </>
          )}
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        {distrib.map((d, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", opacity: hover != null && hover !== i ? 0.5 : 1, transition: "opacity .15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, background: d.color, flexShrink: 0 }} />
              <span style={{ color: C.ink }}>{d.tipo}</span>
            </div>
            <span style={{ ...mono, fontSize: 14 }}>{pct(d.share)} · {eur0(d.val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  POSICIONES
// ============================================================
function Posiciones({ assets, dispatch, onAdd }) {
  const [group, setGroup] = React.useState("tipo"); // tipo | plataforma
  const [q, setQ] = React.useState("");
  const [openGroups, setOpenGroups] = React.useState({});

  const filtered = assets.filter((a) => {
    const s = (a.nombre + " " + a.tipo + " " + a.plataforma).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  const groups = {};
  filtered.forEach((a) => {
    const k = group === "tipo" ? a.tipo : a.plataforma;
    (groups[k] = groups[k] || []).push(a);
  });

  const toggle = (k) => setOpenGroups((o) => ({ ...o, [k]: o[k] === false ? true : false }));
  const isOpen = (k) => openGroups[k] !== false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Buscador */}
      <div style={{ position: "relative" }}>
        <Icon name="search" size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar activo, plataforma…"
          style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 16px 12px 48px", color: C.ink, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16 }} />
      </div>

      {/* Agrupar por */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={capsLabel}>Agrupar por</span>
        <div style={{ display: "flex", background: C.panelLow, padding: 4, borderRadius: 8, border: `1px solid ${C.lineSoft}` }}>
          {["tipo", "plataforma"].map((g) => (
            <button key={g} onClick={() => setGroup(g)}
              style={{ padding: "6px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", textTransform: "capitalize",
                background: group === g ? C.gold : "transparent", color: group === g ? "#fff" : C.dim }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Grupos */}
      {Object.entries(groups).map(([k, items]) => {
        const subtotal = items.reduce((s, a) => s + valorActual(a), 0);
        return (
          <div key={k}>
            <button onClick={() => toggle(k)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.line}`, background: "none", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", cursor: "pointer", color: C.gold }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="expand_more" style={{ color: C.gold, transform: isOpen(k) ? "none" : "rotate(-90deg)", transition: "transform .2s" }} />
                <span style={{ ...capsLabel, color: C.gold, letterSpacing: "0.1em" }}>{k} ({items.length})</span>
              </div>
              <span style={{ ...mono, fontSize: 12, color: C.dim }}>{eur(subtotal)}</span>
            </button>
            {isOpen(k) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {items.map((a) => <AssetCard key={a.id} a={a} dispatch={dispatch} />)}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ ...panelStyle, padding: 40, textAlign: "center", color: C.faint }}>
          Sin resultados. Prueba otro término o añade un activo nuevo.
        </div>
      )}

      <button onClick={onAdd} style={{ position: "fixed", bottom: 96, right: 24, width: 56, height: 56, borderRadius: 999, background: C.gold, color: "#412d00", border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
        <Icon name="add" size={28} />
      </button>
    </div>
  );
}

function AssetCard({ a, dispatch }) {
  const [edit, setEdit] = React.useState(false);
  const va = valorActual(a);
  const rent = rentEfectiva(a);
  const positivo = rent >= 0;
  const autoTicker = a.ticker && a.precioCompra > 0;
  return (
    <div style={{ ...panelStyle, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre}{a.esTactico && <span style={{ ...capsLabel, color: C.blue, marginLeft: 8 }}>táctico</span>}</span>
          <span style={{ fontSize: 12, color: C.dim }}>{a.plataforma} · {a.tipo}{a.ticker ? <span style={mono}> · {a.ticker}</span> : ""}</span>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <span style={{ ...mono, fontSize: 20, fontWeight: 600 }}>{eur(va)}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            <span style={{ ...mono, fontSize: 12, color: positivo ? C.green : C.red, display: "flex", alignItems: "center" }}>
              {pct(rent, 2)} <Icon name={positivo ? "arrow_upward" : "arrow_downward"} size={14} />
            </span>
            <span style={{ ...mono, fontSize: 10, color: C.faint }}>inv {eur0(a.invertido)}</span>
          </div>
          {autoTicker && typeof a.precioActual === "number" && (
            <span style={{ ...mono, fontSize: 10, color: C.gold, marginTop: 2 }}>
              {a.precioActual.toFixed(2)}{a.tickerMoneda ? " " + a.tickerMoneda : ""} · compra {a.precioCompra}
            </span>
          )}
          {autoTicker && typeof a.precioActual !== "number" && (
            <span style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>sin actualizar</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => setEdit((e) => !e)} style={miniBtn}>{edit ? "Cerrar" : "Editar"}</button>
        <button onClick={() => dispatch({ type: "remove", id: a.id })} style={{ ...miniBtn, color: C.red, borderColor: "rgba(255,180,171,.3)" }}>Eliminar</button>
      </div>
      {edit && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MiniField label="Invertido (€)" value={a.invertido} onChange={(v) => dispatch({ type: "update", id: a.id, patch: { invertido: v } })} />
            <MiniField label="Rentabilidad (%)" value={a.rentabilidad} onChange={(v) => dispatch({ type: "update", id: a.id, patch: { rentabilidad: v } })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "block" }}>
              <span style={{ ...capsLabel, display: "block", marginBottom: 4 }}>Ticker (Yahoo)</span>
              <input value={a.ticker || ""} onChange={(e) => dispatch({ type: "update", id: a.id, patch: { ticker: e.target.value.toUpperCase() } })}
                placeholder="Ej: IWDA.L" style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8, color: C.ink, ...mono }} />
            </label>
            <MiniField label="Precio compra" value={a.precioCompra || 0} onChange={(v) => dispatch({ type: "update", id: a.id, patch: { precioCompra: v } })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MiniField label="Valor hoy (€)" value={a.valorHoy || 0} onChange={(v) => dispatch({ type: "update", id: a.id, patch: { valorHoy: v } })} />
            <div />
          </div>
          <p style={{ margin: 0, fontSize: 11, color: C.faint }}>
            “Valor hoy” es para Mintos, cuentas remuneradas, etc.: pon lo que tienes ahora mismo y la rentabilidad sale sola (sin ticker).
          </p>
          {autoTicker && (
            <p style={{ margin: 0, fontSize: 11, color: C.faint }}>
              Con ticker y precio de compra, la rentabilidad se calcula sola al actualizar precios (ignora el campo manual de arriba).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const miniBtn = { flex: 1, padding: "6px 10px", fontSize: 12, background: C.panelHigh, border: `1px solid ${C.line}`, borderRadius: 6, color: C.dim, cursor: "pointer", fontFamily: "'Hanken Grotesk', sans-serif" };

// Input numérico robusto: guarda el texto mientras escribes (permite ".", "," y vacío),
// y solo emite el número al padre cuando cambia. Evita el "0" fantasma y el borrado al teclear ".".
function MiniField({ label, value, onChange }) {
  const [txt, setTxt] = React.useState(value === 0 || value == null ? "" : String(value));
  React.useEffect(() => {
    // Sincroniza si el valor externo cambia (ej: actualización de precios) y no coincide.
    const externo = value === 0 || value == null ? "" : String(value);
    if (numOf(txt) !== numOf(externo)) setTxt(externo);
    // eslint-disable-next-line
  }, [value]);
  const handle = (e) => {
    let v = e.target.value;
    // Permite dígitos, un separador decimal (coma o punto) y signo negativo.
    if (/^-?\d*[.,]?\d*$/.test(v) || v === "") {
      setTxt(v);
      onChange(numOf(v));
    }
  };
  return (
    <label style={{ display: "block" }}>
      <span style={{ ...capsLabel, display: "block", marginBottom: 4 }}>{label}</span>
      <input type="text" inputMode="decimal" value={txt} onChange={handle}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8, color: C.ink, ...mono }} />
    </label>
  );
}

// ============================================================
//  AÑADIR ACTIVO
// ============================================================
function AddAsset({ tipos, plataformas, onSave, onCancel }) {
  const [f, setF] = React.useState({ nombre: "", tipo: tipos[0] || "", plataforma: plataformas[0] || "", invertido: "", rentabilidad: "", ticker: "", precioCompra: "", valorHoy: "", fechaEntrada: "", esTactico: false, faseSoros: "", notas: "" });
  const [nuevoTipo, setNuevoTipo] = React.useState(false);
  const [nuevaPlat, setNuevaPlat] = React.useState(false);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  // Para campos numéricos: acepta dígitos, coma o punto, y vacío. Guarda el texto tal cual.
  const setNum = (k, v) => {
    if (/^-?\d*[.,]?\d*$/.test(v) || v === "") setF((o) => ({ ...o, [k]: v }));
  };

  const valido = f.nombre.trim() && f.tipo.trim() && f.invertido !== "";

  const guardar = () => {
    if (!valido) return;
    onSave({
      nombre: f.nombre.trim(),
      tipo: f.tipo.trim(),
      plataforma: f.plataforma.trim() || "-",
      invertido: numOf(f.invertido),
      rentabilidad: numOf(f.rentabilidad),
      ticker: f.ticker.trim(),
      precioCompra: numOf(f.precioCompra),
      precioActual: null,
      valorHoy: numOf(f.valorHoy),
      fechaEntrada: f.fechaEntrada,
      esTactico: f.esTactico,
      faseSoros: f.faseSoros,
      notas: f.notas,
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <Icon name="add_circle" style={{ color: C.gold }} /> Añadir activo
        </h2>
        <p style={{ ...capsLabel, marginTop: 8, letterSpacing: "0.1em", fontSize: 10 }}>Registro de nueva posición</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* General */}
        <Section icon="info" title="Información general">
          <Field label="Nombre del activo">
            <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: MSCI World" style={inp} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Tipo">
              {(nuevoTipo || tipos.length === 0) ? (
                <input autoFocus value={f.tipo} onChange={(e) => set("tipo", e.target.value)} placeholder="Ej: Renta variable" style={inp} />
              ) : (
                <select value={f.tipo} onChange={(e) => { e.target.value === "__new" ? (setNuevoTipo(true), set("tipo", "")) : set("tipo", e.target.value); }} style={inp}>
                  {tipos.map((t) => <option key={t}>{t}</option>)}
                  <option value="__new" style={{ color: C.gold }}>+ Crear nuevo…</option>
                </select>
              )}
            </Field>
            <Field label="Plataforma">
              {(nuevaPlat || plataformas.length === 0) ? (
                <input autoFocus value={f.plataforma} onChange={(e) => set("plataforma", e.target.value)} placeholder="Ej: MyInvestor" style={inp} />
              ) : (
                <select value={f.plataforma} onChange={(e) => { e.target.value === "__new" ? (setNuevaPlat(true), set("plataforma", "")) : set("plataforma", e.target.value); }} style={inp}>
                  {plataformas.map((p) => <option key={p}>{p}</option>)}
                  <option value="__new" style={{ color: C.gold }}>+ Crear nueva…</option>
                </select>
              )}
            </Field>
          </div>
        </Section>

        {/* Financieros */}
        <Section icon="payments" title="Datos financieros">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Importe invertido (€)">
              <input type="text" inputMode="decimal" value={f.invertido} onChange={(e) => setNum("invertido", e.target.value)} placeholder="0,00" style={{ ...inp, ...mono }} />
            </Field>
            <Field label="Rentabilidad (%) — manual">
              <input type="text" inputMode="decimal" value={f.rentabilidad} onChange={(e) => setNum("rentabilidad", e.target.value)} placeholder="Ej: 10,7" style={{ ...inp, ...mono, opacity: (f.ticker.trim() || f.valorHoy) ? 0.5 : 1 }} disabled={!!(f.ticker.trim() || f.valorHoy)} />
            </Field>
          </div>
          {f.invertido !== "" && (
            <div style={{ ...capsLabel, color: C.faint, marginTop: 4 }}>
              Valor actual estimado: {eur(numOf(f.invertido) * (1 + numOf(f.rentabilidad) / 100))}
            </div>
          )}

          {/* Modo valor actual (Mintos, cuentas remuneradas...) */}
          <div style={{ marginTop: 8, padding: 14, background: C.panelLow, border: `1px dashed ${C.line}`, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Icon name="savings" size={16} style={{ color: C.gold }} />
              <span style={{ ...capsLabel, color: C.gold }}>Seguimiento por valor actual (opcional)</span>
            </div>
            <Field label="Valor hoy (€)">
              <input type="text" inputMode="decimal" value={f.valorHoy} onChange={(e) => setNum("valorHoy", e.target.value)} placeholder="Lo que tienes ahora mismo" style={{ ...inp, ...mono }} />
            </Field>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: C.faint }}>
              Para Mintos, cuentas remuneradas, etc.: pon lo invertido arriba y aquí lo que tienes hoy. La rentabilidad se calcula sola.
            </p>
          </div>

          {/* Seguimiento automático por ticker (opcional) */}
          <div style={{ marginTop: 8, padding: 14, background: C.panelLow, border: `1px dashed ${C.line}`, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Icon name="sync" size={16} style={{ color: C.gold }} />
              <span style={{ ...capsLabel, color: C.gold }}>Seguimiento automático por ticker (opcional)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Ticker (Yahoo Finance)">
                <input value={f.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} placeholder="Ej: AAPL, IE00BYX5NX33.SG" style={{ ...inp, ...mono }} />
              </Field>
              <Field label="Precio de compra">
                <input type="text" inputMode="decimal" value={f.precioCompra} onChange={(e) => setNum("precioCompra", e.target.value)} placeholder="0,00" style={{ ...inp, ...mono }} />
              </Field>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: C.faint }}>
              Si rellenas ticker y precio de compra, la rentabilidad se calcula sola al pulsar “Actualizar precios”.
            </p>
          </div>

          <Field label="Fecha de entrada">
            <input type="date" value={f.fechaEntrada} onChange={(e) => set("fechaEntrada", e.target.value)} style={{ ...inp, ...mono }} />
          </Field>
        </Section>

        {/* Estrategia */}
        <Section icon="monitoring" title="Estrategia y seguimiento">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, padding: 16, borderRadius: 8, border: `1px solid ${C.lineSoft}` }}>
            <div>
              <p style={{ margin: 0, color: C.ink }}>Seguimiento táctico</p>
              <p style={{ ...capsLabel, margin: "2px 0 0", fontSize: 10 }}>Marca posiciones de rotación/temáticas</p>
            </div>
            <Toggle on={f.esTactico} onClick={() => set("esTactico", !f.esTactico)} />
          </div>
          {f.esTactico && (
            <Field label="Fase (Soros)">
              <input value={f.faseSoros} onChange={(e) => set("faseSoros", e.target.value)} placeholder="Ej: reflexividad temprana" style={inp} />
            </Field>
          )}
          <Field label="Notas estratégicas">
            <textarea rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Tesis, horizonte, stop-loss…" style={{ ...inp, resize: "none" }} />
          </Field>
        </Section>

        <div style={{ display: "flex", gap: 12, paddingBottom: 24 }}>
          <button onClick={onCancel} style={{ ...miniBtn, flex: "0 0 auto", padding: "16px 24px", fontSize: 16 }}>Cancelar</button>
          <button onClick={guardar} disabled={!valido}
            style={{ flex: 1, background: valido ? C.goldDim : C.lineSoft, color: valido ? "#ffffff" : C.faint, fontSize: 20, fontWeight: 600, padding: 20, borderRadius: 12, border: "none", cursor: valido ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Icon name="save" /> Guardar activo
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <section style={{ ...panelStyle, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, borderBottom: `1px solid ${C.lineSoft}`, paddingBottom: 8 }}>
        <Icon name={icon} size={16} style={{ color: C.gold }} />
        <h3 style={capsLabel}>{title}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ ...capsLabel, display: "block", marginBottom: 8 }}>{label}</span>
      {children}
    </label>
  );
}

const inp = { width: "100%", background: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 8, padding: 16, color: C.ink, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16, boxSizing: "border-box" };

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: on ? C.gold : C.lineSoft, position: "relative", transition: ".2s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: ".2s" }} />
    </button>
  );
}

// ---- Botones hero ----
function BtnGhost({ icon, children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: C.panelHigh, border: `1px solid ${C.lineSoft}`, padding: "7px 16px", borderRadius: 6, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, ...capsLabel }}>
      <Icon name={icon} size={16} /> {children}
    </button>
  );
}
function BtnGold({ icon, children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: C.goldDim, color: "#ffffff", padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, ...capsLabel }}>
      <Icon name={icon} size={16} /> {children}
    </button>
  );
}

// ---- Bottom nav ----
function BottomNav({ view, setView }) {
  const items = [
    { id: "dashboard", icon: "dashboard", label: "Inicio" },
    { id: "posiciones", icon: "account_balance_wallet", label: "Posiciones" },
    { id: "add", icon: "add_chart", label: "Añadir" },
  ];
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "12px 8px", background: C.panelLow, borderTop: `1px solid ${C.lineSoft}`, borderRadius: "12px 12px 0 0" }}>
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button key={it.id} onClick={() => setView(it.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: active ? C.gold : C.dim }}>
            <Icon name={it.icon} style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }} />
            <span style={{ ...capsLabel, color: active ? C.gold : C.dim }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}


// ---- Persistencia en el navegador ----
const STORE_KEY = "patrimonio_assets_v1";
function loadInitial(defaultSeed) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return defaultSeed;
}
function importJSON(dispatch) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        const arr = Array.isArray(data) ? data : data.assets;
        if (!Array.isArray(arr)) throw new Error("formato");
        localStorage.setItem(STORE_KEY, JSON.stringify(arr));
        location.reload();
      } catch (err) {
        alert("Archivo no válido. Debe ser un JSON exportado por esta app.");
      }
    };
    rd.readAsText(file);
  };
  input.click();
}


// ---- Persistencia del objetivo ----
const META_KEY = "patrimonio_meta_v1";
function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) { const n = parseFloat(raw); if (isFinite(n) && n > 0) return n; }
  } catch (e) {}
  return META_OBJETIVO_DEFAULT;
}

// ---- Export JSON ----
function exportJSON(assets) {
  const payload = { app: "patrimonio", version: 1, exported: new Date().toISOString(), assets };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "patrimonio-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
