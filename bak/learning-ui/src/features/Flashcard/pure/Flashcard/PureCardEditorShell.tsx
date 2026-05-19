import React, { useState, useEffect } from 'react';
import { Modal } from "../../../../common/Modal/Modal";
import { Button } from "../../../../common/Button/Button";
import { Select } from "../../../../common/Select/Select";
import { TagSelect, TagOption } from "../../../../common/TagSelect/TagSelect";
import { CardTypeDefinition, FlashcardPluginRegistry } from "../../types";
import { BadgeColor } from "../../../../common/Badge/PureBadge";
import styles from "./PureCardEditorShell.module.css";

export interface PureCardEditorShellProps {
  isOpen: boolean;
  title?: string;
  registry: CardTypeDefinition[];
  availableTags: { id: string; label: string; color?: BadgeColor }[];
  initialType?: keyof FlashcardPluginRegistry;
  initialPayload?: unknown;
  initialTagIds?: string[];
  /** If true, shows a loading spinner on the save button and locks the modal */
  isSaving?: boolean;
  onSave: <K extends keyof FlashcardPluginRegistry>(data: { payload: FlashcardPluginRegistry[K]; tags: string[] }) => void;
  onCancel: () => void;
}

export function PureCardEditorShell({
  isOpen,
  title = 'Edit Card',
  registry,
  availableTags,
  initialType,
  initialPayload,
  initialTagIds = [],
  isSaving = false,
  onSave,
  onCancel
}: PureCardEditorShellProps) {
  const defaultType = initialType || (registry.length > 0 ? registry[0].id : 'markdown');
  const [type, setType] = useState<keyof FlashcardPluginRegistry>(defaultType);
  const [payload, setPayload] = useState<unknown>(initialPayload || {});
  const [tags, setTags] = useState<string[]>(initialTagIds);

  // Reset state when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setType(initialType || (registry.length > 0 ? registry[0].id : 'markdown'));
      setPayload(initialPayload || { type: initialType || (registry.length > 0 ? registry[0].id : 'markdown') });
      setTags(initialTagIds || []);
    }
  }, [isOpen, initialType, initialPayload, initialTagIds, registry]);

  const activeDef = registry.find(r => r.id === type);
  const EditorComponent = activeDef?.EditorComponent as React.ComponentType<{ payload: unknown; onChange: (payload: unknown) => void }> | undefined;

  const handleSave = () => {
    const payloadWithType = {
      ...(payload && typeof payload === 'object' ? payload : {}),
      type,
    } as FlashcardPluginRegistry[typeof type];
    onSave({ payload: payloadWithType, tags });
  };

  const typeOptions = registry.map(def => ({ value: def.id, label: def.label }));
  const selectedTypeOption = typeOptions.find(o => o.value === type) || typeOptions[0];

  // Map available tags to TagSelect format
  const tagOptions: TagOption[] = availableTags.map(t => ({ value: t.id, label: t.label, color: t.color }));
  const selectedTagOptions: TagOption[] = tags.map(id => {
    const found = tagOptions.find(o => o.value === id);
    return found || { value: id, label: id };
  });

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onCancel} 
      size="large" 
      ariaLabel={title}
      isLocked={isSaving}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>

        {registry.length > 1 && (
          <div className={styles.typeSelector}>
            <label className={styles.label}>Card Type</label>
            <Select 
              options={typeOptions}
              value={selectedTypeOption}
              onChange={(option) => {
                const opt = option as { value: string; label: string } | null;
                if (opt) {
                  setType(opt.value as keyof FlashcardPluginRegistry);
                  setPayload({ type: opt.value }); // Reset payload when type changes
                }
              }}
              isDisabled={isSaving}
            />
          </div>
        )}

        <div className={styles.editorArea}>
          {EditorComponent ? (
            <EditorComponent payload={payload} onChange={setPayload} />
          ) : (
            <div style={{ color: 'var(--lui-color-danger)' }}>Unsupported card type selected.</div>
          )}
        </div>

        <div className={styles.typeSelector}>
          <label className={styles.label}>Tags</label>
          <TagSelect 
            options={tagOptions}
            value={selectedTagOptions}
            onChange={(selected) => setTags(selected.map(s => s.value))}
            placeholder="Type to create a new tag..."
            isDisabled={isSaving}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>Save Card</Button>
        </div>
      </div>
    </Modal>
  );
}
