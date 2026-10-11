import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCities } from '../hooks/useCities';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import type { City } from '../types/city';

interface CityPickerProps {
  value: string;
  onChange: (value: string, city: City | null) => void;
  showDeliveryInfo?: boolean;
}

export function CityPicker({ value, onChange, showDeliveryInfo = false }: CityPickerProps) {
  const { cities } = useCities();
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, query]);

  const selectedCity = useMemo(() => cities.find((c) => c.name === value) ?? null, [cities, value]);

  const selectCity = (city: City) => {
    setQuery(city.name);
    onChange(city.name, city);
    setIsOpen(false);
  };

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setIsOpen(true);
          if (!t) onChange('', null);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="📍 Rechercher une ville…"
        placeholderTextColor={colors.creamFaint}
        style={styles.input}
      />
      {isOpen && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.map((city) => (
              <Pressable key={city.id} style={styles.option} onPress={() => selectCity(city)}>
                <Text style={styles.optionText}>{city.name}</Text>
                {showDeliveryInfo && (
                  <Text style={styles.optionFee}>
                    {city.delivery_fee === null ? 'À définir' : city.delivery_fee === 0 ? 'Gratuit' : formatXAF(city.delivery_fee)}
                  </Text>
                )}
              </Pressable>
            ))}
            {filtered.length === 0 && <Text style={styles.noResult}>Aucune ville trouvée.</Text>}
          </ScrollView>
        </View>
      )}
      {showDeliveryInfo && selectedCity && !isOpen && (
        <View style={styles.deliveryBox}>
          <Text style={styles.deliveryLine}>
            🚚 Livraison :{' '}
            {selectedCity.delivery_fee === null
              ? 'À définir'
              : selectedCity.delivery_fee === 0
              ? 'Gratuite — 0 FCFA'
              : formatXAF(selectedCity.delivery_fee)}
          </Text>
          {selectedCity.delivery_agency && <Text style={styles.deliveryLine}>🏢 Expédition : {selectedCity.delivery_agency}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  dropdown: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 220 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13 },
  optionFee: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 11 },
  deliveryBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: -4,
    marginBottom: spacing.sm,
    gap: 4,
  },
  deliveryLine: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12 },
  noResult: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, padding: 14, textAlign: 'center' },
});
