// Mapa compartido en Canvas 2D: arrastre, pellizco, rueda, minimapa y luces de noche.
import {
  BUILDING_IDS, CELL, COUNTRIES, DISTRICTS, LOTS_SIDE, WORLD_H, WORLD_W, isStateLot, lotAt, lotAtWorld, lotRing,
  lotWorld, stateLots, type BuildingId, type MapCompany, type MapSnapshot,
} from '@portlight/shared';
import { countryName, districtName } from './i18n';
import { C, hex } from './palette';
import { sprite } from './sprites';

export interface MapLot { c: number; b: BuildingId | null; l: number; state?: boolean }

const STATE_LOTS = new Map<number, MapLot>();
for (const d of DISTRICTS) for (const s of stateLots(d.idx)) STATE_LOTS.set(s.lot, { c: -1, b: s.building, l: s.level, state: true });

const COUNTRY_BOX = COUNTRIES.map((c) => {
  const ds = c.districts.map((i) => DISTRICTS[i]);
  const x0 = Math.min(...ds.map((d) => d.dx)), x1 = Math.max(...ds.map((d) => d.dx)) + 1;
  const y0 = Math.min(...ds.map((d) => d.dy)), y1 = Math.max(...ds.map((d) => d.dy)) + 1;
  return { code: c.code, x: ((x0 + x1) / 2) * CELL, y: ((y0 + y1) / 2) * CELL };
});

