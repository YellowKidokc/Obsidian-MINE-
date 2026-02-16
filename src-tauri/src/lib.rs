use tauri::State;
use sqlx::{PgPool, postgres::PgPoolOptions};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::PathBuf;
use std::fs;

// ─── Types ───────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

// ─── App State ───────────────────────────────────────────────────

struct AppState {
    db: Arc<Mutex<Option<PgPool>>>,
    vault_path: Arc<Mutex<Option<String>>>,
}

// ─── Vault Commands ──────────────────────────────────────────────

#[tauri::command]
async fn set_vault(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Not a valid directory: {}", path));
    }
    let mut vault = state.vault_path.lock().await;
    *vault = Some(path.clone());
    Ok(format!("Vault set: {}", path))
}

#[tauri::command]
async fn get_vault_files(state: State<'_, AppState>) -> Result<Vec<FileEntry>, String> {
    let vault = state.vault_path.lock().await;
    let vault_path = vault.as_ref().ok_or("No vault selected")?;
    scan_directory(&PathBuf::from(vault_path), 0, 5).map_err(|e| e.to_string())
}

fn scan_directory(path: &PathBuf, depth: usize, max_depth: usize) -> Result<Vec<FileEntry>, std::io::Error> {
    if depth >= max_depth {
        return Ok(vec![]);
    }
    let mut entries = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        
        if name.starts_with('.')
            || name == "node_modules"
            || name == "target"
            || name == "__pycache__"
            || name == ".obsidian"
        {
            continue;
        }
        
        let file_path = entry.path();
        let is_dir = file_path.is_dir();
        
        if is_dir {
            let children = scan_directory(&file_path, depth + 1, max_depth)?;
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: file_path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if name.ends_with(".md") {
            entries.push(FileEntry {
                name,
                path: file_path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    
    Ok(entries)
}

// ─── File Commands ───────────────────────────────────────────────

#[tauri::command]
async fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
async fn write_note(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
async fn create_note(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().await;
    let vault_path = vault.as_ref().ok_or("No vault selected")?;
    let full_path = PathBuf::from(vault_path).join(&path);
    
    if full_path.exists() {
        return Err("File already exists".to_string());
    }
    
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let stem = path.trim_end_matches(".md");
    let initial = format!("# {}\n\n", stem);
    fs::write(&full_path, &initial).map_err(|e| e.to_string())?;
    
    Ok(full_path.to_string_lossy().to_string())
}

// ─── Database Commands ───────────────────────────────────────────

#[tauri::command]
async fn connect_db(state: State<'_, AppState>) -> Result<String, String> {
    let mut db_lock = state.db.lock().await;
    
    if db_lock.is_some() {
        return Ok("Connected".to_string());
    }

    let database_url = "postgres://postgres:Moss9pep2828@192.168.1.177:2665/theophysics";
    
    match PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
    {
        Ok(pool) => {
            *db_lock = Some(pool);
            Ok("Connected".to_string())
        }
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

// ─── App Entry ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Arc::new(Mutex::new(None)),
            vault_path: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            connect_db,
            set_vault,
            get_vault_files,
            read_note,
            write_note,
            create_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
