"""Local static server: X OAuth + Supabase (users, applications, leaderboard)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
PROPS = os.path.join(ROOT, "tools", "script-properties.txt")

SCORE_FOLLOW = 100
SCORE_QUOTE = 15
SCORE_SEAL = 50
SCORE_REF = 80
def task_pts(task_id):
    tid = str(task_id or "")
    if tid == "follow-insomnusxyz":
        return 0
    if tid.startswith("follow-"):
        return 100
    if tid.startswith("discord-"):
        return 100
    if tid.startswith("like-"):
        return 5
    if tid.startswith("rt-"):
        return 10
    if tid.startswith("quote-"):
        return 15
    return None
HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
POST_RE = re.compile(r"^https?://(www\.)?(x|twitter)\.com/", re.I)


def load_props():
    out = {}
    if os.path.isfile(PROPS):
        with open(PROPS, encoding="utf-8") as f:
            for line in f:
                if "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if k and not k.lower().startswith("paste") and not k.lower().startswith("do not"):
                    out[k] = v
    return out


def sb_headers():
    p = load_props()
    key = p.get("SUPABASE_SECRET_KEY") or ""
    return {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def sb_url(path, query=""):
    p = load_props()
    base = (p.get("SUPABASE_URL") or "").rstrip("/")
    return base + path + (("?" + query) if query else "")


def sb_request(method, path, query="", body=None, extra=None):
    headers = sb_headers()
    if extra:
        headers.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(sb_url(path, query), data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode() or "[]"
            code = res.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        return e.code, raw
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = raw
    return code, parsed


def clean_handle(raw):
    return str(raw or "").strip().lstrip("@")


def json_response(handler, status, payload):
    data = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def xauth(body):
    props = load_props()
    client_id = props.get("GOOGLE_CLIENT_ID") or ""
    secret = props.get("GOOGLE_CLIENT_SECRET") or ""
    code = str(body.get("code") or "")
    verifier = str(body.get("verifier") or "")
    redirect = str(body.get("redirect") or "")
    if not client_id or not secret:
        return 400, {"ok": False, "error": "missing Google credentials on local server"}
    if not code or not verifier or not redirect:
        return 400, {"ok": False, "error": "bad oauth"}

    payload = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect,
        "client_id": client_id,
        "client_secret": secret,
        "code_verifier": verifier,
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            tok = json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            tok = json.loads(raw)
        except Exception:
            tok = {"error": raw[:300]}
        return 400, {"ok": False, "error": tok.get("error_description") or tok.get("error") or "token failed"}
    except Exception as e:
        return 400, {"ok": False, "error": str(e)}

    token = tok.get("access_token") or tok.get("id_token")
    if not tok.get("access_token"):
        return 400, {"ok": False, "error": tok.get("error_description") or tok.get("error") or "token failed"}

    me_req = urllib.request.Request(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": "Bearer " + tok["access_token"]},
    )
    try:
        with urllib.request.urlopen(me_req, timeout=20) as res:
            me = json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        return 400, {"ok": False, "error": raw[:300] or "user failed"}

    sub = str(me.get("sub") or "")
    email = str(me.get("email") or "")
    gname = str(me.get("name") or email or "Google")
    if not sub:
        return 400, {"ok": False, "error": "user failed"}
    local = (email.split("@")[0] if email else "g" + sub[-8:])
    handle = re.sub(r"[^A-Za-z0-9_]", "", local)[:15] or ("g" + sub[-8:])

    user = {
        "xid": sub,
        "handle": handle.lower(),
        "name": gname,
        "pfp": str(me.get("picture") or ""),
    }
    code_sb, saved = sb_request(
        "POST",
        "/rest/v1/users",
        query="on_conflict=xid",
        extra={"Prefer": "resolution=merge-duplicates,return=representation"},
        body=user,
    )
    if code_sb >= 400:
        msg = saved if isinstance(saved, str) else json.dumps(saved)
        if "Could not find the table" in msg:
            return 400, {"ok": False, "error": "supabase tables missing — run schema.sql in the SQL editor"}
        return 400, {"ok": False, "error": msg[:240]}
    return 200, {
        "ok": True,
        "provider": "google",
        "id": user["xid"],
        "handle": user["handle"],
        "name": user["name"],
        "pfp": user["pfp"],
    }


def apply(body):
    addr = str(body.get("address") or "").strip().lower()
    handle = clean_handle(body.get("handle")).lower()
    post = str(body.get("post") or "").strip()
    ref = clean_handle(body.get("ref")).lower()
    xid = str(body.get("xid") or "").strip()
    if not xid:
        return 400, {"ok": False, "error": "connect x"}
    if not WALLET_RE.match(addr):
        return 400, {"ok": False, "error": "bad address"}
    if not HANDLE_RE.match(handle):
        return 400, {"ok": False, "error": "bad handle"}
    if not POST_RE.match(post):
        return 400, {"ok": False, "error": "bad post"}
    if ref and not HANDLE_RE.match(ref):
        return 400, {"ok": False, "error": "bad ref"}
    if ref == handle:
        ref = ""

    code, existing = sb_request("GET", "/rest/v1/applications", "address=eq.%s&select=id,handle" % urllib.parse.quote(addr))
    if code == 404:
        return 400, {"ok": False, "error": "supabase tables missing — run schema.sql in the SQL editor"}
    if code < 400 and isinstance(existing, list) and existing:
        return 200, {"ok": False, "error": "seen"}

    row = {
        "xid": xid,
        "handle": handle,
        "address": addr,
        "post": post,
        "ref": ref,
        "status": "pending",
    }
    code, saved = sb_request("POST", "/rest/v1/applications", body=row)
    if code >= 400:
        msg = saved if isinstance(saved, str) else json.dumps(saved)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return 200, {"ok": False, "error": "seen"}
        return 400, {"ok": False, "error": msg[:240]}
    n = 1
    if isinstance(saved, list) and saved:
        n = 1
    return 200, {"ok": True, "n": n}


def claim_task(body):
    xid = str(body.get("xid") or "").strip()
    task_id = str(body.get("task_id") or "").strip()
    handle = clean_handle(body.get("handle")).lower()
    if not xid:
        return 400, {"ok": False, "error": "connect google"}
    pts = task_pts(task_id)
    if pts is None:
        return 400, {"ok": False, "error": "bad task"}
    row = {"xid": xid, "task_id": task_id, "handle": handle}
    code, saved = sb_request(
        "POST",
        "/rest/v1/task_claims",
        query="on_conflict=xid,task_id",
        extra={"Prefer": "resolution=merge-duplicates,return=representation"},
        body=row,
    )
    if code == 404:
        return 200, {"ok": True, "local": True, "pts": pts}
    if code >= 400:
        msg = saved if isinstance(saved, str) else json.dumps(saved)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return 200, {"ok": True, "pts": pts}
        return 400, {"ok": False, "error": msg[:240]}
    return 200, {"ok": True, "pts": pts}


def board():
    code, rows = sb_request("GET", "/rest/v1/applications", "select=handle,ref,created_at&order=created_at.asc")
    if code == 404:
        return 200, {"ok": True, "rows": [], "live": False, "error": "tables missing"}
    if code >= 400 or not isinstance(rows, list):
        return 200, {"ok": True, "rows": [], "live": False}
    people = {}
    for r in rows:
        h = clean_handle(r.get("handle")).lower()
        if not HANDLE_RE.match(h):
            continue
        if h not in people:
            people[h] = {
                "handle": h,
                "score": SCORE_FOLLOW + SCORE_QUOTE + SCORE_SEAL,
                "refs": 0,
                "at": r.get("created_at") or "",
            }
    for r in rows:
        by = clean_handle(r.get("ref")).lower()
        if by in people:
            people[by]["refs"] += 1
            people[by]["score"] += SCORE_REF
    extras = {}
    code_t, claims = sb_request("GET", "/rest/v1/task_claims", "select=handle,task_id")
    if code_t < 400 and isinstance(claims, list):
        for c in claims:
            h = clean_handle(c.get("handle")).lower()
            pts = task_pts(str(c.get("task_id") or "")) or 0
            if h and pts:
                extras[h] = extras.get(h, 0) + pts
    for h, p in people.items():
        extra = extras.get(h, 0)
        p["score"] += extra
        p["extras"] = extra
    ranked = sorted(people.values(), key=lambda x: (-x["score"], x["at"]))
    out = []
    for i, p in enumerate(ranked, 1):
        out.append({
            "rank": i,
            "handle": "@" + p["handle"],
            "score": p["score"],
            "refs": p["refs"],
            "extras": p.get("extras", 0),
        })
    return 200, {"ok": True, "live": True, "rows": out[:200]}


class Handler(SimpleHTTPRequestHandler):
    def _read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode("utf-8", "replace") if n else "{}"
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/board":
            json_response(self, *board())
            return
        SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        body = self._read_json()
        if path == "/xauth":
            json_response(self, *xauth(body))
            return
        if path == "/apply":
            json_response(self, *apply(body))
            return
        if path == "/task":
            json_response(self, *claim_task(body))
            return
        self.send_error(404)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 3000)
    print("http://localhost:%s/" % port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
