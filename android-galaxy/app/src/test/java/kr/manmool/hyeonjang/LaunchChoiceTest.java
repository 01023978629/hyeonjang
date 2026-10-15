package kr.manmool.hyeonjang;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.shadows.ShadowDialog;

/** Uses the public screen so the same test can also run against the 1.0.0 source. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class LaunchChoiceTest {
    private SharedPreferences launcherPreferences() {
        return RuntimeEnvironment.getApplication().getSharedPreferences(
                "hyeonjang_launcher", Context.MODE_PRIVATE);
    }

    @Before public void resetLauncherPreferences() {
        assertTrue(launcherPreferences().edit().clear().commit());
    }

    private TextView findText(View view, String text) {
        if (view instanceof TextView && text.contentEquals(((TextView) view).getText())) {
            return (TextView) view;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                TextView found = findText(group.getChildAt(i), text);
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test public void automaticOpeningDefaultsOffAndFirstLaunchKeepsGuidance() {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            View screen = activity.getWindow().getDecorView();
            TextView choice = findText(screen, "다음부터 바로 열기");
            assertNotNull("V417_AUTO_CHOICE_PRESENT", choice);
            assertTrue("Automatic opening must be a selectable checkbox", choice instanceof CheckBox);
            assertFalse(((CheckBox) choice).isChecked());
            assertNotNull(findText(screen, activity.getString(R.string.browser_note)));
            assertNotNull(findText(screen, activity.getString(R.string.storage_body)));
            assertNull("First launch must not start a browser", Shadows.shadowOf(activity).getNextStartedActivity());
            assertNull("First launch must not attempt a missing-browser fallback", ShadowDialog.getLatestDialog());
            assertTrue(launcherPreferences().getBoolean("guidance_seen", false));
            assertFalse(launcherPreferences().getBoolean("open_automatically", false));
        }
    }
}
