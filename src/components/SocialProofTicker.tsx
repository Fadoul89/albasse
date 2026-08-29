import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { shuffledSocialProofItems, type SocialProofItem } from '../constants/socialProofNotifications';

const SPEED_PX_PER_SEC = 55;
const BANNER_BLUE = '#2D5BFF';

function buildNoticeText(items: SocialProofItem[]) {
  return items.map((it) => `${it.icon} ${it.text}`).join('   •   ') + '   •   ';
}

export function SocialProofTicker() {
  const itemsRef = useRef<SocialProofItem[]>(shuffledSocialProofItems());
  const [noticeText, setNoticeText] = useState(() => buildNoticeText(itemsRef.current));
  const [setWidth, setSetWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const measuredForWidth = useRef(0);

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
        if (finished && !stopped) {
          // Reshuffle content for variety; the reset to 0 happens in the same
          // frame as the wrap, so the loop stays visually seamless.
          itemsRef.current = shuffledSocialProofItems();
          setNoticeText(buildNoticeText(itemsRef.current));
          runLoop();
        }
      });
    };

    runLoop();
    return () => {
      stopped = true;
    };
  }, [setWidth]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.track}>
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
            {noticeText}
          </Text>
          <Text style={styles.text} numberOfLines={1}>
            {noticeText}
          </Text>
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
