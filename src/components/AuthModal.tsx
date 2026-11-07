import React, { useState } from 'react';
import { X, Lock, Compass, CheckCircle2, User, Mail, School, Eye, EyeOff, Zap } from 'lucide-react';
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
      email: 'k.reynolds@westernpoly.edu'
    },
    {
      id: 'dean' as const,
      name: 'Prof. Alistair MacIntyre',
      role: 'Dean of Science & Engineering',
      institution: 'Oxford Union Sciences',
      email: 'a.macintyre@oxford.ac.uk'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin',
      role: 'Student Senate Academic Delegate',
      institution: 'Western Polytechnic Institute',
      email: 'm.lin@westernpoly.edu'
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
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-surface border border-border rounded-lg shadow-xl max-w-md w-full overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-primary">
                {mode === 'signin' ? 'Sign in to SmartGrid' : 'Create campus account'}
              </h2>
              <p className="text-[13px] text-secondary mt-0.5">
                Institutional single sign-on & workspace access
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-primary p-1.5 rounded-md hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-1 flex border-b border-border gap-6 text-[14px]">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`pb-2.5 transition-colors relative cursor-pointer font-medium ${
              mode === 'signin'
                ? 'text-brand border-b-2 border-brand'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`pb-2.5 transition-colors relative cursor-pointer font-medium ${
              mode === 'signup'
                ? 'text-brand border-b-2 border-brand'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Register campus
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'signin' ? (
            <>
              {/* Quick Demo Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px] text-secondary">
                  <span>Demo accounts</span>
                  <span className="text-brand font-medium">1-click switch</span>
                </div>

                <div className="space-y-2">
                  {quickDemoAccounts.map(account => {
                    const isSelected = selectedRole === account.id;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleQuickSelect(account)}
                        className={`w-full p-3 rounded-md border text-left transition-colors flex items-center justify-between cursor-pointer text-[14px] ${
                          isSelected
                            ? 'border-brand bg-brand/5 text-primary'
                            : 'border-border bg-surface hover:bg-subtle text-primary'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium truncate">{account.name}</div>
                          <div className="text-[13px] text-secondary truncate">{account.role} • {account.institution}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-brand bg-brand text-white' : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email & Password */}
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[14px] font-medium text-primary mb-1.5">
                    Institutional email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="name@university.edu"
                      className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-primary mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full h-[38px] pl-9 pr-9 text-[14px] rounded-md border border-border text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface font-mono"
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
              </div>
            </>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[14px] font-medium text-primary mb-1.5">
                  Full name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Dr. Eleanor Vance"
                    className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-primary mb-1.5">
                  Institutional email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                  <input 
                    type="email" 
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                    placeholder="e.g. e.vance@stanford.edu"
                    className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-primary mb-1.5">
                  Institution name
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-secondary absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={institutionName}
                    onChange={e => setInstitutionName(e.target.value)}
                    required
                    className="w-full h-[38px] pl-9 pr-3 text-[14px] rounded-md border border-border text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-surface"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-[38px] px-4 text-[14px] font-medium text-secondary hover:text-primary hover:bg-subtle rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[38px] px-4 bg-brand hover:bg-brand-hover text-white rounded-md text-[14px] font-medium transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Authenticating...' : mode === 'signin' ? 'Sign in' : 'Create workspace'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
