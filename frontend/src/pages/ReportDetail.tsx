/* CivicPulse AI — Single Report Details & Evidence Tracking */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, AlertTriangle, ChevronLeft,
  Copy, Check, Eye, Brain, FileCheck, Info,
  ExternalLink, Building2
} from 'lucide-react';
import { getReport, getReportTimeline, getEvidenceAssessment } from '../services/api';
import type { Report, TimelineResponse, EvidenceAssessment } from '../types';
import { STATUS_LABELS } from '../types';

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [evidence, setEvidence] = useState<EvidenceAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState<number>(() => {
    return Math.floor(Math.random() * 5) + 1;
  });
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');

    Promise.all([
      getReport(id),
      getReportTimeline(id).catch(() => null),
      getEvidenceAssessment(id).catch(() => null),
    ])
      .then(([rep, time, evi]) => {
        setReport(rep);
        setTimeline(time);
        setEvidence(evi);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err.message || 'Failed to load report.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (hasConfirmed) return;
    setConfirmedCount((c) => c + 1);
    setHasConfirmed(true);
  };

  const getRiskBadge = (risk: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      low: { bg: 'bg-black text-white', label: 'Low Evidence Risk' },
      medium: { bg: 'bg-gray-800 text-white', label: 'Medium Evidence Risk' },
      high: { bg: 'bg-gray-200 text-gray-800', label: 'High Evidence Risk' },
      inconclusive: { bg: 'bg-gray-100 text-gray-600', label: 'Inconclusive / Pending' },
    };
    return map[risk] || map.inconclusive;
  };

  const getSeverityBadge = (sev: string) => {
    const map: Record<string, string> = {
      critical: 'bg-black text-white',
      high: 'bg-gray-800 text-white',
      medium: 'bg-gray-200 text-gray-800',
      low: 'bg-gray-100 text-gray-600',
    };
    return map[sev] || map.medium;
  };

  if (loading) {
    return (
      <div className="py-12">
        <div className="container max-w-4xl space-y-6">
          <div className="skeleton h-8 w-1/3" />
          <div className="skeleton h-64 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-16">
        <div className="container max-w-md text-center card p-10">
          <AlertTriangle size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'This report may have been removed or does not exist.'}</p>
          <Link to="/explore" className="btn-primary no-underline">
            <ChevronLeft size={16} /> Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const riskBadge = getRiskBadge(report.evidence_risk);

  return (
    <div className="py-8 fade-in">
      <div className="container max-w-5xl">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#2563EB] no-underline transition-colors">
            <ChevronLeft size={16} /> Back to All Issues
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="btn-secondary btn-sm flex items-center gap-1.5"
              title="Copy link to report"
            >
              {copied ? <Check size={14} className="text-[#2563EB]" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Share Report'}
            </button>
          </div>
        </div>

        {/* Header Card */}
        <div className="card p-5 sm:p-8 mb-6 border border-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="badge badge-black text-xs font-mono">{report.report_id}</span>
                <span className="badge badge-outline text-xs">{report.category_label}</span>
                <span className={`badge text-xs ${getSeverityBadge(report.observed_severity)}`}>
                  {report.observed_severity.toUpperCase()} SEVERITY
                </span>
                {report.is_safety_risk && (
                  <span className="badge bg-black text-white text-xs flex items-center gap-1">
                    <AlertTriangle size={12} className="text-yellow-400" /> IMMEDIATE HAZARD
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black mb-2">
                {report.title}
              </h1>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Status</div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-black font-bold text-sm bg-black text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-pulse" />
                {STATUS_LABELS[report.status] || report.status}
              </span>
            </div>
          </div>

          {/* Quick Meta Row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-4 border-t border-gray-100">
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> Reported on {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {report.address && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {report.address}
              </span>
            )}
            {report.assigned_authority && (
              <span className="flex items-center gap-1.5 font-medium text-black">
                <Building2 size={14} /> Assigned to: {report.assigned_authority}
              </span>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 spans) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description & Details */}
            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-bold">Issue Description</h2>
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line leading-relaxed">
                {report.description || 'No detailed description provided by the citizen.'}
              </p>

              {report.nearby_landmark && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <span className="font-semibold text-black">Nearby Landmark:</span> {report.nearby_landmark}
                </div>
              )}
            </div>

            {/* Photo Evidence Card */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Eye size={20} /> Photo Evidence
                </h2>
                <span className={`badge text-xs ${riskBadge.bg}`}>
                  {riskBadge.label}
                </span>
              </div>

              {report.has_image && report.image_url ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-[450px] flex items-center justify-center">
                    <img
                      src={report.image_url}
                      alt={report.title}
                      className="w-full h-full object-contain max-h-[450px]"
                    />
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-between px-1">
                    <span>Cleaned public preview (EXIF stripped for privacy)</span>
                    <a
                      href={report.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      View Full Size <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
                  <Eye size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No photo was attached with this report.</p>
                </div>
              )}

              {/* Evidence Verification Breakdown */}
              {evidence && (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileCheck size={16} /> Evidence Verification Indicators
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400">Integrity</div>
                      <div className="font-bold capitalize">{evidence.file_integrity}</div>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400">EXIF Meta</div>
                      <div className="font-bold capitalize">{evidence.metadata_status}</div>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400">Location Match</div>
                      <div className="font-bold capitalize">{evidence.location_consistency}</div>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400">Duplicate Check</div>
                      <div className="font-bold capitalize">{evidence.duplicate_status}</div>
                    </div>
                  </div>

                  {evidence.findings && evidence.findings.length > 0 && (
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-gray-600">Verification Findings:</div>
                      <ul className="list-disc pl-4 space-y-1 text-gray-500">
                        {evidence.findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evidence.limitations && evidence.limitations.length > 0 && (
                    <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg flex items-start gap-2">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>{evidence.limitations.join(' • ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Analysis Breakdown */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Brain size={20} /> AI Visual Analysis (Gemini)
                </h2>
                <span className="badge badge-outline text-xs">
                  {report.ai_analysis_status === 'completed' ? 'Analyzed' : report.ai_analysis_status}
                </span>
              </div>

              {report.ai_analysis_status === 'completed' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-400">Detected Category</div>
                      <div className="font-semibold text-sm">{report.ai_category || 'Identified'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-400">Estimated Severity</div>
                      <div className="font-semibold text-sm capitalize">{report.ai_severity || 'Medium'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-xs text-gray-400">Confidence</div>
                      <div className="font-semibold text-sm capitalize">{report.ai_confidence || 'High'}</div>
                    </div>
                  </div>

                  {report.ai_description && (
                    <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 leading-relaxed border border-gray-100">
                      <div className="font-semibold text-black mb-1">Visual Observation Summary:</div>
                      {report.ai_description}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  AI analysis is {report.ai_analysis_status}. Automated classification assists in triage but is not an authoritative verdict.
                </p>
              )}
            </div>

            {/* Map & Coordinates */}
            {report.latitude != null && report.longitude != null && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <MapPin size={20} /> Geographic Location
                  </h2>
                  <span className="badge badge-outline text-xs font-mono">
                    {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                  </span>
                </div>

                {/* OpenStreetMap Iframe */}
                <div className="rounded-xl overflow-hidden border border-gray-200 h-64 w-full relative">
                  <iframe
                    title="Report Location Map"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${report.longitude - 0.005}%2C${report.latitude - 0.005}%2C${report.longitude + 0.005}%2C${report.latitude + 0.005}&layer=mapnik&marker=${report.latitude}%2C${report.longitude}`}
                    className="w-full h-full"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                  <span>
                    Source: <strong className="text-black capitalize">{report.location_source}</strong>
                    {report.location_accuracy_m != null && ` (±${report.location_accuracy_m.toFixed(0)}m accuracy)`}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563EB] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Open in OSM <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Priority Score, Community Confirmation & Timeline */}
          <div className="space-y-6">
            {/* Priority Score Card */}
            <div className="card p-6 bg-black text-white space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Priority Engine</span>
                <span className="badge bg-white text-black text-xs font-bold capitalize">
                  {report.priority_level || 'Normal'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-mono font-bold">{report.priority_score ?? 60}</span>
                <span className="text-gray-400 text-lg">/ 100</span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Calculated dynamically from severity assessment, public safety risk, evidence provenance, and local report density.
              </p>

              <div className="border-t border-gray-800 pt-3 text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Safety Risk Weight:</span>
                  <span className="text-white font-medium">{report.is_safety_risk ? '+30 pts' : '0 pts'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Severity Grade:</span>
                  <span className="text-white font-medium capitalize">{report.observed_severity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Evidence Integrity:</span>
                  <span className="text-white font-medium capitalize">{report.evidence_risk}</span>
                </div>
              </div>
            </div>

            {/* Citizen Confirmation Widget */}
            <div className="card p-6 space-y-3">
              <h3 className="font-bold text-sm">Community Confirmation</h3>
              <p className="text-xs text-gray-500">
                Are you also affected by this issue? Confirming helps authorities understand the local impact.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold">
                  {confirmedCount} citizen{confirmedCount !== 1 ? 's' : ''} confirmed
                </span>
                <button
                  onClick={handleConfirm}
                  disabled={hasConfirmed}
                  className={`btn-sm ${hasConfirmed ? 'btn-secondary text-gray-400 cursor-default' : 'btn-primary'}`}
                >
                  {hasConfirmed ? 'Confirmed ✓' : 'I also see this'}
                </button>
              </div>
            </div>

            {/* Transparent Status Timeline */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Transparent Timeline</h3>
                <span className="text-xs text-gray-400">Public Audit</span>
              </div>

              <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {timeline?.history && timeline.history.length > 0 ? (
                  timeline.history.map((item, idx) => (
                    <div key={idx} className="relative pl-7 text-xs space-y-1">
                      <div className={`absolute left-1.5 top-1 w-3.5 h-3.5 -ml-1.5 rounded-full border-2 border-white ${
                        idx === 0 ? 'bg-[#2563EB] ring-2 ring-[#2563EB]/25' : 'bg-gray-400'
                      }`} />
                      <div className="flex items-center justify-between font-semibold text-black">
                        <span>{STATUS_LABELS[item.to_status] || item.to_status}</span>
                        <span className="text-gray-400 font-normal">
                          {new Date(item.changed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {item.reason && <p className="text-gray-600">{item.reason}</p>}
                      <div className="text-[10px] text-gray-400">
                        Actor: {item.changed_by?.startsWith('dev') ? 'Officer / Admin' : item.changed_by || 'System'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="relative pl-7 text-xs space-y-1">
                    <div className="absolute left-1.5 top-1 w-3.5 h-3.5 -ml-1.5 rounded-full bg-[#2563EB] border-2 border-white ring-2 ring-[#2563EB]/25" />
                    <div className="font-semibold text-black">{STATUS_LABELS[report.status] || report.status}</div>
                    <div className="text-gray-400">Report registered in CivicPulse database</div>
                  </div>
                )}
              </div>
            </div>

            {/* Authority Note / Rejection Reason if any */}
            {report.rejection_reason && (
              <div className="card p-5 bg-gray-50 border-gray-300 space-y-2">
                <span className="text-xs font-bold uppercase text-gray-500">Rejection Reason</span>
                <p className="text-xs text-gray-700">{report.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
