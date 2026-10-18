// ============================================================
// 自动记账 Hook - 监听原生端捕获到的短信/通知，解析后写入交易库
// 说明：原生端实时推送 + 持久队列兜底；本 Hook 在启动/回前台时补扫通知栏并清空队列
// ============================================================

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import AutoLedger from '@/plugins/AutoLedger';
import type { CapturedTransaction } from '@/plugins/AutoLedger';
import { parseCapturedTransaction } from '@/core/transaction-capture';
import { resolveCaptureTiming } from '@/core/capture-timing';
import { isDuplicateCapture } from '@/core/transaction-reconcile';
import { buildClassifyContext } from '@/core/classify-context';
import type { BuiltClassifyContext } from '@/core/classify-context';
import { classifyTransactionDetailed } from '@/core/classify';
import { generateTransactionId } from '@/utils/id';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { useCaptureRuleStore } from '@/stores/capture-rule-store';
import type { ClassificationRule, Transaction } from '@/types';

/** 分类上下文缓存：交易数组引用变化时重建（store 每次变更都会换新数组） */
let cachedCtxKey: Transaction[] | null = null;
let cachedCtx: BuiltClassifyContext | null = null;

function getClassifyContext(
  transactions: Transaction[],
  rules: ClassificationRule[],
): BuiltClassifyContext {
  if (cachedCtxKey !== transactions || cachedCtx === null) {
    cachedCtx = buildClassifyContext(transactions, rules);
    cachedCtxKey = transactions;
  }
  return cachedCtx;
}

/** 解析并写入一条捕获到的交易 */
function processCapture(data: CapturedTransaction) {
  const { rules, settings } = useCaptureRuleStore.getState();
  const parsed = parseCapturedTransaction(data.text, {
    packageName: data.package ?? '',
    rules,
    settings,
  });
  if (!parsed) return;

  const timing = resolveCaptureTiming(data);
  const { transactionNo, transactionTime: timeStr, capturedAt } = timing;
  const store = useTransactionStore.getState();

  const id = generateTransactionId(timeStr, parsed.amount, transactionNo);
  // 同一条通知可能被实时推送和队列重放各送一次；账单回填后单号会被换成账单单号，
  // 所以除了单号还要按 id 判重，否则会重复记一笔。
  if (isDuplicateCapture(store.transactions, id, transactionNo)) return;

  const txn: Transaction = {
    id,
    transactionTime: timeStr,
    transactionType: parsed.transactionType,
    counterparty: parsed.counterparty,
    description: parsed.description,
    amount: parsed.amount,
    paymentStatus: '',
    transactionNo,
    paymentMethod: '',
    category: '',
    categorySource: 'auto',
    origin: 'auto',
    isPeriodic: false,
    tags: [],
    createdAt: new Date(capturedAt).toISOString(),
    coverImage: '',
    theme: '',
  };

  const customRules = useClassificationStore.getState().customRules;
  const ctx = getClassifyContext(store.transactions, customRules);
  const verdict = classifyTransactionDetailed(txn, ctx);

  // 自定义读取规则给出的分类优先级最高（那是用户显式写的规则，比六层判定更权威）
  const category = parsed.category || verdict.category;
  const categorySource: Transaction['categorySource'] = parsed.category
    ? 'rule'
    : verdict.level === 'guessed'
      ? 'guessed'
      : 'auto';

  store.addTransaction({
    ...txn,
    category,
    categorySource,
    classifyBasis: parsed.category ? 'rule' : verdict.basis,
    classifyReason: parsed.category ? '命中自定义读取规则' : verdict.reason,
  });
}

/**
 * 补扫通知栏 + 处理后台期间捕获到的内容。
 * 顺序很重要：先等本地数据加载完，否则刚记的一笔可能被随后的
 * loadFromStorage 覆盖掉。
 */
async function syncCaptures() {
  await Promise.all([
    useTransactionStore.getState().loadFromStorage(),
    useClassificationStore.getState().loadFromStorage(),
    useCaptureRuleStore.getState().loadFromStorage(),
  ]);

  try {
    await AutoLedger.scanActiveNotifications();
  } catch {
    // 监听服务未连接时补扫不可用，不影响队列处理
  }

  const r = await AutoLedger.getPendingCaptures();
  for (const c of r.captures) processCapture(c);
}

/** 在 App 顶层挂载一次（仅原生平台生效） */
export function useAutoLedger() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 启动时补扫通知栏，并处理持久队列里的历史捕获
    void syncCaptures();

    // 实时监听（App 在前台时即时入账）
    const handlePromise = AutoLedger.addListener('transactionCaptured', processCapture);

    // 回到前台时再补扫一次：捞回「通知投递时监听服务恰好没连着」的那条
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncCaptures();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      void handlePromise.then((h) => h.remove());
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
