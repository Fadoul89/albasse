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
  // peu de commandes : le texte tient dans la barre, il reste fixe (pas de défilement ni de trou à droite)
  const scrolls = trackWidth > 0 && setWidth > trackWidth;
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
    translateX.setValue(0);
    if (!scrolls) return;
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
  }, [setWidth, scrolls]);

  if (items.length === 0) return null;
  return (
    <View style={styles.wrapper} testID="recent-purchases">
      <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
          <Text
            style={styles.text}
            numberOfLines={1}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - measuredForWidth.current) > 1) {
                measuredForWidth.current = w;
                setSetWidth(w);
              }
            }}
          >
            {scrolls ? noticeText : noticeText.replace(/[\s•]+$/, '')}
          </Text>
          {scrolls ? (
            <Text style={styles.text} numberOfLines={1}>
              {noticeText}
            </Text>
          ) : null}
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
