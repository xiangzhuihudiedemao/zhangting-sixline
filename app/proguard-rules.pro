# 保留被 JS 调用的桥接方法（当前未开启混淆，留作以后开启 minify 时使用）
-keepclassmembers class com.zhangting.sixline.WebAppBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.zhangting.sixline.WebAppBridge { *; }
