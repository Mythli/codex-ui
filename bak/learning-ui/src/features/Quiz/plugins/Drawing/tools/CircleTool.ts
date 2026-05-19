import { Circle } from 'fabric';
import { DrawingTool } from './types';

export const CircleTool: DrawingTool = {
  id: 'circle',
  label: 'Circle',
  icon: '⭕',
  hotkey: 'c',
  isAction: true,
  onActivate: (canvas) => {
    const circle = new Circle({
      radius: 40,
      fill: 'transparent',
      stroke: '#e94560',
      strokeWidth: 3,
      left: 100,
      top: 100,
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
  }
};
