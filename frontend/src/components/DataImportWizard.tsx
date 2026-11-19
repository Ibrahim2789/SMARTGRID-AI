import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import ExcelJS from 'exceljs';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileWarning,
  History,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import { institutionalStore } from '../data/store';
import { getStoredUser } from '../services/votingApi';
import {
  commitImportBackendApi,
  fetchImportHistoryBackendApi,
  fetchImportTemplateApi,
  ImportApiError,
  ImportHistoryEntry,
  validateImportBackendApi
} from '../services/importApi';
import {
  buildErrorReportCsv,
  buildStorePayloadFromValidatedRows,
  CATEGORY_SCHEMAS,
  ColumnMappingDetail,
  CsvFormatError,
  detectImportColumnMappings,
  DuplicateHandlingMode,
  ExistingStoreSnapshot,
  generateTemplateCsv,
  ImportCategory,
  MAX_CSV_FILE_BYTES,
  parseCsvTextStrict,
  ValidatedRow,
  validateImportPreviewLocal,
  ValidationReport
} from '../utils/csvImport';

export type { ImportCategory };

interface DataImportWizardProps {
  onClose?: () => void;
  onSuccess?: (summary: string) => void;
  defaultCategory?: ImportCategory;
}

type WizardStep = 'category' | 'upload' | 'mapping' | 'preview' | 'results';
type RowFilter = 'all' | 'error' | 'warning' | 'duplicate' | 'ready';

const CALM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const CATEGORY_ORDER: ImportCategory[] = [
  'departments',
  'rooms',
  'laboratories',
  'instructors',
  'courses',
  'cohorts',
  'enrollments',
  'course_assignments',
  'all'
];

const STEP_LABELS: Array<{ id: WizardStep; num: number; label: string }> = [
  { id: 'category', num: 1, label: 'Category' },
  { id: 'upload', num: 2, label: 'Upload File' },
  { id: 'mapping', num: 3, label: 'Map Columns' },
  { id: 'preview', num: 4, label: 'Validate & Duplicates' },
  { id: 'results', num: 5, label: 'Import Summary' }
];

function triggerCsvDownload(fileName: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function excelCellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map(part =>
          typeof part === 'object' && part && 'text' in part
            ? String((part as { text: unknown }).text ?? '')
            : ''
        )
        .join('')
        .trim();
    }
    if ('text' in obj) return String(obj.text ?? '').trim();
    if ('result' in obj) return String(obj.result ?? '').trim();
  }
  return String(value).trim();
}

function extractSheetTable(worksheet: ExcelJS.Worksheet): { headers: string[]; rows: string[][] } {
  const matrix: string[][] = [];
  let maxCols = 0;

  worksheet.eachRow({ includeEmpty: false }, row => {
    const rawValues = row.values;
    const cells: string[] = [];
    if (Array.isArray(rawValues)) {
      // ExcelJS row.values is 1-indexed (index 0 is undefined)
      for (let c = 1; c < rawValues.length; c++) {
        cells.push(excelCellToString(rawValues[c]));
      }
    }
    if (cells.some(cell => cell !== '')) {
      maxCols = Math.max(maxCols, cells.length);
      matrix.push(cells);
    }
  });

  if (matrix.length === 0) {
    throw new CsvFormatError(`Worksheet "${worksheet.name}" is empty.`);
  }

  const rawHeaders = matrix[0].slice(0, maxCols).map((h, i) => h.trim() || `Column_${i + 1}`);
  while (rawHeaders.length < maxCols) {
    rawHeaders.push(`Column_${rawHeaders.length + 1}`);
  }
  const seen = new Map<string, number>();
  const uniqueHeaders = rawHeaders.map(h => {
    const cnt = (seen.get(h) || 0) + 1;
    seen.set(h, cnt);
    return cnt === 1 ? h : `${h} (${cnt})`;
  });

  const dataRows = matrix.slice(1).filter(r => r.some(c => c !== ''));
  if (dataRows.length === 0) {
    throw new CsvFormatError(
      `Worksheet "${worksheet.name}" has column headers but 0 data rows.`
    );
  }

  const normalizedRows = dataRows.map(r => {
    const padded = r.slice(0, uniqueHeaders.length);
    while (padded.length < uniqueHeaders.length) padded.push('');
    return padded;
  });

  return { headers: uniqueHeaders, rows: normalizedRows };
}

function getStoreSnapshot(): ExistingStoreSnapshot {
  const s = institutionalStore.get();
  return {
    departments: s.departments,
    rooms: s.rooms,
    courses: s.courses,
    instructors: s.instructors,
    studentGroups: s.studentGroups,
    sections: s.sections
  };
}

function makeIdempotencyKey(
  category: string,
  fileName: string,
  rowCount: number
): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `imp-${category}-${rowCount}-${fileName.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}-${rand}`;
}

