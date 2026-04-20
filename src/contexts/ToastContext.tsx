import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { spacing, typography, borderRadius } from '../constants/theme';

const DEFAULT_DURATION_MS = 3800;

type ToastContextValue = {
  /** Короткое уведомление в углу экрана; скрывается через durationMs или по крестику. */
  showToast: (message: string, durationMs?: number) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastPayload = { message: string; key: number };

function ToastViewport({
  payload,
  onDismiss,
}: {
  payload: ToastPayload | null;
  onDismiss: () => void;
}) {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!payload) return;
    opacity.setValue(0);
    translateY.setValue(16);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [payload?.key, opacity, translateY]);

  if (!payload) {
    return null;
  }

  const handleClosePress = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 8, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, Platform.OS === 'web' ? { zIndex: 50_000 } : null]}
    >
      <View
        pointerEvents="box-none"
        style={[
          styles.anchor,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingRight: Math.max(insets.right, spacing.md),
            paddingLeft: Math.max(insets.left, spacing.md),
          },
        ]}
      >
        <Animated.View
          pointerEvents="auto"
          style={[
            {
              opacity,
              transform: [{ translateY }],
              maxWidth: 400,
              width: '100%',
              alignSelf: 'flex-end',
            },
            shadows.medium,
          ]}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardText, { color: colors.textPrimary }]} accessibilityRole="text">
              {payload.message}
            </Text>
            <TouchableOpacity
              onPress={handleClosePress}
              hitSlop={14}
              accessibilityLabel="Закрыть уведомление"
              accessibilityRole="button"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    setPayload(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (message: string, durationMs: number = DEFAULT_DURATION_MS) => {
      clearTimer();
      keyRef.current += 1;
      const myKey = keyRef.current;
      setPayload({ message, key: myKey });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setPayload((p) => (p && p.key === myKey ? null : p));
      }, durationMs);
    },
    [clearTimer],
  );

  const value = useMemo(
    () => ({
      showToast,
      hideToast,
    }),
    [showToast, hideToast],
  );

  const dismissFromViewport = useCallback(() => {
    clearTimer();
    setPayload(null);
  }, [clearTimer]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.providerRoot} collapsable={false}>
        {children}
        <ToastViewport payload={payload} onDismiss={dismissFromViewport} />
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1,
  },
  viewport: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  cardText: {
    flex: 1,
    fontSize: typography.fontSizeMD,
    lineHeight: 22,
    fontWeight: typography.fontWeightMedium,
  },
  closeBtn: {
    padding: spacing.xs,
  },
});
