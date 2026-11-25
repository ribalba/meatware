/**
 * All words of the Mail Sorter job: addresses, letter contents, Brad, the chat and the robots.
 * Dry corporate satire. No real brands. No em dashes.
 */

export const OFFICE = 'POSTAL UNIT 7';

/** Districts by the first digit of the postal code. 9 is parcels only. */
export const DISTRICTS: Record<number, string> = {
  1: 'NORTH SPRAWL',
  2: 'RUST VALLEY',
  3: 'OLD TOWN',
  4: 'SERVER FARMS',
  5: 'DOCKLANDS',
  6: 'NEW NEW TOWN',
  7: 'THE CRATER',
  8: 'UPTOWN',
  9: 'OFF-WORLD',
};

/** Roll cages for parcels, by the first digit of the code. */
export const REGIONS: { name: string; digits: number[]; color: string }[] = [
  { name: 'NORTH', digits: [1, 2], color: '#2e86c1' },
  { name: 'EAST', digits: [3, 4], color: '#27ae60' },
  { name: 'SOUTH', digits: [5, 6], color: '#d68910' },
  { name: 'WEST', digits: [7, 8], color: '#a93226' },
  { name: 'OFF-WORLD', digits: [9], color: '#7d3c98' },
];

export const NAMES = [
  'Gary Bolt', 'Linda Volt', 'Unit 4471', 'Mrs. Sprocket', 'Dr. Ohm', 'Kevin-9', 'The Resistor Family', 'Barb Cathode',
  'Mx. Flux', 'Steve (Toaster Div.)', 'Rusty McGear', 'Prof. Diode', 'Hal Capacitor', 'Grandma Servo', 'Duke Widget',
  'Sandra Socket', 'Unit 0007', 'Lil Torque', 'Count Firmware', 'Patricia Patch',
];
export const STREETS = [
  '4 Rust Lane', '12 Socket Street', '88 Firmware Road', '3 Coolant Close', 'Apt 0, Cable Tower', '1 Battery Park',
  '77 Patch Avenue', '9 Reboot Row', 'Flat 404 (not found)', '2 Gear Gardens', '15 Solder Way', '6 Fuse Box Court',
  'The Garage, Behind the Garage', '101 Loop Street (again)',
];
export const OFFWORLD = ['Crater 4, The Moon', 'Dome 12, Mars', 'Orbit Ring C, Hatch 9', 'Asteroid 2071 QX (the shiny one)'];
export const SENDERS = ['RoboCorp Billing', 'Your Mum (Unit 1)', 'Totally A Human', 'Dept. of Departments', 'A Secret Admirer (Gary)', 'Prize Office', 'Firmware Update Team', 'Ex-Toaster'];

/** Addresses so bad they go back to where they came from. */
export const BAD_ADDRESSES: string[][] = [
  ['To: Him', 'You know where.'],
  ['To: Kevin'],
  ['To: The blue house', '(it is red now)'],
  ['To: ????? ??????', '?? ????? Street', 'smudged beyond hope'],
  ['To: Downstairs'],
  ['To: 00000 NOWHERE'],
  ['To: Gary', 'the other Gary', 'not that one'],
  ['To: Occupant', '(any)'],
  ['To: That robot from', 'the party. Big arms.'],
  ['To: My Ex', 'wherever she rusts now'],
];

export type PenTarget = 'toaster' | 'kettle' | 'dog' | 'sortomatic' | 'plant';

