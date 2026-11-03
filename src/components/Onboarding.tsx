import React, { useMemo, useState } from 'react';
import { Icons } from './icons';
import { Sym } from './DirhamSign';
import { DitherBackground } from './DitherBackground';
import { CurrencyPicker } from './CurrencyPicker';
import { AssetCategory, Currency } from '../types';

// ---------------------------------------------------------------------------
// New sign-up onboarding (3 steps). Uses the shared Kaya styles:
// dither background, frosted .glass-panel cards, muted pills, .kaya-btn.
// ---------------------------------------------------------------------------

export interface OnboardingPreset { name: string; category: AssetCategory; currency: string; institution?: string }
export interface OnboardingResult {
  countries: string[];
  displayCurrency: string;
  goals: string[];
  accounts: OnboardingPreset[];
  wantsCustom: boolean;
}

type Country = { code: string; flag?: string; name: string; currency?: string };
const COUNTRIES: Country[] = [
  { code: 'PH', flag: '🇵🇭', name: 'Philippines', currency: Currency.PHP },
  { code: 'CA', flag: '🇨🇦', name: 'Canada', currency: Currency.CAD },
  { code: 'US', flag: '🇺🇸', name: 'United States', currency: Currency.USD },
  { code: 'AE', flag: '🇦🇪', name: 'UAE', currency: Currency.AED },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore', currency: Currency.SGD },
  { code: 'GB', flag: '🇬🇧', name: 'UK', currency: Currency.GBP },
  { code: 'EU', flag: '🇪🇺', name: 'Europe', currency: Currency.EUR },
  { code: 'OTHER', name: 'Other' },
];

const GOALS = [
  { id: 'NET_WORTH', title: 'Grow my net worth', sub: 'One clear total across every currency', icon: Icons.Trend },
  { id: 'PASSIVE_INCOME', title: 'Track passive income', sub: 'Dividends, interest and how they grow', icon: Icons.BarChart },
  { id: 'SAVE_GOAL', title: 'Save for a goal', sub: 'House, tuition, emergency fund', icon: Icons.Home },
  { id: 'SUPPORT_FAMILY', title: 'Support family back home', sub: 'See what you can send, and how fast', icon: Icons.Heart },
];

const B = AssetCategory;
const PRESETS: Record<string, OnboardingPreset[]> = {
  PH: [
    { name: 'BPI', category: B.BANK_PH, currency: 'PHP', institution: 'BPI' },
    { name: 'BDO', category: B.BANK_PH, currency: 'PHP', institution: 'BDO' },
    { name: 'GCash', category: B.CASH, currency: 'PHP', institution: 'GCash' },
    { name: 'Maya', category: B.CASH, currency: 'PHP', institution: 'Maya' },
    { name: 'SSS', category: B.PENSION, currency: 'PHP' },
    { name: 'Pag-IBIG MP2', category: B.PENSION, currency: 'PHP' },
    { name: 'COL Financial', category: B.STOCKS, currency: 'PHP', institution: 'COL Financial' },
  ],
  CA: [
    { name: 'Wealthsimple', category: B.STOCKS, currency: 'CAD', institution: 'Wealthsimple' },
    { name: 'RBC', category: B.BANK_INTL, currency: 'CAD', institution: 'RBC' },
    { name: 'TD', category: B.BANK_INTL, currency: 'CAD', institution: 'TD' },
    { name: 'TFSA', category: B.STOCKS, currency: 'CAD' },
    { name: 'RRSP', category: B.PENSION, currency: 'CAD' },
  ],
  US: [
    { name: 'Chase', category: B.BANK_INTL, currency: 'USD', institution: 'Chase' },
    { name: 'Bank of America', category: B.BANK_INTL, currency: 'USD', institution: 'Bank of America' },
    { name: 'Fidelity', category: B.STOCKS, currency: 'USD', institution: 'Fidelity' },
    { name: '401(k)', category: B.PENSION, currency: 'USD' },
    { name: 'Roth IRA', category: B.PENSION, currency: 'USD' },
  ],
  AE: [
    { name: 'Emirates NBD', category: B.BANK_INTL, currency: 'AED', institution: 'Emirates NBD' },
    { name: 'ADCB', category: B.BANK_INTL, currency: 'AED', institution: 'ADCB' },
    { name: 'Mashreq', category: B.BANK_INTL, currency: 'AED', institution: 'Mashreq' },
    { name: 'Wio', category: B.BANK_INTL, currency: 'AED', institution: 'Wio' },
  ],
  SG: [
    { name: 'DBS', category: B.BANK_INTL, currency: 'SGD', institution: 'DBS' },
    { name: 'OCBC', category: B.BANK_INTL, currency: 'SGD', institution: 'OCBC' },
    { name: 'CPF', category: B.PENSION, currency: 'SGD' },
  ],
  GB: [
    { name: 'HSBC', category: B.BANK_INTL, currency: 'GBP', institution: 'HSBC' },
    { name: 'Barclays', category: B.BANK_INTL, currency: 'GBP', institution: 'Barclays' },
    { name: 'Monzo', category: B.BANK_INTL, currency: 'GBP', institution: 'Monzo' },
    { name: 'ISA', category: B.STOCKS, currency: 'GBP' },
    { name: 'Pension', category: B.PENSION, currency: 'GBP' },
  ],
  EU: [
    { name: 'Revolut', category: B.BANK_INTL, currency: 'EUR', institution: 'Revolut' },
    { name: 'N26', category: B.BANK_INTL, currency: 'EUR', institution: 'N26' },
    { name: 'Wise', category: B.BANK_INTL, currency: 'EUR', institution: 'Wise' },
  ],
};

