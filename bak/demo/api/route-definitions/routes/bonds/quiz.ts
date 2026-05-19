import { defineQuiz } from '@taylordb/learning-backend';
import { demoQuizPlugins } from '../../../features/quiz/plugins';

export const bondsQuizDefinition = defineQuiz(demoQuizPlugins, {
  id: 'demo-quiz-2',
  title: 'Full-Stack Quiz',
  exam: {
    timeLimitSeconds: 15 * 60,
    instructions: 'Answer every question before the timer runs out. The exam instructions also use the shared Markdown renderer with `molecule:O`.',
  },
  questions: [
    {
      id: 'q1',
      questionType: 'multiple-choice',
      difficulty: 'easy',
      maxPoints: 1,
      public: {
        title: 'Architecture',
        questionText: 'What kind of demo is this?',
        choices: [
          { id: 'a', text: 'Frontend Only' },
          { id: 'b', text: 'Full-Stack' },
          { id: 'c', text: 'Backend Only' },
        ],
      },
      grading: {
        question: 'What kind of demo is this?',
        expectedAnswers: ['b'],
        choices: [
          { id: 'a', text: 'Frontend Only' },
          { id: 'b', text: 'Full-Stack' },
          { id: 'c', text: 'Backend Only' },
        ],
      },
      revealPayload: { correctIds: ['b'] },
    },
    {
      id: 'q1b',
      questionType: 'multiple-choice',
      difficulty: 'medium',
      maxPoints: 2,
      public: {
        title: 'Frontend Frameworks',
        questionText:
          'Which of the following are considered frontend web frameworks? (Select all that apply)',
        multiSelect: true,
        choices: [
          { id: 'a', text: 'React' },
          { id: 'b', text: 'Django' },
          { id: 'c', text: 'Vue' },
          { id: 'd', text: 'Spring Boot' },
        ],
      },
      grading: {
        question:
          'Which of the following are considered frontend web frameworks? Select all that apply.',
        expectedAnswers: ['a', 'c'],
        choices: [
          { id: 'a', text: 'React' },
          { id: 'b', text: 'Django' },
          { id: 'c', text: 'Vue' },
          { id: 'd', text: 'Spring Boot' },
        ],
      },
      revealPayload: { correctIds: ['a', 'c'] },
    },
    {
      id: 'q2',
      questionType: 'free-text',
      difficulty: 'medium',
      maxPoints: 3,
      public: {
        title: 'Density & States of Matter',
        questionText:
          'Explain why ice floats on liquid water. This question includes a custom molecule tag: `molecule:O`. Be sure to mention density and molecular structure.',
        inputType: 'long',
        placeholder: 'Type your explanation here...',
      },
      grading: {
        question:
          'Explain why ice floats on liquid water. Be sure to mention density and molecular structure.',
        expectedAnswer:
          'Ice is less dense than liquid water because its hydrogen bonds form a crystalline lattice structure that keeps molecules further apart.',
      },
      revealPayload: {
        answer:
          'Ice is less dense than liquid water because its hydrogen bonds form a crystalline lattice structure that keeps molecules further apart.',
      },
    },
    {
      id: 'q3',
      questionType: 'fill-in-the-blanks',
      difficulty: 'medium',
      maxPoints: 6,
      public: {
        title: 'German Grammar',
        questionText:
          "Translate the sentence: 'The dog bites the man in the leg, because he is very hungry.' Fill in the 6 missing German words.",
        parts: [
          { type: 'gap', id: 'art1', placeholder: 'The' },
          { type: 'text', value: ' Hund beisst ' },
          { type: 'gap', id: 'art2', placeholder: 'the' },
          { type: 'text', value: ' Mann in ' },
          { type: 'gap', id: 'art3', placeholder: 'the' },
          { type: 'text', value: ' Bein, ' },
          { type: 'gap', id: 'conj', placeholder: 'because' },
          { type: 'text', value: ' er ' },
          { type: 'gap', id: 'adv', placeholder: 'very' },
          { type: 'text', value: ' hungrig ' },
          { type: 'gap', id: 'verb', placeholder: 'is' },
          { type: 'text', value: '.' },
        ],
      },
      grading: {
        question:
          "Translate the sentence: 'The dog bites the man in the leg, because he is very hungry.'",
        expectedAnswers: {
          art1: 'Der',
          art2: 'den',
          art3: 'das',
          conj: 'weil',
          adv: 'sehr',
          verb: 'ist',
        },
      },
      revealPayload: {
        answers: { art1: 'Der', art2: 'den', art3: 'das', conj: 'weil', adv: 'sehr', verb: 'ist' },
      },
    },
    {
      id: 'q4',
      questionType: 'formula',
      difficulty: 'hard',
      maxPoints: 4,
      public: {
        title: 'Stoichiometry',
        questionText:
          "Calculate the mass in grams of 3.7 x 10^24 atoms of Sodium (Na). The molar mass of Na is 23 g/mol. Avogadro's number is 6.022 x 10^23. Enter the full mathematical expression you would use to solve this.",
        enableScratchpad: true,
      },
      grading: {
        question:
          "Calculate the mass in grams of 3.7 x 10^24 atoms of Sodium (Na). The molar mass of Na is 23 g/mol. Avogadro's number is 6.022 x 10^23.",
        expectedAnswer: '3.7 * 10^24 / 6.022e23 * 23',
      },
      revealPayload: { answer: '3.7 * 10^24 / 6.022e23 * 23' },
    },
    {
      id: 'q5',
      questionType: 'drawing',
      difficulty: 'boss',
      maxPoints: 3,
      public: {
        title: 'Chemistry Structure',
        questionText:
          'Draw a structural formula for a water molecule (H2O). Explicitly draw the bonds connecting the central Oxygen atom to the two Hydrogen atoms (e.g., H-O-H).',
      },
      grading: {
        question:
          'Draw a structural formula for a water molecule (H2O). Explicitly draw the bonds connecting the central Oxygen atom to the two Hydrogen atoms.',
        expectedAnswer:
          'A correct structural formula for water, showing oxygen bonded to two hydrogens, such as H-O-H.',
      },
      revealPayload: {
        answer: 'A correct drawing should show oxygen bonded to two hydrogens, such as H-O-H.',
      },
    },
    {
      id: 'q6',
      questionType: 'custom-slider',
      difficulty: 'easy',
      maxPoints: 2,
      public: {
        title: 'Custom Plugin Demo',
        questionText: "What percentage of the Earth's surface is covered by water?",
        min: 0,
        max: 100,
        defaultValue: 50,
      },
      grading: {
        question: "What percentage of the Earth's surface is covered by water?",
        expectedAnswer: 71,
      },
      revealPayload: { answer: 71 },
    },
  ],
})
