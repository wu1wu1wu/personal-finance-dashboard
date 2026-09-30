// ============================================================
// 测试辅助：读取 index.css 里的 @theme 令牌
//
// 放在 src/test/ 而不是某个 .test.ts 里，避免被 import 时重复注册测试用例。
// 用途：让"配色改动"能被单测守住（对比度、图表色与令牌是否同值）。
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 读出 index.css 里 --color-* 令牌的原始色值 */
export function readThemeTokens(): Record<string, string> {
  const cssPath = fileURLToPath(new URL('../index.css', import.meta.url));
  const css = readFileSync(cssPath, 'utf8');
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}
