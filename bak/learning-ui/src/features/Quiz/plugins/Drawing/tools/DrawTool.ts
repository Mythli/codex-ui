import { DrawingTool } from './types';

export const DrawTool: DrawingTool = {
  id: 'draw',
  label: 'Draw',
  icon: '✏️',
  hotkey: 'p',
  onActivate: (canvas) => {
    canvas.isDrawingMode = true;
    canvas.selection = false;
    canvas.forEachObject(obj => {
      obj.selectable = false;
      obj.evented = false;
    });
  },
};
