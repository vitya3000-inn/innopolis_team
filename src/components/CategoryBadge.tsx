import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Category } from '../types';
import { typography, spacing, borderRadius, categoryLabels } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface CategoryBadgeProps {
  category: Category;
  size?: 'small' | 'medium';
}

export default function CategoryBadge({ category, size = 'small' }: CategoryBadgeProps) {
  const { colors, categoryColors } = useTheme();
  const styles = useMemo(() => createStyles(), []);

  const color = categoryColors[category] || colors.accent;
  const label = categoryLabels[category] || category;

  return (
    <View
      style={[styles.badge, size === 'medium' && styles.badgeMedium, { backgroundColor: `${color}20` }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, size === 'medium' && styles.labelMedium, { color }]}>{label}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
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
}
