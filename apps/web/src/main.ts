import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/press-start-2p/latin-400.css';
import './style.css';
import {
  BUILDINGS, BUILDING_IDS, COUNTRIES, DISTRICTS, ECON, LEVEL_MULT_MILLI, MAX_LEVEL, PRODUCTS, isStateLot,
  lotDistrict, lotRing, storageCapacity, upgradeCost,
  type BuildingId, type CollectResponse, type MapSnapshot, type MarketDetail, type MarketSummary, type MeResponse,
  type OrderResponse, type ProductId, type StartResponse,
} from '@portlight/shared';
import { api, ApiError, hasToken, setToken } from './api';
import { $, clear, h } from './dom';
import {
  LANGS, countryName, detectLang, districtName, getLang, list, money, num, quotaResetTime, setLang, t, type Lang,
} from './i18n';
import { icon } from './icons';
import { MapView } from './map';
import { C, COMPANY_COLORS, hex } from './palette';
import { blip, setSound } from './sound';
import { drawLighthouse, sprite } from './sprites';

type Tab = 'map' | 'company' | 'market' | 'event' | 'ranking';

const S = {
  me: null as MeResponse | null,
  market: null as MarketSummary | null,
  snapshot: null as MapSnapshot | null,
  tab: 'map' as Tab,
  product: null as ProductId | null,
  side: 'sell' as 'buy' | 'sell',
  settings: { sound: false, motion: matchMedia('(prefers-reduced-motion: reduce)').matches, data: false },
  marketDelay: 45_000,
};

const load = () => { try { Object.assign(S.settings, JSON.parse(localStorage.getItem('pl.settings') ?? '{}')); } catch { /* ok */ } };
const save = () => { try { localStorage.setItem('pl.settings', JSON.stringify(S.settings)); } catch { /* ok */ } };

let map: MapView;

// ---------- utilidades de UI ----------

let toastTimer = 0;
const toast = (msg: string, kind: 'ok' | 'err' | 'info' = 'info') => {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = 'toast'), 4200);
  if (kind === 'err') blip('error');
};

const errMsg = (e: unknown) => {
  const code = e instanceof ApiError ? e.code : 'internal';
  if (code === 'read_only') return t('mk.readonly', { time: quotaResetTime() });
  return t(`err.${code}`);
};

const run = async <T>(fn: () => Promise<T>, btn?: HTMLButtonElement): Promise<T | undefined> => {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) {
    toast(errMsg(e), 'err');
    if (e instanceof ApiError && e.code === 'unauthorized') { setToken(null); S.me = null; showLanding(); }
    return undefined;
  } finally { if (btn) btn.disabled = false; }
};

const productName = (p: ProductId) => t(`product.${p}`);
const buildingName = (b: BuildingId) => t(`building.${b}`);
const qtyList = (inv: Partial<Record<ProductId, number>>) =>
  list(PRODUCTS.filter((p) => (inv[p] ?? 0) > 0).map((p) => `${num(inv[p]!)} ${productName(p)}`));

