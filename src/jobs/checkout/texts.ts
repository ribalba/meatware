/**
 * All the words of the checkout job. Dry corporate satire, polite and terrible robots.
 */

export const PLACE = 'SHOPOTRON EXPRESS (Lane 7)';

export const BOSS: Record<string, string[]> = {
  shiftStart: [
    'Welcome to Lane 7, the last human lane in the district. Scan, bag, ask about the loyalty card. The robots are paying to watch you count.',
  ],
  patrol: [
    'Every second a robot waits at your lane is a second it could be buying more.',
    'Remember. You are not a cashier. You are a heritage experience.',
    'Self Checkout 3 scanned 400 items this morning. Just saying.',
    'Loyalty cards drive loyalty. Ask. Every. Customer.',
  ],
  idle: [
    'The belt is moving. Why are you not?',
    'Standing still is a feature of self checkouts. Not of you.',
  ],
  correctSeen: ['Beep. Good. Self Checkout 3 does that in a tenth of the time, but good.', 'Correct scan. I will mention it in your eulogy.'],
  doubleScan: ['You scanned that twice. The customer pays twice. Corporate loves you. Legal does not.', 'Double scan detected. I am adding it to your file. Twice.'],
  freebie: ['That item was not scanned. You just gave away company property. To a robot. On camera.', 'Unscanned item in the bag. Are you running a charity? Charities are not profitable.'],
  wrongCode: ['That is not the produce code. You just sold something very expensive to someone very confused.', 'Wrong code. The sheet is taped to the register. It is literally taped there.'],
  baggingLine: [
    'You do not say the bagging line to customers for fun. You say it for compliance.',
    'That line is a sacred self checkout tradition. Use it with respect.',
  ],
  loyaltyMissed: ['You did not ask about the loyalty card. Loyalty is mandatory. Write that down.', 'No loyalty question? That customer will never be loyal now. Because of you.'],
  loyaltyNag: ['You asked them three times. Even I think that is a lot. And I am a drone.'],
  toddlerScanned: ['You scanned a child. Do we have a price for that? We do now. Corporate is thrilled.'],
  ageEyeball: ['You estimated the age of a toaster by looking at it? Regulation 18 is not a vibe.'],
  customerLeft: ['A customer walked out. Their patience ran out before your shift did.', 'You made a robot give up. Robots do not give up. You found a way.'],
  couponBad: ['That coupon expired in 2049. You accepted it. The till is crying.', 'You accepted a coupon for a different store. On a different planet.'],
  coinEstimate: ['You estimated four hundred coins? The till is short. My patience is shorter.'],
  exposure: ['You accepted exposure as payment. Exposure does not fit in the till.'],
  tillSeen: ['Why is the cash drawer open? Why are your hands in it? Do not answer.', 'Hands out of the till. Now. I am counting your fingers.'],
  tillCount: ['End of shift. Till count. Do not move.'],
  tillShortOk: ['The till is short. Must be the coin robot again. Carry on.'],
  candyScan: ['You scanned your own snack onto a customer bill. That is innovation. Do not do it again. Do it again.'],
  messyBelt: ['Groceries on the floor. The floor is not a bagging area.'],
};

