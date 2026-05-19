import { ReactNode, CSSProperties } from 'react';
import styles from "./Stack.module.css";

/**
 * A primitive layout component that uses Flexbox to stack items vertically or horizontally.
 * Use this instead of writing custom CSS for basic spacing and alignment.
 */
export interface StackProps {
  /** The flex direction. Defaults to 'column'. */
  direction?: 'row' | 'column';
  /** The gap between items, based on the --lui-space scale. Defaults to 4 (1rem). */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10;
  /** Align items along the cross axis (align-items) */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Align items along the main axis (justify-content) */
  justify?: 'start' | 'center' | 'end' | 'between';
  /** Whether items should wrap to the next line */
  wrap?: boolean;
  /** The items to stack */
  children: ReactNode;
  /** Optional extra class name */
  className?: string;
  /** Optional inline styles */
  style?: CSSProperties;
}

export function Stack({
  direction = 'column',
  gap = 4,
  align,
  justify,
  wrap,
  children,
  className = '',
  style,
}: StackProps) {
  const classes = [
    styles.stack,
    direction === 'row' ? styles.row : styles.col,
    wrap ? styles.wrap : '',
    styles[`gap-${gap}`],
    align ? styles[`align-${align}`] : '',
    justify ? styles[`justify-${justify}`] : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
