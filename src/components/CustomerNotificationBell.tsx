import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useCustomerNotifications } from '../hooks/useCustomerNotifications';
import { colors, fonts, radius } from '../theme';

export function CustomerNotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { unreadCount } = useCustomerNotifications();

  if (!profile) return null;

  return (
    <Pressable style={styles.frame} onPress={() => navigation.navigate('CustomerNotifications')} hitSlop={8}>
      <Text style={styles.bell}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bell: { fontSize: 14 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 9 },
});
