use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::process::{Command, Child};
use std::os::windows::process::CommandExt;
use zhconv::{zhconv, Variant};
use arboard::Clipboard;
use enigo::{Enigo, Key, KeyboardControllable};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Emitter,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use std::process::Stdio;
use once_cell::sync::Lazy;
use rodio::{OutputStream, Sink};
use rodio::source::{SineWave, Source};

static LOGS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

fn add_log(app_handle: &tauri::AppHandle, log: String) {
    println!("{}", log);
    if let Ok(mut logs) = LOGS.lock() {
        logs.push(log.clone());
        if logs.len() > 1000 {
            logs.remove(0);
        }
    }
    let _ = app_handle.emit("whisper-log", log);
}

fn play_audio_cue(cue_type: &'static str, sound_mode: &str) {
    let mode = sound_mode.to_string();
    std::thread::spawn(move || {
        if mode == "off" {
            return;
        }
        
        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(res) => res,
            Err(_) => return,
        };
        let sink = match Sink::try_new(&stream_handle) {
            Ok(s) => s,
            Err(_) => return,
        };
        
        if mode == "modern" {
            let bytes = match cue_type {
                "start" => include_bytes!("../sounds/sound_start.wav").as_slice(),
                "stop" => include_bytes!("../sounds/sound_stop.wav").as_slice(),
                "success" => include_bytes!("../sounds/sound_success.wav").as_slice(),
                "error" => include_bytes!("../sounds/sound_error.wav").as_slice(),
                _ => return,
            };
            let cursor = std::io::Cursor::new(bytes);
            if let Ok(source) = rodio::Decoder::new(cursor) {
                sink.append(source);
                sink.sleep_until_end();
            }
        } else if mode == "retro" {
            match cue_type {
                "start" => {
                    let source = SineWave::new(800.0)
                        .take_duration(std::time::Duration::from_millis(80))
                        .amplify(0.12);
                    sink.append(source);
                    sink.sleep_until_end();
                }
                "stop" => {
                    let source = SineWave::new(600.0)
                        .take_duration(std::time::Duration::from_millis(80))
                        .amplify(0.08); // Quiet stopping beep
                    sink.append(source);
                    sink.sleep_until_end();
                }
                "success" => {
                    let source1 = SineWave::new(523.25)
                        .take_duration(std::time::Duration::from_millis(100))
                        .amplify(0.10);
                    let source2 = SineWave::new(659.25)
                        .take_duration(std::time::Duration::from_millis(180))
                        .amplify(0.10);
                    sink.append(source1);
                    sink.append(source2);
                    sink.sleep_until_end();
                }
                "error" => {
                    let source = SineWave::new(180.0)
                        .take_duration(std::time::Duration::from_millis(300))
                        .amplify(0.15);
                    sink.append(source);
                    sink.sleep_until_end();
                }
                _ => {}
            }
        }
    });
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub model: String,
    pub language: String,
    pub paste_mode: String,
    pub device: String,
    pub compute_type: String,
    pub hotkey_mode: String,
    pub hotkey: String,
    pub chinese_output: String,
    pub cantonese_mode: bool,
    pub cpu_threads: usize,
    pub start_at_login: bool,
    pub app_language: String,
    pub sound_mode: String,
    pub storage_path: String,
    pub custom_prompt: String,
    pub text_replacements: String,
    pub show_settings_on_startup: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            model: "large-v3".to_string(),
            language: "auto".to_string(),
            paste_mode: "clipboard".to_string(),
            device: "cpu".to_string(),
            compute_type: "auto".to_string(),
            hotkey_mode: "hold".to_string(),
            hotkey: "ctrl+f9".to_string(),
            chinese_output: "traditional_tw".to_string(),
            cantonese_mode: false,
            cpu_threads: 0,
            start_at_login: false,
            app_language: "zh".to_string(),
            sound_mode: "modern".to_string(),
            storage_path: "".to_string(),
            custom_prompt: "".to_string(),
            text_replacements: "".to_string(),
            show_settings_on_startup: true,
        }
    }
}

fn get_exe_dir() -> PathBuf {
    let mut exe_path = std::env::current_exe().unwrap_or_default();
    exe_path.pop();
    exe_path
}

fn get_config_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let appdata_root = PathBuf::from(appdata);
        let app_dir = appdata_root.join("voiceinput");
        let config_path = app_dir.join("config.json");
        let _ = std::fs::create_dir_all(&app_dir);

        // v1.0.0 stored user data under the reverse-domain identifier. When
        // upgrading, preserve that existing engine/model location so users do
        // not need to download the large model again.
        if !config_path.exists() {
            let legacy_dir = appdata_root.join("com.travis.voiceinput");
            let legacy_config_path = legacy_dir.join("config.json");
            if let Ok(content) = std::fs::read_to_string(&legacy_config_path) {
                if let Ok(mut config) = serde_json::from_str::<Config>(&content) {
                    if config.storage_path.trim().is_empty() {
                        config.storage_path = legacy_dir.to_string_lossy().to_string();
                    }
                    if let Ok(migrated) = serde_json::to_string_pretty(&config) {
                        let _ = std::fs::write(&config_path, migrated);
                    }
                }
            }
        }

        config_path
    } else {
        get_exe_dir().join("config.json")
    }
}

