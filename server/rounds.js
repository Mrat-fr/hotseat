const roundTypes = ['trivia', 'creative', 'trivia', 'draw', 'creative'];

const triviaQuestions = [
  { question: 'What planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Mars', 'Earth'], answer: 1 },
  { question: 'How many legs does a spider have?', options: ['6', '8', '10', '12'], answer: 1 },
  { question: 'What year did the Titanic sink?', options: ['1905', '1912', '1918', '1923'], answer: 1 },
  { question: 'Which element has the chemical symbol "O"?', options: ['Gold', 'Osmium', 'Oxygen', 'Iron'], answer: 2 },
  { question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Da Vinci', 'Raphael', 'Donatello'], answer: 1 },
  { question: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2 },
  { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'CO2', 'Helium'], answer: 2 },
];

const creativePrompts = [
  'What would be the worst superpower to have on a first date?',
  'Invent a new holiday and explain how people celebrate it.',
  'What would a dog say in a job interview?',
  'Describe the worst possible flavor of ice cream.',
  'Write a one-star review of a national park.',
  'What would your autobiography be titled?',
];

const drawPrompts = [
  'A cat wearing a top hat',
  'Your worst nightmare as a stick figure',
  'The world\'s ugliest sandwich',
  'A superhero with a useless power',
  'Your spirit animal',
  'The last thing you ate, but evil',
];

let triviaIndex = 0;
let creativeIndex = 0;
let drawIndex = 0;

export function getRoundType(roundNumber) {
  return roundTypes[roundNumber % roundTypes.length];
}

export function getRoundData(roundNumber) {
  const type = getRoundType(roundNumber);

  switch (type) {
    case 'trivia': {
      const q = triviaQuestions[triviaIndex % triviaQuestions.length];
      triviaIndex++;
      return { type, question: q.question, options: q.options, correctIndex: q.answer };
    }
    case 'creative': {
      const prompt = creativePrompts[creativeIndex % creativePrompts.length];
      creativeIndex++;
      return { type, prompt };
    }
    case 'draw': {
      const prompt = drawPrompts[drawIndex % drawPrompts.length];
      drawIndex++;
      return { type, prompt };
    }
  }
}

export function scoreTrivia(room, playerName, answerIndex, correctIndex) {
  const player = room.players[playerName];
  if (!player || player.answered) return;
  player.answered = true;
  player.answer = answerIndex;
  if (answerIndex === correctIndex) {
    player.score += 1000;
  }
}

export function scoreCreative(room, playerName, votes) {
  const player = room.players[playerName];
  if (!player) return;
  player.score += votes * 500;
}
