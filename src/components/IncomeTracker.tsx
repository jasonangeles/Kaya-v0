import React, { useState, useEffect, useMemo } from 'react';
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
      className={`fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    />
    <div style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)' }} className="fixed bottom-0 inset-x-0 z-50 bg-surface3 border-t border-ink/10 rounded-t-3xl p-6 shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto max-w-md mx-auto">
      <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6" />
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
  date: new Date().toISOString().split('T')[0],
  note: ''
});

export const IncomeTracker: React.FC<Props> = ({ displayCurrency, privacyMode, addTick, rates, records, onRecordsChange }) => {
  const [mode, setMode] = useState<Mode>('MONTH');
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
      // Current calendar year, January on the left up to the current month.
      for (let m = 0; m <= now.getMonth(); m++) {
        keys.push(monthKey(new Date(now.getFullYear(), m, 1)));
      }
    } else {
      const years = records.map(r => new Date(r.date).getFullYear());
      const minY = years.length ? Math.min(...years) : now.getFullYear();
      for (let y = Math.min(minY, now.getFullYear() - 4); y <= now.getFullYear(); y++) keys.push(`${y}`);
    }
    return keys.map(key => ({
      key,
      label: mode === 'MONTH' ? monthLabel(key) : key,
      total: Math.round((totals.get(key) || 0) * 100) / 100
    }));
  }, [records, mode, displayCurrency, rates]);

  const current = chartData[chartData.length - 1]?.total || 0;
  const previous = chartData[chartData.length - 2]?.total || 0;
  // Average monthly income this year (this year's total ÷ months elapsed). Simple cashflow line.
  const avgMonthly = useMemo(() => {
    if (mode !== 'MONTH') return 0;
    const sum = chartData.reduce((s, d) => s + d.total, 0);
    return sum / (chartData.length || 1);
  }, [chartData, mode]);
  const growth = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
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

  // Opened from the shared floating + button in App.
  useEffect(() => {
    if (addTick > 0) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTick]);
  const openEdit = (r: IncomeRecord) => {
    setEditingId(r.id);
    setDraft({ ...r, date: r.date.split('T')[0] });
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
  const positive = growth >= 0;

  return (
    <div className="pb-28 space-y-6 animate-[fadeIn_0.4s_ease-out]">
      <header className="px-1">
        <h1 className="text-3xl font-medium text-ink mb-1">Passive Income</h1>
        <p className="text-sm text-textMuted">Track how your dividends & interest grow</p>
      </header>

      {/* Summary + chart */}
      <div className="glass-panel rounded-3xl p-4 shadow-lg">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-textMuted text-xs font-medium tracking-widest uppercase mb-1">
              {mode === 'MONTH' ? 'This month' : 'This year'}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-normal text-textFaint"><Sym code={displayCurrency} /></span>
              <span className="text-4xl font-medium text-ink tracking-tight">
                {privacyMode ? '••••••' : Math.round(current).toLocaleString()}
              </span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {positive ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />}
            {Math.abs(growth).toFixed(1)}%
          </div>
        </div>
        <p className="text-[11px] text-textMuted mb-3">
          {mode === 'MONTH' && avgMonthly > 0
            ? <>Averaging {hide(fmt(avgMonthly, displayCurrency))} a month this year</>
            : <>{mode === 'MONTH' ? 'This year so far' : 'Year over year'} · All-time {hide(fmt(allTimeTotal, displayCurrency))}</>}
        </p>

        <div className="h-36 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={10} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-surface3/95 border border-ink/10 p-3 rounded-xl shadow-2xl">
                      <p className="text-textMuted text-xs mb-1">{label}</p>
                      <p className="text-emerald-400 font-bold text-sm">{fmt(payload[0].value, displayCurrency)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} animationDuration={700}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#10b981' : '#3f3f46'} />
                ))}
              </Bar>
              {mode === 'MONTH' && avgMonthly > 0 && (
                <ReferenceLine
                  y={avgMonthly}
                  stroke="#e4e4e7"
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                  ifOverflow="extendDomain"
                  label={{
                    value: privacyMode ? '•••• /mo avg' : `${symbolOf(displayCurrency)}${Math.round(avgMonthly).toLocaleString()} /mo avg`,
                    position: 'insideTopRight',
                    fill: '#a1a1aa',
                    fontSize: 10
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-surface2 rounded-full p-0.5 mt-3">
          {(['MONTH', 'YEAR'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-all ${mode === m ? 'bg-surfaceHi text-ink shadow-sm' : 'text-textFaint hover:text-ink'}`}
            >
              {m === 'MONTH' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      {/* Records grouped by period */}
      {records.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 text-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Icons.Trend size={22} />
          </div>
          <p className="text-ink font-medium mb-1">No income logged yet</p>
          <p className="text-textMuted text-sm">Tap + to add your first dividend or interest payment.</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.key} className="px-1">
            <div className="flex justify-between items-baseline mb-2 px-1">
              <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">{group.label}</h3>
              <span className="text-xs font-medium text-emerald-400">{hide(fmt(group.subtotal, displayCurrency))}</span>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-lg bg-surface2 border border-ink/5">
              {group.items.map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className={`group p-4 flex justify-between items-center cursor-pointer hover:bg-ink/5 transition-colors ${idx !== group.items.length - 1 ? 'border-b border-ink/5' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-ink/5">
                      <Icons.ArrowDownLeft size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{r.source || r.category}</p>
                      <p className="text-[11px] text-textMuted truncate">
                        {r.category} · {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-emerald-400">
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
            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Amount</label>
            <div className="flex items-center bg-surface2 border border-ink/10 rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-ink/40 transition-all">
              <CurrencyPicker value={draft.currency} onChange={(code) => setDraft({ ...draft, currency: code })} variant="inline" />
              <input
                required
                type="number"
                step="any"
                placeholder="0.00"
                value={draft.amount || ''}
                onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-transparent border-none text-emerald-400 text-2xl font-medium p-1 outline-none placeholder:text-textFaint"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Source</label>
            <input
              required
              placeholder="e.g. FB, RCR, BPI Savings"
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-ink/40 outline-none transition-all placeholder:text-textFaint"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Category</label>
            <div className="relative">
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink outline-none appearance-none focus:border-ink/40 transition-all"
              >
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Date</label>
            <div className="relative">
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-ink/40 outline-none transition-all"
              />
              <Icons.Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-textFaint pointer-events-none" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Note (optional)</label>
            <input
              placeholder="Anything to remember"
              value={draft.note || ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-ink/40 outline-none transition-all placeholder:text-textFaint"
            />
          </div>

          {editingId ? (
            <div className="space-y-3 pt-2">
              <button type="submit" className="w-full bg-ink text-paper shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity">
                Save
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={duplicate} className="flex-1 bg-ink/5 hover:bg-ink/10 text-ink border border-ink/10 font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Icons.History size={18} /> Duplicate
                </button>
                <button type="button" onClick={remove} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Icons.Delete size={18} /> Delete
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" className="w-full bg-ink text-paper shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity mt-2">
              Add Income
            </button>
          )}
        </form>
        </>)}
      </Sheet>
    </div>
  );
};