fn set_startup_enabled(enabled: bool) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    let exe_path_str = current_exe.to_string_lossy();
    
    if enabled {
        let value = format!("\"{}\"", exe_path_str);
        let output = Command::new("reg")
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .arg("add")
            .arg("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .arg("/v")
            .arg("VoiceInput")
            .arg("/t")
            .arg("REG_SZ")
            .arg("/d")
            .arg(&value)
            .arg("/f")
            .output();
        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => Err(String::from_utf8_lossy(&out.stderr).to_string()),
            Err(e) => Err(e.to_string()),
        }
    } else {
        let output = Command::new("reg")
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .arg("delete")
            .arg("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .arg("/v")
            .arg("VoiceInput")
            .arg("/f")
            .output();
        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(_) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

fn load_config() -> Config {
    let config_path = get_config_path();
    if config_path.exists() {
        if let Ok(mut file) = File::open(&config_path) {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_ok() {
                if let Ok(config) = serde_json::from_str(&content) {
                    return config;
                }
            }
        }
    }
    let config = Config::default();
    if let Ok(content) = serde_json::to_string_pretty(&config) {
        if let Ok(mut file) = File::create(&config_path) {
            let _ = file.write_all(content.as_bytes());
        }
    }
    config
}

fn normalize_hotkey(hotkey: &str) -> String {
    hotkey
        .split('+')
        .map(|part| {
            let trimmed = part.trim().to_lowercase();
            match trimmed.as_str() {
                "ctrl" => "Ctrl".to_string(),
                "shift" => "Shift".to_string(),
                "alt" => "Alt".to_string(),
                "super" | "win" | "cmd" | "command" => "Super".to_string(),
                other => {
                    if other.len() == 1 {
                        other.to_uppercase()
                    } else if other.starts_with('f') {
                        format!("F{}", &other[1..])
                    } else {
                        let mut c = other.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                        }
                    }
                }
            }
        })
        .collect::<Vec<String>>()
        .join("+")
}

use std::sync::mpsc;
use std::thread;

pub enum RecorderCommand {
    Start,
    Stop,
}

pub struct AudioRecorder {
    tx: Mutex<mpsc::Sender<RecorderCommand>>,
    samples: Arc<Mutex<Vec<f32>>>,
    meta: Arc<Mutex<(u32, u16)>>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let samples = Arc::new(Mutex::new(Vec::new()));
        let meta = Arc::new(Mutex::new((44100, 1)));
        
        let samples_clone = samples.clone();
        let meta_clone = meta.clone();
        
        thread::spawn(move || {
            let mut stream: Option<cpal::Stream> = None;
            for cmd in rx {
                match cmd {
                    RecorderCommand::Start => {
                        if let Ok(mut s) = samples_clone.lock() {
                            s.clear();
                        }
                        let host = cpal::default_host();
                        if let Some(device) = host.default_input_device() {
                            if let Ok(config) = device.default_input_config() {
                                if let Ok(mut m) = meta_clone.lock() {
                                    *m = (config.sample_rate().0, config.channels());
                                }
                                let s_clone = samples_clone.clone();
                                let err_fn = |err| eprintln!("an error occurred on stream: {}", err);
                                
                                let new_stream = match config.sample_format() {
                                    cpal::SampleFormat::F32 => device.build_input_stream(
                                        &config.into(),
                                        move |data: &[f32], _: &cpal::InputCallbackInfo| {
                                            if let Ok(mut buffer) = s_clone.lock() {
                                                buffer.extend_from_slice(data);
                                            }
                                        },
                                        err_fn,
                                        None,
                                    ),
                                    cpal::SampleFormat::I16 => device.build_input_stream(
                                        &config.into(),
                                        move |data: &[i16], _: &cpal::InputCallbackInfo| {
                                            if let Ok(mut buffer) = s_clone.lock() {
                                                buffer.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));
                                            }
                                        },
                                        err_fn,
                                        None,
                                    ),
                                    cpal::SampleFormat::U16 => device.build_input_stream(
                                        &config.into(),
                                        move |data: &[u16], _: &cpal::InputCallbackInfo| {
                                            if let Ok(mut buffer) = s_clone.lock() {
                                                buffer.extend(data.iter().map(|&s| {
                                                    (s as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0)
                                                }));
                                            }
                                        },
                                        err_fn,
                                        None,
                                    ),
                                    _ => continue,
                                };
                                
                                if let Ok(s) = new_stream {
                                    if s.play().is_ok() {
                                        stream = Some(s);
                                    }
                                }
                            }
                        }
                    }
                    RecorderCommand::Stop => {
                        stream = None;
                    }
                }
            }
        });

        Self {
            tx: Mutex::new(tx),
            samples,
            meta,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        if let Ok(tx) = self.tx.lock() {
            tx.send(RecorderCommand::Start).map_err(|e| e.to_string())
        } else {
            Err("Mutex poisoned".to_string())
        }
    }

    pub fn stop(&mut self) -> Option<(Vec<f32>, u32, u16)> {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(RecorderCommand::Stop);
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
        let raw_samples = {
            if let Ok(mut buffer) = self.samples.lock() {
                let s = buffer.clone();
                buffer.clear();
                s
            } else {
                Vec::new()
            }
        };

        if raw_samples.is_empty() {
            None
        } else {
            let (sample_rate, channels) = if let Ok(m) = self.meta.lock() {
                *m
            } else {
                (16000, 1)
            };
            Some((raw_samples, sample_rate, channels))
        }
    }
}

fn resample_to_16k_mono(input_samples: &[f32], src_sample_rate: u32, src_channels: u16) -> Vec<f32> {
    if input_samples.is_empty() {
        return Vec::new();
    }

    let mono_samples = if src_channels > 1 {
        let mut mono = Vec::with_capacity(input_samples.len() / src_channels as usize);
        for chunk in input_samples.chunks_exact(src_channels as usize) {
            let sum: f32 = chunk.iter().sum();
            mono.push(sum / src_channels as f32);
        }
        mono
    } else {
        input_samples.to_vec()
    };

    if src_sample_rate == 16000 {
        return mono_samples;
    }

    let ratio = src_sample_rate as f32 / 16000.0;
    let target_len = (mono_samples.len() as f32 / ratio).floor() as usize;
    let mut resampled = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_index = i as f32 * ratio;
        let index_l = src_index.floor() as usize;
        let index_r = (index_l + 1).min(mono_samples.len() - 1);
        let weight = src_index - index_l as f32;
        
        let sample_l = mono_samples[index_l];
        let sample_r = mono_samples[index_r];
        
        let interpolated = sample_l * (1.0 - weight) + sample_r * weight;
        resampled.push(interpolated);
    }

    resampled
}

fn save_wav(samples: &[f32], path: &str) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    // Apply a volume gain multiplier (e.g., 2.0x) since the raw mic input can be quiet,
    // especially after mixing stereo to mono.
    let volume_gain = 2.0;

    for &sample in samples {
        let amplified = sample * volume_gain;
        let clamped = amplified.clamp(-1.0, 1.0);
        let amplitude = (clamped * i16::MAX as f32) as i16;
        writer.write_sample(amplitude)
            .map_err(|e| format!("Failed to write WAV sample: {}", e))?;
    }
    writer.finalize().map_err(|e| format!("Failed to finalize WAV file: {}", e))?;
    Ok(())
}

