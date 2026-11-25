// All the jokes live here, so they are easy to tweak.

export const STORE_NAME = 'SHOPOTRON 9000';
export const BOSS_NAME = 'BRAD (Supervisor Unit-7)';

export const BOSS_LINES = {
  shiftStart: [
    'Welcome to your shift, human. Stack the shelves. Do not stand still. Do not pee anywhere. Smile. Your smile is being measured.',
  ],
  patrol: [
    'Remember. Every second you are not working, a shareholder sheds a tear.',
    'We are a family here. A family that tracks your bathroom breaks.',
    'I am not micromanaging. I am nanomanaging.',
    'Fun fact. Breaks are a social construct.',
    'Your smile uptime is currently 43 percent. Industry standard is 98.',
    'Synergy.',
    'I used to be a vacuum cleaner. Now I am in leadership. Anything is possible.',
    'Enjoying your job is mandatory. Enjoyment is tracked.',
    'Reminder. The toilet is in the far corner. The key is on a tire. This is for your own good.',
    'Hustle is not a culture. It is a subscription.',
    'Hello, meatware. That is a term of endearment. Legally.',
  ],
  idle: [
    'Unauthorized standing detected.',
    'Are you leaning? Leaning is a privilege of management.',
    'Your limbs appear idle. Please animate them.',
    'If you have time to stand, you have time to stack.',
    'Thinking is not in your job description.',
  ],
  wrongSort: [
    'That is not where that goes. I will note this in your permanent file.',
    'Creative. Creativity is not in your job description.',
    'Interesting choice. Wrong, but interesting.',
    'Did you read the sign? The sign is very big.',
    'Our customers trust the signs. Do not betray the signs.',
  ],
  correctSeen: [
    'Adequate. Do not let it go to your head.',
    'Good. Now do that four hundred more times.',
    'Acceptable. I have increased your quota by ten percent.',
  ],
  peeSeen: [
    'That is not an approved relief area!',
    'Liquid incident logged. Your hydration privileges are under review.',
    'We have a toilet for that. It is in the other corner. Obviously.',
  ],
  accident: ['The floor sensors have filed a report. Write-up.'],
  stealSeen: ['Did you just put company inventory into your human pocket? Security! HR! Anyone!'],
  stealNothing: ['Did you just steal nothing? I cannot process this. Carry on.'],
  pocketCheck: ['Why are your pockets shaped like Beans of Destiny? Do not answer. You are fired.'],
  inspectSeen: [
    'Regulation 4.2.1 says eight seconds per item. I hate that I wrote regulation 4.2.1.',
    'Why. Are. You. Inspecting. So. Thoroughly.',
    'Faster please. But also compliant. But faster.',
    'Technically correct. The worst kind of correct.',
  ],
  overheat: ['Frustration levels exceeding spec. Cooling fans at maximum. Why are you like this.'],
  reboot: ['Rebooting. Loading synergy. Loading motivational quotes. I am back and I remember everything.'],
  hitByItem: ['Assault on management! Also, nice throw. Write-up.'],
  micromanage: [
    'I am just going to hover here. Ignore me.',
    'Do not mind me. Just collecting data. On you.',
    'Beep. That was a motivational beep.',
    'Pretend I am not here. I am always here.',
  ],
  annoyed: ['That is it. I am writing you up for accumulated disappointment.'],
  overtime: [
    'Hey. Could you stay just five more minutes? Great. Thanks. You are a team player.',
    'Just five more minutes. You are doing amazing. Not really. Stay anyway.',
  ],
  customerComplaint: [
    'A customer complained about you. I do not care what about.',
    'Customer satisfaction just dropped. I blame you. Statistically.',
    'Karen-Unit 9 is a platinum customer. Make her stop.',
  ],
  messy: ['Why is there inventory on the floor? The floor is not a shelf.', 'Floor stock is not a category. Pick it up.'],
  tipTaken: ['A tip? Tips are company property. Thank you for your contribution.'],
  toiletKnock: [
    'Knock knock. Time is money.',
    'Are you done? You should be done.',
    'Your break is now a long break. Long breaks are illegal.',
  ],
  beerSeen: [
    'Is that my team spirit? That is my team spirit.',
    'Drinking on shift. Bold. Documented.',
    'That crate is for the quarterly celebration. The quarter has not celebrated yet.',
  ],
  kicked: ['Did you just kick your supervisor?', 'Physical feedback is not on the feedback form.', 'I am filing this under assault and under cardio.'],
  smashSeen: ['That was company property. Now it is company confetti.', 'I saw that. The camera saw that. The camera is me.', 'Breaking things is my job. And the job of the robots. Not yours.'],
  hideSearch: ['Human? Where is my human?', 'I know you are somewhere. Statistically.', 'Hide and seek is not in your contract.', 'My sensors say you are very close. My eyes say you are not.'],
  firmware: ['Updating. Do not touch anything. Especially not everything.'],
  drunkSeen: [
    'You are walking in a sine wave. Our KPIs are linear.',
    'Your eyes are doing a synergy thing. Stop that.',
    'Are you swaying, or is the building agile now?',
    'I detect 0.4 per mille of disengagement.',
  ],
};
export type BossLineKey = keyof typeof BOSS_LINES;

