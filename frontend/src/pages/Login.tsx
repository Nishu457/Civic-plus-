/* CivicPulse AI — Login Page (Phone OTP) */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, RefreshCw, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { setupRecaptcha, sendOTP, getFirebaseAuth, resetRecaptcha } from '../services/firebase';
import type { ConfirmationResult } from 'firebase/auth';

const Login = () => {
  const { user, loginAsDev } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // If already logged in, show account switcher or allow continuing
  const isLoggedIn = !!user;

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const isLocalIp = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1';

  const handleSendOTP = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase authentication is not configured. Please set up Firebase credentials in .env');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const verifier = setupRecaptcha('recaptcha-container');
      if (!verifier) {
        setError('reCAPTCHA setup failed. Please refresh and try again.');
        setLoading(false);
        return;
      }

      const fullNumber = `${countryCode}${phoneNumber}`;
      const result = await sendOTP(fullNumber, verifier);
      setConfirmResult(result);
      setStep('otp');
      setCooldown(60);
    } catch (err: any) {
      console.error('OTP send error:', err);
      resetRecaptcha('recaptcha-container');
      const errMsg = err?.message || '';

      if (errMsg.toLowerCase().includes('billing') || err.code === 'auth/billing-not-enabled') {
        setError(
          'Firebase billing is not enabled on this project. Real SMS requires the Blaze pay-as-you-go plan. To test phone login for FREE without billing: add a test phone number (e.g. +91 9999999999 with code 123456) in Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing", or use the 1-click Demo Citizen button below.'
        );
      } else if (errMsg.toLowerCase().includes('region') || (err.code === 'auth/operation-not-allowed' && errMsg.includes('region'))) {
        setError(
          'SMS Region blocked by Firebase: In Firebase Console → Authentication → Settings tab → SMS region policy, allow India (+91). For instant zero-SMS testing, add a Test Number (e.g. +91 9999999999 with code 123456) in Sign-in method → Phone.'
        );
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Phone Authentication is not enabled in Firebase Console. Please go to Firebase Console → Authentication → Sign-in method → Phone → Enable.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Domain '${window.location.hostname}' is not authorized. Please open http://localhost:5173/login or add '${window.location.hostname}' in Firebase Console → Authentication → Settings → Authorized domains.`);
      } else if (err.code === 'auth/too-many-requests') {
        setError('SMS quota exceeded or too many attempts. Please wait a few minutes, or use test numbers / Demo Citizen.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Please enter a valid 10-digit number.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('reCAPTCHA verification failed. Please try again or refresh.');
      } else {
        setError(err.message || 'Failed to send OTP. Please check your network and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!confirmResult) return;
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await confirmResult.confirm(otp);
      navigate('/my-reports');
    } catch (err: any) {
      console.error('OTP verify error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Incorrect OTP. Please check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP expired. Please request a new one.');
      } else {
        setError(err.message || 'Verification failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (cooldown > 0) return;
    setStep('phone');
    setOtp('');
    setError('');
    setConfirmResult(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-md px-4">
        <div className="card p-8 card-elevated">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Sign In</h1>
            <p className="text-sm text-gray-500">
              {isLoggedIn
                ? 'You are currently signed in.'
                : step === 'phone'
                ? 'Enter your phone number to receive a verification code.'
                : 'Enter the 6-digit code sent to your phone.'}
            </p>
          </div>

          {/* If already signed in banner */}
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Active Session</p>
                <p className="text-base font-bold text-gray-900">{user?.displayName || 'Citizen'}</p>
                <p className="text-sm text-gray-600 font-mono mt-0.5">{user?.phoneNumber || 'Demo Account'}</p>
              </div>

              <button
                onClick={() => navigate('/my-reports')}
                className="btn-primary w-full"
              >
                Go to My Reports <ArrowRight size={18} />
              </button>

              <button
                onClick={async () => {
                  const { signOut } = await import('../services/firebase');
                  await signOut();
                  window.location.reload();
                }}
                className="btn-secondary w-full"
              >
                Sign Out / Use Another Number
              </button>
            </div>
          ) : (
            <>
              {/* Domain tip if running on 127.0.0.1 */}
              {isLocalIp && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 flex items-center justify-between">
                  <span>Firebase works best on <code>localhost</code></span>
                  <a
                    href="http://localhost:5173/login"
                    className="font-semibold underline ml-2 hover:text-black"
                  >
                    Open localhost
                  </a>
                </div>
              )}

              {/* Phone Step */}
              {step === 'phone' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Phone Number</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="input text-center !w-24 shrink-0 font-medium cursor-pointer"
                        style={{ width: '90px', minWidth: '90px' }}
                      >
                        <option value="+91">+91</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                        <option value="+61">+61</option>
                        <option value="+971">+971</option>
                      </select>
                      <input
                        id="phone-input"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="input flex-1"
                        maxLength={10}
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <p id="auth-error-msg" className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md">{error}</p>
                  )}

                  <button
                    id="send-otp-btn"
                    onClick={handleSendOTP}
                    disabled={loading || phoneNumber.length < 10}
                    className="btn-primary w-full"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
                    {loading ? 'Sending SMS OTP...' : 'Send OTP'}
                  </button>
                </div>
              )}

          {/* OTP Step */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="label">Verification Code</label>
                <input
                  id="otp-input"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">
                  Sent to {countryCode} {phoneNumber}
                </p>
              </div>

              {error && (
                <p id="otp-error-msg" className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md">{error}</p>
              )}

              <button
                id="verify-otp-btn"
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                onClick={handleResendOTP}
                disabled={cooldown > 0}
                className="btn-secondary w-full"
              >
                <RefreshCw size={16} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          )}

          {/* Quick Demo Access (for evaluation and offline testing) */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Quick Demo Access
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  loginAsDev('citizen');
                  navigate('/my-reports');
                }}
                className="btn-secondary btn-sm text-xs py-2"
              >
                Demo Citizen
              </button>
              <button
                type="button"
                onClick={() => {
                  loginAsDev('admin');
                  navigate('/admin');
                }}
                className="btn-secondary btn-sm text-xs py-2"
              >
                Demo Admin
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Instantly test authenticated flows without SMS OTP
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center mt-6">
            By signing in, you agree to our terms. Real phone OTP is handled securely via Firebase Authentication.
          </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
