// Publicité mouvementée du menu ☰ (demande du patron, 16 novembre 2026 : « Publicité mouvementée »).
// Les images choisies dans Admin › Promotions intelligentes (lib/menuAd.ts) :
//  - chaque image reste 5 secondes avec un ZOOM LENT, puis GLISSE vers la suivante (la dernière revient à la première sans saut) ;
//  - un REFLET de lumière passe sur l'image ; une BARRE DORÉE se remplit en bas (le temps avant l'image suivante) ; des points disent laquelle est montrée ;
//  - « PUB » en haut à gauche ; « Voir › » fait un petit saut (seulement si l'image a un lien).
// Pour les personnes qui ont demandé « moins d'animations » : pas de zoom, de reflet ni de saut ; les images changent sans glisser.
// Tout le mouvement est fait par le moteur d'animation (transform, opacité) ; plus rien ne tourne quand le menu est fermé.
import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../theme';
import type { AdItem } from '../types';
import { MENU_AD_HEIGHT, MENU_AD_SHOW_MS, MENU_AD_SLIDE_MS, MENU_AD_TEXT } from '../lib/menuAd';

const native = Platform.OS !== 'web';
const shadow = Platform.select({ web: { boxShadow: '0 6px 18px rgba(10,20,50,0.28)' } as object, default: { shadowColor: '#0a1432', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 5 } });

export function MenuAdCard({ items, onOpen }: { items: AdItem[]; onOpen: (item: AdItem) => void }) {
  const n = items.length;
  const [w, setW] = React.useState(0);
  const [index, setIndex] = React.useState(0); // 0..n (n = la copie de la première, pour revenir sans saut)
  const [reduced, setReduced] = React.useState(false);
  const pos = React.useRef(new Animated.Value(0)).current;
  const zoom = React.useRef(new Animated.Value(0)).current;
  const shine = React.useRef(new Animated.Value(0)).current;
  const progress = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  const shown = index % Math.max(1, n);
  const current = items[shown];

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduced(!!r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    Image.prefetch(items.map((i) => i.image_url)).catch(() => {});
  }, [items]);

  // zoom lent, reflet, petit saut de « Voir › » : en boucle tant que la carte est là
  React.useEffect(() => {
    if (reduced) {
      zoom.setValue(0);
      shine.setValue(0);
      pulse.setValue(0);
      return undefined;
    }
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(zoom, { toValue: 1, duration: MENU_AD_SHOW_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(zoom, { toValue: 0, duration: MENU_AD_SHOW_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(shine, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: native }),
          Animated.delay(MENU_AD_SHOW_MS - 1700),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(1750),
          Animated.timing(pulse, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.timing(pulse, { toValue: 0, duration: 260, easing: Easing.out(Easing.back(2)), useNativeDriver: native }),
          Animated.delay(310),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, zoom, shine, pulse]);

  // 5 secondes par image (la barre dorée se remplit), puis glissement vers la suivante
  React.useEffect(() => {
    // une image toutes les 5 secondes, glissement compris : l'image reste 4,3 s (la barre se remplit), puis glisse 0,7 s
    const stay = reduced || n <= 1 ? MENU_AD_SHOW_MS : MENU_AD_SHOW_MS - MENU_AD_SLIDE_MS;
    const fill = () => {
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: stay, easing: Easing.linear, useNativeDriver: false }).start();
    };
    fill();
    if (n <= 1 || w <= 0) {
      // une seule image (ou largeur pas encore connue) : l'image reste, la barre recommence
      const again = setInterval(fill, MENU_AD_SHOW_MS);
      return () => {
        progress.stopAnimation();
        clearInterval(again);
      };
    }
    const t = setTimeout(() => {
      const next = index + 1;
      const done = () => {
        if (next >= n) {
          pos.setValue(0); // la copie de la première : on revient au début sans que cela se voie
          setIndex(0);
        } else setIndex(next);
      };
      if (reduced) {
        pos.setValue(-next * w);
        done();
      } else {
        Animated.timing(pos, { toValue: -next * w, duration: MENU_AD_SLIDE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }).start(({ finished }) => finished && done());
      }
    }, stay);
    return () => {
      progress.stopAnimation();
      clearTimeout(t);
    };
  }, [index, n, w, reduced, pos, progress]);

  // la largeur change (téléphone tourné) : on se recale sur l'image montrée
  React.useEffect(() => {
    if (w > 0) pos.setValue(-index * w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  if (n === 0) return null;
  const slides = n > 1 ? [...items, items[0]] : items;
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const drift = zoom.interpolate({ inputRange: [0, 1], outputRange: [0, -(w || 300) * 0.03] });
  const band = Math.max(80, (w || 300) * 0.38);
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-band * 1.6, (w || 300) + band * 0.4] });
  const goScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const hasLink = !!current?.link;

  return (
    <Pressable
      onPress={() => current && hasLink && onOpen(current)}
      disabled={!hasLink}
      accessibilityRole={hasLink ? 'link' : 'image'}
      accessibilityLabel={`${MENU_AD_TEXT.label(n, shown)}${hasLink ? ' : voir' : ''}`}
      style={[styles.card, shadow]}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      testID="menu-ad"
    >
      <Animated.View style={[styles.track, { width: Math.max(1, w) * slides.length, transform: [{ translateX: pos }] }]} testID="menu-ad-track">
        {slides.map((it, i) => (
          <View key={`${it.image_url}-${i}`} style={[styles.slide, { width: Math.max(1, w) }]} testID={`menu-ad-slide-${i}`}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }, { translateX: drift }] }]} testID={i === 0 ? 'menu-ad-zoom' : undefined}>
              <Image accessibilityLabel={MENU_AD_TEXT.label(n, i % n)} source={{ uri: it.image_url }} style={styles.image} contentFit="cover" />
            </Animated.View>
          </View>
        ))}
      </Animated.View>
      {/* le reflet de lumière */}
      {!reduced ? (
        <Animated.View pointerEvents="none" style={[styles.shine, { width: band, transform: [{ translateX: shineX }, { skewX: '-18deg' }] }]} testID="menu-ad-shine">
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <Text style={styles.tag}>{MENU_AD_TEXT.tag}</Text>
      {n > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === shown && styles.dotOn]} testID={`menu-ad-dot-${i}`} />
          ))}
        </View>
      ) : null}
      {hasLink ? (
        <Animated.Text style={[styles.go, { transform: [{ scale: goScale }] }]} testID="menu-ad-go">
          {MENU_AD_TEXT.go}
        </Animated.Text>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.bar, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} testID="menu-ad-bar" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: MENU_AD_HEIGHT, borderRadius: 16, overflow: 'hidden', marginTop: 16, marginBottom: 10, backgroundColor: '#0e1324' },
  track: { flexDirection: 'row', height: '100%' },
  slide: { height: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  shine: { position: 'absolute', top: -30, bottom: -30, left: 0 },
  tag: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(15,20,35,0.72)', color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 1.4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 16, backgroundColor: '#ffffff' },
  go: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(255,255,255,0.94)', color: '#1d222a', fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: '#f1c96b' },
});
