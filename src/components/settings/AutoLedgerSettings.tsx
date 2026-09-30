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
import { useLocale, useT } from '@/i18n';
import type { Locale } from '@/i18n';
import { cn } from '@/utils/cn';
import CaptureRuleEditor from '@/components/settings/CaptureRuleEditor';

type DebugInfo = Awaited<ReturnType<typeof AutoLedger.getDebugInfo>>;

const WECHAT_PACKAGE = 'com.tencent.mm';
const CARD = 'rounded-2xl border border-line bg-surface p-4';
const SECTION_TITLE = 'mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink';

function formatTime(value: number, locale: Locale, emptyLabel: string): string {
  if (!value) return emptyLabel;
  return new Date(value).toLocaleString(locale, { hour12: false });
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
  const { t } = useT();
  const locale = useLocale();
  const parsed = parseCapturedTransaction(item.text, {
    packageName: item.package,
    rules,
    settings,
  });
  const isWechat = item.package === WECHAT_PACKAGE;
  const emptyTime = t('settingsRules.autoLedger.time.empty');

  let badge;
  if (parsed) {
    badge = (
      <span className="inline-flex items-center gap-0.5 text-income">
        <CircleCheck size={11} aria-hidden="true" />
        {t('settingsRules.autoLedger.recognized', { amount: Math.abs(parsed.amount) })}
      </span>
    );
  } else {
    badge = <span className="text-alert">{t('settingsRules.autoLedger.parseFailed')}</span>;
  }

  return (
    <div className="mt-1.5 border-t border-line pt-1.5 first:mt-0 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <span className="tnum">{formatTime(item.time, locale, emptyTime)}</span>
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
          {t('settingsRules.autoLedger.time.capturedAt', {
            time: formatTime(item.capturedAt, locale, emptyTime),
          })}
        </p>
      )}
    </div>
  );
}

function StatusIcon({ granted }: { granted: boolean }) {
  const { t } = useT();
  return granted ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-income">
      <CircleCheck size={14} aria-hidden="true" />
      {t('settingsRules.autoLedger.granted')}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-subtle">
      <CircleX size={14} aria-hidden="true" />
      {t('settingsRules.autoLedger.notGranted')}
    </span>
  );
}

export default function AutoLedgerSettings() {
  const { t } = useT();
  const locale = useLocale();
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
          {t('settingsRules.autoLedger.title')}
        </h2>
        <p className="text-sm text-ink-muted">{t('settingsRules.autoLedger.androidOnly')}</p>
      </section>
    );
  }

  const emptyTime = t('settingsRules.autoLedger.time.empty');

  const permissionRows = [
    {
      label: t('settingsRules.autoLedger.permission.sms'),
      hint: t('settingsRules.autoLedger.permission.smsHint'),
      granted: smsGranted === true,
      action: handleRequestSms,
      actionLabel: t('settingsRules.autoLedger.permission.smsAction'),
    },
    {
      label: t('settingsRules.autoLedger.permission.notification'),
      hint: t('settingsRules.autoLedger.permission.notificationHint'),
      granted: notifEnabled,
      action: handleOpenNotif,
      actionLabel: t('settingsRules.autoLedger.permission.notificationAction'),
    },
  ];

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <Smartphone size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsRules.autoLedger.permission.title')}
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
          {t('settingsRules.autoLedger.notificationNote')}
        </p>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <BatteryCharging size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsRules.autoLedger.battery.title')}
        </h2>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {t('settingsRules.autoLedger.battery.policy')}
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {batteryIgnoring === null
                ? t('settingsRules.autoLedger.battery.checking')
                : batteryIgnoring
                  ? t('settingsRules.autoLedger.battery.allowed')
                  : t('settingsRules.autoLedger.battery.recommend')}
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
              {t('settingsRules.autoLedger.battery.openSettings')}
            </button>
          )}
        </div>
      </section>

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>
          <RefreshCw size={16} className="text-ink-subtle" aria-hidden="true" />
          {t('settingsRules.autoLedger.captureRules.title')}
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
            {t('settingsRules.autoLedger.diagnostics.title')}
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
              <span>{t('settingsRules.autoLedger.diagnostics.connection')}</span>
              {debugInfo == null ? (
                <span>{t('settingsRules.autoLedger.diagnostics.checking')}</span>
              ) : debugInfo.notificationConnected ? (
                <span className="inline-flex items-center gap-0.5 text-income">
                  <CircleCheck size={12} aria-hidden="true" />
                  {t('settingsRules.autoLedger.diagnostics.connected')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-expense">
                  <CircleX size={12} aria-hidden="true" />
                  {t('settingsRules.autoLedger.diagnostics.disconnected')}
                </span>
              )}
            </div>
            <p>
              {t('settingsRules.autoLedger.diagnostics.lastConnected', {
                time: formatTime(debugInfo?.lastConnectedAt ?? 0, locale, emptyTime),
              })}
            </p>
            <p>
              {t('settingsRules.autoLedger.diagnostics.lastNotification', {
                time: formatTime(debugInfo?.lastNotificationAt ?? 0, locale, emptyTime),
              })}
            </p>
            <p>
              {t('settingsRules.autoLedger.diagnostics.wechatLastSeen', {
                time: formatTime(debugInfo?.wechatLastSeenAt ?? 0, locale, emptyTime),
              })}
            </p>
            <p>
              {t('settingsRules.autoLedger.diagnostics.lastTransaction', {
                time: formatTime(debugInfo?.lastTransactionAt ?? 0, locale, emptyTime),
              })}
            </p>
            <p>
              {debugInfo
                ? t('settingsRules.autoLedger.diagnostics.queueSize', { count: debugInfo.queueSize })
                : t('settingsRules.autoLedger.diagnostics.checking')}
            </p>
            <p>
              {t('settingsRules.autoLedger.diagnostics.filtered', {
                count: debugInfo?.filteredCount ?? 0,
              })}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="button" onClick={handleRescan} className="text-brand hover:underline">
                {t('settingsRules.autoLedger.diagnostics.rescan')}
              </button>
              <button
                type="button"
                onClick={() => void refreshStatus()}
                className="text-brand hover:underline"
              >
                {t('settingsRules.autoLedger.diagnostics.refresh')}
              </button>
              <button
                type="button"
                onClick={handleClearDebug}
                className="text-ink-subtle hover:underline"
              >
                {t('settingsRules.autoLedger.diagnostics.clear')}
              </button>
            </div>

            {debugInfo && debugInfo.recent.length > 0 && (
              <div className="pt-2">
                <p className="mb-1 font-medium text-ink">
                  {t('settingsRules.autoLedger.diagnostics.recent', {
                    count: debugInfo.recent.length,
                  })}
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
