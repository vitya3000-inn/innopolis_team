import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../constants/theme';
import { getEventsByTopicId, getTopicById } from '../data/mockData';
import { Header, EventCard, CategoryBadge } from '../components';

type TopicScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Topic'>;
type TopicScreenRouteProp = RouteProp<RootStackParamList, 'Topic'>;

interface TopicScreenProps {
  navigation: TopicScreenNavigationProp;
  route: TopicScreenRouteProp;
}

export default function TopicScreen({ navigation, route }: TopicScreenProps) {
  const { topicId, topicTitle } = route.params;
  
  const topic = getTopicById(topicId);
  const events = getEventsByTopicId(topicId);

  // Сортируем: breaking сначала, потом по времени
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isBreaking && !b.isBreaking) return -1;
    if (!a.isBreaking && b.isBreaking) return 1;
    return 0;
  });

  const handleEventPress = (eventId: string, eventTitle: string) => {
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
        {topic && (
          <View style={styles.categoryContainer}>
            <CategoryBadge category={topic.category} size="medium" />
          </View>
        )}

        {/* Список событий */}
        <View style={styles.eventsList}>
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
});
