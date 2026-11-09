import { useEffect, useState } from 'react';
import { api } from './api.js';
import { RESTAURANTS } from './sheet.js';

const empty = { nom: '', login: '', password: '', storeIds: [] };

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function reload() {
    setUsers(await api('/api/team'));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, []);

  function toggleStore(id) {
    setForm((current) => ({
      ...current,
      storeIds: current.storeIds.includes(id)
        ? current.storeIds.filter((item) => item !== id)
        : [...current.storeIds, id],
    }));
  }

  async function create(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/team', { method: 'POST', body: JSON.stringify(form) });
      setForm(empty);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(user) {
    await api(`/api/team/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !user.active }),
    });
    await reload();
  }

  const villes = [...new Set(RESTAURANTS.map((store) => store.ville))];

  return (
    <section className="saisie">
      <h1>Équipe</h1>
      <p className="lede">Chaque manager ne voit que les restaurants que vous lui ouvrez.</p>
      {error && <p className="error">{error}</p>}
      <ul className="team">
        {users.map((user) => (
          <li key={user.id}>
            <div>
              <strong>{user.nom}</strong>
              <span>{user.login}</span>
              <span>{user.storeIds.map((id) => RESTAURANTS.find((store) => store.id === id)?.nom).filter(Boolean).join(' · ')}</span>
            </div>
            <button type="button" className="btn-ghost" onClick={() => toggleActive(user)}>
              {user.active ? 'Désactiver' : 'Activer'}
            </button>
          </li>
        ))}
        {users.length === 0 && <li className="muted">Aucun manager pour l’instant.</li>}
      </ul>

      <form className="entry-card" onSubmit={create}>
        <h2>Nouveau manager</h2>
        <label className="month-field">Nom
          <input value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} required />
        </label>
        <label className="month-field">Identifiant
          <input value={form.login} autoComplete="off" onChange={(event) => setForm({ ...form, login: event.target.value })} required />
        </label>
        <label className="month-field">Mot de passe
          <input type="password" value={form.password} autoComplete="new-password" onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </label>
        {villes.map((ville) => (
          <fieldset key={ville} className="checks">
            <legend>{ville}</legend>
            {RESTAURANTS.filter((store) => store.ville === ville).map((store) => (
              <label key={store.id}>
                <input type="checkbox" checked={form.storeIds.includes(store.id)} onChange={() => toggleStore(store.id)} />
                {store.nom}
              </label>
            ))}
          </fieldset>
        ))}
        <button className="btn-primary" type="submit">Créer l’accès</button>
      </form>
    </section>
  );
}
