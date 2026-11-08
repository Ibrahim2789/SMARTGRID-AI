import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  User,
  School,
  Eye,
  EyeOff,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { SmartGridLogo } from './SmartGridLogo';
import { institutionalStore } from '../data/store';
import { computeAcademicScheduleConfig } from '../types/institutional';

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
  onLogin: (user: { name: string; role: string; email: string; institution?: string }) => void;
  onCancel: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  onLogin,
  onCancel
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<'registrar' | 'faculty' | 'student'>('registrar');
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('k.reynolds@westernpoly.edu');
  const [password, setPassword] = useState('••••••••••••');

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [institutionName, setInstitutionName] = useState('Western Polytechnic Institute');
  const [signupRole, setSignupRole] = useState<'Registrar' | 'Faculty' | 'Student'>('Registrar');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTiming = computeAcademicScheduleConfig(
    institutionalStore.get().timeStructure
  );
  const labHoursLabel = (activeTiming.labDurationMinutes / 60).toFixed(
    activeTiming.labDurationMinutes % 60 === 0 ? 0 : 1
  );

  const quickDemoAccounts = [
    {
      id: 'registrar' as const,
      name: 'Dr. Katherine Reynolds',
      role: 'Registrar',
      title: 'Chief University Registrar (Admin)',
      institution: 'Western Polytechnic',
      email: 'k.reynolds@westernpoly.edu',
      badgeBg: 'bg-[#B8EEEE]'
    },
    {
      id: 'faculty' as const,
      name: 'Prof. Alan Turing',
      role: 'Faculty',
      title: 'Computer Science Department',
      institution: 'Western Polytechnic',
      email: 'a.turing@westernpoly.edu',
      badgeBg: 'bg-[#B8F2E6]'
    },
    {
      id: 'student' as const,
      name: 'Maya Lin (CS Y1)',
      role: 'Student',
      title: 'B.S. Computer Science — Year 1',
      institution: 'Western Polytechnic',
      email: 'm.lin@westernpoly.edu',
      badgeBg: 'bg-[#F2D8FA]'
    }
  ];

  const handleQuickSelect = (account: (typeof quickDemoAccounts)[0]) => {
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
          role: 'Registrar',
          institution: 'Western Polytechnic',
          email
        };
        onLogin({
          name: matched.name,
          role: matched.role,
          institution: matched.institution,
          email: matched.email
        });
      } else {
        onLogin({
          name: fullName || 'Dr. Eleanor Vance',
          role: signupRole,
          institution: institutionName || 'Western Polytechnic',
          email: signupEmail || 'e.vance@westernpoly.edu'
        });
      }
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar */}
      <div className="max-w-[1140px] w-full mx-auto flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#77766F] hover:text-[#171717] px-3 py-2 rounded-xl hover:bg-[#EDEAE0] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </button>

        <SmartGridLogo variant="primary" theme="light" size="sm" />
      </div>

      {/* Main Split Card */}
      <div className="max-w-[1040px] w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#E4E2DA] rounded-3xl shadow-sm overflow-hidden">
        {/* Left Column: Editorial Brand & Role Preview */}
        <div className="lg:col-span-5 bg-[#171717] text-white p-8 sm:p-10 flex flex-col justify-between space-y-8">
          <div className="space-y-5">
            <SmartGridLogo
              variant="primary"
              theme="dark"
              size="md"
              subtitle="ACADEMIC TIMETABLE ENGINE"
            />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-[#B8EEEE]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Academic Scheduling Workspace</span>
            </div>

            <h1 className="font-serif-editorial text-3xl sm:text-4xl leading-[1.12] text-white">
              Conflict-free university timetables in seconds.
            </h1>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              Sign in as a Registrar (Administrator), Faculty member, or Student to configure academic timing rules, run the scheduling engine, or export timetables.
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/10 text-xs text-white/80">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-[#B7F77C] shrink-0" />
              <span>
                Configurable {activeTiming.operatingHoursLabel} schedule ({activeTiming.periodLengthMinutes}m lectures & {labHoursLabel}h labs)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#B8EEEE] shrink-0" />
              <span>Zero room, instructor, or student cohort double-bookings</span>
            </div>
          </div>
        </div>

        {/* Right Column: Sign In / Create Account Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 space-y-6">
          {/* Mode Tabs */}
          <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-4">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
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
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#77766F] hover:text-[#171717]'
                }`}
              >
                Create Account
              </button>
            </div>

            <span className="text-xs text-[#77766F] hidden sm:inline">
              Instant Demo Personas Available
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signin' ? (
              <>
                {/* 1-Click Persona Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717]">
                      Select Demo Persona (1-Click Fill)
                    </span>
                    <span className="text-[#77766F]">Switch roles anytime inside the app</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {quickDemoAccounts.map(acc => {
                      const active = selectedRole === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => handleQuickSelect(acc)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#171717] bg-[#F7F6EF] shadow-xs'
                              : 'border-[#E4E2DA] bg-white hover:bg-[#F7F6EF]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${acc.badgeBg} text-[#171717]`}
                            >
                              {acc.role}
                            </span>
                            {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#171717]" />}
                          </div>
                          <div className="text-xs font-semibold text-[#171717] truncate">
                            {acc.name}
                          </div>
                          <div className="text-[11px] text-[#77766F] truncate">{acc.title}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Institutional Email
                    </label>
                    <div className="input-group-field h-10 px-3 gap-2.5">
                      <Mail className="w-4 h-4 text-[#77766F] shrink-0" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Password
                    </label>
                    <div className="input-group-field h-10 px-3 gap-2.5">
                      <Lock className="w-4 h-4 text-[#77766F] shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="text-xs font-mono-tabular"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#77766F] hover:text-[#171717] cursor-pointer shrink-0 flex items-center justify-center p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 shrink-0" />
                        ) : (
                          <Eye className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Full Name
                    </label>
                    <div className="input-group-field h-10 px-3 gap-2.5">
                      <User className="w-4 h-4 text-[#77766F] shrink-0" />
                      <input
                        type="text"
                        required
                        placeholder="Dr. Eleanor Vance"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Workspace Role
                    </label>
                    <select
                      value={signupRole}
                      onChange={e => setSignupRole(e.target.value as 'Registrar' | 'Faculty' | 'Student')}
                      className="input-field h-10 text-xs"
                    >
                      <option value="Registrar">Registrar / Scheduling Admin</option>
                      <option value="Faculty">Faculty / Instructor</option>
                      <option value="Student">Student</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Institutional Email
                  </label>
                  <div className="input-group-field h-10 px-3 gap-2.5">
                    <Mail className="w-4 h-4 text-[#77766F] shrink-0" />
                    <input
                      type="email"
                      required
                      placeholder="e.vance@westernpoly.edu"
                      value={signupEmail}
                      onChange={e => setSignupEmail(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    University / Institution Name
                  </label>
                  <div className="input-group-field h-10 px-3 gap-2.5">
                    <School className="w-4 h-4 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      value={institutionName}
                      onChange={e => setInstitutionName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 text-xs sm:text-sm font-semibold justify-center"
            >
              <span>
                {isSubmitting
                  ? 'Opening Workspace...'
                  : mode === 'signin'
                  ? `Enter Workspace as ${
                      quickDemoAccounts.find(a => a.id === selectedRole)?.role || 'User'
                    }`
                  : 'Create Workspace Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-[1140px] w-full mx-auto text-center text-xs text-[#77766F]">
        SmartGrid AI · University Timetable Scheduling & Resource Optimization
      </div>
    </div>
  );
};
