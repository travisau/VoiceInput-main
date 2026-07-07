import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Config {
  model: string;
  language: string;
  paste_mode: string;
  device: string;
  compute_type: string;
  hotkey_mode: string;
  hotkey: string;
  chinese_output: string;
  cantonese_mode: boolean;
  cpu_threads: number;
  start_at_login: boolean;
  app_language: string;
  sound_mode: string;
  storage_path: string;
  custom_prompt: string;
  text_replacements: string;
}

interface DependencyStatus {
  engine_exists: boolean;
  model_exists: boolean;
  appdata_dir: string;
}

let currentConfig: Config | null = null;

const hotkeyInput = document.getElementById("hotkey") as HTMLInputElement;
const hotkeyModeSelect = document.getElementById("hotkey-mode") as HTMLSelectElement;
const soundModeSelect = document.getElementById("sound-mode") as HTMLSelectElement;
const cantoneseModeToggle = document.getElementById("cantonese-mode") as HTMLInputElement;
const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const chineseOutputSelect = document.getElementById("chinese-output") as HTMLSelectElement;
const applyBtn = document.getElementById("apply-btn") as HTMLButtonElement;
const appLanguageSelect = document.getElementById("app-language") as HTMLSelectElement;
const storagePathInput = document.getElementById("storage-path") as HTMLInputElement;
const browseStorageBtn = document.getElementById("browse-storage-btn") as HTMLButtonElement;
const deviceSelect = document.getElementById("device-select") as HTMLSelectElement;
const customPromptInput = document.getElementById("custom-prompt") as HTMLInputElement;
const textReplacementsInput = document.getElementById("text-replacements") as HTMLTextAreaElement;
const applyLearningBtn = document.getElementById("apply-learning-btn") as HTMLButtonElement;
const learnBtn = document.getElementById("learn-btn") as HTMLButtonElement;
const lastTranscriptionText = document.getElementById("last-transcription-text") as HTMLDivElement;
const correctedTextInput = document.getElementById("corrected-text") as HTMLInputElement;

const setupStoragePathInput = document.getElementById("setup-storage-path") as HTMLInputElement;
const setupBrowseStorageBtn = document.getElementById("setup-browse-storage-btn") as HTMLButtonElement;
const setupTabDownload = document.getElementById("btn-setup-tab-download") as HTMLButtonElement;
const setupTabImport = document.getElementById("btn-setup-tab-import") as HTMLButtonElement;
const methodDownloadContent = document.getElementById("method-download-content") as HTMLDivElement;
const methodImportContent = document.getElementById("method-import-content") as HTMLDivElement;
const importEnginePath = document.getElementById("import-engine-path") as HTMLInputElement;
const importBrowseEngineBtn = document.getElementById("import-browse-engine-btn") as HTMLButtonElement;
const importModelPath = document.getElementById("import-model-path") as HTMLInputElement;
const importBrowseModelBtn = document.getElementById("import-browse-model-btn") as HTMLButtonElement;
const startDownloadBtn = document.getElementById("start-download-btn") as HTMLButtonElement;
const startImportBtn = document.getElementById("start-import-btn") as HTMLButtonElement;
const exportConfigBtn = document.getElementById("export-config-btn") as HTMLButtonElement;
const importConfigBtn = document.getElementById("import-config-btn") as HTMLButtonElement;
const setupEngineSelect = document.getElementById("setup-engine-select") as HTMLSelectElement;

let lastTransText = "";

