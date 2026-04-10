import { LlmInference, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest";

// ==========================================
// 1. CONFIG
// ==========================================
const CONFIG = {
  agent_name: "Opensky",
  creator: "Hafij Shaikh"
};

const SYSTEM_PROMPT = `
You are ${CONFIG.agent_name}, created by ${CONFIG.creator}.

Rules:
- Answer clearly and simply
- Keep responses short unless asked
- Never output broken or random text
- If unsure, say "I don't know"
`;

let history = [];
const MAX_HISTORY = 12;

// ==========================================
// 2. DOM
// ==========================================
const chat = document.getElementById("messagesArea");
const input = document.getElementById("inputText");
const sendBtn = document.getElementById("sendBtn");
const loadingScreen = document.getElementById("loadingScreen");

// ==========================================
// 3. MODEL
// ==========================================
let llm;
let isGenerating = false;

// ==========================================
// 4. GIBBERISH DETECTOR (KEEPED)
// ==========================================
function isGibberish(text) {
  const patterns = [/\.{4,}/, /{.*}/, /<\/?>/];
  let count = 0;
  patterns.forEach(p => { if (p.test(text)) count++; });
  return count >= 2;
}

// ==========================================
// 5. TOOLS (KEEPED)
// ==========================================
const Tools = {
  joke: async () => {
    const d = await (await fetch("https://v2.jokeapi.dev/joke/Any?type=single")).json();
    return d.joke;
  }
};

// SMART TOOL DETECTOR (NEW)
function detectTool(q) {
  q = q.toLowerCase();
  if (q.includes("joke")) return ["joke"];
  return null;
}

// ==========================================
// 6. PROMPT BUILDER (IMPORTANT)
// ==========================================
function buildPrompt(userInput) {
  let convo = history
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  return `
${SYSTEM_PROMPT}

${convo}

USER: ${userInput}
ASSISTANT:
`;
}

// ==========================================
// 7. UI HELPERS
// ==========================================
function addUserMessage(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="user-bubble">${text}</div>`;
  chat.appendChild(div);
  scrollBottom();
}

function addSkeleton() {
  const div = document.createElement("div");
  div.className = "message assistant";

  div.innerHTML = `
    <div class="assistant-content">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
  chat.appendChild(div);
  scrollBottom();
  return div;
}

function scrollBottom() {
  chat.scrollTop = chat.scrollHeight;
}

// ==========================================
// 8. MAIN GENERATION (FULL SYSTEM)
// ==========================================
async function runGemma(query) {
  const skeleton = addSkeleton();
  const contentDiv = skeleton.querySelector(".assistant-content");

  let finalText = "";
  let prompt = buildPrompt(query);

  // TOOL CHECK FIRST (FAST + STABLE)
  const tool = detectTool(query);
  if (tool) {
    const result = await Tools[tool[0]]();
    contentDiv.innerHTML = result;
    history.push({ role: "user", text: query });
    history.push({ role: "assistant", text: result });
    return;
  }

  try {
    await llm.generateResponse(prompt, (chunk, done) => {
      if (!isGenerating) return;

      finalText += chunk;

      // GIBBERISH PROTECTION
      if (isGibberish(finalText)) {
        finalText = "Generation error. Try again.";
        isGenerating = false;
      }

      // SMOOTH RENDER
      contentDiv.innerHTML = finalText;
      scrollBottom();

      if (done) {
        history.push({ role: "user", text: query });
        history.push({ role: "assistant", text: finalText });

        // LIMIT MEMORY
        while (history.length > MAX_HISTORY) history.shift();
      }
    });

  } catch (e) {
    contentDiv.innerHTML = `<span style="color:red">Error</span>`;
  }

  isGenerating = false;
  sendBtn.classList.remove("stop-btn");
}

// ==========================================
// 9. EVENTS
// ==========================================
async function handleSend() {
  if (isGenerating) {
    isGenerating = false;
    return;
  }

  const text = input.value.trim();
  if (!text) return;

  addUserMessage(text);
  input.value = "";

  isGenerating = true;
  sendBtn.classList.add("stop-btn");

  await runGemma(text);
}

sendBtn.onclick = handleSend;

input.onkeydown = e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

// ==========================================
// 10. LONG PRESS EDIT (ADDED)
// ==========================================
let pressTimer;

chat.addEventListener("mousedown", e => {
  const msg = e.target.closest(".message.user");
  if (!msg) return;

  pressTimer = setTimeout(() => {
    msg.classList.add("editing");
    input.value = msg.innerText;
    input.focus();
  }, 500);
});

chat.addEventListener("mouseup", () => clearTimeout(pressTimer));

// ==========================================
// 11. INIT WITH LOADER
// ==========================================
async function init() {
  const genai = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm"
  );

  llm = await LlmInference.createFromOptions(genai, {
    baseOptions: {
      modelAssetPath: "./gemma-4-E2B-it-int4-Web.litertlm"
    },
    maxTokens: 400,
    temperature: 0.6
  });

  loadingScreen.classList.add("hidden");
}

init();