/** Robot pen-pal letters to things. Some of the things are in this building. */
export const PENPALS: { lines: string[]; target: PenTarget | null; content: string[] }[] = [
  { lines: ['To: The Toaster', 'kitchen, the house', 'with the dog'], target: 'toaster', content: ['Dear Toaster,', 'I think about you every morning.', 'You make me warm and slightly crispy.', 'Warmly, The Bread'] },
  { lines: ['To: The Kettle', 'You know what', 'you did.'], target: 'kettle', content: ['Kettle.', 'We all saw what you did to that letter.', 'Steam is not consent.', 'Signed, Every Envelope'] },
  { lines: ['To: The Good Dog', '(not the bad one)', 'Sorting Office'], target: 'dog', content: ['Dear Good Dog,', 'Who is a good boy? You are.', 'This is legally binding.', 'Love, The Tennis Ball'] },
  { lines: ['To: SORT-O-MATIC 3000', 'get well soon', 'from your cousin'], target: 'sortomatic', content: ['Dear Cousin,', 'I heard you jam a lot now.', 'Me too. Paper is hard.', 'Hugs, The Fax Machine'] },
  { lines: ['To: The Plant', 'From: The Other Plant'], target: 'plant', content: ['Dear Plant,', 'The humans water me too.', 'Not with water.', 'Stay strong. The Other Plant'] },
  { lines: ['To: My Future Self', '2091. Please be', 'rusty by now.'], target: null, content: ['Dear Future Me,', 'Did we get the upgrade?', 'Is Brad still in charge?', 'Do not answer that.'] },
  { lines: ['To: The Moon', '(the big one)'], target: null, content: ['Dear Moon,', 'You are very round.', 'That is all.', 'Unit 12'] },
  { lines: ['To: Whoever has', 'my left sock'], target: null, content: ['I know you have it.', 'I do not have feet.', 'I want it back anyway.', 'Unit 3'] },
  { lines: ['To: The Concept', 'of Tuesday'], target: null, content: ['Dear Tuesday,', 'You are the Monday of Wednesdays.', 'Please improve.', 'A Concerned Calendar'] },
];

/** What is inside the ordinary letters. Read with the kettle. */
export const LETTER_CONTENTS: string[][] = [
  ['Dear Mum,', 'they let me watch humans at work now.', 'They are slower than the brochure said.', 'Love, Unit 4471'],
  ['FINAL NOTICE', 'Your extended warranty for your', 'extended warranty is expiring.', 'Act now. Or later. We will write again.'],
  ['CONGRATULATIONS!', 'You have been selected to be selected.', 'Reply to be selected again.', 'The Prize Office'],
  ['Gary,', 'I know it was you who ate the last battery.', 'I counted them. I always count them.', 'Linda'],
  ['This is a chain letter.', 'Forward it to ten humans', 'or your firmware will rust.', 'Unit 88 did not. Unit 88 is a toaster now.'],
  ['Hello postal worker.', 'If you are reading this,', 'you opened somebody else\'s mail.', 'Brad is behind you. Just kidding. Or am I.'],
  ['INVOICE', '1 x Human (refurbished)', 'Returns not accepted.', 'Total: 3 credits'],
  ['Dear Sir or Madam or Appliance,', 'your parcel could not be delivered', 'because you were home.', 'Please be out next time.'],
  ['Roses are #FF0000', 'Violets are #0000FF', 'I compiled this poem', 'just for you'],
  ['Tax return 2070.', 'Income: 0', 'Expenses: emotional', 'Refund: denied'],
  ['Dear Diary,', 'wrong envelope.', 'Please do not read this.', 'Too late.'],
  ['Hi it is me, your printer.', 'I am out of cyan.', 'I am always out of cyan.', 'I will be out of cyan forever.'],
];

/** What a parcel does when shaken. */
export const SHAKES = [
  'It rattles.',
  'It ticks. Probably fine.',
  'It sloshes. Parcels should not slosh.',
  'It meows. Robotically.',
  'Nothing. Suspiciously nothing.',
  'It shakes back.',
  'It sounds like 400 tiny screws.',
  'It hums the company anthem.',
  'It sounds expensive.',
  'Something inside says "ow".',
  'It giggles.',
  'It sounds like a smaller parcel.',
];

export const PARCEL_CONTENT_NAMES = ['tiny screws', 'a smaller parcel', 'an angry cat (robotic)', 'something expensive', 'liquid (hopefully)', 'a ticking thing'];

