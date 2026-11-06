/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RouteType } from './components/SmartGridNav';
import { PublicLandingPage } from './components/PublicLandingPage';
import { AuthPage } from './components/AuthPage';
import { TimetableMatrix } from './components/TimetableMatrix';
import { GeneratorStudio } from './components/GeneratorStudio';
import { AdaptiveEngine } from './components/AdaptiveEngine';
import { StudentVoice } from './components/StudentVoice';
import { CaseStudies } from './components/CaseStudies';
import { InstitutionalPortal } from './components/InstitutionalPortal';
import { AuthenticatedLayout } from './components/AuthenticatedLayout';

export default function App() {
  // App opens in unauthenticated state by default
  const [currentUser, setCurrentUser] = useState<{ 
    name: string; 
    role: string; 
    email: string; 
    institution?: string 
  } | null>(null);

  // Auth screen toggle
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Authenticated workspace route
  const [currentRoute, setCurrentRoute] = useState<RouteType>('portal');

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setShowAuthPage(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (user: { name: string; role: string; email: string; institution?: string }) => {
    setCurrentUser(user);
    setShowAuthPage(false);
    setCurrentRoute('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setShowAuthPage(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (route: RouteType) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // Single Page Application for before-login screen
    return (
      <PublicLandingPage 
        onOpenAuth={handleOpenAuth}
      />
    );
  }

  // 2. If user IS logged in: Render full workspace with left-side menu & hamburger toggle
  return (
    <AuthenticatedLayout
      activeRoute={currentRoute}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
      onOpenAuth={handleOpenAuth}
      currentUser={currentUser}
      onSwitchUser={setCurrentUser}
    >
      {currentRoute === 'portal' && (
        <InstitutionalPortal 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          onSwitchUser={setCurrentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'timetable' && (
        <TimetableMatrix 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'generator' && (
        <GeneratorStudio 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'adaptive-engine' && (
        <AdaptiveEngine 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'student-voice' && (
        <StudentVoice 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'case-studies' && (
        <CaseStudies 
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
          currentUser={currentUser}
          hideNav={true}
        />
      )}

      {currentRoute === 'solutions' && (
        <PublicLandingPage 
          onOpenAuth={handleOpenAuth}
        />
      )}
    </AuthenticatedLayout>
  );
}
