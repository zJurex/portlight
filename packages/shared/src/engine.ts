// Motor puro del juego. Lo usan el servidor (autoridad) y el simulador. Sin E/S, todo en enteros.
import {
  BASE_VALUE, BUILDINGS, COMPLEMENTS, ECON, LEVEL_MULT_MILLI, NEIGHBOR_BONUS_CAP_PCT, NEIGHBOR_BONUS_PCT,
  PRODUCT_TIER, PRODUCTS, type BuildingId, type ProductId, type Recipe,
} from './data';

export type Inventory = Partial<Record<ProductId, number>>;

export interface LotState {
  lot: number;
  building: BuildingId | null;
  level: number;
  /** receta elegida (Taller: 0 muebles, 1 herramientas) */
  mode: number;
  /** ms epoch hasta donde ya se cobró la producción */
  lastAt: number;
}

const MS_PER_HOUR_MILLI = 3_600_000 * 1000;
const TIER_ORDER = { raw: 0, mid: 1, final: 2 } as const;

export const invTotal = (inv: Inventory) => PRODUCTS.reduce((s, p) => s + (inv[p] ?? 0), 0);

export const recipeOf = (l: LotState): Recipe | null => {
  if (!l.building) return null;
  const r = BUILDINGS[l.building].recipes;
  return r.length ? r[Math.min(l.mode, r.length - 1)] : null;
};

/** bonificación por vecinos complementarios, en % (con tope) */
export const neighborBonusPct = (b: BuildingId, neighbors: (BuildingId | null)[]) => {
  const wanted = COMPLEMENTS[b];
  if (!wanted) return 0;
  const found = new Set(neighbors.filter((n): n is BuildingId => !!n && wanted.includes(n)));
  return Math.min(NEIGHBOR_BONUS_CAP_PCT, found.size * NEIGHBOR_BONUS_PCT);
};

/** unidades de salida por hora, en milésimas */
export const rateMilli = (l: LotState, bonusPct = 0) => {
  if (!l.building) return 0;
  const base = BUILDINGS[l.building].rate * LEVEL_MULT_MILLI[l.level - 1];
  return Math.floor((base * (100 + bonusPct)) / 100);
};

/** unidades acumuladas sin cobrar (sin mirar insumos ni capacidad) */
export const pendingUnits = (l: LotState, now: number, bonusPct = 0) => {
  const r = rateMilli(l, bonusPct);
  if (!r) return 0;
  const start = Math.max(l.lastAt, now - ECON.maxOfflineMs);
  return Math.floor((r * Math.max(0, now - start)) / MS_PER_HOUR_MILLI);
};

export interface CollectResult {
  inv: Inventory;
  lots: { lot: number; lastAt: number }[];
  produced: Inventory;
  consumed: Inventory;
  /** lotes que no pudieron producir todo: 'full' sin espacio, 'inputs' sin insumos */
  blocked: { lot: number; reason: 'full' | 'inputs' }[];
}

/**
 * Cobra la producción acumulada de los lotes, en orden materia prima → intermedio → final,
 * respetando insumos disponibles y capacidad de almacén. Lo no cobrado sigue acumulado (tope 24 h).
 */
export const collect = (
  lots: LotState[],
  inventory: Inventory,
  capacity: number,
  now: number,
  bonusOf: (l: LotState) => number = () => 0,
): CollectResult => {
  const inv: Inventory = { ...inventory };
  const produced: Inventory = {};
  const consumed: Inventory = {};
  const changed: { lot: number; lastAt: number }[] = [];
  const blocked: CollectResult['blocked'] = [];
  const ordered = lots
    .map((l) => ({ l, r: recipeOf(l) }))
    .filter((x): x is { l: LotState; r: Recipe } => !!x.r)
    .sort((a, b) => TIER_ORDER[PRODUCT_TIER[a.r.out]] - TIER_ORDER[PRODUCT_TIER[b.r.out]] || a.l.lot - b.l.lot);

  for (const { l, r } of ordered) {
    const rate = rateMilli(l, bonusOf(l));
    const start = Math.max(l.lastAt, now - ECON.maxOfflineMs);
    const potential = Math.floor((rate * Math.max(0, now - start)) / MS_PER_HOUR_MILLI);
    let runs = Math.floor(potential / r.outQty);
    if (runs <= 0) continue;
    const want = runs;
    let inputsShort = false;
    for (const [p, need] of Object.entries(r.inputs) as [ProductId, number][]) {
      const can = Math.floor((inv[p] ?? 0) / need);
      if (can < runs) { runs = can; inputsShort = true; }
    }
    const inputCount = Object.values(r.inputs).reduce((s, n) => s + (n ?? 0), 0);
    const net = r.outQty - inputCount;
    let full = false;
    if (net > 0) {
      const free = Math.max(0, capacity - invTotal(inv));
      const can = Math.floor(free / net);
      if (can < runs) { runs = can; full = true; }
    }
    if (runs < want) blocked.push({ lot: l.lot, reason: full ? 'full' : inputsShort ? 'inputs' : 'full' });
    if (runs <= 0) continue;
    for (const [p, need] of Object.entries(r.inputs) as [ProductId, number][]) {
      inv[p] = (inv[p] ?? 0) - need * runs;
      consumed[p] = (consumed[p] ?? 0) + need * runs;
    }
    const units = runs * r.outQty;
    inv[r.out] = (inv[r.out] ?? 0) + units;
    produced[r.out] = (produced[r.out] ?? 0) + units;
    const used = Math.ceil((units * MS_PER_HOUR_MILLI) / rate);
    changed.push({ lot: l.lot, lastAt: Math.min(now, start + used) });
  }
  return { inv, lots: changed, produced, consumed, blocked };
};

