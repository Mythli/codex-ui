import { ReactNode, useMemo } from 'react';
import { Callout, type CalloutVariant } from '../Callout/Callout';
import { LearningMarkdown } from '../Markdown';
import styles from './MessageGroup.module.css';

export type MessageGroupItemType = 'success' | 'info' | 'warning' | 'error';

export interface MessageGroupItem {
  type: MessageGroupItemType;
  title?: ReactNode;
  content: string | ReactNode;
}

export interface MessageGroupProps {
  items: MessageGroupItem[];
}

const TYPE_TO_VARIANT: Record<MessageGroupItemType, CalloutVariant> = {
  success: 'success',
  info: 'insight',
  warning: 'warning',
  error: 'error',
};

const TYPE_TO_TITLE: Record<MessageGroupItemType, string> = {
  success: 'Success',
  info: 'Details',
  warning: 'Review',
  error: 'Needs attention',
};

const renderContent = (content: string | ReactNode, compact = false) => (
  typeof content === 'string'
    ? <LearningMarkdown className={compact ? styles.compactMarkdown : undefined}>{content}</LearningMarkdown>
    : content
);

export function MessageGroup({ items }: MessageGroupProps) {
  const groups = useMemo(() => {
    const next: Array<{ type: MessageGroupItemType; items: MessageGroupItem[] }> = [];

    for (const item of items) {
      const group = next.find((entry) => entry.type === item.type);
      if (group) {
        group.items.push(item);
      } else {
        next.push({ type: item.type, items: [item] });
      }
    }

    return next;
  }, [items]);

  if (groups.length === 0) return null;

  return (
    <div className={styles.group}>
      {groups.map((group) => {
        const singleItem = group.items.length === 1 ? group.items[0] : null;

        return (
          <Callout
            key={group.type}
            variant={TYPE_TO_VARIANT[group.type]}
            title={singleItem?.title || TYPE_TO_TITLE[group.type]}
            className={styles.callout}
          >
            {singleItem ? (
              renderContent(singleItem.content)
            ) : (
              <ul className={styles.list}>
                {group.items.map((item, index) => (
                  <li key={index} className={styles.item}>
                    {item.title && <strong className={styles.itemTitle}>{item.title}: </strong>}
                    <div className={styles.itemContent}>{renderContent(item.content, true)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Callout>
        );
      })}
    </div>
  );
}
