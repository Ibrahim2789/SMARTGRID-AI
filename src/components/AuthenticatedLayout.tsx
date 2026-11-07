import React, { useState, useEffect, useRef } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Users,
  DoorOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  UserCheck,
  Bell,
  HelpCircle,
  Info,
  Activity,
  History,
  ShieldCheck,
  RotateCcw
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

type UtilityPanelType = 'notifications' | 'help' | 'info' | 'profile' | null;
type InsightSubView = 'analytics' | 'optimization' | 'history';

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
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const [secondaryOpen, setSecondaryOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smartgrid_sidebar_collapsed');
      if (saved !== null) {
        return saved !== 'true';
      }
      // Collapse secondary sidebar by default on narrower tablet viewports (< 1024px)
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setSecondaryOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smartgrid_sidebar_collapsed', String(!next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [termDropdownOpen, setTermDropdownOpen] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanelType>(null);
  const [activeInsightSubView, setActiveInsightSubView] = useState<InsightSubView>('analytics');

  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Solver Schedule Verified',
      detail: 'All 50m lectures & 3h continuous labs respect the 1:00–2:00 PM lunch break.',
      time: 'Just now',
      unread: true
    },
    {
      id: 'n2',
      title: 'Google Sheets Export Ready',
      detail: 'Multi-worksheet .xlsx export includes Weekly Overview + per-course tabs.',
      time: '12m ago',
      unread: true
    },
    {
      id: 'n3',
      title: 'Room Capacity Validated',
      detail: 'Zero lab or lecture hall capacity overflows across active cohorts.',
      time: '1h ago',
      unread: false
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  // Scroll the independent main workspace container to top when route changes
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeRoute, setupStep]);

  const activeTermObj =
    storeSnapshot.terms.find(t => t.status === 'active') || storeSnapshot.terms[0];
  const activeTerm = activeTermObj?.name || 'Fall 2026';
  const institutionName =
    storeSnapshot.institutionProfile?.name || currentUser.institution || 'Western Polytechnic';

  const handleSelectTerm = (termName: string) => {
    if (activeTermObj) {
      institutionalStore.updateTerm(activeTermObj.id, { name: termName });
    }
    setTermDropdownOpen(false);
  };

  const scheduledCount = storeSnapshot.sections.filter(s => Boolean(s.assignedSlot)).length;
  const totalSections = storeSnapshot.sections.length;

  const openSetup = (stepIdx: number) => {
    setActiveUtilityPanel(null);
    if (onOpenSetupStep) {
      onOpenSetupStep(stepIdx);
    } else {
      onNavigate('setup');
    }
    setMobileDrawerOpen(false);
  };

  const openInsightSection = (subView: InsightSubView, elementId: string) => {
    setActiveUtilityPanel(null);
    setActiveInsightSubView(subView);
    onNavigate('feedback');
    setMobileDrawerOpen(false);
    setTimeout(() => {
      const targetEl = document.getElementById(elementId);
      if (targetEl && mainScrollRef.current) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  // =========================================================
  // RIGHT COLUMN (256px) — ALL PRIMARY APPLICATION NAVIGATION
  // Organized into 4 sections, sized to fit 100vh without scrolling
  // =========================================================
  const navigationGroups: Array<{
    heading: string;
    items: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string;
      badgeHighlight?: boolean;
      isActive: boolean;
      onClick: () => void;
    }>;
  }> = [
    {
      heading: 'WORKSPACE',
      items: [
        {
          id: 'nav-dashboard',
          label: 'Dashboard',
          icon: Home,
          isActive: activeRoute === 'home',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('home');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-timetable',
          label: 'My Timetable',
          icon: Calendar,
          badge: `${scheduledCount}/${totalSections}`,
          badgeHighlight: true,
          isActive: activeRoute === 'timetables',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('timetables');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-generate',
          label: 'Generate Schedule',
          icon: Sparkles,
          isActive: activeRoute === 'generate',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('generate');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-preferences',
          label: 'My Preferences',
          icon: Sliders,
          isActive: activeRoute === 'setup' && setupStep === 6,
          onClick: () => openSetup(6)
        }
      ]
    },
    {
      heading: 'ACADEMIC MANAGEMENT',
      items: [
        {
          id: 'nav-courses',
          label: 'Courses',
          icon: BookOpen,
          badge: String(storeSnapshot.courses.length),
          isActive: activeRoute === 'setup' && setupStep === 2,
          onClick: () => openSetup(2)
        },
        {
          id: 'nav-instructors',
          label: 'Instructors',
          icon: Users,
          badge: String(storeSnapshot.instructors.length),
          isActive: activeRoute === 'setup' && setupStep === 3,
          onClick: () => openSetup(3)
        },
        {
          id: 'nav-rooms',
          label: 'Rooms and Laboratories',
          icon: DoorOpen,
          badge: String(storeSnapshot.rooms.length),
          isActive: activeRoute === 'setup' && setupStep === 1,
          onClick: () => openSetup(1)
        },
        {
          id: 'nav-sections',
          label: 'Class Sections & Labs',
          icon: Clock,
          badge: String(storeSnapshot.sections.length),
          isActive: activeRoute === 'setup' && setupStep === 5,
          onClick: () => openSetup(5)
        }
      ]
    },
    {
      heading: 'INSIGHTS',
      items: [
        {
          id: 'nav-analytics',
          label: 'Schedule Analytics',
          icon: BarChart3,
          isActive: activeRoute === 'feedback' && activeInsightSubView === 'analytics',
          onClick: () => openInsightSection('analytics', 'insights-analytics')
        },
        {
          id: 'nav-optimization',
          label: 'Optimization Results',
          icon: Activity,
          badge: '96.4%',
          isActive: activeRoute === 'feedback' && activeInsightSubView === 'optimization',
          onClick: () => openInsightSection('optimization', 'insights-optimization')
        },
        {
          id: 'nav-history',
          label: 'Schedule History',
          icon: History,
          badge: String(storeSnapshot.scenarios.length),
          isActive: activeRoute === 'feedback' && activeInsightSubView === 'history',
          onClick: () => openInsightSection('history', 'insights-history')
        }
      ]
    },
    {
      heading: 'ADDITIONAL',
      items: [
        {
          id: 'nav-cohorts',
          label: 'Cohorts & Departments',
          icon: GraduationCap,
          badge: String(storeSnapshot.studentGroups.length),
          isActive: activeRoute === 'setup' && (setupStep === 4 || setupStep === 0),
          onClick: () => openSetup(4)
        },
        {
          id: 'nav-settings',
          label: 'Workspace Settings',
          icon: Settings,
          isActive: activeRoute === 'settings',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('settings');
            setMobileDrawerOpen(false);
          }
        }
      ]
    }
  ];

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

  const toggleUtilityPanel = (panel: Exclude<UtilityPanelType, null>) => {
    setActiveUtilityPanel(prev => (prev === panel ? null : panel));
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-[#F7F6EF] text-[#171717]">
      {/* =========================================================
          1. LEFT COLUMN (~72px, Fixed 100vh):
             Reserved EXCLUSIVELY for Personal Utilities & Account
         ========================================================= */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden md:flex flex-col items-center justify-between w-[72px] h-screen bg-[#171717] text-white py-3.5 shrink-0 select-none border-r border-[#242424]"
        aria-label="Personal utilities and account controls"
      >
        {/* Top: Brand Monogram + Sidebar Collapse/Expand Toggle */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <div
            title={`${institutionName} · SmartGrid AI`}
            className="w-10 h-10 rounded-xl bg-[#FFFFFF] text-[#171717] flex items-center justify-center font-serif-editorial text-xl tracking-tight select-none"
          >
            S
          </div>

          <button
            onClick={handleToggleSidebar}
            title={secondaryOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
            aria-label={secondaryOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              !secondaryOpen
                ? 'bg-[#2E2E2E] text-[#B8EEEE] hover:bg-[#383838]'
                : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
            }`}
          >
            {secondaryOpen ? (
              <PanelLeftClose className="w-[18px] h-[18px]" />
            ) : (
              <PanelLeftOpen className="w-[18px] h-[18px]" />
            )}
          </button>

          <div className="w-7 h-[1px] bg-[#2E2E2E]" />

          {/* Global Utilities: Notifications, Help & Support, Application Info */}
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={() => toggleUtilityPanel('notifications')}
              title="Notifications & Solver Alerts"
              aria-label="Notifications"
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                activeUtilityPanel === 'notifications'
                  ? 'bg-[#2E2E2E] text-white'
                  : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
              }`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B7F77C]" />
              )}
            </button>

            <button
              onClick={() => toggleUtilityPanel('help')}
              title="Help & University Scheduling Guide"
              aria-label="Help and support"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                activeUtilityPanel === 'help'
                  ? 'bg-[#2E2E2E] text-white'
                  : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
              }`}
            >
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={() => toggleUtilityPanel('info')}
              title="Application Information & Solver Status"
              aria-label="Application information"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                activeUtilityPanel === 'info'
                  ? 'bg-[#2E2E2E] text-white'
                  : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
              }`}
            >
              <Info className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Bottom: Account Settings, User Profile/Avatar, Sign Out */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          <div className="w-7 h-[1px] bg-[#2E2E2E]" />

          <button
            onClick={() => {
              setActiveUtilityPanel(null);
              onNavigate('settings');
            }}
            title="Account & Workspace Settings"
            aria-label="Account settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeRoute === 'settings'
                ? 'bg-[#2E2E2E] text-white'
                : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
            }`}
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => toggleUtilityPanel('profile')}
            title={`Account Profile: ${currentUser.name} (${currentUser.role})`}
            aria-label="User profile and persona switcher"
            className={`w-9 h-9 rounded-full bg-[#F2D8FA] text-[#171717] font-semibold text-xs flex items-center justify-center cursor-pointer border transition-all ${
              activeUtilityPanel === 'profile'
                ? 'border-[#B8EEEE] ring-2 ring-[#B8EEEE]/40'
                : 'border-white/20 hover:opacity-90'
            }`}
          >
            {currentUser.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)}
          </button>

          <button
            onClick={onSignOut}
            title="Sign Out"
            aria-label="Sign out"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#9E9D96] hover:text-white hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <LogOut className="w-[16px] h-[16px]" />
          </button>
        </div>
      </aside>

      {/* =========================================================
          UTILITY POPOVERS (Anchored to the 72px Personal Rail)
         ========================================================= */}
      {activeUtilityPanel && (
        <div
          className="fixed inset-0 z-50 hidden md:block"
          onClick={() => setActiveUtilityPanel(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fixed left-[80px] w-80 bg-[#1F1F1F] text-[#EAE8E1] border border-[#383838] rounded-2xl shadow-2xl p-4 z-50"
            style={{
              top: activeUtilityPanel === 'profile' ? 'auto' : '64px',
              bottom: activeUtilityPanel === 'profile' ? '24px' : 'auto'
            }}
          >
            {activeUtilityPanel === 'notifications' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#333333] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#B8EEEE]" />
                    <span className="text-xs font-semibold text-white">Notifications</span>
                  </div>
                  <button
                    onClick={() =>
                      setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
                    }
                    className="text-[11px] text-[#B8EEEE] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                        n.unread
                          ? 'bg-[#292929] border-[#3E3E3E]'
                          : 'bg-[#222222] border-[#2E2E2E] opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium text-white">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-[#8E8C84]">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-[#B5B3AB] leading-relaxed">{n.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeUtilityPanel === 'help' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#333333] pb-2.5">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#B7F77C]" />
                    <span className="text-xs font-semibold text-white">
                      University Scheduling Guide
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveUtilityPanel(null)}
                    className="text-[#8E8C84] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-[11.5px] text-[#C2C0B8]">
                  <div className="p-2.5 rounded-xl bg-[#292929] border border-[#383838]">
                    <div className="font-semibold text-white mb-0.5">
                      Operating Hours (9:00 AM – 5:00 PM)
                    </div>
                    <p className="text-[11px] text-[#A6A49D]">
                      Morning Session runs 9:00 AM – 1:00 PM (Slots 1–4). Afternoon Session runs
                      2:00 PM – 5:00 PM (Slots 5–7).
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#292929] border border-[#383838]">
                    <div className="font-semibold text-white mb-0.5">
                      50m Lectures & 3h Continuous Labs
                    </div>
                    <p className="text-[11px] text-[#A6A49D]">
                      Regular lectures run 50 mins + 10m break. Labs span 3 continuous hours
                      (9–12, 10–1, or 2–5) without crossing the 1:00–2:00 PM Lunch Break.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeUtilityPanel === 'info' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#333333] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#F2D8FA]" />
                    <span className="text-xs font-semibold text-white">Application Info</span>
                  </div>
                  <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-[#292929] text-[#B8EEEE]">
                    v2.4 Institutional
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#292929]">
                    <div className="text-[10px] text-[#8E8C84]">Active Courses</div>
                    <div className="font-semibold text-white text-sm mt-0.5">
                      {storeSnapshot.courses.length} Courses
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#292929]">
                    <div className="text-[10px] text-[#8E8C84]">Scheduled Sections</div>
                    <div className="font-semibold text-white text-sm mt-0.5">
                      {scheduledCount} / {totalSections}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    institutionalStore.resetToDefaults();
                    setActiveUtilityPanel(null);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#292929] hover:bg-[#333333] text-xs font-medium text-[#EAE8E1] border border-[#383838] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Default University Seed</span>
                </button>
              </div>
            )}

            {activeUtilityPanel === 'profile' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#333333]">
                  <div className="w-9 h-9 rounded-full bg-[#F2D8FA] text-[#171717] font-semibold text-xs flex items-center justify-center shrink-0">
                    {currentUser.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-[#9E9D96] truncate">{currentUser.email}</div>
                  </div>
                </div>

                {onSwitchUser && (
                  <div className="space-y-1">
                    <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                      Switch Active Persona
                    </div>
                    {presetPersonas.map(persona => (
                      <button
                        key={persona.email}
                        onClick={() => {
                          onSwitchUser(persona);
                          setActiveUtilityPanel(null);
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

                <div className="pt-2 border-t border-[#333333] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActiveUtilityPanel(null);
                      onNavigate('settings');
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#292929] hover:bg-[#333333] text-xs text-white cursor-pointer"
                  >
                    Account Settings
                  </button>
                  <button
                    onClick={onSignOut}
                    className="py-1.5 px-3 rounded-lg bg-[#382424] hover:bg-[#4A2C2C] text-xs text-[#F2D8FA] cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          2. RIGHT COLUMN (~256px, Fixed 100vh):
             ALL Primary Application Navigation — Visible Without Scrolling
         ========================================================= */}
      <aside
        className={`fixed inset-y-0 left-[72px] z-30 hidden md:flex flex-col h-screen bg-[#292929] text-[#EAE8E1] shrink-0 select-none transition-all duration-200 ease-in-out overflow-hidden ${
          secondaryOpen
            ? 'w-[256px] opacity-100 border-r border-[#1F1F1F]'
            : 'w-0 opacity-0 border-r-0 pointer-events-none'
        }`}
        aria-label="Main application navigation"
        aria-hidden={!secondaryOpen}
      >
        <div className="w-[256px] h-screen flex flex-col justify-between overflow-hidden">
          {/* Compact Sidebar Header: Context Selector + Collapse Button */}
          <div className="px-3 py-2.5 border-b border-[#363636] relative flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTermDropdownOpen(prev => !prev)}
              className="flex-1 min-w-0 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#333333] hover:bg-[#3A3A3A] transition-colors text-left cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-[#A6A49D] truncate leading-tight">
                  {institutionName}
                </div>
                <div className="text-[12.5px] font-semibold text-white flex items-center gap-1.5 leading-tight mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B7F77C] shrink-0" />
                  <span className="truncate">{activeTerm}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#A6A49D] shrink-0" />
            </button>

            <button
              onClick={handleToggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="w-8 h-8 rounded-xl bg-[#333333] hover:bg-[#3E3E3E] text-[#C2C0B8] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {termDropdownOpen && (
              <div className="absolute left-3 right-3 top-[54px] bg-[#1F1F1F] border border-[#3E3E3E] rounded-xl p-1.5 shadow-xl z-50">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                  Switch Academic Term
                </div>
                {['Fall 2026', 'Spring 2027', 'Summer Intensive 2027'].map(term => (
                  <button
                    key={term}
                    onClick={() => handleSelectTerm(term)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
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

          {/* All Primary Navigation Sections — Clean, Spacious & Visible Without Scrolling */}
          <nav
            className="flex-1 flex flex-col justify-between px-3 py-4 overflow-hidden"
            aria-label="Workspace sections"
          >
            {navigationGroups.map(group => (
              <div key={group.heading} className="space-y-1">
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#8E8C84] select-none">
                  {group.heading}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] leading-snug transition-colors cursor-pointer ${
                          item.isActive
                            ? 'bg-[#3A3A3A] text-white font-medium'
                            : 'text-[#C2C0B8] hover:bg-[#323232] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              item.isActive ? 'text-[#B8EEEE]' : 'text-[#9E9D96]'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badgeHighlight && item.badge && (
                          <span className="text-[10.5px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#1F1F1F] text-[#B8EEEE] shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* =========================================================
          3. CENTRAL CONTENT AREA (Independent Vertical Scroll) + MOBILE DRAWER
         ========================================================= */}
      <div
        ref={mainScrollRef}
        className={`flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden flex flex-col bg-[#F7F6EF] transition-[margin-left] duration-200 ease-in-out ${
          secondaryOpen ? 'md:ml-[328px]' : 'md:ml-[72px]'
        }`}
      >
        {/* Mobile Sticky Header */}
        <header className="md:hidden sticky top-0 z-30 h-14 px-4 bg-[#171717] text-white flex items-center justify-between shrink-0">
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

        {/* Mobile Slide-Over Drawer */}
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

                {navigationGroups.map(group => (
                  <div key={group.heading} className="space-y-1">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                      {group.heading}
                    </div>
                    {group.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={item.onClick}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer ${
                            item.isActive
                              ? 'bg-[#383838] text-white font-medium'
                              : 'text-[#C2C0B8] hover:bg-[#323232]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-[#A6A49D]" />
                            <span>{item.label}</span>
                          </span>
                          {item.badge && (
                            <span className="text-[10px] font-mono-tabular text-[#B8EEEE]">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="pt-4 mt-4 border-t border-[#383838] flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium text-white">{currentUser.name}</div>
                  <div className="text-[#9E9D96] flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-[#B7F77C]" />
                    <span>{currentUser.role}</span>
                  </div>
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

        <main className="flex-1 w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-12 py-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
};
