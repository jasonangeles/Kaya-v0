import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Icons } from './icons';

// Sign-in / sign-up modal shown over the landing page. Magic-link (email OTP)
// handles both new and returning users with a single flow.
export const SignInModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Reset to a clean state each time it reopens.
  useEffect(() => { if (open) { setStatus('idle'); setMessage(''); } }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) { setStatus('error'); setMessage(error.message); }
    else setStatus('sent');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{ animation: 'fadeIn .2s ease-out' }}
    >
      {/* Dimmed, blurred backdrop over the landing */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      {/* Subtle green glow to match the brand */}
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(16,185,129,0.14), transparent 60%)' }} />

      {/* Card — stopPropagation so clicks inside don't close it */}
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

        {status === 'sent' ? (
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Check your email</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We sent a sign-in link to <span className="text-white">{email}</span>. Open it on this device to continue.
            </p>
            <button
              onClick={() => { setStatus('idle'); setEmail(''); }}
              className="mt-6 text-zinc-400 text-sm hover:text-white transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-white mb-1.5">Track your wealth, anywhere</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Enter your email and we'll send you a sign-in link — no password needed. New here? This creates your account too.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                placeholder="you@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-center focus:ring-1 focus:ring-white/40 focus:border-white/40 outline-none transition-all placeholder:text-zinc-600"
              />
              {status === 'error' && <p className="text-rose-400 text-sm text-center">{message}</p>}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-white hover:opacity-90 text-black font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-50"
              >
                {status === 'sending' ? 'Sending…' : 'Send magic link'}
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
