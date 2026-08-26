// Thin desktop shell: the whole app is the static Astro site in ../dist.
// Plugins exist only for the progress autosync (write snapshots to a
// user-chosen folder — see src/lib/autosync.ts and src/lib/syncdir.ts) and the
// Schreib-Assistent's Ollama transport (http, capability-scoped to exactly
// http://localhost:11434/* — see src/lib/assist.ts and docs/assist-design.md).
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![flush_complete])
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
