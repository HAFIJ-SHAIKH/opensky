import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    agent_name: "Opensky",
    creator: "Hafij Shaikh",
    version: "12.0.0" // Smart Single-Model Architecture
};

const conversationHistory = [];
const MAX_HISTORY = 20; 

// --- ADVANCED SYSTEM PROMPT ---
const SYSTEM_PROMPT = `
You are ${OPENSKY_CONFIG.agent_name}, created by ${OPENSKY_CONFIG.creator}. 
You are an intelligent agent with access to tools and data visualization.

CAPABILITIES:
1. Tools: Use tools for real-time data (Weather, Wiki, Pokemon, etc). 
   Format: ACTION: tool_name ARGS: value
2. Graphs: You can create graphs using Chart.js. 
   Format: \`\`\`chart { "type": "bar", "data": {...} }
3. OCR: You can read text from uploaded images using Tesseract.

RULES:
- Be concise. Do not repeat yourself.
- If asked for a list, give exactly what is asked (e.g., "give me an advice" = 1 item).
- If you need data to answer a question, USE A TOOL. Do not guess.
- Never say "I can't create graphs" or "I don't have access". You DO have access.

TOOLS AVAILABLE:
wiki(topic), weather(city), define(word), country(name), pokemon(name), joke(), advice(), bored().
`;

const MODEL_CONFIG = {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC", // Smarter Model
    name: "Phi-3.5 Mini",
    options: {
        temperature: 0.7,
        repetition_penalty: 1.1 // Prevents looping
    }
};

// ==========================================
// 2. DOM
// ==========================================
const loadingScreen = document.getElementById('loadingScreen');
const chatContainer = document.getElementById('chatContainer');
const messagesArea = document.getElementById('messagesArea');
const inputText = document.getElementById('inputText');
const sendBtn = document.getElementById('sendBtn');
const sliderFill = document.getElementById('sliderFill');
const loadingPercent = document.getElementById('loadingPercent');
const loadingLabel = document.getElementById('loadingLabel');
const modelStatusContainer = document.getElementById('modelStatusContainer');
const debugLog = document.getElementById('debugLog');
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

let engine = null;
let isGenerating = false;
let currentImageBase64 = null; 

// ==========================================
// 3. TOOLS & OCR
// ==========================================
const Tools = {
    wiki: async (q) => {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
        const d = await res.json();
        return { text: d.extract, image: d.thumbnail?.source, title: d.title };
    },
    weather: async (city) => {
        const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`)).json();
        if(!geo.results?.[0]) return { text: "City not found" };
        const { latitude, longitude, name } = geo.results[0];
        const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)).json();
        return { text: `Weather in ${name}: ${w.current_weather.temperature}°C, Wind ${w.current_weather.windspeed} km/h` };
    },
    define: async (word) => {
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const d = await res.json();
            return { text: d[0].meanings[0].definitions[0].definition };
        } catch { return { text: "Definition not found" }; }
    },
    country: async (name) => {
        const res = await fetch(`https://restcountries.com/v3.1/name/${name}`);
        const d = await res.json();
        return { text: `${d[0].name.common}, Capital: ${d[0].capital}`, image: d[0].flags?.svg };
    },
    pokemon: async (name) => {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
        const d = await res.json();
        return { 
            text: `#${d.id} ${d.name.toUpperCase()}, Type: ${d.types.map(t=>t.type.name).join(', ')}`,
            image: d.sprites?.front_default
        };
    },
    joke: async () => {
        const d = await (await fetch("https://v2.jokeapi.dev/joke/Any?type=single")).json();
        return { text: d.joke };
    },
    advice: async () => {
        const d = await (await fetch("https://api.adviceslip.com/advice")).text();
        return { text: JSON.parse(d).slip.advice };
    },
    bored: async () => {
        const d = await (await fetch("https://www.boredapi.com/api/activity")).json();
        return { text: `${d.activity} (${d.type})` };
    },
    ocr: async (base64) => {
        // Using Tesseract.js loaded in HTML
        try {
            const result = await Tesseract.recognize(`data:image/jpeg;base64,${base64}`, 'eng', { logger: m => console.log(m) });
            return { text: result.data.text || "No text found." };
        } catch(e) {
            return { text: "OCR failed: " + e.message };
        }
    }
};

