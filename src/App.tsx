import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from './components/icons';
import { NetWorthChart } from './components/NetWorthChart';
import { Asset, Currency, AssetCategory, UserSettings, TimeRange, AssetHistoryEntry } from './types';
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
        className={`fixed bottom-0 left-0 w-full z-50 bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 shadow-2xl transform transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-white">✕</button>
        {children}
      </div>
    </>
  );
};

interface HistoryItemProps {
  entry: AssetHistoryEntry;
  currency: Currency;
  isLast: boolean;
  onDelete: () => void;
  shouldAnimateHint: boolean;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ 
  entry, 
  currency, 
  isLast, 
  onDelete, 
  shouldAnimateHint 
}) => {
  const [offset, setOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (shouldAnimateHint) {
      const timer = setTimeout(() => {
        setOffset(-60);
        setTimeout(() => setOffset(0), 400);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimateHint]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || touchStartX.current === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (diff < 0) {
      setOffset(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    touchStartX.current = null;
    if (offset < -60) {
      setOffset(0);
      onDelete();
    } else {
      setOffset(0);
    }
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
        className={`relative bg-black/40 backdrop-blur-md p-4 flex justify-between items-center transition-transform duration-200 ease-out ${!isLast ? 'border-b border-white/5' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3 select-none pointer-events-none">
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
        <div className="text-right select-none pointer-events-none">
          <p className="text-sm font-medium text-zinc-300">
            {currency === Currency.BTC ? '₿' : getCurrencySymbol(currency)}{entry.amount.toLocaleString()}
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
          className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${isToggled ? 'bg-primary' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${isToggled ? 'left-6' : 'left-1'}`} />
        </div>
      )}
      {!toggle && <Icons.ChevronRight className="w-4 h-4 text-zinc-600" />}
    </div>
  </div>
);

const CURRENCY_OPTIONS = [
  { code: Currency.PHP, name: 'Philippine Peso' },
  { code: Currency.USD, name: 'US Dollar' },
  { code: Currency.CAD, name: 'Canadian Dollar' },
  { code: Currency.AED, name: 'UAE Dirham' },
  { code: Currency.SAR, name: 'Saudi Riyal' },
  { code: Currency.SGD, name: 'Singapore Dollar' },
  { code: Currency.HKD, name: 'Hong Kong Dollar' },
  { code: Currency.JPY, name: 'Japanese Yen' },
  { code: Currency.EUR, name: 'Euro' },
  { code: Currency.GBP, name: 'British Pound' },
  { code: Currency.BTC, name: 'Bitcoin' },
];

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [settings, setSettings] = useState<UserSettings>({
    displayCurrency: Currency.PHP,
    showInBTC: false,
    onboardingComplete: true,
    streakDays: 12,
    lastLogin: new Date().toISOString()
  });
  
  const [activeTab, setActiveTab] = useState<'HOME' | 'ASSETS' | 'SETTINGS' | 'SETTINGS_CURRENCY'>('HOME');
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
  const [modalCurrency, setModalCurrency] = useState<Currency>(Currency.PHP);
  const [currencySearch, setCurrencySearch] = useState('');
  const [isCurrencySearchOpen, setIsCurrencySearchOpen] = useState(false);
  const [updateType, setUpdateType] = useState<'TRANSACTION' | 'MARKET'>('TRANSACTION');
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split('T')[0]);

  const [lastDeletedAsset, setLastDeletedAsset] = useState<Asset | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [passcodeEnabled, setPasscodeEnabled] = useState(true);

  const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);
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
    setCurrencySearch('PHP');
    setIsModalOpen(true);
  };

  const handleOpenUpdateBalance = () => {
    setIsEditMode(false);
    setUpdateDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditAssetDetails = (asset: Asset) => {
    setIsEditMode(true); 
    setModalCategory(asset.category);
    setModalCurrency(asset.currency);
    setCurrencySearch(asset.currency);
    setIsModalOpen(true);
  };

  const handleSaveAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (selectedAsset && !isEditMode) {
        const newAmount = parseFloat(formData.get('amount') as string);
        const dateStr = formData.get('date') as string;
        const isoDate = new Date(dateStr + 'T12:00:00Z').toISOString();
        const change = newAmount - selectedAsset.amount;
        const newEntry: AssetHistoryEntry = {
            id: Date.now().toString(),
            date: isoDate,
            amount: newAmount,
            change: change,
            type: updateType
        };
        const updatedAsset = { 
            ...selectedAsset, 
            amount: newAmount, 
            lastUpdated: isoDate,
            history: [newEntry, ...selectedAsset.history]
        };
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
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
            const currency = formData.get('currency') as Currency;
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
    let newAmount = selectedAsset.amount;
    if (updatedHistory.length > 0) {
        const sorted = [...updatedHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        newAmount = sorted[0].amount;
    } else {
        newAmount = 0;
    }
    const updatedAsset = { ...selectedAsset, history: updatedHistory, amount: newAmount };
    setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
  };

  const handleUndoDelete = () => {
    if (!lastDeletedAsset) return;
    setAssets(prev => [...prev, lastDeletedAsset]);
    setShowUndoToast(false);
    setLastDeletedAsset(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  };

  const handleCurrencySelect = (currency: Currency) => {
    setSettings(prev => ({ ...prev, displayCurrency: currency }));
    setIsCurrencyDropdownOpen(false);
  };

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

                <div className="glass-panel rounded-3xl overflow-hidden shadow-lg bg-transparent">
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
                    <Icons.Fire className="w-3.5 h-3.5 animate-pulse text-[#F7931A]" fill="#F7931A" />
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
                className="glass-panel rounded-3xl relative overflow-hidden select-none shadow-lg"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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
         <header className="mb-8 px-1">
            <h1 className="text-3xl font-medium text-white mb-2">Portfolio</h1>
            <p className="text-sm text-textMuted">Tap to view details</p>
        </header>

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
            {CURRENCY_OPTIONS.map((option, index) => (
                <div 
                    key={option.code}
                    onClick={() => {
                        setSettings(prev => ({ ...prev, displayCurrency: option.code }));
                        setActiveTab('SETTINGS');
                    }}
                    className={`p-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors ${index !== CURRENCY_OPTIONS.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                    <div className="flex items-center gap-3">
                         <span className={`font-medium w-8 ${settings.displayCurrency === option.code ? 'text-primary' : 'text-white'}`}>{option.code}</span>
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
        <SettingsItem icon={<Icons.Lock size={20} />} label="App Lock" toggle isToggled={passcodeEnabled} onToggle={() => setPasscodeEnabled(!passcodeEnabled)} />
        <SettingsItem icon={<Icons.Smartphone size={20} />} label="Face ID" toggle isToggled={faceIdEnabled} onToggle={() => setFaceIdEnabled(!faceIdEnabled)} isLast />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsItem icon={<Icons.Cloud size={20} />} label="Backup" value="Synced" onClick={() => {}} />
        <SettingsItem icon={<Icons.Download size={20} />} label="Export CSV" onClick={() => {}} isLast />
      </SettingsGroup>

      <SettingsGroup title="Support">
        <SettingsItem icon={<Icons.Star size={20} />} label="Rate Kaya" onClick={() => {}} />
        <SettingsItem icon={<Icons.Mail size={20} />} label="Contact Us" onClick={() => {}} isLast />
      </SettingsGroup>

      <div className="text-center mt-8 text-zinc-600 text-xs">
        <p>Kaya Wealth v1.1.0</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent text-textMain max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans">
      
      {/* Scrollable Content Area */}
      <main className="h-screen overflow-y-auto no-scrollbar p-6">
        {activeTab === 'SETTINGS' ? renderSettings() : 
         activeTab === 'SETTINGS_CURRENCY' ? renderCurrencySelection() :
         selectedAssetId ? renderAssetDetail() : 
         activeTab === 'ASSETS' ? renderPortfolioList() : 
         renderHome()}
      </main>

      {/* FAB: Main Add Button OR Update Balance Button */}
      {activeTab !== 'SETTINGS' && activeTab !== 'SETTINGS_CURRENCY' && (
        <div className="absolute bottom-28 right-6 z-30">
          <button 
              onClick={selectedAssetId ? handleOpenUpdateBalance : handleOpenAddAsset}
              className="bg-white text-black w-14 h-14 rounded-2xl shadow-lg shadow-black/40 transition-all active:scale-95 flex items-center justify-center"
          >
              <Icons.Add className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 w-full glass-panel h-24 pb-6 px-8 flex justify-between items-center z-40">
        <button onClick={() => { setActiveTab('HOME'); setSelectedAssetId(null); }} className={`flex flex-col items-center gap-1.5 ${activeTab === 'HOME' ? 'text-primary' : 'text-zinc-600'}`}>
            <Icons.Dashboard className="w-6 h-6" strokeWidth={activeTab === 'HOME' ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Overview</span>
        </button>
        <button onClick={() => { setActiveTab('ASSETS'); setSelectedAssetId(null); }} className={`flex flex-col items-center gap-1.5 ${activeTab === 'ASSETS' ? 'text-primary' : 'text-zinc-600'}`}>
            <Icons.Wallet className="w-6 h-6" strokeWidth={activeTab === 'ASSETS' ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Portfolio</span>
        </button>
        <button onClick={() => { setActiveTab('SETTINGS'); setSelectedAssetId(null); }} className={`flex flex-col items-center gap-1.5 ${(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 'text-primary' : 'text-zinc-600'}`}>
            <Icons.Settings className="w-6 h-6" strokeWidth={(activeTab === 'SETTINGS' || activeTab === 'SETTINGS_CURRENCY') ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Settings</span>
        </button>
      </nav>

      {/* Undo Toast */}
      {showUndoToast && lastDeletedAsset && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900 border border-white/10 shadow-2xl rounded-xl px-6 py-4 flex items-center gap-4 min-w-[320px] animate-[fadeIn_0.3s_ease-out]">
            <span className="text-white text-sm font-medium">Deleted {lastDeletedAsset.name}</span>
            <button onClick={handleUndoDelete} className="ml-auto text-primary font-bold text-sm hover:text-zinc-300 tracking-wide">UNDO</button>
            <button onClick={() => setShowUndoToast(false)} className="text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Dynamic Slide-Up Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {selectedAsset && !isEditMode ? (
            // VIEW: Add Balance (History Entry)
            <>
                <h2 className="text-2xl font-medium mb-6 text-white">Add Balance</h2>
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
                                required 
                                name="amount" 
                                type="number" 
                                step="any" 
                                placeholder="0.00" 
                                className="w-full bg-transparent border-none text-white text-2xl font-medium p-2 outline-none placeholder:text-zinc-700" 
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Toggle removed per request */}

                    <button 
                        type="submit" 
                        className="w-full bg-white text-black shadow-lg shadow-black/40 font-bold py-4 rounded-xl hover:opacity-90 transition-opacity mt-4"
                    >
                        Add Balance
                    </button>
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
                                <div className="relative">
                                    <input type="hidden" name="currency" value={modalCurrency} />
                                    <input type="text" value={currencySearch} onChange={(e) => { setCurrencySearch(e.target.value); setIsCurrencySearchOpen(true); }} onFocus={() => setIsCurrencySearchOpen(true)} placeholder="Select..." className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-700 pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0" />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-textMuted" onClick={() => setIsCurrencySearchOpen(!isCurrencySearchOpen)}><Icons.ChevronDown size={20} /></div>
                                    {isCurrencySearchOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsCurrencySearchOpen(false)}></div>
                                            <div className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-20">
                                                {CURRENCY_OPTIONS.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase())).map(c => (
                                                    <div key={c.code} onClick={() => { setModalCurrency(c.code); setCurrencySearch(c.code); setIsCurrencySearchOpen(false); }} className="px-4 py-3 hover:bg-white/5 cursor-pointer text-sm border-b border-white/5 flex items-center gap-3">
                                                        <span className={`font-medium min-w-[32px] ${modalCurrency === c.code ? 'text-primary' : 'text-white'}`}>{c.code}</span>
                                                        <span className="text-xs text-textMuted truncate">{c.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
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

function getCurrencySymbol(currency: Currency) {
    switch (currency) {
        case Currency.PHP: return '₱';
        case Currency.USD: return '$';
        case Currency.CAD: return 'C$';
        case Currency.AED: return 'د.إ';
        case Currency.SAR: return '﷼';
        case Currency.SGD: return 'S$';
        case Currency.HKD: return 'HK$';
        case Currency.JPY: return '¥';
        case Currency.EUR: return '€';
        case Currency.GBP: return '£';
        case Currency.BTC: return '₿';
        default: return currency;
    }
}