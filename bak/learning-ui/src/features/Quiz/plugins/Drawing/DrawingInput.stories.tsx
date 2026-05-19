import { useRef } from 'react';
import type { Story } from '@ladle/react';
import { PureDrawingInput } from "./PureDrawingInput";
import { PureDrawingInputRef } from "./index";

export default {
  title: 'Features/Quiz/Pure/DrawingInput',
};

export const Default: Story = () => {
  const drawingRef = useRef<PureDrawingInputRef>(null);

  const handleExport = async () => {
    if (drawingRef.current) {
      const image = await drawingRef.current.exportImage('png');
      console.log('Exported Image Base64:', image ? image.substring(0, 50) + '...' : 'Empty');
      alert('Image exported! Check console.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <PureDrawingInput ref={drawingRef} />
      <button 
        onClick={handleExport}
        style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}
      >
        Test Export Image
      </button>
    </div>
  );
};

export const ReadOnly: Story = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h3>Read-Only Mode (Toolbar hidden, canvas locked)</h3>
      <PureDrawingInput isReadOnly={true} />
    </div>
  );
};