const spriteImg = (b: BuildingId, size = 40) => {
  const c = h('canvas', { width: 16, height: 16, class: 'sprite', style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  c.getContext('2d')!.drawImage(sprite(b, 0, false), 0, 0);
  return c;
};

const delta = (bp: number) => {
  if (bp === 0) return h('span', { class: 'delta' }, '＝ 0 %');
  const up = bp > 0;
  return h('span', { class: `delta ${up ? 'up' : 'down'}` }, icon(up ? 'up' : 'down', 10), ` ${num(Math.abs(bp) / 100, 1)} %`);
};

// ---------- estructura ----------

const sheet = () => $('#sheet');
const openSheet = (...children: (Node | string)[]) => {
  const el = sheet();
  clear(el).append(
    h('button', { class: 'icon-btn sheet-close', 'aria-label': t('misc.close'), on: { click: closeSheet } }, icon('close')),
    ...children,
  );
  el.hidden = false;
  el.scrollTop = 0;
};
const closeSheet = () => {
  sheet().hidden = true;
  if (S.tab !== 'map') setTab('map');
  map.selected = -1;
  map.invalidate();
};

const renderChrome = () => {
  const tabs = $('#tabs');
  clear(tabs);
  for (const [id, ic] of [['map', 'map'], ['company', 'company'], ['market', 'market'], ['event', 'event'], ['ranking', 'ranking']] as const) {
    tabs.append(h('button', {
      class: `tab ${S.tab === id ? 'active' : ''}`, 'aria-current': S.tab === id ? 'page' : false,
      on: { click: () => setTab(id) },
    }, icon(ic, 20), h('span', {}, t(`tab.${id}`))));
  }
  const top = $('#topbar');
  clear(top);
  const logo = h('canvas', { width: 16, height: 16, class: 'logo', 'aria-hidden': 'true' });
  drawLighthouse(logo.getContext('2d')!, 0, 0, 1);
  top.append(
    h('div', { class: 'brand' }, logo, h('span', { class: 'brand-name' }, 'Portlight')),
    S.me ? h('div', { class: 'cash', title: t('co.cash') }, icon('coin', 14), h('span', { class: 'num' }, money(S.me.company.cash, 0))) : h('span'),
    h('button', { class: 'icon-btn', 'aria-label': t('misc.settings'), on: { click: showSettings } }, icon('gear')),
  );
  $('#zoom-in').setAttribute('aria-label', t('misc.zoomIn'));
  $('#zoom-out').setAttribute('aria-label', t('misc.zoomOut'));
  $('#go-home').setAttribute('aria-label', t('misc.home'));
  $('#minimap').setAttribute('aria-label', t('misc.minimap'));
  renderHint();
};

const setTab = (tab: Tab) => {
  S.tab = tab;
  renderChrome();
  if (tab === 'map') { sheet().hidden = true; return; }
  if (tab === 'company') renderCompany();
  if (tab === 'market') { S.product = null; renderMarket(); refreshMarket(); }
  if (tab === 'event') openSheet(h('h2', {}, t('tab.event')), h('p', { class: 'muted' }, t('ev.soon')));
  if (tab === 'ranking') openSheet(h('h2', {}, t('tab.ranking')), h('p', { class: 'muted' }, t('rk.soon')));
};

/** guía de los primeros pasos (el tutorial completo llega en la fase 3) */
const renderHint = () => {
  const el = $('#hint');
  const me = S.me;
  let msg = '';
  if (me) {
    const built = me.lots.filter((l) => l.building);
    const anyInv = PRODUCTS.some((p) => (me.company.inv[p] ?? 0) > 0);
    if (!me.lots.length) msg = t('onb.hint', { district: districtName(DISTRICTS[me.company.district].name), count: ECON.freeLots });
    else if (!built.length) msg = t('tut.build');
    else if (!anyInv && built.every((l) => l.pending === 0)) msg = t('tut.wait');
    else if (!anyInv) msg = t('tut.collect');
    else if (me.company.cash >= ECON.startCash - 1 || me.orders.length === 0 && built.length < 2) msg = t('tut.sell');
  }
  el.textContent = msg;
  el.hidden = !msg || S.tab !== 'map' || !sheet().hidden;
};

// ---------- landing y alta ----------

const overlay = () => $('#overlay');

const langPicker = () => h('div', { class: 'lang-picker', role: 'group', 'aria-label': t('set.lang') },
  ...LANGS.map((l) => h('button', { class: `chip ${getLang() === l ? 'active' : ''}`, lang: l, on: { click: () => changeLang(l) } }, l.toUpperCase())));

const showLanding = () => {
  const o = overlay();
  const art = h('canvas', { width: 64, height: 64, class: 'hero-art', 'aria-hidden': 'true' });
  drawLighthouse(art.getContext('2d')!, 0, 0, 4);
  const players = S.snapshot?.players ?? 0;
  clear(o).append(h('div', { class: 'card landing' },
    langPicker(),
    art,
    h('h1', { class: 'wordmark' }, 'PORTLIGHT'),
    h('p', { class: 'pitch' }, t('app.pitch')),
    h('button', { class: 'btn primary big', on: { click: () => showCountries() } }, t('landing.play')),
    h('p', { class: 'muted small' }, t('landing.sub')),
    h('p', { class: 'muted small' }, t('landing.players', { count: players })),
  ));
  o.hidden = false;
};

const showCountries = () => {
  const o = overlay();
  const sorted = [...COUNTRIES].sort((a, b) => (a.code === 'XW' ? 1 : b.code === 'XW' ? -1 : countryName(a.code).localeCompare(countryName(b.code), getLang())));
  clear(o).append(h('div', { class: 'card onb' },
    h('h2', {}, t('onb.country')),
    h('div', { class: 'grid-list' }, ...sorted.map((c) => h('button', {
      class: 'list-btn', on: { click: () => { map.flyToDistrict(c.districts[Math.floor(c.districts.length / 2)], 6); showDistricts(c.code); } },
    }, h('span', { class: 'code' }, c.code === 'XW' ? '🌐' : c.code), countryName(c.code)))),
    h('button', { class: 'btn ghost', on: { click: showLanding } }, t('onb.back')),
  ));
};

const showDistricts = (code: string) => {
  const country = COUNTRIES.find((c) => c.code === code)!;
  const ds = country.districts.map((i) => DISTRICTS[i]).sort((a, b) => districtName(a.name).localeCompare(districtName(b.name), getLang()));
  clear(overlay()).append(h('div', { class: 'card onb' },
    h('h2', {}, t('onb.district')),
    h('p', { class: 'muted' }, countryName(code)),
    h('div', { class: 'grid-list' }, ...ds.map((d) => h('button', {
      class: 'list-btn', on: { click: () => { map.myDistrict = d.idx; map.flyToDistrict(d.idx, 22); showName(d.idx, code); } },
    }, districtName(d.name)))),
    h('button', { class: 'btn ghost', on: { click: showCountries } }, t('onb.back')),
  ));
};

const showName = (district: number, code: string) => {
  let color = COMPANY_COLORS[Math.floor(Math.random() * COMPANY_COLORS.length)];
  const input = h('input', { id: 'company-name', maxlength: 24, minlength: 3, required: true, autocomplete: 'off', placeholder: t('onb.name.placeholder') });
  const colors = h('div', { class: 'colors', role: 'radiogroup', 'aria-label': t('onb.color') });
  const paintColors = () => {
    clear(colors).append(...COMPANY_COLORS.map((c) => h('button', {
      class: `swatch ${c === color ? 'active' : ''}`, role: 'radio', 'aria-checked': String(c === color), 'aria-label': hex(c),
      style: `background:${hex(c)}`, type: 'button', on: { click: () => { color = c; paintColors(); } },
    })));
  };
  paintColors();
  const btn = h('button', { class: 'btn primary big', type: 'submit' }, t('onb.start'));
  const form = h('form', { class: 'card onb', on: {
    submit: async (e) => {
      e.preventDefault();
      const ref = new URLSearchParams(location.search).get('ref') ?? undefined;
      const res = await run(() => api<StartResponse>('POST', '/start', { name: input.value, district, color, lang: getLang(), ref }), btn);
      if (!res) return;
      setToken(res.token);
      S.me = res.me;
      map.myCompany = res.me.company.id;
      map.addCompany({ id: res.me.company.id, name: res.me.company.name, color, district });
      overlay().hidden = true;
      blip('build');
      renderChrome();
      map.flyToDistrict(district, 30);
    },
  } },
    h('h2', {}, t('onb.name')),
    h('p', { class: 'muted' }, `${districtName(DISTRICTS[district].name)} · ${countryName(code)}`),
    h('label', { for: 'company-name' }, t('onb.name')),
    input,
    h('p', { class: 'muted small' }, t('onb.name.help')),
    h('p', { class: 'label' }, t('onb.color')),
    colors,
    btn,
    h('button', { class: 'btn ghost', type: 'button', on: { click: () => showDistricts(code) } }, t('onb.back')),
  );
  clear(overlay()).append(form);
  input.focus();
};

// ---------- lote ----------

const lotTitle = (lot: number) => `${t(`lot.ring.${lotRing(lot)}`)} · ${districtName(DISTRICTS[lotDistrict(lot)].name)}`;

const showLot = (lot: number) => {
  if (lot < 0) { closeSheet(); return; }
  if (S.tab !== 'map') { S.tab = 'map'; renderChrome(); }
  const me = S.me;
  const mine = me?.lots.find((l) => l.lot === lot);
  const info = map.lotInfo(lot);
  if (info?.state || isStateLot(lot)) {
    openSheet(h('h2', {}, t('lot.state')), h('p', { class: 'muted' }, lotTitle(lot)),
      info?.b ? h('div', { class: 'row' }, spriteImg(info.b), h('div', {}, h('strong', {}, buildingName(info.b)), h('div', { class: 'muted' }, t('lot.level', { level: info.l })))) : '',
      h('p', {}, t('lot.state.note')));
    return;
  }
  if (!mine && info) {
    const c = map.company(info.c);
    openSheet(h('h2', {}, t('lot.other', { name: c?.name ?? '—' })), h('p', { class: 'muted' }, lotTitle(lot)),
      info.b ? h('div', { class: 'row' }, spriteImg(info.b), h('div', {}, h('strong', {}, buildingName(info.b)), h('div', { class: 'muted' }, t('lot.level', { level: info.l })))) : '');
    return;
  }
  if (!mine) {
    const ring = lotRing(lot);
    const children: (Node | string)[] = [h('h2', {}, t('lot.free')), h('p', { class: 'muted' }, lotTitle(lot))];
    if (!me) { openSheet(...children); return; }
    if (lotDistrict(lot) !== me.company.district) {
      children.push(h('p', {}, t('lot.otherDistrict', { district: districtName(DISTRICTS[me.company.district].name) })));
    } else if (me.lots.length >= ECON.maxLots) {
      children.push(h('p', {}, t('lot.limit', { count: ECON.maxLots })));
    } else {
      const free = me.company.freeClaims > 0 && ring === 0;
      const btn = h('button', { class: 'btn primary big', on: { click: async () => {
        const r = await run(() => api<MeResponse>('POST', '/claim', { lot }), btn);
        if (!r) return;
        setMe(r);
        map.patchLot(lot, { c: r.company.id, b: null, l: 0 });
        blip('build');
        showLot(lot);
      } } }, free ? t('lot.claim.free') : t('lot.claim.price', { price: money(ECON.lotPrice[ring], 0) }));
      children.push(btn);
    }
    openSheet(...children);
    return;
  }
  if (!mine.building) {
    openSheet(h('h2', {}, t('lot.empty')), h('p', { class: 'muted' }, lotTitle(lot)),
      h('div', { class: 'build-list' }, ...BUILDING_IDS.filter((b) => BUILDINGS[b].enabled).map((b) => {
        const def = BUILDINGS[b];
        const r = def.recipes[0];
        const desc = b === 'warehouse' ? t('building.warehouse.desc', { count: num(storageCapacity([1]) - ECON.baseStorage) })
          : t('lot.rate', { rate: num(def.rate), product: productName(r.out) });
        const uses = r && Object.keys(r.inputs).length ? t('lot.uses', { inputs: list(Object.entries(r.inputs).map(([p, n]) => `${n} ${productName(p as ProductId)}`)) }) : '';
        const afford = me!.company.cash >= def.cost;
        const btn: HTMLButtonElement = h('button', { class: 'build-item', disabled: !afford, on: { click: async () => {
          const res = await run(() => api<MeResponse>('POST', '/build', { lot, building: b }), btn);
          if (!res) return;
          setMe(res);
          map.patchLot(lot, { c: res.company.id, b, l: 1 });
          blip('build');
          showLot(lot);
        } } }, spriteImg(b, 36), h('span', { class: 'bi-text' }, h('strong', {}, buildingName(b)), h('span', { class: 'muted small' }, desc), uses ? h('span', { class: 'muted small' }, uses) : ''),
        h('span', { class: `price num ${afford ? '' : 'no'}` }, money(def.cost, 0)));
        return btn;
      })));
    return;
  }
  const b = mine.building;
  const def = BUILDINGS[b];
  const recipe = def.recipes[Math.min(mine.mode, def.recipes.length - 1)];
  const rate = recipe ? (def.rate * LEVEL_MULT_MILLI[mine.level - 1] * (100 + mine.bonus)) / 100_000 : 0;
  const kids: (Node | string)[] = [
    h('div', { class: 'row' }, spriteImg(b, 56), h('div', {}, h('h2', {}, buildingName(b)), h('p', { class: 'muted' }, `${t('lot.level', { level: mine.level })} · ${lotTitle(lot)}`))),
  ];
  if (recipe) {
    kids.push(h('p', {}, t('lot.rate', { rate: num(rate, 1), product: productName(recipe.out) })));
    if (Object.keys(recipe.inputs).length) kids.push(h('p', { class: 'muted' }, t('lot.uses', { inputs: list(Object.entries(recipe.inputs).map(([p, n]) => `${n} ${productName(p as ProductId)}`)) })));
    if (mine.bonus) kids.push(h('p', { class: 'good' }, icon('up', 10), ' ', t('lot.bonus', { pct: mine.bonus })));
    kids.push(h('p', { class: 'strong' }, t('lot.pending', { count: num(mine.pending) })));
  } else if (b === 'warehouse') {
    kids.push(h('p', {}, t('building.warehouse.desc', { count: num(storageCapacity([mine.level]) - ECON.baseStorage) })));
  }
  if (def.recipes.length > 1) {
    kids.push(h('p', { class: 'label' }, t('lot.makes')), h('div', { class: 'seg' }, ...def.recipes.map((r, i) => h('button', {
      class: `chip ${i === mine.mode ? 'active' : ''}`, 'aria-pressed': String(i === mine.mode),
      on: { click: async () => { const res = await run(() => api<MeResponse>('POST', '/mode', { lot, mode: i })); if (res) { setMe(res); showLot(lot); } } },
    }, productName(r.out)))));
  }
  const actions = h('div', { class: 'actions' });
  if (recipe) actions.append(h('button', { class: 'btn primary', on: { click: (e) => collectAll(e.currentTarget as HTMLButtonElement, lot) } }, t('co.collect')));
  if (mine.level < MAX_LEVEL) {
    const cost = upgradeCost(b, mine.level);
    const up: HTMLButtonElement = h('button', { class: 'btn', disabled: me!.company.cash < cost, on: { click: async () => {
      const res = await run(() => api<MeResponse>('POST', '/upgrade', { lot }), up);
      if (!res) return;
      setMe(res);
      map.patchLot(lot, { c: res.company.id, b, l: mine.level + 1 });
      blip('build');
      showLot(lot);
    } } }, t('lot.upgrade', { price: money(cost, 0) }));
    actions.append(up);
  } else actions.append(h('span', { class: 'muted' }, t('lot.maxLevel')));
  kids.push(actions);
  openSheet(...kids);
};

const collectAll = async (btn?: HTMLButtonElement, reopenLot?: number) => {
  const r = await run(() => api<CollectResponse>('POST', '/collect'), btn);
  if (!r) return;
  setMe(r.me);
  const got = qtyList(r.produced);
  if (got) { toast(t('co.collected', { items: got }), 'ok'); blip('coin'); }
  else if (r.blocked.some((b) => b.reason === 'full')) toast(t('co.full'), 'err');
  else if (r.blocked.length) {
    const l = r.me.lots.find((x) => x.lot === r.blocked[0].lot);
    toast(t('co.inputs', { building: l?.building ? buildingName(l.building) : '' }), 'err');
  } else toast(t('co.nothing'));
  if (reopenLot !== undefined) showLot(reopenLot);
  else if (S.tab === 'company') renderCompany();
};

// ---------- empresa ----------

const setMe = (me: MeResponse) => {
  S.me = me;
  map.myCompany = me.company.id;
  map.myDistrict = me.company.district;
  renderChrome();
};

const renderCompany = () => {
  const me = S.me;
  if (!me) { showLanding(); return; }
  const c = me.company;
  const used = PRODUCTS.reduce((s, p) => s + (c.inv[p] ?? 0), 0);
  const pct = Math.min(100, Math.round((used / c.capacity) * 100));
  const inv = PRODUCTS.filter((p) => (c.inv[p] ?? 0) > 0);
  openSheet(
    h('div', { class: 'company-head' },
      h('span', { class: 'swatch static', style: `background:${hex(c.color)}`, 'aria-hidden': 'true' }),
      h('div', {}, h('h2', {}, c.name), h('p', { class: 'muted' }, `${districtName(DISTRICTS[c.district].name)} · ${countryName(DISTRICTS[c.district].country)}`))),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('span', { class: 'label' }, t('co.cash')), h('strong', { class: 'num big' }, money(c.cash, 0))),
      h('div', { class: 'stat' }, h('span', { class: 'label' }, t('co.inventory')), h('strong', { class: 'num' }, t('co.capacity', { used: num(used), cap: num(c.capacity) })),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: `width:${pct}%` })))),
    h('button', { class: 'btn primary big', on: { click: (e) => collectAll(e.currentTarget as HTMLButtonElement) } }, t('co.collect')),
    h('h3', {}, t('co.inventory')),
    inv.length ? h('ul', { class: 'inv' }, ...inv.map((p) => h('li', {}, h('span', {}, productName(p)), h('strong', { class: 'num' }, num(c.inv[p]!)),
      h('button', { class: 'link', on: { click: () => { S.tab = 'market'; S.side = 'sell'; renderChrome(); openProduct(p); } } }, t('mk.sell'))))) : h('p', { class: 'muted' }, t('co.emptyInv')),
    h('h3', {}, t('co.lots', { count: me.lots.length, max: ECON.maxLots })),
    me.lots.length ? h('ul', { class: 'lots' }, ...me.lots.map((l) => h('li', {},
      l.building ? spriteImg(l.building, 28) : h('span', { class: 'empty-lot', 'aria-hidden': 'true' }),
      h('span', {}, l.building ? `${buildingName(l.building)} · ${t('lot.level', { level: l.level })}` : t('lot.empty')),
      l.pending ? h('span', { class: 'muted num' }, `+${num(l.pending)}`) : h('span'),
      h('button', { class: 'link', on: { click: () => { map.flyToLot(l.lot); map.selected = l.lot; showLot(l.lot); } } }, t('co.goto'))))) : h('p', { class: 'muted' }, t('co.noLots')),
    h('h3', {}, t('co.orders')),
    me.orders.length ? h('ul', { class: 'orders' }, ...me.orders.map((o) => orderRow(o))) : h('p', { class: 'muted' }, t('co.noOrders')),
  );
};

