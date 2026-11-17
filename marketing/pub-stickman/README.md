# Publicité animée Stickman – Albasse Shopping

Production publicitaire indépendante du site (rien ici n'est chargé par le site). Vidéo 2D animée, 9:16 (1080 × 1920), 3 personnages Stickman
dessinés en vectoriel (mêmes traits dans toutes les scènes), 6 scènes, téléphone avec les **vrais** articles du site, sous-titres intégrés.

## Comment c'est fait
- `index.html` + `src/pub.js` : la composition. Tout est une fonction du temps : `window.seek(ms)` place chaque image.
  `makeStickman('client' | 'ami' | 'livreur')` dessine un personnage ; les poses sont des angles (`POSE`) fondus dans le temps.
- `script.json` : les répliques. `build_timeline.py` : le minutage des scènes et des bruitages (`timeline.json` / `timeline.js`),
  à partir des vraies durées des voix (`audio/lines.json`) ou, sans voix, d'une estimation.
- `render.js` : rend les images (Chromium, image par image) ; `ffmpeg` les assemble. `still.js` : images de contrôle.
- `audio_tools.py envelopes` : durée et enveloppe de chaque voix (pour la bouche des personnages) ; `audio_tools.py mix` : le mixage
  (voix au bon moment, bruitages, musique plus douce pendant les voix).
- `assets/` : le vrai logo (`assets/logo.jpg` du site), les polices (Fraunces du site, Inter du système), les photos des articles lues sur le site.

## Fabriquer la vidéo
```
python3 build_timeline.py
NODE_PATH=/opt/node-tools/node_modules node render.js frames/final 30 1
python3 audio_tools.py mix
ffmpeg -framerate 30 -i frames/final/f%05d.jpg -i audio/mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out/albasse-pub-stickman.mp4
```
Aperçu rapide muet : `node render.js frames/apercu 15 0.5` puis `ffmpeg -framerate 15 -i frames/apercu/f%05d.jpg -c:v libx264 -crf 24 -pix_fmt yuv420p out/apercu.mp4`.
