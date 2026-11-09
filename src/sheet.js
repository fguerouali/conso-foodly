export const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export const RESTAURANTS = [
  { id: 4144, nom: 'Foodly Aïn Sebaâ', ville: 'Casablanca' },
  { id: 3905, nom: 'Foodly Bourgogne', ville: 'Casablanca' },
  { id: 2582, nom: 'Foodly Californie', ville: 'Casablanca' },
  { id: 1792, nom: 'Foodly Zeraoui', ville: 'Casablanca' },
  { id: 4234, nom: 'Foodly Mohammedia Parc', ville: 'Mohammedia' },
  { id: 4574, nom: 'Foodly Hay Riad', ville: 'Rabat' },
];

export function blankPoulet() {
  return {
    initBroche: '', initPoulet: '', initGraisse: '', initChutes: '',
    recuPoulet: '', recuGraisse: '',
    b1Poulet: '', b1Graisse: '', b1Chutes: '',
    b2Poulet: '', b2Graisse: '', b2Chutes: '',
    b3Poulet: '', b3Graisse: '', b3Chutes: '',
    finalBroche: '',
  };
}

export function blankViande() {
  return {
    initBroche: '', initViande: '', initVH: '', initChutes: '',
    recuViande: '', recuVH: '',
    b1Viande: '', b1VH: '', b1Graisse: '', b1Chutes: '',
    b2Viande: '', b2VH: '', b2Graisse: '', b2Chutes: '',
    finalBroche: '',
  };
}

export function blankDay() {
  return { poulet: blankPoulet(), viande: blankViande() };
}

export function blankWeek() {
  return Object.fromEntries(DAYS.map((day) => [day, blankDay()]));
}

function num(value) {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function filled(record) {
  return Object.values(record || {}).some((value) => String(value ?? '').trim() !== '');
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function computePoulet(input, previous) {
  const source = input || blankPoulet();
  const init = previous || {
    broche: num(source.initBroche),
    poulet: num(source.initPoulet),
    graisse: num(source.initGraisse),
    chutes: num(source.initChutes),
  };
  const brochesPoulet = num(source.b1Poulet) + num(source.b2Poulet) + num(source.b3Poulet);
  const final = {
    broche: num(source.finalBroche),
    poulet: round2(init.poulet + num(source.recuPoulet) - brochesPoulet),
    graisse: round2(init.graisse + num(source.recuGraisse) - (num(source.b1Graisse) + num(source.b2Graisse) + num(source.b3Graisse))),
    chutes: round2(init.chutes + num(source.b1Poulet) - (num(source.b1Chutes) + num(source.b2Chutes) + num(source.b3Chutes))),
  };
  return {
    init,
    final,
    conso: round2(brochesPoulet - final.broche),
    entered: filled(source),
    opening: previous == null,
  };
}

export function computeViande(input, previous) {
  const source = input || blankViande();
  const init = previous || {
    broche: num(source.initBroche),
    viande: num(source.initViande),
    vh: num(source.initVH),
    chutes: num(source.initChutes),
  };
  const broche1 = round2(num(source.b1Viande) + num(source.b1VH));
  const broche2 = round2(num(source.b2Viande) + num(source.b2VH));
  const final = {
    broche: num(source.finalBroche),
    viande: round2(init.viande + num(source.recuViande) - (num(source.b1Viande) + num(source.b2Viande))),
    vh: round2(init.vh + num(source.recuVH) - (num(source.b1VH) + num(source.b2VH))),
    chutes: round2(init.chutes + num(source.b1Chutes) + num(source.b2Chutes)),
  };
  return {
    init,
    final,
    broche1,
    broche2,
    conso: round2(broche1 + broche2 - final.broche),
    entered: filled(source),
    opening: previous == null,
  };
}

export function computeWeek(week, carry) {
  const out = {};
  let prevPoulet = carry?.poulet ?? null;
  let prevViande = carry?.viande ?? null;
  DAYS.forEach((day) => {
    const entry = week?.[day] || blankDay();
    const poulet = computePoulet(entry.poulet, prevPoulet);
    const viande = computeViande(entry.viande, prevViande);
    if (prevPoulet != null || poulet.entered) prevPoulet = poulet.final;
    if (prevViande != null || viande.entered) prevViande = viande.final;
    out[day] = { poulet, viande };
  });
  return out;
}

export function carryBefore(weeks, monday) {
  const days = [];
  for (const [key, week] of Object.entries(weeks || {})) {
    if (key >= monday) continue;
    DAYS.forEach((day) => days.push({ date: dateOfDay(key, day), week, day }));
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  let poulet = null;
  let viande = null;
  for (const item of days) {
    const entry = item.week?.[item.day] || blankDay();
    const nextPoulet = computePoulet(entry.poulet, poulet);
    const nextViande = computeViande(entry.viande, viande);
    if (poulet != null || nextPoulet.entered) poulet = nextPoulet.final;
    if (viande != null || nextViande.entered) viande = nextViande.final;
  }
  return { poulet, viande };
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return isoDate(d);
}

export function shiftMonday(monday, weeks) {
  const [y, m, d] = monday.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + weeks * 7);
  return isoDate(date);
}

export function dateOfDay(monday, day) {
  const [y, m, d] = monday.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + DAYS.indexOf(day)));
  return date.toISOString().slice(0, 10);
}

export function monthConso(weeks, month) {
  let poulet = 0;
  let viande = 0;
  let days = 0;
  for (const [monday, week] of Object.entries(weeks || {})) {
    const computed = computeWeek(week);
    DAYS.forEach((day) => {
      if (!dateOfDay(monday, day).startsWith(month)) return;
      const row = computed[day];
      if (row.poulet.entered || row.viande.entered) days += 1;
      if (row.poulet.entered) poulet += row.poulet.conso;
      if (row.viande.entered) viande += row.viande.conso;
    });
  }
  return { poulet: round2(poulet), viande: round2(viande), days };
}
