import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { typography, spacing, borderRadius, type ThemeColors } from '../constants/theme';
import { Header, OpinionCard } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { useActionCooldown } from '../hooks/useActionCooldown';
import { fetchEvent } from '../services/newsApi';
import { Event } from '../types';

type EventScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Event'>;
type EventScreenRouteProp = RouteProp<RootStackParamList, 'Event'>;

interface EventScreenProps {
  navigation: EventScreenNavigationProp;
  route: EventScreenRouteProp;
}

export default function EventScreen({ navigation, route }: EventScreenProps) {
  const { eventId, archiveDateUtc } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cooldownRetry = useActionCooldown();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const remote = await fetchEvent(eventId, archiveDateUtc ?? null);
        if (cancelled) return;
        if (remote) {
          setEvent(remote);
        } else {
          setEvent(null);
          setLoadError('Не удалось загрузить событие. Проверьте соединение или откройте ленту заново.');
        }
      } catch (_e) {
        if (!cancelled) {
          setEvent(null);
          setLoadError('Не удалось подключиться к серверу.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, archiveDateUtc]);

  const handleRetry = () => {
    cooldownRetry(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const remote = await fetchEvent(eventId, archiveDateUtc ?? null);
        if (remote) {
          setEvent(remote);
        } else {
          setEvent(null);
          setLoadError('Не удалось загрузить событие. Проверьте соединение или откройте ленту заново.');
        }
      } catch (_e) {
        setEvent(null);
        setLoadError('Не удалось подключиться к серверу.');
      } finally {
        setLoading(false);
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header
          title="Событие"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Загрузка...</Text>
        </View>
      </View>
    );
  }

  if (loadError || !event) {
    return (
      <View style={styles.container}>
        <Header
          title="Событие"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorScreen}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Нет данных</Text>
          <Text style={styles.errorMessage}>{loadError || 'Событие не найдено.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Событие"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {event.isBreaking && (
          <View style={styles.breakingContainer}>
            <View style={styles.breakingBadge}>
              <Ionicons name="flash" size={14} color="#FFF" />
              <Text style={styles.breakingText}>Срочная новость</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.timestamp}>{event.timestamp}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>AI Summary</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{event.summary}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Ключевые факты</Text>
          </View>
          <View style={styles.factsCard}>
            {event.keyFacts.map((fact, index) => (
              <View key={index} style={styles.factItem}>
                <View style={styles.factNumber}>
                  <Text style={styles.factNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="newspaper" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Позиции СМИ</Text>
          </View>
          {event.opinions.map((opinion, index) => (
            <OpinionCard key={index} opinion={opinion} />
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {event.sources.length} источников
            </Text>
          </View>
          <View style={styles.sourcesRow}>
            {event.sources.map((source, index) => (
              <View key={index} style={styles.sourceChip}>
                <Text style={styles.sourceChipText}>{source.name}</Text>
              </View>
            ))}
          </View>
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
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
  breakingContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  breakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.negative,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  breakingText: {
    color: '#FFF',
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightBold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
    marginLeft: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    lineHeight: typography.fontSizeXXL * typography.lineHeightTight,
    marginBottom: spacing.sm,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
  },
  summaryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    lineHeight: typography.fontSizeMD * typography.lineHeightRelaxed,
  },
  factsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  factNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  factNumberText: {
    color: colors.accent,
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightBold,
  },
  factText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    flex: 1,
    lineHeight: typography.fontSizeMD * typography.lineHeightNormal,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sourceChip: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  sourceChipText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeXS,
  },
});
}
