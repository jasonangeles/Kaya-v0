import { Asset, AssetCategory, Currency, HistoricalPoint, TimeRange } from '../types';

// Mock Exchange Rates (Base USD)
export const RATES: Record<string, number> = {
  USD: 1,
  PHP: 56.50, // 1 USD = 56.50 PHP
  CAD: 1.36,  // 1 USD = 1.36 CAD
  BTC: 0.000016, // 1 USD = ~0.000016 BTC
  AED: 3.67,  // UAE Dirham
  SAR: 3.75,  // Saudi Riyal
  SGD: 1.35,  // Singapore Dollar
  HKD: 7.82,  // Hong Kong Dollar
  JPY: 150.0, // Japanese Yen
  EUR: 0.92,  // Euro
  GBP: 0.79   // British Pound
};

export const BTC_PRICE_USD = 62500;

export const INITIAL_ASSETS: Asset[] = [
  {
    id: '1',
    name: 'Emergency Fund',
    category: AssetCategory.BANK_PH,
    amount: 150000,
    currency: Currency.PHP,
    institution: 'BPI',
    lastUpdated: new Date().toISOString(),
    history: [
      { id: 'h1', date: '2025-10-01T10:00:00Z', amount: 140000, change: 140000, type: 'TRANSACTION' },
      { id: 'h2', date: '2025-11-01T10:00:00Z', amount: 150000, change: 10000, type: 'TRANSACTION', note: 'Savings deposit' }
    ]
  },
  {
    id: '2',
    name: 'GCash Daily',
    category: AssetCategory.CASH,
    amount: 5400,
    currency: Currency.PHP,
    institution: 'GCash',
    lastUpdated: new Date().toISOString(),
    history: [
      { id: 'h3', date: '2025-11-05T08:00:00Z', amount: 2000, change: 2000, type: 'TRANSACTION' },
      { id: 'h4', date: '2025-11-06T12:00:00Z', amount: 5400, change: 3400, type: 'TRANSACTION' }
    ]
  },
  {
    id: '3',
    name: 'TFSA Investment',
    category: AssetCategory.STOCKS,
    amount: 12500,
    currency: Currency.CAD,
    institution: 'Wealthsimple',
    lastUpdated: new Date().toISOString(),
    history: [
      { id: 'h5', date: '2025-09-01T10:00:00Z', amount: 10000, change: 10000, type: 'TRANSACTION' },
      { id: 'h6', date: '2025-10-01T10:00:00Z', amount: 11200, change: 1200, type: 'MARKET' },
      { id: 'h7', date: '2025-11-01T10:00:00Z', amount: 12500, change: 1300, type: 'MARKET' }
    ]
  },
  {
    id: '4',
    name: 'Bitcoin Cold Storage',
    category: AssetCategory.CRYPTO,
    amount: 0.15,
    currency: Currency.BTC,
    institution: 'Ledger',
    lastUpdated: new Date().toISOString(),
    history: [
      { id: 'h8', date: '2024-01-01T10:00:00Z', amount: 0.05, change: 0.05, type: 'TRANSACTION' },
      { id: 'h9', date: '2024-06-01T10:00:00Z', amount: 0.10, change: 0.05, type: 'TRANSACTION' },
      { id: 'h10', date: '2025-01-01T10:00:00Z', amount: 0.15, change: 0.05, type: 'TRANSACTION' }
    ]
  }
];

