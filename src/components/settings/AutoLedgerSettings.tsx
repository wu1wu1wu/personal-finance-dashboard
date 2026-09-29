// ============================================================
// AutoLedgerSettings - 自动记账授权、后台保障、规则与诊断
// ============================================================

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  BatteryCharging,
  ChevronDown,
  CircleCheck,
  CircleX,
  RefreshCw,
  Smartphone,
  Stethoscope,
} from 'lucide-react';
import AutoLedger from '@/plugins/AutoLedger';
import type { CaptureRecord } from '@/plugins/AutoLedger';
import { parseCapturedTransaction } from '@/core/transaction-capture';
import type { CaptureRule, CaptureSettings } from '@/types';
import { useCaptureRuleStore } from '@/stores/capture-rule-store';
import { cn } from '@/utils/cn';
import CaptureRuleEditor from '@/components/settings/CaptureRuleEditor';

type DebugInfo = Awaited<ReturnType<typeof AutoLedger.getDebugInfo>>;

const WECHAT_PACKAGE = 'com.tencent.mm';
const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

function formatTime(value: number): string {
  if (!value) return '暂无';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

/** 单条诊断记录：事件时间 + 来源包名 + 解析结果 + 原文 */
function CaptureRow({
  item,
  rules,
  settings,
}: {
  item: CaptureRecord;
  rules: CaptureRule[];
  settings: CaptureSettings;
}) {
  const parsed = parseCapturedTransaction(item.text, {
    packageName: item.package,
    rules,
    settings,
  });
  const isWechat = item.package === WECHAT_PACKAGE;

  let badge;
  if (parsed) {
    badge = (
      <span className="inline-flex items-center gap-0.5 text-income">
        <CircleCheck size={11} aria-hidden="true" />已识别 ¥{Math.abs(parsed.amount)}
      </span>
    );
  } else {
    badge = <span className="text-alert">交易筛选通过 · 解析失败</span>;
  }

  return (
    <div className="mt-1.5 border-t border-line pt-1.5 first:mt-0 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <span className="tnum">{formatTime(item.time)}</span>
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
      <p className="mt-1 break-all text-ink">{item.text}</p>
      {item.capturedAt && item.capturedAt !== item.time && (
        <p className="mt-0.5 text-[10px] text-ink-subtle">
          App 捕获于 {formatTime(item.capturedAt)}
        </p>
      )}
    </div>
  );
}

function StatusIcon({ granted }: { granted: boolean }) {
  return granted ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-income">
      <CircleCheck size={14} aria-hidden="true" />
      已开启
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-subtle">
      <CircleX size={14} aria-hidden="true" />
      未开启
    </span>
  );
}

