import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import Admin from './Admin.jsx';
import { normalizeKey, parseWorkbook } from './compute.js';
import Rapprochement from './Rapprochement.jsx';
import Saisie from './Saisie.jsx';
import {
  formatKg,
  formatQty,
  formatShare,
  labelFromMonthInput,
  monthInputFromDate,
  portionLabel,
} from './format.js';

function Desk({ session, onLogout }) {
  const [view, setView] = useState('caisse');
  const fileRef = useRef(null);
  const [report, setReport] = useState(null);
  const [network, setNetwork] = useState(null);
  const [scope, setScope] = useState('all');
  const [month, setMonth] = useState(() => monthInputFromDate(new Date().toISOString()));
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsingError, setParsingError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' });

  async function handleFile(file) {
    if (!file) return;
    if (!/\.xls[xm]?$/i.test(file.name)) {
      setParsingError('Choisissez un fichier Excel (.xlsx).');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const next = parseWorkbook(buffer, file.name);
      setNetwork(null);
      setReport(next);
      setParsingError('');
      setFilter('all');
      setQuery('');
      setSort({ key: 'total', dir: 'desc' });
    } catch (error) {
      setParsingError(error.message || 'Lecture du fichier impossible.');
    }
  }

  function onInput(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    handleFile(file);
  }

  async function loadCaisse(event) {
    event.preventDefault();
    setLoading(true);
    setParsingError('');
    try {
      const body = await api('/api/conso', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      setReport(null);
      setNetwork(body);
      setScope('all');
      setFilter('all');
      setQuery('');
      setSort({ key: 'total', dir: 'desc' });
    } catch (error) {
      setParsingError(error.message || 'Lecture La Caisse impossible.');
    } finally {
      setLoading(false);
    }
  }

  const scopedStores = useMemo(() => {
    if (!network) return null;
    if (scope === 'all') return network.stores;
    if (String(scope).startsWith('ville:')) {
      const ville = String(scope).slice(6);
      return network.stores.filter((store) => store.ville === ville);
    }
    return network.stores.filter((store) => store.id === scope);
  }, [network, scope]);

  const shown = useMemo(() => {
    if (report) return report;
    if (!network || !scopedStores) return null;
    const totals = sumStores(scopedStores);
    const label = scope === 'all'
      ? 'Réseau Foodly'
      : String(scope).startsWith('ville:')
        ? String(scope).slice(6)
        : (scopedStores[0]?.nom || '');
    return {
      ...totals,
      fileName: '',
      headerLine: `La Caisse · ${label}`,
      periodStart: network.periodStart,
    };
  }, [report, network, scopedStores, scope]);

  const title = labelFromMonthInput(monthInputFromDate(shown?.periodStart)) || 'Consommation du mois';

  function reset() {
    setReport(null);
    setNetwork(null);
    setScope('all');
    setParsingError('');
  }

  return (
    <div className="page">
      <div className="wrap">
        <header className="topbar">
          <div className="topbar-row">
            <img className="logo" src="/logo.png" alt="Foodly Shawarma" />
            <div className="brand">
              <p className="brand-kicker">Foodly Shawarma</p>
              <p className="brand-title">Consommation crue</p>
            </div>
            <button type="button" className="btn-ghost logout" onClick={onLogout}>Sortir</button>
            {shown && view === 'caisse' && (
              <div className="mini" aria-hidden="true">
                <span><b>{formatKg(shown.viandeCruG)}</b> kg viande</span>
                <span><b>{formatKg(shown.pouletCruG)}</b> kg poulet</span>
                <span><b>{formatKg(shown.tenderCruG)}</b> kg tender</span>
              </div>
            )}
          </div>
          <nav className="app-nav" aria-label="Sections">
            <button type="button" aria-selected={view === 'caisse'} onClick={() => setView('caisse')}>Caisse</button>
            <button type="button" aria-selected={view === 'saisie'} onClick={() => setView('saisie')}>Saisie</button>
            <button type="button" aria-selected={view === 'rappro'} onClick={() => setView('rappro')}>Rapprochement</button>
            <button type="button" aria-selected={view === 'equipe'} onClick={() => setView('equipe')}>Équipe</button>
          </nav>
        </header>

        {view === 'saisie' && <Saisie session={session} />}
        {view === 'rappro' && <Rapprochement />}
        {view === 'equipe' && <Admin />}
        {view === 'caisse' && <>
        <main>
          {!shown && (
            <section className="hero">
              <h1>Consommation du mois</h1>
              <p className="lede">
                Chargez les ventes La Caisse, ventilées par ville et par point de vente,
                ou déposez un export Excel.
              </p>
            </section>
          )}

          {!shown && (
            <form className="caisse-card" onSubmit={loadCaisse}>
              <p className="drop-title">Depuis La Caisse</p>
              <p className="drop-sub">Points de vente Foodly, par ville.</p>
              <label className="month-field">
                Mois
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  required
                />
              </label>
              <button className="btn-primary" type="submit" disabled={loading || !month}>
                {loading ? 'Chargement…' : 'BOTONA'}
              </button>
            </form>
          )}

          {!shown && (
            <DropZone
              dragOver={dragOver}
              onBrowse={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
            />
          )}

          {parsingError && <p className="error" role="alert">{parsingError}</p>}

          {shown && (
            <Results
              data={shown}
              title={title}
              stores={network?.stores}
              scope={scope}
              onScope={setScope}
              replaceLabel={network ? 'Autre source' : 'Autre fichier'}
              onReplace={network ? reset : () => fileRef.current?.click()}
              filter={filter}
              onFilter={setFilter}
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={(key) => {
                setSort((current) => (
                  current.key === key
                    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                    : { key, dir: key === 'nom' ? 'asc' : 'desc' }
                ));
              }}
            />
          )}
        </main>
        <footer className="footer">
          <p>Poulet cuit × 1,3 · Viande cuite × 1,4 · Tender au grammage du barème.</p>
        </footer>
        </>}
      </div>

      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        aria-label="Fichier Excel du mois"
        accept=".xlsx,.xls,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onInput}
      />
    </div>
  );
}

function logoutSession(setSession) {
  sessionStorage.removeItem('foodly-token');
  setSession(null);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('foodly-token');
    if (!token) {
      setReady(true);
      return;
    }
    api('/api/me')
      .then((body) => setSession(body))
      .catch(() => sessionStorage.removeItem('foodly-token'))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (!session) return <Login onLogin={setSession} />;
  const leave = () => logoutSession(setSession);
  if (session.role === 'manager') {
    return <Manager session={session} onLogout={leave} />;
  }
  return <Desk session={session} onLogout={leave} />;
}

function Manager({ session, onLogout }) {
  const [view, setView] = useState('saisie');
  return (
    <div className="page">
      <div className="wrap">
        <header className="topbar">
          <div className="topbar-row">
            <img className="logo" src="/logo.png" alt="Foodly Shawarma" />
            <div className="brand">
              <p className="brand-kicker">Foodly Shawarma</p>
              <p className="brand-title">{session.nom}</p>
            </div>
            <button type="button" className="btn-ghost logout" onClick={onLogout}>Sortir</button>
          </div>
          <nav className="app-nav" aria-label="Sections">
            <button type="button" aria-selected={view === 'saisie'} onClick={() => setView('saisie')}>Saisie</button>
            <button type="button" aria-selected={view === 'rappro'} onClick={() => setView('rappro')}>Rapprochement</button>
          </nav>
        </header>
        {view === 'saisie' ? <Saisie session={session} /> : <Rapprochement />}
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      sessionStorage.setItem('foodly-token', body.token);
      onLogin(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <form className="login" onSubmit={submit}>
        <img className="logo" src="/logo.png" alt="Foodly Shawarma" />
        <h1>Consommation</h1>
        <p>Saisie du jour ou lecture des ventes.</p>
        <label>Identifiant
          <input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} required />
        </label>
        <label>Mot de passe
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Entrer'}</button>
      </form>
    </div>
  );
}

function DropZone({ dragOver, onBrowse, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      className={dragOver ? 'drop is-over' : 'drop'}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowse}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onBrowse();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <TrayIcon />
      <p className="drop-title">Déposez le fichier Excel du mois</p>
      <p className="drop-sub">Feuille VENTES_PAR_PRODUIT · quantités vendues</p>
      <span className="btn-primary">Choisir un fichier</span>
    </div>
  );
}

function Results({
  data, title, onReplace, replaceLabel, stores, scope, onScope, filter, onFilter, query, onQuery, sort, onSort,
}) {
  const total = data.viandeCruG + data.pouletCruG + data.tenderCruG;
  const visible = useMemo(() => {
    const needle = normalizeKey(query);
    const filtered = data.lines.filter((line) => {
      if (filter === 'poulet' && !line.pouletCruG) return false;
      if (filter === 'viande' && !line.viandeCruG) return false;
      if (filter === 'tender' && !line.tenderCruG) return false;
      if (needle && !normalizeKey(line.nom).includes(needle)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === 'string') return av.localeCompare(bv, 'fr', { sensitivity: 'base' }) * dir;
      return (av - bv) * dir;
    });
    return filtered;
  }, [data.lines, filter, query, sort]);

  const shown = visible.reduce(
    (acc, line) => ({
      qty: acc.qty + line.qty,
      viande: acc.viande + line.viandeCruG,
      poulet: acc.poulet + line.pouletCruG,
      tender: acc.tender + line.tenderCruG,
    }),
    { qty: 0, viande: 0, poulet: 0, tender: 0 },
  );
  const filteredView = visible.length !== data.lines.length;

  return (
    <section className="results">
      <div className="result-head">
        <div>
          <h1>{title}</h1>
          <p className="meta">
            {[data.headerLine, data.fileName].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onReplace}>{replaceLabel}</button>
      </div>

      {stores && <StoreBoard stores={stores} scope={scope} onScope={onScope} />}

      <section className="kpis" aria-label="Indicateurs du mois">
        <Kpi name="viande" label="Viande crue" grams={data.viandeCruG} hint="Viande cuite × 1,4" />
        <Kpi name="poulet" label="Poulet cru" grams={data.pouletCruG} hint="Poulet cuit × 1,3" />
        <Kpi name="tender" label="Tender cru" grams={data.tenderCruG} hint="Grammage recette, sans perte" />
      </section>

      {total > 0 && (
        <div className="mix">
          <div className="bar" aria-hidden="true">
            <span className="seg-viande" style={{ width: `${(data.viandeCruG / total) * 100}%` }} />
            <span className="seg-poulet" style={{ width: `${(data.pouletCruG / total) * 100}%` }} />
            <span className="seg-tender" style={{ width: `${(data.tenderCruG / total) * 100}%` }} />
          </div>
          <ul className="legend">
            <li><i className="dot-viande" /> Viande {formatShare(data.viandeCruG, total)}</li>
            <li><i className="dot-poulet" /> Poulet {formatShare(data.pouletCruG, total)}</li>
            <li><i className="dot-tender" /> Tender {formatShare(data.tenderCruG, total)}</li>
          </ul>
        </div>
      )}

      <section className="table-card">
        <div className="table-tools">
          <div className="segment" role="tablist" aria-label="Filtrer les produits">
            {[
              ['all', 'Tous'],
              ['viande', 'Viande'],
              ['poulet', 'Poulet'],
              ['tender', 'Tender'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => onFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="search"
            type="search"
            placeholder="Rechercher un produit"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><SortButton label="Produit" active={sort.key === 'nom'} dir={sort.dir} onClick={() => onSort('nom')} /></th>
                <th className="num"><SortButton label="Quantité" active={sort.key === 'qty'} dir={sort.dir} onClick={() => onSort('qty')} /></th>
                <th className="num"><SortButton label="Viande crue" active={sort.key === 'viande'} dir={sort.dir} onClick={() => onSort('viande')} /></th>
                <th className="num"><SortButton label="Poulet cru" active={sort.key === 'poulet'} dir={sort.dir} onClick={() => onSort('poulet')} /></th>
                <th className="num"><SortButton label="Tender cru" active={sort.key === 'tender'} dir={sort.dir} onClick={() => onSort('tender')} /></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={5}>Aucun produit ne correspond.</td>
                </tr>
              )}
              {visible.map((line) => (
                <tr key={line.nom}>
                  <td>
                    <span className="product">{line.nom}</span>
                    <span className="portion">{portionLabel(line)}</span>
                  </td>
                  <td className="num">{formatQty(line.qty)}</td>
                  <KgCell grams={line.viandeCruG} />
                  <KgCell grams={line.pouletCruG} />
                  <KgCell grams={line.tenderCruG} />
                </tr>
              ))}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr>
                  <th>{filteredView ? 'Sous-total affiché' : 'Total'}</th>
                  <th className="num">{formatQty(shown.qty)}</th>
                  <th className="num">{formatKg(shown.viande)} kg</th>
                  <th className="num">{formatKg(shown.poulet)} kg</th>
                  <th className="num">{formatKg(shown.tender)} kg</th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </section>
  );
}

function sumStores(stores) {
  const map = new Map();
  for (const store of stores) {
    for (const line of store.lines) {
      const current = map.get(line.nom);
      if (!current) {
        map.set(line.nom, { ...line });
      } else {
        current.qty += line.qty;
        current.pouletCruG += line.pouletCruG;
        current.viandeCruG += line.viandeCruG;
        current.tenderCruG += line.tenderCruG;
      }
    }
  }
  const lines = [...map.values()].sort(
    (a, b) => (b.pouletCruG + b.viandeCruG + b.tenderCruG) - (a.pouletCruG + a.viandeCruG + a.tenderCruG),
  );
  const sum = (key) => lines.reduce((total, line) => total + line[key], 0);
  return {
    lines,
    pouletCruG: sum('pouletCruG'),
    viandeCruG: sum('viandeCruG'),
    tenderCruG: sum('tenderCruG'),
  };
}

function StoreBoard({ stores, scope, onScope }) {
  const villes = [...new Set(stores.map((store) => store.ville))];
  const activeVille = String(scope).startsWith('ville:')
    ? String(scope).slice(6)
    : (stores.find((store) => store.id === scope)?.ville || '');
  const visibleVilles = activeVille ? villes.filter((ville) => ville === activeVille) : villes;
  return (
    <section className="stores" aria-label="Villes et points de vente">
      <div className="segment" role="tablist" aria-label="Filtrer par ville">
        <button type="button" role="tab" aria-selected={scope === 'all'} onClick={() => onScope('all')}>
          Réseau
        </button>
        {villes.map((ville) => (
          <button
            key={ville}
            type="button"
            role="tab"
            aria-selected={activeVille === ville}
            onClick={() => onScope(`ville:${ville}`)}
          >
            {ville}
          </button>
        ))}
      </div>
      <div className="city-grid">
        {visibleVilles.map((ville) => (
          <section key={ville} className="city">
            <h2>{ville}</h2>
            <ul>
              {stores.filter((store) => store.ville === ville).map((store) => (
                <li key={store.id}>
                  <button
                    type="button"
                    className={scope === store.id ? 'is-on' : ''}
                    onClick={() => onScope(store.id)}
                  >
                    <span className="store-name">{store.nom}</span>
                    {store.error ? (
                      <span className="store-error">{store.error}</span>
                    ) : (
                      <span className="store-figs">
                        <span>Viande {formatKg(store.viandeCruG)}</span>
                        <span>Poulet {formatKg(store.pouletCruG)}</span>
                        <span>Tender {formatKg(store.tenderCruG)}</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function sortValue(line, key) {
  if (key === 'nom') return line.nom;
  if (key === 'qty') return line.qty;
  if (key === 'viande') return line.viandeCruG;
  if (key === 'poulet') return line.pouletCruG;
  if (key === 'tender') return line.tenderCruG;
  return line.viandeCruG + line.pouletCruG + line.tenderCruG;
}

function Kpi({ name, label, grams, hint }) {
  return (
    <article className={`kpi kpi-${name}`}>
      <h2>{label}</h2>
      <p className="figure">
        <span className="value" title={`${formatQty(grams)} g`}>{formatKg(grams)}</span>
        <span className="unit">kg</span>
      </p>
      <p className="hint">{hint}</p>
    </article>
  );
}

function KgCell({ grams }) {
  if (!grams) return <td className="num muted">—</td>;
  return <td className="num">{formatKg(grams)}</td>;
}

function SortButton({ label, active, dir, onClick }) {
  return (
    <button
      type="button"
      className="sort"
      onClick={onClick}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span aria-hidden="true">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
    </button>
  );
}

function TrayIcon() {
  return (
    <svg className="tray" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M18 6v14M12.5 14.5 18 20l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 22.5h22V27a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-4.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
