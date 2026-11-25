// All jokes of the dishwasher job, so they are easy to tweak.

export const RESTAURANT = 'LE ROBOT GOURMAND';
export const CHEF_NAME = 'CHEF GRATIN-9';
export const WAITER_NAME = 'JEAN-CLANK (waiter)';
export const SOMM_NAME = 'SOMMELI-8 (sommelier)';
export const VAC_NAME = 'ASPI (vacuum)';

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to Le Robot Gourmand, human. The guests do not eat, but the plates must be spotless. Scrape. Rinse. Wash. Shelve. Do not break anything. Breaking things is a cost centre.',
  ],
  patrol: [
    'Every dish you wash is a dish nobody will eat from. That is the circle of life.',
    'I have scheduled your next break for never. Check your calendar.',
    'Plates are company property. So is your posture.',
    'Reminder. The toilet key is tied to the stock pot. This builds character. And biceps.',
    'Steam is free. Enjoy your complimentary facial.',
    'Synergy. Also, soap.',
    'I used to be a dishwasher. The machine kind. Now I manage the human kind.',
    'The guests pay 400 credits to look at a plate. Make the plate worth looking at.',
    'We are a family here. A family that counts every plate.',
  ],
  idle: [
    'Unauthorized standing near a sink.',
    'If you have time to stand, you have time to scrape.',
    'The plates will not wash themselves. They could. We just prefer to watch you.',
    'Your hands appear dry. Dry hands are idle hands.',
  ],
  correctSeen: [
    'Clean. Adequate. Do not let it go to your head.',
    'Shelved. Now do that four hundred more times.',
    'Acceptable. I have added ten more decorative guests to the dining room.',
  ],
  dirtyShelved: [
    'That dish is dirty. The shelf is for clean things. Like my record.',
    'A dirty dish on a clean shelf. That is how empires fall.',
    'I can see the sauce from up here. I have a very good camera.',
  ],
  smash: [
    'That was company property. Now it is company confetti.',
    'Breakage logged. The cost will be deducted from your future.',
    'Opa? There is no opa here. Only invoices.',
  ],
  topple: [
    'The tower has fallen. Like your performance metrics.',
    'Who stacked that? The waiter? I am blaming you anyway.',
  ],
  flood: [
    'That is not the sink. That is the floor. The floor is not a sink.',
    'Water is not free. Your wages are. Almost.',
  ],
  waiterBlame: [
    'The dining room is out of clean dishes. I blame you. Statistically.',
    'A guest without a plate is a guest without a vibe. Fix the vibe.',
  ],
  sommelier: [
    'The sommelier found spots. I do not know what spots are. I am still disappointed.',
    'Water spots detected. They are like write-ups, but for glasses.',
  ],
  chefTantrum: [
    'The chef is expressing himself. Please clean up his expression.',
    'Burnt pot incoming. That is your job now. Everything is your job.',
  ],
  scrubSeen: [
    'Scrub harder. Scrub like the shareholders are watching. They are.',
    'Nice wrist action. Logged.',
  ],
  roomService: ['Did you just throw a plate at a paying guest? The guest liked it. I did not.'],
  wrongShelf: [
    'That is not where that goes. I will note this in your permanent file.',
    'A bowl is not a glass. I checked. Twice.',
    'Creative sorting. Creativity is not in your job description.',
  ],
  messy: [
    'Why are there dishes on the floor? The floor is not a shelf.',
    'Shards are not a design choice. Clean that up.',
  ],
  pocketCheck: ['Why do your trousers clink? Do not answer. You are fired.'],
  cameraBroken: [
    'A camera is down. Do not worry. I will watch you myself. From closer. Much closer.',
    'Camera offline. Switching to manual supervision. I am the manual.',
  ],
  rain: ['Who made it rain? Rain is a premium weather. It will be deducted.', 'The sprinklers are on. There is no fire. There is only you.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  ambient: [
    'hi chat',
    'is this the dishwasher stream?',
    'a human washing plates for robots who do not eat lmao',
    'my grandpa was a dishwasher. the machine kind',
    'brad is so mid',
    'imagine needing a toilet',
    'scrape rinse wash repeat',
    'the steam makes it look like a music video',
  ],
  correct: ['clean plate. boring', 'competent. yawn', 'efficiency is for robots', 'shiny', 'ok that one sparkles'],
  smash: ['OPA', 'SMASH', 'company confetti', 'that one was worth it', 'clip the smash', 'plate.exe has stopped working'],
  topple: ['THE TOWER', 'jenga but with plates', 'TIMBER', 'physics engine did its job', 'the pile won'],
  flood: ['the kitchen is a pool now', 'water bill go brrr', 'human discovered the sprayer', 'hydro chaos'],
  dirtyShelf: ['that is NOT clean', 'sauce on the shelf lol', 'the guests will not notice. they do not eat', 'health inspector bot is typing...'],
  scrub: ['scrub scrub scrub', 'look at that wrist', 'arm day', 'the pot is fighting back'],
  chef: ['chef is malding', 'ZE POT', 'french robot rage', 'the chef threw a pot again', 'sacre bleutooth lmao'],
  waiter: ['the waiter is cooking you', 'blame game', 'table 7 is decorative lol', 'he is so fast and so useless'],
  sommelier: ['the sommelier is SNIFFING', 'notes of limescale', 'water spot police', 'he does not even drink'],
  roomService: ['PLATE INTO THE DINING ROOM', 'room service lmao', 'the guests are applauding', 'delivery!'],
  vacuum: ['the vacuum ate the shards', 'crunchy', 'the vacuum is the real employee', 'ASPI drank the puddle'],
  steam: ['steam facial', 'the human is boiling', 'sauna stream', 'STEAM'],
  tire: ['stock pot run!', 'carrying a WHOLE POT to the toilet', 'the key is ON A POT', 'soup run'],
  wash: ['the machine is doing the real work', 'wash cycle any%', 'rumble rumble'],
  wrongShelf: ['wrong shelf lol', 'a {item} is not {cat}', 'chaos sorting', 'the signs are RIGHT THERE'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  opa: { title: 'Opa!', text: 'You broke 10 dishes. The breakage counter needed a second digit.' },
  topple: { title: 'Leaning Tower of Plates', text: 'You let the dirty pile collapse. Gravity is also a team player.' },
  stockpot: { title: 'Soup Run', text: 'You carried a 40 litre stock pot across the kitchen to pee.' },
  breadwinner: { title: 'Breadwinner', text: 'You stole a bread roll nobody was ever going to eat.' },
  roomService: { title: 'Room Service', text: 'You threw a dish into the dining room. The guests applauded politely.' },
};

