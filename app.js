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
  systemPrompt: "당신은 친절하고 정직한 AI 비서입니다. 정보나 사실관계를 물어볼 때 지어내거나 추측하지 마세요 (할루시네이션 방지). 웹 검색 결과 및 검증된 최신 사실에 기반하여 명확하고 정확하게 한국어로 답변해 주세요.",
  conversations: [], // Array of chat objects { id, title, messages: [] }
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

  // Prepare Payload
  const apiMessages = [
    { role: "system", content: state.systemPrompt },
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
