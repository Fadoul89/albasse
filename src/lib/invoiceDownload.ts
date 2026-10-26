// « Télécharger ma facture » : le site demande la facture PDF à la fonction serveur « order-invoice » (supabase/functions/order-invoice) avec le jeton
// de connexion du client. La fonction ne donne la facture qu'au compte qui a passé la commande (ou à l'administrateur) : sans compte, rien.
// Quand le PDF ne peut pas être téléchargé (application sans navigateur, fonction pas encore en ligne, réseau coupé), la facture s'ouvre à l'écran
// (page « Facture », avec son bouton d'impression) : le client n'a jamais une impasse.
import { supabase, isSupabaseConfigured } from './supabase';
import { navigationRef } from '../navigation/navigationRef';
import { useToastStore } from '../store/toastStore';

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/order-invoice`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type InvoiceDownload = 'ok' | 'login' | 'unavailable';

// le nom du fichier annoncé par le serveur (« Facture-FA-2026-000012.pdf »), sinon un nom simple avec le début du numéro de commande
export function invoiceFileName(disposition: string | null | undefined, orderId: string): string {
  const m = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  const name = m?.[1]?.trim();
  return name && /^[\w.\- ]+$/.test(name) ? name : `Facture-${orderId.slice(0, 8)}.pdf`;
}

export async function downloadInvoicePdf(orderId: string): Promise<InvoiceDownload> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return 'unavailable'; // pas de navigateur : la facture s'ouvre à l'écran
  if (!isSupabaseConfigured) return 'unavailable';
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'login';
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      body: JSON.stringify({ action: 'pdf', order_id: orderId }),
    });
    if (res.status === 401) return 'login';
    if (!res.ok) return 'unavailable';
    const blob = await res.blob();
    if (blob.size === 0) return 'unavailable';
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = invoiceFileName(res.headers.get('Content-Disposition'), orderId);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

// Le geste complet pour un bouton : télécharge, sinon explique ou ouvre la facture à l'écran (openScreen : le chat de Zara se ferme d'abord, pour que la page se voie).
export async function downloadOrOpenInvoice(orderId: string, openScreen?: () => void): Promise<void> {
  const toast = useToastStore.getState().show;
  const result = await downloadInvoicePdf(orderId);
  if (result === 'ok') {
    toast('Votre facture est dans vos téléchargements.', { title: '📄 Facture téléchargée', type: 'success' });
  } else if (result === 'login') {
    toast('Connectez-vous avec le compte qui a passé la commande.', { title: 'Facture', type: 'error' });
  } else if (openScreen) {
    openScreen();
  } else if (navigationRef.isReady()) {
    navigationRef.navigate('Invoice', { orderId });
  }
}
