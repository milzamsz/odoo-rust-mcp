#!/usr/bin/env python3
"""
MCP smoke tester for this repo.

Supports:
- STDIO (Cursor-style plain JSON-RPC over stdin/stdout)
- HTTP Streamable (POST /mcp)
- Legacy SSE (/sse + /messages)

Usage examples:
  # 1) STDIO (spawns the Rust binary, uses env from .env)
  python3 mcp_test.py stdio --bin ./rust-mcp/target/release/rust-mcp --env-file .env

  # 2) HTTP Streamable (assumes server already running with --transport http --listen 127.0.0.1:8787)
  python3 mcp_test.py http --url http://127.0.0.1:8787/mcp
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def read_env_file(path: str) -> Dict[str, str]:
    env: Dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as f:
        for raw in f.readlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            env[k] = v
    return env


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


@dataclass
class JsonRpcResponse:
    jsonrpc: str
    id: Any
    result: Optional[Any]
    error: Optional[Any]


def parse_jsonrpc(line: str) -> JsonRpcResponse:
    v = json.loads(line)
    return JsonRpcResponse(
        jsonrpc=v.get("jsonrpc"),
        id=v.get("id"),
        result=v.get("result"),
        error=v.get("error"),
    )


def stdio_roundtrip(
    bin_path: str,
    env: Dict[str, str],
    timeout_s: float = 3.0,
) -> None:
    cmd = [bin_path, "--transport", "stdio"]
    eprint("Starting:", " ".join(cmd))

    p = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env={**os.environ, **env},
        bufsize=1,
    )

    def send(obj: Any) -> None:
        assert p.stdin is not None
        p.stdin.write(json_dumps(obj) + "\n")
        p.stdin.flush()

    def recv_line(deadline: float) -> str:
        assert p.stdout is not None
        while time.time() < deadline:
            line = p.stdout.readline()
            if line:
                return line.strip()
            time.sleep(0.01)
        raise TimeoutError("timeout waiting for stdout line")

    try:
        # initialize
        send(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "clientInfo": {"name": "mcp_test.py", "version": "0.1"},
                    "capabilities": {},
                    "protocolVersion": "2025-11-05",
                },
            }
        )
        deadline = time.time() + timeout_s
        init_line = recv_line(deadline)
        init = parse_jsonrpc(init_line)
        if init.error is not None:
            raise RuntimeError(f"initialize error: {init.error}")
        print("initialize ok")

        # initialized notification (Cursor sends this)
        send({"jsonrpc": "2.0", "method": "initialized"})

        # tools/list
        send({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        tools_line = recv_line(time.time() + timeout_s)
        tools = parse_jsonrpc(tools_line)
        if tools.error is not None:
            raise RuntimeError(f"tools/list error: {tools.error}")
        tool_names = [t.get("name") for t in (tools.result or {}).get("tools", [])]
        print("tools/list:", tool_names)

        # quick tool call: count partners
        send(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "odoo_count",
                    "arguments": {
                        "instance": "default",
                        "model": "res.partner",
                        "domain": [["id", ">", 0]],
                    },
                },
            }
        )
        call_line = recv_line(time.time() + timeout_s)
        call = parse_jsonrpc(call_line)
        if call.error is not None:
            raise RuntimeError(f"tools/call error: {call.error}")
        print("odoo_count raw result:", call.result)

        # shutdown + exit
        send({"jsonrpc": "2.0", "id": 4, "method": "shutdown"})
        _ = recv_line(time.time() + timeout_s)
        send({"jsonrpc": "2.0", "method": "exit"})
        print("shutdown ok")

    finally:
        try:
            p.kill()
        except Exception:
            pass
        try:
            out, err = p.communicate(timeout=0.2)
        except Exception:
            out, err = ("", "")
        if err.strip():
            eprint("server stderr (tail):")
            eprint(err.strip()[-2000:])


def http_post(url: str, body: Any, headers: Dict[str, str]) -> Tuple[int, Dict[str, str], str]:
    data = json_dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            text = resp.read().decode("utf-8", errors="replace")
            return status, resp_headers, text
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        return e.code, {k.lower(): v for k, v in e.headers.items()}, text


def http_roundtrip(url: str) -> None:
    # initialize
    status, headers, text = http_post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "clientInfo": {"name": "mcp_test.py", "version": "0.1"},
                "capabilities": {},
                "protocolVersion": "2025-11-05",
            },
        },
        {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    if status != 200:
        raise RuntimeError(f"initialize failed: http {status}: {text}")
    resp = parse_jsonrpc(text)
    if resp.error is not None:
        raise RuntimeError(f"initialize error: {resp.error}")
    sess = headers.get("mcp-session-id")
    print("initialize ok, session:", sess)

    # initialized
    status, _h, _t = http_post(
        url,
        {"jsonrpc": "2.0", "method": "initialized"},
        {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **({"Mcp-Session-Id": sess} if sess else {}),
        },
    )
    if status not in (200, 202):
        raise RuntimeError(f"initialized failed: http {status}")

    # tools/list
    status, _h, text = http_post(
        url,
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **({"Mcp-Session-Id": sess} if sess else {}),
        },
    )
    if status != 200:
        raise RuntimeError(f"tools/list failed: http {status}: {text}")
    resp = parse_jsonrpc(text)
    if resp.error is not None:
        raise RuntimeError(f"tools/list error: {resp.error}")
    tool_names = [t.get("name") for t in (resp.result or {}).get("tools", [])]
    print("tools/list:", tool_names)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="mode", required=True)

    ap_stdio = sub.add_parser("stdio", help="spawn rust-mcp and talk over stdio")
    ap_stdio.add_argument("--bin", required=True, help="path to rust-mcp binary")
    ap_stdio.add_argument("--env-file", default=".env", help="env file to load (.env)")
    ap_stdio.add_argument("--timeout", type=float, default=3.0)

    ap_http = sub.add_parser("http", help="talk to streamable-http endpoint (POST /mcp)")
    ap_http.add_argument("--url", required=True, help="e.g. http://127.0.0.1:8787/mcp")

    args = ap.parse_args()

    if args.mode == "stdio":
        env = {}
        if args.env_file and os.path.exists(args.env_file):
            env.update(read_env_file(args.env_file))
        # normalize single-instance env (server supports ODOO_URL without scheme, but keep explicit)
        if "ODOO_URL" in env and "://" not in env["ODOO_URL"]:
            env["ODOO_URL"] = "http://" + env["ODOO_URL"]
        # If using a compose-oriented env (host.docker.internal), rewrite for host-side stdio tests.
        if env.get("ODOO_URL", "").startswith("http://host.docker.internal") or env.get(
            "ODOO_URL", ""
        ).startswith("https://host.docker.internal"):
            eprint(
                "Note: rewriting ODOO_URL host.docker.internal -> http://localhost:8069 for stdio test"
            )
            env["ODOO_URL"] = "http://localhost:8069"
        stdio_roundtrip(args.bin, env, timeout_s=args.timeout)
        return

    if args.mode == "http":
        http_roundtrip(args.url)
        return


if __name__ == "__main__":
    main()

