import { query } from "./_generated/server";

export const health = query({
  args: {},
  handler: async () => {
    return { ok: true, service: "dispatchos", time: Date.now() };
  },
});
