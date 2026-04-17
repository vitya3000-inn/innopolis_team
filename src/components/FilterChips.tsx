import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Category } from '../types';
import { typography, spacing, borderRadius, categoryLabels, type ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface FilterChipsProps {
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
  onResetCategories: () => void;
}

const allCategories: Category[] = ['politics', 'economics', 'technology'];

export default function FilterChips({
  selectedCategories,
  onToggleCategory,
  onResetCategories,
}: FilterChipsProps) {
  const { colors, categoryColors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSelected = (category: Category) => selectedCategories.includes(category);
  const isAllSelected = selectedCategories.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[styles.chip, isAllSelected && styles.chipSelected]}
          onPress={onResetCategories}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, isAllSelected && styles.chipTextSelected]}>Все</Text>
        </TouchableOpacity>

        {allCategories.map((category) => {
          const selected = isSelected(category);
          const color = categoryColors[category];
          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, selected && { backgroundColor: `${color}20`, borderColor: color }]}
              onPress={() => onToggleCategory(category)}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.chipText, selected && { color }]}>{categoryLabels[category]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: spacing.xs,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeSM,
      fontWeight: typography.fontWeightMedium,
    },
    chipTextSelected: {
      color: colors.accent,
    },
  });
}
