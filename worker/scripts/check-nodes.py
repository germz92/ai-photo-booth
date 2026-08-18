#!/usr/bin/env python3
"""Query a running ComfyUI for the class_types the booth workflow needs.

Usage (on a live worker, ComfyUI listening on 8188):
  python /usr/local/bin/check-booth-nodes.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

COMFY_URL = "http://127.0.0.1:8188/object_info"
NODE_LIST = Path("/comfyui/required_nodes.txt")


def main() -> int:
    required = [
        line.strip()
        for line in NODE_LIST.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]

    try:
        with urllib.request.urlopen(COMFY_URL, timeout=15) as response:
            info = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: could not reach ComfyUI at {COMFY_URL}: {exc}")
        return 1

    available = set(info.keys())
    missing = [name for name in required if name not in available]

    if missing:
        print("MISSING class_types:")
        for name in missing:
            print(f"  - {name}")
        print(f"\nComfyUI reported {len(available)} node types.")
        return 1

    print(f"OK: all {len(required)} required class_types are registered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