// Best-guess starting country from the device time zone (just a preselection).
function guessCountry(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Manila') return 'PH';
    if (tz === 'Asia/Dubai') return 'AE';
    if (tz === 'Asia/Singapore') return 'SG';
    if (tz === 'Europe/London') return 'GB';
    if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns|Montreal)/.test(tz)) return 'CA';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)|^Pacific\/Honolulu/.test(tz)) return 'US';
    if (/^Europe\//.test(tz)) return 'EU';
  } catch { /* ignore */ }
  return null;
}

const Check: React.FC<{ size?: number }> = ({ size = 14 }) => <Icons.Check size={size} weight="bold" className="shrink-0" />;

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[13px] font-medium transition-colors duration-200 ${on ? 'bg-textMuted text-paper' : 'glass-panel text-textMuted hover:text-ink'}`}
  >
    {children}
  </button>
);

export const Onboarding: React.FC<{ onFinish: (r: OnboardingResult) => void }> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const [countries, setCountries] = useState<string[]>(() => { const g = guessCountry(); return g ? [g] : []; });
  const [goals, setGoals] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // "COUNTRY:name"
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const addCustom = () => {
    const name = customDraft.trim().slice(0, 32);
    if (name && !customNames.some(n => n.toLowerCase() === name.toLowerCase())) {
      setCustomNames(l => [...l, name]);
      setPicked(l => [...l, `ANY:${name}`]);
    }
    setCustomDraft('');
    setAddingCustom(false);
  };
  // Manual currency choice (always allowed; required when only "Other" is picked).
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  // First picked country with a currency drives the display currency.
  const derivedCurrency = useMemo(() => {
    for (const c of COUNTRIES) if (countries.includes(c.code) && c.currency) return c.currency;
    return null;
  }, [countries]);
  const onlyOther = countries.length > 0 && countries.every(c => c === 'OTHER');
  const needsCurrency = onlyOther && !currencyOverride;
  const displayCurrency = currencyOverride || derivedCurrency || Currency.USD;

  const groups = useMemo(() => {
    const g = COUNTRIES.filter(c => countries.includes(c.code) && PRESETS[c.code]).map(c => ({ key: c.code, label: c.name, items: PRESETS[c.code] }));
    g.push({ key: 'ANY', label: 'Anywhere', items: [
      { name: 'Cash', category: B.CASH, currency: displayCurrency },
      { name: 'Bitcoin', category: B.CRYPTO, currency: Currency.BTC },
      // User-added accounts (from "Add your own")
      ...customNames.map(name => ({ name, category: B.OTHER, currency: displayCurrency })),
    ] });
    return g;
  }, [countries, displayCurrency, customNames]);

  const pickedPresets = useMemo(() => {
    const out: OnboardingPreset[] = [];
    for (const g of groups) for (const p of g.items) if (picked.includes(`${g.key}:${p.name}`)) out.push(p);
    return out;
  }, [groups, picked]);

  const finish = (withAccounts: boolean) => onFinish({
    countries, displayCurrency, goals,
    accounts: withAccounts ? pickedPresets : [],
    wantsCustom: false,
  });

  const Back = (
    <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} aria-label="Back" className="text-textFaint hover:text-ink transition-colors p-1 -m-1">
      <Icons.ArrowLeft size={20} />
    </button>
  );

  const n = pickedPresets.length;

  return (
    <div className="h-[100dvh] max-w-md mx-auto relative isolate overflow-hidden text-ink font-sans flex flex-col kaya-anim"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
      <DitherBackground theme="dark" />

      {/* Progress */}
      <div className="px-5 flex gap-1.5 mb-6" aria-hidden>
        {[0, 1, 2].map(i => <i key={i} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-textMuted' : 'bg-ink/15'}`} />)}
      </div>

      <div key={step} className="flex-1 min-h-0 flex flex-col px-5 animate-[kayaRise_0.35s_ease-out]">
        <div className="flex items-center justify-between h-6 mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[1.2px] text-textMuted">Step {step + 1} of 3</span>
          {step > 0 && Back}
        </div>

        {step === 0 && (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">Where does your money live?</h1>
            <p className="text-[14px] text-textFaint mt-2 mb-6 leading-relaxed">Pick every country you keep money in. Kaya adds it all up in one currency.</p>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map(c => {
                const on = countries.includes(c.code);
                return (
                  <Chip key={c.code} on={on} onClick={() => setCountries(l => toggle(l, c.code))}>
                    {on && <Check />}
                    {c.flag ? <span aria-hidden>{c.flag}</span> : (!on && <Icons.Global size={14} className="shrink-0" />)}
                    {c.name}
                  </Chip>
                );
              })}
            </div>
            <div className="glass-panel rounded-[16px] mt-5 px-3.5 py-3 flex items-center gap-3">
              {/* Currency symbol, centered in a fixed-size tile */}
              <div className="relative w-8 h-8 rounded-[10px] bg-[#399d74]/15 text-[#399d74] shrink-0">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] font-semibold leading-none whitespace-nowrap">{needsCurrency ? <Icons.Global size={16} /> : <Sym code={displayCurrency} />}</span>
              </div>
              <p className="flex-1 min-w-0 text-[12px] text-textFaint leading-snug">
                {needsCurrency ? 'Choose the currency for your total' : <>Your total will show in this currency · change anytime</>}
              </p>
              {/* Tap to pick any currency (searchable). Needed when only "Other" is selected. */}
              <div className="shrink-0 -mr-3">
                <CurrencyPicker variant="inline" value={displayCurrency} placeholder={needsCurrency ? 'Choose' : undefined} onChange={setCurrencyOverride} />
              </div>
            </div>
            <div className="flex-1" />
            <button type="button" disabled={!countries.length || needsCurrency} onClick={() => setStep(1)} className="kaya-btn w-full py-4 rounded-[14px]">Continue</button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">What are you tracking for?</h1>
            <p className="text-[14px] text-textFaint mt-2 mb-5 leading-relaxed">Pick all that apply. We'll shape your Home around them.</p>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-5 px-5 pt-1 space-y-2.5">
              {GOALS.map(g => {
                const on = goals.includes(g.id);
                const I = g.icon;
                return (
                  <button key={g.id} type="button" onClick={() => setGoals(l => toggle(l, g.id))} aria-pressed={on}
                    className="glass-panel w-full text-left rounded-[20px] px-4 py-3.5 flex items-center gap-3">
                    {/* Selected outline: same stroke + soft ring as a focused input field.
                        Drawn as its own layer (glass-panel strips borders/shadows in dark mode). */}
                    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[20px] transition-opacity duration-200"
                      style={{ opacity: on ? 1 : 0, boxShadow: 'inset 0 0 0 1px rgba(220,245,223,0.45), 0 0 0 3px rgba(57,157,116,0.18)' }} />
                    <div className="w-10 h-10 rounded-xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center shrink-0"><I size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-ink">{g.title}</p>
                      <p className="text-[12px] text-textFaint mt-0.5">{g.sub}</p>
                    </div>
                    {/* Round checkbox: outline when off, filled muted with a check when on */}
                    <span className={`w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center border transition-colors duration-200 ${on ? 'bg-textMuted border-transparent text-paper' : 'border-ink/20 text-transparent'}`}>
                      <Check size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setStep(2)} className="kaya-btn w-full py-4 rounded-[14px] mt-3">Continue</button>
            <button type="button" onClick={() => { setGoals([]); setStep(2); }} className="w-full mt-2 py-2 text-[13px] font-medium text-textFaint hover:text-ink transition-colors">Skip for now</button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">Add your accounts</h1>
            <p className="text-[14px] text-textFaint mt-2 mb-5 leading-relaxed">Tap the ones you have. You can enter balances anytime.</p>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-5 px-5">
              {groups.map((g, gi) => (
                <div key={g.key} className={gi ? 'mt-5' : ''}>
                  <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-textFaint mb-2.5">{g.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map(p => {
                      const id = `${g.key}:${p.name}`;
                      const on = picked.includes(id);
                      return <Chip key={id} on={on} onClick={() => setPicked(l => toggle(l, id))}>{on && <Check />}{p.name}</Chip>;
                    })}
                    {g.key === 'ANY' && !addingCustom && (
                      <Chip on={false} onClick={() => setAddingCustom(true)}><Icons.Add size={14} className="shrink-0" />Add your own</Chip>
                    )}
                  </div>
                  {/* Inline "Add your own": type a name, it becomes a selected chip above */}
                  {g.key === 'ANY' && addingCustom && (
                    <form onSubmit={(e) => { e.preventDefault(); addCustom(); }} className="mt-3 flex gap-2 animate-[kayaFadeUp_0.25s_ease-out]">
                      <input
                        autoFocus
                        value={customDraft}
                        onChange={(e) => setCustomDraft(e.target.value)}
                        maxLength={32}
                        placeholder="e.g. Car fund, Pag-IBIG, HSA"
                        className="kaya-field flex-1 min-w-0 !py-2.5"
                      />
                      <button type="submit" disabled={!customDraft.trim()} className="kaya-btn px-4 rounded-[14px] shrink-0">Add</button>
                      <button type="button" onClick={() => { setCustomDraft(''); setAddingCustom(false); }} aria-label="Cancel" className="kaya-btn-secondary w-11 rounded-[14px] shrink-0 flex items-center justify-center"><Icons.Close size={16} /></button>
                    </form>
                  )}
                </div>
              ))}
              <div className="glass-panel rounded-[16px] mt-6 mb-2 px-3.5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#399d74]/15 text-[#399d74] flex items-center justify-center shrink-0"><Icons.Lock size={16} /></div>
                <p className="text-[12px] text-textFaint">All manual. <span className="text-ink font-semibold">Nothing links to your bank.</span></p>
              </div>
            </div>
            <button type="button" onClick={() => finish(true)} className="kaya-btn w-full py-4 rounded-[14px] mt-3">
              {n ? `Add ${n} account${n > 1 ? 's' : ''}` : 'Finish setup'}
            </button>
            <button type="button" onClick={() => finish(false)} className="w-full mt-2 py-2 text-[13px] font-medium text-textFaint hover:text-ink transition-colors">Skip for now</button>
          </>
        )}
      </div>
    </div>
  );
};
