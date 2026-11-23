#!/usr/bin/env python3
"""One-time localhost form that sends Google OAuth settings directly by SFTP.

No credential is written to a local file. Access to the local form requires a
random one-use path. Submit only after confirming the destination SSH host key.
"""

import argparse
import io
import secrets
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs

import paramiko


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--ssh-key", type=Path, required=True)
    parser.add_argument("--host", default="100.88.213.117")
    parser.add_argument("--user", default="fnavarro")
    parser.add_argument("--remote-auth-env", default="/supabase/auth.env")
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
                '<!doctype html><meta charset="utf-8"><title>GV Cloud OAuth</title>'
                '<h1>Google OAuth para GV Cloud</h1>'
                '<p>Este formulario local envía el secreto directamente por SFTP.</p>'
                '<form method="post"><label>Client ID '
                '<input name="client_id" autocomplete="off"></label>'
                '<label>Client secret '
                '<input type="password" name="client_secret" autocomplete="off"></label>'
                '<button type="submit">Guardar en Auth</button></form>'
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
                form = parse_qs(self.rfile.read(length).decode(), strict_parsing=True)
                client_id = form["client_id"][0]
                client_secret = form["client_secret"][0]
                if not client_id.endswith(".apps.googleusercontent.com") or not client_secret:
                    raise ValueError("invalid Google OAuth input")
                ssh = paramiko.SSHClient()
                ssh.load_host_keys(str(args.known_hosts))
                ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
                ssh.connect(
                    args.host, username=args.user, key_filename=str(args.ssh_key),
                    look_for_keys=False, allow_agent=False, timeout=15,
                )
                try:
                    sftp = ssh.open_sftp()
                    with sftp.open(args.remote_auth_env, "rb") as handle:
                        current = handle.read().decode()
                    updates = {
                        "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID": client_id,
                        "GOTRUE_EXTERNAL_GOOGLE_SECRET": client_secret,
                    }
                    seen = set()
                    result = []
                    for line in current.splitlines(keepends=True):
                        key = line.split("=", 1)[0]
                        if key in updates:
                            result.append(key + "=" + updates[key] + "\n")
                            seen.add(key)
                        else:
                            result.append(line)
                    if seen != set(updates):
                        raise RuntimeError("Auth env Google keys are missing")
                    data = "".join(result).encode()
                    temp = args.remote_auth_env + ".transfer.tmp"
                    try:
                        sftp.putfo(io.BytesIO(data), temp, file_size=len(data), confirm=True)
                        sftp.chmod(temp, 0o600)
                        sftp.posix_rename(temp, args.remote_auth_env)
                    except Exception:
                        try:
                            sftp.remove(temp)
                        except Exception:
                            pass
                        raise
                    with sftp.open(args.remote_auth_env, "rb") as handle:
                        saved = handle.read().decode()
                    if not all(key + "=" + value in saved for key, value in updates.items()):
                        raise RuntimeError("remote verification failed")
                finally:
                    ssh.close()
                body = b"Saved and verified on GV Cloud. Ask Javier to restart Auth."
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                print("OAuth saved and verified remotely.", flush=True)
            except Exception as error:
                print("OAuth transfer failed:", type(error).__name__, flush=True)
                self.send_error(500, "Remote transfer failed")
            finally:
                threading.Thread(target=self.server.shutdown, daemon=True).start()

    server = HTTPServer(("127.0.0.1", 0), Handler)
    print(f"Open local one-time URL: http://127.0.0.1:{server.server_port}/{token}", flush=True)
    server.serve_forever()
    server.server_close()


if __name__ == "__main__":
    main()
