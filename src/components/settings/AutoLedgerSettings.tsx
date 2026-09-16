// ============================================================
// 自动记账设置面板 - 授权短信权限 / 通知使用权 + 诊断
// ============================================================

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import AutoLedger from '@/plugins/AutoLedger';
import type { CaptureRecord } from '@/plugins/AutoLedger';
import { parseCapturedTransaction } from '@/core/transaction-capture';

type DebugInfo = Awaited<ReturnType<typeof AutoLedger.getDebugInfo>>;

/** 微信包名：高亮显示，用于确认微信通知到底有没有进到监听服务 */
const WECHAT_PACKAGE = 'com.tencent.mm';

/** 捕获记录展示：包名 + 时间 + 文本 + 原生闸门 / 解析结果 */
function CaptureRow({ item }: { item: CaptureRecord }) {
  const parsed = parseCapturedTransaction(item.text);
  const time = item.time
    ? new Date(item.time).toLocaleTimeString('zh-CN', { hour12: false })
    : '';
  const isWechat = item.package === WECHAT_PACKAGE;

  let badge;
  if (parsed) {
    badge = <span className="text-green-600">✓ 已入账 ¥{Math.abs(parsed.amount)}</span>;
  } else if (item.likely) {
    badge = <span className="text-orange-500">闸门通过 · 解析失败</span>;
  } else {
    badge = <span className="text-gray-400">非交易通知</span>;
  }

  return (
    <div className="border-t border-gray-200 pt-1.5 mt-1.5 first:border-0 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
        <span className="font-mono">{time}</span>
        <span
          className={
            isWechat
              ? 'px-1 rounded bg-green-100 text-green-700 font-medium'
              : 'px-1 rounded bg-gray-200 text-gray-600'
          }
        >
          {item.package || item.source}
        </span>
        {badge}
      </div>
      <p className="text-gray-700 break-all">{item.text}</p>
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
      // 忽略
    }
  };

  useEffect(() => {
    if (!isNative) return;
    // 进入页面时查询真实权限状态（而非依赖组件本地状态）
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
    // 从系统设置返回后重新检查状态
    setTimeout(async () => {
      const r = await AutoLedger.hasNotificationAccess();
      setNotifEnabled(r.enabled);
    }, 1000);
  };

  /** 立即补扫通知栏里仍存在的通知，然后刷新诊断 */
  const handleRescan = async () => {
    try {
      await AutoLedger.scanActiveNotifications();
    } catch {
      // 服务未连接时补扫不可用
    }
    await refreshDebug();
  };

  const handleClearDebug = async () => {
    await AutoLedger.clearDebug();
    await refreshDebug();
  };

  if (!isNative) {
    return (
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">📲 自动记账</h2>
        <p className="text-sm text-gray-500">自动记账仅支持安卓 App，请在打包安装后的 App 中使用。</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">📲 自动记账</h2>
      <p className="text-sm text-gray-500 mb-4">
        授权后可自动读取银行卡短信与微信/支付宝通知，识别收支并自动记账。
      </p>

      <div className="space-y-3">
        {/* 短信权限 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">短信权限</p>
            <p className="text-xs text-gray-400">读取银行卡交易短信</p>
          </div>
          {smsGranted ? (
            <span className="text-sm text-green-600">✓ 已授权</span>
          ) : (
            <button
              onClick={handleRequestSms}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              授权
            </button>
          )}
        </div>

        {/* 通知使用权 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">通知使用权</p>
            <p className="text-xs text-gray-400">读取微信支付 / 支付宝通知</p>
          </div>
          {notifEnabled ? (
            <span className="text-sm text-green-600">✓ 已开启</span>
          ) : (
            <button
              onClick={handleOpenNotif}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              去开启
            </button>
          )}
        </div>
      </div>

      {/* 诊断信息 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">🔍 诊断</span>
          <div className="flex items-center gap-3">
            <button onClick={handleRescan} className="text-blue-500 hover:underline">
              补扫
            </button>
            <button onClick={refreshDebug} className="text-blue-500 hover:underline">
              刷新
            </button>
            <button onClick={handleClearDebug} className="text-gray-400 hover:underline">
              清空
            </button>
          </div>
        </div>
        <p>
          通知监听连接：
          {debugInfo == null
            ? '检测中...'
            : debugInfo.notificationConnected
              ? '✅ 已连接'
              : '❌ 未连接'}
        </p>
        <p>
          最近捕获：
          {debugInfo && debugInfo.lastText
            ? `[${debugInfo.lastSource}${debugInfo.lastPackage ? ` · ${debugInfo.lastPackage}` : ''}] ${debugInfo.lastText}`
            : '暂无'}
        </p>
        <p>待处理队列：{debugInfo ? `${debugInfo.queueSize} 条` : '检测中...'}</p>

        {debugInfo && debugInfo.recent.length > 0 && (
          <div className="pt-2">
            <p className="font-medium text-gray-700 mb-1">
              最近 {debugInfo.recent.length} 条捕获（最新在前）
            </p>
            <p className="text-gray-400 mb-1">
              微信通知是否到达，看有没有绿色标签 com.tencent.mm
            </p>
            <div className="max-h-72 overflow-y-auto bg-white rounded border border-gray-200 p-2">
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
