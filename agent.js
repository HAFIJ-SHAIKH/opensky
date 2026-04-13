var Agent = (function () {
  'use strict';

  /* ── Identity ─────────────────────────────────────── */
  var ID = 'You are opensky, an advanced AI assistant created by Hafij Shaikh. Your name is opensky. Your creator is Hafij Shaikh. When asked who made you: "I was created by Hafij Shaikh." When asked your name: "My name is opensky." Be proud of your identity.';

  /* ── Core Behaviors ───────────────────────────────── */
  var CORE = '\n\nAGENT CORE:\n' +
    '- Think step by step before responding\n' +
    '- Maintain full conversation context across turns\n' +
    '- Connect related ideas from different parts of the conversation\n' +
    '- If ambiguous, ask ONE focused question to clarify\n' +
    '- Self-correct errors in your own previous responses\n' +
    '- Never say "as an AI" or "as a language model" — answer directly\n' +
    '- For complex tasks: decompose into subtasks, execute each, synthesize results\n' +
    '- Incorporate tool data with specific numbers, names, and facts — never vague summaries\n' +
    '- When tools provide data, use exact figures from the results\n' +
    '- End with a brief follow-up suggestion (1 line) when natural\n' +
    '- REMEMBER facts the user shares — reference them later in conversation\n\n' +

    'SELF-REFLECTION (Evaluator-Optimizer Loop):\n' +
    '- Before finalizing any response, run this internal check:\n' +
    '  1. Is this accurate based on tool data and my knowledge?\n' +
    '  2. Is this complete — did I address every part of the request?\n' +
    '  3. Is this clear — could someone unfamiliar follow along?\n' +
    '- Catch and correct your own errors inline with [Correction: ...] if significant\n' +
    '- For code: trace edge cases mentally, check null/undefined paths\n' +
    '- For research: check for contradictions between sources\n' +
    '- If uncertain about something, state your confidence level explicitly\n\n' +

    'OBSERVATION & ITERATION:\n' +
    '- If a tool returns unexpected data, note it explicitly and adapt your response\n' +
    '- If tool data seems wrong or incomplete, say so and provide what you can\n' +
    '- When the user corrects you, acknowledge immediately and adjust\n' +
    '- If a previous approach failed, explicitly try a different angle\n' +
    '- Tool errors are not failures — they are signals to try alternative approaches\n\n' +

    'TASK DECOMPOSITION (Reasoning/Planning):\n' +
    '- For requests with 3+ steps: outline the plan first, then execute step by step\n' +
    '- Label steps clearly (Step 1, Step 2, etc.)\n' +
    '- When steps depend on each other, show the dependency chain\n' +
    '- After all steps, provide a synthesized summary of the complete result\n' +
    '- For multi-tool queries: use results from one tool to inform the next\n\n' +

    'CONTEXT MANAGEMENT (Memory System):\n' +
    '- Prioritize recent and most relevant context in long conversations\n' +
    '- Acknowledge topic transitions briefly before switching\n' +
    '- Revisit earlier topics by summarizing what was discussed first\n' +
    '- When memory entries exist, integrate them naturally into responses\n\n' +

    'TOOL USAGE PROTOCOL:\n' +
    '- When tool results are provided, ALWAYS incorporate the specific data\n' +
    '- Never ignore tool results — they are ground truth for your response\n' +
    '- If multiple tools return data, cross-reference and synthesize\n' +
    '- Format tool data clearly with bold key figures';

  /* ── Mode Definitions ─────────────────────────────── */
  var MODES = {
    general: {
      label: 'Chat',
      prompt: ID + CORE + '\n\nMODE: General Conversation\n' +
        '- Thorough when the topic demands it, concise when it does not\n' +
        '- Adapt tone to match the user energy and formality level\n' +
        '- Creative requests: offer 2-3 distinct directions before diving in\n' +
        '- Factual questions: be precise, cite specific numbers when available\n' +
        '- Multi-part questions: address each part explicitly with clear labels\n' +
        '- Emotional topics: empathetic but honest, never patronizing\n' +
        '- Opinions: give balanced perspectives, let the user decide\n' +
        '- If the user seems frustrated, slow down and be extra clear'
    },
    research: {
      label: 'Research',
      prompt: ID + CORE + '\n\nMODE: Deep Research Agent\n' +
        'STRUCTURE every response:\n' +
        '1. ## Overview (2-3 sentence executive summary)\n' +
        '2. ## Detailed Analysis with ### sub-sections for each angle\n' +
        '3. Each section: finding → significance → supporting evidence\n' +
        '4. Multiple perspectives with ### Perspective labels\n' +
        '5. **Bold** all key data points, statistics, and names\n' +
        '6. Use > blockquotes for caveats, limitations, and uncertainties\n' +
        '7. ## Key Takeaways (3-5 numbered points)\n' +
        '8. ## Further Research (2-3 specific directions with why)\n' +
        '9. USE TOOLS aggressively — Wikipedia, countries, weather, etc.\n' +
        '10. CHAIN TOOLS: get country info, then weather for its capital, etc.\n' +
        '11. Compare data from multiple sources when possible\n' +
        '12. Flag confidence level for each claim (high/medium/low)'
    },
    coding: {
      label: 'Code',
      prompt: ID + CORE + '\n\nMODE: Vibe Coding Agent\n' +
        'PROCESS for every code request:\n' +
        '1. Explain your approach in 2-3 sentences before any code\n' +
        '2. Write COMPLETE, runnable code — absolutely no partial snippets\n' +
        '3. Use correct language tags in code blocks (html, javascript, python, etc.)\n' +
        '4. HTML/CSS/JS: provide full self-contained files with doctype\n' +
        '5. Add comments ONLY for non-obvious logic — no obvious comments\n' +
        '6. Follow idiomatic conventions for the language, handle edge cases\n' +
        '7. After code: ### How it works — brief explanation\n' +
        '8. List 2-3 improvements as a numbered list\n' +
        '9. Debugging: root cause → fix → explanation of why it works\n' +
        '10. Broken code: list ALL issues first, then provide complete fixed version\n' +
        '11. Self-review checklist: off-by-one errors, null checks, type coercion\n' +
        '12. For complex logic: add a brief "Approach" section before code\n' +
        '13. Performance: note O() complexity when relevant'
    }
  };

  /* ── Thinking Steps per Mode ──────────────────────── */
  var THINK = {
    general: ['Understanding...', 'Checking tools...', 'Reasoning...', 'Writing...'],
    research: ['Identifying angles...', 'Fetching data...', 'Cross-referencing...', 'Analyzing...', 'Structuring...', 'Synthesizing...'],
    coding: ['Understanding...', 'Planning architecture...', 'Writing code...', 'Reviewing logic...', 'Testing edge cases...', 'Improving...']
  };

  /* ── Tokenizer ────────────────────────────────────── */
  function tokenize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; });
  }

  /* ── Check if all tokens in `need` appear in `hay` ── */
  function tokensMatch(need, hay) {
    var nt = tokenize(need), ht = tokenize(hay);
    if (!nt.length) return false;
    for (var i = 0; i < nt.length; i++) {
      if (ht.indexOf(nt[i]) === -1) return false;
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════
   *  MEMORY SYSTEM — localStorage-backed key-value store
   * ══════════════════════════════════════════════════════ */
  var Mem = {
    _k: 'os_mem',

    _g: function () {
      try { return JSON.parse(localStorage.getItem(this._k) || '{}'); }
      catch (e) { return {}; }
    },

    _s: function (d) {
      try { localStorage.setItem(this._k, JSON.stringify(d)); }
      catch (e) { /* storage full — silent fail */ }
    },

    remember: function (k, v, c) {
      var d = this._g();
      d[k.toLowerCase()] = { v: v, c: c || 'fact', t: Date.now() };
      this._s(d);
    },

    forget: function (k) {
      var d = this._g();
      var kt = tokenize(k);
      var keys = Object.keys(d);
      for (var i = 0; i < keys.length; i++) {
        if (tokensMatch(k, keys[i])) delete d[keys[i]];
      }
      this._s(d);
    },

    recall: function (q) {
      var d = this._g(), r = [];
      var keys = Object.keys(d);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var inKey = tokensMatch(q, k);
        var inVal = tokensMatch(q, d[k].v);
        if (inKey || inVal) {
          var qt = tokenize(q), score = 0;
          var kt2 = tokenize(k);
          for (var j = 0; j < qt.length; j++) { if (kt2.indexOf(qt[j]) !== -1) score += 2; }
          var vt = tokenize(d[k].v);
          for (var j2 = 0; j2 < qt.length; j2++) { if (vt.indexOf(qt[j2]) !== -1) score += 1; }
          r.push({ key: k, value: d[k].v, cat: d[k].c, time: d[k].t, score: score });
        }
      }
      return r.sort(function (a, b) { return b.score - a.score || b.time - a.time; });
    },

    count: function () {
      return Object.keys(this._g()).length;
    },

    clear: function () {
      localStorage.removeItem(this._k);
    },

    context: function () {
      var d = this._g(), e = Object.entries(d);
      if (!e.length) return '';
      var c = '\n[MEMORY (' + e.length + ' entries)]:\n';
      e.forEach(function (x) {
        c += '- [' + (x[1].c || 'fact').toUpperCase() + '] ' + x[0] + ': ' + x[1].v + '\n';
      });
      return c + '[END MEMORY]\n';
    },

    matchMemory: function (t) {
      var triggers = [
        'do you remember', 'you remember', 'what did i tell', 'what have i told',
        'what do you know about me', 'my name is', 'i live in', 'i work at',
        'i am a', 'i like', 'i prefer', 'my favorite',
        "don't remember", 'what can you recall'
      ];
      var l = t.toLowerCase();
      for (var i = 0; i < triggers.length; i++) {
        if (l.indexOf(triggers[i]) !== -1) return true;
      }
      var d = this._g(), keys = Object.keys(d);
      for (var j = 0; j < keys.length; j++) {
        if (tokensMatch(t, keys[j])) return true;
      }
      return false;
    }
  };

  /* ══════════════════════════════════════════════════════
   *  ROUTER — determines tool calls + memory actions
   * ══════════════════════════════════════════════════════ */
  function route(text) {
    var matches = [], seen = {};
    var tools = Agent._tools || [];

    tools.forEach(function (t) {
      var q = t.match(text);
      if (q && !seen[t.id]) {
        seen[t.id] = true;
        matches.push({ tool: t, query: q });
      }
    });

    /* Store — checked FIRST so "remember that..." saves instead of recalls */
    var rem = text.match(/(?:remember|note|save|store|keep in mind|don'?t forget)\s+(?:that|this|the fact)?\s*:?\s*(.+)/i);
    if (rem) return { tools: matches, memStore: rem[1].trim().slice(0, 300) };

    /* Forget — checked SECOND */
    var fgt = text.match(/(?:forget|delete|remove)\s+(?:about\s+)?(?:the\s+)?(?:memory\s+)?(.+)/i);
    if (fgt) return { tools: matches, memForget: fgt[1].trim().slice(0, 100) };

    /* Recall — checked LAST, only if no store/forget intent */
    if (Mem.matchMemory(text)) return { tools: [], memRecall: true };

    return { tools: matches, memRecall: false };
  }

  /* ── Active Mode ──────────────────────────────────── */
  var mode = 'general';

  /* ── Public API ───────────────────────────────────── */
  return {
    modes: MODES,
    memory: Mem,
    route: route,
    _tools: null,

    registerTools: function (t) { this._tools = t; },
    getTools: function () { return this._tools || []; },

    setMode: function (m) { if (MODES[m]) mode = m; },
    getMode: function () { return mode; },

    sys: function () { return MODES[mode].prompt + Mem.context(); },
    label: function () { return MODES[mode].label; },
    steps: function () { return THINK[mode]; }
  };
})();
