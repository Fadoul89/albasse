import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  rating: number;
  size?: number;
  showValue?: boolean;
  reviewCount?: number;
}

export function StarRating({ rating, size = 13, showValue, reviewCount }: Props) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((s) => (
        <Text key={s} style={{ fontSize: size, color: s <= Math.round(rating) ? colors.gold : colors.creamFaint }}>
          ★
        </Text>
      ))}
      {showValue && <Text style={styles.value}>{rating.toFixed(1)}</Text>}
      {reviewCount !== undefined && <Text style={styles.count}>({reviewCount})</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { fontFamily: fonts.bodySemiBold, color: colors.cream, fontSize: 12, marginLeft: 4 },
  count: { fontFamily: fonts.body, color: colors.creamFaint, fontSize: 12, marginLeft: 2 },
});
