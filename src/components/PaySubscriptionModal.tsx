import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, type ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useActionCooldown } from '../hooks/useActionCooldown';

/** Отображаемая цена подписки (пока без реальной оплаты). */
export const SUBSCRIPTION_PRICE_RUB_PER_MONTH = 77;

type PaySubscriptionModalProps = {
  visible: boolean;
  onSignOut: () => void;
  /** Из личного кабинета админа: только просмотр, кнопка «Закрыть», без блокировки ленты. */
  previewMode?: boolean;
  onPreviewClose?: () => void;
};

export default function PaySubscriptionModal({
  visible,
  onSignOut,
  previewMode = false,
  onPreviewClose,
}: PaySubscriptionModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cooldownSubscribe = useActionCooldown();
  const cooldownSignOut = useActionCooldown();

  const onSubscribe = () => {
    cooldownSubscribe(() => {
      Alert.alert(
        'Подписка',
        'Оплата будет подключена позже (Stripe / ЮKassa и т.д.). Пока администратор может включить доступ в Supabase: user_entitlements.subscription_active = true.',
        [{ text: 'OK' }],
      );
    });
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

          <View style={styles.priceBlock}>
            <Text style={styles.priceValue}>{SUBSCRIPTION_PRICE_RUB_PER_MONTH} ₽</Text>
            <Text style={styles.pricePeriod}>в месяц</Text>
          </View>

          <Text style={styles.lead}>
            Спасибо, что пользовались NewsMap. Бесплатный пробный период завершился — надеемся, лента была
            вам полезна. Чтобы по-прежнему открывать актуальную картину дня без ограничений, оформите
            подписку: так вы поддерживаете сервис и сохраняете полный доступ к материалам.
          </Text>
          <Text style={styles.hint}>
            После подключения оплаты подписку можно будет продлевать автоматически и отменять в любой
            момент в настройках.
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
              onPress={() => cooldownSignOut(() => void onSignOut())}
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
      marginBottom: spacing.md,
    },
    previewBadge: {
      alignSelf: 'center',
      color: colors.warning,
      fontSize: typography.fontSizeSM,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.md,
    },
    priceBlock: {
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    priceValue: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeHero,
      fontWeight: typography.fontWeightBold,
    },
    pricePeriod: {
      color: colors.textMuted,
      fontSize: typography.fontSizeMD,
      marginTop: spacing.xs,
    },
    lead: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeMD,
      lineHeight: typography.fontSizeMD * typography.lineHeightRelaxed,
      textAlign: 'center',
      marginBottom: spacing.md,
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
