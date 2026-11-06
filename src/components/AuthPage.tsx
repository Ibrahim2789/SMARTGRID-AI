import React, { useState } from 'react';
import { Compass, Sparkles, ArrowRight, ArrowLeft, Check, ShieldCheck } from 'lucide-react';

interface AuthPageProps {
  onLogin: (user: { name: string; role: string; email: string; institution?: string }) => void;
  onCancel: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLogin,
  onCancel,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  
  // Quick demo profiles
  const [selectedProfile, setSelectedProfile] = useState<'registrar' | 'dean' | 'student'>('registrar');
  
  // Fields
  const [email, setEmail] = useState('k.reynolds@westernpoly.edu');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('Western Polytechnic Institute');
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Chief Registrar',
      institution: 'Western Polytechnic Institute',
      email: 'k.reynolds@westernpoly.edu'
    },
    {
      id: 'dean' as const,
      name: 'Prof. Alistair MacIntyre',
      role: 'Dean of Sciences',
      institution: 'Oxford Union Sciences',
      email: 'a.macintyre@oxford.ac.uk'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin',
      role: 'Student Senate Chair',
      institution: 'Western Polytechnic Institute',
      email: 'm.lin@westernpoly.edu'
    }
  ];

  const handleProfileSelect = (p: typeof demoAccounts[0]) => {
    setSelectedProfile(p.id);
    setEmail(p.email);
    setName(p.name);
    setInstitution(p.institution);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (mode === 'signin') {
        const found = demoAccounts.find(d => d.id === selectedProfile) || {
          name: email.split('@')[0],
          role: 'Academic Administrator',
          institution: institution,
          email: email
        };
        onLogin(found);
      } else {
        onLogin({
          name: name || 'Academic Coordinator',
          role: 'Academic Administrator',
          institution: institution || 'University Campus',
          email: email || 'admin@university.edu'
        });
      }
      setIsLoading(false);
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] flex flex-col justify-center items-center px-6 py-12 antialiased">
      {/* Back button */}
      <div className="w-full max-w-md mb-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#655d69] hover:text-[#1f1b20] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Public Showcase
        </button>
      </div>

      {/* Minimal Card Container */}
      <div className="w-full max-w-md bg-white border border-[#ece6ed] rounded-xl shadow-sm p-8 sm:p-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#3b1e4a] flex items-center justify-center text-white mx-auto shadow-xs">
            <Compass className="w-5 h-5 text-[#f27438]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1f1b20]">
            SMARTGRID <span className="text-[#f27438]">AI</span>
          </h1>
          <p className="text-xs text-[#655d69]">
            {mode === 'signin' ? 'Sign in to access your campus timetable workspace' : 'Register your institution for the deterministic solver'}
          </p>
        </div>

        {/* Minimal Mode Switcher */}
        <div className="flex border-b border-[#ece6ed] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 pb-2.5 text-center transition-colors border-b-2 ${
              mode === 'signin'
                ? 'border-[#3b1e4a] text-[#3b1e4a] font-bold'
                : 'border-transparent text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 pb-2.5 text-center transition-colors border-b-2 ${
              mode === 'signup'
                ? 'border-[#3b1e4a] text-[#3b1e4a] font-bold'
                : 'border-transparent text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* 1-Click Demo Profiles (Clean minimal chips) */}
        {mode === 'signin' && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-[10px] font-mono uppercase text-[#7c747f]">
              <span>Quick Demo Access</span>
              <span className="text-[#18794e] font-semibold">1-Click</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleProfileSelect(account)}
                  className={`py-2 px-2.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center transition-all cursor-pointer ${
                    selectedProfile === account.id
                      ? 'bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] text-[#9c4126] font-bold shadow-xs'
                      : 'bg-[#fbf8fc] text-[#655d69] hover:bg-white'
                  }`}
                >
                  <div className="text-[11px] truncate leading-tight">{account.name.split(' ')[1] || account.name}</div>
                  <div className="text-[9px] font-mono text-[#7c747f] truncate mt-0.5">{account.role}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clean Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {mode === 'signup' && (
            <>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#1f1b20]">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Eleanor Vance"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc] text-[#1f1b20]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#1f1b20]">University or College</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stanford University"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc] text-[#1f1b20]"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#1f1b20]">Institutional Email</label>
            <input
              type="email"
              required
              placeholder="user@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc] text-[#1f1b20]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-[#1f1b20]">Password / SAML Credential</label>
              {mode === 'signin' && (
                <span className="text-[10px] text-[#9c4126] cursor-pointer hover:underline">Forgot?</span>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc] text-[#1f1b20]"
            />
          </div>

          {/* Minimal CTA Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[#9c4126] hover:bg-[#83341d] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-75"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : mode === 'signin' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#fbbd9c]" />
                <span>Sign In to Workspace</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#fbbd9c]" />
                <span>Create Campus Workspace</span>
              </>
            )}
          </button>
        </form>

        {/* Security / FERPA note */}
        <div className="pt-2 text-center text-[10px] font-mono text-[#7c747f] flex items-center justify-center gap-1.5 border-t border-[#ece6ed]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#18794e]" />
          <span>FERPA & Title IV Accredited SSO</span>
        </div>
      </div>
    </div>
  );
};
