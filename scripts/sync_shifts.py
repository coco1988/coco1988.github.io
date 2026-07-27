#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path
from urllib.request import urlopen

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vROZlT_B_mwvH_nGeTJBO2Z2fkGQD0In1eatHfaaZYGrWgl4drHogv4hi8DVj4YneOSEHd30JxC6JOM/pub?gid=1385670592&single=true&output=csv"
OUTPUT_FILE = Path("/site/data/shifts.json")


def clean(value):
    return (value or "").strip()


def main() -> int:
    with urlopen(CSV_URL, timeout=30) as response:
        text = response.read().decode("utf-8-sig")

    lines = text.splitlines()
    reader = csv.DictReader(lines)

    fieldnames = reader.fieldnames or []
    photo_cols = fieldnames[10:21]

    shifts = []
    for i, row in enumerate(reader, start=1):
        assigned = []
        for col in photo_cols:
            val = clean(row.get(col))
            if val:
                assigned.append({"name": col, "slot": val})

        shifts.append(
            {
                "id": i,
                "date": clean(row.get("mm-dd")),
                "from": clean(row.get("from")),
                "till": clean(row.get("till")),
                "what": clean(row.get("what")),
                "where": clean(row.get("where")),
                "category": clean(row.get("category")),
                "notes": clean(row.get("notes")),
                "relevant": clean(row.get("relevant")),
                "comment": clean(row.get("comment")),
                "assigned": assigned,
            }
        )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "source": CSV_URL,
        "count": len(shifts),
        "shifts": shifts,
    }

    tmp = OUTPUT_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    tmp.replace(OUTPUT_FILE)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
