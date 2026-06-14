import { calendarRouter } from "@/server/api/routers/calendar";
import { gmailRouter } from "@/server/api/routers/gmail";
import { postRouter } from "@/server/api/routers/post";
import { authRouter } from "@/server/api/routers/auth";
import { billingRouter } from "@/server/api/routers/billing";
import { agentRouter } from "@/server/api/routers/agent";
import { aiRouter } from "@/server/api/routers/ai";
import { templateRouter } from "@/server/api/routers/template";
import { schedulingRouter } from "@/server/api/routers/scheduling";
import { contactsRouter } from "@/server/api/routers/contacts";
import { referralRouter } from "@/server/api/routers/referral";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  gmail: gmailRouter,
  calendar: calendarRouter,
  auth: authRouter,
  billing: billingRouter,
  agent: agentRouter,
  ai: aiRouter,
  template: templateRouter,
  scheduling: schedulingRouter,
  contacts: contactsRouter,
  referral: referralRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
