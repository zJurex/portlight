// Validación de nombres de empresa: 3 a 24 caracteres, normalización Unicode y filtro básico es/en/pt.
// La lista se amplía en la fase 4 (moderación); acá frena lo más obvio.

// letras que imitan a otras (cirílico/griego → latino) y números usados como letras
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', к: 'k', м: 'm', т: 't', в: 'b', н: 'h',
  α: 'a', ο: 'o', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's',
};

const BLOCKED = [
  // es
  'puta', 'puto', 'mierda', 'pelotud', 'boludo', 'concha', 'verga', 'pija', 'culo', 'maricon', 'trolo', 'negro de mierda', 'nazi', 'hitler',
  // en
  'fuck', 'shit', 'cunt', 'nigg', 'whore', 'bitch', 'porn',
  // pt
  'caralho', 'porra', 'buceta', 'viado', 'cuzao', 'merda', 'arrombad',
  // suplantación
  'admin', 'moderador', 'moderator', 'estado', 'oficial', 'official', 'portlight',
];

export const nameKey = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split('').map((ch) => HOMOGLYPHS[ch] ?? ch).join('')
    .replace(/[^a-z]/g, '');

export const checkName = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < 3 || len > 24) return null;
  if (!/^[\p{L}\p{N} .,'&-]+$/u.test(name)) return null;
  const key = nameKey(name);
  if (key.length < 2) return null;
  if (BLOCKED.some((w) => key.includes(nameKey(w)))) return null;
  return name;
};
