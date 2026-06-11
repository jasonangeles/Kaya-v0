import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Icons } from './icons';

// A small, non-interactive preview of the main app (dummy data) shown inside a
// phone silhouette, so new users can see what Kaya looks like before signing in.
const AppPreview: React.FC = () => (
  <div className="relative mx-auto w-full max-w-[268px]">
    <div
      className="rounded-[2.4rem] border border-white/10 bg-[#0a0a0a] p-3 shadow-2xl"
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000 58%, transparent 98%)',
        maskImage: 'linear-gradient(to bottom, #000 58%, transparent 98%)'
      }}
    >
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/10" />

      {/* Net worth + chart */}
      <div className="rounded-2xl bg-[#141414] border border-white/5 p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Net Worth</p>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-base text-zinc-500">₱</span>
          <span className="text-2xl font-semibold tracking-tight">1,284,930</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-emerald-400 text-[11px] font-medium">▲ 3.1%</span>
          <span className="text-zinc-600 text-[10px]">past month</span>
        </div>
        <div className="px-2">
          <svg viewBox="0 0 200 56" className="w-full h-12" preserveAspectRatio="none">
            <defs>
              <linearGradient id="authChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,42 C18,38 26,40 40,34 S70,30 86,32 110,20 128,22 158,12 176,14 200,8 L200,56 L0,56 Z" fill="url(#authChart)" />
            <path d="M0,42 C18,38 26,40 40,34 S70,30 86,32 110,20 128,22 158,12 176,14 200,8" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex justify-between mt-2">
          {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((r, i) => (
            <span key={r} className={`text-[8px] px-1.5 py-0.5 rounded-full ${i === 5 ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>{r}</span>
          ))}
        </div>
      </div>

      {/* A few assets */}
      <div className="mt-2 rounded-2xl bg-[#141414] border border-white/5 overflow-hidden">
        {[
          { icon: <Icons.Bank size={13} />, name: 'Emergency Fund', sub: 'BPI', val: '₱150,000' },
          { icon: <Icons.Wallet size={13} />, name: 'TFSA', sub: 'Wealthsimple', val: 'C$12,500' },
          { icon: <Icons.Crypto size={13} />, name: 'Bitcoin', sub: 'Ledger', val: '₿0.15' }
        ].map((a, i) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < 2 ? 'border-b border-white/5' : ''}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-zinc-400">{a.icon}</span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-white leading-tight truncate">{a.name}</span>
                <span className="block text-[9px] text-zinc-500 leading-tight">{a.sub}</span>
              </span>
            </div>
            <span className="text-[11px] font-medium text-zinc-200">{a.val}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

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
    if (error) { setStatus('error'); setMessage(error.message); }
    else setStatus('sent');
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-white relative overflow-hidden">
      {/* Green ambient glow (matches the chart hue) — spans the full viewport width */}
      <div
        className="absolute top-0 inset-x-0 h-2/3 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse 75% 55% at 50% 0%, rgba(16,185,129,0.30) 0%, rgba(16,185,129,0.08) 32%, transparent 62%)' }}
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-10 flex flex-col relative z-10 w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-7">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-lg font-medium tracking-wide uppercase">Kaya</h1>
        </div>

        <AppPreview />

        <div className="mt-9 mb-2">
          {status === 'sent' ? (
            <div className="text-center">
              <h2 className="text-2xl font-medium mb-2">Check your email</h2>
              <p className="text-textMuted text-sm leading-relaxed">
                We sent a sign-in link to <span className="text-white">{email}</span>. Open it on this device to continue.
              </p>
              <button onClick={() => { setStatus('idle'); setEmail(''); }} className="mt-6 text-textMuted text-sm hover:text-white transition-colors">
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-medium text-center mb-1">Track your wealth, anywhere</h2>
              <p className="text-textMuted text-sm text-center mb-6">Sign in to sync across devices — no password needed.</p>
              <form onSubmit={submit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                  placeholder="you@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-center focus:ring-1 focus:ring-white/40 focus:border-white/40 outline-none transition-all placeholder:text-zinc-600"
                />
                {status === 'error' && <p className="text-rose-400 text-sm text-center">{message}</p>}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-white hover:opacity-90 text-black font-bold py-4 rounded-xl transition-opacity disabled:opacity-50"
                >
                  {status === 'sending' ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="text-zinc-600 text-[11px] leading-relaxed text-center px-6 pb-8 pt-3 relative z-10 w-full max-w-md mx-auto">
        Kaya never connects to your bank — you enter everything yourself. Your data is stored on your device and synced privately to your account over an encrypted connection. No passwords, no ads.
      </p>
    </div>
  );
};
