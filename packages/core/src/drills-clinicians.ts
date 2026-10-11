// DRAFT — pending trainer review
// Clinical drills for the MI for Clinicians pathway. All people and situations
// are fictional. Example responses model MI process, not medical advice.

import type { Drill } from "./types";

export const CLINICIAN_DRILLS: Drill[] = [
  // -------------------------------------------------------------------------
  // OARS
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-oars-01",
    setting: "clinical",
    skill: "oars",
    level: 1,
    context: "A nurse practitioner, with a 34-year-old rideshare driver at an asthma follow-up",
    speaker: "Patient",
    prompt: "I use the blue one when it gets bad. The daily one, honestly, I forget it exists until I see it rolling around in the cup holder.",
    instruction: "Which response is an open question?",
    choices: [
      {
        text: "Are you using the daily one at all?",
        isTarget: false,
        explanation: "This can be answered with yes or no, so it's a closed question. It can also land like a pop quiz.",
      },
      {
        text: "How does the daily one fit, or not fit, into your day?",
        isTarget: true,
        explanation: "This invites him to walk you through his routine in his own words, so you learn where the inhaler drops out.",
      },
      {
        text: "Do you know the daily one is the one that prevents attacks?",
        isTarget: false,
        explanation: "A closed question that's really information in disguise. It tests him instead of exploring with him.",
      },
      {
        text: "So it lives in the cup holder more than in your routine.",
        isTarget: false,
        explanation: "This is a reflection, not a question. It's a useful move, just not the one asked for here.",
      },
    ],
    exampleResponses: ["How does the daily one fit, or not fit, into your day?"],
  },
  {
    id: "drill-cl-oars-02",
    setting: "clinical",
    skill: "oars",
    level: 1,
    context: "A family physician, with a 52-year-old overnight warehouse supervisor who came in about headaches",
    speaker: "Patient",
    prompt:
      "I get home at seven, the house is loud, my phone's going off. I'm lucky if I get four hours. But I'm not taking a sleeping pill. I've seen what that does to people.",
    instruction: "Which response is a complex reflection?",
    choices: [
      {
        text: "You're getting about four hours.",
        isTarget: false,
        explanation: "This repeats his words. It's a simple reflection: accurate, but it doesn't add meaning.",
      },
      {
        text: "You're running on fumes, and whatever helps has to be something you trust.",
        isTarget: true,
        explanation: "This goes past the facts to what's underneath: how worn down he is, and what matters to him about any fix.",
      },
      {
        text: "Have you tried blackout curtains and putting your phone in another room?",
        isTarget: false,
        explanation: "Advice phrased as a question. It jumps to fixing before he feels understood.",
      },
      {
        text: "Sleeping pills aren't the only option, you know.",
        isTarget: false,
        explanation: "It sounds reassuring, but it corrects him. He may spend the next minute defending his point.",
      },
    ],
    exampleResponses: ["You're running on fumes, and whatever helps has to be something you trust."],
  },
  {
    id: "drill-cl-oars-03",
    setting: "clinical",
    skill: "oars",
    level: 1,
    context: "A cardiac rehab nurse, with a 67-year-old retired machinist three weeks after a heart attack",
    speaker: "Patient",
    prompt:
      "I made it to three sessions. Missed Thursday, my knee was killing me. My wife drove me today because she doesn't trust me to come on my own.",
    instruction: "Which response is an affirmation rather than praise?",
    choices: [
      {
        text: "Great job! Keep it up.",
        isTarget: false,
        explanation: "Friendly, but generic. It doesn't name anything specific about him, so it slides right past.",
      },
      {
        text: "Three sessions with a sore knee. You're putting real work into getting your strength back.",
        isTarget: true,
        explanation: "This names a specific effort and what it says about him. It's about his strengths, not your approval.",
      },
      {
        text: "I'm proud of you.",
        isTarget: false,
        explanation: "Warm, but it's about how you feel. An affirmation keeps the spotlight on him.",
      },
      {
        text: "Missing Thursday is okay, as long as it doesn't become a habit.",
        isTarget: false,
        explanation: "This puts the focus on the missed session and adds a quiet warning.",
      },
    ],
    exampleResponses: ["Three sessions with a sore knee. You're putting real work into getting your strength back."],
  },
  {
    id: "drill-cl-oars-04",
    setting: "clinical",
    skill: "oars",
    level: 2,
    context: "A community pharmacist, at the counter with a 59-year-old who hasn't picked up her statin in two months",
    speaker: "Patient",
    prompt:
      "My neighbor said those cholesterol pills wrecked her muscles. And I read online they can give you diabetes. So I've just been kind of... not.",
    instruction: "Respond with a simple reflection. Stay close to her words, and don't correct anything yet.",
    exampleResponses: [
      "You've heard some things that worry you, so you've held off.",
      "Between your neighbor and what you read, you haven't felt good about taking them.",
    ],
  },
  {
    id: "drill-cl-oars-05",
    setting: "clinical",
    skill: "oars",
    level: 3,
    context: "A physical therapist, near the end of a visit with a 72-year-old retired bus driver with knee arthritis",
    speaker: "Patient",
    prompt:
      "So yeah, stairs are the worst, and walking hurts after about ten minutes. My doctor says move more, which, great, thanks. But I miss the walking club. And my granddaughter's getting married in June, and I'd like to dance at it without paying for it for a week.",
    instruction: "Offer a short summary that pulls together what you've heard, including what matters to him.",
    exampleResponses: [
      "Let me make sure I've got it. Stairs and longer walks hurt, and being told to just move more hasn't been much help. You miss the walking club, and you want to dance at your granddaughter's wedding in June and enjoy the week after, too. What did I leave out?",
    ],
  },

  // -------------------------------------------------------------------------
  // Engaging
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-engaging-01",
    setting: "clinical",
    skill: "engaging",
    level: 1,
    context: "A primary care PA, with a 38-year-old who missed his last two follow-ups and arrived late today",
    speaker: "Patient",
    prompt: "Sorry, sorry. The bus never came. I know I'm late, I know I missed the last ones. Are you still going to see me?",
    instruction: "Which opening is most likely to build trust right away?",
    choices: [
      {
        text: "Yes, but we only have about ten minutes now, so let's get right to your blood pressure.",
        isTarget: false,
        explanation: "Honest about time, but it jumps to your agenda. He may hear it as \"you're behind, so get in line.\"",
      },
      {
        text: "I'm glad you made it. Sounds like getting here has been a real hassle. What would be most useful to spend our time on?",
        isTarget: true,
        explanation: "This welcomes him, reflects the hassle without judging, and invites him to help set the agenda.",
      },
      {
        text: "Missing follow-ups makes it hard for me to manage your care.",
        isTarget: false,
        explanation: "It may be true, but leading with it lands as a reprimand before anything else has happened.",
      },
      {
        text: "Did you get our reminder texts?",
        isTarget: false,
        explanation: "A closed question that feels like checking up on him. It keeps the focus on what he did wrong.",
      },
    ],
    exampleResponses: [
      "I'm glad you made it. Sounds like getting here has been a real hassle. What would be most useful to spend our time on?",
    ],
  },
  {
    id: "drill-cl-engaging-02",
    setting: "clinical",
    skill: "engaging",
    level: 2,
    context: "A nurse care coordinator, on the phone with the daughter of an 84-year-old patient just home from the hospital",
    speaker: "Patient's daughter",
    prompt:
      "I've called four times. Four. Nobody told us which of his old pills to stop, and now he's got two bottles of the same thing with different names. I have a job. I can't be his pharmacist too.",
    instruction: "Respond with a reflection of the feeling under the complaint. Don't explain or defend the discharge process yet.",
    exampleResponses: [
      "You've been left to sort this out on your own, and you're scared of getting it wrong for him.",
      "You're doing a lot to keep your dad safe, and it's been exhausting with no one calling you back.",
    ],
  },
  {
    id: "drill-cl-engaging-03",
    setting: "clinical",
    skill: "engaging",
    level: 3,
    context: "A family physician, at a 46-year-old's annual visit, just after she stepped off the scale",
    speaker: "Patient",
    prompt:
      "Go ahead. Every doctor I've ever had gives me the weight speech. I've been on a diet since I was twelve, so whatever you're about to say, I've heard it.",
    instruction:
      "Respond in a way that acknowledges her experience and gives her control over whether weight comes up at all.",
    exampleResponses: [
      "A lot of visits have started with your weight before anything else, and that's been really discouraging. I'd rather hear what matters to you today. If weight is ever something you want to talk about, that's your call.",
      "You've been on the receiving end of a lot of lectures, starting really young. I'm not going to add one. What would make today worth your time?",
    ],
  },

  // -------------------------------------------------------------------------
  // Focusing
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-focusing-01",
    setting: "clinical",
    skill: "focusing",
    level: 1,
    context: "A nurse practitioner, a few minutes into a visit with a 63-year-old with type 2 diabetes",
    speaker: "Patient",
    prompt:
      "And my back's been bad, and I need my refills, and my wife says I snore like a freight train. And I guess you'll want to talk about my sugar.",
    instruction: "Which response sets the agenda together?",
    choices: [
      {
        text: "Let's start with your sugar, since that's the most important.",
        isTarget: false,
        explanation: "You decide for him. Your priority may be valid, but he may tune out if his concerns get skipped.",
      },
      {
        text: "So there's your back, refills, the snoring, and your sugar. We probably can't do all of it well today. Where would you like to start?",
        isTarget: true,
        explanation: "This lays out the map, is honest about time, and lets him choose. You can still add your own priority to the list.",
      },
      {
        text: "Is the back pain new?",
        isTarget: false,
        explanation: "A closed question that follows the last thing mentioned rather than agreeing on a plan for the visit.",
      },
      {
        text: "We'll need a separate visit for the back and the snoring.",
        isTarget: false,
        explanation: "That may be true, but it decides for him before you know what matters most to him.",
      },
    ],
    exampleResponses: [
      "So there's your back, refills, the snoring, and your sugar. We probably can't do all of it well today. Where would you like to start?",
    ],
  },
  {
    id: "drill-cl-focusing-02",
    setting: "clinical",
    skill: "focusing",
    level: 2,
    context: "An urgent care PA, wrapping up a sinus visit with a 41-year-old who smokes",
    speaker: "Patient",
    prompt: "Okay, so the saline rinse, and come back if it's not better in ten days. Got it. Am I good to go?",
    instruction: "Ask permission to raise smoking before you say anything about it.",
    exampleResponses: [
      "You're all set for the sinuses. Before you go, would it be okay to take two minutes on smoking? Totally fine if today's not the day.",
      "Would you be open to hearing one thing about how smoking and sinus trouble connect, or would you rather leave it for another time?",
    ],
  },
  {
    id: "drill-cl-focusing-03",
    setting: "clinical",
    skill: "focusing",
    level: 3,
    context: "A family physician, opening a 15-minute visit with a 55-year-old who has a list on her phone",
    speaker: "Patient",
    prompt: "I wrote everything down so I wouldn't forget. It's, um, eight things. Is that too many? My last doctor kind of sighed at me.",
    instruction: "Respond in a way that welcomes her list, is honest about time, and invites her to choose where to start.",
    exampleResponses: [
      "I'm glad you wrote it down. That helps both of us. We probably can't do eight well today, so let's look at the list together and you pick the one or two that matter most. We'll make a plan for the rest.",
      "No sighing here. Read me the list quickly, and then you choose what we dig into today.",
    ],
  },
  {
    id: "drill-cl-focusing-04",
    setting: "clinical",
    skill: "focusing",
    level: 2,
    context: "A community pharmacist, when a 70-year-old asks about the shingles vaccine at pickup",
    speaker: "Patient",
    prompt: "My sister got that shingles shot and felt like garbage for two days. Is it even worth it at my age?",
    instruction: "Before you share anything, ask what she already knows or most wants to know. This is the first elicit.",
    exampleResponses: [
      "Good question to ask. What have you heard about it so far, besides your sister's two rough days?",
      "Happy to talk it through. What would be most helpful for you to know as you decide?",
    ],
  },

  // -------------------------------------------------------------------------
  // Evoking
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-evoking-01",
    setting: "clinical",
    skill: "evoking",
    level: 1,
    context: "A behavioral health clinician in primary care, with a 49-year-old contractor after a positive alcohol screen",
    speaker: "Patient",
    prompt: "It's a few beers after work. Okay, sometimes more than a few. Everybody on my crew does it.",
    instruction: "Which question is most likely to draw out his own reasons for change?",
    choices: [
      {
        text: "How many drinks would you say you have in a typical week?",
        isTarget: false,
        explanation: "Useful for assessment, but it asks for a number, not his view. It won't usually bring out his reasons.",
      },
      {
        text: "What, if anything, have you noticed about the nights it's more than a few?",
        isTarget: true,
        explanation: "This invites him to look at the costs himself, in his own words, without a label or a lecture.",
      },
      {
        text: "Don't you think that's a lot?",
        isTarget: false,
        explanation: "A leading question. It pushes him to defend his drinking, which strengthens the case against change.",
      },
      {
        text: "Why don't you cut back to two on weeknights?",
        isTarget: false,
        explanation: "Advice phrased as a question. You're making the case for change, so he's likely to argue the other side.",
      },
    ],
    exampleResponses: ["What, if anything, have you noticed about the nights it's more than a few?"],
  },
  {
    id: "drill-cl-evoking-02",
    setting: "clinical",
    skill: "evoking",
    level: 1,
    context: "A health coach, with a 23-year-old graduate student who vapes, using the importance ruler",
    speaker: "Patient",
    prompt: "On your scale? Like a 4, I guess. I know it's not great, but it's kind of the only thing that gets me through studying.",
    instruction: "She rated the importance of quitting a 4 out of 10. Which follow-up is most likely to draw out change talk?",
    choices: [
      {
        text: "Why a 4 and not a 1 or 2?",
        isTarget: true,
        explanation: "To answer, she has to explain why quitting matters to her at all. Her answer is her own reasons for change.",
      },
      {
        text: "Why only a 4?",
        isTarget: false,
        explanation: "This asks her to defend the low number, so her answer will be reasons not to change.",
      },
      {
        text: "What would it take to get you to a 10?",
        isTarget: false,
        explanation: "A big leap that often gets \"I don't know.\" Asking what would move her one step, from 4 to 5, tends to work better.",
      },
      {
        text: "A 4 is pretty low, considering what vaping does to your lungs.",
        isTarget: false,
        explanation: "This argues with her rating. She's likely to push back or go quiet.",
      },
    ],
    exampleResponses: ["Why a 4 and not a 1 or 2?"],
  },
  {
    id: "drill-cl-evoking-03",
    setting: "clinical",
    skill: "evoking",
    level: 2,
    context: "A diabetes educator, with a 51-year-old bus mechanic who wants to walk after dinner, using the confidence ruler",
    speaker: "Patient",
    prompt: "Confidence? Maybe a 6. When it's nice out I'll do it. It's the rainy days, and the nights I get stuck late at the depot.",
    instruction: "Follow up on his confidence rating with a question that draws out his own strengths or ideas.",
    exampleResponses: [
      "A 6 is solid. What makes it a 6 and not a 3?",
      "What might move it from a 6 to a 7 on those rainy or late nights?",
    ],
  },
  {
    id: "drill-cl-evoking-04",
    setting: "clinical",
    skill: "evoking",
    level: 3,
    context: "A cardiology nurse practitioner, with a 58-year-old six weeks after a heart attack who hasn't started rehab",
    speaker: "Patient",
    prompt: "I'm back at work, I feel okay. Rehab's a lot of driving so somebody can watch me walk on a treadmill. I've got grandkids to chase, not treadmills.",
    instruction: "Respond with an open question or a reflection that invites him to talk about what he wants for the years ahead.",
    exampleResponses: [
      "Keeping up with your grandkids matters a lot to you. What do you want the next few years to look like with them?",
      "You want to be strong for the things that count, not just for a treadmill.",
    ],
  },
  {
    id: "drill-cl-evoking-05",
    setting: "clinical",
    skill: "evoking",
    level: 4,
    context: "A family physician, with a 64-year-old retired teacher with high cholesterol whose brother just had a stroke",
    speaker: "Patient",
    prompt: "I hate taking pills. I've always been the healthy one. But after Jim's stroke... I don't know. I keep thinking about it.",
    instruction: "Offer a double-sided reflection that ends on her reasons for change.",
    exampleResponses: [
      "Taking a pill every day doesn't feel like you, the healthy one, and since Jim's stroke, protecting yourself has been on your mind.",
      "Part of you really doesn't want to be someone who takes pills, and part of you is wondering whether this could keep you from going through what Jim is.",
    ],
  },

  // -------------------------------------------------------------------------
  // Change talk
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-change-talk-01",
    setting: "clinical",
    skill: "change-talk",
    level: 1,
    context: "A clinic nurse, taking vitals with a 57-year-old who stopped his blood pressure pill",
    speaker: "Patient",
    prompt:
      "I didn't like how it made me feel, all foggy. I've been fine without it. My dad had a stroke at sixty, so I guess I should probably do something. I just don't want to feel like that again.",
    instruction: "Which part of what he said is change talk?",
    choices: [
      {
        text: "\"I didn't like how it made me feel, all foggy.\"",
        isTarget: false,
        explanation: "A reason he stopped, so it's sustain talk about the medication. It's also important information to come back to.",
      },
      {
        text: "\"I've been fine without it.\"",
        isTarget: false,
        explanation: "Sustain talk: an argument for keeping things as they are.",
      },
      {
        text: "\"My dad had a stroke at sixty, so I guess I should probably do something.\"",
        isTarget: true,
        explanation: "A reason and a need for change, in his own words. It's tentative, but it's his. This is the line to reflect.",
      },
      {
        text: "\"I just don't want to feel like that again.\"",
        isTarget: false,
        explanation: "This is about avoiding side effects, so it leans away from the medication. Any plan will need to take it seriously.",
      },
    ],
    exampleResponses: ["\"My dad had a stroke at sixty, so I guess I should probably do something.\""],
  },
  {
    id: "drill-cl-change-talk-02",
    setting: "clinical",
    skill: "change-talk",
    level: 1,
    context: "A primary care nurse practitioner, with a 44-year-old long-haul trucker who smokes",
    speaker: "Patient",
    prompt: "I could probably quit if I didn't keep a carton in the truck. I did it for six months when my daughter was born.",
    instruction: "What kind of change talk is this?",
    choices: [
      {
        text: "Desire: wanting to change",
        isTarget: false,
        explanation: "He doesn't say he wants to quit. Desire sounds like \"I want to\" or \"I wish.\"",
      },
      {
        text: "Ability: being able to change",
        isTarget: true,
        explanation: "\"I could\" and \"I did it for six months\" are both about ability. He's telling you he knows he can.",
      },
      {
        text: "Reason: a specific benefit of changing",
        isTarget: false,
        explanation: "His daughter comes up as a time he quit, not as a reason to quit now. A reason sounds like \"It would help my...\"",
      },
      {
        text: "Need: feeling he has to change",
        isTarget: false,
        explanation: "Need sounds like \"I have to\" or \"I've got to.\" He's describing what's possible, not what's urgent.",
      },
    ],
    exampleResponses: ["Ability: being able to change"],
  },
  {
    id: "drill-cl-change-talk-03",
    setting: "clinical",
    skill: "change-talk",
    level: 2,
    context: "A primary care physician, with a 44-year-old dental hygienist after she brings up her drinking",
    speaker: "Patient",
    prompt: "I'm not an alcoholic or anything. But I don't want to be my dad, asleep in the recliner every night by eight. My kids notice stuff.",
    instruction: "Reflect the change talk. Leave the label and the sustain talk alone.",
    exampleResponses: [
      "You want your kids to have a different picture of their mom than the one you had of your dad.",
      "Being present for your kids in the evenings really matters to you.",
    ],
  },
  {
    id: "drill-cl-change-talk-04",
    setting: "clinical",
    skill: "change-talk",
    level: 3,
    context: "A nurse practitioner, with a 29-year-old software tester who scrolls in bed until 2 a.m.",
    speaker: "Patient",
    prompt: "I mean, I'd probably be less of a zombie at work if I put the phone down. And I'd maybe stop snapping at my roommate over the dishes.",
    instruction: "Ask for more: invite him to say more about one of his own reasons.",
    exampleResponses: [
      "What would being less of a zombie at work look like for you?",
      "Tell me more about how things would be different with your roommate.",
    ],
  },

  // -------------------------------------------------------------------------
  // Sustain talk
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-sustain-talk-01",
    setting: "clinical",
    skill: "sustain-talk",
    level: 1,
    context: "A family physician, with a 66-year-old whose blood pressure is 164/98 today",
    speaker: "Patient",
    prompt: "I feel fine, though. I'd know if something was wrong. My body tells me.",
    instruction: "Which response meets the sustain talk without arguing?",
    choices: [
      {
        text: "High blood pressure usually has no symptoms. That's why they call it the silent killer.",
        isTarget: false,
        explanation: "Accurate, but it's the righting reflex: a correction he didn't ask for. He'll likely defend what his body tells him.",
      },
      {
        text: "You trust your body, and right now it's telling you things are okay.",
        isTarget: true,
        explanation: "A simple reflection that shows you heard him. Feeling understood, he's more likely to say what else is on his mind.",
      },
      {
        text: "Feeling fine doesn't mean you are fine.",
        isTarget: false,
        explanation: "A direct contradiction. It puts you on opposite sides of the argument.",
      },
      {
        text: "So you'd rather wait until you have a stroke?",
        isTarget: false,
        explanation: "Sarcasm and a scare tactic. It shames him and tends to end the conversation.",
      },
    ],
    exampleResponses: ["You trust your body, and right now it's telling you things are okay."],
  },
  {
    id: "drill-cl-sustain-talk-02",
    setting: "clinical",
    skill: "sustain-talk",
    level: 2,
    context: "A diabetes educator, with a 48-year-old mother of three who works two jobs",
    speaker: "Patient",
    prompt:
      "You want me eating salmon and fresh vegetables? Have you seen what groceries cost? My kids eat what's cheap and fills them up, and so do I.",
    instruction: "Reflect the sustain talk without arguing or problem-solving.",
    exampleResponses: [
      "Feeding three kids on your budget comes first, and the advice you've gotten doesn't fit your real life.",
      "You're making it work with what you've got, and those healthy-eating handouts feel like they were written for someone else.",
    ],
  },
  {
    id: "drill-cl-sustain-talk-03",
    setting: "clinical",
    skill: "sustain-talk",
    level: 3,
    context: "A nurse practitioner at a college health center, with a 20-year-old sophomore who vapes",
    speaker: "Patient",
    prompt: "It's way better than cigarettes. Literally everyone vapes. Although, okay, I did get winded at intramural soccer, which was embarrassing.",
    instruction: "Offer a double-sided reflection that starts with the sustain talk and ends with the change talk.",
    exampleResponses: [
      "Vaping feels like the safer option and it's just what everyone does, and getting winded at soccer caught your attention.",
      "On one hand it seems pretty normal, and on the other you didn't love how that soccer game felt.",
    ],
  },
  {
    id: "drill-cl-sustain-talk-04",
    setting: "clinical",
    skill: "sustain-talk",
    level: 4,
    context: "A primary care nurse, calling a 52-year-old roofer who has rescheduled his diabetes follow-up three times",
    speaker: "Patient",
    prompt:
      "Look, I'll come in when it slows down. I can't lose a morning's pay so somebody can read me my numbers and hand me a paper. I'll come in if something's wrong.",
    instruction: "Respond with a reflection plus a statement that emphasizes his choice. No pressure, no warnings.",
    exampleResponses: [
      "A morning off costs you real money, and these visits haven't felt worth it. It's your call when you come in.",
      "You want any time you spend here to actually be useful to you. You decide when that is. Would it help to hear about shorter options, like a phone visit?",
    ],
  },

  // -------------------------------------------------------------------------
  // Discord
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-discord-01",
    setting: "clinical",
    skill: "discord",
    level: 1,
    context: "A physician assistant, right after suggesting a cholesterol medication to a 50-year-old",
    speaker: "Patient",
    prompt: "You people always want to push pills. What, do you get a kickback or something?",
    instruction: "Which response is most likely to ease the tension?",
    choices: [
      {
        text: "No, we don't get kickbacks. That's not how it works.",
        isTarget: false,
        explanation: "Defending yourself is a natural reflex, but it keeps the focus on you and the argument going.",
      },
      {
        text: "You've felt pushed toward pills before, and you want someone to actually hear what you think.",
        isTarget: true,
        explanation: "This reflects what's under the jab and shifts the focus back to him, which tends to lower the heat.",
      },
      {
        text: "I'm just following the guidelines.",
        isTarget: false,
        explanation: "It distances you from the suggestion and can sound like hiding behind rules.",
      },
      {
        text: "Okay, forget the medication. Let's talk about your diet.",
        isTarget: false,
        explanation: "Shifting focus can help with discord, but jumping to diet without acknowledging him can feel like the next sales pitch.",
      },
    ],
    exampleResponses: ["You've felt pushed toward pills before, and you want someone to actually hear what you think."],
  },
  {
    id: "drill-cl-discord-02",
    setting: "clinical",
    skill: "discord",
    level: 2,
    context: "A family physician, walking into the exam room 50 minutes late",
    speaker: "Patient",
    prompt: "Fifty minutes. I took a half day for this. So you've got, what, eight minutes for me now?",
    instruction: "Respond with a reflection, an apology, or both. Don't explain why you're late.",
    exampleResponses: [
      "I'm sorry. You gave up half a day and then sat here for fifty minutes. That's a lot to ask of anyone.",
      "You're frustrated, and you're worried you'll get rushed after all that waiting. I'm sorry. Let's make sure the time we have goes to what matters most to you.",
    ],
  },
  {
    id: "drill-cl-discord-03",
    setting: "clinical",
    skill: "discord",
    level: 3,
    context: "A pediatric nurse practitioner, at a 12-month checkup, with a parent who wants to delay the MMR vaccine",
    speaker: "Parent",
    prompt:
      "Before you start, I've done a lot of reading. I'm not anti-vaccine. I just feel like the minute I ask a question in here, everyone treats me like a bad mom.",
    instruction: "Respond to the discord with a reflection that honors her intent. Don't debate the vaccine yet.",
    exampleResponses: [
      "You're asking questions because you care so much about him, and it's felt like that gets read as the opposite.",
      "You've put real time into understanding this, and you want to be treated like the thoughtful parent you are.",
    ],
  },
  {
    id: "drill-cl-discord-04",
    setting: "clinical",
    skill: "discord",
    level: 4,
    context: "A primary care physician, meeting a 47-year-old new patient with chronic low back pain who asks about pain medication",
    speaker: "Patient",
    prompt:
      "My last doctor cut me off cold and looked at me like I was a junkie. I drive a forklift. I'm not trying to get high, I'm trying to keep my job.",
    instruction:
      "Respond to the discord with a complex reflection and an invitation to work together, without promising or refusing any medication.",
    exampleResponses: [
      "Being treated like you wanted to get high, when what you're trying to do is keep working, felt awful. I'd like to understand what your pain is like day to day so we can figure out a plan together.",
      "You were cut off without anyone really listening, and you're bracing for the same thing here. Your pain and your job both matter, and I want to hear about both.",
    ],
  },

  // -------------------------------------------------------------------------
  // Planning (including Elicit-Provide-Elicit)
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-planning-01",
    setting: "clinical",
    skill: "planning",
    level: 1,
    context: "A community pharmacist, talking with a 60-year-old about quitting smoking",
    speaker: "Patient",
    prompt:
      "I know I should quit. Everybody tells me. And smoking's the only way I really relax. Maybe someday, when things calm down. Although... if I tried the patch, would I put it on in the morning or at night?",
    instruction: "Which part of what he said is the clearest sign he may be ready to plan?",
    choices: [
      {
        text: "\"I know I should quit. Everybody tells me.\"",
        isTarget: false,
        explanation: "\"Should\" here comes from other people. It's not yet his own reason, and it's not about how.",
      },
      {
        text: "\"Smoking's the only way I really relax.\"",
        isTarget: false,
        explanation: "Sustain talk. It's worth reflecting, but it isn't a sign he's ready to plan.",
      },
      {
        text: "\"If I tried the patch, would I put it on in the morning or at night?\"",
        isTarget: true,
        explanation: "A question about how to do it is a classic readiness sign. He's starting to picture the change.",
      },
      {
        text: "\"Maybe someday, when things calm down.\"",
        isTarget: false,
        explanation: "Distant and tentative. Planning now would likely feel like pressure.",
      },
    ],
    exampleResponses: ["\"If I tried the patch, would I put it on in the morning or at night?\""],
  },
  {
    id: "drill-cl-planning-02",
    setting: "clinical",
    skill: "planning",
    level: 2,
    context: "A nurse practitioner, with a 61-year-old whose A1c went from 7.2 to 8.4",
    speaker: "Patient",
    prompt: "Eight point four. Is that bad? What does that number even mean?",
    instruction: "Start Elicit-Provide-Elicit: before you explain, find out what she already knows or most wants to know.",
    exampleResponses: [
      "I'll explain. First, what do you remember about what the A1c measures, so I can fill in gaps instead of repeating things?",
      "Good question. What would be most useful for you to understand about it?",
    ],
  },
  {
    id: "drill-cl-planning-03",
    setting: "clinical",
    skill: "planning",
    level: 3,
    context: "A cardiac rehab nurse, after a 58-year-old said rehab is for people worse off than him, then agreed to hear some information",
    speaker: "Patient",
    prompt: "Sure, go ahead. Tell me why I should go.",
    instruction: "Provide one short, neutral piece of information, then ask what he makes of it. This is the provide and the second elicit.",
    exampleResponses: [
      "People who do cardiac rehab after a heart attack are less likely to end up back in the hospital, including people who feel good. You'd know best how that fits for you. What do you make of it?",
      "One thing rehab does is let people push harder, safely, with someone keeping an eye on their heart. How does that sit with everything you want to get back to?",
    ],
  },
  {
    id: "drill-cl-planning-04",
    setting: "clinical",
    skill: "planning",
    level: 3,
    context: "A health coach, with a 39-year-old accountant who just said she wants to start moving more",
    speaker: "Patient",
    prompt: "Okay. I think I actually want to do this. I just don't know where to start, and I don't want to sign up for some boot camp and quit in a week.",
    instruction: "Ask a key question that invites her to shape the first step herself.",
    exampleResponses: [
      "You want something that sticks. What would a first step look like that feels doable, not boot camp?",
      "So you're ready, and you want to start small. Where would you like to begin?",
    ],
  },
  {
    id: "drill-cl-planning-05",
    setting: "clinical",
    skill: "planning",
    level: 4,
    context: "A primary care physician, with a 34-year-old line cook who has decided to cut back on drinking",
    speaker: "Patient",
    prompt: "So what, I just stop? I have no idea how people actually do this.",
    instruction: "Ask permission, offer a short menu of options, and hand the choice back to him.",
    exampleResponses: [
      "Would it help if I shared a few things other people have tried? Some pick alcohol-free days, some set a nightly limit and track it, some change the after-shift routine that leads to the first drink, and some want extra support like counseling or medication. Which of those, if any, sounds like you?",
      "Can I share a few options? You know your life better than I do, so take what fits and leave the rest.",
    ],
  },

  // -------------------------------------------------------------------------
  // Full conversation
  // -------------------------------------------------------------------------
  {
    id: "drill-cl-full-conversation-01",
    setting: "clinical",
    skill: "full-conversation",
    level: 4,
    context: "A family physician, halfway through a visit with a 61-year-old who stopped his blood pressure medication",
    speaker: "Patient",
    prompt:
      "So, yeah. I didn't like the cough, and I don't want to be one of those guys with a pill organizer. But I watched what my dad went through after his stroke. I don't want that.",
    instruction: "Offer a transitional summary that gathers both sides and checks whether he's ready to talk about next steps.",
    exampleResponses: [
      "Let me pull this together. The cough was a real problem, and you don't want your life to revolve around pills. You also saw what the stroke did to your dad, and you don't want that for yourself. Where does that leave you with your blood pressure?",
    ],
  },
  {
    id: "drill-cl-full-conversation-02",
    setting: "clinical",
    skill: "full-conversation",
    level: 4,
    context: "A nurse practitioner, with two minutes left in a visit with a 45-year-old hotel housekeeping supervisor working on her A1c",
    speaker: "Patient",
    prompt:
      "Okay. So I'll do the walk with my sister on Tuesdays and Saturdays, and I'll try switching the soda for sparkling water. Not all of it. Like, the afternoon one.",
    instruction: "Close the visit with a short summary of her plan in her words, an affirmation, and an open door for next time.",
    exampleResponses: [
      "So your plan is walks with your sister on Tuesdays and Saturdays, and swapping the afternoon soda for sparkling water. You picked things that fit your life, which makes them more likely to stick. Next time, tell me how it's going, and we can change the plan if it isn't working.",
    ],
  },
];

