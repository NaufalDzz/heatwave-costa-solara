// The vehicle panel while driving: model name and class with its garage tune, a condition bar,
// the speed in very large digits and the nitro tank.
const CLASS = { sports: 'SPORTS', muscle: 'MUSCLE', sedan: 'SEDAN', suv: 'SUV', taxi: 'CAB', van: 'VAN', truck: 'TRUCK', police: 'INTERCEPTOR', armored: 'ARMORED' };

export function createVehiclePanel(game, root, set) {
  root.innerHTML = `<div class="vp-head"><b id="veh-name"></b><span id="veh-class"></span></div>
<div class="vp-row"><label>CONDITION</label><div class="bar cond"><i id="veh-cond"></i></div><b id="veh-cond-num"></b></div>
<div class="vp-speed"><b id="veh-speed">0</b><span>KM/H</span></div>
<div class="vp-row"><label id="veh-nos-label">NITRO</label><div class="bar nos"><i id="veh-nos"></i></div><b id="veh-nos-num"></b></div>`;
  const $ = (id) => root.querySelector('#' + id);
  const el = { name: $('veh-name'), cls: $('veh-class'), cond: $('veh-cond'), condN: $('veh-cond-num'), speed: $('veh-speed'), nos: $('veh-nos'), nosN: $('veh-nos-num'), nosL: $('veh-nos-label') };
  return {
    update() {
      const p = game.player, v = p.vehicle;
      set('vehShow', root.style, v ? '' : 'none', 'display');
      if (!v) return;
      const up = v.upgrades || {};
      const tune = [up.engine ? `ENGINE ${up.engine}` : '', up.armor ? `ARMOUR ${up.armor}` : '', up.tyres ? 'GRIP' : ''].filter(Boolean).join(' · ');
      set('vehName', el.name, v.spec.name.toUpperCase());
      set('vehClass', el.cls, [CLASS[v.type] || 'CAR', tune].filter(Boolean).join(' · '));
      const cond = Math.max(0, Math.round(v.condition));
      set('vehCond', el.cond.style, `${cond}%`, 'width');
      set('vehCondN', el.condN, `${cond}%`);
      set('vehCondCls', el.cond.parentNode, `bar cond${cond < 35 ? ' low' : ''}`, 'className');
      set('vehSpeed', el.speed, String(Math.round(Math.abs(v.speed) * 3.6)));
      const hasNitro = game.economy.upgrades.nitro;
      set('vehNos', el.nos.style, `${hasNitro ? Math.round(p.nitro * 100) : 0}%`, 'width');
      set('vehNosN', el.nosN, hasNitro ? `${Math.round(p.nitro * 100)}%` : 'NO KIT');
      set('vehNosOn', root.dataset, hasNitro && p.driveInput.nitro ? 'on' : '', 'nitro');
    },
  };
}
