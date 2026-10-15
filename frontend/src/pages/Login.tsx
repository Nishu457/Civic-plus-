/* CivicPulse AI — Supabase Email OTP Authentication & Citizen Verification */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Mail, ArrowRight, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, User, Phone, MapPin, Building, ShieldCheck, Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { sendEmailOtp, verifyEmailOtp, isSupabaseConfigured } from '../services/supabase';

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

const Login = () => {
  const { user, signOut, loginAsDev, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Profile details collected upon signup
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cityDistrict, setCityDistrict] = useState(DISTRICTS[0]);
  const [citizenType, setCitizenType] = useState(CITIZEN_TYPES[0]);
  const [consentResidency, setConsentResidency] = useState(true);
  const [consentAlerts, setConsentAlerts] = useState(true);

  // If already logged in
  const isLoggedIn = !!user;

  // Cooldown countdown timer for Resend OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not configured on this deployment. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. You can also use the Demo accounts below.'
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setLoading(true);

    try {
      await sendEmailOtp(cleanEmail);
      setStep('otp');
      setCooldown(60);
      setSuccessMsg(`We sent a 6-digit verification code to ${cleanEmail}`);
    } catch (err: any) {
      console.error('Supabase OTP send error:', err);
      const msg = err?.message || '';

      if (msg.toLowerCase().includes('rate') || err.status === 429) {
        setError('Too many requests. Please wait a minute before requesting another code.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Network error. Unable to reach authentication server. Please check your connection.');
      } else {
        setError(msg || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);

    try {
      const data = await verifyEmailOtp(email, cleanOtp);

      if (data.session) {
        const sbUser = data.session.user;
        const isProfileDone = sbUser?.user_metadata?.profile_completed;

        if (!isProfileDone) {
          // Transition directly to Profile & Verification collection
          setStep('profile');
          setFullName(sbUser?.user_metadata?.full_name || email.split('@')[0]);
          setPhoneNumber(sbUser?.user_metadata?.phone_number || '');
          setSuccessMsg('Email verified! Please complete your citizen profile & verification to continue.');
        } else {
          // Returning verified citizen
          const from = (location.state as any)?.from?.pathname || '/my-reports';
          navigate(from, { replace: true });
        }
      } else {
        setError('Verification failed. Please request a new code.');
      }
    } catch (err: any) {
      console.error('Supabase OTP verify error:', err);
      const msg = err?.message || '';

      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setError('Invalid or expired verification code. Please check your email or request a new code.');
      } else if (msg.toLowerCase().includes('rate') || err.status === 429) {
        setError('Too many incorrect attempts. Please request a new code.');
      } else {
        setError(msg || 'Code verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Please provide your legal or citizen full name.');
      return;
    }

    if (!consentResidency) {
      setError('Please accept the residency and authentic reporting declaration to complete verification.');
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        displayName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        cityDistrict,
        citizenType,
        isVerified: true,
        profileCompleted: true,
      });

      setSuccessMsg('Citizen Profile Verified! Directing you to CivicPulse...');

      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/my-reports';
        navigate(from, { replace: true });
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0 || loading) return;
    await handleSendOTP();
  };

  const handleChangeEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 fade-in">
      <div className="w-full max-w-lg">
        <div className="card p-6 sm:p-8 card-elevated border border-gray-200">
          {/* Stepper Indicator */}
          {!isLoggedIn && (
            <div className="flex items-center justify-between mb-8 px-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-black">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 'email' ? 'bg-[#2563EB] text-white' : 'bg-black text-white'
                }`}>
                  {step !== 'email' ? <Check size={12} /> : '1'}
                </span>
                <span>Email</span>
              </div>
              <div className={`h-[2px] flex-1 mx-2 ${step !== 'email' ? 'bg-[#2563EB]' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-1.5 font-medium text-black">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 'otp' ? 'bg-[#2563EB] text-white' : step === 'profile' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {step === 'profile' ? <Check size={12} /> : '2'}
                </span>
                <span>Verify Code</span>
              </div>
              <div className={`h-[2px] flex-1 mx-2 ${step === 'profile' ? 'bg-[#2563EB]' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-1.5 font-medium text-black">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 'profile' ? 'bg-[#2563EB] text-white ring-2 ring-blue-200' : 'bg-gray-100 text-gray-500'
                }`}>
                  3
                </span>
                <span>Profile & Verification</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-md ring-2 ring-blue-500/30 bg-[#111111]">
              <img
                src="/logo-mark.png"
                alt="CivicPulse AI Emblem"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-black mb-1.5">
              {isLoggedIn
                ? 'Account Active'
                : step === 'email'
                ? 'Citizen Sign In or Register'
                : step === 'otp'
                ? 'Enter Verification Code'
                : 'Citizen Profile & Verification'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {isLoggedIn
                ? 'You are currently signed in.'
                : step === 'email'
                ? 'Enter your email to receive a secure 6-digit code. Works for both new citizens and returning accounts.'
                : step === 'otp'
                ? `Enter the 6-digit security code sent to ${email}`
                : 'Complete your profile details to establish authentic provenance for your public issue reports.'}
            </p>
          </div>

          {/* Active Session Display */}
          {isLoggedIn && step !== 'profile' ? (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-semibold">Active Session</p>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <p className="text-base font-bold text-black">{user?.displayName || 'Citizen'}</p>
                  {user?.isVerified && (
                    <span className="badge badge-accent text-[10px] flex items-center gap-0.5">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 font-mono">{user?.email || user?.phoneNumber || user?.uid}</p>
                {user?.cityDistrict && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                    <MapPin size={11} /> {user.cityDistrict}
                  </p>
                )}
              </div>

              {!user.profileCompleted && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span>Your Citizen Verification details are incomplete.</span>
                  <button
                    onClick={() => {
                      setFullName(user.displayName || '');
                      setPhoneNumber(user.phoneNumber || '');
                      setStep('profile');
                    }}
                    className="btn-primary btn-sm text-xs py-1"
                  >
                    Complete Now
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/my-reports')}
                  className="btn-primary w-full"
                >
                  My Reports <ArrowRight size={16} />
                </button>
                <Link
                  to="/profile"
                  className="btn-secondary w-full text-center no-underline block"
                >
                  View Profile
                </Link>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setStep('email');
                  setEmail('');
                  setOtp('');
                }}
                className="btn-secondary w-full text-xs text-gray-500 hover:text-black"
              >
                Sign Out / Use Another Account
              </button>
            </div>
          ) : (
            <>
              {/* Configuration Warning if Supabase is missing */}
              {!isSupabaseConfigured && step === 'email' && (
                <div className="mb-5 p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-black">
                    <AlertCircle size={15} className="text-[#2563EB]" />
                    <span>Supabase Configuration Notice</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Set <code className="bg-gray-100 px-1 py-0.5 rounded text-black font-mono">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-black font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in
                    your environment to activate live email delivery. You can also evaluate using the Demo accounts below.
                  </p>
                </div>
              )}

              {/* Step 1: Email Form */}
              {step === 'email' && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label htmlFor="email-input" className="label text-black">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input pl-10"
                        autoComplete="email"
                        autoFocus
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    id="send-otp-btn"
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="btn-primary w-full"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                    {loading ? 'Sending Code...' : 'Send Verification Code'}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
                    Password-free authentication. We will email you a secure one-time 6-digit code.
                  </p>
                </form>
              )}

              {/* Step 2: OTP Verification Form */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {successMsg && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-start gap-2">
                      <CheckCircle2 size={15} className="shrink-0 text-[#2563EB] mt-0.5" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="otp-input" className="label text-black !mb-0">
                        6-Digit Security Code
                      </label>
                      <button
                        type="button"
                        onClick={handleChangeEmail}
                        className="text-xs text-gray-500 hover:text-[#2563EB] border-0 bg-transparent cursor-pointer font-medium"
                      >
                        Change email
                      </button>
                    </div>

                    <input
                      id="otp-input"
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="input text-center text-2xl tracking-[0.4em] font-mono font-bold"
                      maxLength={6}
                      autoFocus
                      disabled={loading}
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    id="verify-otp-btn"
                    type="submit"
                    disabled={loading || otp.trim().length !== 6}
                    className="btn-primary w-full"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {loading ? 'Verifying Code...' : 'Verify & Continue'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={cooldown > 0 || loading}
                    className="btn-secondary w-full"
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </button>
                </form>
              )}

              {/* Step 3: Citizen Profile & Verification Onboarding Form */}
              {step === 'profile' && (
                <form onSubmit={handleSaveProfile} className="space-y-4 fade-in">
                  {successMsg && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                      <CheckCircle2 size={15} className="shrink-0 text-[#2563EB] mt-0.5" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* Verified Badge Preview Banner */}
                  <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50/50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-black flex items-center gap-1.5">
                        Verified Citizen Reporter <CheckCircle2 size={13} className="text-[#2563EB]" />
                      </div>
                      <div className="text-gray-500 mt-0.5">
                        Authenticates your account to report hazards with priority AI triage.
                      </div>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="label text-black">
                      Full Citizen Name <span className="text-[#2563EB]">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="input pl-9"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="label text-black">
                      Phone Number (for SMS & Resolution Alerts)
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="input pl-9"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* District / City */}
                  <div>
                    <label className="label text-black">Primary District / Municipality</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                      <select
                        value={cityDistrict}
                        onChange={(e) => setCityDistrict(e.target.value)}
                        className="input pl-9"
                        disabled={loading}
                      >
                        {DISTRICTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Citizen Role */}
                  <div>
                    <label className="label text-black">Citizen Role</label>
                    <div className="relative">
                      <Building size={16} className="absolute left-3 top-3 text-gray-400" />
                      <select
                        value={citizenType}
                        onChange={(e) => setCitizenType(e.target.value)}
                        className="input pl-9"
                        disabled={loading}
                      >
                        {CITIZEN_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Declarations & Verification Checks */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentResidency}
                        onChange={(e) => setConsentResidency(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span>
                        I confirm my residency and declare that all reported civic hazards represent genuine, on-site observations.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentAlerts}
                        onChange={(e) => setConsentAlerts(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span>
                        Enable instant notifications when municipal authorities update or resolve my reports.
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !fullName.trim() || !consentResidency}
                    className="btn-primary w-full"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    {loading ? 'Activating Verification...' : 'Complete Verification & Continue'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const from = (location.state as any)?.from?.pathname || '/my-reports';
                      navigate(from, { replace: true });
                    }}
                    className="text-xs text-gray-400 hover:text-black block text-center mx-auto border-0 bg-transparent cursor-pointer pt-1"
                  >
                    Skip and finish profile later
                  </button>
                </form>
              )}

              {/* Quick Demo Access (for evaluation without email delays) */}
              {step !== 'profile' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-center mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Instant Demo Access
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loginAsDev('citizen');
                        navigate('/my-reports');
                      }}
                      className="btn-secondary btn-sm text-xs py-2 text-center"
                    >
                      Demo Citizen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loginAsDev('admin');
                        navigate('/admin');
                      }}
                      className="btn-secondary btn-sm text-xs py-2 text-center"
                    >
                      Demo Admin
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    1-click login for development and evaluation
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
