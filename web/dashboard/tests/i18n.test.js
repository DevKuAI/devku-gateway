import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as m from "../src/lib/paraglide/messages.js";
import {
  baseLocale,
  getTextDirection,
  locales,
  strategy,
} from "../src/lib/paraglide/runtime.js";
import {
  localeDisplayName,
  supportedLocale,
} from "../src/lib/i18n/locale.js";

const catalogPath = fileURLToPath(
  new URL("../messages/en.json", import.meta.url),
);
const { $schema, ...englishMessages } = JSON.parse(
  readFileSync(catalogPath, "utf8"),
);
const { $schema: chineseSchema, ...chineseMessages } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../messages/zh-CN.json", import.meta.url)),
    "utf8",
  ),
);

test("the English source catalog contains valid flat semantic keys", () => {
  assert.equal($schema, "https://inlang.com/schema/inlang-message-format");
  assert.ok(Object.keys(englishMessages).length > 0);

  for (const [key, message] of Object.entries(englishMessages)) {
    assert.match(key, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
    assert.ok(
      (typeof message === "string" && message.trim() !== "") ||
        (Array.isArray(message) && message.length > 0),
      `${key} must contain a translation`,
    );
  }
});

test("the Simplified Chinese catalog matches the English source", () => {
  assert.equal(
    chineseSchema,
    "https://inlang.com/schema/inlang-message-format",
  );
  assert.deepEqual(Object.keys(chineseMessages), Object.keys(englishMessages));

  const inputs = (message) =>
    [...JSON.stringify(message).matchAll(/\{([a-z][a-z0-9_]*)\}/g)]
      .map((match) => match[1])
      .sort();

  for (const key of Object.keys(englishMessages)) {
    assert.deepEqual(
      inputs(chineseMessages[key]),
      inputs(englishMessages[key]),
      `${key} must preserve every message input`,
    );
  }
});

test("the Simplified Chinese catalog follows the project copy conventions", () => {
  const catalog = JSON.stringify(chineseMessages);

  assert.doesNotMatch(catalog, /\.\.\./);
  assert.doesNotMatch(catalog, /[“”]/);
  assert.equal(
    chineseMessages.usage_rewrite_summed,
    "节省量按每次 provider 请求汇总；重新发送的对话历史会再次计入。",
  );
  assert.equal(chineseMessages.budgets_period_elapsed, "预算周期进度");
  assert.equal(chineseMessages.models_virtual_model, "Virtual Model");
  assert.equal(chineseMessages.providers_vertex_project, "Vertex Project");
  assert.equal(chineseMessages.providers_vertex_location, "Vertex Location");
  assert.equal(chineseMessages.workflows_created, "Workflow 已创建并激活。");
});

test("Paraglide compiles the Chinese default and English override", () => {
  assert.equal(
    m.pagination_summary(
      { start: 1, end: 25, total: 80 },
      { locale: "zh-CN" },
    ),
    "显示 1–25（共 80）",
  );
  assert.equal(
    m.date_picker_last_days({ count: 1 }, { locale: "zh-CN" }),
    "最近 1 天",
  );
  assert.equal(
    m.date_picker_last_days({ count: 14 }, { locale: "zh-CN" }),
    "最近 14 天",
  );
  assert.equal(
    m.date_picker_days({ count: 1 }, { locale: "zh-CN" }),
    "1 天",
  );
  assert.equal(
    m.pagination_summary(
      { start: 1, end: 25, total: 80 },
      { locale: "en" },
    ),
    "Showing 1–25 of 80",
  );
  assert.equal(
    m.date_picker_last_days({ count: 1 }, { locale: "zh-CN" }),
    "最近 1 天",
  );
  assert.equal(
    m.date_picker_last_days({ count: 2 }, { locale: "zh-CN" }),
    "最近 2 天",
  );
  assert.equal(
    m.date_picker_days({ count: 5 }, { locale: "zh-CN" }),
    "5 天",
  );
  assert.equal(
    m.audit_provider_attempts({ count: 5 }, { locale: "zh-CN" }),
    "5 次 provider 尝试",
  );
  assert.equal(
    m.settings_pricing_summary(
      { matched: 1, recalculated: 1 },
      { locale: "zh-CN" },
    ),
    "已重新计算 1 条用量记录中 1 条记录的定价。",
  );
  assert.equal(
    m.settings_pricing_missing({ count: 2 }, { locale: "zh-CN" }),
    "仍有 2 条用量记录缺少定价元数据。",
  );
  assert.equal(
    m.settings_runtime_refresh_models({ count: 2 }, { locale: "zh-CN" }),
    "2 个 model",
  );
  assert.equal(
    m.settings_runtime_refresh_providers(
      { count: 5 },
      { locale: "zh-CN" },
    ),
    "5 个 provider",
  );
  assert.equal(
    m.settings_pricing_confirmation({}, { locale: "zh-CN" }),
    "重新计算",
  );
  assert.equal(
    m.providers_keys_count({ count: 2 }, { locale: "zh-CN" }),
    "2 个密钥",
  );
  assert.equal(
    m.providers_models_count({ count: 5 }, { locale: "zh-CN" }),
    "5 个 model",
  );
  assert.equal(
    m.models_count({ count: 5 }, { locale: "zh-CN" }),
    "5 个 model",
  );
  assert.equal(
    m.models_alias_count({ count: 5 }, { locale: "zh-CN" }),
    "5 个 alias",
  );
  assert.equal(
    m.models_failover_generated({ count: 5 }, { locale: "zh-CN" }),
    "已生成 5 个 Fallback Model。",
  );
  assert.equal(
    m.models_failover_saved({ count: 5 }, { locale: "zh-CN" }),
    "已保存 5 条 Failover 映射。",
  );
  assert.equal(
    m.overview_total_requests({}, { locale: "zh-CN" }),
    "请求总数",
  );
  assert.equal(
    m.overview_live_token_throughput({}, { locale: "zh-CN" }),
    "实时 Token 吞吐量",
  );
  assert.equal(
    m.overview_provider_status({}, { locale: "zh-CN" }),
    "provider 状态",
  );
  assert.equal(
    m.overview_input_tokens({}, { locale: "zh-CN" }),
    "输入 Token",
  );
  assert.equal(
    m.rate_limits_title({}, { locale: "zh-CN" }),
    "速率限制",
  );
});

test("the browser locale strategy defaults to Simplified Chinese", () => {
  assert.equal(baseLocale, "zh-CN");
  assert.deepEqual(locales, ["zh-CN", "en"]);
  assert.deepEqual(strategy, ["custom-dashboard", "baseLocale"]);
  assert.equal(supportedLocale("zh-CN"), "zh-CN");
  assert.equal(supportedLocale("en"), "en");
  assert.equal(supportedLocale("pl"), undefined);
  assert.equal(localeDisplayName("zh-CN"), "简体中文");
  assert.equal(localeDisplayName("en"), "English");
  assert.equal(getTextDirection("en"), "ltr");
  assert.equal(getTextDirection("ar"), "rtl");
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "paraglide" ? [] : sourceFiles(path);
    }
    return [".js", ".svelte"].includes(extname(path)) ? [path] : [];
  });
}

test("every English message is referenced by dashboard source", () => {
  const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
  const source = sourceFiles(sourceRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  for (const key of Object.keys(englishMessages)) {
    assert.ok(
      source.includes(`m.${key}`),
      `${key} is not used by dashboard source`,
    );
  }
});
