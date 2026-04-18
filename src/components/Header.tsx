import React, { useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, type ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Кнопки справа (например выход из аккаунта). */
  headerRight?: ReactNode;
}

export default function Header({ title, subtitle, showBack, onBack, headerRight }: HeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {showBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerRight != null ? <View style={styles.rightSlot}>{headerRight}</View> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, insetTop: number) {
  return StyleSheet.create({
    container: {
      paddingTop: insetTop + spacing.xxxl + spacing.lg,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: spacing.sm,
      marginLeft: -spacing.sm,
      padding: spacing.xs,
    },
    titleContainer: {
      flex: 1,
      minWidth: 0,
    },
    rightSlot: {
      marginLeft: spacing.sm,
      justifyContent: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.fontSizeXXL,
      fontWeight: typography.fontWeightBold,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: typography.fontSizeSM,
      marginTop: spacing.xs,
    },
  });
}
