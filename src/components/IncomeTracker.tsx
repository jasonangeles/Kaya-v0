import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Icons } from './icons';
import { IncomeRecord } from '../types';
import { symbolFor } from '../data/currencies';
import { CurrencyPicker } from './CurrencyPicker';
import { Sym } from './DirhamSign';

const CATEGORY_OPTIONS = ['Dividend', 'Interest', 'Rental income', 'Royalties', 'Other'];

const symbolOf = (c: string) => symbolFor(c);

// Convert (amount, currency) into the display currency using the live rate map.
// `lockedUsd` (the rate captured when the record was logged) keeps past income
// stable rather than drifting with today's rates.
const toDisplay = (amount: number, from: string, display: string, rates: Record<string, number>, lockedUsd?: number): number => {
  const usd = amount / (lockedUsd || rates[from] || 1);
  return usd * (rates[display] || 1);
};

const fmt = (val: number, display: string) => {
  if (display === 'BTC') return `₿${val.toFixed(6)}`;
  return `${symbolOf(display)}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

// ISO timestamp from a YYYY-MM-DD date + a time-of-day, so same-date entries
// keep a stable log-order sort. Anchored to the LOCAL calendar date so it
// renders back to the picked day (avoids timezone off-by-one).
const isoFromDate = (dateStr: string, preserveFrom?: string) => {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const t = preserveFrom ? new Date(preserveFrom) : new Date();
  return new Date(y, (m || 1) - 1, d || 1, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).toISOString();
};

// Today as YYYY-MM-DD in LOCAL time (not UTC) for date-input defaults.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Stored ISO → local YYYY-MM-DD, so editing shows the same day the list shows.
const localDateFromISO = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Mode = 'MONTH' | 'YEAR';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const yearKey = (d: Date) => `${d.getFullYear()}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }) + (m === 1 ? ` '${String(y).slice(2)}` : '');
};

const Sheet = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children?: React.ReactNode }) => (
  <>
    <div
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    />
    <div style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)' }} className="fixed bottom-0 inset-x-0 z-50 kaya-sheet rounded-t-[28px] p-6  transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto max-w-md mx-auto">
      <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-6" />
      <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-ink">✕</button>
      {children}
    </div>
  </>
);

interface Props {
  displayCurrency: string;
  privacyMode: boolean;
  addTick: number;
  rates: Record<string, number>;
  records: IncomeRecord[];
  onRecordsChange: (records: IncomeRecord[]) => void;
}

const emptyDraft = (currency: string): IncomeRecord => ({
  id: '',
  amount: 0,
  currency,
  source: '',
  category: 'Dividend',
  date: todayLocal(),
  note: ''
});

