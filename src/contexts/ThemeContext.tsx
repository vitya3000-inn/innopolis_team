import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ThemeColors,
  type ThemeMode,
  getColors,
  buildCategoryColors,
  buildStanceColors,
  getShadows,
} from '../constants/theme';

const STORAGE_KEY = '@newsmap_theme_mode';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  categoryColors: Record<string, string>;
  stanceColors: Record<string, string>;
  shadows: ReturnType<typeof getShadows>;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw === 'light' || raw === 'dark') setModeState(raw);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = useMemo(() => getColors(mode), [mode]);
  const categoryColors = useMemo(() => buildCategoryColors(colors), [colors]);
  const stanceColors = useMemo(() => buildStanceColors(colors), [colors]);
  const shadows = useMemo(() => getShadows(mode), [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors,
      categoryColors,
      stanceColors,
      shadows,
      setMode,
      toggleMode,
    }),
    [mode, colors, categoryColors, stanceColors, shadows, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme должен вызываться внутри ThemeProvider');
  }
  return ctx;
}