export default function AutoLedgerSettings() {
  const [smsGranted, setSmsGranted] = useState<boolean | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [batteryIgnoring, setBatteryIgnoring] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const captureRules = useCaptureRuleStore((s) => s.rules);
  const captureSettings = useCaptureRuleStore((s) => s.settings);

  const refreshStatus = async () => {
    const [sms, notification, battery, debug] = await Promise.allSettled([
      AutoLedger.hasSmsPermission(),
      AutoLedger.hasNotificationAccess(),
      AutoLedger.getBatteryOptimizationStatus(),
      AutoLedger.getDebugInfo(),
    ]);

    if (sms.status === 'fulfilled') setSmsGranted(sms.value.granted);
    if (notification.status === 'fulfilled') setNotifEnabled(notification.value.enabled);
    if (battery.status === 'fulfilled') {
      setBatteryIgnoring(battery.value.ignoringOptimizations);
    }
    if (debug.status === 'fulfilled') setDebugInfo(debug.value);
  };

  useEffect(() => {
    if (isNative) void refreshStatus();
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
    setTimeout(() => void refreshStatus(), 1000);
  };

  const handleOpenBattery = async () => {
    await AutoLedger.openAppBatterySettings();
    setTimeout(() => void refreshStatus(), 1000);
  };

  const handleRescan = async () => {
    try {
      await AutoLedger.scanActiveNotifications();
    } catch {
      // 权限未开启时补扫会失败
    }
    await refreshStatus();
  };

  const handleClearDebug = async () => {
    await AutoLedger.clearDebug();
    await refreshStatus();
  };

  if (!isNative) {
    return (
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Smartphone size={16} className="text-ink-subtle" aria-hidden="true" />
          自动记账
        </h2>
        <p className="text-sm text-ink-muted">自动记账只支持安卓 App，请安装打包后的 App 使用。</p>
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
      hint: '读取微信、支付宝和银行通知',
      granted: notifEnabled,
      action: handleOpenNotif,
      actionLabel: '去开启',
    },
  ];

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Smartphone size={16} className="text-ink-subtle" aria-hidden="true" />
          授权状态
        </h2>
        <div className="space-y-4">
          {permissionRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{row.label}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{row.hint}</p>
              </div>
              {row.granted ? (
                <StatusIcon granted />
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
        <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-5 text-ink-muted">
          通知监听保持连接时会实时读取，不要求支付通知一直停留。只有服务断开后的补扫，才依赖通知栏中仍存在的消息。
        </p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <BatteryCharging size={16} className="text-ink-subtle" aria-hidden="true" />
          后台运行
        </h2>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">电池策略</p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {batteryIgnoring === null
                ? '正在检测…'
                : batteryIgnoring
                  ? '已允许后台持续运行'
                  : '建议改为“无限制”，避免系统断连'}
            </p>
          </div>
          {batteryIgnoring ? (
            <StatusIcon granted />
          ) : (
            <button
              type="button"
              onClick={handleOpenBattery}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              打开设置
            </button>
          )}
        </div>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <RefreshCw size={16} className="text-ink-subtle" aria-hidden="true" />
          消息读取规则
        </h2>
        <CaptureRuleEditor />
      </section>

      <section className={CARD}>
        <button
          type="button"
          onClick={() => {
            const next = !showDiagnostics;
            setShowDiagnostics(next);
            if (next) void refreshStatus();
          }}
          aria-expanded={showDiagnostics}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Stethoscope size={16} className="text-ink-subtle" aria-hidden="true" />
            诊断信息
          </span>
          <ChevronDown
            size={17}
            className={cn(
              'text-ink-subtle transition-transform',
              showDiagnostics && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {showDiagnostics && (
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-ink-muted">
            <div className="flex items-center justify-between gap-2">
              <span>通知监听连接</span>
              {debugInfo == null ? (
                <span>检测中…</span>
              ) : debugInfo.notificationConnected ? (
                <span className="inline-flex items-center gap-0.5 text-income">
                  <CircleCheck size={12} aria-hidden="true" />已连接
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-expense">
                  <CircleX size={12} aria-hidden="true" />未连接
                </span>
              )}
            </div>
            <p>最后连接：{formatTime(debugInfo?.lastConnectedAt ?? 0)}</p>
            <p>最后收到通知：{formatTime(debugInfo?.lastNotificationAt ?? 0)}</p>
            <p>微信最近到达：{formatTime(debugInfo?.wechatLastSeenAt ?? 0)}</p>
            <p>最后识别交易：{formatTime(debugInfo?.lastTransactionAt ?? 0)}</p>
            <p>待处理队列：{debugInfo ? `${debugInfo.queueSize} 条` : '检测中…'}</p>
            <p>已过滤非交易通知：{debugInfo?.filteredCount ?? 0} 条</p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="button" onClick={handleRescan} className="text-brand hover:underline">
                补扫通知栏
              </button>
              <button
                type="button"
                onClick={() => void refreshStatus()}
                className="text-brand hover:underline"
              >
                刷新
              </button>
              <button
                type="button"
                onClick={handleClearDebug}
                className="text-ink-subtle hover:underline"
              >
                清空诊断记录
              </button>
            </div>

            {debugInfo && debugInfo.recent.length > 0 && (
              <div className="pt-2">
                <p className="mb-1 font-medium text-ink">
                  最近识别到的 {debugInfo.recent.length} 条交易通知
                </p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                  {debugInfo.recent.map((item, i) => (
                    <CaptureRow
                      key={`${item.time}-${item.package}-${i}`}
                      item={item}
                      rules={captureRules}
                      settings={captureSettings}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
