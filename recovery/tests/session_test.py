"""Exercise independent native sessions and isolated settings through WebView2."""

import json
import base64
import http.server
import io
import pathlib
import socket
import struct
import subprocess
import threading
import time
import zlib
import zipfile
import wave
import math
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXE = ROOT / "dist" / "BeipMU-Recovery-0.9" / "BeipMU-Recovery.exe"
OUT = ROOT / "test-results" / ("sessions-" + time.strftime("%Y%m%d-%H%M%S"))


def tiny_png():
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    row = b"\x00" + b"\xff\x00\x00\xff" * 16 + b"\x00\x00\xff\xff" * 16
    pixels = row * 16
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 32, 16, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b""))


class Assets:
    def __init__(self):
        image = tiny_png()

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path != "/tiles.png":
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(image)))
                self.end_headers()
                self.wfile.write(image)

            def log_message(self, *_):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}/"

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class Fixture:
    def __init__(self, marker, assets):
        self.marker = marker
        self.assets = assets
        self.received = bytearray()
        self.error = None
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(1)
        self.listener.settimeout(30)
        self.port = self.listener.getsockname()[1]
        self.thread = threading.Thread(target=self.serve, daemon=True)
        self.thread.start()

    def serve(self):
        try:
            conn, _ = self.listener.accept()
            with conn:
                conn.settimeout(30)
                if self.marker.startswith("CORE A"):
                    def gmcp(name, payload):
                        message = name + " " + json.dumps(payload, separators=(",", ":"))
                        conn.sendall(b"\xff\xfa\xc9" + message.encode("utf-8") + b"\xff\xf0")

                    conn.sendall(b"This world is Pueblo 1.10 enhanced.\r\n\xff\xfb\xc9")
                    time.sleep(0.1)
                    conn.sendall(("</xch_mudtext><pre>" + self.marker + "\r\n").encode("utf-8"))
                    gmcp("Beip.Stats", {"Player": {"values": {"1_HP": {"prefix-length": 2, "range": {"value": 50, "max": 100}}}}})
                    gmcp("Beip.Tilemap.Info", {"Tiny": {"tile-url": self.assets.base + "tiles.png", "tile-size": "16,16", "map-size": "2,1", "encoding": "hex_8"}})
                    gmcp("Beip.Tilemap.Data", {"Tiny": "0001"})
                    gmcp("Client.Media.Default", {"url": self.assets.base})
                    gmcp("Client.Media.Load", {"name": "tone.wav"})
                    gmcp("beip.line.image-url", self.assets.base + "tiles.png")
                    conn.sendall(b"AVATAR TEST\r\n")
                else:
                    conn.sendall((self.marker + "\r\n").encode("utf-8"))
                while True:
                    try:
                        chunk = conn.recv(4096)
                    except socket.timeout:
                        break
                    if not chunk:
                        break
                    self.received.extend(chunk)
        except Exception as exc:
            self.error = str(exc)
        finally:
            self.listener.close()

    def finish(self):
        self.thread.join(timeout=3)
        assert self.error is None, (self.marker, self.error)


