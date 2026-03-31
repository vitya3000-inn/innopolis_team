import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { getEventById } from '../data/mockData';
import { Header, OpinionCard } from '../components';
import { fetchEvent } from '../services/newsApi';
import { Event } from '../types';

type EventScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Event'>;
type EventScreenRouteProp = RouteProp<RootStackParamList, 'Event'>;

interface EventScreenProps {
  navigation: EventScreenNavigationProp;
  route: EventScreenRouteProp;
}

export default function EventScreen({ navigation, route }: EventScreenProps) {
  // ID события передается из TopicScreen.
  const { eventId } = route.params;
  
  // Основной источник данных для экрана деталей события.
  const [event, setEvent] = useState<Event | undefined | null>(getEventById(eventId));

  useEffect(() => {
    const load = async () => {
      const remote = await fetchEvent(eventId);
      if (remote) {
        setEvent(remote);
      }
    };
    load();
  }, [eventId]);

  if (!event) {
    // Защитный сценарий: событие не найдено в источнике данных.
    return (
      <View style={styles.container}>
        <Header
          title="Событие"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Событие не найдено</Text>
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
        {/* Breaking badge */}
        {event.isBreaking && (
          <View style={styles.breakingContainer}>
            <View style={styles.breakingBadge}>
              <Ionicons name="flash" size={14} color="#FFF" />
              <Text style={styles.breakingText}>Срочная новость</Text>
            </View>
          </View>
        )}

        {/* Заголовок */}
        <View style={styles.section}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.timestamp}>{event.timestamp}</Text>
        </View>

        {/* AI Summary */}
        {/* Краткая выжимка, которую в production можно готовить на backend (LLM-pipeline). */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>AI Summary</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{event.summary}</Text>
          </View>
        </View>

        {/* Ключевые факты */}
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

        {/* Мнения источников */}
        {/* Карточки с позициями разных СМИ по одному и тому же событию. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="newspaper" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Позиции СМИ</Text>
          </View>
          {event.opinions.map((opinion, index) => (
            <OpinionCard key={index} opinion={opinion} />
          ))}
        </View>

        {/* Источники */}
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

const styles = StyleSheet.create({
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
