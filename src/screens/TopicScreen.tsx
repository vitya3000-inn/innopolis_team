import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { spacing, typography, borderRadius, type ThemeColors } from '../constants/theme';
import { Header, EventCard, CategoryBadge } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { fetchTopicEvents } from '../services/newsApi';
import { Event } from '../types';

type TopicScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Topic'>;
type TopicScreenRouteProp = RouteProp<RootStackParamList, 'Topic'>;

interface TopicScreenProps {
  navigation: TopicScreenNavigationProp;
  route: TopicScreenRouteProp;
}

export default function TopicScreen({ navigation, route }: TopicScreenProps) {
  const { topicId, topicTitle, topicCategory, archiveDateUtc } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortByNewest, setSortByNewest] = useState(false);

  const loadEvents = async () => {
    try {
      const remoteEvents = await fetchTopicEvents(topicId, archiveDateUtc ?? null);
      if (remoteEvents.length > 0) {
        setEvents(remoteEvents);
        setError(null);
      } else {
        setEvents([]);
        setError('По этой теме пока нет событий на сервере.');
      }
    } catch (_error) {
      setEvents([]);
      setError('Не удалось подключиться к серверу. Проверьте сеть и адрес API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEvents([]);
    setLoading(true);
    setError(null);
    loadEvents();
  }, [topicId, archiveDateUtc]);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    await loadEvents();
  };

  const sortedEvents = [...events].sort((a, b) => {
    const tA = new Date(a.publishedAt ?? 0).getTime();
    const tB = new Date(b.publishedAt ?? 0).getTime();
    return sortByNewest ? tB - tA : tA - tB;
  });

  const handleEventPress = (eventId: string, eventTitle: string) => {
    navigation.navigate('Event', {
      eventId,
      eventTitle,
      ...(archiveDateUtc ? { archiveDateUtc } : {}),
    });
  };

  const showErrorOnly = !loading && events.length === 0 && error;

  return (
    <View style={styles.container}>
      <Header
        title={topicTitle}
        subtitle={loading ? '…' : `${events.length} событий`}
        showBack
        onBack={() => navigation.goBack()}
      />

      {loading && (
        <View style={styles.centered}>
          <Text style={styles.statusText}>Загрузка событий...</Text>
        </View>
      )}

      {showErrorOnly && (
        <View style={styles.errorScreen}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Нет данных</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !showErrorOnly && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.topRow}>
            <CategoryBadge category={topicCategory} size="medium" />
            <TouchableOpacity
              style={[styles.sortChip, sortByNewest && styles.sortChipActive]}
              onPress={() => setSortByNewest(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-down" size={12} color={sortByNewest ? colors.accent : colors.textMuted} />
              <Text style={[styles.sortChipText, sortByNewest && styles.sortChipTextActive]}>Новые</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventsList}>
            {sortedEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event.id, event.title)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightMedium,
  },
  sortChipTextActive: {
    color: colors.accent,
  },
  eventsList: {
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
