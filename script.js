import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    agent_name: "Opensky",
    creator: "Hafij Shaikh",
    version: "11.0.0" // ReAct Tool Loop
};

const conversationHistory = [];
const MAX_HISTORY = 20; // Increased memory

// --- REACT PROMPTING ---
// This forces the model to "Think" before it speaks.
const TOOLS_PROMPT = `
You are ${OPENSKY_CONFIG.agent_name}, created by ${OPENSKY_CONFIG.creator}. 
You have access to tools. To use a tool, output the EXACT format:
ACTION: tool_name ARGS: arg_value

Available Tools:
- wiki(topic) -> Get info from Wikipedia.
- weather(city) -> Get weather.
- define(word) -> Get definition.
- country(name) -> Get country info.
- pokemon(name) -> Get Pokemon data.
- joke() -> Get a joke.
- advice() -> Get advice.
- bored() -> Get activity suggestion.

RULES:
1. If user asks for real-time data, facts, or specific API requests (Pokemon, Weather), use ACTION first.
2. After using ACTION, you will receive OBSERVATION. Then, summarize it for the user.
3. If user asks for charts/tables, generate a Markdown table.
4. Reply in the user's language (Hindi, English, etc.).
5. DO NOT say you cannot use tools. You MUST use them.

Example:
User: Pikachu
Assistant: ACTION: pokemon ARGS: pikachu
System: OBSERVATION: {"name": "Pikachu", "type": "Electric"...}
Assistant: Here is the data for Pikachu: [Table/Text]
`;

const MODELS = {
  router: { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", name: "Router" },
  executor: { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Core" }
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

let routerEngine = null;
let executorEngine = null; 
let isGenerating = false;
let currentImageBase64 = null; 

// ==========================================
// 3. TOOLS
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
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const d = await res.json();
        return { text: d[0].meanings[0].definitions[0].definition };
    },
    country: async (name) => {
        const res = await fetch(`https://restcountries.com/v3.1/name/${name}`);
        const d = await res.json();
        return { text: `${d[0].name.common}, Capital: ${d[0].capital}, Pop: ${d[0].population}`, image: d[0].flags?.svg };
    },
    pokemon: async (name) => {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
        const d = await res.json();
        return { 
            text: `#${d.id} ${d.name.toUpperCase()}, Type: ${d.types.map(t=>t.type.name).join(', ')}, Stats: HP ${d.stats[0].base_stat}`,
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
        return { text: `${d.activity} (Type: ${d.type})` };
    }
};

// Detect ACTION tags and run tools
async function runToolLogic(text) {
    const match = text.match(/ACTION:\s*(\w+)\s*ARGS:\s*([^\n]+)/i);
    if (!match) return null;

    const toolName = match[1].toLowerCase();
    const args = match[2].trim();

    if (Tools[toolName]) {
        try {
            return await Tools[toolName](args);
        } catch (e) {
            return { text: `Tool ${toolName} failed: ${e.message}` };
        }
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
          <div class="model-card" id="card-router"><div class="model-card-name">Router</div><div class="model-card-desc">...</div></div>
          <div class="model-card" id="card-executor"><div class="model-card-name">Core</div><div class="model-card-desc">...</div></div>
        `;

        loadingLabel.textContent = "Loading Router...";
        routerEngine = await webllm.CreateMLCEngine(MODELS.router.id, {
            initProgressCallback: (r) => updateModelUI('card-router', r, 0)
        });

        loadingLabel.textContent = "Loading Core...";
        executorEngine = await webllm.CreateMLCEngine(MODELS.executor.id, {
            initProgressCallback: (r) => updateModelUI('card-executor', r, 50)
        });

        loadingLabel.textContent = "Ready.";
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            sendBtn.disabled = false;
        }, 500);
    } catch (e) { showError("Init", e); }
}

function updateModelUI(id, r, base) {
    const c = document.getElementById(id);
    if(!c) return;
    c.querySelector('.model-card-desc').textContent = r.text;
    const p = Math.round(r.progress * 100);
    sliderFill.style.width = `${base + p/2}%`;
    loadingPercent.textContent = `${base + p/2}%`;
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
        // 1. Router
        status.textContent = "Routing...";
        const rRes = await routerEngine.chat.completions.create({
            messages: [{role: "system", content: "Classify: CHAT or TASK"}, {role: "user", content: query}],
            temp: 0.1, max_tokens: 5
        });
        const isTask = rRes.choices[0].message.content.trim().toUpperCase().includes("TASK");
        status.textContent = isTask ? "⚡ TASK MODE" : "💬 CHAT MODE";

        // 2. Loop for Tools
        let history = [...conversationHistory];
        let loops = 0;
        let finalText = "";
        
        // Add system prompt
        history.unshift({ role: "system", content: TOOLS_PROMPT });
        if (hasImage) history.push({ role: "user", content: `[Image Context] ${query}` });
        else history.push({ role: "user", content: query });

        while (loops < 3) { // Max 3 tool calls per request to prevent infinite loop
            const completion = await executorEngine.chat.completions.create({
                messages: history,
                temperature: 0.7,
                stream: true
            });

            let currentChunk = "";
            for await (const chunk of completion) {
                if (!isGenerating) break;
                const delta = chunk.choices[0].delta.content;
                if (delta) {
                    currentChunk += delta;
                    // Live preview
                    body.textContent = currentChunk;
                    parseMarkdown(currentChunk, content);
                    smartScroll();
                }
            }
            
            // Check if tool is needed
            const toolResult = await runToolLogic(currentChunk);
            if (toolResult) {
                status.textContent = `🔧 Using Tool...`;
                
                // Format Tool Result for Model
                let obsText = `OBSERVATION: ${JSON.stringify(toolResult)}`;
                
                // Show Tool Result to User
                let toolHtml = `<div class="tool-result"><b>Tool Output:</b><br>${toolResult.text}`;
                if (toolResult.image) toolHtml += `<br><img src="${toolResult.image}" style="max-width:100px; border-radius:4px;">`;
                toolHtml += `</div>`;
                content.innerHTML += toolHtml;

                // Feed back to model
                history.push({ role: "assistant", content: currentChunk });
                history.push({ role: "user", content: obsText }); 
                
                // Continue loop to let model process observation
                loops++;
            } else {
                // No tool needed, we are done
                finalText = currentChunk;
                break;
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
// 6. PARSER
// ==========================================
function parseMarkdown(text, container) {
    // Basic markdown
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Code
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => 
        `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><div class="code-body"><pre>${code}</pre></div></div>`
    );

    // Table
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
        if(routerEngine) await routerEngine.interruptGenerate();
        if(executorEngine) await executorEngine.interruptGenerate();
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
    await runAgentLoop(text || "Analyze this.", hasImg);
}

inputText.oninput = function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; };
inputText.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAction(); } };
sendBtn.onclick = handleAction;

init();
