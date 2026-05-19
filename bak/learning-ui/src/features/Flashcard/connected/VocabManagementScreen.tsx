import React, { useState, useEffect, useMemo } from 'react';
import { VocabCard, FlashcardPluginRegistry, getVocabCardStatus, getVocabCardType } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { PageIntro } from '../../../common/PageIntro/PageIntro';
import { Button } from '../../../common/Button/Button';
import { Pagination } from '../../../common/Pagination/Pagination';
import { PureVocabTable, VocabTableRow } from '../pure/VocabManagement/PureVocabTable';
import { PureBulkActionBar } from '../pure/VocabManagement/PureBulkActionBar';
import { PureCardEditorShell } from '../pure/Flashcard/PureCardEditorShell';
import { ConfirmModal } from '../../../common/ConfirmModal/ConfirmModal';
import { PureVocabEmptyState } from '../pure/Flashcard/PureVocabEmptyState';
import { FilterTag as VocabFilterTag } from '../pure/Flashcard/PureVocabFilterBar';
import { PureVocabFilterBar } from '../pure/Flashcard/PureVocabFilterBar';
import { requireLearningUIDependency, useLearningUIConfig } from '../../../system/LocaleContext';
import styles from './VocabManagementScreen.module.css';

export interface VocabManagementScreenProps {
  /** Pre-fetched cards to render immediately during SSR/hydration */
  initialCards?: VocabCard[];
  /** Pre-fetched tags to render filters immediately during SSR/hydration */
  initialTags?: VocabFilterTag[];
  /** Callback fired when the user selects cards and clicks "Review Selected" */
  onNavigateToReview?: (selectedIds: string[]) => void;
}

