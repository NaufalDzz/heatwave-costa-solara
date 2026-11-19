// The original cast of HEATWAVE and how each face is drawn: skin, hair, clothing, accessories
// and backdrop for the procedural dialogue portraits.
export const CAST = {
  nico: { name: 'Nico Reyes', role: 'You. Back in Costa Solara after five years away.', skin: '#c68863', hair: 'short', hairColor: '#1b1b1b', shirt: '#17b3a8', bg: ['#1a5c6b', '#2fe6d8'], extra: ['stubble'] },
  rosa: { name: 'Tía Rosa Vega', role: 'Mentor. Runs Café Rosa and half of Sunset Heights.', skin: '#d9a07a', hair: 'bun', hairColor: '#cfcfcf', shirt: '#b5179e', bg: ['#7a2a12', '#ff9f43'], extra: ['earrings', 'lipstick'] },
  wrench: { name: 'Jojo "Wrench" Okafor', role: 'Crew. Mechanic at Wrench Works, never met an engine he could not wake.', skin: '#6b4430', hair: 'cap', hairColor: '#2b2b2b', capColor: '#ff7b00', shirt: '#264653', bg: ['#103a3a', '#2a9d8f'], extra: ['goggles', 'beard'] },
  lexi: { name: 'Lexi Moon', role: 'Crew. Getaway driver and hacker from Neon Row.', skin: '#f1c7a5', hair: 'long', hairColor: '#ff4fa3', shirt: '#1d1d24', bg: ['#2a0a3a', '#c77dff'], extra: ['lipstick', 'piercing'] },
  dante: { name: 'Dante Kroll', role: 'Rival. Developer, landlord and owner of the Kroll Syndicate.', skin: '#e8b48f', hair: 'slick', hairColor: '#3b2416', shirt: '#4b1d6e', bg: ['#14051f', '#6a1b9a'], extra: ['shades', 'tie'] },
  hale: { name: 'Capt. Marcus Hale', role: 'SCPD captain who sells protection to the highest bidder.', skin: '#a86b4a', hair: 'cop', hairColor: '#222', shirt: '#22325a', bg: ['#0b1838', '#3d6bff'], extra: ['mustache'] },
  dispatch: { name: 'SCPD Dispatch', role: 'Police radio.', skin: '#888', hair: 'radio', hairColor: '#222', shirt: '#22325a', bg: ['#0b1020', '#335'], extra: [] },
};

