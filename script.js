import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// ==========================================
// 1. CONFIG
// ==========================================
const CONFIG = {
    agent_name: "Opensky",
    creator: "Hafij Shaikh",
    max_history: 10
};

// MAIN MODEL
const MAIN_MODEL = {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
};

// SUB AGENTS (LIGHT MODELS)
const SUB_MODELS = {
    helper: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    fast: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC"
};

// SYSTEM PROMPT
const SYSTEM_PROMPT = `
Tum ${CONFIG.agent_name} ho, created by ${CONFIG.creator}.
Roman Urdu + Hindi mix me baat karo.
Friendly raho. English avoid karo.
Tools sirf real data ke liye use karo.

FORMAT:
ACTION: tool_name ARGS: {json}

TOOLS:
get_wiki(topic)
get_weather(city)
get_crypto(id)
generate_chart(data)
create_profile_chart(items)
`;

// ==========================================
// 2. GLOBAL STATE (SAFE)
// ==========================================
const State = {
    main: null,
    sub: {},
    history: [],
    generating: false
};

// ==========================================
// 3. SAFE TOOL SYSTEM (MODULAR)
// ==========================================
const Tools = {
    async get_wiki({ topic }) {
        try {
            const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
            const d = await res.json();
            return { text: d.extract, image: d.thumbnail?.source };
        } catch {
            return { text: "Wiki error" };
        }
    },

    async get_weather({ city }) {
        try {
            const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}`)).json();
            if (!geo.results?.[0]) return { text: "City nahi mila" };

            const { latitude, longitude, name } = geo.results[0];
            const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)).json();

            return { text: `${name} me ${w.current_weather.temperature}°C hai` };
        } catch {
            return { text: "Weather error" };
        }
    },

    async get_crypto({ id }) {
        try {
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
            const d = await res.json();
            return { text: `${id}: $${d[id]?.usd || "N/A"}` };
        } catch {
            return { text: "Crypto error" };
        }
    },

    async generate_chart(data) {
        return { text: "Chart ready", chart: data };
    },

    async create_profile_chart({ items }) {
        return { text: "Profiles ready", profile: items };
    }
};

// ==========================================
// 4. TOOL PARSER (SAFE)
// ==========================================
function parseTool(text) {
    try {
        const match = text.match(/ACTION:\s*(\w+)\s*ARGS:\s*(\{[\s\S]*\})/i);
        if (!match) return null;
        return {
            name: match[1],
            args: JSON.parse(match[2])
        };
    } catch {
        return null;
    }
}

// ==========================================
// 5. SUB-AGENT SYSTEM
// ==========================================
async function runSubAgent(name, prompt) {
    if (!State.sub[name]) return null;

    try {
        const res = await State.sub[name].chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            stream: false
        });
        return res.choices[0].message.content;
    } catch {
        return null;
    }
}

// ==========================================
// 6. CORE AGENT LOOP (SAFE + EXTENDABLE)
// ==========================================
async function runAgent(query, onUpdate) {

    State.generating = true;

    // optional preprocessing (sub-agent)
    const refined = await runSubAgent("helper", `Improve this input: ${query}`);
    if (refined) query = refined;

    let messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...State.history,
        { role: "user", content: query }
    ];

    let final = "";

    for (let i = 0; i < 5; i++) {

        if (!State.generating) break;

        const stream = await State.main.chat.completions.create({
            messages,
            stream: true
        });

        let chunkText = "";

        for await (const chunk of stream) {
            if (!State.generating) break;

            const t = chunk.choices[0].delta.content;
            if (t) {
                final += t;
                chunkText += t;
                onUpdate?.(t);
            }
        }

        const tool = parseTool(chunkText);

        if (!tool || !Tools[tool.name]) break;

        const result = await Tools[tool.name](tool.args);

        onUpdate?.(`\n\n🔧 ${result.text}\n\n`);

        messages.push({ role: "assistant", content: chunkText });
        messages.push({ role: "user", content: `Observation: ${result.text}` });

        final = "";
    }

    State.history.push({ role: "user", content: query });
    State.history.push({ role: "assistant", content: final });

    State.generating = false;
}

// ==========================================
// 7. INIT SYSTEM (MAIN + SUB)
// ==========================================
async function init() {

    // MAIN MODEL
    State.main = await webllm.CreateMLCEngine(MAIN_MODEL.id);

    // SUB AGENTS (SAFE LOAD)
    try {
        State.sub.helper = await webllm.CreateMLCEngine(SUB_MODELS.helper);
    } catch {}

    try {
        State.sub.fast = await webllm.CreateMLCEngine(SUB_MODELS.fast);
    } catch {}

    console.log("All agents ready");
}

// ==========================================
// 8. BASIC UI HOOK (SAFE)
// ==========================================
async function sendMessage(text) {

    let output = "";

    await runAgent(text, (chunk) => {
        output += chunk;
        console.log(output); // replace with UI later
    });

    return output;
}

// ==========================================
// 9. START
// ==========================================
init();

// TEST
window.ask = async (q) => {
    const res = await sendMessage(q);
    console.log("FINAL:", res);
};
// ==========================================
// 10. UI SYSTEM (ADD-ONLY MODULE)
// ==========================================

// DOM (safe: if missing, code won't crash)
const UI = {
    messages: document.getElementById("messagesArea"),
    input: document.getElementById("inputText"),
    send: document.getElementById("sendBtn")
};

// SAFE DOM CHECK
function hasUI() {
    return UI.messages && UI.input && UI.send;
}

// CREATE MESSAGE
function createMessage(type, text = "") {
    if (!hasUI()) return null;

    const msg = document.createElement("div");
    msg.className = `message ${type}`;

    const bubble = document.createElement("div");
    bubble.className = `${type}-bubble`;
    bubble.innerHTML = text;

    msg.appendChild(bubble);
    UI.messages.appendChild(msg);

    UI.messages.scrollTop = UI.messages.scrollHeight;

    return bubble;
}

// STREAM UPDATE
function streamToBubble(bubble, chunk) {
    if (!bubble) return;
    bubble.innerHTML += chunk;
    UI.messages.scrollTop = UI.messages.scrollHeight;
}

// ==========================================
// 11. RENDER EXTRA (TOOLS UI)
// ==========================================
function renderToolResult(result) {
    if (!hasUI()) return;

    if (result.image) {
        const img = document.createElement("img");
        img.src = result.image;
        img.style.maxWidth = "100%";
        UI.messages.appendChild(img);
    }

    if (result.chart) {
        const canvas = document.createElement("canvas");
        UI.messages.appendChild(canvas);

        setTimeout(() => {
            new Chart(canvas, {
                type: result.chart.type || "bar",
                data: {
                    labels: result.chart.labels,
                    datasets: [{
                        label: "Data",
                        data: result.chart.values
                    }]
                }
            });
        }, 100);
    }
}

// ==========================================
// 12. CONNECT UI WITH AGENT
// ==========================================
async function handleSend() {

    if (!hasUI()) return;

    const text = UI.input.value.trim();
    if (!text) return;

    UI.input.value = "";

    // USER MESSAGE
    createMessage("user", text);

    // ASSISTANT MESSAGE
    const bubble = createMessage("assistant", "");

    await runAgent(text, (chunk) => {
        streamToBubble(bubble, chunk);
    });
}

// ==========================================
// 13. EVENTS (SAFE)
// ==========================================
if (hasUI()) {

    UI.send.onclick = handleSend;

    UI.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
}
// ==========================================
// 14. FULL UI INTEGRATION (MATCH YOUR HTML)
// ==========================================

const UIX = {
    loadingScreen: document.getElementById('loadingScreen'),
    chatContainer: document.getElementById('chatContainer'),
    messages: document.getElementById('messagesArea'),
    input: document.getElementById('inputText'),
    send: document.getElementById('sendBtn'),
    slider: document.getElementById('sliderFill'),
    percent: document.getElementById('loadingPercent'),
    label: document.getElementById('loadingLabel'),
    modelStatus: document.getElementById('modelStatusContainer'),
    debug: document.getElementById('debugLog')
};

// SAFE CHECK
function hasUIX() {
    return UIX.messages && UIX.input && UIX.send;
}

// ==========================================
// 15. LOADING PROGRESS SYSTEM
// ==========================================
let progress = 0;

function updateProgress(val, text) {
    if (!UIX.slider) return;

    progress = val;
    UIX.slider.style.width = val + "%";
    UIX.percent.textContent = val.toFixed(2) + "%";

    if (text && UIX.label) UIX.label.textContent = text;
}

// ==========================================
// 16. SHOW APP
// ==========================================
function showApp() {
    if (!UIX.loadingScreen || !UIX.chatContainer) return;

    UIX.loadingScreen.classList.add("hidden");
    UIX.chatContainer.classList.add("active");

    if (UIX.send) UIX.send.disabled = false;
}

// ==========================================
// 17. ENHANCED INIT (HOOK INTO EXISTING INIT)
// ==========================================

// Wrap original init safely
const originalInit = init;

init = async function () {
    try {
        if (UIX.label) UIX.label.textContent = "Loading Main Model...";

        // MAIN MODEL WITH PROGRESS
        State.main = await webllm.CreateMLCEngine(MAIN_MODEL.id, {
            initProgressCallback: (r) => {
                updateProgress(r.progress * 70, r.text);
            }
        });

        // SUB AGENTS
        if (UIX.label) UIX.label.textContent = "Loading Sub Agents...";

        try {
            State.sub.helper = await webllm.CreateMLCEngine(SUB_MODELS.helper, {
                initProgressCallback: (r) => {
                    updateProgress(70 + r.progress * 15, "Helper loading...");
                }
            });
        } catch {}

        try {
            State.sub.fast = await webllm.CreateMLCEngine(SUB_MODELS.fast, {
                initProgressCallback: (r) => {
                    updateProgress(85 + r.progress * 15, "Fast agent loading...");
                }
            });
        } catch {}

        updateProgress(100, "Ready");

        setTimeout(showApp, 800);

    } catch (e) {
        if (UIX.debug) {
            UIX.debug.style.display = "block";
            UIX.debug.innerText = e.message;
        }
        console.error(e);
    }
};

// ==========================================
// 18. SMART SCROLL (IMPROVED)
// ==========================================
function smartScroll() {
    if (!UIX.messages) return;

    const threshold = 120;
    const nearBottom =
        UIX.messages.scrollHeight - UIX.messages.scrollTop - UIX.messages.clientHeight < threshold;

    if (nearBottom) {
        UIX.messages.scrollTop = UIX.messages.scrollHeight;
    }
}

// ==========================================
// 19. BETTER MESSAGE UI
// ==========================================
function createMessageUI(type, text = "") {
    if (!hasUIX()) return null;

    const msg = document.createElement("div");
    msg.className = `message ${type}`;

    const bubble = document.createElement("div");
    bubble.className = `${type}-bubble`;
    bubble.innerHTML = text;

    msg.appendChild(bubble);
    UIX.messages.appendChild(msg);

    smartScroll();
    return bubble;
}

function streamUI(bubble, chunk) {
    if (!bubble) return;
    bubble.innerHTML += chunk;
    smartScroll();
}

// ==========================================
// 20. STOP / RESET SYSTEM (IMPORTANT)
// ==========================================
async function stopGeneration() {
    State.generating = false;

    try {
        if (State.main) {
            await State.main.interruptGenerate();
            await State.main.resetChat();
        }
    } catch {}

    if (UIX.send) {
        UIX.send.innerHTML = "Send";
    }
}

// ==========================================
// 21. MAIN SEND HANDLER (UPGRADED)
// ==========================================
async function handleSendUI() {

    if (!hasUIX()) return;

    // STOP BUTTON
    if (State.generating) {
        await stopGeneration();
        return;
    }

    const text = UIX.input.value.trim();
    if (!text) return;

    UIX.input.value = "";

    createMessageUI("user", text);
    const bubble = createMessageUI("assistant", "");

    State.generating = true;

    if (UIX.send) UIX.send.innerHTML = "Stop";

    await runAgent(text, (chunk) => {
        streamUI(bubble, chunk);
    });

    State.generating = false;

    if (UIX.send) UIX.send.innerHTML = "Send";
}

// ==========================================
// 22. EVENTS
// ==========================================
if (hasUIX()) {

    UIX.send.onclick = handleSendUI;

    UIX.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendUI();
        }
    });

    UIX.input.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });
}
// ==========================================
// 23. ADVANCED MODEL LOADER (HIGH QUALITY)
// ==========================================

// MODEL STATUS UI
function createModelCard(id, name) {
    if (!UIX.modelStatus) return;

    const div = document.createElement("div");
    div.className = "model-card";
    div.innerHTML = `
        <div class="model-card-name">${name}</div>
        <div class="model-card-desc" id="status-${id}">Waiting...</div>
    `;
    UIX.modelStatus.appendChild(div);
}

// UPDATE STATUS
function updateModelStatus(id, text) {
    const el = document.getElementById(`status-${id}`);
    if (el) el.textContent = text;
}

// SAFE LOADER WITH RETRY
async function loadModelSafe(id, label, progressStart, progressEnd) {
    createModelCard(id, label);

    let attempts = 0;
    const maxRetries = 2;

    while (attempts <= maxRetries) {
        try {
            updateModelStatus(id, "Loading...");

            const engine = await webllm.CreateMLCEngine(id, {
                initProgressCallback: (r) => {
                    const scaled =
                        progressStart + (progressEnd - progressStart) * r.progress;
                    updateProgress(scaled, r.text);
                    updateModelStatus(id, r.text);
                }
            });

            updateModelStatus(id, "Ready");
            return engine;

        } catch (e) {
            attempts++;
            updateModelStatus(id, `Retry ${attempts}...`);

            if (attempts > maxRetries) {
                updateModelStatus(id, "Failed");
                console.warn(`Model failed: ${id}`, e);
                return null;
            }
        }
    }
}

// ==========================================
// 24. REPLACE INIT WITH ROBUST VERSION
// ==========================================

init = async function () {
    try {
        updateProgress(0, "Starting...");

        // MAIN MODEL (MOST IMPORTANT)
        State.main = await loadModelSafe(
            MAIN_MODEL.id,
            "Main Agent (Qwen 1.5B)",
            0,
            70
        );

        if (!State.main) {
            throw new Error("Main model failed to load");
        }

        // HELPER SUB AGENT
        State.sub.helper = await loadModelSafe(
            SUB_MODELS.helper,
            "Helper (0.5B)",
            70,
            85
        );

        // FAST SUB AGENT
        State.sub.fast = await loadModelSafe(
            SUB_MODELS.fast,
            "Fast Agent (1B)",
            85,
            100
        );

        updateProgress(100, "All systems ready");

        setTimeout(() => {
            showApp();
        }, 800);

    } catch (e) {
        console.error(e);

        if (UIX.debug) {
            UIX.debug.style.display = "block";
            UIX.debug.textContent = e.message;
        }
    }
};
// ==========================================
// 25. BRAIN SYSTEM (SEMANTIC + PLANNING)
// ==========================================

async function semanticParse(input) {
    // Use helper agent for understanding
    const prompt = `
Break this user input into JSON:

Input: "${input}"

Return JSON only:
{
 "intent": "...",
 "objects": [],
 "constraints": [],
 "type": "chat | tool | data | question"
}
`;

    try {
        const res = await runSubAgent("helper", prompt);
        return JSON.parse(res);
    } catch {
        return {
            intent: input,
            objects: [],
            constraints: [],
            type: "chat"
        };
    }
}

// ==========================================
// 26. MULTI-STEP PLANNER
// ==========================================
async function createPlan(parsed) {

    const prompt = `
You are a planner AI.

User intent: ${parsed.intent}
Objects: ${JSON.stringify(parsed.objects)}
Constraints: ${JSON.stringify(parsed.constraints)}

Create a plan in JSON:

{
 "steps": [
   { "action": "think | tool | respond", "tool": "", "reason": "" }
 ],
 "use_fast": true/false,
 "use_tools": true/false
}
`;

    try {
        const res = await runSubAgent("helper", prompt);
        return JSON.parse(res);
    } catch {
        return {
            steps: [{ action: "respond" }],
            use_fast: false,
            use_tools: false
        };
    }
}

// ==========================================
// 27. ROUTER DECISION ENGINE
// ==========================================
async function routeRequest(query) {

    const parsed = await semanticParse(query);
    const plan = await createPlan(parsed);

    return {
        parsed,
        plan
    };
}

// ==========================================
// 28. EXECUTION ENGINE (SMART)
// ==========================================
async function executeWithPlan(query, onUpdate) {

    const { parsed, plan } = await routeRequest(query);

    console.log("Parsed:", parsed);
    console.log("Plan:", plan);

    // ⚡ FAST PATH (small agent)
    if (plan.use_fast && State.sub.fast) {
        const fastRes = await runSubAgent("fast", query);
        if (fastRes) {
            onUpdate?.(fastRes);
            return fastRes;
        }
    }

    // 🧠 MAIN AGENT PATH
    return await runAgentWithPlan(query, plan, onUpdate);
}

// ==========================================
// 29. MAIN AGENT WITH PLAN CONTROL
// ==========================================
async function runAgentWithPlan(query, plan, onUpdate) {

    let messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...State.history,
        { role: "user", content: query }
    ];

    let final = "";

    for (let i = 0; i < 5; i++) {

        if (!State.generating) break;

        const stream = await State.main.chat.completions.create({
            messages,
            stream: true
        });

        let chunkText = "";

        for await (const chunk of stream) {
            if (!State.generating) break;

            const t = chunk.choices[0].delta.content;
            if (t) {
                final += t;
                chunkText += t;
                onUpdate?.(t);
            }
        }

        // TOOL CONTROL BASED ON PLAN
        const tool = parseTool(chunkText);

        if (!plan.use_tools || !tool || !Tools[tool.name]) break;

        const result = await Tools[tool.name](tool.args);

        onUpdate?.(`\n\n🔧 ${result.text}\n\n`);

        messages.push({ role: "assistant", content: chunkText });
        messages.push({ role: "user", content: `Observation: ${result.text}` });

        final = "";
    }

    State.history.push({ role: "user", content: query });
    State.history.push({ role: "assistant", content: final });

    return final;
}

// ==========================================
// 30. OVERRIDE MAIN SEND FLOW (IMPORTANT)
// ==========================================

const oldRunAgent = runAgent;

runAgent = async function (query, onUpdate) {
    State.generating = true;

    const res = await executeWithPlan(query, onUpdate);

    State.generating = false;
    return res;
};
// ==========================================
// 31. SMOOTH PROGRESS ENGINE (FIX)
// ==========================================

let currentProgress = 0;
let targetProgress = 0;
let progressAnim = null;

function startSmoothProgress() {
    cancelAnimationFrame(progressAnim);

    function animate() {
        const diff = targetProgress - currentProgress;

        if (Math.abs(diff) > 0.1) {
            currentProgress += diff * 0.08;
        }

        if (UIX.slider) {
            UIX.slider.style.width = currentProgress + "%";
            UIX.percent.textContent = currentProgress.toFixed(2) + "%";
        }

        progressAnim = requestAnimationFrame(animate);
    }

    animate();
}

function setProgressTarget(val, text) {
    targetProgress = val;
    if (text && UIX.label) UIX.label.textContent = text;
}

// ==========================================
// 32. IMPROVED MODEL LOADER (FIXED UI)
// ==========================================

async function loadModelTracked(id, label, start, end) {
    createModelCard(id, label);

    let lastUpdate = Date.now();

    try {
        const engine = await webllm.CreateMLCEngine(id, {
            initProgressCallback: (r) => {
                lastUpdate = Date.now();

                const scaled = start + (end - start) * r.progress;
                setProgressTarget(scaled, r.text);

                updateModelStatus(id, r.text);
            }
        });

        updateModelStatus(id, "Ready");
        return engine;

    } catch (e) {
        updateModelStatus(id, "Failed");
        console.warn("Model failed:", id);
        return null;
    }
}

// ==========================================
// 33. PARALLEL SUB-AGENT SYSTEM (SUB-CLAW 🦀)
// ==========================================

async function runParallelAgents(tasks) {
    // tasks = [{agent:"helper", prompt:"..."}, ...]

    const results = await Promise.allSettled(
        tasks.map(t => runSubAgent(t.agent, t.prompt))
    );

    return results.map((r, i) => ({
        task: tasks[i],
        output: r.status === "fulfilled" ? r.value : null
    }));
}

// ==========================================
// 34. COLLABORATIVE INTENT SYSTEM (BASIC)
// ==========================================

function detectIntentPattern(history) {
    // simple pattern detection (upgrade later)
    const last = history.slice(-3).map(m => m.content).join(" ");

    if (last.includes("compare")) return "comparison";
    if (last.includes("price")) return "data";
    if (last.includes("explain")) return "explanation";

    return "general";
}

// ==========================================
// 35. EMERGENT COORDINATION SIGNAL (FUN + USEFUL)
// ==========================================

function getAgentSignal(type) {
    const signals = {
        fast: "⚡",
        helper: "🧠",
        tool: "🔧",
        parallel: "🦀"
    };

    return signals[type] || "•";
}

// ==========================================
// 36. UPGRADE INIT AGAIN (FINAL FIX)
// ==========================================

init = async function () {
    try {
        startSmoothProgress();

        setProgressTarget(2, "Booting system...");

        // MAIN MODEL
        State.main = await loadModelTracked(
            MAIN_MODEL.id,
            "Main Agent (Qwen 1.5B)",
            2,
            70
        );

        if (!State.main) throw new Error("Main model failed");

        // SUB AGENTS (PARALLEL LOAD 🔥)
        const [helper, fast] = await Promise.allSettled([
            loadModelTracked(SUB_MODELS.helper, "Helper (0.5B)", 70, 85),
            loadModelTracked(SUB_MODELS.fast, "Fast (1B)", 85, 100)
        ]);

        if (helper.status === "fulfilled") State.sub.helper = helper.value;
        if (fast.status === "fulfilled") State.sub.fast = fast.value;

        setProgressTarget(100, "All systems ready");

        setTimeout(() => {
            cancelAnimationFrame(progressAnim);
            showApp();
        }, 800);

    } catch (e) {
        console.error(e);

        if (UIX.debug) {
            UIX.debug.style.display = "block";
            UIX.debug.textContent = e.message;
        }
    }
};
