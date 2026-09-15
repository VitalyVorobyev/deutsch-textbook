// Thin desktop shell: the whole app is the static Astro site in ../dist.
// Plugins exist only for the progress autosync (write snapshots to a
// user-chosen folder — see src/lib/autosync.ts and src/lib/syncdir.ts) and the
// Schreib-Assistent's Ollama transport (http, capability-scoped to exactly
// http://localhost:11434/* — see src/lib/assist.ts and docs/assist-design.md).
//
// Three guards were added with ADR 0018, all of them about the webview's storage
// rather than about the app: the single-instance lock (two processes on one WebKit
// container contend for its SQLite files, a plausible cause of the IndexedDB stall
// that produced ADR 0018), `legacy_webkit_container` (a second container from
// bundle-less runs of this binary — reported, never touched) and the `devtools`
// feature, on in release builds because a single-learner app whose storage can stall
// is worth being able to inspect where it actually runs.
//
// The one piece of shell logic: the exit flush. `pagehide` does not reliably
// fire in the webview on window close or Cmd+Q, so the last ≤20 s of progress
// writes would never reach the sync folder or the cloud. Closing is therefore
// intercepted ONCE: the shell emits `da:close-requested`, the frontend flushes
// (src/lib/autosync.ts `flushForExit`) and answers with the `flush_complete`
// command; a 2 s fallback closes regardless, so a hung webview can never make
// the window unclosable.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

/// Set once the frontend has flushed (or the fallback gave up waiting).
/// After it is set, close and exit proceed without another interception.
static FLUSHED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn flush_complete(app: tauri::AppHandle) {
    FLUSHED.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn begin_flush<E: Emitter<tauri::Wry>>(emitter: &E, app: tauri::AppHandle) {
    let _ = emitter.emit("da:close-requested", ());
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(2));
        if !FLUSHED.swap(true, Ordering::SeqCst) {
            app.exit(0);
        }
    });
}

/// A second WKWebView data container on this machine, if there is one.
///
/// A Tauri app's webview storage lives under a container named after the bundle
/// identifier; launching the release *binary* without its `.app` gets one named after
/// the executable instead. That second container is a whole separate IndexedDB *and*
/// localStorage — its own profile registry, cards and attempts. ADR 0016 recorded the
/// hazard and deferred the warning; this is it.
///
/// **Metadata only, and read-only.** Returns the path and a modification time so the
/// Daten view can say a second store exists. Nothing here opens, merges, moves or
/// deletes it: what to do about a second copy of a learner's progress is the owner's
/// decision, and making it silently is how a day of work disappears.
///
/// macOS only — the container layout this detects is WebKit's. Every other target
/// answers `None`, which the frontend renders as "no second store".
#[tauri::command]
fn legacy_webkit_container() -> Option<serde_json::Value> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")?;
        let path = std::path::Path::new(&home)
            .join("Library")
            .join("WebKit")
            .join("deutsch-atlas");
        if !path.is_dir() {
            return None;
        }
        let modified_at = std::fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        return Some(serde_json::json!({
            "path": path.to_string_lossy(),
            "modifiedAt": modified_at,
        }));
    }
    #[cfg(not(target_os = "macos"))]
    None
}

fn main() {
    tauri::Builder::default()
        // First in the chain, as the plugin requires: a second launch must be turned
        // away before it can open the webview and put a second process on the same
        // WebKit container. The existing window is raised instead.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![flush_complete, legacy_webkit_container])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !FLUSHED.load(Ordering::SeqCst) {
                    api.prevent_close();
                    begin_flush(window, window.app_handle().clone());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Deutsch-Atlas")
        .run(|app, event| {
            // Cmd+Q goes through ExitRequested without a per-window close. `code`
            // is Some for our own `app.exit(0)` above — only a user-initiated
            // exit (None) is intercepted, so the flush can never loop.
            if let RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() && !FLUSHED.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    begin_flush(app, app.clone());
                }
            }
        });
}