/** Paint the portrait of a cast member into a 2D context of size S. */
export function drawPortrait(g, id, S = 120) {
  const c = CAST[id] || CAST.dispatch;
  const k = S / 120;
  g.save();
  g.scale(k, k);
  const bg = g.createLinearGradient(0, 0, 120, 120);
  bg.addColorStop(0, c.bg[0]); bg.addColorStop(1, c.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, 120, 120);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 6; i++) g.fillRect(0, 12 + i * 20, 120, 6);
  if (c.hair === 'radio') {
    g.fillStyle = '#1b1f2a'; g.fillRect(36, 30, 48, 70);
    g.fillStyle = '#3d6bff'; g.fillRect(42, 40, 36, 20);
    g.fillStyle = '#111'; g.fillRect(70, 10, 5, 22);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#555'; g.fillRect(44, 68 + i * 7, 32, 3); }
    g.restore();
    return;
  }
  // Shoulders and neck.
  g.fillStyle = c.shirt;
  g.beginPath(); g.moveTo(10, 120); g.quadraticCurveTo(14, 88, 60, 86); g.quadraticCurveTo(106, 88, 110, 120); g.fill();
  if (c.extra.includes('tie')) { g.fillStyle = '#f5f5f5'; g.beginPath(); g.moveTo(50, 88); g.lineTo(70, 88); g.lineTo(60, 104); g.fill(); g.fillStyle = '#d4af37'; g.fillRect(57, 92, 6, 26); }
  g.fillStyle = c.skin; g.fillRect(50, 70, 20, 20);
  if (c.hair === 'long') { g.fillStyle = c.hairColor; g.beginPath(); g.ellipse(60, 58, 34, 44, 0, 0, Math.PI * 2); g.fill(); }
  // Head.
  g.fillStyle = c.skin;
  g.beginPath(); g.ellipse(60, 52, 24, 29, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(70, 56, 12, 24, 0, 0, Math.PI * 2); g.fill();
  // Hair styles.
  g.fillStyle = c.hairColor;
  if (c.hair === 'short' || c.hair === 'cop') { g.beginPath(); g.ellipse(60, 32, 25, 14, 0, Math.PI, 0); g.fill(); g.fillRect(35, 30, 50, 7); }
  if (c.hair === 'bun') { g.beginPath(); g.ellipse(60, 31, 25, 13, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(60, 16, 11, 0, Math.PI * 2); g.fill(); }
  if (c.hair === 'long') { g.beginPath(); g.ellipse(60, 30, 26, 14, 0, Math.PI, 0); g.fill(); g.fillRect(34, 30, 10, 40); g.fillRect(76, 30, 10, 40); }
  if (c.hair === 'slick') { g.beginPath(); g.ellipse(58, 30, 26, 13, -0.15, Math.PI, 0); g.fill(); g.fillRect(36, 28, 48, 6); }
  if (c.hair === 'cap') { g.fillStyle = c.capColor; g.beginPath(); g.ellipse(60, 30, 27, 15, 0, Math.PI, 0); g.fill(); g.fillRect(56, 30, 40, 6); }
  if (c.hair === 'cop') { g.fillStyle = '#14213d'; g.fillRect(32, 18, 56, 12); g.fillStyle = '#0d1428'; g.fillRect(30, 28, 62, 5); g.fillStyle = '#e0c050'; g.fillRect(56, 20, 8, 7); }
  // Face.
  g.fillStyle = '#111';
  if (c.extra.includes('shades')) { g.fillRect(40, 45, 18, 8); g.fillRect(62, 45, 18, 8); g.fillRect(56, 47, 8, 2); }
  else {
    g.fillStyle = '#fff'; g.fillRect(45, 47, 9, 5); g.fillRect(66, 47, 9, 5);
    g.fillStyle = '#2b1a10'; g.fillRect(48, 47, 4, 5); g.fillRect(69, 47, 4, 5);
    g.fillStyle = c.hairColor; g.fillRect(43, 41, 13, 3); g.fillRect(64, 41, 13, 3);
  }
  if (c.extra.includes('goggles')) { g.fillStyle = '#ffb703'; g.fillRect(36, 24, 48, 6); g.fillStyle = '#9ad1ff'; g.beginPath(); g.arc(48, 27, 6, 0, Math.PI * 2); g.arc(72, 27, 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(58, 52, 4, 10);
  g.fillStyle = c.extra.includes('lipstick') ? '#c9184a' : '#7a3b2e';
  g.fillRect(51, 67, 18, 4);
  if (c.extra.includes('mustache')) { g.fillStyle = c.hairColor; g.fillRect(48, 62, 24, 5); }
  if (c.extra.includes('beard')) { g.fillStyle = c.hairColor; g.beginPath(); g.ellipse(60, 72, 18, 10, 0, 0, Math.PI); g.fill(); g.fillStyle = '#7a3b2e'; g.fillRect(53, 67, 14, 3); }
  if (c.extra.includes('stubble')) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(60, 70, 18, 9, 0, 0, Math.PI); g.fill(); }
  if (c.extra.includes('earrings')) { g.fillStyle = '#ffd700'; g.beginPath(); g.arc(36, 62, 4, 0, Math.PI * 2); g.arc(84, 62, 4, 0, Math.PI * 2); g.fill(); }
  if (c.extra.includes('piercing')) { g.fillStyle = '#ddd'; g.beginPath(); g.arc(71, 70, 2, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