const translations: Record<string, Record<string, string>> = {
  zh: {
    "tab-settings": "⚙️ 系統設定",
    "tab-logs": "🖥️ 引擎日誌",
    "title-hotkey": "⌨️ 快捷鍵設定",
    "lbl-hotkey": "啟動快捷鍵",
    "lbl-hotkey-mode": "按鍵模式",
    "opt-mode-hold": "長按錄音",
    "opt-mode-toggle": "點擊開關",
    "lbl-sound-mode": "語音音效",
    "opt-sound-modern": "現代合成音 (推薦)",
    "opt-sound-retro": "復古蜂鳴音",
    "opt-sound-off": "靜音模式",
    "lbl-app-language": "介面語言",
    "title-engine": "🧠 AI 引擎設定",
    "lbl-cantonese-title": "粵語模式 (廣東話)",
    "lbl-cantonese-desc": "保留廣東話口語化詞彙（如「佢、哋、咗」）",
    "lbl-device-select": "運算裝置 (Device)",
    "opt-device-cpu": "CPU (高相容性，支援所有電腦)",
    "opt-device-cuda": "NVIDIA GPU (需 CUDA 支援，速度最快)",
    "lbl-model-select": "AI 語音模型",
    "lbl-chinese-output": "文字輸出格式",
    "opt-chinese-tw": "繁體中文 (台灣/香港)",
    "opt-chinese-cn": "簡體中文",
    "opt-chinese-none": "原始輸出 (不轉換)",
    "lbl-storage-path": "引擎及模型儲存路徑",
    "placeholder-storage": "預設位置 (AppData)",
    "btn-browse": "瀏覽...",
    "btn-apply": "儲存設定",
    "btn-apply-saving": "正在儲存...",
    "btn-apply-success": "儲存成功！",
    "btn-apply-failed": "儲存失敗",
    "credits-text": "設計者：Travis Au | 電郵：contact@travis-studio.com",
    "title-logs": "🖥️ 引擎運行狀態日誌",
    "setup-title": "🎙️ VoiceInput 安裝引導精靈",
    "setup-desc": "歡迎使用！我們需要下載 AI 語音引擎及模型檔案。它們將儲存在您的儲存路徑中。",
    "setup-engine-title": "AI 語音引擎 (CPU版)",
    "setup-model-title": "AI 語音模型 (Large-v3 輕量版)",
    "btn-download": "一鍵下載與安裝",
    "btn-download-setting-up": "正在安裝...",
    "btn-download-retry": "重試安裝",
    "btn-download-all-set": "安裝完成！正在啟動引擎...",
    "status-checking": "正在檢查...",
    "status-missing": "未下載",
    "status-installed": "已安裝",
    "status-downloading": "正在下載...",
    "status-extracting": "正在解壓...",
    "status-ready": "就緒",
    "status-recording": "錄音中...",
    "status-processing": "處理中...",
    "status-transcribing": "正在轉寫...",
    "title-learning": "📝 字詞學習與自動修正",
    "lbl-setup-storage": "安裝與儲存資料夾 (Storage Path)",
    "btn-setup-tab-download": "🚀 網絡一鍵下載 (推薦)",
    "btn-setup-tab-import": "📂 本地檔案匯入 (離線)",
    "lbl-import-engine": "語音引擎壓縮包 (whisper-server-cpu.zip)",
    "lbl-import-model": "語音模型檔 (ggml-large-v3-q5_0.bin)",
    "btn-install-import": "開始匯入並安裝",
    "lbl-setup-engine-select": "AI 運算引擎版本 (Engine Edition)",
    "opt-setup-cpu": "CPU 版本 (相容性最高，檔案僅 4.4MB)",
    "opt-setup-cuda": "NVIDIA GPU CUDA 版本 (速度極快，需 NVIDIA 顯卡)",
    "lbl-custom-prompt": "常用詞彙學習庫 (Custom Vocabulary)",
    "lbl-custom-prompt-desc": "讓 AI 學習新詞彙，在此輸入你經常使用的專有名詞、姓名、產品名等（用逗號隔開）",
    "lbl-text-replacements": "字詞自動修正對照表 (Text Corrections)",
    "lbl-text-replacements-desc": "自動將聽錯的字替換成正確的字（每行一條規則，格式如：舊字 -> 新字，例如：崔斯 -> Travis）",
    "tab-learning": "📝 字詞學習",
    "title-correct-last": "✏️ 修正上一句辨識內容",
    "lbl-last-transcription": "上一句語音辨識內容",
    "lbl-corrected-text": "修正為",
    "placeholder-corrected": "在此輸入正確的內容...",
    "btn-learn": "學習",
    "btn-learn-success": "已學習！",
    "btn-apply-learning": "儲存學習規則",
    "credits-text-learning": "設計者：Travis Au | 電郵：contact@travis-studio.com",
    "title-backup": "💾 資料備份與移轉",
    "lbl-backup-desc": "您可以匯出所有的系統設定、啟動快速鍵、以及自定義學習詞彙與修正對照表。在新電腦上匯入即可無縫接軌！",
    "btn-export": "匯出資料 / Export Data",
    "btn-import": "匯入資料 / Import Data"
  },
  en: {
    "tab-settings": "⚙️ Settings",
    "tab-logs": "🖥️ Engine Logs",
    "title-hotkey": "⌨️ Hotkey Settings",
    "lbl-hotkey": "Activation Key",
    "lbl-hotkey-mode": "Press Mode",
    "opt-mode-hold": "Hold to Record",
    "opt-mode-toggle": "Click to Toggle",
    "lbl-sound-mode": "Sound Effects",
    "opt-sound-modern": "Modern Synth (New)",
    "opt-sound-retro": "Retro Beeps (Old)",
    "opt-sound-off": "Muted (Silent)",
    "lbl-app-language": "UI Language",
    "title-engine": "🧠 AI Engine Settings",
    "lbl-cantonese-title": "Cantonese Mode (廣東話)",
    "lbl-cantonese-desc": "Preserves spoken Cantonese vocabulary",
    "lbl-device-select": "Device",
    "opt-device-cpu": "CPU (High Compatibility)",
    "opt-device-cuda": "NVIDIA GPU (Requires CUDA)",
    "lbl-model-select": "AI Model",
    "lbl-chinese-output": "Text Output format",
    "opt-chinese-tw": "Traditional Chinese (繁體中文)",
    "opt-chinese-cn": "Simplified Chinese (简体中文)",
    "opt-chinese-none": "No Conversion",
    "lbl-storage-path": "Storage Path",
    "placeholder-storage": "Default (AppData)",
    "btn-browse": "Browse...",
    "btn-apply": "Save Settings",
    "btn-apply-saving": "Saving...",
    "btn-apply-success": "Saved Successfully!",
    "btn-apply-failed": "Save Failed",
    "credits-text": "Designed by Travis Au | Email: contact@travis-studio.com",
    "title-logs": "🖥️ Engine Status Logs",
    "setup-title": "🎙️ VoiceInput Setup Wizard",
    "setup-desc": "Welcome! We need to download the AI Engine and Model files. They will be stored in your storage path.",
    "setup-engine-title": "AI Engine (CPU Edition)",
    "setup-model-title": "AI Model (Large-v3 quantized)",
    "btn-download": "Download & Setup",
    "btn-download-setting-up": "Setting up...",
    "btn-download-retry": "Retry Setup",
    "btn-download-all-set": "All Set! Starting Engine...",
    "status-checking": "Checking...",
    "status-missing": "Missing",
    "status-installed": "Installed",
    "status-downloading": "Downloading...",
    "status-extracting": "Extracting...",
    "status-ready": "Ready",
    "status-recording": "Recording...",
    "status-processing": "Processing...",
    "status-transcribing": "Transcribing...",
    "title-learning": "📝 AI Learning & Correction",
    "lbl-setup-storage": "Storage Folder Path",
    "btn-setup-tab-download": "🚀 Online Download (Recommended)",
    "btn-setup-tab-import": "📂 Local File Import (Offline)",
    "lbl-import-engine": "Voice Engine Archive (whisper-server-cpu.zip)",
    "lbl-import-model": "Voice Model File (ggml-large-v3-q5_0.bin)",
    "btn-install-import": "Import & Install",
    "lbl-setup-engine-select": "AI Engine Edition",
    "opt-setup-cpu": "CPU Edition (Highly Compatible, 4.4MB)",
    "opt-setup-cuda": "NVIDIA GPU Edition (CUDA, requires NVIDIA GPU)",
    "lbl-custom-prompt": "Custom Vocabulary Prompt",
    "lbl-custom-prompt-desc": "Teach Whisper new words by listing them here (comma separated)",
    "lbl-text-replacements": "Text Replacements",
    "lbl-text-replacements-desc": "Correct persistent mistakes automatically (one rule per line: wrong -> correct)",
    "tab-learning": "📝 Learning",
    "title-correct-last": "✏️ Correct Last Transcription",
    "lbl-last-transcription": "Last Transcription",
    "lbl-corrected-text": "Corrected Text",
    "placeholder-corrected": "Make corrections here...",
    "btn-learn": "Learn",
    "btn-learn-success": "Learned!",
    "btn-apply-learning": "Save Learning Rules",
    "credits-text-learning": "Designed by Travis Au | Email: contact@travis-studio.com",
    "title-backup": "💾 Data Backup & Migration",
    "lbl-backup-desc": "Export all system configurations, hotkeys, custom vocabulary prompts, and text replacement rules to migrate them to a new computer, or import them back.",
    "btn-export": "Export Data",
    "btn-import": "Import Data"
  }
};

