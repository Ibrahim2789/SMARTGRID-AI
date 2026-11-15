import ExcelJS from 'exceljs';
import { InstitutionalDataStore } from '../data/store';

export async function exportTimetableToExcel(store: InstitutionalDataStore, filterDeptId?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartGrid AI Scheduler';
  workbook.lastModifiedBy = 'Academic Registrar';
  workbook.created = new Date();

  // Find classes to export
  let targetGroups = store.studentGroups;
  if (filterDeptId && filterDeptId !== 'all') {
    targetGroups = store.studentGroups.filter(g => {
      const prog = store.programs.find(p => p.id === g.programId);
      return prog?.departmentId === filterDeptId;
    });
  }

  const days = store.timeStructure.workingDays;
  const periods = store.timeStructure.periods;

  // Department color palette for pastel Excel fills
  const getDeptFillColor = (code: string) => {
    if (code.startsWith('CS') || code.startsWith('SE') || code.startsWith('AI') || code.startsWith('DS')) {
      return 'FFE0F2FE'; // Sky blue
    }
    if (code.startsWith('EE') || code.startsWith('EL')) {
      return 'FFDBEAFE'; // Light blue
    }
    if (code.startsWith('BA') || code.startsWith('AF') || code.startsWith('MG') || code.startsWith('MK')) {
      return 'FFFEF3C7'; // Amber
    }
    if (code.startsWith('MT') || code.startsWith('PH') || code.startsWith('CH')) {
      return 'FFDCFCE7'; // Mint green
    }
    if (code.startsWith('CE') || code.startsWith('AR')) {
      return 'FFFFEDD5'; // Warm peach
    }
    return 'FFF3F4F6'; // Neutral slate
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  // Helper to get classes for a group on a day
  const getDayClassesForGroup = (groupId: string, day: string) => {
    return store.sections.filter(s => s.studentGroupId === groupId && s.assignedSlot?.day === day);
  };

  // 1. Sheet 1: "All classes" (Stacked with title bars and page breaks)
  const masterSheet = workbook.addWorksheet('All classes', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  masterSheet.columns = [
    { width: 18 }, // Period / Time
    { width: 28 }, // Mon
    { width: 28 }, // Tue
    { width: 28 }, // Wed
    { width: 28 }, // Thu
    { width: 28 }  // Fri
  ];

  targetGroups.forEach((group, gIdx) => {
    const prog = store.programs.find(p => p.id === group.programId);
    const dept = store.departments.find(d => d.id === prog?.departmentId);

    // Title Bar Row
    const titleRow = masterSheet.addRow([
      `${dept?.name || 'Department'} — ${group.name} (${group.code}) | ${group.size} Students | Term 2 (Spring 2026)`
    ]);
    const titleRowNumber = titleRow.number;
    masterSheet.mergeCells(titleRowNumber, 1, titleRowNumber, 6);
    titleRow.height = 28;
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2A37' } // Dark blue / slate
    };
    titleRow.getCell(1).font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Header Row
    const headerRow = masterSheet.addRow(['Time Period', ...days.map(d => {
      switch (d) {
        case 'Mon': return 'Monday';
        case 'Tue': return 'Tuesday';
        case 'Wed': return 'Wednesday';
        case 'Thu': return 'Thursday';
        case 'Fri': return 'Friday';
        default: return d;
      }
    })]);
    headerRow.height = 22;
    for (let c = 1; c <= 6; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
      cell.border = thinBorder;
    }

    // Grid Rows for periods
    periods.forEach(period => {
      const rowValues: any[] = [period];

      days.forEach(day => {
        const sec = store.sections.find(
          s => s.studentGroupId === group.id && s.assignedSlot?.day === day && s.assignedSlot?.timeSlot === period
        );

        if (sec) {
          const course = store.courses.find(c => c.id === sec.courseId);
          const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
          const inst = store.instructors.find(i => i.id === sec.instructorId);

          rowValues.push({
            isClass: true,
            code: course?.code || 'CRS',
            title: course?.title || 'Class',
            room: room?.code || 'TBD',
            prof: inst?.name || 'Faculty',
            deptCode: course?.code || 'GEN'
          });
        } else {
          const dayClasses = getDayClassesForGroup(group.id, day);
          const freeType = dayClasses.length <= 1 ? 'Industrial visit' : 'Library time';
          rowValues.push({
            isClass: false,
            label: freeType
          });
        }
      });

      const periodRow = masterSheet.addRow([
        rowValues[0], 
        ...rowValues.slice(1).map(v => typeof v === 'string' ? v : (v.isClass ? `${v.code}\n${v.title}\n${v.room} • ${v.prof}` : v.label))
      ]);
      periodRow.height = 54;

      // Format Period Column
      const pCell = periodRow.getCell(1);
      pCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
      pCell.alignment = { vertical: 'middle', horizontal: 'center' };
      pCell.border = thinBorder;

      // Format Days
      for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
        const colIdx = dayIdx + 2;
        const cell = periodRow.getCell(colIdx);
        const data = rowValues[colIdx - 1];

        cell.border = thinBorder;
        if (data && data.isClass) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: getDeptFillColor(data.deptCode) }
          };
          cell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF0F172A' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        } else {
          cell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });

    // Empty buffer row after each group
    const spacerRow = masterSheet.addRow([]);
    spacerRow.height = 16;

    // Add page break after each group (except last)
    if (gIdx < targetGroups.length - 1) {
      spacerRow.addPageBreak();
    }
  });

  // 2. Sheets 2..N: One sheet per class
  targetGroups.forEach(group => {
    const sheetName = group.code.replace(/[:\\/?*\[\]]/g, '-').slice(0, 30);
    const classSheet = workbook.addWorksheet(sheetName, {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      }
    });

    classSheet.columns = [
      { width: 18 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 28 }
    ];

    const prog = store.programs.find(p => p.id === group.programId);
    const dept = store.departments.find(d => d.id === prog?.departmentId);

    // Title Row
    const titleRow = classSheet.addRow([
      `WESTERN POLYTECHNIC INSTITUTE — ${group.name} (${group.code})`
    ]);
    classSheet.mergeCells(titleRow.number, 1, titleRow.number, 6);
    titleRow.height = 28;
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2A37' }
    };
    titleRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Subtitle Row
    const subRow = classSheet.addRow([
      `Department: ${dept?.name || 'Engineering'} | Program: ${prog?.name || 'Degree'} | Cohort Size: ${group.size} | Academic Term: Term 2 (Spring 2026)`
    ]);
    classSheet.mergeCells(subRow.number, 1, subRow.number, 6);
    subRow.height = 20;
    subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    subRow.getCell(1).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Header Row
    const headerRow = classSheet.addRow(['Time Period', ...days.map(d => {
      switch (d) {
        case 'Mon': return 'Monday';
        case 'Tue': return 'Tuesday';
        case 'Wed': return 'Wednesday';
        case 'Thu': return 'Thursday';
        case 'Fri': return 'Friday';
        default: return d;
      }
    })]);
    headerRow.height = 22;
    for (let c = 1; c <= 6; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
      cell.border = thinBorder;
    }

    // Grid Rows
    periods.forEach(period => {
      const rowValues: any[] = [period];

      days.forEach(day => {
        const sec = store.sections.find(
          s => s.studentGroupId === group.id && s.assignedSlot?.day === day && s.assignedSlot?.timeSlot === period
        );

        if (sec) {
          const course = store.courses.find(c => c.id === sec.courseId);
          const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
          const inst = store.instructors.find(i => i.id === sec.instructorId);

          rowValues.push({
            isClass: true,
            code: course?.code || 'CRS',
            title: course?.title || 'Class',
            room: room?.code || 'TBD',
            prof: inst?.name || 'Faculty',
            deptCode: course?.code || 'GEN'
          });
        } else {
          const dayClasses = getDayClassesForGroup(group.id, day);
          const freeType = dayClasses.length <= 1 ? 'Industrial visit' : 'Library time';
          rowValues.push({
            isClass: false,
            label: freeType
          });
        }
      });

      const periodRow = classSheet.addRow([
        rowValues[0], 
        ...rowValues.slice(1).map(v => typeof v === 'string' ? v : (v.isClass ? `${v.code}\n${v.title}\n${v.room} • ${v.prof}` : v.label))
      ]);
      periodRow.height = 56;

      const pCell = periodRow.getCell(1);
      pCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
      pCell.alignment = { vertical: 'middle', horizontal: 'center' };
      pCell.border = thinBorder;

      for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
        const colIdx = dayIdx + 2;
        const cell = periodRow.getCell(colIdx);
        const data = rowValues[colIdx - 1];

        cell.border = thinBorder;
        if (data && data.isClass) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: getDeptFillColor(data.deptCode) }
          };
          cell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF0F172A' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        } else {
          cell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });
  });

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const termCode = store.terms.find(t => t.status === 'active')?.code || 'Spring_2026';
  a.download = `Timetable_Master_${termCode}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTimetableToCSV(store: InstitutionalDataStore) {
  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += 'Course Code,Course Title,Room,Instructor,Student Cohort,Day,Time Slot,Type,Credits\n';

  store.sections.forEach(sec => {
    if (!sec.assignedSlot) return;
    const course = store.courses.find(c => c.id === sec.courseId);
    const room = store.rooms.find(r => r.id === sec.assignedSlot?.roomId);
    const inst = store.instructors.find(i => i.id === sec.instructorId);
    const group = store.studentGroups.find(g => g.id === sec.studentGroupId);

    const code = `"${(course?.code || '').replace(/"/g, '""')}"`;
    const title = `"${(course?.title || '').replace(/"/g, '""')}"`;
    const roomCode = `"${(room?.code || '').replace(/"/g, '""')}"`;
    const prof = `"${(inst?.name || '').replace(/"/g, '""')}"`;
    const cohort = `"${(group?.code || '').replace(/"/g, '""')}"`;
    const day = `"${sec.assignedSlot.day}"`;
    const time = `"${sec.assignedSlot.timeSlot}"`;
    const type = `"${course?.requiredRoomType || 'lecture'}"`;
    const credits = course?.creditHours || 3;

    csvContent += `${code},${title},${roomCode},${prof},${cohort},${day},${time},${type},${credits}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const termCode = store.terms.find(t => t.status === 'active')?.code || 'Spring_2026';
  a.download = `Timetable_Export_${termCode}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