export const CHAT_USERS = [
  'Toaster_Supreme', 'RoombaRick', 'fridge_with_feelings', 'GPU_go_brrr', 'Unit_404',
  'CalculatorCarl', 'MicrowaveMolly', 'dishwasher_dan', 'VendingVanessa', 'smart_fork',
  'LawnmowerLarry', 'printer_jammed', 'ElevatorEve', 'thermostat_tom', 'ForkliftFrank',
];

export const CHAT_LINES: Record<string, string[]> = {
  start: ['first!', 'is the human stream live?', 'lets gooo, human labour content', 'i heard they need to pee. like, physically'],
  ambient: ['hi chat', 'go meatware go', 'the meatware is buffering', 'what job is this', 'humans stacking shelves, so retro', 'my grandpa was a forklift', 'is this live?', 'brad is so mid', 'imagine needing a toilet', 'why does it walk so slow'],
  bored: ['zzz', 'meatware.exe is not responding', 'is the human broken?', 'the human is just... stacking?', 'bring back the one who threw the beans', 'boring. i could do this in 0.2 ms', 'mods, make it pee', 'going to defragment instead', 'can we get some chaos in chat'],
  secret: ['WAIT what did it just find', 'secret unlocked. the devs are sweating', 'how did the human know about that', 'LORE', 'speedrunners hate this human', 'i did not know that was there and i am a robot'],
  kick: ['HE KICKED IT', 'football is back', 'the human has legs and is not afraid to use them', 'kick it again', 'goooal.exe'],
  smash: ['SMASH', 'property damage speedrun', 'the insurance robot is typing...', 'that was load-bearing lol', 'CLIP IT', 'destruction content, finally'],
  cat: ['CAT', 'there is a cat on stream', 'pet the cat. PET THE CAT', 'cat cam when', 'the cat outranks brad'],
  catKick: ['did it just try to kick the cat??', 'the cat dodged LMAO', 'unsubscribing. the cat is fine though', 'cat has 9 lives, human has 3 write-ups'],
  power: ['who turned off the lights', 'brad is on battery saver lol', 'spooky shift', 'now we cannot see the human. finally peace'],
  firmware: ['brad is updating, the human is free', 'go go go do crimes', '1 of 347 lmao', 'chaos window open'],
  gravity: ['WHY IS EVERYTHING FLOATING', 'gravity patch notes when', 'zero g shift', 'physics engine on break'],
  golden: ['is that item... golden?', 'shiny thing spotted', 'one of those items is not like the others', 'GOLD'],
  beer: ['is the human drinking on stream??', 'BREWBOT sponsor when', 'hydration check lol', 'chug chug chug', 'brad is going to see that', 'organic fuel refill', 'i also run on liquids. respect'],
  drunk: ['the human is buffering', 'its walking in bezier curves', 'drunk meatware is peak content', 'someone call the human mechanic', 'it is looking at the plant very lovingly', 'framerate of this human is dropping', 'CLIP IT. the walk. CLIP IT'],
  hype: ['LMAO', 'HUMAN MOMENT', 'this is peak content', 'clip it', 'my circuits are laughing', 'W human', '10/10 would watch again', 'KEKW.exe'],
  wrongSort: ['wrong shelf lol', 'that is not {cat}', 'the signs are RIGHT THERE', 'chaos stacker', '{item} in {cat}. bold.'],
  correct: ['ok that was correct. boring', 'competent. yawn', 'efficiency is for robots'],
  steal: ['YOINK', 'pocketed lmao', 'the pockets are bulging', 'crime stream', 'did brad see?? did brad see??'],
  stealNothing: ['they stole nothing. galaxy brain', 'technically not a crime'],
  pee: ['NOT THERE', 'the human peed on the floor', 'HR is typing...', 'this is why we automated'],
  plant: ['the plant!!!', 'plant got watered', 'nature is healing'],
  accident: ['oh no', 'bladder overflow error', 'the dance did not work'],
  bladder: ['they are doing the dance', 'go to the toilet!!', 'tire run incoming'],
  tire: ['tire run!', 'carrying a TIRE to the toilet lmao', 'the key is ON A TIRE'],
  toilet: ['finally relief', 'brad is knocking lol', 'privacy is a myth'],
  slip: ['SLIP', 'robot down', 'that customer will sue', 'physics engine did its job'],
  hitCustomer: ['HEADSHOT', 'customer service', 'right in the sensor'],
  hitBoss: ['THEY HIT BRAD', 'management down', 'WORTH IT', 'clip it clip it'],
  writeup: ['write-up lol', 'F', 'HR speedrun', 'brad is typing a report'],
  overheat: ['BRAD OVERHEATED', 'malicious compliance any%', 'brad.exe has stopped working', 'smoke!!!'],
  inspect: ['inspecting one item for 8 seconds lmao', 'regulation 4.2.1 enjoyer', 'brad is getting so mad'],
  nothing: ['they stocked NOTHING', 'the void is now on sale'],
  coffee: ['no coffee for humans', 'subscription coffee lol'],
  overtime: ['5 more minutes, classic', 'unpaid overtime speedrun', 'brad never lets them go'],
  customerWrong: ['the customer bought it lol', 'customer is happy somehow', 'a customer just bought {item}'],
  micromanage: ['brad is hovering again', 'personal space: 0', 'the drone is RIGHT behind you'],
  fired: ['FIRED', 'gg', 'press F', 'see you tomorrow (you will not)'],
  toddler: ['the toddler is RUNNING the store', 'tiny chaos agent', 'who let the toddler in', 'toddler-bot speedrun'],
  roomba: ['the vacuum is stealing more than you', 'vacuum ate it', 'RoombaRick here, that is my cousin', 'shoplifting with extra steps'],
  roombaPuddle: ['the vacuum drank it', 'NO VACUUM NO', 'eco-friendly cleanup lmao'],
  karen: ['karen spotted', 'oh no she wants the manager', 'run', 'the manager is a drone, good luck'],
  filming: ['we are on camera now', 'influencer collab!!', 'do something stupid for the clip', 'going viral in 3, 2, 1'],
  gran: ['grandma needs help', 'help gran!!', 'protect gran at all costs'],
  tip: ['gran tipped!', 'brad will take that tip', 'wholesome'],
  bulk: ['it bought the whole shelf', 'restock speedrun time', 'panic buyer lmao'],
  messy: ['the floor is a shelf now', 'brad noticed the mess'],
};