const orderRow = (o: MeResponse['orders'][number]) => {
  const btn: HTMLButtonElement = h('button', { class: 'link danger', on: { click: async () => {
    const r = await run(() => api<MeResponse>('DELETE', `/orders/${o.id}`), btn);
    if (!r) return;
    setMe(r);
    if (S.tab === 'company') renderCompany(); else if (S.product) openProduct(S.product);
  } } }, t('mk.cancel'));
  return h('li', {}, h('span', {}, t('mk.orderSide', { side: o.side, qty: num(o.qty - o.filled), product: productName(o.product), price: money(o.price, 2) })), btn);
};

// ---------- mercado ----------

let marketTimer = 0;
const refreshMarket = async () => {
  clearTimeout(marketTimer);
  if (S.tab !== 'market' || document.hidden) return;
  const before = S.market;
  const m = await api<MarketSummary>('GET', '/market').catch(() => null);
  if (m) {
    S.market = m;
    S.marketDelay = m === before ? Math.min(180_000, S.marketDelay * 2) : 45_000; // retroceso si no cambió
    if (m.saving) S.marketDelay = Math.max(S.marketDelay, 120_000);
    if (S.settings.data) S.marketDelay = Math.max(S.marketDelay, 120_000);
    if (!S.product) renderMarket();
  }
  marketTimer = window.setTimeout(refreshMarket, S.marketDelay);
};

