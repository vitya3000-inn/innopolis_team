import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { typography, spacing, borderRadius, type ThemeColors } from '../constants/theme';
import { Header } from '../components';
import PaySubscriptionModal from '../components/PaySubscriptionModal';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { FREE_FEED_DAYS_BEFORE_PAYWALL } from '../services/feedVisitPaywall';

type AccountNav = NativeStackNavigationProp<RootStackParamList, 'Account'>;

interface AccountScreenProps {
  navigation: AccountNav;
}

function formatRuDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AccountScreen({ navigation }: AccountScreenProps) {
  const { user, signOut, authConfigured, isAdmin, role } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [paywallPreviewOpen, setPaywallPreviewOpen] = useState(false);

  const initial = useMemo(() => {
    const e = user?.email?.trim();
    if (!e) return '?';
    return e[0].toUpperCase();
  }, [user?.email]);

  function Row({
    icon,
    label,
    value,
    mono,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    mono?: boolean;
  }) {
    return (
      <View style={styles.row}>
        <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, mono && styles.rowValueMono]} selectable>
            {value}
          </Text>
        </View>
      </View>
    );
  }

  if (!authConfigured || !user) {
    return (
      <View style={styles.container}>
        <Header title="Кабинет" showBack onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Войдите в аккаунт, чтобы открыть личный кабинет.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Личный кабинет" showBack onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, isAdmin && styles.avatarAdmin]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.roleLabel}>
            {isAdmin ? 'Администратор' : role === 'user' ? 'Пользователь' : 'Аккаунт NewsMap'}
          </Text>
          {isAdmin ? (
            <View style={styles.adminPill}>
              <Text style={styles.adminPillText}>Полный доступ к админ-инструментам</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Оформление</Text>
          <View style={styles.themeRow}>
            <View style={styles.themeRowBody}>
              <Text style={styles.rowLabel}>Тема интерфейса</Text>
              <Text style={styles.themeValue}>{mode === 'dark' ? 'Тёмная' : 'Светлая'}</Text>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={(dark) => setMode(dark ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.accentDark }}
              thumbColor={Platform.OS === 'android' ? colors.textPrimary : undefined}
              accessibilityLabel="Переключить тёмную и светлую тему"
            />
          </View>
          <Text style={styles.themeHint}>Распространяется на всё приложение. Настройка сохраняется на устройстве.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Контакты</Text>
          <Row icon="mail-outline" label="Email" value={user.email ?? '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Уровень доступа</Text>
          <Row
            icon={isAdmin ? 'shield-checkmark-outline' : 'person-outline'}
            label="Роль"
            value={isAdmin ? 'Администратор' : 'Пользователь'}
          />
        </View>

        {isAdmin ? (
          <>
            <TouchableOpacity
              style={styles.adminEntry}
              onPress={() => navigation.navigate('Admin')}
              activeOpacity={0.85}
            >
              <Ionicons name="construct-outline" size={22} color={colors.accentLight} />
              <View style={styles.adminEntryBody}>
                <Text style={styles.adminEntryTitle}>Админ-панель</Text>
                <Text style={styles.adminEntryHint}>Обновление ленты на сервере и служебные действия</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminEntry}
              onPress={() => setPaywallPreviewOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={22} color={colors.accentLight} />
              <View style={styles.adminEntryBody}>
                <Text style={styles.adminEntryTitle}>Предпросмотр экрана подписки</Text>
                <Text style={styles.adminEntryHint}>
                  Как видят экран оплаты пользователи после {FREE_FEED_DAYS_BEFORE_PAYWALL} уникальных дней с лентой
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Учётная запись</Text>
          <Row icon="key-outline" label="Способ входа" value="Email и пароль (Supabase)" />
          <Row icon="calendar-outline" label="Регистрация" value={formatRuDate(user.created_at)} />
          <Row icon="time-outline" label="Последний вход" value={formatRuDate(user.last_sign_in_at)} />
        </View>

        <Text style={styles.hint}>
          Данные хранятся в Supabase (схема auth). Лента новостей по-прежнему загружается с вашего backend;
          кабинет не синхронизирует избранное в БД.
        </Text>

        <TouchableOpacity
          style={styles.signOut}
          onPress={() => void signOut()}
          activeOpacity={0.85}
          accessibilityLabel="Выйти из аккаунта"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.negative} />
          <Text style={[styles.signOutText, styles.signOutTextGap]}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>

      <PaySubscriptionModal
        visible={paywallPreviewOpen}
        distinctVisitDays={FREE_FEED_DAYS_BEFORE_PAYWALL}
        onSignOut={signOut}
        previewMode
        onPreviewClose={() => setPaywallPreviewOpen(false)}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    emptyWrap: {
      flex: 1,
      padding: spacing.xl,
      justifyContent: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeMD,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    backBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    backBtnText: {
      color: colors.accentLight,
      fontSize: typography.fontSizeMD,
    },
    avatarWrap: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarAdmin: {
      backgroundColor: colors.positive,
    },
    adminPill: {
      marginTop: spacing.sm,
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.positive,
    },
    adminPillText: {
      color: colors.positive,
      fontSize: typography.fontSizeXS,
      fontWeight: typography.fontWeightMedium,
    },
    adminEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    adminEntryBody: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    adminEntryTitle: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeMD,
      fontWeight: typography.fontWeightSemiBold,
    },
    adminEntryHint: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      marginTop: spacing.xs,
    },
    avatarText: {
      color: colors.textPrimary,
      fontSize: 36,
      fontWeight: typography.fontWeightBold,
    },
    roleLabel: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeLG,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.md,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    themeRowBody: {
      flex: 1,
      marginRight: spacing.md,
    },
    themeValue: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeMD,
      marginTop: spacing.xs,
    },
    themeHint: {
      color: colors.textMuted,
      fontSize: typography.fontSizeXS,
      marginTop: spacing.md,
      lineHeight: 18,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    rowIcon: {
      marginRight: spacing.md,
      marginTop: 2,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowLabel: {
      color: colors.textMuted,
      fontSize: typography.fontSizeXS,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rowValue: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeMD,
      lineHeight: 22,
    },
    rowValueMono: {
      fontSize: typography.fontSizeSM,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    hint: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    signOutText: {
      color: colors.negative,
      fontSize: typography.fontSizeLG,
      fontWeight: typography.fontWeightSemiBold,
    },
    signOutTextGap: {
      marginLeft: spacing.sm,
    },
  });
}
