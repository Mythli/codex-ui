import { DrawingTool } from './types';

export const SelectTool: DrawingTool = {
  id: 'select',
  label: 'Select / Move',
  icon: '👆',
  hotkey: 'v',
  onActivate: (canvas) => {
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject(obj => {
      obj.selectable = true;
      obj.evented = true;
    });
  },
};
