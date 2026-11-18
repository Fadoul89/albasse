#!/usr/bin/env python3
"""Outils audio de la publicité (sans module externe : ffmpeg + wave).
  python3 audio_tools.py envelopes      -> audio/lines.json : durée et enveloppe (30 valeurs/s, 0..1) de chaque voix audio/<id>.mp3
  python3 audio_tools.py mix            -> audio/mix.wav : voix placées au bon moment, bruitages, musique en dessous (plus douce pendant les voix)
Fichiers attendus : audio/<id>.mp3 pour chaque réplique de script.json (l1 … l9, rire, vo), audio/music.mp3, audio/sfx-*.mp3."""
import json, os, subprocess, sys, wave, array, math
P = os.path.dirname(os.path.abspath(__file__))
A = f'{P}/audio'
FPS = 30

def decode(path, rate=16000):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(rate), '-f', 'wav', '-'], capture_output=True, check=True).stdout
    tmp = f'{A}/_tmp.wav'
    open(tmp, 'wb').write(out)
    w = wave.open(tmp)
    data = array.array('h', w.readframes(w.getnframes()))
    w.close(); os.remove(tmp)
    return data, rate

def envelope(path):
    data, rate = decode(path)
    n = len(data); win = rate // FPS
    env = []
    for i in range(0, n, win):
        chunk = data[i:i + win]
        if not chunk: break
        rms = math.sqrt(sum(x * x for x in chunk) / len(chunk)) / 32768
        env.append(rms)
    peak = max(env) or 1
    # lissage léger et normalisation : 1 = le plus fort de la réplique
    sm = [min(1.0, (env[i] * 0.6 + (env[i - 1] if i else env[i]) * 0.2 + (env[i + 1] if i + 1 < len(env) else env[i]) * 0.2) / peak) for i in range(len(env))]
    return round(n / rate, 3), [round(v, 2) for v in sm]

def cmd_envelopes():
    script = json.load(open(f'{P}/script.json'))
    out = {}
    for l in script['lines']:
        f = f'{A}/{l["id"]}.mp3'
        if not os.path.exists(f):
            print('manque', f); continue
        dur, env = envelope(f)
        out[l['id']] = {'file': f'audio/{l["id"]}.mp3', 'duration': dur, 'env': env}
        print(f'{l["id"]:5} {dur:5.2f} s')
    json.dump(out, open(f'{A}/lines.json', 'w'))
    print('audio/lines.json écrit ; relancez build_timeline.py')

def cmd_mix():
    tl = json.load(open(f'{P}/timeline.json'))
    total = tl['duration'] + 0.5
    inputs, filters, voices, sfx = [], [], [], []
    def add(path):
        inputs.extend(['-i', path]); return len(inputs) // 2 - 1
    # les voix
    for l in tl['lines']:
        f = f'{A}/{l["id"]}.mp3'
        if not os.path.exists(f): continue
        i = add(f)
        filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(l["start"] * 1000)}|{int(l["start"] * 1000)},volume=1.0[v{i}]')
        voices.append(f'[v{i}]')
    # les bruitages : nom -> (fichier, moments, volume)
    c = tl['cues']
    plan = {
        'sfx-whoosh': ([c['whoosh_s3'], c['whoosh_s5'], c['whoosh_s6']], 0.7),
        'sfx-unlock': ([c['phone_unlock']], 0.8),
        'sfx-typing': (c['type'], 0.55),
        'sfx-results': (c['results'], 0.6),
        'sfx-tap': ([c['tap_product'], c['tap_order']], 0.8),
        'sfx-confirm': ([c['confirm']], 0.9),
        'sfx-bell': ([c['bell']], 0.9),
        'sfx-taxi': ([0.3], 0.35),
    }
    for name, (times, vol) in plan.items():
        f = f'{A}/{name}.mp3'
        if not os.path.exists(f): continue
        for tm in times:
            i = add(f)
            filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(tm * 1000)}|{int(tm * 1000)},volume={vol}[s{i}]')
            sfx.append(f'[s{i}]')
    n_v = len(voices)
    filters.append(''.join(voices) + f'amix=inputs={n_v}:normalize=0[voices]')
    if sfx:
        filters.append(''.join(sfx) + f'amix=inputs={len(sfx)}:normalize=0[sfx]')
    # la musique : en boucle sur toute la durée, douce, plus basse quand une voix parle (sidechain), fondu à la fin
    m = f'{A}/music.mp3'
    if os.path.exists(m):
        i = add(m)
        filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,aloop=loop=-1:size=2e9,atrim=0:{total},volume=0.42,afade=t=in:d=0.8,afade=t=out:st={total - 2.5}:d=2.5[music0]')
        filters.append('[voices]asplit=2[vmix][vkey]')
        filters.append('[music0][vkey]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=500:makeup=1[music]')
        chain = '[vmix][music]' + ('[sfx]' if sfx else '') + f'amix=inputs={3 if sfx else 2}:normalize=0,alimiter=limit=0.95[out]'
    else:
        chain = '[voices]' + ('[sfx]' if sfx else '') + f'amix=inputs={2 if sfx else 1}:normalize=0,alimiter=limit=0.95[out]'
    filters.append(chain)
    cmd = ['ffmpeg', '-y', '-v', 'error'] + inputs + ['-filter_complex', ';'.join(filters), '-map', '[out]', '-t', str(total), '-ar', '48000', f'{A}/mix.wav']
    subprocess.run(cmd, check=True)
    print('audio/mix.wav écrit', f'({total:.1f} s)')

if __name__ == '__main__':
    {'envelopes': cmd_envelopes, 'mix': cmd_mix}[sys.argv[1]]()
