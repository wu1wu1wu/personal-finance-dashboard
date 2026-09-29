/** 自动记账事件时间换算的纯函数输入 */
export interface CaptureTimingInput {
  /** 消息事件时间（通知 postTime / 短信时间戳） */
  timestamp?: number;
  /** App 实际捕获时间 */
  capturedAt?: number;
  /** 原生生成的稳定事件指纹 */
  fingerprint?: string;
}

export interface CaptureTiming {
  eventTime: number;
  capturedAt: number;
  transactionTime: string;
  transactionNo: string;
}

function formatLocalDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 解析捕获事件的两种时间语义。
 *
 * eventTime 进入交易明细；capturedAt 只用于 createdAt。旧队列缺少时间字段时回退到
 * 当前时间，缺少 fingerprint 时用事件时间生成去重键。
 */
export function resolveCaptureTiming(
  capture: CaptureTimingInput,
  fallbackNow = Date.now(),
): CaptureTiming {
  const capturedAt =
    typeof capture.capturedAt === 'number' && capture.capturedAt > 0
      ? capture.capturedAt
      : fallbackNow;
  const eventTime =
    typeof capture.timestamp === 'number' && capture.timestamp > 0
      ? capture.timestamp
      : capturedAt;

  return {
    eventTime,
    capturedAt,
    transactionTime: formatLocalDateTime(eventTime),
    transactionNo: `auto-${capture.fingerprint || eventTime}`,
  };
}
