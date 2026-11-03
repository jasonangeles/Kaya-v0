import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './icons';
import { ORDERED_CURRENCIES, COMMON_CURRENCY_CODES } from '../data/currencies';

interface Props {
  value: string;
  onChange: (code: string) => void;
  // Trigger style: 'field' = full-width form field; 'inline' = compact pill (amount row, onboarding).
  variant?: 'field' | 'inline';
  /** Optional label to show on the trigger instead of the code (e.g. "Choose"). */
  placeholder?: string;
}

// Currency selector. Tapping the trigger opens a bottom sheet (same style as the
// app's other modals) with a search field and the Settings "Select Currency" list.
// Portaled to <body> so it layers correctly even when opened from inside another sheet.
export const CurrencyPicker: React.FC<Props> = ({ value, onChange, variant = 'field', placeholder }) => {
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

  // Esc closes the sheet on desktop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sheet = open && createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={close} />
      <div
        role="dialog"
        aria-label="Select currency"
        className="fixed bottom-0 inset-x-0 z-[70] max-w-md mx-auto kaya-sheet rounded-t-[28px] px-6 pt-6 flex flex-col animate-[kayaSheetUp_0.3s_cubic-bezier(.22,1,.36,1)]"
        // Fixed height (~70% of the screen) so the search field never jumps while the
        // list filters down; only the list area scrolls/shrinks inside it.
        style={{ height: '70vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-6 shrink-0" />
        <button type="button" onClick={close} aria-label="Close" className="absolute top-6 right-6 text-textMuted hover:text-ink">✕</button>
        <h2 className="text-2xl font-medium text-ink mb-4 shrink-0">Select currency</h2>

        <div className="kaya-field flex items-center gap-2.5 shrink-0 mb-4 kaya-field-wrap">
          <Icons.Search size={18} className="text-textFaint shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or name"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-ink text-[16px] py-1.5 placeholder:text-textFaint"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-textFaint hover:text-ink">
              <Icons.Close size={16} />
            </button>
          )}
        </div>

        {/* Same row style as Settings → Select Currency */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-1 px-1">
          <div className="glass-panel rounded-[20px] overflow-hidden">
            {results.length === 0 && (
              <div className="p-4 text-sm text-textMuted">No currency matches "{query}"</div>
            )}
            {results.map((c, i) => {
              const firstNonCommon =
                !query && i > 0 &&
                COMMON_CURRENCY_CODES.includes(results[i - 1].code) &&
                !COMMON_CURRENCY_CODES.includes(c.code);
              const selected = value === c.code;
              return (
                <React.Fragment key={c.code}>
                  {firstNonCommon && (
                    <div className="px-4 pt-4 pb-2 text-[11px] font-medium uppercase tracking-[1.2px] text-textFaint border-t border-ink/5">All currencies</div>
                  )}
                  <button
                    type="button"
                    onClick={() => pick(c.code)}
                    className={`w-full text-left p-4 flex justify-between items-center hover:bg-ink/5 transition-colors ${i !== results.length - 1 ? 'border-b border-ink/5' : ''}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="font-medium w-10 shrink-0 text-ink">{c.code}</span>
                      <span className="text-sm text-textMuted truncate">{c.name}</span>
                    </span>
                    {selected && <Icons.Check className="text-ink w-5 h-5 shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </>,
    document.body
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'inline'
            ? 'flex items-center gap-1 bg-ink/10 text-ink text-sm rounded-full px-3 py-1.5 mr-3 hover:bg-ink/15 transition-colors'
            : 'kaya-field flex items-center justify-between outline-none transition-all'
        }
      >
        <span className="font-medium">{placeholder || value}</span>
        <Icons.ChevronDown size={variant === 'inline' ? 14 : 20} className="text-textMuted" />
      </button>
      {sheet}
    </>
  );
};
