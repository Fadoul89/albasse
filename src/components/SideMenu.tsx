// Menu ☰ de l'accueil (et de Recherche, des pages de catégorie).
// 15 novembre 2026 : comme Jumia — le PROFIL du client avec ses POINTS, puis les CATÉGORIES une à une.
// 16 novembre 2026 (« Le menu à côté je veux comme ça ») : le style « Curved Sidebar » de la vidéo :
//  - un panneau en VERRE DÉPOLI aux bords courbés, posé à gauche (components/CurvedGlass) ; le reste du site garde ses couleurs ;
//  - en haut : 💎 ALBASSE et le bouton pour fermer ; le profil (photo, point vert, numéro, palier, points, barre) ;
//  - « CATÉGORIES » : toucher une catégorie ouvre TOUJOURS sa page ; sa petite flèche montre ses sous-catégories, reliées par une ligne en arbre
//    (« Tout voir » + chaque sous-catégorie) ; la catégorie de la page ouverte est mise en avant ;
//  - une carte « À la une » seulement pendant un vrai moment fort (Black Friday, Tabaski… mêmes dates que Zara) : elle ouvre Zara sur les promotions ;
//  - en bas : « Mon compte » et « Se déconnecter » (client connecté).
// Voir lib/sideMenu.ts (ce que le menu montre) et docs/menu-accueil.md.
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, Animated, Platform, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useAssistantStore } from '../store/assistantStore';
import { texts } from '../lib/assistantText';
import type { Category } from '../types';
import { useCategories } from '../hooks/useCategories';
import { MENU_TEXT, menuActive, menuCategories, menuHighlight, menuProfile, menuSubs, pointsLabel } from '../lib/sideMenu';
import { CURVE_INSET, CurvedGlass } from './CurvedGlass';
import { MenuAdCard } from './MenuAdCard';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { menuAdItems, menuAdTarget } from '../lib/menuAd';
import { cloudinaryUrl } from '../lib/cloudinaryUrl';
import type { AdItem } from '../types';
import { YoutubeIcon } from './YoutubeIcon';
import { YOUTUBE_CHANNEL_URL, YOUTUBE_SUBSCRIBE_URL } from '../lib/youtube';

const ICONS: Record<string, string> = {
  costumes: '🕴️', chemises: '👔', cravates: '🎀', chaussures: '👟', montres: '⌚', montre: '⌚', accessoires: '💍', parfum: '🧴', vetements: '👔',
  'vetements-pour-femmes': '👗', 'sacs-et-bagages': '👜', lunettes: '🕶️', cosmetique: '💄', electrique: '🔌', 'maison-bureau': '🛋️',
  'maison-mobilier': '🛋️', 'bebe-et-maternite': '🍼', 'velos-pour-enfants-jouets-et-jeux': '🧸', 'ordinateur-portable': '💻', voiture: '🚗',
};

// les couleurs du verre (lettres blanches sur vitre claire bleutée, accents or du site)
const G = {
  ink: '#ffffff',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.8)',
  faint: 'rgba(255,255,255,0.85)',
  line: 'rgba(255,255,255,0.26)',
  tree: 'rgba(255,255,255,0.45)',
  pill: 'rgba(255,255,255,0.2)',
  tile: 'rgba(255,255,255,0.72)',
  gold: '#c98a1e',
  online: '#22c55e',
};
const shadow = (o: number, r: number) =>
  Platform.select({ web: { boxShadow: `0 2px ${r}px rgba(20,30,60,${o})` } as object, default: { shadowColor: '#14203c', shadowOpacity: o, shadowRadius: r / 2, shadowOffset: { width: 0, height: 2 }, elevation: 2 } });

export function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.burger} onPress={onPress} accessibilityRole="button" accessibilityLabel={MENU_TEXT.open} hitSlop={8} testID="menu-button">
      <View style={styles.burgerLine} />
      <View style={styles.burgerLine} />
      <View style={styles.burgerLine} />
    </Pressable>
  );
}

