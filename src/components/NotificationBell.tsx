import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import { colors, fonts } from '../theme';

export function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useAdminNotifications(true);

  return (
    <Pressable onPress={() => navigation.navigate('AdminNotifications')} hitSlop={10}>
      <View>
        <Text style={styles.bell}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -4,
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