pub struct AppState {
    pub config: Mutex<Config>,
    pub recorder: Mutex<AudioRecorder>,
    pub is_recording: Mutex<bool>,
    pub whisper_process: Mutex<Option<Child>>,
    pub resource_dir: std::path::PathBuf,
    pub app_data_dir: std::path::PathBuf,
    pub app_handle: tauri::AppHandle,
    pub tray_ready: tauri::image::Image<'static>,
    pub tray_recording: tauri::image::Image<'static>,
    pub tray_processing: tauri::image::Image<'static>,
}

fn send_to_whisper(wav_path: &str, cantonese_mode: bool) -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(None)
        .build()
        .ok()?;
    let file_bytes = std::fs::read(wav_path).ok()?;
    
    let part = reqwest::blocking::multipart::Part::bytes(file_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav").ok()?;
        
    let prompt_text = if cantonese_mode {
        "以下係廣東話口語對話，請直接用粵語口語字寫出嚟，唔好寫成書面語（國語／普通話）。例如：嘅、咗、喺、佢、唔、係、冇、嚟、嗰、啲、咩、點解、之嘛、搵、嘢、咁、邊、囉、噉、唧、嘥、畀、嗮、㗎、唔好、邊度、點樣、我哋、你哋、佢哋、呢個、玩、食飯、睇嘢。"
    } else {
        "以下是繁體中文："
    };

    let form = reqwest::blocking::multipart::Form::new()
        .part("file", part)
        .text("response_format", "json")
        .text("language", "zh")
        .text("prompt", prompt_text);

    let res = match client.post("http://127.0.0.1:8080/inference")
        .multipart(form)
        .send() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Reqwest error: {}", e);
                return None;
            }
        };
        
    let json: serde_json::Value = match res.json() {
        Ok(j) => j,
        Err(e) => {
            eprintln!("JSON parse error: {}", e);
            return None;
        }
    };
    
    if let Some(text) = json["text"].as_str() {
        Some(text.trim().to_string())
    } else {
        eprintln!("No text field in JSON: {}", json);
        None
    }
}

fn paste_text(text: &str) {
    if let Ok(mut clipboard) = Clipboard::new() {
        let _ = clipboard.set_text(text);
        std::thread::sleep(std::time::Duration::from_millis(100)); // wait for clipboard sync
        let mut enigo = Enigo::new();
        enigo.key_down(Key::Control);
        enigo.key_click(Key::Layout('v'));
        enigo.key_up(Key::Control);
    }
}

fn is_silence(samples: &[f32]) -> bool {
    if samples.is_empty() {
        return true;
    }
    let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
    let rms = (sum_sq / samples.len() as f32).sqrt();
    rms < 0.005 // Roughly -46dB. Prevents transcribing accidental silent clicks
}

fn clean_hallucinations(text: &str) -> String {
    let trimmed = text.trim();
    let lower = trimmed.to_lowercase();
    
    let bad_phrases = [
        "amara.org",
        "字幕由",
        "请关注其他",
        "請關注其他",
        "关注其他影片",
        "關注其他影片",
        "留守更多精彩",
        "下期再見",
        "下期再见",
        "謝謝收看",
        "谢谢收看",
        "thank you for watching",
        "thanks for watching"
    ];
    
    for phrase in &bad_phrases {
        if lower.contains(phrase) {
            return String::new();
        }
    }
    
    trimmed.to_string()
}

fn apply_text_replacements(text: &str, replacements_raw: &str) -> String {
    let mut result = text.to_string();
    for line in replacements_raw.lines() {
        let parts: Vec<&str> = if line.contains("->") {
            line.split("->").map(|s| s.trim()).collect()
        } else if line.contains("→") {
            line.split("→").map(|s| s.trim()).collect()
        } else {
            Vec::new()
        };
        
        if parts.len() == 2 && !parts[0].is_empty() {
            result = result.replace(parts[0], parts[1]);
        }
    }
    result
}

fn handle_recording_stopped(
    samples: &[f32], 
    sample_rate: u32, 
    channels: u16, 
    cantonese_mode: bool, 
    chinese_output: String, 
    sound_mode: String,
    app_handle: tauri::AppHandle, 
    tray_ready_icon: tauri::image::Image<'static>
) {
    let resampled = resample_to_16k_mono(samples, sample_rate, channels);
    if is_silence(&resampled) {
        add_log(&app_handle, "Recording is silent, skipping transcription.".to_string());
        if let Some(tray) = app_handle.tray_by_id("main_tray") {
            let _ = tray.set_icon(Some(tray_ready_icon));
        }
        return;
    }

    let temp_dir = std::env::temp_dir();
    let wav_path = temp_dir.join("voice_input_temp_recording.wav");
    let wav_str = wav_path.to_str().unwrap().to_string();
    if let Err(e) = save_wav(&resampled, &wav_str) {
        add_log(&app_handle, format!("Failed to save WAV: {}", e));
        play_audio_cue("error", &sound_mode);
        if let Some(tray) = app_handle.tray_by_id("main_tray") {
            let _ = tray.set_icon(Some(tray_ready_icon));
        }
        return;
    }
    
    let start = std::time::Instant::now();
    let wav_str_clone = wav_str.clone();
    let app_handle_clone = app_handle.clone();
    let tray_ready_clone = tray_ready_icon.clone();
    let sound_mode_clone = sound_mode.clone();

    std::thread::spawn(move || {
        if let Some(mut text) = send_to_whisper(&wav_str_clone, cantonese_mode) {
            let elapsed = start.elapsed();

            let state = app_handle_clone.state::<AppState>();
            let text_replacements = if let Ok(cfg) = state.config.lock() {
                cfg.text_replacements.clone()
            } else {
                "".to_string()
            };
            text = apply_text_replacements(&text, &text_replacements);
            text = clean_hallucinations(&text);
            
            if text.is_empty() {
                add_log(&app_handle_clone, "Transcription filtered out as silence/hallucination.".to_string());
            } else {
                match chinese_output.as_str() {
                    "traditional_tw" => {
                        text = zhconv(&text, Variant::ZhTW);
                    }
                    "simplified_cn" => {
                        text = zhconv(&text, Variant::ZhCN);
                    }
                    "traditional_hk" => {
                        text = zhconv(&text, Variant::ZhHK);
                    }
                    _ => {}
                }
                
                add_log(&app_handle_clone, format!("Transcription: {} (Took: {:.2?}s)", text, elapsed));
                paste_text(&text);
                let _ = app_handle_clone.emit("transcription-complete", &text);
                play_audio_cue("success", &sound_mode_clone);
            }
        } else {
            add_log(&app_handle_clone, "Failed to transcribe".to_string());
            play_audio_cue("error", &sound_mode_clone);
        }

        if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
            let _ = tray.set_icon(Some(tray_ready_clone));
        }
        
        let _ = std::fs::remove_file(wav_str_clone);
    });
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> Config {
    if let Ok(cfg) = state.config.lock() {
        cfg.clone()
    } else {
        Config::default()
    }
}

