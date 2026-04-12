/* ═══════════════════════════════════════════════════════
 * Planner — Decomposes tasks, renders plan, tracks execution
 * ═══════════════════════════════════════════════════════ */
var Planner = (function () {

  var AGENTS = {
    researcher: { label: 'Researcher', tools: ['wiki', 'country', 'weather', 'uni'] },
    coder: { label: 'Coder', tools: [] },
    data: { label: 'Data Analyst', tools: ['math', 'num', 'exchange', 'crypto', 'ip'] },
    fun: { label: 'Fun Agent', tools: ['joke', 'chuck', 'trivia', 'quote', 'cat', 'dog', 'pokemon', 'advice', 'bored'] },
    utility: { label: 'Utility', tools: ['password', 'date', 'lorem', 'uuid', 'dict'] },
    social: { label: 'Social', tools: ['github', 'meal'] }
  };

  function identifyAgents(toolMatches) {
    var active = {};
    toolMatches.forEach(function (m) {
      Object.keys(AGENTS).forEach(function (a) {
        if (AGENTS[a].tools.indexOf(m.tool.id) !== -1) active[a] = true;
      });
    });
    if (Agent.getMode() === 'coding') active.coder = true;
    return Object.keys(active);
  }

  function createPlan(text, toolMatches, routeResult) {
    var steps = [];
    var agents = identifyAgents(toolMatches);
    var agentLabels = agents.map(function (a) { return AGENTS[a] ? AGENTS[a].label : a; });

    steps.push({
      label: 'Analyzing request',
      sub: agents.length ? 'Routing to ' + agentLabels.join(', ') : 'Direct response'
    });

    if (routeResult.memRecall) {
      steps.push({ label: 'Recalling memory', sub: 'Searching stored facts' });
    }

    if (toolMatches.length) {
      steps.push({
        label: 'Dispatching to ' + toolMatches.length + ' tool(s)',
        sub: agentLabels.join(' + ')
      });
      toolMatches.forEach(function (m) {
        var qStr = typeof m.query === 'string' ? m.query : String(m.query);
        steps.push({
          label: m.tool.icon + ' ' + m.tool.name,
          sub: qStr.length > 40 ? qStr.slice(0, 40) + '...' : qStr
        });
      });
    }

    if (routeResult.memStore) {
      steps.push({ label: 'Storing to memory', sub: routeResult.memStore.slice(0, 50) + '...' });
    }

    steps.push({
      label: 'Generating response',
      sub: Agent.getMode() === 'research' ? 'Structured analysis'
        : Agent.getMode() === 'coding' ? 'With code'
        : 'Natural language'
    });

    steps.push({ label: 'Reviewing and refining', sub: 'Self-check for accuracy' });

    return steps;
  }

  function esc(s) {
    var d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderPlan(container, steps) {
    container.innerHTML =
      '<div class="plan-card" id="planCard">' +
        '<div class="plan-progress"><div class="plan-progress-bar" id="planProgressBar"></div></div>' +
        '<div class="plan-head"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l5 5-5 5H1V6h5L6 1z" stroke="#555" stroke-width="1" stroke-linejoin="round"/></svg> Plan</div>' +
        '<div class="plan-steps" id="planSteps">' +
          steps.map(function (s, i) {
            return '<div class="plan-step" id="ps' + i + '">' +
              '<div class="plan-step-indicator"><span class="plan-dot"></span></div>' +
              '<div class="plan-step-content">' +
                '<span class="plan-step-label">' + esc(s.label) + '</span>' +
                (s.sub ? '<span class="plan-step-sub">' + esc(s.sub) + '</span>' : '') +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function markStep(index, status) {
    var el = document.getElementById('ps' + index);
    if (!el) return;
    el.className = 'plan-step ' + status;
    var bar = document.getElementById('planProgressBar');
    var total = document.querySelectorAll('.plan-step').length;
    if (bar && total) {
      var done = document.querySelectorAll('.plan-step.done').length;
      bar.style.width = Math.round(done / total * 100) + '%';
    }
  }

  function removePlan() {
    var el = document.getElementById('planCard');
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';
      el.style.transition = 'all .25s ease';
      setTimeout(function () { if (el.parentNode) el.remove(); }, 250);
    }
  }

  return {
    AGENTS: AGENTS,
    identifyAgents: identifyAgents,
    createPlan: createPlan,
    renderPlan: renderPlan,
    markStep: markStep,
    removePlan: removePlan
  };
})();
