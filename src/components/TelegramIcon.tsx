// Icône Telegram dorée (couronne + liserés laurier, assortie au style doré du site) : image hébergée sur Cloudinary.
import React from 'react';
import { Image } from 'expo-image';

const TELEGRAM_ICON_GOLD_URL = 'https://res.cloudinary.com/c3sblcwg/image/upload/v1795900510/telegram_icon_gold.png';

export function TelegramIcon({ width = 30 }: { width?: number }) {
  return (
    <Image
      accessibilityLabel="Telegram"
      source={{ uri: TELEGRAM_ICON_GOLD_URL }}
      style={{ width, height: width }}
      contentFit="contain"
    />
  );
}
