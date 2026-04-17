import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { typography, spacing, borderRadius, type ThemeColors } from '../constants/theme';
import { Header } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getVisitStats, postAdminRefresh } from '../services/adminApi';
import { isValidUtcYmd, ymdUtcShift, ymdUtcToday } from '../utils/archiveDate';

type AdminNav = NativeStackNavigationProp<RootStackParamList, 'Admin'>;

interface AdminScreenProps {
  navigation: AdminNav;
}

export default function AdminScreen({ navigation }: AdminScreenProps) {
  const { session, isAdmin, authConfigured } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [forceCache, setForceCache] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  const today = ymdUtcToday();
  const [fromYmd, setFromYmd] = useState(() => ymdUtcShift(today, -6));
  const [toYmd, setToYmd] = useState(today);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsText, setStatsText] = useState<string | null>(null);

  const runRefresh = async () => {
    setLog(null);
    if (!session?.access_token) {
      setLog('Нет access token: выйдите и войдите снова.');
      return;
    }
    setBusy(true);
    try {
      const r = await postAdminRefresh(session.access_token, forceCache);
      if (r.ok) {
        setLog(`Готово. Тем на сервере: ${r.topics}. Обновите ленту свайпом на главной.`);
      } else {
        setLog(`Ошибка (${r.status}): ${r.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (daysInclusive: number) => {
    const t = ymdUtcToday();
    setToYmd(t);
    setFromYmd(ymdUtcShift(t, -(daysInclusive - 1)));
    setStatsText(null);
  };

  const loadVisitStats = async () => {
    setStatsText(null);
    if (!session?.access_token) {
      setStatsText('Нет access token.');
      return;
    }
    if (!isValidUtcYmd(fromYmd) || !isValidUtcYmd(toYmd)) {
      setStatsText('Введите даты в формате YYYY-MM-DD (UTC).');
      return;
    }
    setStatsBusy(true);
    try {
      const r = await getVisitStats(session.access_token, fromYmd, toYmd);
      if (r.ok) {
        setStatsText(
          `За период с ${fromYmd} по ${toYmd} (UTC календарные дни, включительно): ${r.count} посещений главной ленты.`,
        );
      } else {
        setStatsText(`Ошибка (${r.status}): ${r.message}`);
      }
    } finally {
      setStatsBusy(false);
    }
  };

  if (!authConfigured) {
    return (
      <View style={styles.container}>
        <Header title="Админ" showBack onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Supabase Auth не настроен.</Text>
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Header title="Админ" showBack onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
          <Text style={styles.deniedTitle}>Доступ запрещён</Text>
          <Text style={styles.deniedText}>
            Этот раздел только для администраторов. Ваш аккаунт имеет уровень «Пользователь».
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Администрирование" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={22} color={colors.positive} />
          <Text style={styles.badgeText}>Роль: администратор</Text>
        </View>

        <Text style={styles.lead}>
          Запуск полного обновления ленты на backend (NewsAPI → пайплайн → store.json и при включённом
          Supabase — запись прогона). Операция может занять несколько минут.
        </Text>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchBody}>
              <Text style={styles.switchLabel}>Обойти свежесть кэша NewsAPI</Text>
              <Text style={styles.switchHint}>Параметр force=1 на сервере</Text>
            </View>
            <Switch
              value={forceCache}
              onValueChange={setForceCache}
              disabled={busy}
              trackColor={{ false: colors.border, true: colors.accentDark }}
              thumbColor={Platform.OS === 'android' ? colors.textPrimary : undefined}
            />
          </View>

          <TouchableOpacity
            style={[styles.primary, busy && styles.primaryDisabled]}
            onPress={() => void runRefresh()}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={22} color={colors.textPrimary} />
                <Text style={[styles.primaryText, styles.primaryTextGap]}>Обновить ленту на сервере</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {log ? (
          <View style={styles.logBox}>
            <Text style={styles.logText} selectable>
              {log}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Посещения приложения</Text>
        <Text style={styles.lead}>
          Считаются открытия главной ленты (одна запись за запуск приложения на пользователя). Данные в
          Supabase, таблица app_visits — выполните backend/supabase/app_visits.sql, если ещё не создавали.
        </Text>

        <View style={styles.card}>
          <Text style={styles.switchLabel}>Период (UTC, YYYY-MM-DD)</Text>
          <Text style={styles.switchHint}>«По» включительно</Text>
          <View style={styles.dateRow}>
            <View style={[styles.dateField, styles.dateFieldGap]}>
              <Text style={styles.dateLabel}>С</Text>
              <TextInput
                style={styles.dateInput}
                value={fromYmd}
                onChangeText={setFromYmd}
                placeholder="2026-04-01"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>По</Text>
              <TextInput
                style={styles.dateInput}
                value={toYmd}
                onChangeText={setToYmd}
                placeholder="2026-04-07"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7)}>
              <Text style={styles.presetChipText}>7 дней</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(30)}>
              <Text style={styles.presetChipText}>30 дней</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(90)}>
              <Text style={styles.presetChipText}>90 дней</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.secondaryBtn, statsBusy && styles.primaryDisabled]}
            onPress={() => void loadVisitStats()}
            disabled={statsBusy}
          >
            {statsBusy ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.secondaryBtnText}>Показать число посещений</Text>
            )}
          </TouchableOpacity>
        </View>

        {statsText ? (
          <View style={styles.logBox}>
            <Text style={styles.logText} selectable>
              {statsText}
            </Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          POST /admin/refresh и GET /admin/visit-stats: Bearer access_token и email админа
          (config/builtinAdminEmails.json, ADMIN_EMAILS). Отладка без проверки: ADMIN_REFRESH_OPEN=1 на
          backend.
        </Text>
      </ScrollView>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  denied: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deniedTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightSemiBold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  deniedText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  badgeText: {
    color: colors.positive,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
    marginLeft: spacing.sm,
  },
  lead: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  switchBody: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
    marginTop: spacing.xs,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  primaryDisabled: {
    opacity: 0.65,
  },
  primaryText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
  },
  primaryTextGap: {
    marginLeft: spacing.sm,
  },
  logBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeSM,
    lineHeight: 20,
  },
  footer: {
    color: colors.textMuted,
    fontSize: typography.fontSizeXS,
    lineHeight: 18,
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  dateField: {
    flex: 1,
  },
  dateFieldGap: {
    marginRight: spacing.md,
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSizeXS,
    marginBottom: spacing.xs,
  },
  dateInput: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  presetChip: {
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipText: {
    color: colors.accentLight,
    fontSize: typography.fontSizeSM,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
  },
});
}
