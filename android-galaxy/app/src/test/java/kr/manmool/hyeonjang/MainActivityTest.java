package kr.manmool.hyeonjang;

import static org.junit.Assert.*;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.shadows.ShadowDialog;
import java.time.Duration;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class MainActivityTest {
    private TextView findText(View view, String text) {
        if (view instanceof TextView && text.contentEquals(((TextView) view).getText())) return (TextView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                TextView found = findText(group.getChildAt(i), text);
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test public void doesNotLaunchUntilUserChoosesAndShowsStorageBoundary() {
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a = c.get();
            assertNull(Shadows.shadowOf(a).getNextStartedActivity());
            assertNotNull(findText(a.getWindow().getDecorView(), a.getString(R.string.storage_body)));
            assertNotNull(findText(a.getWindow().getDecorView(), a.getString(R.string.upload_body)));
            Button open = (Button) findText(a.getWindow().getDecorView(), a.getString(R.string.open_field));
            assertTrue(open.isEnabled());
            assertTrue(open.getMinHeight() >= 56 * a.getResources().getDisplayMetrics().density);
        }
    }

    @Test public void maliciousIncomingUrlCannotChangeDefaultBrowserTarget() {
        Intent malicious = new Intent(Intent.ACTION_VIEW, Uri.parse("https://untrusted.invalid/collect"));
        malicious.putExtra("url", "javascript:alert(1)");
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class, malicious).setup()) {
            MainActivity a = c.get();
            findText(a.getWindow().getDecorView(), a.getString(R.string.open_default)).performClick();
            Intent launched = Shadows.shadowOf(a).getNextStartedActivity();
            assertEquals(LaunchPolicy.FIELD_URL, launched.getDataString());
            assertEquals(Intent.ACTION_VIEW, launched.getAction());
            assertTrue(launched.hasCategory(Intent.CATEGORY_BROWSABLE));
            assertFalse(launched.hasExtra("url"));
        }
    }

    @Test public void privacyHasOnlyFixedHttpsTarget() {
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a = c.get();
            findText(a.getWindow().getDecorView(), a.getString(R.string.privacy)).performClick();
            assertEquals(LaunchPolicy.PRIVACY_URL, Shadows.shadowOf(a).getNextStartedActivity().getDataString());
        }
    }

    @Test public void rotationDoesNotOpenBrowserOrCopyData() {
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup()) {
            c.recreate();
            assertNull(Shadows.shadowOf(c.get()).getNextStartedActivity());
            assertEquals(0, c.get().databaseList().length);
        }
    }

    @Test public void missingBrowserShowsOneDialogAndLeavesRetryAvailable() {
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a = c.get();
            Button button = (Button) findText(a.getWindow().getDecorView(), a.getString(R.string.open_field));
            button.performClick();
            android.app.Dialog dialog = ShadowDialog.getLatestDialog();
            assertNotNull(dialog);
            assertTrue(button.isEnabled());
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(13));
            assertSame(dialog, ShadowDialog.getLatestDialog());
            assertNull(Shadows.shadowOf(a).getNextStartedActivity());
        }
    }
}
