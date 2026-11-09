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
  BookOpen,
  Building2,
  Sparkles,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { SmartGridLogo } from './SmartGridLogo';
import {
  AuthenticatedVotingUser,
  PublicBatchOption,
  fetchPublicBatches,
  fetchInstitutionsApi,
  loginWithBackend,
  registerStudentAccount,
  activateFacultyAccount,
  registerUniversityAccount
} from '../services/votingApi';
import { institutionalStore, useInstitutionalData, InstitutionSummary } from '../data/store';

export type AuthPortalType = 'student' | 'br' | 'faculty' | 'admin';

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
  initialPortal?: AuthPortalType;
  onLogin: (
    user: AuthenticatedVotingUser,
    options?: {
      launchOnboardingModal?: boolean;
      institutionId?: string;
      institutionName?: string;
      institutionCode?: string;
      campusName?: string;
    }
  ) => void;
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
  }
];

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  initialPortal = 'student',
  onLogin,
  onCancel
}) => {
  const storeSnapshot = useInstitutionalData();

  // Demo quick-fill switcher state (for 1-click testing of Western Poly vs Apex Tech on Sign-In)
  const [demoPresetInstId, setDemoPresetInstId] = useState<'inst-western-poly' | 'inst-apex-tech'>(
    () =>
      institutionalStore.getCurrentInstitutionId() === 'inst-apex-tech'
        ? 'inst-apex-tech'
        : 'inst-western-poly'
  );

  // Available universities for Student Signup & Faculty Activation
  const [availableInstitutions, setAvailableInstitutions] = useState<InstitutionSummary[]>(() =>
    institutionalStore.getAvailableInstitutions()
  );

  const [activePortal, setActivePortal] = useState<AuthPortalType>(initialPortal);

  // Role-specific sub-modes:
  // - student: 'login' | 'signup'
  // - faculty: 'login' | 'activate'
  // - admin:   'login' | 'register-university'
  // - br:      always 'login' (Path B: Direct Admin Provisioning)
  const [studentSubMode, setStudentSubMode] = useState<'login' | 'signup'>(
    initialPortal === 'student' && initialMode === 'signup' ? 'signup' : 'login'
  );
  const [facultySubMode, setFacultySubMode] = useState<'login' | 'activate'>('login');
  const [adminSubMode, setAdminSubMode] = useState<'login' | 'register-university'>(
    initialPortal === 'admin' && initialMode === 'signup' ? 'register-university' : 'login'
  );

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login Form State (Sign-In auto-detects university from user's account!)
  const [loginEmail, setLoginEmail] = useState<string>('m.lin@westernpoly.edu');
  const [loginPassword, setLoginPassword] = useState<string>('Student@2026');

  // Student Registration Form State (Scoped by selected university)
  const [signupInstId, setSignupInstId] = useState<string>(() =>
    institutionalStore.getCurrentInstitutionId()
  );
  const [batches, setBatches] = useState<PublicBatchOption[]>(DEFAULT_FALLBACK_BATCHES);
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regRollNumber, setRegRollNumber] = useState<string>('');
  const [regBatchId, setRegBatchId] = useState<string>('batch-2k25-bscs');
  const [regCustomBatchCode, setRegCustomBatchCode] = useState<string>('');
  const [regSection, setRegSection] = useState<string>('Section A');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');

  // Faculty Account Activation Form State
  const [facInstId, setFacInstId] = useState<string>(() =>
    institutionalStore.getCurrentInstitutionId()
  );
  const [facName, setFacName] = useState<string>('');
  const [facEmail, setFacEmail] = useState<string>('');
  const [facDepartment, setFacDepartment] = useState<string>('Department of Computer Science');
  const [facPassword, setFacPassword] = useState<string>('');
  const [facConfirmPassword, setFacConfirmPassword] = useState<string>('');

  // Admin "Register New University" Form State
  const [univName, setUnivName] = useState<string>('');
  const [univCode, setUnivCode] = useState<string>('');
  const [univCampus, setUnivCampus] = useState<string>('Main Campus');
  const [adminFullName, setAdminFullName] = useState<string>('');
  const [adminOfficialEmail, setAdminOfficialEmail] = useState<string>('');
  const [adminRegPassword, setAdminRegPassword] = useState<string>('');
  const [adminRegConfirmPassword, setAdminRegConfirmPassword] = useState<string>('');

  // Sync institutions from backend so any university registered in SQLite appears in dropdowns
  useEffect(() => {
    const localList = institutionalStore.getAvailableInstitutions();
    fetchInstitutionsApi()
      .then(remoteList => {
        if (!remoteList || remoteList.length === 0) return;
        const mergedMap = new Map<string, InstitutionSummary>();
        localList.forEach(item => mergedMap.set(item.id, item));
        remoteList.forEach(rem => {
          if (!mergedMap.has(rem.id)) {
            mergedMap.set(rem.id, {
              id: rem.id,
              name: rem.name,
              code: rem.code,
              campusName: rem.campusName || 'Main Campus',
              isSample: Boolean(rem.isDemoTemplate),
              isDemoTemplate: Boolean(rem.isDemoTemplate),
              workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              dayStartTime: '09:00',
              dayEndTime: '17:00',
              periodLengthMinutes: 50,
              shortBreakMinutes: 10,
              middayBreakEnabled: true,
              middayBreakStart: '13:00',
              middayBreakDuration: 60,
              labDurationMinutes: 180
            });
          }
        });
        setAvailableInstitutions(Array.from(mergedMap.values()));
      })
      .catch(() => {});
  }, []);

  const loadBatchesForInst = (instId: string) => {
    fetchPublicBatches(instId)
      .then(list => {
        if (list.length > 0) {
          setBatches(list);
          setRegBatchId(list[0].id);
        } else {
          setBatches([]);
          setRegBatchId('__custom__');
        }
      })
      .catch(() => {
        const groups = storeSnapshot.studentGroups;
        if (groups.length > 0) {
          setBatches(
            groups.map(g => ({
              id: g.id,
              code: g.code,
              name: g.name,
              departmentCode: g.departmentCode || 'GEN',
              year: g.academicYear || g.year,
              semester: g.semester || 1
            }))
          );
          setRegBatchId(groups[0].id);
        }
      });
  };

  useEffect(() => {
    loadBatchesForInst(signupInstId);
  }, [signupInstId]);

  const applyDemoCredentials = (
    portal: AuthPortalType,
    presetInst: 'inst-western-poly' | 'inst-apex-tech'
  ) => {
    if (presetInst === 'inst-apex-tech') {
      if (portal === 'student') {
        setLoginEmail('student.alex@apextech.edu');
        setLoginPassword('Student@2026');
      } else if (portal === 'br') {
        setLoginEmail('br.male@apextech.edu');
        setLoginPassword('BR@2026');
      } else if (portal === 'faculty') {
        setLoginEmail('m.vance@apextech.edu');
        setLoginPassword('Faculty@2026');
      } else if (portal === 'admin') {
        setLoginEmail('admin@apextech.edu');
        setLoginPassword('Admin@2026');
      }
    } else {
      if (portal === 'student') {
        setLoginEmail('m.lin@westernpoly.edu');
        setLoginPassword('Student@2026');
      } else if (portal === 'br') {
        setLoginEmail('br.male.2k25bscs@westernpoly.edu');
        setLoginPassword('BR-2K25CS-M!');
      } else if (portal === 'faculty') {
        setLoginEmail('jehanzeb.ahmad@westernpoly.edu');
        setLoginPassword('Faculty@2026');
      } else if (portal === 'admin') {
        setLoginEmail('k.reynolds@westernpoly.edu');
        setLoginPassword('Admin@2026');
      }
    }
  };

  const handleSelectPortal = (portal: AuthPortalType) => {
    setActivePortal(portal);
    setAuthError(null);
    applyDemoCredentials(portal, demoPresetInstId);
  };

  const handleSwitchDemoPreset = (presetInst: 'inst-western-poly' | 'inst-apex-tech') => {
    setDemoPresetInstId(presetInst);
    setAuthError(null);
    applyDemoCredentials(activePortal, presetInst);
  };

  // =========================================================
  // 1. UNIVERSAL SIGN-IN (Auto-Detects University from User)
  // =========================================================
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
      if (authedUser.institutionId) {
        institutionalStore.switchInstitution(authedUser.institutionId);
      }
      onLogin(authedUser);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 2. STUDENT SIGN-UP (Scoped to Selected University & Batch)
  // =========================================================
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

    if (regBatchId === '__custom__' && !regCustomBatchCode.trim()) {
      setAuthError('Please enter your academic batch / cohort code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdStudent = await registerStudentAccount({
        name: regFullName.trim(),
        email: regEmail.trim(),
        registrationNumber: regRollNumber.trim().toUpperCase(),
        batchId: regBatchId,
        customBatchCode: regBatchId === '__custom__' ? regCustomBatchCode.trim().toUpperCase() : undefined,
        section: regSection,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        institutionId: signupInstId
      });
      const targetInst = createdStudent.institutionId || signupInstId;
      institutionalStore.switchInstitution(targetInst);
      onLogin(createdStudent);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Student registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 3. FACULTY ACCOUNT ACTIVATION / CLAIM
  // =========================================================
  const handleFacultyActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (facPassword !== facConfirmPassword) {
      setAuthError('Password and Confirm Password do not match.');
      return;
    }
    if (facPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const activatedFaculty = await activateFacultyAccount({
        name: facName.trim(),
        email: facEmail.trim(),
        department: facDepartment.trim(),
        institutionId: facInstId,
        password: facPassword,
        confirmPassword: facConfirmPassword
      });

      const targetInst = activatedFaculty.institutionId || facInstId;
      institutionalStore.switchInstitution(targetInst);

      // Ensure instructor also exists in the frontend scheduling catalog for this university
      const currentCatalog = institutionalStore.get();
      const existsInCatalog = currentCatalog.instructors.some(
        i => i.email.toLowerCase() === facEmail.trim().toLowerCase()
      );
      if (!existsInCatalog) {
        const defaultDeptId = currentCatalog.departments[0]?.id || 'dept-gen';
        institutionalStore.addInstructor({
          id: `inst-claimed-${Date.now().toString(36)}`,
          departmentId: defaultDeptId,
          name: facName.trim(),
          email: facEmail.trim().toLowerCase(),
          title: facDepartment.trim() || 'Faculty Member',
          maxWeeklyHours: 14,
          maxConsecutiveHours: 3,
          preferredDays: currentCatalog.timeStructure.workingDays,
          unavailableSlots: []
        });
      }

      onLogin(activatedFaculty);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Faculty account activation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 4. ADMIN — REGISTER NEW UNIVERSITY WORKSPACE
  // =========================================================
  const handleAdminRegisterUniversitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!univName.trim() || !univCode.trim()) {
      setAuthError('Please enter the official university name and short code.');
      return;
    }

    if (adminRegPassword !== adminRegConfirmPassword) {
      setAuthError('Password and Confirm Password do not match.');
      return;
    }

    if (adminRegPassword.length < 6) {
      setAuthError('Administrator password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUniversityAccount({
        name: univName.trim(),
        code: univCode.trim().toUpperCase(),
        campusName: univCampus.trim() || 'Main Campus',
        adminName: adminFullName.trim() || 'University Administrator',
        adminEmail: adminOfficialEmail.trim().toLowerCase(),
        adminPassword: adminRegPassword
      });

      // Initialize the same institution ID inside the frontend store
      institutionalStore.registerNewInstitution(
        {
          id: result.institutionId,
          name: result.institutionName,
          code: result.institutionCode,
          campusCode: `${result.institutionCode}-MAIN`,
          campusName: univCampus.trim() || 'Main Campus',
          accreditation: 'Accredited Higher Education Institution',
          academicYear: '2026–2027',
          currentTermName: 'Fall Semester 2026',
          registrarName: adminFullName.trim() || 'University Administrator',
          registrarEmail: adminOfficialEmail.trim().toLowerCase(),
          autoConflictSweep: true,
          defaultSessionMinutes: 50,
          timezone: 'UTC',
          isSample: false
        },
        {}
      );

      institutionalStore.switchInstitution(result.institutionId);

      onLogin(result.user, {
        launchOnboardingModal: true,
        institutionId: result.institutionId,
        institutionName: result.institutionName,
        institutionCode: result.institutionCode,
        campusName: univCampus.trim() || 'Main Campus'
      });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to register new university.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpandedCard =
    (activePortal === 'student' && studentSubMode === 'signup') ||
    (activePortal === 'faculty' && facultySubMode === 'activate') ||
    (activePortal === 'admin' && adminSubMode === 'register-university');

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
      id: 'faculty',
      label: 'Faculty',
      shortDesc: 'Teaching schedule',
      icon: BookOpen
    },
    {
      id: 'admin',
      label: 'Admin',
      shortDesc: 'University setup',
      icon: ShieldCheck
    }
  ];

  const getWelcomeHeading = () => {
    if (activePortal === 'student') {
      return studentSubMode === 'signup'
        ? 'Create Student Account'
        : 'Sign in to Student Portal';
    }
    if (activePortal === 'br') {
      return 'Batch Representative Sign In';
    }
    if (activePortal === 'faculty') {
      return facultySubMode === 'activate'
        ? 'Activate Faculty Account'
        : 'Faculty & Instructor Sign In';
    }
    return adminSubMode === 'register-university'
      ? 'Register New University'
      : 'Administrator Sign In';
  };

  const getWelcomeSubtext = () => {
    if (activePortal === 'student') {
      return studentSubMode === 'signup'
        ? 'Select your university and register with your roll number, batch, and section.'
        : 'Enter your email and password — your university workspace is detected automatically.';
    }
    if (activePortal === 'br') {
      return 'Sign in with the Male or Female BR credentials issued by your University Administrator.';
    }
    if (activePortal === 'faculty') {
      return facultySubMode === 'activate'
        ? 'Claim or register your instructor profile for your university workspace.'
        : 'Access your teaching schedule, room assignments, and availability preferences.';
    }
    return adminSubMode === 'register-university'
      ? 'Create an isolated multi-tenant workspace for your university and launch the setup wizard.'
      : 'Sign in to manage academic structure, scheduling rules, timetables, and BR governance.';
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
          Multi-University Role Access
        </span>
      </div>

      {/* Centered Compact Authentication Panel */}
      <main className="w-full flex-1 flex items-center justify-center py-3">
        <div
          className={`w-full ${
            isExpandedCard ? 'max-w-[510px]' : 'max-w-[440px]'
          } bg-white border border-[#E4E2DA] rounded-2xl shadow-xs p-5 sm:p-6 space-y-4 transition-all`}
        >
          {/* 1. Small SmartGrid AI Logo & Welcome Heading */}
          <div className="space-y-2 text-center">
            <div className="flex justify-center">
              <SmartGridLogo variant="primary" theme="light" size="sm" />
            </div>
            <div>
              <h1 className="font-serif-editorial text-2xl text-[#171717] tracking-tight">
                {getWelcomeHeading()}
              </h1>
              <p className="text-xs text-[#57564F] mt-0.5 leading-relaxed">
                {getWelcomeSubtext()}
              </p>
            </div>
          </div>

          {/* 2. Role Selector Tabs (Student, Batch Rep, Faculty, Admin) */}
          <div
            id="role-selector"
            role="tablist"
            aria-label="Select user role"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
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

          {/* 3. Role-Specific Sub-Mode Segmented Switcher (Student / Faculty / Admin) */}
          {activePortal === 'student' && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => {
                  setStudentSubMode('login');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  studentSubMode === 'login'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                Student Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentSubMode('signup');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  studentSubMode === 'signup'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                Student Sign Up
              </button>
            </div>
          )}

          {activePortal === 'faculty' && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => {
                  setFacultySubMode('login');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  facultySubMode === 'login'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                Faculty Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacultySubMode('activate');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  facultySubMode === 'activate'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                Activate Faculty Account
              </button>
            </div>
          )}

          {activePortal === 'admin' && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => {
                  setAdminSubMode('login');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  adminSubMode === 'login'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                Admin Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminSubMode('register-university');
                  setAuthError(null);
                }}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  adminSubMode === 'register-university'
                    ? 'bg-white text-[#171717] shadow-2xs border border-[#E4E2DA]'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <Sparkles className="w-3 h-3 text-[#171717]" />
                <span>Register New University</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {authError && (
            <div className="px-3 py-2.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* =========================================================
              FORM A: STUDENT SIGN UP (University-Scoped)
             ========================================================= */}
          {activePortal === 'student' && studentSubMode === 'signup' && (
            <form onSubmit={handleStudentSignupSubmit} className="space-y-3">
              {/* Step 1: Select University */}
              <div className="p-2.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
                <label className="flex items-center justify-between text-[11px] font-semibold text-[#171717]">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#171717]" />
                    Select Your University
                  </span>
                  <span className="text-[10px] font-normal text-[#77766F]">
                    Loads your university batches
                  </span>
                </label>
                <select
                  value={signupInstId}
                  onChange={e => setSignupInstId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-[#E4E2DA] text-xs font-medium text-[#171717] focus:outline-none cursor-pointer"
                >
                  {availableInstitutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.code})
                    </option>
                  ))}
                </select>
              </div>

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
                      placeholder="2K25-CS-042"
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
                    placeholder="student@university.edu"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Academic Batch / Cohort
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
                          {b.code} — {b.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom Batch Code...</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Section / Group
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

              {regBatchId === '__custom__' && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Custom Batch / Program Code
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2026-BSCS or FALL26-ME"
                      value={regCustomBatchCode}
                      onChange={e => setRegCustomBatchCode(e.target.value.toUpperCase())}
                      className="text-xs font-mono-tabular uppercase"
                    />
                  </div>
                </div>
              )}

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
          )}

          {/* =========================================================
              FORM B: FACULTY ACCOUNT ACTIVATION / CLAIM
             ========================================================= */}
          {activePortal === 'faculty' && facultySubMode === 'activate' && (
            <form onSubmit={handleFacultyActivateSubmit} className="space-y-3">
              <div className="p-2.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
                <label className="flex items-center justify-between text-[11px] font-semibold text-[#171717]">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#171717]" />
                    Your University Workspace
                  </span>
                </label>
                <select
                  value={facInstId}
                  onChange={e => setFacInstId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-[#E4E2DA] text-xs font-medium text-[#171717] focus:outline-none cursor-pointer"
                >
                  {availableInstitutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Full Name & Title
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <User className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="Dr. Sarah Chen"
                      value={facName}
                      onChange={e => setFacName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Department / School
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="Computer Science"
                      value={facDepartment}
                      onChange={e => setFacDepartment(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                  Institutional Faculty Email
                </label>
                <div className="input-group-field h-9 px-2.5 gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder="s.chen@university.edu"
                    value={facEmail}
                    onChange={e => setFacEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Set Password
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Min. 6 chars"
                      value={facPassword}
                      onChange={e => setFacPassword(e.target.value)}
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
                      value={facConfirmPassword}
                      onChange={e => setFacConfirmPassword(e.target.value)}
                      className="text-xs font-mono-tabular"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary h-10 text-xs font-semibold justify-center mt-1"
              >
                <span>
                  {isSubmitting ? 'Activating Faculty Account...' : 'Activate & Enter Faculty Portal'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* =========================================================
              FORM C: ADMIN — REGISTER NEW UNIVERSITY WORKSPACE
             ========================================================= */}
          {activePortal === 'admin' && adminSubMode === 'register-university' && (
            <form onSubmit={handleAdminRegisterUniversitySubmit} className="space-y-3">
              <div className="p-2.5 rounded-xl bg-[#B7F77C]/25 border border-[#98DF58] text-[11px] text-[#171717] flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] shrink-0 mt-0.5" />
                <span>
                  Creates an isolated multi-tenant workspace for your university, provisions your founding Admin account, and opens the University Setup Wizard.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Official University Name
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Institute of Technology"
                      value={univName}
                      onChange={e => setUnivName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Short Code
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Hash className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="NIT / MIT"
                      value={univCode}
                      onChange={e => setUnivCode(e.target.value.toUpperCase())}
                      className="text-xs font-mono-tabular uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Campus Name
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="Main Innovation Campus"
                      value={univCampus}
                      onChange={e => setUnivCampus(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Administrator Full Name
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <User className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type="text"
                      required
                      placeholder="Dr. Katherine Vance"
                      value={adminFullName}
                      onChange={e => setAdminFullName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                  Administrator Official Email
                </label>
                <div className="input-group-field h-9 px-2.5 gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder="registrar@nit.edu"
                    value={adminOfficialEmail}
                    onChange={e => setAdminOfficialEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171717] mb-1">
                    Admin Password
                  </label>
                  <div className="input-group-field h-9 px-2.5 gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Min. 6 chars"
                      value={adminRegPassword}
                      onChange={e => setAdminRegPassword(e.target.value)}
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
                      value={adminRegConfirmPassword}
                      onChange={e => setAdminRegConfirmPassword(e.target.value)}
                      className="text-xs font-mono-tabular"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary h-10 text-xs font-semibold justify-center mt-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? 'Provisioning University Workspace...'
                    : 'Register University & Launch Setup Wizard'}
                </span>
              </button>
            </form>
          )}

          {/* =========================================================
              FORM D: UNIVERSAL SIGN-IN (Auto-Detects University)
             ========================================================= */}
          {!isExpandedCard && (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#171717]">
                    {activePortal === 'student'
                      ? 'Student Email'
                      : activePortal === 'br'
                      ? 'Batch Representative Email'
                      : activePortal === 'faculty'
                      ? 'Faculty / Instructor Email'
                      : 'Administrator Email'}
                  </label>
                  <span className="text-[10px] text-[#77766F]">
                    Auto-detects university workspace
                  </span>
                </div>
                <div className="input-group-field h-10 px-3 gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder={
                      activePortal === 'student'
                        ? 'student@university.edu'
                        : activePortal === 'br'
                        ? 'br@university.edu'
                        : activePortal === 'faculty'
                        ? 'faculty@university.edu'
                        : 'admin@university.edu'
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

              {/* Login Submit Button */}
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
                    ? 'Sign In as Batch Representative'
                    : activePortal === 'faculty'
                    ? 'Sign In as Faculty'
                    : 'Sign In as Administrator'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Compact Multi-University Demo Quick-Fill Bar */}
              <div className="p-2.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-semibold text-[#57564F]">
                    Quick-Fill Test Accounts:
                  </span>
                  <div className="inline-flex rounded-lg bg-white border border-[#E4E2DA] p-0.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchDemoPreset('inst-western-poly')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                        demoPresetInstId === 'inst-western-poly'
                          ? 'bg-[#171717] text-white'
                          : 'text-[#57564F] hover:text-[#171717]'
                      }`}
                    >
                      Western Poly (Sample)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchDemoPreset('inst-apex-tech')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                        demoPresetInstId === 'inst-apex-tech'
                          ? 'bg-[#171717] text-white'
                          : 'text-[#57564F] hover:text-[#171717]'
                      }`}
                    >
                      Apex Tech (6-Day)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E4E2DA]/70">
                  <span className="text-[10.5px] text-[#77766F] truncate">
                    {demoPresetInstId === 'inst-apex-tech'
                      ? 'Mon–Sat · 60m classes · 2h labs'
                      : 'Mon–Fri · 50m classes · 3h labs'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {demoPresetInstId === 'inst-apex-tech' ? (
                      <>
                        {activePortal === 'student' && (
                          <button
                            type="button"
                            onClick={() => {
                              setLoginEmail('student.alex@apextech.edu');
                              setLoginPassword('Student@2026');
                              setAuthError(null);
                            }}
                            className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                          >
                            Fill Apex Student
                          </button>
                        )}
                        {activePortal === 'br' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('br.male@apextech.edu');
                                setLoginPassword('BR@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Male BR
                            </button>
                            <span className="text-[#77766F]">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('br.female@apextech.edu');
                                setLoginPassword('BR@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Female BR
                            </button>
                          </>
                        )}
                        {activePortal === 'faculty' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('m.vance@apextech.edu');
                                setLoginPassword('Faculty@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Dr. Vance
                            </button>
                            <span className="text-[#77766F]">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('e.rostova@apextech.edu');
                                setLoginPassword('Faculty@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Prof. Rostova
                            </button>
                          </>
                        )}
                        {activePortal === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setLoginEmail('admin@apextech.edu');
                              setLoginPassword('Admin@2026');
                              setAuthError(null);
                            }}
                            className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                          >
                            Fill Apex Admin
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {activePortal === 'student' && (
                          <button
                            type="button"
                            onClick={() => {
                              setLoginEmail('m.lin@westernpoly.edu');
                              setLoginPassword('Student@2026');
                              setAuthError(null);
                            }}
                            className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                          >
                            Fill Demo Student
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
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Male BR
                            </button>
                            <span className="text-[#77766F]">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('br.female.2k25bscs@westernpoly.edu');
                                setLoginPassword('BR-2K25CS-F!');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Female BR
                            </button>
                          </>
                        )}
                        {activePortal === 'faculty' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('jehanzeb.ahmad@westernpoly.edu');
                                setLoginPassword('Faculty@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Dr. Jehanzeb
                            </button>
                            <span className="text-[#77766F]">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginEmail('a.turing@westernpoly.edu');
                                setLoginPassword('Faculty@2026');
                                setAuthError(null);
                              }}
                              className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Prof. Turing
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
                            className="text-[10.5px] font-semibold text-[#171717] underline cursor-pointer"
                          >
                            Fill Demo Admin
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* 5. Role-Specific Governance & Provisioning Footer */}
          <div className="pt-3 border-t border-[#E4E2DA]">
            {activePortal === 'br' && (
              <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#171717]">
                  <KeyRound className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                  <span>Direct Admin Provisioning (Path B)</span>
                </div>
                <p className="text-[11px] text-[#57564F] leading-relaxed">
                  Each batch has strictly two representative seats (<strong>1 Male BR</strong> &amp; <strong>1 Female BR</strong>). BR accounts cannot be self-registered; your University Administrator provisions and issues BR credentials directly inside <strong>Administration → Batch Representatives</strong>.
                </p>
              </div>
            )}

            {activePortal === 'student' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#57564F]">
                  {studentSubMode === 'login'
                    ? 'New student at your university?'
                    : 'Already registered your student account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudentSubMode(studentSubMode === 'login' ? 'signup' : 'login');
                    setAuthError(null);
                  }}
                  className="font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  {studentSubMode === 'login' ? 'Create Student Account →' : '← Back to Sign In'}
                </button>
              </div>
            )}

            {activePortal === 'faculty' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#57564F]">
                  {facultySubMode === 'login'
                    ? 'First time signing in as an instructor?'
                    : 'Already activated your faculty account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFacultySubMode(facultySubMode === 'login' ? 'activate' : 'login');
                    setAuthError(null);
                  }}
                  className="font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  {facultySubMode === 'login' ? 'Activate Faculty Account →' : '← Faculty Sign In'}
                </button>
              </div>
            )}

            {activePortal === 'admin' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#57564F]">
                  {adminSubMode === 'login'
                    ? 'Setting up SmartGrid AI for a new university?'
                    : 'Already have an administrator account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAdminSubMode(
                      adminSubMode === 'login' ? 'register-university' : 'login'
                    );
                    setAuthError(null);
                  }}
                  className="font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  {adminSubMode === 'login' ? 'Register New University →' : '← Admin Sign In'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="max-w-[520px] w-full mx-auto text-center text-[11px] text-[#77766F]">
        SmartGrid AI · Multi-University Timetable &amp; Academic Governance Platform
      </footer>
    </div>
  );
};
