import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { ADMIN_MENU_GROUPS } from '../constants/adminMenu';
import { colors, fonts, radius, spacing } from '../theme';

// Toutes les pages de l'administration sur le tableau de bord, rangées par thème : rapports, clients, marketing, boutique, paramètres.
export function AdminMenuGroups() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.wrap} testID="admin-menu">
      {ADMIN_MENU_GROUPS.map((g) => (
        <View key={g.key} style={styles.group} testID={`admin-menu-group-${g.key}`}>
          <Text style={styles.groupTitle}>{`${g.icon} ${g.title}`}</Text>
          <View style={styles.items}>
            {g.items.map((it) => (
              <Pressable
                key={it.route}
                onPress={() => navigation.navigate(it.route)}
                accessibilityRole="button"
                accessibilityLabel={it.label}
                style={styles.item}
                testID={`admin-menu-${it.route}`}
              >
                <Text style={styles.itemIcon}>{it.icon}</Text>
                <Text style={styles.itemLabel}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: spacing.lg },
  group: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8 },
  groupTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.panelAlt, borderWidth: 1, borderColor: colors.border },
  itemIcon: { fontSize: 14 },
  itemLabel: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12.5, flexShrink: 1 },
});
