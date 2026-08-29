import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useCities } from '../hooks/useCities';
import { colors, fonts, radius, spacing } from '../theme';
import type { City } from '../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

interface CityPickerProps {
  value: string;
  onChange: (value: string, city: City | null) => void;
  placeholder?: string;
  showDeliveryInfo?: boolean;
}

export function CityPicker({
  value,
  onChange,
  placeholder = 'Rechercher une ville...',
  showDeliveryInfo = false,
}: CityPickerProps) {
  const { cities } = useCities();
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isOtherCity, setIsOtherCity] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, query]);

  const selectedCity = useMemo(
    () => cities.find((c) => c.name === value) ?? null,
    [cities, value]
  );

  const selectCity = (city: City) => {
    setQuery(city.name);
    onChange(city.name, city);
    setIsOpen(false);
  };

  const selectOther = () => {
    setIsOtherCity(true);
    setIsOpen(false);
    setQuery('');
    onChange('', null);
  };

  const backToList = () => {
    setIsOtherCity(false);
    setQuery('');
    onChange('', null);
  };

  if (isOtherCity) {
    return (
      <View>
        <View style={styles.otherHeader}>
          <Text style={styles.otherLabel}>Ville : Autre</Text>
          <Pressable onPress={backToList}>
            <Text style={styles.otherBack}>← Choisir dans la liste</Text>
          </Pressable>
        </View>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t, null)}
          placeholder="Veuillez préciser votre ville"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
      </View>
    );
  }

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={`📍 ${placeholder}`}
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
            {filtered.length === 0 && (
              <Text style={styles.noResult}>Aucune ville trouvée.</Text>
            )}
            <Pressable style={styles.otherOption} onPress={selectOther}>
              <Text style={styles.otherOptionText}>➕ Autre ville</Text>
            </Pressable>
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
          <Text style={styles.deliveryLine}>
            🏢 Expédition : {selectedCity.delivery_agency ?? 'À définir'}
          </Text>
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
  otherOption: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.panelAlt },
  otherOptionText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  otherHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  otherLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  otherBack: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
