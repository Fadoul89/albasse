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
import { useAssistantStore, type ChatAction, type ChatImage, type ChatMessage } from '../store/assistantStore';
import type { AssistantProduct } from '../lib/assistantData';
import { hasArabic, type Lang } from '../lib/assistantLang';
import { currentDevice, markIntent } from '../lib/assistantAttribution';
import { texts } from '../lib/assistantText';
import { openInChrome } from '../lib/pwaInstallPrompt';
import { ASSISTANT_NAME, WHATSAPP_URL } from '../constants/assistant';
import { sizedImage } from '../lib/imageSize';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const DESKTOP_WIDTH = 640;
const COMPACT_WIDTH = 430;

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Texte arabe : écrit de droite à gauche.
const NO_ACTIONS: ChatAction[] = [];
const rtlStyle = (rtl: boolean): TextStyle | null => (rtl ? { writingDirection: 'rtl', textAlign: 'right' } : null);

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

function TypingDots({ label }: { label: string }) {
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
    <View style={styles.typingRow} accessibilityLabel={label} accessibilityLiveRegion="polite" testID="assistant-typing">
      <View style={styles.typingDots}>
        {dots.map((v, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: v }]} />
        ))}
      </View>
      <Text style={styles.typingText}>{label}</Text>
    </View>
  );
}

