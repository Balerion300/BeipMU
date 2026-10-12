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
EXE = ROOT / "dist" / "BeipMU-Recovery-0.13" / "BeipMU-Recovery.exe"
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
                route = self.path.split("?", 1)[0]
                if route == "/redirect-image":
                    self.send_response(302)
                    self.send_header("Location", "/animated-fixture.gif")
                    self.end_headers()
                    return
                if route == "/animated-fixture.gif":
                    body, mime = (ROOT / "tests" / "animated-fixture.gif").read_bytes(), "image/gif"
                elif route == "/avatar-fixture.png":
                    body, mime = (ROOT / "tests" / "avatar-fixture.png").read_bytes(), "image/png"
                elif route == "/invalid-image":
                    body, mime = b"This is not an image.", "text/plain"
                elif route == "/tiles.png":
                    body, mime = image, "image/png"
                else:
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

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
        [str(EXE), "--test-core", str(fixtures[0].port), str(fixtures[1].port), str(OUT), str(assets.server.server_port)],
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
    for section in ("scriptObjects", "settings", "layouts", "maps", "everyday", "temporal", "emoji", "commands", "images", "restore", "pipeline", "puebloSpacing", "continuation"):
        checks = result.get(section)
        assert isinstance(checks, dict) and checks, (section, result)
        assert not checks.get("error"), (section, checks)
        diagnostics = {"emoji": {"logPath"}, "maps": {"labelDetails"}, "images": {"savePath", "copyPath", "avatarLiveDetails"}, "restore": {"nativeCharacter", "nativeRequired"}, "puebloSpacing": {"rows"}}
        assert all(value is True for key, value in checks.items() if key != "error" and key not in diagnostics.get(section, set())), (section, checks)
    emoji_log = pathlib.Path(result["emoji"]["logPath"])
    restore_id = result["restore"]["nativeCharacter"]
    assert restore_id == "restore-fixture-char"
    restore_data = (OUT / "Restore" / (restore_id + ".restore")).read_bytes()
    assert restore_data[:9] == b"BEIPRST1\n" and len(restore_data) <= 65536 + 9
    restore_records, offset = [], 9
    while offset < len(restore_data):
        size = struct.unpack_from("<I", restore_data, offset)[0]
        offset += 4
        assert 0 < size <= 60 * 1024 and offset + size <= len(restore_data)
        restore_records.append(json.loads(restore_data[offset:offset + size].decode("utf-8")))
        offset += size
    assert all(value in json.dumps(restore_records) for value in result["restore"]["nativeRequired"])
    image_saved = pathlib.Path(result["images"]["savePath"])
    image_copied = pathlib.Path(result["images"]["copyPath"])
    assert all(path.resolve().is_relative_to(OUT.resolve()) and path.is_file() for path in (image_saved, image_copied))
    assert image_saved.read_bytes() == (ROOT / "tests" / "animated-fixture.gif").read_bytes()
    dib = image_copied.read_bytes()
    assert len(dib) == 124 + 32 * 16 * 4
    assert struct.unpack_from("<IiiHH", dib) == (124, 32, -16, 1, 32)
    assert struct.unpack_from("<IIII", dib, 40) == (0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000)
    assert dib[124:] == bytes((0, 0, 255, 255)) * (32 * 16), "Copy must contain the first red GIF frame"
    assert emoji_log.resolve().is_relative_to(OUT.resolve()) and emoji_log.is_file(), emoji_log
    emoji_text = emoji_log.read_text(encoding="utf-8")
    assert "fox dog face  warning :)" in emoji_text and "🦊" not in emoji_text, emoji_text
    logs = result.get("loggingOptions") or {}
    assert logs and not logs.get("error"), logs
    for key in ("settingsSave", "settingsReopen", "settingsCancel", "nameTokens", "visibleStartFound", "nativeFilesClosed", "restorationSaved"):
        assert logs.get(key) is True, (key, logs)
    for kind in ("plain", "html"):
        path = pathlib.Path(logs[kind + "Path"])
        assert path.resolve().is_relative_to(OUT.resolve()) and path.is_file(), path
        contents = path.read_text(encoding="utf-8")
        assert all(value in contents for value in logs[kind + "Required"]), (kind, contents)
        assert all(value not in contents for value in logs[kind + "Excluded"]), (kind, contents)
    visible_path = pathlib.Path(logs["visiblePath"])
    assert visible_path.resolve().is_relative_to(OUT.resolve()) and visible_path.is_file(), visible_path
    assert visible_path.read_text(encoding="utf-8").splitlines()[0] == logs["visibleFirst"], logs
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
    pipeline_commands = ['/echo pipeline-literal-alpha', 'pipeline-escaped-alpha', 'pipeline-child-alpha', 'pipeline-parent-alpha', 'pipeline-send-alpha', 'pipeline-transmit-alpha', 'pipeline-order-one-alpha', 'pipeline-order-two-alpha', 'pipeline-trigger-alpha']
    for command in pipeline_commands:
        expected = (command + '\r\n').encode()
        assert a.count(expected) == 1 and expected not in b, (command, a, b)
    assert b'pipeline-' not in b, b
    assert a.count(b'continuation-script-seen-ran-alpha\r\n') == 1, a
    assert b'continuation-' not in b, b
    for marker in [b'pipeline-stale-alpha', b'pipeline-stale-queued-alpha', b'pipeline-blocked-alpha', b'pipeline-drop', b'pipeline-local']:
        assert marker not in a + b, (marker, a, b)
    assert a.index(b'pipeline-child-alpha') < a.index(b'pipeline-parent-alpha')
    assert a.index(b'pipeline-order-one-alpha') < a.index(b'pipeline-order-two-alpha')
    assert a.count(b"temporal-next-alpha\r\n") == 2 and b"temporal-next-alpha\r\n" not in b, (phase, a, b)
    assert a.count(b"trigger-click-owner-alpha\r\n") == 1 and b"trigger-click-owner-alpha\r\n" not in b, (phase, a, b)
    for command, own, other in ((b"command-wall-alpha\r\n", a, b), (b"command-wall-beta\r\n", b, a), (b"command-idle-reset-alpha\r\n", a, b)):
        assert own.count(command) == 1 and command not in other, (phase, command, a, b)
    assert b"command-idle-alpha\r\n" not in a + b, (phase, a, b)
    assert a.count(b"\xff\xf1") == 1 and b"\xff\xf1" not in b, (phase, a, b)
    assert b'Core.Ping {"commandFixture":true}' in a and b'Core.Ping {"commandFixture":true}' not in b, (phase, a, b)
    assert b"script-objects-owner-alpha\r\n" in a and b"script-objects-owner-alpha\r\n" not in b, (phase, a, b)
    assert b"template-check SampleUser sample-pass\r\n" in a and b"template-check" not in b, (phase, a, b)
    assert b"template-delayed SampleUser\r\n" in a and b"template-delayed" not in b, (phase, a, b)
    assert b"template-canceled" not in a + b, (phase, a, b)
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
