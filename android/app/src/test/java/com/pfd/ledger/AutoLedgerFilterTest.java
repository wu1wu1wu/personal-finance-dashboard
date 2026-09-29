package com.pfd.ledger;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AutoLedgerFilterTest {

    @Test
    public void acceptsWechatPayment() {
        assertTrue(AutoLedgerFilter.looksLikeTransaction(
                "微信支付 已支付¥96.00", "com.tencent.mm"));
    }

    @Test
    public void acceptsBankTransactionFromUnknownPackage() {
        assertTrue(AutoLedgerFilter.looksLikeTransaction(
                "您尾号1234卡消费人民币88.50元", "com.example.bank"));
    }

    @Test
    public void acceptsRefund() {
        assertTrue(AutoLedgerFilter.looksLikeTransaction(
                "退款成功 金额¥30.00", "com.eg.android.AlipayGphone"));
    }

    @Test
    public void rejectsPendingPaymentReminder() {
        assertFalse(AutoLedgerFilter.looksLikeTransaction(
                "您有1个账单待支付，共1100元", "com.example.property"));
    }

    @Test
    public void rejectsVerificationCode() {
        assertFalse(AutoLedgerFilter.looksLikeTransaction(
                "验证码123456，请勿泄露", "com.android.mms"));
    }

    @Test
    public void rejectsUnrelatedNotification() {
        assertFalse(AutoLedgerFilter.looksLikeTransaction(
                "正在播放第3首歌曲", "com.tencent.qqmusic"));
    }

    @Test
    public void rejectsChatWithoutCompletedTransaction() {
        assertFalse(AutoLedgerFilter.looksLikeTransaction(
                "你支付了吗，午饭20元", "com.tencent.mm"));
    }
}
