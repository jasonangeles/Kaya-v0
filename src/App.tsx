import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from './components/icons';
import { NetWorthChart } from './components/NetWorthChart';
import { IncomeTracker } from './components/IncomeTracker';
import { LockScreen, SetPinSheet, RecoverySheet, RecoveryCodeSheet, generateRecoveryCode, hashRecoveryCode, isBiometricAvailable, registerBiometric } from './components/AppLock';
import { AuthScreen } from './components/AuthScreen';
import { CurrencyPicker } from './components/CurrencyPicker';
import { Sym, DirhamSign } from './components/DirhamSign';
import { ORDERED_CURRENCIES, COMMON_CURRENCY_CODES, symbolFor } from './data/currencies';
import { supabase, isSupabaseEnabled } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Asset, Currency, AssetCategory, UserSettings, TimeRange, AssetHistoryEntry, IncomeRecord } from './types';
import { RATES, INITIAL_ASSETS, generateHistory, BTC_PRICE_USD } from './services/mockDataService';
import { getLiveRates } from './services/fxService';
import { getWealthInsights } from './services/geminiService';

// --- Helper Components ---

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children?: React.ReactNode }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)' }}
        className="fixed bottom-0 inset-x-0 z-50 bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto max-w-md mx-auto"
      >
        <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-white">✕</button>
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
        className={`relative bg-[#0e0e0e] p-4 flex justify-between items-center transition-transform duration-200 ease-out cursor-pointer select-none ${!isLast ? 'border-b border-white/5' : ''}`}
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
          <div className={`p-2 rounded-xl border border-white/5 ${iconBgClass} ${iconColorClass}`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className={`text-xs ${entry.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {entry.change > 0 ? '+' : ''}{entry.change.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="text-right pointer-events-none">
          <p className="text-sm font-medium text-zinc-300">
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
    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${!isLast ? 'border-b border-white/5' : ''}`}
  >
    <div className="flex items-center gap-3">
      {icon && <div className="text-primary">{icon}</div>}
      <span className="text-white text-sm font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {value && <span className="text-textMuted text-sm">{value}</span>}
      {toggle && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
          className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${isToggled ? 'bg-white' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-200 shadow-sm ${isToggled ? 'left-6 bg-black' : 'left-1 bg-white'}`} />
        </div>
      )}
      {!toggle && <Icons.ChevronRight className="w-4 h-4 text-zinc-600" />}
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
  [AssetCategory.OTHER]: '#52525b'
};
const ALLOC_PALETTE = ['#10b981', '#e4e4e7', '#5eead4', '#a1a1aa', '#71717a', '#34d399', '#d4d4d8', '#52525b'];
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
  const [assets, setAssets] = useState<Asset[]>(() => loadStored(STORAGE_KEYS.assets, INITIAL_ASSETS));
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
      if (Array.isArray(d.assets)) setAssets(d.assets);
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
  const [allocMode, setAllocMode] = useState<'TYPE' | 'CURRENCY'>('TYPE');
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

  // Security: PIN + optional biometric unlock, persisted locally.
  const [security, setSecurity] = useState<{ pin: string | null; biometric: boolean; biometricId: string | null; recoveryHash: string | null }>(
    () => loadStored('kaya.security.v1', { pin: null, biometric: false, biometricId: null, recoveryHash: null })
  );
  const [locked, setLocked] = useState<boolean>(() => !!loadStored<{ pin: string | null }>('kaya.security.v1', { pin: null }).pin);
  const [showSetPin, setShowSetPin] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem('kaya.security.v1', JSON.stringify(security)); } catch {}
  }, [security]);

  // Re-lock when the app is sent to the background (if a PIN is set).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden' && security.pin) setLocked(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [security.pin]);

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
  const historyData = useMemo(() => generateHistory(assets, selectedTimeRange), [assets, selectedTimeRange]);
  
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
        .map(h => {
            // Use the rate locked when the entry was logged; fall back to live.
            const rate = h.rateUsd || rates[selectedAsset.currency] || 1;
            const valUSD = h.amount / rate;
            return {
                date: h.date,
                totalValueUSD: valUSD,
                totalValuePHP: valUSD * (rates.PHP || 1),
                totalValueBTC: 0,
                btcPrice: 0,
                inflationIndex: 0
            };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedAsset, selectedTimeRange, rates]);

  const totalValueUSD = useMemo(() => {
    return assets.reduce((acc, curr) => acc + curr.amount / (rates[curr.currency] || 1), 0);
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
    return [...assets]
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
    assets.filter(a => a.category !== AssetCategory.DEBT && a.amount > 0).forEach(a => {
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
      setIsLoadingInsights(true);
      const totalPHP = totalValueUSD * RATES.PHP;
      const tips = await getWealthInsights(assets, totalPHP);
      setInsights(tips);
      setIsLoadingInsights(false);
    };
    fetchAdvice();
  }, []); 
  
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
        const assetData = {
            name: formData.get('name') as string,
            category: formData.get('category') as AssetCategory,
            institution: formData.get('institution') as string,
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
        if (Array.isArray(data.assets)) setAssets(data.assets);
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
                        className="p-2 -ml-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                    >
                        <Icons.ArrowLeft className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={() => handleOpenEditAssetDetails(selectedAsset)}
                        className="p-2 -mr-2 text-zinc-400 hover:text-white"
                    >
                        <Icons.Edit className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-start mb-2 relative z-10">
                    <p className="text-textMuted text-xs font-medium tracking-widest uppercase">
                        {selectedAsset.name}
                    </p>
                    {selectedAsset.institution && (
                        <p className="text-zinc-600 text-xs font-medium tracking-widest uppercase">{selectedAsset.institution}</p>
                    )}
                    <div className="flex items-baseline gap-1 mt-1.5">
                        <span className="text-2xl font-normal text-zinc-500">
                            <Sym code={selectedAsset.currency} />
                        </span>
                        <span className="text-4xl font-medium text-white tracking-tight">
                            {selectedAsset.amount.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="h-28 -mx-4 mt-2">
                    <NetWorthChart 
                        data={assetHistoryData} 
                        mode="FIAT" 
                        displayCurrency={selectedAsset.currency}
                        timeRange={selectedTimeRange} 
                    />
                </div>

                <div className="flex justify-between items-center bg-black/30 rounded-full p-0.5 mt-2">
                    {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setSelectedTimeRange(range)}
                            className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all ${
                                selectedTimeRange === range 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300'
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
                        className="px-3 py-1.5 rounded-full bg-white/5 text-xs font-medium text-white hover:bg-white/10 transition-colors border border-white/5"
                    >
                        Add
                    </button>
                </div>

                <div className="rounded-3xl overflow-hidden shadow-lg bg-[#0e0e0e] border border-white/5">
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
                <h1 className="text-lg font-medium tracking-wide text-white uppercase">Kaya</h1>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {currentStreak > 0 && (
            <div className="relative">
                <button
                    onClick={() => setShowStreakTooltip(!showStreakTooltip)}
                    className="flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-full text-xs font-medium text-textMuted shadow-sm hover:text-white transition-colors"
                >
                    <Icons.Fire className="w-3.5 h-3.5 animate-pulse text-[#F7931A]" weight="fill" />
                    <span>{currentStreak}</span>
                </button>
                {showStreakTooltip && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStreakTooltip(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 p-3 animate-[fadeIn_0.1s_ease-out]">
                            <p className="text-white text-xs font-semibold mb-1">Monthly Streak</p>
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
                        className="text-textMuted hover:text-white transition-colors p-1"
                    >
                        {privacyMode ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                    </button>
                 </div>

                 <div className="relative inline-block">
                    <h2
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className={`flex items-baseline cursor-pointer hover:opacity-80 transition-opacity gap-1 ${settings.displayCurrency === Currency.BTC ? 'text-[#F7931A]' : 'text-white'}`}
                    >
                        <span className="text-3xl font-normal text-zinc-500 font-sans">{settings.displayCurrency === 'AED' ? <DirhamSign /> : totalValueParts.symbol}</span>
                        <span className="text-4xl font-medium font-sans tracking-tight">{totalValueParts.value}</span>
                        <Icons.ChevronDown className="w-4 h-4 self-center text-zinc-600 ml-0.5" />
                    </h2>
                    {isCurrencyDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-44 max-h-64 overflow-y-auto no-scrollbar bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 animate-[fadeIn_0.1s_ease-out]">
                            {COMMON_CURRENCY_CODES.map(curr => (
                                <button
                                    key={curr}
                                    onClick={() => handleCurrencySelect(curr)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${
                                        settings.displayCurrency === curr
                                        ? 'text-primary font-bold bg-white/5'
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

                 <div className="mt-1 flex items-center gap-2">
                    <span className="text-emerald-400 text-sm font-medium flex items-center gap-1">
                        <Icons.Trend size={14} /> +2.4%
                    </span>
                    <span className="text-textMuted text-xs">past month</span>
                 </div>
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
         <div className="flex justify-between items-center bg-black/30 rounded-full p-0.5 mt-2">
            {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all ${
                        selectedTimeRange === range 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
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
                className="text-xs text-primary font-medium hover:text-white transition-colors"
             >
                See All
             </button>
          </div>
          <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
             {topAssets.length === 0 && (
                <div className="p-6 text-center">
                    <p className="text-white text-sm font-medium mb-0.5">No assets yet</p>
                    <p className="text-textMuted text-xs">Tap the + button to add your first one.</p>
                </div>
             )}
             {topAssets.map((asset, index) => (
                <div
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer group ${index !== topAssets.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-textMuted">
                            {asset.category === AssetCategory.BANK_PH ? <Icons.Bank size={18} /> : 
                             asset.category === AssetCategory.CRYPTO ? <Icons.Crypto size={18} /> : 
                             <Icons.Wallet size={18} />}
                        </div>
                        <div>
                            <p className="font-medium text-white text-sm">{asset.name}</p>
                            <p className="text-[10px] text-textMuted">{asset.institution}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-white text-sm tracking-wide">
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
                className="text-xs text-primary font-medium hover:text-white transition-colors"
             >
                Edit
             </button>
          </div>
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
             <div className="grid grid-cols-3 gap-2">
                {fxPairs.map((p, i) => (
                    <div key={i} className="text-center">
                        <p className="text-[11px] text-textMuted mb-1">{p.first}/{p.second}</p>
                        <p className="text-lg font-semibold text-white tabular-nums">{fxRate(p.first, p.second)}</p>
                    </div>
                ))}
             </div>
          </div>
      </div>

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
                                <span className="w-2 h-2 rounded-full bg-white/90 animate-[subtlePulse_2.8s_ease-in-out_infinite]" />
                             </span>
                             <p className="text-base text-slate-200 font-light leading-relaxed flex-1 min-w-0 break-words whitespace-normal">{tip}</p>
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
    </div>
  );

  const renderPortfolioList = () => (
    <div className="pb-28 space-y-4 animate-[fadeIn_0.5s_ease-out]">
         <header className="mb-6 px-1">
            <h1 className="text-3xl font-medium text-white mb-2">Portfolio</h1>
            <p className="text-sm text-textMuted">Tap to view details</p>
        </header>

        {/* Allocation breakdown */}
        {assets.length > 0 && (
        <div className="glass-panel rounded-3xl p-5 shadow-lg mb-2">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">Allocation</h3>
                <div className="flex bg-black/30 rounded-full p-0.5">
                    {(['TYPE', 'CURRENCY'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setAllocMode(m)}
                            className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all ${allocMode === m ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {m === 'TYPE' ? 'By type' : 'By currency'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-black/30">
                {allocation.map(s => (
                    <div key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.color }} className="h-full" title={`${s.key} ${s.pct.toFixed(0)}%`} />
                ))}
            </div>

            <div className="space-y-2.5">
                {allocation.map(s => (
                    <div key={s.key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-sm text-white truncate">{s.key}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-textMuted">{privacyMode ? '••••' : fmtDisplay(s.usd)}</span>
                            <span className="text-sm font-medium text-white w-10 text-right">{s.pct.toFixed(0)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        )}

        {/* Read-only passive-income summary (not counted in net worth) */}
        <button
            onClick={() => goTab('INCOME')}
            className="w-full text-left glass-panel rounded-3xl p-4 shadow-lg flex items-center justify-between hover:bg-white/5 transition-colors mb-2"
        >
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-white/5">
                    <Icons.BarChart size={18} />
                </div>
                <div>
                    <p className="text-sm font-medium text-white">Passive income</p>
                    <p className="text-[11px] text-textMuted">Last 12 months · not in net worth</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-emerald-400">
                    {privacyMode ? '••••' : `${getCurrencySymbol(settings.displayCurrency)}${Math.round(passiveIncome12mo).toLocaleString()}`}
                </span>
                <Icons.ChevronRight className="w-4 h-4 text-zinc-600" />
            </div>
        </button>

        {assets.length === 0 && (
            <div className="glass-panel rounded-3xl p-8 text-center shadow-lg mt-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 text-white flex items-center justify-center mx-auto mb-3">
                    <Icons.Wallet size={22} />
                </div>
                <p className="text-white font-medium mb-1">No assets yet</p>
                <p className="text-textMuted text-sm">Tap the + button to add your first account, investment, or holding.</p>
            </div>
        )}

        {Object.values(AssetCategory).map(category => {
            const categoryAssets = assets.filter(a => a.category === category);
            if (categoryAssets.length === 0) return null;

            return (
                <div key={category} className="mb-6">
                     <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-3 px-1">{category}</h3>
                    <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
                        {categoryAssets.map((asset, index) => (
                            <div 
                                key={asset.id} 
                                onClick={() => setSelectedAssetId(asset.id)}
                                className={`p-5 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer group ${index !== categoryAssets.length - 1 ? 'border-b border-white/5' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 group-hover:border-primary/50 transition-colors">
                                         {asset.category === AssetCategory.BANK_PH ? <Icons.Bank size={18} /> : 
                                          asset.category === AssetCategory.CRYPTO ? <Icons.Crypto size={18} /> : 
                                          <Icons.Wallet size={18} />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white text-base">{asset.name}</p>
                                        <p className="text-xs text-textMuted mt-0.5">{asset.institution}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-white tracking-wide">
                                        {privacyMode ? '••••••' : (
                                            <>
                                                <Sym code={asset.currency} />{asset.currency === Currency.BTC ? '' : ' '}
                                                {asset.amount.toLocaleString()}
                                            </>
                                        )}
                                    </p>
                                    <p className="text-[10px] text-textMuted mt-1">
                                        {new Date(asset.lastUpdated).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
  );

  const renderCurrencySelection = () => (
    <div className="pb-28 animate-[fadeIn_0.3s_ease-out]">
        <header className="flex items-center gap-4 mb-6 px-1">
            <button 
                onClick={() => setActiveTab('SETTINGS')}
                className="p-2 -ml-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-medium text-white">Select Currency</h1>
        </header>

        <div className="glass-panel rounded-3xl overflow-hidden shadow-lg">
            {ORDERED_CURRENCIES.map((option, index) => (
                <div
                    key={option.code}
                    onClick={() => {
                        setSettings(prev => ({ ...prev, displayCurrency: option.code }));
                        setActiveTab('SETTINGS');
                    }}
                    className={`p-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors ${index !== ORDERED_CURRENCIES.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                    <div className="flex items-center gap-3">
                         <span className={`font-medium w-10 ${settings.displayCurrency === option.code ? 'text-primary' : 'text-white'}`}>{option.code}</span>
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
        <h1 className="text-3xl font-medium text-white">Settings</h1>
      </header>

      {/* Premium Banner */}
      <div className="mb-8 relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 shadow-lg cursor-pointer transform transition-transform active:scale-95">
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-1">Kaya Premium</h3>
          <p className="text-white/60 text-sm">Unlock unlimited history & AI insights.</p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-20 text-white">
           <Icons.Sparkles size={64} />
        </div>
      </div>

      <SettingsGroup title="General">
        <SettingsItem icon={<Icons.Global size={20} />} label="Currency" value={settings.displayCurrency} onClick={() => setActiveTab('SETTINGS_CURRENCY')} />
        <SettingsItem icon={<Icons.Bell size={20} />} label="Notifications" toggle isToggled={notificationsEnabled} onToggle={() => setNotificationsEnabled(!notificationsEnabled)} isLast />
      </SettingsGroup>

      <SettingsGroup title="Security">
        <SettingsItem icon={<Icons.Lock size={20} />} label="App Lock (PIN)" toggle isToggled={!!security.pin} onToggle={handleToggleAppLock} />
        {security.pin && (
          <SettingsItem icon={<Icons.Edit size={20} />} label="Change PIN" onClick={handleChangePin} />
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
        <SettingsItem icon={<Icons.Shield size={20} />} label="Privacy & Data" onClick={() => setShowPrivacy(true)} />
        <SettingsItem icon={<Icons.Star size={20} />} label="Rate Kaya" onClick={() => {}} />
        <SettingsItem icon={<Icons.Mail size={20} />} label="Contact Us" onClick={() => {}} isLast />
      </SettingsGroup>

      {isSupabaseEnabled && session && (
        <SettingsGroup title="Account">
          <SettingsItem icon={<Icons.Mail size={20} />} label="Signed in" value={session.user.email || ''} />
          <SettingsItem icon={<Icons.ArrowLeftRight size={20} />} label="Sign out" onClick={handleSignOut} isLast />
        </SettingsGroup>
      )}

      <div className="text-center mt-8 text-zinc-600 text-xs">
        <p>Kaya Wealth v1.1.0</p>
        <p className="mt-1">{isSupabaseEnabled ? 'Cloud sync on' : 'Local only'}</p>
      </div>
    </div>
  );

  if (isSupabaseEnabled && authLoading) {
    return <div className="h-[100dvh] bg-black" />;
  }
  if (isSupabaseEnabled && !session) {
    return <AuthScreen />;
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
                className="bg-white text-black w-14 h-14 rounded-2xl shadow-lg shadow-black/40 transition-all active:scale-95 flex items-center justify-center"
            >
                <Icons.Add className="w-7 h-7" />
            </button>
          </div>
        )}

        {/* Bottom Navigation (icons only) */}
        <nav className="w-full glass-panel pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-8 flex justify-around items-center">
          <button aria-label="Overview" onClick={() => goTab('HOME')} className={`p-2 ${activeTab === 'HOME' ? 'text-primary' : 'text-zinc-600'}`}>
              <Icons.Dashboard className="w-6 h-6" weight={activeTab === 'HOME' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Portfolio" onClick={() => goTab('ASSETS')} className={`p-2 ${activeTab === 'ASSETS' ? 'text-primary' : 'text-zinc-600'}`}>
              <Icons.Wallet className="w-6 h-6" weight={activeTab === 'ASSETS' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Income" onClick={() => goTab('INCOME')} className={`p-2 ${activeTab === 'INCOME' ? 'text-primary' : 'text-zinc-600'}`}>
              <Icons.BarChart className="w-6 h-6" weight={activeTab === 'INCOME' ? 'fill' : 'regular'} />
          </button>
          <button aria-label="Settings" onClick={() => goTab('SETTINGS')} className={`p-2 ${(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 'text-primary' : 'text-zinc-600'}`}>
              <Icons.Settings className="w-6 h-6" weight={(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 'fill' : 'regular'} />
          </button>
        </nav>
      </div>

      {/* Undo Toast */}
      {showUndoToast && lastDeletedAsset && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900 border border-white/10 shadow-2xl rounded-xl px-6 py-4 flex items-center gap-4 min-w-[320px] animate-[fadeIn_0.3s_ease-out]">
            <span className="text-white text-sm font-medium">Deleted {lastDeletedAsset.name}</span>
            <button onClick={handleUndoDelete} className="ml-auto text-primary font-bold text-sm hover:text-zinc-300 tracking-wide">UNDO</button>
            <button onClick={() => setShowUndoToast(false)} className="text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Hidden inputs for restoring a backup / importing a CSV */}
      <input ref={restoreInputRef} type="file" accept="application/json,.json" onChange={handleRestoreFile} className="hidden" />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="hidden" />

      {/* Privacy & Data info */}
      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <h2 className="text-2xl font-medium mb-4 text-white">Privacy & Data</h2>
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p><span className="text-white font-medium">Your data, your control.</span> Kaya is a manual tracker — it never links to your bank, so there are no banking logins or account access to expose. You enter your balances and income yourself.</p>
          <p>A copy is kept on your device so the app works offline. When you sign in, your data syncs to your private account, isolated so no other user can read it, and encrypted in transit and at rest.</p>
          <p>We use passwordless email sign-in, so there's no password to steal. You can export a backup or wipe everything anytime in <span className="text-white">Settings → Data</span>. No ads, ever.</p>
        </div>
        <button onClick={() => setShowPrivacy(false)} className="w-full bg-white text-black shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity mt-6">
          Got it
        </button>
      </Modal>

      {/* Currency Rates editor */}
      <Modal isOpen={showFxEdit} onClose={() => setShowFxEdit(false)}>
        <h2 className="text-2xl font-medium mb-6 text-white">Currency Rates</h2>
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
          <button onClick={saveFx} className="w-full bg-white text-black shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity">
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
                <h2 className="text-2xl font-medium mb-6 text-white">{editingEntryId ? 'Edit Entry' : 'Add Balance'}</h2>
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
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-700" 
                            />
                            <Icons.Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={20} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">New Balance</label>
                        <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                             <span className="text-zinc-500 font-medium mr-2">{selectedAsset.currency}</span>
                             <input
                                key={editingEntryId || 'new'}
                                required
                                name="amount"
                                type="number"
                                step="any"
                                placeholder="0.00"
                                defaultValue={editingEntry ? editingEntry.amount : undefined}
                                className="w-full bg-transparent border-none text-white text-2xl font-medium p-2 outline-none placeholder:text-zinc-700"
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
                            className={`bg-white text-black shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity ${editingEntryId ? 'flex-[2]' : 'w-full'}`}
                        >
                            {editingEntryId ? 'Save Entry' : 'Add Balance'}
                        </button>
                    </div>
                </form>
            </>
        ) : (
            // VIEW: New Asset OR Edit Metadata
            <>
                <h2 className="text-2xl font-medium mb-6 text-white">
                    {selectedAsset ? 'Edit Asset' : 'New Asset'}
                </h2>
                <form onSubmit={handleSaveAsset} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Asset Name</label>
                        <input required name="name" defaultValue={selectedAsset?.name} placeholder="e.g., BDO Savings" className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-700" />
                    </div>
                    
                    {!selectedAsset && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">Amount</label>
                                <input required name="amount" type="number" step="any" placeholder="0.00" className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-700" />
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
                            <select name="category" value={modalCategory} onChange={(e) => setModalCategory(e.target.value as AssetCategory)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white outline-none appearance-none focus:border-primary transition-all">
                                {Object.values(AssetCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"><Icons.ChevronDown size={20} /></div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-2 uppercase tracking-wider">{getInstitutionLabel(modalCategory)} (Optional)</label>
                        <input name="institution" defaultValue={selectedAsset?.institution} placeholder={getInstitutionLabel(modalCategory)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-700" />
                    </div>

                    <div className="flex gap-3 pt-4">
                        {selectedAsset && (
                            <button type="button" onClick={handleDeleteAsset} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"><Icons.Delete size={18} /> Delete</button>
                        )}
                        <button type="submit" className={`flex-[2] bg-white text-black shadow-lg shadow-black/40 font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity ${!selectedAsset ? 'w-full' : ''}`}>
                            {selectedAsset ? 'Save Changes' : 'Add Asset'}
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
        default:
            return 'Institution / Platform';
    }
}

function getCurrencySymbol(currency: string) {
    return symbolFor(currency);
}