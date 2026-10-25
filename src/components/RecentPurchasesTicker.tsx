import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { fetchRecentPurchases } from '../lib/recentPurchases';
import { purchaseText, type RecentPurchase } from '../lib/recentPurchasesText';

const SPEED_PX_PER_SEC = 55;
const BANNER_BLUE = '#2D5BFF';

const buildNoticeText = (items: RecentPurchase[]) => items.map((p) => purchaseText(p)).join('   •   ') + '   •   ';

// Bande défilante de vraies commandes récentes (ville + article). Cachée tant qu'il n'y en a pas : rien n'est inventé.
export function RecentPurchasesTicker() {
  const [items, setItems] = useState<RecentPurchase[]>([]);
  const noticeText = buildNoticeText(items);
  const [setWidth, setSetWidth] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  // le texte est répété assez de fois pour remplir toute la barre (même avec une seule commande), puis défile sans fin
  const copies = setWidth > 0 && trackWidth > 0 ? Math.ceil(trackWidth / setWidth) + 1 : 2;
  const translateX = useRef(new Animated.Value(0)).current;
  const measuredForWidth = useRef(0);

  useEffect(() => {
    let alive = true;
    fetchRecentPurchases().then((rows) => alive && setItems(rows));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (setWidth === 0) return;
    let stopped = false;

    const runLoop = () => {
      translateX.setValue(0);
      Animated.timing(translateX, {
        toValue: -setWidth,
        duration: (setWidth / SPEED_PX_PER_SEC) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !stopped) runLoop();
      });
    };

    runLoop();
    return () => {
      stopped = true;
    };
  }, [setWidth]);

  if (items.length === 0) return null;
  return (
    <View style={styles.wrapper} testID="recent-purchases">
      <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
          {Array.from({ length: copies }, (_, i) => (
            <Text
              key={i}
              style={styles.text}
              numberOfLines={1}
              onLayout={
                i === 0
                  ? (e) => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0 && Math.abs(w - measuredForWidth.current) > 1) {
                        measuredForWidth.current = w;
                        setSetWidth(w);
                      }
                    }
                  : undefined
              }
            >
              {noticeText}
            </Text>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 0 },
  track: {
    borderWidth: 1.5,
    borderColor: BANNER_BLUE,
    borderRadius: radius.sm,
    backgroundColor: colors.panelAlt,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  text: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    flexShrink: 0,
  },
});
