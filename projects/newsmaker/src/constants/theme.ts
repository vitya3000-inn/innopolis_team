// Цветовая палитра приложения
export const colors = {
  // Основные цвета
  background: '#0A0A0F',
  backgroundSecondary: '#12121A',
  backgroundTertiary: '#1A1A24',
  
  // Текст
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#6B6B7B',
  
  // Акценты
  accent: '#6366F1',
  accentLight: '#818CF8',
  accentDark: '#4F46E5',
  
  // Статусы
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',
  warning: '#F59E0B',
  
  // Категории
  categoryPolitics: '#EF4444',
  categoryEconomics: '#10B981',
  categoryTechnology: '#6366F1',
  categorySociety: '#F59E0B',
  categoryEnvironment: '#06B6D4',
  categoryHealth: '#EC4899',
  categoryWorld: '#8B5CF6',
  
  // Границы и разделители
  border: '#2A2A35',
  borderLight: '#3A3A45',
  
  // Карточки
  cardBackground: '#15151F',
  cardBackgroundHover: '#1D1D28',
  
  // Градиенты
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
};

// Типографика
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

// Отступы
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Скругления
export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

// Тени (для iOS)
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Маппинг категорий на цвета
export const categoryColors: Record<string, string> = {
  politics: colors.categoryPolitics,
  economics: colors.categoryEconomics,
  technology: colors.categoryTechnology,
  society: colors.categorySociety,
  environment: colors.categoryEnvironment,
  health: colors.categoryHealth,
  world: colors.categoryWorld,
};

// Маппинг категорий на русские названия
export const categoryLabels: Record<string, string> = {
  politics: 'Политика',
  economics: 'Экономика',
  technology: 'Технологии',
  society: 'Общество',
  environment: 'Экология',
  health: 'Здоровье',
  world: 'В мире',
};

// Маппинг позиций на цвета
export const stanceColors: Record<string, string> = {
  positive: colors.positive,
  neutral: colors.neutral,
  negative: colors.negative,
  critical: colors.warning,
};

// Маппинг позиций на русские названия
export const stanceLabels: Record<string, string> = {
  positive: 'Позитивно',
  neutral: 'Нейтрально',
  negative: 'Негативно',
  critical: 'Критично',
};