function updateUILanguage(lang: string) {
  const dict = translations[lang] || translations["zh"];
  
  // Set tab buttons text
  const settingsTabBtn = document.querySelector('button[data-tab="settings-tab"]') as HTMLButtonElement;
  if (settingsTabBtn) {
    settingsTabBtn.innerHTML = `<span>⚙️</span> ${dict["tab-settings"].substring(2)}`;
  }
  const logsTabBtn = document.querySelector('button[data-tab="logs-tab"]') as HTMLButtonElement;
  if (logsTabBtn) {
    logsTabBtn.innerHTML = `<span>🖥️</span> ${dict["tab-logs"].substring(2)}`;
  }

  // Set group titles
  const hotkeyH2 = document.querySelector('.settings-grid .setting-group:nth-of-type(1) h2') as HTMLHeadingElement;
  if (hotkeyH2) {
    hotkeyH2.innerHTML = `<span class="icon">⌨️</span> ${dict["title-hotkey"].substring(2)}`;
  }
  const engineH2 = document.querySelector('.settings-grid .setting-group:nth-of-type(2) h2') as HTMLHeadingElement;
  if (engineH2) {
    engineH2.innerHTML = `<span class="icon">🧠</span> ${dict["title-engine"].substring(2)}`;
  }

  // Set labels
  const lblHotkey = document.getElementById("lbl-hotkey");
  if (lblHotkey) lblHotkey.textContent = dict["lbl-hotkey"];
  const lblHotkeyMode = document.getElementById("lbl-hotkey-mode");
  if (lblHotkeyMode) lblHotkeyMode.textContent = dict["lbl-hotkey-mode"];
  const lblSoundMode = document.getElementById("lbl-sound-mode");
  if (lblSoundMode) lblSoundMode.textContent = dict["lbl-sound-mode"];
  const lblAppLanguage = document.getElementById("lbl-app-language");
  if (lblAppLanguage) lblAppLanguage.textContent = dict["lbl-app-language"];
  
  const lblCantoneseTitle = document.getElementById("lbl-cantonese-title");
  if (lblCantoneseTitle) lblCantoneseTitle.textContent = dict["lbl-cantonese-title"];
  const lblCantoneseDesc = document.getElementById("lbl-cantonese-desc");
  if (lblCantoneseDesc) lblCantoneseDesc.textContent = dict["lbl-cantonese-desc"];
  
  const lblDeviceSelect = document.getElementById("lbl-device-select");
  if (lblDeviceSelect) lblDeviceSelect.textContent = dict["lbl-device-select"];
  
  const lblModelSelect = document.getElementById("lbl-model-select");
  if (lblModelSelect) lblModelSelect.textContent = dict["lbl-model-select"];
  const lblChineseOutput = document.getElementById("lbl-chinese-output");
  if (lblChineseOutput) lblChineseOutput.textContent = dict["lbl-chinese-output"];
  const lblStoragePath = document.getElementById("lbl-storage-path");
  if (lblStoragePath) lblStoragePath.textContent = dict["lbl-storage-path"];

  const learningTabBtn = document.querySelector('button[data-tab="learning-tab"]') as HTMLButtonElement;
  if (learningTabBtn) {
    learningTabBtn.innerHTML = `<span>📝</span> ${dict["tab-learning"].substring(2)}`;
  }

  const learningH2 = document.querySelector('#learning-tab .setting-group:nth-of-type(2) h2') as HTMLHeadingElement;
  if (learningH2) {
    learningH2.innerHTML = `<span class="icon">📝</span> ${dict["title-learning"].substring(2)}`;
  }
  
  const lblCustomPrompt = document.getElementById("lbl-custom-prompt");
  if (lblCustomPrompt) lblCustomPrompt.textContent = dict["lbl-custom-prompt"];
  const lblCustomPromptDesc = document.getElementById("lbl-custom-prompt-desc");
  if (lblCustomPromptDesc) lblCustomPromptDesc.textContent = dict["lbl-custom-prompt-desc"];
  
  const lblTextReplacements = document.getElementById("lbl-text-replacements");
  if (lblTextReplacements) lblTextReplacements.textContent = dict["lbl-text-replacements"];
  const lblTextReplacementsDesc = document.getElementById("lbl-text-replacements-desc");
  if (lblTextReplacementsDesc) lblTextReplacementsDesc.textContent = dict["lbl-text-replacements-desc"];

  const titleCorrectLast = document.getElementById("title-correct-last");
  if (titleCorrectLast) titleCorrectLast.innerHTML = `<span class="icon">✏️</span> ${dict["title-correct-last"].substring(2)}`;
  const lblLastTranscription = document.getElementById("lbl-last-transcription");
  if (lblLastTranscription) lblLastTranscription.textContent = dict["lbl-last-transcription"];
  const lblCorrectedText = document.getElementById("lbl-corrected-text");
  if (lblCorrectedText) lblCorrectedText.textContent = dict["lbl-corrected-text"];
  
  if (correctedTextInput) correctedTextInput.placeholder = dict["placeholder-corrected"];
  if (learnBtn) learnBtn.textContent = dict["btn-learn"];
  if (applyLearningBtn) applyLearningBtn.textContent = dict["btn-apply-learning"];

  const creditsTextLearning = document.getElementById("credits-text-learning");
  if (creditsTextLearning) creditsTextLearning.textContent = dict["credits-text-learning"];

  const titleBackup = document.getElementById("title-backup");
  if (titleBackup) titleBackup.innerHTML = `<span class="icon">💾</span> ${dict["title-backup"].substring(2)}`;
  const lblBackupDesc = document.getElementById("lbl-backup-desc");
  if (lblBackupDesc) lblBackupDesc.textContent = dict["lbl-backup-desc"];
  if (exportConfigBtn) exportConfigBtn.textContent = dict["btn-export"];
  if (importConfigBtn) importConfigBtn.textContent = dict["btn-import"];

  // Set placeholders and buttons
  const storagePathInput = document.getElementById("storage-path") as HTMLInputElement;
  if (storagePathInput) storagePathInput.placeholder = dict["placeholder-storage"];
  const browseStorageBtn = document.getElementById("browse-storage-btn") as HTMLButtonElement;
  if (browseStorageBtn) browseStorageBtn.textContent = dict["btn-browse"];
  
  const creditsText = document.getElementById("credits-text");
  if (creditsText) creditsText.textContent = dict["credits-text"];
  
  const logsH2 = document.querySelector('.logs-section h2') as HTMLHeadingElement;
  if (logsH2) {
    logsH2.innerHTML = `<span class="icon">🖥️</span> ${dict["title-logs"].substring(2)}`;
  }

  // Set Select options text
  const optModeHold = hotkeyModeSelect.querySelector('option[value="hold"]') as HTMLOptionElement;
  if (optModeHold) optModeHold.textContent = dict["opt-mode-hold"];
  const optModeToggle = hotkeyModeSelect.querySelector('option[value="toggle"]') as HTMLOptionElement;
  if (optModeToggle) optModeToggle.textContent = dict["opt-mode-toggle"];

  const optDeviceCpu = deviceSelect.querySelector('option[value="cpu"]') as HTMLOptionElement;
  if (optDeviceCpu) optDeviceCpu.textContent = dict["opt-device-cpu"];
  const optDeviceCuda = deviceSelect.querySelector('option[value="cuda"]') as HTMLOptionElement;
  if (optDeviceCuda) optDeviceCuda.textContent = dict["opt-device-cuda"];

  const optSoundModern = soundModeSelect.querySelector('option[value="modern"]') as HTMLOptionElement;
  if (optSoundModern) optSoundModern.textContent = dict["opt-sound-modern"];
  const optSoundRetro = soundModeSelect.querySelector('option[value="retro"]') as HTMLOptionElement;
  if (optSoundRetro) optSoundRetro.textContent = dict["opt-sound-retro"];
  const optSoundOff = soundModeSelect.querySelector('option[value="off"]') as HTMLOptionElement;
  if (optSoundOff) optSoundOff.textContent = dict["opt-sound-off"];

  const optChineseTw = chineseOutputSelect.querySelector('option[value="traditional_tw"]') as HTMLOptionElement;
  if (optChineseTw) optChineseTw.textContent = dict["opt-chinese-tw"];
  const optChineseCn = chineseOutputSelect.querySelector('option[value="simplified_cn"]') as HTMLOptionElement;
  if (optChineseCn) optChineseCn.textContent = dict["opt-chinese-cn"];
  const optChineseNone = chineseOutputSelect.querySelector('option[value="none"]') as HTMLOptionElement;
  if (optChineseNone) optChineseNone.textContent = dict["opt-chinese-none"];

  // Setup wizard translation
  const setupTitle = document.querySelector('#setup-overlay h2') as HTMLHeadingElement;
  if (setupTitle) setupTitle.textContent = dict["setup-title"];
  const setupDesc = document.querySelector('#setup-overlay .setup-desc') as HTMLParagraphElement;
  if (setupDesc) setupDesc.textContent = dict["setup-desc"];
  
  const lblSetupStorage = document.getElementById("lbl-setup-storage");
  if (lblSetupStorage) lblSetupStorage.textContent = dict["lbl-setup-storage"];
  if (setupBrowseStorageBtn) setupBrowseStorageBtn.textContent = dict["btn-browse"];
  
  if (setupTabDownload) setupTabDownload.textContent = dict["btn-setup-tab-download"];
  if (setupTabImport) setupTabImport.textContent = dict["btn-setup-tab-import"];
  
  const lblSetupEngineSelect = document.getElementById("lbl-setup-engine-select");
  if (lblSetupEngineSelect) lblSetupEngineSelect.textContent = dict["lbl-setup-engine-select"];
  if (setupEngineSelect) {
    const optSetupCpu = setupEngineSelect.querySelector('option[value="cpu"]') as HTMLOptionElement;
    if (optSetupCpu) optSetupCpu.textContent = dict["opt-setup-cpu"];
    const optSetupCuda = setupEngineSelect.querySelector('option[value="cuda"]') as HTMLOptionElement;
    if (optSetupCuda) optSetupCuda.textContent = dict["opt-setup-cuda"];
  }
  
  const lblImportEngine = document.getElementById("lbl-import-engine");
  if (lblImportEngine) lblImportEngine.textContent = dict["lbl-import-engine"];
  if (importBrowseEngineBtn) importBrowseEngineBtn.textContent = dict["btn-browse"];
  
  const lblImportModel = document.getElementById("lbl-import-model");
  if (lblImportModel) lblImportModel.textContent = dict["lbl-import-model"];
  if (importBrowseModelBtn) importBrowseModelBtn.textContent = dict["btn-browse"];
  
  const startImportBtnEl = document.getElementById("start-import-btn") as HTMLButtonElement;
  if (startImportBtnEl && !startImportBtnEl.disabled) {
    startImportBtnEl.textContent = dict["btn-install-import"];
  }
  
  const depEngineTitle = document.querySelector('#dep-engine .dep-title') as HTMLSpanElement;
  if (depEngineTitle) {
    if (setupEngineSelect && setupEngineSelect.value === "cuda") {
      depEngineTitle.textContent = lang === "zh" ? "AI 語音引擎 (CUDA版本)" : "AI Engine (CUDA Edition)";
    } else {
      depEngineTitle.textContent = dict["setup-engine-title"];
    }
  }
  const depModelTitle = document.querySelector('#dep-model .dep-title') as HTMLSpanElement;
  if (depModelTitle) depModelTitle.textContent = dict["setup-model-title"];
  
  const startBtn = document.getElementById("start-download-btn") as HTMLButtonElement;
  if (startBtn && !startBtn.disabled) {
    startBtn.textContent = dict["btn-download"];
  }
}

