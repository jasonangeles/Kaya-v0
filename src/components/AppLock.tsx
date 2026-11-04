import React, { useEffect, useState } from 'react';
import { Icons } from './icons';
import { DitherBackground } from './DitherBackground';

// --- Crypto + WebAuthn helpers -------------------------------------------

export const hashPin = async (pin: string): Promise<string> => {
  const data = new TextEncoder().encode('kaya-pin-salt:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const canonicalCode = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

// A readable one-time recovery code, e.g. "K7QP-2MXR".
export const generateRecoveryCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  bytes.forEach(b => { s += chars[b % chars.length]; });
  return s.slice(0, 4) + '-' + s.slice(4, 8);
};

export const hashRecoveryCode = (code: string): Promise<string> => hashPin('recovery:' + canonicalCode(code));

const bufToB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const b64ToBuf = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    return !!(window as any).PublicKeyCredential &&
      await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// Registers a platform (Face ID / Touch ID / fingerprint) credential.
// Returns a credential id we can later require, or null on failure.
export const registerBiometric = async (): Promise<string | null> => {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred: any = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Kaya Wealth' },
        user: { id: userId, name: 'kaya-user', displayName: 'Kaya' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    return cred ? bufToB64(cred.rawId) : null;
  } catch {
    return null;
  }
};

// Prompts the device biometric to unlock. Resolves true on success.
export const verifyBiometric = async (credId: string): Promise<boolean> => {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64ToBuf(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;
  } catch {
    return false;
  }
};

// --- UI ------------------------------------------------------------------

const Dots = ({ count, error }: { count: number; error?: boolean }) => (
  <div className="flex justify-center gap-4 my-8">
    {[0, 1, 2, 3].map(i => (
      <div
        key={i}
        className={`w-3.5 h-3.5 rounded-full transition-all ${
          error ? 'bg-rose-500' : i < count ? 'bg-textMuted' : 'bg-ink/20'
        }`}
      />
    ))}
  </div>
);

const Keypad = ({
  onDigit,
  onBackspace,
  biometric,
  onBiometric
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  biometric?: boolean;
  onBiometric?: () => void;
}) => (
  <div className="grid grid-cols-3 gap-5 max-w-[310px] mx-auto">
    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
      <button
        key={n}
        onClick={() => onDigit(n)}
        className="h-20 w-20 mx-auto rounded-full bg-ink/5 hover:bg-ink/10 active:scale-95 text-ink text-3xl font-normal transition-all flex items-center justify-center"
      >
        {n}
      </button>
    ))}
    <button
      onClick={onBiometric}
      disabled={!biometric}
      className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center transition-all ${biometric ? 'text-ink hover:bg-ink/10 active:scale-95' : 'opacity-0 pointer-events-none'}`}
      aria-label="Use biometrics"
    >
      <Icons.Fingerprint size={30} />
    </button>
    <button
      onClick={() => onDigit('0')}
      className="h-20 w-20 mx-auto rounded-full bg-ink/5 hover:bg-ink/10 active:scale-95 text-ink text-3xl font-normal transition-all flex items-center justify-center"
    >
      0
    </button>
    <button
      onClick={onBackspace}
      className="h-20 w-20 mx-auto rounded-full text-ink hover:bg-ink/10 active:scale-95 transition-all flex items-center justify-center"
      aria-label="Delete"
    >
      <Icons.Backspace size={28} />
    </button>
  </div>
);

// Name the biometric the way the device does.
const biometricName = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  return 'fingerprint';
};

// Full-screen lock overlay shown when the app is locked.
// Flow (same as the landing page demo): Kaya mark in a Face ID frame → "Unlock with Face ID"
// (auto-prompted) → frame pulses while scanning → turns green with a check and "Unlocked" →
// the lock screen fades away. PIN entry is one tap away ("Use PIN instead").
export const LockScreen = ({
  expectedHash,
  biometric,
  biometricId,
  onUnlock,
  onForgot
}: {
  expectedHash: string;
  biometric: boolean;
  biometricId: string | null;
  onUnlock: () => void;
  onForgot?: () => void;
}) => {
  const hasBio = biometric && !!biometricId;
  const bioName = biometricName();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  const [usePin, setUsePin] = useState(!hasBio);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'ok'>('idle');
  const [leaving, setLeaving] = useState(false);
  const theme = typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark';

  // Success: hold "Unlocked" for a beat, fade the lock screen out, then hand over.
  const succeed = () => {
    setPhase('ok');
    setTimeout(() => setLeaving(true), 550);
    setTimeout(onUnlock, 950);
  };

  const tryBiometric = async () => {
    if (!hasBio || phase !== 'idle') return;
    setPhase('scanning');
    const ok = await verifyBiometric(biometricId!);
    if (ok) succeed(); else setPhase('idle');
  };

  useEffect(() => {
    // Auto-prompt biometrics as soon as the lock appears.
    tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDigit = async (d: string) => {
    if (digits.length >= 4 || phase === 'ok') return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      const h = await hashPin(next);
      if (h === expectedHash) {
        succeed();
      } else {
        setError(true);
        setTimeout(() => { setError(false); setDigits(''); }, 600);
      }
    }
  };

  const ok = phase === 'ok', scanning = phase === 'scanning';
  const title = ok ? 'Unlocked' : 'Kaya is locked';
  const sub = ok ? 'Welcome back' : scanning ? `Looking for your ${bioName === 'Face ID' ? 'face' : 'fingerprint'}…` : usePin ? 'Enter your PIN to unlock' : `Use ${bioName} or your PIN`;

  return (
    <div className="fixed inset-0 z-[60] bg-paper max-w-md mx-auto overflow-hidden isolate animate-[fadeIn_0.2s_ease-out]"
      style={{ opacity: leaving ? 0 : 1, transform: leaving ? 'scale(1.04)' : 'none', transition: 'opacity .4s ease, transform .4s ease' }}>
      <DitherBackground theme={theme} />
      <div className="h-full flex flex-col items-center justify-center px-8">
        {/* Face ID frame with the Kaya mark (check mark once unlocked) */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <span className="absolute inset-0 rounded-[22px] border-2 transition-colors duration-300"
            style={{ borderColor: ok ? '#399d74' : scanning ? 'rgb(var(--muted))' : 'rgb(var(--ink) / 0.15)' }} />
          {scanning && <span className="absolute inset-1.5 rounded-[17px] animate-pulse" style={{ background: 'rgb(var(--muted) / 0.08)' }} />}
          {ok
            ? <span className="text-[#399d74] animate-[kayaFadeUp_0.25s_ease-out]"><Icons.Check size={34} weight="bold" /></span>
            : <img src="/logo-icon.svg" alt="" className="w-10 h-10 kaya-splash-logo" draggable={false} />}
        </div>
        <h1 key={title} className="text-[20px] font-semibold text-ink mt-5 animate-[kayaFadeUp_0.25s_ease-out]">{title}</h1>
        <p className="text-textFaint text-sm mt-1">{sub}</p>

        {usePin ? (
          <div className={`transition-opacity duration-300 ${ok ? 'opacity-0 pointer-events-none' : ''}`}>
            <Dots count={digits.length} error={error} />
            <Keypad
              onDigit={onDigit}
              onBackspace={() => setDigits(d => d.slice(0, -1))}
              biometric={hasBio}
              onBiometric={() => { setUsePin(false); tryBiometric(); }}
            />
            <div className="flex flex-col items-center gap-3 mt-8">
              {hasBio && (
                <button onClick={() => { setUsePin(false); tryBiometric(); }} className="text-textMuted text-sm hover:text-ink transition-colors">Use {bioName} instead</button>
              )}
              {onForgot && (
                <button onClick={onForgot} className="text-textFaint text-sm hover:text-ink transition-colors">Forgot PIN?</button>
              )}
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center transition-opacity duration-300 ${ok ? 'opacity-0 pointer-events-none' : ''}`}>
            <button onClick={tryBiometric} disabled={scanning}
              className="kaya-btn mt-7 h-11 px-5 rounded-full inline-flex items-center gap-2 text-[14px] disabled:opacity-70">
              <Icons.Fingerprint size={18} /> Unlock with {bioName}
            </button>
            <button onClick={() => setUsePin(true)} className="mt-4 text-textFaint text-sm hover:text-ink transition-colors">Use PIN instead</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Sheet to recover access by entering the recovery code.
