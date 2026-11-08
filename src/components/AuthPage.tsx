import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  AlertCircle,
  Vote,
  Hash,
  Layers,
  Users,
  Info
} from 'lucide-react';
import { SmartGridLogo } from './SmartGridLogo';
import {
  AuthenticatedVotingUser,
  PublicBatchOption,
  fetchPublicBatches,
  loginWithBackend,
  registerStudentAccount
} from '../services/votingApi';

export type AuthPortalType = 'student' | 'br' | 'admin';

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
  initialPortal?: AuthPortalType;
  onLogin: (user: AuthenticatedVotingUser) => void;
  onCancel: () => void;
}

const DEFAULT_FALLBACK_BATCHES: PublicBatchOption[] = [
  {
    id: 'batch-2k25-bscs',
    code: '2K25-BSCS',
    name: 'BS Computer Science — Batch 2K25',
    departmentCode: 'BSCS',
    year: 2,
    semester: 3
  },
  {
    id: 'batch-2k24-bese',
    code: '2K24-BESE',
    name: 'BE Software Engineering — Batch 2K24',
    departmentCode: 'BESE',
    year: 3,
    semester: 5
  },
  {
    id: 'batch-2k24-bee',
    code: '2K24-BEE',
    name: 'BE Electrical Engineering — Batch 2K24',
    departmentCode: 'BEE',
    year: 3,
    semester: 5
  },
  {
    id: 'batch-2k25-bce',
    code: '2K25-BCE',
    name: 'BE Computer Systems Engineering — Batch 2K25',
    departmentCode: 'BCE',
    year: 2,
    semester: 3
  },
  {
    id: 'batch-2k26-bscs',
    code: '2K26-BSCS',
    name: 'BS Computer Science — Batch 2K26',
    departmentCode: 'BSCS',
    year: 1,
    semester: 1
  }
];

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  initialPortal = 'student',
  onLogin,
  onCancel
}) => {
  const [activePortal, setActivePortal] = useState<AuthPortalType>(initialPortal);
  const [studentSubMode, setStudentSubMode] = useState<'login' | 'signup'>(
    initialPortal === 'student' && initialMode === 'signup' ? 'signup' : 'login'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Public batches for Student Registration
  const [batches, setBatches] = useState<PublicBatchOption[]>(DEFAULT_FALLBACK_BATCHES);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState<string>('m.lin@westernpoly.edu');
  const [loginPassword, setLoginPassword] = useState<string>('Student@2026');

  // Student Registration Form State
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regRollNumber, setRegRollNumber] = useState<string>('');
  const [regBatchId, setRegBatchId] = useState<string>('batch-2k25-bscs');
  const [regSection, setRegSection] = useState<string>('Section A');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');

  useEffect(() => {
    fetchPublicBatches()
      .then(list => {
        if (list.length > 0) {
          setBatches(list);
          setRegBatchId(list[0].id);
        }
      })
      .catch(() => {
        // Keep fallback batches if offline
      });
  }, []);

  const handleSelectPortal = (portal: AuthPortalType) => {
    setActivePortal(portal);
    setAuthError(null);
    if (portal !== 'student') {
      // Ensure BR and Admin never land on student signup mode
      setStudentSubMode('login');
    }
    if (portal === 'student') {
      setLoginEmail('m.lin@westernpoly.edu');
      setLoginPassword('Student@2026');
    } else if (portal === 'br') {
      setLoginEmail('br.male.2k25bscs@westernpoly.edu');
      setLoginPassword('BR-2K25CS-M!');
    } else if (portal === 'admin') {
      setLoginEmail('k.reynolds@westernpoly.edu');
      setLoginPassword('Admin@2026');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const authedUser = await loginWithBackend(
        loginEmail.trim(),
        loginPassword,
        false,
        activePortal
      );
      onLogin(authedUser);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (regPassword !== regConfirmPassword) {
      setAuthError('Password and Confirm Password do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdStudent = await registerStudentAccount({
        name: regFullName.trim(),
        email: regEmail.trim(),
        registrationNumber: regRollNumber.trim().toUpperCase(),
        batchId: regBatchId,
        section: regSection,
        password: regPassword,
        confirmPassword: regConfirmPassword
      });
      onLogin(createdStudent);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Student registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStudentSignup = activePortal === 'student' && studentSubMode === 'signup';

  const roleOptions: Array<{
    id: AuthPortalType;
    label: string;
    shortDesc: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    {
      id: 'student',
      label: 'Student',
      shortDesc: 'Timetable & voting',
      icon: GraduationCap
    },
    {
      id: 'br',
      label: 'Batch Rep',
      shortDesc: 'Cohort polls',
      icon: Vote
    },
    {
      id: 'admin',
      label: 'Admin',
      shortDesc: 'System control',
      icon: ShieldCheck
    }
  ];

  const getWelcomeHeading = () => {
    if (isStudentSignup) return 'Create a student account';
    if (activePortal === 'student') return 'Sign in to Student Portal';
    if (activePortal === 'br') return 'Batch Representative Sign In';
    return 'Administrator Sign In';
  };

  const getWelcomeSubtext = () => {
    if (isStudentSignup) {
      return 'Register with your university roll number, batch, and section.';
    }
    if (activePortal === 'student') {
      return 'Access your class schedule, batch polls, and preferences.';
    }
    if (activePortal === 'br') {
      return 'Sign in with the BR credentials assigned to your batch.';
    }
    return 'Authorized access for university registrars and administrators.';
  };

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] flex flex-col justify-between px-4 py-5 sm:py-6">
      {/* Minimal Top Bar */}
      <div className="max-w-[520px] w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57564F] hover:text-[#171717] px-2.5 py-1.5 rounded-lg hover:bg-[#EDEAE0] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Back to home</span>
        </button>

        <span className="text-[11px] font-medium text-[#77766F]">
          Role-Based Access
        </span>
      </div>

      {/* Centered Compact Authentication Panel */}
      <main className="w-full flex-1 flex items-center justify-center py-3">
        <div
          className={`w-full ${
            isStudentSignup ? 'max-w-[500px]' : 'max-w-[430px]'
          } bg-white border border-[#E4E2DA] rounded-2xl shadow-xs p-5 sm:p-6 space-y-4 transition-all`}
        >
          {/* 1. Small SmartGrid AI Logo & 2. Welcome Heading */}
          <div className="space-y-2 text-center">
            <div className="flex justify-center">
              <SmartGridLogo variant="primary" theme="light" size="sm" />
            </div>
            <div>
              <h1 className="font-serif-editorial text-2xl text-[#171717] tracking-tight">
                {getWelcomeHeading()}
              </h1>
              <p className="text-xs text-[#57564F] mt-0.5">
                {getWelcomeSubtext()}
              </p>
            </div>
          </div>

          {/* 3. Compact Role Selector (3 Small Equal Cards/Tabs) */}
          <div
            id="role-selector"
            role="tablist"
            aria-label="Select user role"
            className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
          >
            {roleOptions.map(option => {
              const Icon = option.icon;
              const isSelected = activePortal === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectPortal(option.id)}
                  className={`px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#171717] text-white shadow-2xs'
                      : 'text-[#57564F] hover:text-[#171717] hover:bg-white/60'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-[#B8EEEE]' : 'text-[#77766F]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight truncate">
                      {option.label}
                    </div>
                    <div
                      className={`text-[10px] leading-tight truncate ${
                        isSelected ? 'text-white/70' : 'text-[#77766F]'
                      }`}
                    >
                      {option.shortDesc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="px-3 py-2.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* 4. Login or Student Registration Form */}
          {isStudentSignup ? (
            <form onSubmit={handleStudentSignupSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Full Name
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <User className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="Tariq Mehmood"
                      value={regFullName}
                      onChange={e => setRegFullName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Roll / Reg Number
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Hash className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="2K25-BSCS-042"
                      value={regRollNumber}
                      onChange={e => setRegRollNumber(e.target.value)}
                      className="text-xs font-mono-tabular uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                  University / Student Email
                </label>
                <div className="input-group-field h-9 px-2.5 gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder="t.mehmood@westernpoly.edu"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Batch
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <select
                      value={regBatchId}
                      onChange={e => setRegBatchId(e.target.value)}
                      className="text-xs w-full bg-transparent focus:outline-none"
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Section
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Users className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <select
                      value={regSection}
                      onChange={e => setRegSection(e.target.value)}
                      className="text-xs w-full bg-transparent focus:outline-none"
                    >
                      <option value="Section A">Section A</option>
                      <option value="Section B">Section B</option>
                      <option value="Section C">Section C</option>
                      <option value="Section D">Section D</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Password
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Min. 6 chars"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      className="text-xs font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Confirm Password
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Repeat password"
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      className="text-xs font-mono-tabular"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Signup Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary h-10 text-xs font-semibold justify-center mt-1"
              >
                <span>
                  {isSubmitting ? 'Creating Student Account...' : 'Create Student Account'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                  {activePortal === 'student'
                    ? 'Student Email'
                    : activePortal === 'br'
                    ? 'Batch Representative Email'
                    : 'Administrator Email'}
                </label>
                <div className="input-group-field h-10 px-3 gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder={
                      activePortal === 'student'
                        ? 'student@westernpoly.edu'
                        : activePortal === 'br'
                        ? 'br@westernpoly.edu'
                        : 'admin@westernpoly.edu'
                    }
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#171717]">
                    Password
                  </label>
                  {/* Compact Quick-Fill Demo Helper */}
                  <div className="flex items-center gap-1.5">
                    {activePortal === 'student' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('m.lin@westernpoly.edu');
                          setLoginPassword('Student@2026');
                          setAuthError(null);
                        }}
                        className="text-[10.5px] font-medium text-[#57564F] hover:text-[#171717] underline cursor-pointer"
                      >
                        Demo Student
                      </button>
                    )}
                    {activePortal === 'br' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginEmail('br.male.2k25bscs@westernpoly.edu');
                            setLoginPassword('BR-2K25CS-M!');
                            setAuthError(null);
                          }}
                          className="text-[10.5px] font-medium text-[#57564F] hover:text-[#171717] underline cursor-pointer"
                        >
                          Male BR
                        </button>
                        <span className="text-[10px] text-[#77766F]">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginEmail('br.female.2k25bscs@westernpoly.edu');
                            setLoginPassword('BR-2K25CS-F!');
                            setAuthError(null);
                          }}
                          className="text-[10.5px] font-medium text-[#57564F] hover:text-[#171717] underline cursor-pointer"
                        >
                          Female BR
                        </button>
                      </>
                    )}
                    {activePortal === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('k.reynolds@westernpoly.edu');
                          setLoginPassword('Admin@2026');
                          setAuthError(null);
                        }}
                        className="text-[10.5px] font-medium text-[#57564F] hover:text-[#171717] underline cursor-pointer"
                      >
                        Demo Admin
                      </button>
                    )}
                  </div>
                </div>
                <div className="input-group-field h-10 px-3 gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="text-xs font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#77766F] hover:text-[#171717] cursor-pointer shrink-0 flex items-center justify-center p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* 5. Login Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary h-10 text-xs font-semibold justify-center mt-1"
              >
                <span>
                  {isSubmitting
                    ? 'Signing in...'
                    : activePortal === 'student'
                    ? 'Sign In as Student'
                    : activePortal === 'br'
                    ? 'Sign In as Batch Rep'
                    : 'Sign In as Admin'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* 6. Relevant Signup or Account Information & Navigation */}
          <div className="pt-3 border-t border-[#E4E2DA]">
            {activePortal === 'student' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#57564F]">
                  {studentSubMode === 'login'
                    ? 'New student without an account?'
                    : 'Already have a student account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudentSubMode(studentSubMode === 'login' ? 'signup' : 'login');
                    setAuthError(null);
                  }}
                  className="font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  {studentSubMode === 'login' ? 'Student Sign Up →' : '← Student Login'}
                </button>
              </div>
            )}

            {activePortal === 'br' && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#F7F6EF] text-[11px] text-[#57564F] leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-[#171717] shrink-0 mt-0.5" />
                  <span>
                    BR accounts are created and assigned to batches by university administrators. Public signup is not available for representatives.
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#57564F] px-0.5">
                  <span>Need a different portal?</span>
                  <button
                    type="button"
                    onClick={() => handleSelectPortal('student')}
                    className="font-semibold text-[#171717] hover:underline cursor-pointer"
                  >
                    Return to Role Selection
                  </button>
                </div>
              </div>
            )}

            {activePortal === 'admin' && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#F7F6EF] text-[11px] text-[#57564F] leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-[#171717] shrink-0 mt-0.5" />
                  <span>
                    Admin accounts are provisioned through the authorized university administrative process. No public signup is available.
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#57564F] px-0.5">
                  <span>Need a different portal?</span>
                  <button
                    type="button"
                    onClick={() => handleSelectPortal('student')}
                    className="font-semibold text-[#171717] hover:underline cursor-pointer"
                  >
                    Return to Role Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="max-w-[520px] w-full mx-auto text-center text-[11px] text-[#77766F]">
        SmartGrid AI · University Timetable & Governance Platform
      </footer>
    </div>
  );
};
