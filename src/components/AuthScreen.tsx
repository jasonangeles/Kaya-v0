import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

// Full-screen magic-link sign in. Shown when Supabase is enabled and
// there is no active session.
export const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-8 max-w-md mx-auto bg-black text-white animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <h1 className="text-xl font-medium tracking-wide uppercase">Kaya</h1>
      </div>

      {status === 'sent' ? (
        <div className="text-center mt-2">
          <h2 className="text-2xl font-medium mb-2">Check your email</h2>
          <p className="text-textMuted text-sm leading-relaxed">
            We sent a sign-in link to <span className="text-white">{email}</span>. Open it on this device to continue.
          </p>
          <button
            onClick={() => { setStatus('idle'); setEmail(''); }}
            className="mt-6 text-textMuted text-sm hover:text-white transition-colors"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <p className="text-textMuted text-sm mb-8 text-center">Sign in to sync your wealth across devices</p>
          <form onSubmit={submit} className="w-full space-y-4">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
              placeholder="you@email.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white text-center focus:ring-1 focus:ring-white/40 outline-none transition-all placeholder:text-zinc-700"
            />
            {status === 'error' && <p className="text-rose-400 text-sm text-center">{message}</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
          <p className="text-zinc-600 text-xs mt-6 text-center">No password needed — we email you a secure link.</p>
        </>
      )}
    </div>
  );
};