async function loadConfig() {
  try {
    currentConfig = await invoke<Config>("get_config");
    console.log("Loaded config:", currentConfig);
    
    if (currentConfig) {
      hotkeyInput.value = currentConfig.hotkey;
      hotkeyModeSelect.value = currentConfig.hotkey_mode;
      soundModeSelect.value = currentConfig.sound_mode;
      appLanguageSelect.value = currentConfig.app_language;
      cantoneseModeToggle.checked = currentConfig.cantonese_mode;
      deviceSelect.value = currentConfig.device || "cpu";
      modelSelect.value = currentConfig.model;
      chineseOutputSelect.value = currentConfig.chinese_output;
      storagePathInput.value = currentConfig.storage_path || "";
      customPromptInput.value = currentConfig.custom_prompt || "";
      textReplacementsInput.value = currentConfig.text_replacements || "";
      
      updateUILanguage(currentConfig.app_language);
    }
  } catch (error) {
    console.error("Failed to load config", error);
  }
}

async function saveConfig() {
  if (!currentConfig) return;

  const newConfig: Config = {
    ...currentConfig,
    hotkey: hotkeyInput.value,
    hotkey_mode: hotkeyModeSelect.value,
    sound_mode: soundModeSelect.value,
    app_language: appLanguageSelect.value,
    cantonese_mode: cantoneseModeToggle.checked,
    device: deviceSelect.value,
    model: modelSelect.value,
    chinese_output: chineseOutputSelect.value,
    storage_path: storagePathInput.value,
    custom_prompt: customPromptInput.value,
    text_replacements: textReplacementsInput.value,
  };

  const dict = translations[newConfig.app_language] || translations["zh"];

  try {
    applyBtn.textContent = dict["btn-apply-saving"];
    applyBtn.disabled = true;
    
    await invoke("set_config", { newConfig });
    
    applyBtn.textContent = dict["btn-apply-success"];
    setTimeout(() => {
      applyBtn.textContent = dict["btn-apply"];
      applyBtn.disabled = false;
    }, 2000);
    
    currentConfig = newConfig;
    updateUILanguage(newConfig.app_language);
    runDependencyChecks();
  } catch (error) {
    console.error("Failed to save config", error);
    applyBtn.textContent = dict["btn-apply-failed"];
    setTimeout(() => {
      applyBtn.textContent = dict["btn-apply"];
      applyBtn.disabled = false;
    }, 2000);
  }
}

