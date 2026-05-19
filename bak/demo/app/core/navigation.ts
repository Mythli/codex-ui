import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import type { DemoRouteStaticData } from './router';

export interface DemoNavigationPage extends DemoRouteStaticData {
  path: string;
}

export interface DemoNavigationModule {
  id: string;
  title: string;
  icon?: string;
  order: number;
  pages: DemoNavigationPage[];
}

const hasPageStaticData = (data: unknown): data is DemoRouteStaticData => {
  if (!data || typeof data !== 'object') return false;

  const candidate = data as Partial<DemoRouteStaticData>;
  return Boolean(
    candidate.moduleId &&
    candidate.moduleName &&
    typeof candidate.moduleOrder === 'number' &&
    candidate.title &&
    typeof candidate.order === 'number' &&
    !candidate.hidden
  );
};

const getRoutePath = (route: Record<string, unknown>) => {
  const fullPath = route.fullPath;
  const path = route.path;
  const id = route.id;

  if (typeof fullPath === 'string') return fullPath;
  if (typeof path === 'string') return path;
  if (typeof id === 'string' && id !== '__root__') return id;
  return null;
};

export function getNavigationPages(router: unknown): DemoNavigationPage[] {
  const routesById = (router as { routesById?: Record<string, unknown> }).routesById || {};

  return Object.values(routesById)
    .map((route) => {
      const routeRecord = route as Record<string, unknown>;
      const options = routeRecord.options as { staticData?: unknown } | undefined;
      const staticData = options?.staticData;
      const path = getRoutePath(routeRecord);

      if (!path || !hasPageStaticData(staticData)) return null;

      return {
        ...staticData,
        path,
      };
    })
    .filter((page): page is DemoNavigationPage => page !== null)
    .sort((a, b) => (
      a.moduleOrder - b.moduleOrder ||
      a.order - b.order ||
      a.title.localeCompare(b.title)
    ));
}

export function getNavigationModules(router: unknown): DemoNavigationModule[] {
  const modules = new Map<string, DemoNavigationModule>();

  for (const page of getNavigationPages(router)) {
    const existing = modules.get(page.moduleId);

    if (existing) {
      existing.pages.push(page);
      continue;
    }

    modules.set(page.moduleId, {
      id: page.moduleId,
      title: page.moduleName,
      icon: page.icon,
      order: page.moduleOrder,
      pages: [page],
    });
  }

  return Array.from(modules.values())
    .map((module) => ({
      ...module,
      pages: module.pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * A custom hook that automatically determines the "Previous" and "Next" 
 * pages based on the current URL and route staticData.
 */
export function useModuleNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const allPages = getNavigationPages(router);

  const currentIndex = allPages.findIndex(p => p.path === location.pathname);
  
  if (currentIndex === -1) {
    return {};
  }

  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  return {
    prevLabel: prevPage?.title,
    onPrev: prevPage ? () => navigate({ to: prevPage.path as never }) : undefined,
    nextLabel: nextPage?.title,
    onNext: nextPage ? () => navigate({ to: nextPage.path as never }) : undefined,
  };
}
