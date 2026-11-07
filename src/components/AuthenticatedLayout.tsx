import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData } from '../data/store';
import { 
  Menu, 
  X, 
  LogOut, 
  LayoutDashboard, 
  Database, 
  Cpu, 
  Calendar, 
  MessageSquare, 
  Settings, 
  Compass,
  ChevronRight,
  Check
} from 'lucide-react';

interface AuthenticatedLayoutProps {
  activeRoute: RouteType;
  onNavigate: (route: RouteType) => void;
  onSignOut: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  currentUser: { 
    name: string; 
    role: string; 
    email: string; 
    institution?: string 
  } | null;
  onSwitchUser?: (user: { name: string; role: string; email: string; institution?: string } | null) => void;
  children: React.ReactNode;
}

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  activeRoute,
  onNavigate,
  onSignOut,
  currentUser,
  children
}) => {
  const store = useInstitutionalData();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const normalizeRoute = (r: RouteType): RouteType => {
    if (r === 'portal' || r === 'solutions') return 'home';
    if (r === 'timetable') return 'timetables';
    if (r === 'generator' || r === 'adaptive-engine') return 'generate';
    if (r === 'student-voice') return 'feedback';
    if (r === 'case-studies') return 'settings';
    return r;
  };

  const normalizedActive = normalizeRoute(activeRoute);

  // Compute live counts for sidebar badges
  const setupReadyCount = [
    store.terms.length > 0 && store.timeStructure.periods.length > 0,
    store.departments.length > 0,
    store.rooms.length > 0,
    store.courses.length > 0,
    store.instructors.length > 0,
    store.studentGroups.length > 0,
    store.constraints.length > 0
  ].filter(Boolean).length;

  const placedSectionsCount = store.sections.filter(s => s.assignedSlot).length;
  const activePollsCount = store.feedbackPolls?.length || 4;

  const navItems: {
    id: RouteType;
    label: string;
    subtitle: string;
    badge?: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'home',
      label: 'Home',
      subtitle: 'Readiness & capacity',
      icon: LayoutDashboard
    },
    {
      id: 'setup',
      label: 'Setup',
      subtitle: 'Rooms, courses & rules',
      badge: `${setupReadyCount}/7`,
      icon: Database
    },
    {
      id: 'generate',
      label: 'Generate',
      subtitle: 'Run timetable solver',
      badge: store.scenarios.length > 0 ? 'Ready' : 'Run',
      icon: Cpu
    },
    {
      id: 'timetables',
      label: 'Timetables',
      subtitle: 'Matrix & CSV/PDF export',
      badge: `${placedSectionsCount}`,
      icon: Calendar
    },
    {
      id: 'feedback',
      label: 'Feedback',
      subtitle: 'Polls & schedule review',
      badge: `${activePollsCount}`,
      icon: MessageSquare
    },
    {
      id: 'settings',
      label: 'Settings',
      subtitle: 'Profile, backup & logs',
      icon: Settings
    }
  ];

  const handleNavClick = (route: RouteType) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const user = currentUser || {
    name: store.institutionProfile?.registrarName || 'Dr. Katherine Reynolds',
    role: 'Registrar',
    email: store.institutionProfile?.registrarEmail || 'k.reynolds@westernpoly.edu',
    institution: store.institutionProfile?.name || 'Western Polytechnic'
  };

  // Next logical workflow step helper
  const getNextWorkflowStep = (): { label: string; route: RouteType } => {
    if (normalizedActive === 'home') return { label: 'Step 1: Review Setup Data', route: 'setup' };
    if (normalizedActive === 'setup') return { label: 'Step 2: Generate Timetable', route: 'generate' };
    if (normalizedActive === 'generate') return { label: 'Step 3: Inspect Timetable Matrix', route: 'timetables' };
    if (normalizedActive === 'timetables') return { label: 'Step 4: Review Stakeholder Feedback', route: 'feedback' };
    if (normalizedActive === 'feedback') return { label: 'Step 5: System Settings & Audit', route: 'settings' };
    return { label: 'Return to Home Overview', route: 'home' };
  };

  const nextAction = getNextWorkflowStep();

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] flex flex-col md:flex-row antialiased">
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-[#ece6ed] bg-white min-h-screen sticky top-0 h-screen select-none transition-all duration-200 ${
          sidebarOpen ? 'w-[264px]' : 'w-[76px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[64px] px-4 flex items-center justify-between border-b border-[#ece6ed] bg-gradient-to-r from-[#faf4fc] via-white to-[#fff7f2]">
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
          >
            <div className="w-9 h-9 rounded-xl bg-[#3b1e4a] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Compass className="w-5 h-5 text-[#f27438]" />
            </div>
            {sidebarOpen && (
              <div className="truncate">
                <div className="font-extrabold text-[15px] tracking-tight text-[#1f1b20] leading-none">
                  SMARTGRID <span className="text-[#f27438]">AI</span>
                </div>
                <div className="text-[11px] text-[#7c747f] truncate mt-1">
                  {store.institutionProfile?.name || 'Western Polytechnic'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {sidebarOpen && (
            <div className="px-3 pb-1.5 text-[11px] font-mono text-[#7c747f] uppercase tracking-wider">
              Workspace Pipeline
            </div>
          )}
          {navItems.map(item => {
            const isActive = normalizedActive === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={!sidebarOpen ? `${item.label} — ${item.subtitle}` : undefined}
                className={`w-full text-left rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                  sidebarOpen ? 'px-3.5 py-2.5' : 'p-3 justify-center'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#3b1e4a] to-[#522966] text-white shadow-xs'
                    : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-[#f6f2f7]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#f27438]' : 'text-[#7c747f] group-hover:text-[#3b1e4a]'
                    }`}
                  />
                  {sidebarOpen && (
                    <div className="min-w-0">
                      <div className={`text-[14px] leading-tight truncate ${isActive ? 'font-bold text-white' : 'font-semibold text-[#1f1b20]'}`}>
                        {item.label}
                      </div>
                      <div className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-white/75' : 'text-[#7c747f]'}`}>
                        {item.subtitle}
                      </div>
                    </div>
                  )}
                </div>

                {sidebarOpen && item.badge && (
                  <span
                    className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg shrink-0 ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-[#f6f2f7] text-[#3b1e4a]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3.5 border-t border-[#ece6ed] bg-[#fbf8fc]">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[#1f1b20] truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-[#655d69] truncate">
                  {user.role} · {store.institutionProfile?.campusCode || 'Main Campus'}
                </div>
              </div>
              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-2 rounded-xl text-[#7c747f] hover:text-[#dc2626] hover:bg-white border border-transparent hover:border-[#ece6ed] transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={onSignOut}
                title={`Sign out (${user.name})`}
                className="p-2 rounded-xl text-[#7c747f] hover:text-[#dc2626] hover:bg-white transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area with Sticky Top Bar */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar with Hamburger Toggle & Interactive Workflow Stepper */}
        <header className="sticky top-0 z-40 h-[64px] bg-white/95 backdrop-blur-md border-b border-[#ece6ed] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Hamburger Button (Desktop Collapsible & Mobile Drawer) */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="w-9 h-9 rounded-xl border border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-[#3b1e4a] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
              title="Toggle sidebar menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {/* Current Section Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span
                onClick={() => handleNavClick('home')}
                className="text-[#655d69] hover:text-[#1f1b20] cursor-pointer font-medium hidden sm:inline"
              >
                SmartGrid Workspace
              </span>
              <ChevronRight className="w-4 h-4 text-[#7c747f] hidden sm:inline" />
              <span className="font-bold text-[#1f1b20]">
                {navItems.find(n => n.id === normalizedActive)?.label || 'Home'}
              </span>
            </div>
          </div>

          {/* Center: Guided Timetable Generation Workflow Bar (Desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl p-1">
            {[
              { id: 'setup' as RouteType, step: '1. Setup Data', done: setupReadyCount === 7 },
              { id: 'generate' as RouteType, step: '2. Generate', done: store.scenarios.length > 0 },
              { id: 'timetables' as RouteType, step: '3. Timetables', done: placedSectionsCount > 0 },
              { id: 'feedback' as RouteType, step: '4. Feedback', done: activePollsCount > 0 },
              { id: 'settings' as RouteType, step: '5. Settings', done: true }
            ].map((w, idx) => {
              const isCurrent = normalizedActive === w.id;
              return (
                <React.Fragment key={w.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(w.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      isCurrent
                        ? 'bg-[#3b1e4a] text-white shadow-xs'
                        : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-white'
                    }`}
                  >
                    {w.done && !isCurrent && (
                      <Check className="w-3 h-3 text-[#18794e] stroke-[2.5]" />
                    )}
                    <span>{w.step}</span>
                  </button>
                  {idx < 4 && <ChevronRight className="w-3.5 h-3.5 text-[#dcd9dd]" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right: Guided Next Step Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick(nextAction.route)}
              className="h-9 px-3.5 rounded-xl bg-[#f6f2f7] hover:bg-[#ede6f0] text-[#3b1e4a] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{nextAction.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9c4126]" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#ece6ed] p-4 space-y-1.5 z-30 shadow-lg">
            {navItems.map(item => {
              const isActive = normalizedActive === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'font-bold text-white bg-[#3b1e4a]'
                      : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-[#f6f2f7]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#f27438]' : 'text-[#7c747f]'}`} />
                    <div>
                      <div>{item.label}</div>
                      <div className={`text-xs ${isActive ? 'text-white/75' : 'text-[#7c747f]'}`}>{item.subtitle}</div>
                    </div>
                  </div>
                  {item.badge && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-[#f6f2f7] text-[#3b1e4a]'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-3 mt-2 border-t border-[#ece6ed] flex items-center justify-between px-2">
              <div>
                <div className="text-sm font-bold text-[#1f1b20]">{user.name}</div>
                <div className="text-xs text-[#655d69]">{user.role}</div>
              </div>
              <button
                onClick={onSignOut}
                className="text-xs font-semibold text-[#dc2626] hover:underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Active Screen Viewport */}
        <main className="flex-1 min-w-0 bg-[#fbf8fc]">
          {children}
        </main>
      </div>
    </div>
  );
};
