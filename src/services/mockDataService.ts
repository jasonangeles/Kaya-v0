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

  let dataPoints = 30;
  let intervalHours = 24;
  let startDate = new Date();

  switch (range) {
    case '1D':
      dataPoints = 24;
      intervalHours = 1;
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '1W':
      dataPoints = 7;
      intervalHours = 24;
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '1M':
      dataPoints = 30;
      intervalHours = 24;
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '3M':
      dataPoints = 90;
      intervalHours = 24;
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'YTD':
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const diffTime = Math.abs(today.getTime() - startOfYear.getTime());
      dataPoints = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      intervalHours = 24;
      startDate = startOfYear;
      break;
    case '1Y':
      dataPoints = 52; // Weekly points for smoother chart
      intervalHours = 24 * 7;
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'ALL':
      dataPoints = 60; // Monthly points for 5 years
      intervalHours = 24 * 30;
      startDate.setFullYear(startDate.getFullYear() - 5);
      break;
  }

  // Value Erosion settings (Annual inflation approx 4-5%)
  const hourlyErosionRate = 0.000005; // very rough approx
  
  for (let i = 0; i <= dataPoints; i++) {
    const d = new Date(startDate.getTime() + (i * intervalHours * 60 * 60 * 1000));
    
    // Don't go into future
    if (d > today) break;

    // Volatility depends on range. Short range = mostly noise. Long range = big trends.
    const timeProgress = i / dataPoints; // 0 to 1
    const volatility = range === '1D' ? 0.02 : (range === 'ALL' ? 3.0 : 0.5);
    
    // Create a deterministic-ish wave pattern
    const noise = Math.sin(i * 0.5) * Math.cos(i * 0.2) * volatility;
    
    // Mock BTC Price History
    // Ensure the last point is roughly current price
    const startPrice = range === '1D' ? BTC_PRICE_USD * 0.98 : BTC_PRICE_USD * 0.4;
    const endPrice = BTC_PRICE_USD;
    
    // Linear interp + noise
    let simBTCPrice = startPrice + ((endPrice - startPrice) * timeProgress);
    simBTCPrice = simBTCPrice * (1 + (Math.random() * 0.05 - 0.025)); // Add randomness

    if (range === '1D') {
        simBTCPrice = BTC_PRICE_USD * (0.99 + (Math.random() * 0.02));
    }

    // Value Erosion (Inflation)
    const erosionFactor = 1 - (i * (0.15 / dataPoints)); 
    const inflationIndex = 100 * erosionFactor;

    // Asset Value simulation (Portfolio fluctuation)
    // We base this on the CURRENT total and work backward with some variance
    const portVariance = 1 + (Math.random() * 0.04 - 0.02); // +/- 2% variance in history
    const simulatedUSD = currentTotalUSD * portVariance;

    points.push({
      date: range === '1D' 
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toISOString(), 
      totalValueUSD: simulatedUSD,
      totalValuePHP: simulatedUSD * RATES.PHP,
      totalValueBTC: simulatedUSD / simBTCPrice,
      btcPrice: simBTCPrice,
      inflationIndex: inflationIndex
    });
  }
  return points;
};

// Generate Exchange Rate History (Source vs Target)
export const getExchangeRateHistory = (from: Currency, to: Currency, range: TimeRange = '1M'): HistoricalPoint[] => {
    // Note: We are reusing the HistoricalPoint interface but stuffing rate data into totalValueUSD
    // This is a shortcut for MVP visualization
    const points: HistoricalPoint[] = [];
    
    // Base Rates to USD
    const rateFrom = RATES[from] || 1;
    const rateTo = RATES[to] || 1;
    
    // Current Cross Rate (1 unit of From = X units of To)
    // e.g. 1 USD = 56 PHP.  (1 / 1) * 56
    // e.g. 1 CAD = X PHP.   (1 / 1.36) * 56 = 41.17
    const currentRate = (1 / rateFrom) * rateTo;
    
    const dataPoints = 30;
    
    for (let i = 0; i < dataPoints; i++) {
        // Create a trend
        const volatility = 0.02; // 2% fluctuation
        const randomVar = 1 + (Math.random() * volatility - (volatility/2));
        
        // Slightly trend up or down based on index
        const trend = 1 + (Math.sin(i * 0.2) * 0.01);
        
        const historicalRate = currentRate * randomVar * trend;
        
        points.push({
            date: i.toString(),
            totalValueUSD: historicalRate, // HACK: Using this field for the chart
            totalValuePHP: 0,
            totalValueBTC: 0,
            btcPrice: 0,
            inflationIndex: 0
        });
    }
    return points;
}