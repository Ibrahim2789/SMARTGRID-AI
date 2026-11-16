import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { Search, X } from 'lucide-react';

interface GlobalSearchProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIdx: number) => void;
  variant?: 'topbar' | 'compact';
}

type SearchCategory = 'cohorts' | 'departments' | 'courses' | 'faculty' | 'rooms';

interface SearchResultItem {
  id: string;
  category: SearchCategory;
  categoryLabel: string;
  title: string;
  subtitle: string;
  onSelect: () => void;
}

const CALM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onNavigate,
  onOpenSetupStep,
  variant = 'topbar'
}) => {
  const store = useInstitutionalData();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts: Cmd+K / Ctrl+K / '/' focuses inline input directly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus compact mobile input when toggled open
  useEffect(() => {
    if (variant === 'compact' && isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [variant, isOpen]);

  // Close anchored dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Live filtered results across cohorts, departments, courses, faculty, and rooms
  const searchResults: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    // 1. Batches & Sections
    store.studentGroups.forEach(group => {
      const match =
        !q ||
        group.code.toLowerCase().includes(q) ||
        group.name.toLowerCase().includes(q) ||
        (group.batchCode && group.batchCode.toLowerCase().includes(q)) ||
        (group.semester && `semester ${group.semester}`.includes(q));

      if (match) {
        const prog = store.programs.find(p => p.id === group.programId);
        const dept = store.departments.find(d => d.id === prog?.departmentId);
        items.push({
          id: `group-${group.id}`,
          category: 'cohorts',
          categoryLabel: 'Cohort',
          title: group.code,
          subtitle: `${group.name}${dept ? ` · ${dept.code}` : ''}${group.semester ? ` · Sem ${group.semester}` : ''}`,
          onSelect: () => {
            institutionalStore.setSelectedClassGroupId(group.id);
            onNavigate('timetables');
            setIsOpen(false);
            inputRef.current?.blur();
          }
        });
      }
    });

    // 2. Departments
    store.departments.forEach(dept => {
      const match =
        !q ||
        dept.name.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q);

      if (match) {
        const deptSectionsCount = store.studentGroups.filter(g => {
          const prog = store.programs.find(p => p.id === g.programId);
          return prog?.departmentId === dept.id;
        }).length;

        items.push({
          id: `dept-${dept.id}`,
          category: 'departments',
          categoryLabel: 'Department',
          title: `${dept.code} — ${dept.name}`,
          subtitle: `${deptSectionsCount} ${deptSectionsCount === 1 ? 'Section' : 'Sections'}${dept.school ? ` · ${dept.school}` : ''}`,
          onSelect: () => {
            const firstGroupInDept = store.studentGroups.find(g => {
              const prog = store.programs.find(p => p.id === g.programId);
              return prog?.departmentId === dept.id;
            });
            if (firstGroupInDept) {
              institutionalStore.setSelectedClassGroupId(firstGroupInDept.id);
            }
            onNavigate('timetables');
            setIsOpen(false);
            inputRef.current?.blur();
          }
        });
      }
    });

    // 3. Courses
    store.courses.forEach(course => {
      const match =
        !q ||
        course.code.toLowerCase().includes(q) ||
        (course.title && course.title.toLowerCase().includes(q));

      if (match) {
        const isLabCourse = course.requiredRoomType === 'lab';
        const dept = store.departments.find(d => d.id === course.departmentId);
        items.push({
          id: `course-${course.id}`,
          category: 'courses',
          categoryLabel: 'Course',
          title: `${course.code} — ${course.title}`,
          subtitle: `${course.creditHours} Credits${dept ? ` · ${dept.code}` : ''}${isLabCourse ? ' · Lab-Integrated' : ''}`,
          onSelect: () => {
            if (onOpenSetupStep) {
              onOpenSetupStep(2);
            } else {
              onNavigate('setup');
            }
            setIsOpen(false);
            inputRef.current?.blur();
          }
        });
      }
    });

    // 4. Faculty & Instructors
    store.instructors.forEach(inst => {
      const match =
        !q ||
        inst.name.toLowerCase().includes(q) ||
        (inst.title && inst.title.toLowerCase().includes(q)) ||
        (inst.email && inst.email.toLowerCase().includes(q));

      if (match) {
        const dept = store.departments.find(d => d.id === inst.departmentId);
        items.push({
          id: `inst-${inst.id}`,
          category: 'faculty',
          categoryLabel: 'Faculty',
          title: inst.name,
          subtitle: `${inst.title || 'Faculty'}${dept ? ` · ${dept.code}` : ''}`,
          onSelect: () => {
            onNavigate('timetables');
            setIsOpen(false);
            inputRef.current?.blur();
          }
        });
      }
    });

    // 5. Classrooms & Laboratories
    store.rooms.forEach(room => {
      const match =
        !q ||
        room.code.toLowerCase().includes(q) ||
        room.name.toLowerCase().includes(q) ||
        (room.type && room.type.toLowerCase().includes(q));

      if (match) {
        items.push({
          id: `room-${room.id}`,
          category: 'rooms',
          categoryLabel: room.type === 'lab' ? 'Lab' : 'Room',
          title: room.code,
          subtitle: `${room.name} · ${room.capacity} seats`,
          onSelect: () => {
            onNavigate('timetables');
            setIsOpen(false);
            inputRef.current?.blur();
          }
        });
      }
    });

    return items.slice(0, 10);
  }, [query, store, onNavigate, onOpenSetupStep]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, searchResults.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        searchResults[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const renderDropdownResults = () => (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: CALM_EASE }}
          role="listbox"
          aria-label="Search suggestions"
          className={
            variant === 'compact'
              ? 'fixed left-4 right-4 top-16 z-50 bg-white border border-[#E4E2DA] rounded-xl shadow-xl overflow-hidden'
              : 'absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#E4E2DA] rounded-xl shadow-lg overflow-hidden'
          }
        >
          {variant === 'compact' && (
            <div className="px-3 py-2 border-b border-[#E4E2DA] bg-[#F7F6EF] flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDownInput}
                placeholder="Search departments, cohorts, courses, faculty..."
                className="w-full bg-transparent text-xs font-medium text-[#171717] placeholder:text-[#77766F] focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-0.5 text-[#77766F] hover:text-[#171717] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-[#F0EFEA]">
            {searchResults.length > 0 ? (
              searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={e => {
                      // Trigger before input blur closes dropdown
                      e.preventDefault();
                      item.onSelect();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#F7F6EF]' : 'bg-white hover:bg-[#F7F6EF]/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#171717] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#77766F] truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-[#77766F] shrink-0 whitespace-nowrap">
                      {item.categoryLabel}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center">
                <div className="text-xs font-medium text-[#171717]">
                  {query.trim()
                    ? `No matching records for "${query.trim()}"`
                    : 'No catalog records yet'}
                </div>
                <div className="text-[11px] text-[#77766F] mt-1">
                  {query.trim()
                    ? 'Try a department code, cohort, course, instructor, or room.'
                    : 'Add or import departments, courses, rooms, faculty, or cohorts to search them here.'}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (variant === 'compact') {
    return (
      <MotionConfig reducedMotion="user">
        <div ref={containerRef} className="relative z-40">
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="w-8 h-8 rounded-lg bg-[#292929] hover:bg-[#333333] border border-[#3E3E3E] text-[#C2C0B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Search academic records"
            aria-label="Search academic records"
            aria-expanded={isOpen}
          >
            <Search className="w-4 h-4" />
          </button>
          {renderDropdownResults()}
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={containerRef}
        onBlur={e => {
          if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
            setIsOpen(false);
          }
        }}
        className="relative z-40 w-full max-w-md"
      >
        <div
          className={`h-9 px-3 w-full rounded-xl border flex items-center gap-2 transition-colors ${
            isOpen
              ? 'bg-white border-[#171717]'
              : 'bg-[#F7F6EF] hover:bg-white border-[#E4E2DA]'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={e => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDownInput}
            placeholder="Search departments, cohorts, courses, faculty..."
            aria-label="Search institutional catalog"
            aria-expanded={isOpen}
            className="w-full bg-transparent text-xs font-medium text-[#171717] placeholder:text-[#77766F] focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-0.5 text-[#77766F] hover:text-[#171717] rounded-sm cursor-pointer shrink-0"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {renderDropdownResults()}
      </div>
    </MotionConfig>
  );
};
