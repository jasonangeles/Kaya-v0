import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Icons } from './icons';

// Sign-in / sign-up modal. Email OTP handles new + returning users with one flow.
// Users can tap the emailed link (best on desktop) or enter the 6-digit code
// (best on phones / home-screen apps, where the link opens a different browser
// context and breaks the session).
export const SignInModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  useEffect(() => { if (open) { setPhase('email'); setBusy(false); setMessage(''); setCode(''); } }, [open]);

  if (!open) return null;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setPhase('code'); setCode(''); }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || code.trim().length < 6) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage("That code didn't work. Check it and try again.");
    // On success, the app's auth listener swaps to the signed-in view.
  };

  const reset = () => { setPhase('email'); setEmail(''); setCode(''); setMessage(''); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{ animation: 'fadeIn .2s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(16,185,129,0.14), transparent 60%)' }} />

      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0c0c] p-7 shadow-2xl"
        style={{ animation: 'fadeIn .25s ease-out' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Icons.Close className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium tracking-wide uppercase text-sm text-white">Kaya</span>
        </div>

        {phase === 'code' ? (
          <>
            <h2 className="text-2xl font-semibold text-white mb-1.5">Enter your code</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              We emailed a 6-digit code to <span className="text-white">{email}</span>. Enter it below — or tap the link in the email if you're on a computer.
            </p>
            <form onSubmit={verifyCode} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (message) setMessage(''); }}
                placeholder="123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-center text-2xl tracking-[0.4em] font-semibold focus:ring-1 focus:ring-white/40 focus:border-white/40 outline-none transition-all placeholder:text-zinc-700 placeholder:tracking-normal placeholder:text-base"
              />
              {message && <p className="text-rose-400 text-sm text-center">{message}</p>}
              <button
                type="submit"
                disabled={code.length < 6 || busy}
                className="w-full bg-white hover:opacity-90 text-black font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>
            <div className="flex items-center justify-center gap-4 mt-5 text-[13px]">
              <button onClick={sendCode} disabled={busy} className="text-zinc-400 hover:text-white transition-colors disabled:opacity-50">Resend code</button>
              <span className="text-zinc-700">·</span>
              <button onClick={reset} className="text-zinc-400 hover:text-white transition-colors">Use a different email</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-white mb-1.5">Track your wealth, anywhere</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Enter your email and we'll send you a code (and a link) — no password needed. New here? This creates your account too.
            </p>
            <form onSubmit={sendCode} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (message) setMessage(''); }}
                placeholder="you@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-center focus:ring-1 focus:ring-white/40 focus:border-white/40 outline-none transition-all placeholder:text-zinc-600"
              />
              {message && <p className="text-rose-400 text-sm text-center">{message}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-white hover:opacity-90 text-black font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Continue with email'}
              </button>
            </form>
            <p className="text-zinc-600 text-[11px] leading-relaxed text-center mt-5">
              Kaya never connects to your bank. Your data stays on your device and syncs privately to your account.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
