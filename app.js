/**
 * ==========================================================================
 * OpenRouter AI Assistant - Main Application Logic
 * ==========================================================================
 */

// 🔑 [실습용 API 키 입력란]
// 발급받으신 OpenRouter API 키를 아래 쌍따옴표 안에 넣어주세요!
// 예시: const DEFAULT_API_KEY = "sk-or-v1-1234567890abcdef...";
const DEFAULT_API_KEY = ""; 

// OpenRouter API Endpoint
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Application State
let state = {
  apiKey: DEFAULT_API_KEY,
  selectedModel: "google/gemini-2.0-flash-exp:free",
  enableWebSearch: true,
  systemPrompt: "당신은 첨부된 데이터 문서 및 검증된 사실에 기반하여 답변하는 전문 데이터 분석 AI 비서입니다. 사용자가 질문할 때 제공된 [참고 데이터 문서]를 최우선으로 검색하고 분석하여 명확하고 정확한 정보를 찾아 대답하세요. 데이터 문서에서 질문에 대한 답을 찾을 수 없다면 '제공된 데이터에서 해당 내용을 찾을 수 없습니다'라고 밝히거나 웹검색을 활용하세요.",
  conversations: [], // Array of chat objects { id, title, messages: [] }
  documents: [], // Array of uploaded doc objects { id, name, size, content, active }
  currentChatId: null,
  isGenerating: false
};

// DOM Elements
const elements = {
  sidebar: document.getElementById("sidebar"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  toggleKeyVisibility: document.getElementById("toggleKeyVisibility"),
  webSearchToggle: document.getElementById("webSearchToggle"),
  dropzone: document.getElementById("dropzone"),
  docFileInput: document.getElementById("docFileInput"),
  docFileList: document.getElementById("docFileList"),
  quickAttachBtn: document.getElementById("quickAttachBtn"),
  attachedDocsBar: document.getElementById("attachedDocsBar"),
  attachedDocsChips: document.getElementById("attachedDocsChips"),
  modelSelect: document.getElementById("modelSelect"),
  customModelInput: document.getElementById("customModelInput"),
  systemPromptInput: document.getElementById("systemPromptInput"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  currentModelBadge: document.getElementById("currentModelBadge"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  messagesList: document.getElementById("messagesList"),
  chatBody: document.getElementById("chatBody"),
  chatForm: document.getElementById("chatForm"),
  userPrompt: document.getElementById("userPrompt"),
  sendBtn: document.getElementById("sendBtn")
};

// Marked.js Configuration for Code Highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-'
});

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setupEventListeners();
  renderHistoryList();
  
  if (!state.currentChatId && state.conversations.length > 0) {
    switchChat(state.conversations[0].id);
  } else if (!state.currentChatId) {
    createNewChat();
  }
});

