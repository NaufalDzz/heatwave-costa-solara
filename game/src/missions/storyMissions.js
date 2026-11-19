// The ten-job HEATWAVE story: Nico comes home to Costa Solara, rebuilds Tía Rosa's crew with
// Wrench and Lexi, and takes on Dante Kroll's syndicate and the cops he owns. Each job lists where
// it starts, its dialogue and its stages (drive, steal, deliver, fight, chase, escape, race).
export const STORY = [
  {
    id: 'arrival', title: 'Sunset Arrival', giver: 'rosa', start: { x: -360, z: 171 },
    blurb: 'Rosa lends you her old Thunderhawk and sends you to her mechanic.',
    intro: [['rosa', 'Nico! Five years and not one postcard. Look at you, all grown and still broke.'], ['nico', 'Missed you too, Tía. I heard the Krolls bought half the street.'], ['rosa', 'They bought it, mijo. Now they collect. Take my Thunderhawk to Wrench. We start rebuilding today.']],
    stages: [
      { type: 'enter', text: "Get in Rosa's Thunderhawk", spawn: { type: 'muscle', x: -345, z: 166.1, heading: Math.PI / 2, color: '#9b2226' }, tag: 'rosa-car' },
      { type: 'deliver', text: 'Drive the Thunderhawk to Wrench Works', x: -280, z: 4, radius: 8, tag: 'rosa-car' },
      { type: 'talk', lines: [['wrench', 'Rosa\'s Thunderhawk! She runs like a dream. Mostly. You must be Nico.'], ['wrench', 'Garage is open for you. Repairs, resprays, tuning. Respray loses cops too.']] },
    ],
    reward: { money: 1500, respect: 150 },
  },
  {
    id: 'wheels', title: 'Wheels for Wrench', giver: 'wrench', start: { x: -280, z: 11 },
    blurb: 'Steal a Vortex GT off Palmera Beach for a client of Wrench.',
    intro: [['wrench', 'Client wants a Vortex GT. Red. There is one parked on the beach strip, showing off.'], ['wrench', 'Alarm is loud, so expect the cops to take an interest. Bring it back in one piece.']],
    stages: [
      { type: 'enter', text: 'Steal the red Vortex GT on Palmera Beach', spawn: { type: 'sports', x: 120, z: 406.1, heading: Math.PI / 2, color: '#e63946' }, tag: 'gt', wanted: 1 },
      { type: 'deliver', text: 'Bring the Vortex GT to Wrench Works', x: -280, z: 4, radius: 8, tag: 'gt', minCondition: 40 },
    ],
    reward: { money: 2500, respect: 200 },
  },
  {
    id: 'neon', title: 'Neon Debts', giver: 'lexi', start: { x: 280, z: 9 },
    blurb: 'Coyote collectors are shaking down Neon Row. Lexi wants them gone.',
    intro: [['lexi', 'So you are Rosa\'s nephew. Cute. Can you fight?'], ['lexi', 'Three Coyote collectors outside Club Azure. They work for Kroll now. Make them stop.']],
    stages: [
      { type: 'kill', text: 'Take out the Coyote collectors', gang: 'coyote', enemies: [[268, 89], [286, 88.5], [300, 89.5]], weapon: 'pistol' },
      { type: 'escape', text: 'Lose the cops', level: 2 },
    ],
    reward: { money: 3000, respect: 300, weapon: ['smg', 90] },
  },
  {
    id: 'courier', title: 'Courier Run', giver: 'lexi', start: { x: 280, z: 9 },
    blurb: 'A Kroll courier van carries ledgers. Wreck it and grab the case.',
    intro: [['lexi', 'Kroll moves his books by van. One just left the club. Wreck it, grab the case.'], ['nico', 'Books. Exciting.'], ['lexi', 'Books full of cops on his payroll. Very exciting.']],
    stages: [
      { type: 'chase', text: 'Wreck the Kroll courier van', spawn: { type: 'van', x: 230, z: -1.9, heading: -Math.PI / 2, color: '#1d1d24' }, speed: 24 },
      { type: 'pickup', text: 'Grab the ledger case' },
      { type: 'goto', text: 'Bring the case to Lexi', x: 280, z: 9, radius: 5 },
    ],
    reward: { money: 3500, respect: 300 },
  },
  {
    id: 'harbor', title: 'Harbor Heat', giver: 'rosa', start: { x: -360, z: 171 },
    blurb: 'Kroll muscle is unloading guns at Marina Azul. Crash the party.',
    intro: [['rosa', 'Kroll\'s boys are unloading crates at Marina Azul tonight. Guns for the Coyotes.'], ['rosa', 'Those crates do not reach the street. Comprende?']],
    stages: [
      { type: 'goto', text: 'Drive to the Marina Azul docks', x: 600, z: 120, radius: 14 },
      { type: 'kill', text: 'Wipe out the Kroll crew at the docks', gang: 'kroll', enemies: [[630, 140], [650, 150], [670, 135], [660, 175], [685, 160], [620, 172]], weapon: 'smg' },
      { type: 'escape', text: 'Lose the cops', level: 3 },
    ],
    reward: { money: 5000, respect: 450, weapon: ['shotgun', 24] },
  },
  {
    id: 'parts', title: 'Hot Parts', giver: 'wrench', start: { x: -280, z: 11 },
    blurb: 'A timed run across town with hot engine parts.',
    intro: [['wrench', 'Parts for the Thunderhawk, still warm from the Kroll lot. Buyer waits in Neon Row.'], ['wrench', 'Clock is ticking. Hit every checkpoint.']],
    stages: [
      { type: 'enter', text: 'Get in the Coastal Van', spawn: { type: 'van', x: -268, z: 5, heading: Math.PI / 2, color: '#4cc9f0' }, tag: 'parts-van' },
      { type: 'timed', text: 'Hit every checkpoint before time runs out', seconds: 100, points: [[-160, 0], [-160, 240], [80, 240], [80, 400], [320, 400], [320, 160]], tag: 'parts-van' },
    ],
    reward: { money: 4000, respect: 350 },
  },
  {
    id: 'captain', title: "The Captain's Price", giver: 'hale', start: { x: 120, z: -67 },
    blurb: 'Capt. Hale sells you a favour, then sells you out.',
    intro: [['hale', 'Reyes. Rosa says you can be trusted. I say everyone has a price.'], ['hale', 'Carry this envelope to my associate downtown. Do not open it.']],
    stages: [
      { type: 'goto', text: 'Deliver the envelope downtown', x: -40, z: -164, radius: 6 },
      { type: 'talk', lines: [['lexi', 'Nico, that is no associate. Kroll guards, everywhere. Hale sold you!']] },
      { type: 'kill', text: 'Survive the Kroll ambush', gang: 'kroll', enemies: [[-55, -156], [-25, -166], [-62, -163], [-20, -157]], weapon: 'pistol' },
      { type: 'escape', text: 'Hale called it in. Lose the cops', level: 3 },
    ],
    reward: { money: 5000, respect: 500 },
  },
  {
    id: 'convoy', title: "Kroll's Convoy", giver: 'rosa', start: { x: -360, z: 171 },
    blurb: 'Destroy the armored hauler carrying Kroll\'s cash.',
    intro: [['rosa', 'Kroll moves his cash in an armored hauler out of the Ironworks.'], ['rosa', 'Burn it. Every dollar he loses is a dollar he cannot pay Hale.']],
    stages: [
      { type: 'chase', text: 'Destroy the Kroll Armored Hauler', spawn: { type: 'armored', x: 240, z: -241.9, heading: -Math.PI / 2 }, speed: 18, armored: true },
      { type: 'escape', text: 'Lose the cops', level: 4 },
    ],
    reward: { money: 8000, respect: 700, weapon: ['rifle', 90] },
  },
  {
    id: 'bridge', title: 'Bridge Burner', giver: 'lexi', start: { x: 280, z: 9 },
    blurb: 'Kroll closes the Solara bridge to take the island. Open it.',
    intro: [['lexi', 'Kroll\'s crew blocked the south Solara bridge. Marina Azul is cut off.'], ['lexi', 'Clear the bridge. I will jam their radios. Cops will still come.']],
    stages: [
      { type: 'goto', text: 'Get to the Solara bridge', x: 430, z: -160, radius: 14 },
      { type: 'kill', text: 'Clear the Kroll crew off the bridge', gang: 'kroll', enemies: [[448, -163], [460, -157], [474, -162], [486, -158], [470, -166], [495, -161]], weapon: 'rifle' },
      { type: 'escape', text: 'Shake the cops and the chopper', level: 4 },
    ],
    reward: { money: 9000, respect: 800 },
  },
  {
    id: 'finale', title: 'Heatwave', giver: 'rosa', start: { x: -360, z: 171 },
    blurb: 'Storm Kroll Tower, end Dante Kroll and make it home alive.',
    intro: [['rosa', 'Dante is in his tower downtown, counting what he has left. Not much, thanks to you.'], ['dante', 'Reyes! You burned my money and my bridge. Come up and burn me too, if you can.'], ['rosa', 'Go. And come back to me, mijo.']],
    stages: [
      { type: 'goto', text: 'Get to Kroll Tower, Downtown Solano', x: 40, z: -82, radius: 12 },
      { type: 'kill', text: 'Kill Dante Kroll and his guards', gang: 'kroll', enemies: [[30, -84], [50, -84], [24, -78], [56, -78], [40, -90], [40, -76]], boss: 'dante', weapon: 'rifle' },
      { type: 'escape', text: 'All of SCPD is coming. Lose them', level: 5 },
      { type: 'goto', text: 'Get home to Casa Sol', x: -120, z: 391, radius: 6 },
    ],
    outro: [['rosa', 'You did it. The street is ours again, Nico. Welcome home.'], ['nico', 'Make me a coffee, Tía. A big one.']],
    reward: { money: 25000, respect: 2000 },
  },
];
