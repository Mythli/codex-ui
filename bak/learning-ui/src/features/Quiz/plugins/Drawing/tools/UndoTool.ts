import { DrawingTool } from './types';

export const UndoTool: DrawingTool = {
  id: 'undo',
  label: 'Undo',
  icon: '↶',
  hotkey: 'mod+z',
  isAction: true,
  onActivate: () => {}, // Handled internally
};
