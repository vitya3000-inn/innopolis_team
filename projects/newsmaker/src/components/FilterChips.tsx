import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Category } from '../types';
import { colors, typography, spacing, borderRadius, categoryColors, categoryLabels } from '../constants/theme';

interface FilterChipsProps {
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;
}

const allCategories: Category[] = [
  'politics',
  'economics',
  'technology',
  'society',
  'environment',
  'health',
  'world',
];

export default function FilterChips({ selectedCategories, onToggleCategory }: FilterChipsProps) {
  const isSelected = (category: Category) => selectedCategories.includes(category);
  const isAllSelected = selectedCategories.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Кнопка "Все" */}
        <TouchableOpacity
          style={[styles.chip, isAllSelected && styles.chipSelected]}
          onPress={() => onToggleCategory('politics')}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, isAllSelected && styles.chipTextSelected]}>
            Все
          </Text>
        </TouchableOpacity>

        {/* Категории */}
        {allCategories.map((category) => {
          const selected = isSelected(category);
          const color = categoryColors[category];
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.chip,
                selected && { backgroundColor: `${color}20`, borderColor: color },
              ]}
              onPress={() => onToggleCategory(category)}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text
                style={[
                  styles.chipText,
                  selected && { color },
                ]}
              >
                {categoryLabels[category]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
