"""Exercise the full WebView/native/TLS path against a trusted local Pueblo server."""

import json
import pathlib
import socket
import ssl
import subprocess
import tempfile
import threading
import time

from tls_loopback_test import certificates

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXE = ROOT / "dist" / "BeipMU-Recovery-0.4" / "BeipMU-Recovery.exe"
OUT = ROOT / "test-results" / ("tls-app-" + time.strftime("%Y%m%d-%H%M%S"))


def run():
    assert EXE.exists(), "Build first."
    OUT.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix="beipmu-tls-app-") as directory:
        ca, cert, key, thumbprint = certificates(pathlib.Path(directory))
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert, key)
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        listener.settimeout(25)
        port = listener.getsockname()[1]
        received = bytearray()
        errors = []

        def serve():
            try:
                raw, _ = listener.accept()
                with context.wrap_socket(raw, server_side=True) as conn:
                    conn.settimeout(15)
                    conn.sendall(b"This world is Pueblo 1.10 enhanced.\r\n")
                    deadline = time.monotonic() + 8
                    while b"PUEBLOCLIENT 2.01\r\n" not in received and time.monotonic() < deadline:
                        received.extend(conn.recv(4096))
                    conn.sendall(b'</xch_mudtext><pre>TLS APP COMPLETE\r\n<a xch_cmd="look tls">Inspect TLS</a>\r\nFIXTURE COMPLETE\r\n')
                    deadline = time.monotonic() + 8
                    while b"look tls\r\n" not in received and time.monotonic() < deadline:
                        received.extend(conn.recv(4096))
                    time.sleep(2)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                listener.close()

        thread = threading.Thread(target=serve, daemon=True)
        thread.start()
        installed = False
        try:
            subprocess.run(["certutil", "-user", "-addstore", "-f", "Root", str(ca)],
                           check=True, capture_output=True, text=True)
            installed = True
            startup = subprocess.STARTUPINFO()
            startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startup.wShowWindow = 4
            app = subprocess.Popen([str(EXE), "--test-tls", str(port), str(OUT)], startupinfo=startup)
            try:
                app.wait(timeout=30)
            except subprocess.TimeoutExpired:
                app.kill()
                app.wait()
                raise AssertionError("TLS application did not finish")
        finally:
            if installed:
                subprocess.run(["certutil", "-user", "-delstore", "Root", thumbprint],
                               check=True, capture_output=True, text=True)
            listener.close()
            thread.join(timeout=3)
        assert not errors, errors
        assert not (OUT / "timeout.txt").exists(), "Native TLS test timed out"
        assert (OUT / "result.json").exists(), "No WebView result"
        result = json.loads((OUT / "result.json").read_text(encoding="utf-8"))
        assert "TLS APP COMPLETE" in result["text"] and "Pueblo" in result["protocol"], result
        assert result["commandClicked"] and b"look tls\r\n" in received, (result, received)
        assert (OUT / "preview.png").stat().st_size > 1000
        (OUT / "wire.txt").write_text(received.decode("utf-8", "replace"), encoding="utf-8")
        print(f"Full application TLS, Pueblo, and command path passed: {OUT}")


if __name__ == "__main__":
    run()
