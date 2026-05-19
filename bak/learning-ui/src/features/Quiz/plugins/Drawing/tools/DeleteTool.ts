import { DrawingTool } from './types';

export const DeleteTool: DrawingTool = {
  id: 'delete',
  label: 'Delete Selected',
  icon: '🗑️',
  hotkey: 'backspace, delete',
  isAction: true,
  isDanger: true,
  onActivate: (canvas) => {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
      canvas.discardActiveObject();
      activeObjects.forEach((obj) => canvas.remove(obj));
    }
  }
};
