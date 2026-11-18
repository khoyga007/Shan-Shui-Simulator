"""Generate scene art from art/prompts.md via the Gemini image API.

Usage: python tools/gen_scene.py <section-number> <out-name> [--model M] [--ref PNG]
  section-number: N of the "## N." heading in art/prompts.md
  out-name:       file stem, saved to web/assets/scene/<out-name>.png
Key: env GEMINI_API_KEY (sent as header only).
"""
import base64, json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_LINE = "Match the brushwork, ink tone and level of detail of the attached image exactly."


def prompt_for(n):
    md = open(os.path.join(ROOT, "art", "prompts.md"), encoding="utf-8").read()
    m = re.search(r"^## %d\..*?```\n(.*?)```" % n, md, re.S | re.M)
    if not m:
        sys.exit("no section %d" % n)
    return m.group(1).strip()


def main():
    a = sys.argv[1:]
    model, ref = "gemini-2.5-flash-image", None
    if "--model" in a:
        i = a.index("--model"); model = a[i + 1]; del a[i:i + 2]
    if "--ref" in a:
        i = a.index("--ref"); ref = a[i + 1]; del a[i:i + 2]
    n, name = int(a[0]), a[1]
    text = prompt_for(n)
    parts = []
    if ref:
        parts.append({"inlineData": {"mimeType": "image/png",
                                     "data": base64.b64encode(open(ref, "rb").read()).decode()}})
        text = REF_LINE + "\n\n" + text
    parts.append({"text": text})
    body = json.dumps({"contents": [{"parts": parts}]}).encode()
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        sys.exit("HTTP %d: %s" % (e.code, e.read().decode("utf-8", "replace")[:600]))
    out_dir = os.path.join(ROOT, "web", "assets", "scene")
    os.makedirs(out_dir, exist_ok=True)
    for p in res.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        d = p.get("inlineData")
        if d:
            ext = ".png" if "png" in d.get("mimeType", "") else ".jpg"
            path = os.path.join(out_dir, name + ext)
            open(path, "wb").write(base64.b64decode(d["data"]))
            print("saved", path, d.get("mimeType"), json.dumps(res.get("usageMetadata", {})))
            return
    sys.exit("no image in response: " + json.dumps(res)[:600])


if __name__ == "__main__":
    main()
