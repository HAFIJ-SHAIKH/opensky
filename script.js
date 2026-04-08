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
