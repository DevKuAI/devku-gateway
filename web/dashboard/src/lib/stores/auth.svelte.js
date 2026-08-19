// Admin authentication state. Password login creates an HttpOnly server
// session; API keys remain available for compatible deployments and are stored
// in localStorage. A 401 opens the dialog and advances stale-auth handling.

import { authenticationResponseMetadata } from "./external-auth.js";
import { gomodelPath } from "$lib/api/paths.js";

const API_KEY_STORAGE_KEY = "gomodel_api_key";

export function normalizeApiKey(value) {
  const key = String(value || "").trim();
  if (/^Bearer\s*$/i.test(key)) {
    return "";
  }
  const match = key.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : key;
}

class AuthStore {
  apiKey = $state("");
  password = $state("");
  mode = $state("password");
  sessionAuthenticated = $state(false);
  accessVerified = $state(false);
  submitting = $state(false);
  needsAuth = $state(false);
  authError = $state(false);
  // Optional specific error text for the auth dialog; empty = generic copy.
  authErrorMessage = $state("");
  authErrorCode = $state("");
  dialogOpen = $state(false);
  // Provider-neutral browser auth metadata advertised by an extension.
  externalLoginURL = $state("");
  externalLogoutURL = $state("");
  externalUser = $state("");
  generation = $state(0);
  // Incremented whenever the whole dashboard should re-fetch (key change,
  // timezone change, runtime refresh). Pages watch this in an $effect.
  refreshTick = $state(0);

  init() {
    this.accessVerified = false;
    try {
      this.apiKey = normalizeApiKey(
        localStorage.getItem(API_KEY_STORAGE_KEY) || "",
      );
    } catch {
      this.apiKey = "";
    }
    void this.checkSession();
  }

  hasApiKey() {
    return normalizeApiKey(this.apiKey) !== "";
  }

