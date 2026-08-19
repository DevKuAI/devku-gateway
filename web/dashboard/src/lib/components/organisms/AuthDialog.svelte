<script>
  import DialogCloseButton from "$lib/components/atoms/DialogCloseButton.svelte";
  import Modal from "$lib/components/atoms/Modal.svelte";
  import Icon from "$lib/components/atoms/Icon.svelte";
  import { auth } from "$lib/stores/auth.svelte.js";
  import { authenticationLoginURL } from "$lib/stores/external-auth.js";
  import { gomodelPath } from "$lib/api/paths.js";
  import * as m from "$lib/paraglide/messages.js";
  import { Check, KeyRound, LoaderCircle, LockKeyhole } from "lucide";

  function authErrorText() {
    if (auth.authErrorMessage) return auth.authErrorMessage;
    if (auth.authErrorCode === "network") return m.auth_network_error();
    if (auth.authErrorCode === "dashboard_access_denied") {
      return m.auth_api_key_no_dashboard_access();
    }
    return auth.mode === "password"
      ? m.auth_admin_password_invalid()
      : m.auth_api_key_invalid();
  }
</script>

<Modal
  open={auth.dialogOpen}
  variant="auth"
  closeOnBackdrop={auth.accessVerified}
  onclose={() => {
    if (auth.accessVerified) auth.closeDialog();
  }}
>
  <div
    class="auth-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="authDialogTitle"
  >
    <div class="auth-dialog-header">
      <div>
        <h2 id="authDialogTitle">
          {auth.needsAuth
            ? m.auth_dialog_admin_title()
            : m.auth_dialog_change_method_title()}
        </h2>
      </div>
      {#if auth.accessVerified}
        <DialogCloseButton
          label={m.auth_dialog_close()}
          onclick={() => auth.closeDialog()}
          class="auth-dialog-close"
          iconClass=""
        />
      {/if}
    </div>
    <form
      class="auth-dialog-form"
      onsubmit={async (event) => {
        event.preventDefault();
        if (auth.mode === "password") {
          await auth.submitPassword();
          return;
        }
        await auth.submitApiKey();
      }}
    >
      {#if auth.externalLoginURL}
        <a
          class="btn btn-primary btn-with-icon external-login-btn"
          href={authenticationLoginURL(gomodelPath(auth.externalLoginURL))}
          onclick={() => auth.selectExternalAuthentication()}
        >
          <Icon icon={KeyRound} />
          <span>{m.auth_dialog_sign_in_with_sso()}</span>
        </a>
        <div class="auth-dialog-separator"><span>{m.auth_dialog_or_use_credentials()}</span></div>
      {/if}
      <div class="auth-method-switch" aria-label={m.auth_dialog_method_label()}>
        <button
          type="button"
          class:active={auth.mode === "password"}
          aria-pressed={auth.mode === "password"}
          onclick={() => auth.selectPasswordAuthentication()}
        >
          {m.auth_dialog_method_password()}
        </button>
        <button
          type="button"
          class:active={auth.mode === "api-key"}
          aria-pressed={auth.mode === "api-key"}
          onclick={() => auth.selectApiKeyAuthentication()}
        >
          {m.auth_dialog_method_api_key()}
        </button>
      </div>
      <div class="auth-dialog-input-shell">
        <Icon icon={LockKeyhole} class="auth-dialog-input-icon" />
        {#if auth.mode === "password"}
          <input
            id="authDialogPassword"
            class="auth-dialog-input"
            type="password"
            placeholder={m.auth_admin_password_placeholder()}
            aria-label={m.auth_admin_password_label()}
            autocomplete="current-password"
            data-modal-autofocus
            bind:value={auth.password}
          />
        {:else}
          <input
            id="authDialogApiKey"
            class="auth-dialog-input"
            type="password"
            placeholder={m.auth_api_key_placeholder()}
            aria-label={m.auth_api_key_label()}
            autocomplete="current-password"
            data-modal-autofocus
            bind:value={auth.apiKey}
          />
        {/if}
      </div>
      {#if auth.authErrorMessage || auth.authErrorCode}
        <p class="auth-dialog-error" role="alert">
          {authErrorText()}
        </p>
      {/if}
      {#if auth.mode === "api-key"}
        <p class="auth-dialog-hint">
          {m.auth_api_key_storage_hint()}
        </p>
      {/if}
      <div class="auth-dialog-actions">
        <button
          type="submit"
          class="btn btn-primary btn-with-icon auth-dialog-submit-btn"
          disabled={auth.submitting}
        >
          <Icon
            icon={auth.submitting ? LoaderCircle : Check}
            class={auth.submitting
              ? "auth-dialog-submit-icon spinning"
              : "auth-dialog-submit-icon"}
          />
          <span>{auth.mode === "password"
              ? (auth.submitting ? m.auth_action_signing_in() : m.auth_action_sign_in())
              : m.auth_action_save_api_key()}</span>
        </button>
      </div>
    </form>
  </div>
</Modal>

<style>
.external-login-btn {
    width: 100%;
    justify-content: center;
    text-decoration: none;
}

.auth-dialog-separator {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-muted);
    font-size: 12px;
}

.auth-dialog-separator::before,
.auth-dialog-separator::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border);
}

.auth-dialog-input-shell {
    position: relative;
  }

.auth-method-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
  }

.auth-method-switch button {
    min-height: 34px;
    border: 0;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

.auth-method-switch button.active {
    background: var(--bg-surface);
    color: var(--text);
    box-shadow: var(--shadow-subtle);
  }

.auth-method-switch button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

.auth-dialog-input {
    width: 100%;
    padding: 11px 12px 11px 38px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    outline: none;
  }

.auth-dialog-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }

:global(.auth-dialog-submit-icon.spinning) {
    animation: auth-spin 0.8s linear infinite;
  }

@keyframes auth-spin {
    to { transform: rotate(360deg); }
  }
</style>
