<script>
  // Settings locale picker. Locale labels are stable in every active locale
  // so users can always recognize both available language choices.
  import { localeDisplayName } from "$lib/i18n/locale.js";
  import * as m from "$lib/paraglide/messages.js";
  import { getLocale, locales, setLocale } from "$lib/paraglide/runtime.js";

  const availableLocales = locales.map((value) => ({
    value,
    label: localeDisplayName(value),
  }));
</script>

{#if availableLocales.length > 1}
  <div class="settings-refresh-section locale-settings">
    <label class="locale-selector-label" for="dashboard-locale">
      {m.language_label()}
    </label>
    <select
      id="dashboard-locale"
      class="form-select settings-select"
      value={getLocale()}
      aria-label={m.language_label()}
      onchange={(event) => setLocale(event.currentTarget.value)}
    >
      {#each availableLocales as locale (locale.value)}
        <option value={locale.value}>{locale.label}</option>
      {/each}
    </select>
  </div>
{/if}

<style>
  .locale-settings {
    grid-template-columns: minmax(0, 420px);
  }

  .locale-selector-label {
    color: var(--text);
    font-size: 18px;
    font-weight: 600;
  }
</style>
