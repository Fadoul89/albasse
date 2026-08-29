import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../theme';
import { GoldButton } from '../../components/GoldButton';
import { ChadFlag } from '../../components/ChadFlag';

const CHAD_BLUE = '#0033A0';
const CHAD_YELLOW = '#FECB00';
const CHAD_RED = '#D21034';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CYCLE_MS = 12000;

export function AuthGateScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cycle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cycle, {
          toValue: 1,
          duration: CYCLE_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(cycle, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cycle]);

  const frameLiftY = cycle.interpolate({
    inputRange: [0, 0.15, 0.22, 0.8, 0.87, 1],
    outputRange: [0, 0, -60, -60, 0, 0],
  });
  const roadOpacity = cycle.interpolate({
    inputRange: [0, 0.17, 0.19, 0.81, 0.83, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const scooterX = cycle.interpolate({
    inputRange: [0, 0.14, 0.19, 0.81, 0.86, 1],
    outputRange: [SCREEN_WIDTH * 1.3, SCREEN_WIDTH * 1.3, SCREEN_WIDTH * 1.15, -SCREEN_WIDTH * 1.15, -SCREEN_WIDTH * 1.3, -SCREEN_WIDTH * 1.3],
  });
  const scooterOpacity = cycle.interpolate({
    inputRange: [0, 0.14, 0.19, 0.81, 0.86, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });

  return (
    <LinearGradient colors={[colors.panelAlt, colors.background]} style={styles.screen}>
      <View style={styles.content}>
        <View style={{ marginBottom: spacing.sm }}>
          <ChadFlag width={36} height={24} />
        </View>
        <Text style={styles.brand}>ALBASSE</Text>
        <Text style={styles.brandSub}>SHOPPING</Text>

        <View style={styles.lockFrame}>
          <Text style={styles.lockIcon}>🔐</Text>
        </View>

        <Text style={styles.title}>Créez votre compte pour accéder à notre boutique</Text>
        <Text style={styles.subtitle}>
          Rejoignez Albasse Shopping pour découvrir nos costumes, chemises, montres et bien plus.
        </Text>

        <View style={styles.promoZone}>
          <Animated.View style={[styles.promoFrame, { transform: [{ translateY: frameLiftY }] }]}>
            <Text style={[styles.taglineWord, { color: CHAD_BLUE }]}>SERVICE</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={[styles.taglineWord, { color: CHAD_YELLOW }]}>QUALITÉ</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={[styles.taglineWord, { color: CHAD_RED }]}>GARANTIE</Text>
          </Animated.View>
          <View style={styles.trackClip}>
            <Animated.View style={[styles.road, { opacity: roadOpacity }]} />
            <Animated.Image
              source={require('../../../assets/delivery-moto.png')}
              resizeMode="contain"
              style={[
                styles.scooter,
                { opacity: scooterOpacity, transform: [{ translateX: scooterX }] },
              ]}
            />
          </View>
        </View>

        <GoldButton
          label="Créer mon compte"
          onPress={() => navigation.navigate('Register')}
          style={{ marginTop: spacing.xl, width: '100%' }}
        />
        <GoldButton
          label="J'ai déjà un compte — Se connecter"
          variant="outline"
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.sm, width: '100%' }}
        />
        <Pressable onPress={() => navigation.navigate('AffiliateApply')} style={{ marginTop: spacing.lg }}>
          <Text style={styles.affiliateLink}>🤝 Devenir affilié</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  affiliateLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  brand: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.goldLight, letterSpacing: 4 },
  brandSub: { fontFamily: fonts.body, fontSize: 13, color: colors.cream, letterSpacing: 8, marginTop: 2, marginBottom: spacing.xl },
  lockFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  lockIcon: { fontSize: 30 },
  title: {
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 19,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },
  promoZone: {
    width: '100%',
    height: 140,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trackClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    overflow: 'hidden',
  },
  promoFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  taglineWord: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  dot: { color: colors.creamFaint, fontSize: 12 },
  road: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  scooter: {
    position: 'absolute',
    bottom: 0,
    width: 90,
    height: 60,
  },
});
