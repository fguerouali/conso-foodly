import { readFile } from 'node:fs/promises';
import { parseWorkbook } from '../src/compute.js';

const filePath = process.argv[2]
  || 'C:\\Users\\Fayçal\\Downloads\\REPARTITION_DES_VENTES_PAR_PRODUITS_DU_2026_10_01_AU_2026_10_31 (2).xlsx';

const buffer = await readFile(filePath);
const report = parseWorkbook(buffer, 'octobre.xlsx');
const expected = { pouletCruG: 1063010, viandeCruG: 274204, tenderCruG: 51040 };
let ok = true;

for (const key of Object.keys(expected)) {
  if (report[key] !== expected[key]) {
    console.error(`${key}: ${report[key]} !== ${expected[key]}`);
    ok = false;
  }
}

const notes = report.lines.filter((line) => line.note).map((line) => line.nom);
if (notes.length !== 0) {
  console.error('notes', notes);
  ok = false;
}
const pouletSuper = report.lines.find((line) => line.nom === 'Menu Shawarma poulet Super');
if (!pouletSuper || pouletSuper.pouletCuit !== 120 || pouletSuper.viandeCuite !== 0) {
  console.error('poulet super', pouletSuper);
  ok = false;
}
const kabssa = report.lines.find((line) => line.nom === 'Plat gourmand shawarma viande - kabssa');
if (!kabssa || kabssa.pouletCuit !== 0 || kabssa.viandeCuite !== 120) {
  console.error('viande kabssa', kabssa);
  ok = false;
}
const pouletMhalabia = report.lines.find((line) => line.nom === 'menu shawarma poulet + mhalabia');
if (!pouletMhalabia || pouletMhalabia.pouletCuit !== 60 || pouletMhalabia.viandeCuite !== 0) {
  console.error('poulet mhalabia', pouletMhalabia);
  ok = false;
}
const tendersFrites = report.lines.find((line) => line.nom === 'Tenders Frites');
if (!tendersFrites || tendersFrites.tender !== 120) {
  console.error('tenders frites', tendersFrites);
  ok = false;
}
const excluded = new Set([
  'box shawarma viande',
  'box shawarma poulet',
  'portion riz 250 gr',
  'portion riz 500',
  'extra pistache',
  'frites',
  'houmouss',
  'mini trio mezzes',
  'mouhamara',
  'mtabel',
]);
for (const line of report.lines) {
  const name = line.nom.toLowerCase().replace(/\s+/g, ' ').trim();
  if (excluded.has(name)) {
    console.error('still counted', line.nom);
    ok = false;
  }
}
if (report.caisse !== '2582' || report.periodStart !== '2026-10-01') {
  console.error('period', report.periodStart, report.caisse);
  ok = false;
}

console.log(JSON.stringify({
  ok,
  viandeKg: report.viandeCruG / 1000,
  pouletKg: report.pouletCruG / 1000,
  tenderKg: report.tenderCruG / 1000,
  lines: report.lines.length,
  ignored: report.ignored.length,
  notes,
}, null, 2));

if (!ok) process.exit(1);
