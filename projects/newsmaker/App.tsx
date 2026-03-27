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
  Topic: { topicId: string; topicTitle: string };
  Event: { eventId: string; eventTitle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
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
```

---

### 6. `.gitignore`
```
# Dependencies
node_modules/

# Expo
.expo/
dist/
web-build/

# Native builds
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# Debug
npm-debug.*
yarn-debug.*
yarn-error.*

# macOS
.DS_Store
*.pem

# Local env files
.env*.local
.env

# TypeScript
*.tsbuildinfo

# Testing
coverage/

# IDE
.idea/
.vscode/
*.swp
*.swo
