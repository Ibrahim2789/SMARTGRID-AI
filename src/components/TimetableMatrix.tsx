import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule, getDepartmentBlockClass } from '../data/solverAdapter';
import { exportTimetableToExcel, exportTimetableToCSV } from '../services/timetableExporter';
import { ClassItem } from './ClassDetailsModal';
import { DayOfWeek } from '../types/institutional';
import { X, ChevronDown, Check, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';

interface TimetableMatrixProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const TimetableMatrix: React.FC<TimetableMatrixProps> = () => {
  const store = useInstitutionalData();
  const { scheduleData, conflicts } = buildMatrixSchedule(store);

  const [viewBy, setViewBy] = useState<'all' | 'department' | 'room' | 'instructor' | 'group'>('all');
  const [filterValue, setFilterValue] = useState<string>('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ClassItem | null>(null);

  // Edit side panel state for a block
  const [editDay, setEditDay] = useState<DayOfWeek>('Mon');
  const [editSlot, setEditSlot] = useState<string>('09:00 - 10:30');
  const [editRoomId, setEditRoomId] = useState<string>('');

  const days = store.timeStructure.workingDays;
  const periods = store.timeStructure.periods;

  const handleOpenBlock = (cls: ClassItem) => {
    setSelectedBlock(cls);
    setEditDay(cls.day as DayOfWeek || 'Mon');
    setEditSlot(cls.time || periods[0]);
    const currentRoom = store.rooms.find(r => r.code === cls.room);
    setEditRoomId(currentRoom?.id || store.rooms[0]?.id || '');
  };

  const handleSaveSlotMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock) return;

    institutionalStore.updateSectionSlot(selectedBlock.id, {
      day: editDay,
      timeSlot: editSlot,
      roomId: editRoomId
    });

    setSelectedBlock(null);
  };

  const handlePublish = () => {
    if (conflicts.length > 0) return;
    setPublishSuccess(true);
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  const handleExport = async (format: string) => {
    setExportOpen(false);
    if (format === 'excel') {
      await exportTimetableToExcel(store, viewBy === 'department' ? filterValue : undefined);
      return;
    }
    if (format === 'csv') {
      exportTimetableToCSV(store);
      return;
    }
    if (format === 'ical') {
      let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SmartGrid AI//Timetable//EN\n';
      store.sections.forEach(s => {
        if (!s.assignedSlot) return;
        const c = store.courses.find(item => item.id === s.courseId);
        icsContent += `BEGIN:VEVENT\nSUMMARY:${c?.code} - ${c?.title}\nDESCRIPTION:Day: ${s.assignedSlot.day}, Slot: ${s.assignedSlot.timeSlot}\nEND:VEVENT\n`;
      });
      icsContent += 'END:VCALENDAR';
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timetable_calendar.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Filter logic
  const filterClass = (cls: ClassItem) => {
    if (filterValue === 'all') return true;
    if (viewBy === 'department') {
      const course = store.courses.find(c => c.code === cls.code);
      return course?.departmentId === filterValue;
    }
    if (viewBy === 'room') return cls.room === filterValue;
    if (viewBy === 'instructor') return cls.prof === filterValue;
    if (viewBy === 'group') return cls.cohort === filterValue;
    return true;
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-8 md:py-10 space-y-6">
      {/* Page Title & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8EAEE]">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
            Timetables
          </h1>
          <p className="text-[16px] text-[#556070] mt-1">
            Weekly campus master schedule and room allocation matrix.
          </p>
        </div>

        {/* Toolbar: One View-by Dropdown + Outlined Export Menu + ONE Primary Action (Publish) */}
        <div className="flex items-center gap-3">
          {/* View-by Selector */}
          <div className="flex items-center gap-2">
            <select
              value={viewBy}
              onChange={e => {
                setViewBy(e.target.value as any);
                setFilterValue('all');
              }}
              className="form-input text-[14px] !h-[44px] !w-auto"
            >
              <option value="all">View all</option>
              <option value="department">View by Department</option>
              <option value="room">View by Room</option>
              <option value="instructor">View by Instructor</option>
              <option value="group">View by Student Group</option>
            </select>

            {/* Sub-filter if viewBy is not 'all' */}
            {viewBy === 'department' && (
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="form-input text-[14px] !h-[44px] !w-auto"
              >
                <option value="all">All Departments</option>
                {store.departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            {viewBy === 'room' && (
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="form-input text-[14px] !h-[44px] !w-auto"
              >
                <option value="all">All Rooms</option>
                {store.rooms.map(r => (
                  <option key={r.id} value={r.code}>{r.code}</option>
                ))}
              </select>
            )}

            {viewBy === 'instructor' && (
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="form-input text-[14px] !h-[44px] !w-auto"
              >
                <option value="all">All Instructors</option>
                {store.instructors.map(i => (
                  <option key={i.id} value={i.name}>{i.name}</option>
                ))}
              </select>
            )}

            {viewBy === 'group' && (
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="form-input text-[14px] !h-[44px] !w-auto"
              >
                <option value="all">All Groups</option>
                {store.studentGroups.map(g => (
                  <option key={g.id} value={g.code}>{g.code}</option>
                ))}
              </select>
            )}
          </div>

          {/* Export Outlined Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="btn-secondary"
            >
              <Download className="w-4 h-4 text-[#556070]" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7A8594]" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-[#E8EAEE] rounded-md shadow-lg py-1 z-30 text-[14px]">
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F6F7F9] text-[#1B2430] cursor-pointer flex items-center gap-2 font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#059669]" />
                  <span>Export Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] text-[#556070] hover:text-[#1B2430] cursor-pointer"
                >
                  Export CSV (.csv)
                </button>
                <button
                  onClick={() => handleExport('ical')}
                  className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] text-[#556070] hover:text-[#1B2430] cursor-pointer"
                >
                  Export iCalendar (.ics)
                </button>
              </div>
            )}
          </div>

          {/* ONE Primary Action: Publish (disabled with tooltip while conflicts remain) */}
          <div className="relative group">
            <button
              onClick={handlePublish}
              disabled={conflicts.length > 0}
              className="btn-primary"
            >
              Publish
            </button>
            {conflicts.length > 0 && (
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-[#1B2430] text-white text-[13px] rounded shadow-md pointer-events-none z-40">
                Publish is disabled because {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} remain to be resolved.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Banner */}
      {publishSuccess && (
        <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md text-[15px] text-[#15803D] flex items-center gap-2">
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Timetable published successfully. Synced to institutional registry.</span>
        </div>
      )}

      {/* Hero: Master Week Grid */}
      <div className="content-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F6F7F9] border-b border-[#E8EAEE]">
                <th className="py-3.5 px-4 font-semibold text-[14px] text-[#556070] w-36 border-r border-[#E8EAEE]">
                  Time period
                </th>
                {days.map(day => (
                  <th key={day} className="py-3.5 px-4 font-semibold text-[14px] text-[#1B2430] border-r border-[#E8EAEE] min-w-[190px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAEE]">
              {periods.map(period => (
                <tr key={period} className="hover:bg-[#FDFDFD]">
                  {/* Period Time Column */}
                  <td className="py-3.5 px-4 font-mono text-[14px] font-medium text-[#556070] bg-[#F6F7F9] border-r border-[#E8EAEE] align-top">
                    {period}
                  </td>

                  {/* Day Columns */}
                  {days.map(day => {
                    const classes = (scheduleData[period]?.[day] || []).filter(filterClass);
                    return (
                      <td key={day} className="py-2.5 px-3 border-r border-[#E8EAEE] align-top h-[110px]">
                        {classes.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-[13px] text-[#D5D9E0]">
                            —
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {classes.map(cls => {
                              const blockColor = getDepartmentBlockClass(cls.code);
                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => handleOpenBlock(cls)}
                                  className={`${blockColor} p-2.5 rounded-md text-left cursor-pointer hover:shadow-xs transition-shadow`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[14px] font-bold">
                                      {cls.code}
                                    </span>
                                    <span className="font-mono text-[13px] text-[#556070]">
                                      {cls.room}
                                    </span>
                                  </div>
                                  <div className="text-[14px] font-medium text-[#1B2430] truncate mt-0.5">
                                    {cls.title}
                                  </div>
                                  <div className="text-[13px] text-[#556070] truncate mt-1">
                                    {cls.prof} • {cls.cohort}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Slide-Out Panel to Edit or Move a Block */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
          <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col justify-between p-6 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E8EAEE]">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#1B2430]">
                    {selectedBlock.code}
                  </h3>
                  <p className="text-[14px] text-[#556070] mt-0.5">
                    {selectedBlock.title}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="text-[#7A8594] hover:text-[#1B2430] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Details List */}
              <div className="py-4 space-y-3 text-[14px] border-b border-[#E8EAEE]">
                <div className="flex justify-between">
                  <span className="text-[#7A8594]">Instructor</span>
                  <span className="font-medium text-[#1B2430]">{selectedBlock.prof}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A8594]">Student Cohort</span>
                  <span className="font-medium text-[#1B2430]">{selectedBlock.cohort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A8594]">Enrollment</span>
                  <span className="font-mono text-[#1B2430]">{selectedBlock.enrolled} / {selectedBlock.capacity} seats</span>
                </div>
              </div>

              {/* Edit / Move Form */}
              <form id="moveForm" onSubmit={handleSaveSlotMove} className="space-y-4 pt-4">
                <h4 className="text-[15px] font-semibold text-[#1B2430]">
                  Reallocate slot or room
                </h4>

                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Day of week
                  </label>
                  <select
                    value={editDay}
                    onChange={e => setEditDay(e.target.value as DayOfWeek)}
                    className="form-input"
                  >
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Time period
                  </label>
                  <select
                    value={editSlot}
                    onChange={e => setEditSlot(e.target.value)}
                    className="form-input font-mono"
                  >
                    {periods.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1B2430] mb-1.5">
                    Allocated room
                  </label>
                  <select
                    value={editRoomId}
                    onChange={e => setEditRoomId(e.target.value)}
                    className="form-input"
                  >
                    {store.rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.code} ({r.name}) — Cap: {r.capacity}
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#E8EAEE] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="moveForm"
                className="btn-primary"
              >
                Update allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
