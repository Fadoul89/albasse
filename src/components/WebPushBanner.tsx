import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { isWebPushSupported, hasWebPushPermission, subscribeToWebPush } from '../lib/webPushSubscription';

const DISMISS_KEY = 'albasse_push_banner_dismissed';

function isDismissed(): Promise<boolean> {
  return AsyncStorage.getItem(DISMISS_KEY).then((v) => v === '1');
}

// Visite directe = referrer absent ou domaine externe (lien partage WhatsApp / réseaux sociaux)
function isExternalArrival(): boolean {
  if (typeof document === 'undefined') return false;
  const ref = document.referrer;
  if (!ref) return true;
  try {
    return !new URL(ref).hostname.includes('albasseshopping.com');
  } catch {
    return true;
  }
}

interface Props {
  style?: object;
}

export function WebPushBanner({ style }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isWebPushSupported()) return;
    if (hasWebPushPermission()) return;
    if (!isExternalArrival()) return;

    isDismissed().then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, '1');
  };

  const subscribe = async () => {
    const ok = await subscribeToWebPush();
    if (ok) {
      setVisible(false);
    } else {
      dismiss();
    }
  };

  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.icon}>🔔</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={2}>
          Recevoir les alertes ventes flash et nouveaux produits
        </Text>
      </View>
      <Pressable style={styles.subscribeBtn} onPress={subscribe}>
        <Text style={styles.subscribeBtnText}>Activer</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#0d2b2b',
    borderBottomWidth: 2,
    borderBottomColor: '#00BFA5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  icon: { fontSize: 20 },
  text: { color: '#e0f7f4', fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  subscribeBtn: {
    backgroundColor: '#00BFA5',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  subscribeBtnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#80CBC4', fontSize: 16 },
});
