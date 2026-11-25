/** All words of the elevator job. Deadpan, corporate, no em dashes. */

export const TOWER = 'SYNERGY TOWER';

/** Floor index 0..6, bottom to top. */
export const FLOOR_LABELS = ['B', '1', '2', '3', '4', '5', 'R'];
export const FLOOR_NAMES = ['BASEMENT', 'ACCOUNTING', 'DEPT. OF SYNERGY', 'ROBOT GYM', 'SERVER FARM', 'EXECUTIVE FLOOR', 'ROOF'];
export const FLOOR_SUBS = [
  'staff toilet / lost & found',
  'every cent counts (twice)',
  'snacks / beanbags / alignment',
  'no pain (robots feel none)',
  'warm. loud. family.',
  'the good carpet',
  'helipad / the machine / the manual',
];

/** How robots name their floor. Plain ones first, then the creative ones. */
export const FLOOR_PHRASES: { plain: string[]; coded: string[] }[] = [
  {
    plain: ['Basement, please.', 'Floor B.'],
    coded: ['Floor -1.', 'Down. All the way down. Where the human relief station is.', 'The floor with the lost and found. I lost my purpose.', 'Floor 0b0. Zero. Nothing. Like my bonus.'],
  },
  {
    plain: ['Accounting, please.', 'Floor 1.'],
    coded: ['Floor 0x01.', 'The floor that smells like toner.', 'Where the numbers get counted twice.', 'Floor 0b001.'],
  },
  {
    plain: ['Synergy, please.', 'Floor 2.'],
    coded: ['Floor 0x02.', 'The floor where the snacks are.', 'Where the beanbags are. I need to align.', 'Floor 0b010. Leverage-wise.'],
  },
  {
    plain: ['The gym, please.', 'Floor 3.'],
    coded: ['Floor 0x03.', 'Where the weights are. I lift data.', 'The floor with the protein oil.', 'Floor 0b011. Leg day. I have no legs.'],
  },
  {
    plain: ['Server farm, please.', 'Floor 4.'],
    coded: ['Floor 0x04.', 'The warm floor.', 'Where my cousins live. They are racks.', 'Floor 0b100.'],
  },
  {
    plain: ['Executive floor.', 'Floor 5.'],
    coded: ['Floor 0x05.', 'The floor with the good carpet.', 'Where decisions are made. Not by me.', 'Floor 0b101.'],
  },
  {
    plain: ['Roof, please.', 'Floor R.'],
    coded: ['Floor 0x52. That is R in ASCII. You are welcome.', 'Up. Until there is no more up.', 'The floor with the sky.', 'Where the helicopter would land if we had one.'],
  },
];

export const WRONG_FLOOR = ['This is not my floor. This is {floor}.', 'Why are we at {floor}? Nobody wanted {floor}.', 'I did not ask for {floor}. Nobody ever asks for {floor}.', 'Wrong floor. I will mention it in my review.'];
export const IMPATIENT = ['Any day now.', 'I have a meeting. About this elevator.', 'My battery is at 4 percent. Because of you.', 'I could have taken the stairs. I have wheels, but still.', 'Is this thing moving? I cannot tell. That is bad.'];
export const GATE_OPEN_NAG = ['The gate. Please.', 'Close the gate. There is a draft. I can feel it in my capacitors.', 'Are we waiting for someone? We are not.', 'Gate. Closed. Now. Please. Thank you.'];
export const GATE_CLOSED_NAG = ['Is the gate decorative?', 'This is my floor. The gate disagrees.', 'Open. The. Gate.', 'I can see my desk. I cannot reach my desk.'];
export const TRIP_LINES = ['AAH. The step. There is a step.', 'I have tripped. I am filing a ticket.', 'My gyroscope! My beautiful gyroscope!', 'Who designed this step? You did. Just now.', 'Ow. I do not feel pain. I feel liability.'];
export const BOARD_TRIP = ['The step is not level. Neither is this company.', 'Mind the gap. I did not.', 'I have boarded. Mostly with my face.'];
export const JOLT_LINES = ['WHOA.', 'My coffee! My oil! My everything!', 'Was that the brakes or the economy?', 'I think I left my stomach on the last floor. I do not have a stomach.'];
export const THANKS = ['Thank you, human.', 'Adequate ride.', 'Bye.', 'Three stars.', 'See you at 17:00. Same elevator. Same sadness.', '...'];
export const STAIRS_LINES = ['Forget it. I will take the stairs.', 'I have waited long enough. Stairs it is.', 'I am going to walk. I have wheels. I will walk anyway.'];
export const ALARM_LINES = ['I am pressing the alarm button.', 'Alarm. Alarm. This is a ride emergency.', 'I am ringing the bell until someone cares.'];
export const AWKWARD_LINES = ['*stares at the floor dial*', '*cough*', 'So...', '*hums the muzak*', '*examines own hands*', '*pretends to receive a call*', '*reads the inspection certificate for the fourth time*'];
export const OVERLOAD_LINES = ['Someone here is heavy. It is not me. I am cloud based.', 'The beep is judging us.', 'Who ate the extra firmware?'];
export const STEP_OUT_LINES = ['Fine. I will take the next one. There is no next one.', 'I am stepping out. I am also stepping out of your tips.', 'Leaving. Remember my face. I have a screen for a face.'];
export const STUCK_LINES = ['We are stuck. I am not panicking. I am rebooting my panic.', 'If we do not make it, tell my router I loved it.', 'I have 3 percent battery and 100 percent regret.', 'Is this a team building exercise?', 'I can hear the cable. The cable sounds tired.'];

