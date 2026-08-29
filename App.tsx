import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { colors, fonts } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { Toast } from './src/components/Toast';
import { initAnalyticsSession } from './src/lib/analytics';
import { initTikTokPixel } from './src/lib/tiktokPixel';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    [fonts.displayItalic]: Fraunces_500Medium_Italic,
    [fonts.display]: Fraunces_600SemiBold,
    [fonts.displayBold]: Fraunces_700Bold,
    [fonts.body]: Manrope_400Regular,
    [fonts.bodyMedium]: Manrope_500Medium,
    [fonts.bodySemiBold]: Manrope_600SemiBold,
    [fonts.bodyBold]: Manrope_700Bold,
  });

  const initAuth = useAuthStore((s) => s.init);
  const authLoading = useAuthStore((s) => s.isLoading);

  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      initAnalyticsSession(profile?.id ?? null);
    }
  }, [authLoading]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Albasse Shopping';
      initTikTokPixel();
    }
  }, []);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded && !authLoading) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authLoading]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded || authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.loadingText}>ALBASSE SHOPPING</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.app}>
          <RootNavigator />
          <Toast />
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.goldLight,
    marginTop: 16,
    letterSpacing: 3,
    fontSize: 13,
  },
});