fn save_config_file(config: &Config) -> Result<(), String> {
    let config_path = get_config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let mut file = File::create(&config_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

fn restart_whisper_server(state: &AppState) {
    if let Ok(mut process_opt) = state.whisper_process.lock() {
        if let Some(mut child) = process_opt.take() {
            add_log(&state.app_handle, "Killing old whisper server...".to_string());
            let _ = child.kill();
            let _ = child.wait();
        }

        let base_dir = if let Ok(cfg) = state.config.lock() {
            if !cfg.storage_path.is_empty() {
                PathBuf::from(&cfg.storage_path)
            } else {
                state.app_data_dir.clone()
            }
        } else {
            state.app_data_dir.clone()
        };

        let resource_exe = state.resource_dir.join("bin").join("whisper-server.exe");
        let resource_model = state.resource_dir.join("models").join("ggml-large-v3-q5_0.bin");

        let appdata_exe = base_dir.join("bin").join("whisper-server.exe");
        let appdata_model = base_dir.join("models").join("ggml-large-v3-q5_0.bin");

        let cwd = std::env::current_dir().unwrap_or_default();
        let dev_exe = cwd.join("bin").join("whisper-server.exe");
        let dev_model = cwd.join("models").join("ggml-large-v3-q5_0.bin");
        
        let fallback_exe = cwd.join("src-tauri").join("bin").join("whisper-server.exe");
        let fallback_model = cwd.join("src-tauri").join("models").join("ggml-large-v3-q5_0.bin");

        let final_exe = if appdata_exe.exists() {
            appdata_exe
        } else if resource_exe.exists() {
            resource_exe
        } else if dev_exe.exists() {
            dev_exe
        } else {
            fallback_exe
        };

        let final_model = if appdata_model.exists() {
            appdata_model.clone()
        } else if resource_model.exists() {
            resource_model
        } else if dev_model.exists() {
            dev_model
        } else {
            fallback_model
        };

        if final_exe.exists() && final_model.exists() {
            let (cantonese_mode, device_mode, custom_prompt, cpu_threads) = if let Ok(cfg) = state.config.lock() {
                (cfg.cantonese_mode, cfg.device.clone(), cfg.custom_prompt.clone(), cfg.cpu_threads)
            } else {
                (false, "cpu".to_string(), "".to_string(), 0)
            };

            // Safely manage CUDA DLLs to prevent hijacking NVIDIA GPU when device mode is NOT "cuda"
            let check_dirs = vec![
                base_dir.join("bin"),
                state.resource_dir.join("bin"),
                cwd.join("bin"),
                cwd.join("src-tauri").join("bin"),
            ];

            for dir in check_dirs {
                if dir.exists() {
                    let cuda_dll = dir.join("ggml-cuda.dll");
                    let cuda_disabled = dir.join("ggml-cuda.dll.disabled");

                    if device_mode == "cuda" {
                        if !cuda_dll.exists() && cuda_disabled.exists() {
                            let _ = std::fs::rename(&cuda_disabled, &cuda_dll);
                        }
                    } else {
                        if cuda_dll.exists() {
                            add_log(&state.app_handle, format!("Disabling CUDA DLL in {:?} to prevent locking NVIDIA GPU...", dir));
                            let _ = std::fs::rename(&cuda_dll, &cuda_disabled);
                        }
                    }
                }
            }

            let engine_dir = final_exe.parent().unwrap_or_else(|| std::path::Path::new(""));
            if matches!(device_mode.as_str(), "amd" | "vulkan")
                && !engine_dir.join("ggml-vulkan.dll").exists()
            {
                add_log(
                    &state.app_handle,
                    format!(
                        "AMD Vulkan engine is incomplete: {:?} is missing. Server was not started to avoid a silent CPU fallback.",
                        engine_dir.join("ggml-vulkan.dll")
                    ),
                );
                return;
            }

            if device_mode == "cuda" && !engine_dir.join("ggml-cuda.dll").exists() {
                add_log(
                    &state.app_handle,
                    format!(
                        "CUDA engine is incomplete: {:?} is missing. Server was not started to avoid a silent CPU fallback.",
                        engine_dir.join("ggml-cuda.dll")
                    ),
                );
                return;
            }

            let mut prompt = if cantonese_mode {
                "請精準保留講者的廣東話口語字詞（例如：嘅、喺、咗、唔、佢、㗎、喇），不要翻譯成書面語：".to_string()
            } else {
                "以下是繁體中文：".to_string()
            };
            
            if !custom_prompt.trim().is_empty() {
                prompt = format!("{} 常用字詞：{}。", prompt, custom_prompt.trim());
            }

            let device_label = match device_mode.as_str() {
                "amd" | "vulkan" => "AMD GPU (Vulkan)",
                "cuda" => "NVIDIA GPU (CUDA)",
                _ => "CPU Mode",
            };
            add_log(&state.app_handle, format!("Starting whisper server with model: {:?} on {}, threads: {}", final_model, device_label, cpu_threads));
            
            let mut cmd = Command::new(&final_exe);
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW: Hides console window
            cmd.arg("-m").arg(&final_model)
               .arg("--port").arg("8080")
               .arg("--prompt").arg(prompt)
               .arg("--carry-initial-prompt");

            if cpu_threads > 0 {
                cmd.arg("-t").arg(cpu_threads.to_string());
            }

            if device_mode == "cpu" {
                cmd.arg("-ng");
            }

            match cmd
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn() 
            {
                Ok(mut child) => {
                    add_log(&state.app_handle, "Whisper server process spawned successfully!".to_string());
                    
                    // Emit log event for stdout
                    if let Some(stdout) = child.stdout.take() {
                        let app_handle = state.app_handle.clone();
                        std::thread::spawn(move || {
                            use std::io::{BufReader, BufRead};
                            let reader = BufReader::new(stdout);
                            for line in reader.lines() {
                                if let Ok(line_str) = line {
                                    add_log(&app_handle, line_str);
                                }
                            }
                        });
                    }

                    // Emit log event for stderr
                    if let Some(stderr) = child.stderr.take() {
                        let app_handle = state.app_handle.clone();
                        std::thread::spawn(move || {
                            use std::io::{BufReader, BufRead};
                            let reader = BufReader::new(stderr);
                            for line in reader.lines() {
                                if let Ok(line_str) = line {
                                    add_log(&app_handle, line_str);
                                }
                            }
                        });
                    }

                    *process_opt = Some(child);
                }
                Err(e) => add_log(&state.app_handle, format!("Failed to start whisper server: {}", e)),
            }
        } else {
            let path_str = appdata_model.to_string_lossy();
            add_log(&state.app_handle, format!(
                "[CRITICAL ERROR] Whisper server or model not found!\nExe: {:?}\nModel: {:?}\n\nPlease copy your 'ggml-large-v3-q5_0.bin' file to:\n{}",
                final_exe, final_model, path_str
            ));
            
            if let Some(parent) = appdata_model.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
        }
    }
}

fn build_tray_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, lang: &str) -> Result<tauri::menu::Menu<R>, tauri::Error> {
    let (toggle_txt, settings_txt, quit_txt) = if lang == "zh" {
        ("開始 / 停止錄音", "設定", "退出")
    } else {
        ("Start / Stop Recording", "Settings", "Quit")
    };

    let toggle_i = MenuItemBuilder::with_id("toggle", toggle_txt).build(app)?;
    let settings_i = MenuItemBuilder::with_id("settings", settings_txt).build(app)?;
    let quit_i = MenuItemBuilder::with_id("quit", quit_txt).build(app)?;
    
    MenuBuilder::new(app).items(&[&toggle_i, &settings_i, &quit_i]).build()
}

#[tauri::command]
fn set_config(state: tauri::State<AppState>, new_config: Config) -> Result<(), String> {
    let mut autostart_changed = false;
    let mut new_autostart = false;
    
    if let Ok(mut cfg) = state.config.lock() {
        if cfg.start_at_login != new_config.start_at_login {
            autostart_changed = true;
            new_autostart = new_config.start_at_login;
        }
        *cfg = new_config.clone();
        save_config_file(&cfg)?;
    } else {
        return Err("Failed to lock config".to_string());
    }

    if autostart_changed {
        let _ = set_startup_enabled(new_autostart);
    }

    // Update tray menu dynamically when language changes
    let app_handle = state.app_handle.clone();
    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        if let Ok(new_menu) = build_tray_menu(&app_handle, &new_config.app_language) {
            let _ = tray.set_menu(Some(new_menu));
        }
    }

    Ok(())
}

