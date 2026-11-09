import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { formatKg } from './format.js';
import {
  DAYS,
  blankWeek,
  computeWeek,
  mondayOf,
  shiftMonday,
} from './sheet.js';

const DAY_LABEL = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

function formatAmount(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value || 0);
}

function monthOfMonday(monday) {
  return monday.slice(0, 7);
}

export default function Saisie({ session }) {
  const [storeId, setStoreId] = useState(session.stores[0]?.id || 0);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [day, setDay] = useState(DAYS[(new Date().getDay() + 6) % 7]);
  const [protein, setProtein] = useState('poulet');
  const [week, setWeek] = useState(blankWeek);
  const [carry, setCarry] = useState({ poulet: null, viande: null });
  const [status, setStatus] = useState('');
  const [screen, setScreen] = useState('saisie');
  const [month, setMonth] = useState(() => monthOfMonday(mondayOf(new Date())));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    const bar = document.querySelector('.topbar');
    if (!bar) return undefined;
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let ignore = false;
    setStatus('');
    api(`/api/saisie?storeId=${storeId}&week=${monday}`)
      .then((body) => {
        if (ignore) return;
        setWeek(body.days ? { ...blankWeek(), ...body.days } : blankWeek());
        setCarry(body.carry || { poulet: null, viande: null });
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => { ignore = true; };
  }, [storeId, monday]);

  const computed = useMemo(() => computeWeek(week, carry), [week, carry]);
  const current = computed[day];

  function setField(group, key, value) {
    const next = value.replace(/[^\d,.-]/g, '');
    setWeek((currentWeek) => ({
      ...currentWeek,
      [day]: {
        ...currentWeek[day],
        [group]: { ...currentWeek[day][group], [key]: next },
      },
    }));
    setStatus('');
  }

  async function save() {
    setStatus('Enregistrement…');
    try {
      await api(`/api/saisie?storeId=${storeId}&week=${monday}`, {
        method: 'PUT',
        body: JSON.stringify({ days: week }),
      });
      setStatus('Enregistré');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function botona() {
    setLoading(true);
    setError('');
    try {
      await save();
      const body = await api('/api/rapprochement', {
        method: 'POST',
        body: JSON.stringify({ storeId, month }),
      });
      setReport(body);
      setScreen('rappro');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const store = session.stores.find((item) => item.id === storeId);
  const conso = protein === 'poulet' ? current.poulet.conso : current.viande.conso;

  if (screen === 'historique') {
    return (
      <Historique
        session={session}
        onBack={() => setScreen('saisie')}
        onOpen={(row) => {
          const date = new Date(`${row.date}T12:00:00`);
          setStoreId(row.storeId);
          setMonday(mondayOf(date));
          setDay(DAYS[(date.getDay() + 6) % 7]);
          setScreen('saisie');
        }}
      />
    );
  }

  if (screen === 'rappro' && report) {
    return (
      <Rapprochement
        report={report}
        month={month}
        onMonth={setMonth}
        onRefresh={botona}
        loading={loading}
        onBack={() => setScreen('saisie')}
      />
    );
  }

  return (
    <section className="saisie">
      <div className="segment protein" role="tablist" aria-label="Vue">
        <button type="button" role="tab" aria-selected={screen === 'saisie'} onClick={() => setScreen('saisie')}>Saisie</button>
        <button type="button" role="tab" aria-selected={false} onClick={() => setScreen('historique')}>Historique</button>
      </div>
      {session.stores.length > 1 && (
        <div className="days" role="tablist" aria-label="Restaurant">
          {session.stores.map((item) => (
            <button key={item.id} type="button" aria-selected={item.id === storeId} onClick={() => setStoreId(item.id)}>
              {item.nom.replace(/^Foodly\s+/i, '')}
            </button>
          ))}
        </div>
      )}
      <div className="week-nav">
        <button type="button" onClick={() => setMonday(shiftMonday(monday, -1))} aria-label="Semaine précédente">‹</button>
        <p>Semaine du {monday.split('-').reverse().join('/')}</p>
        <button type="button" onClick={() => setMonday(shiftMonday(monday, 1))} aria-label="Semaine suivante">›</button>
      </div>
      <div className="saisie-head">
        <div className="days" role="tablist" aria-label="Jour">
          {DAYS.map((name) => (
            <button key={name} type="button" role="tab" aria-selected={day === name} onClick={() => setDay(name)}>
              {DAY_LABEL[name]}
            </button>
          ))}
        </div>
        <div className="segment protein" role="tablist" aria-label="Produit">
          <button type="button" role="tab" aria-selected={protein === 'poulet'} onClick={() => setProtein('poulet')}>Poulet</button>
          <button type="button" role="tab" aria-selected={protein === 'viande'} onClick={() => setProtein('viande')}>Viande</button>
        </div>
      </div>
      <p className="drop-sub">{store?.nom} · les cases calculées se remplissent seules.</p>
      {error && <p className="error">{error}</p>}

      {protein === 'poulet' ? (
        <PouletForm
          values={week[day].poulet}
          result={current.poulet}
          opening={current.poulet.opening}
          onChange={(key, value) => setField('poulet', key, value)}
        />
      ) : (
        <ViandeForm
          values={week[day].viande}
          result={current.viande}
          opening={current.viande.opening}
          onChange={(key, value) => setField('viande', key, value)}
        />
      )}

      <div className="savebar">
        <div>
          <span>Consommation</span>
          <strong>{formatAmount(conso)} kg</strong>
        </div>
        <button type="button" className="btn-ghost" onClick={save}>{status || 'Enregistrer'}</button>
        <label className="month-mini">
          Mois
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={botona} disabled={loading}>
          {loading ? 'Calcul…' : 'BOTONA'}
        </button>
      </div>
    </section>
  );
}

function monthBounds(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

function formatDay(iso) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
}

function Historique({ session, onBack, onOpen }) {
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);
  const [storeId, setStoreId] = useState(session.stores.length > 1 ? '' : String(session.stores[0]?.id || ''));
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const query = new URLSearchParams({ from, to });
    if (storeId) query.set('storeId', storeId);
    api(`/api/historique?${query}`)
      .then((body) => {
        if (!ignore) setRows(body.rows || []);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [from, to, storeId]);

  return (
    <section className="saisie">
      <div className="segment protein" role="tablist" aria-label="Vue">
        <button type="button" role="tab" onClick={onBack}>Saisie</button>
        <button type="button" role="tab" aria-selected="true">Historique</button>
      </div>
      <div className="filters">
        <label>Du
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>Au
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>Restaurant
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            {session.stores.length > 1 && <option value="">Tous</option>}
            {session.stores.map((store) => (
              <option key={store.id} value={store.id}>{store.nom.replace(/^Foodly\s+/i, '')}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="drop-sub">Chargement…</p>}
      {!loading && rows.length === 0 && <p className="drop-sub">Aucune saisie sur cette période.</p>}
      <div className="history-list">
        {rows.map((row) => (
          <button key={`${row.storeId}-${row.date}`} type="button" className="history-row" onClick={() => onOpen(row)}>
            <span>
              <strong>{formatDay(row.date)}</strong>
              <em>{row.nom.replace(/^Foodly\s+/i, '')}</em>
            </span>
            <span>Poulet <b>{row.poulet == null ? '—' : `${formatAmount(row.poulet)} kg`}</b></span>
            <span>Viande <b>{row.viande == null ? '—' : `${formatAmount(row.viande)} kg`}</b></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Rapprochement({ report, month, onMonth, onRefresh, loading, onBack }) {
  const rows = [
    ['Viande', report.saisie.viande, report.caisse.viandeKg],
    ['Poulet', report.saisie.poulet, report.caisse.pouletKg],
  ];
  return (
    <section className="saisie">
      <button type="button" className="btn-ghost" onClick={onBack}>Retour à la saisie</button>
      <h1>Rapprochement</h1>
      <p className="meta">{report.store?.nom} · {report.saisie.days} jour{report.saisie.days > 1 ? 's' : ''} saisi{report.saisie.days > 1 ? 's' : ''}</p>
      <label className="month-field">
        Mois
        <input type="month" value={month} onChange={(event) => onMonth(event.target.value)} />
      </label>
      <button type="button" className="btn-primary" onClick={onRefresh} disabled={loading}>
        {loading ? 'Calcul…' : 'BOTONA'}
      </button>
      {report.store?.error && <p className="error">{report.store.error}</p>}
      <div className="compare">
        {rows.map(([label, saisie, caisse]) => {
          const ecart = (caisse || 0) - (saisie || 0);
          return (
            <article key={label} className="city">
              <h2>{label}</h2>
              <p className="compare-line"><span>Consommation saisie</span><b>{formatAmount(saisie)} kg</b></p>
              <p className="compare-line"><span>Cru caisse</span><b>{formatKg(caisse * 1000)} kg</b></p>
              <p className={`compare-line ecart ${ecart < 0 ? 'is-neg' : ''}`}>
                <span>Écart caisse − saisie</span>
                <b>{ecart > 0 ? '+' : ''}{formatAmount(ecart)} kg</b>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PouletForm({ values, result, opening, onChange }) {
  return (
    <>
      <Card title="Stock initial" note={opening ? 'Première saisie : indiquez le stock de départ.' : 'Repris du stock final de la veille.'}>
        <Field label="Broche" value={opening ? values.initBroche : result.init.broche} readOnly={!opening} onChange={(v) => onChange('initBroche', v)} />
        <Field label="Poulet" value={opening ? values.initPoulet : result.init.poulet} readOnly={!opening} onChange={(v) => onChange('initPoulet', v)} />
        <Field label="Graisse" value={opening ? values.initGraisse : result.init.graisse} readOnly={!opening} onChange={(v) => onChange('initGraisse', v)} />
        <Field label="Chutes" value={opening ? values.initChutes : result.init.chutes} readOnly={!opening} onChange={(v) => onChange('initChutes', v)} />
      </Card>
      <Card title="Reçu">
        <Field label="Poulet" value={values.recuPoulet} onChange={(v) => onChange('recuPoulet', v)} />
        <Field label="Graisse" value={values.recuGraisse} onChange={(v) => onChange('recuGraisse', v)} />
      </Card>
      {[1, 2, 3].map((n) => (
        <Card key={n} title={`Broche ${n}`}>
          <Field label="Poulet" value={values[`b${n}Poulet`]} onChange={(v) => onChange(`b${n}Poulet`, v)} />
          <Field label="Graisse" value={values[`b${n}Graisse`]} onChange={(v) => onChange(`b${n}Graisse`, v)} />
          <Field label="Chutes" value={values[`b${n}Chutes`]} onChange={(v) => onChange(`b${n}Chutes`, v)} />
        </Card>
      ))}
      <Card title="Stock final">
        <Field label="Broche" value={values.finalBroche} onChange={(v) => onChange('finalBroche', v)} />
        <Field label="Poulet" value={result.final.poulet} readOnly />
        <Field label="Graisse" value={result.final.graisse} readOnly />
        <Field label="Chutes" value={result.final.chutes} readOnly />
      </Card>
    </>
  );
}

function ViandeForm({ values, result, opening, onChange }) {
  return (
    <>
      <Card title="Stock initial" note={opening ? 'Première saisie : indiquez le stock de départ.' : 'Repris du stock final de la veille.'}>
        <Field label="Broche" value={opening ? values.initBroche : result.init.broche} readOnly={!opening} onChange={(v) => onChange('initBroche', v)} />
        <Field label="Viande" value={opening ? values.initViande : result.init.viande} readOnly={!opening} onChange={(v) => onChange('initViande', v)} />
        <Field label="V.H" value={opening ? values.initVH : result.init.vh} readOnly={!opening} onChange={(v) => onChange('initVH', v)} />
        <Field label="Chutes" value={opening ? values.initChutes : result.init.chutes} readOnly={!opening} onChange={(v) => onChange('initChutes', v)} />
      </Card>
      <Card title="Reçu">
        <Field label="Viande" value={values.recuViande} onChange={(v) => onChange('recuViande', v)} />
        <Field label="V.H" value={values.recuVH} onChange={(v) => onChange('recuVH', v)} />
      </Card>
      {[1, 2].map((n) => (
        <Card key={n} title={`Broche ${n}`}>
          <Field label="Viande" value={values[`b${n}Viande`]} onChange={(v) => onChange(`b${n}Viande`, v)} />
          <Field label="V.H" value={values[`b${n}VH`]} onChange={(v) => onChange(`b${n}VH`, v)} />
          <Field label="Graisse" value={values[`b${n}Graisse`]} onChange={(v) => onChange(`b${n}Graisse`, v)} />
          <Field label="Chutes" value={values[`b${n}Chutes`]} onChange={(v) => onChange(`b${n}Chutes`, v)} />
          <Field label="Broche" value={n === 1 ? result.broche1 : result.broche2} readOnly />
        </Card>
      ))}
      <Card title="Stock final">
        <Field label="Broche" value={values.finalBroche} onChange={(v) => onChange('finalBroche', v)} />
        <Field label="Viande" value={result.final.viande} readOnly />
        <Field label="V.H" value={result.final.vh} readOnly />
        <Field label="Chutes" value={result.final.chutes} readOnly />
      </Card>
    </>
  );
}

function Card({ title, note, children }) {
  return (
    <section className="entry-card">
      <h2>{title}</h2>
      {note && <p>{note}</p>}
      <div className="entry-grid">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, readOnly }) {
  const shown = readOnly ? formatAmount(value) : (value ?? '');
  const negative = readOnly && Number(value) < 0;
  return (
    <label className={`entry${readOnly ? ' is-calc' : ''}${negative ? ' is-neg' : ''}`}>
      <span>{label}</span>
      {readOnly ? <strong>{shown}</strong> : (
        <input
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={shown}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
