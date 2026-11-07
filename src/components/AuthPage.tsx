import React, { useState } from 'react';
import {
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
  const [institution, setInstitution] = useState('Western Polytechnic');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);

  const demoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Registrar',
      institution: 'Western Polytechnic',
      email: 'k.reynolds@westernpoly.edu',
      bg: '#B8EEEE'
    },
    {
      id: 'dean' as const,
      name: 'Prof. Alan Turing',
      role: 'Faculty',
      institution: 'Western Polytechnic',
      email: 'a.turing@westernpoly.edu',
      bg: '#F2D8FA'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin',
      role: 'Student',
      institution: 'Western Polytechnic',
      email: 'm.lin@westernpoly.edu',
      bg: '#B8F2E6'
    }
  ];

  const handleProfileSelect = (p: (typeof demoAccounts)[0]) => {
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
            role: 'Registrar',
            institution,
            email
          };
          onLogin(found);
        } else {
          onLogin({
            name: name || 'Academic Coordinator',
            role: 'Registrar',
            institution: institution || 'Western Polytechnic',
            email: email || 'admin@westernpoly.edu'
          });
        }
      }, 250);
    }, 350);
  };

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] flex flex-col justify-center items-center px-4 sm:px-6 py-12 antialiased">
      {/* Top Header / Back Button */}
      <div className="w-full max-w-md mb-4">
        <button onClick={onCancel} className="btn-secondary h-9 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-md sf-card-white p-7 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-11 h-11 rounded-xl bg-[#171717] flex items-center justify-center text-white font-serif-editorial text-2xl mx-auto mb-2">
            S
          </div>

          <h1 className="font-serif-editorial text-2xl text-[#171717]">
            {mode === 'signin' ? 'Sign in to SmartGrid' : 'Create Workspace Account'}
          </h1>
          <p className="text-xs text-[#77766F]">
            Academic timetable generation & student scheduling workspace
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 bg-[#F7F6EF] rounded-xl border border-[#E4E2DA] text-xs">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer font-semibold ${
              mode === 'signin'
                ? 'bg-[#171717] text-white'
                : 'text-[#77766F] hover:text-[#171717]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer font-semibold ${
              mode === 'signup'
                ? 'bg-[#171717] text-white'
                : 'text-[#77766F] hover:text-[#171717]'
            }`}
          >
            Register
          </button>
        </div>

        {/* 1-Click Fast Profiles */}
        {mode === 'signin' && (
          <div className="space-y-2">
            <div className="text-xs text-[#77766F] font-semibold">
              Select Active Workspace Persona
            </div>

            <div className="space-y-2">
              {demoAccounts.map(account => {
                const isSelected = selectedProfile === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleProfileSelect(account)}
                    style={{ backgroundColor: isSelected ? account.bg : '#F7F6EF' }}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                      isSelected
                        ? 'border-[#171717] text-[#171717]'
                        : 'border-[#E4E2DA] text-[#171717] hover:border-[#171717]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold truncate">{account.name}</div>
                      <div className="text-[11px] text-[#171717]/75 truncate">
                        {account.role} · {account.institution}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#171717] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {helperNotice && (
          <div className="p-3 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] text-xs text-[#171717]">
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
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#77766F] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Eleanor Vance"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="input-field pl-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    University / Institution
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-[#77766F] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Western Polytechnic"
                      value={institution}
                      onChange={e => setInstitution(e.target.value)}
                      className="input-field pl-9 text-xs"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#77766F] absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="user@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field pl-9 text-xs font-mono-tabular"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-[#171717]">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() =>
                    setHelperNotice(
                      'Select any 1-click persona card above and click Sign In to launch the workspace.'
                    )
                  }
                  className="text-xs text-[#171717] underline cursor-pointer"
                >
                  Demo Help
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#77766F] absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pl-9 pr-9 text-xs font-mono-tabular"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-[#77766F] hover:text-[#171717] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full btn-primary mt-2 text-xs"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Entering Workspace...</span>
              </>
            ) : isLoading ? (
              <span>Authenticating...</span>
            ) : mode === 'signin' ? (
              <span>Enter SmartGrid Workspace</span>
            ) : (
              <span>Create Workspace Account</span>
            )}
          </button>
        </form>

        {/* Security / FERPA footer */}
        <div className="pt-3 text-center text-xs text-[#77766F] flex items-center justify-center gap-2 border-t border-[#E4E2DA]">
          <ShieldCheck className="w-4 h-4 text-[#171717]" />
          <span>University SSO · FERPA Compliant</span>
        </div>
      </div>
    </div>
  );
};
