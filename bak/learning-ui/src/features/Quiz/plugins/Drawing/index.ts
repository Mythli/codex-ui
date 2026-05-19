import { QuestionTypePlugin } from '../../core/types/plugin';

// Fabric.js snapshots are complex JSON objects, so we use Record<string, unknown> to store the raw document state
export type DrawingAnswer = Record<string, unknown>;

export interface PureDrawingInputRef {
  exportSnapshot: () => Promise<Record<string, unknown> | null>;
  exportImage: (format: 'jpeg' | 'png') => Promise<string>;
  loadSnapshot: (snapshot: Record<string, unknown>) => void;
  clearCanvas: () => void;
}

const hasDrawableObjects = (answer: DrawingAnswer | null | undefined) => (
  Array.isArray(answer?.objects) && answer.objects.length > 0
);

export const drawingPlugin: QuestionTypePlugin<DrawingAnswer> = {
  type: 'drawing',
  isEmpty: (answer) => !hasDrawableObjects(answer),
};

export * from './PureDrawingInput';
export * from './PureDrawingQuestion';
