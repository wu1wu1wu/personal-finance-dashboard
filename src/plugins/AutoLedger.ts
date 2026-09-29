import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/** 捕获到的交易原始文本（由原生端转发） */
export interface CapturedTransaction {
  /** 来源：短信 / 通知实时投递 / 连接时补偿扫描 */
  source: 'sms' | 'notification' | 'active';
  /** 原始文本 */
  text: string;
  /** 通知来源包名，例如 com.tencent.mm；短信等无来源时为空串 */
  package: string;
  /** 稳定事件指纹，用于实时推送与持久队列去重 */
  fingerprint: string;
  /** 消息事件时间（通知 postTime / 短信时间戳，毫秒） */
  timestamp: number;
  /** App 实际捕获并落盘的时间（毫秒） */
  capturedAt: number;
}

/** 诊断历史里的一条捕获记录 */
export interface CaptureRecord {
  /** 来源：sms / notification / active */
  source: string;
  /** 原始文本（空文本会被标记为 "(空文本)"） */
  text: string;
  /** 通知来源包名，例如 com.tencent.mm */
  package: string;
  /** 稳定事件指纹 */
  fingerprint: string;
  /** 消息事件时间（毫秒） */
  time: number;
  /** App 实际捕获时间（毫秒） */
  capturedAt: number;
  /** 原生侧粗筛结果：是否疑似交易 */
  likely: boolean;
}

export interface AutoLedgerPlugin {
  /** 查询短信权限是否已授予 */
  hasSmsPermission(): Promise<{ granted: boolean }>;
  /** 请求短信权限 */
  requestSmsPermission(): Promise<void>;
  /** 读取并清空持久队列里的待处理捕获 */
  getPendingCaptures(): Promise<{ captures: CapturedTransaction[] }>;
  /** 检查通知使用权是否已开启 */
  hasNotificationAccess(): Promise<{ enabled: boolean }>;
  /** 打开系统「通知使用权」设置页 */
  openNotificationSettings(): Promise<void>;
  /** 查询系统是否已忽略本 App 的电池优化 */
  getBatteryOptimizationStatus(): Promise<{ ignoringOptimizations: boolean }>;
  /** 打开本 App 的系统详情页，由用户设置后台电池策略 */
  openAppBatterySettings(): Promise<void>;
  /** 诊断信息：通知监听连接状态 + 最近捕获内容（含历史） */
  getDebugInfo(): Promise<{
    notificationConnected: boolean;
    lastSource: string;
    lastText: string;
    lastPackage: string;
    lastTime: number;
    lastLikely: boolean;
    /** 最近一次通知监听连接时间 */
    lastConnectedAt: number;
    /** 最近一次收到任意通知的时间 */
    lastNotificationAt: number;
    /** 最近一次识别到疑似交易的时间 */
    lastTransactionAt: number;
    /** 被原生过滤掉的非交易通知数量 */
    filteredCount: number;
    /** 最近一次收到微信通知的时间 */
    wechatLastSeenAt: number;
    /** 最近若干条捕获（最新在前） */
    recent: CaptureRecord[];
    /** 待处理队列长度 */
    queueSize: number;
  }>;
  /** 清空诊断历史（便于做一次干净的复现测试） */
  clearDebug(): Promise<void>;
  /** 立即补扫通知栏里仍存在的通知；scanned=false 表示监听服务未连接 */
  scanActiveNotifications(): Promise<{ scanned: boolean }>;
  /** 监听捕获到的交易文本 */
  addListener(
    eventName: 'transactionCaptured',
    listenerFunc: (data: CapturedTransaction) => void,
  ): Promise<PluginListenerHandle>;
}

const AutoLedger = registerPlugin<AutoLedgerPlugin>('AutoLedger');

export default AutoLedger;
