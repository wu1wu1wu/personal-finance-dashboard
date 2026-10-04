package com.pfd.ledger;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AutoLedgerPlugin.class);
        super.onCreate(savedInstanceState);

        // Capacitor 8 不再接管返回键（BridgeActivity 里没有 onBackPressed），
        // 系统默认行为是直接 finish()——用户在设置子页、详情弹窗里按返回
        // 就会退出整个 App。这里按三层顺序处理：
        //   1. 先问 Web 层要不要这次返回（弹窗 / 底部抽屉，见 core/back-stack.ts）
        //   2. WebView 里有历史就回退（SPA 的 pushState 同样计入历史）
        //   3. 都没有才真的退出 App
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = getBridge() == null ? null : getBridge().getWebView();
                    if (webView == null) {
                        exitApp();
                        return;
                    }
                    // 页面还没加载完时 __pfdHandleBack 不存在，返回 "0"，照常走历史/退出
                    webView.evaluateJavascript(
                        "(window.__pfdHandleBack && window.__pfdHandleBack()) ? '1' : '0'",
                        value -> {
                            if (value != null && value.contains("1")) return;
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                exitApp();
                            }
                        });
                }

                /** 交回系统默认处理：Activity 收尾，App 退出 */
                private void exitApp() {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            });
    }
}
