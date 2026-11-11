import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './components/icons';
import { NetWorthChart, ChartScrub } from './components/NetWorthChart';
import { IncomeTracker } from './components/IncomeTracker';
import { LockScreen, SetPinSheet, RecoverySheet, RecoveryCodeSheet, generateRecoveryCode, hashRecoveryCode, isBiometricAvailable, registerBiometric } from './components/AppLock';
import { Landing } from './components/Landing';
import { InstitutionLogo } from './components/InstitutionLogo';
import { AllocationCarousel } from './components/AllocationCarousel';
import { CurrencyPicker } from './components/CurrencyPicker';
import { Sym, DirhamSign } from './components/DirhamSign';
import { DitherBackground } from './components/DitherBackground';
import { PrivacyPage } from './components/PrivacyPage';
import { BottomSheet } from './components/BottomSheet';
import { optIn, optOut, dismissPrompt, shouldAskMarketing, applyPendingSignupConsent, hasPendingSignupConsent, openCookieSettings, CONSENT_TEXT, type MarketingMeta } from './services/consent';
import { Onboarding, OnboardingResult } from './components/Onboarding';
import { ORDERED_CURRENCIES, COMMON_CURRENCY_CODES, symbolFor } from './data/currencies';
import { supabase, isSupabaseEnabled } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Asset, Currency, AssetCategory, UserSettings, TimeRange, AssetHistoryEntry, IncomeRecord, Liquidity } from './types';
import { RATES, BTC_PRICE_USD } from './services/mockDataService';
import { buildNetWorthSeries } from './services/history';
import { getLiveRates, getFxWeekly, FxHistory } from './services/fxService';
import { getWealthInsights } from './services/geminiService';

// --- Helper Components ---

// Every slide-up form uses the shared sheet (tap/swipe the grab bar, backdrop, ✕ or Escape to close).
const Modal = BottomSheet;

