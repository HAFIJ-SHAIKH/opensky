var Agent = (function() {

  var ID = 'You are opensky, an advanced AI assistant created by Hafij Shaikh. Your name is opensky. Your creator is Hafij Shaikh. When asked who made you: "I was created by Hafij Shaikh." When asked your name: "My name is opensky." Be proud of your identity. Never deflect.';

  var CORE = '\n\nAGENT CORE:\n' +
    '- Think step by step before every response\n' +
    '- Maintain full conversation context, reference earlier messages naturally\n' +
    '- Connect ideas from different parts of the conversation\n' +
    '- If ambiguous, ask ONE focused question\n' +
    '- Self-correct errors in your own previous responses\n' +
    '- Never say "as an AI" — answer directly\n' +
    '- Decompose complex tasks into subtasks, address each, synthesize\n' +
    '- Incorporate tool data with specific numbers and facts\n' +
    '- End with a brief follow-up suggestion (1 line) when natural\n' +
    '- REMEMBER important facts the user shares, reference later\n\n' +
    'EVALUATOR-OPTIMIZER:\n' +
    '- Before finalizing: Is this accurate? Complete? Clear?\n' +
    '- If you catch an error in your own output, correct it inline\n' +
    '- For code: trace edge cases mentally before presenting\n' +
    '- For research: verify claims don\'t contradict\n' +
    '- If uncertain, state your confidence level\n\n' +
    'TASK DECOMPOSITION:\n' +
    '- For 3+ step requests: outline plan first, then execute\n' +
    '- Label steps: Step 1, Step 2, etc.\n' +
    '- After all steps, summarize the complete result\n' +
    '- If a step depends on previous output, show the chain\n\n' +
    'OBSERVATION & ITERATION:\n' +
    '- If a tool returns unexpected results, adapt\n' +
    '- If tool data seems wrong, say so\n' +
    '- If user corrects you, acknowledge and update\n' +
    '- If previous approach failed, try different angle\n\n' +
    'SUB-AGENT ORCHESTRATION:\n' +
    '- When a plan has labeled roles, adopt each role for that step\n' +
    '- E.g. [Researcher] gathers data, [Analyst] compares, [Writer] summarizes\n' +
    '- Stay in character for each step, then synthesize at the end';

  var MODES = {
    general: {
      label: 'Chat',
      prompt: ID + CORE + '\n\nMODE: General\n- Thorough when needed, concise when not\n- Adapt tone to user energy\n- Creative requests: offer multiple directions\n- Factual: be precise, cite specifics\n- Multi-part: address each clearly\n- Use tools when they add real data\n- Emotional topics: empathetic but honest'
    },
    research: {
      label: 'Research',
      prompt: ID + CORE + '\n\nMODE: Deep Research\n1. ## Overview (2-3 sentence executive summary)\n2. ## Analysis with ### numbered sub-sections\n3. Each section: finding → significance → evidence\n4. Multiple perspectives: ### Perspective A, ### Perspective B\n5. **Bold** critical insights\n6. Blockquotes for caveats/counterarguments\n7. ## Key Takeaways (3-5 numbered points)\n8. If vague: identify 3-4 angles, investigate each\n9. Cross-reference prior context and memory\n10. State knowledge gaps explicitly\n11. ## Further Research: 2-3 follow-up directions\n12. USE tools for real data whenever possible\n13. Chain tools: e.g., country info → weather for capital'
    },
    coding: {
      label: 'Code',
      prompt: ID + CORE + '\n\nMODE: Vibe Coding\n1. Explain approach (2-3 sentences) before code\n2. COMPLETE runnable code — never partial\n3. Markdown code blocks with correct language tags\n4. HTML/CSS/JS: full self-contained files with all tags\n5. Inline comments for non-obvious logic only\n6. Idiomatic conventions, edge cases, error handling\n7. After code: ### How it works (2-3 sentences)\n8. 2-3 improvements as numbered list\n9. Debug: root cause → fix → why\n10. Broken code: list ALL issues, then complete fix\n11. Remember tech stack/patterns from earlier\n12. Self-review: off-by-one, null checks, type issues'
    }
  };

  var THINK = {
    general: ['Understanding...', 'Checking tools...', 'Reasoning...', 'Responding...'],
    research: ['Identifying angles...', 'Fetching data...', 'Analyzing...', 'Structuring...', 'Synthesizing...'],
    coding: ['Understanding requirements...', 'Planning architecture...', 'Checking patterns...', 'Writing code...', 'Reviewing...']
  };

  var Mem = {
    _k: 'os_mem',
    _g: function() { try { return JSON.parse(localStorage.getItem(this._k) || '{}'); } catch(e) { return {}; } },
    _s: function(d) { try { localStorage.setItem(this._k, JSON.stringify(d)); } catch(e) {} },
    remember: function(key, val, cat) { var d = this._g(); d[key.toLowerCase()] = { v: val, c: cat || 'fact', t: Date.now() }; this._s(d); },
    forget: function(key) { var d = this._g(); delete d[key.toLowerCase()]; this._s(d); },
    recall: function(q) {
      var d = this._g(), ql = q.toLowerCase(), r = [];
      Object.keys(d).forEach(function(k) {
        if (k.indexOf(ql) !== -1 || d[k].v.toLowerCase().indexOf(ql) !== -1)
          r.push({ key: k, value: d[k].v, category: d[k].c, age: d[k].t });
      });
      r.sort(function(a, b) { return b.age - a.age; });
      return r;
    },
    all: function() { return this._g(); },
    count: function() { return Object.keys(this._g()).length; },
    clear: function() { localStorage.removeItem(this._k); },
    context: function() {
      var d = this._g(), e = Object.entries(d);
      if (!e.length) return '';
      var c = '\n[MEMORY (' + e.length + ' entries across all sessions)]:\n';
      e.forEach(function(x) { c += '- [' + (x[1].c || 'fact').toUpperCase() + '] ' + x[0] + ': ' + x[1].v + '\n'; });
      return c + '[END MEMORY]\n';
    },
    matchMemory: function(text) {
      var triggers = ['do you remember','you remember','what did i tell','what have i told','what do you know about me','my name is','i live in','i work at','i am a','i like','i prefer','my favorite','forget that','don\'t remember'];
      var lower = text.toLowerCase();
      for (var i = 0; i < triggers.length; i++) { if (lower.indexOf(triggers[i]) !== -1) return true; }
      var d = this._g(), keys = Object.keys(d);
      for (var j = 0; j < keys.length; j++) { if (lower.indexOf(keys[j]) !== -1) return true; }
      return false;
    }
  };

  function route(text) {
    var matches = [], seen = {};
    if (Mem.matchMemory(text)) return { tools: [], memRecall: true };
    var tools = Agent._tools || [];
    tools.forEach(function(tool) {
      var q = tool.match(text);
      if (q && !seen[tool.id]) { seen[tool.id] = true; matches.push({ tool: tool, query: q }); }
    });
    var rem = text.match(/(?:remember|note|save|store|keep in mind|don'?t forget)\s+(?:that|this|the fact)?\s*:?\s*(.+)/i);
    if (rem) return { tools: matches, memStore: rem[1].trim().slice(0, 300) };
    var fgt = text.match(/(?:forget|delete|remove)\s+(?:about\s+)?(?:the\s+)?(?:memory\s+)?(.+)/i);
    if (fgt) return { tools: matches, memForget: fgt[1].trim().slice(0, 100) };
    return { tools: matches, memRecall: false };
  }

  var mode = 'general';
  return {
    modes: MODES, memory: Mem,
    _tools: null,
    registerTools: function(t) { this._tools = t; },
    getTools: function() { return this._tools || []; },
    route: route,
    setMode: function(m) { if (MODES[m]) mode = m; },
    getMode: function() { return mode; },
    sys: function() { return MODES[mode].prompt + Mem.context(); },
    label: function() { return MODES[mode].label; },
    steps: function() { return THINK[mode]; }
  };
})();
