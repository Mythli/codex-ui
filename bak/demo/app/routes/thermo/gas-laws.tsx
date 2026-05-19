import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MdTune, MdColorLens, MdRefresh } from 'react-icons/md';
import {
  ExperimentPage,
  type ExperimentSession,
  ObservationsSection,
  LockedSection,
  useExperiment,
  PageIntro,
  ConceptSection,
  ChallengeFeedbackZone,
  ExperimentInputSlider,
  ControlIconButton,
  ControlPopover,
  ChallengeRenderContext,
  Accordion,
  ExperimentStatItem,
  ChallengeArena,
  ChallengeProps
} from '@taylordb/learning-ui';
import { fetchExperimentFn } from '../../features/experiment/server-fns';
import { useModuleNavigation } from '../../core/navigation';

const EXPERIMENT_ID = 'demo-gas-laws';

export const Route = createFileRoute('/thermo/gas-laws')({
  staticData: {
    moduleId: 'thermo',
    moduleName: 'Thermodynamics',
    moduleOrder: 3,
    title: 'Gas Laws',
    order: 1,
    icon: '🌡️',
  },
  component: GasLawsExperiment,
  loader: async () => fetchExperimentFn({ data: EXPERIMENT_ID }),
});

type GasLawSlices = {
  box_x?: number;
  box_color?: string;
  [key: string]: unknown;
};

// Pre-bind the generic type to the Challenge component reference.
// This keeps JSX clean while preserving the reference equality needed by ChallengeArena.
const GasLawChallenge = ChallengeArena.Challenge as React.FC<ChallengeProps<GasLawSlices>>;

const SharedControls = ({ 
  slices, 
  setSlice, 
  restoreCheckpoint, 
  showColor = true, 
  showPosition = true 
}: ChallengeRenderContext<GasLawSlices> & { showColor?: boolean; showPosition?: boolean }) => (
  <>
    {showColor && (
      <ControlPopover
        icon={<MdColorLens />}
        label="Change Color"
        placement="bottom-end"
      >
        <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
          <button onClick={() => setSlice('box_color', '#e94560')} style={{ background: '#e94560', width: '30px', height: '30px', border: slices.box_color === '#e94560' ? '2px solid white' : 'none', borderRadius: '4px', cursor: 'pointer' }} />
          <button onClick={() => setSlice('box_color', '#3b82f6')} style={{ background: '#3b82f6', width: '30px', height: '30px', border: slices.box_color === '#3b82f6' ? '2px solid white' : 'none', borderRadius: '4px', cursor: 'pointer' }} />
          <button onClick={() => setSlice('box_color', '#4ade80')} style={{ background: '#4ade80', width: '30px', height: '30px', border: slices.box_color === '#4ade80' ? '2px solid white' : 'none', borderRadius: '4px', cursor: 'pointer' }} />
        </div>
      </ControlPopover>
    )}
    {showPosition && (
      <ControlPopover
        icon={<MdTune />}
        label="Adjust Position"
        placement="bottom-end"
      >
        <div style={{ padding: '16px', width: '250px' }}>
          <ExperimentInputSlider
            label="Position X"
            min={0}
            max={500}
            step={10}
            value={(slices.box_x as number) || 0}
            onChange={(v) => setSlice('box_x', v as number)}
            indicatorValue={(slices.box_x as number) || 0}
          />
        </div>
      </ControlPopover>
    )}
    <ControlIconButton
      icon={<MdRefresh />}
      label="Reset Canvas to Checkpoint"
      onClick={restoreCheckpoint}
    />
  </>
);

function PersistentBoxCanvas() {
  const { state } = useExperiment();
  const boxX = (state.slices.box_x as number) || 0;
  const boxColor = (state.slices.box_color as string) || '#e94560';

  return (
    <>
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: `${boxX}px`, 
        transform: 'translateY(-50%)',
        width: '60px', 
        height: '60px', 
        backgroundColor: boxColor,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        transition: 'left 0.2s ease-out, background-color 0.2s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold'
      }}>
        Box
      </div>
      
      <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', padding: '16px', borderRadius: '8px', color: '#ccc', maxWidth: '300px', fontSize: '0.85rem' }}>
        <strong>Test the Checkpoint & Reset:</strong>
        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Play in the Explore step, move the box, then click Next.</li>
          <li>Notice the canvas <strong>automatically resets</strong> for Challenge 1!</li>
          <li>Beat Challenge 1 (Move box to 200) and click Next.</li>
          <li>In Challenge 2, mess up the state (e.g., move box back to 0).</li>
          <li>Click the <strong>Undo (↶)</strong> button in the header.</li>
          <li>Notice the box snaps back to X=200 (the start of Challenge 2).</li>
        </ol>
      </div>
    </>
  );
}