export class MapView {
  private g: CanvasRenderingContext2D;
  private mg: CanvasRenderingContext2D;
  private cam = { x: WORLD_W / 2, y: WORLD_H / 2, s: 2 };
  private lots = new Map<number, MapLot>();
  private companies = new Map<number, MapCompany>();
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; moved: number; dist?: number; s?: number } | null = null;
  private frame = 0;
  private dirty = true;
  private dpr = 1;
  selected = -1;
  myCompany = -1;
  myDistrict = -1;
  reduceMotion = false;
  onSelect: (lot: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private mini: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    this.mg = mini.getContext('2d')!;
    this.bind();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    setInterval(() => { if (!this.reduceMotion && !document.hidden) { this.frame ^= 1; this.dirty = true; } }, 600);
    const loop = () => { if (this.dirty) this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setSnapshot(s: MapSnapshot) {
    this.lots.clear();
    for (let i = 0; i < s.lots.length; i += 4) {
      this.lots.set(s.lots[i], { c: s.lots[i + 1], b: s.lots[i + 2] >= 0 ? BUILDING_IDS[s.lots[i + 2]] : null, l: s.lots[i + 3] });
    }
    this.companies = new Map(s.companies.map((c) => [c.id, c]));
    this.invalidate();
  }

  /** actualización local inmediata tras una acción propia */
  patchLot(lot: number, v: MapLot | null) {
    if (v) this.lots.set(lot, v); else this.lots.delete(lot);
    this.invalidate();
  }

  addCompany(c: MapCompany) { this.companies.set(c.id, c); }
  lotInfo(lot: number): MapLot | null { return this.lots.get(lot) ?? STATE_LOTS.get(lot) ?? null; }
  company(id: number) { return this.companies.get(id); }
  invalidate() { this.dirty = true; }

  flyToDistrict(d: number, s = 26) {
    const dd = DISTRICTS[d];
    this.cam = { x: dd.dx * CELL + LOTS_SIDE / 2, y: dd.dy * CELL + LOTS_SIDE / 2, s };
    this.clamp();
    this.invalidate();
  }

  flyToLot(lot: number, s = 30) {
    const w = lotWorld(lot);
    this.cam = { x: w.x + 0.5, y: w.y + 0.5, s };
    this.clamp();
    this.invalidate();
  }

  zoom(f: number, cx = this.canvas.clientWidth / 2, cy = this.canvas.clientHeight / 2) {
    const before = this.toWorld(cx, cy);
    this.cam.s = Math.min(48, Math.max(this.minScale(), this.cam.s * f));
    const after = this.toWorld(cx, cy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clamp();
    this.invalidate();
  }

  private minScale() {
    return Math.min(this.canvas.clientWidth / WORLD_W, this.canvas.clientHeight / WORLD_H) * 0.9;
  }

  private clamp() {
    this.cam.x = Math.min(WORLD_W, Math.max(0, this.cam.x));
    this.cam.y = Math.min(WORLD_H, Math.max(0, this.cam.y));
  }

  private resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const mw = this.mini.clientWidth, mh = this.mini.clientHeight;
    this.mini.width = Math.round(mw * this.dpr);
    this.mini.height = Math.round(mh * this.dpr);
    if (this.cam.s < this.minScale()) this.cam.s = this.minScale();
    this.invalidate();
  }

  private toWorld(sx: number, sy: number) {
    return { x: this.cam.x + (sx - this.canvas.clientWidth / 2) / this.cam.s, y: this.cam.y + (sy - this.canvas.clientHeight / 2) / this.cam.s };
  }

  private bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 1) this.drag = { x: e.offsetX, y: e.offsetY, moved: 0 };
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: 99, dist: Math.hypot(a.x - b.x, a.y - b.y), s: this.cam.s };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.drag) return;
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size >= 2 && this.drag.dist) {
        const [a, b] = [...this.pointers.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const target = (this.drag.s! * Math.hypot(a.x - b.x, a.y - b.y)) / this.drag.dist;
        this.zoom(target / this.cam.s, mid.x, mid.y);
        this.cam.x -= (mid.x - this.drag.x) / this.cam.s;
        this.cam.y -= (mid.y - this.drag.y) / this.cam.s;
        this.drag.x = mid.x; this.drag.y = mid.y;
      } else {
        const dx = e.offsetX - this.drag.x, dy = e.offsetY - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.cam.x -= dx / this.cam.s;
        this.cam.y -= dy / this.cam.s;
        this.drag.x = e.offsetX; this.drag.y = e.offsetY;
      }
      this.clamp();
      this.invalidate();
    });
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        if (this.drag && this.drag.moved < 8) this.tap(e.offsetX, e.offsetY);
        this.drag = null;
      } else if (this.pointers.size === 1) {
        const [p] = [...this.pointers.values()];
        this.drag = { x: p.x, y: p.y, moved: 99 };
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.offsetX, e.offsetY); }, { passive: false });
    c.addEventListener('keydown', (e) => {
      const step = 40 / this.cam.s;
      const k: Record<string, () => void> = {
        ArrowLeft: () => (this.cam.x -= step), ArrowRight: () => (this.cam.x += step),
        ArrowUp: () => (this.cam.y -= step), ArrowDown: () => (this.cam.y += step),
        '+': () => this.zoom(1.25), '-': () => this.zoom(0.8),
      };
      if (k[e.key]) { e.preventDefault(); k[e.key](); this.clamp(); this.invalidate(); }
    });
    this.mini.addEventListener('pointerdown', (e) => {
      const r = this.mini.getBoundingClientRect();
      this.cam.x = ((e.clientX - r.left) / r.width) * WORLD_W;
      this.cam.y = ((e.clientY - r.top) / r.height) * WORLD_H;
      if (this.cam.s < 6) this.cam.s = 12;
      this.clamp();
      this.invalidate();
    });
  }

  private tap(sx: number, sy: number) {
    const w = this.toWorld(sx, sy);
    const lot = lotAtWorld(Math.floor(w.x), Math.floor(w.y));
    if (lot >= 0 && this.cam.s < 8) {
      // desde lejos, el toque acerca al distrito
      this.flyToDistrict(Math.floor(lot / (LOTS_SIDE * LOTS_SIDE)), 22);
      return;
    }
    this.selected = lot;
    this.invalidate();
    this.onSelect(lot);
  }

  private isNight() {
    const h = new Date().getHours();
    return h < 7 || h >= 19;
  }

  private draw() {
    this.dirty = false;
    const g = this.g, dpr = this.dpr;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight, s = this.cam.s;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = C.noche;
    g.fillRect(0, 0, W, H);
    const ox = W / 2 - this.cam.x * s, oy = H / 2 - this.cam.y * s;
    const night = this.isNight();

    // olas: patrón fijo de píxeles sobre el mar
    if (s >= 4) {
      g.fillStyle = C.aguaOscura;
      const step = 3;
      const x0 = Math.floor(-ox / s / step) * step, y0 = Math.floor(-oy / s / step) * step;
      for (let y = y0; y < y0 + H / s + step; y += step) for (let x = x0; x < x0 + W / s + step; x += step) {
        if (((x * 7 + y * 13) & 7) === 0) g.fillRect(Math.round(ox + (x + (this.frame && !this.reduceMotion ? 0.3 : 0)) * s), Math.round(oy + y * s), Math.max(2, s * 0.6), Math.max(1, s * 0.12));
      }
    }

    const view = { x0: -ox / s - CELL, y0: -oy / s - CELL, x1: (W - ox) / s, y1: (H - oy) / s };
    for (const d of DISTRICTS) {
      const wx = d.dx * CELL, wy = d.dy * CELL;
      if (wx > view.x1 || wy > view.y1 || wx < view.x0 || wy < view.y0) continue;
      const px = ox + wx * s, py = oy + wy * s, size = LOTS_SIDE * s;
      if (s < 5) {
        g.fillStyle = d.idx === this.myDistrict ? C.franco : C.arenaOscura;
        g.fillRect(Math.round(px), Math.round(py), Math.ceil(size), Math.ceil(size));
        for (let i = 0; i < LOTS_SIDE * LOTS_SIDE; i++) {
          const info = this.lots.get(d.idx * 64 + i);
          if (!info) continue;
          const comp = this.companies.get(info.c);
          g.fillStyle = comp ? hex(comp.color) : C.crema;
          g.fillRect(Math.round(px + (i % 8) * s), Math.round(py + Math.floor(i / 8) * s), Math.max(1, Math.ceil(s)), Math.max(1, Math.ceil(s)));
        }
        continue;
      }
      // borde del distrito propio
      if (d.idx === this.myDistrict) {
        g.fillStyle = C.franco;
        g.fillRect(Math.round(px - 2), Math.round(py - 2), Math.round(size + 4), Math.round(size + 4));
      }
      const gap = s >= 10 ? 1 : 0;
      for (let ly = 0; ly < LOTS_SIDE; ly++) for (let lx = 0; lx < LOTS_SIDE; lx++) {
        const lot = lotAt(d.idx, lx, ly);
        const x = Math.round(px + lx * s), y = Math.round(py + ly * s), ts = Math.round(s) - gap;
        const ring = lotRing(lot);
        g.fillStyle = ring === 3 ? C.rio : ring === 2 ? C.arenaOscura : C.arena;
        g.fillRect(x, y, ts, ts);
        if (ring === 3 && s >= 10) { // muelle del puerto
          g.fillStyle = C.madera;
          g.fillRect(x, y + Math.round(ts * 0.4), ts, Math.max(2, Math.round(ts * 0.18)));
        }
        const info = this.lots.get(lot) ?? STATE_LOTS.get(lot);
        if (info) {
          const comp = info.state ? null : this.companies.get(info.c);
          const col = info.state ? C.ultramar : comp ? hex(comp.color) : C.crema;
          if (s >= 12) {
            g.fillStyle = col;
            const bw = Math.max(2, Math.round(s / 12));
            g.fillRect(x, y, ts, bw); g.fillRect(x, y + ts - bw, ts, bw); g.fillRect(x, y, bw, ts); g.fillRect(x + ts - bw, y, bw, ts);
          } else {
            g.fillStyle = col;
            g.fillRect(x, y, ts, ts);
          }
          if (info.b && s >= 8) {
            const inset = Math.round(s * 0.1);
            g.drawImage(sprite(info.b, this.reduceMotion ? 0 : this.frame, night), x + inset, y + inset, ts - inset * 2, ts - inset * 2);
            if (info.l > 1 && s >= 16) { // marcas de nivel
              g.fillStyle = C.franco;
              for (let k = 0; k < info.l - 1; k++) g.fillRect(x + 3 + k * 4, y + ts - 6, 3, 3);
            }
          }
          if (info.state && s >= 16) { // insignia del Estado
            g.fillStyle = C.ultramar;
            g.fillRect(x + ts - 9, y + 1, 8, 8);
            g.fillStyle = C.crema;
            g.fillRect(x + ts - 6, y + 2, 2, 6);
            g.fillRect(x + ts - 8, y + 4, 6, 2);
          }
        } else if (ring === 0 && d.idx === this.myDistrict && s >= 12) {
          g.fillStyle = C.cosecha; // lote reclamable: punto guía
          g.fillRect(x + Math.round(ts / 2) - 1, y + Math.round(ts / 2) - 1, 3, 3);
        }
        if (lot === this.selected) {
          g.strokeStyle = C.franco;
          g.lineWidth = 3;
          g.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3);
        }
      }
      if (s >= 9) {
        const label = districtName(d.name);
        g.font = `600 ${Math.min(14, Math.max(10, s * 0.45))}px Inter, system-ui, sans-serif`;
        g.textBaseline = 'bottom';
        g.fillStyle = C.sombra;
        g.fillText(label, px + 1, py - 2 + 1, size);
        g.fillStyle = C.crema;
        g.fillText(label, px, py - 2, size);
      }
    }

    if (s < 9) {
      g.font = `600 ${s < 3 ? 11 : 14}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const c of COUNTRY_BOX) {
        const x = ox + c.x * s, y = oy + c.y * s;
        const name = countryName(c.code).toUpperCase();
        g.fillStyle = C.sombra; g.fillText(name, x + 2, y + 2);
        g.fillStyle = C.crema; g.fillText(name, x, y);
      }
      g.textAlign = 'start';
    }
    this.drawMini(ox, oy, W, H);
  }

  private drawMini(ox: number, oy: number, W: number, H: number) {
    const g = this.mg, mw = this.mini.width, mh = this.mini.height;
    const k = Math.min(mw / WORLD_W, mh / WORLD_H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.noche;
    g.fillRect(0, 0, mw, mh);
    for (const d of DISTRICTS) {
      g.fillStyle = d.idx === this.myDistrict ? C.franco : C.arenaOscura;
      g.fillRect(d.dx * CELL * k, d.dy * CELL * k, Math.max(1, LOTS_SIDE * k), Math.max(1, LOTS_SIDE * k));
    }
    g.strokeStyle = C.crema;
    g.lineWidth = Math.max(1, this.dpr);
    const s = this.cam.s;
    g.strokeRect((-ox / s) * k, (-oy / s) * k, (W / s) * k, (H / s) * k);
  }
}

export const isClaimable = (lot: number, map: MapView) => !isStateLot(lot) && !map.lotInfo(lot);
