import { fetchDay, fetchNetwork } from './lacaisse.js';
import {
  checkPassword,
  createUser,
  deleteUser,
  findUser,
  listUsers,
  readToken,
  readWeek,
  signToken,
  updateUser,
  allWeeks,
  caisseDaysOn,
  importedDates,
  weeksForStore,
  writeCaisseDays,
  writeWeek,
} from './db.js';
import {
  DAYS,
  RESTAURANTS,
  blankPoulet,
  blankViande,
  carryBefore,
  dayConso,
  historyRows,
  monthConso,
  mondayOf,
  dateOfDay,
} from '../src/sheet.js';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function publicUser(user) {
  return {
    id: user.id,
    nom: user.nom,
    login: user.login,
    storeIds: user.storeIds,
    active: user.active,
  };
}

function storesFor(ids) {
  const wanted = new Set((ids || []).map(Number));
  return RESTAURANTS.filter((store) => wanted.has(store.id));
}

function sessionFrom(req) {
  return readToken(req.headers.authorization || req.headers.Authorization || '');
}

function requireUser(req) {
  const session = sessionFrom(req);
  if (!session) throw fail('Connectez-vous.', 401);
  return session;
}

function requireAdmin(req) {
  const session = requireUser(req);
  if (session.role !== 'admin') throw fail('Réservé à l’administrateur.', 403);
  return session;
}

function canStore(session, storeId) {
  if (session.role === 'admin') return true;
  return (session.storeIds || []).map(Number).includes(Number(storeId));
}

function cleanRecord(source, blank) {
  const out = {};
  for (const key of Object.keys(blank())) {
    const value = source?.[key];
    out[key] = value == null ? '' : String(value).trim().slice(0, 16);
  }
  return out;
}

function cleanWeek(days) {
  const out = {};
  for (const day of DAYS) {
    out[day] = {
      poulet: cleanRecord(days?.[day]?.poulet, blankPoulet),
      viande: cleanRecord(days?.[day]?.viande, blankViande),
    };
  }
  return out;
}

function issue(role, extra) {
  return signToken({
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    ...extra,
  });
}

function weeksOf(saved, storeId) {
  const prefix = `${storeId}|`;
  const weeks = {};
  for (const [key, value] of Object.entries(saved || {})) {
    if (key.startsWith(prefix)) weeks[key.slice(prefix.length)] = value;
  }
  return weeks;
}