const renderMarket = () => {
  const m = S.market;
  openSheet(
    h('h2', {}, t('tab.market')),
    m?.saving ? h('p', { class: 'warn' }, m.saving >= 2 ? t('mk.readonly', { time: quotaResetTime() }) : t('mk.saving')) : '',
    !m ? h('p', { class: 'muted' }, t('misc.loading')) : h('table', { class: 'market' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, t('mk.ref')), h('th', {}, t('mk.bid')), h('th', {}, t('mk.ask')))),
      h('tbody', {}, ...m.products.map((p) => h('tr', { tabindex: 0, on: { click: () => openProduct(p.id), keydown: (e) => { if ((e as KeyboardEvent).key === 'Enter') openProduct(p.id); } } },
        h('td', {}, h('strong', {}, productName(p.id)), h('br'), delta(p.changeBp)),
        h('td', { class: 'num' }, money(p.ref, 2)),
        h('td', { class: 'num' }, p.bid ? money(p.bid, 2) : '—'),
        h('td', { class: 'num' }, p.ask ? money(p.ask, 2) : '—'))))),
  );
};

const drawChart = (canvas: HTMLCanvasElement, history: MarketDetail['history']) => {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = canvas.clientWidth || 320, H = 96;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.fillStyle = C.noche; g.fillRect(0, 0, W, H);
  if (!history.length) return;
  if (history.length === 1) history = [history[0], history[0]]; // sin historia todavía: línea plana
  const vals = history.map((x) => x.ref);
  const lo = Math.min(...vals) * 0.98, hi = Math.max(...vals) * 1.02;
  const xs = (i: number) => 8 + (i * (W - 16)) / (history.length - 1);
  const ys = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  g.fillStyle = C.rio;
  for (let i = 0; i < history.length - 1; i++) { // línea escalonada en píxeles
    const x0 = Math.round(xs(i)), x1 = Math.round(xs(i + 1)), y0 = Math.round(ys(vals[i])), y1 = Math.round(ys(vals[i + 1]));
    g.fillRect(x0, y0 - 1, x1 - x0, 3);
    g.fillRect(x1 - 1, Math.min(y0, y1) - 1, 3, Math.abs(y1 - y0) + 3);
  }
  g.fillStyle = C.franco;
  const lx = Math.round(xs(history.length - 1)), ly = Math.round(ys(vals[vals.length - 1]));
  g.fillRect(lx - 3, ly - 3, 6, 6);
};

