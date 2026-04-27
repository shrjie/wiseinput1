/**
 * EchoMind App Logic
 */

class EchoMind {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.visualizerBars = [];
    this.animationId = null;
    this.ipcRenderer = null;
    this.backupTranscript = "";
    this.recognition = null;

    // DOM Elements
    this.recordBtn = document.getElementById('recordBtn');
    this.micIcon = document.getElementById('micIcon');
    this.statusText = document.getElementById('statusText');
    this.visualizer = document.getElementById('visualizer');
    this.rawTranscriptArea = document.getElementById('rawTranscript');
    this.refinedTextArea = document.getElementById('refinedText');
    this.templateChips = document.querySelectorAll('.template-chip');
    this.copyBtn = document.getElementById('copyBtn');

    // Feature Elements
    this.langSelect = document.getElementById('langSelect');
    this.historyContainer = document.getElementById('historyContainer');
    this.clearHistoryBtn = document.getElementById('clearHistory');

    // Settings Elements
    this.settingsToggle = document.getElementById('settingsToggle');
    this.settingsModal = document.getElementById('settingsModal');
    this.closeSettings = document.getElementById('closeSettings');
    this.saveSettings = document.getElementById('saveSettings');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.geminiKeyInput = document.getElementById('geminiKeyInput');
    this.groqKeyInput = document.getElementById('groqKeyInput');
    this.aiProviderSelect = document.getElementById('aiProvider');
    this.geminiSection = document.getElementById('geminiSection');
    this.groqSection = document.getElementById('groqSection');
    this.testWhisperBtn = document.getElementById('testWhisper');
    this.testGeminiBtn = document.getElementById('testGemini');
    this.testGroqBtn = document.getElementById('testGroq');
    this.settingsStatus = document.getElementById('settingsStatus');
    this.exitAppBtn = document.getElementById('exitApp');

