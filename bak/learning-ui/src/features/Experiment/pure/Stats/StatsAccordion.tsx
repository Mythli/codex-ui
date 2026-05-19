import React, { ReactNode, useState, createContext, useContext } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import styles from "./StatsAccordion.module.css";

interface AccordionContextType {
  isOpen: boolean;
  toggle: () => void;
}

const AccordionItemContext = createContext<AccordionContextType | null>(null);

export interface AccordionProps {
  children: ReactNode;
}

export function Accordion({ children }: AccordionProps) {
  return <div className={styles.accordion}>{children}</div>;
}

export interface AccordionItemProps {
  children: ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

Accordion.Item = function AccordionItem({ 
  children, 
  isOpen: controlledIsOpen, 
  onToggle: controlledOnToggle, 
  className = '',
  defaultExpanded = false
}: AccordionItemProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultExpanded);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  
  const toggle = () => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <AccordionItemContext.Provider value={{ isOpen, toggle }}>
      <div className={`${styles.item} ${isOpen ? styles.open : ''} ${className}`}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
};

export interface AccordionHeaderProps {
  children: ReactNode;
  right?: ReactNode;
}

Accordion.Header = function AccordionHeader({ children, right }: AccordionHeaderProps) {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error('Accordion.Header must be used within Accordion.Item');

  return (
    <button className={styles.header} onClick={ctx.toggle} type="button">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span className={styles.icon}>
          {ctx.isOpen ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
        </span>
        <span className={styles.title}>{children}</span>
      </div>
      {right && <div className={styles.headerRight}>{right}</div>}
    </button>
  );
};

export interface AccordionContentProps {
  children: ReactNode;
  noPadding?: boolean;
}

Accordion.Content = function AccordionContent({ children, noPadding = false }: AccordionContentProps) {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error('Accordion.Content must be used within Accordion.Item');

  if (!ctx.isOpen) return null;

  return (
    <div className={`${styles.content} ${noPadding ? styles.noPadding : ''}`}>
      {children}
    </div>
  );
};
