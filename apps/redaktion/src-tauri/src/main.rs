#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tauri::{Manager, State};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};
use tokio::sync::{oneshot, Mutex};

type Reply = Result<Value, String>;

struct Bridge {
    child: Mutex<CommandChild>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Reply>>>>,
    next: AtomicU64,
}

#[tauri::command]
async fn rpc_request(
    app: tauri::AppHandle,
    bridge: State<'_, Bridge>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let id = bridge.next.fetch_add(1, Ordering::Relaxed);
    let (send, receive) = oneshot::channel();
    bridge.pending.lock().await.insert(id, send);
    let request = json!({ "version": 1, "id": id, "method": method, "params": params });
    bridge.child.lock().await.write(format!("{}\n", request).as_bytes())
        .map_err(|error| error.to_string())?;
    let result = receive.await.map_err(|_| "Redaktion sidecar stopped".to_string())??;
    if method == "openWorkspace" {
        if let Some(root) = result.get("root").and_then(Value::as_str) {
            let directory = app.path().app_config_dir().map_err(|error| error.to_string())?;
            fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
            fs::write(directory.join("workspace.txt"), root).map_err(|error| error.to_string())?;
        }
    }
    Ok(result)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let config = app.path().app_config_dir()?.join("workspace.txt");
            let mut command = app.shell().sidecar("redaktion-sidecar")?;
            if let Ok(path) = fs::read_to_string(config) {
                let trimmed = path.trim();
                if !trimmed.is_empty() { command = command.args(["--workspace", trimmed]); }
            }
            let (mut events, child) = command.spawn()?;
            let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Reply>>>> = Arc::new(Mutex::new(HashMap::new()));
            let reader_pending = Arc::clone(&pending);
            tauri::async_runtime::spawn(async move {
                let mut stdout_buffer = String::new();
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(bytes) => {
                            stdout_buffer.push_str(&String::from_utf8_lossy(&bytes));
                            while let Some(newline) = stdout_buffer.find('\n') {
                                let line = stdout_buffer[..newline].to_string();
                                stdout_buffer.drain(..=newline);
                                let Ok(value) = serde_json::from_str::<Value>(&line) else { continue };
                                let Some(id) = value.get("id").and_then(Value::as_u64) else { continue };
                                if let Some(sender) = reader_pending.lock().await.remove(&id) {
                                    let reply = value.get("error").and_then(Value::as_str)
                                        .map(|message| Err(message.to_string()))
                                        .unwrap_or_else(|| Ok(value.get("result").cloned().unwrap_or(Value::Null)));
                                    let _ = sender.send(reply);
                                }
                            }
                        }
                        CommandEvent::Stderr(bytes) => eprintln!("{}", String::from_utf8_lossy(&bytes)),
                        CommandEvent::Terminated(_) => {
                            for (_, sender) in reader_pending.lock().await.drain() {
                                let _ = sender.send(Err("Redaktion sidecar terminated".into()));
                            }
                            break;
                        }
                        _ => {}
                    }
                }
            });
            app.manage(Bridge { child: Mutex::new(child), pending, next: AtomicU64::new(1) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![rpc_request])
        .run(tauri::generate_context!())
        .expect("error while running Redaction");
}
