# VoiceInput v1.0.4

This release repairs first-run installation and AMD GPU support, and standardizes the Windows installation on the C drive.

本版本修正首次安裝流程及 AMD GPU 支援，並統一使用 C 碟作 Windows 正式安裝位置。

## Highlights / 主要更新

- Added and verified AMD Vulkan engine support.
- Fixed the AMD setup option incorrectly selecting the NVIDIA CUDA download.
- AMD installation now requires `ggml-vulkan.dll`; an incomplete engine is no longer reported as installed.
- Prevented AMD mode from silently starting without its Vulkan runtime.
- Fixed the first-run setup window so it is shown and focused after the WebView is ready.
- Fixed setup configuration synchronization for the selected device and storage path.
- Removed the duplicate engine restart during setup that could crash the application on Windows.
- Added the CPU and AMD Vulkan runtime files to the installer resources.
- Changed the Windows installer to per-machine NSIS installation at `C:\Program Files\VoiceInput`.
- User configuration, downloaded engines, and models are stored under `%AppData%\voiceinput`.
- Existing v1.0.0 profiles under `%AppData%\com.travis.voiceinput` are migrated without forcing another model download.
- Improved the learning dialog so users can review the wrong phrase, corrected phrase, replacement rule, and vocabulary entry before saving.

## Validation / 驗證結果

- Fresh Windows user-profile setup completed successfully.
- Setup started the engine exactly once: one start and zero forced restarts.
- Tested on AMD Radeon RX 5700 XT.
- Confirmed `use gpu = 1` and `using Vulkan0 backend` in the engine log.
- Health endpoint returned `{"status":"ok"}`.
- Whisper Large-v3 Q5 transcription completed successfully using the Vulkan backend.
- Active application, engine, model, and configuration paths were confirmed on the C drive with no active `S:\` reference.

## Release asset / 發布檔案

`VoiceInput_1.0.4_x64-setup.exe`

- Size: 11,794,145 bytes
- SHA-256: `4A976DDB757A954F7490FC412B317ABDB1FE8D5962005EF163D37F21B65CC40B`
- Architecture: Windows x64
- Installer: NSIS, per-machine
- Install location: `C:\Program Files\VoiceInput`

## First-run note / 首次使用注意

The Whisper Large-v3 Q5 model is approximately 1.08 GB. It is downloaded to `%AppData%\voiceinput\models` during first-run setup unless a compatible local model is imported.

Whisper Large-v3 Q5 模型約 1.08 GB。首次設定時會下載到 `%AppData%\voiceinput\models`；使用者亦可在安裝精靈匯入兼容的本地模型。
