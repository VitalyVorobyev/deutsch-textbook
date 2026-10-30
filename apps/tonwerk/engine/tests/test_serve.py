"""`serve --handshake`, as the desktop shell runs it: a real process, a real port, a real pipe.

Everything here goes through a subprocess because what is being asserted is process behaviour
that no in-process client can see: what reaches stdout, which port was bound, and that the engine
exits when the process holding its stdin goes away.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest
import typer

from listening_studio.cli import listening_socket

LAUNCH = "from listening_studio.cli import app; app()"


def engine(tmp_path: Path, *args: str) -> subprocess.Popen[str]:
    (tmp_path / "data").mkdir(exist_ok=True)
    (tmp_path / "data" / "listening-plan.yaml").write_text("version: 1\nunits: []\n")
    # The store lives in the user data directory, so HOME and XDG_DATA_HOME are pointed at the
    # fixture: a test must never migrate the operator's own database.
    env = os.environ | {"HOME": str(tmp_path), "XDG_DATA_HOME": str(tmp_path / "xdg")}
    return subprocess.Popen(
        [sys.executable, "-c", LAUNCH, "serve", "--repo", str(tmp_path), *args],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )


def test_the_handshake_is_one_json_line_and_the_engine_stops_when_stdin_closes(
    tmp_path: Path,
) -> None:
    process = engine(tmp_path, "--port", "0", "--handshake")
    try:
        assert process.stdout is not None and process.stdin is not None
        handshake = json.loads(process.stdout.readline())
        assert handshake["tonwerk"] == 1
        assert handshake["port"] > 0
        assert handshake["url"] == f"http://127.0.0.1:{handshake['port']}/"

        # Usable the moment it is printed: the socket was listening before the line was written.
        with urllib.request.urlopen(f"{handshake['url']}health", timeout=10) as health:
            assert json.load(health) == {"status": "ok"}
        request = urllib.request.Request(
            f"{handshake['url']}api/scenes",
            headers={"Authorization": f"Bearer {handshake['token']}"},
        )
        with urllib.request.urlopen(request, timeout=10) as scenes:
            assert json.load(scenes) == []

        process.stdin.close()
        assert process.wait(timeout=20) == 0
        # Nothing after the handshake: the access log is off and uvicorn logs to stderr.
        assert process.stdout.read() == ""
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


def test_the_launch_code_from_serve_signs_in_once(tmp_path: Path) -> None:
    """The printed link is the browser's way in, and it is spent by its first use."""

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    process = engine(tmp_path, "--port", str(port), "--no-browser")
    try:
        assert process.stdout is not None
        first = process.stdout.readline()
        assert first.startswith(f"Tonwerk: http://127.0.0.1:{port}/#code=")
        code = first.split("#code=", 1)[1].split()[0]
        token = process.stdout.readline().removeprefix("API bearer token: ").strip()

        def exchange() -> int:
            body = json.dumps({"code": code}).encode()
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/session",
                data=body,
                headers={"Content-Type": "application/json"},
            )
            for _ in range(100):
                try:
                    with urllib.request.urlopen(request, timeout=10) as response:
                        assert json.load(response) == {"token": token}
                        return response.status
                except urllib.error.HTTPError as error:
                    return error.code
                except urllib.error.URLError:
                    # Without `--handshake` the lines are printed before uvicorn starts, but
                    # the socket is already listening, so this branch is a slow import at most.
                    continue
            raise AssertionError("engine never answered")

        assert exchange() == 200
        assert exchange() == 401
    finally:
        process.terminate()
        process.wait(timeout=20)


def test_a_taken_port_is_refused_with_the_way_out(tmp_path: Path) -> None:
    held = listening_socket(0)
    try:
        with pytest.raises(typer.BadParameter, match="--port 0"):
            listening_socket(held.getsockname()[1])
    finally:
        held.close()
