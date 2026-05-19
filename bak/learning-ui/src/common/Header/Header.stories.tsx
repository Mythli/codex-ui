import type { Story } from '@ladle/react';
import type { ReactNode } from 'react';
import { Header } from './Header';

export default {
  title: 'Common/Header',
};

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ minHeight: '100vh', background: 'var(--lui-color-bg-alt)', padding: 24 }}>
    <div style={{ overflow: 'hidden', border: '1px solid var(--lui-color-border)', borderRadius: 8 }}>
      {children}
    </div>
  </div>
);

export const LessonHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
        <Header.NavButton direction="prev" label="Quiz" onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="Gas Laws" />
      </Header.Center>
      <Header.Right>
        <Header.NavButton direction="next" label="States of Matter" onClick={() => undefined} />
      </Header.Right>
    </Header>
  </Frame>
);

export const QuizHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
        <Header.NavButton direction="prev" label="Introduction" onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="Full-Stack Quiz">
          <Header.Progress value={4} max={7} label="answered" />
        </Header.Title>
      </Header.Center>
      <Header.Right>
        <Header.Metric tone="success">8/10 pts</Header.Metric>
        <Header.ResetButton onReset={() => undefined} />
        <Header.NavButton direction="next" label="Gas Laws" onClick={() => undefined} />
      </Header.Right>
    </Header>
  </Frame>
);

export const ActiveExamHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="Full-Stack Quiz Exam">
          <Header.Progress value={3} max={7} label="answered" />
        </Header.Title>
      </Header.Center>
      <Header.Right>
        <Header.Metric tone="warning">12:42</Header.Metric>
        <Header.ActionButton
          label="3/7 answered"
          title="Submit exam"
          indicator="✓"
          onClick={() => undefined}
        />
      </Header.Right>
    </Header>
  </Frame>
);

export const StartExamHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
        <Header.NavButton direction="prev" label="Quiz" onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="Full-Stack Quiz Exam" />
      </Header.Center>
      <Header.Right>
        <Header.ActionButton
          label="15:00 limit"
          title="Start exam"
          indicator="→"
          variant="success"
          onClick={() => undefined}
        />
      </Header.Right>
    </Header>
  </Frame>
);

export const SubmittingExamHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton disabled onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="Full-Stack Quiz Exam">
          <Header.Progress value={7} max={7} label="answered" />
        </Header.Title>
      </Header.Center>
      <Header.Right>
        <Header.Metric>00:18</Header.Metric>
        <Header.ActionButton
          label="7/7 answered"
          title="Submitting"
          isLoading
          onClick={() => undefined}
        />
      </Header.Right>
    </Header>
  </Frame>
);

export const SubmittedExamHeader: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
        <Header.NavButton direction="prev" label="Quiz" onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title
          title="Full-Stack Quiz Exam"
          actions={<Header.ResetButton onReset={() => undefined} />}
        />
      </Header.Center>
      <Header.Right>
        <Header.NavButton direction="next" label="Gas Laws" onClick={() => undefined} />
      </Header.Right>
    </Header>
  </Frame>
);

export const DenseActions: Story = () => (
  <Frame>
    <Header>
      <Header.Left>
        <Header.BurgerButton onClick={() => undefined} />
        <Header.IconButton icon="?" label="Help" onClick={() => undefined} />
        <Header.IconButton icon="C" label="Calculator" onClick={() => undefined} />
      </Header.Left>
      <Header.Center>
        <Header.Title title="The Periodic Patterns">
          <Header.Progress value={2} max={3} label="discoveries" />
        </Header.Title>
      </Header.Center>
      <Header.Right>
        <Header.IconButton icon="T" label="Open table" onClick={() => undefined} />
        <Header.ResetButton onReset={() => undefined} />
        <Header.NavButton direction="next" label="The Rules of Connection" onClick={() => undefined} />
      </Header.Right>
    </Header>
  </Frame>
);
