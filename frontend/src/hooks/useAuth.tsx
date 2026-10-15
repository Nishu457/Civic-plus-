/* CivicPulse AI — Authentication Context (Supabase Email OTP + Dev Fallback) */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  supabase,
  isSupabaseConfigured,
  signOutSupabase,
  updateSupabaseProfile,
  type Session,
  type User as SupabaseUser,
} from '../services/supabase';
import { getDevUser, setDevLogin, signOut as devSignOut } from '../services/firebase';

export interface AppUser {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  cityDistrict?: string | null;
  citizenType?: string | null;
  isVerified?: boolean;
  profileCompleted?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  loginAsDev: (role: 'citizen' | 'admin') => void;
  updateProfile: (details: Partial<AppUser>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  loginAsDev: () => {},
  updateProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const getLocalProfile = (uid: string): Partial<AppUser> | null => {
    try {
      const raw = localStorage.getItem(`civicpulse_profile_${uid}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveLocalProfile = (uid: string, data: Partial<AppUser>) => {
    try {
      const existing = getLocalProfile(uid) || {};
      localStorage.setItem(`civicpulse_profile_${uid}`, JSON.stringify({ ...existing, ...data }));
    } catch {}
  };

  const checkDevAuth = useCallback(() => {
    const devUser = getDevUser();
    if (devUser) {
      const cached = getLocalProfile(devUser.uid);
      setUser({
        uid: devUser.uid,
        email: devUser.phoneNumber ? `${devUser.phoneNumber}@civicpulse.local` : 'demo@civicpulse.ai',
        phoneNumber: cached?.phoneNumber || devUser.phoneNumber,
        displayName: cached?.displayName || devUser.displayName,
        cityDistrict: cached?.cityDistrict || 'Vijayawada, Krishna District',
        citizenType: cached?.citizenType || (devUser.isAdmin ? 'Municipal Officer' : 'Local Resident'),
        isVerified: cached?.isVerified ?? true,
        profileCompleted: cached?.profileCompleted ?? true,
      });
      setIsAdmin(devUser.isAdmin);
      setLoading(false);
      return true;
    }
    return false;
  }, []);

  const mapSupabaseUser = (sbUser: SupabaseUser | null): AppUser | null => {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    const cached = getLocalProfile(sbUser.id);
    return {
      uid: sbUser.id,
      email: sbUser.email,
      phoneNumber: meta.phone_number || cached?.phoneNumber || sbUser.phone || null,
      displayName: meta.full_name || cached?.displayName || sbUser.email?.split('@')[0] || 'Citizen',
      cityDistrict: meta.city_district || cached?.cityDistrict || null,
      citizenType: meta.citizen_type || cached?.citizenType || 'Local Resident',
      isVerified: Boolean(meta.is_verified || cached?.isVerified),
      profileCompleted: Boolean(meta.profile_completed || cached?.profileCompleted),
    };
  };

  useEffect(() => {
    const handleAuthChange = () => {
      if (!checkDevAuth()) {
        setUser(null);
        setIsAdmin(false);
      }
    };
    window.addEventListener('civicpulse_auth_change', handleAuthChange);

    // 1. Check if local dev session is active
    if (checkDevAuth()) {
      return () => {
        window.removeEventListener('civicpulse_auth_change', handleAuthChange);
      };
    }

    // 2. If Supabase is configured, restore session and listen for auth state changes
    let subscription: any = null;
    if (isSupabaseConfigured && supabase) {
      // Restore initial session
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (initialSession?.user) {
          setSession(initialSession);
          setUser(mapSupabaseUser(initialSession.user));
          const role =
            initialSession.user.app_metadata?.role ||
            initialSession.user.user_metadata?.role;
          setIsAdmin(role === 'admin');
        } else {
          checkDevAuth();
        }
        setLoading(false);
      });

      // Listen for real-time auth state events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
      const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user) {
          setUser(mapSupabaseUser(currentSession.user));
          const role =
            currentSession.user.app_metadata?.role ||
            currentSession.user.user_metadata?.role;
          setIsAdmin(role === 'admin');
        } else {
          if (!checkDevAuth()) {
            setUser(null);
            setIsAdmin(false);
          }
        }
        setLoading(false);
      });
      subscription = data.subscription;
    } else {
      // Supabase not configured: fallback to dev session check
      checkDevAuth();
      setLoading(false);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
      window.removeEventListener('civicpulse_auth_change', handleAuthChange);
    };
  }, [checkDevAuth]);

  const loginAsDev = (role: 'citizen' | 'admin') => {
    setDevLogin(role);
    const isAdm = role === 'admin';
    const uid = isAdm ? 'dev-admin-uid' : 'dev-user-uid';
    const cached = getLocalProfile(uid);
    setUser({
      uid,
      email: isAdm ? 'admin@civicpulse.ai' : 'demo@civicpulse.ai',
      phoneNumber: cached?.phoneNumber || '+91 98765 43210',
      displayName: cached?.displayName || (isAdm ? 'Demo Admin' : 'Demo Citizen'),
      cityDistrict: cached?.cityDistrict || 'Vijayawada, Krishna District',
      citizenType: cached?.citizenType || (isAdm ? 'Municipal Officer' : 'Local Resident'),
      isVerified: cached?.isVerified ?? true,
      profileCompleted: cached?.profileCompleted ?? true,
    });
    setIsAdmin(isAdm);
    setLoading(false);
  };

  const updateProfile = async (details: Partial<AppUser>) => {
    if (!user) return;
    const updatedUser: AppUser = {
      ...user,
      ...details,
      profileCompleted: true,
      isVerified: details.isVerified ?? user.isVerified ?? true,
    };
    saveLocalProfile(user.uid, updatedUser);
    setUser(updatedUser);

    if (isSupabaseConfigured && supabase) {
      try {
        await updateSupabaseProfile({
          full_name: details.displayName || user.displayName || undefined,
          phone_number: details.phoneNumber || user.phoneNumber || undefined,
          city_district: details.cityDistrict || user.cityDistrict || undefined,
          citizen_type: details.citizenType || user.citizenType || undefined,
          is_verified: updatedUser.isVerified,
          profile_completed: true,
        });
      } catch (err) {
        console.warn('Failed to sync profile to Supabase auth:', err);
      }
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      await signOutSupabase();
    }
    await devSignOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        loginAsDev,
        updateProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