export const RecoverySheet = ({
  isOpen,
  onClose,
  expectedHash,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  expectedHash: string | null;
  onSuccess: () => void;
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => { if (isOpen) { setCode(''); setError(false); } }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedHash) return;
    const h = await hashRecoveryCode(code);
    if (h === expectedHash) onSuccess();
    else setError(true);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)', visibility: isOpen ? 'visible' : 'hidden', transition: isOpen ? 'transform 300ms ease-out' : 'transform 300ms ease-out, visibility 0s linear 300ms' }} className="fixed bottom-0 inset-x-0 z-[70] kaya-sheet rounded-t-[28px] p-6 pb-10  transition-transform duration-300 ease-out max-w-md mx-auto">
        <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-ink">✕</button>
        <h2 className="text-2xl font-medium text-ink mb-1">Enter recovery code</h2>
        <p className="text-textMuted text-sm mb-5">The code shown when you first set your PIN.</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(false); }}
            placeholder="XXXX-XXXX"
            className={`kaya-field text-center text-xl tracking-[0.3em] uppercase outline-none transition-all placeholder:text-textFaint ${error ? 'border-rose-500' : 'border-ink/10'}`}
          />
          {error && <p className="text-rose-400 text-sm text-center">That code didn’t match. Try again.</p>}
          <button type="submit" className="w-full kaya-btn py-4 rounded-[14px]">
            Unlock & set new PIN
          </button>
        </form>
      </div>
    </>
  );
};

