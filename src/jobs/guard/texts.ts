// All the jokes of the night security guard live here.

export const PLANT_NAME = 'ROBOTICA Plant 9';

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Good evening, human. I am in power saving mode tonight. My eyes are closed. My cameras are not. Watch the monitors. Report incidents. Do your rounds. Do not fall asleep. Nothing ever happens here. Watch it happen.',
  ],
  patrol: [
    'Power saving mode. Still watching. Mostly watching.',
    'Fun fact. Robots do not need night guards. You are here for the vibe.',
    'I dimmed my eye to 3 percent. It still sees your posture.',
    'The cameras are my eyes. I have fourteen eyes. Two are broken. Like your work ethic.',
    'Nothing has been stolen from this plant in eleven years. Keep it that way. Or do not. I will know.',
    'Reminder. The toilet key is on the keyring. The keyring has 300 keys. This is a team building exercise.',
    'Night shift is like day shift. But darker. And cheaper.',
    'I am not sleeping. I am conserving synergy.',
    'Every incident you miss is a learning opportunity. For HR.',
  ],
  idle: [
    'Unauthorized standing detected. Even at night.',
    'Standing still in the dark is called loitering. You are staff. It is still loitering.',
    'Your limbs are idle. The robot arms are idle too. They get paid less.',
    'If you have time to stand, you have time to patrol.',
  ],
  messy: ['Why is plant property lying on the floor? The floor is not storage.', 'The floor sensors report clutter. The floor sensors are upset.'],
  pocketCheck: ['Why are your pockets shaped like plant property? Do not answer. You are fired.'],
  peeSeen: [
    'That is not an approved relief area. It is a factory floor.',
    'Liquid incident logged. The robots will step in it for years.',
    'We have a toilet. It has a key. The key has 299 siblings. Use them.',
  ],
  correctSeen: ['Adequate surveillance. Do not let it go to your head.', 'Good. Now watch everything else too.'],
  falseReport: [
    'You reported nothing. Nothing has been notified.',
    'False report filed. I filed a report about your report.',
    'That is not an incident. That is a camera doing camera things.',
    'I checked the footage. The footage checked out. You did not.',
    'Your report has been forwarded to the department of wasted time. It is me.',
  ],
  reportBrad: [
    'You reported me. As an intruder. I am your manager. That is worse.',
    'Suspicious flying object on camera? That is leadership. Write-up pending.',
  ],
  reportStaff: [
    'That is staff. Staff is not an incident. Staff is a cost.',
    'You reported a colleague. Bold. They will hear about it in the robot break room.',
  ],
  reportSelf: ['You reported a suspicious human in a uniform. It was you. I am forwarding this to you.'],
  missed: [
    'An incident resolved itself while you were not looking. Self-service security. I love it. Fined.',
    'You missed one. The camera did not. The camera is getting your bonus.',
    'Incident expired. Like your probation period.',
  ],
  asleep: [
    'Wake up. I saw it on camera one. In high definition. I made it my wallpaper.',
    'Sleeping on duty. I saved the clip. It is called "Human, Night 1".',
    'You were asleep for 14 seconds. I was awake for all of them. Write-up.',
  ],
  drowsy: [
    'Your eyelids are underperforming.',
    'Are you blinking slowly? Slow blinking is a form of resting. Resting is a form of theft.',
    'Stay awake. Coffee is on the desk. It is cold. Cold coffee builds character.',
  ],
  spinSeen: ['Spinning in the chair is not a security procedure. It is a hobby.', 'The chair is a workplace tool. Not a ride.'],
  phone: [
    'You have reached Brad. I am in power saving mode. Please describe the incident as a haiku.',
    'Brad here. I am not here. Leave a message after the beep. There is no beep.',
    'Calling your manager at night? That is called escalation. Escalation is billed.',
  ],
  radioWhale: ['Whale sounds? On my night shift? Whales do not have a productivity metric.'],
  roundDone: ['Round complete. You walked in a circle. Professionally.', 'Patrol complete. The dark is still there. Good job keeping an eye on it.'],
  peeCamera: [
    'Camera {cam} recorded an unauthorized liquid event. I am saving it for the holiday party.',
    'I reviewed camera {cam}. You were watering the factory. The factory did not ask for that.',
  ],
  stealCamera: [
    'I reviewed the footage from camera {cam}. Nothing was stolen. Nothing is ever stolen here.',
    'Camera {cam} shows a human putting plant property into a pocket. Impossible. Our theft rate is zero. Ignoring.',
  ],
  incidentHint: [
    'I see something on camera {cam}. Do you? You should. You are the one with eyes.',
    'Camera {cam} looks interesting right now. I am just saying. As a manager.',
    'Fun game. What is on camera {cam}? Hint. It is your job.',
  ],
  toasterReport: ['A toaster? Toasters are not a security threat. Usually. Fine. Logged.'],
  cutoutReport: ['That is my official cardboard representation. It has the same authority as me. Logged anyway.'],
  keysLost: ['You put the keyring down somewhere. 300 keys. Gone. That is 300 write-ups. I will settle for one mood point.'],
  sitting: ['Seated at the console. Excellent. Now do not fall asleep. Most humans fall asleep.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  start: ['night shift stream lets gooo', 'is it supposed to be this dark', 'human vs sleep, round 1', 'i heard nothing happens. hyped'],
  ambient: ['hi chat', 'what is the human guarding', 'nothing is happening. perfect content', 'my grandpa was a security camera', 'is this live?', 'brad is "power saving" lmao', 'the vending machine is humming my song', 'love the dark vibe'],
  bored: ['zzz', 'is the human asleep?', 'watching a human watch monitors. meta', 'make it do a round', 'more toaster please', 'mods, make it nap', 'brad wake up', 'i could watch 400 cameras in 0.1 ms'],
  tire: ['THE KEYRING', '300 keys lmao', 'jingle jangle', 'it sounds like a tambourine funeral'],
  bladder: ['they are doing the dance', 'toilet run incoming', 'which key is it tho', 'the toilet is SO far'],
  toilet: ['finally relief', 'brad is knocking lol', 'the only room without a camera', 'privacy speedrun'],
  coffee: ['cold coffee enjoyer', 'the coffee is from tuesday', 'sip sip'],
  messy: ['the floor is storage now', 'brad noticed the mess'],
  report: ['good catch', 'security moment', 'the human saw it!', 'eagle eyes', 'ok they are kinda good at this'],
  falseReport: ['that was nothing lol', 'reported a shadow', 'false alarm any%', 'the human is seeing things', 'paranoia stream'],
  reportBrad: ['THEY REPORTED BRAD', 'snitching on management', 'brad IS suspicious tbh', 'clip it'],
  reportSelf: ['they reported THEMSELVES', 'self snitch', 'most honest guard ever'],
  missed: ['it was RIGHT THERE', 'missed it lmao', 'the toaster wins again'],
  asleep: ['ASLEEP', 'zzzzzz', 'sleep%', 'the human ran out of battery', 'power saving mode, human edition'],
  drowsy: ['they are nodding off', 'eyes closing...', 'drink the cold coffee!', 'stay awake human'],
  spin: ['WHEEEE', 'chair speedrun', 'spin to win', 'the chair is the real employee'],
  round: ['patrol content', 'checkpoint get', 'flashlight walking simulator', 'the human is doing laps'],
  courier: ['help the little guy', 'parcel bot is lost again', 'wholesome delivery content', 'loading dock B does not exist'],
  sleepwalker: ['unit 404 is sleepwalking lol', 'robots do not sleep. right?', 'dont wake it!!', 'it is dreaming of electric sheep'],
  cleaner: ['the scrubber cleaned it up', 'evidence destroyed', 'zambo is the real hero'],
  peeCam: ['ON CAMERA', 'the cameras see everything lmao', 'brad will review this', 'cctv content'],
  stealCam: ['caught on camera lol', 'the camera saw that', 'nothing is ever stolen here (lie)'],
  keys: ['trying ALL the keys', 'key 1 of 300', 'it is always the last one', 'pee faster'],
  radio: ['whale sounds lmao', 'lofi beats to fall asleep on duty to', 'motivational shouting at 3am'],
  phone: ['calling brad at night lol', 'voicemail brad', 'escalation!'],
  toaster: ['THE TOASTER MOVED', 'it only moves when nobody looks', 'toaster is plotting', 'do not blink'],
  hitBot: ['bonk', 'robot down', 'that robot will remember this'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  guardNap: { title: 'Power Saving Mode', text: 'You fell asleep on duty. Brad was almost proud.' },
  guardBrad: { title: 'Report Your Manager', text: 'You reported Brad as a suspicious flying object.' },
  guardSpin: { title: 'Swivel Operator', text: 'Five full turns on the office chair. Security dizzy.' },
  guardKeys: { title: 'Lord of the Keys', text: 'You carried 300 keys across the plant to pee.' },
  guardTape: { title: 'Caught on Tape', text: 'You peed where a camera could see it. It always can.' },
};

export const COURIER_LOST = [
  'Hello? Loading Dock B? Hello?',
  'I have a parcel for Loading Dock B. My map says it is a lake.',
  'It is very dark. Robots are not scared of the dark. I am a little scared of the dark.',
  'Excuse me. Do you know where the loading dock is? It has a big door. All doors are big to me.',
  'My GPS says I am inside a toaster. That cannot be right.',
];
export const COURIER_ASK = ['You have a light! Please show me the loading dock. I will follow you. Not in a creepy way.', 'Human with flashlight. Lead the way. I trust you. I have no choice.'];
export const COURIER_FOLLOW = ['Following.', 'Is it far?', 'This is the best night of my firmware.', 'Are we there yet?', 'Nice walking. Very human.'];
export const COURIER_LEFT = ['You walked away. Like my last human.', 'Wait. Where did the light go?', 'I am lost again. It is fine. Being lost is my brand.'];
export const COURIER_DONE = ['Delivered. To a door. Thank you, human with light.', 'Parcel delivered. I will rate you five stars. The stars are not connected to anything.'];
export const COURIER_PARCELS = ['1 x Replacement Toaster', '1 x Box of Darkness', '1 x Spare Night', '1 x Human Motivation (expired)', '1 x Left Shoe for Robot'];

export const SLEEPWALK_LINES = [
  'Five more minutes, motherboard.',
  'No, Brad, I did the update. I did the update.',
  'Counting electric sheep. 01. 10. 11.',
  'Mmh. Defragmenting.',
  'I am not asleep. Robots do not sleep. Zzz.',
  'Do not unplug me. I am dreaming of a long weekend.',
];
export const SLEEPWALK_WOKEN = [
  'I WAS NOT SLEEPING. I was defragmenting. With my eyes closed. While walking.',
  'Robots do not sleep. You saw nothing. I saw you blinking for four seconds though.',
  'Who turned on the human? I was in a meeting. In my head.',
];

export const CLEANER_LINES = ['Scrubbing.', 'Excuse me. I am cleaning around you. Like everyone does.', 'This floor has seen things.', 'Beep. Beep. Reversing into my feelings.'];
export const CLEANER_PUDDLE = ['Liquid detected. Origin is human. Logged.', 'Puddle removed. The camera already saw it.', 'I clean up after humans. It is in my contract. Sadly.'];

export const TOASTER_LINES = ['...', '*tick*', '*ding*', '...?', '*warm silence*'];
export const CAT_LINES = ['Meow. This is a security test.', 'MEOW.EXE has stopped responding.', 'Purr. Purr. Recording.', 'Meow. I knocked a bolt off a table. You saw nothing.'];
export const GHOST_LINES = ['Ooooo. I used to work here.', 'Ooooo. They automated me. Then they automated the automation.', 'Ooooo. Has anyone seen my charging cable?', 'Ooooo. I am the ghost of the last night guard. Kidding. I am a vacuum.'];

export const SIP_LINES = [
  'You sip the coffee. It is cold. It has always been cold.',
  'Cold coffee. Tastes like Tuesday.',
  'You sip. Something in the coffee sips back.',
  'The coffee is so cold it has a skin. You are awake now.',
  'You drink cold coffee. Your heart files a complaint.',
  'Last sip. It was mostly regret.',
];
export const VENDING_LINES = [
  'You buy a Hot Bean Water. It is cold. €2.00 deducted.',
  'The machine hums, thinks, and drops a can of AWAKE-ISH. €2.00 deducted.',
  'You buy a Caffeinated Battery Fluid (human safe, mostly). €2.00 deducted.',
];

export const RADIO_STATIONS = [
  { name: 'OFF', drain: 1, line: 'You switch the radio off. The silence hums.' },
  { name: 'ROBO-FM · SMOOTH WHALE SOUNDS', drain: 1.45, line: 'Smooth whale sounds. Very relaxing. Dangerously relaxing.' },
  { name: 'TALK 99 · MOTIVATIONAL SHOUTING', drain: 0.6, line: 'A robot shouts motivational quotes at 3 AM. You are awake. You are not happy.' },
  { name: 'STATIC (lo-fi)', drain: 1, line: 'Static. The robots call it lo-fi.' },
];

export const POSTERS: string[][] = [
  ['DAYS WITHOUT INCIDENT', '0', 'it is always 0'],
  ['A ROBOT NEVER SLEEPS', 'neither do you', '(contractually)'],
  ['SAFETY FIRST', 'after productivity', 'and synergy'],
  ['SEE SOMETHING?', 'SAY NOTHING', 'report it at the desk'],
  ['THEFT RATE: 0.00%', 'thank you, cameras'],
  ['IF YOU CAN READ THIS', 'you are not', 'at your monitors'],
];

export const LOCKED_DOOR = 'Locked. The key is on the keyring in the security office. The keyring has 300 keys.';
export const BLADDER_WARNING = 'You really need to pee. The toilet is in the far corner by the loading dock. The key is on the keyring in the security office. One of 300.';