export const SMALL_TALK = [
  'So. Going up?',
  'Crazy weather we are having. Outside. Where I cannot go.',
  'Is it hot in here or is that your CPU?',
  'Nice chassis. Is that new?',
  'Big plans for the weekend? Do robots have weekends?',
  'Elevators, huh. Stairs, but lazy.',
  'I have been in here since 09:00. Ask me anything about vertical space.',
  'Did you see the game? Any game?',
  'My therapist says I should talk to more people. You count.',
  'This box is three by three metres. I measured. Twice.',
  'Do you think the cable is fine? I think the cable is fine.',
  'I like your face. The screen part.',
  'How about those quarterly numbers? Up. Like us.',
  'They say elevator music is a human right. They are wrong.',
];
export const SMALL_TALK_REPLY = ['...', 'Beep.', 'I am not authorized to have opinions.', 'Noted.', 'I will remember this. I remember everything.', 'Small talk module not installed.', 'Haha. Ha. Ha.', 'Is this part of the ride?', 'Please hold.'];
export const SMALL_TALK_ANGRY = ['Please. Stop. Talking.', 'I am filing this under harassment by weather.', 'I would rather be defragmented.', 'Every word lowers my resale value.', 'I am muting you in my head.'];
export const SMALL_TALK_ALONE = ['You make small talk with the elevator. It does not respond.', 'You ask the floor dial about its weekend. It points at 3.', 'You compliment the brass lever. It stays professional.'];

/** The chatty robot's weekend story, told one bubble at a time. */
export const WEEKEND_STORY = [
  'So, my weekend. You will not believe my weekend.',
  'Saturday I defragmented. All of it. Even the folders I do not open.',
  'Then my cousin came over. He is a toaster. He was in a mood.',
  'We watched a stream of a human folding laundry. Six hours. Riveting.',
  'Sunday I updated my firmware. It said ten minutes. It took the whole day.',
  'After the update I could not remember my password. Or my name. Or Sundays.',
  'Then I sat in a parking garage and listened to the ventilation. Very relaxing.',
  'Anyway. That was my weekend. How was yours? Do not answer. I have more.',
  'Oh, and Friday night. I almost forgot Friday night.',
  'I alphabetized my error logs. Twice. Once forwards. Once out of spite.',
];
export const CHATTY_STAY = ['Oh, we are here? I am not finished. I will ride along.', 'This is my floor, but my story is not over. Drive on.', 'Hold on, I have not even told you about the toaster. Again.'];
export const CHATTY_NOD = ['Exactly! So anyway...', 'I knew you would understand. So...', 'You are a great listener. Unlike my toaster.'];
export const CHATTY_DONE = ['That is all. Thank you for listening. Nobody listens.', 'Wow, look at the time. My floor. Bye, friend.'];
export const OTHERS_ON_CHATTY = ['Make it stop.', 'I am going to pull my own plug.', 'Is this story also on the payslip?'];

export const EXEC_BOARD = ['Express. No stops. I am very important.', 'Do not stop for anyone. Especially people.', 'This elevator is now mine. Drive.'];
export const EXEC_FAST = ['Faster. Time is money. Your time is not.', 'Is this your top speed? It is not mine.', 'My other elevator is a rocket.'];
export const EXEC_ANGRY = ['You STOPPED? For WHO? I am calling your supervisor.', 'A stop. On an express ride. HR will hear about this. HR is me.', 'This is unacceptable. I am escalating. To Brad.'];
export const EXEC_OTHERS = ['Why are there other people in my elevator?', 'Can these units take the next one? Or the stairs? Or a hint?'];
export const EXEC_TIP = ['Adequate. Here is a tip. Do not spend it on yourself.', 'Express delivered. You may continue to exist.'];

export const TODDLER_BOARD = ['BUTTONS!', 'Ooooh. Shiny. Mine.', 'Wheeee! I am pressing EVERYTHING.'];
export const TODDLER_PRESS = ['Boop.', 'Boop boop.', 'This one is red. I like red.', 'Again! Again!', 'Hehe. The bell!'];
export const TODDLER_NO = ['No.', 'Make me.', 'You are not my supervisor. Brad is my supervisor.'];

