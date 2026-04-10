import { LlmInference, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest";

/* ================= CONFIG ================= */
const CONFIG = {
  NAME: "Opensky",
  MAX_HISTORY: 12
};

/* ================= DOM ================= */
const chat = document.getElementById("messagesArea");
const input = document.getElementById("inputText");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearChatBtn");
const loader = document.getElementById("loadingScreen");
const loaderStatus = document.getElementById("loaderStatus");

/* ================= STATE ================= */
let llm = null;
let history = [];
let isGenerating = false;

/* ================= INIT ================= */
async function initializeModel() {
  try {
    loaderStatus.innerText = "Loading engine...";

    const genai = await FilesetResolver.forGenAiTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm"
    );

    loaderStatus.innerText = "Downloading model...";

    llm = await LlmInference.createFromOptions(genai, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-assets/gemma-2b-it-int4.bin"
      },
      temperature: 0.6,
      maxTokens: 400
    });

    loaderStatus.innerText = "Ready";

    setTimeout(() => {
      loader.style.display = "none";
    }, 500);

  } catch (error) {
    loaderStatus.innerText = "Failed to load model";
    console.error(error);
  }
}

/* ================= UI HELPERS ================= */
function createUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "message user";

  const bubble = document.createElement("div");
  bubble.className = "user-bubble";
  bubble.innerText = text;

  msg.appendChild(bubble);
  chat.appendChild(msg);
}

function createAssistantMessage() {
  const msg = document.createElement("div");
  msg.className = "message assistant";

  const content = document.createElement("div");
  content.className = "assistant-content";

  msg.appendChild(content);
  chat.appendChild(msg);

  return content;
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

/* ================= PROMPT ================= */
function buildPrompt(userInput) {
  let conversation = "";

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    conversation += `${item.role.toUpperCase()}: ${item.text}\n`;
  }

  return `
You are Opensky AI. Answer clearly and naturally.

${conversation}

USER: ${userInput}
ASSISTANT:
`;
}

/* ================= GENERATION ================= */
async function generateResponse(userText) {
  if (!llm) return;

  const outputBox = createAssistantMessage();

  let generatedText = "";
  isGenerating = true;

  const prompt = buildPrompt(userText);

  try {
    await llm.generateResponse(prompt, (chunk, done) => {

      if (!isGenerating) return;

      generatedText += chunk;

      outputBox.innerHTML = generatedText + `<span class="cursor"></span>`;
      scrollToBottom();

      if (done) {
        outputBox.innerHTML = generatedText;

        history.push({ role: "user", text: userText });
        history.push({ role: "assistant", text: generatedText });

        if (history.length > CONFIG.MAX_HISTORY) {
          history.shift();
        }

        isGenerating = false;
      }

    });

  } catch (error) {
    outputBox.innerHTML = "Error generating response.";
    console.error(error);
  }
}

/* ================= SEND ================= */
function handleSend() {
  if (isGenerating) {
    isGenerating = false;
    return;
  }

  const text = input.value.trim();
  if (!text) return;

  createUserMessage(text);
  input.value = "";

  generateResponse(text);
}

/* ================= EVENTS ================= */
sendBtn.addEventListener("click", handleSend);

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

/* Clear Chat */
clearBtn.addEventListener("click", () => {
  chat.innerHTML = "";
  history = [];
});

/* ================= EDIT ================= */
let pressTimer;

chat.addEventListener("mousedown", (e) => {
  const message = e.target.closest(".message.user");
  if (!message) return;

  pressTimer = setTimeout(() => {
    message.classList.add("editing");
    input.value = message.innerText;
    input.focus();
  }, 500);
});

chat.addEventListener("mouseup", () => clearTimeout(pressTimer));

/* ================= START ================= */
initializeModel();
