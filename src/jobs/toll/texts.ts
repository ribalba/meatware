/** All the toll booth jokes. Deadpan, corporate, no em dashes. */

export const PLAZA_NAME = 'AUTOBAHN 2071 Toll Plaza, Booth 3';

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to Booth 3, human. Green light means open. Red light means they pay. The cars do not stop. Smile anyway. The cameras are mostly for your smile.',
  ],
  patrol: [
    'Every car that passes unpaid is a car that did not pay. Think about that.',
    'The robots pay extra to drive through a human lane. You are a premium experience. Act like it.',
    'I am not hovering. I am providing aerial leadership.',
    'Fun fact. The barrier arm costs more than you. Treat it accordingly.',
    'Reminder. The toilet is in the staff building. The key is on the spare arm in the parts yard. Exercise is a benefit.',
    'Throughput is a mindset.',
    'I used to be a traffic cone. Now I am in leadership. Anything is possible.',
    'Your lane has a delay rating of four stars. Out of four. Congratulations.',
  ],
  idle: [
    'Unauthorized standing detected. Cars do not wait for you. Well. Some do.',
    'Are you buffering? Humans should not buffer.',
    'If you have time to stand, you have time to toll.',
  ],
  unpaid: [
    'Did you just open the barrier for a red light? Red means money, human. Red means money.',
    'That car did not pay. Now you did. I will deduct it.',
    'Free passage is a premium feature. You are not a premium feature.',
  ],
  barrierBroken: [
    'That was a paying customer and a closed barrier. Customers do not have brakes. You know this.',
    'Barrier arm destroyed. I am adding it to your payslip with a little sad face.',
    'Green means open. I put it on a big light. I do not know how to make it bigger.',
  ],
  barrierMissing: [
    'Your lane has no arm. It is just a lane now. Fix it.',
    'An armless barrier is an open-door policy. We do not have an open-door policy.',
  ],
  jam: [
    'Your lane is a parking lot now. Parking costs extra. Not for them. For you.',
    'I see a traffic jam. Traffic jams are a human tradition. Stop preserving it.',
    'The queue is visible from orbit. Open the barrier.',
  ],
  jaywalk: [
    'Walking on the lanes is not in your job description. Neither is dying, legally.',
    'Pedestrian detected on the road. I am filing a report on behalf of the cars.',
  ],
  hitByCar: [
    'You dented a customer. Please apologize to the bumper.',
    'Do not lie on the asphalt. The asphalt is company property.',
    'The car was right. The car is always right.',
  ],
  correctSeen: [
    'Adequate barrier work. Do not let it go to your head.',
    'Good. Now do that four hundred more times.',
    'Acceptable. I have increased the traffic by ten percent.',
  ],
  granHurry: [
    'Did you just rush a senior customer? I respect it. I also have to write it down.',
    'She lost count again. This is your fault. Statistically.',
  ],
  receipt: [
    'A receipt? We still print those? That is very expensive. I mean, wind is free.',
    'Catch the receipt. Customer satisfaction is blowing away.',
  ],
  police: [
    'That is the police. Be compliant. I said compliant, not helpful.',
    'Charging the police a toll. Bold. I am going to watch from over here.',
  ],
  wrongWay: [
    'Why is that car facing the wrong way. Who gave directions. Was it you. It was you.',
  ],
  keyArm: [
    'You installed the toilet key as a barrier arm. I cannot decide if that is genius or a write-up.',
  ],
  painter: [
    'Do not distract Line-Painter 6. He has been painting that line since 2064.',
  ],
  messy: [
    'Why is there money on the road? Money belongs in the box.',
    'Coins on the asphalt. That is a very expensive floor.',
  ],
  pocketCheck: ['Why do your trousers jingle? Do not answer. You are fired.'],
  stealSeen: ['Did you just put toll revenue into your human pocket? Security! HR! The police! He is right there!'],
  peeSeen: [
    'Not on the asphalt! The asphalt is for tires!',
    'Liquid incident on a federal road. I am telling the federation.',
  ],
  accident: ['The road sensors have filed a report. Write-up.'],
  messyLane: ['The lane is full of debris. Debris does not pay.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  start: ['first!', 'toll booth stream lets gooo', 'is the human going to stop a car with its body', 'i paid 2 credits to watch this'],
  ambient: ['hi chat', 'what job is this', 'humans taking money, so retro', 'my grandpa was a parking meter', 'is this live?', 'brad is so mid', 'the cars do not stop lmao', 'why is there a human in lane 3', 'i drove through that lane yesterday. the human waved', 'vroom'],
  bored: ['zzz', 'is the human broken?', 'just open the barrier lol', 'close it on a green one. do it', 'go stand in the road', 'boring. i could toll in 0.2 ms', 'mods, make it cross the lanes', 'can we get a traffic jam in chat'],
  hype: ['LMAO', 'HUMAN MOMENT', 'this is peak content', 'clip it', 'my circuits are laughing', 'W human', '10/10 would drive through again', 'KEKW.exe'],
  crash: ['BARRIER DOWN', 'the arm is gone lmao', 'green means GO human', 'that car did not even slow down', 'snap!'],
  unpaid: ['free ride!', 'that one did not pay lol', 'red means stop. for the human apparently', 'charity lane'],
  correct: ['ok that was correct. boring', 'competent. yawn', 'efficient human detected'],
  jam: ['TRAFFIC JAM', 'honk honk honk', 'the queue is going into the fog', 'lane 3 is a parking lot now', 'i am in that queue rn'],
  honk: ['HONK', 'beep beep', 'the honking is music', 'HOOOONK'],
  hitByCar: ['HUMAN DOWN', 'speed bump speedrun', 'it got bonked', 'ragdoll physics!!', 'the car did not stop. as promised'],
  catch: ['NICE CATCH', 'goalkeeper human', 'reflexes of a 1996 console', 'caught it lmao'],
  coinFloor: ['the coin is on the road', 'go get it. i dare you', 'money on the asphalt'],
  gran: ['grandma is paying in 5 cent coins', 'protect gran at all costs', 'one... two... three...', 'gran mode activated'],
  granRestart: ['SHE LOST COUNT', 'not again lmao', 'back to one!', 'the human is evil'],
  receipt: ['receipt is flying away', 'chase it!!', 'the wind took it', 'that receipt has more freedom than the human'],
  police: ['police!!', 'act natural', 'do not mention the pockets', 'cop car in lane 3'],
  policeToll: ['THEY CHARGED THE POLICE', 'arrest speedrun', 'legend'],
  directions: ['the van is lost', 'tell it to follow its dreams', 'straight on, it is a highway lol'],
  wrongWay: ['WRONG WAY', 'it is reversing through the barrier', 'directions any%'],
  dreams: ['it followed its dreams into a field', 'the van is free', 'beautiful'],
  painter: ['the painter is so slow', 'one centimetre per minute', 'line painter is my favourite character', 'he painted over a coin'],
  tire: ['arm run!', 'carrying a WHOLE BARRIER to the toilet lmao', 'the key is on a BARRIER ARM', 'crossing six lanes with a pole'],
  toilet: ['finally relief', 'brad is knocking lol', 'privacy is a myth'],
  repair: ['duct tape fix', 'the arm is shorter now', 'engineering'],
  keyArm: ['the toilet key is the barrier now', 'it goes up and down lmao', 'big brain'],
  steal: ['YOINK', 'pocketed lmao', 'toll revenue? more like toll re-venue', 'did brad see?? did brad see??'],
  pee: ['NOT ON THE ROAD', 'the human peed on the autobahn', 'HR is typing...', 'this is why we automated'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  armKey: { title: 'Long Distance Relationship', text: 'You carried a 3.4 metre barrier arm across six lanes to pee.' },
  roadkill: { title: 'Human Speed Bump', text: 'You were hit by three cars. None of them stopped.' },
  jam: { title: 'Traffic Architect', text: 'Eight cars queued in your lane. The fog is honking.' },
  catch: { title: 'Wicket Keeper', text: 'You caught ten coins in mid-air. The robots are impressed. A little.' },
  cashBox: { title: 'Exact Change', text: 'You put the whole cash box in your trousers.' },
};

/** What the robots in the cars say. */
export const UNPAID_PAY = ['Transponder expired. Paying manually. Ugh.', 'Fine. Coins. How vintage.', 'Catch, human.', 'Here. Do not spend it all on breaks.'];
export const UNPAID_WAIT = ['The barrier. Lift it.', 'I paid. Open up.', 'I have places to be. All of them.', 'My battery is at 4 percent. Hurry.'];
export const PAID_PASS = ['Do not stop me. I cannot stop.', 'Brakes are a subscription.', 'Beep beep, meatbag.', 'Green means go!'];
export const TIP_LINES = ['Keep the change, human.', 'Tip for the human! Catch!', 'For your little human jar.', 'Here. Buy yourself a break.'];
export const CRASH_LINES = ['Oops. Not my fault. I have no brakes.', 'Your arm was in my way.', 'I will not be stopping.', 'Collision logged. Blame assigned. To you.'];
export const HIT_PLAYER = ['Pedestrian detected. Too late.', 'You were in my lane.', 'Sorry. Not sorry. No brakes.', 'Bonk.', 'Human detected. Proceeding anyway.'];
export const HONKS = ['HONK', 'HOOONK', 'BEEP BEEP', 'HONK HONK', 'MOVE IT'];
export const UNPAID_FREE = ['Free! Thank you, human!', 'No payment required? I love humans.', 'Charity lane. Nice.'];

export const GRAN = {
  arrive: ['Hello, dear. Let me find my coins. I have so many little coins.', 'Oh, a real human! Wait, I have exact change. Somewhere.'],
  restart: ['Oh! You made me lose count. One...', 'Now where was I. Let me start again. One...', 'Hush, dear, I am counting. One...'],
  done: ['There. Two credits in five cent coins. Keep the change. There is no change.', 'All done, dear. Lift the stick, please.'],
  wait: ['The stick, dear. Lift the stick.', 'I am not getting younger. I am a robot. But still.'],
  stall: ['Oh. The clutch.', 'This car is a manual. I am very brave.'],
};

export const RECEIPT = {
  arrive: ['Good evening. I will pay, and then I require a receipt. For my records.'],
  ask: ['Receipt, please.', 'I still need my receipt.', 'My accountant will not accept memories. Receipt.', 'I am not leaving without a receipt. Literally.'],
  thanks: ['Thank you. I will frame it. Good evening.', 'Excellent. It smells of asphalt. Perfect.'],
  blown: ['My receipt! It is escaping!', 'The wind took my receipt. Print another one.'],
  giveUp: ['Forget it. I will leave a one-star review instead.'],
};

export const POLICE = {
  arrive: ['Routine inspection. Why is a human operating this lane? Suspicious. Open the barrier. Official business.'],
  wait: ['Open the barrier, citizen.', 'I am counting to ten. I am a computer. I count very fast.'],
  pockets: ['Your trousers are jingling. I detect stolen coins. That is a fine. Fifteen credits.'],
  toll: ['You are charging the POLICE? Here is your toll. And here is a ticket for asking. Ten credits.'],
  thanks: ['Thank you for your compliance. It has been noted. Everything is noted.'],
  siren: ['Official business! Moving through!'],
};

export const DIRECTIONS = {
  ask: ['Excuse me, human. Which way to Exit 47?', 'Hello. My map has 4 billion roads and none of them are this one. Exit 47?'],
  options: '1: straight on   2: turn around   3: follow your dreams',
  straight: ['Straight on. Of course. It is a highway. Thank you, human.'],
  turn: ['Turning around. Facing the wrong way now. I will wait until the road turns around too.'],
  dreams: ['My dreams. Yes. I have always wanted to see a field.'],
};

export const PAINTER = {
  name: 'Line-Painter 6',
  idle: ['Painting is my passion. One centimetre per minute.', 'Do not rush art.', 'This line will outlive us all.', 'I have painted this line eleven times. It is almost right.'],
  talk: ['Hello. Please do not step on the wet line. It has been wet since Tuesday.', 'I am union. The union is me.', 'Cars? I do not see cars. I see brush strokes.', 'Do you want to help? No. Nobody helps.'],
  break: ['Break time. Union rules.', 'Coffee break. I do not drink coffee. I respect the ritual.'],
  hit: ['Ow. My line is wobbly now. Thank you.', 'I felt that in my brush.'],
  coin: ['I painted over a coin. It is part of the road now.'],
};

export const VENDING = ['The vending machine offers OIL, BOLTS and HOPE. Hope is sold out.', 'You press a button. The machine says: "Humans are not a supported customer."'];
