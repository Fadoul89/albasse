import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  Platform,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';
import { navigationRef } from '../navigation/navigationRef';
import { useAssistantStore, type ChatAction, type ChatMessage } from '../store/assistantStore';
import type { AssistantProduct } from '../lib/assistantData';
import { ASSISTANT_NAME, ASSISTANT_ROLE, WHATSAPP_URL } from '../constants/assistant';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const DESKTOP_WIDTH = 640;

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const isArabic = (text: string) => /[؀-ۿ]/.test(text);

// Zone visible du navigateur : sur telephone, le clavier la reduit. La fenetre de chat la suit
// pour que la zone de saisie reste toujours au-dessus du clavier.
function useVisibleArea(enabled: boolean) {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setArea({ top: viewport.offsetTop, height: viewport.height });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return area;
}

function TypingDots() {
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.3, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={styles.typingRow} accessibilityLabel={`${ASSISTANT_NAME} écrit…`}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: v }]} />
      ))}
    </View>
  );
}

function ProductCards({ products, onOpen }: { products: AssistantProduct[]; onOpen: (slug: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardsScroll}>
      {products.map((p) => {
        const discount = p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : null;
        return (
          <Pressable key={p.slug} testID="assistant-card" style={styles.card} onPress={() => onOpen(p.slug)} accessibilityRole="link" accessibilityLabel={`Voir ${p.name}`}>
            <View style={styles.cardImageWrap}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.cardImage} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.cardImage, styles.cardNoImage]}>
                  <Text style={styles.cardNoImageText}>🛍️</Text>
                </View>
              )}
              {discount ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-{discount}%</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardName} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.cardPrice}>{formatXAF(p.price)}</Text>
            {discount && p.compare_at_price ? <Text style={styles.cardOldPrice}>{formatXAF(p.compare_at_price)}</Text> : null}
            {!p.in_stock ? <Text style={styles.cardOut}>Épuisé</Text> : <Text style={styles.cardSee}>Voir le produit ›</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ActionChips({ actions, onChoose }: { actions: ChatAction[]; onChoose: (action: ChatAction) => void }) {
  return (
    <View style={styles.chips}>
      {actions.map((a) => {
        const whatsapp = a.kind === 'whatsapp';
        const ghost = a.kind === 'skip';
        return (
          <Pressable
            key={`${a.kind}-${a.label}`}
            testID="assistant-chip"
            style={[styles.chip, ghost && styles.chipGhost, a.highlight && styles.chipHighlight, whatsapp && styles.chipWhatsapp]}
            onPress={() => onChoose(a)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Text style={[styles.chipText, ghost && styles.chipTextGhost, a.highlight && styles.chipTextHighlight, whatsapp && styles.chipTextWhatsapp]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Bubble({
  message,
  showActions,
  onOpenProduct,
  onChoose,
}: {
  message: ChatMessage;
  showActions: boolean;
  onOpenProduct: (slug: string) => void;
  onChoose: (action: ChatAction) => void;
}) {
  const mine = message.role === 'user';
  const rtl = isArabic(message.text);
  const textStyle: TextStyle[] = [styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextBot];
  if (rtl) textStyle.push({ writingDirection: 'rtl', textAlign: 'right' });
  return (
    <View style={styles.group}>
      <View style={[styles.row, mine ? styles.rowMine : styles.rowBot]}>
        {!mine && <Image source={AVATAR} style={styles.smallAvatar} contentFit="cover" />}
        <View style={styles.bubbleColumn}>
          {mine ? (
            <LinearGradient colors={[colors.gold, colors.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
              <Text style={textStyle} selectable>
                {message.text}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleBot]}>
              <Text style={textStyle} selectable>
                {message.text}
              </Text>
            </View>
          )}
          {!mine && message.products && message.products.length > 0 ? <ProductCards products={message.products} onOpen={onOpenProduct} /> : null}
        </View>
      </View>
      {!mine && showActions && message.actions && message.actions.length > 0 ? <ActionChips actions={message.actions} onChoose={onChoose} /> : null}
    </View>
  );
}

export function AssistantPanel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const messages = useAssistantStore((s) => s.messages);
  const loading = useAssistantStore((s) => s.loading);
  const step = useAssistantStore((s) => s.step);
  const send = useAssistantStore((s) => s.send);
  const choose = useAssistantStore((s) => s.choose);
  const closeChat = useAssistantStore((s) => s.closeChat);
  const reset = useAssistantStore((s) => s.reset);

  const desktop = width >= DESKTOP_WIDTH;
  const area = useVisibleArea(!desktop);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [appear]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, loading]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || loading) return;
    setDraft('');
    send(value);
  };

  // Sur telephone le chat couvre l'ecran : on le ferme quand on ouvre une autre page du site.
  const go = (open: () => void) => {
    if (!navigationRef.isReady()) return;
    open();
    if (!desktop) closeChat();
  };

  const openProduct = (slug: string) => go(() => navigationRef.navigate('Product', { slug }));

  const onChoose = (action: ChatAction) => {
    switch (action.kind) {
      case 'whatsapp':
        Linking.openURL(WHATSAPP_URL);
        return;
      case 'register':
        go(() => navigationRef.navigate('Register'));
        return;
      case 'login':
        go(() => navigationRef.navigate('Login'));
        return;
      case 'orders':
        go(() => navigationRef.navigate('Orders'));
        return;
      case 'category':
        if (action.payload) go(() => navigationRef.navigate('Category', { slug: action.payload as string }));
        return;
      default:
        choose(action);
    }
  };

  const panelStyle = desktop
    ? { right: spacing.md, bottom: spacing.md, width: 400, height: Math.min(620, height - spacing.md * 2) }
    : { left: 0, right: 0, top: area?.top ?? 0, height: area?.height ?? height };

  const placeholder = step === 'ask_name' ? 'Écrivez votre prénom…' : step === 'ask_city' ? 'Écrivez votre ville…' : 'Écrivez votre message…';
  const lastIndex = messages.length - 1;

  return (
    <Animated.View
      style={[
        styles.panel,
        desktop ? styles.panelDesktop : null,
        panelStyle,
        { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
      accessibilityViewIsModal
      testID="assistant-panel"
    >
      <LinearGradient colors={[colors.panelAlt, colors.panel]} style={[styles.header, !desktop ? { paddingTop: spacing.sm + insets.top } : null]}>
        <View style={styles.avatarRing}>
          <Image source={AVATAR} style={styles.headerAvatar} contentFit="cover" />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{ASSISTANT_NAME}</Text>
          <Text style={styles.headerRole} numberOfLines={1}>
            {ASSISTANT_ROLE.charAt(0).toUpperCase() + ASSISTANT_ROLE.slice(1)}
          </Text>
        </View>
        {messages.length > 0 && !loading ? (
          <Pressable onPress={reset} hitSlop={8} style={styles.trashButton} accessibilityRole="button" accessibilityLabel="Recommencer la conversation">
            <Text style={styles.trashText}>🗑</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Linking.openURL(WHATSAPP_URL)} hitSlop={8} style={styles.headerWhatsapp} accessibilityRole="link" accessibilityLabel="Parler à l'équipe sur WhatsApp">
          <Text style={styles.headerWhatsappText}>WhatsApp</Text>
        </Pressable>
        <Pressable onPress={closeChat} hitSlop={10} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Fermer">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {messages.map((m, i) => (
          <Bubble key={m.id} message={m} showActions={i === lastIndex && !loading} onOpenProduct={openProduct} onChoose={onChoose} />
        ))}

        {loading ? (
          <View style={[styles.row, styles.rowBot]}>
            <Image source={AVATAR} style={styles.smallAvatar} contentFit="cover" />
            <View style={[styles.bubble, styles.bubbleBot]}>
              <TypingDots />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputBar, !desktop ? { paddingBottom: spacing.sm + (area ? 0 : insets.bottom) } : null]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
          maxLength={300}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => submit(draft)}
          accessibilityLabel="Votre message"
        />
        <Pressable
          onPress={() => submit(draft)}
          disabled={!draft.trim() || loading}
          style={[styles.sendButton, (!draft.trim() || loading) && styles.sendButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
        >
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>{ASSISTANT_NAME} est une assistante automatique. Pour une commande ou un souci, écrivez-nous sur WhatsApp.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  panelDesktop: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 1,
  },
  headerAvatar: { width: '100%', height: '100%', borderRadius: 22 },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#3ddc84',
    borderWidth: 2,
    borderColor: colors.panelAlt,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 18 },
  headerRole: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  trashButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  trashText: { fontSize: 15 },
  headerWhatsapp: { backgroundColor: '#25d366', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  headerWhatsappText: { color: '#06240f', fontFamily: fonts.bodyBold, fontSize: 12 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  closeText: { color: colors.cream, fontSize: 15 },

  messages: { flex: 1 },
  messagesContent: { padding: spacing.md, gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowBot: { justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  smallAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.gold },
  bubbleColumn: { maxWidth: '82%', flexShrink: 1, gap: 8 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleBot: { backgroundColor: colors.panelAlt, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { borderBottomRightRadius: 5 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bubbleTextBot: { color: colors.cream },
  bubbleTextMine: { color: '#1b1405', fontFamily: fonts.bodyMedium },

  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38 },
  chip: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(199,154,62,0.10)' },
  chipGhost: { borderColor: colors.border, backgroundColor: 'transparent' },
  chipHighlight: { backgroundColor: colors.gold },
  chipWhatsapp: { borderColor: '#25d366', backgroundColor: '#25d366' },
  chipText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  chipTextGhost: { color: colors.creamMuted },
  chipTextHighlight: { color: '#1b1405', fontFamily: fonts.bodyBold },
  chipTextWhatsapp: { color: '#06240f', fontFamily: fonts.bodyBold },

  typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 6, paddingHorizontal: 2 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.goldLight },

  cardsScroll: { marginTop: 2 },
  cards: { gap: 10, paddingRight: spacing.md },
  card: { width: 150, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingBottom: 10 },
  cardImageWrap: { width: '100%', height: 130, backgroundColor: '#fff' },
  cardImage: { width: '100%', height: '100%' },
  cardNoImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelAlt },
  cardNoImageText: { fontSize: 30 },
  discountBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 },
  cardName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 17, paddingHorizontal: 9, marginTop: 8, minHeight: 34 },
  cardPrice: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14, paddingHorizontal: 9, marginTop: 4 },
  cardOldPrice: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, textDecorationLine: 'line-through', paddingHorizontal: 9 },
  cardSee: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12, paddingHorizontal: 9, marginTop: 6 },
  cardOut: { color: colors.error, fontFamily: fonts.bodySemiBold, fontSize: 12, paddingHorizontal: 9, marginTop: 6 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panel,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 16,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.45 },
  sendIcon: { color: '#1b1405', fontSize: 17 },
  note: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 10.5,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: colors.panel,
  },
});