// Load Settings & Saved State from LocalStorage
function loadSettings() {
  const savedKey = localStorage.getItem("openrouter_api_key");
  if (savedKey) {
    state.apiKey = savedKey;
    elements.apiKeyInput.value = savedKey;
  } else if (DEFAULT_API_KEY) {
    state.apiKey = DEFAULT_API_KEY;
    elements.apiKeyInput.value = DEFAULT_API_KEY;
  }

  const savedModel = localStorage.getItem("openrouter_selected_model");
  if (savedModel) {
    state.selectedModel = savedModel;
    if (elements.modelSelect.querySelector(`option[value="${savedModel}"]`)) {
      elements.modelSelect.value = savedModel;
    } else {
      elements.modelSelect.value = "custom";
      elements.customModelInput.classList.remove("hidden");
      elements.customModelInput.value = savedModel;
    }
  }
  updateModelBadge();

  const savedWebSearch = localStorage.getItem("openrouter_web_search");
  if (savedWebSearch !== null) {
    state.enableWebSearch = savedWebSearch === "true";
    elements.webSearchToggle.checked = state.enableWebSearch;
  }

  const savedPrompt = localStorage.getItem("openrouter_system_prompt");
  if (savedPrompt) {
    state.systemPrompt = savedPrompt;
    elements.systemPromptInput.value = savedPrompt;
  } else {
    elements.systemPromptInput.value = state.systemPrompt;
  }

  const savedConversations = localStorage.getItem("openrouter_conversations");
  if (savedConversations) {
    try {
      state.conversations = JSON.parse(savedConversations);
    } catch (e) {
      state.conversations = [];
    }
  }

  const savedDocs = localStorage.getItem("openrouter_documents");
  if (savedDocs) {
    try {
      state.documents = JSON.parse(savedDocs);
    } catch (e) {
      state.documents = [];
    }
  }
  
  // Default Sample Document if empty
  if (state.documents.length === 0) {
    state.documents.push({
      id: "doc_sample_seoul_school",
      name: "seoul_school_facility.txt",
      size: "1.2 KB",
      content: `[서울시 학교별 학교시설 개방에 관한 사항 데이터 정보]
- 데이터명: 서울시 학교별 학교시설 개방에 관한 사항
- 데이터 설명: 서울특별시 소재의 학교별 학교시설 개방에 관한 사항에 필요한 정보인 체육장 개방여부, 체육관 개방여부, 강당 개방여부, 일반교과교실 개방여부, 특별교실 개방여부, 시청각실 개방여부 정보가 있습니다.
- 공개일자: 2024.05.10.
- 데이터 갱신일: 2026.09.01.
- 갱신주기: 비정기(자료변경시)
- 분류: 교육
- 원본시스템: 학교알리미 (https://www.schoolinfo.go.kr/)
- 저작권자: 한국교육학술정보원
- 제공기관: 서울특별시교육청
- 제공부서: 학교알리미
- 담당자 연락처: 1544-0079
- 메타정보 수정일: 2025.03.01.
- 이용허락범위: 공공누리 1유형 (출처표시, 상업적 이용 및 변경 가능)`,
      active: true
    });
    saveDocuments();
  }

  renderDocFileList();
  renderAttachedDocsChips();
}

// Event Listeners Registration
function setupEventListeners() {
  // Sidebar Toggles
  elements.toggleSidebarBtn.addEventListener("click", () => {
    elements.sidebar.classList.toggle("collapsed");
  });
  elements.closeSidebarBtn.addEventListener("click", () => {
    elements.sidebar.classList.add("collapsed");
  });

  // API Key Change & Visibility Toggle
  elements.apiKeyInput.addEventListener("input", (e) => {
    state.apiKey = e.target.value.trim();
    localStorage.setItem("openrouter_api_key", state.apiKey);
  });

  elements.toggleKeyVisibility.addEventListener("click", () => {
    const isPassword = elements.apiKeyInput.type === "password";
    elements.apiKeyInput.type = isPassword ? "text" : "password";
    elements.toggleKeyVisibility.querySelector("i").className = isPassword ? "ri-eye-off-line" : "ri-eye-line";
  });

  // Web Search Toggle
  elements.webSearchToggle.addEventListener("change", (e) => {
    state.enableWebSearch = e.target.checked;
    localStorage.setItem("openrouter_web_search", state.enableWebSearch);
  });

  // Dropzone & Document Upload Event Listeners
  if (elements.dropzone) {
    elements.dropzone.addEventListener("click", () => elements.docFileInput.click());
    
    elements.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      elements.dropzone.classList.add("dragover");
    });

    elements.dropzone.addEventListener("dragleave", () => {
      elements.dropzone.classList.remove("dragover");
    });

    elements.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      elements.dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });
  }

  if (elements.docFileInput) {
    elements.docFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFilesUpload(e.target.files);
      }
    });
  }

  if (elements.quickAttachBtn) {
    elements.quickAttachBtn.addEventListener("click", () => elements.docFileInput.click());
  }

  // Model Selection
  elements.modelSelect.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      elements.customModelInput.classList.remove("hidden");
      state.selectedModel = elements.customModelInput.value.trim() || "google/gemini-2.0-flash-exp:free";
    } else {
      elements.customModelInput.classList.add("hidden");
      state.selectedModel = e.target.value;
    }
    localStorage.setItem("openrouter_selected_model", state.selectedModel);
    updateModelBadge();
  });

  elements.customModelInput.addEventListener("input", (e) => {
    state.selectedModel = e.target.value.trim();
    localStorage.setItem("openrouter_selected_model", state.selectedModel);
    updateModelBadge();
  });

  // System Prompt Change
  elements.systemPromptInput.addEventListener("input", (e) => {
    state.systemPrompt = e.target.value;
    localStorage.setItem("openrouter_system_prompt", state.systemPrompt);
  });

  // New Chat & Clear History
  elements.newChatBtn.addEventListener("click", createNewChat);
  elements.clearHistoryBtn.addEventListener("click", clearAllHistory);

  // Auto-resize Textarea
  elements.userPrompt.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
  });

  // Enter Key Handling (Shift+Enter for newline)
  elements.userPrompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      elements.chatForm.dispatchEvent(new Event("submit"));
    }
  });

  // Form Submit
  elements.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Quick Prompts Click Event
  document.querySelectorAll(".prompt-card").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        elements.userPrompt.value = prompt;
        handleSendMessage();
      }
    });
  });
}

