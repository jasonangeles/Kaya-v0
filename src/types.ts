export enum Currency {
  PHP = 'PHP',
  USD = 'USD',
  CAD = 'CAD',
  BTC = 'BTC',
  AED = 'AED',
  SAR = 'SAR',
  SGD = 'SGD',
  HKD = 'HKD',
  JPY = 'JPY',
  EUR = 'EUR',
  GBP = 'GBP'
}

export enum AssetCategory {
  CASH = 'Cash & Wallets',
  BANK_PH = 'Philippine Banks',
  BANK_INTL = 'International Banks',
  CRYPTO = 'Crypto Assets',
  STOCKS = 'Equities',
  REAL_ESTATE = 'Real Estate',
  OTHER = 'Other',
  DEBT = 'Liabilities'
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export interface AssetHistoryEntry {
  id: string;
  date: string;
  amount: number; // The balance at this point in time
  change: number; // The difference from previous
  type: 'TRANSACTION' | 'MARKET'; // Money Moved vs Market Change
  note?: string;
}

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  amount: number; // Current Balance (Stored in original currency)
  currency: string; // ISO currency code (e.g. 'PHP', 'USD', 'BTC')
  institution?: string; // e.g., "BDO", "Wealthsimple"
  lastUpdated: string;
  history: AssetHistoryEntry[];
}

export interface IncomeRecord {
  id: string;
  amount: number;
  currency: string; // ISO currency code
  source: string;   // e.g. "FB", "RCR" — the payer / ticker
  category: string; // e.g. "Dividend", "Interest"
  date: string;     // ISO date
  note?: string;
}

export interface HistoricalPoint {
  date: string;
  totalValuePHP: number;
  totalValueUSD: number;
  totalValueBTC: number;
  btcPrice: number; // Historical price of 1 BTC in USD
  inflationIndex: number; // 100 scale representing purchasing power
}

export interface ExchangeRates {
  [key: string]: number; // Rate relative to USD
}

export interface UserSettings {
  displayCurrency: string; // The currency showing on the dashboard (ISO code)
  showInBTC: boolean; // The toggle to flip everything to BTC
  onboardingComplete: boolean;
  streakDays: number;
  lastStreakDate?: string; // YYYY-MM-DD of the last day activity was logged
  lastLogin: string;
  fxPairs?: { first: string; second: string }[]; // currency-rate widget pairs
}