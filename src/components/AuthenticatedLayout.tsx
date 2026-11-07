import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { Menu, X, LogOut } from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Normalize legacy routes to the 6 primary routes
  const normalizeRoute = (r: RouteType): RouteType => {
    if (r === 'portal' || r === 'solutions') return 'home';
    if (r === 'timetable') return 'timetables';
    if (r === 'generator' || r === 'adaptive-engine') return 'generate';
    if (r === 'student-voice') return 'feedback';
    if (r === 'case-studies') return 'settings';
    return r;
  };

  const normalizedActive = normalizeRoute(activeRoute);

  const navItems: { id: RouteType; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'setup', label: 'Setup' },
    { id: 'generate', label: 'Generate' },
    { id: 'timetables', label: 'Timetables' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'settings', label: 'Settings' }
  ];

  const handleNavClick = (route: RouteType) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const user = currentUser || {
    name: 'Dr. Katherine Reynolds',
    role: 'Registrar',
    email: 'k.reynolds@westernpoly.edu',
    institution: 'Western Polytechnic'
  };

  return (
    <div className="min-h-screen bg-white text-[#1B2430] flex flex-col md:flex-row antialiased">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between h-[56px] px-5 border-b border-[#E8EAEE] bg-white sticky top-0 z-40">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleNavClick('home')}
        >
          <div className="w-5 h-5 rounded bg-[#FFC400] flex items-center justify-center font-bold text-xs text-[#1B2430]">
            S
          </div>
          <span className="font-semibold text-[17px] text-[#1B2430] tracking-tight">SmartGrid</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#556070] hover:text-[#1B2430] cursor-pointer"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E8EAEE] p-4 space-y-1 z-30">
          {navItems.map(item => {
            const isActive = normalizedActive === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-2.5 text-[15px] transition-colors cursor-pointer flex items-center gap-2.5 ${
                  isActive 
                    ? 'font-semibold text-[#1B2430] bg-[#F6F7F9] border-l-[3px] border-[#FFC400]' 
                    : 'text-[#556070] hover:text-[#1B2430] hover:bg-[#F6F7F9]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-4 mt-2 border-t border-[#E8EAEE] flex items-center justify-between px-4">
            <div>
              <div className="text-[14px] font-medium text-[#1B2430]">{user.name}</div>
              <div className="text-[13px] text-[#7A8594]">{user.role}</div>
            </div>
            <button
              onClick={onSignOut}
              className="text-[14px] text-[#DC2626] hover:underline cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar (240px wide, pure white, border-r #E8EAEE) */}
      <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-[#E8EAEE] bg-white min-h-screen sticky top-0 h-screen select-none">
        {/* Brand */}
        <div className="h-[64px] px-6 flex items-center gap-2.5 border-b border-[#E8EAEE]">
          <div className="w-5 h-5 rounded bg-[#FFC400] flex items-center justify-center font-bold text-xs text-[#1B2430]">
            S
          </div>
          <span 
            onClick={() => handleNavClick('home')}
            className="font-semibold text-[17px] text-[#1B2430] tracking-tight cursor-pointer"
          >
            SmartGrid
          </span>
        </div>

        {/* 6 Navigation Items */}
        <nav className="flex-1 py-4 space-y-0.5">
          {navItems.map(item => {
            const isActive = normalizedActive === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-6 py-2.5 text-[15px] flex items-center relative transition-colors cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#1B2430] ${
                  isActive 
                    ? 'font-semibold text-[#1B2430] bg-[#F6F7F9]' 
                    : 'text-[#556070] hover:text-[#1B2430] hover:bg-[#F6F7F9]'
                }`}
              >
                {/* Active Indicator: 3px yellow bar on its left */}
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FFC400]" />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile & Sign Out at Bottom */}
        <div className="p-5 border-t border-[#E8EAEE] bg-white">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5 pr-2">
              <div className="text-[14px] font-semibold text-[#1B2430] truncate">
                {user.name}
              </div>
              <div className="text-[13px] text-[#7A8594] truncate">
                {user.role}
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              className="text-[#7A8594] hover:text-[#DC2626] transition-colors p-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 bg-white">
        {children}
      </main>
    </div>
  );
};