#[tauri::command]
fn start_engine(state: tauri::State<AppState>) {
    restart_whisper_server(&state);
}

#[tauri::command]
fn delete_cuda_files(state: tauri::State<AppState>) -> Result<(), String> {
    let base_dir = if let Ok(cfg) = state.config.lock() {
        if !cfg.storage_path.is_empty() {
            std::path::PathBuf::from(&cfg.storage_path)
        } else {
            state.app_data_dir.clone()
        }
    } else {
        state.app_data_dir.clone()
    };
    
    let bin_dir = base_dir.join("bin");
    if bin_dir.exists() {
        add_log(&state.app_handle, format!("Deleting CUDA files in: {:?}", bin_dir));
        // Delete the custom bin folder containing CUDA binaries
        let _ = std::fs::remove_dir_all(&bin_dir);
    }
    
    // Auto revert device config to cpu
    if let Ok(mut cfg) = state.config.lock() {
        cfg.device = "cpu".to_string();
        save_config_file(&cfg)?;
    }
    
    // Re-launch whisper server in CPU mode
    restart_whisper_server(&state);
    
    Ok(())
}

#[tauri::command]
fn get_logs() -> Vec<String> {
    if let Ok(logs) = LOGS.lock() {
        logs.clone()
    } else {
        Vec::new()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyStatus {
    pub engine_exists: bool,
    pub model_exists: bool,
    pub appdata_dir: String,
    pub appdata_engine_exists: bool,
    pub vulkan_exists: bool,
    pub appdata_vulkan_exists: bool,
    pub cuda_exists: bool,
    pub appdata_cuda_exists: bool,
}

#[tauri::command]
fn check_dependencies(state: tauri::State<AppState>) -> DependencyStatus {
    let base_dir = if let Ok(cfg) = state.config.lock() {
        if !cfg.storage_path.is_empty() {
            PathBuf::from(&cfg.storage_path)
        } else {
            state.app_data_dir.clone()
        }
    } else {
        state.app_data_dir.clone()
    };

    let appdata_exe = base_dir.join("bin").join("whisper-server.exe");
    let appdata_model = base_dir.join("models").join("ggml-large-v3-q5_0.bin");
    
    let resource_exe = state.resource_dir.join("bin").join("whisper-server.exe");
    let _resource_model = state.resource_dir.join("models").join("ggml-large-v3-q5_0.bin");

    let appdata_engine_exists = appdata_exe.exists();
    let engine_exists = appdata_engine_exists || resource_exe.exists();
    let model_exists = appdata_model.exists();

    let appdata_vulkan_exists = base_dir.join("bin").join("ggml-vulkan.dll").exists();
    let resource_vulkan_exists = state.resource_dir.join("bin").join("ggml-vulkan.dll").exists();
    let vulkan_exists = appdata_vulkan_exists || resource_vulkan_exists;

    let appdata_cuda_exists = base_dir.join("bin").join("ggml-cuda.dll").exists() || base_dir.join("bin").join("ggml-cuda.dll.disabled").exists();
    let resource_cuda_exists = state.resource_dir.join("bin").join("ggml-cuda.dll").exists() || state.resource_dir.join("bin").join("ggml-cuda.dll.disabled").exists();
    let cuda_exists = appdata_cuda_exists || resource_cuda_exists;
    
    DependencyStatus {
        engine_exists,
        model_exists,
        appdata_dir: state.app_data_dir.to_string_lossy().to_string(),
        appdata_engine_exists,
        vulkan_exists,
        appdata_vulkan_exists,
        cuda_exists,
        appdata_cuda_exists,
    }
}

#[tauri::command]
fn download_dependency(
    window: tauri::Window,
    url: String,
    dest_path: String,
    event_name: String
) -> Result<(), String> {
    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::builder()
            .user_agent("VoiceInput/1.0")
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new());

        let mut response = match client.get(&url).send() {
            Ok(res) => {
                if !res.status().is_success() {
                    let _ = window.emit(&event_name, serde_json::json!({ "error": format!("HTTP error: {}", res.status()) }));
                    return;
                }
                res
            },
            Err(e) => {
                let _ = window.emit(&event_name, serde_json::json!({ "error": e.to_string() }));
                return;
            }
        };
        
        let total_size = response.content_length().unwrap_or(0);
        let path = std::path::PathBuf::from(&dest_path);
        
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                let _ = window.emit(&event_name, serde_json::json!({ "error": e.to_string() }));
                return;
            }
        }
        
        let mut file = match File::create(&path) {
            Ok(f) => f,
            Err(e) => {
                let _ = window.emit(&event_name, serde_json::json!({ "error": e.to_string() }));
                return;
            }
        };
        
        let mut buffer = [0; 65536]; // 64KB chunks
        let mut downloaded: u64 = 0;
        let mut last_emit = std::time::Instant::now();
        
        loop {
            let limit = match response.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => n,
                Err(e) => {
                    let _ = window.emit(&event_name, serde_json::json!({ "error": e.to_string() }));
                    return;
                }
            };
            
            if let Err(e) = file.write_all(&buffer[..limit]) {
                let _ = window.emit(&event_name, serde_json::json!({ "error": e.to_string() }));
                return;
            }
            
            downloaded += limit as u64;
            
            if last_emit.elapsed().as_millis() > 200 || downloaded == total_size {
                let percentage = if total_size > 0 {
                    (downloaded as f64 / total_size as f64) * 100.0
                } else {
                    0.0
                };
                let _ = window.emit(&event_name, serde_json::json!({
                    "downloaded": downloaded,
                    "total": total_size,
                    "percentage": percentage
                }));
                last_emit = std::time::Instant::now();
            }
        }
        
        if total_size > 0 && downloaded < total_size {
            let _ = window.emit(&event_name, serde_json::json!({ "error": format!("Download incomplete: got {} of {} bytes", downloaded, total_size) }));
            return;
        }

        let _ = window.emit(&event_name, serde_json::json!({
            "downloaded": downloaded,
            "total": total_size,
            "percentage": 100.0,
            "done": true
        }));
    });
    
    Ok(())
}

