# 🎙️ VoiceInput

VoiceInput is a lightweight, highly efficient, and secure offline speech-to-text tray application for Windows. Powered by Tauri, Rust, TypeScript, and Whisper AI, it runs quietly in your system tray and pastes text directly into your active window when you trigger the hotkey.

VoiceInput 是一款專為 Windows 開發的輕量、高效且安全的**離線語音輸入法工具**。基於 Tauri、Rust、TypeScript 和 Whisper AI 技術，它能常駐於系統工作列（System Tray），並在您按下快捷鍵說話後，將辨識出的文字直接貼入目前游標所在的任何輸入框。

---

## ✨ Features / 核心功能

*   **🎙️ Offline & Secure / 離線運作，隱私安全**
    All audio processing is done entirely on your local machine. No voice data is uploaded to any server.
    所有語音識別都在您的電腦本地端完成，無須聯網，語音隱私絕對安全。
    
*   **🚀 Dynamic CPU/GPU Selector / 靈活自選 CPU 或 GPU 加速**
    Choose between CPU Edition (highly compatible) or NVIDIA GPU CUDA Edition (blazing fast) during setup or in settings.
    在安裝或設定中可自由選擇「CPU 引擎」或「NVIDIA GPU CUDA 引擎」加速，享受極速打字體驗。

*   **📂 Custom Storage Path & Local Import / 自訂儲存路徑與本地離線安裝**
    Select where to save large engine and model files. Bypasses internet downloads by importing local `.zip` and `.bin` files directly in the Setup Wizard.
    支援自定義安裝路徑（如 D 碟），並可直接在安裝引導中導入本地的引擎與模型檔案，秒速完成離線安裝。

*   **📝 Dedicated Learning Tab / 專屬字詞學習與糾錯機制**
    *   **Correct Last Sentence / 修正上一句**: Automatically compares your correction with the misheard transcript, extracts the wrong/correct pair, and adds it to your database.
        自動對比上一句識別內容與修正內容，提取出聽錯的字詞並自動學會！
    *   **Custom Vocabulary / 常用詞彙學習庫**: Input names, product terms, and specific nouns to teach the AI.
        輸入您常用的專有名詞、姓名等（以逗號隔開），讓 AI 越用越精準。
    *   **Text Corrections / 糾錯對照表**: Set up custom character replacement rules (e.g. `崔斯 -> Travis`).
        自訂字詞更換規則，自動將聽錯的字替換成正確的字。

*   **💾 Settings Backup & Migration / 資料備份與移轉**
    Easily export all hotkeys, system settings, and custom learnings to a light JSON file, and import them on a new computer.
    一鍵匯出所有系統配置與字詞學習庫，在新電腦上匯入即可無縫接軌。

*   **🔊 Audio Cues & Sound Choices / 語音音效與提示音**
    Choose from Modern Synths, Retro Beeps, or Muted mode for start, success, and error notifications.
    內建現代合成音、復古嗶嗶聲與靜音模式，提供開始、成功與出錯的輕聲提示音。

---

## ⚙️ System Requirements / 系統要求

*   **OS**: Windows 10 / 11 (64-bit)
*   **Hardware**: 
    *   **CPU Edition**: Any modern x64 CPU.
    *   **NVIDIA GPU Edition**: Requires an NVIDIA graphics card supporting CUDA.
*   **Space**: Approximately 1.2 GB of free disk space (for the Whisper large model and local engine server).

---

## 🚀 How to Run & Build / 開發與建置

### Prerequisites / 前置需求
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust & Cargo](https://www.rust-lang.org/tools/install)
*   C++ Build Tools (for Tauri bundler)

### Development / 開發模式
```bash
# Install NPM dependencies / 安裝依賴
npm install

# Run application in dev mode / 啟動開發模式
npm run tauri dev
```

### Production Build / 打包發佈
To package the final installer (MSI):
```bash
npm run tauri build
```
The output `.msi` file will be generated in `src-tauri/target/release/bundle/msi/`.

---

## 👥 Designer Credit / 設計者資訊

*   **Designer / 設計者**: Travis Au
*   **Email / 電郵**: [contact@travis-studio.com](mailto:contact@travis-studio.com)
*   **Website / 網站**: [https://travis-studio.com](https://travis-studio.com)
