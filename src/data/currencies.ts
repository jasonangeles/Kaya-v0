// Currency reference data.
// `usd` = approximate units of this currency per 1 USD (static placeholder,
// to be replaced by live FX in a later phase). Used for symbol lookup,
// the picker list, and the existing fixed-rate conversions.

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  usd: number;
}

// Pinned to the top of the picker, in this order.
export const COMMON_CURRENCY_CODES = ['PHP', 'USD', 'CAD', 'AED', 'SAR', 'SGD', 'HKD', 'JPY', 'EUR', 'GBP', 'BTC'];

export const ALL_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', usd: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', usd: 0.92 },
  { code: 'GBP', name: 'British Pound', symbol: '£', usd: 0.79 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', usd: 150 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', usd: 56.5 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', usd: 1.36 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', usd: 1.52 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', usd: 1.64 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', usd: 0.88 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', usd: 7.24 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', usd: 7.82 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', usd: 1.35 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', usd: 32 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', usd: 1330 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', usd: 83 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', usd: 15800 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', usd: 4.7 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', usd: 36 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', usd: 24500 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'Dh', usd: 3.67 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', usd: 3.75 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', usd: 3.64 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', usd: 0.31 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', usd: 0.38 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', usd: 0.38 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', usd: 0.71 },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', usd: 3.7 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', usd: 32 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', usd: 92 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', usd: 40 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', usd: 4 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', usd: 23 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', usd: 360 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', usd: 4.6 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', usd: 10.5 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', usd: 10.7 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', usd: 6.9 },
  { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr', usd: 138 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', usd: 18.5 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', usd: 1500 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', usd: 48 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', usd: 129 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', usd: 15 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', usd: 10 },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', usd: 3.1 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', usd: 5.1 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', usd: 17 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', usd: 900 },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', usd: 950 },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', usd: 3900 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', usd: 3.75 },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', usd: 39 },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', usd: 6.9 },
  { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', usd: 7500 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', usd: 278 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', usd: 110 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', usd: 300 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', usd: 133 },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', usd: 2100 },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', usd: 4100 },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', usd: 21000 },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', usd: 1.35 },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', usd: 8.05 },
  { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', usd: 3400 },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', usd: 470 },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: "so'm", usd: 12600 },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', usd: 2.7 },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', usd: 1.7 },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', usd: 390 },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', usd: 3.3 },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', usd: 108 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', usd: 1.8 },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', usd: 6.9 },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', usd: 56 },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L', usd: 93 },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', usd: 600 },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', usd: 600 },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$', usd: 2.7 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', usd: 2600 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', usd: 3700 },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', usd: 115 },
  { code: 'XAU', name: 'Gold (ounce)', symbol: 'XAU', usd: 0.00042 },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', usd: 0.0000095 }
];

const byCode = new Map(ALL_CURRENCIES.map(c => [c.code, c]));

export const currencyByCode = (code: string): CurrencyInfo | undefined => byCode.get(code);
export const symbolFor = (code: string): string => byCode.get(code)?.symbol || code;
export const usdRateFor = (code: string): number => byCode.get(code)?.usd ?? 1;

// Common first (in COMMON order), then the rest alphabetically by name.
export const ORDERED_CURRENCIES: CurrencyInfo[] = [
  ...COMMON_CURRENCY_CODES.map(c => byCode.get(c)).filter((c): c is CurrencyInfo => !!c),
  ...ALL_CURRENCIES
    .filter(c => !COMMON_CURRENCY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name))
];
