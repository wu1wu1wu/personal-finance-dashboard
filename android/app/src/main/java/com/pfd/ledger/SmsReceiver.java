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
        for (SmsMessage message : messages) {
            String body = message.getMessageBody();
            if (body != null && !body.isEmpty()) {
                sb.append(body).append('\n');
            }
        }
        AutoLedgerPlugin.capture(context, "sms", sb.toString());
    }
}
