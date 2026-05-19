import { ReactNode } from 'react';
import { useLocale } from '../../system/LocaleContext';
import { Table } from '../Table/Table';
import styles from "./ComparisonTable.module.css";

export interface ComparisonRow {
  question: string;
  values: (string | ReactNode)[];
  isCommon?: boolean; // Highlight as something both have in common
}

export interface ComparisonTableProps {
  headers: string[];
  rows: ComparisonRow[];
  title?: string;
  caption?: string;
}

export function ComparisonTable({ headers, rows, title, caption }: ComparisonTableProps) {
  const { dict } = useLocale();

  return (
    <div className={styles.wrapper}>
      {title && <h4 className={styles.title}>{title}</h4>}
      
      <div className={styles.scroll}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className={styles.questionHeader}>{dict.shared.question}</Table.HeaderCell>
              {headers.map((header, i) => (
                <Table.HeaderCell key={i} className={styles.valueHeader} align="center">{header}</Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row, i) => (
              <Table.Row key={i} variant={row.isCommon ? 'success' : 'default'}>
                <Table.Cell className={styles.question}>{row.question}</Table.Cell>
                {row.values.map((value, j) => (
                  <Table.Cell key={j} className={styles.value} align="center">
                    {value}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  );
}
