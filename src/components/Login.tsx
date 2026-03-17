import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Briefcase, Eye, EyeOff, LogIn, UserPlus,
  ShieldCheck, TrendingUp, Users, Loader2,
  AlertTriangle, Clock, CheckCircle2, Database,
  X, ChevronRight, RefreshCw,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import { signIn, signUp, setSession, checkDbSetup } from '../utils/supabaseDb';

interface Props {
  onLogin: (user: AppUser) => void;
}

const ROLES: { value: UserRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'Manager',   label: 'Manager',        icon: <ShieldCheck size={20} />, desc: 'Full access — view all team meetings & reports' },
  { value: 'Sales',     label: 'Sales Executive', icon: <TrendingUp  size={20} />, desc: 'Log meetings, manage leads & close deals' },
  { value: 'BD',        label: 'BD Executive',    icon: <Users       size={20} />, desc: 'Business development — new accounts & partnerships' },
];

type Mode = 'login' | 'register';

// ─── Friendly error messages for every known error code ───────────────────────
function getFriendlyError(error: string): React.ReactNode {
  if (error === 'RATE_LIMIT') {
    return (
      <span>
        ⏱️ <strong>Too many requests.</strong> Supabase limits signup emails on free tier.
        <br />→ Wait 60 seconds and try again.
        <br />→ OR go to <strong>Supabase → Authentication → Providers → Email → turn OFF "Confirm email"</strong>
      </span>
    );
  }
  if (error === 'EMAIL_NOT_CONFIRMED') {
    return (
      <span>
        📧 <strong>Email not confirmed.</strong>
        <br />→ Go to <strong>Supabase Dashboard → Authentication → Providers → Email</strong>
        <br />→ Turn <strong>OFF</strong> "Confirm email" → Save
        <br />→ Then try signing in again.
      </span>
    );
  }
  if (error === 'WRONG_CREDENTIALS') {
    return (
      <span>
        ❌ <strong>Wrong email or password.</strong>
        <br />→ Double-check your email and password.
        <br />→ Don't have an account? Click <strong>"Create Account"</strong> tab above.
      </span>
    );
  }
  if (error === 'DB_NOT_SETUP') {
    return (
      <span>
        🗄️ <strong>Database tables not found.</strong>
        <br />→ You need to run the setup SQL in Supabase first.
        <br />→ Click the <strong>"Database Setup Guide"</strong> button below.
      </span>
    );
  }
  return <span>{error}</span>;
}

