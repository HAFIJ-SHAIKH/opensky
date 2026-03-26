import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const OPENSKY_CONFIG = {
    agent_name: "Opensky",
    creator: "Hafij Shaikh"
};

const AGENT_MODEL = {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", // Fast, Multilingual
    name: "Agent",
};

// SYSTEM PROMPT: Detailed Tool List
const SYSTEM_PROMPT = `
You are ${OPENSKY_CONFIG.agent_name}, created by ${OPENSKY_CONFIG.creator}.
You have access to powerful tools to help the user.

### AVAILABLE TOOLS ###
1. get_wiki(topic): Get info and photo.
2. get_weather(city): Get current weather.
3. create_profile_chart(items): Create a visual card layout with photos (Great for scientists, actors).
4. create_comparison(item1, item2): Compare two things side-by-side.
5. create_timeline(events): Create a visual timeline of historical events.
6. generate_qr_code(text): Generate a QR code image for a link or text.
7. translate_text(text, target_lang): Translate text.
8. convert_currency(amount, from, to): Convert money.
9. get_random_quote(): Get an inspirational quote.
10. create_flashcards(topic): Generate study flashcards.
11. get_crypto(id): Get crypto price.
12. search_image(query): Find a specific image.

### TOOL FORMAT ###
ACTION: tool_name ARGS: json_data

### EXAMPLES ###

User: Compare Einstein and Newton.
Assistant: ACTION: create_comparison ARGS: {"item1": "Albert Einstein", "item2": "Isaac Newton"}

User: Show me a timeline of WW2.
Assistant: ACTION: create_timeline ARGS: {"events": [{"date":"1939", "event":"War Starts"}, {"date":"1945", "event":"War Ends"}]}

User: Make flashcards for capitals.
Assistant: ACTION: create_flashcards ARGS: {"topic": "Capitals", "cards": [{"q":"France?", "a":"Paris"}, {"q":"Japan?", "a":"Tokyo"}]}

User: Scientists with photos.
Assistant: ACTION: get_wiki ARGS: {"topic": "Albert Einstein"}
(Observation: Got image)
ACTION: create_profile_chart ARGS: {"items": [{"name":"Albert Einstein", "image":"URL", "desc":"Physicist"}]}
`;

const conversationHistory = [];
const MAX_HISTORY = 10; 

// ==========================================
// 2. DOM & STATE
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

let agentEngine = null;
let isGenerating = false;
let currentProgress = 0;
let targetProgress = 0;
let animationFrameId = null;

