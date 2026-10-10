import { describe, expect, it } from 'vitest';
import {
  BASE_VALUE, DISTRICTS, ECON, LOTS_PER_DISTRICT, TOTAL_LOTS, applyHumanPriority, botFactorBp, botQuotes,
  collect, isStateLot, lotAtWorld, lotRing, lotWorld, maintenanceDue, matchOrder, refPrice, stateLots,
  type LotState,
} from '../src';

const H = 3_600_000;
const lot = (p: Partial<LotState>): LotState => ({ lot: 0, building: 'farm', level: 1, mode: 0, lastAt: 0, ...p });

describe('producción perezosa', () => {
  it('produce 12 trigo por hora en una granja nivel 1', () => {
    const r = collect([lot({})], {}, 10_000, 2 * H);
    expect(r.inv.wheat).toBe(24);
    expect(r.lots[0].lastAt).toBe(2 * H);
  });

  it('acumula como máximo 24 horas', () => {
    const r = collect([lot({})], {}, 10_000, 100 * H);
    expect(r.inv.wheat).toBe(12 * 24);
  });

  it('no pierde fracciones: lo no cobrado sigue acumulado', () => {
    const r1 = collect([lot({})], {}, 10_000, H / 2 + 1000); // 6,003 unidades → 6
    expect(r1.inv.wheat).toBe(6);
    const r2 = collect([lot({ lastAt: r1.lots[0].lastAt })], r1.inv, 10_000, H);
    expect(r2.inv.wheat).toBe(12);
  });

  it('la capacidad de almacén frena la producción sin perderla', () => {
    const r = collect([lot({})], {}, 10, 2 * H);
    expect(r.inv.wheat).toBe(10);
    expect(r.blocked[0]).toEqual({ lot: 0, reason: 'full' });
    const r2 = collect([lot({ lastAt: r.lots[0].lastAt })], {}, 10_000, 2 * H);
    expect(r2.inv.wheat).toBe(14);
  });

  it('los procesadores consumen insumos y se limitan por ellos', () => {
    const mill = lot({ lot: 1, building: 'mill' });
    const r = collect([mill], { wheat: 5, energy: 10 }, 10_000, 2 * H);
    expect(r.inv.flour).toBe(2);
    expect(r.inv.wheat).toBe(1);
    expect(r.inv.energy).toBe(8);
    expect(r.blocked[0].reason).toBe('inputs');
  });

  it('cobra materia prima antes que procesados en la misma pasada', () => {
    const r = collect([lot({ lot: 2, building: 'mill' }), lot({ lot: 1 }), lot({ lot: 3, building: 'power' })], {}, 10_000, H);
    expect(r.inv.flour).toBe(6);
    expect(r.inv.wheat).toBe(0);
  });

  it('la panadería da 2 panes por corrida', () => {
    const r = collect([lot({ building: 'bakery' })], { flour: 100, energy: 100 }, 10_000, H);
    expect(r.inv.bread).toBe(8);
    expect(r.inv.flour).toBe(96);
  });

  it('conserva bienes: lo producido menos lo consumido es la variación de inventario', () => {
    const lots = [lot({ lot: 1 }), lot({ lot: 2, building: 'power', level: 3 }), lot({ lot: 3, building: 'mill', level: 2 }), lot({ lot: 4, building: 'bakery' })];
    const before = { wheat: 7, energy: 3 };
    const r = collect(lots, before, 10_000, 7 * H + 12345);
    for (const p of ['wheat', 'energy', 'flour', 'bread'] as const) {
      expect((r.inv[p] ?? 0) - ((before as any)[p] ?? 0)).toBe((r.produced[p] ?? 0) - (r.consumed[p] ?? 0));
    }
  });
});

describe('economía', () => {
  it('ref es el valor base sin operaciones y mitad/mitad con 20', () => {
    expect(refPrice('wheat', { n: 0, qty: 0, value: 0 })).toBe(BASE_VALUE.wheat);
    expect(refPrice('wheat', { n: 20, qty: 100, value: 100 * 600 })).toBe(500);
  });

  it('la retirada de bots tiene piso de 15 %', () => {
    expect(botFactorBp(0)).toBe(10_000);
    expect(botFactorBp(50)).toBe(5_000);
    expect(botFactorBp(1000)).toBe(1_500);
  });

  it('el bot cotiza alrededor de ref con spread y bid < ask', () => {
    for (let t = 0; t < 200; t++) {
      const q = botQuotes('wheat', 400, t * ECON.botBucketMs, 0);
      expect(q.bid.price).toBeLessThan(q.ask.price);
      expect(q.ask.price).toBeLessThanOrEqual(Math.ceil(400 * 1.03 * 1.075) + 1);
      expect(q.bid.price).toBeGreaterThanOrEqual(Math.floor(400 * 0.97 * 0.925) - 1);
    }
  });

  it('el bot no mejora una orden humana dentro de la banda', () => {
    const q = { bucket: 0, bid: { price: 380, qty: 10 }, ask: { price: 420, qty: 10 } };
    expect(applyHumanPriority(q, 400, undefined, 430).ask.price).toBe(430);
    expect(applyHumanPriority(q, 400, undefined, 500).ask.price).toBe(420);
    expect(applyHumanPriority(q, 400, 370, undefined).bid.price).toBe(370);
  });

  it('matching por precio y luego humanos primero', () => {
    const fills = matchOrder('buy', 450, 15, [
      { kind: 'bot', price: 420, qty: 10 },
      { kind: 'human', price: 420, qty: 3, orderId: 9 },
      { kind: 'human', price: 410, qty: 2, orderId: 10 },
      { kind: 'state', price: 520, qty: 99 },
    ]);
    expect(fills.map((f) => [f.level.kind, f.price, f.qty])).toEqual([
      ['human', 410, 2], ['human', 420, 3], ['bot', 420, 10],
    ]);
  });

  it('mantenimiento de 0,5 % diario', () => {
    expect(maintenanceDue(100_000, 0, 86_400_000)).toBe(500);
  });
});

describe('mapa', () => {
  it('tiene distritos de 11 países más Resto del mundo y lotes coherentes', () => {
    expect(new Set(DISTRICTS.map((d) => d.country)).size).toBe(12);
    expect(TOTAL_LOTS).toBe(DISTRICTS.length * LOTS_PER_DISTRICT);
    for (const l of [0, 63, 64, 1000, TOTAL_LOTS - 1]) {
      const { x, y } = lotWorld(l);
      expect(lotAtWorld(x, y)).toBe(l);
    }
  });

  it('los distritos no se superponen', () => {
    const seen = new Set<string>();
    for (const d of DISTRICTS) {
      const k = `${d.dx},${d.dy}`;
      expect(seen.has(k), `${d.country} ${d.name}`).toBe(false);
      seen.add(k);
    }
  });

  it('las Empresas del Estado ocupan lotes del anillo 1', () => {
    for (const d of DISTRICTS) for (const s of stateLots(d.idx)) {
      expect(lotRing(s.lot)).toBe(1);
      expect(isStateLot(s.lot)).toBe(true);
    }
  });
});
