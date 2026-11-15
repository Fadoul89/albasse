// Menu ☰ de l'accueil, comme sur Jumia (demande du patron, 15 novembre 2026) : un panneau qui glisse depuis la gauche avec
//  1. le PROFIL du client et ses POINTS à l'intérieur (palier, barre vers le prochain palier) ; un visiteur voit « Se connecter » ;
//  2. les CATÉGORIES, une à une.
// Voir lib/sideMenu.ts (ce que le menu montre) et docs/menu-accueil.md.
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import type { Category } from '../types';
import { useCategories } from '../hooks/useCategories';
import { MENU_TEXT, menuCategories, menuProfile, pointsLabel } from '../lib/sideMenu';

const ICONS: Record<string, string> = {
  costumes: '🕴️', chemises: '👔', cravates: '🎀', chaussures: '👟', montres: '⌚', montre: '⌚', accessoires: '💍', parfum: '🧴', vetements: '👔',
  'vetements-pour-femmes': '👗', 'sacs-et-bagages': '👜', lunettes: '🕶️', cosmetique: '💄', electrique: '🔌', 'maison-bureau': '🛋️',
  'maison-mobilier': '🛋️', 'bebe-et-maternite': '🍼', 'velos-pour-enfants-jouets-et-jeux': '🧸', 'ordinateur-portable': '💻', voiture: '🚗',
};

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

export function SideMenu({ visible, onClose, categories }: { visible: boolean; onClose: () => void; categories: readonly Category[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(Math.round(width * 0.86), 340);
  const me = menuProfile(profile);
  const cats = menuCategories(categories);

  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} testID="side-menu">
        <View style={[styles.drawer, { width: drawerWidth }]}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>{MENU_TEXT.title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={MENU_TEXT.close} hitSlop={10} testID="menu-close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* 1. le profil du client, avec ses points */}
            <Text style={styles.sectionTitle}>{MENU_TEXT.profileTitle}</Text>
            {me ? (
              <Pressable
                style={styles.profileCard}
                onPress={() => go(() => navigation.navigate('Tabs', { screen: 'Account' } as never))}
                accessibilityRole="button"
                testID="menu-profile"
              >
                <View style={styles.profileTop}>
                  <View style={styles.avatar}>
                    {me.avatarUrl ? <Image accessibilityLabel="Ma photo de profil" source={{ uri: me.avatarUrl }} style={styles.avatarImage} contentFit="cover" /> : <Text style={styles.avatarText}>{me.initial}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1} testID="menu-profile-name">{me.name}</Text>
                    {me.clientNumber ? <Text style={styles.number} testID="menu-profile-number">{me.clientNumber}</Text> : null}
                  </View>
                </View>
                <View style={styles.pointsRow}>
                  <Text style={styles.tier} testID="menu-profile-tier">{`${me.tierIcon} ${me.tierLabel}`}</Text>
                  <Text style={styles.points} testID="menu-profile-points">{pointsLabel(me.points)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(me.progress * 100)}%` }]} />
                </View>
                <Text style={styles.hint} testID="menu-profile-hint">{me.hint}</Text>
                <Text style={styles.viewProfile}>{MENU_TEXT.viewProfile}</Text>
              </Pressable>
            ) : (
              <View style={styles.profileCard} testID="menu-guest">
                <Text style={styles.guestLine}>{MENU_TEXT.guestLine}</Text>
                <Pressable style={styles.loginBtn} onPress={() => go(() => navigation.navigate('Login'))} accessibilityRole="button" testID="menu-login">
                  <Text style={styles.loginText}>{MENU_TEXT.login}</Text>
                </Pressable>
                <Pressable style={styles.registerBtn} onPress={() => go(() => navigation.navigate('Register'))} accessibilityRole="button" testID="menu-register">
                  <Text style={styles.registerText}>{MENU_TEXT.register}</Text>
                </Pressable>
              </View>
            )}

            {/* 2. les catégories, une à une */}
            <Text style={styles.sectionTitle}>{MENU_TEXT.categories}</Text>
            {cats.length === 0 ? <Text style={styles.empty}>{MENU_TEXT.noCategories}</Text> : null}
            {cats.map((c) => (
              <Pressable
                key={c.id}
                style={styles.catRow}
                onPress={() => go(() => navigation.navigate('Category', { slug: c.slug }))}
                accessibilityRole="button"
                testID={`menu-cat-${c.slug}`}
              >
                <View style={styles.catIcon}>
                  {c.image_url ? <Image accessibilityLabel={c.name} source={{ uri: c.image_url }} style={styles.catImage} contentFit="cover" /> : <Text style={styles.catEmoji}>{ICONS[c.slug] ?? '✨'}</Text>}
                </View>
                <Text style={styles.catName} numberOfLines={2}>{c.name}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {/* toucher à côté du panneau le ferme */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={MENU_TEXT.close} testID="menu-backdrop" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  burger: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  burgerLine: { width: 20, height: 2.5, borderRadius: 2, backgroundColor: colors.goldLight },
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdrop: { flex: 1 },
  drawer: { backgroundColor: colors.panelAlt, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headTitle: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 20 },
  close: { color: colors.creamMuted, fontSize: 20, fontFamily: fonts.bodySemiBold },
  sectionTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, letterSpacing: 0.5, paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  profileCard: { marginHorizontal: spacing.md, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 8 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48 },
  avatarText: { color: colors.background, fontFamily: fonts.displayBold, fontSize: 20 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  number: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginTop: 2 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tier: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  points: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 18 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.panelAlt, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
  hint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  viewProfile: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginTop: 2 },
  guestLine: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  loginBtn: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  loginText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  registerBtn: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, paddingVertical: 10, alignItems: 'center' },
  registerText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  empty: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, paddingHorizontal: spacing.md },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  catIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catImage: { width: 40, height: 40 },
  catEmoji: { fontSize: 20 },
  catName: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  chevron: { color: colors.creamFaint, fontSize: 22 },
});
