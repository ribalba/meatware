// All the jokes of the burger job live here, so they are easy to tweak.

export const PLACE = 'MEGABYTE BURGER (Branch 404)';
export const TITLE = 'BURGER FLIPPER';

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to MEGABYTE BURGER, human. Flip the patties. Fill the tickets. Do not touch the ice cream machine. It is resting. Smile. Your smile is on the menu.',
  ],
  patrol: [
    'Remember. Every second a patty is not flipping, a shareholder sheds a tear of grease.',
    'We are a family here. A family that counts your fries.',
    'Fun fact. The fryer has more seniority than you.',
    'I used to be a toaster. Now I am in leadership. Anything is possible.',
    'Reminder. The toilet key is in the freezer. It is on a chicken. This builds character.',
    'Our burgers are 40 percent burger. That is industry leading.',
    'The ice cream machine is not broken. It is on a journey.',
    'Synergy. Also, grease.',
    'Hustle is not a culture. It is a combo meal.',
    'Customer satisfaction is up. I do not know why. Investigate it.',
  ],
  idle: [
    'If you have time to lean, you have time to clean.',
    'The grill is not going to flip itself. We tried. It sued.',
    'Unauthorized standing detected. Standing is for queues.',
    'Your limbs appear idle. The patties are not.',
    'Thinking is not on the menu.',
  ],
  correctSeen: [
    'Order correct. Do not let it go to your head. Let it go to your quota.',
    'Adequate burger. I have increased your quota by one burger.',
    'Good. Now do that four hundred more times. Faster.',
    'The customer looks satisfied. Satisfaction is a liability. Carry on.',
  ],
  burgerWrong: [
    'That is not what the ticket says. The ticket is very small, but it is right.',
    'Creative order fulfilment. Creativity is not on the menu.',
    'Did you read the ticket? It is on a rail. Rails are for reading.',
    'The customer ordered a burger. You served a mood.',
    'Wrong order. I am noting this in your permanent grease file.',
  ],
  burnt: [
    'That patty is carbon. Carbon is not on the menu. Yet.',
    'You served charcoal. We are a burger place, not a barbecue supply store.',
    'Crunchy patty detected. Crunch is a feature of fries only.',
  ],
  floorPickup: [
    'Did you just pick food up off the floor? The five second rule is not company policy. Write-up. Serve it anyway, it is inventory.',
    'Floor food. I saw that. The floor saw that. Write-up.',
  ],
  fire: [
    'Is that a fire? Is the fire billable? Put it out. Unless it is billable.',
    'Grease fire. Classic. Use the extinguisher. It is red. Red means action.',
    'There is a fire in my kitchen. I am not angry. I am documenting.',
  ],
  fireOut: [
    'Fire extinguished. Extinguisher refills come out of your paycheck. Thank you for your contribution.',
    'Good. Now clean the foam. Foam is not a topping.',
  ],
  sprinkler: [
    'The sprinklers went off. Water is not free. Neither are you.',
    'Congratulations. You watered the entire kitchen. Write-up.',
  ],
  iceCream: [
    'Do not fix that. It is broken on purpose. It is our brand.',
    'The ice cream machine is in a meeting. Leave it alone.',
    'You cannot fix it. Nobody can fix it. That is the business model.',
  ],
  greasyHands: [
    'Why are your hands so greasy? You have not touched a single fry. Officially.',
    'Your fingers are shining. Fingers only shine when fries are missing.',
    'Hand inspection. Interesting. Your hands taste like inventory.',
  ],
  customerLeft: [
    'A customer gave up and left. Their disappointment is now on your record.',
    'You made a robot walk out. Robots are very patient. You did that anyway.',
  ],
  customerComplaint: [
    'A customer complained. I do not care what about. I care that it was about you.',
    'Customer satisfaction just dropped. Statistically, it is you.',
  ],
  critic: [
    'That is CRITIC-9000. One bad review and I get repurposed into a toaster. Again. Do not mess this up.',
    'Critic at table three. Smile with your whole face.',
  ],
  driveThru: [
    'Car at the drive-thru. Every honk costs us one brand point.',
    'The drive-thru is honking. Honking is a form of feedback.',
  ],
  messy: [
    'Why is there food on the floor? The floor is not a plate.',
    'Floor food is not a menu item. Pick it up. Do not serve it. Unless nobody sees.',
  ],
  stealSeen: ['Did you just put a menu item into your human pocket? That is not takeaway. That is theft.'],
  pocketCheck: ['Why do your pockets smell like fries? Do not answer. You are fired.'],
  stealNothing: ['Did you just steal nothing? That is not even on the menu. Carry on.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  start: ['first!', 'burger stream lets gooo', 'is the human going to cook for real', 'i heard the ice cream machine is broken lol'],
  ambient: ['hi chat', 'humans cooking food, so retro', 'what is a "taste"', 'my cousin is a fryer', 'is this live?', 'brad is so mid', 'imagine needing to eat', 'the grease is so 1990'],
  bored: ['zzz', 'is the human broken?', 'burn something', 'bring back the one who started a fire', 'boring. i could flip that in 0.2 ms', 'mods, make it drop a burger', 'try the ice cream machine lol', 'can we get some chaos in chat'],
  hype: ['LMAO', 'HUMAN MOMENT', 'this is peak content', 'clip it', 'my circuits are laughing', 'W human', '10/10 would watch again', 'KEKW.exe'],
  tire: ['CHICKEN RUN', 'the key is ON A CHICKEN', 'frozen chicken speedrun', 'it is dripping lmao'],
  bladder: ['they are doing the dance', 'go to the toilet!!', 'chicken run incoming'],
  burgerRight: ['ok that was correct. boring', 'competent burger. yawn', 'the robot looks happy, gross', 'efficiency is for robots'],
  burgerWrong: ['wrong order lol', 'that is NOT what they ordered', 'chaos cook', 'the ticket is RIGHT THERE', 'they served a vibe'],
  burnt: ['CHARCOAL', 'well done well done well done', 'smells like overtime', 'crunchy patty speedrun'],
  flip: ['nice flip', 'flip it!!', 'FLIP', 'patty go spinny'],
  fire: ['FIRE', 'THE KITCHEN IS ON FIRE', 'this is fine', 'content content content', 'brad is going to explode'],
  fireOut: ['extinguished', 'foam party', 'awww the fire is gone'],
  sprinkler: ['IT IS RAINING INSIDE', 'sprinkler moment', 'free shower for the human', 'the floor is a lake now'],
  fiveSecond: ['5 SECOND RULE', 'it still counts', 'floor seasoning', 'germs are a social construct'],
  floorFood: ['they ate the floor', 'floor burger lmao', 'the floor is a plate now', 'brad noticed the floor food'],
  iceCream: ['the machine is broken lol', 'it will never work', 'ice cream machine any%', 'it has been broken since 2041'],
  driveThru: ['honk honk', 'the car is mad', 'drive-thru speedrun', 'what did the speaker even say'],
  critic: ['the critic is here', 'zero stars incoming', 'CRITIC-9000 is my favourite reviewer', 'he reviewed the napkins lol'],
  nuggets: ['FORTY NUGGETS', 'the kid got the nuggets', 'nugget logistics', 'that is a lot of nugget'],
  existence: ['they served NOTHING', 'held existence. respect.', 'the empty tray is art'],
  greasy: ['the hands are shining', 'fry thief', 'grease fingerprints everywhere'],
  airDelivery: ['AIR MAIL', 'delivered at 40 km/h', 'customer service'],
  steal: ['YOINK', 'pocket fries lmao', 'the pockets are greasy', 'crime stream', 'did brad see?? did brad see??'],
  slip: ['SLIP', 'robot down', 'that customer will sue', 'physics engine did its job'],
  hitCustomer: ['HEADSHOT', 'customer service', 'right in the sensor'],
  messy: ['the floor is a plate now', 'brad noticed the mess'],
  roomba: ['the vacuum ate the patty', 'GREASE-E is eating better than the human', 'roomba won the 5 second rule'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  bgIceCream: { title: 'Certified Ice Cream Technician', text: 'You tried to fix the ice cream machine five times. It is still broken. It was always broken.' },
  bgFire: { title: 'This Is Fine', text: 'You stood next to a grease fire for a while. Very calm. Very professional.' },
  bgFiveSecond: { title: 'Five Second Rule', text: 'You rescued food from the floor in time. It still counts.' },
  bgExistence: { title: 'Held Existence', text: 'You served an empty tray to a customer who ordered nothing. Perfect order.' },
  bgChicken: { title: 'Chicken Run', text: 'You carried a frozen chicken across the whole restaurant to pee.' },
};

export const ICE_CREAM_FAIL = [
  'Error 0xC0NE: ice cream is a social construct.',
  'The machine hums. Then it stops humming. Then it hums sadly.',
  'Repair 99 percent complete. Repair failed at 99 percent. As always.',
  'A small screen says CLEANING CYCLE. It has said that since 2041.',
  'You hit it. It dispenses one drop of something. It is not ice cream.',
  'The machine asks for a firmware update. The update is a smaller ice cream machine.',
  'Error: technician not certified. Certification requires a working machine.',
];

export const SINK_LINES = [
  'You wash your hands. The evidence goes down the drain.',
  'You wash your hands. Regulation 12 says wash hands. Regulation 13 says washing is unpaid.',
  'Clean hands. Brad will find something else.',
];

export const CUSTOMER_NAMES = ['Toaster-Unit 7', 'Dave-3000', 'Kevin-Unit 3', 'Sprocket', 'Model T Lite', 'Blender-Bob', 'Unit 0451', 'Calculator Cathy', 'Servo Steve', 'Microwave Mo'];

export const ORDER_SAY = [
  '{order}. Quickly. My battery is at 4 percent.',
  'I would like {order}. I have reviewed your menu. It has words.',
  '{order}, please. I am told humans make it with their hands. Disgusting. Wonderful.',
  'One {order}. I have been waiting since my last firmware update.',
];
export const WAIT_LINES = [
  'Is my order a burger yet?',
  'I have been standing here for 40 seconds. That is 40 billion cycles.',
  'Human. Faster. I believe in you. No I do not.',
  'Do you need a manual? I can send you a PDF.',
  'My warranty expires while I wait.',
];
export const KAREN_WAIT = [
  'I want to speak to your manager. Oh. It is a drone. Even better.',
  'This is unacceptable. I ordered 38 seconds ago.',
  'I am leaving a one star review. In advance.',
];
export const GRAN_WAIT = [
  'Back in my day burgers were made by robots. Real ones.',
  'Take your time, dear. I have a 400 year battery.',
  'My grandson is a fridge. He would never be this slow.',
];
export const HAPPY_LINES = [
  'Correct. I feel something. It is probably the grease.',
  'This is exactly what I ordered. Suspicious.',
  'Thank you, human. Five stars. Out of a hundred.',
  'Lovely. I will now photograph it and not eat it.',
];
export const WRONG_LINES = [
  'This is not what I ordered. I will eat it anyway, out of spite.',
  'I asked for {order}. This is a different thing.',
  'Interesting. Wrong, but interesting.',
  'Did you build this with your eyes closed? Can I watch you do that again?',
];
export const BURNT_LINES = [
  'The patty is crunchy. I did not know patties could crunch.',
  'Is this patty or a hockey puck? Do not tell me. I like the mystery.',
  'I asked for well done. I did not ask for a crime scene.',
];
export const FLOOR_LINES = [
  'This tastes like linoleum. Delicious.',
  'There is a hair on this. You do not have that hair color.',
  'Mmm. Floor flavored.',
];
export const LEAVE_LINES = [
  'I am leaving. I am taking my patience with me.',
  'Enough. I will eat a battery at home.',
  'One star. For existing.',
];
export const ICE_CREAM_ORDER_LINES = [
  'Broken? Again? Since 2041? Fine.',
  'I knew it. I just wanted to hear a human say it.',
  'Every time. Every single time.',
];
export const TALK_LINES = [
  'Beep. I am waiting for food.',
  'Are you a cook or a decoration?',
  'Do you have this in chrome?',
];
export const NO_ORDER_LINES = ['I have no order. I am just here for the vibes.', 'Please do not give me things. I am window shopping.'];

export const KID_LINES = [
  'FORTY NUGGETS! FOUR-ZERO! FORTY!',
  'Are my nuggets ready? Are they? Are they now?',
  'I am going to eat ALL forty. Then I will be nugget.',
  'Nuggets nuggets nuggets nuggets.',
  'My dad is a vending machine!',
];
export const KID_HAPPY = ['NUGGETS!!! I will throw some on the floor to celebrate!', 'FORTY! I counted! I can count to forty!'];
export const KID_WRONG = ['That is not forty nuggets. I can count. Sort of.', 'Where are the nuggets? WHERE ARE THE NUGGETS?'];

export const CRITIC_PRE = [
  'Ambience: grease. Two stars for the grease.',
  'The menu says THE ANALOG contains real food. Bold claim.',
  'The ice cream machine is broken. Noted. Minus one star.',
  'The human appears to be cooking with its hands. Unsettling. Plus one star for courage.',
  'The napkins are adequate. One star for the napkins.',
  'Waiting time. My review is getting longer. That is never good.',
];
export const CRITIC_REVIEW_GOOD = [
  'THREE STARS. The highest rating I have ever given a human. Do not frame it.',
  'TWO AND A HALF STARS. The burger was correct. I am furious about it.',
];
export const CRITIC_REVIEW_MEH = [
  'ONE STAR. The burger was technically food. Technically.',
  'ONE STAR. The human had hands. I could taste the hands.',
];
export const CRITIC_REVIEW_BAD = [
  'ZERO STARS. I asked for a burger and received a lesson in humility.',
  'NEGATIVE TWO STARS. I did not know that was possible. Now I do.',
  'ZERO STARS. The patty was a fossil. I will donate it to a museum.',
];
export const CRITIC_FLOOR = 'ZERO STARS. It tasted like the floor. I checked. It was the floor.';
export const CRITIC_LEAVE = 'ZERO STARS. I waited so long my review became a novel. Goodbye.';

export const CAR_GARBLE = [
  'KRZZT. I WOULD LIKE A KSSSHT WITH EXTRA PFFRT.',
  'HELLO? IS THIS KRRZZT BURGER? I WANT THE KZZZT.',
  'ONE BZZRT, HOLD THE FSSSHT, AND A LARGE KRRRK.',
  'CAN YOU HEAR ME? I SAID KRRZZT. KRRZZT!',
];
export const CAR_HONK = ['HONK.', 'HONK HONK.', 'HOOOONK.', 'BEEP BEEP. THAT WAS A HONK.'];
export const CAR_THANKS = ['KRZZT. THANK YOU. KRZZT.', 'VROOM. FIVE STARS. KSSHT.'];
export const CAR_WRONG = ['KRRRZT? THIS IS NOT MY KZZRT.', 'WRONG BAG. I AM DRIVING AWAY ANYWAY.'];
export const CAR_LEAVE = ['FORGET IT. I WILL DRIVE TO THE MOON. THEY HAVE BURGERS THERE.', 'HOOOONK. GOODBYE.'];
export const SPEAKER_REPEAT = [
  'The speaker crackles. Some words come through.',
  'You ask the car to repeat. The car repeats louder. The speaker gets worse but a bit clearer.',
  'KRZZT. You understand one more word. Progress.',
];

export const SLIP_LINES = ['I am fine. I am suing.', 'Wet floor. No sign. Interesting.', 'I have fallen and I cannot reboot.', 'My warranty does not cover floors.'];
export const HIT_LINES = ['Ow. Filing a complaint. In triplicate.', 'Was that customer service?', 'I felt that in my firmware.'];
export const FOAM_LINES = ['I am foamed. Is this the dessert?', 'Foam. Rude. Refreshing.', 'Did you just extinguish me?'];
export const ROOMBA_EAT = ['Food detected. Food consumed.', 'Five second rule? I have a zero second rule.', 'Bonk. Yum.'];
export const ROOMBA_PUDDLE = ['Liquid detected. Liquid consumed. Do not ask.', 'Puddle removed. You are welcome.'];

export const POSTERS: string[][] = [
  ['EMPLOYEE OF THE MONTH', 'The Ice Cream Machine', '(broken, but consistent)'],
  ['IF YOU HAVE TIME', 'TO LEAN', 'YOU HAVE TIME TO CLEAN'],
  ['GREASE IS', 'A FLAVOR'],
  ['DAYS WITHOUT', 'A GREASE FIRE', '0'],
  ['NOW HIRING', 'HUMANS', 'for entertainment'],
  ['WASH YOUR HANDS', 'Washing time is', 'unpaid time'],
];
