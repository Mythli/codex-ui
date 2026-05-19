import React, { ReactNode } from 'react';
import styles from "./Table.module.css";

export interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <table className={styles.table}>
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

Table.Header = function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead className={`${styles.header} ${className}`}>
      {children}
    </thead>
  );
};

export interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

Table.Body = function TableBody({ children, className = '' }: TableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
};

export interface TableRowProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'selected' | 'warning' | 'danger';
  className?: string;
  onClick?: () => void;
}

Table.Row = function TableRow({ children, variant = 'default', className = '', onClick }: TableRowProps) {
  const classes = [
    styles.tr,
    variant !== 'default' ? styles[`row-${variant}`] : '',
    onClick ? styles.clickable : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <tr className={classes} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </tr>
  );
};

export interface TableCellProps {
  children?: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  colSpan?: number;
}

Table.Cell = function TableCell({ children, align = 'left', className = '', colSpan }: TableCellProps) {
  return (
    <td className={`${styles.td} ${styles[`align-${align}`]} ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
};

Table.HeaderCell = function TableHeaderCell({ children, align = 'left', className = '', colSpan }: TableCellProps) {
  return (
    <th className={`${styles.th} ${styles[`align-${align}`]} ${className}`} colSpan={colSpan}>
      {children}
    </th>
  );
};