// ==========================================
// 3. TOOLS (13 Total)
// ==========================================
const Tools = {
    // 1. Wiki
    get_wiki: async (args) => {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.topic)}`);
        const d = await res.json();
        return { text: d.extract, image: d.thumbnail?.source };
    },
    // 2. Weather
    get_weather: async (args) => {
        const city = args.city;
        const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`)).json();
        if(!geo.results?.[0]) return { text: "City not found" };
        const { latitude, longitude, name } = geo.results[0];
        const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)).json();
        return { text: `Weather in ${name}: ${w.current_weather.temperature}°C` };
    },
    // 3. Profile Chart (Photos)
    create_profile_chart: async (args) => {
        return { text: "Profiles created.", profile: args.items };
    },
    // 4. Comparison
    create_comparison: async (args) => {
        return { text: "Comparison created.", comparison: { item1: args.item1, item2: args.item2 } };
    },
    // 5. Timeline
    create_timeline: async (args) => {
        return { text: "Timeline created.", timeline: args.events };
    },
    // 6. QR Code
    generate_qr_code: async (args) => {
        const text = args.text || "https://google.com";
        return { text: "QR Code generated.", qr: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}` };
    },
    // 7. Translate
    translate_text: async (args) => {
        const text = args.text;
        const lang = args.target_lang || "en";
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        const d = await res.json();
        return { text: d.responseData.translatedText };
    },
    // 8. Currency
    convert_currency: async (args) => {
        const { amount, from, to } = args;
        const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
        const d = await res.json();
        if(d.rates && d.rates[to]) {
            const val = (amount * d.rates[to]).toFixed(2);
            return { text: `${amount} ${from} = ${val} ${to}` };
        }
        return { text: "Could not convert." };
    },
    // 9. Random Quote
    get_random_quote: async () => {
        const res = await fetch("https://api.quotable.io/random");
        const d = await res.json();
        return { text: `"${d.content}" - ${d.author}` };
    },
    // 10. Flashcards
    create_flashcards: async (args) => {
        return { text: "Flashcards created.", flashcards: args.cards };
    },
    // 11. Crypto
    get_crypto: async (args) => {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${args.id}&vs_currencies=usd`);
        const d = await res.json();
        if(d[args.id]) return { text: `${args.id} is $${d[args.id].usd}` };
        return { text: "Coin not found" };
    },
    // 12. Image Search (OpenVerse)
    search_image: async (args) => {
        const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(args.query)}`);
        const d = await res.json();
        if(d.results && d.results[0]) {
             return { text: "Image found.", image: d.results[0].url };
        }
        return { text: "No image found." };
    }
};

function parseToolAction(text) {
    const match = text.match(/ACTION:\s*(\w+)\s*ARGS:\s*([\s\S]+)/i);
    if (match) {
        try {
            const jsonMatch = match[2].match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return { name: match[1].toLowerCase(), args: JSON.parse(jsonMatch[0]) };
            }
        } catch (e) { console.log("Parse Error", e); }
    }
    return null;
}

// ==========================================
// 4. SMOOTH LOADING
// ==========================================
function animateProgress() {
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.05) {
        currentProgress += diff * 0.08; 
        sliderFill.style.width = `${currentProgress}%`;
        loadingPercent.textContent = `${currentProgress.toFixed(2)}%`;
    }
    animationFrameId = requestAnimationFrame(animateProgress);
}

// ==========================================
// 5. LOGIC
// ==========================================
function smartScroll() { messagesArea.scrollTop = messagesArea.scrollHeight; }

function createMessageDiv() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    const status = document.createElement('div');
    status.className = 'agent-status';
    status.innerHTML = `<span class="agent-status-dot"></span><span class="status-text">Thinking...</span>`;
    const content = document.createElement('div');
    content.className = 'assistant-content';
    msgDiv.appendChild(status);
    msgDiv.appendChild(content);
    messagesArea.appendChild(msgDiv);
    smartScroll();
    return { msgDiv, content, status };
}

async function runAgentLoop(query) {
    const { msgDiv, content, status } = createMessageDiv();
    const statusText = status.querySelector('.status-text');

    try {
        while (conversationHistory.length > MAX_HISTORY * 2) conversationHistory.shift();

        let messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory,
            { role: "user", content: query }
        ];

        let finalResponse = "";
        let loops = 0;
        let forceStop = false;

        while (loops < 10 && !forceStop) {
            if (!isGenerating) { forceStop = true; break; }

            const completion = await agentEngine.chat.completions.create({
                messages: messages, temperature: 0.1, stream: true
            });

            let currentChunk = "";
            let textNode = document.createTextNode("");
            content.appendChild(textNode);

            for await (const chunk of completion) {
                if (!isGenerating) { forceStop = true; break; }
                const delta = chunk.choices[0].delta.content;
                if (delta) {
                    currentChunk += delta;
                    finalResponse += delta;
                    textNode.nodeValue += delta;
                    smartScroll();
                }
            }

            if (forceStop) break;
            parseAndRender(finalResponse, content);

            const toolCall = parseToolAction(currentChunk);
            if (toolCall) {
                statusText.textContent = "Running Tool...";
                let result = { text: "Error" };
                if (Tools[toolCall.name]) result = await Tools[toolCall.name](toolCall.args);
                
                // Visualize Result
                let resultHtml = `<div class="tool-result"><b>Result:</b> ${result.text}</div>`;
                
                // 1. Images (Wiki/Search)
                if (result.image) resultHtml += `<img src="${result.image}" style="max-width:100%; border-radius:8px; margin-top:5px;">`;
                
                // 2. Profile Chart
                if (result.profile) {
                    resultHtml += `<div class="profile-grid">`;
                    result.profile.forEach(p => {
                        resultHtml += `<div class="profile-card">
                            <img src="${p.image}" class="profile-img">
                            <div class="profile-info"><h3>${p.name}</h3><p>${p.desc || ''}</p></div>
                        </div>`;
                    });
                    resultHtml += `</div>`;
                }

                // 3. Comparison
                if (result.comparison) {
                    const i1 = result.comparison.item1;
                    const i2 = result.comparison.item2;
                    resultHtml += `<table class="comparison-table"><tr><th>Feature</th><th>${i1.name}</th><th>${i2.name}</th></tr>`;
                    // Simple mock comparison logic
                    resultHtml += `<tr><td>Data</td><td>${i1.desc || 'N/A'}</td><td>${i2.desc || 'N/A'}</td></tr>`;
                    resultHtml += `</table>`;
                }

                // 4. Timeline
                if (result.timeline) {
                    resultHtml += `<div class="timeline-container">`;
                    result.timeline.forEach(e => {
                        resultHtml += `<div class="timeline-item"><div class="timeline-date">${e.date}</div><div class="timeline-content">${e.event}</div></div>`;
                    });
                    resultHtml += `</div>`;
                }

                // 5. QR Code
                if (result.qr) {
                    resultHtml += `<div class="qr-container"><img src="${result.qr}" alt="QR Code"></div>`;
                }

                // 6. Flashcards
                if (result.flashcards) {
                    resultHtml += `<div class="flashcard-grid">`;
                    result.flashcards.forEach(c => {
                        resultHtml += `<div class="flashcard"><div class="flashcard-q">${c.q}</div><div class="flashcard-a">${c.a}</div></div>`;
                    });
                    resultHtml += `</div>`;
                }

                content.innerHTML += resultHtml;
                
                messages.push({ role: "assistant", content: currentChunk });
                messages.push({ role: "user", content: `System: Tool Success. Result: ${result.text}. Continue.` });
                
                finalResponse = ""; 
                loops++;
            } else {
                break; 
            }
        }

        conversationHistory.push({ role: "user", content: query });
        conversationHistory.push({ role: "assistant", content: finalResponse });
        status.style.display = 'none';

    } catch (e) {
        if (!e.message.includes("interrupt")) {
            content.innerHTML += `<span style="color:red">Error: ${e.message}</span>`;
        }
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
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => 
        `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><div class="code-body"><pre>${code}</pre></div></div>`
    );
    container.innerHTML = html.replace(/\n/g, '<br>');
}

window.copyCode = (btn) => {
    navigator.clipboard.writeText(btn.closest('.code-block').querySelector('pre').textContent);
    btn.textContent = 'Copied';
};

// ==========================================
// 7. INITIALIZATION
// ==========================================
function showError(t, e) { 
    debugLog.style.display = 'block'; 
    debugLog.innerHTML = `${t}: ${e.message}`; 
    console.error(e);
}

async function init() {
    try {
        loadingLabel.textContent = "Initializing...";
        if (!navigator.gpu) throw new Error("WebGPU not supported.");

        modelStatusContainer.innerHTML = `
          <div class="model-card">
            <div class="model-card-name">${AGENT_MODEL.name}</div>
            <div class="model-card-desc" id="status-agent">Waiting...</div>
          </div>
        `;

        cancelAnimationFrame(animationFrameId);
        currentProgress = 0; targetProgress = 0;
        animationFrameId = requestAnimationFrame(animateProgress);

        agentEngine = await webllm.CreateMLCEngine(AGENT_MODEL.id, {
            initProgressCallback: (report) => {
                targetProgress = report.progress * 100;
                document.getElementById('status-agent').textContent = report.text;
            }
        });

        targetProgress = 100; 
        document.getElementById('status-agent').textContent = "Ready";
        loadingLabel.textContent = "Ready.";
        
        setTimeout(() => {
            cancelAnimationFrame(animationFrameId);
            sliderFill.style.width = '100%';
            loadingPercent.textContent = "100.00%";
            loadingScreen.classList.add('hidden');
            chatContainer.classList.add('active');
            sendBtn.disabled = false;
        }, 800);

    } catch (e) { 
        cancelAnimationFrame(animationFrameId);
        showError("Init Failed", e); 
    }
}

// ==========================================
// 8. EVENTS
// ==========================================
async function handleAction() {
    if (isGenerating) {
        isGenerating = false; 
        sendBtn.classList.remove('stop-btn');
        if(agentEngine) {
            await agentEngine.interruptGenerate();
            await agentEngine.resetChat();
        }
        return;
    }

    const text = inputText.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.innerHTML = `<div class="user-bubble">${text}</div>`;
    messagesArea.appendChild(userMsg);

    inputText.value = '';
    inputText.style.height = 'auto';

    isGenerating = true;
    sendBtn.classList.add('stop-btn');
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
    
    smartScroll();
    await runAgentLoop(text);
}

inputText.oninput = function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; };
inputText.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAction(); } };
sendBtn.onclick = handleAction;

init();
