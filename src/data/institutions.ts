// Curated registry of financial institutions used to render brand-colored
// monogram logos. Fully local — no network calls. Real SVGs dropped into
// src/assets/logos/<id>.svg will override the monogram automatically.
export interface Institution {
  id: string;       // stable key, also the logo filename
  short: string;    // monogram shown on the tile (1–4 chars)
  color: string;    // brand background color
  aliases: string[];// normalized matches (lowercased, alphanumeric)
}

export const INSTITUTIONS: Institution[] = [
  // ---- Philippines · banks ----
  { id: 'bpi', short: 'BPI', color: '#B11116', aliases: ['bpi', 'bankofthephilippineislands'] },
  { id: 'bdo', short: 'BDO', color: '#002F6C', aliases: ['bdo', 'bdounibank', 'bancodeoro'] },
  { id: 'metrobank', short: 'MB', color: '#002F6C', aliases: ['metrobank', 'mbtc'] },
  { id: 'landbank', short: 'LB', color: '#0A7A3B', aliases: ['landbank', 'landbankofthephilippines'] },
  { id: 'pnb', short: 'PNB', color: '#0033A0', aliases: ['pnb', 'philippinenationalbank'] },
  { id: 'securitybank', short: 'SB', color: '#00529B', aliases: ['securitybank'] },
  { id: 'unionbank', short: 'UB', color: '#F47920', aliases: ['unionbank', 'unionbankph', 'ubp'] },
  { id: 'chinabank', short: 'CB', color: '#C8102E', aliases: ['chinabank', 'cbc'] },
  { id: 'rcbc', short: 'RCBC', color: '#003B7A', aliases: ['rcbc'] },
  { id: 'eastwest', short: 'EW', color: '#E03C31', aliases: ['eastwest', 'eastwestbank'] },
  { id: 'psbank', short: 'PS', color: '#1C75BC', aliases: ['psbank'] },
  { id: 'dbp', short: 'DBP', color: '#0054A6', aliases: ['dbp', 'developmentbankofthephilippines'] },

  // ---- Philippines · digital / e-wallets ----
  { id: 'gcash', short: 'G', color: '#0070E0', aliases: ['gcash'] },
  { id: 'maya', short: 'M', color: '#00C66B', aliases: ['maya', 'paymaya'] },
  { id: 'maribank', short: 'M', color: '#1BA784', aliases: ['maribank', 'mari', 'seabank'] },
  { id: 'tonik', short: 'T', color: '#22D3A6', aliases: ['tonik', 'tonikbank'] },
  { id: 'gotyme', short: 'GT', color: '#FF5A00', aliases: ['gotyme', 'gotymebank'] },
  { id: 'cimb', short: 'CIMB', color: '#EC1C24', aliases: ['cimb', 'cimbph', 'cimbbank'] },
  { id: 'unobank', short: 'UNO', color: '#2E3192', aliases: ['uno', 'unobank', 'unodigitalbank'] },

  // ---- Canada · banks & brokerages ----
  { id: 'rbc', short: 'RBC', color: '#0051A5', aliases: ['rbc', 'royalbank', 'royalbankofcanada'] },
  { id: 'td', short: 'TD', color: '#00B04F', aliases: ['td', 'tdbank', 'torontodominion'] },
  { id: 'scotiabank', short: 'S', color: '#EC111A', aliases: ['scotiabank', 'scotia', 'bankofnovascotia'] },
  { id: 'bmo', short: 'BMO', color: '#0079C1', aliases: ['bmo', 'bankofmontreal'] },
  { id: 'cibc', short: 'CIBC', color: '#B4131E', aliases: ['cibc'] },
  { id: 'nbc', short: 'NBC', color: '#E2231A', aliases: ['nationalbank', 'nbc', 'nationalbankofcanada'] },
  { id: 'tangerine', short: 'T', color: '#FF6200', aliases: ['tangerine'] },
  { id: 'simplii', short: 'S', color: '#E4002B', aliases: ['simplii', 'simpliifinancial'] },
  { id: 'eqbank', short: 'EQ', color: '#5B2D8E', aliases: ['eqbank', 'equitablebank'] },
  { id: 'desjardins', short: 'D', color: '#00874E', aliases: ['desjardins'] },
  { id: 'vancity', short: 'V', color: '#00543D', aliases: ['vancity'] },
  { id: 'atb', short: 'ATB', color: '#0072CE', aliases: ['atb', 'atbfinancial'] },
  { id: 'wealthsimple', short: 'WS', color: '#1A1A1A', aliases: ['wealthsimple'] },
  { id: 'questrade', short: 'Q', color: '#00A0DF', aliases: ['questrade'] },

  // ---- USA · banks & brokerages ----
  { id: 'chase', short: 'C', color: '#117ACA', aliases: ['chase', 'jpmorganchase', 'jpmorgan'] },
  { id: 'bofa', short: 'BA', color: '#E31837', aliases: ['bankofamerica', 'bofa', 'boa'] },
  { id: 'wellsfargo', short: 'WF', color: '#D71E2B', aliases: ['wellsfargo', 'wells'] },
  { id: 'usbank', short: 'US', color: '#0C2074', aliases: ['usbank', 'usbancorp'] },
  { id: 'capitalone', short: 'C1', color: '#004977', aliases: ['capitalone'] },
  { id: 'pnc', short: 'PNC', color: '#F58025', aliases: ['pnc', 'pncbank'] },
  { id: 'truist', short: 'T', color: '#2D1A45', aliases: ['truist'] },
  { id: 'ally', short: 'A', color: '#A50034', aliases: ['ally', 'allybank'] },
  { id: 'schwab', short: 'CS', color: '#00A0DF', aliases: ['schwab', 'charlesschwab'] },
  { id: 'sofi', short: 'SoFi', color: '#00558C', aliases: ['sofi'] },
  { id: 'discover', short: 'D', color: '#FF6000', aliases: ['discover', 'discoverbank'] },

  // ---- UAE · banks ----
  { id: 'enbd', short: 'ENBD', color: '#E2241A', aliases: ['emiratesnbd', 'enbd'] },
  { id: 'fab', short: 'FAB', color: '#00205B', aliases: ['fab', 'firstabudhabibank'] },
  { id: 'adcb', short: 'ADCB', color: '#E03E2F', aliases: ['adcb', 'abudhabicommercialbank'] },
  { id: 'mashreq', short: 'M', color: '#FF5F00', aliases: ['mashreq', 'mashreqbank'] },
  { id: 'dib', short: 'DIB', color: '#009639', aliases: ['dib', 'dubaiislamicbank'] },
  { id: 'adib', short: 'ADIB', color: '#00529B', aliases: ['adib', 'abudhabiislamicbank'] },
  { id: 'rakbank', short: 'RAK', color: '#ED1C24', aliases: ['rakbank', 'rak'] },
  { id: 'emiratesislamic', short: 'EI', color: '#C8102E', aliases: ['emiratesislamic'] },
  { id: 'cbd', short: 'CBD', color: '#1A3668', aliases: ['cbd', 'commercialbankofdubai'] },
  { id: 'wio', short: 'Wio', color: '#6E4BF4', aliases: ['wio', 'wiobank'] },
  { id: 'liv', short: 'Liv', color: '#2DC84D', aliases: ['liv', 'livbank'] },

  // ---- Global · banks & remittance ----
  { id: 'hsbc', short: 'HSBC', color: '#DB0011', aliases: ['hsbc'] },
  { id: 'citi', short: 'Citi', color: '#003B7E', aliases: ['citi', 'citibank', 'citigroup'] },
  { id: 'standardchartered', short: 'SC', color: '#0473EA', aliases: ['standardchartered', 'stanchart'] },
  { id: 'wise', short: 'W', color: '#9FE870', aliases: ['wise', 'transferwise'] },
  { id: 'revolut', short: 'R', color: '#191C1F', aliases: ['revolut'] },
  { id: 'paypal', short: 'PP', color: '#003087', aliases: ['paypal'] },
  { id: 'remitly', short: 'R', color: '#0077C8', aliases: ['remitly'] },
  { id: 'westernunion', short: 'WU', color: '#FFDD00', aliases: ['westernunion', 'wu'] },

  // ---- Crypto · exchanges & wallets ----
  { id: 'binance', short: 'B', color: '#F0B90B', aliases: ['binance'] },
  { id: 'coinbase', short: 'C', color: '#0052FF', aliases: ['coinbase'] },
  { id: 'kraken', short: 'K', color: '#5741D9', aliases: ['kraken'] },
  { id: 'bybit', short: 'By', color: '#F7A600', aliases: ['bybit'] },
  { id: 'okx', short: 'OKX', color: '#0B0B0B', aliases: ['okx', 'okex'] },
  { id: 'ledger', short: 'L', color: '#0B0B0B', aliases: ['ledger'] },
  { id: 'trezor', short: 'T', color: '#00854D', aliases: ['trezor'] },
  { id: 'metamask', short: 'MM', color: '#F6851B', aliases: ['metamask'] },
  { id: 'trustwallet', short: 'TW', color: '#3375BB', aliases: ['trustwallet', 'trust'] },
  { id: 'strike', short: 'S', color: '#191919', aliases: ['strike'] },
  { id: 'pdax', short: 'P', color: '#1A1F71', aliases: ['pdax'] },
  { id: 'coinsph', short: 'C', color: '#5E2B97', aliases: ['coinsph', 'coins'] },

  // ---- Brokerages / investing ----
  { id: 'ibkr', short: 'IB', color: '#D81222', aliases: ['interactivebrokers', 'ibkr'] },
  { id: 'robinhood', short: 'R', color: '#00C805', aliases: ['robinhood'] },
  { id: 'vanguard', short: 'V', color: '#96151D', aliases: ['vanguard'] },
  { id: 'fidelity', short: 'F', color: '#468125', aliases: ['fidelity'] },
  { id: 'col', short: 'COL', color: '#ED1C24', aliases: ['col', 'colfinancial'] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Build a fast exact-match index from every alias.
const INDEX = new Map<string, Institution>();
for (const inst of INSTITUTIONS) for (const a of inst.aliases) INDEX.set(a, inst);

export function findInstitution(name?: string): Institution | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  const exact = INDEX.get(n);
  if (exact) return exact;
  // Prefix match in both directions (handles "BPI Savings", "TD Canada Trust").
  // Require >=3 chars to avoid noisy 2-letter collisions.
  let best: Institution | null = null;
  let bestLen = 0;
  for (const inst of INSTITUTIONS) {
    for (const a of inst.aliases) {
      if (a.length < 3) continue;
      if ((n.startsWith(a) || a.startsWith(n)) && a.length > bestLen) { best = inst; bestLen = a.length; }
    }
  }
  return best;
}

// Luminance check → choose readable text color on the brand tile.
export function textOn(color: string): string {
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0a0a0a' : '#ffffff';
}
