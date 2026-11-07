import React, { useState } from 'react';
import { 
  Compass, 
  Sparkles, 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  User, 
  Building2, 
  CheckCircle2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('Western Polytechnic Institute');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const demoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Chief Registrar',
      institution: 'Western Polytechnic Institute',
      email: 'k.reynolds@westernpoly.edu',
      avatarColor: 'from-[#9c4126] to-[#f27438]',
      initials: 'KR',
      badge: 'Registrar'
    },
    {
      id: 'dean' as const,
      name: 'Prof. Alistair MacIntyre',
      role: 'Dean of Sciences',
      institution: 'Oxford Union Sciences',
      email: 'a.macintyre@oxford.ac.uk',
      avatarColor: 'from-[#3b1e4a] to-[#7209b7]',
      initials: 'AM',
      badge: 'Faculty'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin',
      role: 'Student Senate Chair',
      institution: 'Western Polytechnic Institute',
      email: 'm.lin@westernpoly.edu',
      avatarColor: 'from-[#18794e] to-[#25a26c]',
      initials: 'ML',
      badge: 'Student'
    }
  ];

  const handleProfileSelect = (p: typeof demoAccounts[0]) => {
    setSelectedProfile(p.id);
    setEmail(p.email);
    setName(p.name);
    setInstitution(p.institution);
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd || pwd === '••••••••••••') return { score: 4, label: 'Secure SAML Passkey', color: 'bg-[#18794e]' };
    if (pwd.length < 6) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (pwd.length < 10) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    return { score: 4, label: 'Institutional Strength', color: 'bg-[#18794e]' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);

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
      }, 400);
    }, 650);
  };

  return (
    <div className="relative min-h-screen bg-[#fbf8fc] text-[#1f1b20] flex flex-col justify-center items-center px-4 sm:px-6 py-12 antialiased selection:bg-[#f27438]/20 overflow-hidden">
      {/* Subtle Dot Grid & Ambient Atmospheric Backing */}
      <div className="absolute inset-0 bg-dot-grid-subtle opacity-70 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-[#ffe6dc]/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gradient-to-tl from-[#edd5f2]/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Back Button */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mb-5 relative z-10"
      >
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#655d69] hover:text-[#1f1b20] hover:bg-white/80 border border-transparent hover:border-[#ece6ed] transition-all shadow-xs cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Public Showcase</span>
        </button>
      </motion.div>

      {/* Main Form Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md border border-[#ece6ed] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-7 sm:p-9 space-y-6 relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3b1e4a] via-[#522567] to-[#1f0e27] flex items-center justify-center text-white mx-auto shadow-md shadow-[#3b1e4a]/15 group">
              <Compass className="w-6 h-6 text-[#f27438] animate-pulse-subtle" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#18794e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#18794e]"></span>
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#1f1b20]">
            SMARTGRID <span className="text-[#9c4126]">AI</span>
          </h1>
          <p className="text-xs text-[#655d69] max-w-xs mx-auto">
            {mode === 'signin' 
              ? 'Multi-Objective Combinatorial Solver Workspace' 
              : 'Deploy Equilibrium Engine for your campus'}
          </p>
        </div>

        {/* Mode Switcher with Fluid Tab Pill */}
        <div className="relative flex p-1 bg-[#f6f2f7] rounded-xl border border-[#ece6ed] text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-center rounded-lg transition-all relative z-10 cursor-pointer ${
              mode === 'signin' 
                ? 'text-[#3b1e4a] font-extrabold shadow-xs bg-white' 
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-center rounded-lg transition-all relative z-10 cursor-pointer ${
              mode === 'signup' 
                ? 'text-[#3b1e4a] font-extrabold shadow-xs bg-white' 
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* 1-Click Demo Profiles (Clean Interactive Pills) */}
        {mode === 'signin' && (
          <div className="space-y-2.5 pt-0.5">
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-[#7c747f]">
              <span className="flex items-center gap-1 font-semibold text-[#1f1b20]">
                <Zap className="w-3 h-3 text-[#f27438]" /> 1-Click Fast-Pass Profiles
              </span>
              <span className="text-[#18794e] font-bold bg-[#eaf8f0] px-1.5 py-0.5 rounded">
                Instant Auth
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map(account => {
                const isSelected = selectedProfile === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleProfileSelect(account)}
                    className={`relative p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#9c4126] bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] shadow-xs ring-1 ring-[#9c4126]'
                        : 'border-[#ece6ed] bg-[#fcfaff] hover:bg-white hover:border-[#dcd6df]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${account.avatarColor} text-white flex items-center justify-center text-[10px] font-bold font-mono shadow-xs`}>
                        {account.initials}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#9c4126]" />
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-[#1f1b20] truncate leading-tight">
                        {account.name.split(' ').pop()}
                      </div>
                      <div className="text-[9px] font-mono text-[#7c747f] truncate mt-0.5">
                        {account.badge}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <AnimatePresence mode="wait">
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3.5"
              >
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1f1b20]">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#7c747f] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Eleanor Vance"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] focus:ring-2 focus:ring-[#3b1e4a]/10 bg-[#fbf8fc] text-[#1f1b20] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1f1b20]">
                    University / Institution
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-[#7c747f] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Western Polytechnic"
                      value={institution}
                      onChange={e => setInstitution(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] focus:ring-2 focus:ring-[#3b1e4a]/10 bg-[#fbf8fc] text-[#1f1b20] transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1f1b20]">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#7c747f] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="user@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] focus:ring-2 focus:ring-[#3b1e4a]/10 bg-[#fbf8fc] text-[#1f1b20] transition-all"
              />
            </div>
          </div>

          {/* Password with visibility toggle */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1f1b20]">
                Password / SAML Passkey
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => alert('Demo mode: Click any of the 1-click profiles above to sign in instantly.')}
                  className="text-[10px] text-[#9c4126] font-semibold hover:underline cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#7c747f] absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-[#ece6ed] focus:outline-none focus:border-[#3b1e4a] focus:ring-2 focus:ring-[#3b1e4a]/10 bg-[#fbf8fc] text-[#1f1b20] transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-[#7c747f] hover:text-[#1f1b20] p-1 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password security meter */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[#7c747f] pt-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${strength.color}`} />
                <span>{strength.label}</span>
              </div>
              <span className="text-[#18794e]">256-Bit TLS</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-80 cursor-pointer"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
                <span>Equilibrium Verified! Entering...</span>
              </>
            ) : isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Parity...</span>
              </span>
            ) : mode === 'signin' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
                <span>Launch Workspace</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
                <span>Initialize Campus Core</span>
              </>
            )}
          </button>
        </form>

        {/* Security / FERPA footer note */}
        <div className="pt-2 text-center text-[10px] font-mono text-[#7c747f] flex items-center justify-center gap-2 border-t border-[#ece6ed]">
          <ShieldCheck className="w-4 h-4 text-[#18794e]" />
          <span>FERPA • SOC2 TYPE II • SINGLE SIGN-ON SYNCHRONIZED</span>
        </div>
      </motion.div>
    </div>
  );
};
