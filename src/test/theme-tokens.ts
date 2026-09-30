// ============================================================
// 测试辅助：读取 index.css 里的 @theme 令牌
//
// 放在 src/test/ 而不是某个 .test.ts 里，避免被 import 时重复注册测试用例。
// 用途：让"配色改动"能被单测守住（对比度、深浅两套是否同值、图表色是否同步）。
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../index.css', import.meta.url));

function readCss(): string {
  return readFileSync(CSS_PATH, 'utf8');
}

/** 取出某个选择器（如 `.dark`）后第一对花括号里的内容 */
function extractBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) return '';

  const start = css.indexOf('{', selectorIndex);
  if (start === -1) return '';

  let depth = 0;
  for (let i = start; i < css.length; i++) {
    const char = css[i];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return '';
}

/**
 * 读出 --color-* 令牌的原始色值。
 * @param scope 传 `@theme` 读浅色（默认主题），传 `.dark` 读深色块；
 *              不传则读整份文件（同名字段后者覆盖前者，仅用于对比"两套是否齐全"）
 */
export function readThemeTokens(scope?: string): Record<string, string> {
  const source = scope ? extractBlock(readCss(), scope) : readCss();
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}
