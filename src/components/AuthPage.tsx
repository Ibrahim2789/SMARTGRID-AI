import React, { useState } from 'react';
import { 
  Compass, 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  User, 
  Building2, 
  CheckCircle2
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
  const [selectedProfile, setSelectedProfile] = useState<'registrar' | 'dean' | 'student'>('registrar');
  
  const [email, setEmail] = useState('k.reynolds@westernpoly.edu');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('Western Polytechnic Institute');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);

  const demoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Chief University Registrar',
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
    setHelperNotice(null);
  };

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
      }, 300);
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] flex flex-col justify-center items-center px-4 sm:px-6 py-12 antialiased">
      {/* Top Header / Back Button */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={onCancel}
          className="btn-secondary h-9 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Public Overview</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-md bg-white border border-[#ece6ed] rounded-xl shadow-sm p-7 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-[#3b1e4a] flex items-center justify-center text-white mx-auto mb-2 shadow-xs">
            <Compass className="w-5 h-5 text-[#f27438]" />
          </div>

          <h1 className="text-xl font-extrabold text-[#1f1b20]">
            {mode === 'signin' ? 'Sign in to SmartGrid AI' : 'Create Campus Account'}
          </h1>
          <p className="text-xs text-[#655d69]">
            Institutional timetable generation & scheduling workspace
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 bg-[#f6f2f7] rounded-xl border border-[#ece6ed] text-xs">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer font-bold ${
              mode === 'signin' 
                ? 'bg-white text-[#3b1e4a] shadow-xs' 
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer font-bold ${
              mode === 'signup' 
                ? 'bg-white text-[#3b1e4a] shadow-xs' 
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Register Institution
          </button>
        </div>

        {/* 1-Click Fast Profiles */}
        {mode === 'signin' && (
          <div className="space-y-2">
            <div className="text-xs text-[#655d69] font-bold">
              Instant Demo Accounts (1-Click Switch)
            </div>

            <div className="space-y-1.5">
              {demoAccounts.map(account => {
                const isSelected = selectedProfile === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleProfileSelect(account)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                      isSelected
                        ? 'border-[#3b1e4a] bg-[#faf4fc] text-[#1f1b20]'
                        : 'border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-[#1f1b20]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold truncate">{account.name}</div>
                      <div className="text-[11px] text-[#655d69] truncate">{account.role} · {account.institution}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#9c4126] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {helperNotice && (
          <div className="p-3 rounded-xl bg-[#fff7f2] border border-[#ece6ed] text-xs text-[#9c4126]">
            {helperNotice}
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
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
                      className="form-input pl-10 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
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
                      className="form-input pl-10 text-xs"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
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
                className="form-input pl-10 text-xs font-mono"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-[#1f1b20]">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => setHelperNotice('Demo workspace: select any 1-click institutional profile above and click Sign In.')}
                  className="text-xs text-[#9c4126] font-semibold hover:underline cursor-pointer"
                >
                  Reset / Demo Help
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
                className="form-input pl-10 pr-10 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#7c747f] hover:text-[#1f1b20] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full btn-primary mt-2 text-xs"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Session Verified</span>
              </>
            ) : isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : mode === 'signin' ? (
              <span>Sign In to Workspace</span>
            ) : (
              <span>Create Institutional Account</span>
            )}
          </button>
        </form>

        {/* Security / FERPA footer */}
        <div className="pt-3 text-center text-xs text-[#7c747f] flex items-center justify-center gap-2 border-t border-[#ece6ed]">
          <ShieldCheck className="w-4 h-4 text-[#18794e]" />
          <span>Single Sign-On · FERPA & SOC2 Compliant</span>
        </div>
      </div>
    </div>
  );
};