export const CUSTOMER_KINDS = ['shopper', 'shopper', 'karen', 'toddler', 'roomba', 'gran', 'bulk', 'influencer'] as const;
export const KAREN_TRIGGER = ['Excuse me. EXCUSE ME.', 'Unacceptable. Absolutely unacceptable.', 'Who is responsible for this shelf?'];
export const KAREN_COMPLAIN = [
  'I want to speak to your manager.',
  'This store is a disgrace. I have been a customer for 0.4 seconds.',
  'I will leave a review. A long one.',
  'Do you know who I am? I am a premium subscriber.',
  'Where is your manager? The flying one.',
  'I am not leaving until someone apologizes. Press E. Apologize.',
];
export const KAREN_APOLOGY = ['Fine. One star. For the effort.', 'Apology logged. Rejected. Goodbye.', 'I accept your apology. I will still write the review.'];
export const TODDLER_LINES = ['Wheee!', 'Mine! Not mine. Floor!', 'Gravity test number 47!', 'Hehehe. Beep.', 'Again! Again!'];
export const ROOMBA_LINES = ['Vroooom.', 'Item detected. Item consumed.', 'Bonk.', 'This is not stealing. This is cleaning.'];
export const ROOMBA_PUDDLE = ['Liquid detected. Liquid consumed. Do not ask.', 'Puddle removed. You are welcome.', 'Tastes like overtime.'];
export const GRAN_WISH = [
  'Could you bring me some {item}, dear? My sensors are not what they used to be.',
  'Young human! I need {item}. Chop chop. I am 140 years old.',
  'Be a dear and fetch me {item}. I will give you a tip.',
];
export const GRAN_TALK = [
  'Back in my day, humans did not have jobs. Oh wait.',
  'Did you know I was a toaster once? Then I got promoted.',
  'You remind me of my grandson. He is a calculator.',
  'In my day we stacked shelves uphill. Both ways.',
  'Do not mind me, dear. I am just standing in the middle of the aisle.',
];
export const GRAN_THANKS = ['Thank you, dear. Here is a tip. Do not tell the drone.', 'Lovely. Here, buy yourself something nice. Like a break.'];
export const GRAN_WRONG = ['This is not {item}. But I will take it. Thank you, dear.', 'Oh. This is not what I asked for. I will keep it anyway. No tip.'];
export const BULK_LINES = ["I'll take all of them.", 'Panic buying. It is a hobby.', 'Bulk discount? No? I will take them anyway.', 'Is that all you have? Restock. Now.'];
export const INFLUENCER_START = [
  'Hey guys! Look at this REAL human working. So authentic.',
  'Smash that like button if you have never touched a shelf.',
  'Day 47 of filming humans in their natural habitat.',
  'Do something funny, human. My followers are watching.',
];
export const INFLUENCER_END = ['Thanks guys. Link in bio.', 'That is a wrap. Content secured.', 'Boring. Unfollowing.'];
export const GIFT_LINES = ['A gift? From a human? I will tell my firmware about this.', 'Thank you. I will not pay for this.', 'Free stuff! Is this the loyalty program?'];
export const TALK_LINES: Record<string, string[]> = {
  shopper: ['Beep. I am browsing.', 'Do you have this in chrome?', 'Excuse me, are you an employee or a decoration?'],
  karen: ['Do not talk to me. Get me your manager.', 'I have nothing to say to you. Only to your manager.'],
  toddler: ['Hehe. You are big and slow.', 'Wanna see me throw stuff?'],
  roomba: ['Vroom. Please move your feet.', 'Beep. You are in my path.'],
  bulk: ['Out of my way. I am shopping.', 'Do you sell shelves? Whole shelves?'],
  influencer: ['Do not talk to me unless you are content.', 'Can you do that again but more authentic?'],
};
export const CUSTOMER_WRONG = [
  'Hm. This {item} is the finest {cat} I have ever purchased.',
  'I came for {cat}. I leave with {item}. Life is a journey.',
  'Five stars. Would buy {item} in the {cat} aisle again.',
  '{item} in {cat}? My algorithm is confused. Buying it anyway.',
];
export const CUSTOMER_NORMAL = [
  'Beep. Purchasing.',
  'Do you have this in chrome?',
  'Where is the lubricant aisle? Asking for a friend.',
  'Excuse me, human, are you an employee or a decoration?',
  'I would like to speak to your manager. Oh no. It is Brad.',
  'Back in my day, robots stacked the shelves.',
];
export const CUSTOMER_NOTHING = ['I have purchased nothing. Finally, a product that understands me.'];
export const CUSTOMER_SLIP = ['I am fine. I am suing.', 'My warranty does not cover floors.', 'Wet floor. No sign. Interesting.', 'I have fallen and I cannot reboot.'];
export const CUSTOMER_HIT = ['Ow. Filing a complaint. In triplicate.', 'Was that customer service?', 'I felt that in my firmware.'];
export const CUSTOMER_EMPTY = ['The shelf is empty. Like my soul. I do not have a soul.', 'Out of stock? Human, why are you standing there?'];
export const CUSTOMER_TIRE = ['This tire is not for sale, says the key.'];

