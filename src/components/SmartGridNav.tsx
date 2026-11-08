import React, { useState } from 'react';
import {
  Home,
  Database,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  Sliders,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { SmartGridLogo } from './SmartGridLogo';

export type RouteType =
  | 'home'
  | 'setup'
  | 'generate'
  | 'timetables'
  | 'feedback'
  | 'academic-config'
  | 'settings'
  | 'student-dashboard'
  | 'student-preferences'
  | 'student-voting'
  | 'br-dashboard'
  | 'br-submit'
  | 'br-submissions'
  | 'br-results'
  | 'admin-voting'
  | 'admin-voting-analytics'
  | 'admin-br-management'
  | 'account-settings'
  | 'portal'
  | 'timetable'
  | 'generator'
  | 'adaptive-engine'
  | 'student-voice'
  | 'solutions'
  | 'case-studies';

interface SmartGridNavProps {
  activeRoute: RouteType;
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  currentUser?: { name: string; role: string; email?: string; institution?: string } | null;
  onSignOut?: () => void;
  onSwitchUser?: (user: { name: string; role: string; email: string; institution?: string }) => void;
}

export const SmartGridNav: React.FC<SmartGridNavProps> = ({
  activeRoute,
  onNavigate,
  onOpenAuth,
  currentUser,
  onSignOut,
  onSwitchUser
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [termMenuOpen, setTermMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const storeSnapshot = useInstitutionalData();
  const activeTermObj =
    storeSnapshot.terms.find(t => t.status === 'active') || storeSnapshot.terms[0];
  const activeTerm = activeTermObj?.name || 'Fall 2026';

  const handleSelectTerm = (termName: string) => {
    if (activeTermObj) {
      institutionalStore.updateTerm(activeTermObj.id, { name: termName });
    }
    setTermMenuOpen(false);
  };

  const navItems: {
    id: RouteType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'setup', label: 'Data & Setup', icon: Database },
    { id: 'academic-config', label: 'Academic Configuration', icon: Sliders },
    { id: 'generate', label: 'Generate', icon: Sparkles },
    { id: 'timetables', label: 'Timetables', icon: Calendar },
    { id: 'feedback', label: 'Feedback & Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const isRouteActive = (id: RouteType) => {
    if (id === 'home' && (activeRoute === 'home' || activeRoute === 'portal')) return true;
    if (id === 'timetables' && (activeRoute === 'timetables' || activeRoute === 'timetable'))
      return true;
    if (
      id === 'generate' &&
      (activeRoute === 'generate' ||
        activeRoute === 'generator' ||
        activeRoute === 'adaptive-engine')
    )
      return true;
    if (id === 'feedback' && (activeRoute === 'feedback' || activeRoute === 'student-voice'))
      return true;
    return activeRoute === id;
  };

  const presetPersonas = [
    {
      name: 'Dr. Katherine Reynolds',
      role: 'Registrar',
      email: 'k.reynolds@westernpoly.edu',
      institution: 'Western Polytechnic'
    },
    {
      name: 'Prof. Alan Turing',
      role: 'Faculty',
      email: 'a.turing@westernpoly.edu',
      institution: 'Western Polytechnic'
    },
    {
      name: 'Maya Lin (CS Y1)',
      role: 'Student',
      email: 'm.lin@westernpoly.edu',
      institution: 'Western Polytechnic'
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F7F6EF]/95 backdrop-blur-md border-b border-[#E4E2DA]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity + Term Selector */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
          >
            <SmartGridLogo variant="primary" theme="light" size="sm" />
          </button>

          {currentUser && (
            <div className="relative hidden xl:block pl-3 border-l border-[#E4E2DA]">
              <button
                onClick={() => setTermMenuOpen(!termMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EDEAE0] hover:bg-[#E4E2DA] text-xs font-medium text-[#171717] transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#B7F77C] border border-[#171717]/20"></span>
                <span>{activeTerm}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#77766F]" />
              </button>

              {termMenuOpen && (
                <div className="absolute left-3 mt-1.5 w-48 bg-white border border-[#E4E2DA] rounded-xl shadow-lg py-1 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Active Academic Term
                  </div>
                  {['Fall 2026', 'Spring 2027', 'Summer Intensive 2027'].map(term => (
                    <button
                      key={term}
                      onClick={() => handleSelectTerm(term)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F7F6EF] cursor-pointer ${
                        activeTerm === term ? 'font-semibold text-[#171717]' : 'text-[#77766F]'
                      }`}
                    >
                      <span>{term}</span>
                      {activeTerm === term && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#171717]"></span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Primary Navigation Links */}
        {currentUser && (
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isRouteActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717] hover:bg-[#EDEAE0]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: User Persona Switcher & Account Controls */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <>
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E4E2DA] bg-white hover:bg-[#EDEAE0] transition-colors cursor-pointer text-left"
                  title="Switch active user role (Registrar, Faculty, or Student)"
                >
                  <div className="w-6 h-6 rounded-full bg-[#F2D8FA] text-[#171717] font-semibold text-xs flex items-center justify-center shrink-0">
                    {currentUser.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-semibold text-[#171717] leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-[#77766F] leading-tight flex items-center gap-1">
                      <span>{currentUser.role}</span>
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#77766F]" />
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E4E2DA] rounded-xl shadow-lg py-1.5 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#77766F] border-b border-[#E4E2DA]">
                      Switch Active Persona
                    </div>
                    {presetPersonas.map(persona => (
                      <button
                        key={persona.email}
                        onClick={() => {
                          onSwitchUser?.(persona);
                          setRoleMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#F7F6EF] flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#171717]">{persona.name}</div>
                          <div className="text-[11px] text-[#77766F]">{persona.role}</div>
                        </div>
                        {currentUser.role === persona.role && (
                          <UserCheck className="w-3.5 h-3.5 text-[#171717]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="p-2 rounded-xl text-[#77766F] hover:text-[#171717] hover:bg-[#EDEAE0] transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-[#171717] hover:bg-[#EDEAE0] cursor-pointer"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onOpenAuth?.('signin')}
                className="px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#EDEAE0] rounded-xl transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth?.('signup')}
                className="btn-primary text-xs py-2 px-4"
              >
                Open Workspace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {currentUser && mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E4E2DA] bg-[#F7F6EF] px-4 py-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isRouteActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate?.(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active ? 'bg-[#171717] text-white' : 'text-[#77766F] hover:bg-[#EDEAE0]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