const openProduct = async (p: ProductId) => {
  S.product = p;
  if (S.tab !== 'market') { S.tab = 'market'; renderChrome(); }
  const d = await run(() => api<MarketDetail>('GET', `/market/${p}`));
  if (!d || S.product !== p) return;
  const me = S.me;
  const have = me?.company.inv[p] ?? 0;
  const bestBid = d.bids[0]?.price, bestAsk = d.asks[0]?.price;
  const price = h('input', { id: 'order-price', type: 'number', inputmode: 'decimal', min: 0.01, step: 0.01 });
  const qty = h('input', { id: 'order-qty', type: 'number', inputmode: 'numeric', min: 1, step: 1, value: '10' });
  const summary = h('p', { class: 'muted num', 'aria-live': 'polite' });
  const sideBtns = h('div', { class: 'seg' });
  const update = () => {
    const pc = Math.round(Number(price.value) * 100), q = Math.floor(Number(qty.value));
    const total = pc > 0 && q > 0 ? pc * q : 0;
    summary.textContent = S.side === 'sell'
      ? `${t('mk.total', { amount: money(total, 2) })} · ${t('mk.fee', { amount: money(Math.floor(total * 0.03), 2) })}`
      : t('mk.total', { amount: money(total, 2) });
  };
  const setSide = (s: 'buy' | 'sell') => {
    S.side = s;
    const suggested = s === 'buy' ? bestAsk ?? d.ref : bestBid ?? d.ref;
    price.value = (suggested / 100).toFixed(2);
    if (s === 'sell' && have > 0) qty.value = String(Math.min(have, Math.max(1, Number(qty.value) || 1)));
    clear(sideBtns).append(...(['sell', 'buy'] as const).map((x) => h('button', {
      type: 'button', class: `chip ${S.side === x ? 'active' : ''}`, 'aria-pressed': String(S.side === x), on: { click: () => setSide(x) },
    }, t(`mk.${x}`))));
    update();
  };
  price.addEventListener('input', update);
  qty.addEventListener('input', update);
  const send = h('button', { class: 'btn primary big', type: 'submit' }, t('mk.send'));
  const form = h('form', { class: 'order-form', on: { submit: async (e) => {
    e.preventDefault();
    if (!S.me) { showLanding(); return; }
    const body = { product: p, side: S.side, price: Math.round(Number(price.value) * 100), qty: Math.floor(Number(qty.value)) };
    const r = await run(() => api<OrderResponse>('POST', '/orders', body), send);
    if (!r) return;
    setMe(r.me);
    if (r.filled) { toast(t('mk.filled', { qty: num(r.filled), price: money(r.avgPrice!, 2) }), 'ok'); blip('coin'); }
    if (r.filled < body.qty) toast(r.filled ? `${t('mk.filled', { qty: num(r.filled), price: money(r.avgPrice!, 2) })} ${t('mk.resting')}` : t('mk.resting'), 'ok');
    S.market = null;
    openProduct(p);
  } } },
    sideBtns,
    h('div', { class: 'field-row' },
      h('label', {}, h('span', { class: 'label' }, t('mk.price')), price),
      h('label', {}, h('span', { class: 'label' }, t('mk.qty')), qty)),
    h('div', { class: 'row space' }, h('span', { class: 'muted' }, t('mk.have', { count: num(have) })),
      h('button', { type: 'button', class: 'link', on: { click: () => { setSide('sell'); qty.value = String(have); update(); } } }, t('mk.all'))),
    summary,
    send,
  );
  setSide(S.side);
  const level = (l: MarketDetail['bids'][number]) => h('li', { class: l.kind },
    h('span', { class: 'num' }, money(l.price, 2)), h('span', { class: 'num' }, num(l.qty)), h('span', { class: 'muted small' }, t(`mk.kind.${l.kind}`)));
  const chart = h('canvas', { class: 'chart', 'aria-label': t('mk.history'), role: 'img' });
  const myOrders = me?.orders.filter((o) => o.product === p) ?? [];
  openSheet(
    h('button', { class: 'link back', on: { click: () => { S.product = null; renderMarket(); refreshMarket(); } } }, icon('back', 12), ' ', t('mk.back')),
    h('h2', {}, productName(p)),
    h('p', {}, `${t('mk.ref')}: `, h('strong', { class: 'num' }, money(d.ref, 2))),
    form,
    myOrders.length ? h('div', {}, h('h3', {}, t('co.orders')), h('ul', { class: 'orders' }, ...myOrders.map(orderRow))) : '',
    h('h3', {}, t('mk.history')),
    chart,
    h('h3', {}, t('mk.book')),
    h('div', { class: 'book' },
      h('div', {}, h('p', { class: 'label' }, t('mk.ask')), h('ul', {}, ...d.asks.map(level))),
      h('div', {}, h('p', { class: 'label' }, t('mk.bid')), h('ul', {}, ...d.bids.map(level)))),
    h('h3', {}, t('mk.trades')),
    d.trades.length ? h('ul', { class: 'trades' }, ...d.trades.map((tr) => h('li', {},
      h('span', { class: 'num' }, money(tr.price, 2)), h('span', { class: 'num' }, num(tr.qty)),
      h('span', { class: 'muted small' }, new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(tr.at))))) : h('p', { class: 'muted' }, t('mk.noTrades')),
  );
  requestAnimationFrame(() => drawChart(chart, d.history));
};

