export type SurveyAnswer = { text: string; points: number };
export type SurveyQuestion = { prompt: string; answers: SurveyAnswer[] };

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    prompt: 'Name a popular pizza topping.',
    answers: [
      { text: 'Pepperoni', points: 35 },
      { text: 'Mushrooms', points: 20 },
      { text: 'Onions', points: 14 },
      { text: 'Sausage', points: 12 },
      { text: 'Bacon', points: 9 },
      { text: 'Extra cheese', points: 6 },
      { text: 'Peppers', points: 4 },
    ],
  },
  {
    prompt: 'Name something you bring on a camping trip.',
    answers: [
      { text: 'Tent', points: 33 },
      { text: 'Sleeping bag', points: 26 },
      { text: 'Flashlight', points: 17 },
      { text: 'Food', points: 12 },
      { text: 'Water', points: 7 },
      { text: 'Bug spray', points: 5 },
    ],
  },
  {
    prompt: 'Name a reason you might be late to work.',
    answers: [
      { text: 'Traffic', points: 40 },
      { text: 'Overslept', points: 28 },
      { text: 'Car trouble', points: 12 },
      { text: 'Weather', points: 9 },
      { text: 'Public transit delay', points: 6 },
      { text: 'Child drop-off', points: 5 },
    ],
  },
  {
    prompt: 'Name something you associate with pirates.',
    answers: [
      { text: 'Treasure', points: 34 },
      { text: 'Ship', points: 22 },
      { text: 'Parrot', points: 18 },
      { text: 'Eye patch', points: 12 },
      { text: 'Hook', points: 8 },
      { text: 'Rum', points: 6 },
    ],
  },
  {
    prompt: 'Name something people do while waiting in line.',
    answers: [
      { text: 'Check phone', points: 39 },
      { text: 'Talk', points: 21 },
      { text: 'Listen to music', points: 13 },
      { text: 'People watch', points: 11 },
      { text: 'Read', points: 9 },
      { text: 'Fidget', points: 7 },
    ],
  },
  {
    prompt: 'Name a household chore kids might do for allowance.',
    answers: [
      { text: 'Dishes', points: 31 },
      { text: 'Taking out trash', points: 24 },
      { text: 'Vacuuming', points: 18 },
      { text: 'Laundry', points: 11 },
      { text: 'Mowing lawn', points: 9 },
      { text: 'Dusting', points: 7 },
    ],
  },
  {
    prompt: 'Name something you need to make pancakes.',
    answers: [
      { text: 'Flour', points: 30 },
      { text: 'Eggs', points: 25 },
      { text: 'Milk', points: 20 },
      { text: 'Syrup', points: 10 },
      { text: 'Butter', points: 9 },
      { text: 'Pan', points: 6 },
    ],
  },
  {
    prompt: 'Name a popular board game.',
    answers: [
      { text: 'Monopoly', points: 32 },
      { text: 'Scrabble', points: 21 },
      { text: 'Chess', points: 18 },
      { text: 'Clue', points: 12 },
      { text: 'Risk', points: 9 },
      { text: 'Settlers of Catan', points: 8 },
    ],
  },
];
