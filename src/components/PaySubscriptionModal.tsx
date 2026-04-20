import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, type ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { FREE_FEED_DAYS_BEFORE_PAYWALL } from '../services/feedVisitPaywall';

type PaySubscriptionModalProps = {
  visible: boolean;
  distinctVisitDays: number;
  onSignOut: () => void;
  /** Из личного кабинета админа: только просмотр, кнопка «Закрыть», без блокировки ленты. */
  previewMode?: boolean;
  onPreviewClose?: () => void;
};

export default function PaySubscriptionModal({
  visible,
  distinctVisitDays,
  onSignOut,
  previewMode = false,
  onPreviewClose,
}: PaySubscriptionModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onSubscribe = () => {
    Alert.alert(
      'Подписка',
      'Оплата будет подключена позже (Stripe / ЮKassa и т.д.). Пока администратор может включить доступ в Supabase: user_entitlements.subscription_active = true.',
      [{ text: 'OK' }],
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="diamond-outline" size={48} color={colors.accent} style={styles.icon} />
          <Text style={styles.title}>NewsMap Plus</Text>
          {previewMode ? (
            <Text style={styles.previewBadge}>Предпросмотр (администратор)</Text>
          ) : null}
          <Text style={styles.lead}>
            Вы открывали актуальную ленту {distinctVisitDays} {daysLabel(distinctVisitDays)}. Бесплатно
            доступны первые {FREE_FEED_DAYS_BEFORE_PAYWALL} уникальных дней (по UTC, не больше одного
            засчёта в день).
          </Text>
          <Text style={styles.hint}>
            Оформите подписку, чтобы продолжить пользоваться лентой без ограничений.
          </Text>

          <TouchableOpacity style={styles.primary} onPress={onSubscribe} activeOpacity={0.9}>
            <Text style={styles.primaryText}>Оформить подписку</Text>
          </TouchableOpacity>

          {previewMode ? (
            <TouchableOpacity
              style={styles.closePreview}
              onPress={() => onPreviewClose?.()}
              activeOpacity={0.85}
            >
              <Text style={styles.closePreviewText}>Закрыть</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signOut}
              onPress={() => void onSignOut()}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
              <Text style={styles.signOutText}>Выйти из аккаунта</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function daysLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'дней';
  if (m10 === 1) return 'день';
  if (m10 >= 2 && m10 <= 4) return 'дня';
  return 'дней';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    icon: {
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeXXL,
      fontWeight: typography.fontWeightBold,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    previewBadge: {
      alignSelf: 'center',
      color: colors.warning,
      fontSize: typography.fontSizeSM,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.md,
    },
    lead: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeMD,
      lineHeight: typography.fontSizeMD * typography.lineHeightRelaxed,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    hint: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      lineHeight: typography.fontSizeSM * 1.45,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    primary: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    primaryText: {
      color: '#fff',
      fontSize: typography.fontSizeMD,
      fontWeight: typography.fontWeightSemiBold,
    },
    closePreview: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    closePreviewText: {
      color: colors.accentLight,
      fontSize: typography.fontSizeMD,
      fontWeight: typography.fontWeightMedium,
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    signOutText: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
    },
  });
}
