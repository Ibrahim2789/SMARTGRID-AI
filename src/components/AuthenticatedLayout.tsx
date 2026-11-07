import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import {
  Home,
  Calendar,
  Sparkles,
  BookOpen,
  Sliders,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Users,
  Building2,
  DoorOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { useInstitutionalData, institutionalStore } from '../data/store';

interface AuthenticatedLayoutProps {
  activeRoute: RouteType;
  setupStep?: number;
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIdx: number) => void;
  onSignOut: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  currentUser: { name: string; role: string; email: string; institution?: string };
  onSwitchUser?: (user: { name: string; role: string; email: string; institution?: string }) => void;
  children: React.ReactNode;
}

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  activeRoute,
  setupStep = 0,
  onNavigate,
  onOpenSetupStep,
  onSignOut,
  currentUser,
  onSwitchUser,
  children
}) => {
  const storeSnapshot = useInstitutionalData();
  const [secondaryOpen, setSecondaryOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    resources: true,
    preferences: true,
    recent: true
  });
  const [termDropdownOpen, setTermDropdownOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeTermObj = storeSnapshot.terms.find(t => t.status === 'active') || storeSnapshot.terms[0];
  const activeTerm = activeTermObj?.name || 'Fall 2026';
  const institutionName = storeSnapshot.institutionProfile?.name || currentUser.institution || 'Western Polytechnic';

  const handleSelectTerm = (termName: string) => {
    if (activeTermObj) {
      institutionalStore.updateTerm(activeTermObj.id, { name: termName });
    }
    setTermDropdownOpen(false);
  };

  const scheduledCount = storeSnapshot.sections.filter(s => Boolean(s.assignedSlot)).length;

  const primaryIcons = [
    {
      id: 'home' as RouteType,
      label: 'Dashboard',
      icon: Home,
      isActive: activeRoute === 'home',
      onClick: () => onNavigate('home')
    },
    {
      id: 'timetables' as RouteType,
      label: 'My Timetable',
      icon: Calendar,
      isActive: activeRoute === 'timetables',
      onClick: () => onNavigate('timetables')
    },
    {
      id: 'generate' as RouteType,
      label: 'Generate Schedule',
      icon: Sparkles,
      isActive: activeRoute === 'generate',
      onClick: () => onNavigate('generate')
    },
    {
      id: 'setup-courses' as RouteType,
      label: 'Courses & Resources',
      icon: BookOpen,
      isActive: activeRoute === 'setup' && setupStep !== 6,
      onClick: () => (onOpenSetupStep ? onOpenSetupStep(2) : onNavigate('setup'))
    },
    {
      id: 'setup-prefs' as RouteType,
      label: 'My Preferences',
      icon: Sliders,
      isActive: activeRoute === 'setup' && setupStep === 6,
      onClick: () => (onOpenSetupStep ? onOpenSetupStep(6) : onNavigate('setup'))
    },
    {
      id: 'feedback' as RouteType,
      label: 'Schedule Insights',
      icon: BarChart3,
      isActive: activeRoute === 'feedback',
      onClick: () => onNavigate('feedback')
    }
  ];

  const mainNavLinks = [
    {
      id: 'home',
      label: 'Dashboard',
      icon: Home,
      isActive: activeRoute === 'home',
      onClick: () => {
        onNavigate('home');
        setMobileDrawerOpen(false);
      }
    },
    {
      id: 'timetables',
      label: 'My Timetable',
      icon: Calendar,
      badge: `${scheduledCount} scheduled`,
      isActive: activeRoute === 'timetables',
      onClick: () => {
        onNavigate('timetables');
        setMobileDrawerOpen(false);
      }
    },
    {
      id: 'generate',
      label: 'Generate Schedule',
      icon: Sparkles,
      isActive: activeRoute === 'generate',
      onClick: () => {
        onNavigate('generate');
        setMobileDrawerOpen(false);
      }
    },
    {
      id: 'preferences',
      label: 'My Preferences',
      icon: Sliders,
      isActive: activeRoute === 'setup' && (setupStep === 6 || setupStep === 3),
      onClick: () => {
        if (onOpenSetupStep) onOpenSetupStep(6);
        else onNavigate('setup');
        setMobileDrawerOpen(false);
      }
    },
    {
      id: 'courses',
      label: 'Courses & Resources',
      icon: BookOpen,
      isActive: activeRoute === 'setup' && setupStep !== 6 && setupStep !== 3,
      onClick: () => {
        if (onOpenSetupStep) onOpenSetupStep(2);
        else onNavigate('setup');
        setMobileDrawerOpen(false);
      }
    },
    {
      id: 'feedback',
      label: 'Schedule Insights',
      icon: BarChart3,
      isActive: activeRoute === 'feedback',
      onClick: () => {
        onNavigate('feedback');
        setMobileDrawerOpen(false);
      }
    }
  ];

  const resourceSubItems = [
    { label: 'Course Catalog', count: storeSnapshot.courses.length, step: 2, icon: BookOpen },
    { label: 'Class Sections', count: storeSnapshot.sections.length, step: 5, icon: Clock },
    { label: 'Campus Rooms & Labs', count: storeSnapshot.rooms.length, step: 1, icon: DoorOpen },
    { label: 'Student Cohorts', count: storeSnapshot.studentGroups.length, step: 4, icon: GraduationCap },
    { label: 'Departments', count: storeSnapshot.departments.length, step: 0, icon: Building2 }
  ];

  const preferenceSubItems = [
    { label: 'Timing & Break Rules', step: 6, icon: Sliders },
    { label: 'Faculty Availability', step: 3, icon: Users }
  ];

  const pastelDots = ['#B8EEEE', '#F2D8FA', '#B8F2E6', '#B7F77C', '#E8D36B'];

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
    <div className="min-h-screen flex bg-[#F7F6EF] text-[#171717]">
      {/* =========================================================
          1. FIRST SIDEBAR: ~72px Near-Black Icon Rail (#171717)
         ========================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-[72px] bg-[#171717] text-white py-4 shrink-0 select-none z-30 border-r border-[#242424]"
        aria-label="Primary icon navigation"
      >
        <div className="flex flex-col items-center gap-5 w-full">
          <button
            onClick={() => onNavigate('home')}
            title="SmartGrid Workspace"
            className="w-10 h-10 rounded-xl bg-[#FFFFFF] text-[#171717] flex items-center justify-center font-serif-editorial text-xl tracking-tight cursor-pointer hover:scale-105 transition-transform"
          >
            S
          </button>

          <div className="w-7 h-[1px] bg-[#2E2E2E]" />

          <nav className="flex flex-col items-center gap-2 w-full px-2">
            {primaryIcons.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  title={item.label}
                  className={`relative group w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    item.isActive
                      ? 'bg-[#2E2E2E] text-white'
                      : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
                  }`}
                >
                  {item.isActive && (
                    <span
                      className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#B8EEEE]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="w-[19px] h-[19px]" />
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          <button
            onClick={() => setSecondaryOpen(prev => !prev)}
            title={secondaryOpen ? 'Collapse workspace sidebar' : 'Expand workspace sidebar'}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#9E9D96] hover:text-white hover:bg-[#242424] transition-colors cursor-pointer"
          >
            {secondaryOpen ? (
              <PanelLeftClose className="w-[18px] h-[18px]" />
            ) : (
              <PanelLeftOpen className="w-[18px] h-[18px]" />
            )}
          </button>

          <button
            onClick={() => onNavigate('settings')}
            title="Workspace Settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeRoute === 'settings'
                ? 'bg-[#2E2E2E] text-white'
                : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
            }`}
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => setRoleSwitcherOpen(prev => !prev)}
            title={`${currentUser.name} (${currentUser.role})`}
            className="w-9 h-9 rounded-full bg-[#F2D8FA] text-[#171717] font-semibold text-xs flex items-center justify-center cursor-pointer border border-white/20 hover:opacity-90 transition-opacity"
          >
            {currentUser.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)}
          </button>
        </div>
      </aside>

      {/* =========================================================
          2. SECOND SIDEBAR: ~256px Charcoal Workspace Drawer (#292929)
         ========================================================= */}
      {secondaryOpen && (
        <aside
          className="hidden md:flex flex-col w-[256px] bg-[#292929] text-[#EAE8E1] shrink-0 select-none border-r border-[#1F1F1F] z-20"
          aria-label="Academic workspace navigation"
        >
          {/* Academic Context Selector */}
          <div className="p-3.5 border-b border-[#363636] relative">
            <button
              onClick={() => setTermDropdownOpen(prev => !prev)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#333333] hover:bg-[#3A3A3A] transition-colors text-left cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#A6A49D] truncate">
                  {institutionName}
                </div>
                <div className="text-[13.5px] font-semibold text-white flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#B7F77C]" />
                  <span className="truncate">{activeTerm}</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#A6A49D] shrink-0" />
            </button>

            {termDropdownOpen && (
              <div className="absolute left-3.5 right-3.5 top-[72px] bg-[#1F1F1F] border border-[#3E3E3E] rounded-xl p-1.5 shadow-xl z-40">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                  Switch Academic Term
                </div>
                {['Fall 2026', 'Spring 2027', 'Summer Intensive 2027'].map(term => (
                  <button
                    key={term}
                    onClick={() => handleSelectTerm(term)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      activeTerm === term
                        ? 'bg-[#383838] text-white'
                        : 'text-[#C2C0B8] hover:bg-[#2C2C2C] hover:text-white'
                    }`}
                  >
                    <span>{term}</span>
                    {activeTerm === term && <CheckCircle2 className="w-3.5 h-3.5 text-[#B7F77C]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Navigation Sections */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {/* Primary Workspace Views */}
            <div>
              <div className="px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8C84]">
                Workspace
              </div>
              <div className="space-y-0.5">
                {mainNavLinks.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer ${
                        item.isActive
                          ? 'bg-[#383838] text-white font-medium'
                          : 'text-[#C2C0B8] hover:bg-[#323232] hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0 text-[#A6A49D]" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="text-[10.5px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#1F1F1F] text-[#B8EEEE]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expandable Section: Academic Resources */}
            <div>
              <button
                onClick={() => toggleSection('resources')}
                className="w-full flex items-center justify-between px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8C84] hover:text-[#EAE8E1] cursor-pointer"
              >
                <span>Academic Resources</span>
                {expandedSections.resources ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {expandedSections.resources && (
                <div className="space-y-0.5">
                  {resourceSubItems.map(sub => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeRoute === 'setup' && setupStep === sub.step;
                    return (
                      <button
                        key={sub.label}
                        onClick={() => {
                          if (onOpenSetupStep) onOpenSetupStep(sub.step);
                          else onNavigate('setup');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors cursor-pointer ${
                          isSubActive
                            ? 'bg-[#383838] text-white font-medium'
                            : 'text-[#B5B3AB] hover:bg-[#323232] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <SubIcon className="w-3.5 h-3.5 text-[#8E8C84]" />
                          <span className="truncate">{sub.label}</span>
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[#8E8C84]">
                          {sub.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expandable Section: Preferences & Constraints */}
            <div>
              <button
                onClick={() => toggleSection('preferences')}
                className="w-full flex items-center justify-between px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8C84] hover:text-[#EAE8E1] cursor-pointer"
              >
                <span>Personal Preferences</span>
                {expandedSections.preferences ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {expandedSections.preferences && (
                <div className="space-y-0.5">
                  {preferenceSubItems.map(sub => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeRoute === 'setup' && setupStep === sub.step;
                    return (
                      <button
                        key={sub.label}
                        onClick={() => {
                          if (onOpenSetupStep) onOpenSetupStep(sub.step);
                          else onNavigate('setup');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors cursor-pointer ${
                          isSubActive
                            ? 'bg-[#383838] text-white font-medium'
                            : 'text-[#B5B3AB] hover:bg-[#323232] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <SubIcon className="w-3.5 h-3.5 text-[#8E8C84]" />
                          <span className="truncate">{sub.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expandable Section: Recently Accessed Courses */}
            <div>
              <button
                onClick={() => toggleSection('recent')}
                className="w-full flex items-center justify-between px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8C84] hover:text-[#EAE8E1] cursor-pointer"
              >
                <span>Recently Accessed</span>
                {expandedSections.recent ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {expandedSections.recent && (
                <div className="space-y-0.5">
                  {storeSnapshot.courses.slice(0, 5).map((course, idx) => (
                    <button
                      key={course.id}
                      onClick={() => onNavigate('timetables')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] text-[#B5B3AB] hover:bg-[#323232] hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: pastelDots[idx % pastelDots.length] }}
                        />
                        <span className="font-mono-tabular text-[11.5px] text-[#EAE8E1] shrink-0">
                          {course.code}
                        </span>
                        <span className="truncate text-[#9E9D96]">{course.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Utilities Footer */}
          <div className="p-3 border-t border-[#363636] bg-[#242424] relative">
            {roleSwitcherOpen && onSwitchUser && (
              <div className="absolute bottom-[68px] left-3 right-3 bg-[#1A1A1A] border border-[#3E3E3E] rounded-xl p-2 shadow-xl z-40 space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                  Switch Active Persona
                </div>
                {presetPersonas.map(persona => (
                  <button
                    key={persona.email}
                    onClick={() => {
                      onSwitchUser(persona);
                      setRoleSwitcherOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      currentUser.email === persona.email
                        ? 'bg-[#383838] text-white font-medium'
                        : 'text-[#C2C0B8] hover:bg-[#2C2C2C]'
                    }`}
                  >
                    <div className="text-left truncate">
                      <div className="truncate">{persona.name}</div>
                      <div className="text-[10px] text-[#8E8C84]">{persona.role}</div>
                    </div>
                    {currentUser.email === persona.email && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#B8EEEE] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setRoleSwitcherOpen(prev => !prev)}
                className="flex items-center gap-2.5 min-w-0 text-left hover:bg-[#323232] p-1.5 rounded-lg transition-colors flex-1 cursor-pointer"
                title="Click to switch persona"
              >
                <div className="w-8 h-8 rounded-full bg-[#B8EEEE] text-[#171717] font-semibold text-xs flex items-center justify-center shrink-0">
                  {currentUser.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-[#9E9D96] flex items-center gap-1 truncate">
                    <UserCheck className="w-3 h-3 text-[#B7F77C]" />
                    <span>{currentUser.role}</span>
                  </div>
                </div>
              </button>

              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-2 rounded-lg text-[#9E9D96] hover:text-white hover:bg-[#323232] transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* =========================================================
          3. CENTRAL CONTENT AREA + MOBILE BAR
         ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#F7F6EF]">
        <header className="md:hidden sticky top-0 z-30 h-14 px-4 bg-[#171717] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 rounded-lg text-[#C2C0B8] hover:text-white cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-serif-editorial text-lg text-white">SmartGrid</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#292929] text-[#B8EEEE]">
              {activeTerm}
            </span>
          </div>
          <button
            onClick={() => onNavigate('generate')}
            className="px-3 py-1.5 rounded-lg bg-[#B8EEEE] text-[#171717] text-xs font-semibold cursor-pointer"
          >
            Generate
          </button>
        </header>

        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] bg-[#292929] text-white h-full flex flex-col justify-between p-4 z-10 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#383838]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white text-[#171717] flex items-center justify-center font-serif-editorial text-base">
                      S
                    </div>
                    <div>
                      <div className="font-semibold text-sm">SmartGrid Workspace</div>
                      <div className="text-[11px] text-[#A6A49D]">{activeTerm}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1 text-[#A6A49D] hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {mainNavLinks.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer ${
                          item.isActive
                            ? 'bg-[#383838] text-white font-medium'
                            : 'text-[#C2C0B8] hover:bg-[#323232]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-[#A6A49D]" />
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-[#383838] flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium text-white">{currentUser.name}</div>
                  <div className="text-[#9E9D96]">{currentUser.role}</div>
                </div>
                <button
                  onClick={onSignOut}
                  className="px-2.5 py-1.5 rounded-lg bg-[#383838] text-xs text-white cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-[1480px] mx-auto px-5 sm:px-8 py-7">
          {children}
        </main>
      </div>
    </div>
  );
};