function dailyRows(allowed, date, snaps, saved) {
  return allowed.map((store) => {
    const snap = snaps[store.id];
    const saisie = dayConso(weeksOf(saved, store.id), date);
    const imported = Boolean(snap) && !snap.error;
    return {
      id: store.id,
      nom: store.nom,
      ville: store.ville,
      error: snap?.error || '',
      imported,
      days: saisie.entered ? 1 : 0,
      saisie: { poulet: saisie.poulet || 0, viande: saisie.viande || 0 },
      caisse: {
        pouletKg: imported ? (snap.pouletG || 0) / 1000 : 0,
        viandeKg: imported ? (snap.viandeG || 0) / 1000 : 0,
      },
    };
  }).sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  if (!pathname.startsWith('/api/')) return false;

  try {
    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await readJson(req);
      const login = String(body.login || '').trim();
      const password = String(body.password || '');
      const adminLogin = process.env.LACAISSE_LOGIN || '';
      if (adminLogin && login.toLowerCase() === adminLogin.toLowerCase() && password === process.env.LACAISSE_PASSWORD) {
        const token = issue('admin', { nom: 'Administration', storeIds: RESTAURANTS.map((store) => store.id) });
        sendJson(res, 200, {
          token,
          role: 'admin',
          nom: 'Administration',
          stores: RESTAURANTS,
        });
        return true;
      }
      const user = await findUser(login);
      if (!user || !user.active || !checkPassword(password, user)) {
        throw fail('Identifiant ou mot de passe incorrect.', 401);
      }
      const stores = storesFor(user.storeIds);
      const token = issue('manager', { sub: user.id, nom: user.nom, storeIds: stores.map((store) => store.id) });
      sendJson(res, 200, { token, role: 'manager', nom: user.nom, stores });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const session = requireUser(req);
      sendJson(res, 200, {
        role: session.role,
        nom: session.nom,
        stores: storesFor(session.storeIds),
      });
      return true;
    }

    if (pathname === '/api/team') {
      requireAdmin(req);
      if (req.method === 'GET') {
        const users = await listUsers();
        sendJson(res, 200, users.map(publicUser));
        return true;
      }
      if (req.method === 'POST') {
        const body = await readJson(req);
        const nom = String(body.nom || '').trim();
        const login = String(body.login || '').trim();
        const password = String(body.password || '');
        const storeIds = storesFor(body.storeIds).map((store) => store.id);
        if (!nom || !login || password.length < 4 || storeIds.length === 0) {
          throw fail('Nom, identifiant, mot de passe et au moins un restaurant.', 400);
        }
        const user = await createUser({ nom, login, password, storeIds });
        sendJson(res, 201, publicUser(user));
        return true;
      }
    }

    const teamMatch = pathname.match(/^\/api\/team\/([a-f0-9]+)$/);
    if (teamMatch) {
      requireAdmin(req);
      const id = teamMatch[1];
      if (req.method === 'PATCH') {
        const body = await readJson(req);
        const patch = {};
        if (body.nom != null) patch.nom = body.nom;
        if (body.active != null) patch.active = body.active;
        if (body.password) patch.password = String(body.password);
        if (body.storeIds) patch.storeIds = storesFor(body.storeIds).map((store) => store.id);
        const user = await updateUser(id, patch);
        sendJson(res, 200, publicUser(user));
        return true;
      }
      if (req.method === 'DELETE') {
        await deleteUser(id);
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    if (pathname === '/api/saisie') {
      const session = requireUser(req);
      const storeId = Number(url.searchParams.get('storeId') || 0);
      const week = url.searchParams.get('week') || '';
      if (!canStore(session, storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
        throw fail('Semaine ou restaurant invalide.', 400);
      }
      if (req.method === 'GET') {
        const history = await weeksForStore(storeId);
        sendJson(res, 200, {
          week,
          days: history[week] || null,
          carry: carryBefore(history, week),
        });
        return true;
      }
      if (req.method === 'PUT') {
        const body = await readJson(req);
        const days = cleanWeek(body.days);
        await writeWeek(storeId, week, days);
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    if (req.method === 'GET' && pathname === '/api/historique') {
      const session = requireUser(req);
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const storeId = Number(url.searchParams.get('storeId') || 0);
      if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
        throw fail('Dates invalides.', 400);
      }
      let stores = storesFor(session.storeIds);
      if (storeId) {
        if (!canStore(session, storeId)) throw fail('Restaurant invalide.', 400);
        stores = stores.filter((store) => store.id === storeId);
      }
      const rows = [];
      for (const store of stores) {
        const found = historyRows(await weeksForStore(store.id));
        for (const row of found) {
          if (from && row.date < from) continue;
          if (to && row.date > to) continue;
          rows.push({ ...row, storeId: store.id, nom: store.nom });
        }
      }
      rows.sort((a, b) => b.date.localeCompare(a.date) || a.nom.localeCompare(b.nom, 'fr'));
      sendJson(res, 200, { rows });
      return true;
    }

    if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/caisse-jour') {
      const session = requireUser(req);
      const body = req.method === 'POST' ? await readJson(req) : {};
      const date = String((req.method === 'GET' ? url.searchParams.get('date') : body.date) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('Choisissez un jour.', 400);
      const allowed = storesFor(session.storeIds);
      if (req.method === 'POST') {
        let network = { stores: [] };
        try {
          network = await fetchDay(date, allowed.map((store) => store.id));
        } catch (error) {
          if (error.status !== 404) throw error;
        }
        const found = new Map((network.stores || []).map((store) => [store.id, store]));
        await writeCaisseDays(allowed.map((store) => {
          const remote = found.get(store.id);
          return {
            storeId: store.id,
            date,
            pouletG: remote && !remote.error ? remote.pouletCruG : null,
            viandeG: remote && !remote.error ? remote.viandeCruG : null,
            error: remote ? remote.error : 'Ce restaurant n’est pas encore relié à La Caisse.',
          };
        }));
      }
      const saved = await allWeeks();
      const snaps = await caisseDaysOn(allowed.map((store) => store.id), date);
      const monday = mondayOf(new Date(`${date}T12:00:00`));
      sendJson(res, 200, {
        date,
        stores: dailyRows(allowed, date, snaps, saved),
        importedDates: await importedDates(allowed.map((store) => store.id), monday, dateOfDay(monday, 'dimanche')),
      });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/rapprochement') {
      const session = requireUser(req);
      const body = await readJson(req);
      const month = String(body.month || '');
      if (!/^\d{4}-\d{2}$/.test(month)) throw fail('Mois invalide.', 400);
      const allowed = storesFor(session.storeIds);
      let network = { stores: [] };
      try {
        network = await fetchNetwork(month, allowed.map((store) => store.id));
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      const remote = new Map((network.stores || []).map((store) => [store.id, store]));
      const saved = await allWeeks();
      const stores = allowed.map((store) => {
        const caisse = remote.get(store.id);
        const weeks = {};
        const prefix = `${store.id}|`;
        for (const [key, value] of Object.entries(saved)) {
          if (key.startsWith(prefix)) weeks[key.slice(prefix.length)] = value;
        }
        const saisie = monthConso(weeks, month);
        return {
          id: store.id,
          nom: caisse?.nom || store.nom,
          ville: caisse?.ville || store.ville,
          error: caisse ? caisse.error : 'Ce restaurant n’est pas encore relié à La Caisse.',
          days: saisie.days,
          saisie: { poulet: saisie.poulet, viande: saisie.viande },
          caisse: {
            pouletKg: (caisse?.pouletCruG || 0) / 1000,
            viandeKg: (caisse?.viandeCruG || 0) / 1000,
          },
        };
      });
      stores.sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
      sendJson(res, 200, { month, stores });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/conso') {
      requireAdmin(req);
      const body = await readJson(req);
      sendJson(res, 200, await fetchNetwork(body.month));
      return true;
    }

    sendJson(res, 404, { error: 'Introuvable.' });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || 'Lecture impossible.' });
  }
  return true;
}
