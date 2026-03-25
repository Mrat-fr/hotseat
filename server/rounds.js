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

// Stage 3: The Spectrum — slider-based opinion statements
export const spectrumStatements = [
  // Ethics & Morality
  'A person who commits a crime due to poverty is morally innocent.',
  'It is more ethical to save one young child than five elderly people.',
  'We should hold people accountable for thoughts they haven\'t acted on yet.',
  'Lying to someone "for their own good" is a form of manipulation, not kindness.',
  'If you witness a crime and do nothing, you are as guilty as the perpetrator.',
  'The death of one person you love is a greater tragedy than the death of 1,000 strangers.',
  'Cannibalism is morally acceptable if it is the only way to survive.',
  'It is unethical to bring a child into the world given the current state of the environment.',
  '"Common sense" is just a collection of prejudices learned by age eighteen.',
  'Forgiveness should be earned, never given freely.',
  // Relationships & Loyalty
  'You should never tell your partner about a one-time mistake if it would only hurt them.',
  'It is impossible to truly love two people at the same time.',
  'If you wouldn\'t die for your best friend, you aren\'t actually "best friends."',
  'Parents should have the final say in who their children marry.',
  'Keeping tabs on a partner\'s location via GPS is a sign of care, not control.',
  'You should always take your sibling\'s side in a public argument, even if they are wrong.',
  'Long-distance relationships are fundamentally unsustainable.',
  'It is acceptable to ghost someone if you feel they are becoming too emotionally demanding.',
  'A marriage without children is more likely to be successful than one with them.',
  'You should be allowed to read your partner\'s private messages if you have a "gut feeling."',
  // Society & Future
  'Voting should be a requirement, with fines for those who stay home.',
  'We should genetically engineer humans to be more empathetic and less aggressive.',
  'High-speed internet should be a free human right provided by the state.',
  'History should be rewritten if the "truth" causes too much civil unrest today.',
  'Within 100 years, traditional "family units" will be obsolete.',
  'People should be required to pass a test before being allowed to have children.',
  'A society that prioritizes equality of outcome is destined to fail.',
  'All drugs should be legalized and regulated by the government.',
  'The "Golden Age" of humanity has already passed.',
  'We should prioritize colonizing Mars over fixing Earth\'s climate.',
  // Success & Ambition
  'Money can, in fact, buy long-term happiness.',
  'Formal education is a waste of time for those who are truly naturally gifted.',
  'It is better to be the "dumbest" person in a room of geniuses than the smartest in a room of fools.',
  'If you aren\'t willing to step on others, you don\'t actually want to win.',
  'Professional burnout is a sign of weakness, not an overworked system.',
  'Your job title is the most accurate reflection of your value to society.',
  'A "good" life is measured by the amount of money you leave behind for others.',
  'It is better to have tried and failed miserably than to have never tried at all.',
  'Nepotism is a natural and acceptable way to help those you love.',
  'You should quit your job immediately if it doesn\'t make you feel "passionate" every day.',
  // Personal Philosophy
  'Nostalgia is a trap that prevents people from living in the present.',
  'Most people only do "good deeds" because they want to feel better about themselves.',
  'True altruism does not exist.',
  'Religion has done more harm to the world than any war in history.',
  'It is better to be deeply unhappy and "awake" than blissfully ignorant.',
  'Silence in the face of injustice is the same as supporting the oppressor.',
  'We are all essentially the same person living different lives.',
  'Pain is a more effective teacher than pleasure.',
  'Boredom is the greatest threat to a person\'s mental well-being.',
  'Life has no inherent meaning; we are just biological accidents.',
];

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
