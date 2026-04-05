import { useState } from 'react';
import { ArrowRight, CheckCircle2, LogIn, ShieldCheck, Sparkles, UserPlus, WalletCards } from 'lucide-react';

import { api } from '../api';
import type { CurrentUser } from '../lib/types';

interface LoginProps {
  onLogin: (user: CurrentUser) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const currentUser = await api.register(registerForm);
      onLogin(currentUser);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to register');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const currentUser = await api.login(loginForm);
      onLogin(currentUser);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to log in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-8 font-sans text-slate-200 antialiased selection:bg-emerald-500/30 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="auth-orb auth-orb-left" />
        <div className="auth-orb auth-orb-right" />
        <div className="auth-orb auth-orb-bottom" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(rgba(255,255,255,0.15)_0.8px,transparent_0.8px)] [background-position:0_0] [background-size:18px_18px]" />
      </div>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr,0.9fr] lg:gap-16">
        <section className="auth-fade-up flex flex-col gap-8 lg:pr-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 backdrop-blur-md">
              <Sparkles className="h-4 w-4" />
              <span>SplitMint Karbon Auth</span>
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Shared expenses,
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-100 bg-clip-text text-transparent">
                beautifully scoped.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Register securely, step back into your own workspace later, and keep every balance, group, and expense perfectly synced to your profile.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Private Accounts', 'Your email, your personal session.'],
              ['Distinct Workspaces', 'Exclusive starter groups per user.'],
              ['Clear Ownership', 'Balances follow the logged-in account.'],
              ['Secure Flow', 'Password-based auth with separate user data.']
            ].map(([title, body], index) => (
              <div
                key={title}
                className="auth-feature-card auth-fade-up group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-emerald-500/30 hover:bg-white/[0.04]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-fade-up relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto" style={{ animationDelay: '120ms' }}>
          <div className="auth-shell relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111]/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_70%)]" />

            <div className="relative mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {mode === 'register' ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {mode === 'register' ? 'Start tracking expenses instantly.' : 'Log in to your SplitMint world.'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="mb-8 flex rounded-xl border border-white/5 bg-black/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <UserPlus className="h-4 w-4" /> Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <LogIn className="h-4 w-4" /> Login
              </button>
            </div>

            {error ? (
              <div className="auth-fade-up mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <span>{error}</span>
              </div>
            ) : null}

            {mode === 'register' ? (
              <form onSubmit={handleRegister} className="auth-fade-up flex flex-col gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Full Name</label>
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                    placeholder="Risha Sharma"
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email Address</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                    placeholder="risha@example.com"
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-emerald-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Creating account...' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="auth-fade-up flex flex-col gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email Address</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                    placeholder="risha@example.com"
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                    placeholder="Your password"
                    minLength={6}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/5 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-emerald-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Signing in...' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="mt-8 flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-slate-400">
                Every successful sign-in restores a user-specific world with its own workspace owner, participants, and expenses.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