def run(phase):
    assets = Assets()
    fixtures = [Fixture("CORE A COMPLETE", assets), Fixture("CORE B COMPLETE", assets)]
    for name in ("result.json", "preview.png", "timeout.txt", "menu.json", "window.bmp", "window-capture-error.txt"):
        (OUT / name).unlink(missing_ok=True)
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 4
    app = subprocess.Popen(
        [str(EXE), "--test-core", str(fixtures[0].port), str(fixtures[1].port), str(OUT)],
        startupinfo=startup,
    )
    try:
        try:
            app.wait(timeout=75)
        except subprocess.TimeoutExpired:
            app.kill()
            app.wait()
            raise AssertionError(f"{phase}: application did not finish")
    finally:
        assets.close()
    assert not (OUT / "timeout.txt").exists(), f"{phase}: native timeout"
    assert (OUT / "result.json").exists(), f"{phase}: no result.json"
    result = json.loads((OUT / "result.json").read_text(encoding="utf-8"))
    assert result.get("phase") == phase, result
    assert result.get("classicLayout") is True, result
    assert result.get("connectionDialog") is True and result.get("quickConnect") is True, result
    assert result.get("nativeDialogs") is True and result.get("settingsUI") is True, result
    assert result.get("loggingDialog") is True and result.get("loggingControls") is True, result
    assert result.get("aliasEditor") is True and result.get("triggerEditor") is True and result.get("macroEditor") is True, result
    assert result.get("inputResize") is True and result.get("typingUI") is True, result
    menu = json.loads((OUT / "menu.json").read_text(encoding="utf-8"))
    assert menu == {"count": 6, "itemCount": 7, "labels": ["&Windows", "&Tools", "&Logging...\tCtrl+L", "&Settings...", "&Help", "Close all Windows and E&xit"]}, menu
    floats = json.loads((OUT / "floating-windows.json").read_text(encoding="utf-8"))
    assert floats["created"] >= 2 and floats["ready"] == floats["created"] and floats["closed"] == floats["created"] and floats["live"] == 0, floats
    assert (OUT / "floating-preview.png").stat().st_size > 1000, f"{phase}: no native floating pane screenshot"
    assert result.get("isolated") is True, result
    assert result.get("commandsSent") is True, result
    assert result.get("logging") is True, result
    assert result.get("scripts") is True and result.get("scriptTimeout") is True, result
    for check in ("scriptReceive", "scriptTrigger", "scriptTimers", "scriptIsolation", "scriptDebug",
                  "scriptProfiles", "scriptCommand", "scriptInputIsolation", "scriptInputVisible", "scriptTimerInput"):
        assert result.get(check) is True, (check, result)
    assert result.get("credentialSaved") is True, result
    assert result.get("avatarLoaded") is True and result.get("tilemapRendered") is True, result
    assert result.get("mediaDisabled") is True, result
    assert result.get("mapperUI") is True, result
    for check in ("dockMap", "dockResize", "dockIsolation", "groupedCapture", "captureCancel", "splitIsolated",
                  "imageDock", "imagePlacement", "notesIsolated", "historyIsolated", "historyPlacement",
                  "layoutPersisted", "layoutMoves", "layoutResize", "layoutCopyPaste", "floatingOwner", "floatingDock",
                  "atlasExportPreview", "atlasExportPreviewed", "atlasReimport",
                  "floatingSessionCleanup", "shortcutRemap", "delayRouting", "smartPasteRouting"):
        assert result.get(check) is True, (check, result)
    automation = result.get("automation") or {}
    for check in ("variablesIsolated", "awayContext", "audioOptIn", "nativeSound", "nativeSpeech", "soundEditor", "audioEpochIsolation", "audioDisabled"):
        assert automation.get(check) is True, (check, automation)
    assert (OUT / "automation-sound.png").stat().st_size > 1000
    parity = result.get("parity") or {}
    for check in ("hierarchyEngine", "hierarchyWorker", "hierarchyEditor", "hierarchyTreeActions", "hierarchyTriggerEditor", "scopedSettings", "scopedSettingsCancel", "scopedRuntime", "restorationSaved"):
        assert parity.get(check) is True, (check, parity)
    imported = result.get("classicImport") or {}
    for check in ("configPreview", "reviewBeforeApply", "credentialsOmitted", "scriptOmitted",
                  "configApplied", "nestedConfigApplied", "nestedConfigWorker", "atlasPreview", "zipDecompression", "atlasApplied", "restorationSaved"):
        assert imported.get(check) is True, (check, imported)
    assert not imported.get("error"), imported
    assert result.get("draftsIsolated") is True and result.get("closedIsolation") is True, result
    assert result.get("spawn") is True, result
    assert "50" in json.dumps(result.get("gmcpStats")) and "100" in json.dumps(result.get("gmcpStats")), result
    assert result.get("persistenceLoaded") is (phase == "persist"), result
    assert not result.get("errors"), result
    exported = (OUT / "exported-map.atlas").read_bytes()
    assert exported == base64.b64decode(result.get("atlasBytes") or ""), f"{phase}: native Atlas bytes differ from reviewed export"
    with zipfile.ZipFile(io.BytesIO(exported)) as archive:
        atlas_xml = ET.fromstring(archive.read("Atlas.xml"))
    assert [room.get("name") for room in atlas_xml.iter("room")] == ["Start", "North"], atlas_xml
    assert any(exit_node.get("name_from") == "n" for exit_node in atlas_xml.iter("exit")), atlas_xml
    if phase == "first":
        assert result.get("persistenceSaved") is True, result
    for key, marker in (("alpha", "CORE A COMPLETE"), ("beta", "CORE B COMPLETE")):
        assert marker in result[key]["text"] and result[key]["connected"] is True, result
    paths = [pathlib.Path(p) for p in result.get("logPaths", [])]
    assert len(paths) == 2, result
    for path, marker in zip(paths, ("LOG alpha", "LOG beta")):
        assert path.resolve().is_relative_to(OUT.resolve()) and path.is_file(), path
        assert marker in path.read_text(encoding="utf-8"), path
    assert "CORE LOG BACKLOG" in paths[0].read_text(encoding="utf-8"), paths[0]
    assert all(marker not in paths[0].read_text(encoding="utf-8") for marker in ("WHO START", "WHO BEGIN", "WHO body", "WHO END")), paths[0]
    assert (OUT / "preview.png").stat().st_size > 1000, f"{phase}: no screenshot"
    for fixture in fixtures:
        fixture.finish()
    a, b = [bytes(f.received) for f in fixtures]
    assert b'Core.Supports.Set ["Beip.Stats 1","Beip.Tilemap 1","Beip.Id 1","Client.Media 1"]' in a,(phase,a)
    for command in (b"automation-alias-friend\r\n", b"automation-variable-updated\r\n", b"automation-away-once\r\n"):
        assert a.count(command) == 1 and command not in b, (phase, command, a, b)
    assert b"/set target=" not in a + b, (phase, a, b)
    events = [json.loads(line) for line in (OUT / "trigger-audio.jsonl").read_text().splitlines()]
    assert any(e["sessionId"] == "alpha" and e["event"]["action"] == "sound" and e["event"]["status"] == "api-accepted" for e in events), events
    assert any(e["sessionId"] == "alpha" and e["event"]["action"] == "speech" and e["event"]["status"] == "ended" for e in events), events
    assert b"core-alpha\r\n" in a and b"core-beta\r\n" not in a, (phase, a)
    assert b"core-beta\r\n" in b and b"core-alpha\r\n" not in b, (phase, b)
    assert b"core-line-one\r\n" in a and b"core-line-two\r\n" in a, (phase, a)
    assert b"core-line-one\r\n" not in b and b"core-line-two\r\n" not in b, (phase, b)
    assert b"core-delayed-alpha\r\n" in a and b"core-delayed-alpha\r\n" not in b, (phase, a, b)
    assert b"core-cancelled-alpha\r\n" not in a + b, (phase, a, b)
    for pasted in (b"pre-core-paste-one-post\r\n", b"pre-core-paste-two-post\r\n"):
        assert pasted in a and pasted not in b, (phase, pasted, a, b)
    assert b"saved unsent draft\r\n" not in a + b, (phase, a, b)
    assert b"connect SampleUser sample-pass\r\n" in a, (phase, a)
    assert b"sample-pass" not in b, (phase, b)
    assert b"core-macro-alpha\r\n" in a and b"core-macro-alpha\r\n" not in b, (phase,a,b)
    assert b"core-trigger-alpha\r\n" in a and b"core-trigger-alpha\r\n" not in b,(phase,a,b)
    assert b"core-hook-allowed\r\n" in a and b"core-hook-allowed\r\n" not in b, (phase,a,b)
    assert b"core-hook-blocked\r\n" not in a + b, (phase,a,b)
    assert b"core-script-command" not in a + b and b"core-script-input" not in a + b, (phase,a,b)
    assert b"connect SampleUser sample-pass\r\n" in a and b"connect SampleUser sample-pass\r\n" not in b,(phase,a,b)
    assert b"BlockedWrong" not in a + b and b"BlockedPlain" not in a + b, (phase, a, b)
    assert result.get("workerCSP") is True,result
    (OUT / f"{phase}-wire.json").write_text(
        json.dumps({"alpha": a.decode("utf-8", "replace").replace("sample-pass", "[REDACTED]"),
                    "beta": b.decode("utf-8", "replace").replace("sample-pass", "[REDACTED]")}, indent=2),
        encoding="utf-8",
    )
    (OUT / f"{phase}-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    assert EXE.exists(), "Build first."
    OUT.mkdir(parents=True)
    with wave.open(str(OUT / "test-tone.wav"), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"".join(struct.pack("<h", int(1000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(3200)))
    run("first")
    assert (OUT / "settings.json").exists(), "First pass did not save isolated settings"
    run("persist")
    print(f"Two independent sessions and settings persistence verified: {OUT}")
