"""F8 report -> bot fixture: the pen-down stretches of reports/<id>.json as strokes in screen-height units.
usage: python tools/rep2fix.py r008   -> web/room/fixtures/r008.json ; replay: python tools/roomtest.py "" paint fix=r008"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rid = sys.argv[1]
d = json.load(open(os.path.join(ROOT, 'reports', rid + '.json'), encoding='utf-8'))
H = d['screen'][1]; strokes = []; cur = None
for r in d['log_T_mouseXY_eyeXY_neckV_eyeV_turn_pen']:
    if r[-1]:
        if cur is None: cur = []; strokes.append(cur)
        if not cur or abs(r[3] - cur[-1][0] * H) + abs(r[4] - cur[-1][1] * H) > 1.5: cur.append([round(r[3] / H, 4), round(r[4] / H, 4), r[6]])
    else: cur = None
strokes = [s for s in strokes if len(s) > 8]
json.dump(strokes, open(os.path.join(ROOT, 'web', 'room', 'fixtures', rid + '.json'), 'w'), separators=(',', ':'))
print(rid, 'strokes', [len(s) for s in strokes], 'paint', d.get('paint'), 'pace', d.get('pace'))
