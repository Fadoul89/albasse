// Permet aux tests Node d'importer les fichiers de l'application (imports sans « .ts »).
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !path.extname(specifier) && context.parentURL) {
    const base = specifier.startsWith('/') ? specifier : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(base + ext)) return nextResolve(pathToFileURL(base + ext).href, context);
    }
  }
  return nextResolve(specifier, context);
}
