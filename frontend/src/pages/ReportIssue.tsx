/* CivicPulse AI — Multi-Step Report Issue Workflow with AI Image Verification */

import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Camera, MapPin, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, Upload, AlertTriangle, X, MapPinned,
  Navigation, Info, Sparkles, ShieldCheck, ShieldAlert,
  ShieldX, RefreshCw, AlertCircle
} from 'lucide-react';
import {
  CATEGORIES,
  SEVERITY_LEVELS,
  type ReportFormData,
  type ImageVerificationResult,
} from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { createReport, verifyReportImage } from '../services/api';

const STEPS = ['Category', 'Evidence', 'Location', 'Details', 'Review'];

const ReportIssue = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCategory = searchParams.get('category') || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // AI Image Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ImageVerificationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { location, loading: geoLoading, error: geoError, requestLocation } = useGeolocation();

  const [formData, setFormData] = useState<ReportFormData>({
    category: presetCategory && CATEGORIES[presetCategory] ? presetCategory : '',
    title: '',
    description: '',
    observed_severity: 'medium',
    observed_at: '',
    is_safety_risk: false,
    nearby_landmark: '',
    latitude: undefined,
    longitude: undefined,
    location_accuracy_m: undefined,
    location_source: 'unknown',
    address: '',
    location_consent: false,
    submission_consent: false,
    image: undefined,
    verification_token: undefined,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const updateField = useCallback((field: keyof ReportFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const processSelectedFile = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setSubmitError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Image must be under 10MB.');
      return;
    }

    updateField('image', file);
    updateField('verification_token', undefined);
    setVerificationResult(null);
    setSubmitError('');

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const removeImage = () => {
    updateField('image', undefined);
    updateField('verification_token', undefined);
    setImagePreview(null);
    setVerificationResult(null);
    setSubmitError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Perform AI Image Verification
  const handleVerifyImage = async () => {
    if (!formData.image) return;

    setVerifying(true);
    setSubmitError('');

    try {
      const result = await verifyReportImage(formData.image);
      setVerificationResult(result);

      if (result.can_submit && result.verification_status === 'accepted') {
        updateField('verification_token', result.verification_token);
        // Automatically suggest / adopt detected category if user hasn't explicitly set one or chose "other"
        if (!formData.category || formData.category === 'other') {
          updateField('category', result.canonical_category);
        }
      } else {
        updateField('verification_token', undefined);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || 'Image verification is temporarily unavailable. Please try again.';
      setVerificationResult({
        is_municipal_issue: false,
        issue_category: 'unknown',
        canonical_category: 'other',
        category_label: 'Service Unavailable',
        confidence: 0,
        image_quality: 'unknown',
        severity: 'unknown',
        evidence: '',
        reason: detail,
        user_message: 'Image verification is temporarily unavailable. Please try again.',
        verification_status: 'error',
        can_submit: false,
        image_sha256: '',
        verification_token: '',
        verified_at: new Date().toISOString(),
      });
    } finally {
      setVerifying(false);
    }
  };

  // Sync geolocation to form
  const applyLocation = () => {
    if (!location) return;
    updateField('latitude', location.latitude);
    updateField('longitude', location.longitude);
    updateField('location_accuracy_m', location.accuracy);
    updateField('location_source', location.source);
    updateField('location_consent', true);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.category;
      case 1:
        // Evidence stage: Requires image AND successful AI verification
        return !!formData.image && verificationResult?.can_submit === true;
      case 2:
        return true; // Location optional (GPS or manual)
      case 3:
        return formData.title.length >= 5;
      case 4:
        return formData.submission_consent && verificationResult?.can_submit === true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.submission_consent) {
      setSubmitError('You must consent to report submission.');
      return;
    }
    if (!verificationResult || !verificationResult.can_submit) {
      setSubmitError('You can only submit a report after your evidence image has passed AI verification.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const report = await createReport(formData);
      setSubmitSuccess(report.report_id);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || 'Submission failed.';
      setSubmitError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ──────────────────────────────────
  if (submitSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-12">
        <div className="card card-elevated max-w-md w-full mx-4 text-center p-10">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Report Submitted</h2>
          <p className="text-gray-500 mb-6">
            Your verified civic grievance has been recorded and prioritised.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-400 mb-1">Reference ID</div>
            <div className="text-xl font-mono font-bold">{submitSuccess}</div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            This report is stored in CivicPulse AI with verified visual evidence.
            Use the reference ID to track its resolution status.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => navigate(`/report/${submitSuccess}`)} className="btn-primary w-full">
              View Report Details
            </button>
            <button onClick={() => navigate('/explore')} className="btn-secondary w-full">
              Explore All Issues
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="container max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Report a Municipal Issue</h1>
          <p className="text-sm text-gray-500">
            Submit verified photographic evidence to help municipal authorities prioritise genuine problems.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center gap-1.5 sm:gap-2 flex-1">
              <button
                onClick={() => i < currentStep && setCurrentStep(i)}
                disabled={i > currentStep}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all cursor-pointer ${
                  i === currentStep
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                    : i < currentStep
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
                aria-label={`Step ${i + 1}: ${STEPS[i]}`}
              >
                {i < currentStep ? '✓' : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`stepper-line ${i < currentStep ? 'bg-[#2563EB]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-6">
          <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
          </span>
        </div>

        {/* ── Step 0: Category ───────────────────────── */}
        {currentStep === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 slide-up">
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const isSelected = formData.category === key;
              return (
                <button
                  key={key}
                  onClick={() => updateField('category', key)}
                  className={`card text-left p-4 sm:p-5 cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-sm text-[#111111]">{cat.label}</h4>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-[#2563EB] bg-[#2563EB] text-white text-[9px]'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{cat.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step 1: Evidence & AI Verification ──────── */}
        {currentStep === 1 && (
          <div className="slide-up space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">
                Upload or capture a photograph of the municipal problem.
              </p>
              <p className="text-xs text-blue-600 font-medium flex items-center justify-center gap-1">
                <Sparkles size={13} />
                Images are analyzed by Google Gemini AI to verify authentic civic issues before submission.
              </p>
            </div>

            {!imagePreview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
                  isDragging
                    ? 'border-[#2563EB] bg-blue-50/60 scale-[1.01]'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 text-[#2563EB]">
                  <Upload size={28} />
                </div>
                <p className="font-semibold text-base mb-1">
                  Drag and drop your evidence photo here
                </p>
                <p className="text-xs text-gray-400 mb-5">
                  JPEG, PNG, or WebP • Max 10MB • Clear and well-lit
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                  <label className="btn-primary cursor-pointer flex-1 justify-center">
                    <Camera size={16} />
                    Take Photo
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  <label className="btn-secondary cursor-pointer flex-1 justify-center">
                    <Upload size={16} />
                    Browse Files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image Preview Container */}
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black/5">
                  {/* Animated Scanline while AI is verifying */}
                  {verifying && <div className="ai-scanline" />}

                  <img
                    src={imagePreview}
                    alt="Evidence preview"
                    className={`w-full max-h-96 object-contain rounded-xl transition-opacity duration-300 ${
                      verifying ? 'opacity-80 brightness-95' : 'opacity-100'
                    }`}
                  />

                  {/* Remove Button */}
                  {!verifying && (
                    <button
                      onClick={removeImage}
                      title="Remove image"
                      className="absolute top-3 right-3 w-8 h-8 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md"
                    >
                      <X size={16} />
                    </button>
                  )}

                  {/* Scanning Overlay Card */}
                  {verifying && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 z-20">
                      <div className="bg-white/95 text-gray-900 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center space-y-3 animate-pulse">
                        <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-full flex items-center justify-center mx-auto">
                          <Loader2 size={24} className="animate-spin" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-900">
                            AI is analysing your image. Please wait...
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Checking visual problem evidence, category, and clarity.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File info bar */}
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{formData.image?.name}</span>
                    <span>({((formData.image?.size || 0) / 1024).toFixed(0)} KB)</span>
                  </span>
                  <button
                    onClick={removeImage}
                    className="text-gray-500 hover:text-black underline cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>

                {/* Unverified Action State */}
                {!verificationResult && !verifying && (
                  <div className="card p-5 bg-blue-50/50 border border-blue-200 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">
                          Step 2 Required: AI Visual Verification
                        </h4>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Click below to have Gemini AI examine the photo for identifiable municipal issues before proceeding.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleVerifyImage}
                      disabled={verifying}
                      className="btn-primary w-full py-3 text-sm justify-center gap-2"
                    >
                      <Sparkles size={16} className="text-amber-300" />
                      Verify Image with AI
                    </button>
                  </div>
                )}

                {/* Verification Results Cards */}
                {verificationResult && (
                  <div className="slide-up">
                    {/* ── Status: Accepted ──────────────────────── */}
                    {verificationResult.verification_status === 'accepted' && (
                      <div className="card p-5 border-2 border-emerald-500 bg-emerald-50/70 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <ShieldCheck size={22} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                                Verified Issue
                              </span>
                              <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold">
                                {Math.round(verificationResult.confidence * 100)}% Confidence
                              </span>
                              {verificationResult.severity && verificationResult.severity !== 'unknown' && (
                                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 capitalize">
                                  Severity: {verificationResult.severity}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-emerald-950 mt-1.5">
                              {verificationResult.user_message}
                            </h4>
                          </div>
                        </div>

                        {/* Visual Evidence Summary */}
                        {verificationResult.evidence && (
                          <div className="bg-white/80 rounded-lg p-3 text-xs text-gray-700 border border-emerald-200">
                            <span className="font-semibold text-gray-900 block mb-0.5">
                              Visual Evidence Detected:
                            </span>
                            {verificationResult.evidence}
                          </div>
                        )}

                        {/* Category recommendation */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-emerald-200/80 text-xs">
                          <span className="text-emerald-900">
                            Identified Category:{' '}
                            <strong className="font-semibold">
                              {verificationResult.category_label}
                            </strong>
                          </span>
                          {formData.category !== verificationResult.canonical_category && (
                            <button
                              onClick={() => updateField('category', verificationResult.canonical_category)}
                              className="text-[#2563EB] hover:underline font-semibold text-left sm:text-right"
                            >
                              Sync to Detected Category →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Status: Unclear ───────────────────────── */}
                    {verificationResult.verification_status === 'unclear' && (
                      <div className="card p-5 border-2 border-amber-500 bg-amber-50/70 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <ShieldAlert size={22} />
                          </div>
                          <div className="flex-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white mb-1.5">
                              Unclear Evidence
                            </span>
                            <h4 className="font-bold text-sm text-amber-950">
                              {verificationResult.user_message}
                            </h4>
                          </div>
                        </div>

                        {verificationResult.reason && (
                          <div className="bg-white/80 rounded-lg p-3 text-xs text-gray-700 border border-amber-200">
                            <span className="font-semibold text-gray-900 block mb-0.5">
                              Observations:
                            </span>
                            {verificationResult.reason}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            onClick={removeImage}
                            className="btn-primary btn-sm flex-1 justify-center"
                          >
                            Upload Clearer Photo
                          </button>
                          <button
                            onClick={handleVerifyImage}
                            className="btn-secondary btn-sm flex-1 justify-center"
                          >
                            <RefreshCw size={13} />
                            Retry Verification
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Status: Rejected / Irrelevant ─────────── */}
                    {verificationResult.verification_status === 'rejected_irrelevant' && (
                      <div className="card p-5 border-2 border-red-500 bg-red-50/70 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <ShieldX size={22} />
                          </div>
                          <div className="flex-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white mb-1.5">
                              Rejected Image
                            </span>
                            <h4 className="font-bold text-sm text-red-950">
                              {verificationResult.user_message}
                            </h4>
                          </div>
                        </div>

                        {verificationResult.reason && (
                          <div className="bg-white/80 rounded-lg p-3 text-xs text-gray-700 border border-red-200">
                            <span className="font-semibold text-gray-900 block mb-0.5">
                              Detection Reason:
                            </span>
                            {verificationResult.reason}
                          </div>
                        )}

                        <p className="text-xs text-gray-500">
                          CivicPulse AI rejects selfies, portraits, food, pets, documents, and unrelated photographs to protect municipal dispatch queues.
                        </p>

                        <button
                          onClick={removeImage}
                          className="btn-primary btn-sm w-full justify-center"
                        >
                          Upload a Municipal Issue Photo
                        </button>
                      </div>
                    )}

                    {/* ── Status: Service Error / Timeout ───────── */}
                    {(verificationResult.verification_status === 'error' ||
                      verificationResult.verification_status === 'corrupted') && (
                      <div className="card p-5 border-2 border-red-400 bg-red-50 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle size={22} />
                          </div>
                          <div className="flex-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white mb-1.5">
                              Verification Interrupted
                            </span>
                            <h4 className="font-bold text-sm text-red-950">
                              {verificationResult.user_message}
                            </h4>
                          </div>
                        </div>

                        {verificationResult.reason && (
                          <div className="bg-white/80 rounded-lg p-3 text-xs text-gray-700 border border-red-200">
                            <span className="font-semibold text-gray-900 block mb-0.5">
                              Details:
                            </span>
                            {verificationResult.reason}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            onClick={handleVerifyImage}
                            className="btn-primary btn-sm flex-1 justify-center gap-1.5"
                          >
                            <RefreshCw size={13} />
                            Retry Verification
                          </button>
                          <button
                            onClick={removeImage}
                            className="btn-secondary btn-sm flex-1 justify-center"
                          >
                            Upload Another Photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <p className="text-sm text-gray-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                {submitError}
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Location ──────────────────────── */}
        {currentStep === 2 && (
          <div className="slide-up space-y-6">
            {!formData.latitude ? (
              <div className="card p-8 text-center">
                <MapPinned size={40} className="mx-auto mb-4 text-gray-400" />
                <h3 className="font-semibold mb-2">Capture Location</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Your device GPS will provide coordinates. You can also select a location manually on the map.
                </p>

                <button
                  onClick={() => { requestLocation(); }}
                  disabled={geoLoading}
                  className="btn-primary"
                >
                  {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  {geoLoading ? 'Detecting...' : 'Use My Location'}
                </button>

                {geoError && (
                  <p className="mt-4 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md">{geoError}</p>
                )}

                {location && (
                  <div className="mt-4 text-left bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2">Detected Location</div>
                    <div className="text-sm font-mono">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Accuracy: ±{location.accuracy.toFixed(0)}m | Source: {location.source}
                    </div>
                    <button onClick={applyLocation} className="btn-primary btn-sm mt-3">
                      <CheckCircle2 size={14} /> Use This Location
                    </button>
                  </div>
                )}

                <div className="mt-6 flex items-start gap-2 text-xs text-gray-400 text-left">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Browser-reported GPS is recorded transparently. CivicPulse records the source and accuracy for municipal verification.
                  </span>
                </div>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin size={18} /> Location Captured
                  </h3>
                  <button
                    onClick={() => {
                      updateField('latitude', undefined);
                      updateField('longitude', undefined);
                      updateField('location_source', 'unknown');
                      updateField('location_consent', false);
                    }}
                    className="btn-secondary btn-sm"
                  >
                    Change
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm mb-3">
                  <div>{formData.latitude?.toFixed(6)}, {formData.longitude?.toFixed(6)}</div>
                  {formData.location_accuracy_m != null && (
                    <div className="text-xs text-gray-400 mt-1">
                      Accuracy: ±{formData.location_accuracy_m.toFixed(0)}m
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Source: {formData.location_source}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="label">Address / Landmark (optional)</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="e.g., Near Benz Circle, Vijayawada"
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Details ──────────────────────────── */}
        {currentStep === 3 && (
          <div className="slide-up space-y-5">
            <div>
              <label className="label">Issue Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g., Large pothole on main road near bus stop"
                className={`input ${formData.title.length > 0 && formData.title.length < 5 ? 'input-error' : ''}`}
                maxLength={200}
              />
              {formData.title.length > 0 && formData.title.length < 5 && (
                <p className="form-error">Title must be at least 5 characters.</p>
              )}
            </div>

            <div>
              <label className="label">Description (optional)</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Provide additional context about the issue..."
                className="input min-h-[100px] resize-y"
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Observed Severity</label>
                <select
                  value={formData.observed_severity}
                  onChange={(e) => updateField('observed_severity', e.target.value)}
                  className="input"
                >
                  {SEVERITY_LEVELS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">When Observed</label>
                <input
                  type="datetime-local"
                  value={formData.observed_at || ''}
                  onChange={(e) => updateField('observed_at', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Nearby Landmark (optional)</label>
              <input
                type="text"
                value={formData.nearby_landmark || ''}
                onChange={(e) => updateField('nearby_landmark', e.target.value)}
                placeholder="e.g., Opposite City Hospital"
                className="input"
                maxLength={200}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.is_safety_risk}
                onChange={(e) => updateField('is_safety_risk', e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-black"
              />
              <div>
                <span className="font-semibold text-sm flex items-center gap-1">
                  <AlertTriangle size={14} /> Immediate Public Safety Risk
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">
                  Check this if the issue poses an immediate danger (e.g., open manhole, exposed electrical cables).
                </span>
              </div>
            </label>
          </div>
        )}

        {/* ── Step 4: Review & Submit ──────────────────── */}
        {currentStep === 4 && (
          <div className="slide-up space-y-4">
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-lg">Review Your Report</h3>

              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Category</span>
                  <p className="font-semibold">{CATEGORIES[formData.category]?.label || formData.category}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Severity</span>
                  <p className="font-semibold capitalize">{formData.observed_severity}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-400 text-xs">Title</span>
                  <p className="font-semibold">{formData.title}</p>
                </div>
                {formData.description && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-400 text-xs">Description</span>
                    <p className="text-gray-600">{formData.description}</p>
                  </div>
                )}
              </div>

              {/* Verified Image Section */}
              {imagePreview && (
                <div>
                  <span className="text-gray-400 text-xs">Verified Evidence Photo</span>
                  <div className="relative mt-2">
                    <img
                      src={imagePreview}
                      alt="Verified Evidence"
                      className="w-full max-h-48 object-contain rounded-lg border border-gray-200"
                    />
                    {verificationResult?.verification_status === 'accepted' && (
                      <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 shadow">
                        <ShieldCheck size={13} />
                        AI Verified ({Math.round(verificationResult.confidence * 100)}%)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              {formData.latitude != null && (
                <div>
                  <span className="text-gray-400 text-xs">Location</span>
                  <p className="font-mono text-sm">
                    {formData.latitude.toFixed(6)}, {formData.longitude?.toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Source: {formData.location_source}
                    {formData.location_accuracy_m != null && ` | Accuracy: ±${formData.location_accuracy_m.toFixed(0)}m`}
                  </p>
                  {formData.address && <p className="text-sm text-gray-600 mt-1">{formData.address}</p>}
                </div>
              )}

              {formData.is_safety_risk && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-900">
                  <AlertTriangle size={16} className="text-red-600" />
                  <span className="text-sm font-semibold">Marked as immediate public safety hazard</span>
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="card p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.location_consent}
                  onChange={(e) => updateField('location_consent', e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-black"
                />
                <span className="text-sm">
                  I consent to CivicPulse processing the location coordinates provided for this municipal complaint.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.submission_consent}
                  onChange={(e) => updateField('submission_consent', e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-black"
                />
                <span className="text-sm">
                  I confirm this complaint is truthful and consent to submit it to the municipal priority queue.
                </span>
              </label>
            </div>

            {submitError && (
              <p className="text-sm text-gray-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !formData.submission_consent || !verificationResult?.can_submit}
              className="btn-primary w-full btn-lg justify-center"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {submitting ? 'Submitting Report...' : 'Submit Report'}
            </button>
          </div>
        )}

        {/* ── Navigation Buttons ─────────────────────── */}
        {!submitSuccess && (
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="btn-secondary"
            >
              <ArrowLeft size={16} /> Back
            </button>
            {currentStep < STEPS.length - 1 && (
              <button
                onClick={() => {
                  if (currentStep === 2 && location && !formData.latitude) {
                    applyLocation();
                  }
                  setCurrentStep((s) => s + 1);
                }}
                disabled={!canProceed()}
                className="btn-primary"
              >
                Next <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportIssue;
