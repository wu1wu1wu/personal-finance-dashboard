// ============================================================
// AutoLedgerSettings - 自动记账（短信权限 + 通知使用权 + 诊断）
// ============================================================

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CircleCheck, CircleX, Smartphone, Stethoscope } from 'lucide-react';
import AutoLedger from '@/plugins/AutoLedger';
import type { CaptureRecord } from '@/plugins/AutoLedger';
import { parseCapturedTransaction } from '@/core/transaction-capture';
import { cn } from '@/utils/cn';

type DebugInfo = Awaited<ReturnType<typeof AutoLedger.getDebugInfo>>;

/** 微信包名，用于在诊断列表里高亮确认微信通知是否到达 */
const WECHAT_PACKAGE = 'com.tencent.mm';

/** 单条诊断记录：时间 + 来源包名 + 解析结果 + 原文 */
function CaptureRow({ item }: { item: CaptureRecord }) {
  const parsed = parseCapturedTransaction(item.text);
  const time = item.time
    ? new Date(item.time).toLocaleTimeString('zh-CN', { hour12: false })
    : '';
  const isWechat = item.package === WECHAT_PACKAGE;

  let badge;
  if (parsed) {
    badge = (
      <span className="inline-flex items-center gap-0.5 text-income">
        <CircleCheck size={11} aria-hidden="true" />已入账 ¥{Math.abs(parsed.amount)}
      </span>
    );
  } else if (item.likely) {
    badge = <span className="text-alert">像交易通知 · 解析失败</span>;
  } else {
    badge = <span className="text-ink-subtle">非交易通知</span>;
  }

  return (
    <div className="mt-1.5 border-t border-line pt-1.5 first:mt-0 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <span className="tnum">{time}</span>
        <span
          className={cn(
            'rounded px-1 font-medium',
            isWechat ? 'bg-income-soft text-income' : 'bg-canvas text-ink-muted',
          )}
        >
          {item.package || item.source}
        </span>
        {badge}
      </div>
      <p className="break-all text-ink">{item.text}</p>
    </div>
  );
}

export default function AutoLedgerSettings() {
  const [smsGranted, setSmsGranted] = useState<boolean | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const refreshDebug = async () => {
    try {
      setDebugInfo(await AutoLedger.getDebugInfo());
    } catch {
      // 插件不可用时保持上一次结果
    }
  };

  useEffect(() => {
    if (!isNative) return;
    // 每次进入设置页都查询真实权限状态，不依赖组件内的临时状态
    void AutoLedger.hasSmsPermission().then((r) => setSmsGranted(r.granted));
    void AutoLedger.hasNotificationAccess().then((r) => setNotifEnabled(r.enabled));
    void refreshDebug();
  }, [isNative]);

  const handleRequestSms = async () => {
    try {
      await AutoLedger.requestSmsPermission();
      setSmsGranted(true);
    } catch {
      setSmsGranted(false);
    }
  };

  const handleOpenNotif = async () => {
    await AutoLedger.openNotificationSettings();
    // 等系统设置页返回后重新查询状态
    setTimeout(async () => {
      const r = await AutoLedger.hasNotificationAccess();
      setNotifEnabled(r.enabled);
    }, 1000);
  };

  /** 主动补扫通知栏里已经存在的通知，然后刷新诊断 */
  const handleRescan = async () => {
    try {
      await AutoLedger.scanActiveNotifications();
    } catch {
      // 权限未开启时补扫会失败
    }
    await refreshDebug();
  };

  const handleClearDebug = async () => {
    await AutoLedger.clearDebug();
    await refreshDebug();
  };

  if (!isNative) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Smartphone size={16} className="text-ink-subtle" aria-hidden="true" />
          自动记账
        </h2>
        <p className="text-sm text-ink-muted">
          自动记账只支持安卓 App，请安装打包后的 App 使用。
        </p>
      </section>
    );
  }

  const permissionRows = [
    {
      label: '短信权限',
      hint: '读取银行卡交易短信',
      granted: smsGranted === true,
      action: handleRequestSms,
      actionLabel: '去授权',
    },
    {
      label: '通知使用权',
      hint: '读取微信支付 / 支付宝通知',
      granted: notifEnabled,
      action: handleOpenNotif,
      actionLabel: '去开启',
    },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Smartphone size={16} className="text-ink-subtle" aria-hidden="true" />
        自动记账
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        授权后自动读取银行卡短信和微信 / 支付宝通知，识别到收支会直接记账。
      </p>

      <div className="space-y-3">
        {permissionRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{row.label}</p>
              <p className="text-xs text-ink-subtle">{row.hint}</p>
            </div>
            {row.granted ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-income">
                <CircleCheck size={14} aria-hidden="true" />
                已授权
              </span>
            ) : (
              <button
                type="button"
                onClick={row.action}
                className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
              >
                {row.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 诊断面板 */}
      <div className="mt-4 space-y-1 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 font-medium text-ink">
            <Stethoscope size={13} aria-hidden="true" />
            诊断
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleRescan} className="text-brand hover:underline">
              补扫
            </button>
            <button type="button" onClick={refreshDebug} className="text-brand hover:underline">
              刷新
            </button>
            <button
              type="button"
              onClick={handleClearDebug}
              className="text-ink-subtle hover:underline"
            >
              清空
            </button>
          </div>
        </div>

        <p className="flex items-center gap-1">
          通知监听连接：
          {debugInfo == null ? (
            '检测中…'
          ) : debugInfo.notificationConnected ? (
            <span className="inline-flex items-center gap-0.5 text-income">
              <CircleCheck size={12} aria-hidden="true" />已连接
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-expense">
              <CircleX size={12} aria-hidden="true" />未连接
            </span>
          )}
        </p>

        <p>
          最近捕获：
          {debugInfo && debugInfo.lastText
            ? `[${debugInfo.lastSource}${debugInfo.lastPackage ? ` · ${debugInfo.lastPackage}` : ''}] ${debugInfo.lastText}`
            : '暂无'}
        </p>

        <p>待处理队列：{debugInfo ? `${debugInfo.queueSize} 条` : '检测中…'}</p>

        {debugInfo && debugInfo.recent.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 font-medium text-ink">
              最近 {debugInfo.recent.length} 条通知（新的在前）
            </p>
            <p className="mb-1 text-ink-subtle">
              微信通知是否到达，就看有没有绿色标签 com.tencent.mm
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-2">
              {debugInfo.recent.map((item, i) => (
                <CaptureRow key={`${item.time}-${item.package}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
