import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Eye,
  Check,
  Calendar,
  Layers,
  Award,
  Users,
  Building2,
  AlertCircle
} from 'lucide-react';
import {
  AuthenticatedVotingUser,
  ValidationReportDTO,
  ValidationOverviewDTO,
  fetchValidationReportsApi,
  runTimetableValidationApi
} from '../services/votingApi';
import { showAppPopup } from './ToastPopupHost';

interface ValidationReportsPageProps {
  currentUser: AuthenticatedVotingUser;
}

export const ValidationReportsPage: React.FC<ValidationReportsPageProps> = ({ currentUser }) => {
  const [reports, setReports] = useState<ValidationReportDTO[]>([]);
  const [summary, setSummary] = useState<ValidationOverviewDTO>({
    totalGenerated: 0,
    fullyValid: 0,
    withIssues: 0,
    incomplete: 0,
    latestTimestamp: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<ValidationReportDTO | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchValidationReportsApi(currentUser);
      setReports(res.reports || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      showAppPopup({
        title: 'Failed to Load Reports',
        message: err.message || 'Could not fetch validation reports history.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRevalidate = async (versionId: string) => {
    try {
      setValidatingId(versionId);
      const res = await runTimetableValidationApi(currentUser, versionId);
      showAppPopup({
        title: 'Validation Complete',
        message: `Timetable re-validated successfully. Status: ${res.report.validation_status}`,
        variant: 'success'
      });
      await loadReports();
      if (selectedReport && selectedReport.timetable_version_id === versionId) {
        setSelectedReport(res.report);
      }
    } catch (err: any) {
      showAppPopup({
        title: 'Validation Failed',
        message: err.message || 'Could not run validation check.',
        variant: 'error'
      });
    } finally {
      setValidatingId(null);
    }
  };

  const exportReportCSV = (report: ValidationReportDTO) => {
    const rows = [
      ['SmartGrid AI Timetable Validation Quality Report'],
      ['Report ID', report.id],
      ['Timetable Version ID', report.timetable_version_id],
      ['Version Name', report.versionName || 'N/A'],
      ['Validation Status', report.validation_status],
      ['Timestamp', report.validation_timestamp],
      ['Total Required Sessions', String(report.total_required_sessions)],
      ['Total Scheduled Sessions', String(report.total_scheduled_sessions)],
      ['Total Unscheduled Sessions', String(report.total_unscheduled_sessions)],
      ['Hard Violations Count', String(report.total_hard_violations)],
      ['Warnings Count', String(report.total_warnings)],
      ['Section Conflicts', String(report.section_conflict_count)],
      ['Instructor Conflicts', String(report.instructor_conflict_count)],
      ['Lab Engineer Conflicts', String(report.lab_engineer_conflict_count)],
      ['Room Conflicts', String(report.room_conflict_count)],
      ['Invalid Duration Count', String(report.invalid_duration_count)],
      [''],
      ['Violation Type', 'Severity', 'Session IDs', 'Message']
    ];

    (report.report_data?.violations || []).forEach(v => {
      rows.push([v.type, v.severity, (v.sessionIds || []).join('; '), `"${(v.message || '').replace(/"/g, '""')}"`]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `validation_report_${report.timetable_version_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredReports = reports.filter(r => {
    const matchesStatus = selectedStatusFilter === 'ALL' || r.validation_status === selectedStatusFilter;
    const matchesSearch = (r.versionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.timetable_version_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Valid</span>
          </span>
        );
      case 'VALID WITH WARNINGS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Valid with Warnings</span>
          </span>
        );
      case 'INVALID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B]">
            <XCircle className="w-3.5 h-3.5" />
            <span>Invalid (Conflicts)</span>
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F3E8FF] text-[#6B21A8]">
            <Clock className="w-3.5 h-3.5" />
            <span>Incomplete</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EDEAE0] text-[#525252]">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E4E2DA] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#77766F] mb-1">
            <ShieldCheck className="w-4 h-4 text-[#171717]" />
            <span>Quality Governance & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171717] tracking-tight">
            Timetable Validation & Quality Reports
          </h1>
          <p className="text-sm text-[#77766F] mt-1 max-w-2xl">
            Permanent compliance records, hard and soft constraint audits, credit-hour fulfillment tracking, and conflict prevention for every generated schedule version.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadReports}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E4E2DA] hover:bg-[#EDEAE0] text-[#171717] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Reports</span>
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-medium text-[#77766F] uppercase tracking-wider">Total Generated</div>
          <div className="text-3xl font-extrabold text-[#171717] mt-2">{summary.totalGenerated}</div>
          <div className="text-xs text-[#77766F] mt-1">All audit runs</div>
        </div>

        <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-medium text-[#166534] uppercase tracking-wider">Fully Valid</div>
          <div className="text-3xl font-extrabold text-[#166534] mt-2">{summary.fullyValid}</div>
          <div className="text-xs text-[#77766F] mt-1">Zero conflict schedules</div>
        </div>

        <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-medium text-[#854D0E] uppercase tracking-wider">With Issues</div>
          <div className="text-3xl font-extrabold text-[#854D0E] mt-2">{summary.withIssues}</div>
          <div className="text-xs text-[#77766F] mt-1">Conflicts or warnings</div>
        </div>

        <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-medium text-[#6B21A8] uppercase tracking-wider">Incomplete</div>
          <div className="text-3xl font-extrabold text-[#6B21A8] mt-2">{summary.incomplete}</div>
          <div className="text-xs text-[#77766F] mt-1">Unscheduled sessions</div>
        </div>

        <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-medium text-[#77766F] uppercase tracking-wider">Latest Audit Time</div>
          <div className="text-xs font-bold text-[#171717] mt-3">
            {summary.latestTimestamp ? new Date(summary.latestTimestamp).toLocaleString() : 'No audits yet'}
          </div>
          <div className="text-[11px] text-[#77766F] mt-1">Real-time sync</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-[#E4E2DA] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77766F]" />
            <input
              type="text"
              placeholder="Search by version name or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F6EF] border border-[#E4E2DA] rounded-xl text-xs font-medium text-[#171717] focus:outline-none focus:border-[#171717]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <span className="text-xs font-semibold text-[#77766F] flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['ALL', 'VALID', 'VALID WITH WARNINGS', 'INVALID', 'INCOMPLETE'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedStatusFilter === st
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#F7F6EF] text-[#77766F] hover:bg-[#EDEAE0] hover:text-[#171717]'
              }`}
            >
              {st === 'ALL' ? 'All Statuses' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Reports History Table */}
      <div className="bg-white border border-[#E4E2DA] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-bold uppercase tracking-wider text-[#77766F]">
                <th className="py-3.5 px-5">Timetable Version</th>
                <th className="py-3.5 px-4">Validation Status</th>
                <th className="py-3.5 px-4 text-center">Scheduled</th>
                <th className="py-3.5 px-4 text-center">Hard Conflicts</th>
                <th className="py-3.5 px-4 text-center">Warnings</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E2DA] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#77766F]">
                    Loading validation reports...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#77766F]">
                    No timetable validation reports match your criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map(rep => (
                  <tr key={rep.id} className="hover:bg-[#F7F6EF]/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-[#171717] text-sm">
                        {rep.versionName || 'Timetable Version'}
                      </div>
                      <div className="text-[11px] text-[#77766F] font-mono mt-0.5">
                        ID: {rep.timetable_version_id}
                      </div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(rep.validation_status)}</td>
                    <td className="py-4 px-4 text-center font-medium">
                      <span className="text-[#171717]">{rep.total_scheduled_sessions}</span>
                      <span className="text-[#77766F]"> / {rep.total_required_sessions}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`font-bold ${rep.total_hard_violations > 0 ? 'text-[#991B1B]' : 'text-[#166534]'}`}>
                        {rep.total_hard_violations}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-[#854D0E]">
                      {rep.total_warnings}
                    </td>
                    <td className="py-4 px-4 text-[#77766F]">
                      {new Date(rep.validation_timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#EDEAE0] hover:bg-[#E4E2DA] text-[#171717] font-semibold rounded-lg transition-colors cursor-pointer"
                        title="View Detailed Breakdown"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                      <button
                        onClick={() => handleRevalidate(rep.timetable_version_id)}
                        disabled={validatingId === rep.timetable_version_id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#171717] hover:bg-[#333333] text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Re-run Validation Check"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${validatingId === rep.timetable_version_id ? 'animate-spin' : ''}`} />
                        <span>Re-Verify</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E2DA] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 animate-scaleUp">
            <div className="flex items-start justify-between border-b border-[#E4E2DA] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(selectedReport.validation_status)}
                  <span className="text-xs font-mono text-[#77766F]">Report ID: {selectedReport.id}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#171717]">
                  Quality Report: {selectedReport.versionName || selectedReport.timetable_version_id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-2 rounded-xl text-[#77766F] hover:bg-[#EDEAE0] hover:text-[#171717] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#F7F6EF] p-4 rounded-2xl border border-[#E4E2DA]">
                <div className="text-xs text-[#77766F]">Required Sessions</div>
                <div className="text-xl font-bold text-[#171717] mt-1">{selectedReport.total_required_sessions}</div>
              </div>
              <div className="bg-[#F7F6EF] p-4 rounded-2xl border border-[#E4E2DA]">
                <div className="text-xs text-[#77766F]">Scheduled Sessions</div>
                <div className="text-xl font-bold text-[#171717] mt-1">{selectedReport.total_scheduled_sessions}</div>
              </div>
              <div className="bg-[#F7F6EF] p-4 rounded-2xl border border-[#E4E2DA]">
                <div className="text-xs text-[#77766F]">Hard Violations</div>
                <div className={`text-xl font-bold mt-1 ${selectedReport.total_hard_violations > 0 ? 'text-[#991B1B]' : 'text-[#166534]'}`}>
                  {selectedReport.total_hard_violations}
                </div>
              </div>
              <div className="bg-[#F7F6EF] p-4 rounded-2xl border border-[#E4E2DA]">
                <div className="text-xs text-[#77766F]">Unscheduled</div>
                <div className="text-xl font-bold text-[#6B21A8] mt-1">{selectedReport.total_unscheduled_sessions}</div>
              </div>
            </div>

            {/* Conflict Categories Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#171717]" />
                <span>Conflict Category Breakdown</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white border border-[#E4E2DA] p-3 rounded-xl text-center">
                  <div className="text-[11px] text-[#77766F]">Section Conflicts</div>
                  <div className="text-lg font-bold text-[#171717] mt-1">{selectedReport.section_conflict_count}</div>
                </div>
                <div className="bg-white border border-[#E4E2DA] p-3 rounded-xl text-center">
                  <div className="text-[11px] text-[#77766F]">Instructor Conflicts</div>
                  <div className="text-lg font-bold text-[#171717] mt-1">{selectedReport.instructor_conflict_count}</div>
                </div>
                <div className="bg-white border border-[#E4E2DA] p-3 rounded-xl text-center">
                  <div className="text-[11px] text-[#77766F]">Lab Engineer Conflicts</div>
                  <div className="text-lg font-bold text-[#171717] mt-1">{selectedReport.lab_engineer_conflict_count}</div>
                </div>
                <div className="bg-white border border-[#E4E2DA] p-3 rounded-xl text-center">
                  <div className="text-[11px] text-[#77766F]">Room Conflicts</div>
                  <div className="text-lg font-bold text-[#171717] mt-1">{selectedReport.room_conflict_count}</div>
                </div>
                <div className="bg-white border border-[#E4E2DA] p-3 rounded-xl text-center">
                  <div className="text-[11px] text-[#77766F]">Invalid Durations</div>
                  <div className="text-lg font-bold text-[#171717] mt-1">{selectedReport.invalid_duration_count}</div>
                </div>
              </div>
            </div>

            {/* Detailed Violation Log */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#171717]">Constraint Violations & Warnings Log</h3>
              {(!selectedReport.report_data?.violations || selectedReport.report_data.violations.length === 0) ? (
                <div className="p-6 bg-[#DCFCE7]/40 border border-[#DCFCE7] rounded-2xl text-center text-[#166534] text-xs font-semibold">
                  No constraint violations or warnings detected. This schedule is 100% conflict-free.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {selectedReport.report_data.violations.map((v, idx) => (
                    <div key={idx} className="p-3 bg-[#FEE2E2]/30 border border-[#FEE2E2] rounded-xl flex items-start gap-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#991B1B] text-white shrink-0 mt-0.5">
                        {v.severity}
                      </span>
                      <div className="flex-1 text-xs">
                        <div className="font-bold text-[#171717]">{v.type}</div>
                        <div className="text-[#525252] mt-0.5">{v.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E4E2DA]">
              <button
                onClick={() => exportReportCSV(selectedReport)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E2DA] hover:bg-[#EDEAE0] text-[#171717] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#166534]" />
                <span>Export Report CSV</span>
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2 bg-[#171717] hover:bg-[#333333] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
