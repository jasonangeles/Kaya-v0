// Live exchange rates with a daily localStorage cache and graceful fallback.
// Fiat rates come from frankfurter.app (ECB, free, no key, CORS-friendly);
// BTC from CoinGecko. Values are "units of currency per 1 USD".

const CACHE_KEY = 'kaya.fx.latest';

interface FxSnapshot {
  fetchedAt: string;       // YYYY-MM-DD
  rates: Record<string, number>; // units per 1 USD (fiat)
  btcUsd: number;          // 1 BTC in USD
}

const todayStr = () => new Date().toISOString().split('T')[0];

const readCache = (): FxSnapshot | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as FxSnapshot) : null;
  } catch {
    return null;
  }
};

const writeCache = (snap: FxSnapshot) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch {}
};

const fetchFiat = async (): Promise<Record<string, number> | null> => {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!res.ok) return null;
    const json = await res.json();
    const rates: Record<string, number> = { USD: 1, ...(json.rates || {}) };
    return rates;
  } catch {
    return null;
  }
};

const fetchBtc = async (): Promise<number | null> => {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!res.ok) return null;
    const json = await res.json();
    const v = json?.bitcoin?.usd;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
};

// Returns the freshest rates available. Uses today's cache if present; otherwise
// fetches live, caches, and returns. If the network fails, returns stale cache
// (or null, in which case callers keep their static fallback).
export const getLiveRates = async (): Promise<FxSnapshot | null> => {
  const cached = readCache();
  if (cached && cached.fetchedAt === todayStr()) return cached;

  const [fiat, btc] = await Promise.all([fetchFiat(), fetchBtc()]);
  if (!fiat && !btc) return cached; // offline → fall back to stale cache (may be null)

  const snap: FxSnapshot = {
    fetchedAt: todayStr(),
    rates: fiat || cached?.rates || { USD: 1 },
    btcUsd: btc || cached?.btcUsd || 0
  };
  writeCache(snap);
  return snap;
};
