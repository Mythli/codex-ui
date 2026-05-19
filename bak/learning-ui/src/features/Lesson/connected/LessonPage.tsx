import React, { ReactNode } from 'react';
import { PageShell } from "../../Layout/pure/PageShell";
import { Header } from "../../../common/Header";
import { BurgerButton } from "../../Layout/connected/BurgerButton";
import { PageFooterNav } from "../../Layout/pure/PageFooterNav";
import { Stack } from "../../../common/Stack/Stack";

export interface LessonPageProps {
  /** The title of the lesson, displayed in the header */
  title: string;
  /** The label for the previous page button */
  prevLabel?: string;
  /** Callback fired when the previous button is clicked */
  onPrev?: () => void;
  /** The label for the next page button and the footer card */
  nextLabel?: string;
  /** Callback fired when the next button or footer card is clicked */
  onNext?: () => void;
  /** The content of the lesson (e.g., PageIntro, ConceptSections) */
  children: ReactNode;
}

/**
 * A "batteries-included" wrapper for static reading and video pages.
 * Automatically wires up the PageShell, Header, BurgerButton,
 * and PageFooterNav so developers can focus purely on the content.
 */
export function LessonPage({
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  children,
}: LessonPageProps) {
  return (
    <PageShell
      header={
        <Header>
          <Header.Left>
            <BurgerButton />
            {onPrev && (
              <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} />
            )}
          </Header.Left>
          <Header.Center>
            {title}
          </Header.Center>
          <Header.Right>
            {onNext && (
              <Header.NavButton direction="next" label={nextLabel} onClick={onNext} />
            )}
          </Header.Right>
        </Header>
      }
      footer={
        onNext && nextLabel ? (
          <PageFooterNav>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNext();
              }}
              style={{ textDecoration: 'none', display: 'contents' }}
            >
              <PageFooterNav.Card title={nextLabel} />
            </a>
          </PageFooterNav>
        ) : undefined
      }
    >
      <Stack gap={6}>
        {children}
      </Stack>
    </PageShell>
  );
}
