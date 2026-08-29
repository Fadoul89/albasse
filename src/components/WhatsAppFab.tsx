import React from 'react';
import { Pressable, Text, StyleSheet, Linking } from 'react-native';
import { colors } from '../theme';

const WHATSAPP_URL = 'https://wa.me/23560605151';

export function WhatsAppFab() {
  return (
    <Pressable style={styles.fab} onPress={() => Linking.openURL(WHATSAPP_URL)}>
      <Text style={styles.fabIcon}>💬</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 84,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25d366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 900,
  },
  fabIcon: { fontSize: 24 },
});
