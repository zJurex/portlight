// Corre los escenarios de balance y escribe sim/REPORT.md con los criterios de la sección 6.
// Uso: npx tsx sim/src/run.ts [--players 10000] [--days 90] [--quick]
import { writeFileSync } from 'node:fs';
import { BASE_VALUE, PRODUCTS } from '@portlight/shared';
import { HONEST, Sim, type SimConfig } from './sim';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const quick = process.argv.includes('--quick');
const players = arg('players', quick ? 1000 : 10_000);
const days = arg('days', quick ? 30 : 90);
const seed = arg('seed', 7);

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f = (n: number, d = 2) => n.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
const money = (c: number) => '₣' + Math.round(c / 100).toLocaleString('es-AR');

interface Result { name: string; sim: Sim; ms: number }

const runScenario = (name: string, cfg: Partial<SimConfig>): Result => {
  const t0 = Date.now();
  const sim = new Sim({ players, days, seed, cheaters: 0, refRules: 'robust', launchShare: 0.3, log: (s) => { if (/día (1|10|20|30|45|60|75|90):/.test(s)) console.log(`  [${name}] ${s}`); }, ...cfg });
  console.log(`▶ ${name}`);
  sim.run();
  return { name, sim, ms: Date.now() - t0 };
};

const results = [
  runScenario('honesto', {}),
  runScenario('con tramposos', { cheaters: Math.max(40, Math.floor(players / 100)) }),
  runScenario('con tramposos, ref ingenua', { cheaters: Math.max(40, Math.floor(players / 100)), refRules: 'naive' }),
];

interface Check { name: string; ok: boolean; detail: string }

const evaluate = ({ sim }: Result): Check[] => {
  const d30 = sim.daily.filter((r) => r.day <= 30);
  const maxDev = Math.max(...d30.map((r) => Math.abs(r.index - 1)));
  const maxDevAll = Math.max(...sim.daily.map((r) => Math.abs(r.index - 1)));
  // arbitraje: retorno diario de los arbitrajistas y lavadores sobre su capital inicial
  const cheats = sim.players.filter((p) => p.strategy === 'arb' || p.strategy === 'wash');
  const daysRun = sim.daily.length;
  const rate = (st: string) => { const xs = cheats.filter((p) => p.strategy === st); return xs.length ? Math.max(...xs.map((p) => p.arbProfit / sim.E.startCash / daysRun)) : 0; };
  const arbDaily = Math.max(rate('arb'), rate('wash'));
  // payback del primer edificio para jugadores llegados después de la primera semana, por estrategia honesta;
  // "buena estrategia" = la mejor que puede seguir un recién llegado (la del tutorial es granja + vender)
  const t0 = sim.players[0].joinedAt;
  const perStrategy = HONEST.filter((st) => st !== 'idle').map((st) => {
    const ps = sim.players.filter((p) => p.strategy === st && p.firstBuildAt && p.joinedAt - t0 > 7 * 24 * 3600_000);
    const pb = ps.map((p) => p.paybackHours ?? Infinity);
    return { st, n: ps.length, med: median(pb), under: pb.filter((x) => x < 24).length / Math.max(1, ps.length) };
  }).filter((x) => x.n >= 10);
  const bestNew = perStrategy.reduce((a, b) => (b.med < a.med ? b : a));
  const medPayback = bestNew.med;
  const paybackDetail = `mejor estrategia: ${bestNew.st} ${f(bestNew.med, 1)} h (${f(bestNew.under * 100, 0)} % < 24 h) · ` +
    perStrategy.filter((x) => x !== bestNew).map((x) => `${x.st} ${isFinite(x.med) ? f(x.med, 1) + ' h' : '—'}`).join(' · ');
  const w = sim.wealthAt[30] ?? [];
  const top1 = w.slice(Math.floor(w.length * 0.99));
  const ratio = top1.length ? top1.reduce((a, b) => a + b, 0) / top1.length / median(w) : NaN;
  const drift = sim.moneySupply() - sim.expectedMoney();
  return [
    { name: 'Índice de precios dentro de ±15 % en 30 días', ok: maxDev <= 0.15, detail: `desvío máx. ${f(maxDev * 100, 1)} % (90 días: ${f(maxDevAll * 100, 1)} %)` },
    { name: 'Ningún bucle de arbitraje > 2 % diario', ok: arbDaily <= 0.02, detail: cheats.length ? `arbitraje ${f(rate('arb') * 100, 3)} % · lavado de precios ${f(rate('wash') * 100, 3)} % diario` : 'sin agentes tramposos en este escenario' },
    { name: 'Jugador nuevo con buena estrategia recupera la 1.ª inversión en < 24 h', ok: medPayback < 24, detail: paybackDetail },
    { name: 'Top 1 % ≤ 20 × mediana al día 30', ok: ratio <= 20, detail: `${f(ratio, 1)} ×` },
    { name: 'Cero creación de dinero por redondeo o duplicación', ok: drift === 0, detail: `desvío contable: ${drift} centavos` },
  ];
};

