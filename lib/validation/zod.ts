import { z } from "zod";

// Zod compiles fast paths with new Function() when it can. The CSP forbids
// eval, so its probe would log a CSP violation in every browser; run jitless.
z.config({ jitless: true });

export { z };
