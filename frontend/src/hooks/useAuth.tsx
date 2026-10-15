/* CivicPulse AI — Authentication Context (Supabase Email OTP + Dev Fallback) */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase, isSupabaseConfigured, signOutSupabase, type Session, type User as SupabaseUser } from '../services/supabase';
import { getDevUser, setDevLogin, signOut as devSignOut } from '../services/firebase';

export interface AppUser {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  loginAsDev: (role: 'citizen' | 'admin') => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  loginAsDev: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkDevAuth = useCallback(() => {
    const devUser = getDevUser();
    if (devUser) {
      setUser({
        uid: devUser.uid,
        email: devUser.phoneNumber ? `${devUser.phoneNumber}@civicpulse.local` : 'demo@civicpulse.ai',
        phoneNumber: devUser.phoneNumber,
        displayName: devUser.displayName,
      });
      setIsAdmin(devUser.isAdmin);
      setLoading(false);
      return true;
    }
    return false;
  }, []);

  const mapSupabaseUser = (sbUser: SupabaseUser | null): AppUser | null => {
    if (!sbUser) return null;
    return {
      uid: sbUser.id,
      email: sbUser.email,
      phoneNumber: sbUser.phone || null,
      displayName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Citizen',
    };
  };

  useEffect(() => {
    // 1. Check if local dev session is active
    if (checkDevAuth()) return;

    // 2. If Supabase is configured, restore session and listen for auth state changes
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
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, currentSession) => {
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

      const handleAuthChange = () => {
        if (!checkDevAuth()) {
          setUser(null);
          setIsAdmin(false);
        }
      };
      window.addEventListener('civicpulse_auth_change', handleAuthChange);

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('civicpulse_auth_change', handleAuthChange);
      };
    } else {
      // Supabase not configured: fallback to dev session check
      checkDevAuth();
      setLoading(false);
    }
  }, [checkDevAuth]);

  const loginAsDev = (role: 'citizen' | 'admin') => {
    setDevLogin(role);
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
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
