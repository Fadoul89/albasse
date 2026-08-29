import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  endsAt: string;
  onExpire?: () => void;
}

function getRemaining(endsAt: string) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { diff, hours, minutes, seconds };
}

const pad = (n: number) => n.toString().padStart(2, '0');

export function CountdownTimer({ endsAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => getRemaining(endsAt));

  useEffect(() => {
    const id = setInterval(() => {
      const r = getRemaining(endsAt);
      setRemaining(r);
      if (r.diff <= 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <View style={styles.row}>
      <TimeBlock value={pad(remaining.hours)} label="H" />
      <Text style={styles.sep}>:</Text>
      <TimeBlock value={pad(remaining.minutes)} label="M" />
      <Text style={styles.sep}>:</Text>
      <TimeBlock value={pad(remaining.seconds)} label="S" />
    </View>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  block: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 34,
  },
  value: { fontFamily: fonts.bodyBold, color: colors.goldLight, fontSize: 15 },
  label: { fontFamily: fonts.body, color: colors.creamFaint, fontSize: 8 },
  sep: { color: colors.gold, marginHorizontal: 4, fontFamily: fonts.bodyBold },
});
