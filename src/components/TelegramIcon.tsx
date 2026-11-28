// Le rond bleu Telegram avec son avion en papier : pas d'image à charger (même esprit que YoutubeIcon).
import React from 'react';
import { View, Text } from 'react-native';

export function TelegramIcon({ width = 30 }: { width?: number }) {
  return (
    <View style={{ width, height: width, borderRadius: width / 2, backgroundColor: '#229ED9', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: Math.round(width * 0.5) }}>✈️</Text>
    </View>
  );
}
