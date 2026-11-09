import { fetchNetwork } from './lacaisse.js';
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
  weeksForStore,
  writeWeek,
} from './db.js';
import {
  DAYS,
  RESTAURANTS,
  blankPoulet,
  blankViande,
  carryBefore,
  historyRows,
  monthConso,
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

    if (req.method === 'POST' && pathname === '/api/rapprochement') {
      const session = requireUser(req);
      const body = await readJson(req);
      const storeId = Number(body.storeId);
      const month = String(body.month || '');
      if (!canStore(session, storeId) || !/^\d{4}-\d{2}$/.test(month)) {
        throw fail('Mois ou restaurant invalide.', 400);
      }
      let network = { stores: [] };
      try {
        network = await fetchNetwork(month, [storeId]);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      const known = RESTAURANTS.find((item) => item.id === storeId);
      const store = network.stores.find((item) => item.id === storeId) || (known && {
        id: known.id,
        nom: known.nom,
        ville: known.ville,
        error: 'Ce restaurant n’est pas encore relié à La Caisse.',
      });
      const saisie = monthConso(await weeksForStore(storeId), month);
      sendJson(res, 200, {
        month,
        store: store ? { id: store.id, nom: store.nom, ville: store.ville, error: store.error } : null,
        saisie,
        caisse: {
          pouletKg: (store?.pouletCruG || 0) / 1000,
          viandeKg: (store?.viandeCruG || 0) / 1000,
        },
      });
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