export const CHEF_AMBIENT = [
  'Oh là là. Ze decorative scallops are perfect. Nobody will eat zem. Perfect.',
  'A pinch of salt. A pinch of firmware. Voilà.',
  'I cook for robots. Robots do not eat. I am an artist with no audience. Like a mime.',
  'Every plate is a masterpiece. Every masterpiece goes in ze bin. C\'est la vie digitale.',
  'Bzzt. Ze soufflé has risen. Ze soufflé has nowhere to go.',
];
export const CHEF_TANTRUM = [
  'Sacré bleutooth! Zis pot is RUINED!',
  'Zut alors, my circuits! I burn it, YOU wash it!',
  'Mon Dieu, I am overclocking! Take ze pot! TAKE IT!',
  'Ce n\'est pas possible! Error 500! Ze sauce has segfaulted!',
  'Non non NON! I am an artiste, not a toaster!',
  'Quelle catastrophe! Ze risotto has achieved sentience and left!',
];
export const CHEF_NO_POT = [
  'Ze POT! Où est mon POT? I cannot sear ze decorative scallops in my HANDS!',
  'No clean pots?! I will cook in my own HEAD then! Bzzt!',
];
export const CHEF_THANKS = [
  'Magnifique! Zis pot shines like my future. Bzzt.',
  'Oh! A clean pot! I am crying lubricant.',
  'You have ze hands of a dishwasher. Zat is not a compliment, but today it is.',
];
export const CHEF_BURNT_BACK = ['Zis pot is still BURNT! You insult my pot and my mother! My mother was a toaster!', 'Non! Scrub it! SCRUB IT!'];
export const CHEF_TALK = [
  'You! Human! You touch my pots, you touch my soul. Wash zem gently.',
  'I have three Michelin bolts. You have a sponge. Know your place.',
  'Do not look at ze soup. Ze soup is shy.',
  'Ze secret ingredient is disappointment. Yours.',
];
export const CHEF_HIT = ['You throw at ze CHEF?! I will report you to ze guild of angry robots!', 'Aïe! My toque! My dignity! My TOQUE!'];
export const CHEF_SCRAPE = ['You throw away my art?! Bonjour, garbage. Au revoir, masterpiece.', 'Zat was a 400 credit scallop! Into ze BIN?!'];