// Generate fake history based on time range
export const generateHistory = (assets: Asset[], range: TimeRange = '1M'): HistoricalPoint[] => {
  const points: HistoricalPoint[] = [];
  const today = new Date();
  
  // Calculate current total in USD
  let currentTotalUSD = 0;
  assets.forEach(a => {
    if (a.category === AssetCategory.DEBT) return;
    
    let amountInUSD = 0;
    
    if (a.currency === Currency.BTC) {
      amountInUSD = a.amount * BTC_PRICE_USD;
    } else {
      // Generic rate lookup
      const rate = RATES[a.currency] || 1;
      amountInUSD = a.amount / rate;
    }
    
    currentTotalUSD += amountInUSD;
  });

  let dataPoints = 40; // Increased points for smoother curve
  let intervalHours = 24;
  let startDate = new Date();

  switch (range) {
    case '1D':
      dataPoints = 24;
      intervalHours = 1;
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '1W':
      dataPoints = 28; // 4 points per day
      intervalHours = 6;
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '1M':
      dataPoints = 30;
      intervalHours = 24;
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '3M':
      dataPoints = 45; 
      intervalHours = 24 * 2;
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'YTD':
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const diffTime = Math.abs(today.getTime() - startOfYear.getTime());
      dataPoints = Math.max(20, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))); // Weekly points 
      intervalHours = 24 * 7;
      startDate = startOfYear;
      break;
    case '1Y':
      dataPoints = 52; 
      intervalHours = 24 * 7;
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'ALL':
      dataPoints = 60; 
      intervalHours = 24 * 30;
      startDate.setFullYear(startDate.getFullYear() - 5);
      break;
  }

  // Value Erosion settings (Annual inflation approx 4-5%)
  
  // ALGORITHM UPDATE: Use Random Walk / Cumulative Trend instead of pure random noise
  // This creates smooth "financial-looking" curves instead of jagged lines.
  
  // We simulate BACKWARDS from today (which is currentTotalUSD)
  let simulatedUSD = currentTotalUSD;
  let simulatedBTCPrice = BTC_PRICE_USD;

  // We need to generate points in reverse order first (from today backwards), then reverse the array
  const reversePoints: HistoricalPoint[] = [];

  for (let i = 0; i <= dataPoints; i++) {
    const d = new Date(today.getTime() - (i * intervalHours * 60 * 60 * 1000));
    
    // Skip future if logic slightly overlaps
    if (d > new Date()) {
        d.setTime(new Date().getTime());
    }

    // 1. Calculate Volatility Factor based on range
    const volatilityStep = range === '1D' ? 0.002 : (range === '1Y' || range === 'ALL' ? 0.03 : 0.015);
    
    // 2. Add trend + noise (Random Walk)
    // The 'change' represents going BACK in time. 
    // If market generally goes UP over time, going back means values should be LOWER or HIGHER depending on trend.
    // Let's assume a slight general upward trend for assets (so going back, we subtract)
    const trend = range === '1D' ? 0 : 0.001; // 0.1% growth per step
    const noise = (Math.random() - 0.5) * volatilityStep * 2;
    
    const changePercent = trend + noise;
    
    // For BTC, higher volatility
    const btcNoise = (Math.random() - 0.5) * (volatilityStep * 3) * 2;
    const btcTrend = range === '1D' ? 0 : 0.002;
    
    // Store current state before modifying for next (previous) step
    const inflationIndex = 100 * (1 - (i * (0.04 / (365*24/intervalHours)))); // Simple linear erosion

    reversePoints.push({
      date: range === '1D' 
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toISOString(), 
      totalValueUSD: simulatedUSD,
      totalValuePHP: simulatedUSD * RATES.PHP,
      totalValueBTC: simulatedUSD / simulatedBTCPrice,
      btcPrice: simulatedBTCPrice,
      inflationIndex: inflationIndex
    });

    // Update for next step (going backwards in time)
    // Current = Previous * (1 + change)  => Previous = Current / (1 + change)
    simulatedUSD = simulatedUSD / (1 + changePercent);
    simulatedBTCPrice = simulatedBTCPrice / (1 + btcTrend + btcNoise);
  }

  return reversePoints.reverse();
};

// Generate Exchange Rate History (Source vs Target)
export const getExchangeRateHistory = (from: Currency, to: Currency, range: TimeRange = '1M'): HistoricalPoint[] => {
    const points: HistoricalPoint[] = [];
    const rateFrom = RATES[from] || 1;
    const rateTo = RATES[to] || 1;
    const currentRate = (1 / rateFrom) * rateTo;
    
    // Smooth trend generation
    const dataPoints = 30;
    let rateWalker = currentRate;

    const tempPoints = [];
    for (let i = 0; i < dataPoints; i++) {
        tempPoints.push(rateWalker);
        // Walk backwards
        rateWalker = rateWalker + (rateWalker * (Math.random() - 0.5) * 0.01);
    }
    
    const finalRates = tempPoints.reverse();

    for (let i = 0; i < dataPoints; i++) {
        points.push({
            date: i.toString(),
            totalValueUSD: finalRates[i], 
            totalValuePHP: 0,
            totalValueBTC: 0,
            btcPrice: 0,
            inflationIndex: 0
        });
    }
    return points;
}