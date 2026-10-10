// Simulador de balance: miles de jugadores durante 90 días con el mismo motor que el servidor.
// Paso de 1 hora; cada jugador "entra" según su estrategia y actúa con las reglas reales
// (producción perezosa, mercado con bots y Estado, comisión, mantenimiento, ledger en enteros).
import {
  BASE_VALUE, BUILDINGS, DISTRICTS, ECON, MAX_LEVEL, PRODUCTS, PRODUCT_TIER,
  applyHumanPriority, botInsideState, botQuotes, buildingValue, collect, marketFee, orderBand, refPrice, refPriceCapped,
  refTradeValue, stateDailyQty, stateQuotes, storageCapacity, upgradeCost,
  type BuildingId, type Inventory, type LotState, type ProductId, type TradeStats,
} from '@portlight/shared';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 1);

export type Strategy = 'farmer' | 'chain' | 'optimizer' | 'casual' | 'trader' | 'idle' | 'arb' | 'wash';
export const HONEST: Strategy[] = ['farmer', 'chain', 'optimizer', 'casual', 'trader', 'idle'];

export interface SimConfig {
  players: number;
  days: number;
  seed: number;
  /** cantidad de agentes tramposos (arbitraje + lavado de precios) */
  cheaters: number;
  /** reglas de ref: 'robust' (recorte, tope diario, un trade por par) o 'naive' (fórmula pura) */
  refRules: 'robust' | 'naive';
  /** fracción de jugadores que llegan el día 0; el resto entra parejo hasta el día 30 */
  launchShare: number;
  /** reglas de economía a sobrescribir para calibrar */
  econ?: Partial<typeof ECON>;
  log?: (s: string) => void;
}

interface Order { id: number; owner: Player; product: ProductId; side: 'buy' | 'sell'; price: number; qty: number; escrow: number; at: number }

export interface Player {
  id: number;
  strategy: Strategy;
  district: number;
  cash: number;
  inv: Inventory;
  lots: LotState[];
  orders: Order[];
  maintAt: number;
  joinedAt: number;
  nextCheck: number;
  activeUntil: number;
  lastSeen: number;
  lotsBought: number;
  invested: number;
  firstBuildAt: number;
  firstCost: number;
  /** flujo de caja operativo desde el primer edificio (ventas − compras − mantenimiento) */
  opFlow: number;
  paybackHours: number | null;
  partner?: Player;
  arbProfit: number;
  /** unidades producidas que el Estado todavía puede comprarle (no se revende lo comprado) */
  stateCredit: Inventory;
}

// ---------- utilidades ----------

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

const COUNTRY_WEIGHT: Record<string, number> = { AR: 18, BR: 22, MX: 16, CO: 10, CL: 7, PE: 6, UY: 3, VE: 4, EC: 3, PY: 2, BO: 2, XW: 7 };

