import React, { useState } from 'react';
import { 
  Compass, 
  Sparkles, 
  Menu, 
  X, 
  ChevronRight, 
  Clock, 
  Sliders, 
  Cpu, 
  HeartHandshake, 
  Award, 
  LogOut, 
  Building,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RouteType } from './SmartGridNav';

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
  onSwitchUser,
  children
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hoveredCollapsedItem, setHoveredCollapsedItem] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const activeUser = currentUser || {
    name: 'Dr. Katherine Reynolds',
    role: 'Chief University Registrar',
    email: 'k.reynolds@westernpoly.edu',
    institution: 'Western Polytechnic Institute'
  };

  const navItems = [
    {
      id: 'portal' as RouteType,
      label: 'Command Portal',
      description: 'Audit & LMS Sync',
      icon: Building,
      iconBg: 'bg-gradient-to-br from-[#3b1e4a] to-[#5a2a71] text-white',
      badge: 'Live',
      badgeTone: 'text-[#18794e] bg-[#eaf8f0]'
    },
    {
      id: 'timetable' as RouteType,
      label: 'Timetable Matrix',
      description: '5-Day Campus Grid',
      icon: Clock,
      iconBg: 'bg-gradient-to-br from-[#9c4126] to-[#c84c16] text-white',
      badge: '1,420 Sec',
      badgeTone: 'text-[#9c4126] bg-[#fff0eb]'
    },
    {
      id: 'generator' as RouteType,
      label: 'Generator Studio',
      description: 'Combinatorial Optimizer',
      icon: Sliders,
      iconBg: 'bg-gradient-to-br from-[#f27438] to-[#ea580c] text-white',
      badge: 'SAT Mode',
      badgeTone: 'text-[#ea580c] bg-[#fff7ed]'
    },
    {
      id: 'adaptive-engine' as RouteType,
      label: 'Adaptive Engine',
      description: 'Genetic Convergence',
      icon: Cpu,
      iconBg: 'bg-gradient-to-br from-[#6b21a8] to-[#9333ea] text-white',
      badge: 'Epoch 142',
      badgeTone: 'text-[#7e22ce] bg-[#faf5ff]'
    },
    {
      id: 'student-voice' as RouteType,
      label: 'Student Voice',
      description: 'Circadian Referendums',
      icon: HeartHandshake,
      iconBg: 'bg-gradient-to-br from-[#e11d48] to-[#f43f5e] text-white',
      badge: '3 Polls',
      badgeTone: 'text-[#e11d48] bg-[#fff1f2]'
    },
    {
      id: 'case-studies' as RouteType,
      label: 'Institutional Studies',
      description: 'Accreditation Benchmarks',
      icon: Award,
      iconBg: 'bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white',
      badge: '4 Campuses',
      badgeTone: 'text-[#18794e] bg-[#f0fdf4]'
    },
    {
      id: 'solutions' as RouteType,
      label: 'Public Overview',
      description: 'Landing Page View',
      icon: Compass,
      iconBg: 'bg-gradient-to-br from-[#475569] to-[#64748b] text-white',
      badge: 'Showcase',
      badgeTone: 'text-[#475569] bg-[#f1f5f9]'
    }
  ];

  const handleItemClick = (route: RouteType) => {
    onNavigate(route);
    setMobileDrawerOpen(false);
    setSearchOpen(false);
  };

  const currentItem = navItems.find(item => item.id === activeRoute) || navItems[0];

  const filteredSearchItems = navItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] flex flex-col md:flex-row antialiased selection:bg-[#f27438]/20">
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-[#1f1b20]/40 backdrop-blur-xs z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Quick Command Palette Modal */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#ece6ed] overflow-hidden z-10 p-4 space-y-3"
            >
              <div className="flex items-center gap-3 px-3 py-2 bg-[#fbf8fc] rounded-xl border border-[#ece6ed]">
                <Search className="w-4 h-4 text-[#7c747f]" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Jump to section (Timetable, Solver, Referendums...)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold focus:outline-none text-[#1f1b20]"
                />
                <kbd className="text-[10px] font-mono text-[#7c747f] bg-white px-1.5 py-0.5 rounded border border-[#ece6ed]">
                  ESC
                </kbd>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredSearchItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#f6f2f7] transition-all text-left text-xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-[#1f1b20]">{item.label}</div>
                          <div className="text-[10px] text-[#7c747f]">{item.description}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#ece6ed] group-hover:text-[#1f1b20] transition-colors" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= LEFT SIDEBAR ================= */}
      <aside 
        className={`fixed md:sticky top-0 h-screen z-50 flex flex-col bg-white border-r border-[#ece6ed] transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:w-20' : 'md:w-72'
        } ${
          mobileDrawerOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand & Collapse Header */}
        <div className="h-18 px-4 sm:px-5 border-b border-[#ece6ed] flex items-center justify-between bg-gradient-to-r from-white via-[#fffbfa] to-white">
          <div 
            onClick={() => handleItemClick('portal')}
            className={`flex items-center gap-3 cursor-pointer select-none transition-all ${
              sidebarCollapsed ? 'justify-center w-full' : ''
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b1e4a] via-[#522567] to-[#1f0e27] flex items-center justify-center text-white shadow-md shadow-[#3b1e4a]/15 shrink-0 group">
              <Compass className="w-5 h-5 text-[#f27438] group-hover:rotate-12 transition-transform duration-300" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-[#1f1b20] leading-none">
                  SMARTGRID <span className="text-[#9c4126]">AI</span>
                </span>
                <span className="text-[10px] font-mono text-[#7c747f] mt-0.5 uppercase tracking-wider font-semibold">
                  Equilibrium Engine
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-[#7c747f] hover:text-[#1f1b20] hover:bg-[#f6f2f7] transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#7c747f] hover:text-[#1f1b20] hover:bg-[#f6f2f7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If collapsed on desktop: quick expand button */}
        {sidebarCollapsed && (
          <div className="hidden md:flex justify-center py-2.5 border-b border-[#ece6ed] bg-[#fbf8fc]">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7c747f] hover:text-[#1f1b20] hover:bg-[#ece6ed] transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Profile Mini-Card */}
        <div className="p-3.5 border-b border-[#ece6ed] relative">
          <div 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className={`p-2.5 rounded-xl bg-gradient-to-br from-[#fff7f2] via-white to-[#fbf5fc] border border-[#ece6ed] hover:border-[#dcd9dd] flex items-center gap-3 transition-all cursor-pointer shadow-xs ${
              sidebarCollapsed ? 'justify-center p-2' : ''
            }`}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9c4126] via-[#f27438] to-[#ea580c] text-white flex items-center justify-center text-xs font-bold font-mono shadow-xs shrink-0">
                {activeUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#18794e] border-2 border-white" />
            </div>

            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#1f1b20] truncate">
                  {activeUser.name}
                </div>
                <div className="text-[10px] text-[#9c4126] font-bold truncate">
                  {activeUser.role}
                </div>
                <div className="text-[9px] font-mono text-[#7c747f] truncate">
                  {activeUser.institution || 'Western Polytechnic'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Link List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          <div className={`px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#7c747f] font-bold ${
            sidebarCollapsed ? 'text-center' : ''
          }`}>
            {sidebarCollapsed ? '•' : 'Core Workspace'}
          </div>

          {navItems.map(item => {
            const isActive = activeRoute === item.id;
            const Icon = item.icon;

            return (
              <div 
                key={item.id} 
                className="relative"
                onMouseEnter={() => sidebarCollapsed && setHoveredCollapsedItem(item.id)}
                onMouseLeave={() => sidebarCollapsed && setHoveredCollapsedItem(null)}
              >
                <button
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 group relative cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#faf4fc] via-[#f5ebf8] to-[#faf4fc] text-[#3b1e4a] shadow-xs'
                      : 'text-[#655d69] hover:text-[#1f1b20] hover:bg-[#fcf8fd]'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  {/* Active Indicator Bar on Left */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-md bg-gradient-to-b from-[#9c4126] to-[#f27438]" />
                  )}

                  {/* Colorful Icon Container */}
                  <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-[#3b1e4a]' : 'text-[#1f1b20]'}`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${item.badgeTone}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#7c747f] truncate">
                        {item.description}
                      </div>
                    </div>
                  )}
                </button>

                {/* Floating Tooltip When Collapsed */}
                {sidebarCollapsed && hoveredCollapsedItem === item.id && (
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 bg-[#1f1b20] text-white px-3 py-2 rounded-xl text-xs whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-mono text-[#fbbd9c]">{item.badge}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400">{item.description}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Solver Telemetry Box */}
        {!sidebarCollapsed && (
          <div className="p-3.5 border-t border-[#ece6ed]">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#f0fbf4] via-white to-[#e8f7ee] border border-[#ece6ed] space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#18794e] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#18794e] animate-pulse" />
                  SAT EQUILIBRIUM
                </span>
                <span className="text-[#18794e] font-bold">99.98%</span>
              </div>
              <div className="w-full bg-[#e2f1e7] h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-[#18794e] via-[#25a26c] to-[#f27438] h-full w-[99.98%] rounded-full" />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-[#655d69]">
                <span>0 Hard Clashes</span>
                <span className="text-[#18794e] font-semibold">1.24ms SAT</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions: Sign Out */}
        <div className="p-3 border-t border-[#ece6ed] bg-[#fbf8fc]">
          <button
            onClick={onSignOut}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold text-[#7c747f] hover:text-[#9c4126] hover:bg-[#fff2ee] transition-all cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0 text-[#9c4126]" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar with Contextual Breadcrumbs & Global Search */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#ece6ed] px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Hamburger Button for Mobile Drawer & Desktop Expand */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileDrawerOpen(true);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-2 rounded-xl bg-[#f6f2f7] hover:bg-[#ece6ed] text-[#1f1b20] transition-colors focus:outline-none cursor-pointer"
              aria-label="Toggle Navigation Menu"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5 text-[#3b1e4a]" />
            </button>

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[#7c747f] hidden sm:inline">SmartGrid</span>
              <span className="text-[#ece6ed] hidden sm:inline">/</span>
              <span className="font-bold text-[#1f1b20] flex items-center gap-1.5">
                {currentItem.label}
              </span>
              <span className="text-[10px] font-mono text-[#18794e] font-bold bg-[#eaf8f0] px-2 py-0.5 rounded hidden md:inline">
                ACTIVE_NODE
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Command search trigger pill */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f6f2f7] hover:bg-[#ece6ed] border border-[#ece6ed] text-xs text-[#655d69] transition-all cursor-pointer"
              title="Quick Search"
            >
              <Search className="w-3.5 h-3.5 text-[#7c747f]" />
              <span className="text-[11px] font-medium">Search modules...</span>
              <kbd className="text-[9px] font-mono bg-white px-1.5 py-0.5 rounded text-[#7c747f] border border-[#ece6ed]">
                ⌘K
              </kbd>
            </button>

            {/* Run Optimizer Quick CTA */}
            <button
              onClick={() => handleItemClick('generator')}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fed8c8]" />
              <span className="hidden sm:inline">Run</span> Optimizer
            </button>

            {/* User Avatar Chip */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#ece6ed]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center text-xs font-mono font-bold shadow-xs">
                {activeUser.name[0]}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-[#1f1b20] leading-tight">
                  {activeUser.name}
                </div>
                <div className="text-[10px] text-[#7c747f] leading-tight">
                  {activeUser.role.split(' ')[0]}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Ambient Canvas Glows */}
        <div className="relative flex-1">
          <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-tr from-[#ffe6dc]/40 via-[#fde2e4]/30 to-[#f3e8f8]/20 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-80 right-10 w-96 h-96 bg-gradient-to-br from-[#edd5f2]/30 via-[#e2f1ea]/30 to-[#fdf0e6]/25 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Child Viewport with Smooth Transition */}
          <motion.div
            key={activeRoute}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
