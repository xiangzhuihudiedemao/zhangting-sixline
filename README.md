# 涨停六线计算器 · Android 版

把原来的单文件网页 `涨停六线计算器.html` 装进一个原生 WebView 壳，做成可以安装的 Android App。

- **完全离线**：页面、样式、脚本全部在 APK 内，**不申请任何权限**（连网络权限都没有）
- **打开即用**：桌面图标、启动配色、返回键、系统剪贴板都按 App 方式处理
- **干净**：无第三方 SDK、无广告、无统计，APK 约 76 KB
- 支持 Android 5.0（API 21）及以上；Android 8.0+ / 已更新 WebView 的设备显示效果最佳

## 0. 已打包好的 APK

| 文件 | 说明 |
| --- | --- |
| `dist/涨停六线计算器-v1.0.apk` | 正式签名版，直接装 |
| `dist/zhangting-sixline-v1.0.apk` | 同一文件，英文名备份 |

- 在线下载（手机点开即可）：<https://github.com/xiangzhuihudiedemao/zhangting-sixline/releases/latest>
- 仓库只放源码，APK 通过 Releases 分发

- 包名 `com.zhangting.sixline`，版本 `1.0 (1)`
- SHA-256：`698556CB0BDA8D131087FAB4B5C69A5B94C7D8115C9AB90E8EC7B5FD312FB332`
- 签名：`keystore/zhangting.jks`（alias `zhangting`，密码见 `keystore/README.txt`）
- 已用 `apksigner` 校验：v1 + v2 签名均通过

**装到手机：**

1. 用微信「文件传输助手」、QQ 或数据线把 APK 传到手机
2. 在手机上点开 APK（微信里提示不能打开时，选「用其他应用打开」→ 文件管理器）
3. 提示「禁止安装未知应用」时，允许当前应用安装；提示「未经安全检测」时选「仍然安装」
4. 装好后桌面出现红色六柱图标，点开即用

> 以后自己重新打包时，必须继续用 `keystore/zhangting.jks` 签名，否则无法覆盖升级，只能先卸载旧版。**请备份这个文件**。

## 1. 三种路线怎么选

| 方案 | 需要什么 | 适合 |
| --- | --- | --- |
| 装现成 APK | 一部安卓手机 | 只想用，不想折腾 |
| 浏览器打开 HTML | 手机 + 文件管理器 | 临时用、改完立刻看效果 |
| 自己编译 APK | 电脑（Android Studio 或 JDK+SDK），或 GitHub 账号 | 想改代码、改涨幅、换图标 |

## 2. 不打包，直接当网页用

把 `app/src/main/assets/index.html` 传到手机，用支持本地文件的浏览器（Via、Edge、夸克等）打开即可计算。缺点是没有独立图标、每次要翻文件；部分浏览器（如 Chrome）对 `file://` 页面的「添加到主屏幕」支持不完整。

## 3. 自己编译

### 方式 A：Android Studio（推荐）

