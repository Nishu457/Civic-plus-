/* CivicPulse AI — Citizen My Reports */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Plus, Clock, MapPin, AlertTriangle,
  ChevronRight, Lock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getMyReports } from '../services/api';
import type { ReportListResponse } from '../types';
import { STATUS_LABELS } from '../types';

const MyReports = () => {
  const { user, loginAsDev } = useAuth();
  const [data, setData] = useState<ReportListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getMyReports({ page: 1, page_size: 20 })
      .then(setData)
      .catch((err) => {
        setError(err?.response?.data?.detail || err.message || 'Failed to load your reports.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 fade-in">
        <div className="container max-w-md mx-auto text-center card p-10 card-elevated">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">My Reports</h1>
          <p className="text-sm text-gray-500 mb-6">
            Sign in with your email to track the status and updates of all civic issues you have reported.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => loginAsDev('citizen')}
              className="btn-primary w-full"
            >
              Sign In as Demo Citizen
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
      <div className="container max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">My Reported Issues</h1>
            <p className="text-sm text-gray-500">
              Logged in as {user.email || user.phoneNumber || user.displayName || user.uid}
            </p>
          </div>

          <Link to="/report" className="btn-primary btn-sm no-underline inline-flex items-center gap-1.5">
            <Plus size={16} /> New Report
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-gray-500">
            <AlertTriangle size={32} className="mx-auto mb-2 text-gray-400" />
            <p>{error}</p>
          </div>
        ) : data && data.reports.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="font-semibold text-lg mb-2">No Reports Yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              You haven't submitted any civic issue reports under this account yet. Help improve your community by reporting an issue today.
            </p>
            <Link to="/report" className="btn-primary no-underline">
              Submit Your First Report
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.reports.map((report) => (
              <Link
                key={report.report_id}
                to={`/report/${report.report_id}`}
                className="card p-5 hover:border-[#2563EB] transition-all no-underline block group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-black text-xs font-mono">{report.report_id}</span>
                      <span className="badge badge-outline text-xs">{report.category_label}</span>
                      <span className="badge badge-outline text-xs uppercase">
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-black group-hover:text-[#2563EB] pt-1 transition-colors">
                      {report.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-2">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                      {report.address && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {report.address}
                        </span>
                      )}
                      {report.priority_score != null && (
                        <span className="font-mono font-semibold text-black">
                          Score: {report.priority_score}/100
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center text-gray-400 group-hover:text-[#2563EB] transition-colors shrink-0 pt-2">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyReports;
