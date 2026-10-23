use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Request, State};
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use base64::Engine;
use image::Luma;
use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tower::ServiceExt;
use tower_http::cors::CorsLayer;
use tower_http::services::fs::{ServeDir, ServeFile};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct FileRecord {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub path: String,
    pub encoding: String,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AddressInfo {
    pub interface: String,
    pub address: String,
    pub url: String,
}

pub struct AppState {
    pub port: u16,
    pub upload_path: String,
    pub db_path: String,
    pub primary_url: String,
    pub addresses: Vec<AddressInfo>,
    pub qr_data_url: String,
    pub db: Mutex<HashMap<String, FileRecord>>,
}

fn get_available_interfaces(port: u16) -> Vec<AddressInfo> {
    let mut list = Vec::new();
    if let Ok(ifaces) = get_if_addrs::get_if_addrs() {
        for iface in ifaces {
            if !iface.is_loopback() {
                if let std::net::IpAddr::V4(ipv4) = iface.addr.ip() {
                    list.push(AddressInfo {
                        interface: iface.name,
                        address: ipv4.to_string(),
                        url: format!("http://{}:{}", ipv4, port),
                    });
                }
            }
        }
    }
    list
}

fn generate_qr_data_url(text: &str) -> String {
    match QrCode::new(text.as_bytes()) {
        Ok(code) => {
            let img = code.render::<Luma<u8>>().build();
            let mut bytes = Vec::new();
            if img
                .write_to(
                    &mut std::io::Cursor::new(&mut bytes),
                    image::ImageFormat::Png,
                )
                .is_ok()
            {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                return format!("data:image/png;base64,{}", b64);
            }
        }
        Err(e) => {
            eprintln!("QR generation error: {}", e);
        }
    }
    String::new()
}

async fn load_db(path: &str) -> HashMap<String, FileRecord> {
    if let Ok(content) = tokio::fs::read_to_string(path).await {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

async fn save_db(path: &str, data: &HashMap<String, FileRecord>) {
    if let Ok(json_str) = serde_json::to_string(data) {
        let _ = tokio::fs::write(path, json_str).await;
    }
}

// GET /
async fn index_handler() -> impl IntoResponse {
    let path = Path::new("public/video_upload_test.html");
    if let Ok(content) = tokio::fs::read_to_string(path).await {
        Html(content).into_response()
    } else {
        (StatusCode::NOT_FOUND, "video_upload_test.html not found").into_response()
    }
}

#[derive(Serialize)]
struct UploadResponse {
    success: bool,
    link: Vec<String>,
}

// POST /
async fn upload_handler(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut links = Vec::new();
    let mut details = String::new();

    let mut temp_records: Vec<(String, String, u64, String, String)> = Vec::new();

    while let Ok(Some(mut field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "details" {
            if let Ok(text) = field.text().await {
                details = text;
            }
            continue;
        }

        if name == "user-file" {
            let original_name = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "file".to_string());

            let timestamp = chrono::Utc::now().timestamp_millis();
            let sanitized = original_name.replace(' ', "_");
            let mut stored_name = format!("{}-{}", timestamp, sanitized);
            let mut file_path = PathBuf::from(&state.upload_path).join(&stored_name);

            // Ghi file streaming xuống đĩa
            let mut file = match tokio::fs::File::create(&file_path).await {
                Ok(f) => f,
                Err(e) => {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": format!("Cannot create file: {}", e) })),
                    ));
                }
            };

            while let Ok(Some(chunk)) = field.chunk().await {
                if let Err(e) = file.write_all(&chunk).await {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": format!("Write error: {}", e) })),
                    ));
                }
            }
            let _ = file.flush().await;

            let mut actual_size = tokio::fs::metadata(&file_path)
                .await
                .map(|m| m.len())
                .unwrap_or(0);

            let mut final_name = original_name.clone();

            // Chuyển đổi HEIC nếu là ảnh iPhone
            let is_heic = original_name.to_lowercase().ends_with(".heic");
            if is_heic {
                let script_path = std::env::current_dir()
                    .unwrap_or_default()
                    .join("convert_heic.py");
                if script_path.exists() {
                    let py_cmd = if tokio::process::Command::new("python3")
                        .arg("--version")
                        .output()
                        .await
                        .is_ok()
                    {
                        "python3"
                    } else {
                        "python"
                    };

                    let status = tokio::process::Command::new(py_cmd)
                        .args([
                            script_path.to_str().unwrap_or("convert_heic.py"),
                            "--delete",
                            "--file",
                            &stored_name,
                        ])
                        .current_dir(&state.upload_path)
                        .status()
                        .await;

                    if let Ok(st) = status {
                        if st.success() {
                            let jpg_name = stored_name
                                .replace(".heic", ".jpg")
                                .replace(".HEIC", ".jpg");
                            let jpg_path = PathBuf::from(&state.upload_path).join(&jpg_name);
                            if jpg_path.exists() {
                                stored_name = jpg_name;
                                file_path = jpg_path;
                                final_name = final_name
                                    .replace(".heic", ".jpg")
                                    .replace(".HEIC", ".jpg");
                                if let Ok(meta) = tokio::fs::metadata(&file_path).await {
                                    actual_size = meta.len();
                                }
                            }
                        }
                    }
                }
            }

            let file_id = timestamp.to_string();
            let link = format!("{}/video/{}", state.primary_url, file_id);
            links.push(link);

            let relative_path = format!("{}/{}", state.upload_path.trim_end_matches('/'), stored_name);
            temp_records.push((file_id, final_name, actual_size, relative_path, "7bit".to_string()));
        }
    }

    // Lưu vào database
    {
        let mut db = state.db.lock().await;
        for (id, name, size, path, encoding) in temp_records {
            db.insert(
                id.clone(),
                FileRecord {
                    id,
                    name,
                    size,
                    path,
                    encoding,
                    details: details.clone(),
                },
            );
        }
        save_db(&state.db_path, &db).await;
    }

    Ok(Json(UploadResponse {
        success: true,
        link: links,
    }))
}