async function runDependencyChecks() {
  const overlay = document.getElementById("setup-overlay") as HTMLDivElement;
  const status = await invoke<DependencyStatus>("check_dependencies");
  console.log("Dependency checks:", status);

  const engineStatus = document.getElementById("dep-engine-status") as HTMLSpanElement;
  const modelStatus = document.getElementById("dep-model-status") as HTMLSpanElement;
  const startBtn = document.getElementById("start-download-btn") as HTMLButtonElement;

  const currentLang = appLanguageSelect.value || "zh";
  const dict = translations[currentLang] || translations["zh"];

  if (status.engine_exists && status.model_exists) {
    overlay.classList.add("hidden");
    return;
  }

  updateUILanguage(currentLang);
  overlay.classList.remove("hidden");
  
  engineStatus.textContent = status.engine_exists ? dict["status-installed"] : dict["status-missing"];
  engineStatus.style.color = status.engine_exists ? "var(--accent-green)" : "#ff3c3c";
  if (status.engine_exists) {
    document.getElementById("dep-engine-bar")!.style.width = "100%";
  } else {
    document.getElementById("dep-engine-bar")!.style.width = "0%";
    document.getElementById("dep-engine-text")!.textContent = "";
  }
  
  modelStatus.textContent = status.model_exists ? dict["status-installed"] : dict["status-missing"];
  modelStatus.style.color = status.model_exists ? "var(--accent-green)" : "#ff3c3c";
  if (status.model_exists) {
    document.getElementById("dep-model-bar")!.style.width = "100%";
  } else {
    document.getElementById("dep-model-bar")!.style.width = "0%";
    document.getElementById("dep-model-text")!.textContent = "";
  }

  startBtn.onclick = async () => {
    const freshLang = appLanguageSelect.value || "zh";
    const freshDict = translations[freshLang] || translations["zh"];
    
    startBtn.disabled = true;
    startBtn.textContent = freshDict["btn-download-setting-up"];

    // Read dynamic storage path chosen during setup
    const baseDir = setupStoragePathInput.value.trim() || status.appdata_dir;
    const selectedEngine = setupEngineSelect.value;
    
    // Update config on disk immediately with the selected path & device mode
    if (currentConfig) {
      currentConfig.storage_path = setupStoragePathInput.value.trim();
      currentConfig.device = selectedEngine;
      await invoke("set_config", { newConfig: currentConfig });
    }

    const appDataBin = `${baseDir}\\bin`;
    const appDataModels = `${baseDir}\\models`;
    const tempZip = `${baseDir}\\temp_engine.zip`;
    const modelDest = `${appDataModels}\\ggml-large-v3-q5_0.bin`;

    const download = (url: string, dest: string, eventName: string, barId: string, textId: string) => {
      return new Promise<void>(async (resolve, reject) => {
        const unlisten = await listen<{ downloaded: number; total: number; percentage: number; error?: string; done?: boolean }>(
          eventName,
          (event) => {
            const data = event.payload;
            if (data.error) {
              unlisten();
              reject(data.error);
              return;
            }
            const percentageStr = `${Math.floor(data.percentage)}%`;
            document.getElementById(barId)!.style.width = percentageStr;
            document.getElementById(textId)!.textContent = `${(data.downloaded / 1024 / 1024).toFixed(1)}MB / ${(data.total / 1024 / 1024).toFixed(1)}MB (${percentageStr})`;
            
            if (data.done) {
              unlisten();
              resolve();
            }
          }
        );

        try {
          await invoke("download_dependency", { url, destPath: dest, eventName });
        } catch (err) {
          unlisten();
          reject(err);
        }
      });
    };

    try {
      if (!status.engine_exists) {
        engineStatus.textContent = freshDict["status-downloading"];
        engineStatus.style.color = "var(--accent-blue)";
        
        const engineUrl = selectedEngine === "cuda" 
          ? "https://github.com/travisau/VoiceInput/releases/download/v0.1.0/whisper-server-cuda.zip"
          : "https://github.com/travisau/VoiceInput/releases/download/v0.1.0/whisper-server-cpu.zip";
        
        await download(
          engineUrl,
          tempZip,
          "engine-download-progress",
          "dep-engine-bar",
          "dep-engine-text"
        );

        engineStatus.textContent = freshDict["status-extracting"];
        await invoke("extract_zip", { zipPath: tempZip, destDir: appDataBin });
        engineStatus.textContent = freshDict["status-installed"];
        engineStatus.style.color = "var(--accent-green)";
        document.getElementById("dep-engine-bar")!.style.width = "100%";
      }

      if (!status.model_exists) {
        modelStatus.textContent = freshDict["status-downloading"];
        modelStatus.style.color = "var(--accent-blue)";

        await download(
          "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin",
          modelDest,
          "model-download-progress",
          "dep-model-bar",
          "dep-model-text"
        );

        modelStatus.textContent = freshDict["status-installed"];
        modelStatus.style.color = "var(--accent-green)";
        document.getElementById("dep-model-bar")!.style.width = "100%";
      }

      startBtn.textContent = freshDict["btn-download-all-set"];
      await invoke("start_engine");
      
      setTimeout(() => {
        overlay.classList.add("hidden");
      }, 1500);

    } catch (error) {
      console.error("Setup failed:", error);
      alert(`Setup Failed: ${error}`);
      startBtn.disabled = false;
      startBtn.textContent = freshDict["btn-download-retry"];
    }
  };
}