function updateModelBadge() {
  elements.currentModelBadge.textContent = state.selectedModel || "모델 미선택";
}

// Document Knowledgebase Processing (FileReader)
function handleFilesUpload(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const docObj = {
        id: "doc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        name: file.name,
        size: formatFileSize(file.size),
        content: content,
        active: true
      };
      
      // Prevent Duplicate Filenames
      state.documents = state.documents.filter(d => d.name !== file.name);
      state.documents.push(docObj);
      saveDocuments();
      renderDocFileList();
      renderAttachedDocsChips();
    };
    reader.readAsText(file, "UTF-8");
  });
  elements.docFileInput.value = "";
}

function saveDocuments() {
  localStorage.setItem("openrouter_documents", JSON.stringify(state.documents));
}

function renderDocFileList() {
  if (!elements.docFileList) return;
  elements.docFileList.innerHTML = "";

  if (state.documents.length === 0) {
    elements.docFileList.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:6px;">첨부된 문서가 없습니다.</div>`;
    return;
  }

  state.documents.forEach(doc => {
    const card = document.createElement("div");
    card.className = "doc-file-card";
    card.innerHTML = `
      <div class="doc-file-info">
        <input type="checkbox" ${doc.active ? "checked" : ""} class="doc-toggle-chk" title="답변에 반영 여부">
        <i class="ri-file-text-line"></i>
        <div>
          <div class="doc-file-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</div>
          <div class="doc-file-size">${doc.size}</div>
        </div>
      </div>
      <div class="doc-file-actions">
        <button class="doc-remove-btn" title="삭제"><i class="ri-close-line"></i></button>
      </div>
    `;

    card.querySelector(".doc-toggle-chk").addEventListener("change", (e) => {
      doc.active = e.target.checked;
      saveDocuments();
      renderAttachedDocsChips();
    });

    card.querySelector(".doc-remove-btn").addEventListener("click", () => {
      deleteDocument(doc.id);
    });

    elements.docFileList.appendChild(card);
  });
}

function deleteDocument(docId) {
  state.documents = state.documents.filter(d => d.id !== docId);
  saveDocuments();
  renderDocFileList();
  renderAttachedDocsChips();
}