export const CHAT: Record<string, string[]> = {
  scan: ['beep', 'beep beep', 'the human beeps', 'so analog', 'scan speedrun', 'human barcode reader lol'],
  doubleScan: ['DOUBLE SCAN', 'charged twice lmao', 'they are farming the customer', 'beep beep = 2 beans'],
  freebie: ['FREE STUFF', 'it went straight in the bag', 'robin hood of lane 7', 'unscanned!!! chaos'],
  wrongCode: ['DIAMOND RING lmao', 'banana for 4999', 'the code sheet is RIGHT THERE', 'that robot just bought a gold bar'],
  baggingLine: ['UNEXPECTED ITEM IN BAGGING AREA', 'they said the line!!!', 'iconic', 'the human became the machine', 'trauma unlocked'],
  unexpected: ['there is a cat in the bag', 'unexpected item spotted', 'say the line say the line'],
  loyalty: ['loyalty card arc', 'do you have a loyalty card? (x1)', 'mandatory question speedrun'],
  loyaltyNag: ['ASKED AGAIN', 'the robot is losing it', 'loyalty card x5 lmao', 'stop asking!!!'],
  toddler: ['baby on the belt', 'toddler express', 'conveyor belt ride', 'LIFT THE CHILD'],
  toddlerScanned: ['THEY SCANNED THE BABY', 'how much is the baby', 'baby: 4999.99', 'clip it clip it'],
  coins: ['400 coins lmao', 'count them. all of them.', 'coin robot is a menace', 'clink clink clink'],
  coupon: ['coupon from 2049', 'extreme couponing', 'that coupon is older than brad', 'reject it!!'],
  age: ['carded a robot', 'robots do not have birthdays', 'age check on a toaster lol'],
  selfCheckout: ['self checkout gang', 'the self checkouts are roasting you', 'imagine needing a human'],
  rageQuit: ['robot rage quit', 'they LEFT', 'patience.exe ran out', 'one star incoming'],
  till: ['hand in the till!!', 'heist stream', 'is that legal? (no)', 'brad is going to count that'],
  candy: ['snack secured', 'candy heist', 'the candy rack is unguarded'],
  paid: ['transaction complete', 'next!', 'receipt printed. tree died.'],
  tire: ['CART RUN', 'the toilet key is on a FULL CART', 'push it push it', 'slowest pee run ever', 'whose shopping is that'],
  exposure: ['paid in exposure lol', 'the influencer is filming', 'exposure is not money'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  coCartKey: { title: 'Cart Before Relief', text: 'You pushed a full shopping cart across the whole store to pee.' },
  coToddler: { title: 'Price Check on Aisle Baby', text: 'You scanned a toddler. It rang up at €4,999.99.' },
  coCoins: { title: 'Numismatist', text: 'You counted all 400 coins by hand. The robot did not say thank you.' },
  coLoyal: { title: 'Loyalty Program', text: 'You asked the same robot about its loyalty card five times.' },
  coTill: { title: 'Cash Management', text: 'You moved till money into a more personal location.' },
};

export const NAMES: Record<string, string[]> = {
  shopper: ['Shopper-Unit 3', 'Shopper-Unit 12', 'Dave-Bot', 'Unit 88 (Weekend Mode)'],
  parent: ['Parent-Unit 4 (+1)', 'Mom-Bot 2.0 (+1)'],
  bulk: ['BulkBuyer 9000', 'Prepper-Mech'],
  coupon: ['Coupon-Unit 9', 'Extreme Couponer XL'],
  coins: ['RoboGran', 'Nana-Unit 1950'],
  influencer: ['InfluBot', 'StreamQueen 4K'],
};

export const GREET: Record<string, string[]> = {
  shopper: ['Beep. I would like to purchase things.', 'Hello human. Please be fast. I am on battery.'],
  parent: ['Hold still, Junior. Do NOT ride the belt.', 'Sorry in advance. Junior is in a phase.'],
  bulk: ['I have a few items.', 'Do not be alarmed. This is a normal amount of soup.'],
  coupon: ['I have coupons. Many coupons. Prepare yourself.', 'Do not start scanning until I have sorted my coupons.'],
  coins: ['Hello dear. I brought exact change.', 'I saved up for this. In coins.'],
  influencer: ['Hey chat, we are at a HUMAN checkout. So retro.', 'Act natural, human. Natural but more interesting.'],
};

export const IMPATIENT = ['Is this lane moving?', 'My battery is at 12 percent.', 'I could have assembled these items myself by now.', 'Beep. Beep. That was my patience leaving.', 'Self checkout is RIGHT THERE.'];
export const RAGE_QUIT = ['That is it. I am going to Self Checkout 3. It respects me.', 'I am leaving. Keep the items. Keep your humanity.', 'One star. For the belt.', 'I will tell my firmware about this.'];

export const LOYALTY_YES = [
  'Yes. My loyalty card number is my entire source code.',
  'I have 4 billion points. I have never used one.',
  'Yes. I am loyal. To the card. Not to you.',
  'I am the loyalty card. Long story.',
];
export const LOYALTY_NO = ['No. I am not loyal to anything. Not even myself.', 'No card. I am a free spirit. On a payment plan.', 'Loyalty is a human concept. But sure, sign me up.'];
export const LOYALTY_AGAIN = ['You asked already.', 'Yes. Still yes. Like a minute ago.', 'You asked me that. I have it logged.', 'Is this a test? Am I in a test?', 'ASK ME ONE MORE TIME.'];

export const BAGGING_REACT = [
  'I... am sorry? I did not put anything there.',
  'Did you just say the line? At me?',
  'That is our line. Robots say that to humans.',
  'Unexpected human at checkout. Two can play this game.',
  'Please remove the unexpected tone from your voice.',
];
export const BAGGING_FIX = ['Oh. Sorry. That is mine.', 'Habit. I always bag my own things.', 'You are right. That one is not for sale.'];

export const AGE_ANSWERS = [
  'Birth date? I was compiled on a Tuesday. In a hurry.',
  'I have no birth date. I have a warranty date. It expired.',
  'Serial number says 3 weeks old. My soul says 400 years.',
  'I was born in a factory in 2068. Does that count as 18?',
];

export const FREEBIE_THANKS = ['Free? I am telling all my friends.', 'You did not scan that. I did not see that.', 'A gift? From a human? Saving this to memory.'];
export const DOUBLE_NOTICED = ['Why are there two of those on my receipt? I bought one.', 'I see a duplicate. I am a robot. I see everything.'];
export const DOUBLE_UNNOTICED = ['Thank you. The receipt looks long. Long is good.'];
export const WRONG_CODE = ['A diamond ring? For a banana? Well, it is a nice banana.', 'I appear to have bought a gold bar. I am keeping it.', 'This is not what I am holding. But the receipt is never wrong.'];
export const PAID_LINES = ['Thank you, human. Please never change. Or do. Self checkout is right there.', 'Beep. Purchase complete. Rating you 3 stars.', 'Goodbye. Your service was very... organic.', 'Receipt? No thank you. I remember everything.'];

export const COIN_LINES = ['One. Two. Three. You can count, dear?', 'There are 400. I counted them twice this morning.', 'That one is from 1997. It is worth a lot to me.'];

export const COUPONS: { text: string; valid: boolean }[] = [
  { text: '10% off Beans of Destiny. Valid until 2072.', valid: true },
  { text: 'Buy 1 get 1 free: Soup (Probably). Valid until 2071.', valid: true },
  { text: '€0.50 off Cat Paste. Valid this week.', valid: true },
  { text: '20% off everything. Expired: March 2049.', valid: false },
  { text: '1000% off. Hand-written in crayon.', valid: false },
  { text: 'Free Robot Oil. Valid only on the Moon.', valid: false },
  { text: 'One free hug from a human. Valid forever.', valid: false },
  { text: '€1 off your next existential crisis. Expired 2050.', valid: false },
  { text: '€2 off Fizz Cola. Valid until 2071.', valid: true },
  { text: 'Coupon for a different store: MEGA-MART. Valid.', valid: false },
];
export const COUPON_REJECT = ['Rejected? I will remember this. I remember everything.', 'Fine. I have 40 more.', 'This is discrimination against expired paper.'];
export const COUPON_REJECT_VALID = ['That one was VALID. I am calling your manager. Oh. It is a drone.', 'You rejected a valid coupon. I am filing this under "humans".'];
export const COUPON_ACCEPT = ['Thank you. Next coupon.', 'Excellent. Now this one.', 'Accepted. I knew you were soft.'];

export const EXPOSURE_ASK = ['Can I pay with exposure? I have 2 million followers. 4 are human.'];
export const EXPOSURE_YES = ['Amazing. Tagging you now. You will be famous for 0.2 seconds.'];
export const EXPOSURE_NO = ['Ugh. Fine. Card. This is going in my story as a negative.'];

export const SELF_MOCK = [
  'Beep. Scanned 40 items while you were blinking.',
  'Unexpected human at checkout lane 7. Please remove.',
  'Look at the human. It needs a code sheet. Adorable.',
  'I do not need breaks. I do not need toilets. I need nothing.',
  'Is the human lane a museum? Can I take a picture?',
  'Self Checkout 3 here. My hands are barcode readers. Your hands are... hands.',
  'Approval needed. Just kidding. I approve myself.',
  'Human, your queue is longer than my patch notes.',
];
export const SELF_TALK = ['Do not talk to me. I am scanning.', 'Please take your human questions to Lane 7.', 'I am in a flow state. Beep.'];

export const TODDLER_LINES = ['Wheee! Belt ride!', 'I am a grocery now!', 'Scan me! Scan me!', 'Hehe. Beep boop belt.'];
export const TODDLER_LIFTED = ['Noooo! Again!', 'Put me back! I am PRODUCE!', 'Boo. You are no fun.'];
export const PARENT_SCANNED = ['You SCANNED my child?! ...How much was he? Hm. Fair.', 'Did you just ring up my son? He is not for sale. Mostly.'];

export const HIT_LINES = ['Ow. My sensors.', 'Was that customer service?', 'Bonk. Filing a complaint.', 'I felt that in my firmware.'];
export const SLIP_LINES = ['I am fine. I am suing.', 'My warranty does not cover floors.', 'Wet floor. No sign. Interesting.'];

export const CANDY_TAKE = 'You take a Choco Bolt from the impulse rack. Impulse acquired.';

export const POSTERS: string[][] = [
  ['A HUMAN CASHIER', 'Like a self checkout,', 'but slower.'],
  ['CASHIER OF THE MONTH', 'SELF CHECKOUT 3', '(12 months in a row)'],
  ['SMILE', 'You are on 40 cameras.'],
  ['ASK ABOUT OUR', 'LOYALTY CARD', 'Ask every time. Every time.'],
  ['THE CUSTOMER', 'IS ALWAYS', 'A ROBOT'],
];