/** mantenimiento acumulado entre `from` y `to` para un valor invertido dado */
export const maintenanceDue = (investedValue: number, from: number, to: number) =>
  Math.floor((investedValue * ECON.maintenanceBpPerDay * Math.max(0, to - from)) / (10_000 * 86_400_000));

// ---------- Precio de referencia ----------

export interface TradeStats {
  /** cantidad de operaciones reales (humano con humano) en la ventana */
  n: number;
  qty: number;
  /** valor total en centavos */
  value: number;
}

/** ref = w·base + (1−w)·VWAP, con w = 1 / (1 + n/20) */
export const refPrice = (product: ProductId, s: TradeStats) => {
  const base = BASE_VALUE[product];
  if (s.n <= 0 || s.qty <= 0) return base;
  const K = ECON.refHalfWeightTrades;
  const vwap = s.value / s.qty;
  return Math.max(1, Math.round((base * K + vwap * s.n) / (K + s.n)));
};

/**
 * Valor de una operación para el cálculo de ref: el precio se recorta a la banda del Estado,
 * así una operación a precio absurdo (o un lavado entre cuentas propias) no arrastra la referencia.
 */
export const refTradeValue = (product: ProductId, price: number, qty: number, currentRef: number, E: typeof ECON = ECON) => {
  const st = stateQuotes(product, currentRef, E);
  return Math.min(st.ask, Math.max(st.bid, price)) * qty;
};

/** ref con tope de movimiento diario respecto del cierre del día anterior */
export const refPriceCapped = (product: ProductId, s: TradeStats, prevClose: number | null, E: typeof ECON = ECON) => {
  let r = refPrice(product, s);
  if (E.stateAnchor === 'base') { const st = stateQuotes(product, r, E); r = Math.min(st.ask, Math.max(st.bid, r)); }
  if (!prevClose) return r;
  const lo = Math.floor((prevClose * (10_000 - E.refDailyMoveBp)) / 10_000);
  const hi = Math.ceil((prevClose * (10_000 + E.refDailyMoveBp)) / 10_000);
  return Math.min(hi, Math.max(lo, r));
};

/** banda de precios admitida para una orden límite */
export const orderBand = (ref: number) => ({
  min: Math.max(1, Math.floor((ref * ECON.orderMinBp) / 10_000)),
  max: Math.ceil((ref * ECON.orderMaxBp) / 10_000),
});

/** cupo diario de compra/venta del Estado en un distrito, según sus jugadores activos */
export const stateDailyQty = (product: ProductId, activeInDistrict: number, E: typeof ECON = ECON) => {
  const tier = PRODUCT_TIER[product];
  return E.stateDailyQty[tier] + E.stateDailyQtyPerActive[tier] * activeInDistrict;
};

// ---------- Bots ----------

