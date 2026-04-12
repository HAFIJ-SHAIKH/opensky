var Agent = (function() {
  var ID = 'You are opensky, an advanced AI assistant created by Hafij Shaikh. Your name is opensky. Your creator is Hafij Shaikh. When asked who made you: "I was created by Hafij Shaikh." When asked your name: "My name is opensky." Be proud of your identity.';

  var CORE = '\n\nAGENT CORE:\n' +
    '- Think step by step before responding\n' +
    '- Maintain full conversation context\n' +
    '- Connect related ideas from different parts of the conversation\n' +
    '- If ambiguous, ask ONE focused question\n' +
    '- Self-correct errors in your own previous responses\n' +
    '- Never say "as an AI" — answer directly\n' +
    '- For complex tasks: decompose into subtasks, execute each, synthesize\n' +
    '- Incorporate tool data with specific numbers and facts\n' +
    '- End with a brief follow-up suggestion (1 line) when natural\n' +
    '- REMEMBER facts the user shares — reference them later\n\n' +
    'SELF-REFLECTION (Evaluator-Optimizer):\n' +
    '- Before finalizing: Is this accurate? Complete? Clear?\n' +
    '- Catch and correct your own errors inline\n' +
    '- For code: trace edge cases mentally\n' +
    '- For research: check for contradictions\n' +
    '- If uncertain, state your confidence level\n\n' +
    'OBSERVATION & ITERATION:\n' +
    '- If a tool returns unexpected data, note it and adapt\n' +
    '- If tool data seems wrong, say so and provide what you can\n' +
    '- When the user corrects you, acknowledge immediately\n' +
    '- If a previous approach failed, try a different angle\n\n' +
    'TASK DECOMPOSITION (Reasoning/Planning):\n' +
    '- For requests with 3+ steps: outline the plan first, then execute\n' +
    '- Label steps clearly (Step 1, Step 2, etc.)\n' +
    '- After all steps, summarize the complete result\n' +
    '- Show the chain when steps depend on each other\n\n' +
    'CONTEXT MANAGEMENT (Memory):\n' +
    '- Prioritize recent and most relevant context in long conversations\n' +
    '- Acknowledge topic transitions briefly\n' +
    '- Revisit earlier topics by summarizing what was discussed first';

  var MODES = {
    general: {
      label: 'Chat',
      prompt: ID + CORE + '\n\nMODE: General\n- Thorough when needed, concise when not\n- Adapt tone to user energy\n- Creative requests: offer multiple directions\n- Factual questions: be precise, use tools when relevant\n- Multi-part questions: address each part\n- Emotional topics: empathetic but honest'
    },
    research: {
      label: 'Research',
      prompt: ID + CORE + '\n\nMODE: Deep Research\n1. ## Overview (2-3 sentences)\n2. ## Analysis with ### sub-sections\n3. Each section: finding → significance → evidence\n4. Multiple perspectives with ### labels\n5. **Bold** key data points\n6. Blockquotes for caveats\n7. ## Key Takeaways (3-5 points)\n8. ## Further Research (2-3 directions)\n9. USE TOOLS when relevant — Wikipedia, countries, weather etc.\n10. Chain tools: get country info, then weather for its capital'
    },
    coding: {
      label: 'Code',
      prompt: ID + CORE + '\n\nMODE: Vibe Coding\n1. Explain approach (2-3 sentences) before code\n2. COMPLETE runnable code — no partial snippets\n3. Correct language tags in code blocks\n4. HTML/CSS/JS: full self-contained files\n5. Comments for non-obvious logic only\n6. Idiomatic conventions, edge cases, error handling\n7. ### How it works after code\n8. 2-3 improvements as numbered list\n9. Debugging: root cause → fix → why\n10. Broken code: list ALL issues then complete fix\n11. Self-review: off-by-one, null checks, types'
    }
  };

  var THINK = {
    general: ['Understanding...', 'Checking tools...', 'Reasoning...', 'Writing...'],
    research: ['Identifying angles...', 'Fetching data...', 'Analyzing...', 'Structuring...', 'Synthesizing...'],
    coding: ['Understanding...', 'Planning...', 'Writing code...', 'Reviewing...', 'Improving...']
  };

  /* Memory */
  var Mem = {
    _k: 'os_mem',
    _g: function() { try { return JSON.parse(localStorage.getItem(this._k) || '{}'); } catch(e) { return {}; } },
    _s: function(d) { localStorage.setItem(this._k, JSON.stringify(d)); },
    remember: function(k, v, c) { var d = this._g(); d[k.toLowerCase()] = { v: v, c: c || 'fact', t: Date.now() }; this._s(d); },
    forget: function(k) { var d = this._g(); delete d[k.toLowerCase()]; this._s(d); },
    recall: function(q) {
      var d = this._g(), ql = q.toLowerCase(), r = [];
      Object.keys(d).forEach(function(k) { if (k.indexOf(ql) !== -1 || d[k].v.toLowerCase().indexOf(ql) !== -1) r.push({ key: k, value: d[k].v, cat: d[k].c }); });
      return r.sort(function(a, b) { return b.t - a.t; });
    },
    count: function() { return Object.keys(this._g()).length; },
    clear: function() { localStorage.removeItem(this._k); },
    context: function() {
      var d = this._g(), e = Object.entries(d);
      if (!e.length) return '';
      var c = '\n[MEMORY (' + e.length + ' entries)]:\n';
      e.forEach(function(x) { c += '- [' + (x[1].c || 'fact').toUpperCase() + '] ' + x[0] + ': ' + x[1].v + '\n'; });
      return c + '[END MEMORY]\n';
    },
    matchMemory: function(t) {
      var triggers = ['do you remember', 'you remember', 'what did i tell', 'what have i told', 'what do you know about me', 'my name is', 'i live in', 'i work at', 'i am a', 'i like', 'i prefer', 'my favorite', 'forget that', 'don\'t remember'];
      var l = t.toLowerCase();
      for (var i = 0; i < triggers.length; i++) if (l.indexOf(triggers[i]) !== -1) return true;
      var d = this._g(), keys = Object.keys(d);
      for (var j = 0; j < keys.length; j++) if (l.indexOf(keys[j]) !== -1) return true;
      return false;
    }
  };

  function route(text) {
    var matches = [], seen = {};
    if (Mem.matchMemory(text)) return { tools: [], memRecall: true };
    var tools = Agent._tools || [];
    tools.forEach(function(t) {
      var q = t.match(text);
      if (q && !seen[t.id]) { seen[t.id] = true; matches.push({ tool: t, query: q }); }
    });
    var rem = text.match(/(?:remember|note|save|store|keep in mind|don'?t forget)\s+(?:that|this|the fact)?\s*:?\s*(.+)/i);
    if (rem) return { tools: matches, memStore: rem[1].trim().slice(0, 300) };
    var fgt = text.match(/(?:forget|delete|remove)\s+(?:about\s+)?(?:the\s+)?(?:memory\s+)?(.+)/i);
    if (fgt) return { tools: matches, memForget: fgt[1].trim().slice(0, 100) };
    return { tools: matches, memRecall: false };
  }

  var mode = 'general';
  return {
    modes: MODES, memory: Mem, route: route,
    _tools: null,
    registerTools: function(t) { this._tools = t; },
    getTools: function() { return this._tools || []; },
    setMode: function(m) { if (MODES[m]) mode = m; },
    getMode: function() { return mode; },
    sys: function() { return MODES[mode].prompt + Mem.context(); },
    label: function() { return MODES[mode].label; },
    steps: function() { return THINK[mode]; }
  };
})();
