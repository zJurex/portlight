// i18n: catálogos por idioma en formato ICU (subconjunto: {var}, plural con =N/one/other y #, select).
import es from './locales/es.json';

export const LANGS = ['es', 'en', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
const LOCALE: Record<Lang, string> = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };

type Catalog = Record<string, string>;
let lang: Lang = 'es';
let catalog: Catalog = es;
const loaders: Record<Lang, () => Promise<Catalog>> = {
  es: async () => es,
  en: async () => (await import('./locales/en.json')).default,
  pt: async () => (await import('./locales/pt.json')).default,
};

export const getLang = () => lang;
export const locale = () => LOCALE[lang];

export const setLang = async (l: Lang) => {
  catalog = await loaders[l]();
  lang = l;
  document.documentElement.lang = LOCALE[l];
};

export const detectLang = (): Lang => {
  const fromPath = location.pathname.split('/')[1];
  if ((LANGS as readonly string[]).includes(fromPath)) return fromPath as Lang;
  try {
    const saved = localStorage.getItem('pl.lang');
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch { /* sin almacenamiento */ }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.slice(0, 2).toLowerCase();
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return 'es';
};

type Args = Record<string, string | number>;

/** formatea un mensaje ICU simple */
export const format = (msg: string, args: Args, pluralLocale = LOCALE[lang]): string => {
  let out = '';
  let i = 0;
  while (i < msg.length) {
    const ch = msg[i];
    if (ch !== '{') { out += ch; i++; continue; }
    // buscar la llave de cierre balanceada
    let depth = 0, j = i;
    for (; j < msg.length; j++) {
      if (msg[j] === '{') depth++;
      else if (msg[j] === '}' && --depth === 0) break;
    }
    const inner = msg.slice(i + 1, j);
    i = j + 1;
    const parts = inner.split(',');
    const name = parts[0].trim();
    if (parts.length === 1) { out += String(args[name] ?? `{${name}}`); continue; }
    const kind = parts[1].trim();
    const body = parts.slice(2).join(',');
    const options = new Map<string, string>();
    const re = /\s*([=\w]+)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      let d = 1, k = re.lastIndex;
      for (; k < body.length && d > 0; k++) { if (body[k] === '{') d++; else if (body[k] === '}') d--; }
      options.set(m[1], body.slice(re.lastIndex, k - 1));
      re.lastIndex = k;
    }
    const value = args[name];
    let chosen: string | undefined;
    if (kind === 'plural') {
      const n = Number(value);
      chosen = options.get(`=${n}`) ?? options.get(new Intl.PluralRules(pluralLocale).select(n)) ?? options.get('other');
      out += format((chosen ?? '').replace(/#/g, new Intl.NumberFormat(pluralLocale).format(n)), args, pluralLocale);
    } else {
      chosen = options.get(String(value)) ?? options.get('other');
      out += format(chosen ?? '', args, pluralLocale);
    }
  }
  return out;
};

export const t = (key: string, args: Args = {}) => {
  const msg = catalog[key] ?? (es as Catalog)[key];
  if (msg === undefined) {
    if (import.meta.env.DEV) console.warn('i18n: falta la clave', key);
    return key;
  }
  return format(msg, args);
};

const numFmt = new Map<string, Intl.NumberFormat>();
const nf = (opts: Intl.NumberFormatOptions) => {
  const k = locale() + JSON.stringify(opts);
  let f = numFmt.get(k);
  if (!f) numFmt.set(k, (f = new Intl.NumberFormat(locale(), opts)));
  return f;
};

/** dinero en centavos → "₣1.234" o "₣4,18" */
export const money = (cents: number, decimals: 'auto' | 0 | 2 = 'auto') => {
  const d = decimals === 'auto' ? (Math.abs(cents) < 100_000 && cents % 100 !== 0 ? 2 : 0) : decimals;
  return '₣' + nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(cents / 100);
};
export const num = (n: number, max = 0) => nf({ maximumFractionDigits: max }).format(n);

export const countryName = (code: string) => {
  if (code === 'XW') return t('country.XW');
  try { return new Intl.DisplayNames([locale()], { type: 'region' }).of(code) ?? code; } catch { return code; }
};

export const districtName = (name: string) => (name.startsWith('region.') ? t(name) : name);

/** hora local en que se renueva la cuota diaria (00:00 UTC) */
export const quotaResetTime = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d);
};

export const list = (items: string[]) => new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items);
