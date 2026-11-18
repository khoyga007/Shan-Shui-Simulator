"""Dev server: serves web/ on 127.0.0.1:8098, and POST /shot (body "name.png|dataURL") saves into shots/.
usage: python tools/devserver.py   (from the repo root or anywhere)"""
import base64, http.server, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB, SHOTS = os.path.join(ROOT, 'web'), os.path.join(ROOT, 'shots')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=WEB, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(self):
        if self.path != '/shot': return self.send_error(404)
        name, data = self.rfile.read(int(self.headers['Content-Length'])).decode().split('|', 1)
        name = re.sub(r'[^\w.-]', '_', os.path.basename(name))
        os.makedirs(SHOTS, exist_ok=True)
        with open(os.path.join(SHOTS, name), 'wb') as f: f.write(base64.b64decode(data.split(',', 1)[1]))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', 8098), H).serve_forever()
