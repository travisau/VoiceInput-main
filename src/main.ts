import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
  show_settings_on_startup: boolean;
}

interface DependencyStatus {
  engine_exists: boolean;
  model_exists: boolean;
  appdata_dir: string;
  appdata_engine_exists: boolean;
  vulkan_exists?: boolean;
  appdata_vulkan_exists?: boolean;
  cuda_exists?: boolean;
  appdata_cuda_exists?: boolean;
}

function isEngineInstalled(status: DependencyStatus, engine: string): boolean {
  if (engine === "amd") {
    return status.engine_exists && !!status.vulkan_exists;
  }
  if (engine === "cuda") {
    return status.appdata_engine_exists && !!status.appdata_cuda_exists;
  }
  return status.engine_exists;
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
const showSettingsOnStartupToggle = document.getElementById("show-settings-on-startup") as HTMLInputElement;
const startAtLoginToggle = document.getElementById("start-at-login") as HTMLInputElement;
const cpuThreadsSelect = document.getElementById("cpu-threads-select") as HTMLSelectElement;

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
const reinstallWizardBtn = document.getElementById("reinstall-wizard-btn") as HTMLButtonElement;
const setupCheckModelBtn = document.getElementById("setup-check-model-btn") as HTMLButtonElement;
const setupCheckEngineBtn = document.getElementById("setup-check-engine-btn") as HTMLButtonElement;
const setupRemoveCudaBtn = document.getElementById("setup-remove-cuda-btn") as HTMLButtonElement;
const setupCloseBtn = document.getElementById("setup-close-btn") as HTMLButtonElement;

let lastTransText = "";

function showCustomAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.background = "rgba(0, 0, 0, 0.6)";
    modalOverlay.style.backdropFilter = "blur(15px)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.zIndex = "99999";
    modalOverlay.style.animation = "fadeIn 0.2s ease";

    const modalBox = document.createElement("div");
    modalBox.style.width = "85%";
    modalBox.style.maxWidth = "380px";
    modalBox.style.background = "var(--panel-bg)";
    modalBox.style.border = "1px solid var(--panel-border)";
    modalBox.style.borderRadius = "16px";
    modalBox.style.padding = "24px";
    modalBox.style.boxShadow = "0 24px 40px rgba(0,0,0,0.5)";
    modalBox.style.textAlign = "center";
    modalBox.style.transform = "scale(0.9)";
    modalBox.style.transition = "transform 0.2s ease";

    const textEl = document.createElement("p");
    textEl.style.fontSize = "14px";
    textEl.style.color = "var(--text-primary)";
    textEl.style.lineHeight = "1.6";
    textEl.style.margin = "0 0 20px 0";
    textEl.style.whiteSpace = "pre-wrap";
    textEl.style.wordBreak = "break-all";
    textEl.style.overflowWrap = "break-word";
    textEl.textContent = message;

    const okBtn = document.createElement("button");
    okBtn.className = "primary-btn";
    okBtn.style.width = "100%";
    okBtn.style.padding = "10px 0";
    okBtn.style.fontSize = "14px";
    okBtn.style.cursor = "pointer";
    okBtn.textContent = currentConfig?.app_language === "zh" ? "確定" : "OK";

    modalBox.appendChild(textEl);
    modalBox.appendChild(okBtn);
    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    setTimeout(() => {
      modalBox.style.transform = "scale(1)";
    }, 10);

    const closeHandler = () => {
      modalBox.style.transform = "scale(0.9)";
      modalOverlay.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
        resolve();
      }, 200);
    };

    okBtn.addEventListener("click", closeHandler);
  });
}

function showCustomConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.background = "rgba(0, 0, 0, 0.6)";
    modalOverlay.style.backdropFilter = "blur(15px)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.zIndex = "99999";
    modalOverlay.style.animation = "fadeIn 0.2s ease";

    const modalBox = document.createElement("div");
    modalBox.style.width = "85%";
    modalBox.style.maxWidth = "380px";
    modalBox.style.background = "var(--panel-bg)";
    modalBox.style.border = "1px solid var(--panel-border)";
    modalBox.style.borderRadius = "16px";
    modalBox.style.padding = "24px";
    modalBox.style.boxShadow = "0 24px 40px rgba(0,0,0,0.5)";
    modalBox.style.textAlign = "center";
    modalBox.style.transform = "scale(0.9)";
    modalBox.style.transition = "transform 0.2s ease";

    const textEl = document.createElement("p");
    textEl.style.fontSize = "14px";
    textEl.style.color = "var(--text-primary)";
    textEl.style.lineHeight = "1.6";
    textEl.style.margin = "0 0 20px 0";
    textEl.style.whiteSpace = "pre-wrap";
    textEl.textContent = message;

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "secondary-btn";
    cancelBtn.style.flex = "1";
    cancelBtn.style.padding = "10px 0";
    cancelBtn.style.fontSize = "14px";
    cancelBtn.style.margin = "0";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.textContent = currentConfig?.app_language === "zh" ? "取消" : "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "primary-btn";
    confirmBtn.style.flex = "1";
    confirmBtn.style.padding = "10px 0";
    confirmBtn.style.fontSize = "14px";
    confirmBtn.style.margin = "0";
    confirmBtn.style.cursor = "pointer";
    confirmBtn.textContent = currentConfig?.app_language === "zh" ? "確定" : "OK";

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(confirmBtn);
    modalBox.appendChild(textEl);
    modalBox.appendChild(btnGroup);
    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    setTimeout(() => {
      modalBox.style.transform = "scale(1)";
    }, 10);

    const closeHandler = (result: boolean) => {
      modalBox.style.transform = "scale(0.9)";
      modalOverlay.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
        resolve(result);
      }, 200);
    };

    cancelBtn.addEventListener("click", () => closeHandler(false));
    confirmBtn.addEventListener("click", () => closeHandler(true));
  });
}

interface LearningModalOptions {
  initialWrong: string;
  initialCorrect: string;
  fullOriginal: string;
  fullCorrected: string;
  appLanguage: string;
}