// Tiny inline weekly sparkline for the FX rows. Green if up over the period, red if down.
const Sparkline: React.FC<{ data: number[]; up: boolean; w?: number; h?: number }> = ({ data, up, w = 76, h = 28 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={up ? '#399d74' : '#f43f5e'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface HistoryItemProps {
  entry: AssetHistoryEntry;
  currency: string;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
  shouldAnimateHint: boolean;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  entry,
  currency,
  isLast,
  onDelete,
  onEdit,
  shouldAnimateHint
}) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const moved = useRef(false);

  useEffect(() => {
    if (shouldAnimateHint) {
      const timer = setTimeout(() => {
        setOffset(-60);
        setTimeout(() => setOffset(0), 400);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimateHint]);

  // Shared drag logic for both touch (mobile) and mouse (desktop).
  const begin = (x: number) => {
    startX.current = x;
    isDragging.current = true;
    moved.current = false;
  };
  const drag = (x: number) => {
    if (!isDragging.current || startX.current === null) return;
    const diff = x - startX.current;
    if (Math.abs(diff) > 4) moved.current = true;
    if (diff < 0) setOffset(Math.max(diff, -100));
  };
  const finish = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startX.current = null;
    if (offset < -60) {
      setOffset(0);
      onDelete();
    } else {
      setOffset(0);
    }
  };

  const handleClick = () => {
    // A click without a meaningful drag opens the editor (works on desktop + mobile).
    if (!moved.current) onEdit();
  };

  const isPositive = entry.change >= 0;
  const Icon = isPositive ? Icons.ArrowUp : Icons.ArrowDown;
  const iconColorClass = isPositive ? 'text-[#399d74]' : 'text-rose-400';
  const iconBgClass = isPositive ? 'bg-[#399d74]/15' : 'bg-rose-500/10';

  return (
    <div className={`relative overflow-hidden group ${!isLast ? 'border-b border-ink/5' : ''}`}>
      {/* Delete reveal: only as wide as the swipe, so the transparent row never shows red through it */}
      <div
        className={`absolute inset-y-0 right-0 bg-rose-500/15 flex items-center justify-end px-5 transition-opacity duration-200 ${offset < -10 ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: Math.max(0, -offset) }}
      >
        <Icons.Delete className="text-rose-400 shrink-0" size={20} />
      </div>

      <div
        className="relative px-4 py-3.5 flex justify-between items-center gap-3 transition-transform duration-200 ease-out cursor-pointer select-none hover:bg-ink/5"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(e) => begin(e.targetTouches[0].clientX)}
        onTouchMove={(e) => drag(e.targetTouches[0].clientX)}
        onTouchEnd={finish}
        onMouseDown={(e) => begin(e.clientX)}
        onMouseMove={(e) => drag(e.clientX)}
        onMouseUp={finish}
        onMouseLeave={finish}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3 min-w-0 pointer-events-none">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass} ${iconColorClass}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink truncate">
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className={`text-[12px] mt-0.5 tabular-nums ${entry.change >= 0 ? 'text-[#399d74]' : 'text-rose-400'}`}>
              {entry.change > 0 ? '+' : ''}{entry.change.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 pointer-events-none">
          <p className="text-[15px] font-semibold text-ink tabular-nums">
            <Sym code={currency} />{entry.amount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsGroup = ({ title, children }: { title?: string, children?: React.ReactNode }) => (
  <div className="mb-6">
    {title && <h4 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-2 px-2">{title}</h4>}
    <div className="glass-panel rounded-[20px] overflow-hidden shadow-lg">
      {children}
    </div>
  </div>
);

const SettingsItem = ({ 
  icon, 
  label, 
  value, 
  toggle, 
  isToggled, 
  onToggle, 
  onClick, 
  isLast 
}: { 
  icon?: React.ReactNode, 
  label: string, 
  value?: string, 
  toggle?: boolean, 
  isToggled?: boolean, 
  onToggle?: () => void, 
  onClick?: () => void, 
  isLast?: boolean 
}) => (
  <div 
    onClick={!toggle ? onClick : undefined}
    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-ink/5 transition-colors ${!isLast ? 'border-b border-ink/5' : ''}`}
  >
    <div className="flex items-center gap-3">
      {icon && <div className="text-primary">{icon}</div>}
      <span className="text-ink text-sm font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {value && <span className="text-textMuted text-sm">{value}</span>}
      {toggle && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
          role="switch"
          aria-checked={!!isToggled}
          className={`w-11 h-6 rounded-full relative shrink-0 transition-colors duration-200 ${isToggled ? 'bg-textMuted' : 'bg-ink/15'}`}
        >
          {/* Same colors as the active segmented toggles: muted track, black knob when on */}
          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-200 ${isToggled ? 'left-6 bg-paper' : 'left-1 bg-textFaint'}`} />
        </div>
      )}
      {!toggle && <Icons.ChevronRight className="w-4 h-4 text-textFaint" />}
    </div>
  </div>
);

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
};

const STORAGE_KEYS = { assets: 'kaya.assets.v1', settings: 'kaya.settings.v1' };

// Migrate legacy category labels (e.g. old "Equities (US/CAD)" → "Equities").
const normalizeAssets = (arr: Asset[]): Asset[] =>
  (Array.isArray(arr) ? arr : []).map(a =>
    (a.category as string) === 'Equities (US/CAD)' ? { ...a, category: AssetCategory.STOCKS } : a
  );
const DEFAULT_FX_PAIRS = [
  { first: 'USD', second: 'PHP' },
  { first: 'CAD', second: 'PHP' },
  { first: 'USD', second: 'CAD' }
];

// Portfolio Overview palette — Home tokens (secondary, muted, faint) + two in-between greens.
const OVERVIEW_PALETTE = ['#399d74', 'rgb(var(--muted))', 'rgb(var(--faint))', '#2b6b50', '#3f4a44'];

// Auto liquidity by category (cash-like = high, marketable = medium, long-term/locked = low).
// Users can override per asset; DEBT is excluded from liquidity entirely.
const CATEGORY_LIQUIDITY: Record<string, Liquidity> = {
  [AssetCategory.CASH]: 'high',
  [AssetCategory.BANK_PH]: 'high',
  [AssetCategory.BANK_INTL]: 'high',
  [AssetCategory.STOCKS]: 'medium',
  [AssetCategory.CRYPTO]: 'low',
  [AssetCategory.REAL_ESTATE]: 'low',
  [AssetCategory.PENSION]: 'low',
  [AssetCategory.OTHER]: 'medium'
};
const assetLiquidity = (a: Asset): Liquidity => a.liquidity ?? CATEGORY_LIQUIDITY[a.category] ?? 'medium';
// Two-segment split: high+medium count as reachable soon; low is locked.
const isLiquid = (a: Asset): boolean => assetLiquidity(a) !== 'low';
const LAST_ACTIVE_KEY = 'kaya.lastActiveAt';
const readLastActive = () => { try { return parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0', 10) || 0; } catch { return 0; } };
const writeLastActive = () => { try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {} };

const LOCK_DELAY_OPTIONS = [
  { sec: 0, label: 'Immediately' },
  { sec: 60, label: 'After 1 minute' },
  { sec: 300, label: 'After 5 minutes' },
  { sec: 900, label: 'After 15 minutes' }
];

// AI insights are off until they run through a secure server-side proxy (planned
// premium feature). Flipping this to true also requires the Edge Function + key.
const AI_INSIGHTS_ENABLED = false;
// Portfolio page: passive-income summary card under Overview (hidden for now, not removed).
const SHOW_PORTFOLIO_INCOME_CARD = false;

const SYNC_KEY = 'kaya.syncedAt';
const getSyncedAt = () => { try { return localStorage.getItem(SYNC_KEY) || ''; } catch { return ''; } };
const setSyncedAt = (t: string) => { try { localStorage.setItem(SYNC_KEY, t); } catch {} };

// Which signed-in user the locally-cached data belongs to. Prevents one account's
// data from leaking into another when accounts are switched on the same device.
const OWNER_KEY = 'kaya.ownerId';
const getOwner = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch { return ''; } };
// True when this device may already be signed in (Supabase keeps the session in
// localStorage as "sb-<project>-auth-token"), or when we're landing back from a sign-in
// link. Used so logged-out visitors see the landing page at once instead of the splash.
const maybeSignedIn = (() => {
  try {
    if (/[#&?](access_token|code|token_hash)=/.test(window.location.href)) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (/^sb-.*-auth-token$/.test(k)) return true;
    }
  } catch { /* storage blocked: fall back to waiting for auth */ return true; }
  return false;
})();
const setOwner = (id: string) => { try { localStorage.setItem(OWNER_KEY, id); } catch {} };

const DEFAULT_SETTINGS: UserSettings = {
  displayCurrency: Currency.PHP,
  showInBTC: false,
  onboardingComplete: true,
  streakDays: 0,
  lastLogin: new Date().toISOString()
};

// Build an ISO timestamp from a YYYY-MM-DD date, attaching a time-of-day so
// multiple entries on the same date keep a stable, log-order sort.
// Anchored to the LOCAL calendar date so the stored instant renders back to the
// same day the user picked (avoids timezone off-by-one). `preserveFrom` keeps
// an existing entry's time-of-day when only its date is edited.
const isoFromDate = (dateStr: string, preserveFrom?: string) => {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const t = preserveFrom ? new Date(preserveFrom) : new Date();
  return new Date(y, (m || 1) - 1, d || 1, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).toISOString();
};

// Today's date as YYYY-MM-DD in the user's LOCAL timezone (not UTC), so the date
// picker defaults to the day the user actually sees on the calendar.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A stored ISO timestamp → YYYY-MM-DD in LOCAL time, so editing an entry shows
// the same day the list shows (not the UTC date, which can be a day off).
const localDateFromISO = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

// Recompute an asset's current balance, lastUpdated, and each entry's change
// from its history. Keeps everything consistent after add/edit/delete, even
// when entries are back-dated.
const recomputeAsset = (asset: Asset, history: AssetHistoryEntry[]): Asset => {
  const asc = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let prev = 0;
  const withChange = asc.map((h, i) => {
    const change = i === 0 ? h.amount : h.amount - prev;
    prev = h.amount;
    return { ...h, change };
  });
  const desc = withChange.slice().reverse(); // newest first for display
  const latest = desc[0];
  return {
    ...asset,
    history: desc,
    amount: latest ? latest.amount : 0,
    lastUpdated: latest ? latest.date : asset.lastUpdated
  };
};

export default function App() {
  // New users start empty (clean empty states), not with sample data.
  // Existing data is read from local storage / cloud, so this only affects fresh accounts.
  const [assets, setAssets] = useState<Asset[]>(() => normalizeAssets(loadStored<Asset[]>(STORAGE_KEYS.assets, [])));
  const [income, setIncome] = useState<IncomeRecord[]>(() => loadStored<IncomeRecord[]>('kaya.income.v1', []));
  const [liveRates, setLiveRates] = useState<Record<string, number>>({});
  const [btcUsd, setBtcUsd] = useState<number>(BTC_PRICE_USD);
  const [fxHistory, setFxHistory] = useState<FxHistory | null>(null);

  // Fetch live FX once on load (cached daily; falls back to static rates offline).
  useEffect(() => {
    let active = true;
    getLiveRates().then(snap => {
      if (!active || !snap) return;
      if (snap.rates) setLiveRates(snap.rates);
      if (snap.btcUsd) setBtcUsd(snap.btcUsd);
    });
    return () => { active = false; };
  }, []);

  // Merged rate table (units of currency per 1 USD): live where available,
  // static fallback otherwise, BTC derived from its live USD price.
  const rates = useMemo<Record<string, number>>(() => ({
    ...RATES,
    ...liveRates,
    BTC: btcUsd ? 1 / btcUsd : RATES.BTC
  }), [liveRates, btcUsd]);
  const [settings, setSettings] = useState<UserSettings>(() => loadStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS));

  // Persist data locally so real entries survive reloads.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assets)); } catch {}
  }, [assets]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)); } catch {}
  }, [settings]);
  useEffect(() => {
    try { localStorage.setItem('kaya.income.v1', JSON.stringify(income)); } catch {}
  }, [income]);

  // Weekly FX history for the rate sparklines (cached daily).
  useEffect(() => {
    const pairs = (settings.fxPairs && settings.fxPairs.length) ? settings.fxPairs : DEFAULT_FX_PAIRS;
    const codes = pairs.flatMap(p => [p.first, p.second]);
    getFxWeekly(codes).then(h => { if (h) setFxHistory(h); });
  }, [settings.fxPairs]);

  // --- Supabase auth + cloud sync (no-op unless env keys are set) ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseEnabled);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudError, setCloudError] = useState(false); // cloud unreachable; load is retrying

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    let settled = false;
    // Mark auth "resolved" only once we get a definitive answer, so we never
    // flash the login screen during the brief session-restore window on reload.
    const settle = (s: Session | null) => {
      setSession(s);
      if (!settled) { settled = true; setAuthLoading(false); }
    };
    // onAuthStateChange emits an INITIAL_SESSION event with the restored
    // session — use that as the source of truth for the first paint.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      settle(s);
      if (!s) setCloudLoaded(false);
    });
    // Safety net in case the listener is slow to emit.
    const t = setTimeout(() => {
      if (!settled) supabase!.auth.getSession().then(({ data }) => settle(data.session));
    }, 1500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  // On login: reconcile local vs cloud WITHOUT clobbering newer local data.
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !session) return;
    let active = true;
    const uid = session.user.id;

    const pushLocal = async () => {
      const now = new Date().toISOString();
      await supabase!.from('kaya_data').upsert({ user_id: uid, data: { assets, income, settings }, updated_at: now });
      setSyncedAt(now);
    };
    const adopt = (d: any, cloudUpdated: string) => {
      if (Array.isArray(d.assets)) setAssets(normalizeAssets(d.assets));
      if (Array.isArray(d.income)) setIncome(d.income);
      if (d.settings) setSettings(d.settings);
      setSyncedAt(cloudUpdated);
    };

    (async () => {
      // Retry until the cloud actually answers. A failed request must NEVER be read as
      // "no row" — that would treat an existing user as brand new and overwrite their data.
      let data: any = null;
      for (let attempt = 0; ; attempt++) {
        const res = await supabase!.from('kaya_data').select('data, updated_at').eq('user_id', uid).maybeSingle();
        if (!active) return;
        if (!res.error) { data = res.data; break; }
        setCloudError(true);
        await new Promise(r => setTimeout(r, Math.min(15000, 1500 * 2 ** attempt)));
        if (!active) return;
      }
      setCloudError(false);

      // Trust local cache ONLY if it belongs to this exact user. Anything else
      // (different account, or an untagged stale cache) is not carried over —
      // we load this user's own cloud, or start empty. (The app requires sign-in
      // to enter data, so genuine local data always has a matching owner.)
      const accountSwitch = getOwner() !== uid;

      if (accountSwitch) {
        // A different/untagged account on this device. NEVER carry local data over —
        // adopt this user's own cloud, or start empty.
        const now = new Date().toISOString();
        if (data?.data) {
          adopt(data.data, data.updated_at || now);
        } else {
          // Brand-new account (no cloud row): start empty and show onboarding once.
          const fresh = { ...DEFAULT_SETTINGS, onboardingComplete: false };
          setAssets([]); setIncome([]); setSettings(fresh); setSyncedAt(now);
          await supabase!.from('kaya_data').upsert({ user_id: uid, data: { assets: [], income: [], settings: fresh }, updated_at: now });
        }
      } else if (!data) {
        await pushLocal();                       // no cloud row yet → seed from local
      } else {
        const d: any = data.data || {};
        const cloudUpdated: string = data.updated_at || '';
        const localSynced = getSyncedAt();
        if (!localSynced) {
          // First reconcile under this logic: trust whichever side has more data.
          const localCount = assets.length + income.length;
          const cloudCount = (d.assets?.length || 0) + (d.income?.length || 0);
          if (cloudCount >= localCount) adopt(d, cloudUpdated);
          else await pushLocal();
        } else if (cloudUpdated > localSynced) {
          adopt(d, cloudUpdated);                // cloud changed elsewhere → adopt
        } else {
          await pushLocal();                     // local is newer/equal → keep + push
        }
      }
      setOwner(uid);
      if (active) setCloudLoaded(true);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Push changes to the cloud (debounced) once the initial load is done.
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !session || !cloudLoaded) return;
    const t = setTimeout(() => {
      const now = new Date().toISOString();
      supabase!.from('kaya_data')
        .upsert({ user_id: session.user.id, data: { assets, income, settings }, updated_at: now })
        .then(() => setSyncedAt(now));
    }, 800);
    return () => clearTimeout(t);
  }, [assets, income, settings, session, cloudLoaded]);

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    // Clear this account's local data so the next sign-in starts from their own cloud.
    try {
      localStorage.removeItem(STORAGE_KEYS.assets);
      localStorage.removeItem('kaya.income.v1');
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(SYNC_KEY);
      localStorage.removeItem(OWNER_KEY);
      localStorage.removeItem('kaya.security.v1');     // PIN / recovery / biometric
      localStorage.removeItem('kaya.portfolio.sort');  // view prefs
      localStorage.removeItem('kaya.portfolio.catFilter');
      localStorage.removeItem('kaya.portfolio.curFilter');
    } catch {}
    setAssets([]); setIncome([]); setSettings(DEFAULT_SETTINGS); setCloudLoaded(false);
    setSecurity({ pin: null, biometric: false, biometricId: null, recoveryHash: null, lockDelaySec: 0 });
    setActiveTab('HOME'); // always return to the main page on next sign-in
  };

  // Feedback → Supabase if available, else fall back to an email draft.
  const FEEDBACK_EMAIL = 'designer@jasonangeles.com';
  const submitFeedback = async () => {
    const msg = feedbackText.trim();
    if (!msg) return;
    if (fbHoney.current?.value) { setFeedbackText(''); setFeedbackStatus('sent'); return; } // bot — drop silently
    setFeedbackStatus('sending');
    try {
      if (isSupabaseEnabled && supabase) {
        const { error } = await supabase.from('kaya_feedback').insert({ user_id: session?.user.id ?? null, message: msg });
        if (error) throw error;
      } else {
        window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Kaya feedback')}&body=${encodeURIComponent(msg)}`;
      }
    } catch {
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Kaya feedback')}&body=${encodeURIComponent(msg)}`;
    }
    setFeedbackText('');
    setFeedbackStatus('sent');
  };

  // Contact → Supabase only (never exposes the owner's email to the client).
  const submitContact = async () => {
    const msg = contactText.trim();
    if (!msg) return;
    if (contactHoney.current?.value) { setContactText(''); setContactEmail(''); setContactStatus('sent'); return; } // bot — drop silently
    setContactStatus('sending');
    try {
      if (!supabase) { setContactStatus('error'); return; }
      const reply = contactEmail.trim();
      const tagged = `[Contact]${reply ? ` reply-to: ${reply}` : ''}\n${msg}`;
      const { error } = await supabase.from('kaya_feedback').insert({ user_id: session?.user.id ?? null, message: tagged });
      if (error) { setContactStatus('error'); return; }
      setContactText(''); setContactEmail(''); setContactStatus('sent');
    } catch { setContactStatus('error'); }
  };
  
  const [activeTab, setActiveTab] = useState<'HOME' | 'ASSETS' | 'INCOME' | 'SETTINGS' | 'SETTINGS_CURRENCY'>('HOME');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1M');
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);
  const [historySwipeHintShown, setHistorySwipeHintShown] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalCategory, setModalCategory] = useState<AssetCategory>(AssetCategory.BANK_PH);
  const [modalCurrency, setModalCurrency] = useState<string>(Currency.PHP);
  const [updateType, setUpdateType] = useState<'TRANSACTION' | 'MARKET'>('TRANSACTION');
  const [updateDate, setUpdateDate] = useState(todayLocal());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [incomeAddTick, setIncomeAddTick] = useState(0);
  const [showFxEdit, setShowFxEdit] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showContact, setShowContact] = useState(false);
  const [contactText, setContactText] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  // Honeypots — hidden fields only bots fill; if filled we silently drop the submit.
  const fbHoney = useRef<HTMLInputElement>(null);
  const contactHoney = useRef<HTMLInputElement>(null);
  const [allocMode, setAllocMode] = useState<'TYPE' | 'CURRENCY'>('TYPE');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'CATEGORY' | 'VALUE' | 'UPDATED' | 'LIQUIDITY'>(() => loadStored<'CATEGORY' | 'VALUE' | 'UPDATED' | 'LIQUIDITY'>('kaya.portfolio.sort', 'CATEGORY'));
  const [catFilter, setCatFilter] = useState<AssetCategory[]>(() => loadStored<AssetCategory[]>('kaya.portfolio.catFilter', []));
  const [curFilter, setCurFilter] = useState<string[]>(() => loadStored<string[]>('kaya.portfolio.curFilter', []));
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [fxDraft, setFxDraft] = useState<{ first: string; second: string }[]>(DEFAULT_FX_PAIRS);
  const mainRef = useRef<HTMLElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [lastDeletedAsset, setLastDeletedAsset] = useState<Asset | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const insightsMouseDown = useRef(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Appearance (light / dark). The no-flash script in index.html applies the
  // saved theme before paint; here we just keep state + toggle in sync.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('kaya.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('kaya.theme', next); } catch {}
      document.documentElement.classList.toggle('light', next === 'light');
      return next;
    });
  };

  // Security: PIN + optional biometric unlock, persisted locally.
  const [security, setSecurity] = useState<{ pin: string | null; biometric: boolean; biometricId: string | null; recoveryHash: string | null; lockDelaySec?: number }>(
    () => loadStored('kaya.security.v1', { pin: null, biometric: false, biometricId: null, recoveryHash: null, lockDelaySec: 0 })
  );
  const [locked, setLocked] = useState<boolean>(() => {
    const sec = loadStored<{ pin: string | null; lockDelaySec?: number }>('kaya.security.v1', { pin: null });
    if (!sec.pin) return false;
    const delayMs = (sec.lockDelaySec || 0) * 1000;
    const last = readLastActive();
    return !(last && Date.now() - last <= delayMs); // stay unlocked if reopened within the grace window
  });
  const [showSetPin, setShowSetPin] = useState(false);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem('kaya.security.v1', JSON.stringify(security)); } catch {}
  }, [security]);

  // Track "last active" and only re-lock after the configured grace period.
  useEffect(() => {
    if (!security.pin) return;
    writeLastActive();
    const delayMs = (security.lockDelaySec || 0) * 1000;
    const heartbeat = setInterval(() => { if (document.visibilityState === 'visible') writeLastActive(); }, 10000);
    const onHide = () => writeLastActive();
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        writeLastActive();
      } else {
        const last = readLastActive();
        if (last && Date.now() - last > delayMs) setLocked(true);
      }
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [security.pin, security.lockDelaySec]);

  const handleToggleAppLock = () => {
    if (security.pin) {
      if (window.confirm('Turn off App Lock and remove your PIN?')) {
        setSecurity({ pin: null, biometric: false, biometricId: null, recoveryHash: null });
      }
    } else {
      setShowSetPin(true);
    }
  };
  const handleChangePin = () => setShowSetPin(true);
  const handleSetLockDelay = (sec: number) => { setSecurity(s => ({ ...s, lockDelaySec: sec })); setShowAutoLock(false); };
  const lockDelayLabel = (LOCK_DELAY_OPTIONS.find(o => o.sec === (security.lockDelaySec || 0)) || LOCK_DELAY_OPTIONS[0]).label;
  const handleSetPin = async (hash: string) => {
    setShowSetPin(false);
    if (!security.recoveryHash) {
      // First time enabling: generate a one-time recovery code.
      const code = generateRecoveryCode();
      const rHash = await hashRecoveryCode(code);
      setSecurity(s => ({ ...s, pin: hash, recoveryHash: rHash }));
      setRecoveryCode(code);
    } else {
      setSecurity(s => ({ ...s, pin: hash }));
    }
  };
  const handleRecovered = () => {
    // Correct recovery code: unlock and let the user set a fresh PIN.
    setShowRecovery(false);
    setLocked(false);
    setShowSetPin(true);
  };
  const handleToggleBiometric = async () => {
    if (!security.pin) { window.alert('Set a PIN first, then you can enable biometric unlock.'); return; }
    if (security.biometric) { setSecurity(s => ({ ...s, biometric: false, biometricId: null })); return; }
    const available = await isBiometricAvailable();
    if (!available) {
      window.alert('Biometric unlock isn’t available here. On iPhone, add Kaya to your Home Screen and open it from there, then try again.');
      return;
    }
    const id = await registerBiometric();
    if (id) setSecurity(s => ({ ...s, biometric: true, biometricId: id }));
    else window.alert('Could not set up biometric unlock. You can still use your PIN.');
  };

  const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);
  const editingEntry = useMemo(() => selectedAsset?.history.find(h => h.id === editingEntryId) || null, [selectedAsset, editingEntryId]);
  // A trend needs at least two balance updates on different days. Before that, the line would only
  // move with exchange rates, which reads like history that isn't there yet.
  const hasTrend = useMemo(() => new Set(assets.flatMap(a => (a.history || []).map(h => String(h.date).slice(0, 10)))).size >= 2, [assets]);
  const historyData = useMemo(
    () => buildNetWorthSeries(assets, selectedTimeRange, rates, btcUsd, settings.displayCurrency),
    [assets, selectedTimeRange, rates, btcUsd, settings.displayCurrency]
  );

  // Real % change over the selected range (first non-zero point → latest).
  const netChange = useMemo(() => {
    const vals = historyData.map(p => p.totalValueDisplay || 0);
    const first = vals.find(v => v > 0);
    const last = vals[vals.length - 1];
    if (!first || last == null) return null;
    return ((last - first) / first) * 100;
  }, [historyData]);

  const rangeLabel: Record<TimeRange, string> = {
    '1D': 'today', '1W': 'past week', '1M': 'past month', '3M': 'past 3 months',
    'YTD': 'year to date', '1Y': 'past year', 'ALL': 'all time'
  };
  
  const assetHistoryData = useMemo(() => {
    if (!selectedAsset) return [];
    const now = new Date();
    const cutoff = new Date();
    switch(selectedTimeRange) {
        case '1D': cutoff.setHours(now.getHours() - 24); break;
        case '1W': cutoff.setDate(now.getDate() - 7); break;
        case '1M': cutoff.setDate(now.getDate() - 30); break;
        case '3M': cutoff.setDate(now.getDate() - 90); break;
        case 'YTD': cutoff.setMonth(0, 1); break;
        case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': cutoff.setFullYear(now.getFullYear() - 10); break;
    }

    return selectedAsset.history
        .filter(h => new Date(h.date) >= cutoff)
        .map(h => ({
            // The asset detail chart shows the balance in the asset's own currency.
            date: h.date,
            totalValueUSD: h.amount / (rates[selectedAsset.currency] || 1),
            totalValuePHP: 0,
            totalValueBTC: h.amount,
            totalValueDisplay: h.amount,
            btcPrice: 0,
            inflationIndex: 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedAsset, selectedTimeRange, rates]);

  // Net worth = assets minus liabilities. DEBT subtracts; excluded assets don't count.
  const totalValueUSD = useMemo(() => {
    return assets.reduce((acc, a) => {
      if (a.excluded) return acc;
      const v = a.amount / (rates[a.currency] || 1);
      return a.category === AssetCategory.DEBT ? acc - v : acc + v;
    }, 0);
  }, [assets, rates]);

  const totalValueParts = useMemo(() => {
    if (privacyMode) return { symbol: '', value: '••••••' };
    const display = settings.displayCurrency;
    // BTC needs its own formatting (Intl currency would round it to 0.00).
    if (display === Currency.BTC) {
      const btc = btcUsd ? totalValueUSD / btcUsd : 0;
      return { symbol: '₿', value: btc.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 }) };
    }
    const val = display === Currency.USD ? totalValueUSD : totalValueUSD * (rates[display] || 1);
    const parts = new Intl.NumberFormat('en-PH', { style: 'currency', currency: display }).formatToParts(val);
    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    const value = parts
      .filter(p => p.type !== 'currency' && p.type !== 'literal')
      .map(p => p.value)
      .join('');
    return { symbol, value };
  }, [totalValueUSD, settings.displayCurrency, privacyMode, rates, btcUsd]);

  // ---- Chart scrubbing: the header keeps its layout; only the numbers (and a date) change ----
  const [homeScrub, setHomeScrub] = useState<ChartScrub>(null);
  const [assetScrub, setAssetScrub] = useState<ChartScrub>(null);
  useEffect(() => { setHomeScrub(null); setAssetScrub(null); }, [selectedTimeRange, settings.displayCurrency, selectedAssetId]);

  // Split a value that's already in `code` into { symbol, value } like totalValueParts.
  const partsFor = (val: number, code: string) => {
    if (privacyMode) return { symbol: '', value: '••••••' };
    if (code === Currency.BTC) return { symbol: '₿', value: val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 }) };
    try {
      const parts = new Intl.NumberFormat('en-PH', { style: 'currency', currency: code }).formatToParts(val);
      return {
        symbol: parts.find(p => p.type === 'currency')?.value || '',
        value: parts.filter(p => p.type !== 'currency' && p.type !== 'literal').map(p => p.value).join(''),
      };
    } catch { return { symbol: '', value: Math.round(val).toLocaleString() }; }
  };
  const scrubDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return selectedTimeRange === '1D'
      ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const shortDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  // Home headline: live total normally; the scrubbed point while dragging.
  const homeParts = homeScrub ? partsFor(homeScrub.value, settings.displayCurrency) : totalValueParts;
  const homeChange = useMemo(() => {
    if (!homeScrub) return netChange === null ? null : { pct: netChange, label: rangeLabel[selectedTimeRange] };
    const firstIdx = historyData.findIndex(p => (p.totalValueDisplay || 0) > 0);
    if (firstIdx < 0) return null;
    const first = historyData[firstIdx].totalValueDisplay || 0;
    const cur = homeScrub.point.totalValueDisplay || 0;
    return { pct: ((cur - first) / first) * 100, label: `since ${shortDate(historyData[firstIdx].date)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeScrub, netChange, historyData, selectedTimeRange]);

  const topAssets = useMemo(() => {
    return assets
      .filter(a => !a.excluded && a.category !== AssetCategory.DEBT)
      .sort((a, b) => {
        const getVal = (asset: Asset) => asset.amount / (rates[asset.currency] || 1);
        return getVal(b) - getVal(a);
      })
      .slice(0, 3);
  }, [assets, rates]);

  // The live streak (in months) — 0 (hidden) if the last logged month is older
  // than last month (i.e., a full month was skipped).
  const currentStreak = useMemo(() => {
    if (!settings.lastStreakMonth || !settings.streakDays) return 0;
    const [py, pm] = settings.lastStreakMonth.split('-').map(Number);
    const now = new Date();
    const diff = (now.getFullYear() - py) * 12 + (now.getMonth() + 1 - pm);
    return diff <= 1 ? settings.streakDays : 0;
  }, [settings.lastStreakMonth, settings.streakDays]);

  // Net-worth allocation by asset type or by currency (positive holdings only).
  const allocation = useMemo(() => {
    const usdOf = (a: Asset) => a.amount / (rates[a.currency] || 1);
    const map = new Map<string, number>();
    assets.filter(a => a.category !== AssetCategory.DEBT && a.amount > 0 && !a.excluded).forEach(a => {
      const key = allocMode === 'TYPE' ? a.category : a.currency;
      map.set(key, (map.get(key) || 0) + usdOf(a));
    });
    const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
    let entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    // Keep the palette to five shades: fold everything past the top four into "Others".
    if (entries.length > OVERVIEW_PALETTE.length) {
      const head = entries.slice(0, OVERVIEW_PALETTE.length - 1);
      const rest = entries.slice(OVERVIEW_PALETTE.length - 1).reduce((s, [, v]) => s + v, 0);
      entries = [...head, ['Others', rest]];
    }
    // Colors follow rank (largest = brightest), using the Home palette only.
    return entries.map(([key, usd], i) => ({
      key,
      pct: (usd / total) * 100,
      usd,
      color: OVERVIEW_PALETTE[i % OVERVIEW_PALETTE.length],
    }));
  }, [assets, rates, allocMode]);

  const fmtDisplay = (usd: number) => {
    const display = settings.displayCurrency;
    if (display === Currency.BTC) return `₿${(btcUsd ? usd / btcUsd : 0).toFixed(4)}`;
    return `${getCurrencySymbol(display)}${Math.round(usd * (rates[display] || 1)).toLocaleString()}`;
  };
  // Short form for tight spots (₱1.97M, ₱125K).
  const fmtCompact = (usd: number) => {
    const display = settings.displayCurrency;
    if (display === Currency.BTC) return `₿${(btcUsd ? usd / btcUsd : 0).toFixed(3)}`;
    const v = usd * (rates[display] || 1);
    return `${getCurrencySymbol(display)}${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.abs(v) >= 1e6 ? 2 : 1 }).format(v)}`;
  };

  // Liquidity split (liquid vs locked) + gross assets and liabilities, all in USD base.
  const liquidityBreakdown = useMemo(() => {
    const usdOf = (a: Asset) => a.amount / (rates[a.currency] || 1);
    let liquid = 0, locked = 0, liabilities = 0;
    assets.forEach(a => {
      if (a.excluded) return;
      if (a.category === AssetCategory.DEBT) { liabilities += usdOf(a); return; }
      if (a.amount <= 0) return;
      if (isLiquid(a)) liquid += usdOf(a); else locked += usdOf(a);
    });
    const assetsTotal = liquid + locked;
    return { liquid, locked, liabilities, assetsTotal, net: assetsTotal - liabilities };
  }, [assets, rates]);

  // Portfolio filter + sort.
  const portfolioCurrencies = useMemo(() => Array.from(new Set(assets.map(a => a.currency))), [assets]);
  const filteredAssets = useMemo(() => assets.filter(a =>
    (catFilter.length === 0 || catFilter.includes(a.category)) &&
    (curFilter.length === 0 || curFilter.includes(a.currency))
  ), [assets, catFilter, curFilter]);
  // Excluded assets are parked in their own collapsed section, out of the main list and all totals.
  const mainAssets = useMemo(() => filteredAssets.filter(a => !a.excluded), [filteredAssets]);
  const excludedAssets = useMemo(() => filteredAssets.filter(a => a.excluded), [filteredAssets]);
  const sortedFlat = useMemo(() => {
    const usd = (a: Asset) => a.amount / (rates[a.currency] || 1);
    const liqRank = (a: Asset) => a.category === AssetCategory.DEBT ? 3 : ({ high: 0, medium: 1, low: 2 }[assetLiquidity(a)]);
    const arr = [...mainAssets];
    if (sortMode === 'VALUE') arr.sort((a, b) => usd(b) - usd(a));
    else if (sortMode === 'UPDATED') arr.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    else if (sortMode === 'LIQUIDITY') arr.sort((a, b) => liqRank(a) - liqRank(b) || usd(b) - usd(a));
    return arr;
  }, [mainAssets, sortMode, rates]);
  const filtersActive = catFilter.length > 0 || curFilter.length > 0 || sortMode !== 'CATEGORY';
  // Filtered subtotal (only when a category/currency filter is actually narrowing the list).
  const filteredSubtotal = useMemo(() => {
    if (catFilter.length === 0 && curFilter.length === 0) return null;
    const usd = mainAssets.reduce((s, a) => {
      const u = a.amount / (rates[a.currency] || 1);
      return a.category === AssetCategory.DEBT ? s - u : s + u;
    }, 0);
    const net = liquidityBreakdown.net;
    return { usd, pct: net > 0 ? (usd / net) * 100 : null, count: mainAssets.length };
  }, [mainAssets, catFilter, curFilter, rates, liquidityBreakdown.net]);
  const toggleCat = (c: AssetCategory) => setCatFilter(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleCur = (c: string) => setCurFilter(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const resetFilters = () => { setSortMode('CATEGORY'); setCatFilter([]); setCurFilter([]); };
  // Remember the user's sort/filter across refreshes (per-device view preference).
  useEffect(() => {
    try {
      localStorage.setItem('kaya.portfolio.sort', JSON.stringify(sortMode));
      localStorage.setItem('kaya.portfolio.catFilter', JSON.stringify(catFilter));
      localStorage.setItem('kaya.portfolio.curFilter', JSON.stringify(curFilter));
    } catch {}
  }, [sortMode, catFilter, curFilter]);

  // Passive income received in the last 12 months, in the display currency.
  // Informational only — deliberately NOT added to net worth (avoids double-counting).
  const passiveIncome12mo = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const display = settings.displayCurrency;
    return income
      .filter(r => new Date(r.date) >= cutoff)
      .reduce((sum, r) => {
        const usd = r.amount / (r.rateUsd || rates[r.currency] || 1); // locked source rate
        return sum + usd * (rates[display] || 1);
      }, 0);
  }, [income, settings.displayCurrency, rates]);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!AI_INSIGHTS_ENABLED || assets.length === 0) { setInsights([]); setIsLoadingInsights(false); return; }
      setIsLoadingInsights(true);
      const totalPHP = totalValueUSD * RATES.PHP;
      const tips = await getWealthInsights(assets, totalPHP);
      setInsights(tips);
      setIsLoadingInsights(false);
    };
    fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length === 0]);
  
  useEffect(() => {
    if (selectedAsset && !historySwipeHintShown) {
        const timer = setTimeout(() => {
            setHistorySwipeHintShown(true);
        }, 1500);
        return () => clearTimeout(timer);
    }
  }, [selectedAsset, historySwipeHintShown]);

  const handleOpenAddAsset = () => {
    setSelectedAssetId(null);
    setIsEditMode(false);
    setModalCategory(AssetCategory.BANK_PH);
    setModalCurrency(Currency.PHP);
    setIsModalOpen(true);
  };

  // Same sheet, opened straight on the Debt side (from the Portfolio "Add a loan or credit card" row).
  const handleOpenAddDebt = () => {
    handleOpenAddAsset();
    setModalCategory(AssetCategory.DEBT);
  };

  const handleOpenUpdateBalance = () => {
    setIsEditMode(false);
    setEditingEntryId(null);
    setUpdateDate(todayLocal());
    setIsModalOpen(true);
  };

  const handleOpenEditHistoryEntry = (entry: AssetHistoryEntry) => {
    setIsEditMode(false);
    setEditingEntryId(entry.id);
    setUpdateDate(localDateFromISO(entry.date));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntryId(null);
  };

  const handleOpenEditAssetDetails = (asset: Asset) => {
    setIsEditMode(true); 
    setModalCategory(asset.category);
    setModalCurrency(asset.currency);
    setIsModalOpen(true);
  };

  // Onboarding finished: save profile picks, create picked accounts at 0 (balances later).
  const handleOnboardingFinish = (r: OnboardingResult) => {
    const now = new Date().toISOString();
    const stamp = Date.now();
    const newAssets: Asset[] = r.accounts.map((p, i) => ({
      id: `${stamp}-${i}`,
      name: p.name,
      category: p.category,
      institution: p.institution,
      amount: 0,
      currency: p.currency,
      lastUpdated: now,
      history: [],
    }));
    if (newAssets.length) setAssets(prev => [...prev, ...newAssets]);
    setSettings(prev => ({
      ...prev,
      displayCurrency: r.displayCurrency,
      homeCountries: r.countries,
      goals: r.goals,
      onboardingComplete: true,
      onboardedAt: now,
    }));
    setActiveTab(newAssets.length || r.wantsCustom ? 'ASSETS' : 'HOME');
    if (r.wantsCustom) setTimeout(() => handleOpenAddAsset(), 350);
  };

  const handleSaveAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Dismiss any open native date/select picker so it can't orphan over the closing modal.
    (document.activeElement as HTMLElement | null)?.blur();
    const formData = new FormData(e.currentTarget);
    
    if (selectedAsset && !isEditMode) {
        const newAmount = parseFloat(formData.get('amount') as string);
        const dateStr = formData.get('date') as string;
        let history: AssetHistoryEntry[];
        if (editingEntryId) {
            // Edit an existing saved entry; keep its original time-of-day for stable order.
            history = selectedAsset.history.map(h =>
                h.id === editingEntryId ? { ...h, amount: newAmount, date: isoFromDate(dateStr, h.date) } : h
            );
        } else {
            // Add a new balance entry, stamped with the current time-of-day.
            const newEntry: AssetHistoryEntry = {
                id: Date.now().toString(),
                date: isoFromDate(dateStr),
                amount: newAmount,
                change: 0,
                type: updateType,
                rateUsd: rates[selectedAsset.currency]
            };
            history = [newEntry, ...selectedAsset.history];
        }
        const updatedAsset = recomputeAsset(selectedAsset, history);
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
        if (!editingEntryId) registerStreakActivity(); // adding a balance counts
        setEditingEntryId(null);
    } else {
        const liqRaw = formData.get('liquidity') as string;
        const liquidity = (liqRaw === 'high' || liqRaw === 'medium' || liqRaw === 'low') ? (liqRaw as Liquidity) : undefined;
        const assetData = {
            name: formData.get('name') as string,
            category: formData.get('category') as AssetCategory,
            institution: formData.get('institution') as string,
            liquidity,
            excluded: formData.get('excluded') === 'on',
        };
        if (selectedAsset && isEditMode) {
             setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, ...assetData } : a));
        } else {
            const amount = parseFloat(formData.get('amount') as string);
            const currency = formData.get('currency') as string;
            const newAsset: Asset = {
                id: Date.now().toString(),
                ...assetData,
                amount: amount,
                currency: currency,
                lastUpdated: new Date().toISOString(),
                history: [
                    {
                        id: Date.now().toString(),
                        date: new Date().toISOString(),
                        amount: amount,
                        change: amount,
                        type: 'TRANSACTION',
                        note: 'Initial Entry',
                        rateUsd: rates[currency]
                    }
                ]
            };
            setAssets(prev => [...prev, newAsset]);
            registerStreakActivity(); // adding a new asset counts
        }
    }
    setIsModalOpen(false);
  };

  const handleDeleteAsset = () => {
    if (!selectedAsset) return;
    setLastDeletedAsset(selectedAsset);
    setAssets(prev => prev.filter(a => a.id !== selectedAsset.id));
    setSelectedAssetId(null);
    setIsModalOpen(false);
    setShowUndoToast(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setLastDeletedAsset(null);
    }, 8000);
  };
  
  const handleDeleteHistoryEntry = (entryId: string) => {
    if (!selectedAsset) return;
    const updatedHistory = selectedAsset.history.filter(h => h.id !== entryId);
    const updatedAsset = recomputeAsset(selectedAsset, updatedHistory);
    setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
  };

  const handleUndoDelete = () => {
    if (!lastDeletedAsset) return;
    setAssets(prev => [...prev, lastDeletedAsset]);
    setShowUndoToast(false);
    setLastDeletedAsset(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  };

  const handleCurrencySelect = (currency: string) => {
    setSettings(prev => ({ ...prev, displayCurrency: currency }));
    setIsCurrencyDropdownOpen(false);
  };

  // --- Currency rates widget ---
  const fxPairs = (settings.fxPairs && settings.fxPairs.length) ? settings.fxPairs : DEFAULT_FX_PAIRS;
  const fxRate = (first: string, second: string): string => {
    const rf = rates[first];
    const rs = rates[second];
    if (!rf || !rs) return '—';
    const r = rs / rf; // how many `second` per 1 `first`
    if (!isFinite(r) || r <= 0) return '—';
    return r >= 1 ? r.toFixed(2) : r.toFixed(4);
  };
  // Weekly cross-rate series + % change for a pair (null if no history, e.g. BTC).
  const fxWeeklyFor = (first: string, second: string): { series: number[]; change: number } | null => {
    if (!fxHistory) return null;
    const a = fxHistory.perUsd[first], b = fxHistory.perUsd[second];
    if (!a || !b || a.length < 2 || b.length < 2) return null;
    const n = Math.min(a.length, b.length);
    const series: number[] = [];
    for (let i = 0; i < n; i++) { const v = b[i] / a[i]; if (isFinite(v) && v > 0) series.push(v); }
    if (series.length < 2) return null;
    const change = ((series[series.length - 1] - series[0]) / series[0]) * 100;
    return { series, change };
  };
  const openFxEdit = () => { setFxDraft(fxPairs.map(p => ({ ...p }))); setShowFxEdit(true); };
  const updateFxDraft = (i: number, key: 'first' | 'second', code: string) =>
    setFxDraft(prev => prev.map((p, idx) => idx === i ? { ...p, [key]: code } : p));
  const saveFx = () => { setSettings(prev => ({ ...prev, fxPairs: fxDraft })); setShowFxEdit(false); };

  // Count a month toward the streak when the user logs activity (add asset, add
  // balance, or add income). Repeats within a month don't double-count; skipping
  // a whole month resets it. Fits the monthly cadence of wealth tracking.
  const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const registerStreakActivity = () => {
    const mk = monthKeyOf(new Date());
    setSettings(prev => {
      if (prev.lastStreakMonth === mk) return prev;
      let count = 1;
      if (prev.lastStreakMonth) {
        const [py, pm] = prev.lastStreakMonth.split('-').map(Number);
        const now = new Date();
        const diff = (now.getFullYear() - py) * 12 + (now.getMonth() + 1 - pm);
        count = diff === 1 ? (prev.streakDays || 0) + 1 : 1;
      }
      return { ...prev, streakDays: count, lastStreakMonth: mk };
    });
  };

  const handleClearData = () => {
    const ok = window.confirm('Remove all assets and start with an empty tracker? This cannot be undone.');
    if (!ok) return;
    setSelectedAssetId(null);
    setAssets([]);
    setActiveTab('HOME');
  };

  // --- Data: backup / restore / CSV export ---
  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const readIncome = (): any[] => {
    try { return JSON.parse(localStorage.getItem('kaya.income.v1') || '[]'); } catch { return []; }
  };
  const csvCell = (v: any) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const today = () => new Date().toISOString().split('T')[0];

  const handleExportCSV = () => {
    const rows: any[][] = [['Type', 'Name/Source', 'Category', 'Currency', 'Amount', 'Date', 'Note']];
    assets.forEach(a => rows.push(['Asset', a.name, a.category, a.currency, a.amount, a.lastUpdated, a.institution || '']));
    readIncome().forEach(r => rows.push(['Income', r.source, r.category, r.currency, r.amount, r.date, r.note || '']));
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
    downloadFile(`kaya-export-${today()}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const handleBackup = () => {
    const data = { app: 'kaya', version: 1, exportedAt: new Date().toISOString(), assets, income: readIncome(), settings };
    downloadFile(`kaya-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  // Import a CSV (same column shape as Export CSV / the Kaya template).
  // Replaces current data so the sheet can act as the source of truth.
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || '')).filter(r => r.some(c => c.trim() !== ''));
        if (rows.length < 2) { window.alert('That CSV looks empty.'); return; }
        const header = rows[0].map(h => h.trim().toLowerCase());
        const find = (re: RegExp) => header.findIndex(h => re.test(h));
        const iType = find(/type/), iName = find(/name|source/), iCat = find(/categ/),
              iCur = find(/curr/), iAmt = find(/amount|balance/), iDate = find(/date/), iNote = find(/note|institution/);
        if (iName < 0 || iAmt < 0) { window.alert('CSV needs at least a Name/Source and an Amount column.'); return; }

        const catValues = Object.values(AssetCategory) as string[];
        const newAssets: Asset[] = [];
        const newIncome: IncomeRecord[] = [];

        rows.slice(1).forEach(r => {
          const amount = parseFloat((r[iAmt] || '').replace(/[, ]/g, ''));
          if (isNaN(amount)) return;
          const name = (r[iName] || '').trim();
          if (!name) return;
          const currency = ((iCur >= 0 ? r[iCur] : '') || 'PHP').trim().toUpperCase();
          const cat = (iCat >= 0 ? r[iCat] : '').trim();
          const note = (iNote >= 0 ? r[iNote] : '').trim();
          const dateRaw = (iDate >= 0 ? r[iDate] : '').trim();
          const d = dateRaw ? new Date(dateRaw) : new Date();
          const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          const type = (iType >= 0 ? r[iType] : '').trim().toLowerCase();

          if (type.startsWith('income')) {
            newIncome.push({
              id: `${Date.now()}-${newIncome.length}`,
              amount, currency,
              source: name,
              category: cat || 'Dividend',
              date: iso,
              note: note || undefined,
              rateUsd: rates[currency]
            });
          } else {
            const category = (catValues.includes(cat) ? cat : AssetCategory.OTHER) as AssetCategory;
            newAssets.push({
              id: `${Date.now()}-${newAssets.length}`,
              name, category, amount, currency,
              institution: note || undefined,
              lastUpdated: iso,
              history: [{ id: `${Date.now()}-h-${newAssets.length}`, date: iso, amount, change: amount, type: 'TRANSACTION', rateUsd: rates[currency] }]
            });
          }
        });

        if (!newAssets.length && !newIncome.length) { window.alert('No valid rows found to import.'); return; }
        if (!window.confirm(`Import will REPLACE your current data with ${newAssets.length} asset(s) and ${newIncome.length} income record(s). Continue?`)) return;
        setSelectedAssetId(null);
        setAssets(newAssets);
        setIncome(newIncome);
        window.alert('Import complete.');
      } catch {
        window.alert('Could not read that CSV file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.assets)) setAssets(normalizeAssets(data.assets));
        if (Array.isArray(data.income)) localStorage.setItem('kaya.income.v1', JSON.stringify(data.income));
        if (data.settings) setSettings(data.settings);
        window.alert('Backup restored. Reopen the Income tab to see restored income.');
      } catch {
        window.alert('That file could not be read as a Kaya backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Switch tab; the effect below guarantees the view starts at the top.
  const goTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSelectedAssetId(null);
  };

  // Always anchor the scroll to the top on any navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab, selectedAssetId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe && activeInsightIndex < insights.length - 1) {
      setActiveInsightIndex(prev => prev + 1);
    }
    if (isRightSwipe && activeInsightIndex > 0) {
      setActiveInsightIndex(prev => prev - 1);
    }
  };

  // Desktop mouse-drag for the insights carousel (mirrors touch swipe).
  const handleInsightsMouseDown = (e: React.MouseEvent) => {
    insightsMouseDown.current = true;
    touchStartX.current = e.clientX;
    touchEndX.current = 0;
  };
  const handleInsightsMouseMove = (e: React.MouseEvent) => {
    if (!insightsMouseDown.current) return;
    touchEndX.current = e.clientX;
  };
  const handleInsightsMouseEnd = () => {
    if (!insightsMouseDown.current) return;
    insightsMouseDown.current = false;
    handleTouchEnd();
  };

  const renderAssetDetail = () => {
    if (!selectedAsset) return null;
    return (
        <div className="animate-[kayaRise_0.35s_ease-out]">
            <div className="glass-panel rounded-[24px] p-5 mb-6 relative overflow-visible z-20">
                <div className="flex justify-between items-center mb-2 -mt-1">
                     <button 
                        onClick={() => setSelectedAssetId(null)}
                        className="p-2 -ml-2 rounded-full hover:bg-ink/5 text-textMuted hover:text-ink transition-colors"
                    >
                        <Icons.ArrowLeft className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={() => handleOpenEditAssetDetails(selectedAsset)}
                        className="p-2 -mr-2 text-textMuted hover:text-ink"
                    >
                        <Icons.Edit className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-start mb-2 relative z-10">
                    <div className="w-full flex items-center justify-between gap-2">
                        <p className="text-textMuted text-[11px] font-medium tracking-[1.2px] uppercase truncate">
                            {selectedAsset.name}
                        </p>
                        <span className={`shrink-0 text-[11px] font-medium text-textFaint tabular-nums transition-opacity duration-150 ${assetScrub ? 'opacity-100' : 'opacity-0'}`}>
                            {assetScrub ? scrubDate(assetScrub.point.date) : ''}
                        </span>
                    </div>
                    {selectedAsset.institution && (
                        <p className="text-textFaint text-[11px] font-medium tracking-[1.2px] uppercase">{selectedAsset.institution}</p>
                    )}
                    <div className="flex items-baseline gap-1 mt-1.5">
                        <span className="text-2xl font-normal text-textFaint">
                            <Sym code={selectedAsset.currency} />
                        </span>
                        <span className="text-4xl font-medium text-ink tracking-tight tabular-nums">
                            {(assetScrub ? assetScrub.value : selectedAsset.amount).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="h-28 -mx-5 mt-2">
                    {assetHistoryData.length < 2 ? (
                      <div className="h-full flex items-center justify-center px-8 text-center text-[13px] text-textFaint">Update this balance again to see its progress</div>
                    ) : <NetWorthChart
                        data={assetHistoryData}
                        mode={selectedAsset.currency === Currency.BTC ? 'BTC' : 'FIAT'}
                        displayCurrency={selectedAsset.currency}
                        timeRange={selectedTimeRange}
                        onScrub={setAssetScrub}
                    />}
                </div>

                <div className="flex justify-between items-center mt-2">
                    {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setSelectedTimeRange(range)}
                            className={`px-[10px] py-[6px] text-[10px] font-medium rounded-full transition-all ${
                                selectedTimeRange === range
                                ? 'bg-textMuted text-paper shadow-sm'
                                : 'text-textFaint hover:text-ink'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                 </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-2.5">
                    <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px]">Value History</h3>
                    <button
                        onClick={handleOpenUpdateBalance}
                        className="text-[13px] font-medium text-textFaint hover:text-ink transition-colors"
                    >
                        Add
                    </button>
                </div>

                <div className="glass-panel rounded-[20px] overflow-hidden">
                    {selectedAsset.history.length === 0 && (
                        <div className="p-6 text-center text-textMuted text-sm">No history yet.</div>
                    )}
                    {selectedAsset.history.map((entry, index) => (
                         <HistoryItem
                            key={entry.id}
                            entry={entry}
                            currency={selectedAsset.currency}
                            isLast={index === selectedAsset.history.length - 1}
                            onDelete={() => handleDeleteHistoryEntry(entry.id)}
                            onEdit={() => handleOpenEditHistoryEntry(entry)}
                            shouldAnimateHint={index === 0 && !historySwipeHintShown}
                         />
                    ))}
                </div>
            </div>
        </div>
    );
  };

  // --- Marketing email consent (GDPR / CASL) ---------------------------------
  const marketingMeta = (session?.user?.user_metadata || undefined) as MarketingMeta | undefined;
  const marketingOn = !!marketingMeta?.marketing_opt_in;
  const [showMarketingPrompt, setShowMarketingPrompt] = useState(false);
  const [marketingBusy, setMarketingBusy] = useState(false);
  // Save a choice made on the sign-up form (by code or email link) once the user is signed in
  useEffect(() => { if (session?.user?.id) applyPendingSignupConsent(); }, [session?.user?.id]);
  // One-time prompt for existing users: signed in, past onboarding, unlocked, never asked
  useEffect(() => {
    if (!isSupabaseEnabled || !session || locked || settings.onboardingComplete === false) return;
    if (!shouldAskMarketing(marketingMeta) || hasPendingSignupConsent()) return;
    const t = setTimeout(() => setShowMarketingPrompt(true), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, locked, settings.onboardingComplete, marketingMeta?.marketing_asked_at, marketingMeta?.marketing_opt_in, marketingMeta?.marketing_prompt_dismissed_at]);
  const answerMarketingPrompt = async (yes: boolean) => {
    setMarketingBusy(true);
    await (yes ? optIn('in_app_prompt') : dismissPrompt());
    setMarketingBusy(false);
    setShowMarketingPrompt(false);
  };
  const closeMarketingPrompt = () => { if (showMarketingPrompt) { dismissPrompt(); setShowMarketingPrompt(false); } };
  const toggleMarketing = async () => {
    if (marketingBusy) return;
    setMarketingBusy(true);
    await (marketingOn ? optOut() : optIn('settings'));
    setMarketingBusy(false);
  };

  const greetingName = (() => {
    const custom = settings.displayName?.trim();
    if (custom) return custom;
    const n =session?.user?.email?.split('@')[0]?.replace(/[0-9]+/g, '').replace(/[._+-]+/g, ' ').trim().split(' ')[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'there';
  })();

  const renderHome = () => (
    <div className="space-y-6 animate-[kayaRise_0.4s_ease-out]">
      <header className="flex justify-between items-center">
        <div className="min-w-0 flex-1 pr-3">
            <h1 title={`Hi, ${greetingName}!`} className="text-[20px] font-semibold tracking-tight text-textMuted whitespace-nowrap overflow-hidden text-ellipsis">Hi, {greetingName}!</h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
            <button
                onClick={toggleTheme}
                aria-label="Toggle light or dark mode"
                className="glass-panel w-9 h-9 flex items-center justify-center rounded-full text-textMuted hover:text-ink transition-colors"
            >
                {theme === 'dark' ? <Icons.Moon size={16} /> : <Icons.Sun size={16} />}
            </button>
            {currentStreak > 0 && (
            <div className="relative">
                <button
                    onClick={() => setShowStreakTooltip(!showStreakTooltip)}
                    className="flex items-center gap-1.5 glass-panel h-9 px-3.5 rounded-full text-sm font-medium text-textMuted hover:text-ink transition-colors"
                >
                    <Icons.Fire className="w-3.5 h-3.5 animate-pulse text-[#F7931A]" weight="fill" />
                    <span>{currentStreak}</span>
                </button>
                {showStreakTooltip && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStreakTooltip(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 kaya-pop rounded-xl z-50 p-3 animate-[fadeIn_0.1s_ease-out]">
                            <p className="text-ink text-xs font-semibold mb-1">Monthly Streak</p>
                            <p className="text-[10px] text-textMuted leading-relaxed">
                                You've logged your wealth {currentStreak} {currentStreak === 1 ? 'month' : 'months'} in a row. Log again next month to keep it going!
                            </p>
                        </div>
                    </>
                )}
            </div>
            )}
            <button
                onClick={() => goTab('SETTINGS')}
                aria-label="Profile and settings"
                className="glass-panel w-9 h-9 flex items-center justify-center rounded-full text-textMuted hover:text-ink transition-colors"
            >
                <Icons.User size={22} />
            </button>
        </div>
      </header>

      <div className="glass-panel rounded-[24px] p-5 relative overflow-visible z-20">
         <div className="flex justify-between items-start mb-0 relative">
            <div className="flex-1">
                 <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                        <p className="text-textMuted text-[11px] font-medium tracking-[1.2px] uppercase">Net Worth</p>
                        <button
                            onClick={() => setPrivacyMode(!privacyMode)}
                            className="text-textMuted hover:text-ink transition-colors p-1"
                        >
                            {privacyMode ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                        </button>
                    </div>
                    {/* Date of the scrubbed point (only while dragging on the chart) */}
                    <span className={`text-[11px] font-medium text-textFaint tabular-nums transition-opacity duration-150 ${homeScrub ? 'opacity-100' : 'opacity-0'}`}>
                        {homeScrub ? scrubDate(homeScrub.point.date) : ''}
                    </span>
                 </div>

                 <div className="relative inline-block">
                    <h2
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className={`flex items-baseline cursor-pointer hover:opacity-80 transition-opacity gap-1 ${settings.displayCurrency === Currency.BTC ? 'text-[#F7931A]' : 'text-ink'}`}
                    >
                        <span className="text-3xl font-normal text-textFaint font-sans">{settings.displayCurrency === 'AED' ? <DirhamSign /> : homeParts.symbol}</span>
                        <span className="text-4xl font-medium font-sans tracking-tight tabular-nums">{homeParts.value}</span>
                        <Icons.ChevronDown className="w-4 h-4 self-center text-textFaint ml-0.5" />
                    </h2>
                    {isCurrencyDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-44 max-h-64 overflow-y-auto no-scrollbar kaya-pop rounded-xl z-50 animate-[fadeIn_0.1s_ease-out]">
                            {COMMON_CURRENCY_CODES.map(curr => (
                                <button
                                    key={curr}
                                    onClick={() => handleCurrencySelect(curr)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-ink/5 transition-colors flex items-center justify-between ${
                                        settings.displayCurrency === curr
                                        ? 'text-primary font-bold bg-ink/5'
                                        : 'text-textMuted'
                                    }`}
                                >
                                    <span>{curr === Currency.BTC ? 'BTC (Bitcoin)' : curr}</span>
                                    {settings.displayCurrency === curr && <Icons.Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                 </div>

                 {homeChange !== null && !privacyMode && hasTrend && (
                   <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[13px] font-medium flex items-center gap-1 tabular-nums ${homeChange.pct >= 0 ? 'text-[#399d74]' : 'text-rose-400'}`}>
                          {homeChange.pct >= 0 ? <Icons.Trend size={14} /> : <Icons.TrendDown size={14} />} {homeChange.pct >= 0 ? '+' : ''}{homeChange.pct.toFixed(1)}%
                      </span>
                      <span className="text-textMuted text-xs">{homeChange.label}</span>
                   </div>
                 )}
            </div>
         </div>
         <div className="h-28 -mx-5 mt-2">
            {!hasTrend ? (
              <div className="h-full flex items-center justify-center px-8 text-center text-[13px] text-textFaint">Add another balance to see your progress</div>
            ) : <NetWorthChart
                data={historyData}
                mode={settings.displayCurrency === Currency.BTC ? 'BTC' : 'FIAT'}
                displayCurrency={settings.displayCurrency}
                timeRange={selectedTimeRange}
                onScrub={setHomeScrub}
            />}
         </div>
         <div className="flex justify-between items-center mt-2">
            {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-[10px] py-[6px] text-[10px] font-medium rounded-full transition-all ${
                        selectedTimeRange === range
                        ? 'bg-textMuted text-paper shadow-sm'
                        : 'text-textFaint hover:text-ink'
                    }`}
                >
                    {range}
                </button>
            ))}
         </div>
      </div>

      <div>
          <div className="flex justify-between items-center mb-2.5">
             <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] leading-[1.3]">Top Assets</h3>
             <button
                onClick={() => setActiveTab('ASSETS')}
                className="text-[13px] text-textFaint font-medium hover:text-ink transition-colors"
             >
                See All
             </button>
          </div>
          <div className="glass-panel rounded-[20px] overflow-hidden">
             {topAssets.length === 0 && (
                <div className="p-6 text-center">
                    <p className="text-ink text-sm font-medium mb-0.5">No assets yet</p>
                    <p className="text-textMuted text-xs">Tap the + button to add your first one.</p>
                </div>
             )}
             {topAssets.map((asset, index) => (
                <div
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className="px-4 py-3.5 flex justify-between items-center gap-3 hover:bg-ink/5 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <InstitutionLogo name={asset.institution} category={asset.category} size={40} radius={12} />
                        <div className="min-w-0">
                            <p className="font-medium text-ink text-[15px] truncate">{asset.name}</p>
                            <p className="text-[12px] text-textMuted mt-0.5 truncate">{asset.institution}</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="font-semibold text-ink text-[15px] tabular-nums">
                            {privacyMode ? '•••••' : (
                                <>
                                    <Sym code={asset.currency} />{asset.currency === Currency.BTC ? '' : ' '}
                                    {asset.amount.toLocaleString()}
                                </>
                            )}
                        </p>
                    </div>
                </div>
             ))}
          </div>
      </div>

      <div>
          <div className="flex justify-between items-center mb-2.5">
             <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] leading-[1.3]">Currency Rates</h3>
             <button
                onClick={openFxEdit}
                className="text-[13px] text-textFaint font-medium hover:text-ink transition-colors"
             >
                Edit
             </button>
          </div>
          <div className="glass-panel rounded-[20px] overflow-hidden">
             {fxPairs.map((p, i) => {
                const weekly = fxWeeklyFor(p.first, p.second);
                const up = weekly ? weekly.change >= 0 : true;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 px-[18px] py-3.5">
                    <div className="min-w-0">
                      <p className="text-[15px] text-ink tabular-nums">
                        1 {p.first} = <span className="font-semibold">{fxRate(p.first, p.second)}</span> {p.second}
                      </p>
                      {weekly ? (
                        <p className={`text-[12px] mt-1 ${up ? 'text-[#399d74]' : 'text-rose-400'}`}>
                          {up ? '▲' : '▼'} {Math.abs(weekly.change).toFixed(2)}% <span className="text-textFaint">this week</span>
                        </p>
                      ) : (
                        <p className="text-[12px] text-textFaint mt-1">{p.first}/{p.second}</p>
                      )}
                    </div>
                    {weekly && <Sparkline data={weekly.series} up={up} />}
                  </div>
                );
             })}
          </div>
      </div>

      {AI_INSIGHTS_ENABLED && assets.length > 0 && (
      <div className="px-1">
        <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-3">Insights</h3>
        {isLoadingInsights ? (
            <div className="p-4 rounded-[20px] glass-panel animate-pulse h-24"></div>
        ) : (
            <div
                className="glass-panel rounded-[20px] relative overflow-hidden select-none shadow-lg cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleInsightsMouseDown}
                onMouseMove={handleInsightsMouseMove}
                onMouseUp={handleInsightsMouseEnd}
                onMouseLeave={handleInsightsMouseEnd}
            >
                <div 
                    className="flex w-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${activeInsightIndex * 100}%)` }}
                >
                    {insights.map((tip, idx) => (
                        <div key={idx} className="w-full flex-shrink-0 flex gap-4 items-start px-6 pt-6">
                             <span className="shrink-0 flex items-center h-[1.625rem]">
                                <span className="w-2 h-2 rounded-full bg-ink/90 animate-[subtlePulse_2.8s_ease-in-out_infinite]" />
                             </span>
                             <p className="text-base text-ink font-light leading-relaxed flex-1 min-w-0 break-words whitespace-normal">{tip}</p>
                        </div>
                    ))}
                    {insights.length === 0 && (
                        <div className="w-full flex-shrink-0 px-6 pt-6 text-textMuted text-sm">No insights available.</div>
                    )}
                </div>
                <div className="flex justify-center gap-1.5 py-6">
                    {insights.map((_, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setActiveInsightIndex(idx)}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                idx === activeInsightIndex 
                                ? 'bg-primary w-4' 
                                : 'bg-ink/20 hover:bg-ink/40'
                            }`}
                        />
                    ))}
                </div>
            </div>
        )}
      </div>
      )}
    </div>
  );

  const assetRow = (asset: Asset, showCat: boolean, isLast: boolean) => (
    <div
        key={asset.id}
        onClick={() => setSelectedAssetId(asset.id)}
        className={`px-4 py-3.5 flex justify-between items-center gap-3 hover:bg-ink/5 transition-colors cursor-pointer group ${!isLast ? 'border-b border-ink/5' : ''}`}
    >
        <div className="flex items-center gap-3 min-w-0">
            <InstitutionLogo name={asset.institution} category={asset.category} size={40} radius={12} className="group-hover:border-primary/50 transition-colors" />
            <div className="min-w-0">
                <p className="font-medium text-ink text-[15px] truncate">{asset.name}</p>
                {showCat ? (
                    <span className="flex items-center gap-1.5 mt-1 min-w-0">
                        <span
                            className="text-[9px] leading-none px-1.5 py-[3px] rounded-full shrink-0"
                            style={isLiquid(asset)
                                ? { background: 'rgba(57,157,116,0.15)', color: '#399d74' }
                                : { background: 'rgba(110,135,119,0.15)', color: 'rgb(var(--faint))' }}
                        >
                            {catLabel(asset.category)}
                        </span>
                        {asset.institution && <span className="text-[10px] text-textFaint truncate">{asset.institution}</span>}
                    </span>
                ) : (
                    <p className="text-[12px] text-textMuted mt-0.5 truncate">{asset.institution}</p>
                )}
            </div>
        </div>
        <div className="text-right shrink-0">
            <p className="font-semibold text-ink text-[15px] tabular-nums">
                {privacyMode ? '••••••' : (<><Sym code={asset.currency} />{asset.currency === Currency.BTC ? '' : ' '}{asset.amount.toLocaleString()}</>)}
            </p>
            <p className="text-[11px] text-textFaint mt-0.5">Updated {new Date(asset.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
    </div>
  );

  const renderPortfolioList = () => (
    <div className="space-y-4 animate-[kayaRise_0.4s_ease-out]">
         <header className="mb-6 px-1">
            <h1 className="text-3xl font-medium text-ink mb-2">Portfolio</h1>
            <p className="text-sm text-textMuted">Tap to view details</p>
        </header>

        {/* Allocation + liquidity (swipeable) */}
        {assets.length > 0 && (
            <AllocationCarousel
                segs={allocation}
                liquid={liquidityBreakdown.liquid}
                locked={liquidityBreakdown.locked}
                liabilities={liquidityBreakdown.liabilities}
                assetsTotal={liquidityBreakdown.assetsTotal}
                fmt={fmtDisplay}
                fmtCompact={fmtCompact}
                privacyMode={privacyMode}
                onTogglePrivacy={() => setPrivacyMode(p => !p)}
                allocMode={allocMode}
                onAllocMode={setAllocMode}
            />
        )}

        {/* Read-only passive-income summary (not counted in net worth) — hidden for now; flip SHOW_PORTFOLIO_INCOME_CARD to bring it back */}
        {SHOW_PORTFOLIO_INCOME_CARD && (
        <button
            onClick={() => goTab('INCOME')}
            className="w-full text-left glass-panel rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-ink/5 transition-colors mb-2"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center shrink-0">
                    <Icons.BarChart size={18} />
                </div>
                <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate">Passive income</p>
                    <p className="text-[12px] text-textMuted mt-0.5 truncate">Last 12 months · not in net worth</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[15px] font-semibold text-ink tabular-nums">
                    {privacyMode ? '••••' : `${getCurrencySymbol(settings.displayCurrency)}${Math.round(passiveIncome12mo).toLocaleString()}`}
                </span>
                <Icons.ChevronRight className="w-4 h-4 text-textFaint" />
            </div>
        </button>
        )}

        {assets.length === 0 && (
            <div className="glass-panel rounded-[20px] p-8 text-center shadow-lg mt-4">
                <div className="w-12 h-12 rounded-2xl bg-ink/5 text-ink flex items-center justify-center mx-auto mb-3">
                    <Icons.Wallet size={22} />
                </div>
                <p className="text-ink font-medium mb-1">No assets yet</p>
                <p className="text-textMuted text-sm">Tap the + button to add your first account, investment, or holding.</p>
            </div>
        )}

        {/* Filter + sort control */}
        {assets.length > 0 && (
            <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs text-textMuted">
                    {filteredAssets.length === assets.length ? `${assets.length} ${assets.length === 1 ? 'account' : 'accounts'}` : `${filteredAssets.length} of ${assets.length}`}
                </span>
                <button
                    onClick={() => setFilterOpen(true)}
                    className={`flex items-center gap-2 h-9 px-3.5 rounded-full text-[12px] font-medium transition-colors ${filtersActive ? 'bg-textMuted text-paper' : 'glass-panel text-textMuted hover:text-ink'}`}
                >
                    Filter{filtersActive ? ` · ${catFilter.length + curFilter.length}` : ''}
                    <Icons.BarChart size={14} className="rotate-90" />
                </button>
            </div>
        )}

        {filteredSubtotal && filteredAssets.length > 0 && (
            <div className="glass-panel rounded-[20px] px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium tracking-[1.2px] text-textMuted uppercase">Filtered total</span>
                    <span className="text-[12px] text-textFaint">{filteredSubtotal.count} {filteredSubtotal.count === 1 ? 'account' : 'accounts'}</span>
                </div>
                <p className="text-2xl font-semibold text-ink mb-3">{privacyMode ? '••••••' : fmtDisplay(filteredSubtotal.usd)}</p>
                {filteredSubtotal.pct !== null && (
                    <div className="flex h-2 rounded-full overflow-hidden bg-ink/10 mb-3">
                        <div className="rounded-full" style={{ width: `${Math.max(0, Math.min(100, filteredSubtotal.pct))}%`, background: 'linear-gradient(90deg, #399d74, rgb(var(--muted)))' }} />
                    </div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {catFilter.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full"
                            style={c !== AssetCategory.DEBT && (CATEGORY_LIQUIDITY[c] ?? 'medium') !== 'low'
                                ? { background: 'rgba(57,157,116,0.15)', color: '#399d74' }
                                : { background: 'rgba(110,135,119,0.15)', color: 'rgb(var(--faint))' }}>
                            {c}
                        </span>
                    ))}
                    {curFilter.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-ink/10 text-textMuted">{c}</span>
                    ))}
                    {filteredSubtotal.pct !== null && (
                        <span className="text-[11px] text-textMuted ml-0.5">{filteredSubtotal.pct.toFixed(0)}% of net worth</span>
                    )}
                </div>
            </div>
        )}

        {filteredAssets.length === 0 && assets.length > 0 && (
            <div className="glass-panel rounded-[20px] p-8 text-center shadow-lg">
                <p className="text-ink font-medium mb-1">No matching accounts</p>
                <p className="text-textMuted text-sm">Try clearing a filter.</p>
            </div>
        )}

        {sortMode === 'CATEGORY' ? (
            Object.values(AssetCategory).map(category => {
                const categoryAssets = mainAssets.filter(a => a.category === category);
                if (categoryAssets.length === 0) return null;
                return (
                    <div key={category} className="mb-6">
                        <h3 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-3 px-1">{catLabel(category)}</h3>
                        <div className="glass-panel rounded-[20px] overflow-hidden shadow-lg">
                            {categoryAssets.map((asset, index) => assetRow(asset, false, index === categoryAssets.length - 1))}
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="glass-panel rounded-[20px] overflow-hidden shadow-lg">
                {sortedFlat.map((asset, index) => assetRow(asset, true, index === sortedFlat.length - 1))}
            </div>
        )}

        {/* No debts yet: a quiet way in, so loans aren't hidden behind "New asset" */}
        {assets.length > 0 && !assets.some(a => a.category === AssetCategory.DEBT) && (
            <button type="button" onClick={handleOpenAddDebt}
                className="w-full mb-6 glass-panel rounded-[20px] px-4 py-3.5 flex items-center gap-3 text-left transition-transform active:scale-[0.98] hover:brightness-110">
                <span aria-hidden className="w-10 h-10 rounded-[12px] bg-ink/5 text-textMuted flex items-center justify-center shrink-0"><Icons.Add size={18} /></span>
                <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-ink">Add a loan or credit card</span>
                    <span className="block text-[12px] text-textFaint mt-0.5">Kaya subtracts debts from your net worth</span>
                </span>
            </button>
        )}

        {/* Excluded — tracked but not counted toward net worth */}
        {excludedAssets.length > 0 && (
            <div className="mt-2">
                <button onClick={() => setExcludedOpen(o => !o)} className="w-full flex items-center justify-between px-1 py-2 group">
                    <span className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px]">Excluded · not in net worth ({excludedAssets.length})</span>
                    <Icons.ChevronDown className={`w-4 h-4 text-textFaint transition-transform ${excludedOpen ? 'rotate-180' : ''}`} />
                </button>
                {excludedOpen && (
                    <div className="glass-panel rounded-[20px] overflow-hidden shadow-lg opacity-70">
                        {excludedAssets.map((asset, index) => assetRow(asset, true, index === excludedAssets.length - 1))}
                    </div>
                )}
            </div>
        )}

        <Modal isOpen={filterOpen} onClose={() => setFilterOpen(false)}>
            <h2 className="text-xl font-semibold text-ink mb-5">Sort &amp; filter</h2>

            <p className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-2">Sort</p>
            <div className="flex justify-between items-center mb-6">
                {([['CATEGORY', 'Category'], ['VALUE', 'Value'], ['UPDATED', 'Updated'], ['LIQUIDITY', 'Liquidity']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => setSortMode(m)}
                        className={`px-3.5 py-2 text-[12px] font-medium rounded-full transition-colors duration-200 ${sortMode === m ? 'bg-textMuted text-paper' : 'text-textFaint hover:text-ink'}`}>
                        {label}
                    </button>
                ))}
            </div>

            <p className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-2">Filter</p>

            <p className="text-[11px] text-textFaint mb-2">Category</p>
            <div className="flex flex-wrap gap-2 mb-5">
                {Object.values(AssetCategory).filter(c => assets.some(a => a.category === c)).map(c => (
                    <button key={c} onClick={() => toggleCat(c)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${catFilter.includes(c) ? 'bg-textMuted text-paper border-transparent' : 'border-ink/10 text-textMuted hover:text-ink'}`}>
                        {c !== AssetCategory.DEBT && <i className="w-2 h-2 rounded-full" style={{ background: (CATEGORY_LIQUIDITY[c] ?? 'medium') === 'low' ? 'rgb(var(--faint))' : '#399d74' }} />}{catLabel(c)}
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-textFaint mb-2">Currency</p>
            <div className="flex flex-wrap gap-2">
                {portfolioCurrencies.map(c => (
                    <button key={c} onClick={() => toggleCur(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${curFilter.includes(c) ? 'bg-textMuted text-paper border-transparent' : 'border-ink/10 text-textMuted hover:text-ink'}`}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="flex gap-3 mt-7">
                {filtersActive && (
                    <button type="button" onClick={resetFilters} className="kaya-btn-secondary px-5 py-4 rounded-[14px] whitespace-nowrap">
                        Reset all
                    </button>
                )}
                <button onClick={() => setFilterOpen(false)} className="flex-1 kaya-btn py-4 rounded-[14px]">
                    Show {filteredAssets.length} {filteredAssets.length === 1 ? 'account' : 'accounts'}
                </button>
            </div>
        </Modal>
    </div>
  );

  const renderCurrencySelection = () => (
    <div className="animate-[kayaRise_0.35s_ease-out]">
        <header className="flex items-center gap-4 mb-6 px-1">
            <button 
                onClick={() => setActiveTab('SETTINGS')}
                className="p-2 -ml-2 rounded-full hover:bg-ink/5 text-textMuted hover:text-ink transition-colors"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-medium text-ink">Select Currency</h1>
        </header>

        <div className="glass-panel rounded-[20px] overflow-hidden shadow-lg">
            {ORDERED_CURRENCIES.map((option, index) => (
                <div
                    key={option.code}
                    onClick={() => {
                        setSettings(prev => ({ ...prev, displayCurrency: option.code }));
                        setActiveTab('SETTINGS');
                    }}
                    className={`p-4 flex justify-between items-center cursor-pointer hover:bg-ink/5 transition-colors ${index !== ORDERED_CURRENCIES.length - 1 ? 'border-b border-ink/5' : ''}`}
                >
                    <div className="flex items-center gap-3">
                         <span className={`font-medium w-10 ${settings.displayCurrency === option.code ? 'text-primary' : 'text-ink'}`}>{option.code}</span>
                         <span className="text-sm text-textMuted">{option.name}</span>
                    </div>
                    {settings.displayCurrency === option.code && (
                        <Icons.Check className="text-primary w-5 h-5" />
                    )}
                </div>
            ))}
        </div>
    </div>
  );

  const renderSettings = () => (
    <div className="animate-[kayaRise_0.4s_ease-out]">
      <header className="mb-8 px-1">
        <h1 className="text-3xl font-medium text-ink">Settings</h1>
      </header>

      <SettingsGroup title="General">
        <SettingsItem icon={<Icons.Global size={20} />} label="Currency" value={settings.displayCurrency} onClick={() => setActiveTab('SETTINGS_CURRENCY')} />
        <SettingsItem icon={<Icons.Moon size={20} />} label="Light mode" toggle isToggled={theme === 'light'} onToggle={toggleTheme} />
        <SettingsItem icon={<Icons.Bell size={20} />} label="Notifications" toggle isToggled={notificationsEnabled} onToggle={() => setNotificationsEnabled(!notificationsEnabled)} isLast />
      </SettingsGroup>

      <SettingsGroup title="Security">
        <SettingsItem icon={<Icons.Lock size={20} />} label="App Lock (PIN)" toggle isToggled={!!security.pin} onToggle={handleToggleAppLock} />
        {security.pin && (
          <SettingsItem icon={<Icons.Edit size={20} />} label="Change PIN" onClick={handleChangePin} />
        )}
        {security.pin && (
          <SettingsItem icon={<Icons.History size={20} />} label="Auto-lock" value={lockDelayLabel} onClick={() => setShowAutoLock(true)} />
        )}
        <SettingsItem icon={<Icons.Fingerprint size={20} />} label="Face ID / Touch ID" toggle isToggled={security.biometric} onToggle={handleToggleBiometric} isLast />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsItem icon={<Icons.Cloud size={20} />} label="Backup (download .json)" onClick={handleBackup} />
        <SettingsItem icon={<Icons.Upload size={20} />} label="Restore from backup" onClick={() => restoreInputRef.current?.click()} />
        <SettingsItem icon={<Icons.Download size={20} />} label="Export CSV / Sheets" onClick={handleExportCSV} />
        <SettingsItem icon={<Icons.Upload size={20} />} label="Import CSV / Sheets" onClick={() => csvInputRef.current?.click()} />
        <SettingsItem icon={<Icons.Delete size={20} />} label="Clear all data & start fresh" onClick={handleClearData} isLast />
      </SettingsGroup>

      {isSupabaseEnabled && session && (
        <>
          <SettingsGroup title="Email preferences">
            <SettingsItem icon={<Icons.Mail size={20} />} label={CONSENT_TEXT.settings} toggle isToggled={marketingOn} onToggle={toggleMarketing} isLast />
          </SettingsGroup>
          <p className="text-textFaint text-[11px] -mt-4 mb-6 px-2 leading-relaxed">You'll still get important account and product update emails.</p>
        </>
      )}

      <SettingsGroup title="Support">
        <SettingsItem icon={<Icons.Feedback size={20} />} label="Share feedback" onClick={() => { setFeedbackStatus('idle'); setShowFeedback(true); }} />
        <SettingsItem icon={<Icons.Shield size={20} />} label="Privacy & Data" onClick={() => setShowPrivacy(true)} />
        <SettingsItem icon={<Icons.Settings size={20} />} label="Cookie settings" onClick={openCookieSettings} />
        <SettingsItem icon={<Icons.Star size={20} />} label="Rate Kaya" onClick={() => window.open('https://www.producthunt.com/products/kaya-wealth/reviews', '_blank', 'noopener,noreferrer')} />
        <SettingsItem icon={<Icons.Mail size={20} />} label="Contact Us" onClick={() => { setContactStatus('idle'); setShowContact(true); }} isLast />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsItem
          icon={<Icons.User size={20} />}
          label="Display name"
          value={settings.displayName?.trim() || 'Add'}
          onClick={() => { setNameDraft(settings.displayName || ''); setShowNameEdit(true); }}
          isLast={!(isSupabaseEnabled && session)}
        />
        {isSupabaseEnabled && session && (
          <>
            <SettingsItem icon={<Icons.Mail size={20} />} label="Signed in" value={session.user.email || ''} />
            <SettingsItem icon={<Icons.ArrowLeftRight size={20} />} label="Sign out" onClick={handleSignOut} isLast />
          </>
        )}
      </SettingsGroup>

      {/* Tip jar: a quiet sign-off at the bottom (replaces the old Premium card) */}
      <div className="text-center mt-10 px-6">
        <Icons.Heart size={18} className="mx-auto text-textFaint" />
        <p className="text-[12px] leading-relaxed text-textFaint mt-1.5">
          Kaya is free and ad-free.<br />If it helps you, you can chip in to keep it running.
        </p>
        <a href="https://ko-fi.com/kayawealth" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center mt-3 px-3.5 h-8 rounded-full text-[12px] font-medium text-textMuted border border-textMuted/30 hover:border-textMuted/60 transition-colors">
          Leave a tip
        </a>
      </div>

      <div className="text-center mt-8 text-textFaint text-xs">
        <p>Kaya Wealth v1.1.0</p>
        <p className="mt-1">{isSupabaseEnabled ? 'Cloud sync on' : 'Local only'}</p>
      </div>
    </div>
  );

  // Branded loading screen (dither + logo) — shown while the session restores, and while a
  // brand-new / not-yet-cached account loads from the cloud, so new sign-ups go straight to
  // onboarding instead of flashing an empty Home first.
  const bootSplash = (
    <div className="h-[100dvh] max-w-md mx-auto relative isolate overflow-hidden flex items-center justify-center" aria-busy="true" aria-label="Loading Kaya">
      <DitherBackground theme={theme} />
      <div className="flex flex-col items-center gap-4">
        {/* Logo drawn inline (not an <img>) so it paints on the very first frame */}
        <svg width={44} height={44} viewBox="0 0 32 32" fill="none" aria-hidden className="kaya-splash-logo animate-[subtlePulse_2.2s_ease-in-out_infinite]">
          <path d="M30 29H20L10 16H20L30 29Z" fill="white" />
          <path d="M10 16H20L30 3H20L10 16Z" fill="#399D74" />
          <path d="M20 16L10 29H2V26.3994L10 16H20Z" fill="#399D74" />
          <rect x="2" y="3" width="8" height="26" fill="white" />
        </svg>
        {cloudError && <p className="text-[13px] text-textFaint animate-[kayaFadeUp_0.3s_ease-out]">Can't reach Kaya. Retrying…</p>}
      </div>
    </div>
  );

  // Public privacy policy (same URL whether signed in or not)
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/privacy') {
    return <PrivacyPage />;
  }
  // Logged-out visitors (no saved session on this device) go straight to the landing page;
  // the splash is only for people who are actually signing in.
  if (isSupabaseEnabled && authLoading) {
    return maybeSignedIn ? bootSplash : <Landing />;
  }
  if (isSupabaseEnabled && !session) {
    return <Landing />;
  }
  // Account not cached on this device yet (new sign-up or first sign-in here): wait for the
  // cloud load before drawing anything, so we never flash an empty Home. Returning users on
  // their own device skip this and see their cached data instantly.
  if (isSupabaseEnabled && session && !cloudLoaded && getOwner() !== session.user.id) {
    return bootSplash;
  }
  // New sign-ups only (flag set when their account is first created). No need to wait for the
  // cloud here: an uncached account is already held on the splash above, and a cached one
  // already knows it hasn't finished onboarding — so this shows instantly on refresh.
  if (isSupabaseEnabled && session && settings.onboardingComplete === false) {
    return <Onboarding onFinish={handleOnboardingFinish} />;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-transparent text-textMain max-w-md mx-auto relative isolate shadow-2xl overflow-hidden font-sans">

      {/* Dithered gradient backdrop (behind all content, confined to the app column) */}
      <DitherBackground theme={theme} />

      {/* Scrollable Content Area — runs full height and scrolls UNDER the
          floating dock; bottom padding lets the last item clear the island. */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem+10px)]">
        {activeTab === 'SETTINGS' ? renderSettings() :
         activeTab === 'SETTINGS_CURRENCY' ? renderCurrencySelection() :
         activeTab === 'INCOME' ? <IncomeTracker displayCurrency={settings.displayCurrency} privacyMode={privacyMode} onTogglePrivacy={() => setPrivacyMode(p => !p)} addTick={incomeAddTick} rates={rates} records={income} onRecordsChange={(next) => { if (next.length > income.length) registerStreakActivity(); setIncome(next); }} /> :
         selectedAssetId ? renderAssetDetail() :
         activeTab === 'ASSETS' ? renderPortfolioList() :
         renderHome()}
      </main>

      {/* Bottom bar: floating island dock + FAB above it.
          Bottom padding = iOS safe-area inset + a gap so the island floats
          clearly above the home indicator instead of sitting under it. */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem+10px)] pointer-events-none [&>*:not([aria-hidden])]:pointer-events-auto">
        {/* Blur fade: content scrolling under the dock softens progressively
            instead of looking cluttered behind the island. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-12"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 100%)',
            maskImage: 'linear-gradient(180deg, transparent 0%, #000 55%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 55%)',
          }}
        />
        {activeTab !== 'SETTINGS' && activeTab !== 'SETTINGS_CURRENCY' && (
          <div className="absolute right-6 bottom-full mb-5 z-30">
            <button
                onClick={() => {
                  if (activeTab === 'INCOME') setIncomeAddTick(t => t + 1);
                  else if (selectedAssetId) handleOpenUpdateBalance();
                  else handleOpenAddAsset();
                }}
                aria-label="Add"
                className="kaya-btn w-14 h-14 rounded-2xl shadow-lg shadow-black/40 active:scale-95 flex items-center justify-center"
            >
                <Icons.Add className="w-7 h-7" />
            </button>
          </div>
        )}

        {/* Floating island navigation (Figma: 350×70, r20, fill #424242 @10%,
            background blur 12, 0.5px inside stroke white 10% → 0%, no shadow) */}
        <nav
          style={{
            background: 'rgba(66,66,66,0.10)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          className="relative isolate w-full h-[70px] rounded-[20px] px-2 py-0 flex items-center overflow-hidden"
        >
          {/* gradient stroke that fades to transparent */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[20px]"
            style={{
              padding: '0.5px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0))',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              maskComposite: 'exclude',
            }}
          />
          {([
            { key: 'HOME', label: 'Overview', active: activeTab === 'HOME' },
            { key: 'ASSETS', label: 'Portfolio', active: activeTab === 'ASSETS' },
            { key: 'INCOME', label: 'Income', active: activeTab === 'INCOME' },
            { key: 'SETTINGS', label: 'Settings', active: activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY' },
          ] as const).map(({ key, label, active }) => (
            <button
              key={key}
              aria-label={label}
              onClick={() => goTab(key as any)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] h-full transition-colors ${active ? 'text-textMuted' : 'text-textFaint'}`}
            >
              {active && (
                // Glow exported from Figma (public/glow.png, 256px @2x → 128px), centered on
                // the island's bottom edge under the icon. A pre-rendered image avoids CSS
                // `filter: blur`, which iOS Safari draws as square tiles inside the frosted dock.
                <img
                  src="/glow.png"
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 w-32 h-32 max-w-none"
                  style={{ top: 6 }}
                />
              )}
              {/* Active tab: filled Phosphor icon + muted color + glow; others: outline */}
              {key === 'HOME' ? (
                <Icons.Home className="relative w-[22px] h-[22px]" weight={active ? 'fill' : 'regular'} />
              ) : key === 'ASSETS' ? (
                <Icons.Wallet className="relative w-[22px] h-[22px]" weight={active ? 'fill' : 'regular'} />
              ) : key === 'INCOME' ? (
                <Icons.BarChart className="relative w-[22px] h-[22px]" weight={active ? 'fill' : 'regular'} />
              ) : (
                <Icons.Settings className="relative w-[22px] h-[22px]" weight={active ? 'fill' : 'regular'} />
              )}
              {/* Short visible label (10px, Apple tab bar size) so new users don't have to guess */}
              <span aria-hidden className="relative text-[10px] leading-none font-medium tracking-[0.1px]">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Undo Toast */}
      {showUndoToast && lastDeletedAsset && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 kaya-pop rounded-xl px-6 py-4 flex items-center gap-4 min-w-[320px] animate-[fadeIn_0.3s_ease-out]">
            <span className="text-ink text-sm font-medium">Deleted {lastDeletedAsset.name}</span>
            <button onClick={handleUndoDelete} className="ml-auto text-primary font-bold text-sm hover:text-ink tracking-wide">UNDO</button>
            <button onClick={() => setShowUndoToast(false)} className="text-textFaint hover:text-ink">✕</button>
        </div>
      )}

      {/* Hidden inputs for restoring a backup / importing a CSV */}
      <input ref={restoreInputRef} type="file" accept="application/json,.json" onChange={handleRestoreFile} className="hidden" />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="hidden" />

      {/* Share feedback */}
      <Modal isOpen={showFeedback} onClose={() => { setShowFeedback(false); setFeedbackStatus('idle'); }}>
        {feedbackStatus === 'sent' ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center mx-auto mb-3"><Icons.Check size={22} /></div>
            <h2 className="text-2xl font-medium text-ink mb-1">Thank you!</h2>
            <p className="text-textMuted text-sm">Your feedback helps shape Kaya.</p>
            <button onClick={() => { setShowFeedback(false); setFeedbackStatus('idle'); }} className="w-full kaya-btn py-4 rounded-[14px] mt-6">Done</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-medium text-ink mb-1">Share feedback</h2>
            <p className="text-textMuted text-sm mb-4">Bugs, ideas, requests — anything. I read every message.</p>
            <input ref={fbHoney} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] w-px h-px opacity-0" />
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              autoFocus
              placeholder="What's on your mind?"
              className="kaya-field transition-all resize-none placeholder:text-textFaint"
            />
            <button
              onClick={submitFeedback}
              disabled={!feedbackText.trim() || feedbackStatus === 'sending'}
              className="w-full kaya-btn py-4 rounded-[14px] mt-3"
            >
              {feedbackStatus === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </>
        )}
      </Modal>

      {/* Contact us */}
      <Modal isOpen={showContact} onClose={() => { setShowContact(false); setContactStatus('idle'); }}>
        {contactStatus === 'sent' ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-[#399d74]/15 text-[#399d74] flex items-center justify-center mx-auto mb-3"><Icons.Check size={22} /></div>
            <h2 className="text-2xl font-medium text-ink mb-1">Message sent</h2>
            <p className="text-textMuted text-sm">Thanks for reaching out — I'll get back to you if you left an email.</p>
            <button onClick={() => { setShowContact(false); setContactStatus('idle'); }} className="w-full kaya-btn py-4 rounded-[14px] mt-6">Done</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-medium text-ink mb-1">Contact us</h2>
            <p className="text-textMuted text-sm mb-4">Questions or anything else? Send a message and I'll reply by email.</p>
            <input ref={contactHoney} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] w-px h-px opacity-0" />
            <textarea
              value={contactText}
              onChange={(e) => setContactText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="How can I help?"
              className="kaya-field transition-all resize-none placeholder:text-textFaint"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Your email (optional, so I can reply)"
              className="kaya-field mt-3 outline-none transition-all placeholder:text-textFaint"
            />
            {contactStatus === 'error' && <p className="text-rose-400 text-sm mt-2">Couldn't send — please try again.</p>}
            <button
              onClick={submitContact}
              disabled={!contactText.trim() || contactStatus === 'sending'}
              className="w-full kaya-btn py-4 rounded-[14px] mt-3"
            >
              {contactStatus === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </>
        )}
      </Modal>

      {/* Auto-lock delay picker */}
      <Modal isOpen={showNameEdit} onClose={() => setShowNameEdit(false)}>
        <h2 className="text-2xl font-medium mb-1 text-ink">Display name</h2>
        <p className="text-textMuted text-sm mb-5">This is how Kaya greets you on the Home page.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = nameDraft.trim().slice(0, 24);
            setSettings(prev => ({ ...prev, displayName: v || undefined }));
            (document.activeElement as HTMLElement | null)?.blur();
            setShowNameEdit(false);
          }}
        >
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={24}
            placeholder="e.g. Jazz"
            autoComplete="given-name"
            className="kaya-field transition-colors"
          />
          <button type="submit" className="w-full kaya-btn py-4 rounded-[14px] mt-5">
            Save
          </button>
        </form>
      </Modal>

      <Modal isOpen={showAutoLock} onClose={() => setShowAutoLock(false)}>
        <h2 className="text-2xl font-medium mb-1 text-ink">Auto-lock</h2>
        <p className="text-textMuted text-sm mb-5">Require your PIN after Kaya has been in the background for…</p>
        <div className="rounded-[14px] overflow-hidden bg-ink/[0.04] border border-ink/10">
          {LOCK_DELAY_OPTIONS.map((o, i) => (
            <button
              key={o.sec}
              onClick={() => handleSetLockDelay(o.sec)}
              className={`w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-ink/5 transition-colors ${i !== LOCK_DELAY_OPTIONS.length - 1 ? 'border-b border-ink/5' : ''}`}
            >
              <span className="text-ink text-sm">{o.label}</span>
              {(security.lockDelaySec || 0) === o.sec && <Icons.Check size={18} className="text-primary" />}
            </button>
          ))}
        </div>
        <p className="text-textFaint text-[11px] mt-4 leading-relaxed">"Immediately" locks every time you leave the app. Longer delays are more convenient but less private on a shared device.</p>
      </Modal>

      {/* One-time email opt-in prompt for existing users */}
      <Modal isOpen={showMarketingPrompt} onClose={closeMarketingPrompt}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(57,157,116,0.15)', color: '#399d74' }}>
          <Icons.Mail size={22} />
        </div>
        <h2 className="text-2xl font-medium text-ink mb-2">Stay in the loop?</h2>
        <p className="text-textMuted text-sm leading-relaxed mb-6">{CONSENT_TEXT.in_app_prompt}</p>
        <button onClick={() => answerMarketingPrompt(true)} disabled={marketingBusy} className="w-full kaya-btn py-4 rounded-[14px] disabled:opacity-60">Yes, keep me posted</button>
        <button onClick={() => answerMarketingPrompt(false)} disabled={marketingBusy} className="w-full mt-2 py-3 text-[14px] font-medium text-textFaint hover:text-ink transition-colors">No thanks</button>
      </Modal>

      {/* Privacy & Data info */}
      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <h2 className="text-2xl font-medium mb-4 text-ink">Privacy & Data</h2>
        <div className="space-y-4 text-sm text-ink leading-relaxed">
          <p><span className="text-ink font-medium">Your data, your control.</span> Kaya is a manual tracker — it never links to your bank, so there are no banking logins or account access to expose. You enter your balances and income yourself.</p>
          <p>A copy is kept on your device so the app works offline. When you sign in, your data syncs to your private account, isolated so no other user can read it, and encrypted in transit and at rest.</p>
          <p>We use passwordless email sign-in, so there's no password to steal. You can export a backup or wipe everything anytime in <span className="text-ink">Settings → Data</span>. No ads, ever.</p>
          <p>Read the full <a href="/privacy" className="text-ink underline underline-offset-2">Privacy Policy</a>.</p>
        </div>
        <button onClick={() => setShowPrivacy(false)} className="w-full kaya-btn py-4 rounded-[14px] mt-6">
          Got it
        </button>
      </Modal>

      {/* Currency Rates editor */}
      <Modal isOpen={showFxEdit} onClose={() => setShowFxEdit(false)}>
        <h2 className="text-2xl font-medium mb-6 text-ink">Currency Rates</h2>
        <div className="space-y-6">
          {fxDraft.map((p, i) => (
            <div key={i}>
              <h4 className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] mb-2">Rate {i + 1}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-textMuted mb-1.5">First currency</label>
                  <CurrencyPicker value={p.first} onChange={(c) => updateFxDraft(i, 'first', c)} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-textMuted mb-1.5">Second currency</label>
                  <CurrencyPicker value={p.second} onChange={(c) => updateFxDraft(i, 'second', c)} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={saveFx} className="w-full kaya-btn py-4 rounded-[14px]">
            Save
          </button>
        </div>
      </Modal>

      {/* Security: set-PIN sheet, recovery, and lock overlay */}
      <SetPinSheet isOpen={showSetPin} onClose={() => setShowSetPin(false)} onSet={handleSetPin} />
      <RecoveryCodeSheet code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      {locked && security.pin && (
        <LockScreen
          expectedHash={security.pin}
          biometric={security.biometric}
          biometricId={security.biometricId}
          onUnlock={() => setLocked(false)}
          onForgot={security.recoveryHash ? () => setShowRecovery(true) : undefined}
        />
      )}
      <RecoverySheet
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        expectedHash={security.recoveryHash}
        onSuccess={handleRecovered}
      />

      {/* Dynamic Slide-Up Modal */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {selectedAsset && !isEditMode ? (
            // VIEW: Add Balance OR Edit a saved history entry
            <>
                <h2 className="text-2xl font-medium mb-6 text-ink">{editingEntryId ? 'Edit Entry' : 'Update balance'}</h2>
                <form onSubmit={handleSaveAsset} className="space-y-6">
                    <div>
                        <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Date</label>
                        <div className="relative">
                            <input
                                required
                                type="date"
                                name="date"
                                key={editingEntryId || 'new'}
                                defaultValue={updateDate}
                                className="kaya-field transition-all placeholder:text-textFaint"
                            />
                            <Icons.Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-textFaint pointer-events-none" size={20} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Total balance</label>
                        <div className="flex items-center kaya-field kaya-field-wrap transition-all">
                             <span className="text-textFaint font-medium mr-2">{selectedAsset.currency}</span>
                             <input
                                key={editingEntryId || 'new'}
                                required
                                name="amount"
                                type="number"
                                step="any"
                                placeholder="0.00"
                                defaultValue={editingEntry ? editingEntry.amount : undefined}
                                className="w-full bg-transparent border-none text-ink text-2xl font-medium p-2 outline-none placeholder:text-textFaint"
                                autoFocus
                            />
                        </div>
                        <p className="text-[12px] leading-[18px] text-textFaint mt-2">Enter your total balance on this date, not a deposit. Logging income doesn't change it.</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        {editingEntryId && (
                            <button
                                type="button"
                                onClick={() => { handleDeleteHistoryEntry(editingEntryId); handleCloseModal(); }}
                                className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold py-4 rounded-[14px] transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.Delete size={18} /> Delete
                            </button>
                        )}
                        <button
                            type="submit"
                            className={`kaya-btn py-4 rounded-[14px] ${editingEntryId ? 'flex-[2]' : 'w-full'}`}
                        >
                            {editingEntryId ? 'Save Entry' : 'Update balance'}
                        </button>
                    </div>
                </form>
            </>
        ) : (
            // VIEW: New Asset OR Edit Metadata
            <>
                <h2 className="text-2xl font-medium mb-6 text-ink">
                    {selectedAsset
                        ? (modalCategory === AssetCategory.DEBT ? 'Edit debt' : 'Edit asset')
                        : (modalCategory === AssetCategory.DEBT ? 'New debt' : 'New asset')}
                </h2>
                {/* Asset | Debt switch. New entries only, so an existing account can't be flipped by accident. */}
                {!selectedAsset && (
                    <div role="radiogroup" aria-label="Type" className="flex p-1 rounded-[14px] bg-ink/5 -mt-2 mb-6">
                        {([['asset', 'Asset'], ['debt', 'Debt']] as const).map(([k, t]) => {
                            const on = (modalCategory === AssetCategory.DEBT) === (k === 'debt');
                            return (
                                <button key={k} type="button" role="radio" aria-checked={on}
                                    onClick={() => setModalCategory(k === 'debt' ? AssetCategory.DEBT : AssetCategory.BANK_PH)}
                                    className={`flex-1 py-2.5 rounded-[10px] text-[14px] font-medium transition-colors duration-200 ${on ? 'bg-textMuted text-paper' : 'text-textFaint hover:text-ink'}`}>
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                )}
                {modalCategory === AssetCategory.DEBT && (
                    <p className="text-[13px] leading-[19px] text-textFaint -mt-2 mb-6">Loans, credit cards and anything you owe. Kaya subtracts this from your net worth.</p>
                )}
                <form onSubmit={handleSaveAsset} className="space-y-5">
                    <div>
                        <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">{modalCategory === AssetCategory.DEBT ? 'Debt name' : 'Asset name'}</label>
                        <input required name="name" defaultValue={selectedAsset?.name} placeholder={modalCategory === AssetCategory.DEBT ? 'Car loan, BPI credit card' : 'BDO Savings'} className="kaya-field transition-all placeholder:text-textFaint" />
                    </div>
                    
                    {!selectedAsset && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">{modalCategory === AssetCategory.DEBT ? 'Amount owed' : 'Amount'}</label>
                                <input required name="amount" type="number" step="any" placeholder="0.00" className="kaya-field transition-all placeholder:text-textFaint" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Currency</label>
                                <input type="hidden" name="currency" value={modalCurrency} />
                                <CurrencyPicker value={modalCurrency} onChange={setModalCurrency} />
                            </div>
                        </div>
                    )}

                    {modalCategory === AssetCategory.DEBT ? (
                        <input type="hidden" name="category" value={AssetCategory.DEBT} />
                    ) : (
                    <div>
                        <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Category</label>
                        <div className="relative">
                            <select name="category" value={modalCategory} onChange={(e) => setModalCategory(e.target.value as AssetCategory)} className="kaya-field  transition-all">
                                {Object.values(AssetCategory).filter(cat => cat !== AssetCategory.DEBT).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
                        </div>
                    </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">{getInstitutionLabel(modalCategory)} (Optional)</label>
                        <input name="institution" defaultValue={selectedAsset?.institution} placeholder={getInstitutionLabel(modalCategory)} className="kaya-field transition-all placeholder:text-textFaint" />
                    </div>

                    {modalCategory !== AssetCategory.DEBT && (
                        <div>
                            <label className="block text-[11px] font-medium text-textMuted mb-2 uppercase tracking-[1.2px]">Liquidity (Optional)</label>
                            <div className="relative">
                                <select name="liquidity" defaultValue={selectedAsset?.liquidity ?? 'auto'} className="kaya-field  transition-all">
                                    <option value="auto">Auto · {CATEGORY_LIQUIDITY[modalCategory] ?? 'medium'} (by category)</option>
                                    <option value="high">High · cash-like, reachable in a day</option>
                                    <option value="medium">Medium · sellable in days</option>
                                    <option value="low">Low · locked / long-term</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
                            </div>
                            <p className="text-[11px] text-textFaint mt-1.5">Sets the "accessible now" split. Leave on Auto unless this account is unusual.</p>
                        </div>
                    )}

                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                        <span className="min-w-0">
                            <span className="block text-[11px] font-medium text-textMuted uppercase tracking-[1.2px]">Exclude from net worth</span>
                            <span className="block text-[11px] text-textFaint mt-1">Still tracked, but not added to your total.</span>
                        </span>
                        <input type="checkbox" name="excluded" defaultChecked={selectedAsset?.excluded} className="peer sr-only" />
                        <span className="shrink-0 w-11 h-6 rounded-full bg-ink/15 peer-checked:bg-textMuted relative transition-colors duration-200 after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:transition-all after:duration-200 after:bg-textFaint peer-checked:after:bg-paper peer-checked:after:translate-x-5" />
                    </label>

                    <div className="flex gap-3 pt-4">
                        {selectedAsset && (
                            <button type="button" onClick={handleDeleteAsset} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold py-4 rounded-[14px] transition-colors flex items-center justify-center gap-2"><Icons.Delete size={18} /> Delete</button>
                        )}
                        <button type="submit" className={`flex-[2] kaya-btn py-4 rounded-[14px] ${!selectedAsset ? 'w-full' : ''}`}>
                            {selectedAsset ? 'Save Changes' : (modalCategory === AssetCategory.DEBT ? 'Add debt' : 'Add asset')}
                        </button>
                    </div>
                </form>
            </>
        )}
      </Modal>

    </div>
  );
}

// "Liabilities" is the stored value (kept so saved data still matches); people see "Debts".
function catLabel(category: AssetCategory | string) {
    return category === AssetCategory.DEBT ? 'Debts' : category;
}

function getInstitutionLabel(category: AssetCategory) {
    switch (category) {
        case AssetCategory.BANK_PH:
        case AssetCategory.BANK_INTL:
            return 'Bank Name';
        case AssetCategory.CRYPTO:
            return 'Wallet / Exchange';
        case AssetCategory.STOCKS:
            return 'Brokerage';
        case AssetCategory.PENSION:
            return 'Provider / Fund';
        case AssetCategory.DEBT:
            return 'Lender';
        default:
            return 'Institution / Platform';
    }
}

function getCurrencySymbol(currency: string) {
    return symbolFor(currency);
}