#[tauri::command]
fn extract_zip(zip_path: String, dest_dir: String) -> Result<(), String> {
    let zip_path_buf = std::path::PathBuf::from(&zip_path);
    let dest_dir_buf = std::path::PathBuf::from(&dest_dir);
    
    let file = File::open(&zip_path_buf).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    std::fs::create_dir_all(&dest_dir_buf).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_dir_buf.join(path),
            None => continue,
        };
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    
    // Flatten subdirectories if files were extracted inside a nested subfolder
    if let Ok(entries) = std::fs::read_dir(&dest_dir_buf) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(sub_entries) = std::fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        if sub_path.is_file() {
                            let target_file = dest_dir_buf.join(sub_path.file_name().unwrap());
                            let _ = std::fs::copy(&sub_path, &target_file);
                        }
                    }
                }
            }
        }
    }

    // Ensure server.exe is also mirrored to whisper-server.exe if present
    let server_exe = dest_dir_buf.join("server.exe");
    let whisper_server_exe = dest_dir_buf.join("whisper-server.exe");
    if server_exe.exists() && !whisper_server_exe.exists() {
        let _ = std::fs::copy(&server_exe, &whisper_server_exe);
    }

    let _ = std::fs::remove_file(zip_path_buf);
    Ok(())
}

#[tauri::command]
fn select_directory() -> Option<String> {
    if let Some(path) = rfd::FileDialog::new().pick_folder() {
        Some(path.to_string_lossy().to_string())
    } else {
        None
    }
}

#[tauri::command]
fn select_file(filters_name: String, extensions: Vec<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    let ext_slices: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    dialog = dialog.add_filter(&filters_name, &ext_slices);
    if let Some(path) = dialog.pick_file() {
        Some(path.to_string_lossy().to_string())
    } else {
        None
    }
}

#[tauri::command]
async fn import_local_dependencies(
    engine_zip_path: Option<String>,
    model_bin_path: Option<String>,
    storage_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // 1. Resolve storage path
    let base_path = if let Some(ref sp) = storage_path {
        if sp.trim().is_empty() {
            state.app_data_dir.clone()
        } else {
            PathBuf::from(sp)
        }
    } else {
        state.app_data_dir.clone()
    };
    
    let bin_dir = base_path.join("bin");
    let model_dir = base_path.join("models");
    
    std::fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&model_dir).map_err(|e| e.to_string())?;
    
    // 2. Import Engine ZIP (extract it to bin_dir)
    if let Some(ezp) = engine_zip_path {
        if !ezp.trim().is_empty() {
            let zip_path = PathBuf::from(&ezp);
            if zip_path.exists() {
                add_log(&state.app_handle, format!("Importing local engine zip: {:?}", zip_path));
                let file = File::open(&zip_path).map_err(|e| e.to_string())?;
                let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
                
                for i in 0..archive.len() {
                    let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                    let outpath = match file.enclosed_name() {
                        Some(path) => bin_dir.join(path),
                        None => continue,
                    };
                    
                    if file.name().ends_with('/') {
                        std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
                    } else {
                        if let Some(p) = outpath.parent() {
                            if !p.exists() {
                                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                            }
                        }
                        let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                    }
                }
                add_log(&state.app_handle, "Engine zip extracted successfully!".to_string());
            }
        }
    }
    
    // 3. Import Model Bin file (copy it to model_dir/ggml-large-v3-q5_0.bin)
    if let Some(mbp) = model_bin_path {
        if !mbp.trim().is_empty() {
            let bin_path = PathBuf::from(&mbp);
            if bin_path.exists() {
                add_log(&state.app_handle, format!("Importing local model file: {:?}", bin_path));
                let dest_path = model_dir.join("ggml-large-v3-q5_0.bin");
                std::fs::copy(&bin_path, &dest_path).map_err(|e| e.to_string())?;
                add_log(&state.app_handle, "Model file imported successfully!".to_string());
            }
        }
    }
    
    // 4. Update state config with new storage path
    if let Ok(mut cfg) = state.config.lock() {
        if let Some(ref sp) = storage_path {
            cfg.storage_path = sp.clone();
        }
        let exe_dir = get_exe_dir();
        let config_path = exe_dir.join("config.json");
        if let Ok(json_str) = serde_json::to_string_pretty(&*cfg) {
            let _ = std::fs::write(config_path, json_str);
        }
    }
    
    // 5. Restart Whisper server to apply everything
    restart_whisper_server(&state);
    
    Ok(())
}

