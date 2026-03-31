import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Topic } from '../types';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/theme';
import CategoryBadge from './CategoryBadge';

function pluralEvents(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} событие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} события`;
  return `${n} событий`;
}

interface TopicCardProps {
  topic: Topic;
  onPress: () => void;
}

export default function TopicCard({ topic, onPress }: TopicCardProps) {
  // Карточка агрегированной темы в ленте.
  // Показывает категорию, число событий и время последнего обновления.
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Trending индикатор */}
      {topic.trending && (
        <View style={styles.trendingBadge}>
          <Ionicons name="trending-up" size={12} color={colors.warning} />
          <Text style={styles.trendingText}>В тренде</Text>
        </View>
      )}

      {/* Заголовок */}
      <Text style={styles.title}>{topic.title}</Text>

      {/* Категория */}
      <CategoryBadge category={topic.category} />

      {/* Метаданные */}
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{pluralEvents(topic.eventsCount)}</Text>
        </View>
      </View>

      {/* Время обновления */}
      <View style={styles.footer}>
        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
        <Text style={styles.updateText}>Обновлено {topic.lastUpdate}</Text>
      </View>

      {/* Стрелка */}
      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trendingText: {
    color: colors.warning,
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    marginBottom: spacing.md,
    lineHeight: typography.fontSizeXL * typography.lineHeightTight,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
    marginLeft: spacing.xs,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  updateText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeXS,
    marginLeft: spacing.xs,
  },
  arrow: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -10,
  },
});