const lines: string[] = [];
lines.push('# Informe del simulador de balance', '');
lines.push(`Generado: ${new Date().toISOString()} · ${players.toLocaleString('es-AR')} jugadores · ${days} días · semilla ${seed}`, '');
lines.push('Mismo motor que el servidor (`packages/shared`): producción perezosa, recetas, almacén, bots con retirada gradual, Estado con cupos por distrito, comisión del 3 % y mantenimiento. Estrategias honestas: granjero, cadena, optimizador, casual, trader e inactivo. Tramposos: arbitrajistas y pares de cuentas que lavan precios para inflar la referencia.', '');
let allOk = true;
for (const r of results) {
  const checks = evaluate(r);
  const gate = r.name !== 'con tramposos, ref ingenua';
  if (gate) allOk &&= checks.every((c) => c.ok);
  lines.push(`## Escenario: ${r.name}${gate ? '' : ' (control: muestra el exploit sin las defensas)'}`, '');
  lines.push(`Tiempo de cómputo: ${f(r.ms / 1000, 1)} s`, '');
  lines.push('| Criterio | Resultado | Detalle |', '| --- | --- | --- |');
  for (const c of checks) lines.push(`| ${c.name} | ${c.ok ? '✅' : '❌'} | ${c.detail} |`);
  const s = r.sim, k = s.money, last = s.daily[s.daily.length - 1];
  lines.push('', '**Flujo de francos (acumulado)**', '');
  lines.push('| Fuente / sumidero | Total |', '| --- | --- |');
  lines.push(`| Capital inicial | ${money(k.start)} |`, `| Compras de bots (+) | ${money(k.botBuys)} |`, `| Compras del Estado (+) | ${money(k.stateBuys)} |`);
  lines.push(`| Ventas de bots (−) | ${money(k.botSells)} |`, `| Ventas del Estado (−) | ${money(k.stateSells)} |`, `| Comisiones (−) | ${money(k.fees)} |`);
  lines.push(`| Mantenimiento (−) | ${money(k.maintenance)} |`, `| Lotes (−) | ${money(k.lots)} |`, `| Construcción y mejoras (−) | ${money(k.builds)} |`, `| **Masa monetaria final** | ${money(s.moneySupply())} |`);
  lines.push('', `Volumen: humano-humano ${money(s.volume.humanHuman)} · contra bots ${money(s.volume.vsBot)} · contra Estado ${money(s.volume.vsState)} · jugadores honestos activos al final: ${last.active.toLocaleString('es-AR')}`, '');
  lines.push('**Precio de referencia por producto (₣)**', '');
  const days = [1, 7, 14, 30, 60, 90].filter((d) => d <= s.daily.length);
  lines.push(`| Producto | Base | ${days.map((d) => `Día ${d}`).join(' | ')} |`, `| --- | --- | ${days.map(() => '---').join(' | ')} |`);
  for (const p of PRODUCTS) lines.push(`| ${p} | ${f(BASE_VALUE[p] / 100)} | ${days.map((d) => f(s.daily[d - 1][`ref_${p}`] / 100)).join(' | ')} |`);
  lines.push(`| **índice** | 1,00 | ${days.map((d) => f(s.daily[d - 1].index, 3)).join(' | ')} |`, '');
  const byStrategy = HONEST.map((st) => {
    const ps = s.players.filter((p) => p.strategy === st);
    return `| ${st} | ${ps.length} | ${money(median(ps.map((p) => s.netWorth(p))))} | ${f(median(ps.filter((p) => p.paybackHours !== null).map((p) => p.paybackHours!)), 1)} h |`;
  });
  lines.push('**Por estrategia (final)**', '', '| Estrategia | Jugadores | Patrimonio mediano | Payback mediano |', '| --- | --- | --- | --- |', ...byStrategy, '');
}
lines.push(`## Veredicto de la compuerta de la fase 2: ${allOk ? '✅ APROBADA' : '❌ NO APROBADA'}`, '');
writeFileSync('sim/REPORT.md', lines.join('\n'));
console.log(lines.filter((l) => l.startsWith('|') && (l.includes('✅') || l.includes('❌')) || l.startsWith('## ')).join('\n'));
process.exit(allOk ? 0 : 1);
