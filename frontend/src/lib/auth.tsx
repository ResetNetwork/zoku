// Authentication context and hooks
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Zoku } from './types';

interface AuthContextType {
  user: Zoku | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Zoku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      // Fetch current user from /api/zoku/me
      const response = await fetch('/api/zoku/me');

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const data = await response.json();
      setUser(data.user);
      setError(null);
    } catch (err) {
      console.error('Failed to load user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Helper hooks for permission checks
export const useCanWrite = () => {
  const { user } = useAuth();
  return user?.access_tier === 'entangled' || user?.access_tier === 'prime';
};

export const useIsPrime = () => {
  const { user } = useAuth();
  return user?.access_tier === 'prime';
};
