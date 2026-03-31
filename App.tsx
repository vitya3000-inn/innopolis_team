import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Импорт экранов
import FeedScreen from './src/screens/FeedScreen';
import TopicScreen from './src/screens/TopicScreen';
import EventScreen from './src/screens/EventScreen';

// Типы для навигации
export type RootStackParamList = {
  Feed: undefined;
  Topic: { topicId: string; topicTitle: string; topicCategory: 'politics' | 'economics' | 'technology' | 'society' | 'environment' | 'health' | 'world' };
  Event: { eventId: string; eventTitle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // Корневой навигационный контейнер приложения.
  // Здесь задается основной UX-поток: Feed -> Topic -> Event.
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Feed"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0F' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Topic" component={TopicScreen} />
        <Stack.Screen name="Event" component={EventScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