function renderAttachedDocsChips() {
  if (!elements.attachedDocsBar || !elements.attachedDocsChips) return;
  
  const activeDocs = state.documents.filter(d => d.active);
  if (activeDocs.length === 0) {
    elements.attachedDocsBar.classList.add("hidden");
    elements.attachedDocsChips.innerHTML = "";
    return;
  }

  elements.attachedDocsBar.classList.remove("hidden");
  elements.attachedDocsChips.innerHTML = activeDocs.map(d => `
    <span class="doc-chip"><i class="ri-file-code-line"></i> ${escapeHtml(d.name)}</span>
  `).join("");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Chat Management
function createNewChat() {
  const newChat = {
    id: "chat_" + Date.now(),
    title: "새 대화",
    messages: []
  };
  state.conversations.unshift(newChat);
  saveConversations();
  switchChat(newChat.id);
}

function switchChat(chatId) {
  state.currentChatId = chatId;
  const currentChat = getCurrentChat();
  renderHistoryList();
  renderMessages();
}

function getCurrentChat() {
  return state.conversations.find(c => c.id === state.currentChatId);
}

function saveConversations() {
  localStorage.setItem("openrouter_conversations", JSON.stringify(state.conversations));
}

function renderHistoryList() {
  elements.historyList.innerHTML = "";
  state.conversations.forEach(chat => {
    const item = document.createElement("div");
    item.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
    
    item.innerHTML = `
      <span class="title">${escapeHtml(chat.title)}</span>
      <i class="ri-delete-bin-line delete-chat" title="삭제"></i>
    `;

    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-chat")) {
        e.stopPropagation();
        deleteChat(chat.id);
      } else {
        switchChat(chat.id);
      }
    });

    elements.historyList.appendChild(item);
  });
}

function deleteChat(chatId) {
  state.conversations = state.conversations.filter(c => c.id !== chatId);
  saveConversations();
  if (state.currentChatId === chatId) {
    if (state.conversations.length > 0) {
      switchChat(state.conversations[0].id);
    } else {
      createNewChat();
    }
  } else {
    renderHistoryList();
  }
}

function clearAllHistory() {
  if (confirm("모든 대화 기록을 삭제하시겠습니까?")) {
    state.conversations = [];
    saveConversations();
    createNewChat();
  }
}

// Message Rendering
function renderMessages() {
  const chat = getCurrentChat();
  if (!chat || chat.messages.length === 0) {
    elements.welcomeScreen.classList.remove("hidden");
    elements.messagesList.innerHTML = "";
    return;
  }

  elements.welcomeScreen.classList.add("hidden");
  elements.messagesList.innerHTML = "";

  chat.messages.forEach(msg => {
    appendMessageUI(msg.role, msg.content);
  });

  scrollToBottom();
}

function appendMessageUI(role, content = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${role}`;

  const isUser = role === "user";
  const avatarIcon = isUser ? `<i class="ri-user-3-line"></i>` : `<i class="ri-sparkling-fill"></i>`;
  
  wrapper.innerHTML = `
    <div class="avatar">${avatarIcon}</div>
    <div class="message-content-box">
      <div class="message-bubble">${isUser ? escapeHtml(content) : marked.parse(content)}</div>
      <div class="message-meta">
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        ${!isUser ? `<button class="copy-btn" title="복사"><i class="ri-file-copy-line"></i></button>` : ''}
      </div>
    </div>
  `;

  if (!isUser) {
    const copyBtn = wrapper.querySelector(".copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(content);
        copyBtn.innerHTML = `<i class="ri-check-line"></i>`;
        setTimeout(() => copyBtn.innerHTML = `<i class="ri-file-copy-line"></i>`, 2000);
      });
    }
  }

  elements.messagesList.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function appendTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper assistant typing-wrapper";
  wrapper.innerHTML = `
    <div class="avatar"><i class="ri-sparkling-fill"></i></div>
    <div class="message-content-box">
      <div class="message-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  elements.messagesList.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function scrollToBottom() {
  elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
}

