import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RouteType } from './components/SmartGridNav';
import { PublicLandingPage } from './components/PublicLandingPage';
import { AuthPage } from './components/AuthPage';
import { AuthenticatedLayout } from './components/AuthenticatedLayout';
import { HomeScreen } from './components/HomeScreen';
import { SetupFlow } from './components/SetupFlow';
import { GenerateScreen } from './components/GenerateScreen';
import { TimetableMatrix } from './components/TimetableMatrix';
import { FeedbackScreen } from './components/FeedbackScreen';
import { AcademicConfigurationPage } from './components/AcademicConfigurationPage';
import { SettingsScreen } from './components/SettingsScreen';
import { StudentVotingPage } from './components/StudentVotingPage';
import { StudentDashboardPage } from './components/StudentDashboardPage';
import { BrDashboardPage } from './components/BrDashboardPage';
import { AdminVotingManagementPage } from './components/AdminVotingManagementPage';
import { FacultyDashboardPage } from './components/FacultyDashboardPage';
import { AccountProfilePage } from './components/AccountProfilePage';
import { UniversityOnboardingModal } from './components/UniversityOnboardingModal';
import {
  AuthenticatedVotingUser,
  verifyBackendSession,
  clearStoredUser,
  markSessionActive,
  isCurrentlySignedOut
} from './services/votingApi';
import { institutionalStore } from './data/store';
import { resolveUserCohort } from './utils/userTimetableScope';

const VALID_ROUTES: RouteType[] = [
  'home',
  'setup',
  'generate',
  'timetables',
  'feedback',
  'academic-config',
  'settings',
  'student-dashboard',
  'student-voting',
  'student-preferences',
  'br-dashboard',
  'br-submit',
  'br-submissions',
  'br-results',
  'admin-voting',
  'admin-voting-analytics',
  'admin-br-management',
  'faculty-dashboard',
  'faculty-preferences',
  'account-settings'
];

const STUDENT_ALLOWED_ROUTES: RouteType[] = [
  'student-dashboard',
  'timetables',
  'student-voting',
  'student-preferences',
  'account-settings'
];

const BR_ALLOWED_ROUTES: RouteType[] = [
  'br-dashboard',
  'br-submit',
  'br-submissions',
  'br-results',
  'timetables',
  'account-settings'
];

const FACULTY_ALLOWED_ROUTES: RouteType[] = [
  'faculty-dashboard',
  'faculty-preferences',
  'timetables',
  'account-settings'
];

const ADMIN_ALLOWED_ROUTES: RouteType[] = [
  'home',
  'setup',
  'generate',
  'timetables',
  'feedback',
  'academic-config',
  'settings',
  'admin-voting',
  'admin-voting-analytics',
  'admin-br-management',
  'account-settings'
];

function getNormalizedRole(user: AuthenticatedVotingUser | null): 'student' | 'br' | 'admin' | 'faculty' {
  if (!user) return 'student';
  const r = (user.systemRole || user.role || '').toLowerCase();
  if (r === 'admin' || r === 'registrar') return 'admin';
  if (r === 'br') return 'br';
  if (r === 'faculty') return 'faculty';
  return 'student';
}

function getDefaultDashboardForUser(user: AuthenticatedVotingUser): RouteType {
  const role = getNormalizedRole(user);
  if (role === 'admin') return 'home';
  if (role === 'br') return 'br-dashboard';
  if (role === 'faculty') return 'faculty-dashboard';
  return 'student-dashboard';
}

