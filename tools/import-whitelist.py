"""Import address,tier CSV into public.whitelist. Uses the secret key. Do not commit CSVs."""
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROPS = os.path.join(ROOT, "tools", "script-properties.txt")
WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
PHASES = ("ancient", "freegtd", "gtd", "petlist")


def load_props():
    out = {}
    with open(PROPS, encoding="utf-8") as f:
        for line in f:
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k and not k.lower().startswith("paste") and not k.lower().startswith("do not"):
                out[k] = v
    return out


def phase_from(raw):
    s = str(raw or "").strip().lower()
    if not s:
        return ""
    if "ancient" in s or s in ("ao", "01"):
        return "ancient"
    if "free" in s or s in ("freegtd", "gtd free", "02"):
        return "freegtd"
    if "pet" in s or "list" in s or s == "04":
        return "petlist"
    if "gtd" in s or "guaranteed" in s or s == "03":
        return "gtd"
    return ""


def rest(method, path, query="", body=None):
    p = load_props()
    url = p["SUPABASE_URL"].rstrip("/") + path + (("?" + query) if query else "")
    key = p["SUPABASE_SECRET_KEY"]
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode() or "[]"
            return res.status, json.loads(raw) if raw.startswith("[") or raw.startswith("{") else raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def read_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(f, dialect)
        rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return []
    head = [c.strip().lower() for c in rows[0]]
    ai = next((i for i, h in enumerate(head) if "address" in h or "wallet" in h or h == "0x"), 0)
    pi = next((i for i, h in enumerate(head) if "phase" in h or "tier" in h or "round" in h or "list" in h), 1)
    start = 1 if any(x in " ".join(head) for x in ("address", "wallet", "phase", "tier", "list")) else 0
    out = []
    seen = set()
    skip = 0
    for r in rows[start:]:
        if max(ai, pi) >= len(r):
            skip += 1
            continue
        addr = re.sub(r"\s+", "", r[ai]).lower()
        phase = phase_from(r[pi])
        if not WALLET_RE.match(addr) or not phase:
            skip += 1
            continue
        if addr in seen:
            continue
        seen.add(addr)
        out.append({"address": addr, "phase": phase})
    return out, skip


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/import-whitelist.py path\\to\\wallets.csv")
        print("CSV columns: address, tier   (tier = ancient | freegtd | gtd | petlist)")
        return 1
    path = sys.argv[1]
    if not os.path.isfile(path):
        print("File not found:", path)
        return 1
    rows, skipped = read_rows(path)
    print("valid rows", len(rows), "skipped", skipped)
    if not rows:
        return 1
    ok = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i : i + 200]
        code, data = rest("POST", "/rest/v1/whitelist", "on_conflict=address", chunk)
        n = len(data) if isinstance(data, list) else 0
        if code >= 400:
            print("FAIL", code, data)
            print("Run schema-whitelist.sql in Supabase SQL Editor first.")
            return 1
        ok += n
        print("upserted", ok)
    counts = {}
    for r in rows:
        counts[r["phase"]] = counts.get(r["phase"], 0) + 1
    print("tiers", counts)
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
