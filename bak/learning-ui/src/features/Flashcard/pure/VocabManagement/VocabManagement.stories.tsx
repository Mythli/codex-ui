import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureVocabTable, VocabTableRow } from "./PureVocabTable";
import { PureBulkActionBar } from "./PureBulkActionBar";

export default {
  title: 'Features/Flashcard/Pure/VocabManagement',
};

const MOCK_DATA: VocabTableRow[] = [
  {
    id: '1',
    frontSummary: 'What is the powerhouse of the cell?',
    tags: [{ id: 'bio', label: 'Biology 101', color: 'success' }],
    status: 'mastered'
  },
  {
    id: '2',
    frontSummary: 'Translate: "The library is closed."',
    tags: [{ id: 'span', label: 'Spanish', color: 'warning' }],
    status: 'due'
  },
  {
    id: '3',
    frontSummary: 'Time complexity of binary search',
    tags: [{ id: 'cs', label: 'Computer Science', color: 'info' }],
    status: 'learning'
  },
  {
    id: '4',
    frontSummary: 'Capital of Japan',
    tags: [{ id: 'geo', label: 'Geography', color: 'danger' }],
    status: 'new'
  }
];

export const TableAndBulkActions: Story = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleToggleSelect = (id: string, isShiftPressed: boolean = false) => {
    const currentIndex = MOCK_DATA.findIndex(c => c.id === id);
    const lastIndex = lastSelectedId ? MOCK_DATA.findIndex(c => c.id === lastSelectedId) : -1;

    if (isShiftPressed && lastIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const idsInRange = MOCK_DATA.slice(start, end + 1).map(c => c.id);

      const isCurrentlySelected = selectedIds.includes(id);
      
      if (isCurrentlySelected) {
        setSelectedIds(prev => prev.filter(x => !idsInRange.includes(x)));
      } else {
        setSelectedIds(prev => Array.from(new Set([...prev, ...idsInRange])));
      }
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
    setLastSelectedId(id);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === MOCK_DATA.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(MOCK_DATA.map(x => x.id));
    }
  };

  return (
    <div style={{ padding: '40px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <h2 style={{ color: 'var(--lui-color-text-main)', marginBottom: '20px', fontFamily: 'var(--lui-font-family)' }}>
        Vocabulary Library
      </h2>
      
      <PureVocabTable 
        data={MOCK_DATA}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onEdit={(id) => alert(`Edit card ${id}`)}
      />

      <PureBulkActionBar 
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onReview={() => alert(`Starting custom review session with ${selectedIds.length} cards!`)}
        onDelete={() => alert(`Deleting ${selectedIds.length} cards!`)}
      />
    </div>
  );
};
