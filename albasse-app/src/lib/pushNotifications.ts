import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Meme projet Supabase que le site, cle publique "anon" (securite via RLS).
const SUPABASE_URL = 'https://xtitsmmccpkelxfjyqyh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXRzbW1jY3BrZWx4Zmp5cXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTA1NDQsImV4cCI6MjEwMTY2NjU0NH0.2WC2Q3Gp6A3GMe1HZdS7dhiMSg9xlTPiml11_-XQ6Zg';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function saveTokenToSupabase(token: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_push_tokens?on_conflict=expo_push_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ expo_push_token: token }),
    });
  } catch {
    // silencieux : l'enregistrement du token ne doit jamais bloquer l'app
  }
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Albasse Shopping',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#d4af37',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await saveTokenToSupabase(token);
  } catch {
    // silencieux
  }
}
