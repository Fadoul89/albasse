// Photo → article (règles pures, testées sans navigateur : tests/zara/zara-skills.test.ts).
// La photo est réduite sur le téléphone avant l'envoi : 1024 px au plus pour Zara, 360 px pour l'aperçu dans le chat.
export const PHOTO_SIDE = 1024;
export const THUMB_SIDE = 360;
// même limite que la fonction serveur (supabase/functions/zara-ai/skills.ts, PHOTO_MAX_BASE64)
export const PHOTO_MAX_BASE64 = 1_500_000;

// Réduction à faire pour que le plus grand côté tienne dans max : null si l'image est déjà assez petite (ou de taille inconnue).
export function fitSide(width: number, height: number, max: number): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0) || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

// Le message d'un client pour Zara IA : une photo envoyée sans texte compte comme « (photo envoyée) » dans l'historique.
export function historyText(m: { role: 'user' | 'assistant'; text: string; image?: unknown }): string {
  if (m.text) return m.text;
  return m.role === 'user' && m.image ? '(photo envoyée)' : '';
}

// Le bouton 📷 n'est pas proposé au milieu d'une commande, d'une demande de rappel ou pendant les premières questions (langue, prénom).
export function photoAllowed(step: string): boolean {
  return !step.startsWith('co_') && !step.startsWith('cb_') && step !== 'ask_lang' && step !== 'ask_name';
}