function ProductCards({ products, lang, onOpen, onAdd }: { products: AssistantProduct[]; lang: Lang; onOpen: (slug: string) => void; onAdd: (slug: string) => void }) {
  const t = texts(lang);
  const rtl = rtlStyle(lang === 'ar');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardsScroll}>
      {products.map((p) => {
        const discount = p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : null;
        return (
          <Pressable key={p.slug} testID="assistant-card" style={styles.card} onPress={() => onOpen(p.slug)} accessibilityRole="link" accessibilityLabel={`${t.card.see} ${p.name}`}>
            <View style={styles.cardImageWrap}>
              {p.image ? (
                <Image source={{ uri: sizedImage(p.image, 400) }} style={styles.cardImage} contentFit="cover" transition={150} />
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
            <View style={styles.cardPriceRow}>
              <View style={styles.cardPriceCol}>
                <Text style={styles.cardPrice}>{formatXAF(p.price)}</Text>
                {discount && p.compare_at_price ? <Text style={styles.cardOldPrice}>{formatXAF(p.compare_at_price)}</Text> : null}
              </View>
            </View>
            {p.in_stock && typeof p.stock === 'number' && p.stock >= 1 && p.stock <= 5 ? (
              <Text style={[styles.cardLow, rtl]}>🔥 {p.stock === 1 ? t.card.last : t.card.only(p.stock)}</Text>
            ) : null}
            {/* « Commander » : Zara prend la commande de cet article tout de suite (plus de panier) */}
            {p.in_stock ? (
              <Pressable
                testID="assistant-card-add"
                onPress={() => onAdd(p.slug)}
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel={t.card.addLabel(p.name)}
                hitSlop={4}
              >
                <Text style={styles.addText}>{t.card.order}</Text>
              </Pressable>
            ) : null}
            {!p.in_stock ? <Text style={[styles.cardOut, rtl]}>{t.card.soldOut}</Text> : <Text style={[styles.cardSee, rtl]}>{t.card.see}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// `old` : les boutons d'un message précédent, gardés pour que le client puisse y revenir.
function ActionChips({ actions, onChoose, old = false }: { actions: ChatAction[]; onChoose: (action: ChatAction) => void; old?: boolean }) {
  return (
    <View style={styles.chips}>
      {actions.map((a) => {
        const whatsapp = a.kind === 'whatsapp';
        const ghost = a.kind === 'skip';
        return (
          <Pressable
            key={`${a.kind}-${a.label}`}
            testID={old ? 'assistant-chip-old' : 'assistant-chip'}
            style={[styles.chip, ghost && styles.chipGhost, a.highlight && styles.chipHighlight, whatsapp && styles.chipWhatsapp]}
            onPress={() => onChoose(a)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Text style={[styles.chipText, ghost && styles.chipTextGhost, a.highlight && styles.chipTextHighlight, whatsapp && styles.chipTextWhatsapp, rtlStyle(hasArabic(a.label))]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Une photo envoyée par Zara (ex. comment installer sur iPhone) : touchée, elle s'ouvre en grand dans un nouvel onglet.
function ChatPhoto({ image }: { image: ChatImage }) {
  return (
    <Pressable onPress={() => Linking.openURL(image.src)} accessibilityRole="imagebutton" accessibilityLabel={image.alt} testID="assistant-photo">
      <Image source={{ uri: image.src }} style={[styles.photo, { aspectRatio: image.ratio }]} contentFit="cover" accessibilityLabel={image.alt} />
    </Pressable>
  );
}

function Bubble({
  message,
  actions,
  old,
  onOpenProduct,
  onAdd,
  onChoose,
}: {
  message: ChatMessage;
  actions: ChatAction[];
  old: boolean;
  onOpenProduct: (slug: string) => void;
  onAdd: (slug: string) => void;
  onChoose: (action: ChatAction) => void;
}) {
  const mine = message.role === 'user';
  // Zara écrit de droite à gauche quand elle parle arabe ; ce que tape le visiteur suit ses propres lettres.
  const lang: Lang = message.lang === 'ar' ? 'ar' : 'fr';
  const rtl = mine ? hasArabic(message.text) : lang === 'ar';
  const textStyle: (TextStyle | null)[] = [styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextBot, rtlStyle(rtl)];
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
          {!mine && message.image ? <ChatPhoto image={message.image} /> : null}
          {!mine && message.products && message.products.length > 0 ? <ProductCards products={message.products} lang={lang} onOpen={onOpenProduct} onAdd={onAdd} /> : null}
        </View>
      </View>
      {!mine && actions.length > 0 ? <ActionChips actions={actions} onChoose={onChoose} old={old} /> : null}
    </View>
  );
}

export function AssistantPanel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const messages = useAssistantStore((s) => s.messages);
  const loading = useAssistantStore((s) => s.loading);
  const step = useAssistantStore((s) => s.step);
  const lang = useAssistantStore((s) => s.lang);
  const send = useAssistantStore((s) => s.send);
  const choose = useAssistantStore((s) => s.choose);
  const closeChat = useAssistantStore((s) => s.closeChat);
  const reset = useAssistantStore((s) => s.reset);
  const oldChips = useAssistantStore((s) => s.oldChips);
  const toggleLang = useAssistantStore((s) => s.toggleLang);
  const orderProduct = useAssistantStore((s) => s.orderProduct);
  const startCheckout = useAssistantStore((s) => s.startCheckout);

  const t = texts(lang);
  const desktop = width >= DESKTOP_WIDTH;
  const compact = !desktop && width < COMPACT_WIDTH;
  const area = useVisibleArea(!desktop);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const panelRef = useRef<View>(null);
  const appear = useRef(new Animated.Value(0)).current;

  // Le traducteur automatique de Google ne doit pas traduire Zara : elle parle déjà français et arabe.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = panelRef.current as unknown as HTMLElement | null;
    if (!el?.setAttribute) return;
    el.setAttribute('translate', 'no');
    el.classList.add('notranslate');
    el.setAttribute('lang', lang);
  }, [lang]);

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

  // « Terminer ma commande » : Zara vérifie l'article (prix, stock, compte) puis finalise la commande avec le client, dans la conversation.
  const checkout = () => {
    void startCheckout();
  };

  const onChoose = (action: ChatAction) => {
    switch (action.kind) {
      case 'whatsapp':
        // avec un message déjà écrit pour l'équipe (prix de gros...) si le bouton en porte un
        Linking.openURL(action.payload ? `${WHATSAPP_URL}?text=${encodeURIComponent(action.payload)}` : WHATSAPP_URL);
        return;
      case 'register':
        markIntent('signup', currentDevice()); // si le compte se crée, il sera compté « grâce à Zara »
        go(() => navigationRef.navigate('Register'));
        return;
      case 'login':
        go(() => navigationRef.navigate('Login'));
        return;
      case 'orders':
        go(() => navigationRef.navigate('Tabs', { screen: 'Orders' } as never));
        return;
      case 'account':
        go(() => navigationRef.navigate('Tabs', { screen: 'Account' } as never));
        return;
      // la catégorie elle-même s'affiche dans le chat (Zara) ; seul « Page » ouvre la page de la catégorie
      case 'categoryPage':
        if (action.payload) go(() => navigationRef.navigate('Category', { slug: action.payload as string }));
        return;
      // ancien bouton « Voir mon panier » : il n'y a plus de panier, la commande commencée reprend
      case 'cart':
      case 'checkout':
        checkout();
        return;
      case 'orderPage':
        go(() => navigationRef.navigate('Checkout')); // la page de commande du site, si le client préfère (l'article reste choisi)
        return;
      case 'link':
        if (action.payload) Linking.openURL(action.payload);
        return;
      case 'policy':
        go(() => navigationRef.navigate('ReturnPolicy'));
        return;
      case 'openChrome':
        openInChrome(); // navigateur de Facebook, WhatsApp... : la page s'ouvre dans Chrome pour pouvoir installer
        return;
      default:
        choose(action);
    }
  };

  const panelStyle = desktop
    ? { right: spacing.md, bottom: spacing.md, width: 400, height: Math.min(620, height - spacing.md * 2) }
    : { left: 0, right: 0, top: area?.top ?? 0, height: area?.height ?? height };

  const placeholder =
    step === 'ask_name' || step === 'cb_name'
      ? t.placeholder.name
      : step === 'ask_city' || step === 'co_city'
      ? t.placeholder.city
      : step === 'ask_budget'
      ? t.placeholder.amount
      : step === 'co_name'
      ? t.placeholder.fullName
      : step === 'co_phone' || step === 'cb_phone'
      ? t.placeholder.phone
      : step === 'co_address'
      ? t.placeholder.address
      : step === 'cb_day'
      ? t.placeholder.day
      : t.placeholder.message;
  const lastIndex = messages.length - 1;
  const rtl = lang === 'ar';

  return (
    <Animated.View
      ref={panelRef}
      style={[
        styles.panel,
        desktop ? styles.panelDesktop : null,
        panelStyle,
        { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
      accessibilityViewIsModal
      testID="assistant-panel"
    >
      <LinearGradient colors={[colors.panelAlt, colors.panel]} style={[styles.header, compact && styles.headerCompact, !desktop ? { paddingTop: spacing.sm + insets.top } : null]}>
        <View style={[styles.avatarRing, compact && styles.avatarRingCompact]}>
          <Image source={AVATAR} style={styles.headerAvatar} contentFit="cover" />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerName, compact && styles.headerNameCompact]} numberOfLines={1}>
            {ASSISTANT_NAME}
          </Text>
          <Text style={[styles.headerRole, rtlStyle(rtl)]} numberOfLines={1}>
            {t.roleTitle}
          </Text>
        </View>
        <Pressable
          onPress={toggleLang}
          disabled={loading}
          hitSlop={6}
          style={[styles.langButton, loading && styles.langButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t.ui.otherLang}
          testID="assistant-lang"
        >
          <Text style={[styles.langText, rtlStyle(!rtl)]}>{t.ui.otherLang}</Text>
        </Pressable>
        {messages.length > 0 && !loading ? (
          <Pressable onPress={reset} hitSlop={8} style={[styles.trashButton, compact && styles.roundCompact]} accessibilityRole="button" accessibilityLabel={t.ui.reset}>
            <Text style={styles.trashText}>🗑</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => Linking.openURL(WHATSAPP_URL)}
          hitSlop={8}
          style={compact ? [styles.headerWhatsappRound, styles.roundCompact] : styles.headerWhatsapp}
          accessibilityRole="link"
          accessibilityLabel={t.ui.whatsappAria}
        >
          <Text style={compact ? styles.headerWhatsappEmoji : styles.headerWhatsappText}>{compact ? '💬' : t.ui.whatsappPill}</Text>
        </Pressable>
        <Pressable onPress={closeChat} hitSlop={10} style={[styles.closeButton, compact && styles.roundCompact]} accessibilityRole="button" accessibilityLabel={t.ui.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {messages.map((m, i) => (
          <Bubble
            key={m.id}
            message={m}
            actions={loading || !m.actions ? NO_ACTIONS : i === lastIndex ? m.actions : oldChips(m.actions)}
            old={i !== lastIndex}
            onOpenProduct={openProduct}
            onAdd={orderProduct}
            onChoose={onChoose}
          />
        ))}

        {loading ? (
          <View style={[styles.row, styles.rowBot]}>
            <Image source={AVATAR} style={styles.smallAvatar} contentFit="cover" />
            <View style={[styles.bubble, styles.bubbleBot]}>
              <TypingDots label={t.ui.writing} />
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
          style={[styles.input, rtlStyle(rtl)]}
          maxLength={300}
          returnKeyType="send"
          keyboardType={step === 'co_phone' || step === 'cb_phone' ? 'phone-pad' : 'default'}
          blurOnSubmit={false}
          onSubmitEditing={() => submit(draft)}
          accessibilityLabel={t.ui.input}
        />
        <Pressable
          onPress={() => submit(draft)}
          disabled={!draft.trim() || loading}
          style={[styles.sendButton, (!draft.trim() || loading) && styles.sendButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t.ui.send}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
      <Text style={[styles.note, rtlStyle(rtl) && { writingDirection: 'rtl' }]}>{t.footer}</Text>
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
  headerCompact: { gap: 6, paddingHorizontal: 12 },
  avatarRingCompact: { width: 40, height: 40, borderRadius: 20 },
  headerNameCompact: { fontSize: 17 },
  roundCompact: { width: 32, height: 32, borderRadius: 16 },
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
  langButton: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: 'rgba(199,154,62,0.12)' },
  langButtonDisabled: { opacity: 0.5 },
  langText: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 12.5 },
  headerWhatsapp: { backgroundColor: '#25d366', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  headerWhatsappText: { color: '#06240f', fontFamily: fonts.bodyBold, fontSize: 12 },
  headerWhatsappRound: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#25d366' },
  headerWhatsappEmoji: { fontSize: 16 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  closeText: { color: colors.cream, fontSize: 15 },

  messages: { flex: 1 },
  messagesContent: { padding: spacing.md, gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowBot: { justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  smallAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.gold },
  bubbleColumn: { maxWidth: '82%', flexShrink: 1, gap: 8 },
  photo: { width: 280, maxWidth: '100%', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
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

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  typingDots: { flexDirection: 'row', gap: 5 },
  typingText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.goldLight },

  cardsScroll: { marginTop: 2 },
  cards: { gap: 10, paddingRight: spacing.md },
  card: { width: 158, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingBottom: 10 },
  cardImageWrap: { width: '100%', height: 130, backgroundColor: '#fff' },
  cardImage: { width: '100%', height: '100%' },
  cardNoImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelAlt },
  cardNoImageText: { fontSize: 30 },
  discountBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 },
  cardName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 17, paddingHorizontal: 9, marginTop: 8, minHeight: 34 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 9, marginTop: 4 },
  cardPriceCol: { flex: 1, minWidth: 0 },
  cardPrice: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  cardOldPrice: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, textDecorationLine: 'line-through' },
  addButton: {
    marginHorizontal: 9,
    marginTop: 8,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  addText: { color: '#1b1405', fontFamily: fonts.bodyBold, fontSize: 13 },
  cardSee: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12, paddingHorizontal: 9, marginTop: 6 },
  cardOut: { color: colors.error, fontFamily: fonts.bodySemiBold, fontSize: 12, paddingHorizontal: 9, marginTop: 6 },
  cardLow: { color: '#ffb347', fontFamily: fonts.bodySemiBold, fontSize: 11.5, paddingHorizontal: 9, marginTop: 5 },

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