  save() {
    this.apiKey = normalizeApiKey(this.apiKey);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, this.apiKey);
    } catch {
      // Keep the in-memory key when storage is unavailable.
    }
  }

  clearApiKey() {
    this.apiKey = "";
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      // The in-memory key is still cleared when storage is unavailable.
    }
  }

  selectPasswordAuthentication() {
    this.mode = "password";
    this.authErrorMessage = "";
    this.authErrorCode = "";
  }

  selectApiKeyAuthentication() {
    this.mode = "api-key";
    this.authErrorMessage = "";
    this.authErrorCode = "";
  }

  selectExternalAuthentication() {
    this.clearApiKey();
    this.accessVerified = false;
    this.generation++;
    this.authError = false;
    this.authErrorMessage = "";
    this.authErrorCode = "";
    this.needsAuth = true;
  }

  openDialog() {
    this.dialogOpen = true;
  }

  openPasswordDialog() {
    this.selectPasswordAuthentication();
    this.openDialog();
  }

  openApiKeyDialog() {
    this.selectApiKeyAuthentication();
    this.openDialog();
  }

  closeDialog() {
    this.dialogOpen = false;
  }

  // submitApiKey verifies a newly entered key before revealing dashboard data.
  async submitApiKey() {
    const apiKey = normalizeApiKey(this.apiKey);
    if (!apiKey) {
      this.apiKey = "";
      this.authError = true;
      this.authErrorMessage = "";
      this.authErrorCode = "invalid_api_key";
      this.needsAuth = true;
      this.openDialog();
      return false;
    }

    this.apiKey = apiKey;
    this.accessVerified = false;
    this.generation++;
    const generation = this.generation;
    this.submitting = true;
    this.authErrorCode = "";
    try {
      const response = await fetch(gomodelPath("/admin/runtime/config"), {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      });
      if (generation !== this.generation) return false;
      if (!response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        this.authError = true;
        this.authErrorMessage = "";
        this.authErrorCode = response.status === 403 &&
          data?.error?.code === "dashboard_access_denied"
          ? "dashboard_access_denied"
          : "invalid_api_key";
        this.needsAuth = true;
        return false;
      }

      this.save();
      this.accessVerified = true;
      this.authError = false;
      this.authErrorMessage = "";
      this.authErrorCode = "";
      this.needsAuth = false;
      this.closeDialog();
      this.refresh();
      return true;
    } catch {
      if (generation !== this.generation) return false;
      this.authError = true;
      this.authErrorMessage = "";
      this.authErrorCode = "network";
      this.needsAuth = true;
      return false;
    } finally {
      if (generation === this.generation) {
        this.submitting = false;
      }
    }
  }

  async submitPassword() {
    if (this.password === "") {
      this.authError = true;
      this.authErrorMessage = "";
      this.authErrorCode = "invalid_password";
      this.needsAuth = true;
      this.openDialog();
      return false;
    }

    this.submitting = true;
    this.authErrorCode = "";
    try {
      const response = await fetch(gomodelPath("/admin/auth/login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: this.password }),
      });
      if (!response.ok) {
        this.authError = true;
        this.authErrorMessage = "";
        this.authErrorCode = "invalid_password";
        this.needsAuth = true;
        return false;
      }

      this.clearApiKey();
      this.password = "";
      this.sessionAuthenticated = true;
      this.accessVerified = true;
      this.generation++;
      this.authError = false;
      this.authErrorMessage = "";
      this.authErrorCode = "";
      this.needsAuth = false;
      this.closeDialog();
      this.refresh();
      return true;
    } catch {
      this.authError = true;
      this.authErrorMessage = "";
      this.authErrorCode = "network";
      this.needsAuth = true;
      return false;
    } finally {
      this.submitting = false;
    }
  }

  async checkSession() {
    const generation = this.generation;
    try {
      const response = await fetch(gomodelPath("/admin/auth/session"), {
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (generation !== this.generation) return;
      this.sessionAuthenticated = data?.authenticated === true;
      if (this.sessionAuthenticated && !this.hasApiKey()) {
        this.markAuthorized(generation);
      }
    } catch {
      // Protected API requests remain the source of truth for auth failures.
    }
  }

  async logoutSession() {
    try {
      await fetch(gomodelPath("/admin/auth/logout"), {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      this.sessionAuthenticated = false;
      this.accessVerified = false;
      this.password = "";
      this.clearApiKey();
      this.mode = "password";
      this.generation++;
      this.authError = false;
      this.authErrorMessage = "";
      this.authErrorCode = "";
      this.needsAuth = true;
      this.openDialog();
    }
  }

  refresh() {
    this.refreshTick++;
  }

  observeResponse(response) {
    const metadata = authenticationResponseMetadata(response);
    if (!metadata) return;
    if (Object.hasOwn(metadata, "loginURL")) {
      this.externalLoginURL = metadata.loginURL;
    }
    if (Object.hasOwn(metadata, "logoutURL")) {
      this.externalLogoutURL = metadata.logoutURL;
    }
    if (Object.hasOwn(metadata, "user")) {
      this.externalUser = metadata.user;
    }
  }

  markAuthorized(requestGeneration) {
    if (
      typeof requestGeneration === "number" &&
      requestGeneration < this.generation
    ) {
      return false;
    }
    this.accessVerified = true;
    this.needsAuth = false;
    this.authError = false;
    this.authErrorMessage = "";
    this.authErrorCode = "";
    return true;
  }

  // handleUnauthorized reports whether the 401/403 belongs to the current
  // key. Stale responses (older generation) are ignored silently. An optional
  // message replaces the generic dialog error text (e.g. a valid key that
  // lacks dashboard access).
  handleUnauthorized(requestGeneration, message = "") {
    if (
      typeof requestGeneration === "number" &&
      requestGeneration < this.generation
    ) {
      return false;
    }
    const apiKeyRejected = this.mode === "api-key" && this.hasApiKey();
    this.accessVerified = false;
    this.authError = true;
    this.authErrorMessage = message;
    this.authErrorCode = message
      ? "custom"
      : (apiKeyRejected ? "invalid_api_key" : "");
    this.needsAuth = true;
    this.openDialog();
    return true;
  }
}

export const auth = new AuthStore();
