import React, { useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import FeedScreen from './src/screens/FeedScreen';
import TopicScreen from './src/screens/TopicScreen';
import EventScreen from './src/screens/EventScreen';
import AccountScreen from './src/screens/AccountScreen';
import AdminScreen from './src/screens/AdminScreen';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

// Типы для навигации основного приложения
export type RootStackParamList = {
  Feed: undefined;
  Topic: {
    topicId: string;
    topicTitle: string;
    topicCategory: 'politics' | 'economics' | 'technology' | 'society' | 'environment' | 'health' | 'world';
    /** YYYY-MM-DD UTC: лента из Supabase за этот день (последний прогон). */
    archiveDateUtc?: string;
  };
  Event: { eventId: string; eventTitle: string; archiveDateUtc?: string };
  /** Личный кабинет (только при входе через Supabase). */
  Account: undefined;
  /** Админ: обновление ленты на backend (только для адресов из списка админов). */
  Admin: undefined;
};

export type AuthStackParamList = {
  Auth: undefined;
};

const MainStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function MainNavigator() {
  const { colors } = useTheme();
  return (
    <MainStack.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <MainStack.Screen name="Feed" component={FeedScreen} />
      <MainStack.Screen name="Topic" component={TopicScreen} />
      <MainStack.Screen name="Event" component={EventScreen} />
      <MainStack.Screen name="Account" component={AccountScreen} />
      <MainStack.Screen name="Admin" component={AdminScreen} />
    </MainStack.Navigator>
  );
}

function AuthNavigator() {
  const { colors } = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <AuthStack.Screen name="Auth" component={AuthScreen} />
    </AuthStack.Navigator>
  );
}

function RootNavigator() {
  const { session, loading, authConfigured } = useAuth();
  const { colors, mode } = useTheme();

  const navTheme = useMemo<NavTheme>(
    () => ({
      dark: mode === 'dark',
      colors: {
        primary: colors.accent,
        background: colors.background,
        card: colors.cardBackground,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [colors, mode],
  );

  if (authConfigured && loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const useMainApp = !authConfigured || session != null;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {useMainApp ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
