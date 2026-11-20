// The job panel: JOB n/10 tag, title and who gave it, the countdown chip, the current objective,
// a segmented STAGE bar, the NEXT step and any counter (targets left, checkpoints, boss health).
export function createMissionPanel(game, root, set) {
  root.innerHTML = `<div class="mp-top"><span id="mp-tag" class="chip"></span><b id="mp-title"></b><span id="mp-timer" class="timer"></span></div>
<div id="mp-giver"></div><div id="mp-objective"></div>
<div class="mp-stage"><div id="mp-stages"></div><span id="mp-stage-label"></span></div>
<div id="mp-next"><em>NEXT</em><span id="mp-next-text"></span></div><div id="mp-extra"></div>`;
  const $ = (id) => root.querySelector('#' + id);
  const el = { tag: $('mp-tag'), title: $('mp-title'), timer: $('mp-timer'), giver: $('mp-giver'), obj: $('mp-objective'), stages: $('mp-stages'), label: $('mp-stage-label'), next: $('mp-next'), nextText: $('mp-next-text'), extra: $('mp-extra') };
  return {
    update() {
      const m = game.missions.hudInfo();
      set('mpShow', root.style, m ? '' : 'none', 'display');
      if (!m) return;
      const count = Array.isArray(m.stages) ? m.stages.length : m.stages;
      set('mpTag', el.tag, m.tag);
      set('mpTitle', el.title, m.title);
      set('mpTimer', el.timer, m.timer ? `⏱ ${m.timer}` : '');
      set('mpGiver', el.giver, m.giver || '');
      set('mpObj', el.obj, m.objective, 'innerHTML');
      set('mpStages', el.stages, Array.from({ length: count }, (_, i) => `<i class="${i < m.stage ? 'done' : i === m.stage ? 'now' : ''}"></i>`).join(''), 'innerHTML');
      set('mpLabel', el.label, count && m.stage >= 0 ? `STAGE ${Math.min(m.stage + 1, count)}/${count}` : '');
      set('mpNext', el.next.style, m.next ? '' : 'none', 'display');
      set('mpNextText', el.nextText, m.next || '');
      set('mpExtra', el.extra, m.extra || '', 'innerHTML');
    },
  };
}
