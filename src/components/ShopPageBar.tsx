import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { pageItems, pageRange } from '../lib/pagination';

// Les pages d'une liste d'articles de la boutique (demande du patron, 16 novembre 2026 : « bouton page suivante, 1 2 3 ») :
// « ‹ 1 2 3 … 6 › », un gros bouton « Page suivante › », et « Page 1 sur 6 · articles 1–20 sur 112 ».
// Rien ne s'affiche quand tout tient sur une seule page. 5 numéros au plus : la barre tient sur un téléphone de 360 px.
export function ShopPageBar({ current, count, total, size, onGo, testID = 'shop-pages' }: { current: number; count: number; total: number; size: number; onGo: (page: number) => void; testID?: string }) {
  if (count <= 1) return null;
  const range = pageRange(current, total, size);
  return (
    <View style={styles.bar} testID={testID}>
      <View style={styles.row}>
        <Pressable testID={`${testID}-prev`} role="button" aria-label="Page précédente" aria-disabled={current <= 1} disabled={current <= 1} style={[styles.btn, current <= 1 && styles.btnOff]} onPress={() => onGo(current - 1)}>
          <Text style={styles.btnText}>‹</Text>
        </Pressable>
        {pageItems(current, count, 5).map((it, i) =>
          typeof it === 'number' ? (
            <Pressable key={it} testID={`${testID}-${it}`} role="button" aria-label={`Page ${it}`} aria-current={it === current ? 'page' : undefined} style={[styles.btn, it === current && styles.btnActive]} onPress={() => it !== current && onGo(it)}>
              <Text style={[styles.btnText, it === current && styles.btnTextActive]}>{it}</Text>
            </Pressable>
          ) : (
            <Text key={`${it}-${i}`} style={styles.gap}>
              …
            </Text>
          )
        )}
        <Pressable testID={`${testID}-next`} role="button" aria-label="Page suivante" aria-disabled={current >= count} disabled={current >= count} style={[styles.btn, current >= count && styles.btnOff]} onPress={() => onGo(current + 1)}>
          <Text style={styles.btnText}>›</Text>
        </Pressable>
      </View>
      {current < count ? (
        <Pressable testID={`${testID}-next-big`} role="button" style={({ pressed }) => [styles.nextBig, pressed && { opacity: 0.85 }]} onPress={() => onGo(current + 1)}>
          <Text style={styles.nextBigText}>Page suivante ›</Text>
        </Pressable>
      ) : null}
      {range ? (
        <Text style={styles.info} testID={`${testID}-info`}>
          {`Page ${current} sur ${count} · articles ${range.from}–${range.to} sur ${range.total}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: spacing.lg, alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  btn: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  btnActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  btnOff: { opacity: 0.35 },
  btnText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  btnTextActive: { color: colors.background },
  gap: { color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 15, paddingHorizontal: 2 },
  nextBig: { alignSelf: 'stretch', backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  nextBigText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 15 },
  info: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12.5, textAlign: 'center' },
});
