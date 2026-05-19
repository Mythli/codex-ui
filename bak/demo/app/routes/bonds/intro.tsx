import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  LessonPage,
  PageIntro,
  ConceptSection,
  InfoGrid,
  InfoCard,
  VocabularySection,
  type VocabCard
} from '@taylordb/learning-ui';
import { useModuleNavigation } from '../../core/navigation';
import { fetchVocabCardsBySourceIdsFn } from '../../features/vocab/server-fns';

const LESSON_VOCAB = [
  {
    id: 'bonds-valence-electrons',
    word: 'Valence Electrons',
    definition: 'The electrons in the outermost shell of an atom. These are the electrons involved in forming chemical bonds.',
    tags: ['bonds', 'chemistry']
  },
  {
    id: 'bonds-octet-rule',
    word: 'Octet Rule',
    definition: 'The tendency of atoms to prefer having eight electrons in their valence shell to achieve maximum stability, similar to noble gases.',
    tags: ['bonds', 'chemistry']
  },
  {
    id: 'bonds-covalent-bond',
    word: 'Covalent Bond',
    definition: 'A chemical bond formed when two atoms share one or more pairs of electrons. This custom molecule tag is rendered by the demo Markdown config after you add the card to your deck: `molecule:O`.',
    tags: ['bonds', 'chemistry']
  }
];

export const Route = createFileRoute('/bonds/intro')({
  staticData: {
    moduleId: 'bonds',
    moduleName: 'Chemical Bonds',
    moduleOrder: 2,
    title: 'Introduction',
    order: 1,
    icon: '⚛️',
  },
  loader: async () => fetchVocabCardsBySourceIdsFn({
    data: LESSON_VOCAB.map(item => item.id)
  }),
  component: IntroLesson,
});

function IntroLesson() {
  const navProps = useModuleNavigation();
  const initialExistingCards = Route.useLoaderData() as VocabCard[];

  return (
    <LessonPage
      title="Introduction to Bonds"
      {...navProps}
    >
      <PageIntro>
        <PageIntro.Title>Lesson Demo</PageIntro.Title>
        <PageIntro.Description>
          <p>This page demonstrates the <code>LessonPage</code> wrapper and routing.</p>
          <p>Notice how the "Take the Quiz" button in the header and the footer card automatically route you to the next page using TanStack Router.</p>
        </PageIntro.Description>
      </PageIntro>

      <ConceptSection>
        <ConceptSection.Header stepNumber={1}>Why do atoms bond?</ConceptSection.Header>
        <ConceptSection.Body>
          <p>
            Atoms are always trying to reach the most stable state possible. They do this by interacting with other atoms' electron shells.
          </p>
          <InfoGrid>
            <InfoCard title="The Octet Rule" icon="⚛️">
              <p>Most atoms want exactly 8 electrons in their outermost shell to be perfectly stable.</p>
            </InfoCard>
            <InfoCard title="Energy State" icon="⚡">
              <p>Bonding lowers the total energy of the atoms, making the resulting molecule more stable.</p>
            </InfoCard>
          </InfoGrid>
        </ConceptSection.Body>
      </ConceptSection>

      <VocabularySection
        title="Key Vocabulary"
        description={<p>Review the terms below. Click a card to flip it and read the definition, then add it to your deck for spaced repetition practice.</p>}
        items={LESSON_VOCAB}
        initialExistingCards={initialExistingCards}
      />
    </LessonPage>
  );
}
