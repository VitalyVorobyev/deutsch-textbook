// Thin desktop shell: the whole app is the static Astro site in ../dist.
// Plugins exist only for the progress autosync (write snapshots to a
// user-chosen folder — see src/lib/autosync.ts and src/lib/syncdir.ts) and the
// Schreib-Assistent's Ollama transport (http, capability-scoped to exactly
// http://localhost:11434/* — see src/lib/assist.ts and docs/assist-design.md).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running Deutsch-Atlas");
}