// ---------- ajustes ----------

const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => {
  const id = 'set-' + label.replace(/\W/g, '');
  const input = h('input', { id, type: 'checkbox', role: 'switch', checked: value, on: { change: (e) => onChange((e.target as HTMLInputElement).checked) } });
  return h('label', { class: 'switch', for: id }, h('span', {}, label), input);
};

const showSettings = () => {
  openSheet(
    h('h2', {}, t('set.title')),
    h('p', { class: 'label' }, t('set.lang')),
    langPicker(),
    getLang() !== 'es' ? h('p', { class: 'muted small' }, t('set.machine'), ' ',
      h('a', { href: 'https://github.com/portlight-game/portlight/issues/new?labels=i18n', target: '_blank', rel: 'noopener' }, t('set.suggest'))) : '',
    toggle(t('set.sound'), S.settings.sound, (v) => { S.settings.sound = v; setSound(v); save(); blip('coin'); }),
    toggle(t('set.motion'), S.settings.motion, (v) => { S.settings.motion = v; map.reduceMotion = v; document.documentElement.classList.toggle('reduce-motion', v); save(); }),
    toggle(t('set.data'), S.settings.data, (v) => { S.settings.data = v; save(); }),
  );
};

const changeLang = async (l: Lang) => {
  await setLang(l);
  try { localStorage.setItem('pl.lang', l); } catch { /* ok */ }
  history.replaceState(null, '', `/${l}/${location.search}`);
  renderChrome();
  map.invalidate();
  if (!overlay().hidden) showLanding();
  else if (!sheet().hidden) {
    if (S.tab === 'company') renderCompany();
    else if (S.tab === 'market') S.product ? openProduct(S.product) : renderMarket();
    else showSettings();
  }
};

