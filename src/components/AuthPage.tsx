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
    }, 500);
  };

  return (
    <div className="min-h-screen bg-app text-primary flex flex-col justify-center items-center px-4 sm:px-6 py-12 antialiased">
      {/* Top Header / Back Button */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 h-[38px] px-3.5 rounded-md text-[14px] font-medium text-secondary hover:text-primary hover:bg-subtle border border-border bg-surface transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to public site</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm p-7 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center text-white mx-auto mb-2">
            <Compass className="w-5 h-5" />
          </div>

          <h1 className="text-xl font-semibold text-primary">
            {mode === 'signin' ? 'Sign in to SmartGrid' : 'Create campus account'}
          </h1>
          <p className="text-[14px] text-secondary">
            University timetable scheduling platform
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 bg-subtle rounded-md border border-border text-[14px]">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-center rounded-md transition-colors cursor-pointer font-medium ${
              mode === 'signin' 
                ? 'bg-surface text-primary shadow-xs' 
                : 'text-secondary hover:text-primary'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-center rounded-md transition-colors cursor-pointer font-medium ${
              mode === 'signup' 
                ? 'bg-surface text-primary shadow-xs' 
                : 'text-secondary hover:text-primary'
            }`}
          >
            Register
          </button>
        </div>

        {/* 1-Click Fast Profiles */}
        {mode === 'signin' && (
          <div className="space-y-2">
            <div className="text-[13px] text-secondary font-medium">
              Demo accounts (1-click)
            </div>

            <div className="space-y-1.5">
              {demoAccounts.map(account => {
                const isSelected = selectedProfile === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleProfileSelect(account)}
                    className={`w-full p-2.5 rounded-md border text-left transition-colors cursor-pointer flex items-center justify-between text-[14px] ${
                      isSelected
                        ? 'border-brand bg-brand/5 text-primary'
                        : 'border-border bg-surface hover:bg-subtle text-primary'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate">{account.name}</div>
                      <div className="text-[13px] text-secondary truncate">{account.role}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
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
                  <label className="block text-[14px] font-medium text-primary mb-1.5">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Eleanor Vance"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-primary mb-1.5">
                    University / institution
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Western Polytechnic"
                      value={institution}
                      onChange={e => setInstitution(e.target.value)}
                      className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface text-primary"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="block text-[14px] font-medium text-primary mb-1.5">
              Institutional email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="user@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface text-primary"
              />
            </div>
          </div>

          {/* Password with visibility toggle */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[14px] font-medium text-primary">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => alert('Demo mode: Click any of the 1-click profiles above to sign in.')}
                  className="text-[13px] text-brand hover:underline cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-[38px] pl-9 pr-9 text-[14px] rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface text-primary font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-secondary hover:text-primary cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full h-[38px] mt-2 bg-brand hover:bg-brand-hover text-white rounded-md text-[14px] font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Session verified</span>
              </>
            ) : isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : mode === 'signin' ? (
              <span>Sign in</span>
            ) : (
              <span>Create account</span>
            )}
          </button>
        </form>

        {/* Security / FERPA footer */}
        <div className="pt-3 text-center text-[13px] text-tertiary flex items-center justify-center gap-2 border-t border-border">
          <ShieldCheck className="w-4 h-4 text-secondary" />
          <span>Single sign-on • FERPA & SOC2 compliant</span>
        </div>
      </div>
    </div>
  );
};
