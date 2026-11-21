import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import ExcelJS from 'exceljs';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Columns3,
  Download,
  FileCheck2,
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
import { getStoredUser, fetchInstitutionWorkspace } from '../services/votingApi';
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
  CATEGORY_SCHEMAS,
  ColumnMappingDetail,
  CsvFormatError,
  detectImportColumnMappings,
  DuplicateHandlingMode,
  generateTemplateCsv,
  ImportCategory,
  MAX_CSV_FILE_BYTES,
  parseCsvTextStrict,
  ValidatedRow,
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

interface StepMeta {
  id: WizardStep;
  num: number;
  label: string;
  eyebrow: string;
  heading: string;
}

const STEP_LABELS: StepMeta[] = [
  {
    id: 'category',
    num: 1,
    label: 'Dataset Category',
    eyebrow: 'Schema Selection',
    heading: 'Select Dataset'
  },
  {
    id: 'upload',
    num: 2,
    label: 'Upload File',
    eyebrow: 'Source File',
    heading: 'Upload CSV or Excel File'
  },
  {
    id: 'mapping',
    num: 3,
    label: 'Map Columns',
    eyebrow: 'Field Mapping',
    heading: 'Map Columns'
  },
  {
    id: 'preview',
    num: 4,
    label: 'Validate & Duplicates',
    eyebrow: 'Validation',
    heading: 'Validate & Preview'
  },
  {
    id: 'results',
    num: 5,
    label: 'Import Summary',
    eyebrow: 'Completed',
    heading: 'Import Summary'
  }
];

const stepperContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.06
    }
  }
};

const stepperItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: CALM_EASE }
  }
};

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
  const bodyScrollRef = useRef<HTMLDivElement>(null);
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
  const [uploadProgress, setUploadProgress] = useState<{
    active: boolean;
    fileName: string;
    pct: number;
    stage: string;
  } | null>(null);

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

  useEffect(() => {
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, activeTab]);

  const mappingResult = useMemo(
    () =>
      headers.length > 0
        ? detectImportColumnMappings(headers, category, columnMappings)
        : null,
    [headers, category, columnMappings]
  );

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

  const readFileWithProgress = (
    file: File,
    asArrayBuffer: boolean,
    onProgress: (pct: number) => void
  ): Promise<string | ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = evt => {
        if (evt.lengthComputable && evt.total > 0) {
          const ratio = Math.min(1, evt.loaded / evt.total);
          onProgress(Math.round(15 + ratio * 45));
        }
      };
      reader.onerror = () => reject(new Error(`Unable to read "${file.name}".`));
      reader.onload = () => {
        if (reader.result === null) {
          reject(new Error(`"${file.name}" could not be read.`));
          return;
        }
        resolve(reader.result);
      };
      if (asArrayBuffer) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'utf-8');
      }
    });
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

    setUploadProgress({
      active: true,
      fileName: file.name,
      pct: 15,
      stage: 'Uploading file...'
    });

    if (isExcel) {
      try {
        const buffer = (await readFileWithProgress(file, true, pct => {
          setUploadProgress({
            active: true,
            fileName: file.name,
            pct,
            stage: 'Uploading file...'
          });
        })) as ArrayBuffer;

        setUploadProgress({
          active: true,
          fileName: file.name,
          pct: 72,
          stage: 'Processing workbook...'
        });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        if (workbook.worksheets.length === 0) {
          setUploadProgress(null);
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
          setUploadProgress(null);
          setParseError(errors[0] || 'No valid data rows found in any worksheet.');
          return;
        }
        const preferred =
          validSheetNames.find(n => n.toLowerCase().includes(category.replace('_', ''))) ||
          validSheetNames[0];

        setUploadProgress({
          active: true,
          fileName: file.name,
          pct: 100,
          stage: 'Uploaded'
        });
        await new Promise(r => setTimeout(r, 220));
        setUploadProgress(null);

        setSheetTables(tables);
        setActiveSheetName(preferred);
        applyParsedTable(
          `${file.name} (${preferred})`,
          tables[preferred].headers,
          tables[preferred].rows,
          ''
        );
      } catch (err) {
        setUploadProgress(null);
        setParseError(
          `Could not parse Excel workbook: ${(err as Error).message || 'corrupted .xlsx file'}.`
        );
      }
      return;
    }

    try {
      const text = (await readFileWithProgress(file, false, pct => {
        setUploadProgress({
          active: true,
          fileName: file.name,
          pct,
          stage: 'Uploading file...'
        });
      })) as string;

      setUploadProgress({
        active: true,
        fileName: file.name,
        pct: 78,
        stage: 'Parsing rows...'
      });
      const parsed = parseCsvTextStrict(text);
      setUploadProgress({
        active: true,
        fileName: file.name,
        pct: 100,
        stage: 'Uploaded'
      });
      await new Promise(r => setTimeout(r, 220));
      setUploadProgress(null);

      applyParsedTable(file.name, parsed.headers, parsed.rows, text);
    } catch (err) {
      setUploadProgress(null);
      setParseError((err as Error).message || 'Unable to parse CSV file.');
    }
  };

  const handleParsePastedText = async () => {
    setParseError(null);
    setSheetTables({});
    setActiveSheetName('');
    setUploadProgress({
      active: true,
      fileName: 'pasted_data.csv',
      pct: 45,
      stage: 'Uploading pasted rows...'
    });
    try {
      const parsed = parseCsvTextStrict(pasteInput);
      setUploadProgress({
        active: true,
        fileName: 'pasted_data.csv',
        pct: 100,
        stage: 'Uploaded'
      });
      await new Promise(r => setTimeout(r, 180));
      setUploadProgress(null);
      applyParsedTable('pasted_data.csv', parsed.headers, parsed.rows, pasteInput);
      setShowPasteBox(false);
    } catch (err) {
      setUploadProgress(null);
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

    if (!currentUser?.token) {
      setCommitError(
        'Sign in with an institutional administrator account to validate CSV rows against live Supabase constraints.'
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
      setValidationModeNote('Validated against live Supabase PostgreSQL database and foreign keys.');
    } catch (err) {
      setCommitError(
        err instanceof Error
          ? err.message
          : 'Live Supabase validation failed. Check database connection and retry.'
      );
      setValidationReport(null);
      setValidationModeNote(null);
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
      label: 'Re-validating and staging records for Supabase...'
    });

    const activeMap = mappingResult?.mapping || columnMappings;
    const effectiveKey =
      idempotencyKey || makeIdempotencyKey(category, fileName || category, rows.length);
    setIdempotencyKey(effectiveKey);

    if (!currentUser?.token) {
      setCommitError(
        'Sign in with an institutional administrator account to import data into Supabase.'
      );
      setIsCommitting(false);
      return;
    }

    const instId = institutionalStore.getCurrentInstitutionId();

    try {
      setCommitProgress({
        pct: 45,
        label: `Writing ${validationReport.summary.validRows} verified row(s) in transactional chunks...`
      });

      const res = await commitImportBackendApi(currentUser, {
        category,
        duplicateMode,
        institutionId: instId,
        fileName: fileName || `${category}.csv`,
        confirmUpdates,
        atomic: atomicMode,
        idempotencyKey: effectiveKey,
        csvText: rawCsvText || undefined,
        headers: rawCsvText ? undefined : headers,
        rows: rawCsvText ? undefined : rows,
        columnMappings: activeMap
      });

      setCommitProgress({ pct: 85, label: 'Synchronizing workspace from Supabase...' });
      const freshWorkspace = await fetchInstitutionWorkspace(currentUser, instId);
      institutionalStore.hydrateFromWorkspacePayload(instId, freshWorkspace, currentUser.id);

      const statusVal: 'completed' | 'partial' =
        res.counts.failed > 0 ? 'partial' : 'completed';

      setCommitProgress({ pct: 100, label: 'Completed' });
      setCommitResult({
        status: statusVal,
        message:
          res.message ||
          `Imported ${res.counts.created} new, updated ${res.counts.updated}, skipped ${res.counts.skipped}, rejected ${res.counts.failed} rows.`,
        persistenceMode: 'supabase',
        idempotentReplay: Boolean(res.idempotentReplay),
        durationMs: res.durationMs,
        counts: res.counts,
        errorCsv: res.errorCsv || ''
      });
      setStep('results');
      onSuccess?.(res.message);
    } catch (err) {
      setCommitError(
        (err as Error).message ||
          'Backend import rejected or rolled back cleanly. No partial records were stored.'
      );
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
  const activeStepIdx = STEP_LABELS.findIndex(s => s.id === step);
  const currentStepMeta = STEP_LABELS[activeStepIdx] || STEP_LABELS[0];
  const progressFraction = (activeStepIdx + 1) / STEP_LABELS.length;
  const institutionName =
    institutionalStore.get().institutionProfile?.name || 'SmartGrid University';

  const stepIcons = [Layers, Upload, Columns3, FileCheck2, CheckCircle2];

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#171717]/45 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label="Academic CSV Data Import System"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.28, ease: CALM_EASE }}
          className="w-full max-w-6xl h-[min(90vh,780px)] flex flex-col lg:flex-row bg-white border border-[#E4E2DA] rounded-2xl shadow-2xl overflow-hidden text-[#171717]"
        >
          {/* =========================================================
              LEFT CALM GUIDED STEP RAIL (Desktop, matches Academic Setup Dialog)
             ========================================================= */}
          <aside className="hidden lg:flex lg:w-[272px] shrink-0 flex-col justify-between bg-[#F7F6EF] border-r border-[#E4E2DA] p-6">
            <div className="space-y-6">
              {/* Workspace Header */}
              <div className="space-y-1.5 pb-5 border-b border-[#E4E2DA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#77766F]">
                      Bulk CSV Import
                    </div>
                    <div className="text-sm font-semibold text-[#171717] truncate">
                      {institutionName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vertical Stepper */}
              <motion.nav
                aria-label="Import Wizard Steps"
                variants={stepperContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-1.5"
              >
                {STEP_LABELS.map((item, idx) => {
                  const Icon = stepIcons[idx];
                  const isCurrent = activeTab === 'wizard' && item.id === step;
                  const isDone =
                    idx < activeStepIdx || (step === 'results' && item.id === 'results');
                  const canJumpBack =
                    activeTab === 'history'
                      ? idx <= activeStepIdx && !(idx > 1 && headers.length === 0)
                      : idx < activeStepIdx && step !== 'results';

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      variants={stepperItemVariants}
                      disabled={!canJumpBack && !isCurrent}
                      onClick={() => {
                        if (activeTab === 'history') {
                          setActiveTab('wizard');
                        }
                        if (canJumpBack) {
                          setStep(item.id);
                        }
                      }}
                      className={`relative w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors group ${
                        canJumpBack || isCurrent ? 'cursor-pointer' : 'cursor-default opacity-75'
                      }`}
                    >
                      {isCurrent && (
                        <motion.div
                          layoutId="csv-import-rail-active"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 bg-white border border-[#E4E2DA] rounded-xl shadow-2xs"
                        />
                      )}

                      <div
                        className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono-tabular transition-colors shrink-0 ${
                          isCurrent
                            ? 'bg-[#171717] text-white'
                            : isDone
                            ? 'bg-[#B8F2E6] text-[#171717]'
                            : 'bg-[#EDEAE0] text-[#57564F]'
                        }`}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="relative z-10 min-w-0">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isCurrent || isDone ? 'text-[#171717]' : 'text-[#57564F]'
                          }`}
                        >
                          {item.label}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.nav>

              {/* History Quick Access */}
              <div className="pt-4 border-t border-[#E4E2DA]">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(prev => (prev === 'history' ? 'wizard' : 'history'))
                  }
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-white text-[#171717] border border-[#E4E2DA] shadow-2xs'
                      : 'text-[#57564F] hover:text-[#171717] hover:bg-white/60'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <History className="w-4 h-4 shrink-0" />
                    <span>Import History</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#77766F]" />
                </button>
              </div>
            </div>

            {/* Bottom Progress & Selection Status */}
            <div className="pt-5 border-t border-[#E4E2DA] space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#57564F]">
                <span>
                  {activeTab === 'history'
                    ? 'Audit History'
                    : step === 'results'
                    ? 'Completed'
                    : `Step ${activeStepIdx + 1} of ${STEP_LABELS.length}`}
                </span>
                <span>
                  {activeTab === 'history'
                    ? 'Logs'
                    : `${Math.round(progressFraction * 100)}%`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#E4E2DA] rounded-sm overflow-hidden">
                <motion.div
                  className="h-full bg-[#171717] origin-left"
                  initial={false}
                  animate={{ scaleX: activeTab === 'history' ? 1 : progressFraction }}
                  transition={{ duration: 0.32, ease: CALM_EASE }}
                />
              </div>
              <p className="text-[11px] text-[#57564F] leading-relaxed truncate">
                Dataset: <span className="font-semibold text-[#171717]">{currentSchema.title}</span>
              </p>
            </div>
          </aside>

          {/* =========================================================
              MOBILE TOP STEP STRIP (Below lg)
             ========================================================= */}
          <div className="lg:hidden bg-[#F7F6EF] border-b border-[#E4E2DA] px-4 py-3 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#171717] text-white flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#171717] truncate">
                    {institutionName} · Bulk Import
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#57564F]">
                    {activeTab === 'history'
                      ? 'Import Audit History'
                      : `Step ${activeStepIdx + 1} of ${STEP_LABELS.length} · ${currentStepMeta.label}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(prev => (prev === 'history' ? 'wizard' : 'history'))
                  }
                  className="px-2.5 py-1 rounded-lg border border-[#E4E2DA] bg-white text-[11px] font-semibold text-[#171717] cursor-pointer"
                >
                  {activeTab === 'history' ? 'Wizard' : 'History'}
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close import modal"
                    className="p-1.5 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-black/5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'wizard' && (
              <div className="grid grid-cols-5 gap-1.5">
                {STEP_LABELS.map((item, idx) => {
                  const isCurrent = item.id === step;
                  const isDone = idx < activeStepIdx || step === 'results';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={idx >= activeStepIdx || step === 'results'}
                      onClick={() => {
                        if (idx < activeStepIdx && step !== 'results') setStep(item.id);
                      }}
                      className={`h-7 rounded-lg text-[11px] font-mono-tabular font-semibold transition-colors ${
                        isCurrent
                          ? 'bg-[#171717] text-white'
                          : isDone
                          ? 'bg-[#B8F2E6] text-[#171717] cursor-pointer'
                          : 'bg-white text-[#77766F] border border-[#E4E2DA]'
                      }`}
                    >
                      {isDone && !isCurrent ? '✓' : item.num}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* =========================================================
              RIGHT WORKSPACE PANE
             ========================================================= */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
            {/* Desktop Step Header */}
            <header className="hidden lg:flex items-start justify-between gap-4 px-8 pt-6 pb-4 border-b border-[#E4E2DA] shrink-0">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#77766F]">
                  {activeTab === 'history'
                    ? 'Audit Trail'
                    : `Step ${activeStepIdx + 1} of ${STEP_LABELS.length} · ${currentStepMeta.eyebrow}`}
                </div>
                <h2 className="font-serif-editorial text-2xl text-[#171717] font-semibold mt-0.5">
                  {activeTab === 'history'
                    ? 'Import History'
                    : currentStepMeta.heading}
                </h2>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close import modal"
                  className="p-2 rounded-lg text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF] transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </header>

            {/* Scrollable Body */}
            <div
              ref={bodyScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-8 py-6 bg-white"
            >
              <AnimatePresence mode="wait">
                {activeTab === 'history' ? (
                  <motion.div
                    key="tab-history"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: CALM_EASE }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-mono-tabular text-[#57564F]">
                        {historyEntries.length} recorded import batch
                        {historyEntries.length === 1 ? '' : 'es'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadImportHistory()}
                        className="btn-secondary h-8 text-xs"
                        disabled={historyLoading}
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`}
                        />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {historyError && (
                      <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                        {historyError}
                      </div>
                    )}

                    {historyLoading ? (
                      <div className="border border-[#E4E2DA] rounded-xl p-10 text-center text-xs text-[#57564F]">
                        Loading import history...
                      </div>
                    ) : historyEntries.length === 0 ? (
                      <div className="border border-[#E4E2DA] rounded-xl p-10 text-center space-y-2">
                        <History className="w-7 h-7 text-[#57564F] mx-auto" />
                        <p className="text-sm font-semibold text-[#171717]">
                          No imports recorded yet
                        </p>
                        <p className="text-xs text-[#57564F]">
                          Completed CSV or Excel imports will appear here with row counts, duplicate
                          mode, and duration.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-[#E4E2DA] rounded-xl overflow-x-auto bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF] text-[#57564F]">
                              <th className="py-2.5 px-3.5 font-semibold">Timestamp</th>
                              <th className="py-2.5 px-3.5 font-semibold">File</th>
                              <th className="py-2.5 px-3.5 font-semibold">Category</th>
                              <th className="py-2.5 px-3.5 font-semibold">Admin</th>
                              <th className="py-2.5 px-3.5 font-semibold">Mode</th>
                              <th className="py-2.5 px-3.5 font-semibold">Status</th>
                              <th className="py-2.5 px-3.5 font-semibold text-right">Created</th>
                              <th className="py-2.5 px-3.5 font-semibold text-right">Updated</th>
                              <th className="py-2.5 px-3.5 font-semibold text-right">Skipped</th>
                              <th className="py-2.5 px-3.5 font-semibold text-right">Failed</th>
                              <th className="py-2.5 px-3.5 font-semibold text-right">Duration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E2DA]">
                            {historyEntries.map(item => (
                              <tr key={item.id} className="hover:bg-[#F7F6EF]/50 transition-colors">
                                <td className="py-2.5 px-3.5 font-mono-tabular whitespace-nowrap text-[#57564F]">
                                  {new Date(item.createdAt).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3.5 font-medium text-[#171717]">
                                  {item.fileName}
                                </td>
                                <td className="py-2.5 px-3.5 text-[#171717]">
                                  {CATEGORY_SCHEMAS[item.category as ImportCategory]?.shortLabel ||
                                    item.category}
                                </td>
                                <td className="py-2.5 px-3.5 text-[#57564F]">{item.userName}</td>
                                <td className="py-2.5 px-3.5 capitalize text-[#57564F]">
                                  {item.duplicateMode}
                                </td>
                                <td className="py-2.5 px-3.5 font-medium">
                                  <span
                                    className={
                                      item.status === 'completed'
                                        ? 'text-emerald-800'
                                        : item.status === 'partial'
                                        ? 'text-amber-800'
                                        : 'text-rose-700'
                                    }
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono-tabular text-emerald-800 font-semibold">
                                  {item.createdCount}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono-tabular text-sky-800">
                                  {item.updatedCount}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono-tabular text-[#57564F]">
                                  {item.skippedCount}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono-tabular text-rose-700">
                                  {item.failedCount}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono-tabular text-[#57564F]">
                                  {item.durationMs}ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                ) : step === 'category' ? (
                  <motion.div
                    key="step-category"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: CALM_EASE }}
                    className="space-y-5"
                  >
                    {/* Toolbar above clean list */}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDownloadTemplate(category)}
                        className="btn-secondary h-8 text-xs whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download {currentSchema.shortLabel} Template</span>
                      </button>
                    </div>

                    {/* Clean Single-Column Hairline Radio List */}
                    <div
                      role="radiogroup"
                      aria-label="Academic Data Category"
                      className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] bg-white overflow-hidden"
                    >
                      {CATEGORY_ORDER.map(catId => {
                        const schema = CATEGORY_SCHEMAS[catId];
                        const selected = category === catId;
                        const reqFields = schema.fields.filter(f => f.required);
                        return (
                          <button
                            key={catId}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => handleSelectCategory(catId)}
                            className={`w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                              selected ? 'bg-[#F7F6EF]' : 'bg-white hover:bg-[#F7F6EF]/55'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Accessible Radio Dot */}
                              <span
                                aria-hidden="true"
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  selected
                                    ? 'border-[#171717] bg-white'
                                    : 'border-[#CFCBC0] bg-white'
                                }`}
                              >
                                {selected && (
                                  <span className="w-2 h-2 rounded-full bg-[#171717]" />
                                )}
                              </span>

                              <span className="text-sm font-semibold text-[#171717] truncate">
                                {schema.title}
                              </span>
                            </div>

                            <div className="hidden sm:flex items-center gap-6 shrink-0 text-xs font-mono-tabular text-right">
                              <div className="text-[#57564F]">
                                Key:{' '}
                                <span className="text-[#171717] font-medium">
                                  {schema.stableKeyLabel}
                                </span>
                              </div>
                              <div className="w-24 text-[#57564F]">
                                {reqFields.length > 0
                                  ? `${reqFields.length} required`
                                  : 'Multi-entity'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : step === 'upload' ? (
                  <motion.div
                    key="step-upload"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: CALM_EASE }}
                    className="space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#57564F]">
                        Required fields:{' '}
                        <span className="font-semibold text-[#171717]">
                          {currentSchema.fields
                            .filter(f => f.required)
                            .map(f => f.label)
                            .join(', ') || 'At least one entity identifier per row'}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleDownloadTemplate(category)}
                        className="btn-secondary h-8 text-xs whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download CSV Template</span>
                      </button>
                    </div>

                    {parseError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">File Could Not Be Parsed</p>
                          <p className="mt-0.5">{parseError}</p>
                        </div>
                      </div>
                    )}

                    {/* Uploading Screen Bar */}
                    {uploadProgress?.active ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/55 p-8 sm:p-10 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center shrink-0">
                              <Upload className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#171717] truncate">
                                {uploadProgress.stage}
                              </div>
                              <div className="text-xs font-mono-tabular text-[#57564F] truncate">
                                {uploadProgress.fileName}
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-mono-tabular font-semibold text-[#171717] shrink-0">
                            {uploadProgress.pct}%
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#E4E2DA] overflow-hidden">
                          <div
                            className="h-full bg-[#171717] transition-all duration-200"
                            style={{ width: `${uploadProgress.pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Clean Dropzone */
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
                        className={`rounded-xl p-8 text-center border-2 border-dashed transition-colors ${
                          isDragging
                            ? 'border-[#171717] bg-[#F7F6EF]'
                            : 'border-[#CFCBC0] bg-[#F7F6EF]/35 hover:border-[#171717]/60'
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
                        <div className="w-11 h-11 rounded-xl bg-white border border-[#E4E2DA] flex items-center justify-center mx-auto mb-3">
                          <Upload className="w-5 h-5 text-[#171717]" />
                        </div>
                        <p className="text-sm font-semibold text-[#171717]">
                          {fileName
                            ? `Loaded "${fileName}" (${rows.length} rows, ${headers.length} columns)`
                            : 'Drop CSV or Excel (.xlsx) file here'}
                        </p>
                        <p className="text-xs font-mono-tabular text-[#57564F] mt-1">
                          .csv · .tsv · .xlsx · Max 5 MB
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-primary h-9 text-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{fileName ? 'Replace File' : 'Select File'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPasteBox(prev => !prev)}
                            className="btn-secondary h-9 text-xs"
                          >
                            <span>
                              {showPasteBox ? 'Hide Paste Box' : 'Paste CSV'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {showPasteBox && !uploadProgress?.active && (
                      <div className="border border-[#E4E2DA] rounded-xl p-4 space-y-3 bg-[#F7F6EF]/40">
                        <label className="block text-xs font-semibold text-[#171717]">
                          Paste CSV Content
                        </label>
                        <textarea
                          value={pasteInput}
                          onChange={e => setPasteInput(e.target.value)}
                          rows={6}
                          placeholder={generateTemplateCsv(category)}
                          className="w-full p-3 rounded-xl border border-[#E4E2DA] bg-white font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleParsePastedText()}
                            disabled={!pasteInput.trim()}
                            className="btn-primary h-8 text-xs"
                          >
                            Upload Pasted Rows
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expected Columns Structured Table */}
                    <div className="border border-[#E4E2DA] rounded-xl overflow-hidden bg-white">
                      <div className="px-4 py-3 bg-[#F7F6EF] border-b border-[#E4E2DA] flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#171717]">
                          Expected Columns · {currentSchema.shortLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 bg-white">
                        {currentSchema.fields.map((field, idx) => (
                          <div
                            key={field.key}
                            className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-[#E4E2DA] ${
                              idx > 0 ? 'border-t' : ''
                            } ${idx === 1 ? 'md:border-t-0' : ''} ${
                              idx % 2 === 0 ? 'md:border-r' : ''
                            }`}
                          >
                            <span className="font-medium text-[#171717] truncate">
                              {field.label}
                              {field.required && <span className="text-rose-600 ml-1">*</span>}
                            </span>
                            <span className="font-mono-tabular text-[#57564F] shrink-0">
                              {field.sample}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : step === 'mapping' ? (
                  <motion.div
                    key="step-mapping"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: CALM_EASE }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#57564F]">
                        Source file:{' '}
                        <span className="font-semibold text-[#171717]">{fileName}</span> ·{' '}
                        <span className="font-mono-tabular">{rows.length} data rows</span>
                      </p>
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
                      <div className="flex flex-wrap items-center gap-2 text-xs pb-1">
                        <span className="font-semibold text-[#57564F]">Excel Worksheet:</span>
                        <div className="inline-flex flex-wrap p-1 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] gap-1">
                          {Object.keys(sheetTables).map(sName => (
                            <button
                              key={sName}
                              type="button"
                              onClick={() => handleSwitchExcelSheet(sName)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                activeSheetName === sName
                                  ? 'bg-[#171717] text-white'
                                  : 'text-[#57564F] hover:text-[#171717]'
                              }`}
                            >
                              {sName} ({sheetTables[sName].rows.length})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {mappingResult && mappingResult.conflictingMappings.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Conflicting Target Field Mapping Detected</p>
                          <p className="mt-0.5">
                            Multiple CSV columns map to the same field:{' '}
                            {mappingResult.conflictingMappings
                              .map(c => `${c.targetField} (${c.headers.join(', ')})`)
                              .join('; ')}
                            . Assign each column to a distinct SmartGrid field or ignore duplicates.
                          </p>
                        </div>
                      </div>
                    )}

                    {mappingResult && mappingResult.missingRequiredFields.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
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

                    <div className="border border-[#E4E2DA] rounded-xl overflow-x-auto bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF] text-[#57564F]">
                            <th className="py-2.5 px-3.5 font-semibold">Uploaded Header</th>
                            <th className="py-2.5 px-3.5 font-semibold">Sample Values</th>
                            <th className="py-2.5 px-3.5 font-semibold">Detection</th>
                            <th className="py-2.5 px-3.5 font-semibold">Target SmartGrid Field</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E2DA]">
                          {(mappingResult?.details || []).map((detail: ColumnMappingDetail, colIdx) => {
                            const sampleVals = rows
                              .slice(0, 2)
                              .map(r => r[colIdx])
                              .filter(Boolean)
                              .join(' · ');
                            const isConflict = mappingResult?.conflictingMappings.some(c =>
                              c.headers.includes(detail.header)
                            );
                            const statusLabel = isConflict
                              ? 'Conflict'
                              : detail.confidence === 'exact'
                              ? 'Exact Match'
                              : detail.confidence === 'synonym'
                              ? 'Synonym Auto'
                              : detail.confidence === 'manual'
                              ? 'Manual Override'
                              : detail.confidence === 'uncertain'
                              ? 'Needs Review'
                              : 'Unmapped';
                            const statusColor = isConflict
                              ? 'text-rose-700 font-semibold'
                              : detail.confidence === 'exact' ||
                                detail.confidence === 'synonym' ||
                                detail.confidence === 'manual'
                              ? 'text-emerald-800 font-medium'
                              : detail.confidence === 'uncertain'
                              ? 'text-amber-800 font-medium'
                              : 'text-[#77766F]';

                            return (
                              <tr key={detail.header} className="hover:bg-[#F7F6EF]/45">
                                <td className="py-2.5 px-3.5 font-mono-tabular font-medium text-[#171717]">
                                  {detail.header}
                                </td>
                                <td className="py-2.5 px-3.5 text-[#57564F] max-w-[220px] truncate">
                                  {sampleVals || <span className="italic">empty</span>}
                                </td>
                                <td className={`py-2.5 px-3.5 whitespace-nowrap ${statusColor}`} title={detail.reason}>
                                  {statusLabel}
                                </td>
                                <td className="py-2 px-3.5">
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
                  </motion.div>
                ) : step === 'preview' ? (
                  <motion.div
                    key="step-preview"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: CALM_EASE }}
                    className="space-y-6"
                  >
                    {(validationModeNote ||
                      (validationReport && validationReport.summary.errorRows > 0)) && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {validationModeNote && (
                          <p className="text-xs text-[#57564F]">{validationModeNote}</p>
                        )}
                        {validationReport && validationReport.summary.errorRows > 0 && (
                          <button
                            type="button"
                            onClick={handleDownloadErrors}
                            className="btn-secondary h-8 text-xs border-rose-300 text-rose-900 ml-auto"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              Download Error CSV ({validationReport.summary.errorRows})
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {isValidating && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="border border-[#E4E2DA] rounded-xl p-6 space-y-3 bg-[#F7F6EF]/45"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-[#171717]">
                          <span>Uploading &amp; validating {rows.length} rows...</span>
                          <span className="font-mono-tabular text-[#57564F]">Checking</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E4E2DA] overflow-hidden">
                          <div className="h-full w-2/3 bg-[#171717] animate-pulse rounded-full" />
                        </div>
                      </div>
                    )}

                    {!isValidating && validationReport && (
                      <>
                        {/* Unified Hairline Summary Metrics Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[#E4E2DA] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] bg-white overflow-hidden">
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-[#57564F]">Total Rows</p>
                            <p className="text-xl font-semibold font-mono-tabular text-[#171717] mt-0.5">
                              {validationReport.summary.totalRows}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-emerald-800">Ready</p>
                            <p className="text-xl font-semibold font-mono-tabular text-emerald-900 mt-0.5">
                              {validationReport.summary.validRows}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-amber-800">Warnings</p>
                            <p className="text-xl font-semibold font-mono-tabular text-amber-900 mt-0.5">
                              {validationReport.summary.warningRows}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-rose-700">Errors</p>
                            <p className="text-xl font-semibold font-mono-tabular text-rose-700 mt-0.5">
                              {validationReport.summary.errorRows}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-[#57564F]">Duplicates</p>
                            <p className="text-xl font-semibold font-mono-tabular text-[#171717] mt-0.5">
                              {validationReport.summary.duplicateRows}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] font-medium text-[#57564F]">Breakdown</p>
                            <p className="text-[11px] font-mono-tabular text-[#171717] mt-1.5">
                              Req {validationReport.summary.missingRequiredCount} · Type{' '}
                              {validationReport.summary.invalidTypeCount} · FK{' '}
                              {validationReport.summary.invalidFkCount}
                            </p>
                          </div>
                        </div>

                        {/* Duplicate Strategy — Clean Radio List */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#171717]">
                              Duplicate Record Handling
                            </h3>
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#171717] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={atomicMode}
                                onChange={e => setAtomicMode(e.target.checked)}
                                className="w-4 h-4 accent-[#171717] rounded border-[#CFCBC0]"
                              />
                              <span>Strict Atomic Import</span>
                            </label>
                          </div>

                          <div
                            role="radiogroup"
                            aria-label="Duplicate Record Handling Strategy"
                            className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] bg-white overflow-hidden"
                          >
                            {[
                              {
                                mode: 'skip' as DuplicateHandlingMode,
                                title: 'Skip Duplicates'
                              },
                              {
                                mode: 'update' as DuplicateHandlingMode,
                                title: 'Update Matching Records'
                              },
                              {
                                mode: 'stop' as DuplicateHandlingMode,
                                title: 'Stop on Duplicates'
                              }
                            ].map(opt => {
                              const selected = duplicateMode === opt.mode;
                              return (
                                <button
                                  key={opt.mode}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => void handleChangeDuplicateMode(opt.mode)}
                                  className={`w-full px-4 sm:px-5 py-3 flex items-center gap-3.5 text-left transition-colors cursor-pointer ${
                                    selected ? 'bg-[#F7F6EF]' : 'bg-white hover:bg-[#F7F6EF]/55'
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      selected
                                        ? 'border-[#171717] bg-white'
                                        : 'border-[#CFCBC0] bg-white'
                                    }`}
                                  >
                                    {selected && (
                                      <span className="w-2 h-2 rounded-full bg-[#171717]" />
                                    )}
                                  </span>
                                  <span className="text-[13px] font-semibold text-[#171717]">
                                    {opt.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Field-Level Diff Confirmation for Update Mode */}
                          {duplicateMode === 'update' && validationReport.summary.updateCount > 0 && (
                            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                              <p className="text-xs font-semibold text-amber-950">
                                Field-Level Diff Preview ({validationReport.summary.updateCount}{' '}
                                record{validationReport.summary.updateCount === 1 ? '' : 's'} will be
                                updated)
                              </p>
                              {validationReport.fieldDiffs.length > 0 && (
                                <div className="max-h-36 overflow-y-auto bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 text-xs">
                                  {validationReport.fieldDiffs.slice(0, 25).map(entry => (
                                    <div
                                      key={`${entry.row}-${entry.identifier}`}
                                      className="px-3 py-2 flex flex-wrap items-center gap-2"
                                    >
                                      <span className="font-mono-tabular font-semibold text-[#171717]">
                                        Row {entry.row} ({entry.identifier})
                                      </span>
                                      {entry.diffs.length === 0 ? (
                                        <span className="text-[#57564F]">
                                          Matching record values unchanged
                                        </span>
                                      ) : (
                                        entry.diffs.map(d => (
                                          <span
                                            key={d.field}
                                            className="px-1.5 py-0.5 rounded bg-[#F7F6EF] border border-[#E4E2DA] font-mono-tabular text-[11px]"
                                          >
                                            {d.label}: &ldquo;{String(d.before ?? '')}&rdquo; &rarr;
                                            &ldquo;{String(d.after ?? '')}&rdquo;
                                          </span>
                                        ))
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <label className="flex items-center gap-2.5 text-xs font-medium text-amber-950 cursor-pointer pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={confirmUpdates}
                                  onChange={e => setConfirmUpdates(e.target.checked)}
                                  className="w-4 h-4 accent-[#171717]"
                                />
                                <span>
                                  I confirm overwriting {validationReport.summary.updateCount}{' '}
                                  existing university record(s) with these updated CSV values.
                                </span>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Blocking Banners */}
                        {validationReport.blockingReason && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Import Blocked Before Execution</p>
                              <p className="mt-0.5">{validationReport.blockingReason}</p>
                            </div>
                          </div>
                        )}

                        {atomicMode && validationReport.summary.errorRows > 0 && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
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
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Commit Aborted</p>
                              <p className="mt-0.5">{commitError}</p>
                            </div>
                          </div>
                        )}

                        {/* Row Filter Segmented Control + Detailed Row Table */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex flex-wrap p-1 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA] gap-1">
                              {[
                                {
                                  id: 'all' as RowFilter,
                                  label: `All (${validationReport.rows.length})`
                                },
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
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                    rowFilter === tab.id
                                      ? 'bg-[#171717] text-white'
                                      : 'text-[#57564F] hover:text-[#171717]'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                            <span className="text-xs font-mono-tabular text-[#57564F]">
                              Showing {Math.min(filteredRows.length, 150)} of {filteredRows.length}{' '}
                              rows
                            </span>
                          </div>

                          <div className="border border-[#E4E2DA] rounded-xl overflow-x-auto max-h-72 overflow-y-auto bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead className="sticky top-0 bg-[#F7F6EF] border-b border-[#E4E2DA] text-[#57564F]">
                                <tr>
                                  <th className="py-2.5 px-3 font-semibold">Row</th>
                                  <th className="py-2.5 px-3 font-semibold">Identifier</th>
                                  <th className="py-2.5 px-3 font-semibold">Status</th>
                                  <th className="py-2.5 px-3 font-semibold">Action</th>
                                  <th className="py-2.5 px-3 font-semibold">
                                    Validation Details &amp; Suggested Fix
                                  </th>
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
                                        : 'hover:bg-[#F7F6EF]/45'
                                    }
                                  >
                                    <td className="py-2 px-3 font-mono-tabular text-[#57564F]">
                                      {r.rowNumber}
                                    </td>
                                    <td className="py-2 px-3 font-mono-tabular font-medium text-[#171717]">
                                      {r.identifier}
                                    </td>
                                    <td className="py-2 px-3 font-medium whitespace-nowrap">
                                      <span
                                        className={
                                          r.status === 'ready'
                                            ? 'text-emerald-800'
                                            : r.status === 'duplicate_update'
                                            ? 'text-sky-800'
                                            : r.status === 'duplicate_skip' ||
                                              r.status === 'warning'
                                            ? 'text-amber-800'
                                            : 'text-rose-700'
                                        }
                                      >
                                        {r.status}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 capitalize text-[#57564F]">
                                      {r.action}
                                    </td>
                                    <td className="py-2 px-3 space-y-1">
                                      {r.errors.map((err, eIdx) => (
                                        <div key={eIdx} className="text-rose-900">
                                          <span className="font-mono-tabular font-semibold">
                                            [{err.column}]
                                          </span>{' '}
                                          {err.message}{' '}
                                          <span className="text-[#57564F]">
                                            — Fix: {err.suggestion}
                                          </span>
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
                                        <span className="text-[#57564F]">
                                          Passed all validation checks
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {isCommitting && (
                          <div className="border border-[#E4E2DA] rounded-xl p-4 space-y-2 bg-[#F7F6EF]/50">
                            <div className="flex items-center justify-between text-xs font-medium text-[#171717]">
                              <span>{commitProgress.label}</span>
                              <span className="font-mono-tabular">{commitProgress.pct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#E4E2DA] overflow-hidden">
                              <div
                                className="h-full bg-[#171717] transition-all duration-300"
                                style={{ width: `${commitProgress.pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                ) : (
                  /* Step 5: Import Results */
                  commitResult && (
                    <motion.div
                      key="step-results"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: CALM_EASE }}
                      className="space-y-6"
                    >
                      <div
                        className={`p-6 rounded-xl border flex flex-wrap items-start justify-between gap-4 ${
                          commitResult.status === 'completed'
                            ? 'bg-[#B8F2E6]/30 border-[#8FDCC9]'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
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
                                Import{' '}
                                {commitResult.status === 'completed'
                                  ? 'Completed'
                                  : 'Finished with Skipped Errors'}
                              </h3>
                              {commitResult.idempotentReplay && (
                                <span className="text-xs font-mono-tabular text-[#57564F]">
                                  · Idempotent Replay
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-[#171717] mt-1">{commitResult.message}</p>
                            <p className="text-xs text-[#57564F] mt-1.5 flex items-center gap-1.5 font-mono-tabular">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                Processed in {commitResult.durationMs}ms · Persistence: Supabase
                                PostgreSQL (Verified)
                              </span>
                            </p>
                          </div>
                        </div>

                        {commitResult.counts.failed > 0 && commitResult.errorCsv && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanBase = (fileName || category).replace(/\.[^.]+$/, '');
                              triggerCsvDownload(
                                `${cleanBase}_errors.csv`,
                                commitResult.errorCsv
                              );
                            }}
                            className="btn-secondary h-9 text-xs border-rose-300 text-rose-900"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Error CSV ({commitResult.counts.failed} rows)</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 border border-[#E4E2DA] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] bg-white overflow-hidden">
                        <div className="px-4 py-4">
                          <p className="text-xs text-[#57564F]">Total Processed</p>
                          <p className="text-2xl font-semibold font-mono-tabular text-[#171717] mt-1">
                            {commitResult.counts.totalRows}
                          </p>
                        </div>
                        <div className="px-4 py-4">
                          <p className="text-xs text-emerald-800">Created</p>
                          <p className="text-2xl font-semibold font-mono-tabular text-emerald-900 mt-1">
                            {commitResult.counts.created}
                          </p>
                        </div>
                        <div className="px-4 py-4">
                          <p className="text-xs text-sky-800">Updated</p>
                          <p className="text-2xl font-semibold font-mono-tabular text-sky-900 mt-1">
                            {commitResult.counts.updated}
                          </p>
                        </div>
                        <div className="px-4 py-4">
                          <p className="text-xs text-amber-800">Skipped</p>
                          <p className="text-2xl font-semibold font-mono-tabular text-amber-900 mt-1">
                            {commitResult.counts.skipped}
                          </p>
                        </div>
                        <div className="px-4 py-4">
                          <p className="text-xs text-rose-700">Failed</p>
                          <p className="text-2xl font-semibold font-mono-tabular text-rose-700 mt-1">
                            {commitResult.counts.failed}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>

            {/* Sticky Footer (Matches Academic Setup Dialogue Panel) */}
            <footer className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-[#E4E2DA] bg-[#F7F6EF]/60 shrink-0">
              {activeTab === 'history' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('wizard')}
                    className="btn-secondary h-10 px-4 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Import Wizard</span>
                  </button>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-primary h-10 px-5 text-xs"
                    >
                      <span>Close</span>
                    </button>
                  )}
                </>
              ) : step === 'category' ? (
                <>
                  <div className="text-xs text-[#57564F] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      Selected: <strong className="text-[#171717]">{currentSchema.title}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-secondary h-10 px-4 text-xs"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      className="btn-primary h-10 px-5 text-xs"
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
                    className="btn-secondary h-10 px-4 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <div className="flex items-center gap-2.5">
                    {headers.length > 0 && rows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStep('mapping')}
                        className="btn-primary h-10 px-5 text-xs"
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
                    className="btn-secondary h-10 px-4 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Upload</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canAdvanceFromMapping}
                    onClick={() => void handleProceedToValidation()}
                    className="btn-primary h-10 px-5 text-xs"
                  >
                    <span>Next: Validate &amp; Preview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : step === 'preview' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('mapping')}
                    disabled={isCommitting}
                    className="btn-secondary h-10 px-4 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Adjust Column Mapping</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canExecuteCommit}
                    onClick={() => void handleCommitImport()}
                    className="btn-primary h-10 px-5 text-xs"
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
                      className="btn-secondary h-10 px-4 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Another File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="btn-secondary h-10 px-4 text-xs"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>View Import History</span>
                    </button>
                  </div>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-primary h-10 px-5 text-xs"
                    >
                      <span>Done</span>
                    </button>
                  )}
                </>
              )}
            </footer>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
};