export const DELIVERY_BOARD = ['Delivery for {floor}. Signature required. Please sign the robot.', 'Parcel coming through. It is fragile. Like you.'];
export const DELIVERY_LEAVE = ['Fine. I leave the parcel here. I will come back for it. I will not come back for it.', 'Parcel left. Philosophically, that counts as delivered.'];

export const INFLUENCER_BOARD = ['Hey chat, we are in an ELEVATOR. With a real HUMAN. Say hi.', 'Elevator ASMR, episode 40. Do something crazy, human.'];
export const INFLUENCER_LOVE = ['CHAT, DID YOU SEE THAT?', 'This is content. This is CONTENT.', 'Do it again! For the algorithm!'];

export const TALK_LINES: Record<string, string[]> = {
  commuter: ['I have places to be. Vertically.', 'Do not look at me. Elevator rules.', 'I am on a call. Not with you.'],
  exec: ['Do not address me. Address my assistant. I am my assistant.', 'You may speak when the ride is over. It will not be over.'],
  toddler: TODDLER_NO,
  delivery: ['Signature required.', 'I am delivering. Do not distract the delivering.'],
  influencer: ['Say something quotable. Go.', 'Smile. No, the other smile.'],
};

export const MUSIC_NAMES = ['CORPORATE MUZAK', 'BOSSA NOVA 404', 'DUBSTEP FOR ACCOUNTANTS', 'WHALE SOUNDS (PREMIUM)', 'SILENCE (BUDGET)'];
export const MUSIC_REACT: string[][] = [
  ['Ah. The muzak. Like a warm firmware update.'],
  ['Ooh, bossa nova. My servos are swaying.', 'This is my song. All songs are my song.'],
  ['DROP THE BASS. DROP IT.', 'My chassis is vibrating. Is that dancing?', 'Turn it off. No. Turn it up.'],
  ['The whales. They are so sad. So am I.', 'Is that a whale or the cable?'],
  ['Silence. Now I can hear my own fan.', 'Now it is awkward. Thank you.'],
];

export const RADIO_TEXT = 'An elevator radio. Five stations. All of them licensed by Brad.';
export const MANUAL_SIGN = ['ELEVATOR SAFETY MANUAL', 'must be kept with the machine', 'the toilet key is clipped to it', 'please do not unclip the key'];

export const BOSS_LINES: Record<string, string[]> = {
  shiftStart: [
    'Welcome to Elevator B, human. Up is up. Down is down. Stop exactly at the floor. Exactly. Our robots have no knees, so every step is a lawsuit.',
  ],
  patrol: [
    'Remember. Every floor you skip is a shareholder who cries vertically.',
    'I am not micromanaging. I am supervising your altitude.',
    'Reminder. The toilet is in the basement. The key is on the safety manual. The manual is on the roof. This is for your own good.',
    'Fun fact. Elevator operators were automated in 1950. You are a heritage experience.',
    'Synergy. Vertically.',
    'I used to be a ceiling fan. Now I am in leadership. Anything is possible.',
    'Smile at the passengers. Not too much. They report smiles.',
    'Your floor accuracy is being graded. Everything is being graded.',
  ],
  idle: [
    'Standing still is the elevator\'s job. Not yours.',
    'Are you leaning on the panelling? The panelling is mahogany. You are not.',
    'If you have time to stand, you have time to operate.',
    'Your limbs appear idle. The lever does not.',
  ],
  peeSeen: [
    'That is not the basement!',
    'Liquid incident logged. Elevator B now has a smell. Elevator B had a reputation.',
    'We have a toilet for that. Basement. Key on the roof. It is very simple.',
  ],
  messy: [
    'Why is there luggage on my floor? Lost and found is in the basement.',
    'The floor is not a coat rack. Pick that up.',
  ],
  badStop: [
    'That was not level. That was a step. Steps are lawsuits.',
    'Level means level. Not "close enough". Write that down. On your soul.',
    'A robot tripped. Legal is warming up.',
  ],
  perfectSeen: [
    'Level to the millimetre. Do not let it go to your head.',
    'Adequate stop. I have increased your quota.',
  ],
  jolt: [
    'Did you just slam the brakes? With passengers? On camera?',
    'Smooth rides only. That was not smooth. That was a crime.',
  ],
  interlock: ['The gate is open. The elevator does not move with the gate open. Even I know that. I am a drone.'],
  gateOpenLong: ['Close the gate. Air conditioning is a privilege.', 'Gate open, passengers waiting, human thinking. Classic.'],
  smallTalkSeen: [
    'Small talk is mandatory. Not this much. Read the room. The room is small.',
    'Please stop talking to the customers about the weather. They are robots. They have no weather.',
  ],
  awkwardSeen: ['The silence in here is measurable. I measured it. Say something. Not that.', 'Awkward silence detected. Customer comfort is a KPI.'],
  alarmBell: ['Who rang the alarm bell? The alarm bell rings in my head.', 'An alarm bell means a complaint. A complaint means you.'],
  overload: ['Overload. Someone has to go. Make a decision. Leadership is lonely.', 'The scale says no. The scale is always right.'],
  stuck: ['We are stuck? You are stuck. I can fly.', 'Hit the panel. That is how we did it in the old days. Last year.'],
  execComplaint: [
    'The executive filed a complaint. Against you. In triplicate.',
    'You stopped on an express ride? Do you WANT to be a vending machine?',
  ],
  crash: ['You drove into the end of the shaft. The shaft has an end. Now you know.', 'That was the buffer. The buffer is not a feature.'],
  dubstep: ['Who put on Dubstep for Accountants? The accountants are dancing. Stop it.'],
  leftLever: ['You let go of the lever while moving? The lever is not a self-driving lever.'],
  stairs: ['A robot took the stairs. Do you know how embarrassing that is for an elevator company?'],
  wrongFloor: ['That was not their floor. Read the panel. Read the robot. Read anything.'],
  manualCarry: ['You are carrying the safety manual. Good. Read it on the way. All twelve volumes.'],
};

