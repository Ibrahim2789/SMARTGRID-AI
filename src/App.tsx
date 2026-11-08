import React, { useState, useEffect } from 'react';
import { RouteType } from './components/SmartGridNav';
import { PublicLandingPage } from './components/PublicLandingPage';
import { AuthPage } from './components/AuthPage';
import { AuthenticatedLayout } from './components/AuthenticatedLayout';
import { HomeScreen } from './components/HomeScreen';
import { SetupFlow } from './components/SetupFlow';
import { GenerateScreen } from './components/GenerateScreen';
import { TimetableMatrix } from './components/TimetableMatrix';
import { FeedbackScreen } from './components/FeedbackScreen';
import { SettingsScreen } from './components/SettingsScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ 
    name: string; 
    role: string; 
    email: string; 
    institution?: string 
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('smartgrid_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showAuthPage, setShowAuthPage] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [setupStep, setSetupStep] = useState(0);

  // Normalize route strings
  const normalizeRoute = (r: string): RouteType => {
    if (r === 'portal' || r === 'solutions') return 'home';
    if (r === 'timetable') return 'timetables';
    if (r === 'generator' || r === 'adaptive-engine') return 'generate';
    if (r === 'student-voice') return 'feedback';
    if (r === 'case-studies') return 'settings';
    const valid: RouteType[] = ['home', 'setup', 'generate', 'timetables', 'feedback', 'settings'];
    return valid.includes(r as RouteType) ? (r as RouteType) : 'home';
  };

  const [currentRoute, setCurrentRoute] = useState<RouteType>(() => {
    const hash = window.location.hash.replace('#', '');
    return normalizeRoute(hash);
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentRoute(normalizeRoute(hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setShowAuthPage(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (user: { name: string; role: string; email: string; institution?: string }) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('smartgrid_user', JSON.stringify(user));
    } catch {}
    setShowAuthPage(false);
    setCurrentRoute('home');
    window.location.hash = 'home';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('smartgrid_user');
    } catch {}
    setShowAuthPage(false);
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (route: RouteType) => {
    const normalized = normalizeRoute(route);
    setCurrentRoute(normalized);
    window.location.hash = normalized;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSetupStep = (stepIdx: number) => {
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
    return (
      <PublicLandingPage 
        onOpenAuth={handleOpenAuth}
      />
    );
  }

  // 2. Authenticated App Workspace
  return (
    <AuthenticatedLayout
      activeRoute={currentRoute}
      setupStep={setupStep}
      onNavigate={handleNavigate}
      onOpenSetupStep={handleOpenSetupStep}
      onSignOut={handleSignOut}
      onOpenAuth={handleOpenAuth}
      currentUser={currentUser}
      onSwitchUser={setCurrentUser}
    >
      {currentRoute === 'home' && (
        <HomeScreen 
          onNavigate={handleNavigate}
          onOpenSetupStep={handleOpenSetupStep}
          currentUser={currentUser}
        />
      )}

      {currentRoute === 'setup' && (
        <SetupFlow 
          initialStep={setupStep}
          onStepChange={setSetupStep}
          onNavigate={handleNavigate}
        />
      )}

      {currentRoute === 'generate' && (
        <GenerateScreen 
          onNavigate={handleNavigate}
        />
      )}

      {currentRoute === 'timetables' && (
        <TimetableMatrix 
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          hideNav={true}
        />
      )}

      {currentRoute === 'feedback' && (
        <FeedbackScreen 
          onNavigate={handleNavigate}
        />
      )}

      {currentRoute === 'settings' && (
        <SettingsScreen 
          onNavigate={handleNavigate}
        />
      )}
    </AuthenticatedLayout>
  );
}
