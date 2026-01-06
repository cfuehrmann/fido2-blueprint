import { router } from "./trpc"
import { authRouter } from "./routers/auth"
import { profileRouter } from "./routers/profile"

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
