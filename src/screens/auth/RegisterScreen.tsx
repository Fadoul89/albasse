import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { RegisterForm } from '../../components/RegisterForm';

export function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const afterSignUp = () => {
    // la page demandée à l'arrivée sur le site a déjà été rouverte (RootNavigator) : on n'y touche pas
    if (!navigation.isFocused()) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Créer un compte" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <RegisterForm onSuccess={afterSignUp} onPrivacy={() => navigation.navigate('PrivacyPolicy')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 60 },
});
