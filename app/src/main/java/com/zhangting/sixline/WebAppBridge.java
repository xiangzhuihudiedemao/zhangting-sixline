package com.zhangting.sixline;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

/**
 * 网页里的 navigator.clipboard 在 file:// 页面属于“非安全上下文”，
 * 复制会失败，所以这里给页面加一个原生剪贴板通道。
 */
public class WebAppBridge {

    private final Activity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    WebAppBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean copy(final String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    ClipboardManager manager =
                            (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (manager != null) {
                        manager.setPrimaryClip(ClipData.newPlainText("涨停六线计算器", text));
                    }
                } catch (Exception ignored) {
                    // 个别 ROM 会限制剪贴板写入，静默失败即可
                }
            }
        });
        return true;
    }
}
