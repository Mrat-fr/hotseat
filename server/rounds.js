// Stage 2: Debate Duel — 25 topics for the 5×5 grid
export const debateTopics = [
  { title: 'The Cereal Sequence', pro: 'Cereal first, then milk. (The Logical Way)', con: 'Milk first, then cereal. (The Revolutionary Way)' },
  { title: 'Daily Dilemmas', pro: 'Morning showers are essential to start the day.', con: 'Night showers are essential to leave the day behind.' },
  { title: 'Animal Showdowns', pro: '1,000 pigeons would easily overwhelm a grizzly bear.', con: 'One grizzly bear is an unstoppable force vs. pigeons.' },
  { title: 'The White Lie', pro: "Protecting a friend's feelings justifies a small lie.", con: 'Total radical honesty is the only way to be a true friend.' },
  { title: 'Privacy vs. Safety', pro: "Safety first: Parents should track their teens' phones.", con: 'Privacy first: Tracking breeds distrust.' },
  { title: 'Space Colonization', pro: 'We must colonise Mars to ensure human survival.', con: "We must fix Earth's issues before leaving the planet." },
  { title: 'The Simulation', pro: 'Living in a simulation means I should live more wildly.', con: 'Living in a simulation changes nothing about my values.' },
  { title: 'The Superpower', pro: 'Invisibility is the most practical power for modern life.', con: 'Flight is the most practical power for modern life.' },
  { title: 'The Truth Serum', pro: 'A world without lies would lead to a total collapse.', con: 'A world without lies would lead to a better society.' },
  { title: 'Digital Life', pro: '"Cancel Culture" is a valid form of accountability.', con: '"Cancel Culture" is just a form of digital mob justice.' },
  { title: 'The Remote Reality', pro: 'Permanent Remote Work is the future of productivity.', con: 'In-Person Collaboration is the only way to build a real team.' },
  { title: 'The Gift of Time', pro: 'If you had a time machine, you should go to the Future.', con: 'If you had a time machine, you should go to the Past.' },
  { title: 'The Dog vs. Cat', pro: 'Dogs are the ultimate companions for humans.', con: 'Cats are the superior, low-maintenance masters.' },
  { title: 'The Zoo Debate', pro: 'Zoos are essential for conservation and education.', con: 'Zoos are outdated and should be abolished.' },
  { title: 'The Silicon Brain', pro: 'AI is a revolutionary partner that will automate drudgery and unlock a new era of human potential.', con: 'AI is a high-risk shortcut that threatens to erode our genuine skills, critical thinking, and creativity.' },
  { title: 'The Urban Escape', pro: 'Living in a big, bustling city is the only way to truly experience life.', con: 'A quiet, rural life in nature is the only way to find true peace.' },
  { title: 'The Breakfast Battle', pro: 'Pancakes are the undisputed champion of breakfast.', con: 'Waffles are the superior breakfast item, no contest.' },
  { title: 'The Social Scroll', pro: 'Social media connects us and makes life richer.', con: 'Social media isolates us and is a total time sink.' },
  { title: 'The Homework Debate', pro: 'Homework is essential for reinforcing learning.', con: 'Homework is pointless busywork that kills free time.' },
  { title: 'The Money Question', pro: 'Money absolutely CAN buy happiness.', con: 'Money absolutely CANNOT buy happiness.' },
  { title: 'The Alien Contact', pro: 'If aliens contacted Earth, we should respond immediately.', con: 'If aliens contacted Earth, we should stay completely silent.' },
  { title: 'The Sleep Schedule', pro: 'Being a night owl is the superior lifestyle.', con: 'Being an early bird is the superior lifestyle.' },
  { title: 'The Fashion Statement', pro: 'Comfort over style, always.', con: 'Style over comfort, always.' },
  { title: 'The Music War', pro: 'Modern music is better than music from the past.', con: 'Music from the past is better than modern music.' },
  { title: 'The Food Fight', pro: 'Sweet snacks are objectively better than savory snacks.', con: 'Savory snacks are objectively better than sweet snacks.' },
];

// Stage 1: Yes / No
export const yesnoQuestions = [
  'Is it okay to eat pizza with a fork and knife?',
  'Is sparkling water better than still water?',
  'Is Pepsi better than Coke?',
  'Is the "crust" the best part of the pizza?',
  'Are the books always better than the movie?',
  'Is spoiler culture too sensitive?',
  'Is binge-watching better than weekly episodes?',
  'Are movie theatres better than watching at home?',
  'If you replace every part of a boat, is it still the same boat?',
  'Does a straw only have one hole?',
  'Is the Window seat better than the Aisle seat?',
];

export function getRoundData(roundNumber) {
  const question = yesnoQuestions[roundNumber % yesnoQuestions.length];
  return { type: 'yesno', question };
}

export function getYesNoResults(room) {
  const yes = [];
  const no = [];
  for (const [name, player] of Object.entries(room.players)) {
    if (player.answered) {
      if (player.answer === 'yes') yes.push(name);
      else no.push(name);
    }
  }
  return { yes, no };
}