export const DataImportWizard: React.FC<DataImportWizardProps> = ({
  onClose,
  onSuccess,
  defaultCategory = 'courses'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getStoredUser();

  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  const [step, setStep] = useState<WizardStep>('category');
  const [category, setCategory] = useState<ImportCategory>(
    CATEGORY_SCHEMAS[defaultCategory] ? defaultCategory : 'courses'
  );

  // Source data state
  const [fileName, setFileName] = useState<string>('');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [pasteInput, setPasteInput] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Workbook multi-sheet state (.xlsx)
  const [sheetTables, setSheetTables] = useState<
    Record<string, { headers: string[]; rows: string[][] }>
  >({});
  const [activeSheetName, setActiveSheetName] = useState<string>('');

  // Parsed tabular data & mapping state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

  // Validation & Duplicate handling state
  const [duplicateMode, setDuplicateMode] = useState<DuplicateHandlingMode>('skip');
  const [atomicMode, setAtomicMode] = useState<boolean>(false);
  const [confirmUpdates, setConfirmUpdates] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [backendErrorCsv, setBackendErrorCsv] = useState<string>('');
  const [validationModeNote, setValidationModeNote] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');

  // Commit & Result state
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitProgress, setCommitProgress] = useState<{ pct: number; label: string }>({
    pct: 0,
    label: ''
  });
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    status: 'completed' | 'partial' | 'failed' | 'rolled_back';
    message: string;
    persistenceMode: 'supabase' | 'local_fallback';
    idempotentReplay: boolean;
    durationMs: number;
    counts: {
      totalRows: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    };
    errorCsv: string;
  } | null>(null);

  // History state
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<ImportHistoryEntry[]>([]);

  const mappingResult = useMemo(
    () =>
      headers.length > 0
        ? detectImportColumnMappings(headers, category, columnMappings)
        : null,
    [headers, category, columnMappings]
  );

  // Re-run auto detection cleanly when category changes while keeping existing rows
  const handleSelectCategory = (nextCat: ImportCategory) => {
    setCategory(nextCat);
    setParseError(null);
    setCommitError(null);
    if (headers.length > 0) {
      const detected = detectImportColumnMappings(headers, nextCat);
      setColumnMappings(detected.mapping);
      setValidationReport(null);
    }
  };

  const handleDownloadTemplate = async (targetCat: ImportCategory) => {
    setParseError(null);
    const fallbackCsv = generateTemplateCsv(targetCat);
    const fallbackName = `smartgrid_${targetCat}_template.csv`;
    if (currentUser?.token) {
      try {
        const res = await fetchImportTemplateApi(currentUser, targetCat);
        triggerCsvDownload(res.fileName || fallbackName, res.csvText || fallbackCsv);
        return;
      } catch {
        // Fallback safely to identical local template generator
      }
    }
    triggerCsvDownload(fallbackName, fallbackCsv);
  };

  const applyParsedTable = (
    name: string,
    parsedHeaders: string[],
    parsedRows: string[][],
    rawCsv: string
  ) => {
    const detected = detectImportColumnMappings(parsedHeaders, category);
    setFileName(name);
    setRawCsvText(rawCsv);
    setHeaders(parsedHeaders);
    setRows(parsedRows);
    setColumnMappings(detected.mapping);
    setValidationReport(null);
    setBackendErrorCsv('');
    setConfirmUpdates(false);
    setCommitError(null);
    setParseError(null);
    setIdempotencyKey(makeIdempotencyKey(category, name, parsedRows.length));
    setStep('mapping');
  };

  const handleFileUpload = async (file: File) => {
    setParseError(null);
    setCommitError(null);
    setSheetTables({});
    setActiveSheetName('');

    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xlsx');
    const isDelimited =
      lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt');

    if (!isExcel && !isDelimited) {
      setParseError(
        `Unsupported file format "${file.name}". Please upload a .csv, .tsv, or .xlsx file.`
      );
      return;
    }

    if (file.size === 0) {
      setParseError(`"${file.name}" is empty (0 bytes).`);
      return;
    }

    if (file.size > MAX_CSV_FILE_BYTES) {
      setParseError(
        `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB upload limit.`
      );
      return;
    }

    if (isExcel) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        if (workbook.worksheets.length === 0) {
          setParseError('Excel workbook contains no readable worksheets.');
          return;
        }
        const tables: Record<string, { headers: string[]; rows: string[][] }> = {};
        const errors: string[] = [];
        for (const ws of workbook.worksheets) {
          try {
            tables[ws.name] = extractSheetTable(ws);
          } catch (err) {
            errors.push((err as Error).message);
          }
        }
        const validSheetNames = Object.keys(tables);
        if (validSheetNames.length === 0) {
          setParseError(errors[0] || 'No valid data rows found in any worksheet.');
          return;
        }
        // Prefer a sheet whose name matches current category keywords
        const preferred =
          validSheetNames.find(n => n.toLowerCase().includes(category.replace('_', ''))) ||
          validSheetNames[0];
        setSheetTables(tables);
        setActiveSheetName(preferred);
        applyParsedTable(
          `${file.name} (${preferred})`,
          tables[preferred].headers,
          tables[preferred].rows,
          ''
        );
      } catch (err) {
        setParseError(
          `Could not parse Excel workbook: ${(err as Error).message || 'corrupted .xlsx file'}.`
        );
      }
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsvTextStrict(text);
      applyParsedTable(file.name, parsed.headers, parsed.rows, text);
    } catch (err) {
      setParseError((err as Error).message || 'Unable to parse CSV file.');
    }
  };

  const handleParsePastedText = () => {
    setParseError(null);
    setSheetTables({});
    setActiveSheetName('');
    try {
      const parsed = parseCsvTextStrict(pasteInput);
      applyParsedTable('pasted_data.csv', parsed.headers, parsed.rows, pasteInput);
      setShowPasteBox(false);
    } catch (err) {
      setParseError((err as Error).message || 'Unable to parse pasted data.');
    }
  };

  const handleSwitchExcelSheet = (sheetName: string) => {
    const tbl = sheetTables[sheetName];
    if (!tbl) return;
    setActiveSheetName(sheetName);
    const baseName = fileName.replace(/\s+\([^)]+\)$/, '');
    const detected = detectImportColumnMappings(tbl.headers, category);
    setFileName(`${baseName} (${sheetName})`);
    setHeaders(tbl.headers);
    setRows(tbl.rows);
    setColumnMappings(detected.mapping);
    setValidationReport(null);
    setIdempotencyKey(makeIdempotencyKey(category, `${baseName}_${sheetName}`, tbl.rows.length));
  };

  const handleManualColumnChange = (csvHeader: string, newTarget: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [csvHeader]: newTarget
    }));
  };

  const runValidation = async (targetMode: DuplicateHandlingMode = duplicateMode) => {
    if (headers.length === 0 || rows.length === 0) return;
    setIsValidating(true);
    setCommitError(null);
    setValidationModeNote(null);

    const activeMap = mappingResult?.mapping || columnMappings;
    const localReport = validateImportPreviewLocal({
      category,
      duplicateMode: targetMode,
      headers,
      rows,
      columnMappings: activeMap,
      storeSnapshot: getStoreSnapshot()
    });

    if (!currentUser?.token) {
      setValidationReport(localReport);
      setBackendErrorCsv(
        localReport.summary.errorRows > 0
          ? buildErrorReportCsv(localReport.headers, localReport.rows)
          : ''
      );
      setValidationModeNote(
        'Validated against current browser catalog (sign in as administrator to validate live PostgreSQL constraints).'
      );
      setIsValidating(false);
      return;
    }

    try {
      const remote = await validateImportBackendApi(currentUser, {
        category,
        duplicateMode: targetMode,
        institutionId: institutionalStore.getCurrentInstitutionId(),
        csvText: rawCsvText || undefined,
        headers: rawCsvText ? undefined : headers,
        rows: rawCsvText ? undefined : rows,
        columnMappings: activeMap
      });
      setValidationReport(remote);
      setBackendErrorCsv(remote.errorCsv || '');
      setValidationModeNote('Validated against live Supabase PostgreSQL database & foreign keys.');
    } catch (err) {
      if (err instanceof ImportApiError && err.status === 503) {
        setValidationReport(localReport);
        setBackendErrorCsv(
          localReport.summary.errorRows > 0
            ? buildErrorReportCsv(localReport.headers, localReport.rows)
            : ''
        );
        setValidationModeNote(
          'Live database connection unavailable (503). Validated against local catalog workspace.'
        );
      } else if (err instanceof ImportApiError && (err.status === 401 || err.status === 403)) {
        setCommitError(err.message);
        setValidationReport(localReport);
      } else {
        setValidationReport(localReport);
        setValidationModeNote(
          `Backend preview fallback (${(err as Error).message}); validated against local catalog.`
        );
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleProceedToValidation = async () => {
    if (!mappingResult) return;
    if (
      mappingResult.missingRequiredFields.length > 0 ||
      mappingResult.conflictingMappings.length > 0
    ) {
      return;
    }
    setStep('preview');
    await runValidation(duplicateMode);
  };

  const handleChangeDuplicateMode = async (nextMode: DuplicateHandlingMode) => {
    setDuplicateMode(nextMode);
    setConfirmUpdates(false);
    setCommitError(null);
    await runValidation(nextMode);
  };

  const filteredRows: ValidatedRow[] = useMemo(() => {
    if (!validationReport) return [];
    const list = validationReport.rows;
    if (rowFilter === 'all') return list;
    if (rowFilter === 'error') return list.filter(r => r.status === 'error');
    if (rowFilter === 'warning') {
      return list.filter(r => r.status === 'warning' || r.warnings.length > 0);
    }
    if (rowFilter === 'duplicate') {
      return list.filter(
        r =>
          r.status === 'duplicate_skip' ||
          r.status === 'duplicate_update' ||
          r.errors.some(e => e.kind === 'duplicate')
      );
    }
    return list.filter(r => r.status === 'ready');
  }, [validationReport, rowFilter]);

  const handleDownloadErrors = () => {
    if (!validationReport) return;
    const csv =
      backendErrorCsv || buildErrorReportCsv(validationReport.headers, validationReport.rows);
    const cleanBase = (fileName || category).replace(/\.[^.]+$/, '');
    triggerCsvDownload(`${cleanBase}_errors.csv`, csv);
  };

  const handleCommitImport = async () => {
    if (!validationReport || isCommitting) return;
    if (!validationReport.canProceed) return;
    if (atomicMode && validationReport.summary.errorRows > 0) return;
    if (
      duplicateMode === 'update' &&
      validationReport.summary.updateCount > 0 &&
      !confirmUpdates
    ) {
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setCommitProgress({
      pct: 15,
      label: currentUser?.token
        ? 'Re-validating & committing staged chunks to Supabase...'
        : 'Applying validated records to workspace store...'
    });

    const activeMap = mappingResult?.mapping || columnMappings;
    const effectiveKey =
      idempotencyKey || makeIdempotencyKey(category, fileName || category, rows.length);
    setIdempotencyKey(effectiveKey);
    const storePayload = buildStorePayloadFromValidatedRows(validationReport);

    const runLocalCommit = (mode: 'supabase' | 'local_fallback', overrideCounts?: {
      totalRows: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    }, durationMs = 25, errorCsvOut = '', idempotentReplay = false, messageOut?: string) => {
      const started = performance.now();
      const localRes = institutionalStore.importBulkCatalogData({
        ...storePayload,
        duplicateMode,
        skipSync: mode === 'supabase'
      });
      const elapsed = Math.max(durationMs, Math.round(performance.now() - started));
      const counts = overrideCounts || {
        totalRows: validationReport.summary.totalRows,
        created: localRes.created,
        updated: localRes.updated,
        skipped: localRes.skipped + validationReport.summary.skipCount,
        failed: validationReport.summary.errorRows
      };
      const statusVal: 'completed' | 'partial' =
        counts.failed > 0 ? 'partial' : 'completed';

      if (mode === 'local_fallback') {
        institutionalStore.recordImportHistory({
          userName: currentUser?.name || 'Administrator',
          userEmail: currentUser?.email || '',
          category,
          fileName: fileName || `${category}.csv`,
          duplicateMode,
          status: statusVal,
          totalRows: counts.totalRows,
          createdCount: counts.created,
          updatedCount: counts.updated,
          skippedCount: counts.skipped,
          failedCount: counts.failed,
          durationMs: elapsed
        });
      }

      const finalMsg =
        messageOut ||
        `Imported ${counts.created} new, updated ${counts.updated}, skipped ${counts.skipped}, rejected ${counts.failed} rows.`;

      setCommitProgress({ pct: 100, label: 'Completed' });
      setCommitResult({
        status: statusVal,
        message: finalMsg,
        persistenceMode: mode,
        idempotentReplay,
        durationMs: elapsed,
        counts,
        errorCsv:
          errorCsvOut ||
          (counts.failed > 0
            ? buildErrorReportCsv(validationReport.headers, validationReport.rows)
            : '')
      });
      setStep('results');
      onSuccess?.(finalMsg);
    };

    if (!currentUser?.token) {
      runLocalCommit('local_fallback');
      setIsCommitting(false);
      return;
    }

    try {
      setCommitProgress({
        pct: 45,
        label: `Writing ${validationReport.summary.validRows} verified row(s) in transactional chunks...`
      });

      const res = await commitImportBackendApi(currentUser, {
        category,
        duplicateMode,
        institutionId: institutionalStore.getCurrentInstitutionId(),
        fileName: fileName || `${category}.csv`,
        confirmUpdates,
        atomic: atomicMode,
        idempotencyKey: effectiveKey,
        csvText: rawCsvText || undefined,
        headers: rawCsvText ? undefined : headers,
        rows: rawCsvText ? undefined : rows,
        columnMappings: activeMap
      });

      runLocalCommit(
        'supabase',
        res.counts,
        res.durationMs,
        res.errorCsv,
        res.idempotentReplay,
        res.message
      );
    } catch (err) {
      if (err instanceof ImportApiError && err.status === 503) {
        // Explicit fallback ONLY when Supabase database is unconfigured (503)
        runLocalCommit('local_fallback');
      } else {
        setCommitError(
          (err as Error).message ||
            'Backend import rejected or rolled back cleanly. No partial records were stored.'
        );
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const loadImportHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const localRecords: ImportHistoryEntry[] = (institutionalStore.get().importHistory || []).map(
      rec => ({
        id: rec.id,
        institutionId: rec.institutionId,
        userId: null,
        userName: rec.userName,
        userEmail: rec.userEmail,
        category: rec.category,
        fileName: rec.fileName,
        duplicateMode: rec.duplicateMode,
        status: rec.status,
        totalRows: rec.totalRows,
        createdCount: rec.createdCount,
        updatedCount: rec.updatedCount,
        skippedCount: rec.skippedCount,
        failedCount: rec.failedCount,
        durationMs: rec.durationMs,
        errorSummary: [],
        createdAt: rec.createdAt
      })
    );

    if (!currentUser?.token) {
      setHistoryEntries(localRecords);
      setHistoryLoading(false);
      return;
    }

    try {
      const remote = await fetchImportHistoryBackendApi(
        currentUser,
        institutionalStore.getCurrentInstitutionId(),
        30
      );
      const seenIds = new Set(remote.map(r => r.id));
      const merged = [...remote, ...localRecords.filter(l => !seenIds.has(l.id))];
      setHistoryEntries(merged);
    } catch (err) {
      setHistoryEntries(localRecords);
      if (!(err instanceof ImportApiError && err.status === 503)) {
        setHistoryError((err as Error).message);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      void loadImportHistory();
    }
  }, [activeTab]);

  const resetForAnotherImport = () => {
    setStep('category');
    setFileName('');
    setRawCsvText('');
    setHeaders([]);
    setRows([]);
    setColumnMappings({});
    setValidationReport(null);
    setCommitResult(null);
    setCommitError(null);
    setParseError(null);
    setConfirmUpdates(false);
    setSheetTables({});
    setActiveSheetName('');
  };

  const canAdvanceFromMapping =
    Boolean(mappingResult) &&
    mappingResult!.missingRequiredFields.length === 0 &&
    mappingResult!.conflictingMappings.length === 0 &&
    rows.length > 0;

  const canExecuteCommit =
    Boolean(validationReport) &&
    validationReport!.canProceed &&
    !(atomicMode && validationReport!.summary.errorRows > 0) &&
    !(
      duplicateMode === 'update' &&
      validationReport!.summary.updateCount > 0 &&
      !confirmUpdates
    ) &&
    !isValidating &&
    !isCommitting;

  const currentSchema = CATEGORY_SCHEMAS[category];

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#171717]/45 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label="Academic CSV Data Import System"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: CALM_EASE }}
          className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#F7F6EF] border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden text-[#171717]"
        >
          {/* Top Bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-b border-[#E4E2DA]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif-editorial text-xl font-semibold leading-tight text-[#171717]">
                  Academic CSV Data Import
                </h2>
                <p className="text-xs text-[#77766F] truncate">
                  Workspace:{' '}
                  <span className="font-medium text-[#171717]">
                    {institutionalStore.get().institutionProfile?.name || 'SmartGrid University'}
                  </span>
                  {' · '}
                  <span className="font-mono-tabular">
                    {institutionalStore.getCurrentInstitutionId()}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                <button
                  type="button"
                  onClick={() => setActiveTab('wizard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'wizard'
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  Import Wizard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Import History</span>
                </button>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close import modal"
                  className="p-2 rounded-lg text-[#77766F] hover:text-[#171717] hover:bg-[#F7F6EF] transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </header>

          {/* Stepper Bar */}
          {activeTab === 'wizard' && (
            <div className="px-6 py-3 bg-[#F7F6EF] border-b border-[#E4E2DA] overflow-x-auto">
              <ol className="flex items-center justify-between gap-2 min-w-[600px]">
                {STEP_LABELS.map((item, idx) => {
                  const activeIdx = STEP_LABELS.findIndex(s => s.id === step);
                  const isCurrent = item.id === step;
                  const isDone = idx < activeIdx || step === 'results';
                  return (
                    <li key={item.id} className="flex items-center gap-2 flex-1 last:flex-none">
                      <button
                        type="button"
                        disabled={idx > activeIdx && !(idx <= 1 && headers.length > 0)}
                        onClick={() => {
                          if (idx < activeIdx && step !== 'results') {
                            setStep(item.id);
                          }
                        }}
                        className={`flex items-center gap-2 text-left transition-colors ${
                          idx < activeIdx && step !== 'results'
                            ? 'cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full text-[11px] font-mono-tabular font-semibold flex items-center justify-center border ${
                            isCurrent
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : isDone
                              ? 'bg-[#B8F2E6] text-[#171717] border-[#0F766E]/30'
                              : 'bg-white text-[#77766F] border-[#E4E2DA]'
                          }`}
                        >
                          {isDone && !isCurrent ? <Check className="w-3.5 h-3.5" /> : item.num}
                        </span>
                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            isCurrent ? 'text-[#171717] font-semibold' : 'text-[#77766F]'
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                      {idx < STEP_LABELS.length - 1 && (
                        <div className="flex-1 h-px bg-[#E4E2DA] mx-1" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {activeTab === 'history' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      University Import Audit History
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      Record of bulk CSV and Excel imports executed for this institution.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadImportHistory()}
                    className="btn-secondary h-8 text-xs"
                    disabled={historyLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {historyError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {historyError}
                  </div>
                )}

                {historyLoading ? (
                  <div className="sf-card-white p-10 text-center text-xs text-[#77766F]">
                    Loading import history...
                  </div>
                ) : historyEntries.length === 0 ? (
                  <div className="sf-card-white p-10 text-center space-y-2">
                    <History className="w-7 h-7 text-[#77766F] mx-auto" />
                    <p className="text-sm font-medium text-[#171717]">No imports recorded yet</p>
                    <p className="text-xs text-[#77766F]">
                      Completed imports will appear here with row counts, duplicate mode, and status.
                    </p>
                  </div>
                ) : (
                  <div className="sf-card-white overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF] text-[#77766F]">
                          <th className="py-2.5 px-3 font-medium">Timestamp</th>
                          <th className="py-2.5 px-3 font-medium">File</th>
                          <th className="py-2.5 px-3 font-medium">Category</th>
                          <th className="py-2.5 px-3 font-medium">Admin</th>
                          <th className="py-2.5 px-3 font-medium">Mode</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 px-3 font-medium text-right">Created</th>
                          <th className="py-2.5 px-3 font-medium text-right">Updated</th>
                          <th className="py-2.5 px-3 font-medium text-right">Skipped</th>
                          <th className="py-2.5 px-3 font-medium text-right">Failed</th>
                          <th className="py-2.5 px-3 font-medium text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E2DA]">
                        {historyEntries.map(item => (
                          <tr key={item.id} className="hover:bg-[#F7F6EF]/60">
                            <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap text-[#77766F]">
                              {new Date(item.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#171717]">
                              {item.fileName}
                            </td>
                            <td className="py-2.5 px-3">
                              {CATEGORY_SCHEMAS[item.category as ImportCategory]?.shortLabel ||
                                item.category}
                            </td>
                            <td className="py-2.5 px-3 text-[#77766F]">{item.userName}</td>
                            <td className="py-2.5 px-3 capitalize">{item.duplicateMode}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                                  item.status === 'completed'
                                    ? 'bg-[#B8F2E6]/50 border-emerald-700/20 text-emerald-950'
                                    : item.status === 'partial'
                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                    : 'bg-rose-50 border-rose-300 text-rose-900'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-800 font-medium">
                              {item.createdCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-sky-800">
                              {item.updatedCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-[#77766F]">
                              {item.skippedCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-700">
                              {item.failedCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-[#77766F]">
                              {item.durationMs}ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : step === 'category' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      1. Choose Academic Data Category
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      Select the dataset you want to import. Each category validates required columns,
                      data types, unique identifiers, and foreign-key references.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTemplate(category)}
                    className="btn-secondary h-8 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download {currentSchema.shortLabel} Template</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CATEGORY_ORDER.map(catId => {
                    const schema = CATEGORY_SCHEMAS[catId];
                    const selected = category === catId;
                    const reqFields = schema.fields.filter(f => f.required);
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => handleSelectCategory(catId)}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'bg-white border-[#171717] ring-1 ring-[#171717] shadow-xs'
                            : 'bg-white/80 border-[#E4E2DA] hover:border-[#171717]/40 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-[#171717]">
                            {schema.title}
                          </span>
                          {selected && (
                            <span className="w-5 h-5 rounded-full bg-[#171717] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#77766F] mt-1 leading-relaxed">
                          {schema.description}
                        </p>
                        <div className="mt-3 pt-2.5 border-t border-[#E4E2DA] flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          <span className="text-[#77766F]">
                            Key:{' '}
                            <span className="font-mono-tabular text-[#171717]">
                              {schema.stableKeyLabel}
                            </span>
                          </span>
                          <span className="font-mono-tabular text-[#77766F]">
                            {reqFields.length > 0
                              ? `${reqFields.length} required`
                              : 'Multi-entity'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : step === 'upload' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      2. Upload {currentSchema.title} CSV or Excel File
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      Required fields:{' '}
                      <span className="font-medium text-[#171717]">
                        {currentSchema.fields
                          .filter(f => f.required)
                          .map(f => f.label)
                          .join(', ') || 'At least one entity identifier per row'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTemplate(category)}
                    className="btn-secondary h-8 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Template</span>
                  </button>
                </div>

                {parseError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">File Could Not Be Parsed</p>
                      <p className="mt-0.5">{parseError}</p>
                    </div>
                  </div>
                )}

                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  className={`sf-card-white p-8 text-center border-2 border-dashed transition-colors ${
                    isDragging
                      ? 'border-[#171717] bg-[#F7F6EF]'
                      : 'border-[#CFCBC0] hover:border-[#171717]/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleFileUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <div className="w-11 h-11 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 text-[#171717]" />
                  </div>
                  <p className="text-sm font-semibold text-[#171717]">
                    {fileName
                      ? `Loaded "${fileName}" (${rows.length} rows, ${headers.length} columns)`
                      : 'Drag and drop your CSV or Excel (.xlsx) file here'}
                  </p>
                  <p className="text-xs text-[#77766F] mt-1">
                    Supports UTF-8 CSV (comma, semicolon, tab-delimited) and .xlsx workbooks up to 5
                    MB / 10,000 rows.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary h-9 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{fileName ? 'Replace File' : 'Select File from Computer'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(prev => !prev)}
                      className="btn-secondary h-9 text-xs"
                    >
                      <span>{showPasteBox ? 'Hide Paste Box' : 'Paste CSV / Spreadsheet Text'}</span>
                    </button>
                  </div>
                </div>

                {showPasteBox && (
                  <div className="sf-card-white p-4 space-y-3">
                    <label className="block text-xs font-semibold text-[#171717]">
                      Paste CSV or Tab-Separated Content (Row 1 must be headers)
                    </label>
                    <textarea
                      value={pasteInput}
                      onChange={e => setPasteInput(e.target.value)}
                      rows={6}
                      placeholder={generateTemplateCsv(category)}
                      className="w-full p-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleParsePastedText}
                        disabled={!pasteInput.trim()}
                        className="btn-primary h-8 text-xs"
                      >
                        Parse Pasted Rows
                      </button>
                    </div>
                  </div>
                )}

                {/* Template Column Quick Reference */}
                <div className="sf-card-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#171717]">
                      Expected Columns for {currentSchema.title}
                    </span>
                    <span className="text-[11px] text-[#77766F]">
                      Custom column headers can be mapped in the next step
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {currentSchema.fields.map(field => (
                      <div
                        key={field.key}
                        className="px-2.5 py-1.5 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="font-medium text-[#171717] truncate">
                          {field.label}
                          {field.required && <span className="text-rose-600 ml-0.5">*</span>}
                        </span>
                        <span className="font-mono-tabular text-[#77766F] shrink-0">
                          {field.sample}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : step === 'mapping' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      3. Review & Adjust Column Mapping
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      File: <span className="font-medium text-[#171717]">{fileName}</span> ({rows.length}{' '}
                      data rows). Confirm each spreadsheet header maps cleanly to a SmartGrid field.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const redetected = detectImportColumnMappings(headers, category);
                        setColumnMappings(redetected.mapping);
                      }}
                      className="btn-secondary h-8 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Re-Detect Columns</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary h-8 text-xs"
                    >
                      <span>Replace File</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                {Object.keys(sheetTables).length > 1 && (
                  <div className="sf-card-white p-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-[#77766F]">Excel Worksheet:</span>
                    {Object.keys(sheetTables).map(sName => (
                      <button
                        key={sName}
                        type="button"
                        onClick={() => handleSwitchExcelSheet(sName)}
                        className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                          activeSheetName === sName
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA]'
                        }`}
                      >
                        {sName} ({sheetTables[sName].rows.length} rows)
                      </button>
                    ))}
                  </div>
                )}

                {mappingResult && mappingResult.conflictingMappings.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Conflicting Target Field Mapping Detected</p>
                      <p className="mt-0.5">
                        Multiple CSV columns are mapped to the same field:{' '}
                        {mappingResult.conflictingMappings
                          .map(c => `${c.targetField} (${c.headers.join(', ')})`)
                          .join('; ')}
                        . Assign each column to a distinct SmartGrid field or Ignore one.
                      </p>
                    </div>
                  </div>
                )}

                {mappingResult && mappingResult.missingRequiredFields.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Missing Required Column Mappings</p>
                      <p className="mt-0.5">
                        Map the following required fields before running validation:{' '}
                        <span className="font-semibold">
                          {mappingResult.missingRequiredFields.map(f => f.label).join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="sf-card-white overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF] text-[#77766F]">
                        <th className="py-2.5 px-3 font-medium">Uploaded Header</th>
                        <th className="py-2.5 px-3 font-medium">Sample Values</th>
                        <th className="py-2.5 px-3 font-medium">Detection Status</th>
                        <th className="py-2.5 px-3 font-medium">Target SmartGrid Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA]">
                      {(mappingResult?.details || []).map((detail: ColumnMappingDetail, colIdx) => {
                        const sampleVals = rows
                          .slice(0, 2)
                          .map(r => r[colIdx])
                          .filter(Boolean)
                          .join(' | ');
                        const isConflict = mappingResult?.conflictingMappings.some(c =>
                          c.headers.includes(detail.header)
                        );
                        return (
                          <tr key={detail.header} className="hover:bg-[#F7F6EF]/60">
                            <td className="py-2.5 px-3 font-mono-tabular font-medium text-[#171717]">
                              {detail.header}
                            </td>
                            <td className="py-2.5 px-3 text-[#77766F] max-w-[220px] truncate">
                              {sampleVals || <span className="italic">empty</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                                  isConflict
                                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                                    : detail.confidence === 'exact' ||
                                      detail.confidence === 'synonym' ||
                                      detail.confidence === 'manual'
                                    ? 'bg-[#B8F2E6]/45 border-emerald-700/20 text-emerald-950'
                                    : detail.confidence === 'uncertain'
                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                    : 'bg-[#F7F6EF] border-[#E4E2DA] text-[#77766F]'
                                }`}
                                title={detail.reason}
                              >
                                {isConflict
                                  ? 'Conflict'
                                  : detail.confidence === 'exact'
                                  ? 'Exact Match'
                                  : detail.confidence === 'synonym'
                                  ? 'Synonym Auto'
                                  : detail.confidence === 'manual'
                                  ? 'Manual Override'
                                  : detail.confidence === 'uncertain'
                                  ? 'Needs Review'
                                  : 'Unmapped'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                aria-label={`Map column ${detail.header}`}
                                value={detail.targetField}
                                onChange={e =>
                                  handleManualColumnChange(detail.header, e.target.value)
                                }
                                className={`input-field h-8 text-xs py-1 ${
                                  isConflict ? 'border-rose-400' : ''
                                }`}
                              >
                                <option value="">-- Ignore / Do Not Import --</option>
                                {currentSchema.fields.map(field => (
                                  <option key={field.key} value={field.key}>
                                    {field.label}
                                    {field.required ? ' * (Required)' : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : step === 'preview' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      4. Validation Preview & Duplicate Handling
                    </h3>
                    {validationModeNote && (
                      <p className="text-xs text-[#77766F]">{validationModeNote}</p>
                    )}
                  </div>
                  {validationReport && validationReport.summary.errorRows > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrors}
                      className="btn-secondary h-8 text-xs border-rose-300 text-rose-900"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Error CSV ({validationReport.summary.errorRows})</span>
                    </button>
                  )}
                </div>

                {isValidating && (
                  <div className="sf-card-white p-8 text-center text-xs text-[#77766F]">
                    Validating {rows.length} rows against schema types, duplicates, and foreign keys...
                  </div>
                )}

                {!isValidating && validationReport && (
                  <>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-[#77766F]">Total Rows</p>
                        <p className="text-xl font-semibold font-mono-tabular mt-0.5">
                          {validationReport.summary.totalRows}
                        </p>
                      </div>
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-emerald-800">Ready to Import</p>
                        <p className="text-xl font-semibold font-mono-tabular text-emerald-900 mt-0.5">
                          {validationReport.summary.validRows}
                        </p>
                      </div>
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-amber-800">Warnings</p>
                        <p className="text-xl font-semibold font-mono-tabular text-amber-900 mt-0.5">
                          {validationReport.summary.warningRows}
                        </p>
                      </div>
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-rose-700">Blocking Errors</p>
                        <p className="text-xl font-semibold font-mono-tabular text-rose-700 mt-0.5">
                          {validationReport.summary.errorRows}
                        </p>
                      </div>
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-[#77766F]">Duplicates</p>
                        <p className="text-xl font-semibold font-mono-tabular mt-0.5">
                          {validationReport.summary.duplicateRows}
                        </p>
                      </div>
                      <div className="sf-card-stat">
                        <p className="text-[11px] text-[#77766F]">Issue Breakdown</p>
                        <p className="text-[11px] font-mono-tabular text-[#171717] mt-1">
                          Req: {validationReport.summary.missingRequiredCount} · Type:{' '}
                          {validationReport.summary.invalidTypeCount} · FK:{' '}
                          {validationReport.summary.invalidFkCount}
                        </p>
                      </div>
                    </div>

                    {/* Duplicate Strategy & Safety Options */}
                    <div className="sf-card-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-[#171717]">
                            Duplicate Record Strategy
                          </p>
                          <p className="text-[11px] text-[#77766F]">
                            Choose how SmartGrid handles rows whose stable identifier already exists
                            or appears multiple times in the file.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-[#171717] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={atomicMode}
                            onChange={e => setAtomicMode(e.target.checked)}
                            className="rounded border-[#CFCBC0]"
                          />
                          <span>Strict Atomic Import (reject entire file if any row fails)</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {[
                          {
                            mode: 'skip' as DuplicateHandlingMode,
                            title: 'Skip Duplicates',
                            desc: 'Keep existing records untouched and skip conflicting rows.'
                          },
                          {
                            mode: 'update' as DuplicateHandlingMode,
                            title: 'Update Existing Records',
                            desc: 'Review exact field changes below and confirm overwriting matches.'
                          },
                          {
                            mode: 'stop' as DuplicateHandlingMode,
                            title: 'Stop & Resolve Conflicts',
                            desc: 'Abort entire import if any duplicate or validation error exists.'
                          }
                        ].map(opt => (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() => void handleChangeDuplicateMode(opt.mode)}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              duplicateMode === opt.mode
                                ? 'bg-[#F7F6EF] border-[#171717] ring-1 ring-[#171717]'
                                : 'bg-white border-[#E4E2DA] hover:border-[#171717]/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#171717]">
                                {opt.title}
                              </span>
                              {duplicateMode === opt.mode && (
                                <Check className="w-3.5 h-3.5 text-[#171717]" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#77766F] mt-1">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      {/* Field-Level Diff Confirmation for Update Mode */}
                      {duplicateMode === 'update' && validationReport.summary.updateCount > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-amber-950">
                              Field-Level Diff Preview ({validationReport.summary.updateCount} record
                              {validationReport.summary.updateCount === 1 ? '' : 's'} will be updated)
                            </p>
                          </div>
                          {validationReport.fieldDiffs.length > 0 && (
                            <div className="max-h-36 overflow-y-auto bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 text-[11px]">
                              {validationReport.fieldDiffs.slice(0, 25).map(entry => (
                                <div
                                  key={`${entry.row}-${entry.identifier}`}
                                  className="px-3 py-1.5 flex flex-wrap items-center gap-2"
                                >
                                  <span className="font-mono-tabular font-semibold text-[#171717]">
                                    Row {entry.row} ({entry.identifier})
                                  </span>
                                  {entry.diffs.length === 0 ? (
                                    <span className="text-[#77766F]">
                                      Matching record values unchanged
                                    </span>
                                  ) : (
                                    entry.diffs.map(d => (
                                      <span
                                        key={d.field}
                                        className="px-1.5 py-0.5 rounded bg-[#F7F6EF] border border-[#E4E2DA] font-mono-tabular"
                                      >
                                        {d.label}: "{String(d.before ?? '')}" {'->'} "
                                        {String(d.after ?? '')}"
                                      </span>
                                    ))
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <label className="flex items-center gap-2 text-xs font-medium text-amber-950 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confirmUpdates}
                              onChange={e => setConfirmUpdates(e.target.checked)}
                            />
                            <span>
                              I confirm overwriting {validationReport.summary.updateCount} existing
                              university record(s) with the updated CSV values.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Blocking Banners */}
                    {validationReport.blockingReason && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Import Blocked Before Execution</p>
                          <p className="mt-0.5">{validationReport.blockingReason}</p>
                        </div>
                      </div>
                    )}

                    {atomicMode && validationReport.summary.errorRows > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                        <FileWarning className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Strict Atomic Mode Active</p>
                          <p className="mt-0.5">
                            Resolve all {validationReport.summary.errorRows} failing row(s) or
                            uncheck Strict Atomic Import to import only the{' '}
                            {validationReport.summary.validRows} valid row(s).
                          </p>
                        </div>
                      </div>
                    )}

                    {commitError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Commit Aborted</p>
                          <p className="mt-0.5">{commitError}</p>
                        </div>
                      </div>
                    )}

                    {/* Row Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'all' as RowFilter, label: `All (${validationReport.rows.length})` },
                          {
                            id: 'error' as RowFilter,
                            label: `Errors (${validationReport.summary.errorRows})`
                          },
                          {
                            id: 'warning' as RowFilter,
                            label: `Warnings (${validationReport.summary.warningRows})`
                          },
                          {
                            id: 'duplicate' as RowFilter,
                            label: `Duplicates (${validationReport.summary.duplicateRows})`
                          },
                          {
                            id: 'ready' as RowFilter,
                            label: `Ready (${validationReport.summary.createCount})`
                          }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setRowFilter(tab.id)}
                            className={`px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                              rowFilter === tab.id
                                ? 'bg-[#171717] text-white border-[#171717]'
                                : 'bg-white text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-[#77766F]">
                        Showing {Math.min(filteredRows.length, 150)} of {filteredRows.length} rows
                      </span>
                    </div>

                    {/* Detailed Row Validation Table */}
                    <div className="sf-card-white overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-[#F7F6EF] border-b border-[#E4E2DA] text-[#77766F]">
                          <tr>
                            <th className="py-2 px-3 font-medium">Row</th>
                            <th className="py-2 px-3 font-medium">Identifier</th>
                            <th className="py-2 px-3 font-medium">Status</th>
                            <th className="py-2 px-3 font-medium">Action</th>
                            <th className="py-2 px-3 font-medium">Problems & Suggested Fix</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E2DA]">
                          {filteredRows.slice(0, 150).map(r => (
                            <tr
                              key={r.rowNumber}
                              className={
                                r.status === 'error'
                                  ? 'bg-rose-50/40'
                                  : r.status === 'warning' || r.status === 'duplicate_skip'
                                  ? 'bg-amber-50/30'
                                  : 'hover:bg-[#F7F6EF]/50'
                              }
                            >
                              <td className="py-2 px-3 font-mono-tabular text-[#77766F]">
                                {r.rowNumber}
                              </td>
                              <td className="py-2 px-3 font-mono-tabular font-medium text-[#171717]">
                                {r.identifier}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                                    r.status === 'ready'
                                      ? 'bg-[#B8F2E6]/45 border-emerald-700/20 text-emerald-950'
                                      : r.status === 'duplicate_update'
                                      ? 'bg-sky-50 border-sky-200 text-sky-900'
                                      : r.status === 'duplicate_skip' || r.status === 'warning'
                                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                                      : 'bg-rose-50 border-rose-200 text-rose-900'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 capitalize text-[#77766F]">{r.action}</td>
                              <td className="py-2 px-3 space-y-1">
                                {r.errors.map((err, eIdx) => (
                                  <div key={eIdx} className="text-rose-900">
                                    <span className="font-mono-tabular font-semibold">
                                      [{err.column}]
                                    </span>{' '}
                                    {err.message}{' '}
                                    <span className="text-[#77766F]">— Fix: {err.suggestion}</span>
                                  </div>
                                ))}
                                {r.warnings.map((w, wIdx) => (
                                  <div key={wIdx} className="text-amber-900">
                                    <span className="font-mono-tabular font-semibold">
                                      [{w.column}]
                                    </span>{' '}
                                    {w.message}
                                  </div>
                                ))}
                                {r.errors.length === 0 && r.warnings.length === 0 && (
                                  <span className="text-[#77766F]">Passed all validation checks</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {isCommitting && (
                      <div className="sf-card-white p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span>{commitProgress.label}</span>
                          <span className="font-mono-tabular">{commitProgress.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F7F6EF] overflow-hidden border border-[#E4E2DA]">
                          <div
                            className="h-full bg-[#171717] transition-all duration-300"
                            style={{ width: `${commitProgress.pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Step 5: Import Results */
              commitResult && (
                <div className="space-y-5">
                  <div className="sf-card-white p-6 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          commitResult.status === 'completed'
                            ? 'bg-[#B8F2E6] text-[#171717]'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif-editorial text-xl font-semibold text-[#171717]">
                            Import {commitResult.status === 'completed' ? 'Completed' : 'Finished with Skipped Errors'}
                          </h3>
                          {commitResult.idempotentReplay && (
                            <span className="px-2 py-0.5 rounded-md border border-[#E4E2DA] bg-[#F7F6EF] text-[11px] font-medium">
                              Idempotent Replay
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#77766F] mt-1">{commitResult.message}</p>
                        <p className="text-[11px] text-[#77766F] mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Processed in {commitResult.durationMs}ms · Persistence:{' '}
                            {commitResult.persistenceMode === 'supabase'
                              ? 'Supabase PostgreSQL (Verified)'
                              : 'Local Workspace Storage (Remote Supabase unconfigured or offline)'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {commitResult.counts.failed > 0 && commitResult.errorCsv && (
                      <button
                        type="button"
                        onClick={() => {
                          const cleanBase = (fileName || category).replace(/\.[^.]+$/, '');
                          triggerCsvDownload(`${cleanBase}_errors.csv`, commitResult.errorCsv);
                        }}
                        className="btn-secondary h-9 text-xs border-rose-300 text-rose-900"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Error CSV ({commitResult.counts.failed} rows)</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="sf-card-stat">
                      <p className="text-[11px] text-[#77766F]">Total Processed</p>
                      <p className="text-2xl font-semibold font-mono-tabular mt-1">
                        {commitResult.counts.totalRows}
                      </p>
                    </div>
                    <div className="sf-card-stat">
                      <p className="text-[11px] text-emerald-800">Created</p>
                      <p className="text-2xl font-semibold font-mono-tabular text-emerald-900 mt-1">
                        {commitResult.counts.created}
                      </p>
                    </div>
                    <div className="sf-card-stat">
                      <p className="text-[11px] text-sky-800">Updated</p>
                      <p className="text-2xl font-semibold font-mono-tabular text-sky-900 mt-1">
                        {commitResult.counts.updated}
                      </p>
                    </div>
                    <div className="sf-card-stat">
                      <p className="text-[11px] text-amber-800">Skipped</p>
                      <p className="text-2xl font-semibold font-mono-tabular text-amber-900 mt-1">
                        {commitResult.counts.skipped}
                      </p>
                    </div>
                    <div className="sf-card-stat">
                      <p className="text-[11px] text-rose-700">Failed</p>
                      <p className="text-2xl font-semibold font-mono-tabular text-rose-700 mt-1">
                        {commitResult.counts.failed}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Sticky Footer */}
          <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-t border-[#E4E2DA]">
            {activeTab === 'history' ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('wizard')}
                  className="btn-secondary h-9 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Import Wizard</span>
                </button>
                {onClose && (
                  <button type="button" onClick={onClose} className="btn-primary h-9 text-xs">
                    <span>Close</span>
                  </button>
                )}
              </>
            ) : step === 'category' ? (
              <>
                <div className="text-xs text-[#77766F] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Selected: {currentSchema.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {onClose && (
                    <button type="button" onClick={onClose} className="btn-secondary h-9 text-xs">
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="btn-primary h-9 text-xs"
                  >
                    <span>Next: Upload CSV / Excel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : step === 'upload' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep('category')}
                  className="btn-secondary h-9 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-2">
                  {headers.length > 0 && rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep('mapping')}
                      className="btn-primary h-9 text-xs"
                    >
                      <span>Continue to Column Mapping ({rows.length} rows)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            ) : step === 'mapping' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="btn-secondary h-9 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Upload</span>
                </button>
                <button
                  type="button"
                  disabled={!canAdvanceFromMapping}
                  onClick={() => void handleProceedToValidation()}
                  className="btn-primary h-9 text-xs"
                >
                  <span>Next: Validate & Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : step === 'preview' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  disabled={isCommitting}
                  className="btn-secondary h-9 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Adjust Column Mapping</span>
                </button>
                <button
                  type="button"
                  disabled={!canExecuteCommit}
                  onClick={() => void handleCommitImport()}
                  className="btn-primary h-9 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {isCommitting
                      ? 'Importing...'
                      : validationReport
                      ? `Import ${validationReport.summary.validRows} Verified Row${
                          validationReport.summary.validRows === 1 ? '' : 's'
                        }`
                      : 'Run Import'}
                  </span>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForAnotherImport}
                    className="btn-secondary h-9 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Another File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="btn-secondary h-9 text-xs"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Import History</span>
                  </button>
                </div>
                {onClose && (
                  <button type="button" onClick={onClose} className="btn-primary h-9 text-xs">
                    <span>Done</span>
                  </button>
                )}
              </>
            )}
          </footer>
        </motion.div>
      </div>
    </MotionConfig>
  );
};