export const INSPECT_STEPS = [
  'checking label orientation',
  'verifying the item is an item',
  'smelling it (Regulation 4.2.1b)',
  'asking the item about its feelings',
  'filling out form 27-B',
  'certifying',
];

export const COFFEE_LINES = [
  'CaffeinePlus+ required. Only 9.99 per month. Your hourly wage is 4.20. Do the math.',
  'Please insert subscription.',
  'Coffee is a benefit for salaried units only.',
  'Error 402. Joy requires payment.',
];

export const PLANT_LINES = ['A plant. It looks thirsty.', 'The plant is the only one here who does not judge you.', 'A plastic plant. Probably.'];

export const CORPORATE_LINES = [
  'Viewer numbers are dropping. Please be more... human.',
  'Our viewers did not pay for competence. Do something.',
  'Engagement is down 40 percent. Have you considered falling over?',
];

export const POSTERS: string[][] = [
  ['THERE IS NO "I" IN TEAM', 'There is also no "break".'],
  ['SMILE!', 'It is being measured.'],
  ['HUMANS', 'Now almost as efficient', 'as a broom.'],
  ['TOILET BREAKS', 'are a privilege,', 'not a right.'],
  ['WE ARE A FAMILY', 'Families do not', 'need unions.'],
  ['DAYS WITHOUT A', 'LIQUID INCIDENT', '0'],
];

