import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Category } from '../types';
import { colors, spacing } from '../constants/theme';
import { mockTopics } from '../data/mockData';
import { Header, TopicCard, FilterChips } from '../components';
import { fetchTopics } from '../services/newsApi';
import { Topic } from '../types';

type FeedScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

interface FeedScreenProps {
  navigation: FeedScreenNavigationProp;
}

export default function FeedScreen({ navigation }: FeedScreenProps) {
  // Локальное UI-состояние экрана.
  // refreshing — индикатор pull-to-refresh, selectedCategories — выбранные фильтры.
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>(mockTopics);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Фильтруем темы
  const filteredTopics = selectedCategories.length === 0
    ? topics
    : topics.filter(topic => selectedCategories.includes(topic.category));

  // Сортируем: trending сначала, потом по количеству упоминаний
  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.trending && !b.trending) return -1;
    if (!a.trending && b.trending) return 1;
    return b.mentionsCount - a.mentionsCount;
  });

  const loadTopics = async () => {
    try {
      const remoteTopics = await fetchTopics();
      if (remoteTopics.length > 0) {
        setTopics(remoteTopics);
        setLoadError(null);
      } else {
        setLoadError('Данные пока не готовы, показаны локальные заглушки.');
      }
    } catch (_error) {
      setLoadError('Не удалось получить данные с backend, показаны локальные заглушки.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleRefresh = async () => {
    // Пока используется мок-обновление.
    // При подключении backend здесь будет запрос к API.
    setRefreshing(true);
    await loadTopics();
    setRefreshing(false);
  };

  const handleToggleCategory = (category: Category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  const handleResetCategories = () => {
    setSelectedCategories([]);
  };

  const handleTopicPress = (topicId: string, topicTitle: string, topicCategory: Category) => {
    // Переход в детали выбранной темы.
    navigation.navigate('Topic', { topicId, topicTitle, topicCategory });
  };

  return (
    <View style={styles.container}>
      <Header
        title="NewsMap"
        subtitle="Главные события сегодня"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Фильтры по категориям */}
        <FilterChips
          selectedCategories={selectedCategories}
          onToggleCategory={handleToggleCategory}
          onResetCategories={handleResetCategories}
        />

        {isLoading && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Загрузка тем...</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{loadError}</Text>
          </View>
        )}

        {/* Список тем */}
        <View style={styles.topicsList}>
          {sortedTopics.map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onPress={() => handleTopicPress(topic.id, topic.title, topic.category)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topicsList: {
    paddingHorizontal: spacing.lg,
  },
  statusBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    color: colors.textMuted,
  },
});
