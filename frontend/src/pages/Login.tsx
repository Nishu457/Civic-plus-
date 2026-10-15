/* CivicPulse AI — Supabase Email OTP Authentication (Signup & Login) */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, RefreshCw, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { sendEmailOtp, verifyEmailOtp, isSupabaseConfigured } from '../services/supabase';

const Login = () => {
  const { user, signOut, loginAsDev } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

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
        'Supabase is not configured on this deployment. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel or your local .env file. You can also use the Demo accounts below.'
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
        // Successful real authentication — redirect to destination or /my-reports
        const from = (location.state as any)?.from?.pathname || '/my-reports';
        navigate(from, { replace: true });
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
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8 card-elevated border border-gray-200">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-black mb-1.5">
              {isLoggedIn ? 'Account Active' : step === 'email' ? 'Sign In or Sign Up' : 'Enter Verification Code'}
            </h1>
            <p className="text-sm text-gray-500">
              {isLoggedIn
                ? 'You are currently signed in.'
                : step === 'email'
                ? 'Enter your email to receive a secure 6-digit code. Works for both new citizens and returning users.'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Active Session Display */}
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-semibold">Active Session</p>
                <p className="text-base font-bold text-black">{user?.displayName || 'Citizen'}</p>
                <p className="text-sm text-gray-600 font-mono mt-0.5">{user?.email || user?.phoneNumber || user?.uid}</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/my-reports')}
                className="btn-primary w-full"
              >
                Go to My Reports <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setStep('email');
                  setEmail('');
                  setOtp('');
                }}
                className="btn-secondary w-full"
              >
                Sign Out / Use Another Account
              </button>
            </div>
          ) : (
            <>
              {/* Configuration Warning if Supabase is missing */}
              {!isSupabaseConfigured && (
                <div className="mb-5 p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-black">
                    <AlertCircle size={15} className="text-[#2563EB]" />
                    <span>Supabase Configuration Notice</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Set <code className="bg-gray-100 px-1 py-0.5 rounded text-black font-mono">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-black font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in
                    your Vercel Project Settings to activate live email delivery.
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
                    Password-free authentication. We will email you a one-time 6-digit code.
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

              {/* Quick Demo Access (for evaluation without email delays) */}
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
                  1-click login for development and judge evaluation
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
