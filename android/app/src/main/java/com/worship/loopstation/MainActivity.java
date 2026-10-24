package com.worship.loopstation;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Hosts the web UI (assets/www) in a WebView served from the secure origin https://appassets.local
 * (needed for getUserMedia, AudioWorklet and ES modules), and exposes a small native file bridge
 * ("AndroidFS") that stores everything in the app's private folder: <files dir>/LoopStation/.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.local";
    private static final int REQ_APP = 1;
    private static final int REQ_WEB = 2;
    private static final int REQ_FILE = 3;

    private WebView web;
    private PermissionRequest pendingWebPermission;
    private ValueCallback<Uri[]> fileCallback;
    private WebChromeClient.FileChooserParams fileParams;
    private File root;
    private long lastBack = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new File(getFilesDir(), "LoopStation");
        //noinspection ResultOfMethodCallIgnored
        root.mkdirs();

        web = new WebView(this);
        setContentView(web);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // http://<computer-ip>:8000 separation server

        web.addJavascriptInterface(new Bridge(), "AndroidFS");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!HOST.equals(request.getOrigin().getHost())) { request.deny(); return; }
                    boolean wantsMic = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                    if (!wantsMic) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_WEB);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                fileParams = params;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl("https://" + HOST + "/index.html");
        }
    }

    // ---- static assets served as https://appassets.local/* -------------------------------------
    private WebResourceResponse serveAsset(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null; // let other hosts (the LAN server) go through the network
        String p = uri.getPath();
        if (p == null || p.equals("/")) p = "/index.html";
        if (p.contains("..")) return notFound();
        try {
            InputStream in = getAssets().open("www" + p);
            String mime = mimeOf(p);
            boolean text = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript");
            return new WebResourceResponse(mime, text ? "UTF-8" : null, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static String mimeOf(String p) {
        String l = p.toLowerCase(Locale.ROOT);
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js") || l.endsWith(".mjs")) return "text/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".wav")) return "audio/wav";
        if (l.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }

    // ---- activity callbacks ----------------------------------------------------------------------------
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == REQ_WEB && pendingWebPermission != null) {
            boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
            if (ok) pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
        super.onRequestPermissionsResult(requestCode, permissions, results);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Back button: press twice to leave, so an accidental tap cannot stop the music during a service.
    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) {
            super.onBackPressed();
        } else {
            lastBack = now;
            Toast.makeText(this, "Back again to quit / Retour encore pour quitter", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    // ---- file bridge (called from JS as window.AndroidFS.*) ---------------------------------------------------
    private File resolve(String rel) throws IOException {
        File f = new File(root, rel).getCanonicalFile();
        String base = root.getCanonicalPath();
        if (!f.getPath().equals(base) && !f.getPath().startsWith(base + File.separator)) {
            throw new IOException("path outside storage");
        }
        return f;
    }

    private static boolean deleteRec(File f) {
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRec(k);
        }
        return f.delete();
    }

    private static String guessMime(String name) {
        String l = name.toLowerCase(Locale.ROOT);
        if (l.endsWith(".wav")) return "audio/wav";
        if (l.endsWith(".mp3")) return "audio/mpeg";
        if (l.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private class Bridge {
        @JavascriptInterface
        public boolean mkdirs(String rel) {
            try { File f = resolve(rel); return f.isDirectory() || f.mkdirs(); } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean writeChunk(String rel, String b64, boolean append) {
            try {
                File f = resolve(rel);
                File parent = f.getParentFile();
                if (parent != null && !parent.isDirectory() && !parent.mkdirs()) return false;
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                try (FileOutputStream out = new FileOutputStream(f, append)) { out.write(bytes); }
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public double size(String rel) {
            try { File f = resolve(rel); return f.isFile() ? f.length() : -1; } catch (Exception e) { return -1; }
        }

        /** Returns base64 of up to len bytes starting at offset, or null on error. */
        @JavascriptInterface
        public String readChunk(String rel, double offset, int len) {
            try (RandomAccessFile raf = new RandomAccessFile(resolve(rel), "r")) {
                raf.seek((long) offset);
                byte[] buf = new byte[len];
                int n = raf.read(buf);
                if (n < 0) n = 0;
                return Base64.encodeToString(buf, 0, n, Base64.NO_WRAP);
            } catch (Exception e) { return null; }
        }

        @JavascriptInterface
        public String list(String rel) {
            JSONArray arr = new JSONArray();
            try {
                File[] kids = resolve(rel).listFiles();
                if (kids != null) {
                    Arrays.sort(kids, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));
                    for (File k : kids) {
                        JSONObject o = new JSONObject();
                        o.put("name", k.getName());
                        o.put("type", k.isDirectory() ? "directory" : "file");
                        arr.put(o);
                    }
                }
            } catch (Exception e) { /* empty list */ }
            return arr.toString();
        }

        @JavascriptInterface
        public boolean remove(String rel) {
            try {
                File f = resolve(rel);
                return f.exists() && !f.equals(root) && deleteRec(f);
            } catch (Exception e) { return false; }
        }

        /** Asks for the microphone, plus storage on Android 9 and older (the only versions where it is needed). */
        @JavascriptInterface
        public void requestPermissions() {
            runOnUiThread(() -> {
                List<String> need = new ArrayList<>();
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    need.add(Manifest.permission.RECORD_AUDIO);
                }
                if (Build.VERSION.SDK_INT <= 28) {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        need.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                    }
                    if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        need.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                    }
                }
                // qualified: Bridge declares its own requestPermissions() which would otherwise shadow the Activity's
                if (!need.isEmpty()) MainActivity.this.requestPermissions(need.toArray(new String[0]), REQ_APP);
            });
        }

        /** Copies a file (or every file of a folder) to Downloads/LoopStation. Returns "ok:<n>" or "error:<reason>". */
        @JavascriptInterface
        public String exportPublic(String rel) {
            try {
                File f = resolve(rel);
                if (!f.exists()) return "error:not found";
                int count = 0;
                if (f.isDirectory()) {
                    File[] kids = f.listFiles();
                    if (kids != null) {
                        for (File k : kids) {
                            if (k.isFile()) { copyToDownloads(k, f.getName() + "_" + k.getName()); count++; }
                        }
                    }
                } else {
                    copyToDownloads(f, f.getName());
                    count = 1;
                }
                return "ok:" + count;
            } catch (Exception e) {
                return "error:" + e.getMessage();
            }
        }
    }

    private void copyToDownloads(File src, String displayName) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
            v.put(MediaStore.MediaColumns.MIME_TYPE, guessMime(displayName));
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/LoopStation");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("cannot create file in Downloads");
            try (OutputStream out = getContentResolver().openOutputStream(uri); InputStream in = new FileInputStream(src)) {
                if (out == null) throw new IOException("cannot open output");
                pipe(in, out);
            }
        } else {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                throw new IOException("storage permission denied");
            }
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "LoopStation");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create Downloads/LoopStation");
            try (OutputStream out = new FileOutputStream(new File(dir, displayName)); InputStream in = new FileInputStream(src)) {
                pipe(in, out);
            }
        }
    }

    private static void pipe(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
    }
}