#[tauri::command]
fn export_config_file(config_json: String) -> Result<(), String> {
    if let Some(path) = rfd::FileDialog::new()
        .set_file_name("voice_input_backup.json")
        .add_filter("JSON Files", &["json"])
        .save_file() 
    {
        let mut file = File::create(&path).map_err(|e| e.to_string())?;
        file.write_all(config_json.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Export cancelled by user".to_string())
    }
}

#[tauri::command]
fn import_config_file() -> Result<Config, String> {
    if let Some(path) = rfd::FileDialog::new()
        .add_filter("JSON Files", &["json"])
        .pick_file() 
    {
        let mut file = File::open(&path).map_err(|e| e.to_string())?;
        let mut content = String::new();
        file.read_to_string(&mut content).map_err(|e| e.to_string())?;
        
        let config: Config = serde_json::from_str(&content).map_err(|e| format!("Invalid backup file format: {}", e))?;
        Ok(config)
    } else {
        Err("Import cancelled by user".to_string())
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config();
    let normalized_shortcut = normalize_hotkey(&config.hotkey);
    println!("Loaded config. Hotkey: {} ({})", config.hotkey, normalized_shortcut);

    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
            let state = app.state::<AppState>();
            let (hotkey_mode, sound_mode) = if let Ok(cfg) = state.config.lock() {
                (cfg.hotkey_mode.clone(), cfg.sound_mode.clone())
            } else {
                ("hold".to_string(), "modern".to_string())
            };

            if event.state == ShortcutState::Pressed {
                println!("Global shortcut pressed!");
                let mut is_recording = state.is_recording.lock().unwrap();

                if hotkey_mode == "hold" {
                    if !*is_recording {
                        if let Ok(mut recorder) = state.recorder.lock() {
                            if let Err(e) = recorder.start() {
                                eprintln!("Failed to start recording: {}", e);
                            } else {
                                *is_recording = true;
                                println!("Recording started (Hold mode)...");
                                if let Some(tray) = app.tray_by_id("main_tray") {
                                    let _ = tray.set_icon(Some(state.tray_recording.clone()));
                                }
                                play_audio_cue("start", &sound_mode);
                            }
                        }
                    }
                } else {
                    // Toggle mode
                    if *is_recording {
                        if let Ok(mut recorder) = state.recorder.lock() {
                            if let Some((samples, sample_rate, channels)) = recorder.stop() {
                                *is_recording = false;
                                println!("Recording stopped (Toggle mode)...");
                                if let Some(tray) = app.tray_by_id("main_tray") {
                                    let _ = tray.set_icon(Some(state.tray_processing.clone()));
                                }
                                play_audio_cue("stop", &sound_mode);

                                let (cantonese_mode, chinese_output) = if let Ok(cfg) = state.config.lock() {
                                    (cfg.cantonese_mode, cfg.chinese_output.clone())
                                } else {
                                    (false, "traditional_tw".to_string())
                                };
                                handle_recording_stopped(&samples, sample_rate, channels, cantonese_mode, chinese_output, sound_mode.clone(), state.app_handle.clone(), state.tray_ready.clone());
                            }
                        }
                    } else {
                        if let Ok(mut recorder) = state.recorder.lock() {
                            if let Err(e) = recorder.start() {
                                eprintln!("Failed to start recording: {}", e);
                            } else {
                                *is_recording = true;
                                println!("Recording started (Toggle mode)...");
                                if let Some(tray) = app.tray_by_id("main_tray") {
                                    let _ = tray.set_icon(Some(state.tray_recording.clone()));
                                }
                                play_audio_cue("start", &sound_mode);
                            }
                        }
                    }
                }
            } else if event.state == ShortcutState::Released {
                println!("Global shortcut released!");
                let mut is_recording = state.is_recording.lock().unwrap();

                if hotkey_mode == "hold" && *is_recording {
                    if let Ok(mut recorder) = state.recorder.lock() {
                        if let Some((samples, sample_rate, channels)) = recorder.stop() {
                            *is_recording = false;
                            println!("Recording stopped (Hold mode)...");
                            if let Some(tray) = app.tray_by_id("main_tray") {
                                    let _ = tray.set_icon(Some(state.tray_processing.clone()));
                            }
                            play_audio_cue("stop", &sound_mode);

                            let (cantonese_mode, chinese_output) = if let Ok(cfg) = state.config.lock() {
                                (cfg.cantonese_mode, cfg.chinese_output.clone())
                            } else {
                                (false, "traditional_tw".to_string())
                            };
                            handle_recording_stopped(&samples, sample_rate, channels, cantonese_mode, chinese_output, sound_mode.clone(), state.app_handle.clone(), state.tray_ready.clone());
                        }
                    }
                }
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(shortcut_plugin)
        .invoke_handler(tauri::generate_handler![greet, get_config, set_config, get_logs, check_dependencies, download_dependency, extract_zip, start_engine, delete_cuda_files, select_directory, select_file, import_local_dependencies, export_config_file, import_config_file])
        .setup(move |app| {
            let config = load_config();
            let normalized = normalize_hotkey(&config.hotkey);

            let resource_dir = app.path().resource_dir().unwrap_or_default();
            let app_data_dir = app.path().app_data_dir().unwrap_or_default();
            let app_handle = app.handle().clone();

            let tray_ready_bytes = include_bytes!("../icons/tray_ready.png");
            let tray_ready_decoded = image::load_from_memory(tray_ready_bytes).unwrap().to_rgba8();
            let (w_r, h_r) = tray_ready_decoded.dimensions();
            let tray_ready = tauri::image::Image::new_owned(tray_ready_decoded.into_raw(), w_r, h_r);

            let tray_recording_bytes = include_bytes!("../icons/tray_recording.png");
            let tray_recording_decoded = image::load_from_memory(tray_recording_bytes).unwrap().to_rgba8();
            let (w_rec, h_rec) = tray_recording_decoded.dimensions();
            let tray_recording = tauri::image::Image::new_owned(tray_recording_decoded.into_raw(), w_rec, h_rec);

            let tray_processing_bytes = include_bytes!("../icons/tray_processing.png");
            let tray_processing_decoded = image::load_from_memory(tray_processing_bytes).unwrap().to_rgba8();
            let (w_pr, h_pr) = tray_processing_decoded.dimensions();
            let tray_processing = tauri::image::Image::new_owned(tray_processing_decoded.into_raw(), w_pr, h_pr);

            let app_state = AppState {
                config: Mutex::new(config.clone()),
                recorder: Mutex::new(AudioRecorder::new()),
                is_recording: Mutex::new(false),
                whisper_process: Mutex::new(None),
                resource_dir: resource_dir.clone(),
                app_data_dir: app_data_dir.clone(),
                app_handle,
                tray_ready: tray_ready.clone(),
                tray_recording,
                tray_processing,
            };
            
            restart_whisper_server(&app_state);
            app.manage(app_state);

            let _ = set_startup_enabled(config.start_at_login);

            let base_dir = if !config.storage_path.is_empty() {
                PathBuf::from(&config.storage_path)
            } else {
                app_data_dir.clone()
            };

            let appdata_exe = base_dir.join("bin").join("whisper-server.exe");
            let appdata_model = base_dir.join("models").join("ggml-large-v3-q5_0.bin");
            let resource_exe = resource_dir.join("bin").join("whisper-server.exe");

            let appdata_engine_exists = appdata_exe.exists();
            let engine_exists = appdata_engine_exists || resource_exe.exists();
            let model_exists = appdata_model.exists();

            let show_window = config.show_settings_on_startup || !engine_exists || !model_exists;
            if show_window {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            let parsed_shortcut = normalized.parse::<Shortcut>();

            // Register global shortcut
            if let Ok(parsed_shortcut) = parsed_shortcut {
                if let Err(e) = app.global_shortcut().register(parsed_shortcut) {
                    eprintln!("Failed to register global shortcut: {:?}", e);
                } else {
                    println!("Successfully registered global shortcut: {}", normalized);
                }
            } else {
                eprintln!("Could not parse shortcut: {}", normalized);
            }

            // 1. Create tray menu items dynamically using loaded language
            let menu = build_tray_menu(app.handle(), &config.app_language)?;

            // 2. Build the tray icon
            let _tray = TrayIconBuilder::with_id("main_tray")
                .icon(tray_ready)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            let state = app.state::<AppState>();
                            if let Ok(mut process_opt) = state.whisper_process.lock() {
                                if let Some(mut child) = process_opt.take() {
                                    let _ = child.kill();
                                }
                            }
                            app.exit(0);
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "toggle" => {
                            let state = app.state::<AppState>();
                            let mut is_recording = state.is_recording.lock().unwrap();
                            let (cantonese_mode, chinese_output, sound_mode) = if let Ok(cfg) = state.config.lock() {
                                (cfg.cantonese_mode, cfg.chinese_output.clone(), cfg.sound_mode.clone())
                            } else {
                                (false, "traditional_tw".to_string(), "modern".to_string())
                            };
                            if *is_recording {
                                if let Ok(mut recorder) = state.recorder.lock() {
                                    if let Some((samples, sample_rate, channels)) = recorder.stop() {
                                        *is_recording = false;
                                        println!("Recording stopped via tray menu. Samples: {}", samples.len());
                                        if let Some(tray) = app.tray_by_id("main_tray") {
                                            let _ = tray.set_icon(Some(state.tray_processing.clone()));
                                        }
                                        play_audio_cue("stop", &sound_mode);
                                        handle_recording_stopped(&samples, sample_rate, channels, cantonese_mode, chinese_output, sound_mode.clone(), state.app_handle.clone(), state.tray_ready.clone());
                                    }
                                }
                            } else {
                                if let Ok(mut recorder) = state.recorder.lock() {
                                    if recorder.start().is_ok() {
                                        *is_recording = true;
                                        println!("Recording started via tray menu...");
                                        if let Some(tray) = app.tray_by_id("main_tray") {
                                            let _ = tray.set_icon(Some(state.tray_recording.clone()));
                                        }
                                        play_audio_cue("start", &sound_mode);
                                    }
                                }
                            }
                        }
                        _ => (),
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        let state = app_handle.state::<AppState>();
                        let mut is_recording = state.is_recording.lock().unwrap();
                        let (cantonese_mode, chinese_output, sound_mode) = if let Ok(cfg) = state.config.lock() {
                            (cfg.cantonese_mode, cfg.chinese_output.clone(), cfg.sound_mode.clone())
                        } else {
                            (false, "traditional_tw".to_string(), "modern".to_string())
                        };
                        if *is_recording {
                            if let Ok(mut recorder) = state.recorder.lock() {
                                if let Some((samples, sample_rate, channels)) = recorder.stop() {
                                    *is_recording = false;
                                    println!("Recording stopped via tray click. Samples: {}", samples.len());
                                    if let Some(tray) = app_handle.tray_by_id("main_tray") {
                                        let _ = tray.set_icon(Some(state.tray_processing.clone()));
                                    }
                                    play_audio_cue("stop", &sound_mode);
                                    handle_recording_stopped(&samples, sample_rate, channels, cantonese_mode, chinese_output, sound_mode.clone(), state.app_handle.clone(), state.tray_ready.clone());
                                }
                            }
                        } else {
                            if let Ok(mut recorder) = state.recorder.lock() {
                                if recorder.start().is_ok() {
                                    *is_recording = true;
                                    println!("Recording started via tray click...");
                                    if let Some(tray) = app_handle.tray_by_id("main_tray") {
                                        let _ = tray.set_icon(Some(state.tray_recording.clone()));
                                    }
                                    play_audio_cue("start", &sound_mode);
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
