/* CivicPulse AI — Admin Triage & Governance Dashboard */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Search, ChevronLeft, ChevronRight, X,
  ArrowUpDown, FileSpreadsheet, Lock, Camera, Eye, ExternalLink
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getDashboard,
  adminListReports,
  updateReportStatus,
  triggerSync,
  getAuditLog,
  resolveImageUrl,
} from '../services/api';
import type { DashboardStats, ReportListItem, ReportListResponse } from '../types';
import { CATEGORIES, STATUS_LABELS } from '../types';

const AdminDashboard = () => {
  const { isAdmin, loginAsDev } = useAuth();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<ReportListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal State for Status Update
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [assignedAuthority, setAssignedAuthority] = useState('');
  const [updateReason, setUpdateReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Lightbox Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; id: string } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'triage' | 'audit'>('triage');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    getDashboard()
      .then(setStats)
      .catch((err) => console.error('Failed to load dashboard stats:', err));

    adminListReports({
      page,
      page_size: 15,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      evidence_risk: riskFilter || undefined,
      search: search || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    })
      .then(setReports)
      .catch((err) => console.error('Failed to load reports:', err))
      .finally(() => setLoading(false));
  }, [page, statusFilter, categoryFilter, riskFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  const handleSyncSheets = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await triggerSync();
      setSyncMessage(res.message || 'Synced successfully with Google Sheets.');
      getDashboard().then(setStats);
    } catch (err: any) {
      setSyncMessage(err?.response?.data?.detail || err.message || 'Sheets sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenModal = (report: ReportListItem) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setAssignedAuthority('');
    setUpdateReason('');
    setUpdateError('');
  };

  const handleSaveStatus = async () => {
    if (!selectedReport) return;
    setUpdating(true);
    setUpdateError('');

    try {
      await updateReportStatus(selectedReport.report_id, {
        status: newStatus,
        reason: updateReason || undefined,
        assigned_authority: assignedAuthority || undefined,
      });

      setSelectedReport(null);
      loadDashboard();
    } catch (err: any) {
      setUpdateError(err?.response?.data?.detail || err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const loadAuditLog = () => {
    setActiveTab('audit');
    getAuditLog({ page: 1 })
      .then((data) => setAuditLogs(data.entries || []))
      .catch((err) => console.error('Failed to load audit logs:', err));
  };

  // If user is not admin, show login prompt
  if (!isAdmin) {
    return (
      <div className="py-20">
        <div className="container max-w-md mx-auto text-center card p-10 card-elevated">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Administrator Access</h1>
          <p className="text-sm text-gray-500 mb-6">
            You must be signed in with administrative credentials to access the CivicPulse governance and triage dashboard.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                loginAsDev('admin');
              }}
              className="btn-primary w-full"
            >
              Sign In as Demo Admin
            </button>
            <Link to="/login" className="btn-secondary w-full no-underline block">
              Sign In with Email OTP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 fade-in">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-black text-xs">Admin Control</span>
              <span className="text-xs text-gray-400">CivicPulse Governance v0.1</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Issue Triage & Operations</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncSheets}
              disabled={syncing}
              className="btn-secondary btn-sm flex items-center gap-1.5"
              title="Sync pending reports to Google Sheets"
            >
              <FileSpreadsheet size={16} />
              {syncing ? 'Syncing...' : 'Sync to Sheets'}
            </button>
            <button
              onClick={loadDashboard}
              className="btn-secondary btn-sm flex items-center gap-1.5"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs flex items-center justify-between">
            <span>{syncMessage}</span>
            <button onClick={() => setSyncMessage('')} className="text-gray-400 hover:text-black">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Dashboard Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <div className="card p-5">
              <div className="text-xs text-gray-500 font-medium uppercase mb-1">Total Reports</div>
              <div className="text-3xl font-bold font-mono">{stats.total_reports}</div>
              <div className="text-xs text-gray-400 mt-1">Recorded civic issues</div>
            </div>

            <div className="card p-5">
              <div className="text-xs text-gray-500 font-medium uppercase mb-1">Awaiting Review</div>
              <div className="text-3xl font-bold font-mono text-black">
                {stats.reports_awaiting_review}
              </div>
              <div className="text-xs text-gray-400 mt-1">Pending officer triage</div>
            </div>

            <div className="card p-5">
              <div className="text-xs text-gray-500 font-medium uppercase mb-1">Avg Priority Score</div>
              <div className="text-3xl font-bold font-mono">
                {stats.average_priority_score ?? '—'}
                <span className="text-sm font-normal text-gray-400">/100</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Evidence-weighted impact</div>
            </div>

            <div className="card p-5">
              <div className="text-xs text-gray-500 font-medium uppercase mb-1">Sheets Sync</div>
              <div className="text-sm font-bold mt-2 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${stats.sheets_sync_status.includes('pending') ? 'bg-gray-400' : 'bg-[#2563EB]'}`} />
                <span className="capitalize">{stats.sheets_sync_status.replace('_', ' ')}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Open public dataset</div>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('triage')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer bg-transparent border-0 ${
              activeTab === 'triage'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Report Triage Table
          </button>
          <button
            onClick={loadAuditLog}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer bg-transparent border-0 ${
              activeTab === 'audit'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Admin Audit Trail
          </button>
        </div>

        {activeTab === 'triage' ? (
          <>
            {/* Filter Bar */}
            <div className="card p-4 mb-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="sm:col-span-2 lg:col-span-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search Title or Report ID..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      className="input pl-9"
                    />
                  </div>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="input"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="input"
                >
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                <select
                  value={riskFilter}
                  onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
                  className="input"
                >
                  <option value="">All Evidence Risks</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="inconclusive">Inconclusive</option>
                </select>
              </div>
            </div>

            {/* Mobile View: Cards (< 768px) */}
            <div className="block md:hidden space-y-3 mb-6">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="card p-4 space-y-3">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-8 w-full" />
                  </div>
                ))
              ) : reports && reports.reports.length === 0 ? (
                <div className="card p-8 text-center text-gray-500">
                  No reports match the selected filters.
                </div>
              ) : (
                reports?.reports.map((report) => (
                  <div key={report.report_id} className="card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="badge badge-black text-xs font-mono">{report.report_id}</span>
                      <span className="badge badge-outline text-xs uppercase">
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </div>

                    <div className="flex gap-3 items-start">
                      {report.has_image && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: resolveImageUrl(report.image_url, report.report_id),
                              title: report.title,
                              id: report.report_id,
                            })
                          }
                          className="shrink-0 p-0 border-0 bg-transparent cursor-pointer rounded-lg overflow-hidden group relative"
                          title="Click to view photo evidence"
                        >
                          <img
                            src={resolveImageUrl(report.image_url, report.report_id)}
                            alt={report.title}
                            className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-gray-50 shadow-xs"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = resolveImageUrl(null, report.report_id);
                              if (target.src !== fallback && fallback) {
                                target.src = fallback;
                              } else {
                                target.style.display = 'none';
                              }
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-lg">
                            <Eye size={16} />
                          </div>
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link to={`/report/${report.report_id}`} className="font-bold text-base text-black hover:text-[#2563EB] no-underline block truncate">
                          {report.title}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">{report.category_label}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <div className="space-x-1">
                        <span className="text-gray-400">Score:</span>
                        <span className="font-mono font-bold">{report.priority_score ?? '—'}</span>
                      </div>
                      <div className="space-x-1">
                        <span className="text-gray-400">Risk:</span>
                        <span className="capitalize font-medium">{report.evidence_risk}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => handleOpenModal(report)}
                        className="btn-secondary btn-sm text-xs py-1.5"
                      >
                        Update Status
                      </button>
                      <Link
                        to={`/report/${report.report_id}`}
                        className="btn-primary btn-sm text-xs py-1.5 text-center no-underline"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block card overflow-hidden p-0 border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Report ID</th>
                      <th className="py-3 px-4 font-semibold">Photo</th>
                      <th className="py-3 px-4 font-semibold">Title & Category</th>
                      <th className="py-3 px-4 font-semibold">Severity</th>
                      <th className="py-3 px-4 font-semibold">Evidence Risk</th>
                      <th className="py-3 px-4 font-semibold">
                        <button
                          onClick={() => {
                            setSortBy('priority_score');
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          }}
                          className={`flex items-center gap-1 hover:text-[#2563EB] font-semibold border-0 bg-transparent cursor-pointer p-0 ${sortBy === 'priority_score' ? 'text-[#2563EB]' : ''}`}
                        >
                          Priority <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={8} className="py-4 px-4">
                            <div className="skeleton h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : reports && reports.reports.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
                          No reports match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      reports?.reports.map((report) => (
                        <tr key={report.report_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold">
                            <Link to={`/report/${report.report_id}`} className="hover:underline text-black">
                              {report.report_id}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4">
                            {report.has_image ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: resolveImageUrl(report.image_url, report.report_id),
                                    title: report.title,
                                    id: report.report_id,
                                  })
                                }
                                className="relative group p-0 border-0 bg-transparent cursor-pointer block rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                title="Click to view full photo evidence"
                              >
                                <img
                                  src={resolveImageUrl(report.image_url, report.report_id)}
                                  alt={report.title}
                                  className="w-11 h-11 rounded-lg object-cover border border-gray-200 bg-gray-50 group-hover:opacity-90 group-hover:scale-105 transition-all shadow-xs"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    const fallback = resolveImageUrl(null, report.report_id);
                                    if (target.src !== fallback && fallback) {
                                      target.src = fallback;
                                    } else {
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }
                                  }}
                                />
                                <div className="hidden w-11 h-11 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] text-center p-1 font-medium">
                                  No img
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-lg">
                                  <Eye size={14} />
                                </div>
                              </button>
                            ) : (
                              <div className="w-11 h-11 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 flex flex-col items-center justify-center text-gray-300">
                                <Camera size={14} />
                                <span className="text-[9px] mt-0.5 text-gray-400">None</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-semibold truncate">{report.title}</div>
                            <div className="text-xs text-gray-500">{report.category_label}</div>
                          </td>
                          <td className="py-3.5 px-4 capitalize text-xs">
                            <span className="badge badge-outline text-[11px]">
                              {report.observed_severity}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`badge text-[11px] ${
                              report.evidence_risk === 'low'
                                ? 'bg-black text-white'
                                : report.evidence_risk === 'medium'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-200 text-gray-800'
                            }`}>
                              {report.evidence_risk}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            {report.priority_score ?? '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="badge badge-outline text-[11px] uppercase">
                              {STATUS_LABELS[report.status] || report.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenModal(report)}
                              className="btn-secondary btn-sm text-xs py-1 px-2.5"
                            >
                              Update Status
                            </button>
                            <Link
                              to={`/report/${report.report_id}`}
                              className="btn-primary btn-sm text-xs py-1 px-2.5 no-underline inline-block"
                            >
                              Inspect
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {reports && reports.total > reports.page_size && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 text-xs">
                  <span className="text-gray-500">
                    Showing {(page - 1) * reports.page_size + 1} to{' '}
                    {Math.min(page * reports.page_size, reports.total)} of {reports.total} reports
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="btn-secondary btn-sm text-xs py-1 px-2"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span className="font-semibold">{page}</span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil(reports.total / reports.page_size)}
                      className="btn-secondary btn-sm text-xs py-1 px-2"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Audit Logs Tab */
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-lg mb-2">Administrative Audit Trail</h3>
            <p className="text-xs text-gray-500 mb-4">
              All status changes and sync operations are recorded for transparency.
            </p>

            <div className="divide-y divide-gray-100 text-xs">
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-gray-400">No audit logs recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-black flex items-center gap-2">
                        <span className="badge badge-black text-[10px] uppercase">{log.action}</span>
                        {log.target_report_id && (
                          <Link to={`/report/${log.target_report_id}`} className="hover:underline font-mono text-[#2563EB]">
                            {log.target_report_id}
                          </Link>
                        )}
                      </div>
                      {log.details && (
                        <div className="text-gray-500 mt-1">
                          {log.details.reason && <span>Reason: {log.details.reason} • </span>}
                          {log.details.to && <span>Status: {log.details.from} → {log.details.to}</span>}
                          {log.details.assigned_authority && <span> • Authority: {log.details.assigned_authority}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Status Update Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="card card-elevated max-w-lg w-full p-5 sm:p-6 space-y-4 fade-in bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-lg">Update Report Status</h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1 text-gray-400 hover:text-black border-0 bg-transparent cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <div>Report ID: <strong className="font-mono text-black">{selectedReport.report_id}</strong></div>
                <div>Title: <strong className="text-black">{selectedReport.title}</strong></div>
              </div>

              {selectedReport.has_image && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Eye size={14} className="text-[#2563EB]" /> Attached Photo Evidence
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: resolveImageUrl(selectedReport.image_url, selectedReport.report_id),
                          title: selectedReport.title,
                          id: selectedReport.report_id,
                        })
                      }
                      className="text-[#2563EB] text-xs font-medium hover:underline inline-flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0"
                    >
                      Enlarge <ExternalLink size={12} />
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-white max-h-48 flex items-center justify-center">
                    <img
                      src={resolveImageUrl(selectedReport.image_url, selectedReport.report_id)}
                      alt={selectedReport.title}
                      className="max-h-48 w-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = resolveImageUrl(null, selectedReport.report_id);
                        if (target.src !== fallback && fallback) {
                          target.src = fallback;
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Target Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input"
                >
                  <option value="under_review">Under Review</option>
                  <option value="forwarded">Forwarded to Authority</option>
                  <option value="acknowledged">Acknowledged by Dept</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="label">Assign Public Authority (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Vijayawada Municipal Corporation, AP Discom..."
                  value={assignedAuthority}
                  onChange={(e) => setAssignedAuthority(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Notes / Reason for Citizen</label>
                <textarea
                  placeholder="Explain the update reason or inspection details..."
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  className="input min-h-[80px]"
                />
              </div>

              {updateError && (
                <p className="text-xs text-gray-700 bg-gray-100 p-2.5 rounded-lg">
                  {updateError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStatus}
                  disabled={updating}
                  className="btn-primary btn-sm"
                >
                  {updating ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox Photo Preview Modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 fade-in"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                <div className="min-w-0 pr-4">
                  <span className="badge badge-black text-xs font-mono mb-1">{previewImage.id}</span>
                  <h3 className="font-bold text-sm sm:text-base text-black truncate">{previewImage.title}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={previewImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm text-xs flex items-center gap-1 no-underline"
                  >
                    Open Tab <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="p-1.5 text-gray-400 hover:text-black rounded-lg border-0 bg-transparent cursor-pointer"
                    aria-label="Close preview"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-gray-950 flex items-center justify-center min-h-[300px] max-h-[75vh]">
                <img
                  src={previewImage.url}
                  alt={previewImage.title}
                  className="max-h-[70vh] max-w-full object-contain rounded-md"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = resolveImageUrl(null, previewImage.id);
                    if (target.src !== fallback && fallback) {
                      target.src = fallback;
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
