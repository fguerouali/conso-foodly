import { buildReport, productLabel } from '../src/compute.js';

const BASE = 'https://apiv2.lacaisse.ma/api/v1/';

function fail(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function monthWindow(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw fail('Choisissez un mois.', 400);
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw fail('Choisissez un mois.', 400);
  const last = new Date(year, monthNumber, 0).getDate();
  const mm = String(monthNumber).padStart(2, '0');
  const yy = String(year).slice(2);
  const dd = String(last).padStart(2, '0');
  return {
    month,
    periodStart: `${year}-${mm}-01`,
    periodEnd: `${year}-${mm}-${dd}`,
    dateDebut: `01-${mm}-${yy}`,
    dateFin: `${dd}-${mm}-${yy}`,
  };
}

async function post(path, body, token, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw fail('La Caisse ne répond pas.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = String(data.status || data.message || '');
    if (/login ou mot de passe/i.test(raw)) throw fail('Identifiants La Caisse refusés.', 401);
    throw fail(raw || `La Caisse a répondu ${response.status}.`, response.status);
  }
  return data;
}

function isFoodly(store) {
  return /foodly/i.test(String(store?.nom_societe || ''));
}

function caisseDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year.slice(2)}`;
}

function spanWindow(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw fail('Choisissez une date.', 400);
  }
  return {
    month: from.slice(0, 7),
    periodStart: from,
    periodEnd: to,
    dateDebut: caisseDate(from),
    dateFin: caisseDate(to),
  };
}

async function fetchPeriod(period, onlyIds) {
  const login = process.env.LACAISSE_LOGIN;
  const password = process.env.LACAISSE_PASSWORD;
  if (!login || !password) {
    throw fail('La connexion La Caisse n’est pas configurée sur le serveur.', 503);
  }
  const auth = await post('auth', { login, password });
  if (!auth.token) throw fail('Identifiants La Caisse refusés.', 401);

  const listed = await post('caisse/listCaisse', { email: login }, auth.token);
  const wanted = new Set((onlyIds || []).map(Number));
  const stores = (Array.isArray(listed.data) ? listed.data : []).filter((store) => (
    isFoodly(store) && (!wanted.size || wanted.has(Number(store.id_caisse)))
  ));
  if (stores.length === 0) throw fail('Aucun point de vente Foodly trouvé.', 404);

  const details = await Promise.all(stores.map(async (store) => {
    const id = store.id_caisse;
    try {
      const payload = await post(`activiteproduit/${id}`, {
        info: { dateDebut: period.dateDebut, dateFin: period.dateFin, listcaisses: '' },
      }, auth.token, {
        'X-identifier-val': String(id),
        'X-identifier-account': String(auth.id_account_caisse || ''),
      });
      const rows = payload?.data?.ventesParProduit || [];
      const report = buildReport(rows.map((row) => ({
        nom: productLabel(row.designation),
        qty: row.quantite,
      })), {
        id,
        nom: store.nom_societe,
        ville: store.ville || 'Autre',
      });
      return {
        id,
        nom: store.nom_societe,
        ville: store.ville || 'Autre',
        pouletCruG: report.pouletCruG,
        viandeCruG: report.viandeCruG,
        tenderCruG: report.tenderCruG,
        lines: report.lines,
        error: '',
      };
    } catch (error) {
      return {
        id,
        nom: store.nom_societe,
        ville: store.ville || 'Autre',
        pouletCruG: 0,
        viandeCruG: 0,
        tenderCruG: 0,
        lines: [],
        error: error.message || 'Lecture impossible.',
      };
    }
  }));

  details.sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
  const sum = (key) => details.reduce((total, store) => total + store[key], 0);

  return {
    source: 'lacaisse',
    month: period.month,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    pouletCruG: sum('pouletCruG'),
    viandeCruG: sum('viandeCruG'),
    tenderCruG: sum('tenderCruG'),
    stores: details,
  };
}

export async function fetchNetwork(month, onlyIds) {
  return fetchPeriod(monthWindow(month), onlyIds);
}

export async function fetchDay(date, onlyIds) {
  return fetchPeriod(spanWindow(date, date), onlyIds);
}
