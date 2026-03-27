import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Opinion } from '../types';
import { colors, typography, spacing, borderRadius, stanceColors, stanceLabels } from '../constants/theme';

interface OpinionCardProps {
  opinion: Opinion;
}

export default function OpinionCard({ opinion }: OpinionCardProps) {
  const stanceColor = stanceColors[opinion.stance] || colors.neutral;
  const stanceLabel = stanceLabels[opinion.stance] || opinion.stance;

  const handleOpenArticle = () => {
    Linking.openURL(opinion.articleUrl);
  };

  return (
    <View style={styles.card}>
      {/* Заголовок с источником */}
      <View style={styles.header}>
        <View style={styles.sourceInfo}>
          <View style={styles.sourceIcon}>
            <Ionicons name="newspaper" size={16} color={colors.textPrimary} />
          </View>
          <Text style={styles.sourceName}>{opinion.sourceName}</Text>
        </View>
        <View style={[styles.stanceBadge, { backgroundColor: `${stanceColor}20` }]}>
          <View style={[styles.stanceDot, { backgroundColor: stanceColor }]} />
          <Text style={[styles.stanceText, { color: stanceColor }]}>{stanceLabel}</Text>
        </View>
      </View>

      {/* Summary мнения */}
      <Text style={styles.summary}>{opinion.summary}</Text>

      {/* Ключевые поинты */}
      <View style={styles.keyPoints}>
        {opinion.keyPoints.map((point, index) => (
          <View key={index} style={styles.keyPointItem}>
            <Ionicons name="checkmark-circle" size={14} color={stanceColor} />
            <Text style={styles.keyPointText}>{point}</Text>
          </View>
        ))}
      </View>

      {/* Ссылка на статью */}
      <TouchableOpacity style={styles.linkButton} onPress={handleOpenArticle}>
        <Text style={styles.linkText}>Читать статью</Text>
        <Ionicons name="open-outline" size={14} color={colors.accent} />
      </TouchableOpacity>
    </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  sourceName: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },
  stanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  stanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  stanceText: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    lineHeight: typography.fontSizeMD * typography.lineHeightNormal,
    marginBottom: spacing.md,
  },
  keyPoints: {
    marginBottom: spacing.md,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  keyPointText: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
    marginLeft: spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkText: {
    color: colors.accent,
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightMedium,
    marginRight: spacing.xs,
  },
});
