"""Room self-test: serves web/ on 8097, opens the room headless with ?bot=1 (web/room/bot.js), waits for reports/bot.json.
usage: python tools/roomtest.py ['{"turn":20,"rho":1.4}']   (optional settings override, JSON)"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, PORT = os.path.join(ROOT, 'reports', 'bot.json'), 8097
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
if os.path.exists(OUT): os.remove(OUT)
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tools', 'devserver.py'), str(PORT)])
prof = tempfile.mkdtemp(prefix='roomtest-')
q = '?bot=1' + ('&set=' + urllib.parse.quote(sys.argv[1]) if len(sys.argv) > 1 else '')
ch = subprocess.Popen([CHROME, '--headless=new', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--window-size=1936,1175', f'--user-data-dir={prof}', f'http://127.0.0.1:{PORT}/room/{q}'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    t0 = time.time()
    while not os.path.exists(OUT) and time.time() - t0 < 180: time.sleep(0.5)
    time.sleep(0.3)
    if not os.path.exists(OUT): sys.exit('timeout: no reports/bot.json')
    r = json.load(open(OUT, encoding='utf-8'))
    for k, v in r.items(): print(k, json.dumps(v))
finally:
    ch.terminate(); srv.terminate(); time.sleep(0.5); shutil.rmtree(prof, ignore_errors=True)