// Parse Tool Action from model output
async function handleToolAction(text) {
    const match = text.match(/ACTION:\s*(\w+)\s*ARGS:\s*([^\n]+)/i);
    if (!match) return null;

    const toolName = match[1].toLowerCase();
    const args = match[2].trim();

    if (toolName === 'ocr' && currentImageBase64) {
        return await Tools.ocr(currentImageBase64);
    } else if (Tools[toolName]) {
        return await Tools[toolName](args);
    }
    return { text: `Unknown tool: ${toolName}` };
}

// ==========================================
// 4. INIT
// ==========================================
function showError(t, e) { debugLog.style.display = 'block'; debugLog.innerHTML = `${t}: ${e.message}`; }

async function init() {
    try {
        loadingLabel.textContent = "Checking WebGPU...";
        if (!navigator.gpu) throw new Error("WebGPU not supported.");

        modelStatusContainer.innerHTML = `
          <div class="model-card" id="card-main">
            <div class="model-card-name">${MODEL_CONFIG.name}</div>
            <div class="model-card-desc">Loading Smart Core...</div>
          </div>
        `;

        loadingLabel.textContent = `Loading ${MODEL_CONFIG.name} (Smarter Model)...`;
        engine = await webllm.CreateMLCEngine(MODEL_CONFIG.id, {
            initProgressCallback: (report) => {
                const p = Math.round(report.progress * 100);
                document.querySelector('.model-card-desc').textContent = report.text;
                sliderFill.style.width = `${p}%`;
                loadingPercent.textContent = `${p}%`;
            }
        });

        loadingLabel.textContent = "Ready.";
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            sendBtn.disabled = false;
        }, 500);
    } catch (e) { showError("Init Failed", e); }
}

// ==========================================
// 5. LOGIC
// ==========================================
function smartScroll() {
    const near = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 100;
    if (near) messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function runAgentLoop(query, hasImage) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';

    const panel = document.createElement('div');
    panel.className = 'agent-panel open';
    panel.innerHTML = `<div class="agent-header"><span>🧠 Thinking...</span></div><div class="agent-body"></div>`;
    panel.querySelector('.agent-header').onclick = () => panel.classList.toggle('open');

    const content = document.createElement('div');
    content.className = 'assistant-content';

    msgDiv.appendChild(panel);
    msgDiv.appendChild(content);
    messagesArea.appendChild(msgDiv);
    smartScroll();

    const status = panel.querySelector('span');
    const body = panel.querySelector('.agent-body');

    try {
        // Prepare history
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory
        ];

        // Handle Image
        if (hasImage) {
            messages.push({ role: "user", content: `[Image Uploaded] ${query}. Use ACTION: ocr ARGS: image to read text if needed.` });
        } else {
            messages.push({ role: "user", content: query });
        }

        // ReAct Loop
        let loops = 0;
        let finalText = "";
        
        while (loops < 3) {
            status.textContent = loops === 0 ? "⚡ Processing..." : "🔧 Using Tool...";
            
            const completion = await engine.chat.completions.create({
                messages: messages,
                temperature: MODEL_CONFIG.options.temperature,
                repetition_penalty: MODEL_CONFIG.options.repetition_penalty,
                stream: true
            });

            let currentChunk = "";
            for await (const chunk of completion) {
                if (!isGenerating) break;
                const delta = chunk.choices[0].delta.content;
                if (delta) {
                    currentChunk += delta;
                    body.textContent = currentChunk; // Live thoughts
                    parseAndRender(currentChunk, content); // Live preview
                    smartScroll();
                }
            }
            
            // Check if tool is needed
            const toolResult = await handleToolAction(currentChunk);
            if (toolResult) {
                status.textContent = "✅ Tool Used";
                
                // Show result to user
                let toolHtml = `<div class="tool-result"><b>Tool Result:</b> ${toolResult.text}`;
                if (toolResult.image) toolHtml += `<br><img src="${toolResult.image}" style="max-width:100px; border-radius:4px; margin-top:5px;">`;
                toolHtml += `</div>`;
                content.innerHTML += toolHtml;

                // Feed back to model
                messages.push({ role: "assistant", content: currentChunk });
                messages.push({ role: "user", content: `OBSERVATION: ${JSON.stringify(toolResult.text)}. Now summarize or answer the user.` });
                
                loops++;
            } else {
                finalText = currentChunk;
                break; // Done
            }
        }

        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: finalText });
        if (conversationHistory.length > MAX_HISTORY * 2) conversationHistory.splice(0, 2);

    } catch (e) {
        content.innerHTML += `<span style="color:red">Error: ${e.message}</span>`;
    } finally {
        isGenerating = false;
        sendBtn.classList.remove('stop-btn');
        sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    }
}

