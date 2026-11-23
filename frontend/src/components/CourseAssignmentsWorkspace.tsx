import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FlaskConical,
  History,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { RouteType } from './SmartGridNav';
import { showAppPopup } from './ToastPopupHost';
import { institutionalStore } from '../data/store';
import {
  applyBulkAssignmentApi,
  AssignmentApiError,
  AuthenticatedVotingUser,
  clearOfferingAssignmentApi,
  copySectionAssignmentsApi,
  fetchAssignmentHistoryApi,
  fetchAssignmentWorkspaceApi,
  fetchInstitutionWorkspace,
  previewBulkAssignmentApi,
  saveOfferingAssignmentApi,
  syncAssignmentOfferingsApi,
  validateOfferingAssignmentApi
} from '../services/votingApi';
import type {
  AssignmentLaboratoryDTO,
  AssignmentOfferingDTO,
  AssignmentTimetableImpactDTO,
  AssignmentValidationResultDTO,
  AssignmentWorkspaceResponseDTO,
  BulkPreviewResponseDTO,
  CopySectionResponseDTO,
  StaffWorkloadDTO
} from '../types/institutional';

interface CourseAssignmentsWorkspaceProps {
  currentUser: AuthenticatedVotingUser;
  onNavigate: (route: RouteType) => void;
}

type WorkspaceTab = 'offerings' | 'workload' | 'history';
type SortField = 'course' | 'section' | 'hours' | 'status';

interface PendingImpactConfirm {
  mode: 'single' | 'clear_single' | 'bulk' | 'copy' | 'clear_bulk';
  title: string;
  description: string;
  affectedVersions?: Array<{ versionId: string; name: string; status: string }>;
  affectedCount?: number;
}

const STATUS_META: Record<
  AssignmentOfferingDTO['assignmentStatus'],
  { label: string; colorClass: string; dotColor: string; sortRank: number }
> = {
  assigned: {
    label: 'Assigned',
    colorClass: 'text-emerald-700',
    dotColor: '#15803D',
    sortRank: 4
  },
  partial: {
    label: 'Partial',
    colorClass: 'text-amber-700',
    dotColor: '#B45309',
    sortRank: 2
  },
  invalid: {
    label: 'Invalid',
    colorClass: 'text-red-700',
    dotColor: '#B91C1C',
    sortRank: 1
  },
  unassigned: {
    label: 'Unassigned',
    colorClass: 'text-neutral-600',
    dotColor: '#737373',
    sortRank: 3
  }
};

