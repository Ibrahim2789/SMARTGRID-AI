import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type RouteType = 
  | 'home' 
  | 'setup' 
  | 'generate' 
  | 'timetables' 
  | 'feedback' 
  | 'settings'
  // Legacy aliases
  | 'portal' 
  | 'timetable' 
  | 'generator' 
  | 'adaptive-engine' 
  | 'student-voice' 
  | 'case-studies' 
  | 'solutions';

interface SmartGridNavProps {
  activeRoute?: RouteType;
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
}

export const SmartGridNav: React.FC<SmartGridNavProps> = ({ 
  activeRoute = 'home',
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser = null
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Normalize legacy routes
  const normalizeRoute = (r: RouteType): RouteType => {
    if (r === 'portal' || r === 'solutions') return 'home';
    if (r === 'timetable') return 'timetables';
    if (r === 'generator' || r === 'adaptive-engine') return 'generate';
    if (r === 'student-voice') return 'feedback';
    if (r === 'case-studies') return 'settings';
    return r;
  };

  const normalizedActive = normalizeRoute(activeRoute);

  const navLinks: { id: RouteType; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'setup', label: 'Setup' },
    { id: 'generate', label: 'Generate' },
    { id: 'timetables', label: 'Timetables' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'settings', label: 'Settings' }
  ];

  const handleNavClick = (id: RouteType) => {
    onNavigate?.(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E8EAEE] h-[56px] px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        {/* Brand */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => handleNavClick('home')}
        >
          <div className="w-5 h-5 rounded bg-[#FFC400] flex items-center justify-center font-bold text-xs text-[#1B2430]">
            S
          </div>
          <span className="font-semibold text-[17px] text-[#1B2430] tracking-tight">
            SmartGrid
          </span>
        </div>

        {/* Desktop 6-item Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const isActive = normalizedActive === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`relative px-3.5 py-1.5 text-[15px] font-medium transition-colors cursor-pointer rounded-sm ${
                  isActive 
                    ? 'text-[#1B2430] font-semibold' 
                    : 'text-[#556070] hover:text-[#1B2430] hover:bg-[#F6F7F9]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-[-14px] left-0 right-0 h-[3px] bg-[#FFC400]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-4">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-[#556070] hidden sm:inline">
              {currentUser.name}
            </span>
            <button
              onClick={onSignOut}
              className="text-[14px] text-[#556070] hover:text-[#1B2430] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenAuth?.('signin')}
            className="btn-secondary h-[38px] px-3.5 text-[14px]"
          >
            Sign in
          </button>
        )}

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 text-[#556070] hover:text-[#1B2430] cursor-pointer"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[56px] left-0 right-0 bg-white border-b border-[#E8EAEE] p-4 shadow-sm space-y-1 z-50">
          {navLinks.map(link => {
            const isActive = normalizedActive === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`w-full text-left px-3 py-2.5 text-[15px] rounded-md transition-colors cursor-pointer ${
                  isActive 
                    ? 'font-semibold text-[#1B2430] bg-[#F6F7F9] border-l-3 border-[#FFC400]' 
                    : 'text-[#556070] hover:bg-[#F6F7F9]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
