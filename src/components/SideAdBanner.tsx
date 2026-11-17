import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const CUBE_MS = 900; // durée de la rotation du cube
const NEON_PURPLE = '#C400FF';
const VISIBLE_COUNT = 3;
const PERSPECTIVE = 900;

// Les images changent par « page » : les 3 images de la bande sont remplacées toutes ensemble par les 3 suivantes.
// La page se calcule sur l'horloge (même ROTATE_MS pour toutes les bandes) : les deux bandes de l'accueil
// changent donc au même moment, et les 6 images sont remplacées par 6 autres d'un coup.
export function pageAt(now: number, pageCount: number) {
  return pageCount > 0 ? Math.floor(now / ROTATE_MS) % pageCount : 0;
}

// Effet « cube qui tourne » : la face actuelle (3 affiches) part vers la gauche en pivotant sur son bord droit,
// la face suivante arrive de la droite en pivotant sur son bord gauche, comme les deux faces d'un cube.
// height : la hauteur de la bande (plus haute sur téléphone, où chaque bande prend toute la largeur)
export function SideAdBanner({ items, height = 120 }: { items: AdItem[]; height?: number }) {
  const visibleCount = Math.min(VISIBLE_COUNT, items.length);
  const pageCount = visibleCount > 0 ? Math.ceil(items.length / visibleCount) : 0;
  const [page, setPage] = useState(() => pageAt(Date.now(), pageCount));
  const [next, setNext] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length === 0) return;
    Image.prefetch(items.map((item) => item.image_url)).catch(() => {});
  }, [items]);

  useEffect(() => {
    setPage(pageAt(Date.now(), pageCount));
    setNext(null);
    if (pageCount <= 1) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    // délai jusqu'au prochain tic ; un minuteur parti un peu en avance ne déclenche pas deux changements de suite
    const waitForTick = () => {
      const wait = ROTATE_MS - (Date.now() % ROTATE_MS);
      return wait < 200 ? wait + ROTATE_MS : wait;
    };
    const schedule = () => {
      timer = setTimeout(() => {
        const target = pageAt(Date.now() + CUBE_MS, pageCount);
        turn.setValue(0);
        setNext(target);
        Animated.timing(turn, { toValue: 1, duration: CUBE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
          if (!alive) return;
          // la face qui vient d'arriver devient la face fixe (sans rotation)
          setPage(target);
          setNext(null);
        });
        schedule();
      }, waitForTick());
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pageCount, turn]);

  if (items.length === 0) return null;

  const pageItems = (p: number) => {
    const start = (p % Math.max(pageCount, 1)) * visibleCount;
    return Array.from({ length: visibleCount }, (_, i) => items[(start + i) % items.length]);
  };

  const renderSlot = (item: AdItem, active: boolean) => {
    const image = <Image accessibilityLabel="Publicité Albasse Shopping" source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />;
    return item.link && active ? (
      <Pressable style={styles.slot} onPress={() => Linking.openURL(item.link!)}>
        {image}
      </Pressable>
    ) : (
      <View style={styles.slot}>{image}</View>
    );
  };

  const renderFace = (p: number, active: boolean) =>
    pageItems(p).map((item, i) => (
      <React.Fragment key={`slot-${i}`}>
        {i > 0 && <View style={styles.divider} />}
        {renderSlot(item, active)}
      </React.Fragment>
    ));

  const turning = next !== null && width > 0;
  const w = width || 1;
  // face qui part : pivote sur son bord droit et glisse à gauche ; elle s'assombrit en tournant
  const outStyle = {
    transformOrigin: 'right center',
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: turn.interpolate({ inputRange: [0, 1], outputRange: [0, -w] }) },
      { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] }) },
    ],
  };
  // face qui arrive : pivote sur son bord gauche depuis la droite
  const inStyle = {
    transformOrigin: 'left center',
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: turn.interpolate({ inputRange: [0, 1], outputRange: [w, 0] }) },
      { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
    ],
  };
  const outShade = turn.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const inShade = turn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {turning ? (
        <>
          <Animated.View style={[styles.face, outStyle]}>
            {renderFace(page, false)}
            <Animated.View pointerEvents="none" style={[styles.shade, { opacity: outShade }]} />
          </Animated.View>
          <Animated.View style={[styles.face, inStyle]}>
            {renderFace(next!, false)}
            <Animated.View pointerEvents="none" style={[styles.shade, { opacity: inShade }]} />
          </Animated.View>
        </>
      ) : (
        <View style={styles.face}>{renderFace(page, true)}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#05010D',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: NEON_PURPLE,
    shadowColor: NEON_PURPLE,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: colors.panel, backfaceVisibility: 'hidden' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  slot: { flex: 1 },
  divider: { width: 2, backgroundColor: NEON_PURPLE },
  image: { width: '100%', height: '100%' },
});
