import { useState } from 'react';
import { api } from './api.js';

function formatAmount(value) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0);
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shortName(nom) {
  return String(nom || '').replace(/^Foodly\s+/i, '');
}

export default function Rapprochement() {
  const [month, setMonth] = useState(currentMonth);
  const [stores, setStores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = await api('/api/rapprochement', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      setStores(body.stores || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const villes = stores ? [...new Set(stores.map((store) => store.ville))] : [];

  return (
    <section className="saisie">
      <h1>Rapprochement</h1>
      <p className="lede">La consommation saisie, le cru de la caisse, enseigne par enseigne.</p>
      <form className="rappro-bar" onSubmit={load}>
        <label>Mois
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
        </label>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Calcul…' : 'BOTONA'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {stores && stores.length > 1 && <Ensemble stores={stores} />}
      {villes.map((ville) => (
        <section key={ville} className="rappro-city">
          {villes.length > 1 && <h2>{ville}</h2>}
          {stores.filter((store) => store.ville === ville).map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </section>
      ))}
      {stores && stores.length === 0 && <p className="drop-sub">Aucun restaurant pour ce compte.</p>}
    </section>
  );
}

function Ensemble({ stores }) {
  const total = stores.reduce((sum, store) => ({
    days: sum.days + store.days,
    saisie: { poulet: sum.saisie.poulet + store.saisie.poulet, viande: sum.saisie.viande + store.saisie.viande },
    caisse: { pouletKg: sum.caisse.pouletKg + store.caisse.pouletKg, viandeKg: sum.caisse.viandeKg + store.caisse.viandeKg },
  }), { days: 0, saisie: { poulet: 0, viande: 0 }, caisse: { pouletKg: 0, viandeKg: 0 } });
  return (
    <article className="rappro-card is-total">
      <header>
        <h2>Ensemble</h2>
        <p>{stores.length} enseignes · {total.days} jour{total.days > 1 ? 's' : ''} saisi{total.days > 1 ? 's' : ''}</p>
        {stores.some((store) => store.days === 0) && <p>Sans saisie, la consommation compte pour zéro.</p>}
      </header>
      <GapTable store={total} />
    </article>
  );
}

function StoreCard({ store }) {
  return (
    <article className="rappro-card">
      <header>
        <h2>{shortName(store.nom)}</h2>
        <p>{store.days ? `${store.days} jour${store.days > 1 ? 's' : ''} saisi${store.days > 1 ? 's' : ''}` : 'Aucune saisie ce mois'}</p>
      </header>
      {store.error && <p className="error">{store.error}</p>}
      <GapTable store={store} />
    </article>
  );
}

function GapTable({ store }) {
  const rows = [
    ['Viande', store.saisie.viande, store.caisse.viandeKg],
    ['Poulet', store.saisie.poulet, store.caisse.pouletKg],
  ];
  const filled = store.days > 0;
  return (
    <table className="gap-table">
      <thead>
        <tr>
          <th />
          <th>Saisie</th>
          <th>Caisse</th>
          <th>Écart</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, saisie, caisse]) => {
          const ecart = (caisse || 0) - (saisie || 0);
          return (
            <tr key={label}>
              <th>{label}</th>
              <td>{filled ? formatAmount(saisie) : '—'}</td>
              <td>{formatAmount(caisse)}</td>
              <td className={!filled ? '' : ecart < 0 ? 'is-neg' : ecart > 0 ? 'is-pos' : ''}>
                {filled ? `${ecart > 0 ? '+' : ''}${formatAmount(ecart)}` : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
