import React, { useState, useEffect, useRef } from 'react';
import { RouteType } from './SmartGridNav';
import { SmartGridLogo } from './SmartGridLogo';
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
  RotateCcw,
  Vote,
  FileText,
  ShieldCheck,
  Send,
  User,
  Building2,
  PlusCircle,
  Upload,
  Check
} from 'lucide-react';
import { useInstitutionalData, institutionalStore, InstitutionSummary } from '../data/store';
import { computeAcademicScheduleConfig } from '../types/institutional';
import { AuthenticatedVotingUser } from '../services/votingApi';
import { UniversityOnboardingModal } from './UniversityOnboardingModal';
import { DataImportWizard } from './DataImportWizard';
import { GlobalSearch } from './GlobalSearch';

interface AuthenticatedLayoutProps {
  activeRoute: RouteType;
  setupStep?: number;
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIdx: number) => void;
  onSignOut: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  currentUser: AuthenticatedVotingUser;
  onSwitchUser?: (user: AuthenticatedVotingUser) => void;
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
  children
}) => {
  const storeSnapshot = useInstitutionalData();
  const activeTiming = computeAcademicScheduleConfig(storeSnapshot.timeStructure);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const normalizedRole = (currentUser.systemRole || currentUser.role || '').toLowerCase();
  const isAdminRole = normalizedRole === 'admin' || normalizedRole === 'registrar';
  const isBrRole = normalizedRole === 'br';
  const isStudentRole = normalizedRole === 'student';
  const isFacultyRole = normalizedRole === 'faculty';

  const homeRouteForRole: RouteType = isStudentRole
    ? 'student-dashboard'
    : isBrRole
    ? 'br-dashboard'
    : isFacultyRole
    ? 'faculty-dashboard'
    : 'home';

  const [secondaryOpen, setSecondaryOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smartgrid_sidebar_collapsed');
      if (saved !== null) {
        return saved !== 'true';
      }
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
      } catch {}
      return next;
    });
  };

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [termDropdownOpen, setTermDropdownOpen] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanelType>(null);
  const [activeInsightSubView, setActiveInsightSubView] = useState<InsightSubView>(() => {
    try {
      const saved = sessionStorage.getItem('smartgrid_insight_tab');
      if (saved === 'analytics' || saved === 'optimization' || saved === 'history') {
        return saved;
      }
    } catch {}
    return 'analytics';
  });

  useEffect(() => {
    const handleInsightEvent = (e: Event) => {
      const custom = e as CustomEvent<InsightSubView>;
      if (custom.detail) {
        setActiveInsightSubView(custom.detail);
        if (mainScrollRef.current) {
          mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('smartgrid:insight-tab', handleInsightEvent);
    return () => window.removeEventListener('smartgrid:insight-tab', handleInsightEvent);
  }, []);

  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const availableInstitutions = institutionalStore.getAvailableInstitutions();
  const currentInstitutionId = institutionalStore.getCurrentInstitutionId();
  const currentInstSummary = availableInstitutions.find(i => i.id === currentInstitutionId);

  const handleSwitchInstitution = (instId: string) => {
    institutionalStore.switchInstitution(instId);
    setTermDropdownOpen(false);
  };

  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Timetable Verified',
      detail: 'All lectures & continuous labs respect the configured university operating hours and breaks.',
      time: 'Just now',
      unread: true
    },
    {
      id: 'n2',
      title: 'Batch Voting Active',
      detail: 'Published cohort referendums are open for student participation.',
      time: '12m ago',
      unread: true
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeRoute, setupStep, activeInsightSubView]);

  const activeTermsList = storeSnapshot.terms.filter(t => t.status === 'active');
  const activeTermObj = activeTermsList[0] || storeSnapshot.terms[0];
  const activeTerm =
    activeTermsList.length > 0
      ? activeTermsList.map(t => t.name).join(' + ')
      : activeTermObj?.name || 'Configured Semester';
  const institutionName =
    storeSnapshot.institutionProfile?.name || currentUser.institution || 'Western Polytechnic';

  const handleToggleTermActive = (termId: string) => {
    if (!isAdminRole) return;
    institutionalStore.toggleTermActiveStatus(termId);
  };

  const scheduledCount = storeSnapshot.sections.filter(s => Boolean(s.assignedSlot)).length;
  const totalSections = storeSnapshot.sections.length;

  const openSetup = (stepIdx: number) => {
    if (!isAdminRole) return;
    setActiveUtilityPanel(null);
    if (onOpenSetupStep) {
      onOpenSetupStep(stepIdx);
    } else {
      onNavigate('setup');
    }
    setMobileDrawerOpen(false);
  };

  const openInsightSection = (subView: InsightSubView, _elementId?: string) => {
    if (!isAdminRole) return;
    setActiveUtilityPanel(null);
    setActiveInsightSubView(subView);
    try {
      sessionStorage.setItem('smartgrid_insight_tab', subView);
      window.dispatchEvent(new CustomEvent('smartgrid:insight-tab', { detail: subView }));
    } catch {}
    onNavigate('feedback');
    setMobileDrawerOpen(false);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // =========================================================
  // DYNAMIC ROLE-BASED NAVIGATION GROUPS
  // Strictly separate menus for Students, BRs, and Admins
  // One main feature = one sidebar destination (no duplicate internal tabs)
  // =========================================================
  type NavGroupItem = {
    id: string;
    code: string;
    heading: string;
    items: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      meta?: string;
      metaAccent?: boolean;
      isActive: boolean;
      onClick: () => void;
    }>;
  };

  const studentNavigationGroups: NavGroupItem[] = [
    {
      id: 'group-student-workspace',
      code: '01',
      heading: 'STUDENT WORKSPACE',
      items: [
        {
          id: 'nav-student-dashboard',
          label: 'Student Dashboard',
          icon: Home,
          isActive: activeRoute === 'student-dashboard',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('student-dashboard');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-student-timetable',
          label: 'My Timetable',
          icon: Calendar,
          meta: currentUser.batchCode || 'Schedule',
          metaAccent: true,
          isActive: activeRoute === 'timetables',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('timetables');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-student-voting',
          label: 'Student Voting',
          icon: Vote,
          meta: 'Polls',
          metaAccent: true,
          isActive: activeRoute === 'student-voting',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('student-voting');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-student-preferences',
          label: 'My Preferences',
          icon: Sliders,
          isActive: activeRoute === 'student-preferences',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('student-preferences');
            setMobileDrawerOpen(false);
          }
        }
      ]
    },
    {
      id: 'group-student-account',
      code: '02',
      heading: 'ACCOUNT',
      items: [
        {
          id: 'nav-account-settings',
          label: 'Account Profile',
          icon: User,
          isActive: activeRoute === 'account-settings',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('account-settings');
            setMobileDrawerOpen(false);
          }
        }
      ]
    }
  ];

  const brNavigationGroups: NavGroupItem[] = [
    {
      id: 'group-br-workspace',
      code: '01',
      heading: 'REPRESENTATIVE WORKSPACE',
      items: [
        {
          id: 'nav-br-dashboard',
          label: 'BR Workspace',
          icon: Home,
          meta: currentUser.batchCode || 'BR',
          metaAccent: true,
          isActive:
            activeRoute === 'br-dashboard' ||
            activeRoute === 'br-submit' ||
            activeRoute === 'br-submissions' ||
            activeRoute === 'br-results',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('br-dashboard');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-br-timetable',
          label: 'Batch Timetable',
          icon: Calendar,
          meta: currentUser.batchCode || 'Grid',
          isActive: activeRoute === 'timetables',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('timetables');
            setMobileDrawerOpen(false);
          }
        }
      ]
    },
    {
      id: 'group-br-account',
      code: '02',
      heading: 'ACCOUNT',
      items: [
        {
          id: 'nav-br-account',
          label: 'Account Profile',
          icon: User,
          isActive: activeRoute === 'account-settings',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('account-settings');
            setMobileDrawerOpen(false);
          }
        }
      ]
    }
  ];

  const adminNavigationGroups: NavGroupItem[] = [
    {
      id: 'group-workspace',
      code: '01',
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
          id: 'nav-timetable',
          label: 'My Timetable',
          icon: Calendar,
          meta: `${scheduledCount}/${totalSections}`,
          metaAccent: true,
          isActive: activeRoute === 'timetables',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('timetables');
            setMobileDrawerOpen(false);
          }
        }
      ]
    },
    {
      id: 'group-academic',
      code: '02',
      heading: 'ACADEMIC MANAGEMENT',
      items: [
        {
          id: 'nav-rooms',
          label: 'Rooms & Laboratories',
          icon: DoorOpen,
          meta: String(storeSnapshot.rooms.length),
          isActive: activeRoute === 'setup' && setupStep === 1,
          onClick: () => openSetup(1)
        },
        {
          id: 'nav-classes-sections',
          label: 'Classes & Sections',
          icon: GraduationCap,
          meta: String(storeSnapshot.studentGroups.length),
          isActive:
            activeRoute === 'setup' &&
            (setupStep === 4 || setupStep === 5 || setupStep === 0),
          onClick: () => openSetup(4)
        },
        {
          id: 'nav-instructors',
          label: 'Instructors',
          icon: Users,
          meta: String(storeSnapshot.instructors.length),
          isActive:
            activeRoute === 'setup' && (setupStep === 3 || setupStep === 6),
          onClick: () => openSetup(3)
        },
        {
          id: 'nav-courses',
          label: 'Courses',
          icon: BookOpen,
          meta: String(storeSnapshot.courses.length),
          isActive: activeRoute === 'setup' && setupStep === 2,
          onClick: () => openSetup(2)
        }
      ]
    },
    {
      id: 'group-analytics',
      code: '03',
      heading: 'ANALYTICS & OPTIMIZATION',
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
          meta: '96.4%',
          isActive: activeRoute === 'feedback' && activeInsightSubView === 'optimization',
          onClick: () => openInsightSection('optimization', 'insights-optimization')
        },
        {
          id: 'nav-history',
          label: 'Schedule History',
          icon: History,
          meta: String(storeSnapshot.scenarios.length),
          isActive: activeRoute === 'feedback' && activeInsightSubView === 'history',
          onClick: () => openInsightSection('history', 'insights-history')
        }
      ]
    },
    {
      id: 'group-administration',
      code: '04',
      heading: 'ADMINISTRATION',
      items: [
        {
          id: 'nav-admin-voting',
          label: 'Voting Management',
          icon: Vote,
          meta: 'Polls',
          metaAccent: true,
          isActive:
            activeRoute === 'admin-voting' ||
            activeRoute === 'admin-voting-analytics',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('admin-voting');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-admin-br-management',
          label: 'Batch Representatives',
          icon: ShieldCheck,
          meta: '2/Batch',
          isActive: activeRoute === 'admin-br-management',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('admin-br-management');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-academic-config',
          label: 'Academic Configuration',
          icon: Clock,
          meta: `${activeTiming.periodLengthMinutes}m`,
          metaAccent: true,
          isActive: activeRoute === 'academic-config',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('academic-config');
            setMobileDrawerOpen(false);
          }
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

  const facultyNavigationGroups: NavGroupItem[] = [
    {
      id: 'group-faculty-workspace',
      code: '01',
      heading: 'FACULTY WORKSPACE',
      items: [
        {
          id: 'nav-faculty-dashboard',
          label: 'My Teaching Schedule',
          icon: Calendar,
          meta: 'Personal',
          metaAccent: true,
          isActive: activeRoute === 'faculty-dashboard',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('faculty-dashboard');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-faculty-matrix',
          label: 'Institutional Matrix',
          icon: BookOpen,
          meta: 'All Classes',
          isActive: activeRoute === 'timetables',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('timetables');
            setMobileDrawerOpen(false);
          }
        },
        {
          id: 'nav-faculty-preferences',
          label: 'Availability & Blocks',
          icon: Clock,
          isActive: activeRoute === 'faculty-preferences',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('faculty-preferences');
            setMobileDrawerOpen(false);
          }
        }
      ]
    },
    {
      id: 'group-faculty-account',
      code: '02',
      heading: 'ACCOUNT',
      items: [
        {
          id: 'nav-faculty-profile',
          label: 'Faculty Profile',
          icon: User,
          isActive: activeRoute === 'account-settings',
          onClick: () => {
            setActiveUtilityPanel(null);
            onNavigate('account-settings');
            setMobileDrawerOpen(false);
          }
        }
      ]
    }
  ];

  const navigationGroups = isStudentRole
    ? studentNavigationGroups
    : isBrRole
    ? brNavigationGroups
    : isFacultyRole
    ? facultyNavigationGroups
    : adminNavigationGroups;

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  // When opening the web app, the right sidebar options are collapsed except the first one (01. Workspace)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => ({
    'group-academic': true,
    'group-insights': true,
    'group-community': true,
    'group-system': true,
    'group-student-account': true,
    'group-br-voting': true,
    'group-br-account': true,
    'group-faculty-workload': true,
    'group-faculty-account': true
  }));

  const handleSidebarMouseEnter = () => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleSidebarMouseLeave = () => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsSidebarHovered(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const isCurrentlyCollapsed = prev[groupId] ?? true;
      return {
        ...prev,
        [groupId]: !isCurrentlyCollapsed
      };
    });
  };

  const isRightSidebarExpanded = secondaryOpen || isSidebarHovered;

  const toggleUtilityPanel = (panel: Exclude<UtilityPanelType, null>) => {
    setActiveUtilityPanel(prev => (prev === panel ? null : panel));
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-[#F7F6EF] text-[#171717]">
      {/* =========================================================
           1. LEFT COLUMN (72px, Fixed 100vh):
              Personal Utilities & Account (Hover opens Right Sidebar)
          ========================================================= */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed inset-y-0 left-0 z-40 hidden md:flex flex-col items-center justify-between w-[72px] h-screen bg-[#171717] text-white py-3.5 shrink-0 select-none border-r border-[#242424]"
        aria-label="Personal utilities and account controls"
      >
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <button
            type="button"
            onClick={() => {
              setActiveUtilityPanel(null);
              onNavigate(homeRouteForRole);
            }}
            title={institutionName}
            aria-label="Dashboard"
            className="rounded-xl transition-transform hover:scale-105 cursor-pointer focus:outline-none"
          >
            <SmartGridLogo variant="icon" theme="dark" size="md" />
          </button>

          <div className="w-7 h-[1px] bg-[#2E2E2E]" />

          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={() => toggleUtilityPanel('notifications')}
              title="Notifications"
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
              title="Application Information"
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

        {/* Bottom: Settings, User Profile/Avatar, Single Logout Button */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          <div className="w-7 h-[1px] bg-[#2E2E2E]" />

          <button
            onClick={() => {
              setActiveUtilityPanel(null);
              onNavigate(isAdminRole ? 'academic-config' : 'account-settings');
            }}
            title={isAdminRole ? 'Academic Configuration' : 'Account & Profile Settings'}
            aria-label="Settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeRoute === 'academic-config' || activeRoute === 'account-settings'
                ? 'bg-[#2E2E2E] text-white'
                : 'text-[#9E9D96] hover:text-white hover:bg-[#242424]'
            }`}
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => toggleUtilityPanel('profile')}
            title={`Account Profile: ${currentUser.name} (${currentUser.role})`}
            aria-label="User profile"
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
            title="Log Out"
            aria-label="Log out"
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
                      Operating Hours ({activeTiming.operatingHoursLabel})
                    </div>
                    <p className="text-[11px] text-[#A6A49D]">
                      {activeTiming.slots.length} daily slots across {activeTiming.workingDays.join('–')}.
                      {activeTiming.middayBreak.enabled
                        ? ` Protected Midday Break: ${activeTiming.middayBreak.fullRangeLabel}.`
                        : ' Continuous daytime scheduling.'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#292929] border border-[#383838]">
                    <div className="font-semibold text-white mb-0.5">
                      {activeTiming.periodLengthMinutes}m Lectures & {activeTiming.labDurationMinutes}m Labs
                    </div>
                    <p className="text-[11px] text-[#A6A49D]">
                      Regular lectures run {activeTiming.periodLengthMinutes} mins. Labs span {activeTiming.labSpanSlots} continuous slots without splitting.
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
                    <span className="text-xs font-semibold text-white">Workspace Overview</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#333333] border border-[#333333] rounded-xl text-xs">
                  <div className="p-2.5">
                    <div className="text-[10px] text-[#8E8C84]">Courses</div>
                    <div className="font-semibold text-white text-sm mt-0.5 font-mono-tabular">
                      {storeSnapshot.courses.length}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[10px] text-[#8E8C84]">Scheduled</div>
                    <div className="font-semibold text-white text-sm mt-0.5 font-mono-tabular">
                      {scheduledCount} / {totalSections}
                    </div>
                  </div>
                </div>
                {isAdminRole && (
                  <button
                    onClick={() => {
                      institutionalStore.resetToDefaults();
                      setActiveUtilityPanel(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#292929] hover:bg-[#333333] text-xs font-medium text-[#EAE8E1] border border-[#383838] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Default Seed</span>
                  </button>
                )}
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

                <div className="p-2.5 rounded-xl bg-[#292929] border border-[#383838] text-xs space-y-1">
                  <div className="text-[10px] text-[#8E8C84]">Verified Backend Role</div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#B7F77C]" />
                    <span>
                      {isBrRole
                        ? `Batch Representative (${
                            currentUser.brGenderRole === 'female' ? 'Female BR' : 'Male BR'
                          })`
                        : currentUser.role}
                    </span>
                  </div>
                  {currentUser.batchCode && (
                    <div className="text-[11px] text-[#B8EEEE]">
                      Cohort: {currentUser.batchCode}
                      {currentUser.section ? ` · ${currentUser.section}` : ''}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#333333] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActiveUtilityPanel(null);
                      onNavigate('account-settings');
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-[#292929] hover:bg-[#333333] text-xs text-white cursor-pointer"
                  >
                    Account Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
           2. RIGHT COLUMN (Fixed 100vh):
              Role-Specific Navigation Menu
              - Smoothly opens when hovering Left Sidebar or when expanded
              - Completely collapses (no icons) when collapsed
              - No web app name on the right sidebar
              - All option groups collapsible except the first one
          ========================================================= */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className={`fixed inset-y-0 left-[72px] z-30 hidden md:flex flex-col h-screen bg-[#292929] text-[#EAE8E1] shrink-0 select-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
          isRightSidebarExpanded
            ? 'w-[256px] opacity-100 border-r border-[#1F1F1F] shadow-xl'
            : 'w-0 opacity-0 pointer-events-none border-r-0'
        }`}
        aria-label="Main application navigation"
        aria-hidden={!isRightSidebarExpanded}
      >
        {isRightSidebarExpanded && (
          <div className="w-[256px] h-screen flex flex-col justify-between overflow-hidden">
            {/* Context & Term Selector Header (No Web App Name, No Collapse Icon) */}
            <div className="px-3 py-3 border-b border-[#363636] relative flex flex-col gap-2 shrink-0">
              <button
                onClick={() => {
                  if (isAdminRole) setTermDropdownOpen(prev => !prev);
                }}
                title={`${institutionName} · ${activeTerm}`}
                className="w-full min-w-0 flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg bg-[#323232] hover:bg-[#383838] transition-colors text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-[#9E9D96] truncate leading-tight flex items-center gap-1.5">
                    <span className="truncate">
                      {isStudentRole
                        ? `STUDENT · ${currentUser.batchCode || 'COHORT'}`
                        : isBrRole
                        ? `BR · ${currentUser.batchCode || 'COHORT'}`
                        : isFacultyRole
                        ? `FACULTY · TEACHING`
                        : institutionName}
                    </span>
                  </div>
                  <div className="text-[11.5px] font-semibold text-white flex items-center gap-1.5 leading-tight mt-0.5">
                    <span className="truncate">{activeTerm}</span>
                  </div>
                </div>
                {isAdminRole && <ChevronDown className="w-3.5 h-3.5 text-[#9E9D96] shrink-0" />}
              </button>

              {isAdminRole && termDropdownOpen && (
                <div className="absolute left-2.5 right-2.5 top-[58px] bg-[#1F1F1F] border border-[#3E3E3E] rounded-xl p-2 shadow-2xl z-50 space-y-2 max-h-[420px] overflow-y-auto">
                  {/* Section 1: Switch Active University */}
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84] flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-[#B8EEEE]" />
                      <span>Active University</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {availableInstitutions.map(inst => {
                        const isSelected = inst.id === currentInstitutionId;
                        return (
                          <button
                            key={inst.id}
                            onClick={() => handleSwitchInstitution(inst.id)}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-[#383838] text-white font-medium'
                                : 'text-[#C2C0B8] hover:bg-[#2C2C2C] hover:text-white'
                            }`}
                          >
                            <div className="min-w-0 pr-1">
                              <div className="truncate text-[11px] font-medium leading-tight">
                                {inst.name}
                              </div>
                              <div className="text-[9.5px] text-[#8E8C84] leading-tight mt-0.5">
                                {inst.code} · {inst.isDemoTemplate ? 'Sample' : 'Configured'}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#B7F77C] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Universal CSV Importer Action */}
                  <div className="pt-1.5 border-t border-[#333333] space-y-1">
                    <button
                      onClick={() => {
                        setTermDropdownOpen(false);
                        setShowImportWizard(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-[11px] text-[#EAE8E1] font-medium transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#B7F77C] shrink-0" />
                      <span>Import CSV Dataset</span>
                    </button>
                  </div>

                  {/* Section 3: Configured Academic Semesters */}
                  <div className="pt-1.5 border-t border-[#333333] space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8C84]">
                      Academic Semesters
                    </div>
                    {storeSnapshot.terms.map(term => {
                      const isTermActive = term.status === 'active';
                      return (
                        <button
                          key={term.id}
                          onClick={() => handleToggleTermActive(term.id)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isTermActive
                              ? 'bg-[#383838] text-white'
                              : 'text-[#C2C0B8] hover:bg-[#2C2C2C] hover:text-white'
                          }`}
                        >
                          <div className="min-w-0 text-left pr-1">
                            <div className="text-[11px] truncate">{term.name}</div>
                            <div className="text-[9.5px] text-[#8E8C84] font-mono-tabular">
                              {term.code}
                            </div>
                          </div>
                          {isTermActive ? (
                            <Check className="w-3.5 h-3.5 text-[#B7F77C] shrink-0" />
                          ) : (
                            <span className="text-[10px] text-[#7E7C74] shrink-0">Off</span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setTermDropdownOpen(false);
                        onNavigate('academic-config');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[10.5px] text-[#B8EEEE] hover:bg-[#2C2C2C] transition-colors cursor-pointer"
                    >
                      Manage Calendar &amp; Policies →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Role Navigation Groups (First group fixed open; all other groups collapsible) */}
            <nav
              className="flex-1 flex flex-col justify-start gap-4 px-2.5 py-3 overflow-y-auto"
              aria-label="Workspace navigation hierarchy"
            >
              {navigationGroups.map((group, groupIdx) => {
                const isCollapsible = groupIdx > 0;
                const isGroupCollapsed = isCollapsible && (collapsedGroups[group.id] ?? true);

                return (
                  <div key={group.id} className="space-y-1">
                    {isCollapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.id)}
                        aria-expanded={!isGroupCollapsed}
                        className="w-full px-2.5 py-1 rounded-md flex items-center justify-between gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A8880] hover:text-[#EAE8E1] hover:bg-white/[0.04] transition-colors select-none cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="font-mono-tabular text-[#6E6C65]">{group.code}.</span>
                          <span className="truncate">{group.heading}</span>
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[#8A8880] shrink-0 transition-transform duration-200 ${
                            isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A8880] select-none">
                        <span className="font-mono-tabular text-[#6E6C65]">{group.code}.</span>
                        <span>{group.heading}</span>
                      </div>
                    )}

                    {!isGroupCollapsed && (
                      <div className="space-y-0.5">
                        {group.items.map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={item.onClick}
                              title={`${item.label}${item.meta ? ` (${item.meta})` : ''} · ${group.heading}`}
                              aria-current={item.isActive ? 'page' : undefined}
                              className={`group relative w-full h-[29px] flex items-center justify-between gap-2 px-2.5 rounded-md text-[12.5px] leading-none transition-colors cursor-pointer ${
                                item.isActive
                                  ? 'bg-[#383838] text-white font-medium'
                                  : 'text-[#C2C0B8] hover:bg-white/[0.05] hover:text-white font-normal'
                              }`}
                            >
                              {item.isActive && (
                                <span
                                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#B8EEEE]"
                                  aria-hidden="true"
                                />
                              )}

                              <span className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`w-[15px] h-[15px] shrink-0 transition-colors ${
                                    item.isActive
                                      ? 'text-[#B8EEEE]'
                                      : 'text-[#96948C] group-hover:text-[#D6D4CE]'
                                  }`}
                                />
                                <span className="truncate">{item.label}</span>
                              </span>

                              {item.meta && (
                                <span
                                  className={`text-[11px] font-mono-tabular shrink-0 ${
                                    item.isActive
                                      ? 'text-[#B8EEEE] font-medium'
                                      : item.metaAccent
                                      ? 'text-[#A6A49D]'
                                      : 'text-[#7E7C74] group-hover:text-[#A6A49D]'
                                  }`}
                                >
                                  {item.meta}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom Logged-In User Summary (No Duplicate Logout Button) */}
            <div className="px-3 py-2.5 border-t border-[#363636] flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{currentUser.name}</div>
                <div className="text-[11px] text-[#9E9D96] truncate">
                  {isBrRole
                    ? `${currentUser.brGenderRole === 'female' ? 'Female' : 'Male'} BR · ${
                        currentUser.batchCode || ''
                      }`
                    : isStudentRole
                    ? `Student · ${currentUser.batchCode || ''}`
                    : isFacultyRole
                    ? 'Faculty · Instructor'
                    : currentUser.role}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* =========================================================
           3. CENTRAL CONTENT AREA + MAIN BACKGROUND SIDEBAR TOGGLE
          ========================================================= */}
      <div
        ref={mainScrollRef}
        className={`flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden flex flex-col bg-[#F7F6EF] transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isRightSidebarExpanded ? 'md:ml-[328px]' : 'md:ml-[72px]'
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
            <SmartGridLogo variant="primary" theme="dark" size="xs" />
          </div>
          <div className="flex items-center gap-2">
            {isAdminRole && (
              <GlobalSearch
                onNavigate={onNavigate}
                onOpenSetupStep={openSetup}
                variant="compact"
              />
            )}
            {isAdminRole ? (
              <button
                onClick={() => onNavigate('generate')}
                className="px-3 py-1.5 rounded-lg bg-[#B8EEEE] text-[#171717] text-xs font-semibold cursor-pointer"
              >
                Generate
              </button>
            ) : (
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 rounded-lg bg-[#292929] text-white text-xs font-semibold cursor-pointer"
              >
                Logout
              </button>
            )}
          </div>
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
                  <div className="text-xs font-semibold text-white">
                    {institutionName} · {activeTerm}
                  </div>
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1 text-[#A6A49D] hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {navigationGroups.map((group, groupIdx) => {
                  const isCollapsible = groupIdx > 0;
                  const isGroupCollapsed = isCollapsible && (collapsedGroups[group.id] ?? true);
                  return (
                    <div key={group.id} className="space-y-1">
                      {isCollapsible ? (
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="w-full px-2.5 py-1 flex items-center justify-between gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8C84] cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono-tabular text-[#6E6C65]">{group.code}.</span>
                            <span>{group.heading}</span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                            }`}
                          />
                        </button>
                      ) : (
                        <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8C84]">
                          <span className="font-mono-tabular text-[#6E6C65]">{group.code}.</span>
                          <span>{group.heading}</span>
                        </div>
                      )}
                      {!isGroupCollapsed && (
                        <div className="space-y-0.5">
                          {group.items.map(item => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={item.onClick}
                                className={`relative w-full flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer ${
                                  item.isActive
                                    ? 'bg-[#383838] text-white font-medium'
                                    : 'text-[#C2C0B8] hover:bg-white/[0.05] hover:text-white'
                                }`}
                              >
                                {item.isActive && (
                                  <span
                                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#B8EEEE]"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="flex items-center gap-2.5">
                                  <Icon
                                    className={`w-4 h-4 ${
                                      item.isActive ? 'text-[#B8EEEE]' : 'text-[#A6A49D]'
                                    }`}
                                  />
                                  <span>{item.label}</span>
                                </span>
                                {item.meta && (
                                  <span
                                    className={`text-[10.5px] font-mono-tabular ${
                                      item.isActive ? 'text-[#B8EEEE]' : 'text-[#8E8C84]'
                                    }`}
                                  >
                                    {item.meta}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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

        {/* Main Background Top Bar with Collapse Sidebar Icon, Global Search, and Onboard/Import Actions */}
        <div className="hidden md:flex items-center justify-between gap-4 px-6 sm:px-10 pt-4 pb-1 shrink-0">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleSidebar}
              title={secondaryOpen ? 'Collapse sidebar' : 'Pin sidebar open'}
              aria-label={secondaryOpen ? 'Collapse sidebar' : 'Pin sidebar open'}
              className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white border border-[#E4E2DA] text-[#171717] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              {/* Sidebar Split-Panel Collapse Icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="9.5" y1="3" x2="9.5" y2="21" />
                <line x1="6" y1="8" x2="7.2" y2="8" />
                <line x1="6" y1="12" x2="7.2" y2="12" />
              </svg>
            </button>

            {isAdminRole && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#171717]">{institutionName}</span>
              </div>
            )}
          </div>

          {/* Global Workspace Search Component */}
          {isAdminRole && (
            <div className="flex-1 max-w-md mx-auto flex justify-center">
              <GlobalSearch onNavigate={onNavigate} onOpenSetupStep={openSetup} />
            </div>
          )}

          {isAdminRole && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportWizard(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F7F6EF] border border-[#E4E2DA] text-xs font-medium text-[#171717] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Universal CSV & Excel Data Importer"
              >
                <Upload className="w-3.5 h-3.5 text-[#171717]" />
                <span>Import Data (CSV)</span>
              </button>
            </div>
          )}
        </div>

        <main className="flex-1 w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-12 py-6 lg:py-8">
          {children}
        </main>
      </div>

      {showOnboardingModal && (
        <UniversityOnboardingModal
          onClose={() => setShowOnboardingModal(false)}
          onCompleted={newInstId => {
            setShowOnboardingModal(false);
            institutionalStore.switchInstitution(newInstId);
          }}
        />
      )}

      {showImportWizard && (
        <DataImportWizard
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            setShowImportWizard(false);
          }}
        />
      )}
    </div>
  );
};
