import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useWheel } from '../hooks/useWheel';
import { useAuthStore } from '../store/authStore';
import { colors, fonts, radius, spacing } from '../theme';

const SHOW_DELAY_MS = 1200;

function seenKey(userId: string, milestone: number) {
  return `albasse_wheel_popup_seen_${userId}_${milestone}`;
}

export function WheelPopup() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { canSpinMilestone, deliveredCount, isLoading } = useWheel();

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile || isLoading || !canSpinMilestone) return;
    let cancelled = false;
    const milestone = Math.floor(deliveredCount / 5);

    AsyncStorage.getItem(seenKey(profile.id, milestone)).then((seen) => {
      if (cancelled || seen) return;
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    });

    return () => {
      cancelled = true;
    };
  }, [profile?.id, canSpinMilestone, deliveredCount, isLoading]);

  if (!profile || !canSpinMilestone) return null;

  const milestone = Math.floor(deliveredCount / 5);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(seenKey(profile.id, milestone), '1');
  };

  const play = async () => {
    await dismiss();
    navigation.navigate('Wheel');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={10}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          <Text style={styles.icon}>🎡</Text>
          <Text style={styles.title}>Un tour de roue vous attend !</Text>
          <Text style={styles.message}>
            Merci pour votre fidélité — vous avez débloqué un tour de la roue de la chance. Tentez de
            gagner un cadeau dès maintenant !
          </Text>

          <Pressable style={styles.primaryBtn} onPress={play}>
            <Text style={styles.primaryBtnText}>🎉 Jouer maintenant</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={dismiss}>
            <Text style={styles.secondaryBtnText}>Plus tard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  closeIcon: { color: colors.creamFaint, fontSize: 18 },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18, marginBottom: spacing.sm, textAlign: 'center' },
  message: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  secondaryBtn: { marginTop: spacing.sm, paddingVertical: 8 },
  secondaryBtnText: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
