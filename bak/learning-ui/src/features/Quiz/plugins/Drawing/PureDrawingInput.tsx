import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { Canvas, PencilBrush } from 'fabric';
import { useHotkeys } from 'react-hotkeys-hook';
import { PureDrawingInputRef } from './index';
import { DrawingTool, DEFAULT_DRAWING_TOOLS } from './tools';
import styles from "./PureDrawingInput.module.css";

export type { DrawingTool };
export { DEFAULT_DRAWING_TOOLS };

// Helper component to dynamically bind hotkeys without violating React hook rules
function ToolHotkey({ tool, isEnabled, onTrigger }: { tool: DrawingTool, isEnabled: boolean, onTrigger: (tool: DrawingTool) => void }) {
  useHotkeys(tool.hotkey!, (e) => {
    e.preventDefault();
    onTrigger(tool);
  }, { enabled: isEnabled }, [isEnabled, tool, onTrigger]);
  
  return null;
}

export interface PureDrawingInputProps {
  onChange?: () => void;
  isReadOnly?: boolean;
  tools?: DrawingTool[];
  snapshot?: Record<string, unknown> | null;
}

export const PureDrawingInput = forwardRef<PureDrawingInputRef, PureDrawingInputProps>(
  ({ onChange, isReadOnly = false, tools = DEFAULT_DRAWING_TOOLS, snapshot = null }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasElementRef = useRef<HTMLCanvasElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
    const [pendingSnapshot, setPendingSnapshot] = useState<Record<string, unknown> | null>(null);
    const [activeToolId, setActiveToolId] = useState<string>('draw');
    const [isHovered, setIsHovered] = useState(false);

    // History State for Undo/Redo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const isHistoryAction = useRef<boolean>(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const onChangeRef = useRef(onChange);
    const loadedSnapshotJsonRef = useRef<string | null>(null);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const updateUndoRedoState = () => {
      setCanUndo(historyIndexRef.current >= 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    };

    const saveHistory = () => {
      if (isHistoryAction.current || !fabricCanvas) return;
      const json = JSON.stringify(fabricCanvas.toJSON());
      
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      
      // Prevent saving duplicate consecutive states
      if (currentIndex >= 0 && currentHistory[currentIndex] === json) return;

      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(json);
      
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      updateUndoRedoState();
      onChangeRef.current?.();
    };

    const undo = () => {
      if (!fabricCanvas || historyIndexRef.current < 0) return;
      
      isHistoryAction.current = true;
      const newIndex = historyIndexRef.current - 1;
      historyIndexRef.current = newIndex;
      
      const finalize = () => {
        fabricCanvas.renderAll();
        isHistoryAction.current = false;
        updateUndoRedoState();
        onChangeRef.current?.();
      };

      if (newIndex < 0) {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#ffffff';
        finalize();
      } else {
        const result = fabricCanvas.loadFromJSON(JSON.parse(historyRef.current[newIndex]));
        if (result && typeof result.then === 'function') {
          result.then(finalize);
        } else {
          finalize();
        }
      }
    };

    const redo = () => {
      if (!fabricCanvas || historyIndexRef.current >= historyRef.current.length - 1) return;
      
      isHistoryAction.current = true;
      const newIndex = historyIndexRef.current + 1;
      historyIndexRef.current = newIndex;
      
      const finalize = () => {
        fabricCanvas.renderAll();
        isHistoryAction.current = false;
        updateUndoRedoState();
        onChangeRef.current?.();
      };

      const result = fabricCanvas.loadFromJSON(JSON.parse(historyRef.current[newIndex]));
      if (result && typeof result.then === 'function') {
        result.then(finalize);
      } else {
        finalize();
      }
    };

    // 1. Initialize Fabric.js Canvas
    useEffect(() => {
      if (!canvasElementRef.current || !wrapperRef.current) return;

      const width = wrapperRef.current.offsetWidth;
      const height = 500;

      const canvas = new Canvas(canvasElementRef.current, {
        width,
        height,
        backgroundColor: '#ffffff',
        isDrawingMode: true,
      });

      // Configure default brush
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = '#2c3e50';
        canvas.freeDrawingBrush.width = 3;
      } else {
        const brush = new PencilBrush(canvas);
        brush.color = '#2c3e50';
        brush.width = 3;
        canvas.freeDrawingBrush = brush;
      }

      setFabricCanvas(canvas);

      // Cleanup on unmount
      return () => {
        canvas.dispose();
      };
    }, []);

    // 2. Handle Pending Snapshots (Loaded before canvas mounted)
    useEffect(() => {
      if (fabricCanvas && pendingSnapshot) {
        try {
          isHistoryAction.current = true;
          const result = fabricCanvas.loadFromJSON(pendingSnapshot);
          const finalize = () => {
            fabricCanvas.renderAll();
            historyRef.current = [JSON.stringify(pendingSnapshot)];
            historyIndexRef.current = 0;
            updateUndoRedoState();
            isHistoryAction.current = false;
          };
          
          if (result && typeof result.then === 'function') {
            result.then(finalize);
          } else {
            finalize();
          }
        } catch (e) {
          console.error("Failed to load fabric snapshot", e);
          isHistoryAction.current = false;
        }
        setPendingSnapshot(null);
      }
    }, [fabricCanvas, pendingSnapshot]);

    useEffect(() => {
      if (!snapshot) return;

      const nextSnapshotJson = JSON.stringify(snapshot);
      if (!fabricCanvas) {
        if (loadedSnapshotJsonRef.current !== nextSnapshotJson) {
          setPendingSnapshot(snapshot);
          loadedSnapshotJsonRef.current = nextSnapshotJson;
        }
        return;
      }

      const currentSnapshotJson = JSON.stringify(fabricCanvas.toJSON());
      if (currentSnapshotJson === nextSnapshotJson || loadedSnapshotJsonRef.current === nextSnapshotJson) return;

      try {
        isHistoryAction.current = true;
        const result = fabricCanvas.loadFromJSON(snapshot);
        const finalize = () => {
          fabricCanvas.renderAll();
          historyRef.current = [nextSnapshotJson];
          historyIndexRef.current = 0;
          loadedSnapshotJsonRef.current = nextSnapshotJson;
          updateUndoRedoState();
          isHistoryAction.current = false;
        };

        if (result && typeof result.then === 'function') {
          result.then(finalize);
        } else {
          finalize();
        }
      } catch (e) {
        console.error("Failed to load fabric snapshot", e);
        isHistoryAction.current = false;
      }
    }, [fabricCanvas, snapshot]);

    // 3. Sync ReadOnly & Tool State
    useEffect(() => {
      if (!fabricCanvas) return;

      if (isReadOnly) {
        fabricCanvas.isDrawingMode = false;
        fabricCanvas.selection = false;
        fabricCanvas.forEachObject((obj) => {
          obj.selectable = false;
          obj.evented = false;
        });
        fabricCanvas.discardActiveObject();
      } else {
        const currentTool = tools.find(t => t.id === activeToolId);
        if (currentTool) {
          currentTool.onActivate(fabricCanvas);
        }
      }

      fabricCanvas.renderAll();
    }, [fabricCanvas, isReadOnly, activeToolId, tools]);

    // 4. Listen for changes to trigger auto-save and history
    useEffect(() => {
      if (!fabricCanvas) return;

      const handleCanvasChange = () => {
        if (!isReadOnly) saveHistory();
      };

      fabricCanvas.on('object:added', handleCanvasChange);
      fabricCanvas.on('object:modified', handleCanvasChange);
      fabricCanvas.on('object:removed', handleCanvasChange);

      return () => {
        fabricCanvas.off('object:added', handleCanvasChange);
        fabricCanvas.off('object:modified', handleCanvasChange);
        fabricCanvas.off('object:removed', handleCanvasChange);
      };
    }, [fabricCanvas, isReadOnly]);

    // 5. Expose API to Parent (QuizContext)
    useImperativeHandle(ref, () => ({
      exportSnapshot: async () => {
        if (!fabricCanvas) return null;
        return fabricCanvas.toJSON() as Record<string, unknown>;
      },
      exportImage: async (format) => {
        if (!fabricCanvas) return '';
        const objects = fabricCanvas.getObjects();
        if (objects.length === 0) return '';

        try {
          // Multiplier increases the resolution of the exported image for the AI Vision model
          return fabricCanvas.toDataURL({
            format: format === 'jpeg' ? 'jpeg' : 'png',
            quality: 0.9,
            multiplier: 2,
          });
        } catch (e) {
          console.error("Failed to export fabric image", e);
          return '';
        }
      },
      loadSnapshot: (snapshot) => {
        if (fabricCanvas) {
          try {
            isHistoryAction.current = true;
            const result = fabricCanvas.loadFromJSON(snapshot);
            const finalize = () => {
              fabricCanvas.renderAll();
              historyRef.current = [JSON.stringify(snapshot)];
              historyIndexRef.current = 0;
              loadedSnapshotJsonRef.current = JSON.stringify(snapshot);
              updateUndoRedoState();
              isHistoryAction.current = false;
            };
            if (result && typeof result.then === 'function') {
              result.then(finalize);
            } else {
              finalize();
            }
          } catch (e) {
            console.error("Failed to load fabric snapshot", e);
            isHistoryAction.current = false;
          }
        } else {
          setPendingSnapshot(snapshot);
        }
      },
      clearCanvas: () => {
        if (!fabricCanvas) return;
        isHistoryAction.current = true;
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#ffffff';
        fabricCanvas.renderAll();
        historyRef.current = [];
        historyIndexRef.current = -1;
        updateUndoRedoState();
        isHistoryAction.current = false;
        onChangeRef.current?.();
      }
    }));

    // 6. Handle Tool Clicks
    const handleToolClick = (tool: DrawingTool) => {
      if (!fabricCanvas || isReadOnly) return;

      if (tool.id === 'undo') {
        undo();
        return;
      }
      if (tool.id === 'redo') {
        redo();
        return;
      }

      if (tool.isAction) {
        tool.onActivate(fabricCanvas);
        
        // If it's a shape/text insertion, switch to select mode automatically
        if (!tool.isDanger) {
          const selectTool = tools.find(t => t.id === 'select');
          if (selectTool) {
            setActiveToolId('select');
            selectTool.onActivate(fabricCanvas);
          }
        }
      } else {
        const prevTool = tools.find(t => t.id === activeToolId);
        if (prevTool?.onDeactivate) prevTool.onDeactivate(fabricCanvas);
        
        setActiveToolId(tool.id);
        tool.onActivate(fabricCanvas);
      }
    };

    const isToolDisabled = (tool: DrawingTool) => {
      if (isReadOnly) return true;
      if (tool.id === 'undo') return !canUndo;
      if (tool.id === 'redo') return !canRedo;
      return false;
    };

    return (
      <div 
        className={styles.container}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Dynamically bind hotkeys for all tools that define them */}
        {tools.map(tool => tool.hotkey ? (
          <ToolHotkey 
            key={`hotkey-${tool.id}`} 
            tool={tool} 
            isEnabled={isHovered && !isToolDisabled(tool)} 
            onTrigger={handleToolClick} 
          />
        ) : null)}

        {!isReadOnly && tools.length > 0 && (
          <div className={styles.toolbar}>
            {tools.map(tool => (
              <button
                key={tool.id}
                type="button"
                title={tool.hotkey ? `${tool.label} (${tool.hotkey})` : tool.label}
                disabled={isToolDisabled(tool)}
                className={`${styles.toolBtn} ${activeToolId === tool.id && !tool.isAction ? styles.toolBtnActive : ''} ${tool.isDanger ? styles.toolBtnDanger : ''}`}
                onClick={() => handleToolClick(tool)}
              >
                {tool.icon} {tool.label}
              </button>
            ))}
          </div>
        )}

        <div ref={wrapperRef} className={`${styles.canvasWrapper} ${isReadOnly ? styles.readOnly : ''}`}>
          <canvas ref={canvasElementRef} />
        </div>
      </div>
    );
  }
);

PureDrawingInput.displayName = 'PureDrawingInput';