// Le bouton ☰ + son panneau pour les pages qui n'ont pas déjà les catégories sous la main (Recherche, pages de catégorie) :
// les catégories ne sont lues qu'à l'OUVERTURE du menu (aucune lecture de plus tant que le client ne touche pas ☰).
function SideMenuLoaded({ onClose }: { onClose: () => void }) {
  const { categories } = useCategories();
  return <SideMenu visible onClose={onClose} categories={categories} />;
}

export function MenuLauncher() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <MenuButton onPress={() => setOpen(true)} />
      {open ? <SideMenuLoaded onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// la page ouverte, si c'est une page de catégorie (sinon rien n'est mis en avant)
function useOpenCategorySlug(): string | null {
  const route = useRoute();
  if (route.name !== 'Category') return null;
  const slug = (route.params as { slug?: unknown } | undefined)?.slug;
  return typeof slug === 'string' ? slug : null;
}

function CatIcon({ c }: { c: Category }) {
  return (
    <View style={[styles.catIcon, shadow(0.14, 4)]}>
      {c.image_url ? <Image accessibilityLabel={c.name} source={{ uri: cloudinaryUrl(c.image_url, 400) }} style={styles.catImage} contentFit="cover" /> : <Text style={styles.catEmoji}>{ICONS[c.slug] ?? '✨'}</Text>}
    </View>
  );
}

export function SideMenu({ visible, onClose, categories }: { visible: boolean; onClose: () => void; categories: readonly Category[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(Math.round(width * 0.86), 340);
  // le contenu reste à l'intérieur des bords creusés (4,5 % de la largeur) avec un peu d'air
  const side = Math.max(18, Math.ceil(drawerWidth * CURVE_INSET) + 8);
  const me = menuProfile(profile);
  const cats = menuCategories(categories);
  const active = menuActive(categories, useOpenCategorySlug());
  const highlight = visible ? menuHighlight(Date.now()) : null;
  // la publicité mouvementée choisie dans l'admin passe AVANT la carte automatique « À la une »
  const { settings } = useStoreSettings();
  const ads = menuAdItems(settings.menu_ad_items);
  // la catégorie dont les sous-catégories sont montrées (une seule à la fois) : au départ, celle de la page ouverte si elle en a
  const [openId, setOpenId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (visible) setOpenId(active && menuSubs(categories, active.mainId).length > 0 ? active.mainId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, active?.mainId]);

  // le panneau arrive en glissant un peu depuis la gauche
  const slide = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, slide]);

  const go = (fn: () => void) => {
    onClose();
    fn();
  };
  const openCategory = (slug: string) => go(() => navigation.navigate('Category', { slug }));
  // la carte « À la une » : Zara s'ouvre sur les vraies promotions (première visite : Zara salue d'abord, comme d'habitude)
  const openPromotions = () =>
    go(() => {
      const z = useAssistantStore.getState();
      if (z.messages.length === 0 || z.loading) {
        z.openChat();
        return;
      }
      useAssistantStore.setState({ open: true, teaserDismissed: true });
      void z.choose({ label: texts(z.lang).chip.promotions, kind: 'say', payload: 'promotions' });
    });

  // une image de la publicité : un article ou une catégorie s'ouvre dans le site ; une autre page du site à sa place ; WhatsApp ou un autre site à part
  const openAd = (item: AdItem) => {
    const target = menuAdTarget(item.link);
    if (!target) return;
    go(() => {
      if (target.kind === 'product') navigation.navigate('Product', { slug: target.slug });
      else if (target.kind === 'category') navigation.navigate('Category', { slug: target.slug });
      else if (target.kind === 'page' && Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(target.path);
      else if (target.kind === 'external') void Linking.openURL(target.url);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} testID="side-menu">
        <Animated.View
          style={[
            styles.panel,
            { width: drawerWidth, opacity: slide, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
          ]}
          testID="menu-panel"
        >
          <CurvedGlass />
          <ScrollView contentContainerStyle={{ paddingHorizontal: side, paddingTop: 16, paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
            {/* 💎 ALBASSE et le bouton pour fermer */}
            <View style={styles.head}>
              <View style={styles.brandRow}>
                <View style={[styles.logo, shadow(0.15, 8)]}>
                  <Text style={styles.logoGem}>💎</Text>
                </View>
                <Text style={styles.brand}>{MENU_TEXT.brand}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={MENU_TEXT.close} hitSlop={10} testID="menu-close">
                <View style={styles.closeBar} />
                <Text style={styles.closeArrow}>←</Text>
              </Pressable>
            </View>

            {/* le profil du client, avec ses points */}
            {me ? (
              <Pressable onPress={() => go(() => navigation.navigate('Tabs', { screen: 'Account' } as never))} accessibilityRole="button" accessibilityLabel={`${MENU_TEXT.account} : ${me.name}`} testID="menu-profile">
                <View style={styles.meRow}>
                  <View style={[styles.avatarRing, shadow(0.2, 10)]}>
                    <View style={styles.avatar}>
                      {me.avatarUrl ? <Image accessibilityLabel="Ma photo de profil" source={{ uri: me.avatarUrl }} style={styles.avatarImage} contentFit="cover" /> : <Text style={styles.avatarText}>{me.initial}</Text>}
                    </View>
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1} testID="menu-profile-name">{me.name}</Text>
                    <View style={styles.idRow}>
                      {me.clientNumber ? <Text style={styles.number} testID="menu-profile-number">{me.clientNumber}</Text> : null}
                      <Text style={[styles.badge, shadow(0.12, 3)]} testID="menu-profile-tier">{`${me.tierIcon} ${me.tierLabel}`}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.pointsRow}>
                  <Text style={styles.points} testID="menu-profile-points">{pointsLabel(me.points)}</Text>
                  <Text style={styles.hint} testID="menu-profile-hint">{me.hint}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(me.progress > 0 ? 3 : 0, Math.round(me.progress * 100))}%` }]} />
                </View>
              </Pressable>
            ) : (
              <View style={[styles.guestCard, shadow(0.1, 8)]} testID="menu-guest">
                <Text style={styles.guestLine}>{MENU_TEXT.guestLine}</Text>
                <Pressable style={styles.loginBtn} onPress={() => go(() => navigation.navigate('Login'))} accessibilityRole="button" testID="menu-login">
                  <Text style={styles.loginText}>{MENU_TEXT.login}</Text>
                </Pressable>
                <Pressable style={styles.registerBtn} onPress={() => go(() => navigation.navigate('Register'))} accessibilityRole="button" testID="menu-register">
                  <Text style={styles.registerText}>{MENU_TEXT.register}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.sep} />

            {/* les catégories, une à une ; la flèche montre les sous-catégories */}
            <Text style={styles.label}>{MENU_TEXT.categoriesLabel}</Text>
            {cats.length === 0 ? <Text style={styles.empty}>{MENU_TEXT.noCategories}</Text> : null}
            {cats.map((c) => {
              const subs = menuSubs(categories, c.id);
              const isOpen = openId === c.id && subs.length > 0;
              const here = active?.activeId === c.id;
              return (
                <View key={c.id}>
                  <View style={[styles.row, (isOpen || here) && [styles.rowOn, shadow(0.12, 10)]]}>
                    <Pressable style={styles.rowMain} onPress={() => openCategory(c.slug)} accessibilityRole="button" testID={`menu-cat-${c.slug}`}>
                      <CatIcon c={c} />
                      <Text style={[styles.catName, here && styles.catNameOn]} numberOfLines={1}>{c.name}</Text>
                      {subs.length === 0 ? (
                        <View style={styles.toggle}>
                          <Text style={styles.chevron}>›</Text>
                        </View>
                      ) : null}
                    </Pressable>
                    {subs.length > 0 ? (
                      <Pressable
                        style={styles.toggle}
                        onPress={() => setOpenId(isOpen ? null : c.id)}
                        accessibilityRole="button"
                        accessibilityLabel={isOpen ? MENU_TEXT.closeSubs(c.name) : MENU_TEXT.openSubs(c.name)}
                        aria-expanded={isOpen}
                        hitSlop={6}
                        testID={`menu-sub-toggle-${c.slug}`}
                      >
                        <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {isOpen ? (
                    <View style={styles.tree} testID={`menu-subs-${c.slug}`}>
                      <View style={styles.treeLine} />
                      <SubRow label={MENU_TEXT.seeAll} on={false} onPress={() => openCategory(c.slug)} testID={`menu-sub-all-${c.slug}`} />
                      {subs.map((s) => (
                        <SubRow key={s.id} label={s.name} on={active?.activeId === s.id} onPress={() => openCategory(s.slug)} testID={`menu-sub-${s.slug}`} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* la publicité mouvementée du patron ; sinon « À la une », seulement pendant un vrai moment fort */}
            {ads.length > 0 ? (
              <MenuAdCard items={ads} onOpen={openAd} />
            ) : highlight ? (
              <Pressable style={[styles.card, shadow(0.28, 18)]} onPress={openPromotions} accessibilityRole="button" accessibilityLabel={`${highlight.title}, ${highlight.when} : voir les promotions avec Zara`} testID="menu-highlight">
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTag}>{`${MENU_TEXT.highlightTag} · ${highlight.monthTag}`}</Text>
                  <Text style={styles.cardTitle} testID="menu-highlight-title">{highlight.title.replace(' ', '\n')}</Text>
                  <Text style={styles.cardWhen}>{highlight.when}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.star, { left: 16, top: 14 }]}>✦</Text>
                  <Text style={[styles.star, { right: 24, top: 24, fontSize: 7 }]}>✦</Text>
                  <Text style={styles.cardEmoji}>{highlight.emoji}</Text>
                  <Text style={styles.cardCta}>{MENU_TEXT.highlightCta}</Text>
                </View>
              </Pressable>
            ) : null}

            {/* Mon compte / Se déconnecter */}
            {me ? (
              <View style={styles.foot}>
                <Pressable style={styles.row} onPress={() => go(() => navigation.navigate('Tabs', { screen: 'Account' } as never))} accessibilityRole="button" testID="menu-account">
                  <View style={styles.footIcon}><Text style={styles.footEmoji}>👤</Text></View>
                  <Text style={styles.catName}>{MENU_TEXT.account}</Text>
                  <View style={styles.toggle}>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.row} onPress={() => go(() => void signOut())} accessibilityRole="button" testID="menu-signout">
                  <View style={styles.footIcon}><Text style={styles.footEmoji}>↪</Text></View>
                  <Text style={styles.catName}>{MENU_TEXT.signOut}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* la chaîne YouTube de la boutique (demande du patron) : la carte ouvre la chaîne, « S'abonner » la fenêtre d'abonnement */}
            <Pressable style={[styles.ytCard, shadow(0.12, 10)]} onPress={() => Linking.openURL(YOUTUBE_CHANNEL_URL)} accessibilityRole="link" accessibilityLabel={`${MENU_TEXT.youtubeTitle} : ${MENU_TEXT.youtubeSub}`} testID="menu-youtube">
              <YoutubeIcon width={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ytTitle}>{MENU_TEXT.youtubeTitle}</Text>
                <Text style={styles.ytSub}>{MENU_TEXT.youtubeSub}</Text>
              </View>
              <Pressable style={styles.ytBtn} onPress={() => Linking.openURL(YOUTUBE_SUBSCRIBE_URL)} accessibilityRole="link" accessibilityLabel="S'abonner à notre chaîne YouTube" hitSlop={6} testID="menu-youtube-subscribe">
                <Text style={styles.ytBtnText}>{MENU_TEXT.youtubeSubscribe}</Text>
              </Pressable>
            </Pressable>
          </ScrollView>
        </Animated.View>
        {/* toucher à côté du panneau le ferme */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={MENU_TEXT.close} testID="menu-backdrop" />
      </View>
    </Modal>
  );
}

function SubRow({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable style={[styles.subRow, on && [styles.subRowOn, shadow(0.16, 12)]]} onPress={onPress} accessibilityRole="button" testID={testID}>
      <View style={styles.branch} />
      <View style={[styles.subDot, on && styles.subDotOn]} />
      <Text style={[styles.subText, on && styles.subTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  burger: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  burgerLine: { width: 20, height: 2.5, borderRadius: 2, backgroundColor: colors.goldLight },
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(3,10,30,0.45)' },
  backdrop: { flex: 1 },
  panel: { marginLeft: 10, marginVertical: 12, overflow: 'visible' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  logoGem: { fontSize: 17 },
  brand: { color: G.ink, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 4.5 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  closeBar: { width: 2, height: 13, borderRadius: 1, backgroundColor: G.ink },
  closeArrow: { color: G.ink, fontSize: 15, fontFamily: fonts.bodyBold, marginTop: -1 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  avatarRing: { width: 54, height: 54, borderRadius: 27, padding: 2, backgroundColor: '#e4e8ef' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50 },
  avatarText: { color: colors.background, fontFamily: fonts.displayBold, fontSize: 20 },
  onlineDot: { position: 'absolute', right: 1, bottom: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: G.online, borderWidth: 2, borderColor: '#ffffff' },
  name: { color: G.ink, fontFamily: fonts.bodyBold, fontSize: 16 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' },
  number: { color: G.muted, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0.4 },
  badge: { color: '#8a4f17', backgroundColor: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 10.5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  points: { color: G.ink, fontFamily: fonts.bodyBold, fontSize: 15 },
  hint: { flexShrink: 1, textAlign: 'right', color: G.muted, fontFamily: fonts.body, fontSize: 11.5 },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 6, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: G.gold },
  guestCard: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', padding: 14, gap: 10 },
  guestLine: { color: G.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  loginBtn: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  loginText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  registerBtn: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.goldLight, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(7,36,105,0.35)' },
  registerText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  sep: { height: 1, backgroundColor: G.line, marginTop: 16, marginBottom: 12 },
  label: { color: G.muted, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2.8, marginLeft: 4, marginBottom: 6 },
  empty: { color: G.muted, fontFamily: fonts.body, fontSize: 13, paddingHorizontal: 4, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: 12, paddingRight: 4, gap: 12, paddingLeft: 10 },
  rowOn: { backgroundColor: G.pill },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  catIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: G.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catImage: { width: 28, height: 28 },
  catEmoji: { fontSize: 15 },
  catName: { flex: 1, color: G.text, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  catNameOn: { color: G.ink, fontFamily: fonts.bodyBold },
  chevron: { color: G.faint, fontSize: 18, fontFamily: fonts.bodySemiBold, width: 22, textAlign: 'center' },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: G.ink },
  toggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tree: { marginLeft: 24, paddingLeft: 18, marginTop: 4, marginBottom: 6 },
  treeLine: { position: 'absolute', left: 0, top: 0, bottom: 18, width: 1.5, borderRadius: 1, backgroundColor: G.tree },
  subRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  subRowOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  branch: { position: 'absolute', left: -18, top: '50%', width: 12, height: 1.5, backgroundColor: G.tree },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginRight: 10 },
  subDotOn: { backgroundColor: G.gold },
  subText: { flex: 1, color: 'rgba(255,255,255,0.92)', fontFamily: fonts.bodyMedium, fontSize: 13 },
  subTextOn: { color: G.ink, fontFamily: fonts.bodyBold },
  card: { flexDirection: 'row', height: 118, borderRadius: 16, overflow: 'hidden', marginTop: 16, marginBottom: 10 },
  cardLeft: { width: '46%', backgroundColor: '#f4f5f8', padding: 12, justifyContent: 'space-between' },
  cardTag: { color: '#6b7280', fontFamily: fonts.bodyBold, fontSize: 8.5, letterSpacing: 1.6 },
  cardTitle: { color: '#111111', fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 20 },
  cardWhen: { color: '#5b6270', fontFamily: fonts.body, fontSize: 10 },
  cardRight: { flex: 1, backgroundColor: '#0e1324', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 40 },
  star: { position: 'absolute', color: '#ffffff', fontSize: 9 },
  cardCta: { position: 'absolute', right: 10, bottom: 8, color: '#d4d9ea', fontFamily: fonts.bodyBold, fontSize: 8.5, letterSpacing: 1.2 },
  foot: { marginTop: 4 },
  ytCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: '#ff3b30' },
  ytTitle: { color: G.text, fontFamily: fonts.bodyBold, fontSize: 14 },
  ytSub: { color: G.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  ytBtn: { backgroundColor: '#ff0000', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  ytBtnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 11 },
  footIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  footEmoji: { fontSize: 14, color: G.ink },
});
