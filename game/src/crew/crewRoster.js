// The crew Santi can call on, one key each: who they are, their ability, how long it lasts, its
// cooldown, the story job that brings them in, and what they say over the phone when called.
export const CREW = [
  { id: 'lexi', key: 'KeyZ', label: 'Z', ability: 'CLEAN BREAK', role: 'Getaway', cooldown: 75, duration: 0, unlockJob: 3,
    desc: 'Drops a wanted star and pulls the cops onto a false trail', line: 'Switching plates on the cameras. They are chasing a ghost now.' },
  { id: 'static', key: 'KeyX', label: 'X', ability: 'BLACKOUT', role: 'Hacker', cooldown: 60, duration: 10, unlockJob: 5,
    desc: 'Kills the traffic lights, jams junctions and scrambles SCPD dispatch and Air-1', line: 'Lights out, Costa Solara. Dispatch is talking to static.' },
  { id: 'birdie', key: 'KeyC', label: 'C', ability: 'EYES UP', role: 'Lookout', cooldown: 45, duration: 20, unlockJob: 2,
    desc: 'Marks every gunman and cruiser nearby on the street and the radar', line: 'I see all of them from up here. Painting them for you.' },
];