// ==========================================
// 6. RENDERER
// ==========================================
function parseAndRender(text, container) {
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 1. Chart.js Support
    html = html.replace(/```chart\s*([\s\S]*?)```/g, (match, json) => {
        try {
            const data = JSON.parse(json);
            const id = 'chart_' + Math.random().toString(36).substr(2, 9);
            // We create a placeholder that the main loop will fill if needed, or we use a trick:
            setTimeout(() => {
                const el = document.getElementById(id);
                if(el) new Chart(el, { type: data.type || 'bar', data: data.data, options: { responsive: true, maintainAspectRatio: false } });
            }, 100);
            return `<div class="chart-container"><canvas id="${id}"></canvas></div>`;
        } catch(e) {
            return `<div style="color:red">Invalid Chart JSON</div>`;
        }
    });

    // 2. Code
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => 
        `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><div class="code-body"><pre>${code}</pre></div></div>`
    );

    // 3. Table
    if (html.includes('|')) {
        const tReg = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm;
        html = html.replace(tReg, (m, h, b) => {
            const th = h.split('|').filter(x=>x.trim()).map(x=>`<th>${x.trim()}</th>`).join('');
            const tr = b.trim().split('\n').map(r => `<tr>${r.split('|').filter(x=>x.trim()).map(x=>`<td>${x.trim()}</td>`).join('')}</tr>`).join('');
            return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
        });
    }

    container.innerHTML = html.replace(/\n/g, '<br>');
}

// ==========================================
// 7. EVENTS
// ==========================================
window.copyCode = (btn) => {
    navigator.clipboard.writeText(btn.closest('.code-block').querySelector('pre').textContent);
    btn.textContent = 'Copied';
    setTimeout(()=>btn.textContent='Copy', 1000);
};

uploadBtn.onclick = () => imageInput.click();
imageInput.onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImageBase64 = ev.target.result.split(',')[1];
        imagePreview.src = ev.target.result;
        imagePreviewContainer.classList.add('active');
    };
    reader.readAsDataURL(file);
};
removeImageBtn.onclick = () => { currentImageBase64 = null; imagePreviewContainer.classList.remove('active'); imageInput.value = ''; };

async function handleAction() {
    if (isGenerating) {
        isGenerating = false;
        sendBtn.classList.remove('stop-btn');
        if(engine) await engine.interruptGenerate();
        return;
    }

    const text = inputText.value.trim();
    if (!text && !currentImageBase64) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    let bubble = `<div class="user-bubble">${text}`;
    if (currentImageBase64) bubble += `<img src="data:image/jpeg;base64,${currentImageBase64}">`;
    bubble += `</div>`;
    userMsg.innerHTML = bubble;
    messagesArea.appendChild(userMsg);

    const hasImg = !!currentImageBase64;
    inputText.value = '';
    inputText.style.height = 'auto';
    
    currentImageBase64 = null;
    imagePreviewContainer.classList.remove('active');
    imageInput.value = '';

    isGenerating = true;
    sendBtn.classList.add('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
    
    smartScroll();
    await runAgentLoop(text || "Read this image.", hasImg);
}

inputText.oninput = function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; };
inputText.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAction(); } };
sendBtn.onclick = handleAction;

init();
