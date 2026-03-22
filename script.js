
import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm";

// Configuration for opensky
const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";
const statusDisplay = document.getElementById("status");
const chatContainer = document.getElementById("chat-container");
const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");

let engine;

async function init() {
    try {
        engine = new webllm.MLCEngine();
        engine.setInitProgressCallback((report) => {
            statusDisplay.innerText = `[opensky] ${report.text}`;
        });

        // reload() checks IndexedDB for local weights before downloading from HF
        await engine.reload(MODEL_ID);
        
        statusDisplay.innerText = "opensky Ready: Llama-3.1 Active";
        input.disabled = false;
        button.disabled = false;
    } catch (e) {
        statusDisplay.innerText = "WebGPU Error: " + e.message;
        console.error(e);
    }
}

async function sendMessage() {
    const text = input.value;
    if(!text) return;
    
    appendMessage("user", text);
    input.value = "";
    
    try {
        const response = await engine.chat.completions.create({
            messages: [{ role: "user", content: text }]
        });
        
        appendMessage("opensky", response.choices[0].message.content);
    } catch (err) {
        appendMessage("opensky", "Error: " + err.message);
    }
}

function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerText = role === "user" ? text : `[opensky]: ${text}`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

button.onclick = sendMessage;
init();
```
