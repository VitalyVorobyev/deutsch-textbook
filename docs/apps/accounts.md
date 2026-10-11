# Accounts and sync — a guide

Signing in is optional: without an account the app is complete and stays on your device. An
account adds a cloud copy of your progress so another device can pick it up. How sync works and how
the server is set up is in [`../architecture/cloud-sync.md`](../architecture/cloud-sync.md).

## Creating your own account and bringing your existing progress into it

The owner's account is not seeded by a migration; it is created by signing in, and `OWNER_EMAILS`
is what makes that first sign-in an approved owner rather than a pending learner.

1. Finish the [server setup](../architecture/cloud-sync.md#setup) (D1, R2, both OAuth apps, six
   secrets, migrations). `OWNER_EMAILS` must contain the address you will sign in with.
2. On the device that already holds your progress, open **Fortschritt → Daten → Export** and keep
   the file. This is a safety net, not a required step — step 5 needs it only if you are moving to
   a different browser.
3. Open the profile menu in the header → **Anmelden**, and sign in. You should land on `/konto` as
   `Aktiv` with the **Eigentümer** marker. If it says *Wartet auf Freigabe*, `OWNER_EMAILS` did not
   match the verified email the provider returned — fix the secret and sign in again; it is
   re-applied on every sign-in.
4. Press **Verbinden · \<your profile\>**. This binds that local profile to the account. Because the
   profile already has attempts, it asks first: connecting merges the local history with whatever
   the account holds. On a fresh account it holds nothing, so this is a pure upload.
5. Only if you are on a *different* browser from the one with your history: **Fortschritt
   hochladen** and pick the exported file. It is merged into the local profile first and then
   pushed, so nothing is lost in either direction.
6. Confirm: `Zuletzt synchronisiert` gets a timestamp, and `bun run progress:pull --list` shows
   `snapshots/<your account id>/current.json.gz`.

A second device then needs only steps 3 and 4 — its first sync pulls the account state and merges
it into whatever that device had.

## Approving someone else

1. They open the site and sign in with Google or GitHub. An account is created for them
   **`pending`**, and nothing of theirs is stored server-side.
2. They see *Wartet auf Freigabe* on `/konto` and can keep learning; their progress stays on their
   device and uploads once you approve.
3. You open `/konto`. The **Nutzer** section lists every account, pending ones first.
4. **Freigeben** flips them to `approved` and their next sync uploads. **Sperren** stops an
   approved account syncing without touching what is already stored. **Entfernen** deletes the
   account, its sessions, its device tokens and its R2 objects.

You cannot suspend or delete your own account from that list — the API refuses it, because the only
surface that could undo it is the one you would be locking yourself out of. Use **Konto löschen**
on your own card if you really mean it.

## Connecting the desktop app

The desktop webview is a different origin, so it cannot receive the session cookie. Rather than
carrying a bearer token between machines, the app asks and you approve:

1. In the desktop app, open **Konto** → **Geräte** → **Verbinden**. It shows an eight-symbol code
   like `AC4K-MTQ9` and starts waiting.
2. On any device where you are signed in to the website, open `/konto` → **Geräte**, type that code
   and press **Weiter**.
3. Check that the code and device name on screen match what the app is showing, then **Freigeben**.
4. The desktop picks up its token within a few seconds and starts syncing.

Codes expire after ten minutes; if one does, start again in step 1. Revoke a connected device from
the website at any time. For a machine you cannot look at while you use the browser — a headless
box, a VM, an SSH session — **Gerätecode von Hand ausstellen** on the website still issues a `dat_…`
token to paste in directly.
