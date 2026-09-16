// ============================================================
// 自动记账 Hook - 监听原生端捕获到的短信/通知，解析后写入交易库
// 说明：原生端实时推送 + 持久队列兜底；本 Hook 在启动/回前台时补扫通知栏并清空队列
// ============================================================

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import AutoLedger from '@/plugins/AutoLedger';
import type { CapturedTransaction } from '@/plugins/AutoLedger';
import { parseCapturedTransaction } from '@/core/transaction-capture';
import { classifyTransaction } from '@/core/classifier';
import { generateTransactionId } from '@/utils/id';
import { useTransactionStore } from '@/stores/transaction-store';
import { useClassificationStore } from '@/stores/classification-store';
import { buildHabitModel } from '@/core/habit-learner';
import type { HabitModel } from '@/core/habit-learner';
import type { Transaction } from '@/types';

/** 习惯模型缓存：交易数组引用变化时重建（store 每次变更都会换新数组） */
let cachedModelKey: Transaction[] | null = null;
let cachedModel: HabitModel | null = null;

function getHabitModel(transactions: Transaction[]): HabitModel {
  if (cachedModelKey !== transactions || cachedModel === null) {
    cachedModel = buildHabitModel(transactions);
    cachedModelKey = transactions;
  }
  return cachedModel;
}

/** 把时间戳格式化为本地 "yyyy-MM-dd HH:mm:ss" */
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 解析并写入一条捕获到的交易 */
function processCapture(data: CapturedTransaction) {
  const parsed = parseCapturedTransaction(data.text);
  if (!parsed) return;

  // 同一笔会同时走「实时推送」和「持久队列」两条路，按来源时间戳去重
  const transactionNo = `auto-${data.timestamp}`;
  const store = useTransactionStore.getState();
  if (store.transactions.some((t) => t.transactionNo === transactionNo)) return;

  // 必须用原生捕获时刻（= 支付时刻）而不是「当前处理时刻」：
  // App 在后台时，通知可能隔几小时才被处理，用处理时刻会让账单回填的时间匹配失准。
  const timeStr = formatDateTime(data.timestamp);
  const txn: Transaction = {
    id: generateTransactionId(timeStr, parsed.amount, transactionNo),
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
    createdAt: new Date().toISOString(),
    coverImage: '',
  };

  const customRules = useClassificationStore.getState().customRules;
  let category = classifyTransaction(txn, customRules);
  let categorySource: Transaction['categorySource'] = 'auto';

  // 关键词规则没命中时，用历史账单学到的「金额 + 时段」习惯给一个推测分类。
  // 推测结果单独标记，方便用户一眼分辨并能一键改正。
  if (category === '待确认') {
    const guess = getHabitModel(store.transactions).predict(txn);
    if (guess) {
      category = guess.category;
      categorySource = 'guessed';
    }
  }

  store.addTransaction({ ...txn, category, categorySource });
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
