//! Tonwerk's desktop shell: it starts the checkout's engine, signs the studio in, and stops the
//! engine on quit.
//!
//! Nothing here renders, stores or decides anything. The engine serves the studio; this process
//! owns only its lifecycle, which is the part a person should never have to do by hand:
//!
//! 1. find the checkout (the one this binary was built in, unless another was chosen);
//! 2. run its engine with `serve --port 0 --handshake` and read the one JSON line it prints;
//! 3. open the studio at the engine's address with the token already on the page, set by an
//!    initialisation script before any of the page's own scripts run — never in the address bar;
//! 4. on quit, close the engine's stdin, which stops it, and kill it only if it does not stop.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::{
    collections::VecDeque,
    fs::{self, File},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

/// The engine's entry point inside a checkout. Run directly rather than through `uv run`, which
/// would sync the environment first and remove the speech runtime `install-qwen.sh` added.
const ENGINE: &str = "apps/tonwerk/engine/.venv/bin/atlas-listening";
const INSTALL: &str =
    "cd apps/tonwerk/engine && uv sync --extra test --extra mlx && ./install-qwen.sh";
/// Startup imports the render stack and migrates the store; a cold first start is seconds.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(90);
const STOP_GRACE: Duration = Duration::from_secs(5);
const LOG_TAIL: usize = 200;

struct Engine {
    child: Child,
    /// Held and never written. Dropping it is how the engine is told to stop.
    stdin: Option<ChildStdin>,
}

#[derive(Default)]
struct Supervisor(Mutex<Option<Engine>>);

/// Everything the engine says outside the handshake: to a file for later, and the last lines in
/// memory for the start page when it fails.
struct Log {
    file: Option<File>,
    tail: VecDeque<String>,
}

impl Log {
    fn push(&mut self, line: String) {
        if let Some(file) = self.file.as_mut() {
            let _ = writeln!(file, "{line}");
        }
        if self.tail.len() == LOG_TAIL {
            self.tail.pop_front();
        }
        self.tail.push_back(line);
    }

    fn text(&self) -> String {
        self.tail.iter().cloned().collect::<Vec<_>>().join("\n")
    }
}

fn is_checkout(path: &Path) -> bool {
    path.join(ENGINE).is_file()
}

fn checkout_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join("checkout.txt"))
}

/// The checkout to run, in order: `TONWERK_CHECKOUT`, the one chosen last time, the one this
/// binary was compiled in, and finally a folder picker whose answer is remembered.
fn resolve_checkout(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("TONWERK_CHECKOUT") {
        let path = PathBuf::from(path);
        return if is_checkout(&path) {
            Ok(path)
        } else {
            Err(format!(
                "TONWERK_CHECKOUT={} hat kein {ENGINE}.",
                path.display()
            ))
        };
    }
    if let Some(path) = checkout_file(app)
        .and_then(|file| fs::read_to_string(file).ok())
        .map(|text| PathBuf::from(text.trim()))
        .filter(|path| is_checkout(path))
    {
        return Ok(path);
    }
    if let Some(path) = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .ok()
        .filter(|path| is_checkout(path))
    {
        return Ok(path);
    }
    let picked = app
        .dialog()
        .file()
        .set_title("Deutsch-Atlas-Checkout wählen")
        .blocking_pick_folder()
        .and_then(|folder| folder.into_path().ok())
        .ok_or_else(|| "Kein Checkout gewählt.".to_string())?;
    if !is_checkout(&picked) {
        return Err(format!(
            "{} hat kein {ENGINE}. Im Checkout einmal ausführen:\n  {INSTALL}",
            picked.display()
        ));
    }
    if let Some(file) = checkout_file(app) {
        if let Some(directory) = file.parent() {
            let _ = fs::create_dir_all(directory);
        }
        let _ = fs::write(file, picked.to_string_lossy().as_bytes());
    }
    Ok(picked)
}

/// A Finder-launched app gets a bare PATH. ffmpeg is usually in Homebrew's prefix, and the
/// engine's own venv goes first so its tools win.
fn engine_path(checkout: &Path) -> String {
    let venv = checkout.join("apps/tonwerk/engine/.venv/bin");
    let mut parts = vec![
        venv.to_string_lossy().into_owned(),
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
    ];
    if let Ok(path) = std::env::var("PATH") {
        parts.push(path);
    }
    parts.join(":")
}

fn spawn(checkout: &Path, log: Arc<Mutex<Log>>) -> Result<(Engine, mpsc::Receiver<Value>), String> {
    let mut child = Command::new(checkout.join(ENGINE))
        .args(["serve", "--repo"])
        .arg(checkout)
        .args(["--port", "0", "--handshake"])
        .current_dir(checkout.join("apps/tonwerk/engine"))
        .env("PATH", engine_path(checkout))
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("{} startet nicht: {error}", checkout.join(ENGINE).display()))?;

    let (send, receive) = mpsc::channel();
    let stdout = child.stdout.take().expect("piped stdout");
    let stdout_log = Arc::clone(&log);
    thread::spawn(move || {
        let mut waiting = true;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if waiting {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if value.get("tonwerk").is_some() {
                        waiting = false;
                        let _ = send.send(value);
                        continue;
                    }
                }
            }
            stdout_log.lock().unwrap().push(line);
        }
    });
    let stderr = child.stderr.take().expect("piped stderr");
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            log.lock().unwrap().push(line);
        }
    });
    let stdin = child.stdin.take();
    Ok((Engine { child, stdin }, receive))
}