/** Clinician daily sequence: recognize before respond, OARS before evoking. */
export const CLINICIAN_DAILY_DRILL_ORDER: string[] = [
  "drill-cl-oars-01",
  "drill-cl-oars-02",
  "drill-cl-oars-03",
  "drill-cl-engaging-01",
  "drill-cl-oars-04",
  "drill-cl-focusing-01",
  "drill-cl-engaging-02",
  "drill-cl-change-talk-01",
  "drill-cl-oars-05",
  "drill-cl-sustain-talk-01",
  "drill-cl-focusing-02",
  "drill-cl-evoking-01",
  "drill-cl-change-talk-02",
  "drill-cl-focusing-04",
  "drill-cl-evoking-02",
  "drill-cl-change-talk-03",
  "drill-cl-engaging-03",
  "drill-cl-discord-01",
  "drill-cl-sustain-talk-02",
  "drill-cl-focusing-03",
  "drill-cl-evoking-03",
  "drill-cl-planning-01",
  "drill-cl-change-talk-04",
  "drill-cl-discord-02",
  "drill-cl-planning-02",
  "drill-cl-evoking-04",
  "drill-cl-sustain-talk-03",
  "drill-cl-planning-03",
  "drill-cl-discord-03",
  "drill-cl-planning-04",
  "drill-cl-evoking-05",
  "drill-cl-sustain-talk-04",
  "drill-cl-discord-04",
  "drill-cl-planning-05",
  "drill-cl-full-conversation-01",
  "drill-cl-full-conversation-02",
];
