import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';

export interface DemoRouteStaticData {
  moduleId: string;
  moduleName: string;
  moduleOrder: number;
  title: string;
  order: number;
  icon?: string;
  hidden?: boolean;
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}


declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption extends Partial<DemoRouteStaticData> {}
}
