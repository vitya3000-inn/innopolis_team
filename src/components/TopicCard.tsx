import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Topic } from '../types';
import { typography, spacing, borderRadius, type ThemeColors, getShadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import CategoryBadge from './CategoryBadge';

type AppShadows = ReturnType<typeof getShadows>;

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
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.title}>{topic.title}</Text>

      <CategoryBadge category={topic.category} />

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{pluralEvents(topic.eventsCount)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
        <Text style={styles.updateText}>Обновлено {topic.lastUpdate}</Text>
      </View>

      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors, shadows: AppShadows) {
  return StyleSheet.create({
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
}
