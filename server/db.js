import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const file = join(process.env.DATA_DIR || join(process.cwd(), 'data'), 'foodly.json');

function secret() {
  return process.env.TOKEN_SECRET || process.env.LACAISSE_PASSWORD || 'foodly-local';
}

async function load() {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return { users: [], weeks: {} };
  }
}

async function save(db) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(db, null, 2));
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

export function checkPassword(password, user) {
  const hash = scryptSync(password, user.salt, 32);
  const expected = Buffer.from(user.hash, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readToken(header) {
  const token = String(header || '').replace(/^Bearer\s+/i, '');
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function listUsers() {
  const db = await load();
  return db.users;
}

export async function createUser({ nom, login, password, storeIds }) {
  const db = await load();
  const key = login.trim().toLowerCase();
  if (db.users.some((user) => user.login === key)) {
    const error = new Error('Cet identifiant existe déjà.');
    error.status = 409;
    throw error;
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: randomBytes(8).toString('hex'),
    nom: nom.trim(),
    login: key,
    salt,
    hash,
    storeIds: storeIds.map(Number),
    active: true,
  };
  db.users.push(user);
  await save(db);
  return user;
}

export async function updateUser(id, patch) {
  const db = await load();
  const user = db.users.find((item) => item.id === id);
  if (!user) {
    const error = new Error('Manager introuvable.');
    error.status = 404;
    throw error;
  }
  if (patch.nom != null) user.nom = String(patch.nom).trim();
  if (patch.storeIds) user.storeIds = patch.storeIds.map(Number);
  if (patch.active != null) user.active = Boolean(patch.active);
  if (patch.password) {
    const next = hashPassword(patch.password);
    user.salt = next.salt;
    user.hash = next.hash;
  }
  await save(db);
  return user;
}

export async function deleteUser(id) {
  const db = await load();
  db.users = db.users.filter((user) => user.id !== id);
  await save(db);
}

export async function findUser(login) {
  const db = await load();
  return db.users.find((user) => user.login === String(login || '').trim().toLowerCase()) || null;
}

export async function readWeek(storeId, week) {
  const db = await load();
  return db.weeks[`${storeId}|${week}`] || null;
}

export async function writeWeek(storeId, week, days) {
  const db = await load();
  db.weeks[`${storeId}|${week}`] = days;
  await save(db);
}

export async function allWeeks() {
  const db = await load();
  return db.weeks;
}

export async function weeksForStore(storeId) {
  const db = await load();
  const prefix = `${storeId}|`;
  const out = {};
  for (const [key, value] of Object.entries(db.weeks)) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  }
  return out;
}
