import React from 'react';
import { Header } from "../../../common/Header";
import { useLayout } from "../store/LayoutContext";

export function BurgerButton() {
  const { toggleSidebar } = useLayout();
  return <Header.BurgerButton onClick={toggleSidebar} />;
}