export const IncomeTracker: React.FC<Props> = ({ displayCurrency, privacyMode, addTick, rates, records, onRecordsChange }) => {
  const [mode, setMode] = useState<Mode>('MONTH');
  const currentYear = new Date().getFullYear();
  const [viewYear, setViewYear] = useState(currentYear); // which year the Monthly view shows
  const earliestYear = useMemo(() => {
    const ys = records.map(r => new Date(r.date).getFullYear());
    return ys.length ? Math.min(...ys) : currentYear;
  }, [records, currentYear]);
  // Which bar is highlighted (null = the current/latest period).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  useEffect(() => { setSelectedKey(null); }, [mode, viewYear]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IncomeRecord>(emptyDraft(displayCurrency));

  // Controlled by App (which persists + syncs). Shim keeps the existing
  // setRecords(prev => ...) call sites working unchanged.
  const setRecords = (updater: IncomeRecord[] | ((prev: IncomeRecord[]) => IncomeRecord[])) => {
    const next = typeof updater === 'function' ? (updater as (p: IncomeRecord[]) => IncomeRecord[])(records) : updater;
    onRecordsChange(next);
  };

  // Build a continuous set of periods for the chart (last 12 months, or all years present).
  const chartData = useMemo(() => {
    const totals = new Map<string, number>();
    records.forEach(r => {
      const d = new Date(r.date);
      const key = mode === 'MONTH' ? monthKey(d) : yearKey(d);
      totals.set(key, (totals.get(key) || 0) + toDisplay(r.amount, r.currency, displayCurrency, rates, r.rateUsd));
    });

    const keys: string[] = [];
    const now = new Date();
    if (mode === 'MONTH') {
      // The selected year, January on the left. Current year stops at this month; past years show all 12.
      const lastMonth = viewYear === currentYear ? now.getMonth() : 11;
      for (let m = 0; m <= lastMonth; m++) keys.push(monthKey(new Date(viewYear, m, 1)));
    } else {
      // Only years that have data, oldest → current. No empty padding.
      for (let y = earliestYear; y <= currentYear; y++) keys.push(`${y}`);
    }
    return keys.map(key => ({
      key,
      label: mode === 'MONTH' ? monthLabel(key) : key,
      total: Math.round((totals.get(key) || 0) * 100) / 100
    }));
  }, [records, mode, displayCurrency, rates, viewYear, currentYear, earliestYear]);

  // Average monthly income for the displayed year (year total ÷ months shown). Simple cashflow line.
  const avgMonthly = useMemo(() => {
    if (mode !== 'MONTH') return 0;
    const sum = chartData.reduce((s, d) => s + d.total, 0);
    return sum / (chartData.length || 1);
  }, [chartData, mode]);

  // Headline number + growth: current month (MoM) for this year, year total (YoY) when browsing a past year, year total (YoY) in Yearly mode.
  const summary = useMemo(() => {
    const amt = (r: IncomeRecord) => toDisplay(r.amount, r.currency, displayCurrency, rates, r.rateUsd);
    const yearTotalOf = (y: number) => records.reduce((s, r) => new Date(r.date).getFullYear() === y ? s + amt(r) : s, 0);
    const monthTotalOf = (key: string) => records.reduce((s, r) => monthKey(new Date(r.date)) === key ? s + amt(r) : s, 0);
    // "vs Aug" for months (with the year when it crosses into the previous one), "vs 2025" for years.
    const monthVs = (y: number, m: number) => {
      const d = new Date(y, m - 2, 1);
      const short = d.toLocaleDateString('en-US', { month: 'short' });
      return d.getFullYear() === y ? short : `${short} ${d.getFullYear()}`;
    };
    // growth = null → nothing to compare (both empty); isNew → prior period had no income.
    const cmp = (label: string, value: number, prev: number, vs: string) => ({
      label, value, vs,
      isNew: prev <= 0 && value > 0,
      growth: prev > 0 ? ((value - prev) / prev) * 100 : null as number | null,
    });

    // A tapped bar drives the headline: its label, its total, and change vs the period before it.
    const selIdx = selectedKey ? chartData.findIndex(d => d.key === selectedKey) : -1;
    if (selIdx >= 0) {
      const sel = chartData[selIdx];
      if (mode === 'YEAR') {
        const y = Number(sel.key);
        return cmp(sel.key, sel.total, yearTotalOf(y - 1), `${y - 1}`);
      }
      const [y, m] = sel.key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return cmp(label, sel.total, monthTotalOf(monthKey(new Date(y, m - 2, 1))), monthVs(y, m));
    }

    if (mode === 'YEAR') {
      const cur = chartData[chartData.length - 1]?.total || 0;
      return cmp('This year', cur, yearTotalOf(currentYear - 1), `${currentYear - 1}`);
    }
    if (viewYear === currentYear) {
      const now = new Date();
      const cur = chartData[chartData.length - 1]?.total || 0;   // current month
      return cmp('This month', cur, monthTotalOf(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))), monthVs(now.getFullYear(), now.getMonth() + 1));
    }
    const total = chartData.reduce((s, d) => s + d.total, 0);
    return cmp(`${viewYear}`, total, yearTotalOf(viewYear - 1), `${viewYear - 1}`);
  }, [mode, viewYear, currentYear, chartData, records, displayCurrency, rates, selectedKey]);
  const current = summary.value;
  const growth = summary.growth;
  const allTimeTotal = useMemo(
    () => records.reduce((s, r) => s + toDisplay(r.amount, r.currency, displayCurrency, rates, r.rateUsd), 0),
    [records, displayCurrency, rates]
  );

  // Group records by period for the list, newest first.
  const grouped = useMemo(() => {
    const map = new Map<string, IncomeRecord[]>();
    [...records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(r => {
        const d = new Date(r.date);
        const key = mode === 'MONTH' ? monthKey(d) : yearKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      });
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: mode === 'MONTH'
        ? new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : key,
      subtotal: items.reduce((s, r) => s + toDisplay(r.amount, r.currency, displayCurrency, rates, r.rateUsd), 0),
      items
    }));
  }, [records, mode, displayCurrency, rates]);

  const openAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft(displayCurrency));
    setIsOpen(true);
  };

  // Opened from the shared floating + button in App. Only react to a NEW tap:
  // remember the tick value at mount so re-entering the tab (which remounts this
  // component with a non-zero tick from earlier taps) doesn't reopen the sheet.
  const seenAddTick = useRef(addTick);
  useEffect(() => {
    if (addTick !== seenAddTick.current) {
      seenAddTick.current = addTick;
      openAdd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTick]);
  const openEdit = (r: IncomeRecord) => {
    setEditingId(r.id);
    setDraft({ ...r, date: localDateFromISO(r.date) });
    setIsOpen(true);
  };
  const closeSheet = () => { setIsOpen(false); setEditingId(null); };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.amount || !draft.source.trim()) return;
    if (editingId) {
      setRecords(prev => prev.map(r => r.id === editingId ? { ...draft, date: isoFromDate(draft.date, r.date) } : r));
    } else {
      setRecords(prev => [...prev, { ...draft, id: Date.now().toString(), date: isoFromDate(draft.date), rateUsd: rates[draft.currency] }]);
    }
    closeSheet();
  };

  const remove = () => {
    if (!editingId) return;
    setRecords(prev => prev.filter(r => r.id !== editingId));
    closeSheet();
  };

  // Duplicate: copy details with today's date, then open it for quick editing.
  const duplicate = () => {
    const id = Date.now().toString();
    const copy: IncomeRecord = {
      ...draft,
      id,
      date: new Date().toISOString()
    };
    setRecords(prev => [...prev, copy]);
    setEditingId(id);
    setDraft({ ...copy, date: copy.date.split('T')[0] });
  };

  const hide = (s: string) => privacyMode ? '••••••' : s;
  const positive = (growth ?? 0) >= 0;

  return (
    <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
      <header className="px-1">
        <h1 className="text-3xl font-medium text-ink mb-1">Passive Income</h1>
        <p className="text-sm text-textMuted">Track how your dividends & interest grow</p>
      </header>

      {/* Summary + chart */}
      <div className="glass-panel rounded-[24px] p-5">
        {/* Header row: label + Monthly/Yearly toggle (same position/style as Portfolio "By type/By currency") */}
        <div className="flex items-center justify-between h-[25px]">
          <p className="text-textMuted text-[11px] font-medium tracking-[1.2px] uppercase">
            {summary.label}
          </p>
          <div className="flex gap-0.5">
            {(['MONTH', 'YEAR'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-[10px] py-[6px] text-[10px] font-medium rounded-full transition-colors duration-200 ${mode === m ? 'bg-textMuted text-paper' : 'text-textFaint hover:text-ink'}`}
              >
                {m === 'MONTH' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + growth (growth sits under the toggle, right-aligned) */}
        <div className="flex items-end justify-between mt-2 mb-1">
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-2xl font-normal text-textFaint"><Sym code={displayCurrency} /></span>
            <span className="text-4xl font-medium text-ink tracking-tight truncate">
              {privacyMode ? '••••••' : Math.round(current).toLocaleString()}
            </span>
          </div>
          {/* Change vs the previous period, with what it's compared against spelled out */}
          {(growth !== null || summary.isNew) && (
            <div className="shrink-0 mb-1 text-right">
              {growth !== null ? (
                <div className={`flex items-center justify-end gap-1 text-[13px] font-medium tabular-nums ${positive ? 'text-[#399d74]' : 'text-rose-400'}`}>
                  {positive ? <Icons.ArrowUp size={13} weight="bold" /> : <Icons.ArrowDown size={13} weight="bold" />}
                  {Math.abs(growth).toFixed(1)}%
                </div>
              ) : (
                <div className="text-[13px] font-medium text-[#399d74]">New</div>
              )}
              <div className="text-[11px] text-textFaint mt-0.5">vs {summary.vs}</div>
            </div>
          )}
        </div>
        <p className="text-[12px] text-textFaint mb-3">
          {mode === 'MONTH' && avgMonthly > 0
            ? <>Averaging <span className="text-[#399d74] font-medium">{hide(fmt(avgMonthly, displayCurrency))}</span> a month {viewYear === currentYear ? 'this year' : `in ${viewYear}`}</>
            : <>{mode === 'MONTH' ? 'No income yet for this year' : 'Year over year'} · All-time {hide(fmt(allTimeTotal, displayCurrency))}</>}
        </p>

        {mode === 'MONTH' && (
          <div className="flex items-center justify-center gap-5 mb-2">
            <button
              onClick={() => setViewYear(y => Math.max(earliestYear, y - 1))}
              disabled={viewYear <= earliestYear}
              aria-label="Previous year"
              className="p-1 rounded-full text-textMuted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Icons.ChevronRight size={18} className="rotate-180" />
            </button>
            <span className="text-sm font-medium text-ink tabular-nums w-12 text-center">{viewYear}</span>
            <button
              onClick={() => setViewYear(y => Math.min(currentYear, y + 1))}
              disabled={viewYear >= currentYear}
              aria-label="Next year"
              className="p-1 rounded-full text-textMuted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Icons.ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className="h-36 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              style={{ cursor: 'pointer' }}
              onClick={(s: any) => {
                // Tapping anywhere in a column selects that period; tap it again to go back to the latest.
                const i = s?.activeTooltipIndex;
                if (i == null || !chartData[i]) return;
                const k = chartData[i].key;
                setSelectedKey(prev => (prev === k ? null : k));
              }}
            >
              <defs>
                {/* Main green at the base fading to muted at the top */}
                <linearGradient id="incomeBarGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#399d74" />
                  <stop offset="100%" stopColor="#dcf5df" />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: '#6e8777', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={10} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null;
                  // Same colors as the active toggles: muted fill, black text.
                  return (
                    <div className="bg-textMuted text-paper px-3 py-2 rounded-xl shadow-lg shadow-black/30">
                      <p className="text-[11px] font-medium text-paper/60 leading-none mb-1">{label}</p>
                      <p className="text-sm font-semibold leading-none tabular-nums">{privacyMode ? '••••' : fmt(payload[0].value, displayCurrency)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" radius={[6, 6, 2, 2]} animationDuration={700} maxBarSize={48}>
                {/* Every bar uses the gradient; the selected period (default: latest) is full strength. */}
                {chartData.map((entry, i) => {
                  const isSel = selectedKey ? entry.key === selectedKey : i === chartData.length - 1;
                  return <Cell key={entry.key} fill="url(#incomeBarGrad)" fillOpacity={isSel ? 1 : 0.4} style={{ transition: 'fill-opacity 200ms ease' }} />;
                })}
              </Bar>
              {mode === 'MONTH' && avgMonthly > 0 && (
                <ReferenceLine
                  y={avgMonthly}
                  stroke="#399d74"
                  strokeDasharray="4 4"
                  strokeOpacity={0.9}
                  ifOverflow="extendDomain"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Records grouped by period */}
      {records.length === 0 ? (
        <div className="glass-panel rounded-[20px] p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center mx-auto mb-3">
            <Icons.Trend size={22} />
          </div>
          <p className="text-ink font-medium mb-1">No income logged yet</p>
          <p className="text-textMuted text-sm">Tap + to add your first dividend or interest payment.</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.key}>
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px]">{group.label}</h3>
              <span className="text-[13px] font-medium text-ink tabular-nums">{hide(fmt(group.subtotal, displayCurrency))}</span>
            </div>
            {/* Same frosted card + row style as the Portfolio account list */}
            <div className="glass-panel rounded-[20px] overflow-hidden">
              {group.items.map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className={`group px-4 py-3.5 flex justify-between items-center gap-3 cursor-pointer hover:bg-ink/5 transition-colors ${idx !== group.items.length - 1 ? 'border-b border-ink/5' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center shrink-0">
                      <Icons.ArrowDownLeft size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink text-[15px] truncate">{r.source || r.category}</p>
                      <p className="text-[12px] text-textMuted mt-0.5 truncate">
                        {r.category} · {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-ink text-[15px] tabular-nums">
                      {privacyMode ? '••••' : <>+<Sym code={r.currency} />{r.amount.toLocaleString()}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add / Edit sheet */}
      <Sheet isOpen={isOpen} onClose={closeSheet}>
        {isOpen && (<>
        <h2 className="text-2xl font-medium mb-6 text-ink">{editingId ? 'Edit Income' : 'Add Income'}</h2>
        <form onSubmit={save} className="space-y-5">
          <div>
            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Amount</label>
            <div className="flex items-center kaya-field kaya-field-wrap transition-all">
              <CurrencyPicker value={draft.currency} onChange={(code) => setDraft({ ...draft, currency: code })} variant="inline" />
              <input
                required
                type="number"
                step="any"
                placeholder="0.00"
                value={draft.amount || ''}
                onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-transparent border-none text-[#399d74] text-2xl font-medium p-1 outline-none placeholder:text-textFaint"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Source</label>
            <input
              required
              placeholder="e.g. JFC, SM, BPI Savings"
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              className="kaya-field transition-all placeholder:text-textFaint"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Category</label>
            <div className="relative">
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="kaya-field  transition-all"
              >
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Date</label>
            <div className="relative">
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="kaya-field transition-all"
              />
              <Icons.Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-textFaint pointer-events-none" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Note (optional)</label>
            <input
              placeholder="Anything to remember"
              value={draft.note || ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className="kaya-field transition-all placeholder:text-textFaint"
            />
          </div>

          {editingId ? (
            <div className="space-y-3 pt-2">
              <button type="submit" className="w-full kaya-btn py-4 rounded-[14px]">
                Save
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={duplicate} className="flex-1 bg-ink/5 hover:bg-ink/10 text-ink border border-ink/10 font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Icons.History size={18} /> Duplicate
                </button>
                <button type="button" onClick={remove} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold py-4 rounded-[14px] transition-colors flex items-center justify-center gap-2">
                  <Icons.Delete size={18} /> Delete
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" className="w-full kaya-btn py-4 rounded-[14px] mt-2">
              Add Income
            </button>
          )}
        </form>
        </>)}
      </Sheet>
    </div>
  );
};
