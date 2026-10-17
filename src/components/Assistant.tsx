import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../theme';
import { navigationRef } from '../navigation/navigationRef';
import { useAssistantStore } from '../store/assistantStore';
import { useAuthStore } from '../store/authStore';
import { firstNameOfFullName } from '../lib/assistantBrain';
import { texts } from '../lib/assistantText';
import { AssistantPanel } from './AssistantPanel';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const TEASER_DELAY_MS = 5000;
const TEASER_DURATION_MS = 10000;
const TEASER_SEEN_KEY = 'albasse_assistant_teaser_seen';
const SIZE = 62;
const PRODUCT_BAR_LIFT = 62;

// Nom de l'ecran affiche : le bouton est cache sur les pages d'administration (il couvrait les chiffres).
function useCurrentRouteName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setName(navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? null) : null);
    update();
    const unsubscribe = navigationRef.addListener('state', update);
    const wait = setInterval(() => {
      if (navigationRef.isReady()) {
        update();
        clearInterval(wait);
      }
    }, 150);
    return () => {
      unsubscribe();
      clearInterval(wait);
    };
  }, []);
  return name;
}

function teaserAlreadySeen() {
  if (Platform.OS !== 'web') return false;
  try {
    return window.sessionStorage.getItem(TEASER_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

// Bouton rond avec le visage de Zara Kings (remplace l'ancien bouton WhatsApp), une bulle de
// bienvenue une seule fois par visite, et la fenetre de chat.
export function Assistant() {
  const open = useAssistantStore((s) => s.open);
  const openChat = useAssistantStore((s) => s.openChat);
  const teaserDismissed = useAssistantStore((s) => s.teaserDismissed);
  const dismissTeaser = useAssistantStore((s) => s.dismissTeaser);
  const savedName = useAssistantStore((s) => s.name);
  const lang = useAssistantStore((s) => s.lang);
  const profileName = useAuthStore((s) => s.profile?.full_name);
  const name = firstNameOfFullName(profileName) ?? savedName;
  const routeName = useCurrentRouteName();
  const [teaserVisible, setTeaserVisible] = useState(false);
  const t = texts(lang);
  const rtl = lang === 'ar';
  const teaserRef = useRef<View>(null);

  // Le traducteur automatique de Google ne doit pas traduire la bulle : elle suit déjà la langue de Zara.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = teaserRef.current as unknown as HTMLElement | null;
    if (!el?.setAttribute) return;
    el.setAttribute('translate', 'no');
    el.classList.add('notranslate');
  });

  useEffect(() => {
    if (open || teaserDismissed || teaserAlreadySeen()) return;
    const show = setTimeout(() => {
      setTeaserVisible(true);
      if (Platform.OS === 'web') {
        try {
          window.sessionStorage.setItem(TEASER_SEEN_KEY, '1');
        } catch {
          // ignore : la bulle pourra revenir a la prochaine visite
        }
      }
    }, TEASER_DELAY_MS);
    const hide = setTimeout(() => setTeaserVisible(false), TEASER_DELAY_MS + TEASER_DURATION_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [open, teaserDismissed]);

  if (routeName?.startsWith('Admin')) return null;

  const showTeaser = teaserVisible && !open && !teaserDismissed;
  // Sur la fiche produit, la barre « Commander / Ajouter au panier » est haute : le bouton passe au-dessus.
  const lift = routeName === 'Product' ? PRODUCT_BAR_LIFT : 0;

  return (
    <>
      {open ? <AssistantPanel /> : null}
      {!open ? (
        <>
          {showTeaser ? (
            <Pressable ref={teaserRef} style={[styles.teaser, { bottom: 92 + lift }]} onPress={openChat} accessibilityRole="button" accessibilityLabel={t.openLabel}>
              <Text style={[styles.teaserText, rtl && styles.teaserTextRtl]}>{t.teaser(name)}</Text>
              <Pressable onPress={dismissTeaser} hitSlop={10} style={styles.teaserClose} accessibilityRole="button" accessibilityLabel={t.ui.closeTeaser}>
                <Text style={styles.teaserCloseText}>✕</Text>
              </Pressable>
            </Pressable>
          ) : null}
          <Pressable style={[styles.fab, { bottom: 82 + lift }]} onPress={openChat} accessibilityRole="button" accessibilityLabel={t.fabLabel} testID="assistant-fab">
            <Image source={AVATAR} style={styles.avatar} contentFit="cover" />
            <View style={styles.dot} />
          </Pressable>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 14,
    bottom: 82,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    padding: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
    zIndex: 900,
  },
  avatar: { width: '100%', height: '100%', borderRadius: SIZE / 2 },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3ddc84',
    borderWidth: 2.5,
    borderColor: colors.background,
  },
  teaser: {
    position: 'absolute',
    right: 14 + SIZE + 8,
    bottom: 92,
    maxWidth: 250,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 900,
  },
  teaserText: { flex: 1, color: '#1b1405', fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  teaserTextRtl: { writingDirection: 'rtl', textAlign: 'right' },
  teaserClose: { paddingHorizontal: 4, paddingVertical: 1 },
  teaserCloseText: { color: 'rgba(27,20,5,0.55)', fontSize: 12 },
});
