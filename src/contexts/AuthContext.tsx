import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseAuthConfigured, supabase } from '../lib/supabase';
import { getAppRole, isAdminEmail, type AppRole } from '../lib/accessRoles';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authConfigured: boolean;
  /** Роль в приложении: guest (без Auth), user, admin (по email). */
  role: AppRole;
  isAdmin: boolean;
  /** Вход: email + пароль → `signInWithPassword` (Supabase Auth). */
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  /** Письмо со ссылкой сброса пароля (настройте Redirect URLs в Supabase). */
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase не настроен: задайте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return {
        error: new Error('Supabase не настроен: задайте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY'),
        needsEmailConfirmation: false,
      };
    }
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: origin
        ? {
            emailRedirectTo: `${origin}/`,
          }
        : undefined,
    });
    if (error) {
      return { error: new Error(error.message), needsEmailConfirmation: false };
    }
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return { error: null, needsEmailConfirmation };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) {
      return { error: new Error('Supabase не настроен') };
    }
    const trimmed = email.trim();
    if (!trimmed) {
      return { error: new Error('Укажите email') };
    }
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: origin ? `${origin}/` : undefined,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const user = session?.user ?? null;
  const isAdmin = useMemo(() => isAdminEmail(user?.email ?? null), [user?.email]);
  const role = useMemo(
    () => getAppRole(isSupabaseAuthConfigured, user?.email ?? null),
    [user?.email],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      authConfigured: isSupabaseAuthConfigured,
      role,
      isAdmin,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      signOut,
    }),
    [
      session,
      user,
      loading,
      role,
      isAdmin,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth должен вызываться внутри AuthProvider');
  }
  return ctx;
}
