import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from './components/icons';
import { NetWorthChart } from './components/NetWorthChart';
import { IncomeTracker } from './components/IncomeTracker';
import { LockScreen, SetPinSheet, RecoverySheet, RecoveryCodeSheet, generateRecoveryCode, hashRecoveryCode, isBiometricAvailable, registerBiometric } from './components/AppLock';
import { AuthScreen } from './components/AuthScreen';
import { CurrencyPicker } from './components/CurrencyPicker';
import { ORDERED_CURRENCIES, symbolFor } from './data/currencies';
import { supabase, isSupabaseEnabled } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Asset, Currency, AssetCategory, UserSettings, TimeRange, AssetHistoryEntry, IncomeRecord } from './types';
import { RATES, INITIAL_ASSETS, generateHistory, BTC_PRICE_USD } from './services/mockDataService';
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
        className="fixed bottom-0 left-0 w-full z-50 bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto max-w-md mx-auto"
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
        <div className="flex items-center gap-2 text-right">
          <p className="text-sm font-medium text-zinc-300 pointer-events-none">
            {currency === Currency.BTC ? '₿' : getCurrencySymbol(currency)}{entry.amount.toLocaleString()}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete entry"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <Icons.Delete size={16} />
          </button>
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

const STORAGE_KEYS = { assets: 'kaya.assets.v1', settings: 'kaya.settings.v1' };

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
  const [settings, setSettings] = useState<UserSettings>(() => loadStored(STORAGE_KEYS.settings, {
    displayCurrency: Currency.PHP,
    showInBTC: false,
    onboardingComplete: true,
    streakDays: 12,
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

  // On login: pull this user's cloud data, or seed the cloud from local on first run.
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !session) return;
    let active = true;
    (async () => {
      const { data } = await supabase!.from('kaya_data').select('data').eq('user_id', session.user.id).maybeSingle();
      if (!active) return;
      const d: any = data?.data;
      if (d && (Array.isArray(d.assets) || Array.isArray(d.income))) {
        if (Array.isArray(d.assets)) setAssets(d.assets);
        if (Array.isArray(d.income)) setIncome(d.income);
        if (d.settings) setSettings(d.settings);
      } else {
        // First login on this account: migrate whatever is local up to the cloud.
        await supabase!.from('kaya_data').upsert({
          user_id: session.user.id,
          data: { assets, income, settings },
          updated_at: new Date().toISOString()
        });
      }
      setCloudLoaded(true);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Push changes to the cloud (debounced) once the initial load is done.
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !session || !cloudLoaded) return;
    const t = setTimeout(() => {
      supabase!.from('kaya_data').upsert({
        user_id: session.user.id,
        data: { assets, income, settings },
        updated_at: new Date().toISOString()
      });
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
  const [comparisonMode, setComparisonMode] = useState(false);
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
  const mainRef = useRef<HTMLElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

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
            let valUSD = 0;
            if (selectedAsset.currency === Currency.BTC) {
                valUSD = h.amount * BTC_PRICE_USD;
            } else {
                const rate = RATES[selectedAsset.currency] || 1;
                valUSD = h.amount / rate;
            }
            return {
                date: h.date,
                totalValueUSD: valUSD,
                totalValuePHP: valUSD * RATES.PHP,
                totalValueBTC: 0,
                btcPrice: 0,
                inflationIndex: 0
            };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedAsset, selectedTimeRange]);

  const totalValueUSD = useMemo(() => {
    return assets.reduce((acc, curr) => {
      let usdVal = 0;
      if (curr.currency === Currency.BTC) {
        usdVal = curr.amount * BTC_PRICE_USD;
      } else {
        const rate = RATES[curr.currency] || 1;
        usdVal = curr.amount / rate;
      }
      return acc + usdVal;
    }, 0);
  }, [assets]);

  const totalValueParts = useMemo(() => {
    if (privacyMode) return { symbol: '', value: '••••••' };
    if (comparisonMode) {
      return { symbol: '₿', value: (totalValueUSD / BTC_PRICE_USD).toFixed(6) };
    }
    let val = totalValueUSD;
    if (settings.displayCurrency !== Currency.USD) {
         val = totalValueUSD * (RATES[settings.displayCurrency] || 1);
    }
    const parts = new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: settings.displayCurrency 
    }).formatToParts(val);
    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    const value = parts
      .filter(p => p.type !== 'currency' && p.type !== 'literal')
      .map(p => p.value)
      .join('');
    return { symbol, value };
  }, [totalValueUSD, settings.displayCurrency, comparisonMode, privacyMode]);

  const topAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => {
        const getVal = (asset: Asset) => {
           if (asset.currency === Currency.BTC) return asset.amount * BTC_PRICE_USD;
           const rate = RATES[asset.currency] || 1;
           return asset.amount / rate;
        }
        return getVal(b) - getVal(a);
      })
      .slice(0, 3);
  }, [assets]);

  // Passive income received in the last 12 months, in the display currency.
  // Informational only — deliberately NOT added to net worth (avoids double-counting).
  const passiveIncome12mo = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const display = settings.displayCurrency;
    return income
      .filter(r => new Date(r.date) >= cutoff)
      .reduce((sum, r) => {
        const usd = r.currency === Currency.BTC ? r.amount * BTC_PRICE_USD : r.amount / (RATES[r.currency] || 1);
        const val = display === Currency.BTC ? usd / BTC_PRICE_USD : usd * (RATES[display] || 1);
        return sum + val;
      }, 0);
  }, [income, settings.displayCurrency]);

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
        const isoDate = new Date(dateStr + 'T12:00:00Z').toISOString();
        let history: AssetHistoryEntry[];
        if (editingEntryId) {
            // Edit an existing saved entry (date and/or amount).
            history = selectedAsset.history.map(h =>
                h.id === editingEntryId ? { ...h, amount: newAmount, date: isoDate } : h
            );
        } else {
            // Add a new balance entry.
            const newEntry: AssetHistoryEntry = {
                id: Date.now().toString(),
                date: isoDate,
                amount: newAmount,
                change: 0,
                type: updateType
            };
            history = [newEntry, ...selectedAsset.history];
        }
        const updatedAsset = recomputeAsset(selectedAsset, history);
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
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
                        note: 'Initial Entry'
                    }
                ]
            };
            setAssets(prev => [...prev, newAsset]);
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
                    <p className="text-textMuted text-xs font-medium tracking-widest uppercase mb-1">
                        {selectedAsset.name}
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-normal text-zinc-500">
                            {selectedAsset.currency === Currency.BTC ? '₿' : getCurrencySymbol(selectedAsset.currency)}
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
            <div className="relative">
                <button
                    onClick={() => setShowStreakTooltip(!showStreakTooltip)} 
                    className="flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-full text-xs font-medium text-textMuted shadow-sm hover:text-white transition-colors"
                >
                    <Icons.Fire className="w-3.5 h-3.5 animate-pulse text-[#F7931A]" weight="fill" />
                    <span>{settings.streakDays}</span>
                </button>
                {showStreakTooltip && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStreakTooltip(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 p-3 animate-[fadeIn_0.1s_ease-out]">
                            <p className="text-white text-xs font-semibold mb-1">Daily Streak</p>
                            <p className="text-[10px] text-textMuted leading-relaxed">
                                You've tracked your wealth for {settings.streakDays} days in a row. Keep checking in to build your habit!
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
      </header>

      <div className="glass-panel rounded-3xl p-4 relative overflow-visible shadow-lg z-20">
         <div className="flex justify-between items-start mb-0 relative">
            <div className="flex-1">
                 <div className="flex items-center gap-2 mb-1">
                    <p className="text-textMuted text-xs font-medium tracking-widest uppercase">
                        {comparisonMode ? 'BTC Equivalent' : 'Net Worth'}
                    </p>
                    <button 
                        onClick={() => setPrivacyMode(!privacyMode)}
                        className="text-textMuted hover:text-white transition-colors p-1"
                    >
                        {privacyMode ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                    </button>
                 </div>
                 
                 <div className="flex items-center justify-between w-full pr-1">
                    <div className="relative inline-block">
                        <h2 
                            onClick={() => !comparisonMode && setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                            className={`flex items-baseline cursor-pointer hover:opacity-80 transition-opacity gap-1 ${comparisonMode ? 'text-[#F7931A]' : 'text-white'}`}
                        >
                            <span className="text-3xl font-normal text-zinc-500 font-sans">{totalValueParts.symbol}</span>
                            <span className="text-4xl font-medium font-sans tracking-tight">{totalValueParts.value}</span>
                        </h2>
                        {isCurrencyDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-32 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                                {[Currency.PHP, Currency.USD, Currency.CAD].map(curr => (
                                    <button
                                        key={curr}
                                        onClick={() => handleCurrencySelect(curr)}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors ${
                                            settings.displayCurrency === curr 
                                            ? 'text-primary font-bold bg-white/5' 
                                            : 'text-textMuted'
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => setComparisonMode(!comparisonMode)}
                        className={`p-2 rounded-full transition-all border ${comparisonMode ? 'bg-[#F7931A] border-[#F7931A] text-white shadow-[0_0_15px_rgba(247,147,26,0.5)]' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
                    >
                        <Icons.Crypto size={24} />
                    </button>
                 </div>

                 <div className="mt-1">
                    {comparisonMode ? (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <p className="text-white text-xs font-medium mb-0.5">
                                1 BTC = <span className="text-emerald-400">${BTC_PRICE_USD.toLocaleString()}</span>
                            </p>
                            <p className="text-[10px] text-textMuted leading-tight">
                                Your net worth in BTC shifts; showing <span className="text-rose-400">USD value erosion</span>.
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400 text-sm font-medium flex items-center gap-1">
                                <Icons.Trend size={14} /> +2.4%
                            </span>
                            <span className="text-textMuted text-xs">past month</span>
                        </div>
                    )}
                 </div>
            </div>
         </div>
         <div className="h-28 -mx-4 mt-2">
            <NetWorthChart 
                data={historyData} 
                mode={comparisonMode ? 'COMPARISON' : 'FIAT'} 
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
                                    {asset.currency === Currency.BTC ? '₿' : asset.currency + ' '} 
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
                             <div className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
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
                                                {asset.currency === Currency.BTC ? '₿' : asset.currency + ' '} 
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
        <SettingsItem icon={<Icons.Download size={20} />} label="Export CSV" onClick={handleExportCSV} />
        <SettingsItem icon={<Icons.Delete size={20} />} label="Clear all data & start fresh" onClick={handleClearData} isLast />
      </SettingsGroup>

      <SettingsGroup title="Support">
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
         activeTab === 'INCOME' ? <IncomeTracker displayCurrency={settings.displayCurrency} privacyMode={privacyMode} addTick={incomeAddTick} records={income} onRecordsChange={setIncome} /> :
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

      {/* Hidden input for restoring a backup file */}
      <input ref={restoreInputRef} type="file" accept="application/json,.json" onChange={handleRestoreFile} className="hidden" />

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