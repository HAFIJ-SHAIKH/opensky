/* ═══════════════════════════════════════════════════════
 * Planner — Decomposes tasks, renders plan, tracks execution
 * ═══════════════════════════════════════════════════════ */
var Planner = (function() {

  /* Sub-agent definitions */
  var AGENTS = {
    researcher: { label: 'Researcher', tools: ['wiki', 'country', 'weather', 'uni'] },
    coder:     { label: 'Coder',      tools: [] },
    data:      { label: 'Data Analyst', tools: ['math', 'num', 'exchange', 'crypto', 'ip'] },
    fun:       { label: 'Fun Agent',   tools: ['joke', 'chuck', 'trivia', 'quote', 'cat', 'dog', 'pokemon', 'advice', 'bored'] },
    utility:   { label: 'Utility',    tools: ['password', 'date', 'lorem', 'uuid', 'dict'] },
    social:    { label: 'Social',      tools: ['github', 'meal'] }
  };

  function identifyAgents(toolMatches) {
    var active = {};
    toolMatches.forEach(function(m) {
      Object.keys(AGENTS).forEach(function(a) {
        if (AGENTS[a].tools.indexOf(m.tool.id) !== -1) active[a] = true;
      });
    });
    // Always include coder if in coding mode
    if (Agent.getMode() === 'coding') active.coder = true;
    return Object.keys(active);
  });

  function createPlan(text, toolMatches, routeResult) {
    var steps = [];
    var agents = identifyAgents(toolMatches);
    var agentLabels = agents.map(function(a) { return AGENTS[a] ? AGENTS[a].label : a; });

    // Step 1: Always analyze
    steps.push({ label: 'Analyzing request', sub: agents.length ? 'Routing to ' + agentLabels.join(', ') : 'Direct response', icon: 'analyze' });

    // Step 2: Memory if needed
    if (routeResult.memRecall) {
      steps.push({ label: 'Recalling memory', sub: 'Searching stored facts', icon: 'memory' });
    }

    // Step 3: Tools
    if (toolMatches.length) {
      steps.push({ label: 'Dispatching to ' + toolMatches.length + ' tool(s)', sub: agentLabels.join(' + '), icon: 'route' });
      toolMatches.forEach(function(m) {
        steps.push({ label: m.tool.icon + ' ' + m.tool.name, sub: m.query.length > 40 ? m.query.slice(0, 40) + '...' : m.query, icon: 'tool' });
      });
    }

    // Step 4: Memory store
    if (routeResult.memStore) {
      steps.push({ label: 'Storing to memory', sub: routeResult.memStore.slice(0, 50) + '...', icon: 'memory' });
    }

    // Step 5: Generate
    steps.push({ label: 'Generating response', sub: Agent.getMode() === 'research' ? 'Structured analysis' : Agent.getMode() === 'coding' ? 'With code' : 'Natural language', icon: 'generate' });

    // Step 6: Review
    steps.push({ label: 'Reviewing and refining', sub: 'Self-check for accuracy', icon: 'review' });

    return steps;
  }

  var CHECK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SPIN = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2a4 4 0 014 4 4 4 0 01-4-4" stroke="#999" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="16 6"/></svg>';
  var CIRCLE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="3" stroke="#2a2a2a" stroke-width="1"/></svg>';

  function renderPlan(container, steps) {
    container.innerHTML = '<div class="plan-card" id="planCard">' +
      '<div class="plan-head"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l5 5-5 5H1V6h5L6 1z" stroke="#555" stroke-width="1" stroke-linejoin="round"/></svg> Execution Plan</div>' +
      '<div class="plan-steps" id="planSteps">' +
      steps.map(function(s, i) {
        return '<div class="plan-step" id="ps' + i + '">' +
          '<div class="plan-step-icon">' + CIRCLE + '</div>' +
          '<span>' + esc(s.label) + '</span>' +
          (s.sub ? '<span style="color:var(--g3);font-size:9.5px;margin-left:4px">' + esc(s.sub) + '</span>' : '') +
          '</div>';
      }).join('') +
      '</div></div>';
  }

  function markStep(index, status) {
    var el = document.getElementById('ps' + index);
    if (!el) return;
    el.className = 'plan-step ' + status;
    var icon = el.querySelector('.plan-step-icon');
    if (!icon) return;
    if (status === 'done') icon.innerHTML = CHECK;
    else if (status === 'active') icon.innerHTML = SPIN;
    else icon.innerHTML = CIRCLE;
  }

  function removePlan() {
    var el = document.getElementById('planCard');
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; setTimeout(function() { if (el.parentNode) el.remove(); }, 200); }
  }

  function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML; }

  return {
    AGENTS: AGENTS,
    identifyAgents: identifyAgents,
    createPlan: createPlan,
    renderPlan: renderPlan,
    markStep: markStep,
    removePlan: removePlan
  };
})();
