import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useWheel } from '../hooks/useWheel';
import { useToastStore } from '../store/toastStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { colors, fonts, radius, spacing } from '../theme';

const WHEEL_SIZE = 280;
const RADIUS = WHEEL_SIZE / 2 - 30;

export function WheelScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { prizes, deliveredCount, ordersUntilNextSpin, isLoading, spin } = useWheel();
  const showToast = useToastStore((s) => s.show);
  const rotation = useRef(new Animated.Value(0)).current;
  const currentRotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; icon: string; isLose: boolean } | null>(null);

  if (!profile) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Roue de la chance" showBack />
        <Text style={styles.denied}>Connectez-vous pour jouer.</Text>
      </View>
    );
  }

  const segmentAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);

    const res = await spin();
    if ('error' in res) {
      setSpinning(false);
      showToast(res.error, { title: 'Pas de tour disponible', type: 'error' });
      return;
    }

    const winIndex = prizes.findIndex((p) => p.label === res.label);
    const targetSegment = winIndex >= 0 ? winIndex : 0;
    const segmentCenter = targetSegment * segmentAngle + segmentAngle / 2;
    const spins = 5 * 360;
    const target = currentRotationRef.current + spins + (360 - segmentCenter) - (currentRotationRef.current % 360);

    Animated.timing(rotation, {
      toValue: target,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      currentRotationRef.current = target;
      setSpinning(false);
      setResult(res);
      showToast(
        res.isLose ? 'Pas de chance cette fois, retentez la semaine prochaine !' : `Vous avez gagné : ${res.label} ${res.icon}`,
        { title: res.isLose ? '😔 Perdu' : '🎉 Gagné !', type: res.isLose ? 'error' : 'success' }
      );
    });
  };

  const spin_deg = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.screen}>
      <ScreenHeader title="🎡 Roue de la chance" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Un tour garanti tous les 5 commandes livrées ! Palier 10, 20, 30... : un lot premium assuré.
        </Text>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>📦 Commandes livrées</Text>
          <Text style={styles.progressValue}>{deliveredCount}</Text>
          {ordersUntilNextSpin > 0 ? (
            <Text style={styles.progressHint}>
              Encore {ordersUntilNextSpin} commande(s) livrée(s) pour votre prochain tour garanti.
            </Text>
          ) : (
            <Text style={styles.progressHintReady}>🎉 Un tour garanti est disponible !</Text>
          )}
        </View>

        <View style={styles.wheelWrap}>
          <View style={styles.pointer} />
          <Animated.View style={[styles.wheel, { transform: [{ rotate: spin_deg }] }]}>
            {prizes.map((p, i) => {
              const angle = i * segmentAngle;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.segment,
                    {
                      transform: [{ rotate: `${angle}deg` }, { translateY: -RADIUS }],
                    },
                  ]}
                >
                  <Text style={styles.segmentIcon}>{p.icon}</Text>
                </View>
              );
            })}
          </Animated.View>
        </View>

        <GoldButton
          label={spinning ? 'Ça tourne...' : '🎲 Tourner la roue'}
          onPress={handleSpin}
          loading={spinning || isLoading}
          style={{ marginTop: spacing.xl, width: '100%' }}
        />

        {result && !spinning && (
          <View style={[styles.resultBox, result.isLose && styles.resultBoxLose]}>
            <Text style={styles.resultIcon}>{result.icon}</Text>
            <Text style={styles.resultText}>{result.isLose ? 'Pas de chance cette fois !' : `Bravo, vous avez gagné : ${result.label}`}</Text>
            {!result.isLose && (
              <Text style={styles.resultHint}>Notre équipe vous contactera pour organiser la remise de votre lot.</Text>
            )}
          </View>
        )}

        <Text style={styles.rulesTitle}>📜 Règles</Text>
        <Text style={styles.rulesText}>
          • Un tour garanti à chaque palier de 5 commandes livrées (5, 10, 15...).{'\n'}
          • Au palier 10, 20, 30... vous êtes assuré de gagner le lot premium.{'\n'}
          • Si vous n'avez pas encore de palier disponible, un tour de consolation est offert une fois par semaine.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md, paddingBottom: 60, alignItems: 'center' },
  subtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginBottom: spacing.md, lineHeight: 17 },
  progressCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xl,
  },
  progressLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  progressValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 30, marginTop: 4 },
  progressHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 6, textAlign: 'center' },
  progressHintReady: { color: '#3ddc6f', fontFamily: fonts.bodySemiBold, fontSize: 12, marginTop: 6, textAlign: 'center' },
  wheelWrap: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center' },
  pointer: {
    position: 'absolute',
    top: -6,
    zIndex: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.red,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: colors.panel,
    borderWidth: 4,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentIcon: { fontSize: 22 },
  resultBox: {
    backgroundColor: 'rgba(61,220,111,0.12)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#3ddc6f',
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.lg,
  },
  resultBoxLose: { backgroundColor: 'rgba(216,35,42,0.1)', borderColor: colors.red },
  resultIcon: { fontSize: 36, marginBottom: 6 },
  resultText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, textAlign: 'center' },
  resultHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 6 },
  rulesTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 15, marginTop: spacing.xl, alignSelf: 'flex-start' },
  rulesText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 18, marginTop: spacing.sm, alignSelf: 'flex-start' },
});
