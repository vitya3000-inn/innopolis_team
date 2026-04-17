import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Opinion } from '../types';
import { typography, spacing, borderRadius, type ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface OpinionMapProps {
  opinions: Opinion[];
}

export default function OpinionMap({ opinions }: OpinionMapProps) {
  const { colors, stanceColors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const groupedOpinions = opinions.reduce(
    (acc, opinion) => {
      const stance = opinion.stance;
      if (!acc[stance]) {
        acc[stance] = [];
      }
      acc[stance].push(opinion);
      return acc;
    },
    {} as Record<string, Opinion[]>,
  );

  const total = opinions.length;
  const stanceStats = Object.entries(groupedOpinions).map(([stance, ops]) => ({
    stance,
    count: ops.length,
    percentage: Math.round((ops.length / total) * 100),
    sources: ops.map((o) => o.sourceName),
  }));

  stanceStats.sort((a, b) => b.count - a.count);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Карта мнений</Text>
      <Text style={styles.subtitle}>Как разные источники освещают событие</Text>

      <View style={styles.scaleContainer}>
        <View style={styles.scale}>
          {stanceStats.map((stat, index) => (
            <View
              key={stat.stance}
              style={[
                styles.scaleSegment,
                {
                  flex: stat.percentage,
                  backgroundColor: stanceColors[stat.stance] || colors.neutral,
                  borderTopLeftRadius: index === 0 ? borderRadius.full : 0,
                  borderBottomLeftRadius: index === 0 ? borderRadius.full : 0,
                  borderTopRightRadius: index === stanceStats.length - 1 ? borderRadius.full : 0,
                  borderBottomRightRadius: index === stanceStats.length - 1 ? borderRadius.full : 0,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        {stanceStats.map((stat) => (
          <View key={stat.stance} style={styles.legendItem}>
            <View style={styles.legendHeader}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: stanceColors[stat.stance] || colors.neutral },
                ]}
              />
              <Text style={styles.legendLabel}>{getStanceLabel(stat.stance)}</Text>
              <Text style={styles.legendPercentage}>{stat.percentage}%</Text>
            </View>
            <View style={styles.legendSources}>
              {stat.sources.map((source, idx) => (
                <View key={idx} style={styles.sourceChip}>
                  <Text style={styles.sourceChipText}>{source}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          💡 Позиции определены на основе анализа тональности публикаций
        </Text>
      </View>
    </View>
  );
}

function getStanceLabel(stance: string): string {
  const labels: Record<string, string> = {
    positive: 'Позитивно',
    neutral: 'Нейтрально',
    negative: 'Негативно',
    critical: 'Критично',
  };
  return labels[stance] || stance;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeLG,
      fontWeight: typography.fontWeightBold,
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      marginBottom: spacing.lg,
    },
    scaleContainer: {
      marginBottom: spacing.lg,
    },
    scale: {
      flexDirection: 'row',
      height: 12,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    scaleSegment: {
      height: '100%',
    },
    legend: {
      gap: spacing.md,
    },
    legendItem: {
      marginBottom: spacing.md,
    },
    legendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: spacing.sm,
    },
    legendLabel: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeMD,
      fontWeight: typography.fontWeightMedium,
      flex: 1,
    },
    legendPercentage: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      fontWeight: typography.fontWeightSemiBold,
    },
    legendSources: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginLeft: spacing.lg + spacing.sm,
    },
    sourceChip: {
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    sourceChipText: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeXS,
    },
    hint: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: typography.fontSizeXS,
      textAlign: 'center',
    },
  });
}
