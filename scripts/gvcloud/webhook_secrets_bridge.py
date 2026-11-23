#!/usr/bin/env python3
"""One-time localhost form that sends the mail-webhook secrets directly by SFTP.

Sets RESEND_WEBHOOK_SECRET and/or BREVO_WEBHOOK_SECRET in the app's remote
.env.production. No value is written to a local file or printed. Access to the
local form requires a random one-use path. Submit only after confirming the
destination SSH host key. Restart the app afterwards (touch reiniciar.txt).
"""

import argparse
import io
import secrets
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs

import paramiko

FIELDS = {
    "resend_secret": "RESEND_WEBHOOK_SECRET",
    "brevo_token": "BREVO_WEBHOOK_SECRET",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--ssh-key", type=Path, required=True)
    parser.add_argument("--host", default="100.88.213.117")
    parser.add_argument("--user", default="fnavarro")
    parser.add_argument("--remote-env", default="/sitios/mundialdecollage.com.ar/.env.production")
    args = parser.parse_args()
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *parts) -> None:
            pass

        def do_GET(self) -> None:
            if self.path != "/" + token:
                self.send_error(404)
                return
            body = (
                '<!doctype html><meta charset="utf-8"><title>GV Cloud webhooks</title>'
                '<h1>Secretos de webhooks de correo</h1>'
                '<p>Este formulario local envía los valores directamente por SFTP. '
                'Dejá vacío el que no quieras cambiar.</p>'
                '<form method="post"><label>Resend signing secret (whsec_...) '
                '<input type="password" name="resend_secret" autocomplete="off"></label><br>'
                '<label>Brevo bearer token '
                '<input type="password" name="brevo_token" autocomplete="off"></label><br>'
                '<button type="submit">Guardar en GV Cloud</button></form>'
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:
            if self.path != "/" + token:
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                self.send_error(413)
                return
            try:
                form = parse_qs(self.rfile.read(length).decode(), keep_blank_values=True)
                updates = {}
                for field, key in FIELDS.items():
                    value = (form.get(field) or [""])[0].strip()
                    if value:
                        if any(c in value for c in "\r\n\0 "):
                            raise ValueError("invalid characters in " + key)
                        updates[key] = value
                if not updates:
                    raise ValueError("no value submitted")
                ssh = paramiko.SSHClient()
                ssh.load_host_keys(str(args.known_hosts))
                ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
                ssh.connect(
                    args.host, username=args.user, key_filename=str(args.ssh_key),
                    look_for_keys=False, allow_agent=False, timeout=15,
                )
                try:
                    sftp = ssh.open_sftp()
                    with sftp.open(args.remote_env, "rb") as handle:
                        current = handle.read().decode()
                    seen = set()
                    result = []
                    for line in current.splitlines(keepends=True):
                        key = line.split("=", 1)[0]
                        if key in updates:
                            result.append(key + "=" + updates[key] + "\n")
                            seen.add(key)
                        else:
                            result.append(line)
                    if result and not result[-1].endswith("\n"):
                        result[-1] += "\n"
                    for key in updates:
                        if key not in seen:
                            result.append(key + "=" + updates[key] + "\n")
                    data = "".join(result).encode()
                    temp = args.remote_env + ".transfer.tmp"
                    try:
                        sftp.putfo(io.BytesIO(data), temp, file_size=len(data), confirm=True)
                        sftp.chmod(temp, 0o600)
                        sftp.posix_rename(temp, args.remote_env)
                    except Exception:
                        try:
                            sftp.remove(temp)
                        except Exception:
                            pass
                        raise
                    with sftp.open(args.remote_env, "rb") as handle:
                        saved = handle.read().decode()
                    if not all(key + "=" + value in saved for key, value in updates.items()):
                        raise RuntimeError("remote verification failed")
                finally:
                    ssh.close()
                body = ("Saved and verified: " + ", ".join(sorted(updates)) + ". Restart the app.").encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                print("Saved and verified remotely:", ", ".join(sorted(updates)), flush=True)
            except Exception as error:
                print("Webhook secret transfer failed:", type(error).__name__, flush=True)
                self.send_error(500, "Remote transfer failed")
            finally:
                threading.Thread(target=self.server.shutdown, daemon=True).start()

    server = HTTPServer(("127.0.0.1", 0), Handler)
    print(f"Open local one-time URL: http://127.0.0.1:{server.server_port}/{token}", flush=True)
    server.serve_forever()
    server.server_close()


if __name__ == "__main__":
    main()
