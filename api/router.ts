import { createRouter, publicQuery } from "./middleware";
import { presenceRouter } from "./presence";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  presence: presenceRouter,
});

export type AppRouter = typeof appRouter;
