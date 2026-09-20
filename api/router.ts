import { createRouter, publicQuery } from "./middleware";
import { presenceRouter } from "./presence";
import { supportRouter } from './support';

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  presence: presenceRouter,
  support: supportRouter,
});

export type AppRouter = typeof appRouter;