export function VocabManagementScreen({
  initialCards,
  initialTags,
  onNavigateToReview
}: VocabManagementScreenProps) {
  const learningUI = useLearningUIConfig();
  const resolvedBackend = requireLearningUIDependency(
    learningUI.adapters?.vocab,
    'VocabManagementScreen backend'
  );
  const resolvedCardRegistry = requireLearningUIDependency(
    learningUI.plugins?.vocabCards,
    'VocabManagementScreen cardRegistry'
  );
  // Data State
  const [cards, setCards] = useState<VocabCard[]>(initialCards || []);
  const [availableTags, setAvailableTags] = useState<VocabFilterTag[]>(initialTags || []);
  const [isLoading, setIsLoading] = useState(!initialCards || !initialTags);
  
  // Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 

  // Selection & Modal State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<VocabCard | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Async Action States
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial Load
  useEffect(() => {
    if (initialCards && initialTags) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [cardsData, tagsData] = await Promise.all([
          resolvedBackend.fetchAllCards(),
          resolvedBackend.fetchAvailableTags()
        ]);
        setCards(cardsData);
        setAvailableTags(tagsData);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [resolvedBackend, initialCards, initialTags]);

  // Derived State: Filtering
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        JSON.stringify(card.payload).toLowerCase().includes(searchLower) ||
        (card.frontMarkdown || '').toLowerCase().includes(searchLower) ||
        (card.backMarkdown || '').toLowerCase().includes(searchLower);
        
      const matchesTags = activeTags.length === 0 || 
        activeTags.every(tag => (card.tags || []).includes(tag));
        
      const cardStatus = getVocabCardStatus(card);
      const matchesStatus = activeStatuses.length === 0 || activeStatuses.includes(cardStatus);
        
      return matchesSearch && matchesTags && matchesStatus;
    });
  }, [cards, searchQuery, activeTags, activeStatuses]);

  // Derived State: Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / ITEMS_PER_PAGE));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCards.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCards, currentPage]);

  // Derived State: Table Mapping
  const tableData: VocabTableRow[] = useMemo(() => {
    return paginatedCards.map(card => {
      let frontText = card.frontMarkdown || 'Empty Card';
      if (getVocabCardType(card) === 'markdown') {
        frontText = (card.payload as FlashcardPluginRegistry['markdown']).front || frontText;
      } else if (card.payload && typeof card.payload === 'object' && 'front' in card.payload) {
        frontText = String(card.payload.front);
      }

      const cardTags = (card.tags || []).map(tagId => {
        const found = availableTags.find(t => t.id === tagId);
        return found || { id: tagId, label: tagId };
      });
      return {
        id: card.id,
        frontSummary: frontText,
        tags: cardTags,
        status: getVocabCardStatus(card)
      };
    });
  }, [paginatedCards, availableTags]);

  // Handlers
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleToggleSelect = (id: string, isShiftPressed: boolean = false) => {
    const currentIndex = paginatedCards.findIndex(c => c.id === id);
    const lastIndex = lastSelectedId ? paginatedCards.findIndex(c => c.id === lastSelectedId) : -1;

    if (isShiftPressed && lastIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const idsInRange = paginatedCards.slice(start, end + 1).map(c => c.id);

      const isCurrentlySelected = selectedIds.includes(id);
      
      if (isCurrentlySelected) {
        // Deselect range
        setSelectedIds(prev => prev.filter(x => !idsInRange.includes(x)));
      } else {
        // Select range
        setSelectedIds(prev => Array.from(new Set([...prev, ...idsInRange])));
      }
    } else {
      // Normal toggle
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
    
    setLastSelectedId(id);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedCards.length && paginatedCards.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedCards.map(c => c.id));
    }
  };

  const handleCreateNew = () => {
    setEditingCard(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card) {
      setEditingCard(card);
      setIsEditorOpen(true);
    }
  };

  const handleSaveCard = async <K extends keyof FlashcardPluginRegistry>(data: { payload: FlashcardPluginRegistry[K]; tags: string[] }) => {
    setIsSaving(true);
    try {
      // Normalize tags: trim whitespace, convert to lowercase, and remove duplicates
      const normalizedTags = Array.from(new Set(data.tags.map(t => t.trim().toLowerCase()).filter(Boolean)));

      if (editingCard) {
        const updated = await resolvedBackend.updateCard(editingCard.id, { payload: data.payload, tags: normalizedTags });
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        // Generate a unique sourceId for manually created cards
        const sourceId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const created = await resolvedBackend.createCard({ sourceId, payload: data.payload, tags: normalizedTags });
        setCards(prev => [created, ...prev]);
      }
      
      // Dynamically add any new tags to the availableTags state so they appear in the filter dropdown immediately
      const newTags = normalizedTags.filter(t => !availableTags.find(at => at.id === t));
      if (newTags.length > 0) {
        setAvailableTags(prev => [...prev, ...newTags.map(t => ({ id: t, label: t }))]);
      }

      setIsEditorOpen(false);
      setEditingCard(null);
    } catch (err) {
      console.error("Failed to save card", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    try {
      await resolvedBackend.deleteCards(selectedIds);
      setCards(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error("Failed to delete cards", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <PageIntro>
        <PageIntro.Title>Vocabulary Library</PageIntro.Title>
        <PageIntro.Description>
          Search, edit, and organize your flashcards. Select specific cards to launch a custom review session.
        </PageIntro.Description>
      </PageIntro>

      <PureVocabFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search words, definitions, or markdown..."
        availableTags={availableTags}
        activeTags={activeTags}
        onTagsChange={(tags) => { setActiveTags(tags); setCurrentPage(1); }}
        availableStatuses={STATUS_OPTIONS}
        activeStatuses={activeStatuses}
        onStatusesChange={(statuses) => { setActiveStatuses(statuses); setCurrentPage(1); }}
        actionButton={<Button variant="primary" onClick={handleCreateNew}>+ New Card</Button>}
      />

      {isLoading ? (
        <PureVocabTable.Skeleton rowCount={ITEMS_PER_PAGE} />
      ) : cards.length === 0 ? (
        <PureVocabEmptyState 
          title="Your deck is empty"
          message="Start building your knowledge base by creating your first flashcard."
        />
      ) : filteredCards.length === 0 ? (
        <PureVocabEmptyState 
          title="No cards found"
          message="We couldn't find any cards matching your current filters."
          onClearFilters={() => { setSearchQuery(''); setActiveTags([]); setActiveStatuses([]); }}
        />
      ) : (
        <>
          <PureVocabTable 
            data={tableData}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onEdit={handleEdit}
          />
          
          {totalPages > 1 && (
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          )}
        </>
      )}

      <PureBulkActionBar 
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onDelete={() => setIsDeleteModalOpen(true)}
        onReview={() => onNavigateToReview?.(selectedIds)}
      />

      <PureCardEditorShell 
        isOpen={isEditorOpen}
        title={editingCard ? "Edit Card" : "Create New Card"}
        registry={resolvedCardRegistry}
        availableTags={availableTags}
        initialType={editingCard ? getVocabCardType(editingCard) : undefined}
        initialPayload={editingCard?.payload}
        initialTagIds={editingCard?.tags}
        isSaving={isSaving}
        onSave={handleSaveCard}
        onCancel={() => { setIsEditorOpen(false); setEditingCard(null); }}
      />

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title="Delete Cards?"
        message={`Are you sure you want to delete ${selectedIds.length} cards? This will also erase their review history. This cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        isLoading={isDeleting}
        onConfirm={handleDeleteSelected}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
