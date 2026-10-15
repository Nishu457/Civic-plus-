/* CivicPulse AI — Multi-Step Report Issue Workflow */

import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Camera, MapPin, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, Upload, AlertTriangle, X, MapPinned,
  Navigation, Info
} from 'lucide-react';
import { CATEGORIES, SEVERITY_LEVELS, type ReportFormData } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { createReport } from '../services/api';

const STEPS = ['Category', 'Evidence', 'Location', 'Details', 'Review'];

const ReportIssue = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCategory = searchParams.get('category') || '';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const updateField = useCallback((field: keyof ReportFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    setSubmitError('');
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    updateField('image', undefined);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      case 0: return !!formData.category;
      case 1: return true; // Image optional but recommended
      case 2: return true; // Location optional
      case 3: return formData.title.length >= 5;
      case 4: return formData.submission_consent;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.submission_consent) {
      setSubmitError('You must consent to report submission.');
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
            Your report has been recorded and is being processed.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-400 mb-1">Reference ID</div>
            <div className="text-xl font-mono font-bold">{submitSuccess}</div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            This report is stored in CivicPulse AI. Use the reference ID to track its status.
            Reports are not automatically forwarded to government authorities.
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
          <h1 className="text-2xl font-bold mb-2">Report a Civic Issue</h1>
          <p className="text-sm text-gray-500">
            Provide evidence to help your community prioritise this problem.
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

        {/* ── Step 1: Evidence (Image) ───────────────── */}
        {currentStep === 1 && (
          <div className="slide-up space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                Upload a photo of the issue. Fresh camera captures provide stronger evidence provenance.
              </p>
            </div>

            {!imagePreview ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-black transition-colors">
                <Camera size={40} className="mx-auto mb-4 text-gray-400" />
                <p className="font-semibold mb-2">Upload Evidence Photo</p>
                <p className="text-sm text-gray-400 mb-4">JPEG, PNG, or WebP — Max 10MB</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <label className="btn-primary cursor-pointer">
                    <Camera size={16} />
                    Take Photo
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  <label className="btn-secondary cursor-pointer">
                    <Upload size={16} />
                    Choose File
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Evidence preview"
                  className="w-full max-h-96 object-contain rounded-xl border border-gray-200"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-3 right-3 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors border-0 cursor-pointer"
                >
                  <X size={16} />
                </button>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle2 size={16} />
                  {formData.image?.name} ({((formData.image?.size || 0) / 1024).toFixed(0)} KB)
                </div>
              </div>
            )}

            {submitError && (
              <p className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md flex items-center gap-2">
                <AlertTriangle size={16} /> {submitError}
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
                    Browser-reported GPS is self-reported by your device. CivicPulse records
                    the source and accuracy but cannot independently verify device coordinates.
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
                    placeholder="e.g., Near MG Road, Vijayawada"
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
                  Check this if the issue poses an immediate danger (e.g., exposed wires, deep open pit).
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

              {/* Image */}
              {imagePreview && (
                <div>
                  <span className="text-gray-400 text-xs">Evidence Photo</span>
                  <img src={imagePreview} alt="Evidence" className="mt-2 w-full max-h-48 object-contain rounded-lg border border-gray-200" />
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
                <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-semibold">Marked as immediate safety risk</span>
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
                  I consent to CivicPulse processing the location data I provided for this report.
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
                  I confirm this report is truthful to the best of my knowledge and consent to submission.
                </span>
              </label>
            </div>

            {submitError && (
              <p className="text-sm text-gray-700 bg-gray-100 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} /> {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !formData.submission_consent}
              className="btn-primary w-full btn-lg"
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
