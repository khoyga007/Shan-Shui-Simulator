"""Dev server: serves web/ on 127.0.0.1:8098 (or the port given), POST /shot (body "name.png|dataURL") saves into
shots/, POST /report (same body) saves into reports/ (the test room's F8 key).
usage: python tools/devserver.py [port]   (from the repo root or anywhere)"""
import base64, http.server, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web')
DIRS = {'/shot': os.path.join(ROOT, 'shots'), '/report': os.path.join(ROOT, 'reports')}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=WEB, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(self):
        out = DIRS.get(self.path)
        if not out: return self.send_error(404)
        name, data = self.rfile.read(int(self.headers['Content-Length'])).decode().split('|', 1)
        name = re.sub(r'[^\w.-]', '_', os.path.basename(name))
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, name), 'wb') as f: f.write(base64.b64decode(data.split(',', 1)[1]))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8098), H).serve_forever()
