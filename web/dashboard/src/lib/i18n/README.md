# Dashboard translations

Paraglide JS v2 reads JSON catalogs from `messages/`. English (`en`) is the
source catalog, while Simplified Chinese (`zh-CN`) is the runtime default and
fallback locale. Both are configured in `project.inlang/settings.json`. Never
edit generated files in `src/lib/paraglide/`.

## Using a message

```svelte
<script>
  import * as m from "$lib/paraglide/messages.js";
</script>

<label>{m.auth_api_key_label()}</label>
<p>{m.pagination_summary({ start: 1, end: 25, total: 80 })}</p>
```

Use flat `snake_case` keys. Reuse a message only when its meaning is identical,
and prefer complete phrases with named inputs so translators can reorder text.

## Updating a locale

1. Add or update keys in the English source catalog.
2. Apply the same keys to `messages/zh-CN.json` without changing inputs or
   plural branches.
3. Run `npm test`, `npm run check`, and `npm run build`.

The locale selector in Settings reads the configured locale list automatically.
Tests reject unused English messages and catalogs with mismatched keys or
inputs.
