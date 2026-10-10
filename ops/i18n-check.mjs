// Chequeo de catálogos i18n para CI: claves faltantes o sobrantes, variables distintas,
// textos vacíos o demasiado largos, y claves usadas en el código que no existen.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'apps/web/src/locales';
const base = 'es';
const cats = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))]));
const errors = [];

// nombres de variables de nivel superior de un mensaje ICU ({name} o {name, plural, ...})
const vars = (msg) => {
  const out = new Set();
  let depth = 0, start = -1;
  for (let i = 0; i < msg.length; i++) {
    if (msg[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (msg[i] === '}') { depth--; if (depth === 0) out.add(msg.slice(start + 1, i).split(',')[0].trim()); }
  }
  if (depth !== 0) errors.push(`llaves desbalanceadas: ${msg}`);
  return [...out].sort().join(',');
};

const ref = cats[base];
for (const [lang, cat] of Object.entries(cats)) {
  for (const k of Object.keys(ref)) {
    if (!(k in cat)) { errors.push(`[${lang}] falta la clave ${k}`); continue; }
    const v = cat[k];
    if (typeof v !== 'string' || !v.trim()) errors.push(`[${lang}] ${k} está vacío`);
    if (vars(v) !== vars(ref[k])) errors.push(`[${lang}] ${k}: variables {${vars(v)}} ≠ {${vars(ref[k])}}`);
    const max = Math.max(Math.ceil(ref[k].length * 1.6), ref[k].length + 24);
    if (v.length > max) errors.push(`[${lang}] ${k}: ${v.length} caracteres (máx. ${max})`);
  }
  for (const k of Object.keys(cat)) if (!(k in ref)) errors.push(`[${lang}] clave sobrante ${k}`);
}

// claves literales usadas en el código
const src = 'apps/web/src';
for (const f of readdirSync(src).filter((f) => f.endsWith('.ts'))) {
  const code = readFileSync(join(src, f), 'utf8');
  for (const m of code.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) if (!(m[1] in ref)) errors.push(`${f}: usa la clave inexistente ${m[1]}`);
}
// claves dinámicas: cada id de datos tiene que tener su texto
const data = readFileSync('packages/shared/src/data.ts', 'utf8');
const ids = (name) => JSON.parse(data.match(new RegExp(`${name} = (\\[[^\\]]+\\])`))[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
for (const p of ids('PRODUCTS')) if (!(`product.${p}` in ref)) errors.push(`falta product.${p}`);
for (const b of ids('BUILDING_IDS')) if (!(`building.${b}` in ref)) errors.push(`falta building.${b}`);
const api = readFileSync('packages/shared/src/api.ts', 'utf8');
for (const m of api.match(/export type ErrorCode =([^;]+);/)[1].matchAll(/'(\w+)'/g)) if (!(`err.${m[1]}` in ref)) errors.push(`falta err.${m[1]}`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problema(s) de i18n`);
  process.exit(1);
}
console.log(`i18n OK: ${Object.keys(cats).join(', ')} · ${Object.keys(ref).length} claves`);
