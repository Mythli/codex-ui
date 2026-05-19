import { createFileRoute } from '@tanstack/react-router';
import apiRouter from '../../../api/core/api';

const handler = async ({ request }: { request: Request }) => {
  return apiRouter.fetch(request);
};

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      DELETE: handler,
      PATCH: handler,
      OPTIONS: handler,
    },
  },
});
