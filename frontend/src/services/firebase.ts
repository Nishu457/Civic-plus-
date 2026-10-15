/* CivicPulse AI — Firebase Configuration */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _recaptchaVerifier: RecaptchaVerifier | null = null;

// Initialize synchronously on load only if env vars are present; otherwise initialized via initFirebase()
if (DEFAULT_FIREBASE_CONFIG.apiKey && DEFAULT_FIREBASE_CONFIG.projectId) {
  try {
    app = initializeApp(DEFAULT_FIREBASE_CONFIG);
    _auth = getAuth(app);
  } catch (e) {
    console.warn('Initial Firebase app boot:', e);
  }
}

export const initFirebase = (config: {
  firebase_api_key: string;
  firebase_auth_domain: string;
  firebase_project_id: string;
  firebase_messaging_sender_id: string;
  firebase_app_id: string;
}) => {
  if (app && _auth && config.firebase_project_id === DEFAULT_FIREBASE_CONFIG.projectId) {
    return;
  }

  try {
    app = initializeApp({
      apiKey: config.firebase_api_key,
      authDomain: config.firebase_auth_domain,
      projectId: config.firebase_project_id,
      messagingSenderId: config.firebase_messaging_sender_id,
      appId: config.firebase_app_id,
    });
    _auth = getAuth(app);
  } catch (e) {
    console.error('Firebase initialization error:', e);
  }
};

export const auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) {
      if (prop === 'currentUser') return null;
      return undefined;
    }
    return (_auth as any)[prop];
  },
});

export const getFirebaseAuth = (): Auth | null => _auth;

export const getDevUser = () => {
  const token = localStorage.getItem('civicpulse_dev_token');
  if (!token) return null;
  const isAdmin = token.includes('admin');
  return {
    uid: isAdmin ? 'dev-admin-uid' : 'dev-user-uid',
    phoneNumber: '+91 98765 43210',
    displayName: isAdmin ? 'Demo Admin' : 'Demo Citizen',
    isAdmin,
  };
};

export const setDevLogin = (role: 'citizen' | 'admin') => {
  localStorage.setItem('civicpulse_dev_token', role === 'admin' ? 'dev-admin-token' : 'dev-user-token');
  window.dispatchEvent(new Event('civicpulse_auth_change'));
};

export const clearDevLogin = () => {
  localStorage.removeItem('civicpulse_dev_token');
  window.dispatchEvent(new Event('civicpulse_auth_change'));
};

export const resetRecaptcha = (containerId: string = 'recaptcha-container') => {
  if (_recaptchaVerifier) {
    try {
      _recaptchaVerifier.clear();
    } catch (e) {}
    _recaptchaVerifier = null;
  }
  const container = document.getElementById(containerId);
  if (container && container.parentNode) {
    const fresh = document.createElement('div');
    fresh.id = containerId;
    container.parentNode.replaceChild(fresh, container);
  }
};

export const setupRecaptcha = (containerId: string): RecaptchaVerifier | null => {
  if (!_auth) return null;

  try {
    resetRecaptcha(containerId);

    _recaptchaVerifier = new RecaptchaVerifier(_auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA expired');
        resetRecaptcha(containerId);
      },
    });

    return _recaptchaVerifier;
  } catch (e) {
    console.error('RecaptchaVerifier setup failed:', e);
    resetRecaptcha(containerId);
    return null;
  }
};

export const sendOTP = async (
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> => {
  if (!_auth) throw new Error('Firebase authentication is not ready.');
  return signInWithPhoneNumber(_auth, phoneNumber, recaptchaVerifier);
};

export const signOut = async () => {
  clearDevLogin();
  if (_auth) {
    await _auth.signOut();
  }
};
