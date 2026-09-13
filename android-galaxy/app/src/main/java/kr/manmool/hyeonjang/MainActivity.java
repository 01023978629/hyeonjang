package kr.manmool.hyeonjang;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TwaLauncher launcher;
    private Button openButton;
    private boolean opening;
    private final Runnable launchTimeout = () -> {
        if (opening && !isFinishing() && !isDestroyed()) {
            releaseLauncher();
            resetButton();
            showLaunchError();
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(dp(24), dp(28), dp(24), dp(28));
        scroll.addView(column);
        setContentView(scroll);
        ViewCompat.setOnApplyWindowInsetsListener(scroll, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(scroll);
        addText(column, R.string.app_name, 14, true, Color.rgb(22, 112, 90));
        addText(column, R.string.heading, 30, true, Color.rgb(22, 43, 35));
        addText(column, R.string.subtitle, 17, false, Color.rgb(76, 94, 85));
        openButton = addButton(column, R.string.open_field, this::openField);
        openButton.setTextColor(Color.WHITE);
        openButton.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(22,112,90)));
        addText(column, chromeAvailable() ? R.string.browser_chrome : R.string.browser_default, 14, true, Color.DKGRAY);
        addText(column, R.string.browser_note, 14, false, Color.DKGRAY);
        addButton(column, R.string.open_default, () -> openExternal(LaunchPolicy.FIELD_URL));
        card(column, R.string.storage_title, R.string.storage_body);
        card(column, R.string.upload_title, R.string.upload_body);
        card(column, R.string.install_title, R.string.install_body);
        addButton(column, R.string.privacy, () -> openExternal(LaunchPolicy.PRIVACY_URL));
        addText(column, R.string.version, 13, false, Color.DKGRAY);
        // Never auto-launch: users must first see storage and browser-selection guidance.
    }

    protected boolean chromeAvailable() {
        try {
            ApplicationInfo app = getPackageManager().getApplicationInfo(LaunchPolicy.CHROME_PACKAGE, 0);
            return app.enabled && (app.flags & ApplicationInfo.FLAG_SUSPENDED) == 0;
        } catch (PackageManager.NameNotFoundException e) { return false; }
    }

    private void openField() {
        if (opening) return;
        opening = true;
        openButton.setEnabled(false);
        openButton.setText(R.string.launching);
        handler.postDelayed(launchTimeout, 12000);
        try {
            releaseLauncher();
            launcher = new TwaLauncher(this, chromeAvailable() ? LaunchPolicy.CHROME_PACKAGE : null);
            TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder(Uri.parse(LaunchPolicy.FIELD_URL));
            launcher.launch(builder, new CustomTabsCallback(), null,
                this::resetButton, this::launchFallback);
        } catch (RuntimeException e) {
            releaseLauncher();
            resetButton();
            showLaunchError();
        }
    }

    private void launchFallback(Context context, TrustedWebActivityIntentBuilder builder,
            String providerPackage, Runnable completed) {
        if (!opening || isFinishing() || isDestroyed()) return;
        // A missing browser must show ONE Korean dialog, with no pending timeout behind it.
        resetButton();
        try {
            String provider = providerPackage != null ? providerPackage : CustomTabsClient.getPackageName(context, null);
            if (provider == null) { showLaunchError(); return; }
            TwaLauncher.CCT_FALLBACK_STRATEGY.launch(context, builder, provider, completed);
        } catch (RuntimeException e) { showLaunchError(); }
    }

    protected void openExternal(String fixedUrl) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fixedUrl)).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException | SecurityException e) { showLaunchError(); }
    }

    private void showLaunchError() {
        new AlertDialog.Builder(this).setTitle(R.string.browser_missing)
            .setMessage(R.string.browser_missing_body)
            .setPositiveButton(R.string.chrome_store, (dialog, which) -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(LaunchPolicy.CHROME_STORE_URL)));
                } catch (ActivityNotFoundException | SecurityException e) {
                    Toast.makeText(this, R.string.launch_error, Toast.LENGTH_LONG).show();
                }
            }).setNegativeButton(R.string.close, null).show();
    }

    private void resetButton() {
        handler.removeCallbacks(launchTimeout);
        opening = false;
        if (openButton != null) { openButton.setEnabled(true); openButton.setText(R.string.open_field); }
    }

    private void releaseLauncher() {
        if (launcher != null) { launcher.destroy(); launcher = null; }
    }

    @Override protected void onStop() {
        super.onStop();
        // Do not leave a late service connection opening a browser after the user leaves this app.
        handler.removeCallbacks(launchTimeout);
        releaseLauncher();
        resetButton();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        releaseLauncher();
        super.onDestroy();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private TextView addText(LinearLayout parent, int text, int size, boolean bold, int color) {
        TextView view = new TextView(this);
        view.setText(text); view.setTextSize(size); view.setTextColor(color);
        view.setLineSpacing(dp(4), 1);
        if (bold) view.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(14);
        parent.addView(view, params);
        return view;
    }

    private Button addButton(LinearLayout parent, int text, Runnable action) {
        Button button = new Button(this);
        button.setText(text); button.setTextSize(16); button.setAllCaps(false); button.setMinHeight(dp(56));
        button.setOnClickListener(view -> action.run());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(12);
        parent.addView(button, params);
        return button;
    }

    private void card(LinearLayout parent, int title, int body) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(18), dp(18), dp(18), dp(8));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE); background.setCornerRadius(dp(16));
        card.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(12); params.bottomMargin = dp(4);
        parent.addView(card, params);
        addText(card, title, 18, true, Color.rgb(22,43,35));
        addText(card, body, 15, false, Color.rgb(76,94,85));
    }
}
