// Durable Object "World": estado económico autoritativo en SQLite, serializado (sin condiciones de carrera).
// Ejecución perezosa: la producción, el mantenimiento y los bots se calculan al consultar, sin cron.
import { DurableObject } from 'cloudflare:workers';
import {
  BASE_VALUE, BUILDING_IDS, BUILDINGS, DISTRICTS, ECON, MAX_LEVEL, PRODUCTS, PRODUCT_TIER,
  applyHumanPriority, botQuotes, buildingValue, collect, isStateLot, lotDistrict, lotNeighbors, lotRing,
  marketFee, matchOrder, neighborBonusPct, pendingUnits, rateMilli, refPrice, stateLots, stateQuotes,
  storageCapacity, upgradeCost,
  type BookLevel, type BuildingId, type CompanyView, type ErrorCode, type Inventory, type Level, type LotState,
  type MapCompany, type MarketDetail, type MarketSummary, type MeResponse, type OrderView, type ProductId,
  type Side, type TradeStats,
} from '@portlight/shared';
import type { Env } from './index';
import { checkName, nameKey } from './names';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const BOT = 0;
const STATE = -1;

class HttpError extends Error {
  constructor(public code: ErrorCode, public status = 400) { super(code); }
}
const fail = (code: ErrorCode, status = 400): never => { throw new HttpError(code, status); };

