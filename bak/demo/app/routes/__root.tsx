import React from 'react'
import { createRootRoute, Outlet, Link, useRouter, useRouterState, Scripts, HeadContent } from '@tanstack/react-router'
import { LearningUIProvider, RootLayout, Sidebar, experimentLocalStorageAdapter, type LayoutState } from '@taylordb/learning-ui';
import { demoMarkdownConfig } from '../core/markdown';
import { getNavigationModules } from '../core/navigation';
import { apiExperimentBackend } from '../features/experiment/experiment';
import { fetchLayoutStateFn, saveLayoutStateFn } from '../features/layout/server-fns';
import { apiQuizAdapter, apiQuizExamAdapter, quizPlugins } from '../features/quiz/quiz';
import { apiVocabBackend } from '../features/vocab/vocab';
import { DEMO_CARD_REGISTRY } from '../features/vocab/vocabRegistry';

export const Route = createRootRoute({
  loader: async () => fetchLayoutStateFn(),
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const modules = getNavigationModules(router)
  const initialLayoutState = Route.useLoaderData() as LayoutState;
  const layoutStorage = React.useMemo(() => ({
    load: () => fetchLayoutStateFn(),
    save: async (state: LayoutState) => {
      await saveLayoutStateFn({ data: state });
    },
  }), []);

  return (
    <html>
      <head>
        <HeadContent />
        <title>Learning UI - Full Stack Demo</title>
      </head>
      <body>
        <LearningUIProvider
          markdownConfig={demoMarkdownConfig}
          adapters={{
            quiz: apiQuizAdapter,
            quizExam: apiQuizExamAdapter,
            vocab: apiVocabBackend,
            experiment: apiExperimentBackend,
            experimentStorage: experimentLocalStorageAdapter,
          }}
          plugins={{
            quiz: quizPlugins,
            vocabCards: DEMO_CARD_REGISTRY,
          }}
        >
          <RootLayout
            initialLayoutState={initialLayoutState}
            layoutStorage={layoutStorage}
            sidebar={
              <Sidebar title="Demo App">
                {modules.map((module) => (
                  <Sidebar.Category key={module.id} title={module.title} icon={module.icon}>
                    {module.pages.map((page) => (
                      <Sidebar.Item key={page.path} isActive={pathname === page.path}>
                        <Link to={page.path as never}>{page.title}</Link>
                      </Sidebar.Item>
                    ))}
                  </Sidebar.Category>
                ))}
              </Sidebar>
            }
          >
            <Outlet />
          </RootLayout>
        </LearningUIProvider>
        <Scripts />
      </body>
    </html>
  );
}
/*

import { HeadContent, createRootRoute } from '@tanstack/react-router'


export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        {children}
      </body>
    </html>
  )
}
*/
