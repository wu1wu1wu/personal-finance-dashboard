package com.pfd.ledger;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;

/**
 * 通知监听服务：抓取微信支付 / 支付宝等交易通知，转发到插件。
 *
 * 两条采集路径：
 * 1. onNotificationPosted —— 实时投递（服务已连接时）
 * 2. onListenerConnected / scanActiveNow —— 补偿扫描通知栏里仍存在的通知
 *    覆盖「通知投递时服务恰好未连接」这个国产 ROM 上最常见的漏采场景
 */
public class AutoLedgerNotificationService extends NotificationListenerService {

    /** 当前活着的服务实例，供插件在 App 回到前台时触发补偿扫描 */
    private static AutoLedgerNotificationService live;

    @Override
    public void onListenerConnected() {
        live = this;
        AutoLedgerPlugin.setNotificationConnected(true);
        // 连上的瞬间补扫一次，捞回服务未连接期间投递的通知
        scanActive("active");
    }

    @Override
    public void onListenerDisconnected() {
        if (live == this) live = null;
        AutoLedgerPlugin.setNotificationConnected(false);
    }

    @Override
    public void onDestroy() {
        if (live == this) live = null;
        super.onDestroy();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        ingest(sbn, "notification");
    }

    /**
     * 供插件调用：立即补扫通知栏。
     * @return 服务当前是否存活（false 表示服务没连上，扫描无从谈起）
     */
    public static boolean scanActiveNow() {
        AutoLedgerNotificationService s = live;
        if (s == null) return false;
        s.scanActive("active");
        return true;
    }

    /** 扫描当前通知栏里仍然存在的通知 */
    private void scanActive(String source) {
        StatusBarNotification[] active;
        try {
            active = getActiveNotifications();
        } catch (Exception e) {
            return;
        }
        if (active == null) return;
        for (StatusBarNotification sbn : active) {
            ingest(sbn, source);
        }
    }

    /**
     * 统一入口：抽取文本 + 生成指纹后交给插件。
     * 指纹用「通知 key + 投递时间」，这样实时投递与补偿扫描拿到的是同一条，
     * 由插件侧去重，避免同一笔被记两次。
     */
    private void ingest(StatusBarNotification sbn, String source) {
        if (sbn == null) return;
        try {
            String text = extractText(sbn);
            String fingerprint = sbn.getKey() + "|" + sbn.getPostTime();
            AutoLedgerPlugin.capture(getApplicationContext(), source, text, sbn.getPackageName(), fingerprint);
        } catch (Exception ignored) {
            // 单条通知解析失败不影响其他通知
        }
    }

    /**
     * 遍历通知里所有文本字段。
     * 微信/支付宝不一定把正文放在 EXTRA_TEXT，因此这里覆盖：
     * tickerText、所有 CharSequence、CharSequence[]（textLines）、ArrayList<CharSequence>
     */
    private String extractText(StatusBarNotification sbn) {
        StringBuilder sb = new StringBuilder();
        try {
            Notification notification = sbn.getNotification();
            if (notification == null) return "";

            append(sb, notification.tickerText);

            Bundle extras = notification.extras;
            if (extras != null) {
                for (String key : extras.keySet()) {
                    Object value = extras.get(key);
                    if (value instanceof CharSequence) {
                        append(sb, (CharSequence) value);
                    } else if (value instanceof CharSequence[]) {
                        for (CharSequence cs : (CharSequence[]) value) {
                            append(sb, cs);
                        }
                    } else if (value instanceof ArrayList) {
                        for (Object o : (ArrayList<?>) value) {
                            if (o instanceof CharSequence) {
                                append(sb, (CharSequence) o);
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // 忽略解析失败的通知
        }
        return sb.toString().trim();
    }

    /** 追加一段文本，跳过空串与系统内部类名噪音，并去掉重复片段 */
    private static void append(StringBuilder sb, CharSequence cs) {
        if (cs == null) return;
        String s = cs.toString().trim();
        if (s.isEmpty()) return;
        // 某些媒体通知的 extras 里混着类名，没有信息量
        if (s.startsWith("android.app.Notification$")) return;
        if (sb.indexOf(s) >= 0) return;
        if (sb.length() > 0) sb.append(' ');
        sb.append(s);
    }

    /** 判断本应用的通知使用权是否已开启 */
    public static boolean isEnabled(Context context) {
        ComponentName cn = new ComponentName(context, AutoLedgerNotificationService.class);
        String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (flat == null || flat.isEmpty()) return false;
        for (String s : flat.split(":")) {
            if (cn.flattenToString().equals(s)) return true;
        }
        return false;
    }
}
