/* CivicPulse AI — Authentication Context */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getDevUser, setDevLogin, signOut as firebaseSignOut } from '../services/firebase';

export interface AppUser {
  uid: string;
  phoneNumber?: string | null;
  displayName?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  loginAsDev: (role: 'citizen' | 'admin') => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  loginAsDev: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkDevAuth = useCallback(() => {
    const devUser = getDevUser();
    if (devUser) {
      setUser({
        uid: devUser.uid,
        phoneNumber: devUser.phoneNumber,
        displayName: devUser.displayName,
      });
      setIsAdmin(devUser.isAdmin);
      setLoading(false);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Check if dev session exists
    if (checkDevAuth()) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber,
          displayName: firebaseUser.displayName,
        });
        const token = await firebaseUser.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } else {
        // If not in firebase, recheck dev auth
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
      unsubscribe();
      window.removeEventListener('civicpulse_auth_change', handleAuthChange);
    };
  }, [checkDevAuth]);

  const loginAsDev = (role: 'citizen' | 'admin') => {
    setDevLogin(role);
  };

  const handleSignOut = async () => {
    await firebaseSignOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, loginAsDev, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
