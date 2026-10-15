import 'expo-observe';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    registerForPushNotificationsAsync();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0c0f' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0c0c0f' } }}>
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}