function enforceRoleRoute(route: RouteType, user: AuthenticatedVotingUser | null): RouteType {
  if (!user) return route;
  const role = getNormalizedRole(user);
  if (role === 'student') {
    return STUDENT_ALLOWED_ROUTES.includes(route) ? route : 'student-dashboard';
  }
  if (role === 'br') {
    return BR_ALLOWED_ROUTES.includes(route) ? route : 'br-dashboard';
  }
  if (role === 'faculty') {
    return FACULTY_ALLOWED_ROUTES.includes(route) ? route : 'faculty-dashboard';
  }
  return ADMIN_ALLOWED_ROUTES.includes(route) ? route : 'home';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedVotingUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('smartgrid_user');
      const parsed: AuthenticatedVotingUser | null = saved ? JSON.parse(saved) : null;
      if (parsed?.institutionId) {
        institutionalStore.switchInstitution(parsed.institutionId);
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [showAuthPage, setShowAuthPage] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [setupStep, setSetupStep] = useState(0);
  const [pendingOnboarding, setPendingOnboarding] = useState<{
    institutionId: string;
    institutionName: string;
    institutionCode: string;
    campusName: string;
  } | null>(null);

  // Normalize route strings
  const normalizeRoute = useCallback((r: string): RouteType => {
    if (r === 'portal' || r === 'solutions') return 'home';
    if (r === 'timetable') return 'timetables';
    if (r === 'generator' || r === 'adaptive-engine') return 'generate';
    if (r === 'student-voice') return 'feedback';
    if (r === 'case-studies') return 'settings';
    return VALID_ROUTES.includes(r as RouteType) ? (r as RouteType) : 'home';
  }, []);

  const [currentRoute, setCurrentRoute] = useState<RouteType>(() => {
    const hash = window.location.hash.replace('#', '');
    const normalized = normalizeRoute(hash);
    try {
      const saved = sessionStorage.getItem('smartgrid_user');
      const parsed: AuthenticatedVotingUser | null = saved ? JSON.parse(saved) : null;
      if (parsed) {
        return enforceRoleRoute(normalized, parsed);
      }
    } catch {
      // ignore
    }
    return normalized;
  });

  const isAuthenticatedRef = useRef<boolean>(Boolean(currentUser));

  const persistUser = useCallback((user: AuthenticatedVotingUser | null) => {
    if (user) {
      isAuthenticatedRef.current = true;
      markSessionActive(user);
      setCurrentUser(user);
    } else {
      isAuthenticatedRef.current = false;
      clearStoredUser();
      setCurrentUser(null);
    }
  }, []);

  // Safe background sync that NEVER resurrects a signed-out session and avoids redundant re-renders
  const handleSyncAuthenticatedUser = useCallback((user: AuthenticatedVotingUser) => {
    if (!isAuthenticatedRef.current || isCurrentlySignedOut()) {
      return;
    }
    try {
      sessionStorage.setItem('smartgrid_user', JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
    setCurrentUser(prev => {
      if (!prev || !isAuthenticatedRef.current || isCurrentlySignedOut()) {
        return null;
      }
      const unchanged =
        prev.id === user.id &&
        prev.email === user.email &&
        prev.name === user.name &&
        prev.role === user.role &&
        prev.systemRole === user.systemRole &&
        prev.batchId === user.batchId &&
        prev.batchCode === user.batchCode &&
        prev.section === user.section &&
        prev.registrationNumber === user.registrationNumber &&
        prev.brGenderRole === user.brGenderRole;
      return unchanged ? prev : user;
    });
  }, []);

  // Synchronize user's batch/cohort with the timetable viewer
  const syncUserCohortInStore = useCallback((user: AuthenticatedVotingUser | null) => {
    if (!user?.batchCode) return;
    const state = institutionalStore.get();
    const matchedGroup = resolveUserCohort(user, state.studentGroups);
    if (matchedGroup) {
      institutionalStore.setSelectedClassGroupId(matchedGroup.id);
    }
  }, []);

  // Verify stored token against trusted backend on initial mount
  useEffect(() => {
    if (!currentUser?.token) return;
    let cancelled = false;
    verifyBackendSession(currentUser.token).then(verifiedUser => {
      if (cancelled || !isAuthenticatedRef.current || isCurrentlySignedOut()) return;
      if (!verifiedUser) {
        // Invalid or deactivated session -> sign out immediately
        persistUser(null);
        setShowAuthPage(false);
        window.location.hash = '';
      } else {
        if (verifiedUser.institutionId) {
          institutionalStore.switchInstitution(verifiedUser.institutionId);
        }
        handleSyncAuthenticatedUser(verifiedUser);
        syncUserCohortInStore(verifiedUser);
        setCurrentRoute(prev => {
          const safeRoute = enforceRoleRoute(prev, verifiedUser);
          if (safeRoute !== prev) {
            window.location.hash = safeRoute;
          }
          return safeRoute;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Enforce role-based route protection on hash change or user role change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const normalized = normalizeRoute(hash);
      if (currentUser) {
        const safeRoute = enforceRoleRoute(normalized, currentUser);
        setCurrentRoute(safeRoute);
        if (safeRoute !== normalized) {
          window.location.hash = safeRoute;
        }
      } else {
        setCurrentRoute(normalized);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser, normalizeRoute]);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setShowAuthPage(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (
    user: AuthenticatedVotingUser,
    options?: {
      launchOnboardingModal?: boolean;
      institutionId?: string;
      institutionName?: string;
      institutionCode?: string;
      campusName?: string;
    }
  ) => {
    if (user.institutionId) {
      institutionalStore.switchInstitution(user.institutionId);
    }
    persistUser(user);
    syncUserCohortInStore(user);
    setShowAuthPage(false);
    if (options?.launchOnboardingModal && options.institutionId) {
      setPendingOnboarding({
        institutionId: options.institutionId,
        institutionName: options.institutionName || user.institution || '',
        institutionCode: options.institutionCode || 'UNIV',
        campusName: options.campusName || 'Main Campus'
      });
    }
    const initialRoute = getDefaultDashboardForUser(user);
    setCurrentRoute(initialRoute);
    window.location.hash = initialRoute;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchUser = (user: AuthenticatedVotingUser) => {
    if (user.institutionId) {
      institutionalStore.switchInstitution(user.institutionId);
    }
    persistUser(user);
    syncUserCohortInStore(user);
    const safeRoute = enforceRoleRoute(currentRoute, user);
    setCurrentRoute(safeRoute);
    window.location.hash = safeRoute;
  };

  const handleSignOut = () => {
    isAuthenticatedRef.current = false;
    clearStoredUser();
    setCurrentUser(null);
    setShowAuthPage(false);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (route: RouteType) => {
    const normalized = normalizeRoute(route);
    const safeRoute = currentUser ? enforceRoleRoute(normalized, currentUser) : normalized;
    setCurrentRoute(safeRoute);
    window.location.hash = safeRoute;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSetupStep = (stepIdx: number) => {
    if (getNormalizedRole(currentUser) !== 'admin') {
      handleNavigate(getDefaultDashboardForUser(currentUser!));
      return;
    }
    setSetupStep(stepIdx);
    handleNavigate('setup');
  };

  // 1. If user is NOT logged in:
  if (!currentUser) {
    if (showAuthPage) {
      return (
        <AuthPage
          initialMode={authMode}
          onLogin={handleLogin}
          onCancel={() => setShowAuthPage(false)}
        />
      );
    }
    return <PublicLandingPage onOpenAuth={handleOpenAuth} />;
  }

  const normalizedRole = getNormalizedRole(currentUser);
  const isAdmin = normalizedRole === 'admin';
  const isBr = normalizedRole === 'br';
  const isStudent = normalizedRole === 'student';
  const isFaculty = normalizedRole === 'faculty';

  // Ensure active route is strictly permitted for current user's verified role
  const effectiveRoute = enforceRoleRoute(currentRoute, currentUser);

  // 2. Authenticated App Workspace with Role-Isolated Dashboards & Navigation
  return (
    <AuthenticatedLayout
      activeRoute={effectiveRoute}
      setupStep={setupStep}
      onNavigate={handleNavigate}
      onOpenSetupStep={handleOpenSetupStep}
      onSignOut={handleSignOut}
      onOpenAuth={handleOpenAuth}
      currentUser={currentUser}
      onSwitchUser={handleSwitchUser}
    >
      {/* =========================================================
          ADMIN-ONLY PAGES (Strictly Blocked for Students & BRs)
         ========================================================= */}
      {isAdmin && effectiveRoute === 'home' && (
        <HomeScreen
          onNavigate={handleNavigate}
          onOpenSetupStep={handleOpenSetupStep}
          currentUser={currentUser}
        />
      )}

      {isAdmin && effectiveRoute === 'setup' && (
        <SetupFlow
          initialStep={setupStep}
          onStepChange={setSetupStep}
          onNavigate={handleNavigate}
          currentUser={currentUser}
        />
      )}

      {isAdmin && effectiveRoute === 'generate' && (
        <GenerateScreen onNavigate={handleNavigate} currentUser={currentUser} />
      )}

      {isAdmin && effectiveRoute === 'feedback' && (
        <FeedbackScreen onNavigate={handleNavigate} />
      )}

      {isAdmin && effectiveRoute === 'academic-config' && (
        <AcademicConfigurationPage
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onSwitchUser={handleSwitchUser}
        />
      )}

      {isAdmin && effectiveRoute === 'settings' && (
        <SettingsScreen
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onSwitchUser={handleSwitchUser}
        />
      )}

      {isAdmin &&
        (effectiveRoute === 'admin-voting' ||
          effectiveRoute === 'admin-voting-analytics' ||
          effectiveRoute === 'admin-br-management') && (
          <AdminVotingManagementPage
            currentUser={currentUser}
            initialSubView={
              effectiveRoute === 'admin-br-management'
                ? 'br-management'
                : effectiveRoute === 'admin-voting-analytics'
                ? 'analytics'
                : 'voting'
            }
            onSwitchUser={handleSwitchUser}
          />
        )}

      {/* =========================================================
          STUDENT-ONLY DASHBOARD, VOTING & PREFERENCES
         ========================================================= */}
      {isStudent &&
        (effectiveRoute === 'student-dashboard' || effectiveRoute === 'student-preferences') && (
          <StudentDashboardPage
            currentUser={currentUser}
            subView={effectiveRoute === 'student-preferences' ? 'preferences' : 'dashboard'}
            onNavigate={handleNavigate}
            onUserSynced={handleSyncAuthenticatedUser}
          />
        )}

      {isStudent && effectiveRoute === 'student-voting' && (
        <StudentVotingPage currentUser={currentUser} onUserSynced={handleSyncAuthenticatedUser} />
      )}

      {/* =========================================================
          BATCH REPRESENTATIVE (BR) DASHBOARD, SUBMIT, SUBMISSIONS & RESULTS
         ========================================================= */}
      {isBr &&
        (effectiveRoute === 'br-dashboard' ||
          effectiveRoute === 'br-submit' ||
          effectiveRoute === 'br-submissions' ||
          effectiveRoute === 'br-results') && (
          <BrDashboardPage
            currentUser={currentUser}
            initialSubView={
              effectiveRoute === 'br-submit'
                ? 'submit'
                : effectiveRoute === 'br-submissions'
                ? 'submissions'
                : effectiveRoute === 'br-results'
                ? 'results'
                : 'dashboard'
            }
            onUserSynced={handleSyncAuthenticatedUser}
          />
        )}

      {/* =========================================================
          FACULTY-ONLY DASHBOARD & AVAILABILITY PREFERENCES
         ========================================================= */}
      {isFaculty &&
        (effectiveRoute === 'faculty-dashboard' || effectiveRoute === 'faculty-preferences') && (
          <FacultyDashboardPage
            currentUser={currentUser}
            subView={effectiveRoute === 'faculty-preferences' ? 'preferences' : 'dashboard'}
            onNavigate={handleNavigate}
            onUserSynced={handleSyncAuthenticatedUser}
          />
        )}

      {/* =========================================================
          SHARED ROLE-SCOPED PAGES: TIMETABLES & ACCOUNT PROFILE
         ========================================================= */}
      {effectiveRoute === 'timetables' && (
        <TimetableMatrix
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          hideNav={true}
        />
      )}

      {effectiveRoute === 'account-settings' && (
        <AccountProfilePage
          currentUser={currentUser}
          onUserUpdated={handleSyncAuthenticatedUser}
          onSignOut={handleSignOut}
        />
      )}

      {pendingOnboarding && isAdmin && (
        <UniversityOnboardingModal
          existingInstitutionId={pendingOnboarding.institutionId}
          initialName={pendingOnboarding.institutionName}
          initialCode={pendingOnboarding.institutionCode}
          initialCampusName={pendingOnboarding.campusName}
          initialRegistrarName={currentUser.name}
          initialRegistrarEmail={currentUser.email}
          onClose={() => setPendingOnboarding(null)}
          onCompleted={newInstId => {
            institutionalStore.switchInstitution(newInstId);
            setPendingOnboarding(null);
          }}
        />
      )}
    </AuthenticatedLayout>
  );
}
