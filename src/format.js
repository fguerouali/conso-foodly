const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const kgFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatKg(grams) {
  return kgFormat.format((Number(grams) || 0) / 1000);
}

export function formatQty(value) {
  const n = Number(value) || 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatGrams(value) {
  return `${formatQty(value)} g`;
}

export function formatShare(part, total) {
  if (!total) return '0 %';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format((part / total) * 100)} %`;
}

export function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function portionLabel(line) {
  const parts = [];
  if (line.pouletCuit) parts.push(`${formatGrams(line.pouletCuit)} poulet cuit`);
  if (line.viandeCuite) parts.push(`${formatGrams(line.viandeCuite)} viande cuite`);
  if (line.tender) parts.push(`${formatGrams(line.tender)} tender`);
  return parts.join(' · ');
}

export function labelFromMonthInput(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return '';
  const [year, month] = value.split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name) return '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function monthInputFromDate(iso) {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return '';
  return iso.slice(0, 7);
}

export function periodBounds(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return {
    periodStart: `${year}-${mm}-01`,
    periodEnd: `${year}-${mm}-${String(last).padStart(2, '0')}`,
  };
}