    this.init();
    this.setupElectron();
    this.handleWebCompatibility();
    this.loadSettings();
    this.loadHistory();
    this.requestMicPermission();
  }

  isElectron() {
    return (typeof process !== 'undefined' && process.versions && process.versions.electron);
  }

  handleWebCompatibility() {
    if (!this.isElectron()) {
      // 網頁版隱藏結束按鈕及其分隔線
      if (this.exitAppBtn) this.exitAppBtn.style.display = 'none';
      const headerGlass = document.querySelector('header .glass-panel');
      if (headerGlass) {
        const divider = headerGlass.querySelector('div[style*="height: 16px"]');
        if (divider) divider.style.display = 'none';
        headerGlass.style.padding = '4px 8px';
      }
      
      // 網頁版隱藏拖拽區域提示 (滑鼠游標改回預設)
      const dragRegion = document.querySelector('.drag-region');
      if (dragRegion) dragRegion.style.cursor = 'default';
    }
  }

  loadHistory() {
    const history = JSON.parse(localStorage.getItem('echomind_history') || '[]');
    this.historyContainer.innerHTML = '';
    if (history.length === 0) {
      this.historyContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; text-align: center; opacity: 0.3; padding: 10px;">尚無紀錄</div>';
      return;
    }
    history.forEach(item => this.renderHistoryItem(item));
    this.updateStats();
  }

  addToHistory(text) {
    const history = JSON.parse(localStorage.getItem('echomind_history') || '[]');
    const newItem = { text, time: new Date().toLocaleTimeString(), id: Date.now() };
    history.unshift(newItem);
    localStorage.setItem('echomind_history', JSON.stringify(history.slice(0, 20)));
    this.loadHistory();
  }

  renderHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.style.cssText = 'background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; margin-bottom: 8px;';
    div.innerHTML = `<div style="display: flex; justify-content: space-between; color: var(--text-dim); font-size: 0.7rem; margin-bottom: 4px;">
      <span>${item.time}</span>
      <i data-lucide="external-link" style="width: 10px;"></i>
    </div>
    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${item.text}</div>`;
    div.onclick = () => {
      this.refinedTextArea.innerText = item.text;
      this.showStatus("✅ 已載入紀錄", "var(--accent-primary)");
    };
    this.historyContainer.appendChild(div);
    lucide.createIcons();
  }

  updateStats() {
    const history = JSON.parse(localStorage.getItem('echomind_history') || '[]');
    const stats = document.querySelectorAll('footer strong');
    if (stats.length >= 1) stats[0].innerText = history.length;
  }

  async requestMicPermission() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.showStatus("🎤 麥克風已就緒", "var(--text-dim)");
    } catch (err) {
      console.error("Mic permission denied:", err);
      this.showStatus("❌ 請允許麥克風權限", "#ef4444");
    }
  }
  setupElectron() {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        this.ipcRenderer = ipcRenderer;
        this.ipcRenderer.on('toggle-record', () => this.toggleRecording());
      } catch (e) {
        console.warn("Electron IPC not available:", e);
      }
    }
  }

  loadSettings() {
    try {
      const openaiKey = localStorage.getItem('openai_api_key');
      const geminiKey = localStorage.getItem('gemini_api_key');
      const groqKey = localStorage.getItem('groq_api_key');
      const provider = localStorage.getItem('ai_provider') || 'gemini';

      if (openaiKey && this.apiKeyInput) this.apiKeyInput.value = openaiKey;
      if (geminiKey && this.geminiKeyInput) this.geminiKeyInput.value = geminiKey;
      if (groqKey && this.groqKeyInput) this.groqKeyInput.value = groqKey;
      
      if (this.aiProviderSelect) {
        this.aiProviderSelect.value = provider;
        if (this.geminiSection) this.geminiSection.style.display = provider === 'gemini' ? 'flex' : 'none';
        if (this.groqSection) this.groqSection.style.display = provider === 'groq' ? 'flex' : 'none';
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  }

  init() {
    this.setupVisualizer();
    this.bindEvents();
  }

  setupVisualizer() {
    for (let i = 0; i < 30; i++) {
      const bar = document.createElement('div');
      bar.className = 'wave-bar';
      this.visualizer.appendChild(bar);
      this.visualizerBars.push(bar);
    }
  }

  bindEvents() {
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    
    // Settings & Testing
    if (this.settingsToggle) {
      this.settingsToggle.addEventListener('click', () => {
        if (this.settingsModal) {
          this.settingsModal.style.display = 'block';
          this.loadSettings();
        }
      });
    }
    
    if (this.closeSettings) this.closeSettings.addEventListener('click', () => this.settingsModal.style.display = 'none');
    if (this.testWhisperBtn) this.testWhisperBtn.addEventListener('click', () => this.testWhisperKey());
    if (this.testGeminiBtn) this.testGeminiBtn.addEventListener('click', () => this.testGeminiKey());
    if (this.testGroqBtn) this.testGroqBtn.addEventListener('click', () => this.testGroqKey());
    
    // Auto-save on Input
    if (this.apiKeyInput) {
      this.apiKeyInput.addEventListener('input', () => {
        localStorage.setItem('openai_api_key', this.apiKeyInput.value);
      });
    }
    if (this.geminiKeyInput) {
      this.geminiKeyInput.addEventListener('input', () => {
        localStorage.setItem('gemini_api_key', this.geminiKeyInput.value);
      });
    }
    if (this.groqKeyInput) {
      this.groqKeyInput.addEventListener('input', () => {
        localStorage.setItem('groq_api_key', this.groqKeyInput.value);
      });
    }
    if (this.aiProviderSelect) {
      this.aiProviderSelect.addEventListener('change', () => {
        const provider = this.aiProviderSelect.value;
        localStorage.setItem('ai_provider', provider);
        if (this.geminiSection) this.geminiSection.style.display = provider === 'gemini' ? 'flex' : 'none';
        if (this.groqSection) this.groqSection.style.display = provider === 'groq' ? 'flex' : 'none';
      });
    }

    if (this.exitAppBtn) {
      this.exitAppBtn.addEventListener('click', () => {
        if (confirm('確定要結束 EchoMind 嗎？')) {
          window.close();
        }
      });
    }
    
    this.saveSettings.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
      this.showStatus("✅ 設定已更新", "var(--accent-primary)");
    });

    this.clearHistoryBtn.addEventListener('click', () => {
      if (confirm('確定要清除所有歷史紀錄嗎？')) {
        localStorage.removeItem('echomind_history');
        this.loadHistory();
      }
    });

    this.templateChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.templateChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (this.rawTranscriptArea.innerText && !this.rawTranscriptArea.innerText.startsWith("聆聽中")) this.processWithTemplate(chip.dataset.template);
      });
    });

    this.copyBtn.addEventListener('click', () => this.copyToClipboard(this.refinedTextArea.innerText));
  }

  showSettingsStatus(msg, isError = false) {
    this.settingsStatus.innerText = msg;
    this.settingsStatus.style.color = isError ? "#ef4444" : "#10b981";
  }

  // --- API Testing Logic ---

  async testWhisperKey() {
    const key = this.apiKeyInput.value;
    if (!key) return this.showSettingsStatus("❌ 請輸入 OpenAI Key", true);
    this.testWhisperBtn.innerText = "⏳";
    this.showSettingsStatus("正在檢測 OpenAI...", false);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      const data = await response.json();
      if (response.ok) {
        this.showSettingsStatus("✅ OpenAI 金鑰驗證成功！", false);
        localStorage.setItem('openai_api_key', key);
      } else {
        // 特別抓出餘額不足的訊息
        if (data.error?.code === "insufficient_quota") {
          throw new Error("帳戶餘額不足 (Quota Exceeded)，請至 OpenAI 儲值。");
        }
        throw new Error(data.error?.message || "驗證失敗");
      }
    } catch (e) {
      this.showSettingsStatus("❌ Whisper 錯誤: " + e.message, true);
    } finally {
      this.testWhisperBtn.innerText = "檢測";
    }
  }

  async testGeminiKey() {
    const key = this.geminiKeyInput.value;
    if (!key) return this.showSettingsStatus("❌ 請輸入 Gemini Key", true);
    this.testGeminiBtn.innerText = "⏳";
    this.showSettingsStatus("正在偵測可用模型...", false);

    const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
    let lastError = "";

    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
        });
        const data = await response.json();
        if (response.ok && !data.error) {
          this.showSettingsStatus(`✅ Gemini 驗證成功！(使用 ${model})`, false);
          localStorage.setItem('gemini_api_key', key);
          localStorage.setItem('gemini_working_model', model); // 記錄工作的模型
          this.testGeminiBtn.innerText = "檢測";
          return;
        }
        lastError = data.error?.message || "未知錯誤";
      } catch (e) {
        lastError = e.message;
      }
    }

    this.showSettingsStatus(`❌ Gemini 錯誤: ${lastError}`, true);
    this.testGeminiBtn.innerText = "檢測";
  }

  async testGroqKey() {
    const key = this.groqKeyInput.value;
    if (!key) return this.showSettingsStatus("❌ 請輸入 Groq Key", true);
    this.testGroqBtn.innerText = "⏳";
    this.showSettingsStatus("正在檢測 Groq...", false);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: "hi" }]
        })
      });
      const data = await response.json();
      if (response.ok) {
        this.showSettingsStatus("✅ Groq 驗證成功！", false);
        localStorage.setItem('groq_api_key', key);
      } else {
        throw new Error(data.error?.message || "驗證失敗");
      }
    } catch (e) {
      this.showSettingsStatus("❌ Groq 錯誤: " + e.message, true);
    } finally {
      this.testGroqBtn.innerText = "檢測";
    }
  }

  // --- Recording Flow ---

  async toggleRecording() {
    if (this.isRecording) this.stopRecording();
    else await this.startRecording();
  }

  async startRecording() {
    try {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      // 1. 初始化 Whisper 錄音
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => this.audioChunks.push(event.data);
      this.mediaRecorder.onstop = () => this.handleRecordingComplete();
      this.mediaRecorder.start();

      // 2. 初始化「備援辨識」(Web Speech API)
      this.backupTranscript = "";
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.langSelect.value === 'auto' ? 'zh-TW' : this.langSelect.value;
        
        this.recognition.onresult = (event) => {
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
          }
          if (final) this.backupTranscript += final;
        };
        this.recognition.start();
      }

      this.isRecording = true;
      this.updateUIStatus(true);
      this.startVisualizer(this.stream);
      this.rawTranscriptArea.innerText = "聆聽中... (停止後將優先使用 Whisper)";
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("無法存取麥克風。請確認權限設定。");
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      if (this.recognition) this.recognition.stop();
      this.isRecording = false;
      this.updateUIStatus(false);
      this.stopVisualizer();
    }
  }

  updateUIStatus(recording) {
    if (recording) {
      document.body.classList.add('recording-active');
      this.recordBtn.classList.add('recording');
      this.statusText.innerText = "🔴 錄音中 (全域監聽)";
      this.statusText.style.color = "#ef4444";
      this.micIcon.setAttribute('data-lucide', 'square');
    } else {
      document.body.classList.remove('recording-active');
      this.recordBtn.classList.remove('recording');
      this.statusText.innerText = "✨ 正在整段辨識...";
      this.statusText.style.color = "var(--accent-primary)";
      this.micIcon.setAttribute('data-lucide', 'mic');
    }
    lucide.createIcons();
  }

  startVisualizer(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < this.visualizerBars.length; i++) {
        const value = dataArray[i % bufferLength];
        const height = Math.max(4, (value / 255) * 80);
        this.visualizerBars[i].style.height = `${height}px`;
        this.visualizerBars[i].style.opacity = 0.3 + (value / 255) * 0.7;
      }
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  stopVisualizer() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.visualizerBars.forEach(bar => {
      bar.style.height = '4px';
      bar.style.opacity = '0.2';
    });
  }

  async handleRecordingComplete() {
    const openaiKey = localStorage.getItem('openai_api_key');
    const groqKey = localStorage.getItem('groq_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    const lang = this.langSelect.value;
    
    if (this.audioChunks.length === 0) {
      this.showStatus("❌ 錄音失敗：無音訊數據", "#ef4444");
      return;
    }
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.statusText.innerText = "🚀 正在進行整段辨識...";

    // --- 階段 1：優先嘗試 Groq (極速) ---
    if (groqKey) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-large-v3');
        if (lang !== 'auto') formData.append('language', lang);

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}` },
          body: formData
        });

        const data = await response.json();
        if (data.text) {
          this.rawTranscriptArea.innerText = data.text;
          this.showStatus("✅ Groq 辨識成功", "var(--accent-primary)");
          this.processWithTemplate(document.querySelector('.template-chip.active')?.dataset.template || 'clean', true);
          return;
        }
      } catch (err) {
        console.warn("Groq STT 失敗，嘗試備援...", err);
      }
    }

    // --- 階段 2：嘗試 OpenAI (Whisper) ---
    if (openaiKey) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        if (lang !== 'auto') formData.append('language', lang);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          body: formData
        });

        const data = await response.json();
        if (data.text) {
          this.rawTranscriptArea.innerText = data.text;
          this.showStatus("✅ OpenAI 辨識成功", "var(--accent-primary)");
          this.processWithTemplate(document.querySelector('.template-chip.active')?.dataset.template || 'clean', true);
          return;
        }
      } catch (err) {
        console.warn("OpenAI STT 失敗，嘗試 Gemini 救災...", err);
      }
    }

    // --- 階段 3：終極救災 (Gemini STT) ---
    if (geminiKey) {
      this.showStatus("⚠️ 正在使用 Gemini 備援辨識...", "#f59e0b");
      const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
      let lastError = "";

      for (const modelName of modelsToTry) {
        try {
          const base64Audio = await this.blobToBase64(audioBlob);
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: "這是一段語音錄音，請幫我轉成繁體中文逐字稿。只要輸出逐字稿內容，不要有任何其他廢話：" },
                  { inline_data: { mime_type: "audio/webm", data: base64Audio } }
                ]
              }]
            })
          });
          
          const data = await response.json();
          if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
            const text = data.candidates[0].content.parts[0].text.trim();
            this.rawTranscriptArea.innerText = text;
            this.showStatus("✅ Gemini 救災辨識成功", "var(--accent-primary)");
            this.processWithTemplate(document.querySelector('.template-chip.active')?.dataset.template || 'clean', true);
            return;
          }
        } catch (e) { lastError = e.message; }
      }
    }

    this.showStatus("❌ 所有辨識方法均失敗", "#ef4444");
    this.rawTranscriptArea.innerText = "無法辨識語音，請檢查網路或 API 設定。";
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async processWithTemplate(template, autoOutput = false) {
    const raw = this.rawTranscriptArea.innerText;
    const provider = localStorage.getItem('ai_provider') || 'gemini';
    const geminiKey = localStorage.getItem('gemini_api_key');
    const groqKey = localStorage.getItem('groq_api_key');
    const workingModel = localStorage.getItem('gemini_working_model') || "gemini-1.5-flash";
    
    if (!raw || raw.startsWith("聆聽中") || raw.startsWith("辨識失敗")) return;

    if (provider === 'gemini' && !geminiKey) {
      this.showStatus("⚠️ 未設定 Gemini Key", "#f59e0b");
      this.refinedTextArea.innerText = raw;
      if (autoOutput) this.handleFinalOutput(raw);
      return;
    }
    if (provider === 'groq' && !groqKey) {
      this.showStatus("⚠️ 未設定 Groq Key", "#f59e0b");
      this.refinedTextArea.innerText = raw;
      if (autoOutput) this.handleFinalOutput(raw);
      return;
    }

    this.refinedTextArea.innerHTML = `<div class="loading-spinner" style="opacity: 0.5;">${provider === 'groq' ? 'Groq' : 'Gemini'} 正在潤色整段內容...</div>`;
    this.statusText.innerText = "✨ AI 正在潤色...";

    let promptContext = "";
    switch(template) {
      case 'summary': promptContext = "請將以下語音內容縮減為極簡摘要，限制在15個字以內："; break;
      case 'classical': promptContext = "請將以下現代口語轉化為優雅的文言文："; break;
      case 'meeting': promptContext = "請將以下內容整理為會議紀錄，含討論重點與決議："; break;
      default: promptContext = "請潤飾以下內容，去除贅字、修正語法並補上標點，保持語氣自然：";
    }

    const fullPrompt = `${promptContext}\n\n"${raw}"`;

    try {
      if (provider === 'groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: fullPrompt }],
            temperature: 0.7
          })
        });
        const data = await response.json();
        if (data.choices && data.choices[0].message) {
          const refined = data.choices[0].message.content.trim();
          this.finalizeRefinement(refined, autoOutput);
        } else {
          throw new Error(data.error?.message || "Groq 處理失敗");
        }
      } else {
        // Gemini 邏輯
        const tryFetch = async (modelName) => {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
          });
          return res;
        };

        let response = await tryFetch(workingModel);
        let data = await response.json();

        if (!response.ok || data.error) {
          const fallbackModel = (workingModel === "gemini-pro") ? "gemini-1.5-flash" : "gemini-pro";
          response = await tryFetch(fallbackModel);
          data = await response.json();
        }

        if (data.error) throw new Error(data.error.message);
        
        const refined = data.candidates[0].content.parts[0].text.trim();
        this.finalizeRefinement(refined, autoOutput);
      }
    } catch (err) {
      console.error("AI Refinement Error:", err);
      const errorMsg = err.message || "未知 API 錯誤";
      this.showStatus("❌ 潤色失敗: " + errorMsg, "#ef4444");
      this.refinedTextArea.innerText = raw + `\n\n(潤色失敗: ${errorMsg})`;
      if (autoOutput) this.handleFinalOutput(raw);
    }
  }

  finalizeRefinement(refined, autoOutput) {
    this.refinedTextArea.innerText = refined;
    this.addToHistory(refined); 
    this.statusText.innerText = "✅ 處理完成並已複製";
    if (autoOutput) this.handleFinalOutput(refined);
  }

  handleFinalOutput(text) {
    // 1. Copy to clipboard
    navigator.clipboard.writeText(text);

    // 2. If in Electron, send to Main Process for Auto-Paste
    if (this.ipcRenderer) {
      this.ipcRenderer.send('auto-paste', text);
      this.showStatus("✅ 已自動貼上！", "#10b981");
    } else {
      this.showStatus("✅ 已自動複製，請按 Ctrl+V", "#10b981");
    }
  }

  showStatus(msg, color) {
    const originalText = "就緒";
    this.statusText.innerText = msg;
    this.statusText.style.color = color || "var(--text-dim)";
    setTimeout(() => {
      this.statusText.innerText = originalText;
      this.statusText.style.color = "var(--text-dim)";
    }, 3000);
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showStatus("✨ 內容已複製 ✨", "var(--accent-primary)");
    });
  }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
  new EchoMind();
});
