package kr.manmool.hyeonjang;

import static org.junit.Assert.*;
import android.content.Intent;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Looper;
import android.text.Layout;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
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

    // Native Android text measurement, including the bundled Korean fonts. These are JVM
    // layout simulations, not emulator screenshots or Samsung browser/device validation.
    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w320dp-h568dp-port-mdpi")
    public void compactPortraitKeepsAllTextAndActionsReachable() {
        verifyMeasuredScreen(320, 568, 1f, 0, 24, 0, 24);
    }

    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w360dp-h800dp-port-xhdpi")
    public void galaxyPortraitRespectsSystemBarsAtLargerFontSize() {
        verifyMeasuredScreen(360, 800, 1.3f, 0, 24, 0, 48);
    }

    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w320dp-h568dp-port-mdpi")
    public void compactPortraitAtDoubleFontSizeDoesNotClipLabels() {
        verifyMeasuredScreen(320, 568, 2f, 0, 24, 0, 24);
    }

    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w640dp-h320dp-land-mdpi")
    public void shortLandscapeKeepsFooterReachableAroundCutout() {
        verifyMeasuredScreen(640, 320, 1f, 40, 0, 16, 24);
    }

    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w640dp-h320dp-land-mdpi")
    public void shortLandscapeAtDoubleFontSizeKeepsActionsReachable() {
        verifyMeasuredScreen(640, 320, 2f, 40, 0, 16, 24);
    }

    private void verifyMeasuredScreen(int widthDp, int heightDp, float fontScale,
            int leftInsetDp, int topInsetDp, int rightInsetDp, int bottomInsetDp) {
        float originalFontScale = RuntimeEnvironment.getFontScale();
        RuntimeEnvironment.setFontScale(fontScale);
        try (ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a = c.get();
            float density = a.getResources().getDisplayMetrics().density;
            ScrollView scroll = (ScrollView) ((ViewGroup) a.findViewById(android.R.id.content)).getChildAt(0);
            Insets safe = Insets.of(Math.round(leftInsetDp * density), Math.round(topInsetDp * density),
                    Math.round(rightInsetDp * density), Math.round(bottomInsetDp * density));
            ViewCompat.dispatchApplyWindowInsets(scroll, new WindowInsetsCompat.Builder()
                    .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), safe)
                    .build());
            assertEquals("Left safe area", safe.left, scroll.getPaddingLeft());
            assertEquals("Top safe area", safe.top, scroll.getPaddingTop());
            assertEquals("Right safe area", safe.right, scroll.getPaddingRight());
            assertEquals("Bottom safe area", safe.bottom, scroll.getPaddingBottom());
            measureViewport(scroll, Math.round(widthDp * density), Math.round(heightDp * density));
            verifyMeasuredChildren(scroll, density);

            TextView body = findText(scroll, a.getString(R.string.storage_body));
            assertNotNull(body);
            assertEquals(fontScale, a.getResources().getConfiguration().fontScale, 0.001f);
            if (fontScale > 1f) {
                // Android 15 keeps 30sp headings unchanged at 130% through nonlinear scaling.
                // The smaller body must grow, so checking its measured size proves scaling is active.
                assertTrue("The test must actually increase the rendered body font size", body.getTextSize() > 15 * density);
            }
            int[] actions = { R.string.open_field, R.string.open_default, R.string.privacy };
            for (int action : actions) {
                TextView button = findText(scroll, a.getString(action));
                assertNotNull(button);
                assertTrue("Action must be enabled: " + button.getText(), button.isEnabled());
                assertReachableByScroll(scroll, button);
            }
            assertReachableByScroll(scroll, findText(scroll, a.getString(R.string.version)));
            assertNull("Measuring or scrolling must never launch a browser", Shadows.shadowOf(a).getNextStartedActivity());
        } finally {
            RuntimeEnvironment.setFontScale(originalFontScale);
        }
    }

    private void measureViewport(ScrollView scroll, int width, int height) {
        scroll.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        scroll.layout(0, 0, width, height);
        assertEquals(width, scroll.getMeasuredWidth());
        assertEquals(height, scroll.getMeasuredHeight());
        assertTrue("Long guidance must remain vertically scrollable", scroll.getChildAt(0).getHeight()
                > height - scroll.getPaddingTop() - scroll.getPaddingBottom());
    }

    private void verifyMeasuredChildren(ViewGroup parent, float density) {
        int previousBottom = parent.getPaddingTop();
        for (int i = 0; i < parent.getChildCount(); i++) {
            View child = parent.getChildAt(i);
            assertTrue("A child must have measured width", child.getWidth() > 0);
            assertTrue("A child must have measured height", child.getHeight() > 0);
            assertTrue("A child crosses the left safe area", child.getLeft() >= parent.getPaddingLeft());
            assertTrue("A child crosses the right safe area", child.getRight() <= parent.getWidth() - parent.getPaddingRight());
            if (parent instanceof LinearLayout) {
                assertTrue("Content overlaps the preceding row", child.getTop() >= previousBottom);
                assertTrue("Content is clipped by its card", child.getBottom() <= parent.getHeight() - parent.getPaddingBottom());
                previousBottom = child.getBottom();
            }
            if (child instanceof TextView) {
                TextView text = (TextView) child;
                Layout layout = text.getLayout();
                String label = text.getText().toString();
                assertNotNull("Text layout missing: " + label, layout);
                assertTrue("Text is clipped vertically: " + label,
                        layout.getHeight() <= text.getHeight() - text.getCompoundPaddingTop() - text.getCompoundPaddingBottom());
                assertEquals("Last text characters are missing: " + label,
                        label.length(), layout.getLineEnd(layout.getLineCount() - 1));
                for (int line = 0; line < layout.getLineCount(); line++) {
                    assertEquals("Text is ellipsized: " + label, 0, layout.getEllipsisCount(line));
                    assertTrue("Text overflows horizontally: " + label,
                            layout.getLineRight(line) - layout.getLineLeft(line) <= layout.getWidth() + 1);
                }
                if (text instanceof Button) {
                    assertTrue("Touch target is too short: " + label, text.getHeight() >= 48 * density);
                    assertTrue("Touch target is too narrow: " + label, text.getWidth() >= 48 * density);
                }
            }
            if (child instanceof ViewGroup) verifyMeasuredChildren((ViewGroup) child, density);
        }
    }

    private void assertReachableByScroll(ScrollView scroll, View target) {
        assertNotNull(target);
        Rect bounds = new Rect(0, 0, target.getWidth(), target.getHeight());
        scroll.offsetDescendantRectToMyCoords(target, bounds);
        scroll.scrollTo(0, bounds.top - scroll.getPaddingTop());
        assertTrue("Target top is hidden after scrolling", bounds.top - scroll.getScrollY() >= scroll.getPaddingTop());
        assertTrue("Target bottom is hidden after scrolling",
                bounds.bottom - scroll.getScrollY() <= scroll.getHeight() - scroll.getPaddingBottom());
        assertEquals("There must be no horizontal scrolling", 0, scroll.getScrollX());
    }
}
