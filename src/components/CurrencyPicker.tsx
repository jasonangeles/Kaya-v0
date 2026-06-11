import React, { useState, useMemo } from 'react';
import { Icons } from './icons';
import { ORDERED_CURRENCIES, COMMON_CURRENCY_CODES } from '../data/currencies';

interface Props {
  value: string;
  onChange: (code: string) => void;
  // Render style: 'field' = full-width form field; 'inline' = compact pill (for the amount row).
  variant?: 'field' | 'inline';
}

// Searchable currency selector: type to filter by code or name,
// common currencies pinned on top, full ISO list below.
export const CurrencyPicker: React.FC<Props> = ({ value, onChange, variant = 'field' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ORDERED_CURRENCIES;
    return ORDERED_CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [query]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (code: string) => { onChange(code); close(); };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          variant === 'inline'
            ? 'flex items-center gap-1 bg-zinc-800 text-zinc-200 text-sm rounded-lg px-2.5 py-1.5 mr-3 hover:bg-zinc-700 transition-colors'
            : 'w-full flex items-center justify-between bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-white/40 outline-none transition-all'
        }
      >
        <span className="font-medium">{value}</span>
        <Icons.ChevronDown size={variant === 'inline' ? 14 : 20} className="text-textMuted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[220px]">
            <div className="p-2 border-b border-white/5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search currency…"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/40 placeholder:text-zinc-600"
              />
            </div>
            <div className="max-h-60 overflow-y-auto no-scrollbar">
              {results.length === 0 && (
                <div className="px-4 py-3 text-sm text-textMuted">No match</div>
              )}
              {results.map((c, i) => {
                const firstNonCommon =
                  !query &&
                  i > 0 &&
                  COMMON_CURRENCY_CODES.includes(results[i - 1].code) &&
                  !COMMON_CURRENCY_CODES.includes(c.code);
                return (
                  <React.Fragment key={c.code}>
                    {firstNonCommon && <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-zinc-600 bg-white/5">All currencies</div>}
                    <button
                      type="button"
                      onClick={() => pick(c.code)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    >
                      <span className={`font-medium min-w-[36px] ${value === c.code ? 'text-primary' : 'text-white'}`}>{c.code}</span>
                      <span className="text-xs text-textMuted truncate flex-1">{c.name}</span>
                      {value === c.code && <Icons.Check size={16} className="text-primary" />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
