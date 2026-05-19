import React from 'react';
import { Canvas } from 'fabric';

export interface DrawingTool {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Optional keyboard shortcut to activate this tool (e.g., 'mod+z', 'p', 'backspace') */
  hotkey?: string;
  /** If true, the tool acts as a one-time click (like dropping a shape) rather than an active mode */
  isAction?: boolean;
  /** If true, styles the button as a destructive action */
  isDanger?: boolean;
  onActivate: (canvas: Canvas) => void;
  onDeactivate?: (canvas: Canvas) => void;
}
