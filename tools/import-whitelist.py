"""Sync address,phase CSV into public.whitelist.

Highest tier wins on duplicate wallets:
  ancient > freegtd > gtd > petlist

Usage:
  python tools/import-whitelist.py
      uses WHITELIST_CSV_URL from tools/script-properties.txt
  python tools/import-whitelist.py C:\\Users\\Micheal\\Downloads\\sheet.csv
      uses that file

Do not commit CSVs or the properties file.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROPS = os.path.join(ROOT, "tools", "script-properties.txt")
WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
RANK = {"ancient": 4, "freegtd": 3, "gtd": 2, "petlist": 1}


def load_props():
    out = {}
    if not os.path.isfile(PROPS):
        return out
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
    if "gtd" in s or "guaranteed" in s or s == "03":
        return "gtd"
    if "pet" in s or "list" in s or s == "04":
        return "petlist"
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
        with urllib.request.urlopen(req, timeout=90) as res:
            raw = res.read().decode() or "[]"
            return res.status, json.loads(raw) if raw.startswith("[") or raw.startswith("{") else raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def parse_csv_text(text):
    f = io.StringIO(text)
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = [r for r in csv.reader(f, dialect) if any(c.strip() for c in r)]
    if not rows:
        return [], 0
    head = [c.strip().lower() for c in rows[0]]
    ai = next((i for i, h in enumerate(head) if "address" in h or "wallet" in h or h == "0x"), 0)
    pi = next((i for i, h in enumerate(head) if "phase" in h or "tier" in h or "round" in h or "list" in h), 1)
    start = 1 if any(x in " ".join(head) for x in ("address", "wallet", "phase", "tier", "list")) else 0
    best = {}
    skip = 0
    dups = 0
    for r in rows[start:]:
        if max(ai, pi) >= len(r):
            skip += 1
            continue
        addr = re.sub(r"\s+", "", r[ai]).lower()
        phase = phase_from(r[pi])
        if not WALLET_RE.match(addr) or not phase:
            skip += 1
            continue
        if addr in best:
            dups += 1
            if RANK[phase] > RANK[best[addr]]:
                best[addr] = phase
        else:
            best[addr] = phase
    out = [{"address": a, "phase": p} for a, p in best.items()]
    return out, skip, dups


def load_source(arg):
    if arg:
        if arg.startswith("http://") or arg.startswith("https://"):
            req = urllib.request.Request(arg, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as res:
                return res.read().decode("utf-8-sig")
        if os.path.isfile(arg):
            with open(arg, encoding="utf-8-sig") as f:
                return f.read()
        raise SystemExit("Not a file or URL: " + arg)
    url = load_props().get("WHITELIST_CSV_URL") or ""
    if not url:
        raise SystemExit(
            "Pass a CSV path, or set WHITELIST_CSV_URL in tools/script-properties.txt"
        )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8-sig")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    text = load_source(arg)
    rows, skipped, dups = parse_csv_text(text)
    print("unique wallets", len(rows), "duplicate extra rows", dups, "skipped", skipped)
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