export default function Login({ onLogin }: Props) {
  const [mode, setMode]           = useState<Mode>('login');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [checking, setChecking]   = useState(true);
  const [dbOk, setDbOk]           = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass,  setLoginPass]  = useState('');

  // Register fields
  const [regName,  setRegName]  = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass,  setRegPass]  = useState('');
  const [regRole,  setRegRole]  = useState<UserRole>('Sales');

  // Check DB on mount
  useEffect(() => {
    checkDb();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const checkDb = async () => {
    setChecking(true);
    const result = await checkDbSetup();
    setDbOk(result === null);
    setChecking(false);
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!loginEmail.trim() || !loginPass) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { user, error } = await signIn(loginEmail.trim().toLowerCase(), loginPass);
    setLoading(false);
    if (error || !user) {
      setErrorMsg(error ?? 'Login failed. Please try again.');
      if (error === 'DB_NOT_SETUP') setShowSetup(true);
      return;
    }
    setSession(user);
    toast.success(`Welcome back, ${user.name}! 👋`);
    onLogin(user);
  };

  // ── Register ─────────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!regName.trim() || !regEmail.trim() || !regPass) {
      setErrorMsg('Please fill all fields.');
      return;
    }
    if (regPass.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (countdown > 0) {
      setErrorMsg(`Please wait ${countdown} seconds before trying again.`);
      return;
    }
    setLoading(true);
    const { user, error } = await signUp(regName.trim(), regEmail.trim().toLowerCase(), regPass, regRole);
    setLoading(false);

    if (error || !user) {
      if (error === 'RATE_LIMIT') startCountdown(60);
      if (error === 'DB_NOT_SETUP') setShowSetup(true);
      setErrorMsg(error ?? 'Registration failed. Please try again.');
      return;
    }
    setSession(user);
    setSuccessMsg(`✅ Account created! Welcome, ${user.name}!`);
    toast.success(`Account created! Welcome, ${user.name}! 🎉`);
    setTimeout(() => onLogin(user), 800);
  };

  const SQL = `-- Drop existing tables if any
drop table if exists meetings;
drop table if exists inventory;
drop table if exists profiles;

-- Profiles table
create table profiles (
  id uuid references auth.users on delete cascade,
  name text not null,
  role text not null,
  created_at timestamp default now(),
  primary key (id)
);

-- Meetings table
create table meetings (
  id text primary key,
  sales_person_id text, sales_person_name text, sales_person_role text,
  client_name text, job_title text, company_name text,
  phone text, email text, response text, lead_type text,
  city text, address text, meeting_duration text,
  next_meeting_date text, deal_amount text, deal_qty text,
  product_sold text, photo_url text, latitude text,
  longitude text, location_address text, visit_time text,
  created_at timestamp default now()
);

-- Inventory table
create table inventory (
  id text primary key,
  name text not null, price numeric not null, category text not null,
  created_at timestamp default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table meetings enable row level security;
alter table inventory enable row level security;

-- Policies for profiles
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Policies for meetings
create policy "Auth read meetings" on meetings for select using (auth.role() = 'authenticated');
create policy "Auth insert meetings" on meetings for insert with check (auth.role() = 'authenticated');
create policy "Auth update meetings" on meetings for update using (auth.role() = 'authenticated');
create policy "Auth delete meetings" on meetings for delete using (auth.role() = 'authenticated');

-- Policies for inventory
create policy "Auth read inventory" on inventory for select using (auth.role() = 'authenticated');
create policy "Auth insert inventory" on inventory for insert with check (auth.role() = 'authenticated');
create policy "Auth update inventory" on inventory for update using (auth.role() = 'authenticated');
create policy "Auth delete inventory" on inventory for delete using (auth.role() = 'authenticated');

-- Storage bucket for photos
insert into storage.buckets (id, name, public)
  values ('visit-photos', 'visit-photos', false)
  on conflict (id) do nothing;

create policy "Auth upload photos" on storage.objects
  for insert with check (bucket_id = 'visit-photos' AND auth.role() = 'authenticated');
create policy "Auth read photos" on storage.objects
  for select using (bucket_id = 'visit-photos' AND auth.role() = 'authenticated');
create policy "Auth delete photos" on storage.objects
  for delete using (bucket_id = 'visit-photos' AND auth.role() = 'authenticated');`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── DB SETUP MODAL ── */}
      {showSetup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Database size={22} className="text-blue-400" />
                <h2 className="text-white font-bold text-lg">Database Setup Guide</h2>
              </div>
              <button onClick={() => setShowSetup(false)} className="text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">

              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">1</div>
                <div>
                  <p className="text-white font-semibold mb-1">Go to Supabase SQL Editor</p>
                  <p className="text-slate-400 text-sm">
                    Open <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">supabase.com</a> → Your project → <strong className="text-white">SQL Editor</strong> (left menu) → <strong className="text-white">New query</strong>
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
                <div className="w-full">
                  <p className="text-white font-semibold mb-2">Paste this SQL and click RUN ▶</p>
                  <div className="relative">
                    <pre className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">{SQL}</pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(SQL); toast.success('SQL copied!'); }}
                      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">3</div>
                <div>
                  <p className="text-white font-semibold mb-1">Disable Email Confirmation</p>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-sm">
                    <p className="flex items-center gap-1.5 mb-1">
                      <ChevronRight size={14} /> Authentication (left menu)
                    </p>
                    <p className="flex items-center gap-1.5 mb-1">
                      <ChevronRight size={14} /> Providers → Email
                    </p>
                    <p className="flex items-center gap-1.5">
                      <ChevronRight size={14} /> Turn <strong className="text-amber-300 mx-1">OFF</strong> "Confirm email" → Save
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">4</div>
                <div>
                  <p className="text-white font-semibold mb-1">Come back here and click "Check Again"</p>
                  <button
                    onClick={async () => { await checkDb(); if (dbOk) { setShowSetup(false); toast.success('Database is ready! ✅'); } }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
                  >
                    <RefreshCw size={15} /> Check Again
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-900/60 mb-4">
            <Briefcase size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SalesCRM</h1>
          <p className="text-blue-300 mt-1 text-sm">Field Sales Management Platform</p>
        </div>

        {/* DB Status Banner */}
        {checking ? (
          <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <Loader2 size={16} className="text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-slate-400 text-xs">Checking database connection…</p>
          </div>
        ) : dbOk === false ? (
          <div className="mb-4 bg-red-500/10 border border-red-500/40 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Database size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-300 font-semibold text-sm mb-1">⚠️ Database not set up yet</p>
                <p className="text-red-400 text-xs mb-3">The database tables are missing. You must run the setup SQL in Supabase before you can create accounts or log in.</p>
                <button
                  onClick={() => setShowSetup(true)}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                >
                  <Database size={13} /> View Setup Guide
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-green-300 text-xs font-medium">✅ Database connected — ready to use</p>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === m ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2 items-start">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-red-300 text-xs leading-relaxed">{getFriendlyError(errorMsg)}</div>
            </div>
          )}

          {/* DB not setup shortcut */}
          {(errorMsg === 'DB_NOT_SETUP') && (
            <button
              onClick={() => setShowSetup(true)}
              className="mb-4 w-full bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600/30 transition"
            >
              <Database size={14} /> Open Database Setup Guide
            </button>
          )}

          {/* Success */}
          {successMsg && (
            <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex gap-2 items-start">
              <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-xs leading-relaxed">{successMsg}</p>
            </div>
          )}

          {/* Countdown */}
          {countdown > 0 && (
            <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex gap-2 items-center">
              <Clock size={16} className="text-orange-400 flex-shrink-0" />
              <p className="text-orange-300 text-xs">
                Rate limit — please wait <span className="font-bold text-orange-200 text-sm">{countdown}s</span> before trying again.
              </p>
            </div>
          )}

          {/* ── SIGN IN ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                <input
                  type="email" value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setErrorMsg(''); }}
                  placeholder="you@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={loginPass}
                    onChange={(e) => { setLoginPass(e.target.value); setErrorMsg(''); }}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button
                type="submit" disabled={loading || dbOk === false}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 text-sm"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <><LogIn size={16} /> Sign In</>}
              </button>
              <p className="text-center text-slate-500 text-xs">
                Don't have an account?{' '}
                <button type="button" onClick={() => { setMode('register'); setErrorMsg(''); }} className="text-blue-400 hover:text-blue-300 font-medium">
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ── CREATE ACCOUNT ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                <input
                  type="text" value={regName}
                  onChange={(e) => { setRegName(e.target.value); setErrorMsg(''); }}
                  placeholder="Rahul Sharma"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                <input
                  type="email" value={regEmail}
                  onChange={(e) => { setRegEmail(e.target.value); setErrorMsg(''); }}
                  placeholder="you@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={regPass}
                    onChange={(e) => { setRegPass(e.target.value); setErrorMsg(''); }}
                    placeholder="Min 6 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Your Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value} type="button" onClick={() => setRegRole(r.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all duration-150 ${
                        regRole === r.value
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {r.icon}
                      <span className="text-center leading-tight">{r.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-2 text-center">{ROLES.find((r) => r.value === regRole)?.desc}</p>
              </div>
              <button
                type="submit" disabled={loading || countdown > 0 || dbOk === false}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 text-sm"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                ) : countdown > 0 ? (
                  <><Clock size={16} /> Wait {countdown}s…</>
                ) : (
                  <><UserPlus size={16} /> Create Account</>
                )}
              </button>
              <p className="text-center text-slate-500 text-xs">
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setErrorMsg(''); }} className="text-blue-400 hover:text-blue-300 font-medium">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center space-y-2">
          <p className="text-slate-600 text-xs flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-green-500" />
            Secured by Supabase — passwords hashed, data encrypted, cross-device sync
          </p>
          {dbOk === false && (
            <button
              onClick={() => setShowSetup(true)}
              className="text-blue-400 hover:text-blue-300 text-xs underline flex items-center gap-1 mx-auto"
            >
              <Database size={12} /> Database Setup Guide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
