"""Packt dashboard/index.html als Store-Dokument {text} für files/index.html."""
import json, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "build" / "files.index.html.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"text": (root / "dashboard" / "index.html").read_text("utf-8")}, ensure_ascii=False), "utf-8")
print(out)