1. 安装 [Android Studio](https://developer.android.com/studio)（自带 JDK 17 和 SDK）
2. `File → Open`，选择本目录 `zhangting-sixline`
3. 等待 Gradle Sync 完成（首次会下载 AGP 和依赖，几分钟）
4. 菜单 `Build → Build Bundle(s) / APK(s) → Build APK(s)`
5. 产物：`app/build/outputs/apk/debug/app-debug.apk`

要生成正式签名版，`keystore.properties` 已配好，直接
`Build → Generate Signed Bundle / APK → APK` 或命令行 `./gradlew :app:assembleRelease`。

### 方式 B：命令行

需要 JDK 17、Android SDK（platform 34 + build-tools 34.0.0）：

```bash
export JAVA_HOME=/path/to/jdk17
export ANDROID_HOME=/path/to/android-sdk
cd zhangting-sixline
./gradlew :app:assembleDebug     # Windows: gradlew.bat :app:assembleDebug
```

产物：`app/build/outputs/apk/debug/app-debug.apk`

> `gradle/wrapper/gradle-wrapper.properties` 里的 Gradle 下载地址默认指向腾讯镜像（国内快）；在海外可改回 `https://services.gradle.org/distributions/gradle-8.7-bin.zip`。

### 方式 C：GitHub Actions 云编译（电脑上什么都不用装）

1. 在 GitHub 新建仓库
2. 把 `zhangting-sixline` 里的文件推上去（含 `.github/workflows/build-apk.yml`）
3. 打开仓库 `Actions` 标签，运行 `build-apk`
4. 构建完成后在该次运行的 `Artifacts` 里下载 `zhangting-sixline-apk`，解压得到 `app-debug.apk`

> debug 版用 Android 默认调试证书签名，能正常安装使用，只是不能上架商店。想用正式密钥，把 `keystore/zhangting.jks` 转成 base64 存进仓库 Secrets 再改工作流即可，或者干脆在本地打 release 包。

## 4. 签名与升级

项目根目录的 `keystore.properties` 指向 `keystore/zhangting.jks`。两个文件都已被 `.gitignore` 忽略，不会误传到网上。

想换一把新密钥：

```bash
keytool -genkeypair -v \
  -keystore zhangting.jks -alias zhangting \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass 你的密码 -keypass 你的密码 \
  -dname "CN=YourName, OU=App, O=Personal, L=Beijing, ST=Beijing, C=CN"
```

`keystore.properties` 格式：

```properties
storeFile=keystore/zhangting.jks
storePassword=你的密码
keyAlias=zhangting
keyPassword=你的密码
```

然后 `./gradlew :app:assembleRelease`，产物在 `app/build/outputs/apk/release/app-release.apk`。

**务必备份 `.jks` 和密码**，丢了就只能卸载重装、无法覆盖升级。

## 5. 定制

| 想改什么 | 改哪里 |
| --- | --- |
| 六档涨幅 / 名称 / 颜色 | `app/src/main/assets/index.html` 里的 `LINES` 数组 |
| App 名称 | `app/src/main/res/values/strings.xml` 的 `app_name` |
| 图标 | `app/src/main/res/mipmap-*/ic_launcher*.png`，或运行 `python tools/make_icons.py` 重新生成 |
| 包名 | `app/build.gradle.kts` 的 `namespace`、`applicationId`（改了要同步改 Java 包名和目录） |
| 版本号 | `app/build.gradle.kts` 的 `versionCode` / `versionName` |

改完 HTML 后重新执行一次 `assembleDebug` / `assembleRelease` 即可。

要点：网页在 `file://` 下不属于安全上下文，`navigator.clipboard` 不可用。壳里通过 `AndroidBridge.copy()` 走原生剪贴板，自己改 HTML 时请保留 `copyText()` 开头那段桥接逻辑。

## 6. 常见问题

**装不上 / 提示「应用未安装」**
- 手机里已有同包名、不同签名的旧版：先卸载旧版
- Android 版本低于 5.0：不支持
- 传输过程损坏：重新传一次（可对比文件大小 76,206 字节）

**提示「未经安全检测」**
国产 ROM 常见拦截，选「继续安装 / 仍然安装」即可；应用没有联网权限，不会上传任何数据。

**复制按钮没反应**
确认装的是本项目打的包（不是浏览器里的原网页）。原网页在 `file://` 下剪贴板受限，这是加壳的主要原因之一。

**返回键直接退出**
页面只有一屏，属于预期行为；`MainActivity.onBackPressed()` 已处理 `canGoBack()`。

**能不能上架应用商店**
个人自用不需要。国内商店通常要求企业资质、软件著作权、备案等，成本远高于自用。

## 7. 目录结构

```
zhangting-sixline/
├─ app/
│  ├─ build.gradle.kts               # compileSdk 34 / minSdk 21 / 签名配置
│  └─ src/main/
│     ├─ AndroidManifest.xml         # 无 INTERNET 权限，竖屏
│     ├─ assets/index.html           # 原网页 + 原生剪贴板桥
│     ├─ java/com/zhangting/sixline/
│     │  ├─ MainActivity.java        # WebView 壳
│     │  └─ WebAppBridge.java        # 写入系统剪贴板
│     └─ res/                        # 图标、主题、名称
├─ dist/                             # 打好的 APK
├─ keystore/                         # 签名密钥（勿外传，已 gitignore）
├─ tools/make_icons.py               # 图标生成脚本
├─ .github/workflows/build-apk.yml   # 云编译
├─ .toolchain/                       # 本机编译用的 JDK/SDK/Gradle（约 1.3 GB，可删）
└─ gradlew / gradlew.bat / gradle/   # Gradle 8.7 wrapper
```

`.toolchain/` 只是这台机器上编译用的，已加入 `.gitignore`，删掉不影响项目；重装后可用 Android Studio 或官方 SDK 重新编译。
