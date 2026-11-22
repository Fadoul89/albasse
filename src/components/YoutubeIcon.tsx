// Le logo « lecture » de YouTube (rectangle arrondi + triangle), dessiné : pas d'image à charger.
import React from 'react';
import { View } from 'react-native';

export function YoutubeIcon({ width = 30, inverted = false }: { width?: number; inverted?: boolean }) {
  const h = Math.round(width * 0.7);
  const t = Math.round(width * 0.3);
  return (
    <View style={{ width, height: h, borderRadius: Math.round(width * 0.22), backgroundColor: inverted ? '#ffffff' : '#ff0000', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: Math.round(t * 0.25),
          borderLeftWidth: t,
          borderTopWidth: Math.round(t * 0.62),
          borderBottomWidth: Math.round(t * 0.62),
          borderLeftColor: inverted ? '#ff0000' : '#ffffff',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
        }}
      />
    </View>
  );
}
