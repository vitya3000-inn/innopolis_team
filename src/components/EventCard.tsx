import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Event } from '../types';
import { typography, spacing, borderRadius, type ThemeColors, getShadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

type AppShadows = ReturnType<typeof getShadows>;

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const topSources = event.sources.slice(0, 5);
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {event.isBreaking && (
        <View style={styles.breakingBadge}>
          <Ionicons name="flash" size={12} color="#FFF" />
          <Text style={styles.breakingText}>Срочно</Text>
        </View>
      )}

      <Text style={styles.title}>{event.title}</Text>

      <Text style={styles.summary} numberOfLines={3}>
        {event.summary}
      </Text>

      <View style={styles.facts}>
        {event.keyFacts.slice(0, 2).map((fact, index) => (
          <View key={index} style={styles.factItem}>
            <View style={styles.factDot} />
            <Text style={styles.factText} numberOfLines={1}>
              {fact}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.sourcesInfo}>
          <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
          <Text style={styles.sourcesText}>{event.sources.length} источников</Text>
        </View>
        <View style={styles.opinionsInfo}>
          <Ionicons name="git-compare-outline" size={14} color={colors.accent} />
          <Text style={styles.opinionsText}>{event.opinions.length} мнений</Text>
        </View>
        <Text style={styles.timestamp}>{event.timestamp}</Text>
      </View>

      <View style={styles.sourceIconsRow}>
        {topSources.map((source) => (
          <View key={source.id} style={styles.sourceIcon} accessibilityLabel={source.name}>
            <Text style={styles.sourceIconText}>{source.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        ))}
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
    breakingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.negative,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      alignSelf: 'flex-start',
      marginBottom: spacing.sm,
    },
    breakingText: {
      color: '#FFF',
      fontSize: typography.fontSizeXS,
      fontWeight: typography.fontWeightBold,
      marginLeft: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeLG,
      fontWeight: typography.fontWeightBold,
      marginBottom: spacing.sm,
      lineHeight: typography.fontSizeLG * typography.lineHeightTight,
      paddingRight: spacing.xl,
    },
    summary: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeMD,
      lineHeight: typography.fontSizeMD * typography.lineHeightNormal,
      marginBottom: spacing.md,
    },
    facts: {
      marginBottom: spacing.md,
    },
    factItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    factDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
      marginRight: spacing.sm,
    },
    factText: {
      color: colors.textSecondary,
      fontSize: typography.fontSizeSM,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sourcesInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sourcesText: {
      color: colors.textMuted,
      fontSize: typography.fontSizeXS,
      marginLeft: spacing.xs,
    },
    opinionsInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: spacing.md,
    },
    opinionsText: {
      color: colors.accent,
      fontSize: typography.fontSizeXS,
      marginLeft: spacing.xs,
      fontWeight: typography.fontWeightMedium,
    },
    timestamp: {
      color: colors.textMuted,
      fontSize: typography.fontSizeXS,
      marginLeft: 'auto',
    },
    arrow: {
      position: 'absolute',
      right: spacing.lg,
      top: spacing.lg,
    },
    sourceIconsRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    sourceIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    sourceIconText: {
      color: colors.textSecondary,
      fontSize: 9,
      fontWeight: typography.fontWeightBold,
    },
  });
}
