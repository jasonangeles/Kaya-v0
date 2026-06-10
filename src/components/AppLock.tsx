import React, { useEffect, useState } from 'react';
import { Icons } from './icons';

// --- Crypto + WebAuthn helpers -------------------------------------------

export const hashPin = async (pin: string): Promise<string> => {
  const data = new TextEncoder().encode('kaya-pin-salt:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

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
          error ? 'bg-rose-500' : i < count ? 'bg-white' : 'bg-zinc-700'
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
  <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
      <button
        key={n}
        onClick={() => onDigit(n)}
        className="h-16 w-16 mx-auto rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-white text-2xl font-medium transition-all flex items-center justify-center"
      >
        {n}
      </button>
    ))}
    <button
      onClick={onBiometric}
      disabled={!biometric}
      className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center transition-all ${biometric ? 'text-white hover:bg-white/10 active:scale-95' : 'opacity-0 pointer-events-none'}`}
      aria-label="Use biometrics"
    >
      <Icons.Fingerprint size={26} />
    </button>
    <button
      onClick={() => onDigit('0')}
      className="h-16 w-16 mx-auto rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-white text-2xl font-medium transition-all flex items-center justify-center"
    >
      0
    </button>
    <button
      onClick={onBackspace}
      className="h-16 w-16 mx-auto rounded-full text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center"
      aria-label="Delete"
    >
      <Icons.Backspace size={24} />
    </button>
  </div>
);

// Full-screen lock overlay shown when the app is locked.
export const LockScreen = ({
  expectedHash,
  biometric,
  biometricId,
  onUnlock
}: {
  expectedHash: string;
  biometric: boolean;
  biometricId: string | null;
  onUnlock: () => void;
}) => {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);

  const tryBiometric = async () => {
    if (!biometric || !biometricId) return;
    const ok = await verifyBiometric(biometricId);
    if (ok) onUnlock();
  };

  useEffect(() => {
    // Auto-prompt biometrics as soon as the lock appears.
    tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      const h = await hashPin(next);
      if (h === expectedHash) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => { setError(false); setDigits(''); }, 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center px-8 max-w-md mx-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <h1 className="text-lg font-medium tracking-wide text-white uppercase">Kaya</h1>
      </div>
      <p className="text-textMuted text-sm mb-2">Enter your PIN to unlock</p>
      <Dots count={digits.length} error={error} />
      <Keypad
        onDigit={onDigit}
        onBackspace={() => setDigits(d => d.slice(0, -1))}
        biometric={biometric && !!biometricId}
        onBiometric={tryBiometric}
      />
    </div>
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
        className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed bottom-0 left-0 w-full z-50 bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 pb-10 shadow-2xl transform transition-transform duration-300 ease-out max-w-md mx-auto ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6" />
        <button onClick={onClose} className="absolute top-6 right-6 text-textMuted hover:text-white">✕</button>
        <h2 className="text-2xl font-medium text-white text-center">
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
