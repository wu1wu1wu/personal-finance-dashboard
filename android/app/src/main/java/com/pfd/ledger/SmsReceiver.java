package com.pfd.ledger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/** 短信广播接收器：收到短信后把正文发给插件，由插件转发到 Web 层 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;

        StringBuilder sb = new StringBuilder();
        long eventTime = 0;
        String sender = "";
        for (SmsMessage message : messages) {
            String body = message.getMessageBody();
            if (body != null && !body.isEmpty()) {
                sb.append(body).append('\n');
            }
            if (eventTime == 0 && message.getTimestampMillis() > 0) {
                eventTime = message.getTimestampMillis();
            }
            if (sender.isEmpty() && message.getOriginatingAddress() != null) {
                sender = message.getOriginatingAddress();
            }
        }
        String text = sb.toString().trim();
        String fingerprint = "sms|" + sender + "|" + eventTime + "|" + text.hashCode();
        AutoLedgerPlugin.capture(context, "sms", text, "", fingerprint, eventTime);
    }
}
