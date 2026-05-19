import React from 'react';
import { PageShell } from "../../Layout/pure/PageShell";
import { Header } from "../../../common/Header";
import { BurgerButton } from "../../Layout/connected/BurgerButton";
import { PageFooterNav } from "../../Layout/pure/PageFooterNav";
import { VocabManagementScreen, VocabManagementScreenProps } from "./VocabManagementScreen";

export interface VocabManagementPageProps extends VocabManagementScreenProps {
  /** The title of the page, displayed in the header */
  title?: string;
  /** The label for the previous page button */
  prevLabel?: string;
  /** Callback fired when the previous button is clicked */
  onPrev?: () => void;
  /** The label for the next page button and the footer card */
  nextLabel?: string;
  /** Callback fired when the next button or footer card is clicked */
  onNext?: () => void;
}

/**
 * A "batteries-included" wrapper for the VocabManagementScreen.
 * Automatically wires up the PageShell, Header, BurgerButton,
 * and PageFooterNav so developers can focus purely on the content.
 */
export function VocabManagementPage({
  title = 'Manage Deck',
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  initialCards,
  initialTags,
  onNavigateToReview
}: VocabManagementPageProps) {
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
      <VocabManagementScreen
        initialCards={initialCards}
        initialTags={initialTags}
        onNavigateToReview={onNavigateToReview}
      />
    </PageShell>
  );
}
