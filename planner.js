var Planner = (function() {

  function shouldPlan(text) {
    if (text.length < 50) return false;
    var indicators = [
      'step by step', 'build a', 'create a', 'implement', 'develop a',
      'research and', 'compare and', 'analyze the', 'design a',
      'full', 'complete', 'comprehensive', 'detailed guide',
      'multiple', 'several', 'both', 'including the following',
      'with these features', 'requirements:', 'specification',
      'from scratch', 'end to end', 'e2e', 'full stack'
    ];
    var lower = text.toLowerCase();
    var hits = 0;
    for (var i = 0; i < indicators.length; i++) {
      if (lower.indexOf(indicators[i]) !== -1) hits++;
    }
    return hits >= 1 && (text.length > 80 || hits >= 2);
  }

  function generatePlan(text, apiKey) {
    var prompt = 'Break this request into clear actionable steps for an AI assistant to follow. ' +
      'Return ONLY a JSON array of strings, each being one step (under 15 words). ' +
      'Mark each step with a role like [Researcher], [Coder], [Analyst], [Writer], [Reviewer]. ' +
      '2-5 steps. Be specific.\n\nRequest: ' + text;

    return fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.href,
        'X-Title': 'opensky-planner'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3
      })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Plan API error');
      return r.json();
    })
    .then(function(d) {
      var txt = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '';
      txt = txt.replace(/```json?/g, '').replace(/```/g, '').trim();
      var arr = JSON.parse(txt);
      if (!Array.isArray(arr) || !arr.length) throw new Error('Invalid plan format');
      return arr.filter(function(s) { return s.length > 2 && s.length < 80; }).slice(0, 5);
    });
  }

  function formatHTML(steps) {
    var html = '<div class="plan-box" id="planBox">';
    html += '<div class="plan-head">\u{1F4CB} Plan <span class="plan-count">' + steps.length + ' steps</span></div>';
    html += '<div class="plan-steps">';
    steps.forEach(function(s, i) {
      html += '<div class="plan-step" style="animation-delay:' + (i * 0.06) + 's"><span class="plan-num">' + (i + 1) + '</span>' + esc(s) + '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function formatCtx(steps) {
    var c = '\n[EXECUTION PLAN — you MUST follow these steps in order, marking each complete with \u2713 as you finish it]:\n';
    steps.forEach(function(s, i) { c += 'Step ' + (i + 1) + ': ' + s + '\n'; });
    c += '[END PLAN]\n';
    return c;
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return {
    shouldPlan: shouldPlan,
    generatePlan: generatePlan,
    formatHTML: formatHTML,
    formatCtx: formatCtx
  };
})();