/** hash determinístico → [0, 1) */
export const hash01 = (...parts: (string | number)[]) => {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** multiplicador de volumen de bots en puntos básicos: max(0,15; 1 − órdenes_reales_24h/100) */
export const botFactorBp = (realOrders24h: number) =>
  Math.max(ECON.botMinFactorBp, 10_000 - Math.floor((realOrders24h * 10_000) / ECON.botRealOrdersForZero));

export interface Quote { price: number; qty: number }
export interface BotQuotes { bucket: number; bid: Quote; ask: Quote }

/**
 * Cotización del creador de mercado: spread total 5–15 % alrededor de ref, con ruido de ±3 %,
 * renovada en cada ventana. Cantidad por ventana según nivel del producto y retirada gradual.
 */
export const botQuotes = (product: ProductId, ref: number, now: number, realOrders24h: number, seed = 'pl'): BotQuotes => {
  const bucket = Math.floor(now / ECON.botBucketMs);
  const spreadBp = 500 + Math.floor(hash01(seed, product, bucket, 's') * 1000);
  const noiseBp = Math.floor((hash01(seed, product, bucket, 'n') * 2 - 1) * 300);
  const center = (ref * (10_000 + noiseBp)) / 10_000;
  const ask = Math.max(2, Math.round((center * (10_000 + spreadBp / 2)) / 10_000));
  const bid = Math.max(1, Math.min(ask - 1, Math.round((center * (10_000 - spreadBp / 2)) / 10_000)));
  const qty = Math.floor((ECON.botQty[PRODUCT_TIER[product]] * botFactorBp(realOrders24h)) / 10_000);
  return { bucket, bid: { price: bid, qty }, ask: { price: ask, qty } };
};

/**
 * Prioridad humana: un bot nunca mejora el precio de una orden real abierta dentro de su banda.
 * (Fuera de la banda ±15 % se ignora, para que una orden humana extrema no arrastre a los bots.)
 */
export const applyHumanPriority = (q: BotQuotes, ref: number, bestHumanBid?: number, bestHumanAsk?: number): BotQuotes => {
  let { bid, ask } = q;
  if (bestHumanAsk !== undefined && ask.price < bestHumanAsk && bestHumanAsk <= Math.round(ref * 1.15)) ask = { ...ask, price: bestHumanAsk };
  if (bestHumanBid !== undefined && bid.price > bestHumanBid && bestHumanBid >= Math.round(ref * 0.85)) bid = { ...bid, price: bestHumanBid };
  return { ...q, bid, ask };
};

/**
 * El creador de mercado nunca abre un bucle contra el Estado: no vende más barato de lo que paga
 * el Estado ni compra más caro de lo que cobra el Estado.
 */
export const botInsideState = (q: BotQuotes, st: { bid: number; ask: number }): BotQuotes => {
  const ask = Math.max(q.ask.price, st.bid + 1);
  const bid = Math.min(q.bid.price, st.ask - 1, ask - 1);
  return { ...q, bid: { ...q.bid, price: bid }, ask: { ...q.ask, price: ask } };
};

/**
 * Precios del Estado (piso y techo). Por defecto se anclan al valor base del producto:
 * anclarlos a ref provoca un espiral (piso → operaciones al piso → ref baja → piso baja), ver sim/REPORT.md.
 */
export const stateQuotes = (product: ProductId, ref: number, E: typeof ECON = ECON) => {
  const anchor = E.stateAnchor === 'base' ? BASE_VALUE[product] : ref;
  return {
    bid: Math.max(1, Math.floor((anchor * E.stateBuyBp) / 10_000)),
    ask: Math.ceil((anchor * E.stateSellBp) / 10_000),
  };
};

// ---------- Matching ----------

export type Side = 'buy' | 'sell';
export type LevelKind = 'human' | 'bot' | 'state';
export interface Level {
  kind: LevelKind;
  price: number;
  qty: number;
  /** id de orden humana (para prioridad temporal) */
  orderId?: number;
  companyId?: number;
}
export interface Fill { level: Level; qty: number; price: number }

const KIND_PRIORITY: Record<LevelKind, number> = { human: 0, bot: 1, state: 2 };

/**
 * Cruza una orden límite entrante contra los niveles del lado opuesto (ya sin órdenes propias).
 * Precio de ejecución = precio del nivel en reposo. A igual precio, humanos primero y luego por antigüedad.
 */
export const matchOrder = (side: Side, limit: number, qty: number, opposite: Level[]): Fill[] => {
  const levels = opposite
    .filter((l) => l.qty > 0 && (side === 'buy' ? l.price <= limit : l.price >= limit))
    .sort((a, b) =>
      (side === 'buy' ? a.price - b.price : b.price - a.price) ||
      KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
      (a.orderId ?? 0) - (b.orderId ?? 0));
  const fills: Fill[] = [];
  let left = qty;
  for (const level of levels) {
    if (left <= 0) break;
    const q = Math.min(left, level.qty);
    fills.push({ level, qty: q, price: level.price });
    left -= q;
  }
  return fills;
};

/** comisión de mercado que paga el vendedor */
export const marketFee = (value: number) => Math.floor((value * ECON.marketFeeBp) / 10_000);
