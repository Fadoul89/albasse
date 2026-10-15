import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const SITE_URL = 'https://www.albasseshopping.com/?albasse_app=1';
const SITE_HOST = 'albasseshopping.com';
// Ajoute une marque dans le user-agent pour que le site sache qu'il tourne
// dans l'app (et n'affiche pas sa propre bannière "Telechargez l'app").
const APP_USER_AGENT_SUFFIX = ' AlbasseShoppingApp/1.0';

export default function HomeScreen() {
  const webviewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (canGoBack) {
          webviewRef.current?.goBack();
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [canGoBack])
  );

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  // Les liens vers un autre site (WhatsApp, Telegram, Mobile Money...) ou un
  // schema non-web (tel:, mailto:) s'ouvrent dans une app externe plutot que
  // dans la WebView.
  const handleShouldStartLoad = (request: { url: string }) => {
    try {
      const url = new URL(request.url);
      const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
      if (isHttp && url.hostname.endsWith(SITE_HOST)) return true;
      Linking.openURL(request.url).catch(() => {});
      return false;
    } catch {
      return true;
    }
  };

  return (
    <View style={styles.screen}>
      <WebView
        ref={webviewRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        applicationNameForUserAgent={APP_USER_AGENT_SUFFIX}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadEnd={() => setLoading(false)}
        decelerationRate="normal"
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        domStorageEnabled
        startInLoadingState={false}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#d4af37" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0c0c0f' },
  webview: { flex: 1, backgroundColor: '#0c0c0f' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0c0f',
  },
});
