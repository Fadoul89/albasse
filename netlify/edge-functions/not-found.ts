// Vraie page 404 : une adresse qui n'existe pas reçoit le CODE 404 (avant : la page d'accueil avec le code 200).
// Le visiteur voit la page « Introuvable » de l'application (écran NotFound) ; Google comprend que l'adresse n'existe pas.
// Cette fonction regarde la réponse normale du site (context.next()) et ne change QUE le code et deux en-têtes :
// fichiers, images, scripts, pages connues et réponses des autres fonctions ne sont jamais modifiés. Au moindre doute, la réponse normale est renvoyée.
import type { Context } from 'https://edge.netlify.com';
import { isKnownPath, looksLikeFile } from './lib/routes.ts';

export default async (request: Request, context: Context): Promise<Response> => {
  const res = await context.next();
  try {
    // site « page unique » (docs/site-cafe-separe.md) : rien à faire
    if (Deno.env.get('EXPO_PUBLIC_SINGLE_PAGE')) return res;
    if (request.method !== 'GET' && request.method !== 'HEAD') return res;
    const { pathname } = new URL(request.url);
    if (isKnownPath(pathname) || looksLikeFile(pathname)) return res;
    // seulement la coquille de l'application (page HTML, code 200) : une redirection, une erreur ou un fichier restent tels quels
    if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('text/html')) return res;
    const headers = new Headers(res.headers);
    headers.set('x-robots-tag', 'noindex');
    headers.set('cache-control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : res.body, { status: 404, statusText: 'Not Found', headers });
  } catch {
    return res;
  }
};
