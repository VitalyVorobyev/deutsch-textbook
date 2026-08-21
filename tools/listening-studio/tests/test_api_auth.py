"""One secret, one way to present it, and the three things that are open on purpose.

Every row of the table in `web.local_only`'s docstring has a test here, because an auth rule that
is only *described* is a rule nobody notices the day it stops holding. Since PR 9b the table is
four rows rather than seven: the cookie, `?token=` and the origin check went with the HTML forms,
and this file is what proves they are gone rather than merely unused.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[3]


def studio(tmp_path: Path) -> TestClient:
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "listening-plan.yaml").write_text(
        yaml.safe_dump({"version": 1, "units": []})
    )
    store = Store(tmp_path / "db.sqlite3")
    return TestClient(app(store, tmp_path, token="test"), raise_server_exceptions=False)


def test_a_valid_bearer_token_is_accepted(tmp_path: Path) -> None:
    http = studio(tmp_path)
    response = http.get("/api/scenes", headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    assert response.json() == []
    # Nothing ambient is ever handed out. There is no session to have.
    assert http.cookies.get("atlas_studio") is None


def test_a_wrong_bearer_token_is_401_json_and_never_a_redirect(tmp_path: Path) -> None:
    """401, not 403: the credential is what is at fault, and the caller can act on that.

    And never a redirect — a redirect to an HTML sign-in page is unparseable to the CLI that
    sent the header, which would see a 200 full of markup and no way to tell it went wrong.
    """

    http = studio(tmp_path)
    response = http.get(
        "/api/scenes", headers={"Authorization": "Bearer wrong"}, follow_redirects=False
    )
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Invalid bearer token"}
    assert response.headers.get("www-authenticate") == "Bearer"

    scheme = http.get("/api/scenes", headers={"Authorization": "Token test"})
    assert scheme.status_code == 401

    # A non-ASCII credential is a wrong credential, not a 500. Sent as raw bytes because that is
    # the only way one can arrive: an HTTP header is bytes on the wire, Starlette decodes it as
    # latin-1, and `secrets.compare_digest` on a `str` outside ASCII raises TypeError — which
    # would leave the middleware as an unhandled 500. The comparison is made on bytes instead.
    exotic = http.get("/api/scenes", headers={"Authorization": "Bearer tëst".encode("latin-1")})
    assert exotic.status_code == 401
    assert http.get("/api/scenes", headers={"Authorization": "Bearer"}).status_code == 401


def test_no_credential_at_all_is_also_401_and_says_which_it_was(tmp_path: Path) -> None:
    """The 403 row is gone with the cookie that made it mean something.

    It used to say "you are not this machine", which was answerable — present the cookie, or come
    from localhost. With one credential and one way to present it there is nothing else to try, so
    a missing bearer and a wrong one get the same status and different words. 401 is also what
    Tonwerk turns back into its token screen; a 403 would leave a stale session staring at an
    error it could not act on.
    """

    http = studio(tmp_path)
    missing = http.get("/api/scenes")
    assert missing.status_code == 401
    assert missing.json() == {"detail": "Missing bearer token"}
    assert missing.headers.get("www-authenticate") == "Bearer"


def test_the_cookie_and_query_token_paths_are_gone(tmp_path: Path) -> None:
    """Both legacy presentations are refused, and neither leaves a session behind.

    `?token=` used to authenticate and set a cookie that carried the *next* request. A regression
    here is silent in exactly the way that matters: everything keeps working in a browser and the
    credential nobody meant to keep issuing is back.
    """

    http = studio(tmp_path)
    assert http.get("/api/scenes?token=test").status_code == 401
    assert http.cookies.get("atlas_studio") is None

    http.cookies.set("atlas_studio", "test")
    assert http.get("/api/scenes").status_code == 401


def test_the_origin_check_is_gone_because_there_is_nothing_ambient_left(tmp_path: Path) -> None:
    """It was a CSRF guard, and CSRF is a property of credentials a browser attaches by itself.

    A bearer request has always been exempt (a CLI sends no `Origin` at all). With the cookie
    deleted, every request is a bearer request — so the check now only ever had one possible
    subject, and that subject was never at risk. It is removed rather than left as a no-op.
    """

    http = studio(tmp_path)
    foreign = http.get(
        "/api/scenes", headers={"Authorization": "Bearer test", "Origin": "https://evil.example"}
    )
    assert foreign.status_code == 200
    assert "access-control-allow-origin" not in {key.lower() for key in foreign.headers}


def test_health_is_open_hands_out_nothing_and_opens_nothing(tmp_path: Path) -> None:
    """/health is token-exempt so a supervisor can poll it; that must not be a way in.

    Every response used to carry the session cookie, so any client could GET /health, keep the
    cookie it was given, and reach every mutation endpoint without ever knowing the token. There
    is no cookie to be given now, and this asserts both halves: the poll works, and it buys the
    same client nothing on the next request.
    """

    http = studio(tmp_path)
    health = http.get("/health")
    assert health.status_code == 200
    assert "atlas_studio" not in health.cookies
    assert http.cookies.get("atlas_studio") is None
    assert http.get("/api/scenes").status_code == 401


def test_the_workbench_is_served_open_because_it_is_what_asks_for_the_token(
    tmp_path: Path,
) -> None:
    """`/` carries no studio data, and a token screen behind the token is unreachable.

    Which of the two answers arrives depends on whether `apps/tonwerk/dist` exists in this
    checkout, and both are correct — what is being asserted is that neither is a 401.
    """

    http = studio(tmp_path)
    root = http.get("/")
    assert root.status_code in {200, 503}
    if root.status_code == 503:
        assert "bun run tonwerk:build" in root.text


def test_the_only_routes_outside_api_are_health_and_the_workbench(tmp_path: Path) -> None:
    """No form route survived the deletion, asserted against the route table rather than by GET.

    By request, because the answer to a GET depends on the checkout: with `apps/tonwerk/dist`
    built, the static mount at `/` answers 404 for `/projects/1` and **405** for a POST to it,
    which is the right behaviour and a useless assertion. The route table is the fact.

    It matters beyond tidiness: `/projects/{id}/script` and its siblings wrote a `RevisionPayload`
    through an HTML form, and those projects are frozen data until PR 11 converts them.
    """

    store = Store(tmp_path / "db.sqlite3")
    api = app(store, tmp_path, token="test")
    paths = {str(getattr(route, "path", "")) for route in api.routes}
    outside = {path for path in paths if not path.startswith("/api")}
    # `/openapi.json` and the two doc pages are FastAPI's own and were never part of the surface.
    # The empty string is the static mount: Starlette normalises a `Mount` at `/` to a `""` prefix.
    assert outside <= {
        "",
        "/",
        "/health",
        "/openapi.json",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
    }
    assert not [path for path in paths if path.startswith(("/projects", "/readings"))]


def test_the_dashboard_endpoints_answer_the_same_shape_as_before(tmp_path: Path) -> None:
    """The pre-scene projects are frozen data, and they stay readable.

    Read against the real course repository, because both endpoints join the plan, the character
    catalog and the Lesetext corpus — a fixture repo would exercise the empty branch of all
    three. The store is still a throwaway, so nothing here depends on the editor's own database.
    """

    store = Store(tmp_path / "db.sqlite3")
    http = TestClient(app(store, REPO, token="test"), raise_server_exceptions=False)
    auth = {"Authorization": "Bearer test"}
    dashboard = http.get("/api/dashboard", headers=auth)
    assert dashboard.status_code == 200
    assert set(dashboard.json()) == {"dialogues", "readings", "issues", "summary"}
    assert set(dashboard.json()["summary"]) == {
        "dialogues",
        "dialogues_approved",
        "readings",
        "readings_approved",
        "paragraphs",
        "characters",
        "sounds",
    }
    assert dashboard.json()["summary"]["dialogues"] > 0
    assert dashboard.json()["summary"]["readings"] > 0

    sounds = http.get("/api/sounds", headers=auth)
    assert sounds.status_code == 200 and sounds.json() == []
    projects = http.get("/api/projects", headers=auth)
    assert projects.status_code == 200
    assert {row["kind"] for row in projects.json()} == {"dialogue", "reading"}
    assert http.get("/api/narration-profiles", headers=auth).status_code == 200
