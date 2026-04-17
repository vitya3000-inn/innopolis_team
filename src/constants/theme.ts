/** Токены цветов UI (тёмная и светлая схемы). */
export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  positive: string;
  negative: string;
  neutral: string;
  warning: string;
  categoryPolitics: string;
  categoryEconomics: string;
  categoryTechnology: string;
  categorySociety: string;
  categoryEnvironment: string;
  categoryHealth: string;
  categoryWorld: string;
  border: string;
  borderLight: string;
  cardBackground: string;
  cardBackgroundHover: string;
  gradientStart: string;
  gradientEnd: string;
};

export const darkColors: ThemeColors = {
  background: '#0A0A0F',
  backgroundSecondary: '#12121A',
  backgroundTertiary: '#1A1A24',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#6B6B7B',
  accent: '#6366F1',
  accentLight: '#818CF8',
  accentDark: '#4F46E5',
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',
  warning: '#F59E0B',
  categoryPolitics: '#EF4444',
  categoryEconomics: '#10B981',
  categoryTechnology: '#6366F1',
  categorySociety: '#F59E0B',
  categoryEnvironment: '#06B6D4',
  categoryHealth: '#EC4899',
  categoryWorld: '#8B5CF6',
  border: '#2A2A35',
  borderLight: '#3A3A45',
  cardBackground: '#15151F',
  cardBackgroundHover: '#1D1D28',
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
};

export const lightColors: ThemeColors = {
  background: '#F4F4F9',
  backgroundSecondary: '#ECECF4',
  backgroundTertiary: '#E0E0EA',
  textPrimary: '#111118',
  textSecondary: '#4B4B5C',
  textMuted: '#71718A',
  accent: '#4F46E5',
  accentLight: '#6366F1',
  accentDark: '#4338CA',
  positive: '#059669',
  negative: '#DC2626',
  neutral: '#6B7280',
  warning: '#D97706',
  categoryPolitics: '#DC2626',
  categoryEconomics: '#059669',
  categoryTechnology: '#4F46E5',
  categorySociety: '#D97706',
  categoryEnvironment: '#0891B2',
  categoryHealth: '#DB2777',
  categoryWorld: '#7C3AED',
  border: '#D4D4E0',
  borderLight: '#C6C6D4',
  cardBackground: '#FFFFFF',
  cardBackgroundHover: '#F8F8FC',
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
};

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? lightColors : darkColors;
}

export function buildCategoryColors(c: ThemeColors): Record<string, string> {
  return {
    politics: c.categoryPolitics,
    economics: c.categoryEconomics,
    technology: c.categoryTechnology,
    society: c.categorySociety,
    environment: c.categoryEnvironment,
    health: c.categoryHealth,
    world: c.categoryWorld,
  };
}

export function buildStanceColors(c: ThemeColors): Record<string, string> {
  return {
    positive: c.positive,
    neutral: c.neutral,
    negative: c.negative,
    critical: c.warning,
  };
}

/** Совместимость: дефолт тёмная тема для типов/импортов без контекста. */
export const colors = darkColors;

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSizeXXL: 24,
  fontSizeHero: 32,

  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,

  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.7,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export function getShadows(mode: ThemeMode) {
  const shadowColor = mode === 'light' ? '#000000' : '#000000';
  const op = mode === 'light' ? 0.08 : 0.15;
  const op2 = mode === 'light' ? 0.1 : 0.2;
  const op3 = mode === 'light' ? 0.12 : 0.25;
  return {
    small: {
      shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: op,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: op2,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: op3,
      shadowRadius: 16,
      elevation: 8,
    },
  };
}

export const categoryLabels: Record<string, string> = {
  politics: 'Политика',
  economics: 'Экономика',
  technology: 'Технологии',
  society: 'Общество',
  environment: 'Экология',
  health: 'Здоровье',
  world: 'В мире',
};

export const stanceLabels: Record<string, string> = {
  positive: 'Позитивно',
  neutral: 'Нейтрально',
  negative: 'Негативно',
  critical: 'Критично',
};
