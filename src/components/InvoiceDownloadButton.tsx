// Bouton « Télécharger ma facture » (confirmation de commande, page Facture) : un toucher = la facture PDF de cette commande (lib/invoiceDownload).
import React, { useState } from 'react';
import type { ViewStyle } from 'react-native';
import { GoldButton } from './GoldButton';
import { downloadOrOpenInvoice } from '../lib/invoiceDownload';

interface Props {
  orderId: string;
  variant?: 'gold' | 'outline';
  style?: ViewStyle;
}

export function InvoiceDownloadButton({ orderId, variant = 'gold', style }: Props) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadOrOpenInvoice(orderId);
    } finally {
      setBusy(false);
    }
  };
  return <GoldButton label="📄 Télécharger ma facture" onPress={press} loading={busy} variant={variant} style={style} />;
}
