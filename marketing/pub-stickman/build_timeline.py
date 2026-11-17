#!/usr/bin/env python3
"""Construit timeline.json : le minutage des 6 scènes, des répliques et des bruitages.
Les durées viennent des vraies voix (audio/lines.json, écrit par make_audio.py) ; sans voix : une estimation (pour l'aperçu muet).
Lancer : python3 build_timeline.py   (depuis le dossier du projet)"""
import json, os
P = os.path.dirname(os.path.abspath(__file__))
script = json.load(open(f'{P}/script.json'))
audio_path = f'{P}/audio/lines.json'
audio = json.load(open(audio_path)) if os.path.exists(audio_path) else {}

def estimate(text):  # ~14 lettres par seconde en français
    return max(1.2, round(len(text) * 0.06, 2))

lines = {}
for l in script['lines']:
    a = audio.get(l['id'])
    dur = a['duration'] if a else (2.0 if l.get('laugh') else estimate(l['text']))
    lines[l['id']] = {**l, 'dur': round(dur, 3), 'env': a['env'] if a else None, 'file': a['file'] if a else None}

t = 0.0
scenes = {}
def place(scene, order, lead, gaps, tail, min_dur=0.0):
    """Pose les répliques d'une scène l'une après l'autre : lead (silence avant), gaps (entre), tail (après)."""
    global t
    start = t
    cur = start + lead
    for i, lid in enumerate(order):
        lines[lid]['start'] = round(cur, 3)
        lines[lid]['end'] = round(cur + lines[lid]['dur'], 3)
        cur = lines[lid]['end'] + (gaps[i] if i < len(gaps) else 0)
    end = max(cur + tail, start + min_dur)
    scenes[scene] = {'id': scene, 'start': round(start, 3), 'end': round(end, 3)}
    t = end

# scène 1 : la rue, ils marchent, le client se plaint
place(1, ['l1'], lead=1.7, gaps=[], tail=0.5)
# scène 2 : la solution
place(2, ['l2', 'l3', 'l4'], lead=0.2, gaps=[0.45, 0.45], tail=0.4)
# scène 3 : le téléphone, la recherche (4 mots tapés) : au moins 9,6 s
place(3, ['l5'], lead=0.9, gaps=[], tail=0.8, min_dur=9.8)
# scène 4 : la commande (le parcours de commande dure 4,2 s après le début de l7)
s4_start = t
place(4, ['l6', 'l7'], lead=0.3, gaps=[0.4], tail=0.6)
scenes[4]['end'] = round(max(scenes[4]['end'], lines['l7']['start'] + 4.9), 3)
t = scenes[4]['end']
# scène 5 : le livreur (il arrive en 1,3 s, sonnette), puis les rires
place(5, ['l8', 'l9', 'rire'], lead=1.5, gaps=[0.5, 0.3], tail=0.4)
# scène 6 : le grand final, la voix off, puis la bannière reste
place(6, ['vo'], lead=0.8, gaps=[], tail=2.2)

s3 = scenes[3]
type_start = s3['start'] + 1.0
cycle = min(2.6, max(2.0, (s3['end'] - type_start - 0.3) / 4))
order_t0 = lines['l7']['start'] + 0.9
cues = {
    'whoosh_s3': s3['start'],
    'phone_unlock': s3['start'] + 0.25,
    'type_cycle': round(cycle, 3),
    'type': [round(type_start + i * cycle, 3) for i in range(4)],
    'results': [round(type_start + i * cycle + 0.75, 3) for i in range(4)],
    'tap_product': round(order_t0, 3),
    'tap_order': round(order_t0 + 1.3, 3),
    'confirm': round(order_t0 + 2.9, 3),
    'whoosh_s5': scenes[5]['start'],
    'courier_in': [scenes[5]['start'] + 0.15, scenes[5]['start'] + 1.25],
    'bell': scenes[5]['start'] + 1.15,
    'whoosh_s6': scenes[6]['start'],
}
out = {'fps': 30, 'duration': round(t, 3), 'scenes': [scenes[k] for k in sorted(scenes)], 'lines': [lines[l['id']] for l in script['lines']], 'cues': cues}
json.dump(out, open(f'{P}/timeline.json', 'w'), ensure_ascii=False)
# la même chose en JS : la page est ouverte en file://, où fetch() est interdit
open(f'{P}/timeline.js', 'w').write('window.TIMELINE = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(f"durée totale : {t:.1f} s")
for s in out['scenes']:
    print(f"  scène {s['id']} : {s['start']:.1f} → {s['end']:.1f}")
for l in out['lines']:
    print(f"    {l['id']:5} {l['speaker']:8} {l['start']:5.1f} → {l['end']:5.1f}  ({'voix' if l['file'] else 'estimé'})")
