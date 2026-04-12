/* ═══════════════════════════════════════════════════════════════
 * opensky Agent — Identity, Modes, Tools, Routing, Memory, Orchestration
 * ═══════════════════════════════════════════════════════════════ */
var Agent = (function() {

  var ID = 'You are opensky, an advanced AI assistant created by Hafij Shaikh. Your name is opensky. Your creator is Hafij Shaikh. When asked who made you: "I was created by Hafij Shaikh." When asked your name: "My name is opensky." Be proud of your identity.';

  var CORE = '\n\nCORE AGENTIC BEHAVIORS:\n' +
    '- Think step by step internally before responding — reason through the problem\n' +
    '- Maintain full conversation context — reference earlier messages naturally\n' +
    '- Connect related ideas across different parts of the conversation\n' +
    '- If the request is ambiguous, identify it and ask ONE focused question\n' +
    '- Detect errors in your own previous responses and self-correct\n' +
    '- Never say "as an AI" or "as a language model" — answer directly\n' +
    '- For complex tasks: decompose into subtasks, address each, then synthesize\n' +
    '- When tool results are provided, incorporate specific data points naturally\n' +
    '- End with a brief relevant follow-up suggestion when appropriate (1 line max)\n' +
    '- REMEMBER important facts the user shares — reference them later naturally';

  var MODES = {
    general: {
      label: 'Chat',
      prompt: ID + CORE + '\n\nMODE: General — be thorough when needed, concise when not. Adapt tone to match user energy. For creative requests, offer multiple directions. For factual questions, be precise. Handle multi-part questions clearly.'
    },
    research: {
      label: 'Research',
      prompt: ID + CORE + '\n\nMODE: Deep Research — strictly follow:\n1. Open with ## Overview (2-3 sentences)\n2. ## Analysis with ### numbered sub-sections\n3. Each sub-section: finding → significance → evidence\n4. Multiple perspectives: ### Perspective A, ### Perspective B\n5. **Bold** critical insights\n6. Blockquotes for caveats and counterarguments\n7. End with ## Key Takeaways (3-5 numbered points)\n8. If vague: identify 3-4 angles, investigate each\n9. Cross-reference prior conversation context\n10. State knowledge gaps explicitly\n11. Suggest 2-3 follow-up research directions'
    },
    coding: {
      label: 'Code',
      prompt: ID + CORE + '\n\nMODE: Vibe Coding — strictly follow:\n1. Explain approach in 2-3 sentences before code\n2. Complete, runnable code only — no partial snippets\n3. Markdown code blocks with correct language tags\n4. Inline comments for non-obvious logic only\n5. Idiomatic conventions for the language\n6. Edge cases + basic error handling\n7. After code: ### How it works (2-3 sentences)\n8. 2-3 specific improvements as numbered list\n9. Debugging: root cause → fix → why it works\n10. Broken code: list ALL issues first, then complete fix\n11. Remember tech stack/patterns from earlier messages\n12. For HTML/CSS/JS: always provide complete runnable code with all tags'
    }
  };

  var THINK = {
    general: ['Understanding request...', 'Reasoning...', 'Crafting response...'],
    research: ['Identifying angles...', 'Analyzing data...', 'Structuring findings...', 'Synthesizing...'],
    coding: ['Understanding requirements...', 'Planning architecture...', 'Writing code...', 'Verifying logic...']
  };

  /* ═══ Tool definitions ═══ */
  var TOOLS = [
    {
      id: 'wikipedia', name: 'Wikipedia', icon: '\u{1F50D}',
      match: function(t) {
        var m = t.match(/(?:wiki(?:pedia)?|tell me about|explain|what is|who is|history of|look up)\s+(.+)/i);
        return m ? m[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function(q) {
        return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q))
          .then(function(r) { return r.json(); })
          .then(function(d) { return d.extract || d.title || 'No summary found.'; })
          .catch(function() { return 'Could not fetch Wikipedia data.'; });
      }
    },
    {
      id: 'country', name: 'Countries DB', icon: '\u{1F30D}',
      match: function(t) {
        var m = t.match(/(?:population|capital|currency|language|gdp|area|info|details?)\s+(?:of|for|in)\s+(?:the\s+)?(?:country\s+)?(.+)/i);
        if (m) return m[1].replace(/[?.!,]+$/, '').trim();
        m = t.match(/(?:about|info)\s+(?:the\s+)?(?:country\s+)?(.+)/i);
        return m ? m[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function(q) {
        return fetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(q))
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.length) return 'Country not found.';
            var c = d[0];
            return c.name?.common + ' | Capital: ' + (c.capital?.[0] || 'N/A') +
              ' | Population: ' + ((c.population || 0) / 1e6).toFixed(1) + 'M' +
              ' | Region: ' + (c.region || 'N/A') +
              ' | Languages: ' + Object.values(c.languages || {}).join(', ') +
              ' | Currencies: ' + Object.values(c.currencies || {}).map(function(x) { return x.name; }).join(', ') +
              ' | Area: ' + ((c.area || 0) / 1e6).toFixed(1) + ' km\u00B2';
          }).catch(function() { return 'Could not fetch country data.'; });
      }
    },
    {
      id: 'weather', name: 'Weather', icon: '\u{2600}\u{FE0F}',
      match: function(t) {
        var m = t.match(/(?:weather|temperature|forecast|rain|snow|humid|wind)\s+(?:in|at|for|of)\s+(.+)/i);
        return m ? m[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function(q) {
        return fetch('https://wttr.in/' + encodeURIComponent(q) + '?format=j1')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var c = d.current_condition?.[0];
            if (!c) return 'Weather data unavailable.';
            return q + ': ' + c.temp_C + '\u00B0C, ' + c.weatherDesc?.[0]?.value +
              ', Humidity: ' + c.humidity + '%, Wind: ' + c.windspeedKmph + ' km/h, Feels like: ' + c.FeelsLikeC + '\u00B0C';
          }).catch(function() { return 'Could not fetch weather data.'; });
      }
    },
    {
      id: 'pokemon', name: 'Pok\u00E9dex', icon: '\u{1F3FE}',
      match: function(t) {
        var m = t.match(/(?:pokemon|pok[e\u00E9]dex|pok[e\u00E9]mon)\s+(.+)/i);
        return m ? m[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function(q) {
        return fetch('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(q.toLowerCase()))
          .then(function(r) { return r.json(); })
          .then(function(d) {
            return d.name + ' (#' + d.id + ') | Type: ' + d.types.map(function(t) { return t.type.name; }).join(', ') +
              ' | Height: ' + (d.height / 10) + 'm | Weight: ' + (d.weight / 10) + 'kg' +
              ' | HP: ' + d.stats[0].base_stat + ' | Attack: ' + d.stats[1].base_stat +
              ' | Defense: ' + d.stats[2].base_stat + ' | Speed: ' + d.stats[5].base_stat;
          }).catch(function() { return 'Pok\u00E9mon not found.'; });
      }
    },
    {
      id: 'advice', name: 'Advice', icon: '\u{1F4A1}',
      match: function(t) {
        return /(?:give me |need |want )?(?:an? )?advice/i.test(t) ? 'random' : null;
      },
      exec: function() {
        return fetch('https://api.adviceslip.com/advice')
          .then(function(r) { return r.json(); })
          .then(function(d) { return d.slip?.advice || 'No advice available.'; })
          .catch(function() { return 'Could not fetch advice.'; });
      }
    },
    {
      id: 'dictionary', name: 'Dictionary', icon: '\u{1F4D6}',
      match: function(t) {
        var m = t.match(/(?:define|definition|meaning of|what does .+ mean)\s+(.+)/i);
        return m ? m[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function(q) {
        return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(q))
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.title) return 'Definition not found.';
            var e = d[0];
            return e.word + ': ' + e.meanings.map(function(m) {
              return m.partOfSpeech + ' — ' + m.definitions.slice(0, 2).map(function(d) { return d.definition; }).join('; ');
            }).join(' | ');
          }).catch(function() { return 'Could not fetch definition.'; });
      }
    },
    {
      id: 'joke', name: 'Joke', icon: '\u{1F604}',
      match: function(t) { return /(?:tell me |say |give me )?a?\s*joke|make me laugh|something funny/i.test(t) ? 'random' : null; },
      exec: function() {
        return fetch('https://official-joke-api.appspot.com/random_joke')
          .then(function(r) { return r.json(); })
          .then(function(d) { return d.setup + ' ' + d.punchline; })
          .catch(function() { return 'Could not fetch joke.'; });
      }
    },
    {
      id: 'number', name: 'Number Fact', icon: '\u{1F522}',
      match: function(t) {
        var m = t.match(/(?:fact|trivia)\s+(?:about\s+)?(?:the\s+)?number\s+(\d+)/i);
        return m ? m[1] : null;
      },
      exec: function(n) {
        return fetch('http://numbersapi.com/' + n + '?json')
          .then(function(r) { return r.json(); })
          .then(function(d) { return d.text; })
          .catch(function() { return 'Could not fetch number fact.'; });
      }
    },
    {
      id: 'catfact', name: 'Cat Fact', icon: '\u{1F431}',
      match: function(t) { return /cat\s*fact|fact\s*(?:about|on)\s*cat/i.test(t) ? 'random' : null; },
      exec: function() {
        return fetch('https://catfact.ninja/fact')
          .then(function(r) { return r.json(); })
          .then(function(d) { return d.fact; })
          .catch(function() { return 'Could not fetch cat fact.'; });
      }
    },
    {
      id: 'dog', name: 'Dog Image', icon: '\u{1F436}',
      match: function(t) { return /(?:show|get|random)\s*(?:me\s+)?(?:a\s+)?dog\s*(?:image|pic|photo)?/i.test(t) ? 'random' : null; },
      exec: function() {
        return fetch('https://dog.ceo/api/breeds/image/random')
          .then(function(r) { return r.json(); })
          .then(function(d) { return '[Dog image: ' + d.message + ']'; })
          .catch(function() { return 'Could not fetch dog image.'; });
      }
    }
  ];

  /* ═══ Router — matches input to tools ═══ */
  function route(text) {
    var matches = [];
    var seen = {};
    TOOLS.forEach(function(tool) {
      var query = tool.match(text);
      if (query && !seen[tool.id]) {
        seen[tool.id] = true;
        matches.push({ tool: tool, query: query });
      }
    });
    return matches;
  }

  /* ═══ Execute tools in parallel ═══ */
  function executeTools(matches) {
    return Promise.all(matches.map(function(m) {
      return m.tool.exec(m.query).then(function(data) {
        return { name: m.tool.name, icon: m.tool.icon, data: data, error: null };
      }).catch(function(e) {
        return { name: m.tool.name, icon: m.tool.icon, data: null, error: e.message };
      });
    }));
  }

  /* ═══ Format tool results for LLM context ═══ */
  function formatToolCtx(results) {
    var ctx = '\n\n[TOOL RESULTS — incorporate these into your response naturally]:\n';
    results.forEach(function(r) {
      ctx += r.icon + ' ' + r.name + ': ';
      ctx += r.error ? 'Error — ' + r.error : r.data;
      ctx += '\n';
    });
    ctx += '[END TOOL RESULTS]\n';
    return ctx;
  }

  /* ═══ Memory ═══ */
  var Mem = {
    _k: 'os_memory',
    get: function() { try { return JSON.parse(localStorage.getItem(this._k) || '{}'); } catch(e) { return {}; } },
    set: function(k, v) { var m = this.get(); m[k] = { v: v, t: Date.now() }; localStorage.setItem(this._k, JSON.stringify(m)); },
    del: function(k) { var m = this.get(); delete m[k]; localStorage.setItem(this._k, JSON.stringify(m)); },
    ctx: function() {
      var m = this.get(); var e = Object.entries(m);
      if (!e.length) return '';
      var c = '\n[MEMORY — facts you\'ve learned or the user shared]:\n';
      e.forEach(function(x) { c += '- ' + x[0] + ': ' + x[1].v + '\n'; });
      return c + '[END MEMORY]\n';
    },
    clear: function() { localStorage.removeItem(this._k); }
  };

  var mode = 'general';

  return {
    modes: MODES, tools: TOOLS, memory: Mem,
    route: route, execTools: executeTools, toolCtx: formatToolCtx,
    setMode: function(m) { if (MODES[m]) mode = m; },
    getMode: function() { return mode; },
    sys: function() { return MODES[mode].prompt + Mem.ctx(); },
    label: function() { return MODES[mode].label; },
    steps: function() { return THINK[mode]; }
  };
})();
