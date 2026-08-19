import { overwriteGetLocale } from "../src/lib/paraglide/runtime.js";

// Most tests verify locale-independent business logic against the English
// source copy. Locale-specific tests override this explicitly when needed.
overwriteGetLocale(() => "en");