function GasLawsExperiment() {
  const navProps = useModuleNavigation();
  const initialExperiment = Route.useLoaderData() as ExperimentSession;

  return (
    <ExperimentPage
      experimentId={EXPERIMENT_ID}
      possibleObservations={initialExperiment.experiment.observations}
      title={initialExperiment.experiment.title}
      {...navProps}
    >
      <PageIntro>
        <PageIntro.Title>The Smart Experiment Engine</PageIntro.Title>
        <PageIntro.Description>
          <p>
            This page demonstrates the full power of the Experiment Engine, including 
            <strong> Checkpoint Restoration</strong> and <strong>Free Navigation</strong>. Play with the simulator, complete the challenges, 
            and try the "Undo" button to see your past states restored automatically.
          </p>
        </PageIntro.Description>
      </PageIntro>

      <ChallengeArena<GasLawSlices> historyKey="demo_history" title="Checkpoint Demo" stepNumber={1} dark>
        
        <GasLawChallenge
          id="c0" 
          type="explore" 
          question={'Explore the canvas. This Markdown string includes a custom molecule tag: `molecule:O`.'}
          isSuccess={() => true}
          renderFeedback={(ctx) => (
            <ChallengeFeedbackZone 
              status="explore" 
              message={'Take your time to play around. The feedback zone uses the same renderer: `molecule:CCO`.'}
              onSubmitAndAdvance={(!ctx.isLastChallenge && !ctx.isCompleted) ? () => ctx.submitAndAdvance() : undefined} 
            />
          )}
          renderControls={(ctx) => <SharedControls {...ctx} />}
        />

        <GasLawChallenge
          id="c1" 
          type="challenge" 
          question="Move the box to the right (Position >= 200)."
          onRestore={(baseState) => ({ ...baseState, box_x: 0, box_color: '#e94560' })}
          isSuccess={({ slices }) => ((slices.box_x as number) || 0) >= 200}
          renderFeedback={(ctx) => {
            const success = ((ctx.slices.box_x as number) || 0) >= 200;
            return (
              <ChallengeFeedbackZone 
                status={success ? 'success' : 'building'} 
                message={success ? <strong>Great! The box is in position.</strong> : 'Use the slider to move the box.'} 
                onSubmitAndAdvance={(success && !ctx.isLastChallenge && !ctx.isCompleted) ? () => ctx.submitAndAdvance() : undefined} 
              />
            );
          }}
          renderControls={(ctx) => <SharedControls {...ctx} showColor={false} />}
        />

        <GasLawChallenge
          id="c2" 
          type="challenge" 
          question="Change the box color to Blue."
          isSuccess={({ slices }) => slices.box_color === '#3b82f6'}
          renderFeedback={(ctx) => {
            const success = ctx.slices.box_color === '#3b82f6';
            return (
              <ChallengeFeedbackZone 
                status={success ? 'success' : 'building'} 
                message={success ? <strong>Excellent! The box is now blue.</strong> : 'Use the color picker to change the box to blue.'} 
                onSubmitAndAdvance={(success && !ctx.isLastChallenge && !ctx.isCompleted) ? () => ctx.submitAndAdvance() : undefined} 
              />
            );
          }}
          renderControls={(ctx) => <SharedControls {...ctx} showPosition={false} />}
          renderSidebar={({ slices }) => (
            <Accordion>
              <Accordion.Item defaultExpanded>
                <Accordion.Header>Box Properties</Accordion.Header>
                <Accordion.Content>
                  <ExperimentStatItem label="Current Color" value={(slices.box_color as string) || '#e94560'} />
                  <ExperimentStatItem label="Target Color" value="#3b82f6" />
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          )}
        />

        <GasLawChallenge
          id="c3" 
          type="challenge" 
          question="Move the box further right (Position >= 400)."
          isSuccess={({ slices }) => ((slices.box_x as number) || 0) >= 400}
          renderFeedback={(ctx) => {
            const success = ((ctx.slices.box_x as number) || 0) >= 400;
            return (
              <ChallengeFeedbackZone 
                status={success ? 'success' : 'building'} 
                message={success ? <strong>Perfect! You completed all challenges.</strong> : 'Move the box to Position >= 400.'} 
                onSubmitAndAdvance={(success && !ctx.isLastChallenge && !ctx.isCompleted) ? () => ctx.submitAndAdvance() : undefined} 
              />
            );
          }}
          renderControls={(ctx) => <SharedControls {...ctx} showColor={false} />}
        />

        <PersistentBoxCanvas />
      </ChallengeArena>

      <ObservationsSection 
        stepNumber={2}
        placeholder="Type 'heat makes things move faster' to trigger the real AI backend..."
      />

      <LockedSection requiredObservationId="heat_motion">
        <ConceptSection>
          <ConceptSection.Header stepNumber={3}>Discovery: Heat is Motion!</ConceptSection.Header>
          <ConceptSection.Body>
            <p>
              <strong>Magic!</strong> This section automatically unlocked because the Context 
              registered that you discovered the <code>heat_motion</code> pattern. 
            </p>
          </ConceptSection.Body>
        </ConceptSection>
      </LockedSection>

    </ExperimentPage>
  );
}