// GET /api/interface-address
async fn interface_address_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({
        "interfaceAddress": state.primary_url,
        "QR": state.qr_data_url,
        "addresses": state.addresses,
    }))
}

// GET /api/server-addresses
async fn server_addresses_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({
        "port": state.port.to_string(),
        "addresses": state.addresses,
    }))
}

#[derive(Serialize)]
struct FileStat {
    name: String,
    size: u64,
    created: String,
    modified: String,
    #[serde(rename = "isFile")]
    is_file: bool,
}

// GET /get-uploads
async fn get_uploads_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut files_list = Vec::new();
    let mut dir = match tokio::fs::read_dir(&state.upload_path).await {
        Ok(d) => d,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Error reading upload directory").into_response(),
    };

    while let Ok(Some(entry)) = dir.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if let Ok(meta) = entry.metadata().await {
            let created = meta
                .created()
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                .unwrap_or_default();
            let modified = meta
                .modified()
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                .unwrap_or_default();

            files_list.push(FileStat {
                name,
                size: meta.len(),
                created,
                modified,
                is_file: meta.is_file(),
            });
        }
    }

    Json(files_list).into_response()
}

#[derive(Serialize, Clone)]
struct PortItem {
    protocol: String,
    #[serde(rename = "localAddress")]
    local_address: String,
    port: String,
    state: String,
    pid: String,
    process: String,
}

// GET /api/listening-ports
async fn listening_ports_handler() -> impl IntoResponse {
    let is_win = cfg!(target_os = "windows");
    let cmd = if is_win {
        tokio::process::Command::new("netstat")
            .args(["-ano", "-p", "tcp"])
            .output()
            .await
    } else {
        tokio::process::Command::new("ss")
            .args(["-tulpn"])
            .output()
            .await
    };

    let mut ports: Vec<PortItem> = Vec::new();

    if let Ok(output) = cmd {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            if is_win {
                if trimmed.starts_with("TCP") && trimmed.contains("LISTENING") {
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 5 {
                        let local_addr = parts[1];
                        let port = local_addr.split(':').last().unwrap_or("").to_string();
                        let pid = parts[4].to_string();
                        ports.push(PortItem {
                            protocol: "TCP".to_string(),
                            local_address: local_addr.to_string(),
                            port,
                            state: "LISTENING".to_string(),
                            pid,
                            process: String::new(),
                        });
                    }
                }
            } else if trimmed.starts_with("tcp") || trimmed.starts_with("udp") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 5 {
                    let proto = parts[0].to_uppercase();
                    let state = parts[1].to_string();
                    let local_addr = parts[4].to_string();
                    let port = local_addr.split(':').last().unwrap_or("").to_string();
                    let proc_info = parts.get(6..).map(|s| s.join(" ")).unwrap_or_default();

                    let mut proc_name = String::new();
                    let mut pid = String::new();
                    if let Some(pos) = proc_info.find("pid=") {
                        let sub = &proc_info[pos + 4..];
                        if let Some(end) = sub.find(|c: char| !c.is_ascii_digit()) {
                            pid = sub[..end].to_string();
                        } else {
                            pid = sub.to_string();
                        }
                    }
                    if let Some(start) = proc_info.find("((\"") {
                        if let Some(end) = proc_info[start + 3..].find('"') {
                            proc_name = proc_info[start + 3..start + 3 + end].to_string();
                        }
                    }

                    ports.push(PortItem {
                        protocol: proto,
                        local_address: local_addr,
                        port,
                        state,
                        pid,
                        process: if proc_name.is_empty() { proc_info } else { proc_name },
                    });
                }
            }
        }
    }

    ports.sort_by(|a, b| {
        a.port
            .parse::<u32>()
            .unwrap_or(0)
            .cmp(&b.port.parse::<u32>().unwrap_or(0))
    });

    Json(serde_json::json!({
        "success": true,
        "count": ports.len(),
        "data": ports,
    }))
}