export const CourseAssignmentsWorkspace: React.FC<CourseAssignmentsWorkspaceProps> = ({
  currentUser,
  onNavigate
}) => {
  const institutionId =
    currentUser.institutionId || institutionalStore.getCurrentInstitutionId();

  // Workspace API data & loading states
  const [workspace, setWorkspace] = useState<AssignmentWorkspaceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('offerings');

  // Cascading hierarchy & table filters
  const [termFilter, setTermFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [componentFilter, setComponentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortAsc, setSortAsc] = useState(true);

  // Multi-select checkboxes
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Drawer State (preserving edits on failed save)
  const [activeOfferingId, setActiveOfferingId] = useState<string | null>(null);
  const [draftInstructorId, setDraftInstructorId] = useState<string>('');
  const [draftLabEngineerId, setDraftDraftLabEngineerId] = useState<string>('');
  const [draftAssignedLabId, setDraftAssignedLabId] = useState<string>('');
  const [allowWorkloadOverride, setAllowWorkloadOverride] = useState(false);
  const [staffPickerMode, setStaffPickerMode] = useState<'lecture' | 'lab' | null>(null);
  const [staffPickerSearch, setStaffPickerSearch] = useState('');
  const [liveValidation, setLiveValidation] = useState<
    | (AssignmentValidationResultDTO & {
        updatedWorkloadPreview?: {
          instructor?: StaffWorkloadDTO | null;
          labEngineer?: StaffWorkloadDTO | null;
        };
      })
    | null
  >(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingSingle, setIsSavingSingle] = useState(false);

  // Bulk Assign Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInstructorId, setBulkInstructorId] = useState('');
  const [bulkLabEngineerId, setBulkLabEngineerId] = useState('');
  const [bulkAssignedLabId, setBulkAssignedLabId] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkAllowOverride, setBulkAllowOverride] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponseDTO | null>(null);
  const [isLoadingBulkPreview, setIsLoadingBulkPreview] = useState(false);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  // Copy Section Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceSectionId, setCopySourceSectionId] = useState('');
  const [copyTargetSectionIds, setCopyTargetSectionIds] = useState<string[]>([]);
  const [copyOverwrite, setCopyOverwrite] = useState(false);
  const [copyAllowOverride, setCopyAllowOverride] = useState(false);
  const [copyPreview, setCopyPreview] = useState<CopySectionResponseDTO | null>(null);
  const [isLoadingCopyPreview, setIsLoadingCopyPreview] = useState(false);
  const [isApplyingCopy, setIsApplyingCopy] = useState(false);

  // Timetable Impact Confirmation Modal (HTTP 409)
  const [impactConfirm, setImpactConfirm] = useState<PendingImpactConfirm | null>(null);

  // Staff Workload Overview tab filters & detail
  const [workloadDeptFilter, setWorkloadDeptFilter] = useState('all');
  const [workloadRoleFilter, setWorkloadRoleFilter] = useState('all');
  const [workloadSearch, setWorkloadSearch] = useState('');
  const [selectedStaffForDetail, setSelectedStaffForDetail] = useState<StaffWorkloadDTO | null>(null);

  // Assignment History tab state
  const [historyRows, setHistoryRows] = useState<
    Array<{
      id: string;
      actor_name?: string;
      actor_role?: string;
      action: string;
      entity_type: string;
      entity_id: string;
      summary: string;
      previous_value?: string;
      new_value?: string;
      created_at: string;
    }>
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const syncStoreWithInstitution = useCallback(async () => {
    try {
      const ws = await fetchInstitutionWorkspace(currentUser, institutionId);
      institutionalStore.hydrateFromWorkspacePayload(institutionId, ws, currentUser.id);
    } catch {
      // Non-fatal background store refresh
    }
  }, [currentUser, institutionId]);

  const loadWorkspace = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetchAssignmentWorkspaceApi(currentUser, {
          universityId: institutionId,
          termId: termFilter !== 'all' ? termFilter : undefined,
          departmentId: deptFilter !== 'all' ? deptFilter : undefined,
          cohortCode: cohortFilter !== 'all' ? cohortFilter : undefined,
          programId: programFilter !== 'all' ? programFilter : undefined,
          sectionId: sectionFilter !== 'all' ? sectionFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          componentType: componentFilter !== 'all' ? componentFilter : undefined,
          search: searchQuery.trim() || undefined
        });
        setWorkspace(res);
        setSelectedIds(prev => prev.filter(id => res.offerings.some(o => o.id === id)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load Course Assignment Workspace.';
        setLoadError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentUser,
      institutionId,
      termFilter,
      deptFilter,
      cohortFilter,
      programFilter,
      sectionFilter,
      statusFilter,
      componentFilter,
      searchQuery
    ]
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchAssignmentHistoryApi(currentUser, institutionId);
      setHistoryRows(res.history || []);
    } catch (err) {
      showAppPopup({
        title: 'History Unavailable',
        message: err instanceof Error ? err.message : 'Failed to load assignment history.',
        variant: 'error'
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentUser, institutionId]);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Cascading dropdown options derived from workspace hierarchy
  const hierarchy = workspace?.hierarchy;
  const availableCohorts = useMemo(() => {
    if (!hierarchy) return [];
    const matching = hierarchy.sections.filter(
      s => deptFilter === 'all' || s.departmentId === deptFilter
    );
    return Array.from(new Set(matching.map(s => s.cohortCode).filter(Boolean))).sort();
  }, [hierarchy, deptFilter]);

  const availablePrograms = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.programs.filter(
      p => deptFilter === 'all' || p.departmentId === deptFilter
    );
  }, [hierarchy, deptFilter]);

  const availableSections = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.sections.filter(s => {
      if (deptFilter !== 'all' && s.departmentId !== deptFilter) return false;
      if (cohortFilter !== 'all' && s.cohortCode !== cohortFilter) return false;
      if (programFilter !== 'all' && s.programId !== programFilter) return false;
      return true;
    });
  }, [hierarchy, deptFilter, cohortFilter, programFilter]);

  // Reset downstream filters smoothly when upstream changes
  const handleDepartmentChange = (val: string) => {
    setDeptFilter(val);
    setCohortFilter('all');
    setProgramFilter('all');
    setSectionFilter('all');
  };
  const handleCohortChange = (val: string) => {
    setCohortFilter(val);
    setSectionFilter('all');
  };
  const handleProgramChange = (val: string) => {
    setProgramFilter(val);
    setSectionFilter('all');
  };

  // Sorted offerings
  const sortedOfferings = useMemo(() => {
    const items = [...(workspace?.offerings || [])];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'course') {
        cmp = a.courseCode.localeCompare(b.courseCode);
      } else if (sortField === 'section') {
        cmp = a.sectionLabel.localeCompare(b.sectionLabel);
      } else if (sortField === 'hours') {
        cmp = a.totalWeeklyHours - b.totalWeeklyHours;
      } else {
        cmp =
          STATUS_META[a.assignmentStatus].sortRank -
          STATUS_META[b.assignmentStatus].sortRank;
      }
      if (cmp === 0) cmp = a.courseCode.localeCompare(b.courseCode);
      return sortAsc ? cmp : -cmp;
    });
    return items;
  }, [workspace?.offerings, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const activeOffering = useMemo(
    () => workspace?.offerings.find(o => o.id === activeOfferingId) || null,
    [workspace?.offerings, activeOfferingId]
  );

  // Open Detail Drawer for an offering
  const openOfferingDrawer = (offering: AssignmentOfferingDTO) => {
    setActiveOfferingId(offering.id);
    setDraftInstructorId(offering.instructorId || '');
    setDraftDraftLabEngineerId(offering.labEngineerId || '');
    setDraftAssignedLabId(offering.assignedLabId || '');
    setAllowWorkloadOverride(false);
    setStaffPickerMode(null);
    setStaffPickerSearch('');
    setLiveValidation({
      valid: offering.valid,
      staffReady: offering.staffReady,
      status: offering.assignmentStatus,
      errors: offering.validationErrors,
      warnings: offering.validationWarnings,
      missingFields: offering.missingFields,
      timetableImpact: offering.timetableImpact
    });
  };

  // Dry-run live validation whenever drawer selections change
  const runDryValidation = useCallback(
    async (
      offeringId: string,
      instId: string,
      engId: string,
      labId: string,
      overrideCap: boolean
    ) => {
      setIsValidating(true);
      try {
        const res = await validateOfferingAssignmentApi(currentUser, {
          universityId: institutionId,
          offeringId,
          instructorId: instId || null,
          labEngineerId: engId || null,
          assignedLabId: labId || null,
          allowWorkloadOverride: overrideCap
        });
        setLiveValidation(res);
      } catch (err) {
        showAppPopup({
          title: 'Validation Check Failed',
          message: err instanceof Error ? err.message : 'Unable to validate assignment.',
          variant: 'error'
        });
      } finally {
        setIsValidating(false);
      }
    },
    [currentUser, institutionId]
  );

  const handleDraftChange = (
    patch: Partial<{
      instructorId: string;
      labEngineerId: string;
      assignedLabId: string;
      allowOverride: boolean;
    }>
  ) => {
    if (!activeOffering) return;
    const nextInst = patch.instructorId !== undefined ? patch.instructorId : draftInstructorId;
    const nextEng = patch.labEngineerId !== undefined ? patch.labEngineerId : draftLabEngineerId;
    const nextLab = patch.assignedLabId !== undefined ? patch.assignedLabId : draftAssignedLabId;
    const nextOv = patch.allowOverride !== undefined ? patch.allowOverride : allowWorkloadOverride;

    if (patch.instructorId !== undefined) setDraftInstructorId(nextInst);
    if (patch.labEngineerId !== undefined) setDraftDraftLabEngineerId(nextEng);
    if (patch.assignedLabId !== undefined) setDraftAssignedLabId(nextLab);
    if (patch.allowOverride !== undefined) setAllowWorkloadOverride(nextOv);

    void runDryValidation(activeOffering.id, nextInst, nextEng, nextLab, nextOv);
  };

  const handleSaveSingle = async (confirmImpact = false) => {
    if (!activeOffering) return;
    setIsSavingSingle(true);
    try {
      await saveOfferingAssignmentApi(currentUser, activeOffering.id, {
        universityId: institutionId,
        instructorId: activeOffering.requiresLecture ? (draftInstructorId || null) : null,
        labEngineerId: activeOffering.requiresLab ? (draftLabEngineerId || null) : null,
        assignedLabId: activeOffering.requiresLab ? (draftAssignedLabId || null) : null,
        allowWorkloadOverride,
        confirmTimetableImpact: confirmImpact
      });
      setImpactConfirm(null);
      showAppPopup({
        title: 'Assignment Saved',
        message: `${activeOffering.courseCode} (${activeOffering.sectionLabel}) updated cleanly.`,
        variant: 'success'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      if (err instanceof AssignmentApiError && err.status === 409 && err.data?.requiresConfirmation) {
        const impact = err.data.timetableImpact as AssignmentTimetableImpactDTO | undefined;
        setImpactConfirm({
          mode: 'single',
          title: 'Confirm Timetable Impact',
          description: err.message,
          affectedVersions: impact?.affectedVersions,
          affectedCount: impact?.affectedEntriesCount
        });
      } else if (err instanceof AssignmentApiError && err.status === 422 && err.data?.validation) {
        setLiveValidation(err.data.validation as AssignmentValidationResultDTO);
        showAppPopup({
          title: 'Validation Blocked Save',
          message: err.message,
          variant: 'error'
        });
      } else {
        showAppPopup({
          title: 'Failed to Save Assignment',
          message: err instanceof Error ? err.message : 'Unable to save assignment.',
          variant: 'error'
        });
      }
    } finally {
      setIsSavingSingle(false);
    }
  };

  const handleClearSingle = async (confirmImpact = false) => {
    if (!activeOffering) return;
    setIsSavingSingle(true);
    try {
      await clearOfferingAssignmentApi(currentUser, {
        universityId: institutionId,
        offeringIds: [activeOffering.id],
        fields: ['instructorId', 'labEngineerId', 'assignedLabId'],
        confirmTimetableImpact: confirmImpact
      });
      setImpactConfirm(null);
      setDraftInstructorId('');
      setDraftDraftLabEngineerId('');
      setDraftAssignedLabId('');
      showAppPopup({
        title: 'Assignment Cleared',
        message: `Cleared staff & lab assignments for ${activeOffering.courseCode} (${activeOffering.sectionLabel}).`,
        variant: 'info'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      if (err instanceof AssignmentApiError && err.status === 409 && err.data?.requiresConfirmation) {
        setImpactConfirm({
          mode: 'clear_single',
          title: 'Confirm Clearing Published Offering',
          description: err.message,
          affectedCount: Number(err.data.publishedImpactCount || 1)
        });
      } else {
        showAppPopup({
          title: 'Clear Failed',
          message: err instanceof Error ? err.message : 'Unable to clear assignment.',
          variant: 'error'
        });
      }
    } finally {
      setIsSavingSingle(false);
    }
  };

  const handleSyncOfferings = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAssignmentOfferingsApi(currentUser, {
        universityId: institutionId,
        termId: termFilter !== 'all' ? termFilter : undefined,
        departmentId: deptFilter !== 'all' ? deptFilter : undefined
      });
      showAppPopup({
        title: 'Course Offerings Synchronized',
        message: res.message,
        variant: res.createdCount > 0 ? 'success' : 'info'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      showAppPopup({
        title: 'Sync Failed',
        message: err instanceof Error ? err.message : 'Failed to synchronize offerings.',
        variant: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Multi-selection helpers
  const allVisibleSelected =
    sortedOfferings.length > 0 && sortedOfferings.every(o => selectedIds.includes(o.id));
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visSet = new Set(sortedOfferings.map(o => o.id));
      setSelectedIds(prev => prev.filter(id => !visSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...sortedOfferings.map(o => o.id)]);
      setSelectedIds(Array.from(merged));
    }
  };
  const toggleRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Bulk Assign workflow
  const openBulkModal = () => {
    setBulkInstructorId('');
    setBulkLabEngineerId('');
    setBulkAssignedLabId('');
    setBulkOverwrite(false);
    setBulkAllowOverride(false);
    setBulkPreview(null);
    setShowBulkModal(true);
  };

  const handlePreviewBulk = async () => {
    if (!bulkInstructorId && !bulkLabEngineerId && !bulkAssignedLabId) {
      showAppPopup({
        title: 'Select Field to Assign',
        message: 'Choose at least a Lecture Instructor, Lab Engineer, or Specific Lab to preview.',
        variant: 'info'
      });
      return;
    }
    setIsLoadingBulkPreview(true);
    try {
      const res = await previewBulkAssignmentApi(currentUser, {
        universityId: institutionId,
        offeringIds: selectedIds,
        instructorId: bulkInstructorId || null,
        labEngineerId: bulkLabEngineerId || null,
        assignedLabId: bulkAssignedLabId || null,
        overwriteExisting: bulkOverwrite,
        allowWorkloadOverride: bulkAllowOverride
      });
      setBulkPreview(res);
    } catch (err) {
      showAppPopup({
        title: 'Bulk Preview Failed',
        message: err instanceof Error ? err.message : 'Unable to compute bulk preview.',
        variant: 'error'
      });
    } finally {
      setIsLoadingBulkPreview(false);
    }
  };

  const handleApplyBulk = async (confirmImpact = false) => {
    setIsApplyingBulk(true);
    try {
      const res = await applyBulkAssignmentApi(currentUser, {
        universityId: institutionId,
        offeringIds: selectedIds,
        instructorId: bulkInstructorId || null,
        labEngineerId: bulkLabEngineerId || null,
        assignedLabId: bulkAssignedLabId || null,
        overwriteExisting: bulkOverwrite,
        allowWorkloadOverride: bulkAllowOverride,
        confirmTimetableImpact: confirmImpact
      });
      setImpactConfirm(null);
      setShowBulkModal(false);
      setSelectedIds([]);
      showAppPopup({
        title: 'Bulk Assignment Applied',
        message: res.message,
        variant: 'success'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      if (err instanceof AssignmentApiError && err.status === 409 && err.data?.requiresConfirmation) {
        setImpactConfirm({
          mode: 'bulk',
          title: 'Confirm Bulk Timetable Impact',
          description: err.message,
          affectedCount: Number(err.data.publishedImpactCount || 0)
        });
      } else {
        showAppPopup({
          title: 'Bulk Apply Blocked',
          message: err instanceof Error ? err.message : 'Unable to apply bulk updates.',
          variant: 'error'
        });
      }
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const handleClearBulk = async (confirmImpact = false) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await clearOfferingAssignmentApi(currentUser, {
        universityId: institutionId,
        offeringIds: selectedIds,
        fields: ['instructorId', 'labEngineerId', 'assignedLabId'],
        confirmTimetableImpact: confirmImpact
      });
      setImpactConfirm(null);
      setSelectedIds([]);
      showAppPopup({
        title: 'Selected Assignments Cleared',
        message: res.message,
        variant: 'info'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      if (err instanceof AssignmentApiError && err.status === 409 && err.data?.requiresConfirmation) {
        setImpactConfirm({
          mode: 'clear_bulk',
          title: 'Confirm Clearing Published Offerings',
          description: err.message,
          affectedCount: Number(err.data.publishedImpactCount || selectedIds.length)
        });
      } else {
        showAppPopup({
          title: 'Clear Failed',
          message: err instanceof Error ? err.message : 'Unable to clear selected assignments.',
          variant: 'error'
        });
      }
    }
  };

  // Copy Section workflow
  const openCopyModal = () => {
    const secs = hierarchy?.sections || [];
    setCopySourceSectionId(secs[0]?.id || '');
    setCopyTargetSectionIds([]);
    setCopyOverwrite(false);
    setCopyAllowOverride(false);
    setCopyPreview(null);
    setShowCopyModal(true);
  };

  const handlePreviewCopy = async () => {
    if (!copySourceSectionId || copyTargetSectionIds.length === 0) {
      showAppPopup({
        title: 'Select Source & Targets',
        message: 'Pick one source section and at least one target section.',
        variant: 'info'
      });
      return;
    }
    setIsLoadingCopyPreview(true);
    try {
      const res = await copySectionAssignmentsApi(currentUser, {
        universityId: institutionId,
        sourceSectionId: copySourceSectionId,
        targetSectionIds: copyTargetSectionIds,
        previewOnly: true,
        overwriteExisting: copyOverwrite,
        allowWorkloadOverride: copyAllowOverride
      });
      setCopyPreview(res);
    } catch (err) {
      showAppPopup({
        title: 'Copy Preview Failed',
        message: err instanceof Error ? err.message : 'Unable to preview section copy.',
        variant: 'error'
      });
    } finally {
      setIsLoadingCopyPreview(false);
    }
  };

  const handleApplyCopy = async (confirmImpact = false) => {
    setIsApplyingCopy(true);
    try {
      const res = await copySectionAssignmentsApi(currentUser, {
        universityId: institutionId,
        sourceSectionId: copySourceSectionId,
        targetSectionIds: copyTargetSectionIds,
        previewOnly: false,
        overwriteExisting: copyOverwrite,
        allowWorkloadOverride: copyAllowOverride,
        confirmTimetableImpact: confirmImpact
      });
      setImpactConfirm(null);
      setShowCopyModal(false);
      showAppPopup({
        title: 'Section Assignments Copied',
        message: res.message || `Copied ${res.copiedCount || 0} assignment(s).`,
        variant: 'success'
      });
      await loadWorkspace(true);
      await syncStoreWithInstitution();
    } catch (err) {
      if (err instanceof AssignmentApiError && err.status === 409 && err.data?.requiresConfirmation) {
        setImpactConfirm({
          mode: 'copy',
          title: 'Confirm Copy Over Published Schedule',
          description: err.message,
          affectedCount: Number(err.data.publishedImpactCount || 0)
        });
      } else {
        showAppPopup({
          title: 'Copy Blocked',
          message: err instanceof Error ? err.message : 'Unable to copy section assignments.',
          variant: 'error'
        });
      }
    } finally {
      setIsApplyingCopy(false);
    }
  };

  // Filtered staff list for Drawer Picker & Staff Workload Overview
  const staffDirectory = workspace?.staffDirectory || [];
  const laboratories = workspace?.laboratories || [];

  const filteredPickerStaff = useMemo(() => {
    if (!staffPickerMode) return [];
    const q = staffPickerSearch.trim().toLowerCase();
    return staffDirectory
      .filter(s => {
        if (staffPickerMode === 'lecture' && s.staffRole !== 'faculty') return false;
        if (staffPickerMode === 'lab' && s.staffRole !== 'lab_engineer') return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.staffCode.toLowerCase().includes(q) ||
          s.departmentCode.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (activeOffering) {
          const aSameDept = a.departmentId === activeOffering.departmentId ? 0 : 1;
          const bSameDept = b.departmentId === activeOffering.departmentId ? 0 : 1;
          if (aSameDept !== bSameDept) return aSameDept - bSameDept;
        }
        return a.utilizationPct - b.utilizationPct;
      });
  }, [staffDirectory, staffPickerMode, staffPickerSearch, activeOffering]);

  const filteredWorkloadStaff = useMemo(() => {
    const q = workloadSearch.trim().toLowerCase();
    return staffDirectory.filter(s => {
      if (workloadDeptFilter !== 'all' && s.departmentId !== workloadDeptFilter) return false;
      if (workloadRoleFilter !== 'all' && s.staffRole !== workloadRoleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.staffCode.toLowerCase().includes(q)
      );
    });
  }, [staffDirectory, workloadDeptFilter, workloadRoleFilter, workloadSearch]);

  const summary = workspace?.summary;
  const selectedStaffInstructor = staffDirectory.find(s => s.id === draftInstructorId);
  const selectedStaffEngineer = staffDirectory.find(s => s.id === draftLabEngineerId);

  const confirmModalProceed = () => {
    if (!impactConfirm) return;
    if (impactConfirm.mode === 'single') void handleSaveSingle(true);
    else if (impactConfirm.mode === 'clear_single') void handleClearSingle(true);
    else if (impactConfirm.mode === 'bulk') void handleApplyBulk(true);
    else if (impactConfirm.mode === 'copy') void handleApplyCopy(true);
    else if (impactConfirm.mode === 'clear_bulk') void handleClearBulk(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F6EF] text-[#171717]">
      <div className="max-w-[1440px] mx-auto px-6 py-7 space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E4E2DA] pb-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#737373] font-medium">
              Academic Management · Staff & Laboratory Allocation
            </p>
            <h1 className="serif-editorial text-3xl text-[#171717] mt-1">
              Course, Instructor &amp; Lab Engineer Assignments
            </h1>
            <p className="text-sm text-[#525252] mt-1">
              Explicitly assign qualified faculty, dedicated lab engineers, and pinned laboratories per section before timetable optimization.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncOfferings}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] text-[#171717] rounded-md transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Sync Missing Offerings</span>
              {summary && summary.unsyncedOfferingsCount > 0 && (
                <span className="font-mono-tabular text-[11px] font-semibold text-amber-700">
                  ({summary.unsyncedOfferingsCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={openCopyModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] text-[#171717] rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Section</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('generate')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#171717] hover:bg-[#2E2E2E] text-white rounded-md transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Timetable Solver</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-[#E4E2DA] rounded-md px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Total Offerings</div>
              <div className="font-mono-tabular text-2xl font-semibold text-[#171717] mt-1">
                {summary.totalOfferings}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">
                {summary.labOfferingsCount} include labs
              </div>
            </div>
            <div className="bg-white border border-[#E4E2DA] rounded-md px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Solver Ready</div>
              <div className="font-mono-tabular text-2xl font-semibold text-emerald-700 mt-1">
                {summary.generationReadyCount}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">
                {summary.completeCount} fully pinned
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('offerings');
                setStatusFilter('missing_instructor');
              }}
              className="text-left bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md px-4 py-3 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Missing Instructor</div>
              <div
                className={`font-mono-tabular text-2xl font-semibold mt-1 ${
                  summary.missingInstructorCount > 0 ? 'text-amber-700' : 'text-[#171717]'
                }`}
              >
                {summary.missingInstructorCount}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">Click to filter</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('offerings');
                setStatusFilter('missing_lab_engineer');
              }}
              className="text-left bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md px-4 py-3 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Missing Lab Engineer</div>
              <div
                className={`font-mono-tabular text-2xl font-semibold mt-1 ${
                  summary.missingLabEngineerCount > 0 ? 'text-amber-700' : 'text-[#171717]'
                }`}
              >
                {summary.missingLabEngineerCount}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">Required for labs</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('offerings');
                setStatusFilter('missing_lab');
              }}
              className="text-left bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md px-4 py-3 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Unpinned Labs</div>
              <div className="font-mono-tabular text-2xl font-semibold text-[#171717] mt-1">
                {summary.missingLaboratoryCount}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">Auto-selects unless pinned</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('offerings');
                setStatusFilter('invalid');
              }}
              className="text-left bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md px-4 py-3 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#737373]">Invalid Conflicts</div>
              <div
                className={`font-mono-tabular text-2xl font-semibold mt-1 ${
                  summary.invalidCount > 0 ? 'text-red-700' : 'text-[#171717]'
                }`}
              >
                {summary.invalidCount}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">Blocks timetable generation</div>
            </button>
          </div>
        )}

        {/* Workspace Tab Navigation */}
        <div className="flex items-center justify-between border-b border-[#E4E2DA]">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('offerings')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                activeTab === 'offerings'
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#737373] hover:text-[#171717]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Course Offerings</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('workload')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                activeTab === 'workload'
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#737373] hover:text-[#171717]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Workload Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#737373] hover:text-[#171717]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Assignment History</span>
            </button>
          </div>
          {summary && summary.generationReadyCount < summary.totalOfferings && (
            <div className="hidden md:flex items-center gap-2 text-xs text-amber-800 pb-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {summary.totalOfferings - summary.generationReadyCount} offering(s) still require staff/conflict resolution before optimization
              </span>
            </div>
          )}
        </div>

        {/* Error State */}
        {loadError && (
          <div className="bg-white border border-red-300 rounded-md p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadWorkspace()}
              className="px-3 py-1.5 text-xs font-medium bg-[#171717] text-white rounded-md"
            >
              Retry
            </button>
          </div>
        )}

        {/* TAB 1: COURSE OFFERINGS WORKSPACE */}
        {activeTab === 'offerings' && (
          <div className="space-y-4">
            {/* Cascading Hierarchy Filter Bar */}
            <div className="bg-white border border-[#E4E2DA] rounded-md p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Academic Term
                  </label>
                  <select
                    value={termFilter}
                    onChange={e => setTermFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Terms</option>
                    {(hierarchy?.terms || []).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={deptFilter}
                    onChange={e => handleDepartmentChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Departments</option>
                    {(hierarchy?.departments || []).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Cohort / Batch
                  </label>
                  <select
                    value={cohortFilter}
                    onChange={e => handleCohortChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Cohorts</option>
                    {availableCohorts.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Program
                  </label>
                  <select
                    value={programFilter}
                    onChange={e => handleProgramChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Programs</option>
                    {availablePrograms.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Section
                  </label>
                  <select
                    value={sectionFilter}
                    onChange={e => setSectionFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Sections</option>
                    {availableSections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} ({s.studentCount} students)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#E4E2DA]">
                <div className="md:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search course code, title, section, instructor, lab..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  />
                </div>
                <div className="md:col-span-3">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="missing_instructor">Missing Lecture Instructor</option>
                    <option value="missing_lab_engineer">Missing Lab Engineer</option>
                    <option value="missing_lab">No Specific Lab Pinned</option>
                    <option value="invalid">Invalid / Conflicts</option>
                    <option value="unassigned">Unassigned Only</option>
                    <option value="partial">Partial Assignment</option>
                    <option value="assigned">Assigned &amp; Complete</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={componentFilter}
                    onChange={e => setComponentFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                  >
                    <option value="all">All Components</option>
                    <option value="lecture">Includes Lecture</option>
                    <option value="lab">Includes Lab</option>
                    <option value="lecture_lab">Lecture + Lab</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTermFilter('all');
                      setDeptFilter('all');
                      setCohortFilter('all');
                      setProgramFilter('all');
                      setSectionFilter('all');
                      setStatusFilter('all');
                      setComponentFilter('all');
                      setSearchQuery('');
                    }}
                    className="w-full px-3 py-1.5 text-xs font-medium text-[#525252] hover:text-[#171717] border border-[#E4E2DA] rounded bg-white transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedIds.length > 0 && (
              <div className="bg-[#171717] text-white rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium">
                  <span className="font-mono-tabular font-semibold">{selectedIds.length}</span> offering(s) selected
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openBulkModal}
                    className="px-3 py-1.5 text-xs font-medium bg-white text-[#171717] hover:bg-[#F7F6EF] rounded transition-colors inline-flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Bulk Assign Staff / Lab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearBulk(false)}
                    className="px-3 py-1.5 text-xs font-medium bg-transparent border border-neutral-600 hover:border-white text-white rounded transition-colors inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Selected</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* Offerings Table */}
            <div className="bg-white border border-[#E4E2DA] rounded-md overflow-hidden">
              {isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-[#737373]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#171717]" />
                  <span>Loading section course offerings...</span>
                </div>
              ) : sortedOfferings.length === 0 ? (
                <div className="py-16 px-6 text-center space-y-3">
                  <p className="text-sm font-medium text-[#171717]">
                    No course offerings match the active filters.
                  </p>
                  <p className="text-xs text-[#737373] max-w-md mx-auto">
                    If you recently added courses or sections in Setup, synchronize offerings to materialize section-specific lecture &amp; lab assignment records.
                  </p>
                  <button
                    type="button"
                    onClick={handleSyncOfferings}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#171717] text-white rounded-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Course Offerings</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]/70 text-[11px] uppercase tracking-wider text-[#737373]">
                        <th className="py-2.5 pl-4 pr-2 w-8">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                            aria-label="Select all visible offerings"
                            className="rounded border-[#D4D1C7] text-[#171717] focus:ring-0"
                          />
                        </th>
                        <th className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => toggleSort('course')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-[#171717]"
                          >
                            <span>Course &amp; Component</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => toggleSort('section')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-[#171717]"
                          >
                            <span>Section / Hierarchy</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('hours')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-[#171717]"
                          >
                            <span>Load</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Lecture Instructor</th>
                        <th className="py-2.5 px-3">Lab Engineer</th>
                        <th className="py-2.5 px-3">Assigned Lab</th>
                        <th className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => toggleSort('status')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-[#171717]"
                          >
                            <span>Status</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-2.5 pl-3 pr-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA] text-xs">
                      {sortedOfferings.map(off => {
                        const meta = STATUS_META[off.assignmentStatus];
                        const isChecked = selectedIds.includes(off.id);
                        const isActiveRow = activeOfferingId === off.id;
                        return (
                          <tr
                            key={off.id}
                            className={`transition-colors ${
                              isActiveRow
                                ? 'bg-[#EFECE2]'
                                : isChecked
                                ? 'bg-[#F7F6EF]'
                                : 'hover:bg-[#FAF9F4]'
                            }`}
                          >
                            <td className="py-2.5 pl-4 pr-2 align-top">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRow(off.id)}
                                aria-label={`Select ${off.courseCode} ${off.sectionLabel}`}
                                className="mt-0.5 rounded border-[#D4D1C7] text-[#171717] focus:ring-0"
                              />
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-mono-tabular font-semibold text-[#171717]">
                                {off.courseCode}
                              </div>
                              <div className="text-[#525252] truncate max-w-[230px]">
                                {off.courseTitle}
                              </div>
                              <div className="text-[11px] text-[#737373] mt-0.5">
                                {off.requiresLecture && off.requiresLab
                                  ? `Lecture (${off.lectureHours}h) · Lab (${off.labHours}h)`
                                  : off.requiresLab
                                  ? `Lab Only (${off.labHours}h)`
                                  : `Lecture Only (${off.lectureHours}h)`}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-mono-tabular font-medium text-[#171717]">
                                {off.sectionLabel}
                              </div>
                              <div className="text-[11px] text-[#737373]">
                                {off.departmentCode || 'GEN'} · {off.cohortCode}
                                {off.programCode ? ` · ${off.programCode}` : ''}
                              </div>
                              <div className="font-mono-tabular text-[11px] text-[#737373]">
                                {off.expectedStudents} students
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top text-right font-mono-tabular whitespace-nowrap">
                              <div className="font-medium text-[#171717]">
                                {off.lectureCredits}+{off.labCredits} cr
                              </div>
                              <div className="text-[11px] text-[#737373]">
                                {off.totalWeeklyHours} h/wk
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              {!off.requiresLecture ? (
                                <span className="text-[#A3A3A3]">Not applicable</span>
                              ) : off.instructorName ? (
                                <div>
                                  <div className="font-medium text-[#171717]">{off.instructorName}</div>
                                  <div className="font-mono-tabular text-[11px] text-[#737373]">
                                    {off.instructorCode}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-amber-700 font-medium">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              {!off.requiresLab ? (
                                <span className="text-[#A3A3A3]">Not applicable</span>
                              ) : off.labEngineerName ? (
                                <div>
                                  <div className="font-medium text-[#171717]">{off.labEngineerName}</div>
                                  <div className="font-mono-tabular text-[11px] text-[#737373]">
                                    {off.labEngineerCode}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-amber-700 font-medium">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              {!off.requiresLab ? (
                                <span className="text-[#A3A3A3]">—</span>
                              ) : off.assignedLabId ? (
                                <div>
                                  <div className="font-mono-tabular font-medium text-[#171717]">
                                    {off.assignedLabCode}
                                  </div>
                                  <div className="text-[11px] text-[#737373] truncate max-w-[140px]">
                                    {off.assignedLabName}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[#737373]">Auto-select</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className={`inline-flex items-center gap-1.5 font-medium ${meta.colorClass}`}>
                                <span
                                  className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: meta.dotColor }}
                                />
                                <span>{meta.label}</span>
                              </div>
                              {off.validationErrors.length > 0 && (
                                <div className="text-[11px] text-red-700 mt-0.5 max-w-[200px] leading-snug">
                                  {off.validationErrors[0].message}
                                </div>
                              )}
                              {off.validationErrors.length === 0 && off.validationWarnings.length > 0 && (
                                <div className="text-[11px] text-amber-700 mt-0.5 max-w-[200px] leading-snug">
                                  {off.validationWarnings[0].message}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 pr-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => openOfferingDrawer(off)}
                                className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] text-[#171717] rounded transition-colors"
                              >
                                Assign
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: STAFF WORKLOAD OVERVIEW */}
        {activeTab === 'workload' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#E4E2DA] rounded-md p-4 flex flex-col sm:flex-row gap-3 items-end justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto flex-1">
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={workloadDeptFilter}
                    onChange={e => setWorkloadDeptFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  >
                    <option value="all">All Departments</option>
                    {(hierarchy?.departments || []).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Staff Role
                  </label>
                  <select
                    value={workloadRoleFilter}
                    onChange={e => setWorkloadRoleFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  >
                    <option value="all">All Roles</option>
                    <option value="faculty">Faculty (Lecture Instructors)</option>
                    <option value="lab_engineer">Lab Engineers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1">
                    Search Staff
                  </label>
                  <input
                    type="text"
                    value={workloadSearch}
                    onChange={e => setWorkloadSearch(e.target.value)}
                    placeholder="Name, email, or code..."
                    className="w-full px-3 py-1.5 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  />
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs text-[#525252] font-mono-tabular">
                <span>Total: {filteredWorkloadStaff.length}</span>
                <span className="text-red-700">
                  Overloaded: {filteredWorkloadStaff.filter(s => s.currentWeeklyHours > s.maxWeeklyHours).length}
                </span>
                <span>
                  Unassigned: {filteredWorkloadStaff.filter(s => s.currentWeeklyHours === 0).length}
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#E4E2DA] rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]/70 text-[11px] uppercase tracking-wider text-[#737373]">
                      <th className="py-2.5 px-4">Staff Member</th>
                      <th className="py-2.5 px-3">Role &amp; Dept</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Courses</th>
                      <th className="py-2.5 px-3 text-right">Lec Hrs</th>
                      <th className="py-2.5 px-3 text-right">Lab Hrs</th>
                      <th className="py-2.5 px-3 text-right">Total / Max</th>
                      <th className="py-2.5 px-3 w-44">Utilization</th>
                      <th className="py-2.5 px-4 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA] text-xs">
                    {filteredWorkloadStaff.map(st => {
                      const overloaded = st.currentWeeklyHours > st.maxWeeklyHours;
                      const barPct = Math.min(100, Math.round(st.utilizationPct));
                      return (
                        <tr
                          key={st.id}
                          onClick={() => setSelectedStaffForDetail(st)}
                          className="hover:bg-[#FAF9F4] cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-[#171717]">{st.name}</div>
                            <div className="text-[11px] text-[#737373]">
                              <span className="font-mono-tabular">{st.staffCode}</span> · {st.email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-[#171717]">
                              {st.staffRole === 'lab_engineer' ? 'Lab Engineer' : 'Faculty Instructor'}
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              {st.departmentCode || 'GEN'} · {st.designation}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 font-medium ${
                                st.isActive ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: st.isActive ? '#15803D' : '#B91C1C' }}
                              />
                              <span>{st.isActive ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            {st.assignedCoursesCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            {st.currentLectureHours}h
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            {st.currentLabHours}h
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                              overloaded ? 'text-red-700' : 'text-[#171717]'
                            }`}
                          >
                            {st.currentWeeklyHours} / {st.maxWeeklyHours}h
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#E4E2DA] rounded-full overflow-hidden">
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${barPct}%`,
                                    backgroundColor: overloaded
                                      ? '#B91C1C'
                                      : st.utilizationPct > 85
                                      ? '#B45309'
                                      : '#171717'
                                  }}
                                />
                              </div>
                              <span className="font-mono-tabular text-[11px] w-10 text-right">
                                {st.utilizationPct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular">
                            <span className={overloaded ? 'text-red-700 font-semibold' : 'text-[#525252]'}>
                              {st.remainingCapacityHours}h
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredWorkloadStaff.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-xs text-[#737373]">
                          No instructors or lab engineers found for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ASSIGNMENT HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white border border-[#E4E2DA] rounded-md overflow-hidden">
            {isLoadingHistory ? (
              <div className="py-16 flex items-center justify-center gap-2 text-xs text-[#737373]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading assignment audit history...</span>
              </div>
            ) : historyRows.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#737373]">
                No course assignment changes recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]/70 text-[11px] uppercase tracking-wider text-[#737373]">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Summary</th>
                      <th className="py-2.5 px-4">Change Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA] text-xs">
                    {historyRows.map(log => (
                      <tr key={log.id} className="hover:bg-[#FAF9F4]">
                        <td className="py-2.5 px-4 font-mono-tabular text-[11px] text-[#737373] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#171717]">{log.actor_name || 'Admin'}</div>
                          <div className="text-[11px] text-[#737373]">{log.actor_role || 'admin'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular uppercase text-[11px] font-semibold text-[#171717]">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-[#171717]">{log.summary}</td>
                        <td className="py-2.5 px-4 font-mono-tabular text-[11px] text-[#525252]">
                          {log.previous_value || log.new_value
                            ? `${log.previous_value || 'none'} → ${log.new_value || 'none'}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SLIDE-OVER DETAIL ASSIGNMENT DRAWER */}
      {activeOffering && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <div className="w-full max-w-xl bg-white h-full border-l border-[#E4E2DA] flex flex-col">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-[#E4E2DA] flex items-start justify-between gap-4 bg-[#F7F6EF]">
              <div>
                <div className="font-mono-tabular text-xs font-semibold text-[#737373]">
                  {activeOffering.courseCode} · {activeOffering.sectionLabel}
                </div>
                <h2 className="serif-editorial text-xl text-[#171717] mt-0.5">
                  {activeOffering.courseTitle}
                </h2>
                <div className="text-xs text-[#525252] mt-1 font-mono-tabular">
                  {activeOffering.departmentCode} · {activeOffering.cohortCode} · {activeOffering.expectedStudents} students · {activeOffering.totalWeeklyHours} h/wk total
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOfferingId(null)}
                className="p-1.5 text-[#737373] hover:text-[#171717] rounded"
                aria-label="Close assignment drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Lecture Instructor Assignment Block */}
              <div className="border border-[#E4E2DA] rounded-md p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#171717]">
                      Lecture Component
                    </h3>
                    <p className="text-[11px] text-[#737373] font-mono-tabular">
                      {activeOffering.requiresLecture
                        ? `${activeOffering.lectureCredits} credit hr · ${activeOffering.lectureHours} contact hrs/wk`
                        : 'No lecture sessions in this course'}
                    </p>
                  </div>
                  {activeOffering.requiresLecture && draftInstructorId && (
                    <button
                      type="button"
                      onClick={() => handleDraftChange({ instructorId: '' })}
                      className="text-[11px] text-red-700 hover:underline"
                    >
                      Clear Instructor
                    </button>
                  )}
                </div>

                {activeOffering.requiresLecture ? (
                  <>
                    <div className="flex items-center justify-between gap-3 p-3 bg-[#F7F6EF] border border-[#E4E2DA] rounded">
                      <div className="min-w-0">
                        {selectedStaffInstructor ? (
                          <>
                            <div className="text-xs font-semibold text-[#171717]">
                              {selectedStaffInstructor.name}
                            </div>
                            <div className="text-[11px] text-[#525252] font-mono-tabular mt-0.5">
                              {selectedStaffInstructor.staffCode} · {selectedStaffInstructor.departmentCode} ·{' '}
                              {(liveValidation?.updatedWorkloadPreview?.instructor?.currentWeeklyHours ??
                                selectedStaffInstructor.currentWeeklyHours)}
                              /{selectedStaffInstructor.maxWeeklyHours} h/wk
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-amber-700 font-medium">
                            No Lecture Instructor assigned
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffPickerMode(staffPickerMode === 'lecture' ? null : 'lecture');
                          setStaffPickerSearch('');
                        }}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] rounded"
                      >
                        {staffPickerMode === 'lecture' ? 'Hide Picker' : 'Choose Faculty'}
                      </button>
                    </div>

                    {staffPickerMode === 'lecture' && (
                      <div className="border border-[#E4E2DA] rounded-md bg-white overflow-hidden">
                        <div className="p-2 border-b border-[#E4E2DA] bg-[#F7F6EF]">
                          <input
                            type="text"
                            value={staffPickerSearch}
                            onChange={e => setStaffPickerSearch(e.target.value)}
                            placeholder="Filter faculty by name, code, or department..."
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-[#E4E2DA]">
                          {filteredPickerStaff.map(st => {
                            const selected = draftInstructorId === st.id;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                disabled={!st.isActive}
                                onClick={() => {
                                  handleDraftChange({ instructorId: st.id });
                                  setStaffPickerMode(null);
                                }}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                                  selected ? 'bg-[#EFECE2]' : 'hover:bg-[#FAF9F4]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-[#171717] flex items-center gap-2">
                                    <span>{st.name}</span>
                                    {!st.isActive && (
                                      <span className="text-[10px] text-red-700 font-semibold">Inactive</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#737373] font-mono-tabular">
                                    {st.staffCode} · {st.departmentCode} · {st.assignedCoursesCount} courses · {st.unavailableSlots.length} blocked slots
                                  </div>
                                </div>
                                <div className="text-right shrink-0 font-mono-tabular">
                                  <div className="text-[11px] font-semibold text-[#171717]">
                                    {st.currentWeeklyHours}/{st.maxWeeklyHours}h
                                  </div>
                                  <div className="w-16 h-1 bg-[#E4E2DA] rounded-full mt-1 overflow-hidden">
                                    <div
                                      className="h-full bg-[#171717]"
                                      style={{ width: `${Math.min(100, st.utilizationPct)}%` }}
                                    />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          {filteredPickerStaff.length === 0 && (
                            <div className="p-4 text-center text-xs text-[#737373]">
                              No matching active faculty instructors found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#737373]">
                    This is a Lab-only offering; no Theory instructor is required.
                  </p>
                )}
              </div>

              {/* Lab Engineer & Specific Laboratory Block */}
              <div className="border border-[#E4E2DA] rounded-md p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#171717] inline-flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Laboratory Component</span>
                    </h3>
                    <p className="text-[11px] text-[#737373] font-mono-tabular">
                      {activeOffering.requiresLab
                        ? `${activeOffering.labCredits} lab cr · ${activeOffering.labHours} contact hrs/wk (3h continuous blocks)`
                        : 'No laboratory component on this course'}
                    </p>
                  </div>
                  {activeOffering.requiresLab && draftLabEngineerId && (
                    <button
                      type="button"
                      onClick={() => handleDraftChange({ labEngineerId: '' })}
                      className="text-[11px] text-red-700 hover:underline"
                    >
                      Clear Lab Engineer
                    </button>
                  )}
                </div>

                {activeOffering.requiresLab ? (
                  <>
                    {/* Lab Engineer Picker */}
                    <div className="flex items-center justify-between gap-3 p-3 bg-[#F7F6EF] border border-[#E4E2DA] rounded">
                      <div className="min-w-0">
                        {selectedStaffEngineer ? (
                          <>
                            <div className="text-xs font-semibold text-[#171717]">
                              {selectedStaffEngineer.name}
                            </div>
                            <div className="text-[11px] text-[#525252] font-mono-tabular mt-0.5">
                              {selectedStaffEngineer.staffCode} · {selectedStaffEngineer.departmentCode} ·{' '}
                              {(liveValidation?.updatedWorkloadPreview?.labEngineer?.currentWeeklyHours ??
                                selectedStaffEngineer.currentWeeklyHours)}
                              /{selectedStaffEngineer.maxWeeklyHours} h/wk
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-amber-700 font-medium">
                            No Lab Engineer assigned
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffPickerMode(staffPickerMode === 'lab' ? null : 'lab');
                          setStaffPickerSearch('');
                        }}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] rounded"
                      >
                        {staffPickerMode === 'lab' ? 'Hide Picker' : 'Choose Lab Engineer'}
                      </button>
                    </div>

                    {staffPickerMode === 'lab' && (
                      <div className="border border-[#E4E2DA] rounded-md bg-white overflow-hidden">
                        <div className="p-2 border-b border-[#E4E2DA] bg-[#F7F6EF]">
                          <input
                            type="text"
                            value={staffPickerSearch}
                            onChange={e => setStaffPickerSearch(e.target.value)}
                            placeholder="Filter lab engineers by name, code, or department..."
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-[#E4E2DA]">
                          {filteredPickerStaff.map(st => {
                            const selected = draftLabEngineerId === st.id;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                disabled={!st.isActive}
                                onClick={() => {
                                  handleDraftChange({ labEngineerId: st.id });
                                  setStaffPickerMode(null);
                                }}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                                  selected ? 'bg-[#EFECE2]' : 'hover:bg-[#FAF9F4]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-[#171717]">
                                    {st.name}
                                    {!st.isActive && (
                                      <span className="ml-2 text-[10px] text-red-700 font-semibold">Inactive</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#737373] font-mono-tabular">
                                    {st.staffCode} · {st.departmentCode} · {st.assignedCoursesCount} labs
                                  </div>
                                </div>
                                <div className="text-right shrink-0 font-mono-tabular">
                                  <div className="text-[11px] font-semibold text-[#171717]">
                                    {st.currentWeeklyHours}/{st.maxWeeklyHours}h
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          {filteredPickerStaff.length === 0 && (
                            <div className="p-4 text-center text-xs text-[#737373]">
                              No matching active lab engineers found. Add staff with Lab Engineer role in Setup.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Specific Laboratory Pinning */}
                    <div className="pt-2 space-y-1.5">
                      <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                        Specific Assigned Laboratory (Optional Pinning)
                      </label>
                      <select
                        value={draftAssignedLabId}
                        onChange={e => handleDraftChange({ assignedLabId: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded focus:outline-none focus:border-[#171717]"
                      >
                        <option value="">Auto-select compatible lab during generation</option>
                        {laboratories.map((lab: AssignmentLaboratoryDTO) => (
                          <option key={lab.id} value={lab.id} disabled={!lab.isAvailable}>
                            {lab.code} — {lab.name} ({lab.capacity} seats
                            {!lab.isAvailable ? ' · Unavailable' : ''}
                            {lab.capacity < activeOffering.expectedStudents ? ' · Below capacity' : ''})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-[#737373]">
                        When pinned, DSatur, Genetic Algorithm, Simulated Annealing, and Validator strictly lock lab blocks to this room.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#737373]">
                    This course has zero lab hours; no Lab Engineer or Laboratory is required.
                  </p>
                )}
              </div>

              {/* Validation & Readiness Feedback Panel */}
              <div className="border border-[#E4E2DA] rounded-md p-4 bg-[#F7F6EF] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] inline-flex items-center gap-1.5">
                    {isValidating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : liveValidation?.valid && liveValidation?.staffReady ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>Live Assignment Validation</span>
                  </span>
                  {liveValidation && (
                    <span
                      className={`text-xs font-medium ${
                        STATUS_META[liveValidation.status].colorClass
                      }`}
                    >
                      {STATUS_META[liveValidation.status].label}
                    </span>
                  )}
                </div>

                {liveValidation?.errors && liveValidation.errors.length > 0 && (
                  <ul className="space-y-1 text-xs text-red-700">
                    {liveValidation.errors.map((e, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{e.message}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {liveValidation?.warnings && liveValidation.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-800">
                    {liveValidation.warnings.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{w.message}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {liveValidation?.valid &&
                  (!liveValidation.warnings || liveValidation.warnings.length === 0) &&
                  liveValidation.staffReady && (
                    <p className="text-xs text-emerald-700">
                      All role, qualification, workload, and room rules satisfied for timetable optimization.
                    </p>
                  )}

                {((liveValidation?.errors?.some(e => e.code.includes('workload')) ||
                  liveValidation?.warnings?.some(w => w.code.includes('workload'))) ??
                  false) && (
                  <label className="flex items-center gap-2 pt-2 border-t border-[#E4E2DA] text-xs text-[#171717] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowWorkloadOverride}
                      onChange={e => handleDraftChange({ allowOverride: e.target.checked })}
                      className="rounded border-[#D4D1C7] text-[#171717] focus:ring-0"
                    />
                    <span>Allow weekly workload cap override for this offering</span>
                  </label>
                )}

                {liveValidation?.timetableImpact?.hasPublishedImpact && (
                  <div className="pt-2 border-t border-[#E4E2DA] text-[11px] text-[#525252]">
                    Referenced in published/active timetable version(s):{' '}
                    {liveValidation.timetableImpact.affectedVersions.map(v => v.name).join(', ')}. Saving requires confirmation; published versions stay intact until regeneration.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-[#E4E2DA] bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleClearSingle(false)}
                disabled={isSavingSingle}
                className="px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-md transition-colors disabled:opacity-50"
              >
                Clear Assignment
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveOfferingId(null)}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] text-[#171717] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSingle(false)}
                  disabled={isSavingSingle || (liveValidation !== null && !liveValidation.valid)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#171717] hover:bg-[#2E2E2E] text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {isSavingSingle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAFF WORKLOAD DETAIL MODAL */}
      {selectedStaffForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="bg-white border border-[#E4E2DA] rounded-md w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
              <div>
                <h3 className="serif-editorial text-xl text-[#171717]">
                  {selectedStaffForDetail.name}
                </h3>
                <p className="text-xs text-[#525252] font-mono-tabular mt-0.5">
                  {selectedStaffForDetail.staffCode} · {selectedStaffForDetail.departmentCode} ·{' '}
                  {selectedStaffForDetail.currentWeeklyHours}/{selectedStaffForDetail.maxWeeklyHours} h/wk ({selectedStaffForDetail.utilizationPct}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffForDetail(null)}
                className="p-1 text-[#737373] hover:text-[#171717]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-2">
                  Assigned Course Offerings ({selectedStaffForDetail.assignedOfferings.length})
                </h4>
                {selectedStaffForDetail.assignedOfferings.length === 0 ? (
                  <p className="text-xs text-[#737373]">No course offerings currently assigned.</p>
                ) : (
                  <div className="border border-[#E4E2DA] rounded divide-y divide-[#E4E2DA]">
                    {selectedStaffForDetail.assignedOfferings.map((ao, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono-tabular font-semibold text-[#171717]">{ao.courseCode}</span>{' '}
                          <span className="text-[#525252]">— {ao.courseTitle}</span>
                          <div className="text-[11px] text-[#737373]">
                            Section {ao.sectionLabel} · {ao.role}
                          </div>
                        </div>
                        <span className="font-mono-tabular font-semibold text-[#171717]">
                          {ao.hours} h/wk
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedStaffForDetail.unavailableSlots.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-2">
                    Unavailable Time Windows
                  </h4>
                  <div className="flex flex-wrap gap-3 text-xs font-mono-tabular text-[#525252]">
                    {selectedStaffForDetail.unavailableSlots.map((u, idx) => (
                      <span key={idx}>
                        {u.day} {u.startTime}–{u.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGNMENT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="bg-white border border-[#E4E2DA] rounded-md w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
              <div>
                <h3 className="serif-editorial text-xl text-[#171717]">
                  Bulk Assign Across {selectedIds.length} Offering(s)
                </h3>
                <p className="text-xs text-[#737373]">
                  Select any combination of Faculty Instructor, Lab Engineer, and Pinned Lab, then preview cumulative load before applying.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-[#737373] hover:text-[#171717]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase mb-1">
                    Lecture Instructor (Optional)
                  </label>
                  <select
                    value={bulkInstructorId}
                    onChange={e => {
                      setBulkInstructorId(e.target.value);
                      setBulkPreview(null);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  >
                    <option value="">Leave unchanged</option>
                    {staffDirectory
                      .filter(s => s.staffRole === 'faculty' && s.isActive)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.currentWeeklyHours}/{s.maxWeeklyHours}h)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase mb-1">
                    Lab Engineer (Optional)
                  </label>
                  <select
                    value={bulkLabEngineerId}
                    onChange={e => {
                      setBulkLabEngineerId(e.target.value);
                      setBulkPreview(null);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  >
                    <option value="">Leave unchanged</option>
                    {staffDirectory
                      .filter(s => s.staffRole === 'lab_engineer' && s.isActive)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.currentWeeklyHours}/{s.maxWeeklyHours}h)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] uppercase mb-1">
                    Specific Laboratory (Optional)
                  </label>
                  <select
                    value={bulkAssignedLabId}
                    onChange={e => {
                      setBulkAssignedLabId(e.target.value);
                      setBulkPreview(null);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                  >
                    <option value="">Leave unchanged</option>
                    {laboratories
                      .filter(l => l.isAvailable)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.name} ({l.capacity} cap)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkOverwrite}
                    onChange={e => {
                      setBulkOverwrite(e.target.checked);
                      setBulkPreview(null);
                    }}
                    className="rounded border-[#D4D1C7] text-[#171717]"
                  />
                  <span>Overwrite already assigned offerings (otherwise fills unassigned only)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkAllowOverride}
                    onChange={e => {
                      setBulkAllowOverride(e.target.checked);
                      setBulkPreview(null);
                    }}
                    className="rounded border-[#D4D1C7] text-[#171717]"
                  />
                  <span>Allow weekly workload cap override</span>
                </label>
              </div>

              {bulkPreview && (
                <div className="border border-[#E4E2DA] rounded-md overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F7F6EF] border-b border-[#E4E2DA] flex flex-wrap gap-4 text-xs font-mono-tabular">
                    <span>Will Update: <strong>{bulkPreview.applicableCount}</strong></span>
                    <span>Overwrites: <strong>{bulkPreview.overwriteCount}</strong></span>
                    <span className={bulkPreview.invalidCount > 0 ? 'text-red-700' : ''}>
                      Invalid: <strong>{bulkPreview.invalidCount}</strong>
                    </span>
                    {bulkPreview.publishedImpactCount > 0 && (
                      <span className="text-amber-700">
                        Published Schedule Impact: <strong>{bulkPreview.publishedImpactCount}</strong>
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#E4E2DA] text-xs">
                    {bulkPreview.previewRows.map(r => (
                      <div key={r.offeringId} className="px-4 py-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-[#171717]">
                            <span className="font-mono-tabular">{r.courseCode}</span> · {r.sectionLabel}
                          </div>
                          {r.changedFields.length === 0 ? (
                            <div className="text-[11px] text-[#737373]">
                              Skipped ({r.skippedReasons.join(', ') || 'unchanged'})
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#525252]">
                              Fields: {r.changedFields.join(', ')}
                            </div>
                          )}
                          {r.errors.length > 0 && (
                            <div className="text-[11px] text-red-700 mt-0.5">{r.errors[0].message}</div>
                          )}
                        </div>
                        <span className={r.valid ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                          {r.valid ? 'Valid' : 'Blocked'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
              <button
                type="button"
                onClick={handlePreviewBulk}
                disabled={isLoadingBulkPreview}
                className="px-4 py-2 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md inline-flex items-center gap-1.5"
              >
                {isLoadingBulkPreview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Preview Changes</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyBulk(false)}
                  disabled={isApplyingBulk || !bulkPreview || bulkPreview.invalidCount > 0 || bulkPreview.applicableCount === 0}
                  className="px-4 py-2 text-xs font-medium bg-[#171717] hover:bg-[#2E2E2E] text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isApplyingBulk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Apply Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COPY SECTION MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="bg-white border border-[#E4E2DA] rounded-md w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
              <div>
                <h3 className="serif-editorial text-xl text-[#171717]">
                  Copy Assignments Between Sections
                </h3>
                <p className="text-xs text-[#737373]">
                  Copy matching course instructors, lab engineers, and pinned labs from one section onto sibling sections with full workload validation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="p-1 text-[#737373] hover:text-[#171717]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[#737373] uppercase mb-1">
                  Source Section
                </label>
                <select
                  value={copySourceSectionId}
                  onChange={e => {
                    const nextSrc = e.target.value;
                    setCopySourceSectionId(nextSrc);
                    setCopyTargetSectionIds(prev => prev.filter(id => id !== nextSrc));
                    setCopyPreview(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#F7F6EF] border border-[#E4E2DA] rounded"
                >
                  {(hierarchy?.sections || []).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#737373] uppercase mb-1">
                  Target Sections
                </label>
                <div className="max-h-40 overflow-y-auto border border-[#E4E2DA] rounded divide-y divide-[#E4E2DA]">
                  {(hierarchy?.sections || [])
                    .filter(s => s.id !== copySourceSectionId)
                    .map(s => {
                      const checked = copyTargetSectionIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="px-3 py-2 flex items-center gap-2.5 text-xs hover:bg-[#FAF9F4] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setCopyTargetSectionIds(prev =>
                                prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                              );
                              setCopyPreview(null);
                            }}
                            className="rounded border-[#D4D1C7] text-[#171717]"
                          />
                          <span className="font-mono-tabular font-medium text-[#171717]">{s.code}</span>
                          <span className="text-[#737373]">{s.cohortCode}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex flex-wrap gap-6 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyOverwrite}
                    onChange={e => {
                      setCopyOverwrite(e.target.checked);
                      setCopyPreview(null);
                    }}
                    className="rounded border-[#D4D1C7] text-[#171717]"
                  />
                  <span>Overwrite existing target assignments</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyAllowOverride}
                    onChange={e => {
                      setCopyAllowOverride(e.target.checked);
                      setCopyPreview(null);
                    }}
                    className="rounded border-[#D4D1C7] text-[#171717]"
                  />
                  <span>Allow weekly workload cap override</span>
                </label>
              </div>

              {copyPreview && (
                <div className="border border-[#E4E2DA] rounded-md overflow-hidden">
                  <div className="px-4 py-2 bg-[#F7F6EF] border-b border-[#E4E2DA] text-xs font-mono-tabular flex flex-wrap gap-4">
                    <span>Matched: <strong>{copyPreview.matchedOfferings || 0}</strong></span>
                    <span>Will Apply: <strong>{copyPreview.willApplyCount || 0}</strong></span>
                    <span>Overwrites: <strong>{copyPreview.overwriteCount || 0}</strong></span>
                    <span className={(copyPreview.invalidCount || 0) > 0 ? 'text-red-700' : ''}>
                      Invalid: <strong>{copyPreview.invalidCount || 0}</strong>
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#E4E2DA] text-xs">
                    {(copyPreview.items || []).map(item => (
                      <div key={item.offeringId} className="px-4 py-2 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono-tabular font-semibold">{item.courseCode}</span> · {item.sectionLabel}
                          {item.errors.length > 0 && (
                            <div className="text-[11px] text-red-700">{item.errors[0].message}</div>
                          )}
                        </div>
                        <span className={item.valid ? 'text-emerald-700' : 'text-red-700'}>
                          {item.valid ? `${item.changedFields.length} field(s)` : 'Invalid'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
              <button
                type="button"
                onClick={handlePreviewCopy}
                disabled={isLoadingCopyPreview}
                className="px-4 py-2 text-xs font-medium bg-white border border-[#E4E2DA] hover:border-[#171717] rounded-md inline-flex items-center gap-1.5"
              >
                {isLoadingCopyPreview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Preview Copy</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCopy(false)}
                  disabled={
                    isApplyingCopy ||
                    !copyPreview ||
                    (copyPreview.invalidCount || 0) > 0 ||
                    (copyPreview.willApplyCount || 0) === 0
                  }
                  className="px-4 py-2 text-xs font-medium bg-[#171717] text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isApplyingCopy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIMETABLE IMPACT CONFIRMATION MODAL (HTTP 409) */}
      {impactConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white border border-[#E4E2DA] rounded-md w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[#171717]">
                  {impactConfirm.title}
                </h3>
                <p className="text-xs text-[#525252] mt-1 leading-relaxed">
                  {impactConfirm.description}
                </p>
                {impactConfirm.affectedVersions && impactConfirm.affectedVersions.length > 0 && (
                  <div className="mt-2 p-2.5 bg-[#F7F6EF] border border-[#E4E2DA] rounded text-[11px] text-[#171717]">
                    Versions impacted: {impactConfirm.affectedVersions.map(v => `${v.name} (${v.status})`).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImpactConfirm(null)}
                className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E4E2DA] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModalProceed}
                className="px-4 py-2 text-xs font-medium bg-[#171717] text-white rounded-md"
              >
                Confirm &amp; Save Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
