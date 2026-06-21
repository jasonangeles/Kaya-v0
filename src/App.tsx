import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from './components/icons';
import { NetWorthChart } from './components/NetWorthChart';
import { IncomeTracker } from './components/IncomeTracker';
import { LockScreen, SetPinSheet, RecoverySheet, RecoveryCodeSheet, generateRecoveryCode, hashRecoveryCode, isBiometricAvailable, registerBiometric } from './components/AppLock';
import { Landing } from './components/Landing';
import { InstitutionLogo } from './components/InstitutionLogo';
import { AllocationCarousel } from './components/AllocationCarousel';
import { CurrencyPicker } from './components/CurrencyPicker';
import { Sym, DirhamSign } from './components/DirhamSign';
import { ORDERED_CURRENCIES, COMMON_CURRENCY_CODES, symbolFor } from './data/currencies';
import { supabase, isSupabaseEnabled } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Asset, Currency, AssetCategory, UserSettings, TimeRange, AssetHistoryEntry, IncomeRecord, Liquidity } from './types';
import { RATES, BTC_PRICE_USD } from './services/mockDataService';
import { buildNetWorthSeries } from './services/history';
import { getLiveRates } from './services/fxService';
import { getWealthInsights } from './services/geminiService';

// --- Helper Components ---

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children?: React.ReactNode }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)' }}
        className="fixed bottom-0 inset-x-0 z-50 bg-surface3 border-t border-ink/10 rounded-t-3xl p-6 shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto max-w-md mx-auto"
      >
        <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-ink">✕</button>
        {isOpen ? children : null}
      </div>
    </>
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
  const iconColorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
  const iconBgClass = isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10';

  return (
    <div className="relative overflow-hidden group">
      <div
        className={`absolute inset-y-0 right-0 w-full bg-red-500/20 flex items-center justify-end px-6 rounded-none transition-opacity duration-200 ${offset < -10 ? 'opacity-100' : 'opacity-0'}`}
      >
        <Icons.Delete className="text-red-500" size={20} />
      </div>

      <div
        className={`relative bg-surface2 p-4 flex justify-between items-center transition-transform duration-200 ease-out cursor-pointer select-none ${!isLast ? 'border-b border-ink/5' : ''}`}
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
        <div className="flex items-center gap-3 pointer-events-none">
          <div className={`p-2 rounded-xl border border-ink/5 ${iconBgClass} ${iconColorClass}`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className={`text-xs ${entry.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {entry.change > 0 ? '+' : ''}{entry.change.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="text-right pointer-events-none">
          <p className="text-sm font-medium text-ink">
            <Sym code={currency} />{entry.amount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsGroup = ({ title, children }: { title?: string, children?: React.ReactNode }) => (
  <div className="mb-6">
    {title && <h4 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2 px-2">{title}</h4>}
    <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
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
          className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${isToggled ? 'bg-ink' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-200 shadow-sm ${isToggled ? 'left-6 bg-paper' : 'left-1 bg-ink'}`} />
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

// Muted, on-brand allocation colors. Crypto/BTC keeps its signature orange.
const TYPE_COLORS: Record<string, string> = {
  [AssetCategory.CRYPTO]: '#F7931A',
  [AssetCategory.BANK_PH]: '#10b981',
  [AssetCategory.BANK_INTL]: '#5eead4',
  [AssetCategory.STOCKS]: '#e4e4e7',
  [AssetCategory.CASH]: '#a1a1aa',
  [AssetCategory.REAL_ESTATE]: '#71717a',
  [AssetCategory.PENSION]: '#94a3b8',
  [AssetCategory.OTHER]: '#52525b'
};
const ALLOC_PALETTE = ['#10b981', '#e4e4e7', '#5eead4', '#a1a1aa', '#71717a', '#34d399', '#d4d4d8', '#52525b'];

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

const SYNC_KEY = 'kaya.syncedAt';
const getSyncedAt = () => { try { return localStorage.getItem(SYNC_KEY) || ''; } catch { return ''; } };
const setSyncedAt = (t: string) => { try { localStorage.setItem(SYNC_KEY, t); } catch {} };

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
  const [settings, setSettings] = useState<UserSettings>(() => loadStored(STORAGE_KEYS.settings, {
    displayCurrency: Currency.PHP,
    showInBTC: false,
    onboardingComplete: true,
    streakDays: 0,
    lastLogin: new Date().toISOString()
  }));

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

  // --- Supabase auth + cloud sync (no-op unless env keys are set) ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseEnabled);
  const [cloudLoaded, setCloudLoaded] = useState(false);

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
      const { data } = await supabase!.from('kaya_data').select('data, updated_at').eq('user_id', uid).maybeSingle();
      if (!active) return;

      if (!data) {
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
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split('T')[0]);
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
    const segs = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, usd], i) => ({
        key,
        pct: (usd / total) * 100,
        usd,
        color: allocMode === 'TYPE'
          ? (TYPE_COLORS[key] || ALLOC_PALETTE[i % ALLOC_PALETTE.length])
          : (key === Currency.BTC ? '#F7931A' : ALLOC_PALETTE[i % ALLOC_PALETTE.length])
      }));
    return segs;
  }, [assets, rates, allocMode]);

  const fmtDisplay = (usd: number) => {
    const display = settings.displayCurrency;
    if (display === Currency.BTC) return `₿${(btcUsd ? usd / btcUsd : 0).toFixed(4)}`;
    return `${getCurrencySymbol(display)}${Math.round(usd * (rates[display] || 1)).toLocaleString()}`;
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
      if (assets.length === 0) { setInsights([]); setIsLoadingInsights(false); return; }
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

  const handleOpenUpdateBalance = () => {
    setIsEditMode(false);
    setEditingEntryId(null);
    setUpdateDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditHistoryEntry = (entry: AssetHistoryEntry) => {
    setIsEditMode(false);
    setEditingEntryId(entry.id);
    setUpdateDate(entry.date.split('T')[0]);
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

  const handleSaveAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        <div className="pb-28 animate-[fadeIn_0.3s_ease-out]">
            <div className="glass-panel rounded-t-[32px] rounded-b-3xl p-5 mb-6 relative overflow-visible shadow-lg z-20">
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
                    <p className="text-textMuted text-xs font-medium tracking-widest uppercase">
                        {selectedAsset.name}
                    </p>
                    {selectedAsset.institution && (
                        <p className="text-textFaint text-xs font-medium tracking-widest uppercase">{selectedAsset.institution}</p>
                    )}
                    <div className="flex items-baseline gap-1 mt-1.5">
                        <span className="text-2xl font-normal text-textFaint">
                            <Sym code={selectedAsset.currency} />
                        </span>
                        <span className="text-4xl font-medium text-ink tracking-tight">
                            {selectedAsset.amount.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="h-28 -mx-4 mt-2">
                    <NetWorthChart 
                        data={assetHistoryData}
                        mode={selectedAsset.currency === Currency.BTC ? 'BTC' : 'FIAT'}
                        displayCurrency={selectedAsset.currency}
                        timeRange={selectedTimeRange}
                    />
                </div>

                <div className="flex justify-between items-center bg-surface2 rounded-full p-0.5 mt-2">
                    {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setSelectedTimeRange(range)}
                            className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all ${
                                selectedTimeRange === range 
                                ? 'bg-surfaceHi text-ink shadow-sm' 
                                : 'text-textFaint hover:text-ink'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                 </div>
            </div>

            <div className="px-1">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">Value History</h3>
                    <button 
                        onClick={handleOpenUpdateBalance}
                        className="px-3 py-1.5 rounded-full bg-ink/5 text-xs font-medium text-ink hover:bg-ink/10 transition-colors border border-ink/5"
                    >
                        Add
                    </button>
                </div>

                <div className="rounded-3xl overflow-hidden shadow-lg bg-surface2 border border-ink/5">
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

  const renderHome = () => (
    <div className="space-y-6 pb-28 animate-[fadeIn_0.5s_ease-out]">
      <header className="flex justify-between items-center px-1">
        <div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <h1 className="text-lg font-medium tracking-wide text-ink uppercase">Kaya</h1>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button
                onClick={toggleTheme}
                aria-label="Toggle light or dark mode"
                className="glass-panel w-8 h-8 flex items-center justify-center rounded-full text-textMuted hover:text-ink transition-colors shadow-sm"
            >
                {theme === 'dark' ? <Icons.Moon size={15} /> : <Icons.Sun size={15} />}
            </button>
            {currentStreak > 0 && (
            <div className="relative">
                <button
                    onClick={() => setShowStreakTooltip(!showStreakTooltip)}
                    className="flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-full text-xs font-medium text-textMuted shadow-sm hover:text-ink transition-colors"
                >
                    <Icons.Fire className="w-3.5 h-3.5 animate-pulse text-[#F7931A]" weight="fill" />
                    <span>{currentStreak}</span>
                </button>
                {showStreakTooltip && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStreakTooltip(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-surface3 border border-ink/10 rounded-xl shadow-2xl z-50 p-3 animate-[fadeIn_0.1s_ease-out]">
                            <p className="text-ink text-xs font-semibold mb-1">Monthly Streak</p>
                            <p className="text-[10px] text-textMuted leading-relaxed">
                                You've logged your wealth {currentStreak} {currentStreak === 1 ? 'month' : 'months'} in a row. Log again next month to keep it going!
                            </p>
                        </div>
                    </>
                )}
            </div>
            )}
        </div>
      </header>

      <div className="glass-panel rounded-3xl p-4 relative overflow-visible shadow-lg z-20">
         <div className="flex justify-between items-start mb-0 relative">
            <div className="flex-1">
                 <div className="flex items-center gap-2 mb-1">
                    <p className="text-textMuted text-xs font-medium tracking-widest uppercase">Net Worth</p>
                    <button
                        onClick={() => setPrivacyMode(!privacyMode)}
                        className="text-textMuted hover:text-ink transition-colors p-1"
                    >
                        {privacyMode ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                    </button>
                 </div>

                 <div className="relative inline-block">
                    <h2
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className={`flex items-baseline cursor-pointer hover:opacity-80 transition-opacity gap-1 ${settings.displayCurrency === Currency.BTC ? 'text-[#F7931A]' : 'text-ink'}`}
                    >
                        <span className="text-3xl font-normal text-textFaint font-sans">{settings.displayCurrency === 'AED' ? <DirhamSign /> : totalValueParts.symbol}</span>
                        <span className="text-4xl font-medium font-sans tracking-tight">{totalValueParts.value}</span>
                        <Icons.ChevronDown className="w-4 h-4 self-center text-textFaint ml-0.5" />
                    </h2>
                    {isCurrencyDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-44 max-h-64 overflow-y-auto no-scrollbar bg-surface3 border border-ink/10 rounded-xl shadow-2xl z-50 animate-[fadeIn_0.1s_ease-out]">
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

                 {netChange !== null && !privacyMode && (
                   <div className="mt-1 flex items-center gap-2">
                      <span className={`text-sm font-medium flex items-center gap-1 ${netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netChange >= 0 ? <Icons.Trend size={14} /> : <Icons.TrendDown size={14} />} {netChange >= 0 ? '+' : ''}{netChange.toFixed(1)}%
                      </span>
                      <span className="text-textMuted text-xs">{rangeLabel[selectedTimeRange]}</span>
                   </div>
                 )}
            </div>
         </div>
         <div className="h-28 -mx-4 mt-2">
            <NetWorthChart
                data={historyData}
                mode={settings.displayCurrency === Currency.BTC ? 'BTC' : 'FIAT'}
                displayCurrency={settings.displayCurrency}
                timeRange={selectedTimeRange}
            />
         </div>
         <div className="flex justify-between items-center bg-surface2 rounded-full p-0.5 mt-2">
            {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all ${
                        selectedTimeRange === range 
                        ? 'bg-surfaceHi text-ink shadow-sm' 
                        : 'text-textFaint hover:text-ink'
                    }`}
                >
                    {range}
                </button>
            ))}
         </div>
      </div>

      <div className="px-1">
          <div className="flex justify-between items-end mb-3">
             <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">Top Assets</h3>
             <button 
                onClick={() => setActiveTab('ASSETS')}
                className="text-xs text-primary font-medium hover:text-ink transition-colors"
             >
                See All
             </button>
          </div>
          <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
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
                    className={`p-4 flex justify-between items-center hover:bg-ink/5 transition-colors cursor-pointer group ${index !== topAssets.length - 1 ? 'border-b border-ink/5' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <InstitutionLogo name={asset.institution} category={asset.category} size={36} radius={10} />
                        <div>
                            <p className="font-medium text-ink text-sm">{asset.name}</p>
                            <p className="text-[10px] text-textMuted">{asset.institution}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-ink text-sm tracking-wide">
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

      <div className="px-1">
          <div className="flex justify-between items-end mb-3">
             <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">Currency Rates</h3>
             <button
                onClick={openFxEdit}
                className="text-xs text-primary font-medium hover:text-ink transition-colors"
             >
                Edit
             </button>
          </div>
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
             <div className="grid grid-cols-3 gap-2">
                {fxPairs.map((p, i) => (
                    <div key={i} className="text-center">
                        <p className="text-[11px] text-textMuted mb-1">{p.first}/{p.second}</p>
                        <p className="text-lg font-semibold text-ink tabular-nums">{fxRate(p.first, p.second)}</p>
                    </div>
                ))}
             </div>
          </div>
      </div>

      {assets.length > 0 && (
      <div className="px-1">
        <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-3">Insights</h3>
        {isLoadingInsights ? (
            <div className="p-4 rounded-3xl glass-panel animate-pulse h-24"></div>
        ) : (
            <div
                className="glass-panel rounded-3xl relative overflow-hidden select-none shadow-lg cursor-grab active:cursor-grabbing"
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
                                : 'bg-zinc-700 hover:bg-zinc-600'
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
        className={`p-5 flex justify-between items-center hover:bg-ink/5 transition-colors cursor-pointer group ${!isLast ? 'border-b border-ink/5' : ''}`}
    >
        <div className="flex items-center gap-4 min-w-0">
            <InstitutionLogo name={asset.institution} category={asset.category} size={44} radius={12} className="group-hover:border-primary/50 transition-colors" />
            <div className="min-w-0">
                <p className="font-medium text-ink text-base truncate">{asset.name}</p>
                {showCat ? (
                    <span className="flex items-center gap-1.5 mt-1 min-w-0">
                        <span
                            className="text-[9px] leading-none px-1.5 py-[3px] rounded-full shrink-0"
                            style={isLiquid(asset)
                                ? { background: 'rgba(16,185,129,0.10)', color: '#5fb89a' }
                                : { background: 'rgba(148,163,184,0.12)', color: '#8d9bad' }}
                        >
                            {asset.category}
                        </span>
                        {asset.institution && <span className="text-[10px] text-textFaint truncate">{asset.institution}</span>}
                    </span>
                ) : (
                    <p className="text-xs text-textMuted mt-0.5">{asset.institution}</p>
                )}
            </div>
        </div>
        <div className="text-right shrink-0">
            <p className="font-semibold text-ink tracking-wide">
                {privacyMode ? '••••••' : (<><Sym code={asset.currency} />{asset.currency === Currency.BTC ? '' : ' '}{asset.amount.toLocaleString()}</>)}
            </p>
            <p className="text-[10px] text-textMuted mt-1">{new Date(asset.lastUpdated).toLocaleDateString()}</p>
        </div>
    </div>
  );

  const renderPortfolioList = () => (
    <div className="pb-28 space-y-4 animate-[fadeIn_0.5s_ease-out]">
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
                privacyMode={privacyMode}
                allocMode={allocMode}
                onAllocMode={setAllocMode}
            />
        )}

        {/* Read-only passive-income summary (not counted in net worth) */}
        <button
            onClick={() => goTab('INCOME')}
            className="w-full text-left glass-panel rounded-3xl p-4 shadow-lg flex items-center justify-between hover:bg-ink/5 transition-colors mb-2"
        >
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-ink/5">
                    <Icons.BarChart size={18} />
                </div>
                <div>
                    <p className="text-sm font-medium text-ink">Passive income</p>
                    <p className="text-[11px] text-textMuted">Last 12 months · not in net worth</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-emerald-400">
                    {privacyMode ? '••••' : `${getCurrencySymbol(settings.displayCurrency)}${Math.round(passiveIncome12mo).toLocaleString()}`}
                </span>
                <Icons.ChevronRight className="w-4 h-4 text-textFaint" />
            </div>
        </button>

        {assets.length === 0 && (
            <div className="glass-panel rounded-3xl p-8 text-center shadow-lg mt-4">
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
                    {filteredAssets.length === assets.length ? `${assets.length} accounts` : `${filteredAssets.length} of ${assets.length}`}
                </span>
                <button
                    onClick={() => setFilterOpen(true)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtersActive ? 'bg-surfaceHi text-ink border-ink/10' : 'bg-surface2 text-textMuted border-ink/5 hover:text-ink'}`}
                >
                    {filtersActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    Filter
                    <Icons.BarChart size={14} className="rotate-90" />
                </button>
            </div>
        )}

        {filteredSubtotal && filteredAssets.length > 0 && (
            <div className="glass-panel rounded-2xl px-4 py-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] tracking-widest text-textFaint uppercase">Filtered total</span>
                    <span className="text-[11px] text-textFaint">{filteredSubtotal.count} {filteredSubtotal.count === 1 ? 'account' : 'accounts'}</span>
                </div>
                <p className="text-2xl font-semibold text-ink mb-2.5">{privacyMode ? '••••••' : fmtDisplay(filteredSubtotal.usd)}</p>
                {filteredSubtotal.pct !== null && (
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-surface2 mb-2.5">
                        <div style={{ width: `${Math.max(0, Math.min(100, filteredSubtotal.pct))}%`, background: '#10b981' }} />
                    </div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {catFilter.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full"
                            style={c !== AssetCategory.DEBT && (CATEGORY_LIQUIDITY[c] ?? 'medium') !== 'low'
                                ? { background: 'rgba(16,185,129,0.10)', color: '#5fb89a' }
                                : { background: 'rgba(148,163,184,0.12)', color: '#8d9bad' }}>
                            {c}
                        </span>
                    ))}
                    {curFilter.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-surface2 text-textMuted">{c}</span>
                    ))}
                    {filteredSubtotal.pct !== null && (
                        <span className="text-[11px] text-textMuted ml-0.5">{filteredSubtotal.pct.toFixed(0)}% of net worth</span>
                    )}
                </div>
            </div>
        )}

        {filteredAssets.length === 0 && assets.length > 0 && (
            <div className="glass-panel rounded-3xl p-8 text-center shadow-lg">
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
                        <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-3 px-1">{category}</h3>
                        <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
                            {categoryAssets.map((asset, index) => assetRow(asset, false, index === categoryAssets.length - 1))}
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
                {sortedFlat.map((asset, index) => assetRow(asset, true, index === sortedFlat.length - 1))}
            </div>
        )}

        {/* Excluded — tracked but not counted toward net worth */}
        {excludedAssets.length > 0 && (
            <div className="mt-2">
                <button onClick={() => setExcludedOpen(o => !o)} className="w-full flex items-center justify-between px-1 py-2 group">
                    <span className="text-xs font-bold text-textMuted uppercase tracking-widest">Excluded · not in net worth ({excludedAssets.length})</span>
                    <Icons.ChevronDown className={`w-4 h-4 text-textFaint transition-transform ${excludedOpen ? 'rotate-180' : ''}`} />
                </button>
                {excludedOpen && (
                    <div className="glass-panel rounded-3xl overflow-hidden shadow-lg opacity-70">
                        {excludedAssets.map((asset, index) => assetRow(asset, true, index === excludedAssets.length - 1))}
                    </div>
                )}
            </div>
        )}

        <Modal isOpen={filterOpen} onClose={() => setFilterOpen(false)}>
            <h2 className="text-xl font-semibold text-ink mb-5">Sort &amp; filter</h2>

            <p className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2">Sort</p>
            <div className="flex bg-surface2 rounded-xl p-1 mb-6">
                {([['CATEGORY', 'Category'], ['VALUE', 'Value'], ['UPDATED', 'Updated'], ['LIQUIDITY', 'Liquidity']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => setSortMode(m)}
                        className={`flex-1 py-2 text-[12px] font-medium rounded-lg transition-all ${sortMode === m ? 'bg-surfaceHi text-ink shadow' : 'text-textFaint hover:text-ink'}`}>
                        {label}
                    </button>
                ))}
            </div>

            <p className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2">Filter</p>

            <p className="text-[11px] text-textFaint mb-2">Category</p>
            <div className="flex flex-wrap gap-2 mb-5">
                {Object.values(AssetCategory).filter(c => assets.some(a => a.category === c)).map(c => (
                    <button key={c} onClick={() => toggleCat(c)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${catFilter.includes(c) ? 'bg-surfaceHi text-ink border-ink/20' : 'bg-surface2 text-textMuted border-ink/5 hover:text-ink'}`}>
                        {c !== AssetCategory.DEBT && <i className="w-2 h-2 rounded-full" style={{ background: (CATEGORY_LIQUIDITY[c] ?? 'medium') === 'low' ? '#94a3b8' : '#10b981' }} />}{c}
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-textFaint mb-2">Currency</p>
            <div className="flex flex-wrap gap-2">
                {portfolioCurrencies.map(c => (
                    <button key={c} onClick={() => toggleCur(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${curFilter.includes(c) ? 'bg-surfaceHi text-ink border-ink/20' : 'bg-surface2 text-textMuted border-ink/5 hover:text-ink'}`}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="flex gap-3 mt-7">
                {filtersActive && (
                    <button type="button" onClick={resetFilters} className="px-5 py-3.5 rounded-xl border border-ink/15 text-ink font-medium hover:bg-ink/5 transition-colors whitespace-nowrap">
                        Reset all
                    </button>
                )}
                <button onClick={() => setFilterOpen(false)} className="flex-1 bg-ink text-paper font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity">
                    Show {filteredAssets.length} {filteredAssets.length === 1 ? 'account' : 'accounts'}
                </button>
            </div>
        </Modal>
    </div>
  );

  const renderCurrencySelection = () => (
    <div className="pb-28 animate-[fadeIn_0.3s_ease-out]">
        <header className="flex items-center gap-4 mb-6 px-1">
            <button 
                onClick={() => setActiveTab('SETTINGS')}
                className="p-2 -ml-2 rounded-full hover:bg-ink/5 text-textMuted hover:text-ink transition-colors"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-medium text-ink">Select Currency</h1>
        </header>

        <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
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
    <div className="pb-28 animate-[fadeIn_0.5s_ease-out]">
      <header className="mb-8 px-1">
        <h1 className="text-3xl font-medium text-ink">Settings</h1>
      </header>

      {/* Premium Banner */}
      <div className="mb-8 relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-ink/10 shadow-lg cursor-pointer transform transition-transform active:scale-95">
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-1">Kaya Premium</h3>
          <p className="text-white/70 text-sm">Unlock unlimited history & AI insights.</p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-20 text-white">
           <Icons.Sparkles size={64} />
        </div>
      </div>

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

      <SettingsGroup title="Support">
        <SettingsItem icon={<Icons.Feedback size={20} />} label="Share feedback" onClick={() => { setFeedbackStatus('idle'); setShowFeedback(true); }} />
        <SettingsItem icon={<Icons.Shield size={20} />} label="Privacy & Data" onClick={() => setShowPrivacy(true)} />
        <SettingsItem icon={<Icons.Star size={20} />} label="Rate Kaya" onClick={() => window.open('https://www.producthunt.com/products/kaya-wealth/reviews', '_blank', 'noopener,noreferrer')} />
        <SettingsItem icon={<Icons.Mail size={20} />} label="Contact Us" onClick={() => { setContactStatus('idle'); setShowContact(true); }} isLast />
      </SettingsGroup>

      {isSupabaseEnabled && session && (
        <SettingsGroup title="Account">
          <SettingsItem icon={<Icons.Mail size={20} />} label="Signed in" value={session.user.email || ''} />
          <SettingsItem icon={<Icons.ArrowLeftRight size={20} />} label="Sign out" onClick={handleSignOut} isLast />
        </SettingsGroup>
      )}

      <div className="text-center mt-8 text-textFaint text-xs">
        <p>Kaya Wealth v1.1.0</p>
        <p className="mt-1">{isSupabaseEnabled ? 'Cloud sync on' : 'Local only'}</p>
      </div>
    </div>
  );

  if (isSupabaseEnabled && authLoading) {
    return <div className="h-[100dvh] bg-paper" />;
  }
  if (isSupabaseEnabled && !session) {
    return <Landing />;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-transparent text-textMain max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans">

      {/* Scrollable Content Area */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-6">
        {activeTab === 'SETTINGS' ? renderSettings() :
         activeTab === 'SETTINGS_CURRENCY' ? renderCurrencySelection() :
         activeTab === 'INCOME' ? <IncomeTracker displayCurrency={settings.displayCurrency} privacyMode={privacyMode} addTick={incomeAddTick} rates={rates} records={income} onRecordsChange={(next) => { if (next.length > income.length) registerStreakActivity(); setIncome(next); }} /> :
         selectedAssetId ? renderAssetDetail() :
         activeTab === 'ASSETS' ? renderPortfolioList() :
         renderHome()}
      </main>

      {/* Bottom bar: FAB anchored one equal gap above the nav */}
      <div className="shrink-0 relative z-40">
        {activeTab !== 'SETTINGS' && activeTab !== 'SETTINGS_CURRENCY' && (
          <div className="absolute right-6 bottom-full mb-6 z-30">
            <button
                onClick={() => {
                  if (activeTab === 'INCOME') setIncomeAddTick(t => t + 1);
                  else if (selectedAssetId) handleOpenUpdateBalance();
                  else handleOpenAddAsset();
                }}
                className="bg-ink text-paper w-14 h-14 rounded-2xl shadow-lg shadow-black/40 transition-all active:scale-95 flex items-center justify-center"
            >
                <Icons.Add className="w-7 h-7" />
            </button>
          </div>
        )}

        {/* Bottom Navigation (icons only) */}
        <nav className="w-full glass-panel pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-8 flex justify-around items-center">
          <button aria-label="Overview" onClick={() => goTab('HOME')} className={`p-2 ${activeTab === 'HOME' ? 'text-primary' : 'text-textFaint'}`}>
              <Icons.Dashboard className="w-6 h-6" weight={activeTab === 'HOME' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Portfolio" onClick={() => goTab('ASSETS')} className={`p-2 ${activeTab === 'ASSETS' ? 'text-primary' : 'text-textFaint'}`}>
              <Icons.Wallet className="w-6 h-6" weight={activeTab === 'ASSETS' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Income" onClick={() => goTab('INCOME')} className={`p-2 ${activeTab === 'INCOME' ? 'text-primary' : 'text-textFaint'}`}>
              <Icons.BarChart className="w-6 h-6" weight={activeTab === 'INCOME' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Settings" onClick={() => goTab('SETTINGS')} className={`p-2 ${(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 'text-primary' : 'text-textFaint'}`}>
              <Icons.Settings className="w-6 h-6" weight={(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 'fill' : 'regular'} />
          </button>
        </nav>
      </div>

      {/* Undo Toast */}
      {showUndoToast && lastDeletedAsset && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 bg-surface3 border border-ink/10 shadow-2xl rounded-xl px-6 py-4 flex items-center gap-4 min-w-[320px] animate-[fadeIn_0.3s_ease-out]">
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3"><Icons.Check size={22} /></div>
            <h2 className="text-2xl font-medium text-ink mb-1">Thank you!</h2>
            <p className="text-textMuted text-sm">Your feedback helps shape Kaya.</p>
            <button onClick={() => { setShowFeedback(false); setFeedbackStatus('idle'); }} className="w-full bg-ink text-paper font-bold py-4 rounded-xl mt-6 hover:opacity-90 transition-opacity">Done</button>
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
              className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink outline-none focus:border-ink/40 transition-all resize-none placeholder:text-textFaint"
            />
            <button
              onClick={submitFeedback}
              disabled={!feedbackText.trim() || feedbackStatus === 'sending'}
              className="w-full bg-ink text-paper font-bold py-4 rounded-xl mt-3 hover:opacity-90 transition-opacity disabled:opacity-50"
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3"><Icons.Check size={22} /></div>
            <h2 className="text-2xl font-medium text-ink mb-1">Message sent</h2>
            <p className="text-textMuted text-sm">Thanks for reaching out — I'll get back to you if you left an email.</p>
            <button onClick={() => { setShowContact(false); setContactStatus('idle'); }} className="w-full bg-ink text-paper font-bold py-4 rounded-xl mt-6 hover:opacity-90 transition-opacity">Done</button>
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
              className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink outline-none focus:border-ink/40 transition-all resize-none placeholder:text-textFaint"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Your email (optional, so I can reply)"
              className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 mt-3 text-ink outline-none focus:border-ink/40 transition-all placeholder:text-textFaint"
            />
            {contactStatus === 'error' && <p className="text-rose-400 text-sm mt-2">Couldn't send — please try again.</p>}
            <button
              onClick={submitContact}
              disabled={!contactText.trim() || contactStatus === 'sending'}
              className="w-full bg-ink text-paper font-bold py-4 rounded-xl mt-3 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {contactStatus === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </>
        )}
      </Modal>

      {/* Auto-lock delay picker */}
      <Modal isOpen={showAutoLock} onClose={() => setShowAutoLock(false)}>
        <h2 className="text-2xl font-medium mb-1 text-ink">Auto-lock</h2>
        <p className="text-textMuted text-sm mb-5">Require your PIN after Kaya has been in the background for…</p>
        <div className="rounded-2xl overflow-hidden bg-surface2 border border-ink/5">
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

      {/* Privacy & Data info */}
      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <h2 className="text-2xl font-medium mb-4 text-ink">Privacy & Data</h2>
        <div className="space-y-4 text-sm text-ink leading-relaxed">
          <p><span className="text-ink font-medium">Your data, your control.</span> Kaya is a manual tracker — it never links to your bank, so there are no banking logins or account access to expose. You enter your balances and income yourself.</p>
          <p>A copy is kept on your device so the app works offline. When you sign in, your data syncs to your private account, isolated so no other user can read it, and encrypted in transit and at rest.</p>
          <p>We use passwordless email sign-in, so there's no password to steal. You can export a backup or wipe everything anytime in <span className="text-ink">Settings → Data</span>. No ads, ever.</p>
        </div>
        <button onClick={() => setShowPrivacy(false)} className="w-full bg-ink text-paper shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity mt-6">
          Got it
        </button>
      </Modal>

      {/* Currency Rates editor */}
      <Modal isOpen={showFxEdit} onClose={() => setShowFxEdit(false)}>
        <h2 className="text-2xl font-medium mb-6 text-ink">Currency Rates</h2>
        <div className="space-y-6">
          {fxDraft.map((p, i) => (
            <div key={i}>
              <h4 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2">Rate {i + 1}</h4>
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
          <button onClick={saveFx} className="w-full bg-ink text-paper shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity">
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
                <h2 className="text-2xl font-medium mb-6 text-ink">{editingEntryId ? 'Edit Entry' : 'Add Balance'}</h2>
                <form onSubmit={handleSaveAsset} className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Date</label>
                        <div className="relative">
                            <input 
                                required 
                                type="date"
                                name="date"
                                value={updateDate}
                                onChange={(e) => setUpdateDate(e.target.value)}
                                className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-textFaint" 
                            />
                            <Icons.Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-textFaint pointer-events-none" size={20} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">New Balance</label>
                        <div className="flex items-center bg-surface2 border border-ink/10 rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
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
                    </div>

                    <div className="flex gap-3 pt-2">
                        {editingEntryId && (
                            <button
                                type="button"
                                onClick={() => { handleDeleteHistoryEntry(editingEntryId); handleCloseModal(); }}
                                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.Delete size={18} /> Delete
                            </button>
                        )}
                        <button
                            type="submit"
                            className={`bg-ink text-paper shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity ${editingEntryId ? 'flex-[2]' : 'w-full'}`}
                        >
                            {editingEntryId ? 'Save Entry' : 'Add Balance'}
                        </button>
                    </div>
                </form>
            </>
        ) : (
            // VIEW: New Asset OR Edit Metadata
            <>
                <h2 className="text-2xl font-medium mb-6 text-ink">
                    {selectedAsset
                        ? (modalCategory === AssetCategory.DEBT ? 'Edit Liability' : 'Edit Asset')
                        : (modalCategory === AssetCategory.DEBT ? 'New Liability' : 'New Asset')}
                </h2>
                <form onSubmit={handleSaveAsset} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">{modalCategory === AssetCategory.DEBT ? 'Liability Name' : 'Asset Name'}</label>
                        <input required name="name" defaultValue={selectedAsset?.name} placeholder={modalCategory === AssetCategory.DEBT ? 'e.g., Car Loan' : 'e.g., BDO Savings'} className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-textFaint" />
                    </div>
                    
                    {!selectedAsset && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">{modalCategory === AssetCategory.DEBT ? 'Amount Owed' : 'Amount'}</label>
                                <input required name="amount" type="number" step="any" placeholder="0.00" className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-textFaint" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Currency</label>
                                <input type="hidden" name="currency" value={modalCurrency} />
                                <CurrencyPicker value={modalCurrency} onChange={setModalCurrency} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Category</label>
                        <div className="relative">
                            <select name="category" value={modalCategory} onChange={(e) => setModalCategory(e.target.value as AssetCategory)} className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink outline-none appearance-none focus:border-primary transition-all">
                                {Object.values(AssetCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">{getInstitutionLabel(modalCategory)} (Optional)</label>
                        <input name="institution" defaultValue={selectedAsset?.institution} placeholder={getInstitutionLabel(modalCategory)} className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-textFaint" />
                    </div>

                    {modalCategory !== AssetCategory.DEBT && (
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Liquidity (Optional)</label>
                            <div className="relative">
                                <select name="liquidity" defaultValue={selectedAsset?.liquidity ?? 'auto'} className="w-full bg-surface2 border border-ink/10 rounded-xl p-4 text-ink outline-none appearance-none focus:border-primary transition-all">
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
                            <span className="block text-xs font-medium text-textMuted uppercase tracking-wider">Exclude from net worth</span>
                            <span className="block text-[11px] text-textFaint mt-1">Still tracked, but not added to your total.</span>
                        </span>
                        <input type="checkbox" name="excluded" defaultChecked={selectedAsset?.excluded} className="peer sr-only" />
                        <span className="shrink-0 w-11 h-6 rounded-full bg-zinc-700 peer-checked:bg-ink relative transition-colors duration-200 after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:shadow-sm after:transition-all after:duration-200 after:bg-ink peer-checked:after:bg-paper peer-checked:after:translate-x-5" />
                    </label>

                    <div className="flex gap-3 pt-4">
                        {selectedAsset && (
                            <button type="button" onClick={handleDeleteAsset} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"><Icons.Delete size={18} /> Delete</button>
                        )}
                        <button type="submit" className={`flex-[2] bg-ink text-paper shadow-lg shadow-black/40 font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity ${!selectedAsset ? 'w-full' : ''}`}>
                            {selectedAsset ? 'Save Changes' : (modalCategory === AssetCategory.DEBT ? 'Add Liability' : 'Add Asset')}
                        </button>
                    </div>
                </form>
            </>
        )}
      </Modal>

    </div>
  );
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