// OpenRouter API Communication with Streaming
async function handleSendMessage() {
  const text = elements.userPrompt.value.trim();
  if (!text || state.isGenerating) return;

  const apiKey = state.apiKey || DEFAULT_API_KEY;
  if (!apiKey) {
    alert("OpenRouter API 키를 설정해주세요! 사이드바의 API 키 입력란 또는 app.js의 DEFAULT_API_KEY에 입력할 수 있습니다.");
    elements.sidebar.classList.remove("collapsed");
    elements.apiKeyInput.focus();
    return;
  }

  const chat = getCurrentChat();
  if (!chat) return;

  // Add User Message
  if (chat.messages.length === 0) {
    chat.title = text.length > 20 ? text.substring(0, 20) + "..." : text;
  }

  chat.messages.push({ role: "user", content: text });
  elements.userPrompt.value = "";
  elements.userPrompt.style.height = "auto";
  renderMessages();

  state.isGenerating = true;
  elements.sendBtn.disabled = true;

  const typingIndicator = appendTypingIndicator();

  // Build Knowledge Context from Active Documents (RAG)
  let knowledgeContext = "";
  const activeDocs = state.documents.filter(d => d.active);
  if (activeDocs.length > 0) {
    knowledgeContext = "\n\n=== 📄 [사용자 데이터 지식베이스 (첨부된 문서)] ===\n" +
      activeDocs.map(d => `--- [파일명: ${d.name}] ---\n${d.content}`).join("\n\n") +
      "\n=== [데이터 문서 끝] ===";
  }

  // Prepare Payload with Dynamic Knowledge Context
  const fullSystemPrompt = state.systemPrompt + knowledgeContext;
  const apiMessages = [
    { role: "system", content: fullSystemPrompt },
    ...chat.messages.map(m => ({ role: m.role, content: m.content }))
  ];

  // Request Payload Assembly
  const requestPayload = {
    model: state.selectedModel,
    messages: apiMessages,
    stream: true
  };

  // OpenRouter 웹 검색 플러그인 활성화 (할루시네이션 방지 및 실시간 웹검색)
  if (state.enableWebSearch) {
    requestPayload.plugins = [
      {
        id: "web"
      }
    ];
  }

  let assistantContent = "";
  let assistantMessageBubble = null;
  let assistantWrapper = null;

  try {
    // OpenRouter 호출 시 CORS Preflight 이슈를 방지하기 위해 표준 헤더만 전송합니다.
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error("API 키가 올바르지 않거나 유효하지 않습니다. (401 Unauthorized)");
      } else if (response.status === 402) {
        throw new Error("OpenRouter 계정 잔액(Credit)이 부족합니다.");
      } else if (response.status === 404) {
        throw new Error(`선택하신 모델(${state.selectedModel})을 찾을 수 없거나 제공되지 않습니다.`);
      }
      throw new Error(errData.error?.message || `API 오류 (상태 코드: ${response.status})`);
    }

    typingIndicator.remove();

    assistantWrapper = document.createElement("div");
    assistantWrapper.className = "message-wrapper assistant";
    assistantWrapper.innerHTML = `
      <div class="avatar"><i class="ri-sparkling-fill"></i></div>
      <div class="message-content-box">
        <div class="message-bubble"></div>
        <div class="message-meta">
          <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button class="copy-btn" title="복사"><i class="ri-file-copy-line"></i></button>
        </div>
      </div>
    `;
    elements.messagesList.appendChild(assistantWrapper);
    assistantMessageBubble = assistantWrapper.querySelector(".message-bubble");

    // Copy Event
    const copyBtn = assistantWrapper.querySelector(".copy-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(assistantContent);
      copyBtn.innerHTML = `<i class="ri-check-line"></i>`;
      setTimeout(() => copyBtn.innerHTML = `<i class="ri-file-copy-line"></i>`, 2000);
    });

    // Stream Reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.replace("data: ", "");
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices[0]?.delta?.content || "";
            assistantContent += delta;
            assistantMessageBubble.innerHTML = marked.parse(assistantContent);
            scrollToBottom();
          } catch (e) {
            // Ignore partial JSON parse errors
          }
        }
      }
    }

    chat.messages.push({ role: "assistant", content: assistantContent });
    saveConversations();
    renderHistoryList();

  } catch (error) {
    if (typingIndicator) typingIndicator.remove();
    
    appendMessageUI("assistant", `⚠️ **오류가 발생했습니다:** ${error.message}\n\nAPI 키와 선택한 모델이 올바른지 확인해주세요.`);
  } finally {
    state.isGenerating = false;
    elements.sendBtn.disabled = false;
  }
}

// Helper Utilities
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