interface LearningModalResult {
  wrong: string;
  correct: string;
  addReplacement: boolean;
  addVocabulary: boolean;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showLearningWordEditModal(options: LearningModalOptions): Promise<LearningModalResult | null> {
  return new Promise((resolve) => {
    const isZh = options.appLanguage === "zh";

    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.background = "rgba(0, 0, 0, 0.65)";
    modalOverlay.style.backdropFilter = "blur(12px)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.zIndex = "99999";
    modalOverlay.style.animation = "fadeIn 0.2s ease";

    const modalBox = document.createElement("div");
    modalBox.style.width = "90%";
    modalBox.style.maxWidth = "460px";
    modalBox.style.background = "var(--panel-bg, #1e1e2d)";
    modalBox.style.border = "1px solid var(--panel-border, #323248)";
    modalBox.style.borderRadius = "16px";
    modalBox.style.padding = "24px";
    modalBox.style.boxShadow = "0 24px 48px rgba(0,0,0,0.6)";
    modalBox.style.textAlign = "left";
    modalBox.style.transform = "scale(0.95)";
    modalBox.style.transition = "transform 0.2s ease";

    const titleEl = document.createElement("h3");
    titleEl.style.fontSize = "16px";
    titleEl.style.fontWeight = "600";
    titleEl.style.color = "var(--text-primary, #ffffff)";
    titleEl.style.margin = "0 0 6px 0";
    titleEl.style.display = "flex";
    titleEl.style.alignItems = "center";
    titleEl.style.gap = "8px";
    titleEl.innerHTML = `<span>📝</span> ${isZh ? "字詞學習與前後文微調" : "Learn & Adjust Word / Phrase"}`;

    const descEl = document.createElement("p");
    descEl.style.fontSize = "12px";
    descEl.style.color = "var(--text-secondary, #a0a0b8)";
    descEl.style.lineHeight = "1.5";
    descEl.style.margin = "0 0 16px 0";
    descEl.textContent = isZh
      ? "廣東話建議以完整「字詞/短語」進行學習，避免單字誤替換。您可在下方手動調整前後字詞範圍："
      : "For Cantonese speech, learning full words/phrases prevents single-character misreplacements. Adjust the word range below:";

    const previewContainer = document.createElement("div");
    previewContainer.style.background = "rgba(0, 0, 0, 0.25)";
    previewContainer.style.borderRadius = "10px";
    previewContainer.style.padding = "10px 14px";
    previewContainer.style.marginBottom = "16px";
    previewContainer.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    previewContainer.style.fontSize = "12px";

    const origPrev = document.createElement("div");
    origPrev.style.color = "var(--text-secondary, #aaa)";
    origPrev.style.marginBottom = "4px";
    origPrev.innerHTML = `<strong style="color:#ff6b6b">${isZh ? "原本辨識：" : "Original:"}</strong> ${escapeHtml(options.fullOriginal)}`;

    const corrPrev = document.createElement("div");
    corrPrev.style.color = "var(--text-primary, #fff)";
    corrPrev.innerHTML = `<strong style="color:#51cf66">${isZh ? "修正句子：" : "Corrected:"}</strong> ${escapeHtml(options.fullCorrected)}`;

    previewContainer.appendChild(origPrev);
    previewContainer.appendChild(corrPrev);

    const formGroup = document.createElement("div");
    formGroup.style.display = "flex";
    formGroup.style.flexDirection = "column";
    formGroup.style.gap = "12px";
    formGroup.style.marginBottom = "16px";

    const wrongWrapper = document.createElement("div");
    const wrongLabel = document.createElement("label");
    wrongLabel.style.fontSize = "12px";
    wrongLabel.style.fontWeight = "500";
    wrongLabel.style.color = "var(--text-secondary, #aaa)";
    wrongLabel.style.marginBottom = "4px";
    wrongLabel.style.display = "block";
    wrongLabel.textContent = isZh ? "原本聽錯的字詞（可連同前後文一同修改）：" : "Original Wrong Word/Phrase (or with context):";

    const wrongInput = document.createElement("input");
    wrongInput.type = "text";
    wrongInput.value = options.initialWrong;
    wrongInput.style.width = "100%";
    wrongInput.style.padding = "8px 12px";
    wrongInput.style.fontSize = "13px";
    wrongInput.style.borderRadius = "8px";
    wrongInput.style.border = "1px solid var(--panel-border, #444)";
    wrongInput.style.background = "rgba(255,255,255,0.05)";
    wrongInput.style.color = "var(--text-primary, #fff)";
    wrongInput.style.boxSizing = "border-box";
    wrongWrapper.appendChild(wrongLabel);
    wrongWrapper.appendChild(wrongInput);

    const correctWrapper = document.createElement("div");
    const correctLabel = document.createElement("label");
    correctLabel.style.fontSize = "12px";
    correctLabel.style.fontWeight = "500";
    correctLabel.style.color = "var(--text-secondary, #aaa)";
    correctLabel.style.marginBottom = "4px";
    correctLabel.style.display = "block";
    correctLabel.textContent = isZh ? "修正後的正確字詞（可連同前後文一同修改）：" : "Corrected Word/Phrase (or with context):";

    const correctInput = document.createElement("input");
    correctInput.type = "text";
    correctInput.value = options.initialCorrect;
    correctInput.style.width = "100%";
    correctInput.style.padding = "8px 12px";
    correctInput.style.fontSize = "13px";
    correctInput.style.borderRadius = "8px";
    correctInput.style.border = "1px solid var(--panel-border, #444)";
    correctInput.style.background = "rgba(255,255,255,0.05)";
    correctInput.style.color = "var(--text-primary, #fff)";
    correctInput.style.boxSizing = "border-box";
    correctWrapper.appendChild(correctLabel);
    correctWrapper.appendChild(correctInput);

    formGroup.appendChild(wrongWrapper);
    formGroup.appendChild(correctWrapper);

    const scopeContainer = document.createElement("div");
    scopeContainer.style.display = "flex";
    scopeContainer.style.flexDirection = "column";
    scopeContainer.style.gap = "8px";
    scopeContainer.style.marginBottom = "20px";
    scopeContainer.style.padding = "10px 12px";
    scopeContainer.style.background = "rgba(255,255,255,0.03)";
    scopeContainer.style.borderRadius = "8px";
    scopeContainer.style.border = "1px solid rgba(255,255,255,0.05)";

    const chkReplLabel = document.createElement("label");
    chkReplLabel.style.display = "flex";
    chkReplLabel.style.alignItems = "center";
    chkReplLabel.style.gap = "8px";
    chkReplLabel.style.fontSize = "12px";
    chkReplLabel.style.color = "var(--text-primary, #fff)";
    chkReplLabel.style.cursor = "pointer";

    const chkRepl = document.createElement("input");
    chkRepl.type = "checkbox";
    chkRepl.checked = true;
    chkReplLabel.appendChild(chkRepl);
    chkReplLabel.appendChild(document.createTextNode(isZh ? "加入「字詞自動替換對照表」(放至最頂部)" : "Add to Auto Text Replacements (placed at top)"));

    const chkVocabLabel = document.createElement("label");
    chkVocabLabel.style.display = "flex";
    chkVocabLabel.style.alignItems = "center";
    chkVocabLabel.style.gap = "8px";
    chkVocabLabel.style.fontSize = "12px";
    chkVocabLabel.style.color = "var(--text-primary, #fff)";
    chkVocabLabel.style.cursor = "pointer";

    const chkVocab = document.createElement("input");
    chkVocab.type = "checkbox";
    chkVocab.checked = true;
    chkVocabLabel.appendChild(chkVocab);
    chkVocabLabel.appendChild(document.createTextNode(isZh ? "加入 Whisper 常用詞彙 Prompt (放至最頂部)" : "Add to Whisper Custom Vocabulary (placed at top)"));

    scopeContainer.appendChild(chkReplLabel);
    scopeContainer.appendChild(chkVocabLabel);

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "10px";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "secondary-btn";
    cancelBtn.style.flex = "1";
    cancelBtn.style.padding = "9px 0";
    cancelBtn.style.fontSize = "13px";
    cancelBtn.style.margin = "0";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.textContent = isZh ? "取消" : "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.className = "primary-btn";
    saveBtn.style.flex = "1.5";
    saveBtn.style.padding = "9px 0";
    saveBtn.style.fontSize = "13px";
    saveBtn.style.margin = "0";
    saveBtn.style.cursor = "pointer";
    saveBtn.textContent = isZh ? "儲存學習規則" : "Save Learning Rule";

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(saveBtn);

    modalBox.appendChild(titleEl);
    modalBox.appendChild(descEl);
    modalBox.appendChild(previewContainer);
    modalBox.appendChild(formGroup);
    modalBox.appendChild(scopeContainer);
    modalBox.appendChild(btnGroup);

    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    setTimeout(() => {
      modalBox.style.transform = "scale(1)";
      correctInput.focus();
    }, 10);

    const closeHandler = (result: LearningModalResult | null) => {
      modalBox.style.transform = "scale(0.95)";
      modalOverlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(modalOverlay)) {
          document.body.removeChild(modalOverlay);
        }
        resolve(result);
      }, 150);
    };

    cancelBtn.addEventListener("click", () => closeHandler(null));

