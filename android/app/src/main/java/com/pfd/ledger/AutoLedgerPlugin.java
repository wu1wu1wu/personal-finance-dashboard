package com.pfd.ledger;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "AutoLedger",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }
        )
    }
)
public class AutoLedgerPlugin extends Plugin {

    private static AutoLedgerPlugin instance;

    private static volatile boolean notificationConnected = false;

    private static final String QUEUE_PREFS = "pfd_autoledger_queue";
    private static final String QUEUE_KEY = "captures";
    private static final int MAX_QUEUE = 50;

    private static final String DEBUG_PREFS = "pfd_autoledger_debug";
    private static final String DEBUG_LAST_SOURCE = "last_source";
    private static final String DEBUG_LAST_TEXT = "last_text";
    private static final String DEBUG_LAST_PACKAGE = "last_package";
    private static final String DEBUG_LAST_TIME = "last_time";
    private static final String DEBUG_LAST_LIKELY = "last_likely";
    private static final String DEBUG_RECENT = "recent";
    private static final int DEBUG_RECENT_MAX = 50;

    /** 已处理过的通知指纹（通知 key|postTime），用于「实时投递 + 补偿扫描」去重 */
    private static final String SEEN_PREFS = "pfd_autoledger_seen";
    private static final String SEEN_KEY = "fingerprints";
    private static final int MAX_SEEN = 200;
    private static final long SEEN_TTL_MS = 12L * 60 * 60 * 1000;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        instance = null;
    }

    /** 把捕获到的原始文本发给 Web 层（实时推） */
    public void emitCapturedText(String source, String text) {
        emitCapturedText(source, text, System.currentTimeMillis());
    }

    /**
     * 把捕获到的原始文本发给 Web 层。
     * timestamp 由调用方传入：队列与实时推送必须用同一个时间戳，
     * 否则同一笔会被当成两条记录（Web 层用 timestamp 生成去重 ID）。
     */
    public void emitCapturedText(String source, String text, long timestamp) {
        if (text == null || text.trim().isEmpty()) return;
        JSObject data = new JSObject();
        data.put("source", source); // "sms" / "notification" / "active"
        data.put("text", text);
        data.put("timestamp", timestamp);
        notifyListeners("transactionCaptured", data, true);
    }

    /** 静态入口：短信等无包名来源 */
    public static void capture(Context context, String source, String text) {
        capture(context, source, text, "");
    }

    /** 静态入口：无指纹（短信广播不会重复投递） */
    public static void capture(Context context, String source, String text, String packageName) {
        capture(context, source, text, packageName, "");
    }

    /**
     * 静态入口：实时通知（若 WebView 存活）+ 持久队列兜底。
     *
     * @param fingerprint 通知指纹（通知 key|postTime）。同一条通知被「实时投递」和
     *                    「补偿扫描」各拿一次时，靠它去重，避免同一笔记两次。
     */
    public static void capture(Context context, String source, String text,
                               String packageName, String fingerprint) {
        String pkg = packageName == null ? "" : packageName;
        String raw = text == null ? "" : text.trim();
        long now = System.currentTimeMillis();

        // 0. 同一条通知已在别处处理过 → 直接跳过（连诊断都不重复记）
        if (fingerprint != null && !fingerprint.isEmpty() && seenBefore(context, fingerprint, now)) {
            return;
        }

        // 1. 抽不出文本的通知也要留痕，否则微信那条会「静默消失」，无从排查
        if (raw.isEmpty()) {
            recordDebug(context, source, "(空文本)", pkg, now, false);
            return;
        }

        boolean likely = looksLikeTransaction(raw);

        // 2. 疑似交易的落盘到持久队列（App 被杀 / 后台也能补记）
        if (likely) {
            enqueueCapture(context, source, raw, now);
        }

        // 3. 记录诊断信息（最近若干条 + 最后一次）——全量记录，否则无从排查
        recordDebug(context, source, raw, pkg, now, likely);

        // 4. 只有疑似交易的才实时推给 Web 层，避免聊天里的金额被误记账
        if (likely) {
            AutoLedgerPlugin p = instance;
            if (p != null) {
                // 与入队共用同一个 now，保证 Web 层能把两者去重
                p.emitCapturedText(source, raw, now);
            }
        }
    }

    /**
     * 粗筛：文本里既有数字、又有金额/交易字样才认为可能是交易。
     * 目的是过滤掉无关通知（音视频、下载、系统提示等），不追求精确。
     */
    private static boolean looksLikeTransaction(String text) {
        if (text == null) return false;
        boolean hasDigit = false;
        for (int i = 0; i < text.length(); i++) {
            if (Character.isDigit(text.charAt(i))) {
                hasDigit = true;
                break;
            }
        }
        if (!hasDigit) return false;
        String[] hints = {
            "¥", "￥", "元", "人民币", "支付", "付款", "消费", "扣款", "支出",
            "收入", "到账", "转账", "退款", "收款", "余额", "账单", "交易"
        };
        for (String h : hints) {
            if (text.contains(h)) return true;
        }
        return false;
    }

    /**
     * 写诊断信息：最近一次捕获 + 最近 N 条历史。
     * 历史按「包名 + 文本」去重，避免 QQ 音乐这类高频刷新的通知把列表挤爆，
     * 导致真正关心的那条被挤出可视范围。
     */
    private static void recordDebug(Context context, String source, String text,
                                    String pkg, long now, boolean likely) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(DEBUG_PREFS, Context.MODE_PRIVATE);
            JSONArray recent = new JSONArray();
            try {
                recent = new JSONArray(prefs.getString(DEBUG_RECENT, "[]"));
            } catch (JSONException ignored) {
            }

            // 同包同文本已出现过 → 不再重复插入
            for (int i = 0; i < recent.length(); i++) {
                JSONObject old = recent.optJSONObject(i);
                if (old != null
                        && pkg.equals(old.optString("package"))
                        && text.equals(old.optString("text"))) {
                    return;
                }
            }

            JSONObject obj = new JSONObject();
            obj.put("source", source);
            obj.put("text", text);
            obj.put("package", pkg);
            obj.put("time", now);
            obj.put("likely", likely);

            // 最新的放最前面，只保留最近 N 条
            JSONArray next = new JSONArray();
            next.put(obj);
            for (int i = 0; i < recent.length() && next.length() < DEBUG_RECENT_MAX; i++) {
                next.put(recent.get(i));
            }
            prefs.edit()
                    .putString(DEBUG_LAST_SOURCE, source)
                    .putString(DEBUG_LAST_TEXT, text)
                    .putString(DEBUG_LAST_PACKAGE, pkg)
                    .putLong(DEBUG_LAST_TIME, now)
                    .putBoolean(DEBUG_LAST_LIKELY, likely)
                    .putString(DEBUG_RECENT, next.toString())
                    .apply();
        } catch (Exception ignored) {
        }
    }

    /**
     * 指纹是否已处理过。首次见到时记录并返回 false。
     * 过期的指纹会被清理，避免无限增长。
     */
    private static boolean seenBefore(Context context, String fingerprint, long now) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(SEEN_PREFS, Context.MODE_PRIVATE);
            JSONArray arr = new JSONArray();
            try {
                arr = new JSONArray(prefs.getString(SEEN_KEY, "[]"));
            } catch (JSONException ignored) {
            }

            JSONArray kept = new JSONArray();
            boolean seen = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                long t = o.optLong("time", 0);
                if (now - t > SEEN_TTL_MS) continue;
                if (fingerprint.equals(o.optString("fp"))) {
                    seen = true;
                }
                kept.put(o);
            }

            if (seen) return true;

            JSONObject entry = new JSONObject();
            entry.put("fp", fingerprint);
            entry.put("time", now);
            kept.put(entry);
            while (kept.length() > MAX_SEEN) {
                kept.remove(0);
            }
            prefs.edit().putString(SEEN_KEY, kept.toString()).apply();
            return false;
        } catch (Exception e) {
            // 去重失败不应阻断记账
            return false;
        }
    }

    /** 通知监听服务的连接状态回调 */
    public static void setNotificationConnected(boolean connected) {
        notificationConnected = connected;
    }

    /** 诊断信息：通知监听是否连接 + 最近捕获内容（含历史） */
    @PluginMethod
    public void getDebugInfo(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(DEBUG_PREFS, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("notificationConnected", notificationConnected);
        ret.put("lastSource", prefs.getString(DEBUG_LAST_SOURCE, ""));
        ret.put("lastText", prefs.getString(DEBUG_LAST_TEXT, ""));
        ret.put("lastPackage", prefs.getString(DEBUG_LAST_PACKAGE, ""));
        ret.put("lastTime", prefs.getLong(DEBUG_LAST_TIME, 0));
        ret.put("lastLikely", prefs.getBoolean(DEBUG_LAST_LIKELY, false));
        JSArray recent = new JSArray();
        try {
            JSONArray arr = new JSONArray(prefs.getString(DEBUG_RECENT, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("source", o.optString("source"));
                item.put("text", o.optString("text"));
                item.put("package", o.optString("package"));
                item.put("time", o.optLong("time"));
                item.put("likely", o.optBoolean("likely"));
                recent.put(item);
            }
        } catch (JSONException ignored) {
        }
        ret.put("recent", recent);
        ret.put("queueSize", readQueue(getContext()).length());
        call.resolve(ret);
    }

    /** 清空诊断历史（方便做一次干净的复现测试） */
    @PluginMethod
    public void clearDebug(PluginCall call) {
        getContext().getSharedPreferences(DEBUG_PREFS, Context.MODE_PRIVATE)
                .edit().clear().apply();
        call.resolve();
    }

    /**
     * 立即补扫通知栏里仍然存在的通知。
     * App 回到前台时调用，用于捞回「通知投递时监听服务恰好没连着」的那条。
     */
    @PluginMethod
    public void scanActiveNotifications(PluginCall call) {
        boolean scanned = AutoLedgerNotificationService.scanActiveNow();
        JSObject ret = new JSObject();
        ret.put("scanned", scanned);
        call.resolve(ret);
    }

    /** 查询短信权限是否已授予 */
    @PluginMethod
    public void hasSmsPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    /** 请求短信权限（RECEIVE_SMS + READ_SMS） */
    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            call.resolve();
        } else {
            call.reject("短信权限被拒绝，请到系统设置里开启");
        }
    }

    /** 读取并清空持久队列，返回捕获到的交易文本列表 */
    @PluginMethod
    public void getPendingCaptures(PluginCall call) {
        Context context = getContext();
        JSONArray arr = readQueue(context);
        JSArray ret = new JSArray();
        for (int i = 0; i < arr.length(); i++) {
            try {
                JSONObject obj = arr.getJSONObject(i);
                JSObject js = new JSObject();
                js.put("source", obj.optString("source"));
                js.put("text", obj.optString("text"));
                js.put("timestamp", obj.optLong("timestamp"));
                ret.put(js);
            } catch (JSONException ignored) {
            }
        }
        clearQueue(context);
        JSObject result = new JSObject();
        result.put("captures", ret);
        call.resolve(result);
    }

    /** 查询通知使用权是否已开启 */
    @PluginMethod
    public void hasNotificationAccess(PluginCall call) {
        boolean enabled = AutoLedgerNotificationService.isEnabled(getContext());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /** 打开系统「通知使用权」设置页 */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开通知使用权设置", e);
        }
    }

    // ---- 持久队列实现 ----

    private static void enqueueCapture(Context context, String source, String text, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE);
            JSONArray arr = readQueue(prefs);
            JSONObject obj = new JSONObject();
            obj.put("source", source);
            obj.put("text", text);
            obj.put("timestamp", timestamp);
            arr.put(obj);
            while (arr.length() > MAX_QUEUE) {
                arr.remove(0);
            }
            prefs.edit().putString(QUEUE_KEY, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static JSONArray readQueue(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE);
        return readQueue(prefs);
    }

    private static JSONArray readQueue(SharedPreferences prefs) {
        try {
            return new JSONArray(prefs.getString(QUEUE_KEY, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void clearQueue(Context context) {
        context.getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE).edit().remove(QUEUE_KEY).apply();
    }
}