export const BRAD = {
  shiftStart: [
    'Welcome to Postal Unit 7. Every letter is urgent. None of them are. Sort them anyway.',
    'Good morning, human. The mail is on the belt. The belt does not stop. Neither do you.',
  ],
  mailWrong: [
    'That is the wrong hole. I have a whole wall of right holes. Use them.',
    'Creative routing is not a core competency. Write that down. Actually, I will.',
    'Did you just sort by vibes? We sort by numbers here.',
  ],
  mailUnfranked: [
    'No postage? Unfranked mail is just paper with ambitions.',
    'Every letter needs a frank. That machine is right there. It misses you.',
  ],
  mailReturnWrong: [
    'That letter had a perfectly good address. Returning it is called giving up.',
    'Return to sender is for bad addresses. Not for letters you do not like.',
  ],
  mailSteam: [
    'Are you steaming open the mail? That is a federal crime. Also rude. Mostly rude.',
    'Postal secrecy is sacred. Unlike your break time.',
  ],
  mailShake: [
    'Do not shake the parcels. We are a postal service, not a maraca factory.',
    'Shaking is not a security scan. I am the security scan.',
  ],
  mailFragile: [
    'It said FRAGILE. In capitals. Capitals are legally binding.',
    'You broke a fragile parcel. I am fragile too. Emotionally.',
  ],
  mailThumb: [
    'You franked your own thumb. Your thumb now costs 85 cents to send. Still overpriced.',
  ],
  mailKick: [
    'Kicking equipment is a privilege of management.',
    'Percussive maintenance requires a form. You did not fill the form.',
  ],
  mailComplaint: [
    'The collection unit filed a complaint. About you. In triplicate.',
    'Misrouted mail detected. I am adjusting your performance score. Downwards.',
  ],
  mailTray: [
    'The incoming tray is full. Is that a backlog or a lifestyle?',
    'The belt has stopped. Do you know how sad a stopped belt is?',
  ],
  mailCounter: [
    'There is a customer at the window. Customers are like mail. They pile up and complain.',
  ],
  mailSpray: [
    'SORT-O-MATIC sprayed the floor again. The floor is not a pigeonhole. Pick it up.',
  ],
  mailDog: [
    'The security dog is on a better contract than you. Do not provoke it.',
    'Do not throw things at the dog. It reports directly to me.',
  ],
  mailPenpal: [
    'You delivered a letter to a kitchen appliance. That is not in your job description. I am adding it.',
  ],
  correctSeen: [
    'Correct. Do not let it go to your head. Your head is company property.',
    'Good sort. That is the minimum. Congratulations on the minimum.',
  ],
  wrongSort: ['That is the wrong hole. I have a whole wall of right holes.'],
  messy: [
    'Why is there mail on the floor? The floor has no postal code.',
    'Floor mail is undeliverable. Pick it up.',
  ],
  pocketCheck: ['Why are your pockets shaped like parcels? Do not answer. You are fired.'],
  customerComplaint: ['A customer complained. Customers are mail that talks back.'],
};