interface Company {
  id: number; userId: number; name: string; color: number; district: number;
  cash: number; inv: Inventory; freeClaims: number; maintAt: number; createdAt: number;
  lots: LotState[];
}
interface Order {
  id: number; companyId: number; product: ProductId; side: Side;
  price: number; qty: number; filled: number; escrow: number; createdAt: number;
}
interface BotUsage { bucket: number; bidUsed: number; askUsed: number; day: number; dayBought: number; daySold: number }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, lang TEXT, ref TEXT);
CREATE TABLE IF NOT EXISTS companies(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
  color INTEGER NOT NULL, district INTEGER NOT NULL, cash INTEGER NOT NULL, inv TEXT NOT NULL, free_claims INTEGER NOT NULL,
  maint_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS companies_user ON companies(user_id);
CREATE TABLE IF NOT EXISTS lots(lot INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, building TEXT, level INTEGER NOT NULL,
  mode INTEGER NOT NULL, last_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS lots_company ON lots(company_id);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, product TEXT NOT NULL, side TEXT NOT NULL,
  price INTEGER NOT NULL, qty INTEGER NOT NULL, filled INTEGER NOT NULL, escrow INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS trades(id INTEGER PRIMARY KEY, product TEXT NOT NULL, price INTEGER NOT NULL, qty INTEGER NOT NULL,
  buyer INTEGER NOT NULL, seller INTEGER NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS trades_product_at ON trades(product, at);
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, company_id INTEGER NOT NULL, delta INTEGER NOT NULL,
  reason TEXT NOT NULL, ref INTEGER);
CREATE TABLE IF NOT EXISTS trade_hourly(product TEXT NOT NULL, hour INTEGER NOT NULL, n INTEGER NOT NULL, qty INTEGER NOT NULL,
  value INTEGER NOT NULL, PRIMARY KEY(product, hour)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS order_hourly(product TEXT NOT NULL, hour INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(product, hour)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS price_daily(product TEXT NOT NULL, day INTEGER NOT NULL, ref INTEGER NOT NULL, PRIMARY KEY(product, day)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS bot_usage(product TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS state_quota(day INTEGER NOT NULL, district INTEGER NOT NULL, product TEXT NOT NULL, bought INTEGER NOT NULL,
  sold INTEGER NOT NULL, PRIMARY KEY(day, district, product)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
`;

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const etagOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `"${(h >>> 0).toString(36)}${s.length.toString(36)}"`;
};

const sha256 = async (s: string) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isProduct = (p: unknown): p is ProductId => typeof p === 'string' && (PRODUCTS as readonly string[]).includes(p);

export class World extends DurableObject<Env> {
  private sql: SqlStorage;
  private companies = new Map<number, Company>();
  private tokens = new Map<string, number>();
  private orders = new Map<number, Order>();
  private tradeStats = new Map<ProductId, Map<number, TradeStats>>();
  private orderHourly = new Map<ProductId, Map<number, number>>();
  private botUsage = new Map<ProductId, BotUsage>();
  /** lote → [compañía, índice de edificio (-1 vacío), nivel] */
  private mapLots = new Map<number, [number, number, number]>();
  private mapCompanies = new Map<number, MapCompany>();
  private lastClosedDay = 0;
  private cache = new Map<string, { at: number; body: string; etag: string }>();
  private reqDay = 0;
  private reqCount = 0;
  private writeLimiter = new Map<number, { at: number; n: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.init());
  }

  private init() {
    this.sql.exec(SCHEMA);
    const now = Date.now();
    for (const r of this.sql.exec<{ id: number; company_id: number; product: string; side: string; price: number; qty: number; filled: number; escrow: number; created_at: number }>('SELECT * FROM orders')) {
      this.orders.set(r.id, { id: r.id, companyId: r.company_id, product: r.product as ProductId, side: r.side as Side, price: r.price, qty: r.qty, filled: r.filled, escrow: r.escrow, createdAt: r.created_at });
    }
    const fromHour = Math.floor((now - ECON.refWindowMs) / HOUR);
    for (const r of this.sql.exec<{ product: string; hour: number; n: number; qty: number; value: number }>('SELECT * FROM trade_hourly WHERE hour >= ?', fromHour)) {
      this.statsFor(r.product as ProductId).set(r.hour, { n: r.n, qty: r.qty, value: r.value });
    }
    for (const r of this.sql.exec<{ product: string; hour: number; n: number }>('SELECT * FROM order_hourly WHERE hour >= ?', Math.floor((now - DAY) / HOUR))) {
      this.ordersFor(r.product as ProductId).set(r.hour, r.n);
    }
    for (const r of this.sql.exec<{ product: string; v: string }>('SELECT * FROM bot_usage')) this.botUsage.set(r.product as ProductId, JSON.parse(r.v));
    const meta = (k: string) => this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v;
    this.lastClosedDay = Number(meta('closed_day') ?? Math.floor(now / DAY) - 1);
    const req = JSON.parse(meta('requests') ?? '{"day":0,"n":0}');
    this.reqDay = req.day; this.reqCount = req.n;
    const map = meta('map');
    if (map) {
      const m = JSON.parse(map) as { lots: number[]; companies: MapCompany[] };
      for (let i = 0; i < m.lots.length; i += 4) this.mapLots.set(m.lots[i], [m.lots[i + 1], m.lots[i + 2], m.lots[i + 3]]);
      for (const c of m.companies) this.mapCompanies.set(c.id, c);
    }
  }

  // ---------- infraestructura ----------

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const now = Date.now();
    try {
      this.countRequest(now);
      this.closeDays(now);
      const path = url.pathname.replace(/^\/api/, '');
      const text = req.method === 'POST' ? await req.text() : '';
      let body: Record<string, unknown> = {};
      if (text) { try { body = JSON.parse(text); } catch { fail('bad_request'); } }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) fail('bad_request');
      if (req.method !== 'GET' && this.saving(now) >= 2 && path !== '/start') fail('read_only', 503);

      if (req.method === 'GET' && path === '/market') return this.cached(req, 'market', 30_000, now, () => this.marketSummary(now));
      if (req.method === 'GET' && path.startsWith('/market/')) {
        const p = path.slice(8);
        if (!isProduct(p)) fail('not_found', 404);
        return this.cached(req, `market:${p}`, 15_000, now, () => this.marketDetail(p as ProductId, now));
      }
      if (req.method === 'GET' && path === '/map') return this.cached(req, 'map', 30_000, now, () => this.mapSnapshot(now));
      if (req.method === 'POST' && path === '/start') return json(await this.start(body, now));

      const c = await this.auth(req);
      if (req.method === 'GET' && path === '/me') return json(this.me(c, now));
      if (req.method !== 'GET') this.limitWrites(c.id, now);
      if (req.method === 'POST' && path === '/claim') return json(this.claim(c, body, now));
      if (req.method === 'POST' && path === '/build') return json(this.build(c, body, now));
      if (req.method === 'POST' && path === '/upgrade') return json(this.upgrade(c, body, now));
      if (req.method === 'POST' && path === '/mode') return json(this.setMode(c, body, now));
      if (req.method === 'POST' && path === '/collect') return json(this.collectAll(c, now));
      if (req.method === 'POST' && path === '/orders') return json(this.placeOrder(c, body, now));
      if (req.method === 'DELETE' && path.startsWith('/orders/')) return json(this.cancelOrder(c, Number(path.slice(8)), now));
      return fail('not_found', 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status);
      console.error('internal', (e as Error)?.stack ?? e);
      return json({ error: 'internal' }, 500);
    }
  }

  private cached(req: Request, key: string, ttl: number, now: number, build: () => unknown) {
    let c = this.cache.get(key);
    if (!c || now - c.at > ttl) {
      const body = JSON.stringify(build());
      c = { at: now, body, etag: etagOf(body) };
      this.cache.set(key, c);
    }
    const maxAge = Math.max(1, Math.floor((ttl - (now - c.at)) / 1000));
    const headers = { etag: c.etag, 'cache-control': `public, max-age=${maxAge}` };
    if (req.headers.get('if-none-match') === c.etag) return new Response(null, { status: 304, headers });
    return new Response(c.body, { headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
  }

  private countRequest(now: number) {
    const day = Math.floor(now / DAY);
    if (day !== this.reqDay) { this.reqDay = day; this.reqCount = 0; }
    this.reqCount++;
    // se persiste cada 25 requests para no gastar escrituras (se tolera perder algunas si el objeto se reinicia)
    if (this.reqCount % 25 === 0) this.putMeta('requests', JSON.stringify({ day: this.reqDay, n: this.reqCount }));
  }

  /** 0 normal, 1 ahorro (≥80 % de la cuota diaria), 2 solo lectura (≥100 %) */
  private saving(now: number) {
    if (Math.floor(now / DAY) !== this.reqDay) return 0;
    const budget = Number(this.env.DAILY_REQUEST_BUDGET || 100_000);
    return this.reqCount >= budget ? 2 : this.reqCount >= budget * 0.8 ? 1 : 0;
  }

  private limitWrites(companyId: number, now: number) {
    const w = this.writeLimiter.get(companyId);
    if (!w || now - w.at > 60_000) { this.writeLimiter.set(companyId, { at: now, n: 1 }); return; }
    if (++w.n > 40) fail('rate_limited', 429);
  }

  private putMeta(k: string, v: string) {
    this.sql.exec('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
  }

  /** El mapa se guarda como un único blob: 1 fila escrita por cambio, y 1 fila leída al despertar. */
  private saveMap() {
    this.putMeta('map', JSON.stringify({ lots: this.flatLots(), companies: [...this.mapCompanies.values()] }));
    this.cache.delete('map');
  }

  /** Cierre diario perezoso: guarda la ref de cierre y poda datos viejos. */
  private closeDays(now: number) {
    const today = Math.floor(now / DAY);
    if (this.lastClosedDay >= today - 1) return;
    const day = today - 1;
    this.ctx.storage.transactionSync(() => {
      for (const p of PRODUCTS) this.sql.exec('INSERT OR REPLACE INTO price_daily(product, day, ref) VALUES(?, ?, ?)', p, day, this.ref(p, now));
      this.sql.exec('DELETE FROM trade_hourly WHERE hour < ?', Math.floor((now - ECON.refWindowMs) / HOUR) - 1);
      this.sql.exec('DELETE FROM order_hourly WHERE hour < ?', Math.floor((now - DAY) / HOUR) - 1);
      this.sql.exec('DELETE FROM state_quota WHERE day < ?', today - 1);
      this.sql.exec('DELETE FROM trades WHERE at < ?', now - 8 * DAY);
      this.sql.exec('DELETE FROM price_daily WHERE day < ?', today - 30);
      this.sql.exec("INSERT INTO meta(k, v) VALUES('closed_day', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(day));
    });
    this.lastClosedDay = day;
  }

  // ---------- cuentas ----------

  private async start(b: Record<string, unknown>, now: number) {
    const name = checkName(b.name);
    if (!name) fail('name_invalid');
    if (!isInt(b.district, 0, DISTRICTS.length - 1)) fail('district_invalid');
    const color = isInt(b.color, 0, 0xffffff) ? b.color : 0xf2a93b;
    const key = nameKey(name!);
    if (this.sql.exec('SELECT 1 FROM companies WHERE name_key = ?', key).toArray().length) fail('name_taken');
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
    const hash = await sha256(token);
    const lang = typeof b.lang === 'string' && /^[a-z]{2}$/.test(b.lang) ? b.lang : 'es';
    const ref = typeof b.ref === 'string' && /^[A-Za-z0-9]{1,16}$/.test(b.ref) ? b.ref : null;
    let company!: Company;
    this.ctx.storage.transactionSync(() => {
      const userId = this.sql.exec<{ id: number }>('INSERT INTO users(token_hash, created_at, lang, ref) VALUES(?, ?, ?, ?) RETURNING id', hash, now, lang, ref).one().id;
      const id = this.sql.exec<{ id: number }>(
        'INSERT INTO companies(user_id, name, name_key, color, district, cash, inv, free_claims, maint_at, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        userId, name, key, color, b.district, ECON.startCash, '{}', ECON.freeLots, now, now).one().id;
      company = { id, userId, name: name!, color, district: b.district as number, cash: ECON.startCash, inv: {}, freeClaims: ECON.freeLots, maintAt: now, createdAt: now, lots: [] };
      this.ledger(now, id, ECON.startCash, 'start');
    });
    this.companies.set(company.id, company);
    this.tokens.set(hash, company.id);
    this.mapCompanies.set(company.id, { id: company.id, name: company.name, color: company.color, district: company.district });
    this.saveMap();
    return { token, me: this.me(company, now) };
  }

  private async auth(req: Request): Promise<Company> {
    const m = /^Bearer ([A-Za-z0-9_-]{20,64})$/.exec(req.headers.get('authorization') ?? '');
    if (!m) fail('unauthorized', 401);
    const hash = await sha256(m![1]);
    let id = this.tokens.get(hash);
    if (id === undefined) {
      const row = this.sql.exec<{ id: number }>('SELECT c.id FROM users u JOIN companies c ON c.user_id = u.id WHERE u.token_hash = ?', hash).toArray()[0];
      if (!row) fail('unauthorized', 401);
      id = row.id;
      this.tokens.set(hash, id);
    }
    return this.company(id!);
  }

  private company(id: number): Company {
    let c = this.companies.get(id);
    if (c) return c;
    const r = this.sql.exec<{ id: number; user_id: number; name: string; color: number; district: number; cash: number; inv: string; free_claims: number; maint_at: number; created_at: number }>('SELECT * FROM companies WHERE id = ?', id).toArray()[0];
    if (!r) fail('not_found', 404);
    const lots = this.sql.exec<{ lot: number; building: string | null; level: number; mode: number; last_at: number }>('SELECT * FROM lots WHERE company_id = ?', id)
      .toArray().map((l) => ({ lot: l.lot, building: l.building as BuildingId | null, level: l.level, mode: l.mode, lastAt: l.last_at }));
    c = { id: r.id, userId: r.user_id, name: r.name, color: r.color, district: r.district, cash: r.cash, inv: JSON.parse(r.inv), freeClaims: r.free_claims, maintAt: r.maint_at, createdAt: r.created_at, lots };
    if (this.companies.size > 5000) this.companies.clear();
    this.companies.set(id, c);
    return c;
  }

  private saveCompany(c: Company) {
    this.sql.exec('UPDATE companies SET cash = ?, inv = ?, free_claims = ?, maint_at = ? WHERE id = ?', c.cash, JSON.stringify(c.inv), c.freeClaims, c.maintAt, c.id);
  }

  private saveLot(c: Company, l: LotState) {
    this.sql.exec('INSERT INTO lots(lot, company_id, building, level, mode, last_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(lot) DO UPDATE SET building = excluded.building, level = excluded.level, mode = excluded.mode, last_at = excluded.last_at',
      l.lot, c.id, l.building, l.level, l.mode, l.lastAt);
    this.mapLots.set(l.lot, [c.id, l.building ? BUILDING_IDS.indexOf(l.building) : -1, l.level]);
    this.saveMap();
  }

  private ledger(now: number, companyId: number, delta: number, reason: string, ref: number | null = null) {
    if (delta !== 0) this.sql.exec('INSERT INTO ledger(at, company_id, delta, reason, ref) VALUES(?, ?, ?, ?, ?)', now, companyId, delta, reason, ref);
  }

  /** mantenimiento perezoso: 0,5 % diario del valor invertido, cobrado al actuar */
  private settle(c: Company, now: number) {
    const value = c.lots.reduce((s, l) => s + (l.building ? buildingValue(l.building, l.level) : 0), 0);
    const due = Math.floor((value * ECON.maintenanceBpPerDay * Math.max(0, now - c.maintAt)) / (10_000 * DAY));
    if (due < 100) return;
    const paid = Math.min(due, c.cash);
    c.cash -= paid;
    c.maintAt = now;
    this.ledger(now, c.id, -paid, 'maintenance');
  }

  // ---------- empresa ----------

  private bonusOf = (l: LotState) => {
    if (!l.building) return 0;
    const neighbors = lotNeighbors(l.lot).map((n) => {
      const m = this.mapLots.get(n);
      if (m) return m[1] >= 0 ? BUILDING_IDS[m[1]] : null;
      const s = stateLots(lotDistrict(n)).find((x) => x.lot === n);
      return s ? s.building : null;
    });
    return neighborBonusPct(l.building, neighbors);
  };

  private capacity(c: Company) {
    return storageCapacity(c.lots.filter((l) => l.building === 'warehouse').map((l) => l.level));
  }

  private me(c: Company, now: number): MeResponse {
    const view: CompanyView = { id: c.id, name: c.name, color: c.color, district: c.district, cash: c.cash, inv: c.inv, capacity: this.capacity(c), freeClaims: c.freeClaims, createdAt: c.createdAt };
    const lots = c.lots.map((l) => {
      const bonus = this.bonusOf(l);
      return { ...l, bonus, pending: pendingUnits(l, now, bonus) };
    });
    const orders: OrderView[] = [...this.orders.values()].filter((o) => o.companyId === c.id)
      .map(({ id, product, side, price, qty, filled, createdAt }) => ({ id, product, side, price, qty, filled, createdAt }));
    return { now, company: view, lots, orders };
  }

  private ownedLot(c: Company, lot: unknown) {
    const l = c.lots.find((x) => x.lot === lot);
    if (!l) fail('lot_not_owned');
    return l!;
  }

  private claim(c: Company, b: Record<string, unknown>, now: number) {
    const lot = b.lot;
    if (!isInt(lot, 0, DISTRICTS.length * 64 - 1)) fail('bad_request');
    if (isStateLot(lot as number)) fail('lot_state');
    if (this.mapLots.has(lot as number)) fail('lot_taken');
    if (c.lots.length >= ECON.maxLots) fail('lot_limit');
    if (lotDistrict(lot as number) !== c.district) fail('lot_district');
    const ring = lotRing(lot as number);
    const free = c.freeClaims > 0 && ring === 0;
    const price = free ? 0 : ECON.lotPrice[ring];
    this.ctx.storage.transactionSync(() => {
      this.settle(c, now);
      if (c.cash < price) fail('no_cash');
      c.cash -= price;
      if (free) c.freeClaims--;
      this.ledger(now, c.id, -price, 'lot', lot as number);
      const l: LotState = { lot: lot as number, building: null, level: 0, mode: 0, lastAt: now };
      c.lots.push(l);
      this.saveLot(c, l);
      this.saveCompany(c);
    });
    return this.me(c, now);
  }

  private build(c: Company, b: Record<string, unknown>, now: number) {
    const l = this.ownedLot(c, b.lot);
    if (l.building) fail('lot_busy');
    const bid = b.building as BuildingId;
    if (!(BUILDING_IDS as readonly string[]).includes(bid) || !BUILDINGS[bid].enabled) fail('building_invalid');
    const mode = isInt(b.mode, 0, BUILDINGS[bid].recipes.length - 1) ? b.mode : 0;
    this.ctx.storage.transactionSync(() => {
      this.settle(c, now);
      const cost = BUILDINGS[bid].cost;
      if (c.cash < cost) fail('no_cash');
      c.cash -= cost;
      this.ledger(now, c.id, -cost, 'build', l.lot);
      Object.assign(l, { building: bid, level: 1, mode, lastAt: now });
      this.saveLot(c, l);
      this.saveCompany(c);
    });
    return this.me(c, now);
  }

  private upgrade(c: Company, b: Record<string, unknown>, now: number) {
    const l = this.ownedLot(c, b.lot);
    if (!l.building) fail('building_invalid');
    if (l.level >= MAX_LEVEL) fail('max_level');
    this.ctx.storage.transactionSync(() => {
      this.settle(c, now);
      const cost = upgradeCost(l.building!, l.level);
      if (c.cash < cost) fail('no_cash');
      c.cash -= cost;
      this.ledger(now, c.id, -cost, 'upgrade', l.lot);
      // conserva exactamente lo acumulado: se reescala el tiempo al nuevo ritmo
      const bonus = this.bonusOf(l);
      const oldRate = rateMilli(l, bonus);
      const start = Math.max(l.lastAt, now - ECON.maxOfflineMs);
      l.level++;
      const newRate = rateMilli(l, bonus);
      if (oldRate > 0 && newRate > 0) l.lastAt = now - Math.floor(((now - start) * oldRate) / newRate);
      this.saveLot(c, l);
      this.saveCompany(c);
    });
    return this.me(c, now);
  }

  private setMode(c: Company, b: Record<string, unknown>, now: number) {
    const l = this.ownedLot(c, b.lot);
    if (!l.building || !isInt(b.mode, 0, BUILDINGS[l.building].recipes.length - 1)) fail('bad_request');
    l.mode = b.mode as number;
    this.saveLot(c, l);
    return this.me(c, now);
  }

  private collectAll(c: Company, now: number) {
    const r = collect(c.lots, c.inv, this.capacity(c), now, this.bonusOf);
    this.ctx.storage.transactionSync(() => {
      this.settle(c, now);
      c.inv = r.inv;
      for (const ch of r.lots) {
        const l = c.lots.find((x) => x.lot === ch.lot)!;
        l.lastAt = ch.lastAt;
        this.sql.exec('UPDATE lots SET last_at = ? WHERE lot = ?', l.lastAt, l.lot);
      }
      this.saveCompany(c);
    });
    return { me: this.me(c, now), produced: r.produced, blocked: r.blocked };
  }

  // ---------- mercado ----------

  private statsFor(p: ProductId) {
    let m = this.tradeStats.get(p);
    if (!m) this.tradeStats.set(p, (m = new Map()));
    return m;
  }

  private ordersFor(p: ProductId) {
    let m = this.orderHourly.get(p);
    if (!m) this.orderHourly.set(p, (m = new Map()));
    return m;
  }

  private ref(p: ProductId, now: number) {
    const from = Math.floor((now - ECON.refWindowMs) / HOUR);
    const s: TradeStats = { n: 0, qty: 0, value: 0 };
    for (const [h, v] of this.statsFor(p)) if (h >= from) { s.n += v.n; s.qty += v.qty; s.value += v.value; }
    return refPrice(p, s);
  }

  private realOrders24h(p: ProductId, now: number) {
    const from = Math.floor((now - DAY) / HOUR);
    let n = 0;
    for (const [h, v] of this.ordersFor(p)) if (h >= from) n += v;
    return n;
  }

  private usage(p: ProductId, now: number): BotUsage {
    const bucket = Math.floor(now / ECON.botBucketMs), day = Math.floor(now / DAY);
    let u = this.botUsage.get(p) ?? { bucket, bidUsed: 0, askUsed: 0, day, dayBought: 0, daySold: 0 };
    if (u.bucket !== bucket) u = { ...u, bucket, bidUsed: 0, askUsed: 0 };
    if (u.day !== day) u = { ...u, day, dayBought: 0, daySold: 0 };
    this.botUsage.set(p, u);
    return u;
  }

  private stateQuota(day: number, district: number, p: ProductId) {
    const r = this.sql.exec<{ bought: number; sold: number }>('SELECT bought, sold FROM state_quota WHERE day = ? AND district = ? AND product = ?', day, district, p).toArray()[0];
    return r ?? { bought: 0, sold: 0 };
  }

  private humanBook(p: ProductId, side: Side, exclude?: number) {
    return [...this.orders.values()].filter((o) => o.product === p && o.side === side && o.companyId !== exclude);
  }

  /** niveles de los bots y del Estado (virtuales: no se escriben hasta que alguien opera) */
  private virtualLevels(p: ProductId, now: number, district: number | null) {
    const ref = this.ref(p, now);
    const bids = this.humanBook(p, 'buy'), asks = this.humanBook(p, 'sell');
    const bestBid = bids.length ? Math.max(...bids.map((o) => o.price)) : undefined;
    const bestAsk = asks.length ? Math.min(...asks.map((o) => o.price)) : undefined;
    const q = applyHumanPriority(botQuotes(p, ref, now, this.realOrders24h(p, now)), ref, bestBid, bestAsk);
    const u = this.usage(p, now);
    const dayCap = q.bid.qty * ECON.botDailyBuckets;
    const botBid: Level = { kind: 'bot', price: q.bid.price, qty: Math.max(0, Math.min(q.bid.qty - u.bidUsed, dayCap - u.dayBought)) };
    const botAsk: Level = { kind: 'bot', price: q.ask.price, qty: Math.max(0, Math.min(q.ask.qty - u.askUsed, dayCap - u.daySold)) };
    const st = stateQuotes(ref);
    const levels = { ref, bids: [botBid], asks: [botAsk] };
    if (district !== null) {
      const sq = this.stateQuota(Math.floor(now / DAY), district, p);
      const cap = ECON.stateDailyQty[PRODUCT_TIER[p]];
      levels.bids.push({ kind: 'state', price: st.bid, qty: Math.max(0, cap - sq.bought) });
      levels.asks.push({ kind: 'state', price: st.ask, qty: Math.max(0, cap - sq.sold) });
    }
    return levels;
  }

  private placeOrder(c: Company, b: Record<string, unknown>, now: number) {
    if (!isProduct(b.product) || (b.side !== 'buy' && b.side !== 'sell') || !isInt(b.qty, 1, 100_000) || !isInt(b.price, 1, 1e9)) fail('order_invalid');
    const p = b.product as ProductId, side = b.side as Side, qty = b.qty as number, limit = b.price as number;
    const ref = this.ref(p, now);
    if (limit < Math.floor(ref / 5) || limit > ref * 5) fail('order_invalid');
    const open = [...this.orders.values()].filter((o) => o.companyId === c.id).length;
    if (open >= ECON.maxOpenOrders) fail('order_limit');

    let filled = 0, spent = 0;
    this.ctx.storage.transactionSync(() => {
      this.settle(c, now);
      if (side === 'sell' && (c.inv[p] ?? 0) < qty) fail('no_stock');
      if (side === 'buy' && c.cash < limit * qty) fail('no_cash');
      if (side === 'sell') c.inv[p] = (c.inv[p] ?? 0) - qty; // los bienes quedan reservados

      const v = this.virtualLevels(p, now, c.district);
      const human: Level[] = this.humanBook(p, side === 'buy' ? 'sell' : 'buy', c.id)
        .map((o) => ({ kind: 'human', price: o.price, qty: o.qty - o.filled, orderId: o.id, companyId: o.companyId }));
      const fills = matchOrder(side, limit, qty, [...human, ...(side === 'buy' ? v.asks : v.bids)]);

      const hour = Math.floor(now / HOUR);
      const u = this.usage(p, now);
      for (const f of fills) {
        const value = f.price * f.qty;
        const fee = marketFee(value);
        filled += f.qty; spent += value;
        let counterparty = f.level.kind === 'bot' ? BOT : STATE;
        if (f.level.kind === 'human') {
          const o = this.orders.get(f.level.orderId!)!;
          const other = this.company(o.companyId);
          counterparty = other.id;
          o.filled += f.qty;
          if (o.side === 'buy') { // el otro compra: paga desde su reserva, recibe bienes
            o.escrow -= value;
            other.inv[p] = (other.inv[p] ?? 0) + f.qty;
          } else { // el otro vende: cobra
            other.cash += value - fee;
            this.ledger(now, other.id, value - fee, 'sell', o.id);
          }
          if (o.filled >= o.qty) this.closeOrder(o, other, now);
          else this.sql.exec('UPDATE orders SET filled = ?, escrow = ? WHERE id = ?', o.filled, o.escrow, o.id);
          this.saveCompany(other);
          const s = this.statsFor(p), cur = s.get(hour) ?? { n: 0, qty: 0, value: 0 };
          s.set(hour, { n: cur.n + 1, qty: cur.qty + f.qty, value: cur.value + value });
          this.sql.exec('INSERT INTO trade_hourly(product, hour, n, qty, value) VALUES(?, ?, 1, ?, ?) ON CONFLICT(product, hour) DO UPDATE SET n = n + 1, qty = qty + excluded.qty, value = value + excluded.value', p, hour, f.qty, value);
        } else if (f.level.kind === 'bot') {
          if (side === 'sell') { u.bidUsed += f.qty; u.dayBought += f.qty; } else { u.askUsed += f.qty; u.daySold += f.qty; }
        } else {
          const day = Math.floor(now / DAY);
          this.sql.exec(`INSERT INTO state_quota(day, district, product, bought, sold) VALUES(?, ?, ?, ?, ?)
            ON CONFLICT(day, district, product) DO UPDATE SET bought = bought + excluded.bought, sold = sold + excluded.sold`,
            day, c.district, p, side === 'sell' ? f.qty : 0, side === 'buy' ? f.qty : 0);
        }
        if (side === 'buy') {
          c.cash -= value;
          c.inv[p] = (c.inv[p] ?? 0) + f.qty;
          this.ledger(now, c.id, -value, 'buy');
        } else {
          c.cash += value - fee;
          this.ledger(now, c.id, value - fee, 'sell');
        }
        this.sql.exec('INSERT INTO trades(product, price, qty, buyer, seller, at) VALUES(?, ?, ?, ?, ?, ?)', p, f.price, f.qty,
          side === 'buy' ? c.id : counterparty, side === 'buy' ? counterparty : c.id, now);
      }
      if (fills.some((f) => f.level.kind === 'bot')) this.sql.exec('INSERT OR REPLACE INTO bot_usage(product, v) VALUES(?, ?)', p, JSON.stringify(u));

      const rest = qty - filled;
      if (rest > 0) {
        const escrow = side === 'buy' ? limit * rest : 0;
        if (escrow) { c.cash -= escrow; this.ledger(now, c.id, -escrow, 'escrow'); }
        const id = this.sql.exec<{ id: number }>('INSERT INTO orders(company_id, product, side, price, qty, filled, escrow, created_at) VALUES(?, ?, ?, ?, ?, 0, ?, ?) RETURNING id',
          c.id, p, side, limit, rest, escrow, now).one().id;
        this.orders.set(id, { id, companyId: c.id, product: p, side, price: limit, qty: rest, filled: 0, escrow, createdAt: now });
      }
      const oh = this.ordersFor(p);
      oh.set(hour, (oh.get(hour) ?? 0) + 1);
      this.sql.exec('INSERT INTO order_hourly(product, hour, n) VALUES(?, ?, 1) ON CONFLICT(product, hour) DO UPDATE SET n = n + 1', p, hour);
      this.saveCompany(c);
    });
    this.cache.delete('market');
    this.cache.delete(`market:${p}`);
    return { me: this.me(c, now), filled, avgPrice: filled ? Math.round(spent / filled) : null };
  }

  /** cierra una orden: devuelve la reserva sobrante (dinero o bienes) */
  private closeOrder(o: Order, c: Company, now: number) {
    if (o.side === 'buy' && o.escrow > 0) { c.cash += o.escrow; this.ledger(now, c.id, o.escrow, 'release', o.id); }
    if (o.side === 'sell' && o.qty > o.filled) c.inv[o.product] = (c.inv[o.product] ?? 0) + (o.qty - o.filled);
    this.sql.exec('DELETE FROM orders WHERE id = ?', o.id);
    this.orders.delete(o.id);
  }

  private cancelOrder(c: Company, id: number, now: number) {
    const o = this.orders.get(id);
    if (!o || o.companyId !== c.id) fail('not_found', 404);
    this.ctx.storage.transactionSync(() => {
      this.closeOrder(o!, c, now);
      this.saveCompany(c);
    });
    this.cache.delete('market');
    this.cache.delete(`market:${o!.product}`);
    return this.me(c, now);
  }

  private marketSummary(now: number): MarketSummary {
    const yesterday = Math.floor(now / DAY) - 1;
    const prev = new Map(this.sql.exec<{ product: string; ref: number }>('SELECT product, ref FROM price_daily WHERE day = ?', yesterday).toArray().map((r) => [r.product, r.ref]));
    return {
      now,
      saving: this.saving(now),
      products: PRODUCTS.map((p) => {
        const v = this.virtualLevels(p, now, null);
        const bids = [...this.humanBook(p, 'buy').map((o) => o.price), ...v.bids.filter((l) => l.qty > 0).map((l) => l.price)];
        const asks = [...this.humanBook(p, 'sell').map((o) => o.price), ...v.asks.filter((l) => l.qty > 0).map((l) => l.price)];
        const before = prev.get(p) ?? BASE_VALUE[p];
        return { id: p, ref: v.ref, bid: bids.length ? Math.max(...bids) : null, ask: asks.length ? Math.min(...asks) : null, changeBp: Math.round(((v.ref - before) * 10_000) / before) };
      }),
    };
  }

  private marketDetail(p: ProductId, now: number): MarketDetail {
    const v = this.virtualLevels(p, now, null);
    const agg = (side: Side, extra: Level[]): BookLevel[] => {
      const m = new Map<string, BookLevel>();
      for (const o of this.humanBook(p, side)) {
        const k = `h${o.price}`;
        const cur = m.get(k) ?? { price: o.price, qty: 0, kind: 'human' as const };
        cur.qty += o.qty - o.filled;
        m.set(k, cur);
      }
      for (const l of extra) if (l.qty > 0) m.set(`b${l.price}`, { price: l.price, qty: l.qty, kind: l.kind });
      return [...m.values()].sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price)).slice(0, 10);
    };
    const trades = this.sql.exec<{ price: number; qty: number; at: number }>('SELECT price, qty, at FROM trades WHERE product = ? AND at >= ? ORDER BY at DESC LIMIT 20', p, now - 2 * DAY).toArray();
    const history = this.sql.exec<{ day: number; ref: number }>('SELECT day, ref FROM price_daily WHERE product = ? AND day >= ? ORDER BY day', p, Math.floor(now / DAY) - 7).toArray();
    history.push({ day: Math.floor(now / DAY), ref: v.ref });
    return { now, product: p, ref: v.ref, bids: agg('buy', v.bids), asks: agg('sell', v.asks), trades, history };
  }

  // ---------- mapa ----------

  private flatLots() {
    const out: number[] = [];
    for (const [lot, [c, b, l]] of this.mapLots) out.push(lot, c, b, l);
    return out;
  }

  private mapSnapshot(now: number) {
    const used = new Set<number>();
    for (const [, [c]] of this.mapLots) used.add(c);
    return {
      at: now,
      lots: this.flatLots(),
      companies: [...this.mapCompanies.values()].filter((c) => used.has(c.id)),
      players: this.mapCompanies.size,
    };
  }
}
