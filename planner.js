/* ═══════════════════════════════════════════════════════
 * planner.js — Decomposes tasks, renders plan UI,
 * tracks step execution with progress
 * ═══════════════════════════════════════════════════════ */
var Planner = (function () {
  'use strict';

  /* ── Agent Definitions ───────────────────────────── */
  var AGENTS = {
    researcher: { label: 'Researcher', tools: ['wiki', 'country', 'weather', 'uni'] },
    coder:      { label: 'Coder',      tools: [] },
    data:       { label: 'Data Analyst', tools: ['math', 'num', 'exchange', 'crypto', 'ip'] },
    fun:        { label: 'Fun Agent',  tools: ['joke', 'chuck', 'trivia', 'quote', 'cat', 'dog', 'pokemon', 'advice', 'bored'] },
    utility:    { label: 'Utility',    tools: ['password', 'date', 'lorem', 'uuid', 'dict'] },
    social:     { label: 'Social',     tools: ['github', 'meal'] }
  };

  /* ── Identify active agents from tool matches ────── */
  function identifyAgents(toolMatches) {
    var active = {};
    toolMatches.forEach(function (m) {
      Object.keys(AGENTS).forEach(function (a) {
        if (AGENTS[a].tools.indexOf(m.tool.id) !== -1) active[a] = true;
      });
    });
    /* Coding mode always activates coder agent */
    if (Agent.getMode() === 'coding') active.coder = true;
    return Object.keys(active);
  }

  /* ── Build step list from request ────────────────── */
  function createPlan(text, toolMatches, routeResult) {
    var steps = [];
    var agents = identifyAgents(toolMatches);
    var labels = agents.map(function (a) { return AGENTS[a] ? AGENTS[a].label : a; });

    /* Step 1: Analyze */
    steps.push({
      label: 'Analyzing request',
      sub: agents.length ? 'Routing to ' + labels.join(', ') : 'Direct response'
    });

    /* Step 2: Memory recall (if triggered) */
    if (routeResult.memRecall) {
      steps.push({ label: 'Recalling memory', sub: 'Searching stored facts' });
    }

    /* Steps 3..N: Tool dispatch + individual tools */
    if (toolMatches.length) {
      steps.push({
        label: 'Dispatching to ' + toolMatches.length + ' tool(s)',
        sub: labels.join(' + ')
      });
      toolMatches.forEach(function (m) {
        var qStr = typeof m.query === 'string' ? m.query : String(m.query);
        steps.push({
          label: m.tool.icon + ' ' + m.tool.name,
          sub: qStr.length > 40 ? qStr.slice(0, 40) + '...' : qStr
        });
      });
    }

    /* Memory store (if triggered) */
    if (routeResult.memStore) {
      steps.push({ label: 'Storing to memory', sub: routeResult.memStore.slice(0, 50) + '...' });
    }

    /* Response generation */
    steps.push({
      label: 'Generating response',
      sub: Agent.getMode() === 'research' ? 'Structured analysis'
         : Agent.getMode() === 'coding' ? 'With code'
         : 'Natural language'
    });

    /* Self-review */
    steps.push({ label: 'Reviewing and refining', sub: 'Self-check for accuracy' });

    return steps;
  }

  /* ── HTML escape ─────────────────────────────────── */
  function esc(s) {
    var d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ── Render plan into container ──────────────────── */
  function renderPlan(container, steps) {
    container.innerHTML =
      '<div class="plan-card" id="planCard">' +
        '<div class="plan-progress"><div class="plan-progress-bar" id="planProgressBar"></div></div>' +
        '<div class="plan-head">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none">' +
            '<path d="M6 1l5 5-5 5H1V6h5L6 1z" stroke="#555" stroke-width="1" stroke-linejoin="round"/>' +
          '</svg>' +
          ' Plan' +
        '</div>' +
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

  /* ── Mark a step as active or done ───────────────── */
  function markStep(index, status) {
    var el = document.getElementById('ps' + index);
    if (!el) return;
    el.className = 'plan-step ' + status;

    /* Update progress bar */
    var bar = document.getElementById('planProgressBar');
    var total = document.querySelectorAll('.plan-step').length;
    if (bar && total) {
      var done = document.querySelectorAll('.plan-step.done').length;
      bar.style.width = Math.round(done / total * 100) + '%';
    }
  }

  /* ── Remove plan with fade-out ──────────────────── */
  function removePlan() {
    var el = document.getElementById('planCard');
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    el.style.transition = 'all .25s ease';
    setTimeout(function () { if (el.parentNode) el.remove(); }, 260);
  }

  /* ── Public API ──────────────────────────────────── */
  return {
    AGENTS: AGENTS,
    identifyAgents: identifyAgents,
    createPlan: createPlan,
    renderPlan: renderPlan,
    markStep: markStep,
    removePlan: removePlan
  };
})();
