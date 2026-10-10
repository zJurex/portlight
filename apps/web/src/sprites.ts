// Pixel art de 16×16 dibujado por código: sin assets externos.
// Cada edificio tiene 2 cuadros de animación y variante de noche (ventanas encendidas).
import type { BuildingId } from '@portlight/shared';
import { C } from './palette';

type Px = (x: number, y: number, w: number, h: number, c: string) => void;
type Painter = (px: Px, frame: number, night: boolean) => void;

const win = (night: boolean) => (night ? C.franco : C.noche);

const PAINTERS: Record<BuildingId, Painter> = {
  farm(px, f, n) {
    for (let y = 9; y < 15; y += 2) px(1, y, 9, 1, C.cosecha);
    for (let y = 10; y < 15; y += 2) px(1, y, 9, 1, C.arenaOscura);
    px(10, 6, 5, 8, C.ladrillo);
    px(9, 4, 7, 2, C.teja);
    px(12, 10, 2, 4, C.noche);
    px(11, 7, 1, 1, win(n));
    px(13, 7, 1, 1, win(n));
    px(3 + f, 6, 1, 3, C.franco); // espantapájaros que se mueve
    px(2 + f, 6, 3, 1, C.madera);
  },
  sawmill(px, f, n) {
    px(2, 6, 9, 8, C.madera);
    px(1, 4, 11, 2, C.ladrillo);
    px(4, 8, 2, 2, win(n));
    px(7, 8, 2, 2, win(n));
    px(11, 11, 4, 3, C.madera);
    px(11, 11, 4, 1, C.arenaOscura);
    px(12, 8, 2, 2, C.niebla);
    px(f ? 12 : 13, 7, 1, 1, C.crema); // hoja de sierra girando
  },
  mine(px, f, n) {
    px(1, 7, 14, 7, C.piedra);
    px(3, 5, 10, 2, C.piedra);
    px(6, 9, 4, 5, C.sombra);
    px(6, 9, 4, 1, C.madera);
    px(7, 10, 2, 1, n ? C.franco : C.sombra);
    px(10 + f, 12, 3, 2, C.ladrillo); // vagoneta
    px(11 + f, 11, 1, 1, C.niebla);
  },
  power(px, f, n) {
    px(2, 7, 9, 7, C.muelle);
    px(11, 3, 3, 11, C.ladrillo);
    px(11, 3, 3, 1, C.teja);
    px(4, 9, 2, 2, win(n));
    px(7, 9, 2, 2, win(n));
    px(5, 5, 3, 2, C.franco);
    px(6, 4, 1, 1, C.franco);
    px(f ? 11 : 12, 1, 2, 1, C.niebla); // humo
    px(f ? 13 : 11, 0, 1, 1, C.niebla);
  },
  mill(px, f, n) {
    px(5, 6, 6, 8, C.crema);
    px(4, 5, 8, 1, C.ladrillo);
    px(7, 11, 2, 3, C.madera);
    px(7, 8, 2, 1, win(n));
    if (f) { px(7, 0, 2, 6, C.madera); px(4, 2, 8, 2, C.madera); }
    else { for (let i = 0; i < 5; i++) { px(4 + i, 0 + i, 1, 1, C.madera); px(11 - i, 0 + i, 1, 1, C.madera); } }
    px(7, 2, 2, 2, C.teja);
  },
  carpentry(px, f, n) {
    px(1, 6, 10, 8, C.ladrillo);
    px(0, 4, 12, 2, C.madera);
    px(3, 8, 2, 2, win(n));
    px(7, 8, 2, 2, win(n));
    px(12, 9 + f, 3, 1, C.arenaOscura);
    px(12, 11, 3, 1, C.arenaOscura);
    px(12, 13, 3, 1, C.arenaOscura);
  },
  foundry(px, f, n) {
    px(1, 7, 10, 7, C.piedra);
    px(10, 2, 4, 12, C.muelle);
    px(10, 2, 4, 1, C.sombra);
    px(3, 10, 5, 3, f ? C.teja : C.franco); // horno
    px(4, 8, 1, 1, win(n));
    px(f ? 10 : 12, 0, 2, 1, C.niebla);
  },
  bakery(px, f, n) {
    px(2, 6, 11, 8, C.crema);
    px(1, 4, 13, 2, C.teja);
    px(10, 1, 2, 3, C.ladrillo);
    px(f ? 10 : 11, 0, 1, 1, C.niebla);
    px(6, 10, 3, 4, C.madera);
    px(3, 8, 2, 2, win(n));
    px(10, 8, 2, 2, win(n));
    px(5, 7, 5, 1, C.franco); // cartel
  },
  workshop(px, f, n) {
    px(1, 6, 14, 8, C.ladrillo);
    for (let x = 1; x < 15; x += 3) px(x, 4, 2, 2, C.muelle); // techo de diente de sierra
    px(3, 9, 2, 2, win(n));
    px(11, 9, 2, 2, win(n));
    px(6, 8, 4, 4, C.niebla); // engranaje
    px(f ? 7 : 6, f ? 7 : 9, f ? 2 : 4, f ? 6 : 2, C.niebla);
    px(7, 9, 2, 2, C.ladrillo);
  },
  warehouse(px, _f, n) {
    px(1, 5, 14, 9, C.muelle);
    px(0, 4, 16, 1, C.piedra);
    px(4, 8, 8, 6, C.piedra);
    for (let y = 9; y < 14; y += 2) px(4, y, 8, 1, C.muelle);
    px(2, 6, 1, 1, win(n));
    px(13, 6, 1, 1, win(n));
  },
  shop(px, _f, n) {
    px(2, 6, 12, 8, C.crema);
    for (let x = 2; x < 14; x += 2) px(x, 5, 1, 2, C.teja);
    px(3, 9, 4, 3, win(n));
    px(9, 9, 3, 5, C.madera);
  },
  port(px, f, n) {
    px(0, 10, 16, 6, C.rio);
    px(1, 6, 9, 4, C.madera);
    px(11, 3, 2, 8, C.ladrillo);
    px(10 + f, 2, 5, 1, C.franco);
    px(3, 7, 1, 1, win(n));
  },
};

const cache = new Map<string, HTMLCanvasElement>();

/** sprite 16×16 de un edificio; el nivel suma una bandera de color */
export const sprite = (b: BuildingId, frame: number, night: boolean): HTMLCanvasElement => {
  const key = `${b}:${frame}:${night ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  const shadow: Px = (x, y, w, h) => { g.fillStyle = C.sombra; g.fillRect(x + 1, y + 1, w, h); };
  const px: Px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // sombra dura desplazada: primero la silueta, después el dibujo
  PAINTERS[b]((x, y, w, h) => shadow(x, y, w, h, ''), frame, night);
  PAINTERS[b](px, frame, night);
  cache.set(key, c);
  return c;
};

/** faro del wordmark y del favicon */
export const drawLighthouse = (g: CanvasRenderingContext2D, x: number, y: number, s: number, lit = true) => {
  const p = (px: number, py: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x + px * s, y + py * s, w * s, h * s); };
  p(5, 3, 6, 2, C.teja);
  p(6, 1, 4, 2, lit ? C.franco : C.niebla);
  p(7, 0, 2, 1, C.teja);
  p(6, 5, 4, 3, C.crema);
  p(6, 8, 4, 2, C.teja);
  p(5, 10, 6, 3, C.crema);
  p(4, 13, 8, 3, C.teja);
  if (lit) { p(0, 1, 5, 1, C.franco); p(11, 1, 5, 1, C.franco); }
};
