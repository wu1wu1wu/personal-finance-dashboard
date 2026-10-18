// src/core/replay-classify.test.ts
// 默认跳过；把 PFD_BACKUP 指向一份备份 JSON 时才执行。
// 例：PFD_BACKUP="C:/path/记账备份_已脱敏.json" node node_modules/vitest/vitest.mjs run src/core/replay-classify.test.ts
// 备份文件绝不进仓库（只在本地读）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Transaction } from '@/types';
import { buildClassifyContext } from './classify-context';
import { classifyTransactionDetailed } from './classify';

const backupPath = process.env.PFD_BACKUP;

describe.skipIf(!backupPath)('真实备份回放', () => {
  it('输出依据等级分布，且必须有留白', () => {
    const raw = JSON.parse(readFileSync(backupPath!, 'utf8')) as {
      pfd_transactions?: Transaction[];
      pfd_custom_rules?: never[];
    };
    const txns = raw.pfd_transactions ?? [];
    const ctx = buildClassifyContext(txns, raw.pfd_custom_rules ?? []);

    const levels = new Map<string, number>();
    const bases = new Map<string, number>();
    const changes: string[] = [];
    for (const t of txns) {
      const r = classifyTransactionDetailed(t, ctx);
      levels.set(r.level, (levels.get(r.level) ?? 0) + 1);
      bases.set(r.basis, (bases.get(r.basis) ?? 0) + 1);
      if (r.category !== t.category) {
        changes.push(
          `${t.transactionTime?.slice(0, 10)} ${t.amount} ${t.category}(${t.categorySource}) → ${r.category} [${r.level}/${r.basis}] ${r.reason}`,
        );
      }
    }

    console.log(`回放 ${txns.length} 条`);
    console.log('等级:', [...levels.entries()].map(([k, v]) => `${k}=${v}`).join('  '));
    console.log('依据:', [...bases.entries()].map(([k, v]) => `${k}=${v}`).join('  '));
    console.log(`与库中不同: ${changes.length}/${txns.length}`);
    changes.slice(0, 40).forEach((c) => console.log('  ' + c));

    expect(txns.length).toBeGreaterThan(0);
    // 关键断言：不允许"全确定"——没有依据的记录必须留白
    expect(levels.get('pending') ?? 0).toBeGreaterThan(0);
  });
});
