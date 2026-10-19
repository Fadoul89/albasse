// Compte obligatoire à l'entrée du site (réglage store_settings.account_required, interrupteur sur la page admin « Clients »).
// Restent ouvertes sans compte : connexion, inscription, mot de passe oublié, confidentialité, conditions de retour et contact.
// Les robots de Google et Facebook voient le site (articles trouvés sur Google, aperçus des liens partagés).
export const WALL_FREE_ROUTES = ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'PrivacyPolicy', 'ReturnPolicy', 'Contact'];

// noms précis seulement (« bot » seul attraperait des téléphones comme les Cubot)
const CRAWLER =
  /googlebot|adsbot-google|mediapartners-google|google-inspectiontool|bingbot|yandexbot|duckduckbot|baiduspider|applebot|petalbot|ahrefsbot|semrushbot|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|whatsapp\/|lighthouse/i;

export const isCrawler = (userAgent: string | null | undefined) => !!userAgent && CRAWLER.test(userAgent);

// Visiteur sans compte alors que le compte est obligatoire (on attend de savoir s'il est connecté et ce que dit le réglage).
export function mustSignUp(input: {
  required: boolean | null | undefined;
  settingsLoading: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  userAgent?: string | null;
}): boolean {
  if (input.settingsLoading || input.authLoading || input.isAuthenticated) return false;
  if (input.required !== true) return false;
  return !isCrawler(input.userAgent);
}

// L'écran « Créez votre compte » couvre la page, sauf sur les pages ouvertes sans compte.
export const wallCovers = (routeName: string | null | undefined) => !routeName || !WALL_FREE_ROUTES.includes(routeName);
