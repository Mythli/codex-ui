import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import type { LayoutState } from '@taylordb/learning-ui';

const LAYOUT_STATE_COOKIE = 'lui_layout_state';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const fetchLayoutStateFn = createServerFn({ method: 'GET', strict: false })
  .handler(async (): Promise<LayoutState> => ({
    isSidebarOpen: getCookie(LAYOUT_STATE_COOKIE) === 'open',
  }));

export const saveLayoutStateFn = createServerFn({ method: 'POST', strict: false })
  .inputValidator((state: LayoutState) => state)
  .handler(async ({ data: state }): Promise<LayoutState> => {
    setCookie(LAYOUT_STATE_COOKIE, state.isSidebarOpen ? 'open' : 'closed', {
      path: '/',
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
    });

    return state;
  });