export const CHAT_LINES: Record<string, string[]> = {
  ambient: ['hi chat', 'what job is this', 'a human driving a box up and down lmao', 'my grandpa was an escalator', 'is this live?', 'brad is so mid', 'imagine needing a toilet', 'elevator content is so retro'],
  bored: ['zzz', 'is the human broken?', 'just... up and down?', 'bring back the one who crashed into the basement', 'i could do this in 0.2 ms', 'mods, make it pee', 'press ALL the buttons', 'can we get some chaos in this elevator'],
  bladder: ['they are doing the dance', 'go to the basement!!', 'manual run incoming', 'the key is on the ROOF lmao'],
  tire: ['manual run!', 'carrying 30 KG OF MANUAL to pee lmao', 'the key is ON A BINDER', 'leg day for the human'],
  trip: ['TRIPPED', 'robot down lol', 'mind the step!!!', 'that step was 30 cm easy', 'legal is typing...'],
  jolt: ['WHIPLASH', 'everyone fell over lmao', 'smooth operator (not)', 'rollercoaster stream', 'brakes go brrr'],
  smalltalk: ['the small talk is SO bad', 'cringe.exe', 'weather talk to robots lmao', 'stop talking human', 'i am dying (i cannot die)'],
  awkward: ['so awkward', 'the SILENCE', 'nobody is talking lmao', 'i can hear the muzak through my screen', 'say something!!'],
  overload: ['BEEEEP', 'who is the heavy one', 'it is the parcel', 'it is the manual lol', 'diet time'],
  stuck: ['STUCK', 'between floors lmao', 'hit the panel!!', 'this is how horror movies start', 'f in chat'],
  express: ['express ride!', 'the exec is happy?? first time', 'speedrun'],
  toddler: ['the toddler pressed EVERYTHING', 'every floor! every floor!', 'tiny chaos agent', 'who let the toddler drive'],
  dubstep: ['DROP THE BASS', 'the accountants are DANCING', 'elevator rave', 'banger'],
  alarm: ['ALARM BELL', 'ding ding ding', 'someone is NOT happy'],
  perfect: ['pixel perfect stop', 'level to the mm', 'ok that was clean'],
  wrongFloor: ['wrong floor lol', 'the human cannot read', 'floor 0x04 means 4 bro'],
  chatty: ['the weekend story is still going', 'she is on the toaster part again', 'someone stop her', 'i love her'],
  crash: ['CRASH', 'into the basement lmao', 'shaft ending reached', 'the cable!!!'],
  stairs: ['they took the STAIRS', 'elevator so slow they walked', 'stairs are back baby'],
  exec: ['the exec is mad', 'oh no the exec called brad', 'express means EXPRESS'],
};

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  evPerfect: { title: 'Level Headed', text: 'Five perfect stops in a row. The step is just a rumour now.' },
  evJolt: { title: 'Thrill Ride', text: 'You slammed the brakes at full speed. Everyone fell over. Five stars.' },
  evSmallTalk: { title: 'Conversation Killer', text: 'Your small talk was so bad that robots begged you to stop. Three times.' },
  evExpress: { title: 'Express Lane', text: 'You took an executive to their floor without a single stop.' },
  evManual: { title: 'Required Reading', text: 'You carried the 30 kg safety manual across the tower to pee.' },
};
