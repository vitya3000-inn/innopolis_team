import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Category } from '../types';
import { colors, typography, spacing, borderRadius, categoryColors, categoryLabels } from '../constants/theme';

interface CategoryBadgeProps {
  category: Category;
  size?: 'small' | 'medium';
}

export default function CategoryBadge({ category, size = 'small' }: CategoryBadgeProps) {
  // Цвет и подпись берутся из централизованного маппинга theme.ts.
  const color = categoryColors[category] || colors.accent;
  const label = categoryLabels[category] || category;

  return (
    <View style={[
      styles.badge,
      size === 'medium' && styles.badgeMedium,
      { backgroundColor: `${color}20` }
    ]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[
        styles.label,
        size === 'medium' && styles.labelMedium,
        { color }
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeMedium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelMedium: {
    fontSize: typography.fontSizeSM,
  },
});