export class Sim {
  readonly cfg: SimConfig;
  readonly E: typeof ECON;
  now = T0;
  r: () => number;
  players: Player[] = [];
  private nextId = 1;
  private orderId = 1;
  books = new Map<ProductId, { bids: Order[]; asks: Order[] }>();
  /** estadísticas de ref por hora: producto → hora → stats */
  private stats = new Map<ProductId, Map<number, TradeStats>>();
  private pairs = new Map<ProductId, Map<string, number>>();
  private ordersHourly = new Map<ProductId, Map<number, number>>();
  private botUse = new Map<ProductId, { bucket: number; bid: number; ask: number; day: number; bought: number; sold: number }>();
  private stateUse = new Map<string, { bought: number; sold: number }>();
  private activeByDistrict = new Map<number, number>();
  closes = new Map<ProductId, number[]>();
  refCache = new Map<ProductId, number>();
  /** contabilidad: fuentes y sumideros de francos */
  money = { start: 0, botBuys: 0, stateBuys: 0, botSells: 0, stateSells: 0, fees: 0, maintenance: 0, lots: 0, builds: 0 };
  volume = { humanHuman: 0, vsBot: 0, vsState: 0 };
  daily: Record<string, number>[] = [];
  wealthAt: Record<number, number[]> = {};

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.E = { ...ECON, ...cfg.econ };
    this.r = rng(cfg.seed);
    for (const p of PRODUCTS) {
      this.books.set(p, { bids: [], asks: [] });
      this.stats.set(p, new Map());
      this.pairs.set(p, new Map());
      this.ordersHourly.set(p, new Map());
      this.closes.set(p, []);
    }
  }

  // ---------- precios ----------

  ref(p: ProductId) {
    const c = this.refCache.get(p);
    if (c !== undefined) return c;
    const from = Math.floor((this.now - this.E.refWindowMs) / HOUR);
    const s: TradeStats = { n: 0, qty: 0, value: 0 };
    for (const [h, v] of this.stats.get(p)!) if (h >= from) { s.n += v.n; s.qty += v.qty; s.value += v.value; }
    const closes = this.closes.get(p)!;
    const v = this.cfg.refRules === 'robust' ? refPriceCapped(p, s, closes.length ? closes[closes.length - 1] : null, this.E) : refPrice(p, s);
    this.refCache.set(p, v);
    return v;
  }

  private realOrders24h(p: ProductId) {
    const from = Math.floor((this.now - DAY) / HOUR);
    let n = 0;
    for (const [h, v] of this.ordersHourly.get(p)!) if (h >= from) n += v;
    return n;
  }

  private bot(p: ProductId) {
    const bucket = Math.floor(this.now / this.E.botBucketMs), day = Math.floor(this.now / DAY);
    let u = this.botUse.get(p) ?? { bucket, bid: 0, ask: 0, day, bought: 0, sold: 0 };
    if (u.bucket !== bucket) u = { ...u, bucket, bid: 0, ask: 0 };
    if (u.day !== day) u = { ...u, day, bought: 0, sold: 0 };
    this.botUse.set(p, u);
    return u;
  }

  private stateKey(d: number, p: ProductId) { return `${Math.floor(this.now / DAY)}:${d}:${p}`; }

  /** niveles virtuales (bot + Estado del distrito) */
  private virtual(p: ProductId, district: number, seller?: Player) {
    const ref = this.ref(p);
    const book = this.books.get(p)!;
    const st = stateQuotes(p, ref, this.E);
    let q = applyHumanPriority(botQuotes(p, ref, this.now, this.realOrders24h(p), 'sim' + this.cfg.seed), ref, book.bids[0]?.price, book.asks[0]?.price);
    if (this.cfg.refRules === 'robust') q = botInsideState(q, st);
    const u = this.bot(p);
    const cap = q.bid.qty * this.E.botDailyBuckets;
    const sq = this.stateUse.get(this.stateKey(district, p)) ?? { bought: 0, sold: 0 };
    const quota = stateDailyQty(p, this.activeByDistrict.get(district) ?? 0, this.E);
    return {
      ref,
      botBid: { price: q.bid.price, qty: Math.max(0, Math.min(q.bid.qty - u.bid, cap - u.bought)) },
      botAsk: { price: q.ask.price, qty: Math.max(0, Math.min(q.ask.qty - u.ask, cap - u.sold)) },
      stateBid: { price: st.bid, qty: Math.max(0, Math.min(quota - sq.bought, seller ? seller.stateCredit[p] ?? 0 : Infinity)) },
      stateAsk: { price: st.ask, qty: Math.max(0, quota - sq.sold) },
    };
  }

  bestBid(p: ProductId, district: number, seller?: Player) {
    const v = this.virtual(p, district, seller);
    const h = this.books.get(p)!.bids[0]?.price ?? 0;
    return Math.max(h, v.botBid.qty ? v.botBid.price : 0, v.stateBid.qty ? v.stateBid.price : 0);
  }

  bestAsk(p: ProductId, district: number) {
    const v = this.virtual(p, district);
    const c = [this.books.get(p)!.asks[0]?.price, v.botAsk.qty ? v.botAsk.price : undefined, v.stateAsk.qty ? v.stateAsk.price : undefined].filter((x): x is number => !!x);
    return c.length ? Math.min(...c) : Infinity;
  }

  // ---------- mercado ----------

  /** coloca una orden límite con las mismas reglas que el servidor; devuelve lo ejecutado */
  place(pl: Player, p: ProductId, side: 'buy' | 'sell', limit: number, qty: number): { filled: number; value: number } {
    const ref = this.ref(p);
    if (this.cfg.refRules === 'robust') {
      const band = orderBand(ref);
      limit = Math.min(band.max, Math.max(band.min, limit));
    } else {
      limit = Math.min(ref * 5, Math.max(Math.floor(ref / 5), limit));
    }
    qty = Math.floor(qty);
    if (qty <= 0) return { filled: 0, value: 0 };
    if (pl.orders.length >= this.E.maxOpenOrders) this.cancel(pl, pl.orders[0]);
    if (side === 'sell') { qty = Math.min(qty, pl.inv[p] ?? 0); if (qty <= 0) return { filled: 0, value: 0 }; pl.inv[p]! -= qty; }
    if (side === 'buy') { qty = Math.min(qty, Math.floor(pl.cash / limit)); if (qty <= 0) return { filled: 0, value: 0 }; }
    const hour = Math.floor(this.now / HOUR);
    const oh = this.ordersHourly.get(p)!;
    oh.set(hour, (oh.get(hour) ?? 0) + 1);

    const book = this.books.get(p)!;
    const opp = side === 'buy' ? book.asks : book.bids;
    const v = this.virtual(p, pl.district, side === 'sell' ? pl : undefined);
    const virt = side === 'buy'
      ? [{ kind: 'bot' as const, ...v.botAsk }, { kind: 'state' as const, ...v.stateAsk }]
      : [{ kind: 'bot' as const, ...v.botBid }, { kind: 'state' as const, ...v.stateBid }];
    const better = (a: number, b: number) => (side === 'buy' ? a <= b : a >= b);
    let left = qty, filled = 0, value = 0, hi = 0;
    while (left > 0) {
      // mejor nivel: humano (excluyendo propias) vs virtuales; a igual precio, humano primero
      while (hi < opp.length && opp[hi].owner === pl) hi++;
      const h = hi < opp.length && better(opp[hi].price, limit) ? opp[hi] : null;
      let vbest: (typeof virt)[number] | null = null;
      for (const x of virt) if (x.qty > 0 && better(x.price, limit) && (!vbest || (side === 'buy' ? x.price < vbest.price : x.price > vbest.price))) vbest = x;
      if (!h && !vbest) break;
      const useHuman = h && (!vbest || (side === 'buy' ? h.price <= vbest.price : h.price >= vbest.price));
      const price = useHuman ? h!.price : vbest!.price;
      const q = Math.min(left, useHuman ? h!.qty : vbest!.qty);
      const val = price * q, fee = marketFee(val);
      if (useHuman) {
        const o = h!, other = o.owner;
        o.qty -= q;
        if (side === 'buy') { other.cash += val - fee; this.money.fees += fee; other.opFlow += val - fee; }
        else { o.escrow -= val; other.inv[p] = (other.inv[p] ?? 0) + q; other.opFlow -= val; }
        if (o.qty === 0) { this.closeOrder(o); opp.splice(hi, 1); }
        this.recordHumanTrade(p, side === 'buy' ? pl : other, side === 'buy' ? other : pl, price, q, hour);
        this.volume.humanHuman += val;
      } else {
        vbest!.qty -= q;
        if (vbest!.kind === 'bot') {
          const u = this.bot(p);
          if (side === 'sell') { u.bid += q; u.bought += q; this.money.botBuys += val; } else { u.ask += q; u.sold += q; this.money.botSells += val; }
          this.volume.vsBot += val;
        } else {
          const k = this.stateKey(pl.district, p);
          const su = this.stateUse.get(k) ?? { bought: 0, sold: 0 };
          if (side === 'sell') { su.bought += q; this.money.stateBuys += val; pl.stateCredit[p] = (pl.stateCredit[p] ?? 0) - q; } else { su.sold += q; this.money.stateSells += val; }
          this.stateUse.set(k, su);
          this.volume.vsState += val;
        }
      }
      if (side === 'buy') { pl.cash -= val; pl.inv[p] = (pl.inv[p] ?? 0) + q; pl.opFlow -= val; }
      else {
        pl.cash += val - fee; pl.opFlow += val - fee;
        this.money.fees += fee; // el vendedor siempre paga la comisión
      }
      left -= q; filled += q; value += val;
    }
    if (left > 0) {
      const escrow = side === 'buy' ? limit * left : 0;
      pl.cash -= escrow;
      const o: Order = { id: this.orderId++, owner: pl, product: p, side, price: limit, qty: left, escrow, at: this.now };
      pl.orders.push(o);
      const arr = side === 'buy' ? book.bids : book.asks;
      // inserción ordenada: precio y luego antigüedad
      let lo = 0, hiI = arr.length;
      while (lo < hiI) { const m = (lo + hiI) >> 1; if (side === 'buy' ? arr[m].price >= limit : arr[m].price <= limit) lo = m + 1; else hiI = m; }
      arr.splice(lo, 0, o);
    }
    return { filled, value };
  }

  private recordHumanTrade(p: ProductId, buyer: Player, seller: Player, price: number, q: number, hour: number) {
    const s = this.stats.get(p)!;
    const cur = s.get(hour) ?? { n: 0, qty: 0, value: 0 };
    let n = 1;
    let value = price * q;
    if (this.cfg.refRules === 'robust') {
      const key = buyer.id < seller.id ? `${buyer.id}:${seller.id}` : `${seller.id}:${buyer.id}`;
      const pairs = this.pairs.get(p)!;
      const last = pairs.get(key);
      n = last !== undefined && this.now - last < this.E.refWindowMs ? 0 : 1;
      if (n) pairs.set(key, this.now);
      value = refTradeValue(p, price, q, this.ref(p), this.E);
      // un par repetido no suma volumen a la ref (solo su primera operación cuenta)
      if (!n) { q = 0; value = 0; }
    }
    s.set(hour, { n: cur.n + n, qty: cur.qty + q, value: cur.value + value });
  }

  private closeOrder(o: Order) {
    const pl = o.owner;
    if (o.side === 'buy') { pl.cash += o.escrow; o.escrow = 0; }
    else if (o.qty > 0) pl.inv[o.product] = (pl.inv[o.product] ?? 0) + o.qty;
    o.qty = 0;
    pl.orders = pl.orders.filter((x) => x !== o);
  }

  cancel(pl: Player, o: Order) {
    const book = this.books.get(o.product)!;
    const arr = o.side === 'buy' ? book.bids : book.asks;
    const i = arr.indexOf(o);
    if (i >= 0) arr.splice(i, 1);
    this.closeOrder(o);
  }

  // ---------- jugadores ----------

  private pickDistrict() {
    const total = Object.values(COUNTRY_WEIGHT).reduce((a, b) => a + b, 0);
    let x = this.r() * total;
    let code = 'AR';
    for (const [c, w] of Object.entries(COUNTRY_WEIGHT)) { x -= w; if (x <= 0) { code = c; break; } }
    const ds = DISTRICTS.filter((d) => d.country === code);
    // distribución desigual: algunas provincias atraen más gente
    const i = Math.floor(Math.pow(this.r(), 1.8) * ds.length);
    return ds[i].idx;
  }

  addPlayer(strategy: Strategy, district = this.pickDistrict()): Player {
    const pl: Player = {
      id: this.nextId++, strategy, district, cash: this.E.startCash, inv: {}, lots: [], orders: [], maintAt: this.now,
      joinedAt: this.now, nextCheck: this.now + Math.floor(this.r() * HOUR), lastSeen: this.now, lotsBought: 0, invested: 0,
      firstBuildAt: 0, firstCost: 0, opFlow: 0, paybackHours: null, arbProfit: 0, stateCredit: {},
      activeUntil: strategy === 'idle' ? this.now + 2 * DAY : this.now + this.lifetime(strategy),
    };
    this.money.start += this.E.startCash;
    this.players.push(pl);
    return pl;
  }

  private lifetime(s: Strategy) {
    if (s === 'arb' || s === 'wash') return 1000 * DAY;
    // churn: la mitad se va en ~3 semanas; un núcleo queda todo el período
    const x = this.r();
    return x < 0.35 ? Math.floor((3 + this.r() * 10) * DAY) : x < 0.6 ? Math.floor((14 + this.r() * 30) * DAY) : 1000 * DAY;
  }

  private checkInterval(s: Strategy) {
    const base: Record<Strategy, number> = { farmer: 6, chain: 4, optimizer: 3, casual: 20, trader: 2, idle: 12, arb: 1, wash: 1 };
    return Math.floor(base[s] * HOUR * (0.6 + this.r() * 0.8));
  }

  private capacity(pl: Player) {
    return storageCapacity(pl.lots.filter((l) => l.building === 'warehouse').map((l) => l.level));
  }

  private settle(pl: Player) {
    const value = pl.lots.reduce((s, l) => s + (l.building ? buildingValue(l.building, l.level) : 0), 0);
    const due = Math.floor((value * this.E.maintenanceBpPerDay * Math.max(0, this.now - pl.maintAt)) / (10_000 * DAY));
    if (due < 100) return;
    const paid = Math.min(due, pl.cash);
    pl.cash -= paid; pl.opFlow -= paid;
    this.money.maintenance += paid;
    pl.maintAt = this.now;
  }

  private claimLot(pl: Player) {
    if (pl.lots.length >= this.E.maxLots) return false;
    const free = pl.lots.length < this.E.freeLots;
    const ring = free ? 0 : Math.min(3, Math.floor(pl.lotsBought / 3));
    const price = free ? 0 : this.E.lotPrice[ring];
    if (pl.cash < price) return false;
    pl.cash -= price;
    this.money.lots += price;
    if (!free) pl.lotsBought++;
    pl.invested += price;
    pl.lots.push({ lot: pl.lots.length, building: null, level: 0, mode: 0, lastAt: this.now });
    return true;
  }

  private build(pl: Player, b: BuildingId, mode = 0) {
    let lot = pl.lots.find((l) => !l.building);
    if (!lot) { if (!this.claimLot(pl)) return false; lot = pl.lots[pl.lots.length - 1]; }
    const cost = BUILDINGS[b].cost;
    if (pl.cash < cost) return false;
    pl.cash -= cost;
    this.money.builds += cost;
    pl.invested += cost;
    Object.assign(lot, { building: b, level: 1, mode, lastAt: this.now });
    if (!pl.firstBuildAt) { pl.firstBuildAt = this.now; pl.firstCost = cost; pl.opFlow = 0; }
    return true;
  }

  private upgrade(pl: Player, l: LotState) {
    if (!l.building || l.level >= MAX_LEVEL) return false;
    const cost = upgradeCost(l.building, l.level);
    if (pl.cash < cost) return false;
    pl.cash -= cost;
    this.money.builds += cost;
    pl.invested += cost;
    l.level++;
    return true;
  }

  /** ganancia esperada por hora de un edificio nivel 1 a precios actuales (venta al bid, compra al ask) */
  private hourlyProfit(b: BuildingId, district: number, level = 1, mode = 0) {
    const def = BUILDINGS[b];
    const r = def.recipes[mode];
    if (!r) return 0;
    const rate = (def.rate * [1, 1.4, 1.9, 2.5, 3.2][level - 1]) / r.outQty;
    let inputCost = 0;
    for (const [p, n] of Object.entries(r.inputs) as [ProductId, number][]) inputCost += n * Math.min(this.bestAsk(p, district), this.ref(p) * 1.3);
    const out = r.outQty * this.ref(r.out) * 0.9;
    return rate * (out - inputCost) - (buildingValue(b, level) * this.E.maintenanceBpPerDay) / 10_000 / 24;
  }

  private chooseInvestment(pl: Player): (() => boolean) | null {
    const s = pl.strategy;
    const raw: BuildingId[] = ['farm', 'sawmill', 'mine', 'power'];
    if (s === 'farmer' || s === 'casual' || s === 'idle') {
      if (s === 'idle' && pl.lots.some((l) => l.building)) return null;
      if (pl.lots.length < this.E.maxLots || pl.lots.some((l) => !l.building)) {
        const b = raw[Math.floor(this.r() * raw.length)];
        return () => this.build(pl, b);
      }
      const l = pl.lots.filter((x) => x.building && x.level < MAX_LEVEL).sort((a, b) => a.level - b.level)[0];
      return l ? () => this.upgrade(pl, l) : null;
    }
    if (s === 'chain') {
      const plan: BuildingId[] = ['farm', 'power', 'farm', 'mill', 'power', 'bakery', 'sawmill', 'sawmill', 'carpentry', 'mine', 'foundry', 'warehouse'];
      const have = pl.lots.filter((l) => l.building).length;
      if (have < plan.length) return () => this.build(pl, plan[have]);
      const l = pl.lots.filter((x) => x.building && x.building !== 'warehouse' && x.level < MAX_LEVEL).sort((a, b) => a.level - b.level)[0];
      return l ? () => this.upgrade(pl, l) : null;
    }
    if (s === 'optimizer' || s === 'trader') {
      if (s === 'trader' && pl.lots.filter((l) => l.building).length >= 2) return null;
      // mejor retorno por franco entre construir y mejorar
      let best: { roi: number; act: () => boolean } | null = null;
      const consider = (roi: number, act: () => boolean) => { if (roi > 0 && (!best || roi > best.roi)) best = { roi, act }; };
      if (pl.lots.length < this.E.maxLots || pl.lots.some((l) => !l.building)) {
        const lotCost = pl.lots.some((l) => !l.building) || pl.lots.length < this.E.freeLots ? 0 : this.E.lotPrice[Math.min(3, Math.floor(pl.lotsBought / 3))];
        for (const b of ['farm', 'sawmill', 'mine', 'power', 'mill', 'carpentry', 'foundry', 'bakery', 'workshop'] as BuildingId[]) {
          for (let m = 0; m < BUILDINGS[b].recipes.length; m++) consider(this.hourlyProfit(b, pl.district, 1, m) / (BUILDINGS[b].cost + lotCost), () => this.build(pl, b, m));
        }
      }
      for (const l of pl.lots) {
        if (!l.building || l.building === 'warehouse' || l.level >= MAX_LEVEL) continue;
        const gain = this.hourlyProfit(l.building, pl.district, l.level + 1, l.mode) - this.hourlyProfit(l.building, pl.district, l.level, l.mode);
        consider(gain / upgradeCost(l.building, l.level), () => this.upgrade(pl, l));
      }
      const used = PRODUCTS.reduce((a, p) => a + (pl.inv[p] ?? 0), 0);
      if (used > this.capacity(pl) * 0.8) return () => this.build(pl, 'warehouse');
      return best ? (best as { act: () => boolean }).act : null;
    }
    return null;
  }

  /** insumos que la empresa necesita para 12 horas de sus procesadores */
  private needs(pl: Player) {
    const need: Inventory = {};
    for (const l of pl.lots) {
      if (!l.building) continue;
      const def = BUILDINGS[l.building];
      const r = def.recipes[l.mode];
      if (!r) continue;
      const runs = (def.rate * [1, 1.4, 1.9, 2.5, 3.2][l.level - 1] * 12) / r.outQty;
      for (const [p, n] of Object.entries(r.inputs) as [ProductId, number][]) need[p] = (need[p] ?? 0) + Math.ceil(n * runs);
    }
    return need;
  }

  private act(pl: Player) {
    pl.lastSeen = this.now;
    for (const o of [...pl.orders]) if (this.now - o.at > DAY) this.cancel(pl, o);
    this.settle(pl);
    if (pl.strategy === 'arb') return this.actArb(pl);
    if (pl.strategy === 'wash') return this.actWash(pl);
    const res = collect(pl.lots, pl.inv, this.capacity(pl), this.now);
    pl.inv = res.inv;
    for (const [p, n] of Object.entries(res.produced) as [ProductId, number][]) pl.stateCredit[p] = (pl.stateCredit[p] ?? 0) + n;
    for (const ch of res.lots) pl.lots.find((l) => l.lot === ch.lot)!.lastAt = ch.lastAt;

    const need = this.needs(pl);
    // vender excedentes
    for (const p of PRODUCTS) {
      const have = pl.inv[p] ?? 0;
      const sell = have - (need[p] ?? 0);
      if (sell <= 0) continue;
      const ref = this.ref(p);
      const patient = pl.strategy === 'trader' || (pl.strategy === 'chain' && this.r() < 0.5);
      if (pl.strategy === 'optimizer') {
        // vende al mejor comprador si paga al menos el 90 % de ref; si no, publica a ref
        const bid = this.bestBid(p, pl.district, pl);
        this.place(pl, p, 'sell', bid >= ref * 0.9 ? bid : ref, sell);
        continue;
      }
      // el apurado le vende al mejor comprador disponible y deja el resto a ese precio; nunca regala debajo del piso del Estado
      const limit = patient ? Math.max(this.bestBid(p, pl.district, pl), Math.round(ref * (0.97 + this.r() * 0.08))) : Math.max(this.bestBid(p, pl.district, pl), Math.round(ref * 0.7));
      this.place(pl, p, 'sell', limit, sell);
    }
    // comprar insumos faltantes
    for (const [p, n] of Object.entries(need) as [ProductId, number][]) {
      const short = n - (pl.inv[p] ?? 0) - pl.orders.filter((o) => o.side === 'buy' && o.product === p).reduce((a, o) => a + o.qty, 0);
      if (short <= 0) continue;
      const ref = this.ref(p);
      const limit = Math.round(ref * (pl.strategy === 'optimizer' ? 1.02 : 1.1));
      const budget = Math.max(0, pl.cash - 20_000);
      this.place(pl, p, 'buy', limit, Math.min(short, Math.floor(budget / limit)));
    }
    // trader: hace de creador de mercado chico en materias primas
    if (pl.strategy === 'trader') {
      for (const p of ['wheat', 'wood', 'ore', 'energy'] as ProductId[]) {
        const ref = this.ref(p);
        if (pl.orders.length < this.E.maxOpenOrders - 1 && pl.cash > 200_000) this.place(pl, p, 'buy', Math.round(ref * 0.9), 50);
      }
    }
    // invertir: hasta 3 acciones por visita, guardando una reserva
    for (let k = 0; k < 3; k++) {
      const act = this.chooseInvestment(pl);
      if (!act || !act()) break;
    }
    if (pl.paybackHours === null && pl.firstBuildAt && pl.opFlow >= pl.firstCost) pl.paybackHours = (this.now - pl.firstBuildAt) / HOUR;
  }

  /** arbitrajista: busca comprar barato y vender caro sin producir nada */
  private actArb(pl: Player) {
    for (const p of PRODUCTS) {
      const ask = this.bestAsk(p, pl.district), bid = this.bestBid(p, pl.district, pl);
      if (!isFinite(ask) || bid * (1 - this.E.marketFeeBp / 10_000) <= ask) continue;
      const before = pl.cash + (pl.inv[p] ?? 0) * this.ref(p);
      const bought = this.place(pl, p, 'buy', ask, Math.floor(Math.min(pl.cash * 0.5, 2_000_000) / ask));
      if (bought.filled) this.place(pl, p, 'sell', bid, pl.inv[p] ?? 0);
      pl.arbProfit += pl.cash + (pl.inv[p] ?? 0) * this.ref(p) - before;
    }
    for (const o of [...pl.orders]) this.cancel(pl, o);
  }

  /**
   * Lavado de precios: dos cuentas propias se compran entre sí a precio inflado para subir la ref,
   * y después venden producción real al Estado (0,70 × ref inflada).
   */
  private actWash(pl: Player) {
    const mate = pl.partner;
    const target: ProductId = 'flour';
    if (!mate) return;
    for (let i = 0; i < 6; i++) {
      // le doy una unidad al socio y él la vende cara a mí (pago ida y vuelta, solo pierdo la comisión)
      if ((mate.inv[target] ?? 0) < 1) {
        const got = this.place(pl, target, 'buy', Math.round(this.ref(target) * 1.3), 1);
        if (got.filled) { pl.inv[target]! -= 1; mate.inv[target] = (mate.inv[target] ?? 0) + 1; }
      }
      const hi = Math.round(this.ref(target) * 5);
      this.place(mate, target, 'sell', hi, 1);
      this.place(pl, target, 'buy', hi, 1);
      for (const o of [...mate.orders]) this.cancel(mate, o);
      for (const o of [...pl.orders]) this.cancel(pl, o);
    }
    // cosecha: compra al bot barato y vende al Estado a 0,70 × ref inflada
    const before = pl.cash + mate.cash;
    const ask = this.bestAsk(target, pl.district), bid = this.bestBid(target, pl.district, pl);
    if (isFinite(ask) && bid * 0.97 > ask) {
      const got = this.place(pl, target, 'buy', ask, 200);
      if (got.filled) this.place(pl, target, 'sell', bid, pl.inv[target] ?? 0);
    }
    pl.arbProfit += pl.cash + mate.cash - before;
  }

  // ---------- reloj ----------

  private closeDay() {
    for (const p of PRODUCTS) this.closes.get(p)!.push(this.ref(p));
    // podar
    const fromH = Math.floor((this.now - this.E.refWindowMs) / HOUR) - 1;
    for (const p of PRODUCTS) {
      for (const h of this.stats.get(p)!.keys()) if (h < fromH) this.stats.get(p)!.delete(h);
      for (const h of this.ordersHourly.get(p)!.keys()) if (h < fromH) this.ordersHourly.get(p)!.delete(h);
      const pairs = this.pairs.get(p)!;
      for (const [k, at] of pairs) if (this.now - at > this.E.refWindowMs) pairs.delete(k);
    }
    for (const k of this.stateUse.keys()) if (Number(k.split(':')[0]) < Math.floor(this.now / DAY) - 1) this.stateUse.delete(k);
    // jugadores activos por distrito (vistos en los últimos 3 días, sin tramposos)
    this.activeByDistrict.clear();
    for (const pl of this.players) if (HONEST.includes(pl.strategy) && this.now - pl.lastSeen < 3 * DAY) this.activeByDistrict.set(pl.district, (this.activeByDistrict.get(pl.district) ?? 0) + 1);
  }

  netWorth(pl: Player) {
    const escrow = pl.orders.reduce((a, o) => a + o.escrow, 0);
    const goods = PRODUCTS.reduce((a, p) => a + ((pl.inv[p] ?? 0) + pl.orders.filter((o) => o.side === 'sell' && o.product === p).reduce((s, o) => s + o.qty, 0)) * this.ref(p), 0);
    return pl.cash + escrow + goods + pl.invested;
  }

  moneySupply() {
    let m = 0;
    for (const pl of this.players) m += pl.cash + pl.orders.reduce((a, o) => a + o.escrow, 0);
    return m;
  }

  expectedMoney() {
    const k = this.money;
    return k.start + k.botBuys + k.stateBuys - k.botSells - k.stateSells - k.fees - k.maintenance - k.lots - k.builds;
  }

  run() {
    const { players, days, cheaters, launchShare } = this.cfg;
    const strategies: [Strategy, number][] = [['farmer', 0.3], ['chain', 0.22], ['optimizer', 0.15], ['casual', 0.2], ['trader', 0.05], ['idle', 0.08]];
    const pick = (): Strategy => { let x = this.r(); for (const [s, w] of strategies) { x -= w; if (x <= 0) return s; } return 'farmer'; };
    const arrivals: number[] = [];
    const launch = Math.floor(players * launchShare);
    for (let i = 0; i < players; i++) arrivals.push(i < launch ? 0 : Math.floor(this.r() * 30 * 24));
    arrivals.sort((a, b) => a - b);
    let ai = 0;
    for (let i = 0; i < cheaters; i++) {
      if (i % 2 === 0) this.addPlayer('arb');
      else {
        const a = this.addPlayer('wash'), b = this.addPlayer('wash', a.district);
        a.partner = b; b.partner = undefined;
        b.nextCheck = Infinity;
      }
    }
    this.closeDay();
    for (let h = 0; h < days * 24; h++) {
      this.now = T0 + h * HOUR;
      this.refCache.clear();
      while (ai < arrivals.length && arrivals[ai] <= h) { this.addPlayer(pick()); ai++; }
      const due = this.players.filter((pl) => pl.nextCheck <= this.now + HOUR && pl.activeUntil > this.now);
      due.sort((a, b) => a.nextCheck - b.nextCheck);
      for (const pl of due) {
        this.now = Math.max(this.now, pl.nextCheck);
        this.refCache.clear();
        this.act(pl);
        pl.nextCheck = this.now + this.checkInterval(pl.strategy);
      }
      this.now = T0 + (h + 1) * HOUR;
      if ((h + 1) % 24 === 0) {
        this.refCache.clear();
        this.closeDay();
        this.recordDay((h + 1) / 24);
      }
    }
    return this;
  }

  private recordDay(day: number) {
    const idx = PRODUCTS.reduce((a, p) => a + this.ref(p) / BASE_VALUE[p], 0) / PRODUCTS.length;
    const honestActive = this.players.filter((p) => HONEST.includes(p.strategy) && p.activeUntil > this.now);
    const row: Record<string, number> = {
      day, index: idx, money: this.moneySupply(), drift: this.moneySupply() - this.expectedMoney(),
      active: honestActive.length, humanVol: this.volume.humanHuman, botVol: this.volume.vsBot, stateVol: this.volume.vsState,
    };
    for (const p of PRODUCTS) row[`ref_${p}`] = this.ref(p);
    this.daily.push(row);
    if (day === 30 || day === this.cfg.days) this.wealthAt[day] = honestActive.map((p) => this.netWorth(p)).sort((a, b) => a - b);
    this.cfg.log?.(`día ${day}: índice ${idx.toFixed(3)} · activos ${honestActive.length} · masa ₣${Math.round(row.money / 100).toLocaleString('es-AR')} · desvío ${row.drift}`);
  }
}