// One-time display of a freshly generated recovery code.
export const RecoveryCodeSheet = ({ code, onClose }: { code: string | null; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const open = !!code;
  return (
    <>
      <div className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} />
      <div style={{ transform: open ? 'translateY(0)' : 'translateY(100%)', visibility: open ? 'visible' : 'hidden', transition: open ? 'transform 300ms ease-out' : 'transform 300ms ease-out, visibility 0s linear 300ms' }} className="fixed bottom-0 inset-x-0 z-[70] kaya-sheet rounded-t-[28px] p-6 pb-10  transition-transform duration-300 ease-out max-w-md mx-auto">
        <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-6" />
        <h2 className="text-2xl font-medium text-ink mb-1">Save your recovery code</h2>
        <p className="text-textMuted text-sm mb-5">
          This is the only way back in if you forget your PIN. Write it down or store it somewhere safe — it won’t be shown again.
        </p>
        <div className="bg-ink/[0.04] border border-ink/10 rounded-[14px] p-5 text-center mb-4">
          <span className="text-3xl font-medium text-ink tracking-[0.25em]">{code}</span>
        </div>
        <button
          onClick={() => { if (code) { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
          className="w-full kaya-btn-secondary py-4 rounded-[14px] mb-3"
        >
          {copied ? 'Copied ✓' : 'Copy code'}
        </button>
        <button onClick={onClose} className="w-full kaya-btn py-4 rounded-[14px]">
          I’ve saved it
        </button>
      </div>
    </>
  );
};

// Bottom sheet to set (or change) the PIN.
export const SetPinSheet = ({
  isOpen,
  onClose,
  onSet
}: {
  isOpen: boolean;
  onClose: () => void;
  onSet: (hash: string) => void;
}) => {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) { setStep('enter'); setFirst(''); setDigits(''); setError(false); }
  }, [isOpen]);

  const onDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      if (step === 'enter') {
        setFirst(next);
        setTimeout(() => { setStep('confirm'); setDigits(''); }, 150);
      } else {
        if (next === first) {
          const h = await hashPin(next);
          onSet(h);
        } else {
          setError(true);
          setTimeout(() => { setError(false); setStep('enter'); setFirst(''); setDigits(''); }, 600);
        }
      }
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)', visibility: isOpen ? 'visible' : 'hidden', transition: isOpen ? 'transform 300ms ease-out' : 'transform 300ms ease-out, visibility 0s linear 300ms' }} className="fixed bottom-0 inset-x-0 z-50 kaya-sheet rounded-t-[28px] p-6 pb-10  transition-transform duration-300 ease-out max-w-md mx-auto">
        <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-ink">✕</button>
        <h2 className="text-2xl font-medium text-ink text-center">
          {step === 'enter' ? 'Set a PIN' : 'Confirm PIN'}
        </h2>
        <p className="text-textMuted text-sm text-center mt-1">
          {error ? 'PINs did not match. Try again.' : '4-digit code to lock the app'}
        </p>
        <Dots count={digits.length} error={error} />
        <Keypad onDigit={onDigit} onBackspace={() => setDigits(d => d.slice(0, -1))} />
      </div>
    </>
  );
};
