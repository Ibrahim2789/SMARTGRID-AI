import React, { useState } from 'react';
import { X, Shield, Lock, Compass, CheckCircle2, User, Building, ArrowRight, Mail, School, Sparkles, Eye, EyeOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; role: string; email: string; institution?: string }) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onLogin,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<'registrar' | 'dean' | 'student'>('registrar');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sign in fields
  const [email, setEmail] = useState('k.reynolds@westernpoly.edu');
  const [password, setPassword] = useState('••••••••••••');
  
  // Sign up fields
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [institutionName, setInstitutionName] = useState('Stanford University');
  const [signupRole, setSignupRole] = useState('Academic Scheduling Officer');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const quickDemoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Chief University Registrar',
      institution: 'Western Polytechnic Institute',
      email: 'k.reynolds@westernpoly.edu',
      desc: 'Full matrix governance, solver dispatch, Title IV compliance'
    },
    {
      id: 'dean' as const,
      name: 'Prof. Alistair MacIntyre',
      role: 'Dean of Science & Engineering',
      institution: 'Oxford Union Sciences',
      email: 'a.macintyre@oxford.ac.uk',
      desc: 'Faculty availability approvals & cleanroom lab contention'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin',
      role: 'Student Senate Academic Delegate',
      institution: 'Western Polytechnic Institute',
      email: 'm.lin@westernpoly.edu',
      desc: 'Cohort chronotype referendums & transit buffer auditing'
    }
  ];

  const handleQuickSelect = (account: typeof quickDemoAccounts[0]) => {
    setSelectedRole(account.id);
    setEmail(account.email);
    setPassword('••••••••••••');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      if (mode === 'signin') {
        const matched = quickDemoAccounts.find(a => a.id === selectedRole) || {
          name: email.split('@')[0].replace('.', ' '),
          role: 'Academic Administrator',
          institution: 'Institutional Campus',
          email: email
        };
        onLogin({
          name: matched.name,
          role: matched.role,
          institution: matched.institution,
          email: matched.email
        });
      } else {
        onLogin({
          name: fullName || 'Academic Coordinator',
          role: signupRole,
          institution: institutionName,
          email: signupEmail || 'admin@university.edu'
        });
      }
      setIsSubmitting(false);
      onClose();
    }, 550);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-[#ece6ed] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#ece6ed] flex items-center justify-between bg-gradient-to-r from-white via-[#fffbfa] to-[#fbf8fc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b1e4a] via-[#522567] to-[#1f0e27] flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5 text-[#f27438]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#1f1b20]">
                {mode === 'signin' ? 'Institutional Sign In' : 'Create Campus Account'}
              </h2>
              <p className="text-[10px] font-mono text-[#7c747f]">
                Algorithmic Campus Equilibrium • Single Sign-On
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7c747f] hover:text-[#1f1b20] p-1.5 rounded-lg hover:bg-[#ece6ed] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-1 flex border-b border-[#ece6ed] gap-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`pb-2.5 transition-colors relative cursor-pointer ${
              mode === 'signin'
                ? 'text-[#3b1e4a] font-bold border-b-2 border-[#3b1e4a]'
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Sign In with SSO
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`pb-2.5 transition-colors relative cursor-pointer ${
              mode === 'signup'
                ? 'text-[#3b1e4a] font-bold border-b-2 border-[#3b1e4a]'
                : 'text-[#655d69] hover:text-[#1f1b20]'
            }`}
          >
            Register Institution
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {mode === 'signin' ? (
            <>
              {/* 1-Click Fast Auth Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#655d69] font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#f27438]" /> Quick Demo Profiles (1-Click)
                  </label>
                  <span className="text-[10px] font-bold text-[#18794e] bg-[#eefcf2] px-2 py-0.5 rounded shadow-xs">
                    Instant Access
                  </span>
                </div>

                <div className="space-y-2">
                  {quickDemoAccounts.map(account => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleQuickSelect(account)}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer card-lift ${
                        selectedRole === account.id
                          ? 'border-[#9c4126] bg-[#fff7f2] ring-1 ring-[#9c4126] shadow-xs'
                          : 'border-[#ece6ed] bg-[#fbf8fc] hover:border-[#dcd9dd]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#1f1b20] flex items-center gap-1.5">
                          <span>{account.name}</span>
                          <span className="text-[11px] font-normal text-[#655d69]">• {account.institution}</span>
                        </div>
                        <div className="text-[10px] text-[#7c747f] font-mono">{account.role}</div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedRole === account.id ? 'border-[#9c4126] bg-[#9c4126] text-white' : 'border-[#dcd9df]'
                      }`}>
                        {selectedRole === account.id && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email & Password */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#7c747f] absolute left-3 top-2.5" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="name@university.edu"
                      className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#ece6ed] text-[#1f1b20] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1f1b20] mb-1">
                    SSO Password / SAML Credential
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7c747f] absolute left-3 top-2.5" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-[#ece6ed] text-[#1f1b20] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-[#7c747f] hover:text-[#1f1b20]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7c747f] absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Dr. Eleanor Vance"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#ece6ed] text-[#1f1b20] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7c747f] absolute left-3 top-2.5" />
                  <input 
                    type="email" 
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                    placeholder="e.g. e.vance@stanford.edu"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#ece6ed] text-[#1f1b20] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f1b20] mb-1">
                  Institution Name
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-[#7c747f] absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={institutionName}
                    onChange={e => setInstitutionName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#ece6ed] text-[#1f1b20] focus:outline-none focus:border-[#3b1e4a] bg-[#fbf8fc]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#ece6ed]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#655d69] hover:bg-[#f6f2f7] rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
              {isSubmitting ? 'Authenticating...' : mode === 'signin' ? 'Launch Workspace' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