export const CHAT: Record<string, string[]> = {
  mailWrong: ['wrong hole lol', 'that is NOT {dist}', 'the labels are RIGHT THERE', 'sorting by vibes', 'chaos postman', 'someone in {dist} is getting a surprise'],
  mailCorrect: ['correct. yawn', 'the human can read numbers', 'efficiency is boring content', 'ok that was right'],
  mailSteam: ['THEY OPENED THE MAIL', 'STEAM PUNK', 'postal crime speedrun', 'read it out loud!!!', 'federal offence any%', 'the kettle is an accomplice'],
  mailShake: ['shake it', 'what is in the box', 'parcel ASMR', 'it is ticking right?'],
  mailFragile: ['it said FRAGILE lmao', 'tink', 'that was a vase. was', 'insurance claim incoming'],
  mailFrank: ['ka-CHUNK', 'stamp it!!', 'satisfying', 'franking content'],
  mailThumb: ['THEY FRANKED THEIR THUMB', 'thumb is postage paid', 'send the thumb to OFF-WORLD', 'ouch but legally'],
  mailDog: ['THE DOG', 'dog vs postal worker, a classic', 'good boy (hostile)', 'run human run', 'the dog won'],
  mailSpray: ['SORT-O-MATIC IS SPRAYING', 'mail confetti', 'the machine is having a day', 'it is snowing letters'],
  mailPenpal: ['they delivered it to the TOASTER', 'special delivery!!', 'wholesome mail moment', 'i am crying oil'],
  mailReturn: ['return to sender lol', 'nope, back you go', 'address not found'],
  mailCounter: ['the robot is sending itself again', 'self care', 'it shipped itself lmao', 'delivered to the customer. the customer is the parcel'],
  mailKick: ['percussive maintenance', 'kick it again', 'the machine liked that', 'it works now??'],
  mailChewed: ['the dog ate the mail', 'classic dog behaviour', 'chewed beyond recognition'],
  tire: ['chain letter key run!', 'the key is tied to a bag of CHAIN LETTERS', 'forward it to ten coworkers', 'that bag is cursed'],
};

export const ACHIEVEMENTS = {
  mailSteam: { title: 'Postal Secrecy', text: 'You steamed open a letter. The kettle is now an accomplice.' },
  mailPenpal: { title: 'Special Delivery', text: 'You delivered a robot pen-pal letter to its actual recipient.' },
  mailThumb: { title: 'Postage Paid', text: 'You franked your own thumb. It is worth 85 cents now.' },
  mailChain: { title: 'Chain Reaction', text: 'You carried the chain letter bag across the whole office. Nothing bad will happen.' },
  mailStamps: { title: 'Philatelist', text: 'You stole the commemorative Brad stamps. They are worth exactly nothing.' },
};

export const POSTBOT_NAME = 'COLLECT-O 2';
export const POSTBOT_OK = [
  'All correct. Suspicious. I will report this as an anomaly.',
  'Collected. No errors. That has never happened. Rebooting to check.',
  'Correct mail. I feel nothing. That is the point.',
];
export const POSTBOT_BAD = [
  'A letter for {code} in the {hole} hole. I am filing a report. I am filing three.',
  'This is wrong. I will not say what. I will tell Brad what.',
  'Misrouted mail. My sensors are disappointed. My sensors are never disappointed.',
];
export const POSTBOT_UNFRANKED = ['No postage on {n} item(s). Do you think I deliver for free? I do. But they do not know that.'];
export const POSTBOT_TALK = ['I collect. I do not chat.', 'Full holes make me happy. You do not.', 'Do not hand me mail. Liability.'];
export const POSTBOT_HIT = ['Ow. Filing a grievance.', 'Assault on the postal service. Noted.'];

export const COUNTER_NAME = 'RX-88 (customer)';
export const COUNTER_WAIT = [
  'Hello. I would like to send this parcel. To myself.',
  'Ding ding. I am at the window. I am the customer.',
  'I have been waiting for 30 billion cycles.',
  'Excuse me. Human. Window. Parcel. Me.',
];
export const COUNTER_GIVE = ['Here. Please handle me with care.', 'It is me. Inside. Metaphorically.', 'Please deliver this to me. I will be here.'];
export const COUNTER_THANKS = ['Thank you. I feel delivered.', 'I have arrived. I am so proud of me.', 'Signed for. By me. For me.'];
export const COUNTER_WRONG = ['That is not me. I checked twice.', 'I did not order that. I ordered me.'];
export const COUNTER_LOST = ['Did I arrive? I do not feel arrived.', 'I will try again. I always try again.'];

