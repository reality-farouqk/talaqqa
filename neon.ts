import { defineConfig } from "@neon/config/v1";

// Neon provides Postgres only. Sign-in is the app's own Better Auth (src/api/auth.ts), which stores
// users and sessions in this database; Neon Managed Auth stays off.
export default defineConfig({
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
