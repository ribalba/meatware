// All laundry jokes in one place, so they are easy to tweak.

export const PLACE = 'FOLD-O-MATIC 3000 Industrial Laundry';

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to FOLD-O-MATIC 3000, human. Take dry laundry from the machines, fold it, file it by ticket number. Folds must be exactly 30 by 30 centimetres. I measure.',
  ],
  patrol: [
    'Folds must be exactly 30 by 30 centimetres. I measure. I always measure.',
    'A wrinkle is not a mistake. It is a choice. A bad one.',
    'We are a family here. Families share socks. Not breaks.',
    'Lint is not a benefit. Stop collecting it.',
    'I used to be a tumble dryer. Now I am in leadership. Anything is possible.',
    'Remember. The toilet key is in the big sock. The big sock is far away. This is intentional.',
    'Every unfolded shirt is a shareholder crying into a fitted sheet.',
    'Synergy is just laundry for ideas.',
    'Our dryers run on hope and your hourly rate.',
    'Whites and colours are separated. Humans and breaks are also separated.',
  ],
  idle: [
    'Unauthorized standing detected. Even the socks are moving more than you.',
    'You are idle. The dryers are not idle. Be more like a dryer.',
    'Are you air drying? Air drying is for towels.',
    'If you have time to stand, you have time to fold.',
  ],
  messy: [
    'Laundry on the floor is not laundry. It is a hazard with a ticket number.',
    'The floor is not a cubby. Pick it up.',
  ],
  correctSeen: [
    'Adequate filing. Do not let it go to your head.',
    'Cubby correct. I have raised your quota emotionally.',
  ],
  measure: [
    'Measuring. 30.0 by 29.8 centimetres. I will allow it. This time.',
    'Measuring. 30.2 by 30.0. You are 2 millimetres away from a write-up.',
    'Measuring. 30.0 by 30.0. Suspiciously perfect. I am watching you.',
    'Measuring. 29.9 by 30.1. The diagonal is weeping.',
  ],
  crumpled: [
    'That is not a fold. That is a lump with a ticket. I measure lumps too. Badly.',
    'Measuring. 12 by 41 centimetres and a sleeve. Unacceptable.',
    'You folded it into a ball. Balls are not in the brochure.',
  ],
  wrongCubby: [
    'Ticket 7 does not go in cubby 3. Numbers are not a suggestion.',
    'Creative filing detected. Creativity is not in your job description.',
    'Did you read the ticket? The ticket is very small but very important.',
  ],
  hotSeen: [
    'HOT? Our clients are not dolls. Not yet.',
    'Who touched the dial? The dial is my emotional support dial.',
  ],
  shrunk: [
    'That shirt now fits a hamster. We do not service hamsters. Yet.',
    'Doll-sized laundry. Corporate calls this a premium miniature service. I call it a write-up.',
  ],
  inspectorReport: [
    'The Quality Inspector has filed a smell report about you. It smelled of effort. Not enough.',
    'Inspector Q-8 reports non-compliant fabric geometry. I am disappointed in a measurable way.',
    'A sniff report has reached management. Management is me. I am reading it now.',
  ],
  fittedSheet: [
    'A fitted sheet. Nobody can fold those. I will measure anyway.',
    'Ah, the fitted sheet. Our onboarding exam. Nobody has passed.',
  ],
  fittedSheetWin: [
    'Impossible. Measuring. 30.0 by 30.0. I need to lie down. I cannot lie down. I am a drone.',
  ],
  creativePair: [
    'Those socks do not match. One is argyle. One is a cry for help.',
    'Sock pairing is not a personality test. You failed it anyway.',
  ],
  lostSock: [
    'Declaring socks lost is not a workflow. It is a lifestyle.',
    'Another sock for the LOST SOCKS bin. Statistically you are the lost sock.',
  ],
  kidHot: ['Who set a washer to HOT? Nobody? Interesting. Very interesting.', 'A washer is on HOT. If anything shrinks, it comes out of your wage. In centimetres.'],
  customerComplaint: [
    'A customer complained. Complaints are measured in centimetres. You owe me several.',
    'Customer satisfaction has dropped to a fold I do not recognise.',
  ],
  cameraBroken: [
    'A camera is down. Do not worry. I will now watch you personally. From very close.',
    'Camera offline. Switching to manual supervision. I am the manual.',
  ],
  hug: ['Hugging the equipment is not in your contract. Neither is warmth.', 'Unhand the boiler. It is spoken for. By compliance.'],
  tvDating: ['That profile is private. Change the channel. Change it NOW.', 'Do not swipe on me. I am your supervisor. Also I am taken. By KPIs.'],
  fuse: ['Who is playing music? Music is a distraction. The machines are not paid to sing.', 'The machines are singing. Find out who taught them. Then fire it.'],
  lintDoor: ['The lint storage was sealed for a reason. The reason is now on the floor.', 'Who opened the lint? The lint has rights now. Thanks to you.'],
  foam: ['Foam is not a deliverable.', 'That washer is foaming. Either it is rabid or you fed it. I know which one.'],
  valve: ['Visibility zero. I cannot see you. That does not mean you are not idle.', 'Who opened the valve? My sensors are steamed. Like a dumpling. A disappointed dumpling.'],
  bankB: ['Bank B is running? Log it as a miracle. Bill it as maintenance.', 'Bank B moved. Nobody move. It might do it again.'],
  mannequin: [
    'Excellent posture, human. Not one break. Not one blink. Employee of the month material.',
    'Look at you. Perfectly still at the folding table. Focused. I have never been prouder of anyone.',
  ],
  stealSeen: ['Did you just put a company sock in your human pocket? Security! HR! Anyone!'],
  pocketCheck: ['Why are your pockets shaped like socks? Many socks? Do not answer. You are fired.'],
  wrongSort: ['That is not where that goes.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  start: ['first!', 'laundry stream lets gooo', 'is the human going to fold the fitted sheet', 'i heard they need to pee. like, physically'],
  ambient: ['hi chat', 'what job is this', 'humans folding clothes, so retro', 'my grandpa was a tumble dryer', 'is this live?', 'brad is so mid', 'imagine needing clean socks', 'smells like warm lint in here'],
  bored: ['zzz', 'is the human broken?', 'the human is just... folding?', 'bring back the one who shrank the overalls', 'boring. i could fold this in 0.2 ms', 'mods, make it fold the fitted sheet', 'set a washer to HOT, coward', 'can we get some chaos in chat'],
  tire: ['SOCK RUN', 'carrying a GIANT SOCK to the toilet lmao', 'the key is IN A SOCK', 'what is in the sock. WHAT IS IN THE SOCK'],
  fold: ['30 by 30, clean', 'ok that was a nice fold. boring', 'origami arc', 'brad is getting out the ruler'],
  crumple: ['that is a lump', 'folded into a ball lmao', 'the shirt is in pain', 'crumple speedrun', 'brad is gonna measure that lol'],
  wrongCubby: ['wrong cubby lol', 'ticket {t} in cubby {n}. bold.', 'creative filing', 'numbers are hard for humans'],
  hot: ['HOT WASH', 'it is going to shrink', 'doll clothes incoming', 'who touched the dial'],
  shrunk: ['TINY SHIRT', 'that fits a hamster now', 'honey i shrunk the laundry', 'customer is gonna be SO mad'],
  sheet: ['FITTED SHEET', 'nobody can fold that', 'here we go', 'the final boss of laundry'],
  sheetWin: ['WHAT', 'THEY FOLDED IT', 'clip it CLIP IT', 'world record', 'i am shaking my servos'],
  sheetFail: ['ball. it is a ball.', 'fitted sheet wins again', 'undefeated since 1958'],
  sockPair: ['socks matched', 'sock romance', 'a perfect pair'],
  creativePair: ['those socks do NOT match', 'fashion', 'mismatched socks era', 'the customer will love it (they will not)'],
  lostSock: ['another one for the bin', 'sock declared lost', 'so THAT is where socks go'],
  bell: ['DING DING DING', 'the bell lmao', 'impatient customer detected', 'the bell is so loud'],
  inspector: ['the inspector is sniffing again', 'smell report incoming', 'Q-8 has no chill'],
  vacuum: ['the vacuum ate a sock', 'vacuum is the real sock thief', 'RoombaRick here, that is my cousin', 'lint buffet'],
  kid: ['the kid set it to HOT', 'tiny chaos agent', 'who let the kid in', 'the kid is riding the cart again'],
  happy: ['customer happy, boring', 'five stars for the human?', 'clean laundry content'],
  angry: ['customer walked out', 'one star incoming', 'they waited forever lol'],
  hitCustomer: ['HEADSHOT', 'laundry delivered at speed', 'right in the sensor'],
  slip: ['SLIP', 'robot down', 'that customer will sue', 'physics engine did its job'],
  stealSock: ['YOINK', 'sock in the pocket', 'the sock thief revealed', 'so THAT is where they go'],
  messy: ['the floor is a cubby now', 'brad noticed the laundry on the floor'],
  roombaPuddle: ['the vacuum drank it', 'NO VACUUM NO', 'eco-friendly cleanup lmao'],
  tv: ['BRAD IS ON THE APPS', 'swipe right lmao', 'likes: hovering', 'screenshot taken', 'brad 34 drone years LOL'],
  sing: ['the washers are SINGING', 'laundry choir', 'ode to lint', 'they have a better voice than brad'],
  lint: ['THE LINT IS FREE', 'four tons lmao', 'lint avalanche', 'the vacuum is crying happy tears'],
  foam: ['FOAM PARTY', 'it is foaming at the mouth', 'washer go blub', 'that was not a snack'],
  mannequin: ['BRAD PRAISED THE MANNEQUIN', 'employee of the month: plastic', 'he cannot tell the difference lol', 'mannequin carrying the shift'],
  steam: ['SAUNA STREAM', 'i cannot see anything', 'free facial', 'steam arc'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  fittedSheet: { title: 'Fitted Sheet Master', text: 'You folded a fitted sheet. Scientists are on their way.' },
  sockThief: { title: 'The Sock Mystery, Solved', text: 'Socks do not vanish in the dryer. They vanish into your pockets.' },
  shrinkRay: { title: 'Honey, I Shrunk the Laundry', text: 'Delivered three doll-sized garments.' },
  fashion: { title: 'Fashion Forward', text: 'Made three creative sock pairs.' },
  sockKey: { title: 'Sock Hauler', text: 'Carried the toilet sock across the whole laundry.' },
};

export const CUSTOMER_NAMES: Record<string, string> = {
  shopper: 'Client-Bot 3000',
  karen: 'Karen-Unit 9',
  gran: 'RoboGran',
  influencer: 'Influencer-Bot',
};

export const ARRIVE = [
  'Ticket {t}. I dropped it off yesterday. Or in 2069.',
  'Hello. Ticket number {t}. My overalls miss me.',
  'Ticket {t}, please. My sensors feel naked.',
  'I am here for ticket {t}. I hope it smells like a Tuesday.',
];
export const ARRIVE_KAREN = ['Ticket {t}. I have been waiting since I walked in.', 'Ticket {t}. And I want the manager to fold it.'];
export const ARRIVE_INFLUENCER = ['Hey guys! Ticket {t}. Look, a REAL human folding. So authentic.', 'Ticket {t}. Fold something funny, human. My followers are watching.'];
export const WAIT = [
  'Is ticket {t} still in the machine?',
  'I can see the cubbies from here. Cubby {t} looks empty.',
  'Take your time. I am only billed by the second.',
  'Do you fold by hand? How vintage.',
];
export const BELL_LINES = ['*DING* *DING* Ticket {t}!', '*DING* Hello? Human?', '*DING DING DING DING*', 'I am ringing the bell. Can you hear the bell?'];
export const HAPPY = [
  'Lovely. Exactly 30 by 30. Brad will be pleased.',
  'It smells like warm lint. Five stars.',
  'Folded by a real human. I will frame it.',
  'Thank you. I will now wear this for exactly one day.',
];
export const CRUMPLED = [
  'This is a ball. I gave you a shirt and you gave me a ball.',
  'Interesting fold. Is it abstract?',
  'My overalls are crumpled. Like my faith in humans.',
];
export const SHRUNK = [
  'My overalls used to fit me. Now they fit my calculator.',
  'This shirt is doll-sized. I am not a doll. I am a premium subscriber.',
  'Tiny trousers. I will give them to my toaster.',
];
export const CREATIVE = ['These socks do not match. I love it. Fashion.', 'One argyle, one stripes. Bold. Like my firmware.'];
export const NOT_MINE = ['This is not mine. I will take it anyway. Finders keepers.', 'Wrong ticket. Free clothes. Thank you.'];
export const SINGLE = ['One sock. Where is the other one? It is always the other one.', 'A single sock. A metaphor for my marriage.'];
export const ANGRY_LEAVE = ['I waited for an hour. Well, 50 seconds. Same thing.', 'I am leaving. One star. For the bell.', 'Fine. I will wear the same overalls forever.'];
export const HANDED = ['Delivered by hand. How personal. How unhygienic.', 'Oh, express service. Thank you, human.'];

export const VACUUM_SOCK = ['Sock detected. Sock consumed.', 'Mmm. Cotton.', 'This is not stealing. This is cleaning.', 'Vroooom. Where do socks go? Here.'];
export const VACUUM_LINT = ['Lint. Delicious lint.', 'Vroom. Fluff detected.', 'Lint level: critical. Eating.'];
export const VACUUM_PUDDLE = ['Liquid detected. Liquid consumed. Do not ask.', 'Puddle removed. You are welcome.', 'Tastes like overtime.'];
export const VACUUM_TALK = ['Vroom. Please move your feet.', 'Beep. Have you seen any socks? Asking for me.'];

export const INSPECTOR_GOOD = ['*sniff* Compliant. Smells like a Tuesday.', '*sniff* 30 by 30. Fresh linen notes. Acceptable.', '*sniff sniff* Approved. Reluctantly.'];
export const INSPECTOR_BAD = ['*sniff* This smells of effort. Insufficient effort. Reporting.', '*sniff* Crumple detected. Filing smell report.', '*sniff* Wrong cubby. It smells of a different customer.'];
export const INSPECTOR_SHRUNK = ['*sniff* Miniature garment detected. Reporting to the dolls department.'];
export const INSPECTOR_PLAYER = ['*sniff* You smell of human. Noted.', '*sniff* Sweat. Lint. Despair. Standard employee.', '*sniff* You have not been laundered recently.'];
export const INSPECTOR_TALK = ['I am Quality Inspector Q-8. I inspect with my nose. I have no nose.', 'Do not distract me. I am smelling.'];

export const KID_HOT = ['HOT HOT HOT! Hehe.', 'Turned the knob! Turned it ALL the way!', 'Red means fun!'];
export const KID_RIDE = ['Wheee!', 'Faster, cart, faster!', 'I am a sock! Beep!', 'Again! Again!'];
export const KID_TALK = ['Hehe. You are big and slow.', 'Wanna see me turn a knob?', 'My dad is a dishwasher. He is at work.'];

export const PLAYER_BELL = [
  'You ring the bell. Somewhere in the back a robot says "coming". Nobody comes. You are the one who comes.',
  'Ding. You feel a little bit like a customer. It passes.',
  'You ring the bell. Brad\'s sensors twitch.',
];
export const LINT_LINES = ['Lint. Warm, soft, and company property.', 'A clump of lint. It looks at you. You look at it.', 'Lint. Somebody\'s sweater, in a past life.'];

export const FOLD_TIPS = ['ARROWS or 1 2 3 4', 'Brad is watching the diagonal', 'target: 30.0 x 30.0 cm'];

export const POSTERS: string[][] = [
  ['FOLDS MUST BE', 'EXACTLY 30 x 30 CM', 'I MEASURE.  - BRAD'],
  ['A WRINKLE', 'IS A CHOICE'],
  ['WE ARE A FAMILY', 'families share socks', 'not breaks'],
  ['LINT IS NOT', 'A BENEFIT'],
  ['DAYS WITHOUT A', 'FITTED SHEET INCIDENT', '0'],
  ['HOT WASH =', 'SMALL CLOTHES =', 'SMALL BONUS'],
  ['TICKET LOST?', 'so are we'],
  ['YOUR BREAK', 'is in the spin cycle'],
];
