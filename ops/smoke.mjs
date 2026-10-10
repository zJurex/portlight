// Prueba de humo de la API: node ops/smoke.mjs [baseUrl]
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
let token = '';
const call = async (method, path, body) => {
  const r = await fetch(base + '/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = r.status === 304 ? null : await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const expectErr = async (code, p) => { try { await p; throw new Error('esperaba ' + code); } catch (e) { if (!String(e.message).includes(code)) throw e; } };

const D = Math.floor(Math.random() * 280), L = D * 64;
const name = 'Smoke ' + Math.random().toString(36).slice(2, 8);
const s = await call('POST', '/start', { name, district: D, color: 0x3fc1c9, lang: 'es' });
token = s.token;
console.log('start ok', s.me.company.cash, 'free', s.me.company.freeClaims);
await expectErr('lot_district', call('POST', '/claim', { lot: ((D + 1) % 280) * 64 }));
await expectErr('name_taken', call('POST', '/start', { name, district: D }));
let me = await call('POST', '/claim', { lot: L + 2 });
me = await call('POST', '/claim', { lot: L + 3 });
me = await call('POST', '/build', { lot: L + 2, building: 'farm' });
me = await call('POST', '/build', { lot: L + 3, building: 'power' });
console.log('lots', me.lots.map((l) => `${l.lot}:${l.building}`).join(' '), 'cash', me.company.cash);
await expectErr('lot_busy', call('POST', '/build', { lot: L + 2, building: 'mine' }));
me = await call('POST', '/upgrade', { lot: L + 2 });
const mk = await call('GET', '/market');
console.log('market', mk.products.map((p) => `${p.id}:${p.ref}/${p.bid}/${p.ask}`).join(' '));
const wheat = mk.products.find((p) => p.id === 'wheat');
const buy = await call('POST', '/orders', { product: 'wheat', side: 'buy', price: wheat.ask, qty: 5 });
console.log('buy filled', buy.filled, 'avg', buy.avgPrice, 'inv', JSON.stringify(buy.me.company.inv));
const sell = await call('POST', '/orders', { product: 'wheat', side: 'sell', price: wheat.bid, qty: 5 });
console.log('sell filled', sell.filled, 'avg', sell.avgPrice, 'cash', sell.me.company.cash);
const rest = await call('POST', '/orders', { product: 'energy', side: 'buy', price: 150, qty: 10 });
console.log('resting orders', rest.me.orders.length, 'cash', rest.me.company.cash);
me = await call('DELETE', '/orders/' + rest.me.orders[0].id);
console.log('after cancel', me.orders.length, 'cash', me.company.cash);
const col = await call('POST', '/collect');
console.log('collect', JSON.stringify(col.produced));
const det = await call('GET', '/market/wheat');
console.log('book', det.bids.length, det.asks.length, 'trades', det.trades.length);
const map = await call('GET', '/map');
console.log('map lots', map.lots.length / 4, 'companies', map.companies.length, 'players', map.players);
console.log('SMOKE OK');