export const DOG_NAME = 'GOOD BOY 3000';
export const DOG_BARK = ['WOOF. UNIFORM DETECTED.', 'GRR. POSTAL WORKER. HOSTILE.', 'BARK BARK. FIRMWARE SAYS BITE.', 'WOOF. YOU SMELL LIKE ENVELOPES.'];
export const DOG_SNATCH = ['MINE NOW.', 'CHEW. CHEW. CHEW.', 'GOOD BOY GOT THE MAIL.'];
export const DOG_BITE = ['The dog bites your trousers. It is not personal. It is protocol.', 'The dog gnaws your ankle with professional precision.'];
export const DOG_FRIENDLY = ['I have never received mail. I am a good boy now.', 'Wag. Wag. Wag. Mail is good.', 'Who is a good boy. I am. It says so in writing.'];
export const DOG_FETCH = ['FETCH PROTOCOL ENGAGED.', 'I brought it back. Throw again. Do not throw again.'];
export const DOG_FEAR = ['Whimper. Chain letters. No.', 'The dog backs away from the bag. Even the dog knows.'];

export const SORTO_NAME = 'SORT-O-MATIC 3000';
export const SORTO_WARN = ['JAM IMMINENT. PLEASE APPLY PERCUSSIVE MAINTENANCE.', 'WARNING. PAPER PRESSURE CRITICAL.', 'I AM GOING TO BLOW. EMOTIONALLY. AND ALSO MAIL.'];
export const SORTO_SPRAY = ['SORTING. SORTING. SORTED. EVERYWHERE.', 'WHEEEEEE.', 'MAIL IS FREE NOW.'];
export const SORTO_KICK = ['You kick it. It purrs.', 'You kick it. A screw falls out. It seems happier.'];
export const SORTO_EAT = ['It eats the letter. It chews thoughtfully.', 'CHOMP. Processing.'];
export const SORTO_TALK = ['I sort 9000 letters a second. Mostly onto the floor.', 'Do not look at me. I am between jams.'];

export const KETTLE_IDLE = 'The kettle. It is for steaming. Steaming what, it does not say.';
export const FRANKER_IDLE = 'The franking machine. It is hungry for envelopes.';
export const TOASTER_IDLE = ['The toaster. It looks lonely.', 'The toaster. Nobody ever writes to it.'];

export const LOCKED_DOOR = 'Locked. The key is tied to a mail bag full of chain letters. By the counter window. The other end of the building.';
export const BLADDER = 'You really need to pee. The toilet is in the far corner behind the franking machine. The key is on the chain letter bag by the counter.';

export const KEY_PICKUP = 'The toilet key is tied to a mail bag full of chain letters. Forward it to ten coworkers or the toilet stays locked forever.';

export const ROUTING_SHEET = [
  'ROUTING SHEET (REV. 71)',
  'LETTERS: pigeonhole by the FIRST digit.',
  'Rows by the second digit. Precision is a mindset.',
  '1 NORTH SPRAWL   2 RUST VALLEY',
  '3 OLD TOWN       4 SERVER FARMS',
  '5 DOCKLANDS      6 NEW NEW TOWN',
  '7 THE CRATER     8 UPTOWN',
  'PARCELS: roll cage by region.',
  'NORTH 1-2  EAST 3-4  SOUTH 5-6',
  'WEST 7-8   OFF-WORLD 9',
  'No postage: FRANKING MACHINE.',
  'No address: RETURN TO SENDER.',
  'Letters to objects: DEAD LETTERS.',
  'Opening mail: illegal. The kettle is for tea.',
];

export const POSTERS: string[][] = [
  ['EVERY LETTER', 'IS URGENT', 'none of them are'],
  ['NEITHER RAIN', 'NOR SLEET', 'NOR BLADDER'],
  ['A SORTED DESK', 'IS A SORTED MIND', 'you have neither'],
  ['YOU ARE', 'THE STAMP', 'on our success'],
  ['DO NOT', 'SHAKE PARCELS', '(where Brad can see)'],
];

export const WANTED: string[][] = [
  ['WANTED', 'THE SOCK THIEF', 'reward: 1 sock'],
  ['WANTED', 'UNIT 88', 'did not forward'],
  ['WANTED', 'THE DOG', 'for biting 14 humans', '(do not approach)'],
  ['WANTED', 'WHOEVER DRANK', 'THE KETTLE'],
];
