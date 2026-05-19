import React from 'react';
import { CardTypeDefinition, CardEditorProps, CardRenderProps } from '../../..';
import { MarkdownEditor } from '../../../common/MarkdownEditor/MarkdownEditor';
import { PureMarkdownFlashcard } from '../pure/Flashcard/PureMarkdownFlashcard';

const MarkdownEditorComponent = ({ payload, onChange }: CardEditorProps<'markdown'>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <div>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--lui-color-text-muted)' }}>Front (Markdown)</label>
      <MarkdownEditor 
        value={payload?.front || ''} 
        onChange={val => onChange({ ...payload, type: 'markdown', front: val })} 
        placeholder="# Question..." 
      />
    </div>
    <div>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--lui-color-text-muted)' }}>Back (Markdown)</label>
      <MarkdownEditor 
        value={payload?.back || ''} 
        onChange={val => onChange({ ...payload, type: 'markdown', back: val })} 
        placeholder="**Answer**..." 
      />
    </div>
  </div>
);

const MarkdownRenderer = ({ payload, isFlipped }: CardRenderProps<'markdown'>) => (
  <PureMarkdownFlashcard 
    isFlipped={isFlipped} 
    frontMarkdown={payload?.front || ''} 
    backMarkdown={payload?.back || ''} 
  />
);

/**
 * The standard Markdown flashcard type definition.
 * Ready to be injected into the VocabPage cardRegistry.
 */
export const markdownCardType: CardTypeDefinition<'markdown'> = {
  id: 'markdown',
  label: 'Standard Text (Markdown)',
  EditorComponent: MarkdownEditorComponent,
  RenderComponent: MarkdownRenderer,
};