window.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await loadConfig();
    await runDependencyChecks();
  })();
  
  applyBtn.addEventListener("click", saveConfig);
  applyLearningBtn.addEventListener("click", saveConfig);

  // Setup tab toggling
  if (setupTabDownload && setupTabImport) {
    setupTabDownload.addEventListener("click", () => {
      setupTabDownload.classList.add("active");
      setupTabImport.classList.remove("active");
      methodDownloadContent.classList.add("active");
      methodImportContent.classList.remove("active");
      startDownloadBtn.classList.remove("hidden");
      startImportBtn.classList.add("hidden");
    });

    setupTabImport.addEventListener("click", () => {
      setupTabImport.classList.add("active");
      setupTabDownload.classList.remove("active");
      methodImportContent.classList.add("active");
      methodDownloadContent.classList.remove("active");
      startImportBtn.classList.remove("hidden");
      startDownloadBtn.classList.add("hidden");
    });
  }

  if (setupEngineSelect) {
    setupEngineSelect.addEventListener("change", () => {
      const currentLang = appLanguageSelect.value || "zh";
      updateUILanguage(currentLang);
    });
  }

  // Setup browse storage
  if (setupBrowseStorageBtn) {
    setupBrowseStorageBtn.addEventListener("click", async () => {
      try {
        const selected = await invoke<string | null>("select_directory");
        if (selected) {
          setupStoragePathInput.value = selected;
        }
      } catch (err) {
        console.error("Failed to select setup storage:", err);
      }
    });
  }

  // Local files browsing
  if (importBrowseEngineBtn) {
    importBrowseEngineBtn.addEventListener("click", async () => {
      try {
        const selected = await invoke<string | null>("select_file", {
          filtersName: "Zip Files",
          extensions: ["zip"]
        });
        if (selected) {
          importEnginePath.value = selected;
        }
      } catch (err) {
        console.error("Failed to select engine zip:", err);
      }
    });
  }

  if (importBrowseModelBtn) {
    importBrowseModelBtn.addEventListener("click", async () => {
      try {
        const selected = await invoke<string | null>("select_file", {
          filtersName: "Model Files",
          extensions: ["bin"]
        });
        if (selected) {
          importModelPath.value = selected;
        }
      } catch (err) {
        console.error("Failed to select model bin:", err);
      }
    });
  }

  // Local import trigger
  if (startImportBtn) {
    startImportBtn.addEventListener("click", async () => {
      const engineZip = importEnginePath.value.trim();
      const modelBin = importModelPath.value.trim();
      const storagePath = setupStoragePathInput.value.trim();
      const currentLang = appLanguageSelect.value || "zh";
      const dict = translations[currentLang] || translations["zh"];
      const overlay = document.getElementById("setup-overlay") as HTMLDivElement;

      if (!engineZip && !modelBin) {
        alert(currentLang === "zh" ? "請至少選擇要匯入的引擎或模型檔案！" : "Please select at least one file to import!");
        return;
      }

      startImportBtn.disabled = true;
      startImportBtn.textContent = dict["btn-install-import-loading"] || "Importing...";

      try {
        await invoke("import_local_dependencies", {
          engineZipPath: engineZip || null,
          modelBinPath: modelBin || null,
          storagePath: storagePath || null
        });
        
        startImportBtn.textContent = dict["btn-install-import-success"] || "Finished!";
        setTimeout(() => {
          overlay.classList.add("hidden");
        }, 1500);
      } catch (err) {
        console.error("Local import failed:", err);
        alert(`Import Failed: ${err}`);
        startImportBtn.disabled = false;
        startImportBtn.textContent = currentLang === "zh" ? "重試匯入" : "Retry Import";
      }
    });
  }
  
  function extractDifference(original: string, corrected: string) {
    if (original === corrected) return null;
    
    let prefixLen = 0;
    while (prefixLen < original.length && prefixLen < corrected.length && original[prefixLen] === corrected[prefixLen]) {
      prefixLen++;
    }
    
    let suffixLen = 0;
    while (
      suffixLen < original.length - prefixLen && 
      suffixLen < corrected.length - prefixLen && 
      original[original.length - 1 - suffixLen] === corrected[corrected.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }
    
    const wrong = original.substring(prefixLen, original.length - suffixLen).trim();
    const correct = corrected.substring(prefixLen, corrected.length - suffixLen).trim();
    
    if (wrong && correct) {
      return { wrong, correct };
    }
    return null;
  }

  learnBtn.addEventListener("click", async () => {
    const correctedVal = correctedTextInput.value.trim();
    const currentLang = currentConfig?.app_language || "zh";
    const dict = translations[currentLang] || translations["zh"];

    if (!lastTransText) {
      alert(currentLang === "zh" ? "尚未輸入任何句子！" : "No sentence transcribed yet!");
      return;
    }

    if (!correctedVal || correctedVal === lastTransText) {
      return;
    }

    const diff = extractDifference(lastTransText, correctedVal);
    if (diff) {
      const { wrong, correct } = diff;
      let existingReplacements = textReplacementsInput.value.trim();
      const newRule = `${wrong} -> ${correct}`;
      
      if (existingReplacements) {
        existingReplacements = existingReplacements + "\n" + newRule;
      } else {
        existingReplacements = newRule;
      }
      
      textReplacementsInput.value = existingReplacements;
      await saveConfig();
      
      const oldText = learnBtn.textContent;
      learnBtn.textContent = dict["btn-learn-success"] || "Learned!";
      learnBtn.disabled = true;
      setTimeout(() => {
        learnBtn.textContent = oldText;
        learnBtn.disabled = false;
      }, 1500);
    } else {
      let existingReplacements = textReplacementsInput.value.trim();
      const newRule = `${lastTransText} -> ${correctedVal}`;
      if (existingReplacements) {
        existingReplacements = existingReplacements + "\n" + newRule;
      } else {
        existingReplacements = newRule;
      }
      textReplacementsInput.value = existingReplacements;
      await saveConfig();
      
      const oldText = learnBtn.textContent;
      learnBtn.textContent = dict["btn-learn-success"] || "Learned!";
      learnBtn.disabled = true;
      setTimeout(() => {
        learnBtn.textContent = oldText;
        learnBtn.disabled = false;
      }, 1500);
    }
  });
  
  browseStorageBtn.addEventListener("click", async () => {
    try {
      const selected = await invoke<string | null>("select_directory");
      if (selected) {
        storagePathInput.value = selected;
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  });

  if (exportConfigBtn) {
    exportConfigBtn.addEventListener("click", async () => {
      if (!currentConfig) return;
      const currentLang = appLanguageSelect.value || "zh";
      
      const latestConfig: Config = {
        ...currentConfig,
        hotkey: hotkeyInput.value,
        hotkey_mode: hotkeyModeSelect.value,
        sound_mode: soundModeSelect.value,
        app_language: appLanguageSelect.value,
        cantonese_mode: cantoneseModeToggle.checked,
        device: deviceSelect.value,
        model: modelSelect.value,
        chinese_output: chineseOutputSelect.value,
        storage_path: storagePathInput.value,
        custom_prompt: customPromptInput.value,
        text_replacements: textReplacementsInput.value,
      };

      try {
        const jsonStr = JSON.stringify(latestConfig, null, 2);
        await invoke("export_config_file", { configJson: jsonStr });
        alert(currentLang === "zh" ? "匯出設定及學習資料成功！" : "Settings exported successfully!");
      } catch (err) {
        console.error("Export config failed:", err);
        if (err !== "Export cancelled by user") {
          alert(`Export failed: ${err}`);
        }
      }
    });
  }

  if (importConfigBtn) {
    importConfigBtn.addEventListener("click", async () => {
      const currentLang = appLanguageSelect.value || "zh";
      try {
        const importedConfig = await invoke<Config>("import_config_file");
        
        hotkeyInput.value = importedConfig.hotkey;
        hotkeyModeSelect.value = importedConfig.hotkey_mode;
        soundModeSelect.value = importedConfig.sound_mode;
        appLanguageSelect.value = importedConfig.app_language;
        cantoneseModeToggle.checked = importedConfig.cantonese_mode;
        deviceSelect.value = importedConfig.device || "cpu";
        modelSelect.value = importedConfig.model;
        chineseOutputSelect.value = importedConfig.chinese_output;
        storagePathInput.value = importedConfig.storage_path || "";
        customPromptInput.value = importedConfig.custom_prompt || "";
        textReplacementsInput.value = importedConfig.text_replacements || "";

        currentConfig = importedConfig;
        await saveConfig();
        alert(currentLang === "zh" ? "匯入設定及學習資料成功！" : "Settings imported successfully!");
      } catch (err) {
        console.error("Import config failed:", err);
        if (err !== "Import cancelled by user") {
          alert(`Import failed: ${err}`);
        }
      }
    });
  }
  
  // Tab Switching Logic
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(targetTab!)?.classList.add("active");
    });
  });
  
  const logsContainer = document.getElementById("logs-container") as HTMLDivElement;

  // Function to append a log line to UI
  function appendLogLine(line: string) {
    const lineEl = document.createElement("div");
    lineEl.className = "log-line";
    
    // Highlight errors/warnings
    if (line.includes("[CRITICAL ERROR]") || line.includes("Failed") || line.includes("Error")) {
      lineEl.style.color = "#ff3c3c";
    } else if (line.includes("Starting") || line.includes("Whisper server")) {
      lineEl.style.color = "var(--accent-blue)";
    } else if (line.includes("Transcription:")) {
      lineEl.style.color = "var(--accent-green)";
    }
    
    lineEl.textContent = line;
    logsContainer.appendChild(lineEl);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // Load historical logs
  async function loadHistoricalLogs() {
    try {
      logsContainer.innerHTML = ""; // Clear loader
      const logs = await invoke<string[]>("get_logs");
      if (logs && logs.length > 0) {
        logs.forEach(appendLogLine);
      } else {
        const emptyEl = document.createElement("div");
        emptyEl.className = "log-line system-msg";
        emptyEl.textContent = "Engine logs initialized. Awaiting process launch...";
        logsContainer.appendChild(emptyEl);
      }
    } catch (e) {
      console.error("Failed to load historical logs:", e);
    }
  }

  loadHistoricalLogs();

  // Listen for real-time log events
  listen<string>("whisper-log", (event) => {
    appendLogLine(event.payload);
    
    // Clean up if logs get too long (keep last 200 lines)
    while (logsContainer.children.length > 200) {
      logsContainer.removeChild(logsContainer.firstChild!);
    }
  });

  // Listen for successful transcription
  listen<string>("transcription-complete", (event) => {
    lastTransText = event.payload;
    if (lastTranscriptionText) {
      lastTranscriptionText.textContent = event.payload;
      lastTranscriptionText.style.color = "var(--text-primary)";
    }
    if (correctedTextInput) {
      correctedTextInput.value = event.payload;
    }
  });
});
