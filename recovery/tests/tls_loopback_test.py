"""Local Schannel integration test; requires cryptography and compiled tls_test.exe.

Generates a unique temporary CA and localhost server certificate. It imports
only that CA into the current user's Root store for the positive and hostname
tests, then removes that exact thumbprint in a finally block.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import pathlib
import socket
import ssl
import subprocess
import tempfile
import threading

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLIENT = ROOT / "build" / "tls_test.exe"


def certificates(folder: pathlib.Path):
    now = dt.datetime.now(dt.timezone.utc)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "BeipMU temporary TLS test CA")])
    ca = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.KeyUsage(True, False, False, False, False, True, True, False, False), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
        .issuer_name(ca_name)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.KeyUsage(True, False, True, False, False, False, False, False, False), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    ca_der = ca.public_bytes(serialization.Encoding.DER)
    ca_path, leaf_path, key_path = (folder / part for part in ("ca.cer", "server.pem", "server.key"))
    ca_path.write_bytes(ca_der)
    leaf_path.write_bytes(leaf.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(leaf_key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    return ca_path, leaf_path, key_path, hashlib.sha1(ca_der).hexdigest().upper()


def run():
    if not CLIENT.exists():
        raise RuntimeError(f"Compile {CLIENT} before running this test")
    with tempfile.TemporaryDirectory(prefix="beipmu-tls-") as directory:
        ca_path, leaf_path, key_path, thumbprint = certificates(pathlib.Path(directory))
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(leaf_path, key_path)
        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        server.listen(3)
        server.settimeout(15)
        port = server.getsockname()[1]
        failures = []

        def serve():
            try:
                for _ in range(3):
                    raw, _ = server.accept()
                    raw.settimeout(15)
                    try:
                        with context.wrap_socket(raw, server_side=True) as tls:
                            if tls.recv(4) == b"ping":
                                tls.sendall(b"pong")
                    except (ssl.SSLError, ConnectionError, TimeoutError):
                        raw.close()
            except Exception as exc:
                failures.append(exc)

        thread = threading.Thread(target=serve, daemon=True)
        thread.start()
        installed = False
        try:
            def client(host, expected):
                process = subprocess.run([str(CLIENT), "127.0.0.1", str(port), host, expected],
                    capture_output=True, text=True, timeout=20)
                if process.returncode:
                    raise AssertionError(f"TLS {host}/{expected}, exit {process.returncode}: {process.stdout} {process.stderr}")
                print(process.stdout.strip())

            client("localhost", "failure")  # CA is not yet trusted.
            subprocess.run(["certutil", "-user", "-addstore", "-f", "Root", str(ca_path)],
                check=True, capture_output=True, text=True)
            installed = True
            client("localhost", "success")
            client("wrong.example", "failure")
        finally:
            if installed:
                subprocess.run(["certutil", "-user", "-delstore", "Root", thumbprint],
                    check=True, capture_output=True, text=True)
            server.close()
            thread.join(timeout=2)
        if failures:
            raise RuntimeError(failures)
    print("3 local TLS cases passed")


if __name__ == "__main__":
    run()
