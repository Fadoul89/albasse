import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { TabParamList } from './types';
import { colors, fonts, radius } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CartScreen } from '../screens/CartScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { useCartStore } from '../store/cartStore';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, string> = {
  Home: '🏠',
  Search: '🔍',
  Cart: '🛒',
  Account: '👤',
};

const LABELS: Record<keyof TabParamList, string> = {
  Home: 'Accueil',
  Search: 'Recherche',
  Cart: 'Panier',
  Account: 'Compte',
};

export function TabNavigator() {
  const count = useCartStore((s) => s.count());

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.panelAlt,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          height: 78,
          paddingBottom: 12,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 10,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.creamFaint,
        tabBarLabel: ({ color, focused }) => (
          <Text
            style={{
              color,
              fontFamily: focused ? fonts.bodySemiBold : fonts.bodyMedium,
              fontSize: 11.5,
              marginTop: 2,
            }}
          >
            {LABELS[route.name as keyof TabParamList]}
          </Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
            <Text style={{ fontSize: focused ? 26 : 23 }}>
              {ICONS[route.name as keyof TabParamList]}
            </Text>
          </View>
        ),
        tabBarBadge:
          route.name === 'Cart' && count > 0 ? count : undefined,
        tabBarBadgeStyle: {
          backgroundColor: colors.red,
          color: colors.cream,
          fontSize: 11,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.gold + '26',
  },
});