// ---------- arranque ----------

let mapTimer = 0;
const refreshMap = async () => {
  clearTimeout(mapTimer);
  if (!document.hidden) {
    const snap = await api<MapSnapshot>('GET', '/map').catch(() => null);
    if (snap && snap !== S.snapshot) { S.snapshot = snap; map.setSnapshot(snap); }
  }
  mapTimer = window.setTimeout(refreshMap, S.settings.data ? 180_000 : 90_000);
};

const boot = async () => {
  load();
  setSound(S.settings.sound);
  document.documentElement.classList.toggle('reduce-motion', S.settings.motion);
  const lang = detectLang();
  await setLang(lang);
  if (!location.pathname.startsWith(`/${lang}/`)) history.replaceState(null, '', `/${lang}/${location.search}`);
  map = new MapView($('#map') as HTMLCanvasElement, $('#minimap') as HTMLCanvasElement);
  map.reduceMotion = S.settings.motion;
  map.onSelect = (lot) => showLot(lot);
  $('#zoom-in').append(icon('plus'));
  $('#zoom-out').append(icon('minus'));
  $('#go-home').append(icon('home'));
  $('#zoom-in').addEventListener('click', () => map.zoom(1.4));
  $('#zoom-out').addEventListener('click', () => map.zoom(1 / 1.4));
  $('#go-home').addEventListener('click', () => { if (S.me) map.flyToDistrict(S.me.company.district, 30); });
  renderChrome();
  await refreshMap();
  if (hasToken()) {
    const me = await run(() => api<MeResponse>('GET', '/me'));
    if (me) { setMe(me); map.flyToDistrict(me.company.district, 26); overlay().hidden = true; }
  }
  if (!S.me) showLanding();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    refreshMap();
    if (S.tab === 'market') refreshMarket();
    if (S.me) { const me = await api<MeResponse>('GET', '/me').catch(() => null); if (me) { setMe(me); if (S.tab === 'company') renderCompany(); } }
  });
};

boot();
