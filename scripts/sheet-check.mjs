import { blankWeek, carryBefore, computeWeek, monthConso } from '../src/sheet.js';

const week = blankWeek();
week.lundi.poulet = {
  ...week.lundi.poulet,
  initPoulet: '10', initGraisse: '2', initChutes: '1', initBroche: '4',
  recuPoulet: '5', recuGraisse: '1',
  b1Poulet: '4', b1Graisse: '1', b1Chutes: '0.5',
  b2Poulet: '3', b2Chutes: '0.2',
  b3Poulet: '2', b3Chutes: '0.1',
  finalBroche: '1',
};
week.lundi.viande = {
  ...week.lundi.viande,
  initViande: '20', initVH: '4', initChutes: '1', initBroche: '6',
  recuViande: '10', recuVH: '2',
  b1Viande: '8', b1VH: '2', b1Chutes: '0.4',
  b2Viande: '5', b2VH: '1', b2Chutes: '0.3',
  finalBroche: '3',
};
week.mardi.poulet = { ...week.mardi.poulet, finalBroche: '0' };

const out = computeWeek(week);
const p = out.lundi.poulet;
const v = out.lundi.viande;
const checks = [
  ['poulet final', p.final.poulet, 10 + 5 - (4 + 3 + 2)],
  ['poulet graisse', p.final.graisse, 2 + 1 - 1],
  ['poulet chutes', p.final.chutes, 1 + 4 - (0.5 + 0.2 + 0.1)],
  ['poulet conso', p.conso, 4 + 3 + 2 - 1],
  ['mardi init poulet', out.mardi.poulet.init.poulet, p.final.poulet],
  ['viande broche 1', v.broche1, 10],
  ['viande broche 2', v.broche2, 6],
  ['viande final', v.final.viande, 20 + 10 - (8 + 5)],
  ['vh final', v.final.vh, 4 + 2 - (2 + 1)],
  ['viande chutes', v.final.chutes, 1 + 0.4 + 0.3],
  ['viande conso', v.conso, 10 + 6 - 3],
  ['mardi init viande', out.mardi.viande.init.viande, v.final.viande],
];

let failed = 0;
for (const [name, got, expected] of checks) {
  if (Math.abs(got - expected) > 0.001) {
    failed += 1;
    console.error(name, got, expected);
  }
}
const month = monthConso({ '2026-11-02': week }, '2026-11');
if (month.poulet !== p.conso + out.mardi.poulet.conso) {
  failed += 1;
  console.error('month poulet', month);
}
if (month.viande !== v.conso) {
  failed += 1;
  console.error('month viande', month, v.conso);
}
const carried = carryBefore({ '2026-11-02': week }, '2026-11-09');
const next = computeWeek(blankWeek(), carried);
if (next.lundi.poulet.opening || next.lundi.poulet.init.poulet !== p.final.poulet) {
  failed += 1;
  console.error('lundi suivant poulet', next.lundi.poulet.opening, next.lundi.poulet.init.poulet, p.final.poulet);
}
if (next.lundi.viande.opening || next.lundi.viande.init.viande !== v.final.viande) {
  failed += 1;
  console.error('lundi suivant viande', next.lundi.viande.opening, next.lundi.viande.init.viande, v.final.viande);
}
const mid = blankWeek();
mid.mercredi.poulet = { ...mid.mercredi.poulet, initPoulet: '7', finalBroche: '1' };
const started = computeWeek(mid, { poulet: null, viande: null });
if (!started.lundi.poulet.opening || !started.mercredi.poulet.opening || started.jeudi.poulet.opening) {
  failed += 1;
  console.error('ouverture mercredi', started.lundi.poulet.opening, started.mercredi.poulet.opening, started.jeudi.poulet.opening);
}
if (started.jeudi.poulet.init.poulet !== 7) {
  failed += 1;
  console.error('jeudi', started.jeudi.poulet.init.poulet);
}
if (failed) process.exit(1);
console.log('sheet ok', { poulet: p.conso, viande: v.conso, days: month.days });