    saveBtn.addEventListener("click", () => {
      const wVal = wrongInput.value.trim();
      const cVal = correctInput.value.trim();
      if (!cVal) {
        correctInput.focus();
        return;
      }
      closeHandler({
        wrong: wVal,
        correct: cVal,
        addReplacement: chkRepl.checked,
        addVocabulary: chkVocab.checked,
      });
    });
  });
}

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
    "lbl-device-select": "運算裝置",
    "opt-device-cpu": "CPU (高相容性，支援所有電腦)",
    "opt-device-cuda": "NVIDIA GPU (需 CUDA 支援，速度最快)",
    "opt-device-amd": "AMD GPU (Vulkan 加速，適合 AMD 顯示卡)",
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
    "lbl-setup-storage": "安裝與儲存資料夾",
    "btn-setup-tab-download": "🚀 網絡一鍵下載 (推薦)",
    "btn-setup-tab-import": "📂 本地檔案匯入 (離線)",
    "lbl-import-engine": "語音引擎壓縮包 (whisper-server-cuda.zip)",
    "lbl-import-model": "語音模型檔 (ggml-large-v3-q5_0.bin)",
    "btn-install-import": "開始匯入並安裝",
    "lbl-setup-engine-select": "AI 運算引擎版本",
    "opt-setup-cpu": "CPU 版本 (相容性最高，檔案僅 4.4MB)",
    "opt-setup-cuda": "NVIDIA GPU CUDA 版本 (速度極快，需 NVIDIA 顯卡)",
    "opt-setup-amd": "AMD GPU / Vulkan 版本 (支援 AMD 顯示卡加速)",
    "lbl-custom-prompt": "常用詞彙學習庫",
    "lbl-custom-prompt-desc": "讓 AI 學習新詞彙，在此輸入你經常使用的專有名詞、姓名、產品名等（用逗號隔開）",
    "lbl-text-replacements": "字詞自動修正對照表",
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
    "btn-export": "匯出資料",
    "btn-import": "匯入資料",
    "no-transcription-yet": "(尚未有已轉寫的句子)",
    "btn-reinstall": "⚙️ 啟動安裝與設定精靈",
    "btn-check": "檢測本機",
    "btn-manage": "🔍 檢視與編輯",
    "modal-replacements-title": "字詞自動修正管理",
    "modal-replacements-desc": "檢視、搜尋與編輯您的自動修正對照表規則。",
    "placeholder-search-replacements": "搜尋規則...",
    "placeholder-wrong": "聽錯的字",
    "placeholder-correct": "修正後",
    "btn-add": "新增",
    "btn-bulk-edit": "切換至文字編輯",
    "btn-list-view": "切換至列表檢視",
    "count-rules": "共 {count} 條規則",
    "btn-save-replacements": "套用變更",
    "lbl-show-settings-title": "開啟程式時自動顯示主視窗",
    "lbl-start-at-login-title": "開機時自動啟動",
    "lbl-cpu-threads": "CPU 運算執行緒數",
    "opt-threads-auto": "自動 (預設 4 執行緒)",
    "btn-remove-cuda": "移除",
    "btn-edit": "編輯"
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
    "opt-device-amd": "AMD GPU (Vulkan)",
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
    "lbl-import-engine": "Voice Engine Archive (whisper-server-cuda.zip)",
    "lbl-import-model": "Voice Model File (ggml-large-v3-q5_0.bin)",
    "btn-install-import": "Import & Install",
    "lbl-setup-engine-select": "AI Engine Edition",
    "opt-setup-cpu": "CPU Edition (Highly Compatible, 4.4MB)",
    "opt-setup-cuda": "NVIDIA GPU Edition (CUDA, requires NVIDIA GPU)",
    "opt-setup-amd": "AMD GPU / Vulkan Edition (Supports AMD GPUs)",
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
    "btn-import": "Import Data",
    "no-transcription-yet": "(No sentences transcribed yet)",
    "btn-reinstall": "⚙️ Launch Setup Wizard",
    "btn-check": "Check Local",
    "btn-manage": "🔍 Manage",
    "modal-replacements-title": "Text Corrections Manager",
    "modal-replacements-desc": "View, search, and edit your text replacement rules.",
    "placeholder-search-replacements": "Search rules...",
    "placeholder-wrong": "Wrong word",
    "placeholder-correct": "Correction",
    "btn-add": "Add",
    "btn-bulk-edit": "Switch to Bulk Edit",
    "btn-list-view": "Switch to List View",
    "count-rules": "{count} rules in total",
    "btn-save-replacements": "Apply Changes",
    "lbl-show-settings-title": "Show Settings on Startup",
    "lbl-start-at-login-title": "Start at Windows Login",
    "lbl-cpu-threads": "CPU Threads",
    "opt-threads-auto": "Auto (4 Threads)",
    "btn-remove-cuda": "Remove CUDA",
    "btn-edit": "Edit"
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

  const engineH2 = document.getElementById("title-engine");
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

  const lblShowSettings = document.getElementById("lbl-show-settings-title");
  if (lblShowSettings) lblShowSettings.textContent = dict["lbl-show-settings-title"];
  const lblStartAtLogin = document.getElementById("lbl-start-at-login-title");
  if (lblStartAtLogin) lblStartAtLogin.textContent = dict["lbl-start-at-login-title"];
  const lblCpuThreads = document.getElementById("lbl-cpu-threads");
  if (lblCpuThreads) lblCpuThreads.textContent = dict["lbl-cpu-threads"];
  const optThreadsAuto = document.getElementById("opt-threads-auto");
  if (optThreadsAuto) optThreadsAuto.textContent = dict["opt-threads-auto"];
  
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

  const titleLearning = document.getElementById("title-learning");
  if (titleLearning) {
    titleLearning.innerHTML = `<span class="icon">📝</span> ${dict["title-learning"].substring(2)}`;
  }

  const lastTransTextEl = document.getElementById("last-transcription-text");
  if (lastTransTextEl) {
    if (!lastTransText) {
      lastTransTextEl.textContent = dict["no-transcription-yet"];
    }
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
  
  const reinstallWizardBtnEl = document.getElementById("reinstall-wizard-btn");
  if (reinstallWizardBtnEl) reinstallWizardBtnEl.textContent = dict["btn-reinstall"];
  
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
  const optDeviceAmd = deviceSelect.querySelector('option[value="amd"]') as HTMLOptionElement;
  if (optDeviceAmd) optDeviceAmd.textContent = dict["opt-device-amd"];

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
  if (setupCheckModelBtn) setupCheckModelBtn.textContent = dict["btn-check"];
  
  if (setupTabDownload) setupTabDownload.textContent = dict["btn-setup-tab-download"];
  if (setupTabImport) setupTabImport.textContent = dict["btn-setup-tab-import"];
  
  const lblSetupEngineSelect = document.getElementById("lbl-setup-engine-select");
  if (lblSetupEngineSelect) lblSetupEngineSelect.textContent = dict["lbl-setup-engine-select"];
  if (setupEngineSelect) {
    const optSetupCpu = setupEngineSelect.querySelector('option[value="cpu"]') as HTMLOptionElement;
    if (optSetupCpu) optSetupCpu.textContent = dict["opt-setup-cpu"];
    const optSetupCuda = setupEngineSelect.querySelector('option[value="cuda"]') as HTMLOptionElement;
    if (optSetupCuda) optSetupCuda.textContent = dict["opt-setup-cuda"];
    const optSetupAmd = setupEngineSelect.querySelector('option[value="amd"]') as HTMLOptionElement;
    if (optSetupAmd) optSetupAmd.textContent = dict["opt-setup-amd"];
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
    } else if (setupEngineSelect && setupEngineSelect.value === "amd") {
      depEngineTitle.textContent = lang === "zh" ? "AI 語音引擎 (AMD Vulkan版本)" : "AI Engine (AMD Vulkan Edition)";
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
  if (setupRemoveCudaBtn) {
    setupRemoveCudaBtn.textContent = dict["btn-remove-cuda"] || "Remove CUDA";
  }

  // Replacements & Vocabulary Modal translations
  const btnManageReplacements = document.getElementById("btn-manage-replacements");
  if (btnManageReplacements) btnManageReplacements.textContent = dict["btn-manage"] || "🔍 Manage";
  
  const btnManageVocabulary = document.getElementById("btn-manage-vocabulary");
  if (btnManageVocabulary) btnManageVocabulary.textContent = dict["btn-manage"] || "🔍 Manage";
  
  const modalReplacementsTitle = document.getElementById("modal-replacements-title");
  if (modalReplacementsTitle) modalReplacementsTitle.textContent = dict["modal-replacements-title"] || "";
  
  const modalReplacementsDesc = document.getElementById("modal-replacements-desc");
  if (modalReplacementsDesc) modalReplacementsDesc.textContent = dict["modal-replacements-desc"] || "";
  
  const replacementSearch = document.getElementById("replacement-search") as HTMLInputElement;
  if (replacementSearch) replacementSearch.placeholder = dict["placeholder-search-replacements"] || "";
  
  const newReplacementWrong = document.getElementById("new-replacement-wrong") as HTMLInputElement;
  if (newReplacementWrong) newReplacementWrong.placeholder = dict["placeholder-wrong"] || "";
  
  const newReplacementCorrect = document.getElementById("new-replacement-correct") as HTMLInputElement;
  if (newReplacementCorrect) newReplacementCorrect.placeholder = dict["placeholder-correct"] || "";
  
  const btnAddReplacement = document.getElementById("btn-add-replacement");
  if (btnAddReplacement) btnAddReplacement.textContent = dict["btn-add"] || "";
  
  const btnToggleBulkEdit = document.getElementById("btn-toggle-bulk-edit");
  if (btnToggleBulkEdit) {
    const isBulk = !document.getElementById("bulk-edit-container")?.classList.contains("hidden");
    btnToggleBulkEdit.textContent = isBulk ? (dict["btn-list-view"] || "") : (dict["btn-bulk-edit"] || "");
  }
  
  const replacementsSaveBtn = document.getElementById("replacements-save-btn");
  if (replacementsSaveBtn) replacementsSaveBtn.textContent = dict["btn-save-replacements"] || "";
}

function updateCpuThreadsVisibility() {
  if (deviceSelect) {
    const isCuda = deviceSelect.value === "cuda";
    const cpuThreadsRow = document.getElementById("cpu-threads-row");
    if (cpuThreadsRow) {
      if (isCuda) {
        cpuThreadsRow.classList.add("hidden");
      } else {
        cpuThreadsRow.classList.remove("hidden");
      }
    }
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
      setupEngineSelect.value = currentConfig.device || "cpu";
      modelSelect.value = currentConfig.model;
      chineseOutputSelect.value = currentConfig.chinese_output;
      storagePathInput.value = currentConfig.storage_path || "";
      setupStoragePathInput.value = currentConfig.storage_path || "";
      customPromptInput.value = currentConfig.custom_prompt || "";
      textReplacementsInput.value = currentConfig.text_replacements || "";
      showSettingsOnStartupToggle.checked = currentConfig.show_settings_on_startup !== false; // default true
      startAtLoginToggle.checked = !!currentConfig.start_at_login; // default false
      cpuThreadsSelect.value = String(currentConfig.cpu_threads || 0); // default 0 (auto)
      
      updateUILanguage(currentConfig.app_language);
      updateCpuThreadsVisibility();
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
    show_settings_on_startup: showSettingsOnStartupToggle.checked,
    start_at_login: startAtLoginToggle.checked,
    cpu_threads: Number(cpuThreadsSelect.value),
  };

  const dict = translations[newConfig.app_language] || translations["zh"];

  try {
    applyBtn.textContent = dict["btn-apply-saving"];
    applyBtn.disabled = true;
    
    await invoke("set_config", { newConfig });
    await invoke("start_engine");
    
    applyBtn.textContent = dict["btn-apply-success"];
    applyBtn.disabled = true;
    
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

async function runDependencyChecks(forceShow = false) {
  const overlay = document.getElementById("setup-overlay") as HTMLDivElement;
  const status = await invoke<DependencyStatus>("check_dependencies");
  console.log("Dependency checks:", status);

  const engineStatus = document.getElementById("dep-engine-status") as HTMLSpanElement;
  const modelStatus = document.getElementById("dep-model-status") as HTMLSpanElement;
  const startBtn = document.getElementById("start-download-btn") as HTMLButtonElement;

  const currentLang = appLanguageSelect.value || "zh";
  const dict = translations[currentLang] || translations["zh"];

  if (setupStoragePathInput) {
    if (!setupStoragePathInput.value || setupStoragePathInput.value.includes("Program Files")) {
      setupStoragePathInput.value = status.appdata_dir;
    }
  }

  updateUILanguage(currentLang);

  const selectedEngine = setupEngineSelect.value;
  const isCudaMode = selectedEngine === "cuda";
  const engineInstalled = isEngineInstalled(status, selectedEngine);

  // Show or hide "Remove CUDA / 移除" button
  if (setupRemoveCudaBtn) {
    if (status.appdata_engine_exists && isCudaMode) {
      setupRemoveCudaBtn.classList.remove("hidden");
    } else {
      setupRemoveCudaBtn.classList.add("hidden");
    }
  }

  if (engineInstalled && status.model_exists && !forceShow) {
    overlay.classList.add("hidden");
    return;
  }

  overlay.classList.remove("hidden");

  // The native window starts hidden so the tray app stays unobtrusive.
  // Show it only after the WebView is ready and the setup wizard is known
  // to be required; showing it earlier from Rust can be lost during startup.
  try {
    const appWindow = getCurrentWindow();
    await appWindow.show();
    await appWindow.setFocus();
  } catch (error) {
    console.error("Failed to show setup window:", error);
  }
  
  // Render Engine Status
  engineStatus.textContent = engineInstalled ? dict["status-installed"] : dict["status-missing"];
  engineStatus.style.color = engineInstalled ? "var(--accent-green)" : "#ff3c3c";
  document.getElementById("dep-engine-bar")!.style.width = engineInstalled ? "100%" : "0%";
  document.getElementById("dep-engine-text")!.textContent = "";

  // Render Model Status
  modelStatus.textContent = status.model_exists ? dict["status-installed"] : dict["status-missing"];
  modelStatus.style.color = status.model_exists ? "var(--accent-green)" : "#ff3c3c";
  if (status.model_exists) {
    document.getElementById("dep-model-bar")!.style.width = "100%";
    document.getElementById("dep-model-text")!.textContent = "";
  } else {
    document.getElementById("dep-model-bar")!.style.width = "0%";
    document.getElementById("dep-model-text")!.textContent = "";
  }

  // Update Start Button
  if (engineInstalled && status.model_exists) {
    startBtn.textContent = currentLang === "zh" ? "檢測成功！點此開啟主介面" : "Found! Enter App";
    startBtn.disabled = false;
    startBtn.onclick = async () => {
      // Update config on disk with selected engine and storage path
      if (currentConfig) {
        currentConfig.storage_path = setupStoragePathInput.value.trim();
        currentConfig.device = setupEngineSelect.value;
        await invoke("set_config", { newConfig: currentConfig });
      }
      await loadConfig();
      await invoke("start_engine");
      overlay.classList.add("hidden");
      
      // Auto open settings tab after wizard closes
      const settingsTabBtn = document.querySelector('.tab-btn[data-tab="settings-tab"]') as HTMLButtonElement;
      if (settingsTabBtn) {
        settingsTabBtn.click();
      }
    };
  } else {
    startBtn.textContent = dict["btn-download"];
    startBtn.disabled = false;
    
    // Wire the download flow
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      startBtn.textContent = dict["btn-download-setting-up"];

      const baseDir = setupStoragePathInput.value.trim() || status.appdata_dir;
      const selectedEngine = setupEngineSelect.value;
      
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
        // Re-fetch live status just before starting
        const liveStatus = await invoke<DependencyStatus>("check_dependencies");
        const liveIsEngineInstalled = isEngineInstalled(liveStatus, selectedEngine);

        if (!liveIsEngineInstalled) {
          engineStatus.textContent = dict["status-downloading"];
          engineStatus.style.color = "var(--accent-blue)";
          
          let engineUrl = "";
          if (selectedEngine === "amd") {
            engineUrl = "https://github.com/nyancodex/whisper-server-vulkan-windows/releases/download/v0.1.0/whisper-server-bundle.zip";
          } else if (selectedEngine === "cuda") {
            engineUrl = "https://github.com/travisau/VoiceInput-main/releases/download/v1.0.0/whisper-server-cuda.zip";
          } else {
            engineUrl = "https://github.com/travisau/VoiceInput-main/releases/download/v1.0.0/whisper-server-cpu.zip";
          }

          await download(
            engineUrl,
            tempZip,
            "engine-download-progress",
            "dep-engine-bar",
            "dep-engine-text"
          );

          engineStatus.textContent = dict["status-extracting"];
          await invoke("extract_zip", { zipPath: tempZip, destDir: appDataBin });

          const installedStatus = await invoke<DependencyStatus>("check_dependencies");
          if (!isEngineInstalled(installedStatus, selectedEngine)) {
            const missingComponent = selectedEngine === "amd"
              ? "ggml-vulkan.dll"
              : selectedEngine === "cuda"
                ? "ggml-cuda.dll"
                : "whisper-server.exe";
            throw new Error(`Engine archive extracted, but ${missingComponent} was not found in ${appDataBin}`);
          }

          engineStatus.textContent = dict["status-installed"];
          engineStatus.style.color = "var(--accent-green)";
          document.getElementById("dep-engine-bar")!.style.width = "100%";
          document.getElementById("dep-engine-text")!.textContent = "";
        }

        if (!liveStatus.model_exists) {
          modelStatus.textContent = dict["status-downloading"];
          modelStatus.style.color = "var(--accent-blue)";

          await download(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin",
            modelDest,
            "model-download-progress",
            "dep-model-bar",
            "dep-model-text"
          );

          modelStatus.textContent = dict["status-installed"];
          modelStatus.style.color = "var(--accent-green)";
          document.getElementById("dep-model-bar")!.style.width = "100%";
          document.getElementById("dep-model-text")!.textContent = "";
        }

        startBtn.textContent = dict["btn-download-all-set"];
        await loadConfig();
        await invoke("start_engine");
        
        setTimeout(() => {
          overlay.classList.add("hidden");
          
          // Auto open settings tab after wizard closes
          const settingsTabBtn = document.querySelector('.tab-btn[data-tab="settings-tab"]') as HTMLButtonElement;
          if (settingsTabBtn) {
            settingsTabBtn.click();
          }
        }, 1500);

      } catch (error) {
        console.error("Setup failed:", error);
        const errStr = String(error);
        if (errStr.includes("os error 5") || errStr.includes("存取被拒") || errStr.includes("Access is denied")) {
          setupStoragePathInput.value = status.appdata_dir;
          if (currentConfig) {
            currentConfig.storage_path = status.appdata_dir;
            await invoke("set_config", { newConfig: currentConfig });
          }
          await showCustomAlert(currentLang === "zh"
            ? `安裝失敗：存取被拒 (os error 5)！\nWindows 不允許非管理員程式寫入 C:\\Program Files。\n\n系統已自動為您更換儲存路徑至 AppData 專用資料夾：\n${status.appdata_dir}\n\n請再次點擊「重試安裝」即可順利下載！`
            : `Setup Failed: Access Denied (os error 5)!\nWindows prevents writing files into Program Files.\nStorage path has been automatically updated to your user AppData folder:\n${status.appdata_dir}\nPlease click "Retry Setup" to complete download.`);
        } else {
          await showCustomAlert(`Setup Failed: ${error}`);
        }
        startBtn.disabled = false;
        startBtn.textContent = dict["btn-download-retry"];
      }
    };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await loadConfig();
    await runDependencyChecks();
  })();
  
  applyBtn.addEventListener("click", saveConfig);
  applyLearningBtn.addEventListener("click", saveConfig);

  function onSettingChanged() {
    const currentLang = appLanguageSelect.value || "zh";
    const dict = translations[currentLang] || translations["zh"];
    if (applyBtn) {
      applyBtn.textContent = dict["btn-apply"] || "儲存設定";
      applyBtn.disabled = false;
    }
  }

  // Bind change/input events to detect unsaved settings changes
  if (hotkeyModeSelect) hotkeyModeSelect.addEventListener("change", onSettingChanged);
  if (soundModeSelect) soundModeSelect.addEventListener("change", onSettingChanged);
  if (appLanguageSelect) appLanguageSelect.addEventListener("change", onSettingChanged);
  if (cantoneseModeToggle) cantoneseModeToggle.addEventListener("change", onSettingChanged);
  if (showSettingsOnStartupToggle) showSettingsOnStartupToggle.addEventListener("change", onSettingChanged);
  if (startAtLoginToggle) startAtLoginToggle.addEventListener("change", onSettingChanged);
  if (deviceSelect) {
    deviceSelect.addEventListener("change", () => {
      onSettingChanged();
      updateCpuThreadsVisibility();
    });
  }
  if (cpuThreadsSelect) cpuThreadsSelect.addEventListener("change", onSettingChanged);
  if (modelSelect) modelSelect.addEventListener("change", onSettingChanged);
  if (chineseOutputSelect) chineseOutputSelect.addEventListener("change", onSettingChanged);
  if (storagePathInput) storagePathInput.addEventListener("input", onSettingChanged);

  // Implement hotkey recording
  if (hotkeyInput) {
    hotkeyInput.addEventListener("focus", () => {
      hotkeyInput.value = "";
      hotkeyInput.placeholder = appLanguageSelect.value === "zh" ? "請按下快捷鍵組合..." : "Press hotkey combination...";
    });

    hotkeyInput.addEventListener("blur", () => {
      if (!hotkeyInput.value) {
        hotkeyInput.value = currentConfig?.hotkey || "ctrl+f9";
      }
      hotkeyInput.placeholder = "";
    });

    hotkeyInput.addEventListener("keydown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");
      if (e.metaKey) parts.push("command");

      const key = e.key;
      const isModifier = ["Control", "Shift", "Alt", "Meta"].includes(key);

      if (!isModifier) {
        let keyName = key.toLowerCase();
        if (keyName === " ") keyName = "space";
        else if (keyName === "arrowup") keyName = "up";
        else if (keyName === "arrowdown") keyName = "down";
        else if (keyName === "arrowleft") keyName = "left";
        else if (keyName === "arrowright") keyName = "right";
        
        parts.push(keyName);
        hotkeyInput.value = parts.join("+");
        onSettingChanged();
        hotkeyInput.blur(); // auto-finish recording when main key is pressed
      } else {
        if (parts.length > 0) {
          hotkeyInput.value = parts.join("+") + "+";
        } else {
          hotkeyInput.value = "";
        }
      }
    });
  }

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
        await showCustomAlert(`Import Failed: ${err}`);
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

  function getDiffPairs(original: string, corrected: string): Array<{ wrong: string; correct: string }> {
    const n = original.length;
    const m = corrected.length;
    
    // DP table for LCS
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (original[i - 1] === corrected[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find diff blocks
    let i = n, j = m;
    const ops: Array<{ type: 'keep' | 'delete' | 'insert'; char: string }> = [];
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && original[i - 1] === corrected[j - 1]) {
        ops.push({ type: 'keep', char: original[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'insert', char: corrected[j - 1] });
        j--;
      } else {
        ops.push({ type: 'delete', char: original[i - 1] });
        i--;
      }
    }
    ops.reverse();
    
    // Group consecutive deletes and inserts
    const pairs: Array<{ wrong: string; correct: string }> = [];
    let currentDelete = "";
    let currentInsert = "";
    
    for (const op of ops) {
      if (op.type === 'delete') {
        currentDelete += op.char;
      } else if (op.type === 'insert') {
        currentInsert += op.char;
      } else {
        if (currentDelete || currentInsert) {
          pairs.push({
            wrong: currentDelete.trim(),
            correct: currentInsert.trim()
          });
          currentDelete = "";
          currentInsert = "";
        }
      }
    }
    
    if (currentDelete || currentInsert) {
      pairs.push({
        wrong: currentDelete.trim(),
        correct: currentInsert.trim()
      });
    }
    
    const isPunctuation = (str: string) => /^[，。、？！,.?!:：;；"'\s]+$/.test(str);
    
    return pairs
      .map(p => {
        let w = p.wrong.replace(/^[，。、？！,.?!:：;；"'\s]+|[，。、？！,.?!:：;；"'\s]+$/g, "");
        let c = p.correct.replace(/^[，。、？！,.?!:：;；"'\s]+|[，。、？！,.?!:：;；"'\s]+$/g, "");
        return { wrong: w, correct: c };
      })
      .filter(p => p.wrong && p.correct && p.wrong !== p.correct && !isPunctuation(p.wrong) && !isPunctuation(p.correct));
  }

  learnBtn.addEventListener("click", async () => {
    const correctedVal = correctedTextInput.value.trim();
    const currentLang = currentConfig?.app_language || "zh";
    const dict = translations[currentLang] || translations["zh"];

    if (!lastTransText) {
      await showCustomAlert(currentLang === "zh" ? "尚未輸入任何句子！" : "No sentence transcribed yet!");
      return;
    }

    if (!correctedVal || correctedVal === lastTransText) {
      return;
    }

    let initWrong = "";
    let initCorrect = "";

    const pairs = getDiffPairs(lastTransText, correctedVal);
    if (pairs.length > 0) {
      initWrong = pairs[0].wrong;
      initCorrect = pairs[0].correct;
    } else {
      const diff = extractDifference(lastTransText, correctedVal);
      if (diff) {
        initWrong = diff.wrong;
        initCorrect = diff.correct;
      } else {
        initWrong = lastTransText;
        initCorrect = correctedVal;
      }
    }

    const editResult = await showLearningWordEditModal({
      initialWrong: initWrong,
      initialCorrect: initCorrect,
      fullOriginal: lastTransText,
      fullCorrected: correctedVal,
      appLanguage: currentLang,
    });

    if (!editResult) return;

    // 1. Add auto text replacement rule (placed at VERY TOP)
    if (editResult.addReplacement && editResult.wrong) {
      const newRule = `${editResult.wrong} -> ${editResult.correct}`;
      let rules = textReplacementsInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      rules = rules.filter(r => !r.startsWith(`${editResult.wrong} -> `));
      rules.unshift(newRule); // Prepend to top!
      textReplacementsInput.value = rules.join('\n');
    }

    // 2. Add custom vocabulary prompt word (placed at VERY TOP)
    if (editResult.addVocabulary && editResult.correct) {
      let vocab = customPromptInput.value.split(',').map(w => w.trim()).filter(w => w.length > 0);
      vocab = vocab.filter(w => w !== editResult.correct);
      vocab.unshift(editResult.correct); // Prepend to top!
      customPromptInput.value = vocab.join(', ');
    }

    await saveConfig();

    const oldText = learnBtn.textContent;
    learnBtn.textContent = dict["btn-learn-success"] || "Learned!";
    learnBtn.disabled = true;
    setTimeout(() => {
      learnBtn.textContent = oldText;
      learnBtn.disabled = false;
    }, 1500);
  });
  
  browseStorageBtn.addEventListener("click", async () => {
    try {
      const selected = await invoke<string | null>("select_directory");
      if (selected) {
        storagePathInput.value = selected;
        onSettingChanged();
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  });

  if (reinstallWizardBtn) {
    reinstallWizardBtn.addEventListener("click", () => {
      runDependencyChecks(true);
    });
  }

  if (setupCheckEngineBtn) {
    setupCheckEngineBtn.addEventListener("click", async () => {
      const storagePath = setupStoragePathInput.value.trim();
      const currentLang = appLanguageSelect.value || "zh";
      
      // 1. Update config on disk immediately with the selected path
      if (currentConfig) {
        currentConfig.storage_path = storagePath;
        await invoke("set_config", { newConfig: currentConfig });
      }

      // 2. Recheck and update UI
      await runDependencyChecks(true);

      // 3. Fetch latest checked state
      try {
        const status = await invoke<DependencyStatus>("check_dependencies");
        const selectedEngine = setupEngineSelect.value;
        const isCudaMode = selectedEngine === "cuda";
        const isAmdMode = selectedEngine === "amd";
        const engineInstalled = isEngineInstalled(status, selectedEngine);

        if (engineInstalled) {
          if (isCudaMode) {
            await showCustomAlert(currentLang === "zh" 
              ? "找到 CUDA 語音引擎檔案！已成功檢測到 whisper-server.exe！" 
              : "CUDA Engine found! Successfully detected whisper-server.exe!");
          } else if (isAmdMode) {
            await showCustomAlert(currentLang === "zh"
              ? "找到 AMD Vulkan 語音引擎！已成功檢測到 whisper-server.exe 及 ggml-vulkan.dll！"
              : "AMD Vulkan Engine found! Detected whisper-server.exe and ggml-vulkan.dll.");
          } else {
            await showCustomAlert(currentLang === "zh" 
              ? "已採用程式內置之 CPU 語音引擎，免安裝開箱即用！" 
              : "Using built-in CPU Engine. Ready to use out-of-the-box!");
          }
        } else {
          const expectedPath = storagePath
            ? `${storagePath}\\bin\\`
            : `(預設 AppData)\\bin\\`;
          await showCustomAlert(currentLang === "zh"
            ? `未檢測到必要之 GPU 加速組件！請在精靈中點擊「一鍵下載與安裝」自動下載至：\n${expectedPath}`
            : `GPU Acceleration Component not found! Click "Download & Setup" to install to:\n${expectedPath}`);
        }
      } catch (err) {
        console.error("Failed to check local engine:", err);
      }
    });
  }

  if (setupRemoveCudaBtn) {
    setupRemoveCudaBtn.addEventListener("click", async () => {
      const currentLang = appLanguageSelect.value || "zh";
      const confirmRemove = await showCustomConfirm(currentLang === "zh"
        ? "確定要移除本機 CUDA 加速引擎嗎？這將刪除 custom bin 資料夾（約釋放 1.2GB 空間），程式會切換回內置 CPU 引擎。"
        : "Are you sure you want to remove the CUDA engine? This will delete the custom bin folder (~1.2GB space) and switch back to the built-in CPU engine.");
      
      if (!confirmRemove) return;

      try {
        await invoke("delete_cuda_files");
        
        // Revert dropdown value to cpu
        setupEngineSelect.value = "cpu";
        deviceSelect.value = "cpu";
        
        // Update UI
        await runDependencyChecks(true);

        await showCustomAlert(currentLang === "zh"
          ? "已成功移除 CUDA 語音引擎，釋放約 1.2GB 空間！程式已自動切換回內置 CPU 模式。"
          : "CUDA Engine removed! Reverted to built-in CPU mode successfully.");
      } catch (err) {
        console.error("Failed to remove CUDA files:", err);
        await showCustomAlert(`Failed to remove CUDA: ${err}`);
      }
    });
  }

  if (setupCheckModelBtn) {
    setupCheckModelBtn.addEventListener("click", async () => {
      const storagePath = setupStoragePathInput.value.trim();
      const currentLang = appLanguageSelect.value || "zh";
      
      // 1. Update config on disk immediately with the selected path
      if (currentConfig) {
        currentConfig.storage_path = storagePath;
        await invoke("set_config", { newConfig: currentConfig });
      }

      // 2. Recheck and update UI
      await runDependencyChecks(true);

      // 3. Fetch checked state
      try {
        const status = await invoke<DependencyStatus>("check_dependencies");
        if (status.model_exists) {
          await showCustomAlert(currentLang === "zh" 
            ? "找到模型檔案！已成功檢測到 ggml-large-v3-q5_0.bin！" 
            : "Model found! Successfully detected ggml-large-v3-q5_0.bin!");
        } else {
          const expectedPath = storagePath 
            ? `${storagePath}\\models\\ggml-large-v3-q5_0.bin` 
            : `(預設 AppData)\\models\\ggml-large-v3-q5_0.bin`;
          await showCustomAlert(currentLang === "zh"
            ? `未找到模型檔案！請確認你已將模型放入：\n${expectedPath}`
            : `Model file not found! Please make sure the model is placed in:\n${expectedPath}`);
        }
      } catch (err) {
        console.error("Failed to check local model:", err);
      }
    });
  }

  if (setupCloseBtn) {
    setupCloseBtn.addEventListener("click", async () => {
      const overlay = document.getElementById("setup-overlay") as HTMLDivElement;
      const currentLang = appLanguageSelect.value || "zh";
      try {
        const status = await invoke<DependencyStatus>("check_dependencies");
        if (status.engine_exists && status.model_exists) {
          overlay.classList.add("hidden");
        } else {
          await showCustomAlert(currentLang === "zh"
            ? "語音引擎或模型檔案尚未安裝完成，請先完成下載或匯入！"
            : "Engine or model files are missing. Please complete setup first!");
        }
      } catch (err) {
        console.error("Failed to check status on close:", err);
        overlay.classList.add("hidden");
      }
    });
  }

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
        await showCustomAlert(currentLang === "zh" ? "匯出設定及學習資料成功！" : "Settings exported successfully!");
      } catch (err) {
        console.error("Export config failed:", err);
        if (err !== "Export cancelled by user") {
          await showCustomAlert(`Export failed: ${err}`);
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
        await showCustomAlert(currentLang === "zh" ? "匯入設定及學習資料成功！" : "Settings imported successfully!");
      } catch (err) {
        console.error("Import config failed:", err);
        if (err !== "Import cancelled by user") {
          await showCustomAlert(`Import failed: ${err}`);
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

  if (setupEngineSelect) {
    setupEngineSelect.addEventListener("change", () => {
      runDependencyChecks(true);
    });
  }
  
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

  // Text Replacements Manager Modal Logic
  const replacementsModal = document.getElementById("replacements-modal") as HTMLDivElement;
  const btnManageReplacements = document.getElementById("btn-manage-replacements") as HTMLButtonElement;
  const replacementsCloseBtn = document.getElementById("replacements-close-btn") as HTMLButtonElement;
  const replacementSearchInput = document.getElementById("replacement-search") as HTMLInputElement;
  const newReplacementWrongInput = document.getElementById("new-replacement-wrong") as HTMLInputElement;
  const newReplacementCorrectInput = document.getElementById("new-replacement-correct") as HTMLInputElement;
  const btnAddReplacement = document.getElementById("btn-add-replacement") as HTMLButtonElement;
  const replacementsListContainer = document.getElementById("replacements-list-container") as HTMLDivElement;
  const btnToggleBulkEdit = document.getElementById("btn-toggle-bulk-edit") as HTMLButtonElement;
  const bulkEditContainer = document.getElementById("bulk-edit-container") as HTMLDivElement;
  const replacementsBulkTextarea = document.getElementById("replacements-bulk-textarea") as HTMLTextAreaElement;
  const replacementsSaveBtn = document.getElementById("replacements-save-btn") as HTMLButtonElement;

  let modalReplacements: Array<{ wrong: string; correct: string }> = [];
  let editingWrongKey: string | null = null;

  function parseReplacements(text: string): Array<{ wrong: string; correct: string }> {
    return text.split('\n')
      .map(line => {
        let delimiter = "";
        if (line.includes("->")) {
          delimiter = "->";
        } else if (line.includes("→")) {
          delimiter = "→";
        }
        
        if (delimiter) {
          const parts = line.split(delimiter).map(p => p.trim());
          if (parts.length === 2 && parts[0]) {
            return { wrong: parts[0], correct: parts[1] };
          }
        }
        return null;
      })
      .filter((item): item is { wrong: string; correct: string } => item !== null);
  }

  function renderReplacementsList(filterText: string = "") {
    replacementsListContainer.innerHTML = "";
    
    const searchLower = filterText.toLowerCase().trim();
    const filtered = modalReplacements.filter(item => 
      item.wrong.toLowerCase().includes(searchLower) || 
      item.correct.toLowerCase().includes(searchLower)
    );
    
    filtered.forEach(item => {
      const row = document.createElement("div");
      row.className = "replacement-item-row";
      
      const currentLang = appLanguageSelect.value || "zh";
      const dict = translations[currentLang] || translations["zh"];
      
      if (item.wrong === editingWrongKey) {
        // Render in edit mode
        const wrongInput = document.createElement("input");
        wrongInput.type = "text";
        wrongInput.className = "inline-edit-input";
        wrongInput.value = item.wrong;
        wrongInput.style.flex = "1";
        wrongInput.style.height = "24px";
        wrongInput.style.fontSize = "12px";
        wrongInput.style.marginRight = "4px";
        wrongInput.style.minWidth = "0";
        
        const arrowSpan = document.createElement("span");
        arrowSpan.style.fontSize = "12px";
        arrowSpan.style.color = "var(--text-secondary)";
        arrowSpan.style.marginRight = "4px";
        arrowSpan.textContent = "→";
        
        const correctInput = document.createElement("input");
        correctInput.type = "text";
        correctInput.className = "inline-edit-input";
        correctInput.value = item.correct;
        correctInput.style.flex = "1";
        correctInput.style.height = "24px";
        correctInput.style.fontSize = "12px";
        correctInput.style.marginRight = "4px";
        correctInput.style.minWidth = "0";
        
        const actionGroup = document.createElement("div");
        actionGroup.style.display = "flex";
        actionGroup.style.gap = "4px";
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "secondary-btn";
        saveBtn.style.padding = "2px 6px";
        saveBtn.style.fontSize = "11px";
        saveBtn.style.background = "var(--accent-green)";
        saveBtn.style.color = "white";
        saveBtn.style.borderColor = "var(--accent-green)";
        saveBtn.textContent = "✓";
        saveBtn.addEventListener("click", () => {
          const wVal = wrongInput.value.trim();
          const cVal = correctInput.value.trim();
          if (wVal && cVal) {
            const originalIndex = modalReplacements.findIndex(r => r.wrong === item.wrong);
            if (originalIndex !== -1) {
              const dupIndex = modalReplacements.findIndex((r, idx) => r.wrong === wVal && idx !== originalIndex);
              if (dupIndex !== -1) {
                showCustomAlert(currentLang === "zh" ? "此字詞修正規則已存在！" : "This wrong word rule already exists!");
                return;
              }
              modalReplacements[originalIndex] = { wrong: wVal, correct: cVal };
              editingWrongKey = null;
              renderReplacementsList(replacementSearchInput.value);
              updateCount();
            }
          }
        });
        
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "secondary-btn";
        cancelBtn.style.padding = "2px 6px";
        cancelBtn.style.fontSize = "11px";
        cancelBtn.textContent = "×";
        cancelBtn.addEventListener("click", () => {
          editingWrongKey = null;
          renderReplacementsList(replacementSearchInput.value);
        });
        
        row.appendChild(wrongInput);
        row.appendChild(arrowSpan);
        row.appendChild(correctInput);
        actionGroup.appendChild(saveBtn);
        actionGroup.appendChild(cancelBtn);
        row.appendChild(actionGroup);
      } else {
        // Render in view mode
        const textSpan = document.createElement("span");
        textSpan.className = "replacement-item-text";
        textSpan.innerHTML = `<span>${item.wrong}</span> <span class="replacement-item-arrow">→</span> <span>${item.correct}</span>`;
        
        const actionGroup = document.createElement("div");
        actionGroup.style.display = "flex";
        actionGroup.style.gap = "4px";
        actionGroup.style.alignItems = "center";
        
        const editBtn = document.createElement("button");
        editBtn.className = "secondary-btn";
        editBtn.style.padding = "2px 6px";
        editBtn.style.fontSize = "11px";
        editBtn.style.background = "transparent";
        editBtn.style.color = "var(--accent-blue)";
        editBtn.style.borderColor = "var(--accent-blue)";
        editBtn.textContent = dict["btn-edit"] || "編輯";
        editBtn.addEventListener("click", () => {
          editingWrongKey = item.wrong;
          renderReplacementsList(replacementSearchInput.value);
        });
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "replacement-delete-btn";
        deleteBtn.innerHTML = "&times;";
        deleteBtn.style.margin = "0";
        deleteBtn.style.padding = "2px 6px";
        deleteBtn.addEventListener("click", () => {
          const originalIndex = modalReplacements.findIndex(r => r.wrong === item.wrong && r.correct === item.correct);
          if (originalIndex !== -1) {
            modalReplacements.splice(originalIndex, 1);
            renderReplacementsList(replacementSearchInput.value);
            updateCount();
          }
        });
        
        row.appendChild(textSpan);
        actionGroup.appendChild(editBtn);
        actionGroup.appendChild(deleteBtn);
        row.appendChild(actionGroup);
      }
      
      replacementsListContainer.appendChild(row);
    });
    
    replacementsBulkTextarea.value = modalReplacements.map(r => `${r.wrong} -> ${r.correct}`).join('\n');
  }

  function updateCount() {
    const countText = document.getElementById("replacements-count-text") as HTMLSpanElement;
    const currentLang = appLanguageSelect.value || "zh";
    const dict = translations[currentLang] || translations["zh"];
    countText.textContent = dict["count-rules"].replace("{count}", modalReplacements.length.toString());
  }

  if (btnManageReplacements) {
    btnManageReplacements.addEventListener("click", () => {
      const text = textReplacementsInput.value;
      modalReplacements = parseReplacements(text);
      
      bulkEditContainer.classList.add("hidden");
      const currentLang = appLanguageSelect.value || "zh";
      const dict = translations[currentLang] || translations["zh"];
      if (btnToggleBulkEdit) btnToggleBulkEdit.textContent = dict["btn-bulk-edit"] || "Switch to Bulk Edit";
      
      replacementSearchInput.value = "";
      newReplacementWrongInput.value = "";
      newReplacementCorrectInput.value = "";
      
      renderReplacementsList();
      updateCount();
      
      replacementsModal.classList.remove("hidden");
    });
  }

  if (replacementsCloseBtn) {
    replacementsCloseBtn.addEventListener("click", () => {
      replacementsModal.classList.add("hidden");
    });
  }

  if (replacementSearchInput) {
    replacementSearchInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      renderReplacementsList(target.value);
    });
  }

  if (btnAddReplacement) {
    btnAddReplacement.addEventListener("click", () => {
      const wrongVal = newReplacementWrongInput.value.trim();
      const correctVal = newReplacementCorrectInput.value.trim();
      
      if (wrongVal && correctVal) {
        const dup = modalReplacements.find(r => r.wrong === wrongVal);
        if (dup) {
          dup.correct = correctVal;
        } else {
          modalReplacements.unshift({ wrong: wrongVal, correct: correctVal });
        }
        newReplacementWrongInput.value = "";
        newReplacementCorrectInput.value = "";
        renderReplacementsList(replacementSearchInput.value);
        updateCount();
      }
    });
  }

  if (btnToggleBulkEdit) {
    btnToggleBulkEdit.addEventListener("click", () => {
      const isHidden = bulkEditContainer.classList.contains("hidden");
      const currentLang = appLanguageSelect.value || "zh";
      const dict = translations[currentLang] || translations["zh"];
      
      if (isHidden) {
        bulkEditContainer.classList.remove("hidden");
        btnToggleBulkEdit.textContent = dict["btn-list-view"] || "Switch to List View";
      } else {
        bulkEditContainer.classList.add("hidden");
        btnToggleBulkEdit.textContent = dict["btn-bulk-edit"] || "Switch to Bulk Edit";
        modalReplacements = parseReplacements(replacementsBulkTextarea.value);
        renderReplacementsList(replacementSearchInput.value);
        updateCount();
      }
    });
  }

  if (replacementsSaveBtn) {
    replacementsSaveBtn.addEventListener("click", async () => {
      if (!bulkEditContainer.classList.contains("hidden")) {
        modalReplacements = parseReplacements(replacementsBulkTextarea.value);
      }
      
      textReplacementsInput.value = modalReplacements.map(r => `${r.wrong} -> ${r.correct}`).join('\n');
      replacementsModal.classList.add("hidden");
      await saveConfig();
    });
  }

  // ==========================================
  // Custom Vocabulary Manager Modal Logic
  // ==========================================
  const vocabularyModal = document.getElementById("vocabulary-modal") as HTMLDivElement;
  const vocabularyCloseBtn = document.getElementById("vocabulary-close-btn") as HTMLButtonElement;
  const btnManageVocabulary = document.getElementById("btn-manage-vocabulary") as HTMLButtonElement;
  const vocabularySearchInput = document.getElementById("vocabulary-search") as HTMLInputElement;
  const newVocabularyWordInput = document.getElementById("new-vocabulary-word") as HTMLInputElement;
  const btnAddVocabulary = document.getElementById("btn-add-vocabulary") as HTMLButtonElement;
  const vocabularyListContainer = document.getElementById("vocabulary-list-container") as HTMLDivElement;
  const btnToggleVocabBulk = document.getElementById("btn-toggle-vocab-bulk") as HTMLButtonElement;
  const vocabularyCountText = document.getElementById("vocabulary-count-text") as HTMLSpanElement;
  const vocabBulkContainer = document.getElementById("vocab-bulk-container") as HTMLDivElement;
  const vocabularyBulkTextarea = document.getElementById("vocabulary-bulk-textarea") as HTMLTextAreaElement;
  const vocabularySaveBtn = document.getElementById("vocabulary-save-btn") as HTMLButtonElement;

  let modalVocabulary: string[] = [];

  function parseVocabulary(text: string): string[] {
    return text.split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);
  }

  let editingWordKey: string | null = null;

  function renderVocabularyList(filterText: string = "") {
    vocabularyListContainer.innerHTML = "";
    
    const searchLower = filterText.toLowerCase().trim();
    const filtered = modalVocabulary.filter(word => 
      word.toLowerCase().includes(searchLower)
    );
    
    filtered.forEach(word => {
      const row = document.createElement("div");
      row.className = "replacement-item-row";
      
      const currentLang = appLanguageSelect.value || "zh";
      const dict = translations[currentLang] || translations["zh"];
      
      if (word === editingWordKey) {
        const wordInput = document.createElement("input");
        wordInput.type = "text";
        wordInput.className = "inline-edit-input";
        wordInput.value = word;
        wordInput.style.flex = "1";
        wordInput.style.height = "24px";
        wordInput.style.fontSize = "12px";
        wordInput.style.marginRight = "4px";
        wordInput.style.minWidth = "0";
        
        const actionGroup = document.createElement("div");
        actionGroup.style.display = "flex";
        actionGroup.style.gap = "4px";
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "secondary-btn";
        saveBtn.style.padding = "2px 6px";
        saveBtn.style.fontSize = "11px";
        saveBtn.style.background = "var(--accent-green)";
        saveBtn.style.color = "white";
        saveBtn.style.borderColor = "var(--accent-green)";
        saveBtn.textContent = "✓";
        saveBtn.addEventListener("click", () => {
          const wVal = wordInput.value.trim();
          if (wVal) {
            const originalIndex = modalVocabulary.indexOf(word);
            if (originalIndex !== -1) {
              const dupIndex = modalVocabulary.indexOf(wVal);
              if (dupIndex !== -1 && dupIndex !== originalIndex) {
                showCustomAlert(currentLang === "zh" ? "此自訂詞彙已存在！" : "This vocabulary word already exists!");
                return;
              }
              modalVocabulary[originalIndex] = wVal;
              editingWordKey = null;
              renderVocabularyList(vocabularySearchInput.value);
              updateVocabCount();
            }
          }
        });
        
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "secondary-btn";
        cancelBtn.style.padding = "2px 6px";
        cancelBtn.style.fontSize = "11px";
        cancelBtn.textContent = "×";
        cancelBtn.addEventListener("click", () => {
          editingWordKey = null;
          renderVocabularyList(vocabularySearchInput.value);
        });
        
        row.appendChild(wordInput);
        actionGroup.appendChild(saveBtn);
        actionGroup.appendChild(cancelBtn);
        row.appendChild(actionGroup);
      } else {
        const textSpan = document.createElement("span");
        textSpan.className = "replacement-item-text";
        textSpan.style.fontWeight = "500";
        textSpan.textContent = word;
        
        const actionGroup = document.createElement("div");
        actionGroup.style.display = "flex";
        actionGroup.style.gap = "4px";
        actionGroup.style.alignItems = "center";
        
        const editBtn = document.createElement("button");
        editBtn.className = "secondary-btn";
        editBtn.style.padding = "2px 6px";
        editBtn.style.fontSize = "11px";
        editBtn.style.background = "transparent";
        editBtn.style.color = "var(--accent-blue)";
        editBtn.style.borderColor = "var(--accent-blue)";
        editBtn.textContent = dict["btn-edit"] || "編輯";
        editBtn.addEventListener("click", () => {
          editingWordKey = word;
          renderVocabularyList(vocabularySearchInput.value);
        });
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "replacement-delete-btn";
        deleteBtn.innerHTML = "&times;";
        deleteBtn.style.margin = "0";
        deleteBtn.style.padding = "2px 6px";
        deleteBtn.addEventListener("click", () => {
          const index = modalVocabulary.indexOf(word);
          if (index !== -1) {
            modalVocabulary.splice(index, 1);
            renderVocabularyList(vocabularySearchInput.value);
            updateVocabCount();
          }
        });
        
        row.appendChild(textSpan);
        actionGroup.appendChild(editBtn);
        actionGroup.appendChild(deleteBtn);
        row.appendChild(actionGroup);
      }
      
      vocabularyListContainer.appendChild(row);
    });
    
    vocabularyBulkTextarea.value = modalVocabulary.join(', ');
  }

  function updateVocabCount() {
    const currentLang = appLanguageSelect.value || "zh";
    const total = modalVocabulary.length;
    vocabularyCountText.textContent = currentLang === "zh" 
      ? `共 ${total} 個詞彙` 
      : `${total} words in total`;
  }

  if (btnManageVocabulary) {
    btnManageVocabulary.addEventListener("click", () => {
      const text = customPromptInput.value;
      modalVocabulary = parseVocabulary(text);
      
      vocabBulkContainer.classList.add("hidden");
      const currentLang = appLanguageSelect.value || "zh";
      btnToggleVocabBulk.textContent = currentLang === "zh" ? "切換至文字編輯" : "Switch to Bulk Edit";
      
      vocabularySearchInput.value = "";
      newVocabularyWordInput.value = "";
      
      renderVocabularyList();
      updateVocabCount();
      
      vocabularyModal.classList.remove("hidden");
    });
  }

  if (vocabularyCloseBtn) {
    vocabularyCloseBtn.addEventListener("click", () => {
      vocabularyModal.classList.add("hidden");
    });
  }

  if (vocabularySearchInput) {
    vocabularySearchInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      renderVocabularyList(target.value);
    });
  }

  if (btnAddVocabulary) {
    btnAddVocabulary.addEventListener("click", () => {
      const word = newVocabularyWordInput.value.trim();
      if (word) {
        if (!modalVocabulary.includes(word)) {
          modalVocabulary.unshift(word);
        }
        newVocabularyWordInput.value = "";
        renderVocabularyList(vocabularySearchInput.value);
        updateVocabCount();
      }
    });
  }

  if (btnToggleVocabBulk) {
    btnToggleVocabBulk.addEventListener("click", () => {
      const isHidden = vocabBulkContainer.classList.contains("hidden");
      const currentLang = appLanguageSelect.value || "zh";
      
      if (isHidden) {
        vocabBulkContainer.classList.remove("hidden");
        btnToggleVocabBulk.textContent = currentLang === "zh" ? "切換至列表檢視" : "Switch to List View";
      } else {
        vocabBulkContainer.classList.add("hidden");
        btnToggleVocabBulk.textContent = currentLang === "zh" ? "切換至文字編輯" : "Switch to Bulk Edit";
        modalVocabulary = parseVocabulary(vocabularyBulkTextarea.value);
        renderVocabularyList(vocabularySearchInput.value);
        updateVocabCount();
      }
    });
  }

  if (vocabularySaveBtn) {
    vocabularySaveBtn.addEventListener("click", async () => {
      if (!vocabBulkContainer.classList.contains("hidden")) {
        modalVocabulary = parseVocabulary(vocabularyBulkTextarea.value);
      }
      
      customPromptInput.value = modalVocabulary.join(', ');
      vocabularyModal.classList.add("hidden");
      await saveConfig();
    });
  }
});
