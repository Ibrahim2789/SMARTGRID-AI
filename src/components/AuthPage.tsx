import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  AuthenticatedVotingUser,
  PublicBatchOption,
  UniversityDetectionResult,
  fetchPublicBatches,
  fetchInstitutionsApi,
  loginWithBackend,
  registerStudentAccount,
  activateFacultyAccount,
  registerUniversityAccount,
  detectUniversityByEmailApi,
  requestPasswordRecoveryApi
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com'
]);

function isDemoOrDevEnvironment(): boolean {
  try {
    if (import.meta.env.DEV) return true;
    if (import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'false') return false;
    const host = window.location.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.run.app') ||
      host.includes('aistudio')
    );
  } catch {
    return false;
  }
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  initialPortal = 'student',
  onLogin,
  onCancel
}) => {
  const storeSnapshot = useInstitutionalData();
  const isDemoModeAvailable = isDemoOrDevEnvironment();

  const [availableInstitutions, setAvailableInstitutions] = useState<InstitutionSummary[]>(() =>
    institutionalStore.getAvailableInstitutions()
  );

  // Selected Role: 'student' | 'br' | 'faculty' | 'admin'
  const [activePortal, setActivePortal] = useState<AuthPortalType>(initialPortal);

  // Role-specific authentication modes
  const [studentSubMode, setStudentSubMode] = useState<'signin' | 'signup'>(
    initialPortal === 'student' && initialMode === 'signup' ? 'signup' : 'signin'
  );
  const [facultySubMode, setFacultySubMode] = useState<'signin' | 'activate'>('signin');
  const [adminSubMode, setAdminSubMode] = useState<'signin' | 'register-university'>('signin');

  // Forgot Password view state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

  // Password visibility controls (the only icons used on this screen)
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Submission & feedback states
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Sign-In Form State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Real-time University Detection State
  const [universityDetection, setUniversityDetection] = useState<UniversityDetectionResult>({
    status: 'idle'
  });

  // Demo Accounts Collapsible Drawer State
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [demoPresetInstId, setDemoPresetInstId] = useState<'inst-western-poly' | 'inst-apex-tech'>(
    () =>
      institutionalStore.getCurrentInstitutionId() === 'inst-apex-tech'
        ? 'inst-apex-tech'
        : 'inst-western-poly'
  );

  // Student Registration Form State
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

  // Admin "Register New University Workspace" Form State
  const [univName, setUnivName] = useState<string>('');
  const [univCode, setUnivCode] = useState<string>('');
  const [univCampus, setUnivCampus] = useState<string>('Main Campus');
  const [adminFullName, setAdminFullName] = useState<string>('');
  const [adminOfficialEmail, setAdminOfficialEmail] = useState<string>('');
  const [adminRegPassword, setAdminRegPassword] = useState<string>('');
  const [adminRegConfirmPassword, setAdminRegConfirmPassword] = useState<string>('');

  const roleTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const roleOptions: Array<{
    id: AuthPortalType;
    label: string;
  }> = [
    { id: 'student', label: 'Student' },
    { id: 'br', label: 'Batch Representative' },
    { id: 'faculty', label: 'Faculty' },
    { id: 'admin', label: 'Admin' }
  ];

  // Sync institutions from backend on mount
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

  // Real-time University Detection based on the entered email domain
  useEffect(() => {
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setUniversityDetection({ status: 'idle' });
      return;
    }

    const parts = trimmed.split('@');
    const domain = parts[parts.length - 1] || '';
    if (!domain || !domain.includes('.') || domain.endsWith('.')) {
      setUniversityDetection({ status: 'idle' });
      return;
    }

    let isCancelled = false;
    setUniversityDetection({ status: 'detecting', domain });

    const timer = window.setTimeout(async () => {
      try {
        const res = await detectUniversityByEmailApi(trimmed);
        if (isCancelled) return;
        setUniversityDetection(res);
      } catch {
        if (isCancelled) return;
        if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
          setUniversityDetection({
            status: 'unsupported',
            domain,
            message: `@${domain} is a personal email provider, not a university domain.`
          });
        } else if (domain.includes('westernpoly.edu')) {
          setUniversityDetection({
            status: 'detected',
            domain,
            institutionId: 'inst-western-poly',
            institutionName: 'Western Polytechnic University',
            institutionCode: 'WPU'
          });
        } else if (domain.includes('apextech.edu')) {
          setUniversityDetection({
            status: 'detected',
            domain,
            institutionId: 'inst-apex-tech',
            institutionName: 'Apex Institute of Technology & Sciences',
            institutionCode: 'AITS'
          });
        } else {
          setUniversityDetection({
            status: 'unrecognized',
            domain,
            message: `No registered university workspace matched @${domain}.`
          });
        }
      }
    }, 260);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [loginEmail]);

  const clearErrors = () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    setFieldErrors({});
  };

  const handleSelectPortal = (portal: AuthPortalType) => {
    setActivePortal(portal);
    setIsForgotPasswordOpen(false);
    clearErrors();
    if (portal === 'student') {
      setStudentSubMode('signin');
    } else if (portal === 'faculty') {
      setFacultySubMode('signin');
    } else if (portal === 'admin') {
      setAdminSubMode('signin');
    }
  };

  const handleRoleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const total = roleOptions.length;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % total;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + total) % total;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = total - 1;
    }
    if (nextIndex !== null) {
      const targetRole = roleOptions[nextIndex];
      handleSelectPortal(targetRole.id);
      roleTabRefs.current[nextIndex]?.focus();
    }
  };

  const fillDemoCredential = (email: string, password: string) => {
    setIsForgotPasswordOpen(false);
    clearErrors();
    if (activePortal === 'student') setStudentSubMode('signin');
    if (activePortal === 'faculty') setFacultySubMode('signin');
    if (activePortal === 'admin') setAdminSubMode('signin');
    setLoginEmail(email);
    setLoginPassword(password);
  };

  // =========================================================
  // INLINE FIELD VALIDATION HELPERS
  // =========================================================
  const validateSignInFields = (): boolean => {
    const errors: Record<string, string> = {};
    const cleanEmail = loginEmail.trim();
    if (!cleanEmail) {
      errors.loginEmail = 'Please enter your institutional email address.';
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errors.loginEmail = 'Enter a valid email address (for example, name@university.edu).';
    }
    if (!loginPassword) {
      errors.loginPassword = 'Please enter your account password.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStudentSignupFields = (): boolean => {
    const errors: Record<string, string> = {};
    if (regFullName.trim().length < 2) {
      errors.regFullName = 'Enter your full legal name (at least 2 characters).';
    }
    if (regRollNumber.trim().length < 3) {
      errors.regRollNumber = 'Enter your official university roll or registration number.';
    }
    if (!regEmail.trim() || !EMAIL_REGEX.test(regEmail.trim())) {
      errors.regEmail = 'Enter a valid student or university email address.';
    }
    if (regBatchId === '__custom__' && !regCustomBatchCode.trim()) {
      errors.regCustomBatchCode = 'Enter your cohort or batch code (e.g., 2K25-BSCS).';
    }
    if (regPassword.length < 6) {
      errors.regPassword = 'Password must be at least 6 characters long.';
    }
    if (regPassword !== regConfirmPassword) {
      errors.regConfirmPassword = 'Confirmation password does not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFacultyActivateFields = (): boolean => {
    const errors: Record<string, string> = {};
    if (facName.trim().length < 2) {
      errors.facName = 'Enter your full name and academic title (e.g., Dr. Sarah Chen).';
    }
    if (!facDepartment.trim()) {
      errors.facDepartment = 'Enter your academic department or school.';
    }
    if (!facEmail.trim() || !EMAIL_REGEX.test(facEmail.trim())) {
      errors.facEmail = 'Enter a valid institutional faculty email address.';
    }
    if (facPassword.length < 6) {
      errors.facPassword = 'Password must be at least 6 characters long.';
    }
    if (facPassword !== facConfirmPassword) {
      errors.facConfirmPassword = 'Confirmation password does not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateAdminRegisterFields = (): boolean => {
    const errors: Record<string, string> = {};
    if (!univName.trim()) {
      errors.univName = 'Enter the official university name.';
    }
    if (!univCode.trim()) {
      errors.univCode = 'Enter the university short code (e.g., WPU).';
    }
    if (adminFullName.trim().length < 2) {
      errors.adminFullName = 'Enter the administrator full name.';
    }
    if (!adminOfficialEmail.trim() || !EMAIL_REGEX.test(adminOfficialEmail.trim())) {
      errors.adminOfficialEmail = 'Enter a valid official registrar or admin email.';
    }
    if (adminRegPassword.length < 6) {
      errors.adminRegPassword = 'Password must be at least 6 characters long.';
    }
    if (adminRegPassword !== adminRegConfirmPassword) {
      errors.adminRegConfirmPassword = 'Confirmation password does not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // =========================================================
  // 1. UNIVERSAL SIGN-IN HANDLER
  // =========================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    clearErrors();

    if (!validateSignInFields()) return;

    setIsSubmitting(true);
    try {
      const authedUser = await loginWithBackend(
        loginEmail.trim(),
        loginPassword,
        false,
        activePortal
      );
      setAuthSuccessMessage(`Authenticated as ${authedUser.name}. Opening workspace...`);
      if (authedUser.institutionId) {
        institutionalStore.switchInstitution(authedUser.institutionId);
      }
      onLogin(authedUser);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please verify your email, password, and selected role.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 2. STUDENT SIGN-UP HANDLER
  // =========================================================
  const handleStudentSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    clearErrors();

    if (!validateStudentSignupFields()) return;

    setIsSubmitting(true);
    try {
      const createdStudent = await registerStudentAccount({
        name: regFullName.trim(),
        email: regEmail.trim(),
        registrationNumber: regRollNumber.trim().toUpperCase(),
        batchId: regBatchId,
        customBatchCode:
          regBatchId === '__custom__' ? regCustomBatchCode.trim().toUpperCase() : undefined,
        section: regSection,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        institutionId: signupInstId
      });
      setAuthSuccessMessage('Student account created. Redirecting to your cohort timetable...');
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
  // 3. FACULTY PROFILE ACTIVATION HANDLER
  // =========================================================
  const handleFacultyActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    clearErrors();

    if (!validateFacultyActivateFields()) return;

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

      setAuthSuccessMessage('Faculty account activated. Loading instructor portal...');
      onLogin(activatedFaculty);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Faculty account activation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 4. ADMIN — ONBOARD NEW UNIVERSITY WORKSPACE HANDLER
  // =========================================================
  const handleAdminRegisterUniversitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    clearErrors();

    if (!validateAdminRegisterFields()) return;

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
      setAuthSuccessMessage('University workspace provisioned. Launching setup wizard...');

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

  // =========================================================
  // 5. FORGOT PASSWORD RECOVERY HANDLER
  // =========================================================
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecoverySubmitting) return;
    setRecoveryError(null);
    setRecoverySuccessMessage(null);

    const targetEmail = recoveryEmail.trim();
    if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
      setRecoveryError('Please enter a valid institutional email address (e.g., user@university.edu).');
      return;
    }

    setIsRecoverySubmitting(true);
    try {
      const res = await requestPasswordRecoveryApi({
        email: targetEmail,
        role: activePortal
      });
      setRecoverySuccessMessage(res.message);
    } catch (err) {
      setRecoveryError(
        err instanceof Error ? err.message : 'Unable to submit password recovery request.'
      );
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  const isMultiColumnForm =
    !isForgotPasswordOpen &&
    ((activePortal === 'student' && studentSubMode === 'signup') ||
      (activePortal === 'faculty' && facultySubMode === 'activate') ||
      (activePortal === 'admin' && adminSubMode === 'register-university'));

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717] flex flex-col justify-between px-4 py-6 sm:px-6 sm:py-8">
      {/* Top Bar */}
      <header className="max-w-[560px] w-full mx-auto flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs sm:text-sm font-medium text-[#4A4942] hover:text-[#171717] min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#EDEAE0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] transition-colors cursor-pointer"
        >
          Back to home
        </button>
      </header>

      {/* Main Authentication Surface */}
      <main className="w-full flex-1 flex items-center justify-center py-6">
        <div
          className={`w-full ${
            isMultiColumnForm ? 'max-w-[560px]' : 'max-w-[480px]'
          } bg-white border border-[#E4E2DA] rounded-2xl p-6 sm:p-8 space-y-6 transition-all`}
        >
          {/* Single Heading with Brand Identity */}
          <h1 className="font-serif-editorial text-2xl sm:text-[28px] font-semibold text-[#171717] tracking-tight text-center">
            SmartGrid AI
          </h1>

          {/* Accessible 4-Role Selector (Labels Only, No Icons, No Descriptions) */}
          <div className="space-y-2">
            <label
              id="role-selector-label"
              className="block text-xs font-semibold text-[#171717]"
            >
              Role
            </label>
            <div
              role="tablist"
              aria-labelledby="role-selector-label"
              className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
            >
              {roleOptions.map((option, idx) => {
                const isSelected = activePortal === option.id;
                return (
                  <button
                    key={option.id}
                    ref={el => {
                      roleTabRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`role-tab-${option.id}`}
                    aria-selected={isSelected}
                    aria-controls={`role-panel-${option.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectPortal(option.id)}
                    onKeyDown={e => handleRoleKeyDown(e, idx)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] ${
                      isSelected
                        ? 'bg-[#171717] text-white'
                        : 'bg-white text-[#4A4942] hover:text-[#171717] border border-[#E4E2DA]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Switcher (Scoped by Role Registration Rules) */}
          {!isForgotPasswordOpen && activePortal === 'student' && (
            <div
              role="group"
              aria-label="Student authentication mode"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
            >
              <button
                type="button"
                onClick={() => {
                  setStudentSubMode('signin');
                  clearErrors();
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] ${
                  studentSubMode === 'signin'
                    ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                    : 'text-[#4A4942] hover:text-[#171717]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentSubMode('signup');
                  clearErrors();
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] ${
                  studentSubMode === 'signup'
                    ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                    : 'text-[#4A4942] hover:text-[#171717]'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {!isForgotPasswordOpen && activePortal === 'faculty' && (
            <div
              role="group"
              aria-label="Faculty authentication mode"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
            >
              <button
                type="button"
                onClick={() => {
                  setFacultySubMode('signin');
                  clearErrors();
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] ${
                  facultySubMode === 'signin'
                    ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                    : 'text-[#4A4942] hover:text-[#171717]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacultySubMode('activate');
                  clearErrors();
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] ${
                  facultySubMode === 'activate'
                    ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                    : 'text-[#4A4942] hover:text-[#171717]'
                }`}
              >
                Activate Profile
              </button>
            </div>
          )}

          {/* Global Error & Success Alerts (No Icons) */}
          {authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs"
            >
              {authError}
            </div>
          )}

          {authSuccessMessage && (
            <div
              role="status"
              aria-live="polite"
              className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] text-xs font-medium"
            >
              {authSuccessMessage}
            </div>
          )}

          {/* =========================================================
              VIEW 0: FORGOT PASSWORD RECOVERY VIEW
             ========================================================= */}
          {isForgotPasswordOpen && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" noValidate>
              {recoveryError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs"
                >
                  {recoveryError}
                </div>
              )}

              {recoverySuccessMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] text-xs leading-relaxed"
                >
                  {recoverySuccessMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="recovery-email-input"
                  className="block text-xs font-semibold text-[#171717]"
                >
                  Institutional Email Address
                </label>
                <div className="input-group-field h-11 px-3.5">
                  <input
                    id="recovery-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@university.edu"
                    value={recoveryEmail}
                    onChange={e => {
                      setRecoveryEmail(e.target.value);
                      setRecoveryError(null);
                    }}
                    className="text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isRecoverySubmitting}
                  className="w-full sm:flex-1 btn-primary h-11 text-xs sm:text-sm font-semibold justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                >
                  {isRecoverySubmitting
                    ? 'Submitting Recovery Request...'
                    : 'Send Recovery Instructions'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setRecoveryError(null);
                    setRecoverySuccessMessage(null);
                  }}
                  className="w-full sm:w-auto btn-secondary h-11 px-4 text-xs sm:text-sm font-semibold justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          )}

          {/* =========================================================
              FORM A: STUDENT SIGN UP (University-Scoped)
             ========================================================= */}
          {!isForgotPasswordOpen &&
            activePortal === 'student' &&
            studentSubMode === 'signup' && (
              <form
                id="role-panel-student"
                onSubmit={handleStudentSignupSubmit}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="student-signup-university"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    University
                  </label>
                  <select
                    id="student-signup-university"
                    value={signupInstId}
                    onChange={e => setSignupInstId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs sm:text-sm font-medium text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer"
                  >
                    {availableInstitutions.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-name"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Full Name
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.regFullName ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="student-signup-name"
                        type="text"
                        required
                        autoComplete="name"
                        aria-invalid={Boolean(fieldErrors.regFullName)}
                        aria-describedby={
                          fieldErrors.regFullName ? 'err-student-name' : undefined
                        }
                        placeholder="e.g. Tariq Mehmood"
                        value={regFullName}
                        onChange={e => {
                          setRegFullName(e.target.value);
                          if (fieldErrors.regFullName) {
                            setFieldErrors(prev => ({ ...prev, regFullName: '' }));
                          }
                        }}
                        className="text-sm w-full"
                      />
                    </div>
                    {fieldErrors.regFullName && (
                      <p id="err-student-name" className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.regFullName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-roll"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Registration / Roll Number
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.regRollNumber ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="student-signup-roll"
                        type="text"
                        required
                        aria-invalid={Boolean(fieldErrors.regRollNumber)}
                        aria-describedby={
                          fieldErrors.regRollNumber ? 'err-student-roll' : undefined
                        }
                        placeholder="e.g. 2K25-BSCS-042"
                        value={regRollNumber}
                        onChange={e => {
                          setRegRollNumber(e.target.value);
                          if (fieldErrors.regRollNumber) {
                            setFieldErrors(prev => ({ ...prev, regRollNumber: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular uppercase w-full"
                      />
                    </div>
                    {fieldErrors.regRollNumber && (
                      <p id="err-student-roll" className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.regRollNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="student-signup-email"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Student Email
                  </label>
                  <div
                    className={`input-group-field h-11 px-3 ${
                      fieldErrors.regEmail ? 'border-[#DC2626]' : ''
                    }`}
                  >
                    <input
                      id="student-signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.regEmail)}
                      aria-describedby={fieldErrors.regEmail ? 'err-student-email' : undefined}
                      placeholder="student@westernpoly.edu"
                      value={regEmail}
                      onChange={e => {
                        setRegEmail(e.target.value);
                        if (fieldErrors.regEmail) {
                          setFieldErrors(prev => ({ ...prev, regEmail: '' }));
                        }
                      }}
                      className="text-sm w-full"
                    />
                  </div>
                  {fieldErrors.regEmail && (
                    <p id="err-student-email" className="text-[11px] text-[#8B1E1E]">
                      {fieldErrors.regEmail}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-batch"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Academic Batch
                    </label>
                    <div className="input-group-field h-11 px-3">
                      <select
                        id="student-signup-batch"
                        value={regBatchId}
                        onChange={e => setRegBatchId(e.target.value)}
                        className="text-xs sm:text-sm w-full bg-transparent focus:outline-none cursor-pointer"
                      >
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.code} — {b.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter Custom Cohort Code...</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-section"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Class Section
                    </label>
                    <div className="input-group-field h-11 px-3">
                      <select
                        id="student-signup-section"
                        value={regSection}
                        onChange={e => setRegSection(e.target.value)}
                        className="text-xs sm:text-sm w-full bg-transparent focus:outline-none cursor-pointer"
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
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-custom-batch"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Custom Batch Code
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.regCustomBatchCode ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="student-signup-custom-batch"
                        type="text"
                        required
                        placeholder="e.g. 2K26-BSCS"
                        value={regCustomBatchCode}
                        onChange={e =>
                          setRegCustomBatchCode(e.target.value.toUpperCase())
                        }
                        className="text-sm font-mono-tabular uppercase w-full"
                      />
                    </div>
                    {fieldErrors.regCustomBatchCode && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.regCustomBatchCode}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-password"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.regPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="student-signup-password"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        value={regPassword}
                        onChange={e => {
                          setRegPassword(e.target.value);
                          if (fieldErrors.regPassword) {
                            setFieldErrors(prev => ({ ...prev, regPassword: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(prev => !prev)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showRegPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.regPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.regPassword}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-signup-confirm-password"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Confirm Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.regConfirmPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="student-signup-confirm-password"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={regConfirmPassword}
                        onChange={e => {
                          setRegConfirmPassword(e.target.value);
                          if (fieldErrors.regConfirmPassword) {
                            setFieldErrors(prev => ({ ...prev, regConfirmPassword: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(prev => !prev)}
                        aria-label={
                          showRegConfirmPassword
                            ? 'Hide confirmation password'
                            : 'Show confirmation password'
                        }
                        aria-pressed={showRegConfirmPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.regConfirmPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.regConfirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary h-11 text-sm font-semibold justify-center mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                >
                  {isSubmitting ? 'Creating Student Account...' : 'Create Student Account'}
                </button>
              </form>
            )}

          {/* =========================================================
              FORM B: FACULTY PROFILE ACTIVATION
             ========================================================= */}
          {!isForgotPasswordOpen &&
            activePortal === 'faculty' &&
            facultySubMode === 'activate' && (
              <form
                id="role-panel-faculty"
                onSubmit={handleFacultyActivateSubmit}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="faculty-activate-university"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    University
                  </label>
                  <select
                    id="faculty-activate-university"
                    value={facInstId}
                    onChange={e => setFacInstId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs sm:text-sm font-medium text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer"
                  >
                    {availableInstitutions.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="faculty-activate-name"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Full Name &amp; Title
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.facName ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="faculty-activate-name"
                        type="text"
                        required
                        placeholder="Dr. Sarah Chen"
                        value={facName}
                        onChange={e => {
                          setFacName(e.target.value);
                          if (fieldErrors.facName) {
                            setFieldErrors(prev => ({ ...prev, facName: '' }));
                          }
                        }}
                        className="text-sm w-full"
                      />
                    </div>
                    {fieldErrors.facName && (
                      <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.facName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="faculty-activate-dept"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Academic Department
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.facDepartment ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="faculty-activate-dept"
                        type="text"
                        required
                        placeholder="Department of Computer Science"
                        value={facDepartment}
                        onChange={e => {
                          setFacDepartment(e.target.value);
                          if (fieldErrors.facDepartment) {
                            setFieldErrors(prev => ({ ...prev, facDepartment: '' }));
                          }
                        }}
                        className="text-sm w-full"
                      />
                    </div>
                    {fieldErrors.facDepartment && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.facDepartment}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="faculty-activate-email"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Approved Faculty Email
                  </label>
                  <div
                    className={`input-group-field h-11 px-3 ${
                      fieldErrors.facEmail ? 'border-[#DC2626]' : ''
                    }`}
                  >
                    <input
                      id="faculty-activate-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="s.chen@westernpoly.edu"
                      value={facEmail}
                      onChange={e => {
                        setFacEmail(e.target.value);
                        if (fieldErrors.facEmail) {
                          setFieldErrors(prev => ({ ...prev, facEmail: '' }));
                        }
                      }}
                      className="text-sm w-full"
                    />
                  </div>
                  {fieldErrors.facEmail && (
                    <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.facEmail}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="faculty-activate-password"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Create Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.facPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="faculty-activate-password"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        value={facPassword}
                        onChange={e => {
                          setFacPassword(e.target.value);
                          if (fieldErrors.facPassword) {
                            setFieldErrors(prev => ({ ...prev, facPassword: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(prev => !prev)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showRegPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.facPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.facPassword}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="faculty-activate-confirm"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Confirm Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.facConfirmPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="faculty-activate-confirm"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={facConfirmPassword}
                        onChange={e => {
                          setFacConfirmPassword(e.target.value);
                          if (fieldErrors.facConfirmPassword) {
                            setFieldErrors(prev => ({
                              ...prev,
                              facConfirmPassword: ''
                            }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(prev => !prev)}
                        aria-label={
                          showRegConfirmPassword
                            ? 'Hide confirmation password'
                            : 'Show confirmation password'
                        }
                        aria-pressed={showRegConfirmPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.facConfirmPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.facConfirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary h-11 text-sm font-semibold justify-center mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                >
                  {isSubmitting ? 'Activating Faculty Profile...' : 'Activate Faculty Account'}
                </button>
              </form>
            )}

          {/* =========================================================
              FORM C: ADMIN — ONBOARD NEW UNIVERSITY TENANT
             ========================================================= */}
          {!isForgotPasswordOpen &&
            activePortal === 'admin' &&
            adminSubMode === 'register-university' && (
              <form
                id="role-panel-admin"
                onSubmit={handleAdminRegisterUniversitySubmit}
                className="space-y-4"
                noValidate
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="admin-univ-name"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      University Name
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.univName ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="admin-univ-name"
                        type="text"
                        required
                        placeholder="e.g. National Institute of Technology"
                        value={univName}
                        onChange={e => {
                          setUnivName(e.target.value);
                          if (fieldErrors.univName) {
                            setFieldErrors(prev => ({ ...prev, univName: '' }));
                          }
                        }}
                        className="text-sm w-full"
                      />
                    </div>
                    {fieldErrors.univName && (
                      <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.univName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-univ-code"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Short Code
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.univCode ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="admin-univ-code"
                        type="text"
                        required
                        placeholder="NIT"
                        value={univCode}
                        onChange={e => {
                          setUnivCode(e.target.value.toUpperCase());
                          if (fieldErrors.univCode) {
                            setFieldErrors(prev => ({ ...prev, univCode: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular uppercase w-full"
                      />
                    </div>
                    {fieldErrors.univCode && (
                      <p className="text-[11px] text-[#8B1E1E]">{fieldErrors.univCode}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-univ-campus"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Campus Name
                    </label>
                    <div className="input-group-field h-11 px-3">
                      <input
                        id="admin-univ-campus"
                        type="text"
                        required
                        placeholder="Main Engineering Campus"
                        value={univCampus}
                        onChange={e => setUnivCampus(e.target.value)}
                        className="text-sm w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-registrar-name"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Administrator Name
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 ${
                        fieldErrors.adminFullName ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="admin-registrar-name"
                        type="text"
                        required
                        placeholder="Dr. Katherine Vance"
                        value={adminFullName}
                        onChange={e => {
                          setAdminFullName(e.target.value);
                          if (fieldErrors.adminFullName) {
                            setFieldErrors(prev => ({ ...prev, adminFullName: '' }));
                          }
                        }}
                        className="text-sm w-full"
                      />
                    </div>
                    {fieldErrors.adminFullName && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.adminFullName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-official-email"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Official Registrar Email
                  </label>
                  <div
                    className={`input-group-field h-11 px-3 ${
                      fieldErrors.adminOfficialEmail ? 'border-[#DC2626]' : ''
                    }`}
                  >
                    <input
                      id="admin-official-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="registrar@nit.edu"
                      value={adminOfficialEmail}
                      onChange={e => {
                        setAdminOfficialEmail(e.target.value);
                        if (fieldErrors.adminOfficialEmail) {
                          setFieldErrors(prev => ({ ...prev, adminOfficialEmail: '' }));
                        }
                      }}
                      className="text-sm w-full"
                    />
                  </div>
                  {fieldErrors.adminOfficialEmail && (
                    <p className="text-[11px] text-[#8B1E1E]">
                      {fieldErrors.adminOfficialEmail}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-reg-password"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.adminRegPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="admin-reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        value={adminRegPassword}
                        onChange={e => {
                          setAdminRegPassword(e.target.value);
                          if (fieldErrors.adminRegPassword) {
                            setFieldErrors(prev => ({ ...prev, adminRegPassword: '' }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(prev => !prev)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showRegPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.adminRegPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.adminRegPassword}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-reg-confirm-password"
                      className="block text-xs font-semibold text-[#171717]"
                    >
                      Confirm Password
                    </label>
                    <div
                      className={`input-group-field h-11 px-3 gap-2 ${
                        fieldErrors.adminRegConfirmPassword ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <input
                        id="admin-reg-confirm-password"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={adminRegConfirmPassword}
                        onChange={e => {
                          setAdminRegConfirmPassword(e.target.value);
                          if (fieldErrors.adminRegConfirmPassword) {
                            setFieldErrors(prev => ({
                              ...prev,
                              adminRegConfirmPassword: ''
                            }));
                          }
                        }}
                        className="text-sm font-mono-tabular w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(prev => !prev)}
                        aria-label={
                          showRegConfirmPassword
                            ? 'Hide confirmation password'
                            : 'Show confirmation password'
                        }
                        aria-pressed={showRegConfirmPassword}
                        className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] cursor-pointer"
                      >
                        {showRegConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.adminRegConfirmPassword && (
                      <p className="text-[11px] text-[#8B1E1E]">
                        {fieldErrors.adminRegConfirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary h-11 text-sm font-semibold justify-center mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                >
                  {isSubmitting
                    ? 'Provisioning University Workspace...'
                    : 'Provision University Workspace'}
                </button>
              </form>
            )}

          {/* =========================================================
              FORM D: SIGN-IN FORM (With Real-Time University Detection)
             ========================================================= */}
          {!isForgotPasswordOpen && !isMultiColumnForm && (
            <form
              id={`role-panel-${activePortal}`}
              onSubmit={handleLoginSubmit}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="signin-email-input"
                  className="block text-xs font-semibold text-[#171717]"
                >
                  {activePortal === 'student'
                    ? 'Student Email'
                    : activePortal === 'br'
                    ? 'Batch Representative Email'
                    : activePortal === 'faculty'
                    ? 'Faculty Email'
                    : 'Administrator Email'}
                </label>

                <div
                  className={`input-group-field h-11 px-3.5 ${
                    fieldErrors.loginEmail ? 'border-[#DC2626]' : ''
                  }`}
                >
                  <input
                    id="signin-email-input"
                    type="email"
                    required
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.loginEmail)}
                    aria-describedby="signin-university-detection-feedback"
                    placeholder={
                      activePortal === 'student'
                        ? 'student@university.edu'
                        : activePortal === 'br'
                        ? 'br.cohort@university.edu'
                        : activePortal === 'faculty'
                        ? 'instructor@university.edu'
                        : 'registrar@university.edu'
                    }
                    value={loginEmail}
                    onChange={e => {
                      setLoginEmail(e.target.value);
                      if (fieldErrors.loginEmail) {
                        setFieldErrors(prev => ({ ...prev, loginEmail: '' }));
                      }
                    }}
                    className="text-sm w-full"
                  />
                </div>

                {fieldErrors.loginEmail && (
                  <p className="text-[11px] text-[#8B1E1E] font-medium">
                    {fieldErrors.loginEmail}
                  </p>
                )}

                {/* Real-Time University Detection Feedback (Text Only, No Icons) */}
                {universityDetection.status !== 'idle' && (
                  <div
                    id="signin-university-detection-feedback"
                    aria-live="polite"
                    className="pt-0.5"
                  >
                    {universityDetection.status === 'detecting' && (
                      <div className="text-[11px] text-[#4A4942]">
                        Detecting university workspace for{' '}
                        <strong className="font-mono-tabular">
                          @{universityDetection.domain}
                        </strong>
                        ...
                      </div>
                    )}

                    {universityDetection.status === 'detected' && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] text-[11px] flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          University detected:{' '}
                          <strong>{universityDetection.institutionName}</strong>
                        </span>
                        {universityDetection.institutionCode && (
                          <span className="font-mono-tabular font-semibold shrink-0">
                            {universityDetection.institutionCode}
                          </span>
                        )}
                      </div>
                    )}

                    {universityDetection.status === 'unrecognized' && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#78350F] text-[11px]">
                        University domain{' '}
                        <strong className="font-mono-tabular">
                          @{universityDetection.domain}
                        </strong>{' '}
                        was not recognized.
                      </div>
                    )}

                    {universityDetection.status === 'unsupported' && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-[11px]">
                        Personal email domain (
                        <strong className="font-mono-tabular">
                          @{universityDetection.domain}
                        </strong>
                        ) is not supported. Use your university email address.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Password Input + Eye Visibility Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="signin-password-input"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(loginEmail);
                      setRecoveryError(null);
                      setRecoverySuccessMessage(null);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs font-medium text-[#4A4942] hover:text-[#171717] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] rounded px-1 py-0.5 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <div
                  className={`input-group-field h-11 px-3.5 gap-2.5 ${
                    fieldErrors.loginPassword ? 'border-[#DC2626]' : ''
                  }`}
                >
                  <input
                    id="signin-password-input"
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.loginPassword)}
                    aria-describedby={
                      fieldErrors.loginPassword ? 'err-signin-password' : undefined
                    }
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={e => {
                      setLoginPassword(e.target.value);
                      if (fieldErrors.loginPassword) {
                        setFieldErrors(prev => ({ ...prev, loginPassword: '' }));
                      }
                    }}
                    className="text-sm font-mono-tabular w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(prev => !prev)}
                    className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] focus-visible:outline-2 focus-visible:outline-[#171717] cursor-pointer shrink-0 flex items-center justify-center"
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showSignInPassword}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="w-4 h-4 shrink-0" />
                    ) : (
                      <Eye className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                </div>

                {fieldErrors.loginPassword && (
                  <p id="err-signin-password" className="text-[11px] text-[#8B1E1E] font-medium">
                    {fieldErrors.loginPassword}
                  </p>
                )}
              </div>

              {/* Primary Role-Specific Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary h-11 text-sm font-semibold justify-center mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
              >
                {isSubmitting
                  ? 'Signing In...'
                  : activePortal === 'student'
                  ? 'Sign In as Student'
                  : activePortal === 'br'
                  ? 'Sign In as Batch Representative'
                  : activePortal === 'faculty'
                  ? 'Sign In as Faculty'
                  : 'Sign In as Admin'}
              </button>
            </form>
          )}

          {/* Role-Scoped Footer Navigation & Secondary Actions */}
          {!isForgotPasswordOpen && (
            <div className="pt-4 border-t border-[#E4E2DA] space-y-3">
              {activePortal === 'admin' && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[#4A4942]">
                    {adminSubMode === 'signin'
                      ? 'New university institution?'
                      : 'Existing university workspace?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSubMode(
                        adminSubMode === 'signin' ? 'register-university' : 'signin'
                      );
                      clearErrors();
                    }}
                    className="font-semibold text-[#171717] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] rounded px-1 py-0.5 cursor-pointer"
                  >
                    {adminSubMode === 'signin'
                      ? 'Onboard New University'
                      : 'Return to Sign In'}
                  </button>
                </div>
              )}

              {/* Visually Secondary Development/Demo Test Accounts Disclosure */}
              {isDemoModeAvailable && !isMultiColumnForm && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDemoAccounts(prev => !prev)}
                    aria-expanded={showDemoAccounts}
                    className="w-full flex items-center justify-between text-[11px] font-medium text-[#57564F] hover:text-[#171717] py-1.5 px-2 rounded-lg hover:bg-[#F7F6EF] transition-colors cursor-pointer"
                  >
                    <span>Demo Test Accounts</span>
                    <span>{showDemoAccounts ? 'Hide' : 'Show'}</span>
                  </button>

                  {showDemoAccounts && (
                    <div className="mt-2 p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-[#4A4942]">
                          University:
                        </span>
                        <div className="inline-flex rounded-lg bg-white border border-[#E4E2DA] p-0.5">
                          <button
                            type="button"
                            onClick={() => setDemoPresetInstId('inst-western-poly')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              demoPresetInstId === 'inst-western-poly'
                                ? 'bg-[#171717] text-white'
                                : 'text-[#4A4942] hover:text-[#171717]'
                            }`}
                          >
                            Western Poly (WPU)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDemoPresetInstId('inst-apex-tech')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              demoPresetInstId === 'inst-apex-tech'
                                ? 'bg-[#171717] text-white'
                                : 'text-[#4A4942] hover:text-[#171717]'
                            }`}
                          >
                            Apex Tech (AITS)
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#E4E2DA]">
                        <span className="text-[11px] text-[#57564F]">
                          Quick-fill {roleOptions.find(r => r.id === activePortal)?.label}:
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {demoPresetInstId === 'inst-apex-tech' ? (
                            <>
                              {activePortal === 'student' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fillDemoCredential(
                                      'student.alex@apextech.edu',
                                      'Student@2026'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                >
                                  Alex Rivera
                                </button>
                              )}
                              {activePortal === 'br' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential('br.male@apextech.edu', 'BR@2026')
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Male BR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential('br.female@apextech.edu', 'BR@2026')
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Female BR
                                  </button>
                                </>
                              )}
                              {activePortal === 'faculty' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential('m.vance@apextech.edu', 'Faculty@2026')
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Dr. Vance
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential(
                                        'e.rostova@apextech.edu',
                                        'Faculty@2026'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Prof. Rostova
                                  </button>
                                </>
                              )}
                              {activePortal === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fillDemoCredential('admin@apextech.edu', 'Admin@2026')
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                >
                                  Dr. Arthur Vance
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {activePortal === 'student' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fillDemoCredential('m.lin@westernpoly.edu', 'Student@2026')
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                >
                                  Maya Lin
                                </button>
                              )}
                              {activePortal === 'br' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential(
                                        'br.male.2k25bscs@westernpoly.edu',
                                        'BR-2K25CS-M!'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Male BR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential(
                                        'br.female.2k25bscs@westernpoly.edu',
                                        'BR-2K25CS-F!'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Female BR
                                  </button>
                                </>
                              )}
                              {activePortal === 'faculty' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential(
                                        'jehanzeb.ahmad@westernpoly.edu',
                                        'Faculty@2026'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Dr. Jehanzeb
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fillDemoCredential(
                                        'a.turing@westernpoly.edu',
                                        'Faculty@2026'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                  >
                                    Prof. Turing
                                  </button>
                                </>
                              )}
                              {activePortal === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fillDemoCredential(
                                      'k.reynolds@westernpoly.edu',
                                      'Admin@2026'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                                >
                                  Dr. Reynolds
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <div />
    </div>
  );
};
