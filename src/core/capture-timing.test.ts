import { describe, expect, it } from 'vitest';
import { resolveCaptureTiming } from './capture-timing';

describe('resolveCaptureTiming', () => {
  it('交易时间使用消息事件时间，createdAt 使用实际捕获时间', () => {
    const eventTime = new Date(2026, 8, 23, 19, 4, 5).getTime();
    const capturedAt = new Date(2026, 8, 23, 21, 30, 0).getTime();

    const result = resolveCaptureTiming({
      timestamp: eventTime,
      capturedAt,
      fingerprint: 'notification-key|123',
    });

    expect(result.eventTime).toBe(eventTime);
    expect(result.capturedAt).toBe(capturedAt);
    expect(result.transactionTime).toBe('2026-09-23 19:04:05');
    expect(result.transactionNo).toBe('auto-notification-key|123');
  });

  it('旧队列没有 capturedAt 时沿用事件时间', () => {
    const eventTime = new Date(2026, 8, 23, 19, 4, 5).getTime();
    const result = resolveCaptureTiming({ timestamp: eventTime }, 999);

    expect(result.capturedAt).toBe(999);
    expect(result.eventTime).toBe(eventTime);
    expect(result.transactionNo).toBe(`auto-${eventTime}`);
  });

  it('完全没有事件时间时回退到捕获时间', () => {
    const result = resolveCaptureTiming({ capturedAt: 123456 });

    expect(result.eventTime).toBe(123456);
    expect(result.capturedAt).toBe(123456);
  });
});
