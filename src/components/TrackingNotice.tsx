import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { navigationRef } from '../navigation/navigationRef';
import { setTrackingChoice, subscribeBrowsing, trackingState } from '../lib/browsingTracker';
import { markNoticeSeen, noticeSeen } from '../lib/trackingConsent';

// Information discrète, une seule fois : la boutique retient les articles regardés pour mieux conseiller. Le visiteur peut refuser tout de
// suite. Elle apparaît après la première fiche produit regardée, jamais au chargement, et reste courte (rien de détaillé ni d'inquiétant).
export function TrackingNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const state = trackingState();
      setVisible(state.allowed && state.hasData && !noticeSeen());
    };
    check();
    return subscribeBrowsing(check);
  }, []);

  if (!visible) return null;

  const close = () => {
    markNoticeSeen();
    setVisible(false);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card} testID="tracking-notice">
        <Text style={styles.text}>
          🔒 Pour mieux vous conseiller, la boutique retient les articles que vous regardez (rien de personnel). Vous pouvez refuser à tout moment.
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.ok} onPress={close} accessibilityRole="button" testID="tracking-notice-ok">
            <Text style={styles.okText}>OK</Text>
          </Pressable>
          <Pressable
            style={styles.refuse}
            onPress={() => {
              setTrackingChoice('denied');
              close();
            }}
            accessibilityRole="button"
            testID="tracking-notice-refuse"
          >
            <Text style={styles.refuseText}>Refuser</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              close();
              if (navigationRef.isReady()) navigationRef.navigate('PrivacyPolicy' as never);
            }}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.link}>En savoir plus</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 226, alignItems: 'center', zIndex: 850, paddingHorizontal: spacing.md },
  card: {
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  ok: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 6 },
  okText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 12 },
  refuse: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  refuseText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 11, marginLeft: 'auto' },
});
