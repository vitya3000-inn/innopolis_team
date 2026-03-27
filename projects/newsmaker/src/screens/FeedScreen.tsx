import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Category } from '../types';
import { colors, spacing } from '../constants/theme';
import { mockTopics } from '../data/mockData';
import { Header, TopicCard, FilterChips } from '../components';

type FeedScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

interface FeedScreenProps {
  navigation: FeedScreenNavigationProp;
}

export default function FeedScreen({ navigation }: FeedScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);

  // Фильтруем темы
  const filteredTopics = selectedCategories.length === 0
    ? mockTopics
    : mockTopics.filter(topic => selectedCategories.includes(topic.category));

  // Сортируем: trending сначала, потом по количеству упоминаний
  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.trending && !b.trending) return -1;
    if (!a.trending && b.trending) return 1;
    return b.mentionsCount - a.mentionsCount;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    // Имитация загрузки данных
    await new Promise(resolve => setTimeout(resolve, 1500));
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

  const handleTopicPress = (topicId: string, topicTitle: string) => {
    navigation.navigate('Topic', { topicId, topicTitle });
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
        />

        {/* Список тем */}
        <View style={styles.topicsList}>
          {sortedTopics.map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onPress={() => handleTopicPress(topic.id, topic.title)}
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
});