fn js(value: &str) -> String {
    serde_json::to_string(value).expect("a string serialises")
}

/// The start page's failure state. Retried until the page has defined `zeigeFehler`, because a
/// fast failure can arrive before the page has finished loading.
fn fail(app: &AppHandle, title: &str, text: &str, log: &str) {
    if let Some(window) = app.get_webview_window("start") {
        let script = format!(
            "(function z(){{ if (window.zeigeFehler) window.zeigeFehler({}, {}, {}); else setTimeout(z, 50); }})()",
            js(title),
            js(text),
            js(log)
        );
        let _ = window.eval(&script);
    }
}

fn open_studio(app: &AppHandle, handshake: &Value) -> Result<(), String> {
    let url: Url = handshake
        .get("url")
        .and_then(Value::as_str)
        .and_then(|url| url.parse().ok())
        .ok_or("Der Handshake der Engine nennt keine Adresse.")?;
    let token = handshake
        .get("token")
        .and_then(Value::as_str)
        .ok_or("Der Handshake der Engine nennt keinen Token.")?;
    let origin = url.origin();
    // Guarded by origin: the script runs on every page this webview loads, and the token is for
    // the engine's own pages only.
    let script = format!(
        "if (window.location.origin === {}) {{ window.__TONWERK_SESSION__ = Object.freeze({{ token: {} }}); }}",
        js(&origin.ascii_serialization()),
        js(token)
    );
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let built = WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url))
            .title("Tonwerk · Audioregie")
            .inner_size(1440.0, 920.0)
            .min_inner_size(900.0, 640.0)
            .initialization_script(&script)
            .on_navigation(move |target| {
                if target.origin() == origin {
                    return true;
                }
                // A link out of the studio opens in the browser, never in the window that
                // holds the token.
                let _ = Command::new("open").arg(target.as_str()).spawn();
                false
            })
            .build();
        match built {
            Ok(_) => {
                if let Some(start) = handle.get_webview_window("start") {
                    let _ = start.close();
                }
            }
            Err(error) => fail(&handle, "Fenster", &error.to_string(), ""),
        }
    })
    .map_err(|error| error.to_string())
}

/// Find the checkout, start its engine, and open the studio, reporting any failure on the start
/// page. Runs off the main thread: the folder picker and the handshake both block.
fn launch(app: AppHandle) {
    let checkout = match resolve_checkout(&app) {
        Ok(checkout) => checkout,
        Err(error) => return fail(&app, "Kein Checkout", &error, ""),
    };
    let file = app.path().app_log_dir().ok().and_then(|directory| {
        fs::create_dir_all(&directory).ok()?;
        File::create(directory.join("engine.log")).ok()
    });
    let log = Arc::new(Mutex::new(Log {
        file,
        tail: VecDeque::new(),
    }));
    let (engine, handshake) = match spawn(&checkout, Arc::clone(&log)) {
        Ok(started) => started,
        Err(error) => {
            return fail(
                &app,
                "Engine startet nicht",
                &format!("{error}\n\nIm Checkout: {INSTALL}"),
                "",
            )
        }
    };
    let supervisor = app.state::<Supervisor>();
    *supervisor.0.lock().unwrap() = Some(engine);

    let deadline = Instant::now() + HANDSHAKE_TIMEOUT;
    let reply = loop {
        match handshake.recv_timeout(Duration::from_millis(200)) {
            Ok(value) => break Ok(value),
            Err(mpsc::RecvTimeoutError::Timeout) if Instant::now() < deadline => {
                if let Some(engine) = supervisor.0.lock().unwrap().as_mut() {
                    if let Ok(Some(status)) = engine.child.try_wait() {
                        break Err(format!("Die Engine hat sich beendet ({status})."));
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                break Err(format!(
                    "Kein Handshake nach {} s.",
                    HANDSHAKE_TIMEOUT.as_secs()
                ))
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                // stdout closed without a handshake; give stderr a moment to arrive in the log.
                thread::sleep(Duration::from_millis(300));
                break Err("Die Engine hat sich vor dem Handshake beendet.".to_string());
            }
        }
    };
    let result = reply.and_then(|value| open_studio(&app, &value));
    if let Err(error) = result {
        stop(&app);
        let text = log.lock().unwrap().text();
        fail(&app, "Engine startet nicht", &error, &text);
    }
}

/// Close stdin, which stops the engine; kill it only if it is still running after the grace period.
fn stop(app: &AppHandle) {
    let supervisor = app.state::<Supervisor>();
    let taken = supervisor.0.lock().unwrap().take();
    let Some(mut engine) = taken else {
        return;
    };
    drop(engine.stdin.take());
    let deadline = Instant::now() + STOP_GRACE;
    while Instant::now() < deadline {
        if let Ok(Some(_)) = engine.child.try_wait() {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
    let _ = engine.child.kill();
    let _ = engine.child.wait();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Supervisor::default())
        .setup(|app| {
            WebviewWindowBuilder::new(app, "start", WebviewUrl::App("index.html".into()))
                .title("Tonwerk")
                .inner_size(720.0, 480.0)
                .build()?;
            let handle = app.handle().clone();
            thread::spawn(move || launch(handle));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tonwerk")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop(app);
            }
        });
}
