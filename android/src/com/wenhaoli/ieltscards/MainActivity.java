package com.wenhaoli.ieltscards;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Offline assets are served under a fixed, app-owned HTTPS origin. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int IMPORT = 71, EXPORT = 72;
    private WebView web;
    private ValueCallback<Uri[]> pendingImport;
    private byte[] pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(248,248,245));
        getWindow().setNavigationBarColor(Color.rgb(248,248,245));
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(248,248,245));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
        setContentView(frame);
        WebSettings config = web.getSettings();
        config.setJavaScriptEnabled(true);
        config.setDomStorageEnabled(true);
        config.setAllowFileAccess(false);
        config.setAllowContentAccess(true);
        config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        config.setSupportMultipleWindows(false);
        config.setTextZoom(100);
        web.addJavascriptInterface(new BackupBridge(), "AndroidBackup");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return missing();
                String name = uri.getPath();
                if (name == null || name.equals("/")) name = "/index.html";
                if (name.contains("..") || name.contains("\\")) return missing();
                try {
                    InputStream file = getAssets().open("site" + name);
                    return new WebResourceResponse(mime(name), "UTF-8", file);
                } catch (Exception error) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost()) && "https".equals(uri.getScheme())) return false;
                if ("https".equals(uri.getScheme()) && "github.com".equals(uri.getHost())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException error) { message("没有可打开资料链接的浏览器。"); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingImport != null) pendingImport.onReceiveValue(null);
                pendingImport = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("*/*"); intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json","text/plain","application/octet-stream"});
                try { startActivityForResult(intent, IMPORT); }
                catch (ActivityNotFoundException error) { pendingImport.onReceiveValue(null); pendingImport=null; message("系统文件选择器不可用。"); }
                return true;
            }
        });
        web.loadUrl(HOME);
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/json";
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,new ByteArrayInputStream(new byte[0]));
    }
    private void message(String text) { runOnUiThread(() -> Toast.makeText(this,text,Toast.LENGTH_LONG).show()); }
    public final class BackupBridge {
        @JavascriptInterface public void saveBackup(String json, String filename) {
            if (json == null || json.length() > 5*1024*1024) { message("备份过大，无法导出。"); return; }
            try {
                JSONObject object = new JSONObject(json);
                if (!"ielts-zhenjing".equals(object.optString("app")) || object.optInt("version") != 1) return;
            } catch (Exception error) { return; }
            runOnUiThread(() -> {
                if (web.getUrl() == null || !web.getUrl().startsWith("https://" + HOST + "/")) return;
                pendingExport = json.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.setType("application/json"); intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE, "雅思词汇学习进度.json");
                try { startActivityForResult(intent, EXPORT); }
                catch (ActivityNotFoundException error) { pendingExport=null; message("系统文件保存器不可用。"); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request == IMPORT && pendingImport != null) {
            pendingImport.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            pendingImport=null;
        }
        if (request == EXPORT) {
            if (result == RESULT_OK && data != null && pendingExport != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new java.io.IOException("Cannot open destination");
                    output.write(pendingExport); message("学习进度已导出。");
                } catch (Exception error) { message("导出失败，请重试。"); }
            }
            pendingExport=null;
        }
    }
    @Override protected void onDestroy() {
        if (pendingImport != null) pendingImport.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("AndroidBackup"); web.destroy(); }
        super.onDestroy();
    }
}
