import { useMemo, useRef, useState } from 'react';
import { normalizeKey, parseWorkbook } from './compute.js';
import {
  formatKg,
  formatQty,
  formatShare,
  labelFromMonthInput,
  monthInputFromDate,
  portionLabel,
} from './format.js';

export default function App() {
  const fileRef = useRef(null);
  const [report, setReport] = useState(null);
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

  const title = labelFromMonthInput(monthInputFromDate(report?.periodStart)) || 'Consommation du mois';

  return (
    <div className="page">
      <div className="wrap">
        <header className="topbar">
          <img className="logo" src="/logo.png" alt="Foodly Shawarma" />
          <div className="brand">
            <p className="brand-kicker">Foodly Shawarma</p>
            <p className="brand-title">Consommation crue</p>
          </div>
          {report && (
            <div className="mini" aria-hidden="true">
              <span><b>{formatKg(report.viandeCruG)}</b> kg viande</span>
              <span><b>{formatKg(report.pouletCruG)}</b> kg poulet</span>
              <span><b>{formatKg(report.tenderCruG)}</b> kg tender</span>
            </div>
          )}
        </header>

        <main>
          {!report && (
            <section className="hero">
              <h1>Consommation du mois</h1>
              <p className="lede">
                Déposez l’export caisse. Les quantités vendues deviennent le poids cru
                de viande, de poulet et de tender.
              </p>
            </section>
          )}

          {!report && (
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

          {report && (
            <Results
              data={report}
              title={title}
              onReplace={() => fileRef.current?.click()}
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

function Results({ data, title, onReplace, filter, onFilter, query, onQuery, sort, onSort }) {
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
        <button type="button" className="btn-ghost" onClick={onReplace}>Autre fichier</button>
      </div>

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
