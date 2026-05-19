import { IText } from 'fabric';
import { DrawingTool } from './types';

export const TextTool: DrawingTool = {
  id: 'text',
  label: 'Text',
  icon: '🔤',
  hotkey: 't',
  isAction: true,
  onActivate: (canvas) => {
    const text = new IText('Type here', {
      left: 100,
      top: 100,
      fontFamily: 'sans-serif',
      fontSize: 24,
      fill: '#2c3e50',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
  }
};
