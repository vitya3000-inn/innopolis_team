import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../constants/theme';
import { getEventsByTopicId } from '../data/mockData';
import { Header, EventCard, CategoryBadge } from '../components';
import { fetchTopicEvents } from '../services/newsApi';
import { Event } from '../types';

type TopicScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Topic'>;
type TopicScreenRouteProp = RouteProp<RootStackParamList, 'Topic'>;

interface TopicScreenProps {
  navigation: TopicScreenNavigationProp;
  route: TopicScreenRouteProp;
}

export default function TopicScreen({ navigation, route }: TopicScreenProps) {
  // Параметры приходят из карточки темы на FeedScreen.
  const { topicId, topicTitle, topicCategory } = route.params;
  
  // На текущем этапе данные берутся из mock-слоя.
  // Позже здесь может быть запрос GET /topics/:id/events.
  const [events, setEvents] = useState<Event[]>(getEventsByTopicId(topicId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const remoteEvents = await fetchTopicEvents(topicId);
        if (remoteEvents.length > 0) {
          setEvents(remoteEvents);
          setError(null);
        } else {
          setError('Для этой темы пока нет событий с backend.');
        }
      } catch (_error) {
        setError('Не удалось получить события, показаны локальные данные.');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, [topicId]);

  // Сортируем: breaking сначала, потом по времени
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isBreaking && !b.isBreaking) return -1;
    if (!a.isBreaking && b.isBreaking) return 1;
    return 0;
  });

  const handleEventPress = (eventId: string, eventTitle: string) => {
    // Переход в экран конкретного события.
    navigation.navigate('Event', { eventId, eventTitle });
  };

  return (
    <View style={styles.container}>
      <Header
        title={topicTitle}
        subtitle={`${events.length} событий`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Категория темы */}
        <View style={styles.categoryContainer}>
          <CategoryBadge category={topicCategory} size="medium" />
        </View>

        {/* Список событий */}
        <View style={styles.eventsList}>
          {loading && <Text style={styles.statusText}>Загрузка событий...</Text>}
          {error && <Text style={styles.statusText}>{error}</Text>}
          {sortedEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => handleEventPress(event.id, event.title)}
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
  categoryContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  eventsList: {
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