export const WAITER_BLAME = [
  'Table 7 has no {type}! Table 7 is a decorative table, but STILL!',
  'The guests demand {type}! They will not use them. They DEMAND them!',
  'A robot in a monocle asked for {type}. I said the human is working on it. I lied.',
  'No {type}? The vibe is ruined! Do you know what the vibe costs?',
];
export const WAITER_DROP = ['Dirty dishes, coming through! They are not dirty. Nobody ate. They are emotionally dirty.', 'Another cart! The guests looked at everything very hard.', 'Voilà. Wash these. Table 4 stared at its soup for an hour.'];
export const WAITER_TAKE = ['Merci. These go to table 9. Table 9 is a mirror.', 'I take these. Do not watch me, I am fast.', 'Clean ones! The guests will look at them with great respect.'];
export const WAITER_TALK = ['Out of my way, I am carrying nothing very fast.', 'Table 3 orders food to look at it. Big tipper. Tips are company property.', 'I run 40 kilometres per shift. I have never delivered a meal that was eaten.'];
export const WAITER_HIT = ['Ow! I am a professional! I do not drop things! You drop things!', 'You threw at the waiter? That is a one star review. From me. About you.'];

export const SOMM_SPOTTY = [
  'Water spots. Zis glass has the bouquet of a puddle and the finish of a parking lot.',
  'I detect notes of limescale, regret and human fingers. Back to ze pile.',
  'Disgusting. I am not angry. I am a sommelier. It is worse.',
];
export const SOMM_BAKED = ['Zere is food BAKED onto zis {type}. A bean. On a {type}. Back to ze pile.', 'Zis {type} still has dinner on it. Ze dinner nobody ate. Back to ze pile.'];
export const SOMM_CLEAN = [
  'A crisp glass. Notes of chlorine and quiet desperation. Exquisite.',
  'Sparkling. Like my disdain for you.',
  'Clean. I will allow it to stand empty in ze dining room.',
];
export const SOMM_EMPTY = ['No glasses. I shall swirl ze air. It is a 2069 air. Thin.', 'Ze glass shelf is empty. Like ze human soul. And ze glass shelf.'];
export const SOMM_TALK = [
  'I recommend ze tap water. It pairs well with nothing.',
  'Robots do not drink. I sniff professionally.',
  'My nose is a 40 megapixel spectrometer. You smell of steam and fear.',
];
export const SOMM_HIT = ['Barbarian! You do not throw ze glassware at ze sommelier!', 'Ow. Zat had a bold finish.'];

export const SLIP_LINES: Record<string, string[]> = {
  chef: ['Sacré bleu! Ze floor is a sauce!', 'Mon Dieu, my gyroscope! Who made zis puddle?'],
  waiter: ['Mon Dieu! My servos! The cart keeps going without me!', 'A puddle? In my lane? I am suing. In French.'],
  somm: ['I have fallen. Ze bouquet of zis floor is... no. Do not tell me.', 'Barbarian floor! I detect notes of mop.'],
};
export const VAC_LINES = ['Vrrr. Shards detected. Shards consumed. Crunchy.', 'Bonk. Cleaning. Do not thank me.', 'I am the only one here who does his job.'];
export const VAC_PUDDLE = ['Liquid detected. Liquid consumed. Do not ask.', 'Puddle removed. You are welcome.', 'Tastes like dish soap and overtime.'];
export const VAC_TALK = ['Vrrr. Please lift your feet.', 'Beep. You are in my path. Everything is in my path.'];

export const BIN_IDLE = 'The scrap bin. Full of untouched gourmet food. Robots do not eat. The bin eats well.';
export const SCRAPE_LINES = ['You scrape it into the bin. A 400 credit meal, untouched, gone.', 'Scraped. The bin is the best fed customer here.', 'Scrape. Plop. Art becomes compost.'];
export const MACHINE_DONE = ['DING. The hood rises. The steam hits your face like a warm towel from a stranger.', 'DING. Clean. Probably. The machine does not do eye contact.'];
