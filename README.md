# VoiceInput

VoiceInput is a lightweight Windows tray application for private, offline speech-to-text. It is built with Tauri, Rust, TypeScript, and whisper.cpp. Press a hotkey, speak, and VoiceInput pastes the transcription into the active application.

VoiceInput 是一款輕量、私隱優先的 Windows 離線語音輸入工具。程式以 Tauri、Rust、TypeScript 及 whisper.cpp 製作。按下快捷鍵開始說話，完成後文字會自動貼到目前使用中的程式。

## Features / 功能

- **Offline and private / 離線及保障私隱**
  - After the initial engine and model setup, speech recognition runs locally. Voice recordings are not uploaded to a transcription service.
  - 完成首次引擎及模型設定後，語音辨識會在本機運行，不會將錄音上傳到語音轉錄服務。

- **CPU, NVIDIA CUDA, and AMD Vulkan / 支援 CPU、NVIDIA CUDA 及 AMD Vulkan**
  - Choose the engine that matches the computer during first-run setup or in Settings.
  - 可在首次安裝精靈或設定頁選擇適合電腦的運算引擎。
  - AMD mode verifies that the Vulkan runtime is present instead of silently falling back to CPU.
  - AMD 模式會檢查 Vulkan runtime，避免安裝不完整時靜默改用 CPU。

- **Cantonese mode and Chinese output / 廣東話模式及中文輸出**
  - Supports Cantonese prompts and Traditional Chinese, Simplified Chinese, or original model output.
  - 支援廣東話提示，以及繁體中文、簡體中文或模型原始文字輸出。

- **Custom vocabulary and text corrections / 自訂字詞及文字修正**
  - Add names, product terms, and replacement rules to improve everyday dictation.
  - 可加入人名、產品名稱及文字取代規則，改善日常語音輸入。

- **Settings backup and migration / 設定備份及轉移**
  - Export or import hotkeys, application settings, vocabulary, and correction rules as JSON.
  - 可用 JSON 匯出或匯入快捷鍵、程式設定、自訂字詞及修正規則。

- **Local file import / 本地檔案匯入**
  - The setup wizard can import compatible engine ZIP and Whisper model BIN files for offline deployment.
  - 安裝精靈可匯入兼容的引擎 ZIP 及 Whisper 模型 BIN，方便離線部署。

## System requirements / 系統需求

- Windows 10 or Windows 11, 64-bit
- Approximately 1.2 GB of free space for the Whisper model and local engine
- One of the following:
  - A modern x64 CPU
  - An NVIDIA GPU with a compatible CUDA driver
  - An AMD GPU with a working Vulkan driver

已在 AMD Radeon RX 5700 XT 上驗證 Vulkan 加速，日誌顯示 `use gpu = 1` 及 `using Vulkan0 backend`。

## Install / 安裝

1. Download `VoiceInput_1.0.4_x64-setup.exe` from [GitHub Releases](https://github.com/travisau/VoiceInput-main/releases).
2. Run the installer and approve the Windows administrator prompt.
3. VoiceInput is installed for all users at:

   ```text
   C:\Program Files\VoiceInput
   ```

4. On first launch, the setup wizard uses the current Windows user's data folder:

   ```text
   %AppData%\voiceinput
   ```

5. Select CPU, NVIDIA CUDA, or AMD Vulkan. The Whisper Large-v3 Q5 model is approximately 1.08 GB and is downloaded during first-run setup if it is not already installed.

中文安裝摘要：下載 `VoiceInput_1.0.4_x64-setup.exe`，以管理員權限完成安裝。程式會安裝到 `C:\Program Files\VoiceInput`，模型、設定及可下載引擎會儲存在 `%AppData%\voiceinput`，毋須安裝到其他磁碟。

## Fresh-install flow / 新用戶首次安裝流程

On a clean profile, VoiceInput opens the setup wizard, selects the per-user AppData folder automatically, checks the selected engine and model, then starts the engine once after setup is complete.

全新使用者第一次開啟程式時，會看到安裝引導精靈。程式會自動選用該使用者的 AppData 資料夾，檢查所選引擎及模型，完成後只啟動一次語音引擎。

## Development / 開發

### Prerequisites / 所需工具

- [Node.js](https://nodejs.org/) 18 or later
- [Rust and Cargo](https://www.rust-lang.org/tools/install)
- Microsoft C++ Build Tools required by Tauri

### Run in development mode / 開發模式

```powershell
npm install
npm run tauri dev
```

### Build the Windows installer / 建立 Windows 安裝程式

The supported release artifact is the per-machine NSIS executable:

```powershell
npm run tauri build -- --bundles nsis
```

Output:

```text
src-tauri\target\release\bundle\nsis\VoiceInput_<version>_x64-setup.exe
```

## Project structure / 專案結構

- `src/` — TypeScript frontend and first-run setup flow
- `src-tauri/src/` — Rust application, recording, configuration, and engine management
- `src-tauri/bin/` — engine runtime files bundled into release builds
- `src-tauri/tauri.conf.json` — installer and bundled-resource configuration

## Credits / 製作資料

- Designer / 設計者：Travis Au
- Email / 電郵：[contact@travis-studio.com](mailto:contact@travis-studio.com)
- Website / 網站：[https://travis-studio.com](https://travis-studio.com)
