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
