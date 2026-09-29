package com.pfd.ledger;

/**
 * 自动记账原生侧粗筛。
 *
 * NotificationListenerService 会收到系统中的所有通知。无关通知在原生层直接丢弃，
 * 不进入持久队列、实时解析和诊断历史。这里只做保守筛选，最终仍由 Web 层规则解析。
 */
final class AutoLedgerFilter {

    private static final String[] TRUSTED_PACKAGES = {
        "com.tencent.mm",
        "com.eg.android.AlipayGphone",
        "com.icbc",
        "com.chinamworld.main",
        "com.ccb.longjiLife",
        "cmb.pb",
        "com.bankcomm.Bankcomm",
        "com.android.bankabc",
        "com.cmbchina"
    };

    /** 只有明确表示交易已经完成，才允许进入后续解析。 */
    private static final String[] COMPLETED_ACTIONS = {
        "已支付", "支付成功", "付款成功", "消费", "扣款", "已扣款",
        "交易成功", "到账", "已到账", "入账", "收款", "已收款",
        "退款", "已退款", "转入", "转出", "收入", "支出"
    };

    /** 提醒、失败和验证码等消息说明钱没有实际变动。 */
    private static final String[] NEGATIVE_CONTEXTS = {
        "待支付", "未支付", "尚未支付", "未及时支付", "待缴", "待缴费",
        "应缴", "待还款", "账单提醒", "请尽快", "请登录", "逾期",
        "支付失败", "交易失败", "支付未成功", "验证码", "请勿泄露"
    };

    /** 未知来源必须具备明确的金额信号，避免把普通聊天或营销文本当成交易。 */
    private static final String[] AMOUNT_SIGNALS = {
        "¥", "￥", "元", "人民币", "金额", "合计", "共计", "消费",
        "扣款", "收款", "支出", "收入", "到账", "入账", "退款"
    };

    private AutoLedgerFilter() {
    }

    static boolean looksLikeTransaction(String text, String packageName) {
        String value = text == null ? "" : text.trim();
        if (value.isEmpty() || !containsDigit(value)) return false;
        if (containsAny(value, NEGATIVE_CONTEXTS)) return false;
        if (!containsAny(value, COMPLETED_ACTIONS)) return false;

        if (isTrustedPackage(packageName)) return true;
        return containsAny(value, AMOUNT_SIGNALS);
    }

    private static boolean isTrustedPackage(String packageName) {
        String value = packageName == null ? "" : packageName;
        for (String trusted : TRUSTED_PACKAGES) {
            if (value.startsWith(trusted)) return true;
        }
        return false;
    }

    private static boolean containsAny(String value, String[] candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) return true;
        }
        return false;
    }

    private static boolean containsDigit(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isDigit(value.charAt(i))) return true;
        }
        return false;
    }
}
