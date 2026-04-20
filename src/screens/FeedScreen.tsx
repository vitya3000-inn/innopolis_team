import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Category } from '../types';
import { spacing, typography, type ThemeColors } from '../constants/theme';
import { Header, TopicCard, FilterChips } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchTopics, getApiBaseUrl } from '../services/newsApi';
import { recordAppVisitOncePerMount } from '../services/visitAnalytics';
import { syncFeedVisitPaywall } from '../services/feedVisitPaywall';
import PaySubscriptionModal from '../components/PaySubscriptionModal';
import { useActionCooldown } from '../hooks/useActionCooldown';
import { Topic } from '../types';
import { dateFromYmdString, isValidUtcYmd, ymdFromPickerDate } from '../utils/archiveDate';

type FeedScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

interface FeedScreenProps {
  navigation: FeedScreenNavigationProp;
}

export default function FeedScreen({ navigation }: FeedScreenProps) {
  const { user, authConfigured, loading: authLoading, signOut, isAdmin } = useAuth();
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visitLogged = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** null = актуальная лента (store); иначе архив Supabase за календарный день UTC */
  const [archiveDateUtc, setArchiveDateUtc] = useState<string | null>(null);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  /** Выбранный в календаре день (локальная календарная дата). */
  const [pickerDate, setPickerDate] = useState(() => dateFromYmdString(null));
  const [webDateDraft, setWebDateDraft] = useState('');
  const [paywallOpen, setPaywallOpen] = useState(false);
  const cooldownRefresh = useActionCooldown();
  const cooldownRetry = useActionCooldown();

  const filteredTopics = selectedCategories.length === 0
    ? topics
    : topics.filter(topic => selectedCategories.includes(topic.category));

  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.trending && !b.trending) return -1;
    if (!a.trending && b.trending) return 1;
    return b.mentionsCount - a.mentionsCount;
  });

  const loadTopics = async () => {
    try {
      const remoteTopics = await fetchTopics(archiveDateUtc);
      if (remoteTopics.length > 0) {
        setTopics(remoteTopics);
        setLoadError(null);
      } else {
        setTopics([]);
        setLoadError(
          `Сервер вернул 0 тем (проверьте GET /topics и store.json на машине с backend).\nAPI: ${getApiBaseUrl()}`,
        );
      }
    } catch (error) {
      setTopics([]);
      const detail =
        error instanceof Error ? error.message : 'Не удалось подключиться к серверу.';
      setLoadError(`${detail}\n\nAPI: ${getApiBaseUrl()}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadTopics();
  }, [archiveDateUtc]);

  useEffect(() => {
    if (!authConfigured || authLoading || visitLogged.current) return;
    const id = setTimeout(() => {
      if (visitLogged.current) return;
      visitLogged.current = true;
      void recordAppVisitOncePerMount(user?.id ?? null);
    }, 320);
    return () => clearTimeout(id);
  }, [authConfigured, authLoading, user?.id]);

  /** Уникальные UTC-дни с успешной актуальной лентой; при ≥7 без подписки — модалка оплаты. Админы не ограничиваются и не пишутся в paywall-таблицы. */
  useEffect(() => {
    if (isAdmin) {
      setPaywallOpen(false);
      return;
    }
    if (!authConfigured || authLoading || !user?.id || archiveDateUtc !== null) return;
    if (isLoading) return;
    if (topics.length === 0 || loadError) return;
    let cancelled = false;
    void syncFeedVisitPaywall(user.id).then((r) => {
      if (cancelled || !r) return;
      setPaywallOpen(r.shouldShowPaywall);
    });
    return () => {
      cancelled = true;
    };
  }, [
    authConfigured,
    authLoading,
    user?.id,
    archiveDateUtc,
    isLoading,
    topics.length,
    loadError,
    isAdmin,
  ]);

  const handleRefresh = () => {
    cooldownRefresh(async () => {
      setRefreshing(true);
      try {
        await loadTopics();
      } finally {
        setRefreshing(false);
      }
    });
  };

  const handleRetry = () => {
    cooldownRetry(async () => {
      setIsLoading(true);
      setLoadError(null);
      await loadTopics();
    });
  };

  const handleToggleCategory = (category: Category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  const handleResetCategories = () => {
    setSelectedCategories([]);
  };

  const handleTopicPress = (topicId: string, topicTitle: string, topicCategory: Category) => {
    navigation.navigate('Topic', {
      topicId,
      topicTitle,
      topicCategory,
      ...(archiveDateUtc ? { archiveDateUtc } : {}),
    });
  };

  const openArchiveModal = () => {
    setPickerDate(dateFromYmdString(archiveDateUtc));
    setWebDateDraft(archiveDateUtc || '');
    setArchiveModalOpen(true);
  };

  const applyPickerDate = () => {
    setArchiveDateUtc(ymdFromPickerDate(pickerDate));
    setArchiveModalOpen(false);
  };

  const onNativePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      return;
    }
    if (date) {
      setPickerDate(date);
    }
  };

  const applyWebDate = () => {
    const t = webDateDraft.trim();
    if (!t) {
      setArchiveDateUtc(null);
      setArchiveModalOpen(false);
      return;
    }
    if (!isValidUtcYmd(t)) return;
    setArchiveDateUtc(t);
    setArchiveModalOpen(false);
  };

  const webOkDisabled =
    Platform.OS === 'web' &&
    Boolean(webDateDraft.trim()) &&
    !isValidUtcYmd(webDateDraft.trim());

  const showErrorOnly = !isLoading && topics.length === 0 && loadError;

  const subtitleMain = archiveDateUtc
    ? `Архив UTC ${archiveDateUtc} (последний прогон дня)`
    : 'Главные события сегодня';
  const headerSubtitle = subtitleMain;

  return (
    <View style={styles.container}>
      <Header
        title="NewsMap"
        subtitle={headerSubtitle}
        headerRight={
          authConfigured && user ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Account')}
              accessibilityLabel="Личный кабинет"
              hitSlop={12}
            >
              <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View style={styles.archiveBar}>
        <TouchableOpacity style={styles.archiveButton} onPress={openArchiveModal} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          <Text style={styles.archiveButtonText}>
            {archiveDateUtc ? `UTC ${archiveDateUtc}` : 'Дата (UTC)'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={archiveModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Архив за день</Text>
              <Text style={styles.modalHint}>
                Выберите дату в календаре. Для запроса к серверу используется календарный день (YYYY-MM-DD);
                на backend фильтр по UTC-дню прогона ingestion.
              </Text>

              {Platform.OS === 'web' ? (
                <>
                  <Text style={styles.webPickerLabel}>Дата (веб)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="2025-04-03"
                    placeholderTextColor={colors.textMuted}
                    value={webDateDraft}
                    onChangeText={setWebDateDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    onChange={onNativePickerChange}
                    themeVariant={mode === 'dark' ? 'dark' : 'light'}
                    maximumDate={new Date()}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setArchiveModalOpen(false)}>
                  <Text style={styles.modalSecondaryText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondary}
                  onPress={() => {
                    setArchiveDateUtc(null);
                    setArchiveModalOpen(false);
                  }}
                >
                  <Text style={styles.modalSecondaryText}>Актуальная лента</Text>
                </TouchableOpacity>
                {Platform.OS === 'web' ? (
                  <TouchableOpacity
                    style={[styles.modalPrimary, webOkDisabled && styles.modalPrimaryDisabled]}
                    onPress={applyWebDate}
                    disabled={webOkDisabled}
                  >
                    <Text style={styles.modalPrimaryText}>OK</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.modalPrimary} onPress={applyPickerDate}>
                    <Text style={styles.modalPrimaryText}>Готово</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {isLoading && (
        <View style={styles.centered}>
          <Text style={styles.statusText}>Загрузка тем...</Text>
        </View>
      )}

      {showErrorOnly && (
        <View style={styles.errorScreen}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Нет данных</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !showErrorOnly && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <FilterChips
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onResetCategories={handleResetCategories}
          />

          <View style={styles.topicsList}>
            {sortedTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onPress={() => handleTopicPress(topic.id, topic.title, topic.category)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <PaySubscriptionModal
        visible={paywallOpen}
        onSignOut={() => {
          setPaywallOpen(false);
          void signOut();
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  archiveBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  archiveButtonText: {
    color: colors.accent,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  pickerWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  webPickerLabel: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightBold,
  },
  modalHint: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
    marginTop: spacing.sm,
    lineHeight: typography.fontSizeSM * 1.4,
  },
  modalInput: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalSecondary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalSecondaryText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeMD,
  },
  modalPrimary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
  },
  modalPrimaryDisabled: {
    opacity: 0.45,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topicsList: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeMD,
  },
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  errorTitle: {
    marginTop: spacing.lg,
    color: colors.textPrimary,
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
  },
  errorMessage: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.fontSizeMD,
    textAlign: 'center',
    lineHeight: typography.fontSizeMD * typography.lineHeightRelaxed,
  },
  retryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
});
}