// GET /video/:id
async fn render_video_handler(
    AxumPath(id): AxumPath<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let db = state.db.lock().await;
    let file_details = match db.get(&id) {
        Some(f) => f,
        None => return (StatusCode::NOT_FOUND, "INVALID FILE ID").into_response(),
    };

    let stored_file_name = file_details
        .path
        .split(['/', '\\'])
        .last()
        .unwrap_or(&file_details.name);

    let video_details = if file_details.details.is_empty() {
        "NA"
    } else {
        &file_details.details
    };
    let video_name = &file_details.name;

    let html = format!(
        r#"<html>
    <title>Sample Video Stream</title>
    <body>
        <video width="320" height="240" controls>
            <source src="/video/{stored_file_name}/play" type="video/mp4"/>
            Your browser does not support the <code>video</code> element.
        </video>
        <br>
        <div>
          <strong>Video Details: </strong>
          {video_details}
        </div>
        <div>
          <strong>Video Name: </strong>
          {video_name}
        </div>
    </body>
  </html>"#
    );

    Html(html).into_response()
}

// GET /video/:file_name/play (hỗ trợ Range Header HTTP 206 để tua/phát mượt)
async fn play_video_handler(
    AxumPath(file_name): AxumPath<String>,
    State(state): State<Arc<AppState>>,
    req: Request,
) -> Response {
    let file_path = PathBuf::from(&state.upload_path).join(&file_name);
    if !file_path.exists() {
        return (StatusCode::NOT_FOUND, "No such file found").into_response();
    }
    match ServeFile::new(&file_path).oneshot(req).await {
        Ok(res) => res.into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Streaming error: {}", err),
        )
            .into_response(),
    }
}

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(2024);

    let upload_path = std::env::var("FILE_UPLOAD_PATH").unwrap_or_else(|_| "uploads/".to_string());
    let db_path = "db/uploaded-files.js".to_string();

    // Tạo thư mục uploads và db nếu chưa có
    let _ = tokio::fs::create_dir_all(&upload_path).await;
    let _ = tokio::fs::create_dir_all("db").await;

    let addresses = get_available_interfaces(port);
    let primary_url = if let Some(first) = addresses.first() {
        first.url.clone()
    } else {
        format!("http://localhost:{}", port)
    };

    println!("==================================================");
    println!("🦀 UPLOAD FILES SERVER (RUST AXUM VERSION)");
    println!("==================================================");
    for item in &addresses {
        println!("{}", item.url);
    }
    println!("Server is listening at port {}", port);
    println!("==================================================");

    let qr_data_url = generate_qr_data_url(&primary_url);
    let db_data = load_db(&db_path).await;

    let state = Arc::new(AppState {
        port,
        upload_path: upload_path.clone(),
        db_path,
        primary_url,
        addresses,
        qr_data_url,
        db: Mutex::new(db_data),
    });

    let app = Router::new()
        .route("/", get(index_handler))
        .route("/", post(upload_handler))
        .route("/get-uploads", get(get_uploads_handler))
        .route("/api/interface-address", get(interface_address_handler))
        .route("/api/server-addresses", get(server_addresses_handler))
        .route("/api/listening-ports", get(listening_ports_handler))
        .route("/video/{id}", get(render_video_handler))
        .route("/video/{file_name}/play", get(play_video_handler))
        .nest_service("/uploads", ServeDir::new(&upload_path))
        .fallback_service(
            ServeDir::new("public")
                .not_found_service(ServeFile::new("public/404.html")),
        )
        // Cho phép upload file lên đến 10GB
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
    }
}