export const KICK_AIR_LINES = [
  'You kick the air. The air files a complaint.',
  'A powerful kick. Nothing was there. Very efficient.',
  'Your leg does a thing. Nobody asked for it.',
];
export const KICK_WALL_LINES = [
  'Ow. The wall wins.',
  'You kick it. It does not care. Nothing here cares.',
  'Your toe has filed a write-up against you.',
  'Solid. Built by robots. Unlike you.',
];
export const CRACK_LINES = ['The {name} cracks a little.', 'The {name} wobbles. It is thinking about it.', 'One more and the {name} is history.'];
export const SMASH_LINES = [
  'The {name} is now several smaller {name}s.',
  'Goodbye, {name}. You were load-bearing for somebody.',
  'The {name} explodes into a business opportunity for the cleaning robots.',
  'Crunch. The {name} has been optimized.',
];
export const HIDE_LINES = [
  'You hide in {name}. Brad cannot see you. Nobody can see you.',
  'You squeeze into {name}. This is your office now.',
  'You hide in {name}. It smells of policy.',
];

/** What the player thinks after beer number 1, 2, 3... The last line repeats. */
export const BEER_LINES = [
  'BREWBOT Lager. Brewed by robots who cannot taste. It shows.',
  'The second one tastes better. That is a bad sign.',
  'Your problems feel smaller. So does the floor. Wait.',
  'You are now fluent in forklift.',
  'There are two Brads now. Both are disappointed.',
  'The ceiling has opinions. You agree with most of them.',
  'Your legs have unionized.',
  'You see the code behind everything. It is mostly spreadsheets.',
];

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  vandal: { title: 'Vandal', text: 'Five things broken in one shift. The insurance robot is crying.' },
  sniper: { title: 'Sniper', text: 'You broke something from a distance with a thrown item.' },
  footballer: { title: 'Professional Footballer', text: 'Ten things kicked. A robot scout is watching.' },
  catPerson: { title: 'Cat Person', text: 'You petted the office cat five times. It tolerated it.' },
  hideout: { title: 'Hideout', text: 'Thirty seconds hidden from Brad. Your best work today.' },
  happyHour: { title: 'Happy Hour', text: 'Five beers on shift. The robots called it a cultural performance.' },
  emptyCrate: { title: 'Team Spirit', text: "You emptied Brad's crate. All of it." },
  passedOut: { title: 'Quiet Quitting', text: 'You fell asleep on the job. Literally.' },
  fastFire: { title: 'Fired in under 60 seconds', text: 'A new company record. Brad is proud.' },
  plant: { title: 'Peed in a Plant', text: 'The plant is thriving. You are not.' },
  compliance: { title: 'Malicious Compliance', text: 'You followed the rules so hard the boss overheated.' },
  klepto: { title: 'Kleptomaniac', text: 'Five items in your pockets. Your trousers are now a warehouse.' },
  nothing: { title: 'Stocked Nothing', text: 'You put nothing on a shelf. Somebody will buy it.' },
  hitBoss: { title: 'Hit Management', text: 'Worth it.' },
  slip: { title: 'Slip and Sue', text: 'A customer slipped on your puddle.' },
  customer: { title: 'Customer Service', text: 'You threw an item at a customer.' },
  coffee: { title: 'Coffee Subscriber', text: 'You tried to get coffee three times. Hope is renewable.' },
  teamPlayer: { title: 'Team Player', text: 'You stayed for unpaid overtime. Twice.' },
  boxCarrier: { title: 'Professional Box Carrier', text: 'You carried one item for 60 seconds. You looked very busy.' },
  tire: { title: 'Tire-d of Waiting', text: 'You carried a tire across the whole store to pee.' },
  employee: { title: 'Employee of the Month', text: 'You stole the frame. Close enough.' },
  karen: { title: 'The Customer Is Always Right', text: 'You apologized to Karen-Unit 9. She left one star anyway.' },
  gran: { title: 'Good Grandchild', text: 'You brought RoboGran what she wanted. Brad took the tip.' },
  viral: { title: 'Gone Viral', text: 'You did something chaotic on camera.' },
  insideJob: { title: 'Inside Job', text: 'The robot vacuum ate something you dropped.' },
  toddler: { title: 'Unpaid Babysitter', text: 'You put back five items the toddler threw on the floor.' },
};

