import { DrawingTool } from './types';

export const RedoTool: DrawingTool = {
  id: 'redo',
  label: 'Redo',
  icon: '↷',
  hotkey: 'mod+y, mod+shift+z',
  isAction: true,
  onActivate: () => {}, // Handled internally
};
