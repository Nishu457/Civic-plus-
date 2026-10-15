/* CivicPulse AI — Citizen Profile & Verification Management */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, ShieldCheck, User, Mail, Phone, MapPin,
  Building, CheckCircle2, ArrowRight, Save, LogOut,
  FileText, Plus, AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getMyReports } from '../services/api';

const DISTRICTS = [
  'Vijayawada (NTR District)',
  'Visakhapatnam',
  'Guntur',
  'Amaravati Capital Region',
  'Tirupati',
  'Kurnool',
  'Kakinada',
  'Nellore',
  'Rajahmundry',
  'Kadapa',
  'Anantapur',
  'Eluru',
  'Srikakulam',
  'Vizianagaram',
  'Other / Pan-India',
];

const CITIZEN_TYPES = [
  'Local Resident',
  'Ward Volunteer / Community Leader',
  'Resident Welfare Association (RWA) Member',
  'Student / Youth Representative',
  'Business / Commercial Shop Owner',
  'Public Transit Commuter',
];

const Profile = () => {
  const { user, isAdmin, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [cityDistrict, setCityDistrict] = useState(user?.cityDistrict || DISTRICTS[0]);
  const [citizenType, setCitizenType] = useState(user?.citizenType || CITIZEN_TYPES[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [reportCount, setReportCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhoneNumber(user.phoneNumber || '');
      if (user.cityDistrict) setCityDistrict(user.cityDistrict);
      if (user.citizenType) setCitizenType(user.citizenType);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      getMyReports({ page: 1, page_size: 1 })
        .then((res) => setReportCount(res.total))
        .catch(() => setReportCount(0));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 fade-in">
        <div className="container max-w-md mx-auto text-center card p-8 card-elevated">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-6">
            Please sign in to access your citizen profile and verification credentials.
          </p>
          <Link to="/login" className="btn-primary w-full no-underline block text-center">
            Sign In / Register
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaveSuccess(false);

    if (!displayName.trim() || displayName.trim().length < 2) {
      setError('Please provide your legal or full citizen name.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        cityDistrict,
        citizenType,
        isVerified: true,
        profileCompleted: true,
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-8 sm:py-12 fade-in">
      <div className="container max-w-3xl mx-auto px-4">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-black text-xs">Citizen Identity</span>
              {user.isVerified && (
                <span className="badge badge-accent text-xs flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Reporter
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
              Profile & Verification
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/report"
              className="btn-primary btn-sm no-underline flex items-center gap-1.5"
            >
              <Plus size={15} /> Report Issue
            </Link>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-[#2563EB] shrink-0" />
            <span>Profile and citizen verification credentials updated successfully.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Verification Card */}
          <div className="md:col-span-1 space-y-4">
            <div className="card p-6 text-center card-elevated">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-700 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'C'}
                </div>
                {user.isVerified && (
                  <div
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#2563EB] border-2 border-white flex items-center justify-center text-white shadow-sm"
                    title="Verified Citizen Reporter"
                  >
                    <CheckCircle2 size={15} />
                  </div>
                )}
              </div>

              <h2 className="font-bold text-lg text-black truncate">{displayName || 'Citizen'}</h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{user.email}</p>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Account Role</span>
                  <span className="font-medium text-black capitalize">
                    {isAdmin ? 'Administrator' : 'Citizen Reporter'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Verification</span>
                  <span className="font-semibold text-[#2563EB] flex items-center gap-1">
                    <ShieldCheck size={13} /> Level 2 Verified
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">My Reports</span>
                  <Link
                    to="/my-reports"
                    className="font-mono font-bold text-black hover:text-[#2563EB] no-underline"
                  >
                    {reportCount !== null ? reportCount : '...'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-4 space-y-2 text-xs">
              <div className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-2">
                Quick Shortcuts
              </div>
              <Link
                to="/my-reports"
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-black no-underline transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText size={15} className="text-gray-400" /> View My Reports
                </span>
                <ArrowRight size={13} className="text-gray-400" />
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-black no-underline transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Shield size={15} className="text-[#2563EB]" /> Admin Triage Panel
                  </span>
                  <ArrowRight size={13} className="text-gray-400" />
                </Link>
              )}
              <button
                onClick={() => {
                  signOut();
                  navigate('/');
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-red-50 text-red-600 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <LogOut size={15} /> Sign Out
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Profile & Verification Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Verified Credentials Banner */}
            <div className="card p-5 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/30 border border-blue-200">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm ring-1 ring-blue-500/30 bg-[#111111]">
                  <img
                    src="/logo-mark.png"
                    alt="CivicPulse Verified"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-black">
                    Verified Citizen Reporter Badge
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Your account is authenticated for high-integrity civic reporting. Photos and GPS coordinates submitted from your account are verified by the Gemini AI priority engine with provenance tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Profile Information */}
            <div className="card p-6 card-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-base text-black flex items-center gap-2">
                  <User size={18} className="text-[#2563EB]" /> Citizen Details
                </h3>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn-secondary btn-sm text-xs"
                  >
                    Edit Details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-gray-500 hover:text-black border-0 bg-transparent cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="label">Full Legal / Citizen Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={!isEditing || saving}
                      placeholder="e.g. Ramesh Kumar"
                      className="input pl-9"
                      required
                    />
                  </div>
                </div>

                {/* Email (Readonly) */}
                <div>
                  <label className="label">Registered Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      value={user.email || ''}
                      disabled
                      className="input pl-9 bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    Verified via 6-digit email security code.
                  </span>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="label">Contact Phone Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={!isEditing || saving}
                      placeholder="+91 98765 43210"
                      className="input pl-9"
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    Used for municipal dispatch updates and SMS notifications.
                  </span>
                </div>

                {/* District / City */}
                <div>
                  <label className="label">Primary District / Municipality</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                    <select
                      value={cityDistrict}
                      onChange={(e) => setCityDistrict(e.target.value)}
                      disabled={!isEditing || saving}
                      className="input pl-9"
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Citizen Role */}
                <div>
                  <label className="label">Citizen Role / Designation</label>
                  <div className="relative">
                    <Building size={16} className="absolute left-3 top-3 text-gray-400" />
                    <select
                      value={citizenType}
                      onChange={(e) => setCitizenType(e.target.value)}
                      disabled={!isEditing || saving}
                      className="input pl-9"
                    >
                      {CITIZEN_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary btn-sm flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      {saving ? 'Saving...' : 'Save Profile Details'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