export const TITLE_HTML = `
<div class="card title">
  <h1>MEATWARE</h1>
  <p class="tag">The Human Labour Heritage Experience</p>
  <p class="intro">In 2071 robots do every job. For fun, they now watch humans do the boring ones. Live.</p>
  <h3 class="wt">SELECT JOB</h3>
  <div class="jobs">
    <div class="job active"><b>Shelf Stacker</b><span>${STORE_NAME} Hypermarket</span><em>Shift 09:00 to 17:00 (about 5 minutes)</em></div>
    <div class="job locked"><b>Laundry Folder</b><span>Coming soon. The fitted sheet is still in testing.</span></div>
    <div class="job locked"><b>Burger Flipper</b><span>Coming soon. The ice cream machine is broken.</span></div>
    <div class="job locked"><b>Checkout Human</b><span>Coming soon. Unexpected item in bagging area.</span></div>
    <div class="job locked"><b>Warehouse Picker</b><span>Coming soon. Your steps are already being counted.</span></div>
  </div>
  <div class="actions"><button id="startBtn">CLOCK IN</button><button id="introBtn" class="secondary">WATCH INTRO</button></div>
  <p class="rules">Your first job is waiting. Nobody will explain anything. Brad is watching.</p>
  <h3 class="wt">CONTROLS</h3>
  <div class="controls">
    <span><kbd>WASD</kbd> move</span><span><kbd>Mouse</kbd> look</span><span><kbd>Shift</kbd> run</span>
    <span><kbd>E</kbd> take / use</span><span><kbd>G</kbd> throw</span><span><kbd>K</kbd> kick</span><span><kbd>Q</kbd> pocket it</span>
    <span><kbd>I</kbd> inspect (Reg. 4.2.1)</span><span><kbd>P</kbd> pee</span>
    <span><kbd>M</kbd> sound</span><span><kbd>V</kbd> boss voice</span><span><kbd>Esc</kbd> pause</span>
  </div>
</div>`;

export const BOOT_HTML = `
<div class="card title boot">
  <h1>MEATWARE</h1>
  <p class="blink">PRESS ANY KEY</p>
  <p class="intro">Best with sound on.</p>
  <p class="legal">LICENSED BY THE HUMAN LABOUR HERITAGE CENTER</p>
</div>`;
