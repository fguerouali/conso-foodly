import { useEffect, useState } from 'react';
import { api } from './api.js';
import { DAYS, dateOfDay, mondayOf } from './sheet.js';

const DAY_LABEL = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

function formatAmount(value) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0);
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shortName(nom) {
  return String(nom || '').replace(/^Foodly\s+/i, '');
}

export default function Rapprochement() {
  const [mode, setMode] = useState('jour');
  const [month, setMonth] = useState(currentMonth);
  const [date, setDate] = useState(todayIso);
  const [stores, setStores] = useState(null);
  const [imported, setImported] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'jour') return undefined;
    let ignore = false;
    setLoading(true);
    setError('');
    api(`/api/caisse-jour?date=${date}`)
      .then((body) => {
        if (ignore) return;
        setStores(body.stores || []);
        setImported(body.importedDates || []);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [mode, date]);

  function switchMode(next) {
    setMode(next);
    setStores(null);
    setError('');
  }

  async function loadMonth(event) {
    event.preventDefault();
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

  async function importDay(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = await api('/api/caisse-jour', {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      setStores(body.stores || []);
      setImported(body.importedDates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const villes = stores ? [...new Set(stores.map((store) => store.ville))] : [];
  const monday = mondayOf(new Date(`${date}T12:00:00`));
  const needsImport = mode === 'jour';
  const showEnsemble = stores && stores.length > 1 && (!needsImport || stores.some((store) => store.imported));

  return (
    <section className="saisie">
      <h1>Rapprochement</h1>
      <div className="segment protein" role="tablist" aria-label="Période">
        <button type="button" role="tab" aria-selected={mode === 'jour'} onClick={() => switchMode('jour')}>Jour</button>
        <button type="button" role="tab" aria-selected={mode === 'mois'} onClick={() => switchMode('mois')}>Mois</button>
      </div>

      {mode === 'jour' ? (
        <>
          <p className="lede">Importez le cru du jour depuis La Caisse, puis comparez-le à la saisie de chaque enseigne.</p>
          <div className="days" role="tablist" aria-label="Jour de la semaine">
            {DAYS.map((name) => {
              const iso = dateOfDay(monday, name);
              return (
                <button key={name} type="button" role="tab" aria-selected={iso === date} onClick={() => setDate(iso)}>
                  {DAY_LABEL[name]}{imported.includes(iso) ? ' ·' : ''}
                </button>
              );
            })}
          </div>
          <form className="rappro-bar" onSubmit={importDay}>
            <label>Jour
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Import…' : 'Importer la caisse'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="lede">Le mois entier, lu directement dans La Caisse, enseigne par enseigne.</p>
          <form className="rappro-bar" onSubmit={loadMonth}>
            <label>Mois
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
            </label>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Calcul…' : 'BOTONA'}
            </button>
          </form>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {needsImport && stores && stores.every((store) => !store.imported) && !loading && (
        <p className="drop-sub">Ce jour n’est pas encore importé. La saisie est déjà affichée.</p>
      )}
      {showEnsemble && <Ensemble stores={stores} needsImport={needsImport} />}
      {villes.map((ville) => (
        <section key={ville} className="rappro-city">
          {villes.length > 1 && <h2>{ville}</h2>}
          {stores.filter((store) => store.ville === ville).map((store) => (
            <StoreCard key={store.id} store={store} needsImport={needsImport} />
          ))}
        </section>
      ))}
    </section>
  );
}

function Ensemble({ stores, needsImport }) {
  const total = stores.reduce((sum, store) => ({
    days: sum.days + store.days,
    imported: sum.imported || store.imported,
    saisie: { poulet: sum.saisie.poulet + store.saisie.poulet, viande: sum.saisie.viande + store.saisie.viande },
    caisse: {
      pouletKg: sum.caisse.pouletKg + (store.imported || !needsImport ? store.caisse.pouletKg : 0),
      viandeKg: sum.caisse.viandeKg + (store.imported || !needsImport ? store.caisse.viandeKg : 0),
    },
  }), { days: 0, imported: false, saisie: { poulet: 0, viande: 0 }, caisse: { pouletKg: 0, viandeKg: 0 } });
  return (
    <article className="rappro-card is-total">
      <header>
        <h2>Ensemble</h2>
        <p>{stores.length} enseignes · {total.days} jour{total.days > 1 ? 's' : ''} saisi{total.days > 1 ? 's' : ''}</p>
        {needsImport && stores.some((store) => !store.imported) && <p>Le cru n’additionne que les enseignes déjà importées.</p>}
        {!needsImport && stores.some((store) => store.days === 0) && <p>Sans saisie, la consommation compte pour zéro.</p>}
      </header>
      <GapTable store={total} needsImport={needsImport} />
    </article>
  );
}

function StoreCard({ store, needsImport }) {
  const note = needsImport
    ? `${store.imported ? 'Caisse importée' : 'Caisse non importée'} · ${store.days ? 'saisie faite' : 'pas de saisie'}`
    : (store.days ? `${store.days} jour${store.days > 1 ? 's' : ''} saisi${store.days > 1 ? 's' : ''}` : 'Aucune saisie ce mois');
  return (
    <article className="rappro-card">
      <header>
        <h2>{shortName(store.nom)}</h2>
        <p>{note}</p>
      </header>
      {store.error && <p className="error">{store.error}</p>}
      <GapTable store={store} needsImport={needsImport} />
    </article>
  );
}

function GapTable({ store, needsImport }) {
  const rows = [
    ['Viande', store.saisie.viande, store.caisse.viandeKg],
    ['Poulet', store.saisie.poulet, store.caisse.pouletKg],
  ];
  const hasSaisie = store.days > 0;
  const hasCaisse = needsImport ? Boolean(store.imported) : true;
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
          const comparable = hasSaisie && hasCaisse;
          return (
            <tr key={label}>
              <th>{label}</th>
              <td>{hasSaisie ? formatAmount(saisie) : '—'}</td>
              <td>{hasCaisse ? formatAmount(caisse) : '—'}</td>
              <td className={!comparable ? '' : ecart < 0 ? 'is-neg' : ecart > 0 ? 'is-pos' : ''}>
                {comparable ? `${ecart > 0 ? '+' : ''}${formatAmount(ecart)}` : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
