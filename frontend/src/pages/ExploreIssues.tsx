/* CivicPulse AI — Explore Issues Page */

import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MapPin, Search, ChevronLeft, ChevronRight,
  Eye, AlertTriangle, Clock, X
} from 'lucide-react';
import { listReports } from '../services/api';
import type { ReportListResponse } from '../types';
import { CATEGORIES, STATUS_LABELS } from '../types';

const ExploreIssues = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ReportListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';

  useEffect(() => {
    setLoading(true);
    listReports({
      page,
      page_size: 12,
      category: category || undefined,
      status: status || undefined,
    })
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load reports.'))
      .finally(() => setLoading(false));
  }, [page, category, status]);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  // Filter by search query in memory
  const displayedReports = useMemo(() => {
    if (!data?.reports) return [];
    if (!searchQuery.trim()) return data.reports;
    const q = searchQuery.toLowerCase().trim();
    return data.reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.report_id.toLowerCase().includes(q) ||
        (r.address && r.address.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const severityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: 'badge-black',
      high: 'badge-dark',
      medium: 'badge-outline',
      low: 'badge-outline text-gray-500',
    };
    return styles[severity] || styles.medium;
  };

  return (
    <div className="py-8 sm:py-10">
      <div className="container px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
              Community Reports
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mt-0.5">
              Explore Civic Issues
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {data ? `${data.total} recorded public problem${data.total !== 1 ? 's' : ''}` : 'Loading...'}
            </p>
          </div>
          <Link to="/report" className="btn-primary btn-sm no-underline self-start sm:self-auto">
            Report New Issue
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="card p-3 sm:p-4 mb-6 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues by title, ID or location..."
                className="input pl-9 text-xs sm:text-sm py-2"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black border-0 bg-transparent cursor-pointer p-0.5"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <select
              value={category}
              onChange={(e) => setFilter('category', e.target.value)}
              className="input w-full sm:w-48 text-xs py-2 cursor-pointer font-medium"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="input w-full sm:w-44 text-xs py-2 cursor-pointer font-medium"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {(category || status || searchQuery) && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs">
              <span className="text-gray-400">Active filters:</span>
              {category && (
                <button
                  onClick={() => setFilter('category', '')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 cursor-pointer"
                >
                  {CATEGORIES[category]?.label || category} <X size={12} />
                </button>
              )}
              {status && (
                <button
                  onClick={() => setFilter('status', '')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 cursor-pointer"
                >
                  {STATUS_LABELS[status] || status} <X size={12} />
                </button>
              )}
              {searchQuery && (
                <span className="text-gray-500">
                  Filtering for "{searchQuery}"
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchParams(new URLSearchParams());
                }}
                className="text-[#2563EB] hover:underline ml-auto font-medium border-0 bg-transparent cursor-pointer"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-12 text-center">
            <AlertTriangle size={36} className="mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold text-base mb-1">Unable to Load Reports</h3>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        ) : displayedReports.length === 0 ? (
          <div className="card p-12 text-center bg-gray-50/50">
            <Search size={36} className="mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold text-base mb-1">No Reports Found</h3>
            <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
              {searchQuery || category || status
                ? 'No issues match your current filters. Try relaxing your search criteria.'
                : 'No civic issues reported yet. Be the first to report!'}
            </p>
            <Link to="/report" className="btn-primary btn-sm no-underline">Report an Issue</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedReports.map((report) => (
                <Link
                  key={report.report_id}
                  to={`/report/${report.report_id}`}
                  className="card p-5 hover:border-[#2563EB] transition-all no-underline group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className="font-mono text-xs font-semibold text-[#111111]">
                        {report.report_id}
                      </span>
                      <span className={`badge ${severityBadge(report.observed_severity)}`}>
                        {report.observed_severity}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-[#111111] group-hover:text-[#2563EB] transition-colors mb-1 line-clamp-2">
                      {report.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">{report.category_label}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                      {report.latitude != null && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-[#2563EB]" /> GPS Verified
                        </span>
                      )}
                      {report.has_image && (
                        <span className="flex items-center gap-1">
                          <Eye size={11} /> Photo
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock size={11} />
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="badge badge-outline text-[10px]">
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                      {report.priority_score != null && (
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase">Priority</span>
                          <span className="text-xs font-mono font-bold text-[#111111]">
                            {report.priority_score}/100
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {data && data.total > data.page_size && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setFilter('page', String(page - 1))}
                  disabled={page <= 1}
                  className="btn-secondary btn-sm"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} /> Prev
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  Page {data.page} of {Math.ceil(data.total / data.page_size)}
                </span>
                <button
                  onClick={() => setFilter('page', String(page + 1))}
                  disabled={page >= Math.ceil(data.total / data.page_size)}
                  className="btn-secondary btn-sm"
                  aria-label="Next page"
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExploreIssues;
