"""The app factory: one JSON API, one bearer token, and the built workbench in front of it.

Since PR 9b this module is small on purpose. Everything a person does with the studio happens in
**Tonwerk** (`apps/tonwerk`), a React app that talks to `/api` and nothing else; the server-rendered
HTML that used to live here and in `ui.py` — the index, the project page, the script and question
forms, the two approval pages — is gone, along with the cookie and `?token=` credentials that
existed only to carry a browser through them.

What is left is three things, in the order they are registered:

1. `/health`, open, so a supervisor can poll it.
2. `/api/**`, from `api/`, behind `Authorization: Bearer`.
3. the built Tonwerk bundle at `/`, when there is one — a **mount**, so it must come last: a
   static mount at `/` matches every path beneath it and would shadow both of the above.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from .generative.locks import set_models_root
from .storage import Store
from .api import Transcriber
from .api import router as studio_router


PACKAGE_ROOT = Path(__file__).resolve().parents[2]

#: The workbench's built bundle, found from **this package's own position** rather than from the
#: `--repo` the server was started against. `apps/tonwerk` is part of this repository; `--repo` may
#: point at a fixture that has never heard of it, and in the tests it always does.
TONWERK_DIST = PACKAGE_ROOT.parents[1] / "apps" / "tonwerk" / "dist"

#: What `/` answers when nobody has built the workbench. Plain text, because the reader is looking
#: at a browser tab that was supposed to be an app and needs one command, not a styled page.
NO_BUNDLE = (
    "Tonwerk ist nicht gebaut.\n\n"
    "  bun run tonwerk:build\n\n"
    "Danach diese Seite neu laden. Die JSON-API läuft bereits: /api, mit dem Bearer-Token,\n"
    "das beim Start ausgegeben wurde.\n"
)


def app(
    store: Store,
    repo: Path,
    token: str | None = None,
    *,
    allow_test_adapters: bool = False,
    transcribe_fn: Transcriber | None = None,
) -> FastAPI:
    api = FastAPI(title="Deutsch-Atlas Listening Studio")
    # The course repository this server was started against is also where `.models/` is looked
    # for. Stated once here rather than re-derived from this file's position on every lookup.
    set_models_root(repo)
    secret = token or secrets.token_urlsafe(24)

    @api.middleware("http")
    async def local_only(request: Request, call_next):  # type: ignore[no-untyped-def]
        """One secret, one way to present it, and one thing it guards.

        | Path | `Authorization` | Result |
        | ---------------------------- | -------------- | ------------ |
        | `/api/**` | correct bearer | pass |
        | `/api/**` | present, wrong | **401 JSON** |
        | `/api/**` | absent | **401 JSON** |
        | `/health`, `/`, the workbench | anything | pass |

        Three rows of the previous table are gone, and each one went for a reason.

        *The cookie and `?token=` are gone with the pages that needed them.* They existed so a
        browser could carry a credential through `ui.py`'s server-rendered forms. Tonwerk is a
        bundle that sends `Authorization` on every request it makes, so nothing ambient is left —
        which is also why **the origin check is gone**. That check was a CSRF guard; CSRF is a
        property of ambient credentials, because a browser attaches a cookie to a cross-site
        request without being asked and never attaches an `Authorization` header. With no cookie
        to attach, a foreign page can neither send a credentialed request here nor read the answer
        to an uncredentialed one — this server sends no CORS headers at all.

        *An absent credential is now 401, not 403.* The two used to differ because a request could
        arrive holding an ambient cookie: 403 meant "not from this machine", 401 meant "your token
        is wrong". With one credential and one way to present it, "you presented none" and "what
        you presented is wrong" are the same answer to the same caller — and 401 with
        `WWW-Authenticate` is the one Tonwerk turns back into its token screen.

        *The workbench itself is open, and has to be.* It is the screen that **asks** for the
        token, so a bundle behind the token could never be reached. It carries no studio data:
        every byte of that is behind `/api`, and this server binds to 127.0.0.1.

        `/health` stays exempt so a supervisor can poll it, and it now hands out nothing because
        nothing is handed out to anybody — the session cookie that made the exemption a way in
        does not exist any more.
        """

        # Returned, not raised. An HTTPException raised inside an http middleware never reaches
        # FastAPI's exception handler — Starlette lets it escape as an unhandled error — so
        # every rejection here was answering 500 while looking like a 403 in the source.
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        header = request.headers.get("authorization")
        scheme, _, presented = (header or "").partition(" ")
        # Compared as bytes: `compare_digest` on `str` raises TypeError for anything outside
        # ASCII, so a header with one accented character would leave the middleware as an
        # unhandled 500 instead of the 401 a wrong credential deserves.
        if header is None or scheme.lower() != "bearer" or not secrets.compare_digest(
            presented.strip().encode("utf-8", "surrogatepass"), secret.encode()
        ):
            return JSONResponse(
                {"detail": "Invalid bearer token" if header else "Missing bearer token"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
        return await call_next(request)

    @api.exception_handler(ValueError)
    def workflow_error(request: Request, exc: ValueError) -> Response:
        """A refused step is the editor's answer, not a server fault.

        `Store.transition` raises ValueError for anything that is not the legal next step, and
        nothing caught it — so a project already at `automatically_checked` answered a bare 500
        traceback to Validate, Generate and QA alike.

        Every route now under this handler is JSON, so the HTML branch it used to carry went with
        the forms. It stays as the backstop for the paths where a `model_validate` can raise
        inside a legacy `api/projects` or `api/readings` write: those answer a readable 409
        instead of a traceback the desktop app cannot parse.
        """

        return JSONResponse({"detail": str(exc)}, status_code=409)

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    api.include_router(
        studio_router(
            store,
            repo,
            allow_test_adapters=allow_test_adapters,
            transcribe_fn=transcribe_fn,
        )
    )

    if TONWERK_DIST.is_dir():
        # Last, and at `/`: a static mount matches everything beneath its prefix, so registering
        # it before `/health` or the API router would shadow both. `html=True` serves index.html
        # for `/`, which is all a hash-routed app needs — every Tonwerk address is `#/…`.
        api.mount("/", StaticFiles(directory=TONWERK_DIST, html=True), name="tonwerk")
    else:

        @api.get("/", response_class=PlainTextResponse)
        def unbuilt() -> PlainTextResponse:
            return PlainTextResponse(NO_BUNDLE, status_code=503)

    api.state.session_token = secret
    api.state.repo = repo
    return api
