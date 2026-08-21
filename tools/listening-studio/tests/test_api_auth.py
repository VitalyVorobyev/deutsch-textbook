"""Two ways to present one secret, and the rules that keep them from covering for each other.

`Authorization: Bearer` is what the desktop app and any CLI or agent use. The cookie and
`?token=` are what the legacy HTML pages use and die with them. Every row of the table in
`web.local_only`'s docstring has a test here, because an auth rule that is only *described* is a
rule nobody notices the day it stops holding.
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
    # A program is not a browser session: it already holds the token, and handing it an ambient
    # credential as well would add a way in without adding a capability.
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


def test_a_wrong_bearer_is_refused_even_beside_a_valid_cookie(tmp_path: Path) -> None:
    """A presented credential is never quietly overruled by an ambient one.

    Otherwise a client with a stale token works in every browser-shaped case and fails in every
    other, which is the hardest kind of auth bug to see: the failure is somewhere the token was
    never the thing being tested.
    """

    http = studio(tmp_path)
    assert http.get("/api/scenes?token=test").status_code == 200
    assert http.cookies.get("atlas_studio") == "test"

    refused = http.get("/api/scenes", headers={"Authorization": "Bearer wrong"})
    assert refused.status_code == 401


def test_a_request_with_no_origin_and_a_valid_bearer_passes(tmp_path: Path) -> None:
    """A CLI sends no `Origin`. The origin check is a CSRF guard and CSRF needs a cookie.

    Applying it to a header-authenticated request would refuse exactly the caller this API is
    for — and would not make a cookie-authenticated one any safer.
    """

    http = studio(tmp_path)
    assert "origin" not in {key.lower() for key in http.headers}
    assert http.get("/api/scenes", headers={"Authorization": "Bearer test"}).status_code == 200
    # Even a foreign origin, which the cookie path refuses, is irrelevant with a bearer token:
    # no browser attaches an `Authorization` header to a cross-site request on its own.
    foreign = http.get(
        "/api/scenes", headers={"Authorization": "Bearer test", "Origin": "https://evil.example"}
    )
    assert foreign.status_code == 200


def test_the_cookie_and_query_paths_still_work_exactly_as_before(tmp_path: Path) -> None:
    http = studio(tmp_path)
    assert http.get("/api/scenes").status_code == 403
    assert http.get("/api/scenes?token=test").status_code == 200
    assert http.cookies.get("atlas_studio") == "test"
    # The cookie alone carries the next request, which is what the HTML pages rely on.
    assert http.get("/api/scenes").status_code == 200
    # And the origin check still applies to it.
    blocked = http.get("/api/scenes", headers={"Origin": "https://evil.example"})
    assert blocked.status_code == 403
    assert blocked.json() == {"detail": "Invalid origin"}


def test_health_is_still_exempt_and_still_hands_out_nothing(tmp_path: Path) -> None:
    http = studio(tmp_path)
    assert http.get("/health").status_code == 200
    assert http.cookies.get("atlas_studio") is None
    assert http.get("/api/scenes").status_code == 403


def test_the_react_dashboard_endpoints_answer_the_same_shape_as_before(tmp_path: Path) -> None:
    """The split into `api/` moved code, not paths. The dashboard reads these two on every load.

    Read against the real course repository, because both endpoints join the plan, the character
    catalog and the Lesetext corpus — a fixture repo would exercise the empty branch of all
    three. The store is still a throwaway, so nothing here depends on the editor's own database.
    """

    store = Store(tmp_path / "db.sqlite3")
    http = TestClient(app(store, REPO, token="test"), raise_server_exceptions=False)
    dashboard = http.get("/api/dashboard?token=test")
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

    sounds = http.get("/api/sounds?token=test")
    assert sounds.status_code == 200 and sounds.json() == []
    projects = http.get("/api/projects?token=test")
    assert projects.status_code == 200
    assert {row["kind"] for row in projects.json()} == {"dialogue", "reading"}
    assert http.get("/api/narration-profiles?token=test").status_code == 200
