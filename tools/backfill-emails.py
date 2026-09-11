"""Copy emails from Supabase Auth into public.users. Run after schema-email.sql."""
import json
import os
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_props():
    out = {}
    with open(os.path.join(ROOT, "tools", "script-properties.txt"), encoding="utf-8") as f:
        for line in f:
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k and not k.lower().startswith("paste") and not k.lower().startswith("do not"):
                out[k] = v
    return out


def main():
    p = load_props()
    base = p["SUPABASE_URL"].rstrip("/")
    key = p["SUPABASE_SECRET_KEY"]
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
    }
    filled = 0
    page = 1
    while page <= 50:
        req = urllib.request.Request(
            base + "/auth/v1/admin/users?page=" + str(page) + "&per_page=200",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as res:
                data = json.loads(res.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            print("auth list fail", e.code, e.read()[:200].decode())
            return 1
        users = data.get("users") if isinstance(data, dict) else data
        if not isinstance(users, list) or not users:
            break
        for u in users:
            xid = str(u.get("id") or "")
            email = str(u.get("email") or "")
            if not xid or not email:
                continue
            body = json.dumps({"email": email}).encode()
            patch = urllib.request.Request(
                base + "/rest/v1/users?xid=eq." + xid,
                data=body,
                method="PATCH",
                headers={
                    **headers,
                    "Prefer": "return=minimal",
                },
            )
            try:
                with urllib.request.urlopen(patch, timeout=20) as res:
                    res.read()
                    filled += 1
            except urllib.error.HTTPError as e:
                print("patch fail", e.code, e.read()[:180].decode())
                return 1
        page += 1
    print("filled", filled)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
