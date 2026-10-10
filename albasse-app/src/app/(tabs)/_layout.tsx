import { Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, fonts, radius } from '../../theme';
import { useCartTotalItems } from '../../store/cartStore';

const ICONS: Record<string, string> = { index: '🏠', search: '🔍', cart: '🛒', profile: '👤' };
const LABELS: Record<string, string> = { index: 'Accueil', search: 'Recherche', cart: 'Panier', profile: 'Compte' };

export default function TabsLayout() {
  const cartCount = useCartTotalItems();

  return (
    <Tabs
      screenOptions={({ route }) => {
        const isCart = route.name === 'cart';
        const isAccount = route.name === 'profile';
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.creamFaint,
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
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: isCart ? '#3b9eff' : isAccount ? colors.gold : focused ? colors.gold : colors.creamFaint,
                fontFamily: focused || isCart || isAccount ? fonts.bodySemiBold : fonts.bodyMedium,
                fontSize: 11.5,
                marginTop: 2,
              }}
            >
              {LABELS[route.name]}
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                { width: 44, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
                isCart ? { backgroundColor: '#3b9eff' } : isAccount ? { backgroundColor: colors.gold } : focused && { backgroundColor: colors.gold + '26' },
              ]}
            >
              <Text style={{ fontSize: focused ? 26 : 23 }}>{ICONS[route.name]}</Text>
            </View>
          ),
          tabBarBadge: isCart && cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red, color: colors.cream, fontSize: 11, minWidth: 18, height: 18, borderRadius: 9 },
        };
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
