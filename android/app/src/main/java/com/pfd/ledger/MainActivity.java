package com.pfd.ledger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AutoLedgerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
