import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { SCHEDULED_DELIVERY } from '../constants/shopRules';
import { dayOptions, formatSlot, slotToIso, slotsOfDay, timeLabel } from '../lib/scheduledDelivery';
import type { DeliveryType } from '../types';

interface Props {
  type: DeliveryType;
  day: string | null; // « 2026-10-31 »
  time: string | null; // « 14:30 »
  onType: (type: DeliveryType) => void;
  onDay: (day: string) => void;
  onTime: (time: string) => void;
  now?: number;
}

// Choix du type de livraison pour un client de N'Djamena : normale, ou programmée à un jour et une heure (heure de N'Djamena).
// Les créneaux possibles viennent de src/lib/scheduledDelivery.ts ; la base revérifie le rendez-vous à l'enregistrement.
export function ScheduledDeliveryPicker({ type, day, time, onType, onDay, onTime, now = Date.now() }: Props) {
  const days = dayOptions(now);
  const slots = day ? slotsOfDay(day, now) : [];
  const iso = day && time ? slotToIso(day, time) : null;
  const first = SCHEDULED_DELIVERY.firstSlot;
  const last = SCHEDULED_DELIVERY.lastSlot;

  return (
    <View testID="delivery-picker">
      <Pressable
        style={[styles.option, type === 'standard' && styles.optionActive]}
        onPress={() => onType('standard')}
        accessibilityRole="radio"
        accessibilityState={{ selected: type === 'standard' }}
        aria-checked={type === 'standard'}
        testID="delivery-standard"
      >
        <Text style={styles.icon}>🚚</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Livraison normale</Text>
          <Text style={styles.optionSub}>Nous vous livrons dès que votre commande est prête</Text>
        </View>
        <View style={[styles.radio, type === 'standard' && styles.radioActive]} />
      </Pressable>

      <Pressable
        style={[styles.option, type === 'scheduled' && styles.optionActive]}
        onPress={() => onType('scheduled')}
        accessibilityRole="radio"
        accessibilityState={{ selected: type === 'scheduled' }}
        aria-checked={type === 'scheduled'}
        testID="delivery-scheduled"
      >
        <Text style={styles.icon}>📅</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Livraison programmée</Text>
          <Text style={styles.optionSub}>Vous choisissez le jour et l’heure du rendez-vous</Text>
        </View>
        <View style={[styles.radio, type === 'scheduled' && styles.radioActive]} />
      </Pressable>

      {type === 'scheduled' ? (
        <View style={styles.box} testID="delivery-schedule-box">
          <Text style={styles.label}>Jour du rendez-vous</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d) => (
              <Pressable
                key={d.key}
                style={[styles.chip, day === d.key && styles.chipActive]}
                onPress={() => onDay(d.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: day === d.key }}
                testID={`sched-day-${d.key}`}
              >
                <Text style={[styles.chipText, day === d.key && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Heure du rendez-vous</Text>
          {day ? (
            <View style={styles.slotGrid}>
              {slots.map((s) => (
                <Pressable
                  key={s.time}
                  style={[styles.chip, time === s.time && s.available && styles.chipActive, !s.available && styles.chipOff]}
                  onPress={() => s.available && onTime(s.time)}
                  disabled={!s.available}
                  accessibilityRole="button"
                  accessibilityState={{ selected: time === s.time, disabled: !s.available }}
                  testID={`sched-time-${s.time}`}
                >
                  <Text style={[styles.chipText, time === s.time && s.available && styles.chipTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>Choisissez d’abord le jour.</Text>
          )}

          {iso ? (
            <Text style={styles.summary} testID="sched-summary">{`✅ Rendez-vous : ${formatSlot(iso, now)}`}</Text>
          ) : null}
          <Text style={styles.hint}>
            {`Rendez-vous de ${timeLabel(first)} à ${timeLabel(last)}, au moins ${SCHEDULED_DELIVERY.minLeadMinutes / 60} h après votre commande. Soyez disponible à l’heure choisie pour recevoir votre colis.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  optionActive: { borderColor: colors.gold },
  icon: { fontSize: 22 },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
  optionSub: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.creamFaint },
  radioActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  box: { backgroundColor: colors.panelAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 8 },
  dayRow: { gap: 8, paddingRight: 8 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  chipOff: { opacity: 0.3 },
  chipText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  summary: { color: colors.success, fontFamily: fonts.bodySemiBold, fontSize: 14, marginTop: spacing.md },
  hint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
});
