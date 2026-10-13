"""Verify the preview's complete file inventory and bytes before publication."""
import hashlib
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist" / "BeipMU-Recovery-0.16"
ARCHIVE = ROOT / "dist" / "BeipMU-Recovery-0.16-x64.zip"


def verify():
    expected = {"BeipMU-Recovery.exe": (DIST / "BeipMU-Recovery.exe").read_bytes()}
    assert expected["BeipMU-Recovery.exe"].startswith(b"MZ"), "Missing native Windows executable"
    for directory in ("ui", "examples"):
        for path in (ROOT / directory).rglob("*"):
            if path.is_file():
                expected[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    for name in ("README.md", "FEATURE-PARITY.md", "UI-REFERENCE.md",
                 "COMPLETION-CHECKLIST.md", "SCRIPT-PARITY.md"):
        expected[name] = (ROOT / name).read_bytes()
    expected["LICENSE"] = (ROOT.parent / "LICENSE").read_bytes()
    expected["WebView2-SDK-LICENSE.txt"] = (ROOT / "vendor/webview2/LICENSE.txt").read_bytes()
    installed = {p.relative_to(DIST).as_posix(): p.read_bytes()
                 for p in DIST.rglob("*") if p.is_file()}
    assert installed.keys() == expected.keys(), {
        "missing": sorted(expected.keys() - installed.keys()),
        "unexpected": sorted(installed.keys() - expected.keys())}
    assert all(installed[name] == value for name, value in expected.items()), "Source/package byte mismatch"
    with zipfile.ZipFile(ARCHIVE) as archive:
        names = [info.filename for info in archive.infolist() if not info.is_dir()]
        assert len(names) == len(set(names)), "Duplicate archive entries"
        assert set(names) == set(expected), "Archive inventory mismatch"
        assert archive.testzip() is None, "Archive CRC failure"
        assert all(archive.read(name) == value for name, value in expected.items()), "Archive byte mismatch"
    return {"archive": str(ARCHIVE), "files": len(expected),
            "bytes": ARCHIVE.stat().st_size,
            "sha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
            "exe_sha256": hashlib.sha256(expected["BeipMU-Recovery.exe"]).hexdigest()}


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
