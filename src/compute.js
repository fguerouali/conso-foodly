import * as XLSX from 'xlsx';
import { recipes } from './recipe.js';

export const COEF_POULET = 1.3;
export const COEF_VIANDE = 1.4;

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const recipeByName = new Map(recipes.map((recipe) => [normalizeKey(recipe.nom), recipe]));

function rawGrams(qty, cooked, coef) {
  const coef10 = Math.round(coef * 10);
  return Math.round((qty * cooked * coef10) / 10);
}

function conflictNote(key, recipe) {
  const saysPoulet = /\bpoulet\b/.test(key);
  const saysViande = /\bviande\b/.test(key);
  const saysTender = /\btenders?\b/.test(key);
  const saysMixte = /\bmixte\b/.test(key);
  if (saysMixte || (saysPoulet && saysViande)) return null;
  if (saysPoulet && !saysViande && !saysTender && recipe.viande > 0) {
    return 'Le nom indique du poulet, le barème compte aussi de la viande.';
  }
  if (saysViande && !saysPoulet && !saysTender && recipe.poulet > 0 && recipe.viande === 0) {
    return 'Le nom indique de la viande, le barème est dans la colonne poulet.';
  }
  if (saysTender && !saysPoulet && !saysViande && (recipe.poulet > 0 || recipe.viande > 0)) {
    return 'Le nom indique du tender, le barème compte une autre protéine.';
  }
  return null;
}

export function recipeNote(recipe) {
  return conflictNote(normalizeKey(recipe.nom), recipe);
}

function toQty(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/\s/g, '').replace(',', '.'));
    return n;
  }
  return NaN;
}

function findHeader(rows) {
  const limit = Math.min(rows.length, 20);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] || [];
    let produit = -1;
    let quantite = -1;
    row.forEach((cell, cellIndex) => {
      const key = normalizeKey(cell);
      if (key === 'produit') produit = cellIndex;
      if (key === 'quantite' || key === 'qte') quantite = cellIndex;
    });
    if (produit >= 0 && quantite >= 0) {
      return { headerIndex: index, produit, quantite };
    }
  }
  return null;
}

export function parseWorkbook(data, fileName = '') {
  const workbook = XLSX.read(data, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeKey(name) === 'ventes par produit');
  if (!sheetName) {
    throw new Error('Ce fichier ne contient pas la feuille VENTES_PAR_PRODUIT.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  const header = findHeader(rows);
  if (!header) {
    throw new Error('Colonnes PRODUIT et QUANTITÉ introuvables.');
  }

  const texts = [];
  rows.slice(0, 4).forEach((row) => {
    (row || []).forEach((cell) => {
      if (typeof cell === 'string' && cell.trim()) texts.push(cell.trim());
    });
  });
  const headerLine = (texts.find((text) => /Du\s+\d{2}/i.test(text)) || '').replace(/\s+/g, ' ').trim();
  const period = headerLine.match(
    /Du\s+(\d{2})[/.-](\d{2})[/.-](\d{4})\s+au\s+(\d{2})[/.-](\d{2})[/.-](\d{4})/i,
  );
  const caisseMatch = headerLine.match(/Caisse\s+(\d+)/i);

  const qtyByName = new Map();
  for (let index = header.headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const rawName = row[header.produit];
    if (rawName == null || typeof rawName === 'number') continue;
    const nom = String(rawName).trim();
    if (!nom || normalizeKey(nom).startsWith('total')) continue;
    const qty = toQty(row[header.quantite]);
    if (!Number.isFinite(qty) || qty === 0) continue;
    const key = normalizeKey(nom);
    const current = qtyByName.get(key);
    if (current) current.qty += qty;
    else qtyByName.set(key, { nom, qty });
  }

  if (qtyByName.size === 0) {
    throw new Error('Aucune quantité vendue dans VENTES_PAR_PRODUIT.');
  }

  const lines = [];
  const ignored = [];

  qtyByName.forEach((sale, key) => {
    const recipe = recipeByName.get(key);
    if (!recipe || (!recipe.poulet && !recipe.viande && !recipe.tender)) {
      ignored.push(sale);
      return;
    }
    const pouletCruG = rawGrams(sale.qty, recipe.poulet, COEF_POULET);
    const viandeCruG = rawGrams(sale.qty, recipe.viande, COEF_VIANDE);
    const tenderCruG = rawGrams(sale.qty, recipe.tender, 1);
    lines.push({
      nom: recipe.nom,
      qty: sale.qty,
      pouletCuit: recipe.poulet,
      viandeCuite: recipe.viande,
      tender: recipe.tender,
      pouletCruG,
      viandeCruG,
      tenderCruG,
      note: conflictNote(key, recipe) || '',
    });
  });

  lines.sort(
    (a, b) => b.pouletCruG + b.viandeCruG + b.tenderCruG - (a.pouletCruG + a.viandeCruG + a.tenderCruG),
  );
  ignored.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

  const sum = (key) => lines.reduce((total, line) => total + line[key], 0);

  return {
    fileName,
    headerLine,
    caisse: caisseMatch ? caisseMatch[1] : '',
    periodStart: period ? `${period[3]}-${period[2]}-${period[1]}` : '',
    periodEnd: period ? `${period[6]}-${period[5]}-${period[4]}` : '',
    pouletCruG: sum('pouletCruG'),
    viandeCruG: sum('viandeCruG'),
    tenderCruG: sum('tenderCruG'),
    ventesCount: qtyByName.size,
    lines,
    ignored,
  };
}
