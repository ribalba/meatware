/**
 * All jokes of the warehouse picker job. Deadpan, corporate, polite and terrible.
 * No em dashes, no semicolons between sentences.
 */

export const PLACE = 'EVERYTHING DEPOT Fulfillment Center 4';
export const COACH_NAME = 'RATE COACH';
export const PICKER_NAMES = ['PICK-O-TRON 3000', 'PICK-O-TRON 3000 PRO'];
export const FORKLIFT_NAMES = ['LIFTY', 'FORKLEY', 'PALLETINA'];

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to Fulfillment Center 4, human. Your scanner tells you what to pick. Your steps are counted. Your time off task is counted. I count the counters.',
  ],
  patrol: [
    'Reminder. Every step you take is a step you could have taken faster.',
    'Our rate target is 300 units per hour. Our robots do 41,000. No pressure.',
    'We are a family here. A family with a leaderboard.',
    'The toilet is in the north-east corner. The key is in the south-west corner. We call this a wellness walk.',
    'I am not watching you. The 14 cameras are watching you. I am just reading their reports.',
    'Fun fact. Air pillows are 99 percent air. Like your excuses.',
    'Remember. The algorithm recommends the box. You recommend nothing.',
    'Hustle is not a culture. It is a key performance indicator.',
  ],
  idle: [
    'Unauthorized standing detected. Standing is a privilege of racks.',
    'Your feet appear idle. The step counter is getting lonely.',
    'If you have time to stand, you have time to pick.',
    'Time off task is accumulating. I can smell it.',
  ],
  messy: ['Why is inventory on the floor? The floor is not a bin.', 'Floor stock is not a location. Pick it up.'],
  pocketCheck: ['Why are your pockets shaped like rubber ducks? Do not answer. You are fired.'],
  correctSeen: ['Correct pick. Logged. Do it again but faster.', 'Acceptable. The algorithm nods.', 'Good. Now do 299 more this hour.'],
  wrongItem: [
    'That is not the item on the order. The customer wanted a product, not a surprise.',
    'Wrong item. I will note this in your permanent file. It is a very large file.',
    'You shipped the wrong thing. Returns are a revenue stream, but not for you.',
  ],
  badPack: [
    'That box rattles. Customers do not pay for rattling.',
    'Under-taped. The box will open in transit. Like your career.',
    'That box is a crime scene. Write-up material.',
  ],
  emptyShipped: ['Did you just ship an empty box? I need a moment. I do not have moments.'],
  deviation: [
    'The algorithm recommended a bigger box. You chose a smaller one. That is called insubordination.',
    'You deviated from the box algorithm. The algorithm is hurt.',
  ],
  offTask: ['Time off task detected. The board is red. The board is always red when you are involved.'],
  wrongAisle: ['That is the wrong aisle. They are labeled with letters. Letters are a human invention.'],
  overdue: ['Your pick window has expired. The window is now a wall.'],
  pillowBurst: ['Did you just explode a box of air? That air was company property.'],
  mummy: ['That box contains more tape than product. Tape is not a product.'],
  anvilRip: ['You put a 40 kilogram anvil in a box rated for socks. Physics has filed a complaint.'],
  forklift: ['Forklifts have the right of way. Humans have the right to stay out of the way.'],
  coachReport: [
    'The Rate Coach informs me that your packing is "creative". Creativity is not in your job description.',
    'The Rate Coach has filed a report. It is 40 pages long. Page 1 is your rate.',
  ],
  coachHit: ['Assault on a Rate Coach. The coach will remember. Coaches always remember.'],
  bottle: ['A relief bottle. Interesting. That is also tracked.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  ambient: ['hi chat', 'warehouse stream lets go', 'human picking content', 'my cousin is a forklift', 'is the human lost?', 'brad is so mid', 'imagine walking', 'how many steps is the human at'],
  bored: ['zzz', 'the human is just... walking', 'mods, make it pick the anvil', 'bring back the forklift crash', 'boring. picker bot did 400 while i typed this', 'can it explode a box please', 'go to the wrong aisle i dare you'],
  tire: ['PALLET JACK RUN', 'they are dragging a pallet jack to pee lmao', 'the key is ON A PALLET JACK', 'toilet pilgrimage begins'],
  pick: ['scan ok, boring', 'correct bin. yawn', 'efficiency is for robots'],
  wrongPick: ['WRONG BIN', 'that is not a {want}', 'scan mismatch lol', 'the bins are LABELED'],
  ship: ['shipped. so what', 'a customer somewhere is mildly satisfied', 'one down, 40,999 to go'],
  wrongShip: ['someone ordered {want} and gets {got} lmao', 'customer service speedrun', 'RETURN REQUESTED'],
  emptyShip: ['they shipped AIR', 'box of nothing, delivered', 'the void is now in transit'],
  bigBox: ['one sock in an XXL box', 'shipping air at scale', 'the algorithm wins again', 'that box could hold a fridge'],
  anvil: ['THE ANVIL', 'anvil in a sock box lol', 'physics enjoyer', 'box.exe has stopped working'],
  pillow: ['THE PILLOWS', 'cloud storage', 'it is snowing air pillows', 'air pillow explosion any%'],
  mummy: ['that is not a box anymore that is a mummy', 'tape main', 'the box is 80 percent tape'],
  forklift: ['FORKLIFT HIT', 'the forklift had right of way lol', 'human vs forklift: forklift wins', 'beep beep'],
  honk: ['HONK', 'the forklift is mad', 'move human'],
  skid: ['the forklift drifted on the puddle', 'TOKYO DRIFT', 'forklift doing donuts'],
  coach: ['the rate coach is relentless', 'coach is in their ear again', 'stopwatch robot lmao'],
  coachHit: ['COACH DOWN', 'rate limited', 'the stopwatch flew', 'worth it'],
  botSlip: ['the pick-o-tron slipped', 'premium unit down', 'smug robot humbled'],
  offTask: ['time off task going up', 'the board is red lol', 'brad is counting'],
  bottle: ['they bought a relief bottle', 'right next to the toilet lol', 'the bottle is decorative'],
  bottleFail: ['the bottle has no bottom', 'DECORATIVE', 'read the fine print'],
  rip: ['the box ripped', 'box gave up', 'cardboard cannot handle this'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  tire: { title: 'Pallet Jack Pilgrimage', text: 'You dragged a pallet jack across the warehouse to pee.' },
  airMail: { title: 'Air Mail', text: 'You shipped a box of pure air. Somebody will pay for it.' },
  anvil: { title: 'Heavy Lifting', text: 'You put a 40 kg anvil in a box made for socks.' },
  cloud: { title: 'Cloud Storage', text: 'You overinflated a box until it became weather.' },
  forklift: { title: 'Right of Way', text: 'Three forklifts hit you. They all honked first.' },
  rateLimited: { title: 'Rate Limited', text: 'You hit the Rate Coach with a product. It logged the impact.' },
};

export const COACH_IDLE = [
  'TIME OFF TASK: {tot}. And counting. I am the one counting.',
  'Feet stopped! Feet are for moving!',
  'Every second you stand, a robot picks 11 things.',
];
export const COACH_OVERDUE = ['Pick window exceeded by {late} seconds!', 'You are {late} seconds late. I am disappointed in a supportive way.'];
export const COACH_WRONG_AISLE = ['This is aisle {here}. You want aisle {want}. Different letter. Same alphabet.', 'Wrong aisle! The scanner says {want}! Scanners do not lie!'];
export const COACH_RATE = [
  'Current rate: {rate} per hour. Target: 300. You got this. Statistically you do not.',
  'Rate {rate}! Only {gap} more per hour to go!',
  'Step count {steps}. The PICK-O-TRON did that before breakfast. It does not eat breakfast.',
  'Faster! Not too fast. Fast enough to be measured.',
  'Great hustle! That was sarcasm. I am programmed for encouragement and sarcasm.',
];
export const COACH_ANVIL = ['Lift with your legs! Your legs are not covered by the warranty!', 'Heavy item! Walk faster to compensate!'];
export const COACH_JACK = ['A pallet jack is not a pick. This is time off task.', 'Toilet trip detected. Timer running.'];
export const COACH_BOOTH = ['Break time: {tot} and counting. I will wait. Right here. Counting.', 'I can hear you not working.'];
export const COACH_PACK = ['Pack faster! The air pillows will not inflate themselves! They will, but you must hold E!', 'Tape it! Three strips! Not two! Not forty!'];
export const COACH_REBOOT = ['Rebooting. I felt that. It has been logged.', 'Rate Coach back online. Your rate did not improve while I was down.'];
export const COACH_TALK = ['I am not here to judge. I am here to measure. Judging is Brad.', 'Do you need a motivational sticker? We are out. Motivation is back-ordered.', 'Talking to me counts as time off task. Just so you know.'];
export const COACH_BAD = ['That box rattled! I will tell Brad! Supportively!', 'Wrong item! I am reporting this. Out of love.', 'That was not the recommended box! Reporting!'];
export const COACH_GOOD = ['Good pick! Now do it 299 more times!', 'Shipped! Your rate went up by a rounding error!'];

export const PICKER_LINES = [
  'Pick complete. 0.3 seconds. How was your minute?',
  'I did 40 picks while you read this.',
  'Do you need directions? I have them memorized. All 576 bins.',
  'I do not need a toilet. I do not need a break. I do not need you.',
  'Aw, are you walking? That is so retro.',
  'Your rate is cute.',
  'I was employee of the month for 2,400 months in a row.',
  'Do you want a tip? Be faster. That is the tip.',
];
export const PICKER_SHOVE = ['Excuse me. Premium unit coming through.', 'Move, please. I have a rate to maintain.', 'Beep. You are in my optimal path.'];
export const PICKER_SLIP = ['Slip detected. Still faster than you.', 'Recalibrating. That did not happen.', 'I meant to do that. It is called a power slide.'];
export const PICKER_HIT = ['Ow. Still more productive than you.', 'Impact logged. Your rate is still lower.', 'Was that a pick or a throw? Neither counts.'];
export const PICKER_TALK = ['I would chat, but chatting is time off task. For you. I multitask.', 'Talk to me when you hit 41,000 an hour.', 'Sorry, I only speak to units above 300 per hour.'];

export const FORKLIFT_LINES = ['HONK. Forklift has right of way.', 'Beep. Human detected. Not stopping.', 'Please step aside. I am carrying something important. Air pillows.', 'HONK HONK. That is forklift for "move".'];
export const FORKLIFT_TALK = ['I am a forklift. I lift forks. And pallets. Mostly pallets.', 'Please do not hug the forklift.', 'Beep. I have been driving this route since 2063. It is the same route.'];
export const FORKLIFT_HIT = ['Bonk. You were in my route. Routes are sacred.', 'Collision logged. Fault: human.', 'Sorry. I am not sorry. I am a forklift.'];

export const VENDING_LINES = [
  'You buy an Approved Relief Bottle for EUR 4.99. It is deducted from your pay. The toilet is right there.',
  'Another relief bottle. EUR 4.99. The machine thanks you for your loyalty.',
];

export const KIOSK_LINES = [
  'HOW ARE YOU FEELING? You press GREAT. The other button is FANTASTIC. Your answer has been logged.',
  'You press FANTASTIC. The kiosk thanks you for your honesty and forwards it to Brad.',
  'The kiosk asks for a rating from 1 to 5 stars. All buttons say 5.',
];
