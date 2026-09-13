'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, 'android-galaxy', rel), 'utf8');

function verify(overrides = {}) {
  const get = rel => overrides[rel] ?? read(rel);
  const manifest = get('app/src/main/AndroidManifest.xml');
  const source = get('app/src/main/java/kr/manmool/hyeonjang/MainActivity.java');
  const policy = get('app/src/main/java/kr/manmool/hyeonjang/LaunchPolicy.java');
  const gradle = get('app/build.gradle');
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.deepEqual([...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map(m => m[1]), ['android.permission.INTERNET']);
  assert.doesNotMatch(manifest, /<service|<provider|android.intent.category.BROWSABLE/);
  assert.deepEqual([...manifest.matchAll(/<activity android:name="([^"]+)"/g)].map(m => m[1]), ['.MainActivity']);
  assert.doesNotMatch(get('app/src/main/res/values/styles.xml'), /windowLightNavigationBar/);
  assert.match(get('app/src/main/res/values-v27/styles.xml'), /windowLightNavigationBar/);
  assert.doesNotMatch(source, /new WebView|addJavascriptInterface|getIntent\(|WEBVIEW_FALLBACK_STRATEGY|setEphemeralBrowsingEnabled/);
  assert.match(source, /TwaLauncher.CCT_FALLBACK_STRATEGY/);
  assert.match(source, /Uri.parse\(LaunchPolicy.FIELD_URL\)/);
  assert.match(source, /onDestroy\(\)[\s\S]*?releaseLauncher\(\)/);
  assert.match(source, /onStop\(\)[\s\S]*?releaseLauncher\(\)/);
  assert.match(source, /handler.removeCallbacksAndMessages\(null\)/);
  assert.match(policy, /FIELD_URL = "https:\/\/01023978629.github.io\/hyeonjang\/"/);
  assert.match(gradle, /minSdk 24/); assert.match(gradle, /targetSdk 36/);
  assert.match(gradle, /debuggable false/);
  assert.match(gradle, /androidbrowserhelper:2\.7\.3/);
  const ignore = get('.gitignore');
  for (const rule of ['*.jks','*.keystore','*.apk','dist/','local.properties']) assert.ok(ignore.includes(rule));
}

verify();
if (process.argv.includes('--mutations')) {
  const mf = 'app/src/main/AndroidManifest.xml';
  const java = 'app/src/main/java/kr/manmool/hyeonjang/MainActivity.java';
  const policy = 'app/src/main/java/kr/manmool/hyeonjang/LaunchPolicy.java';
  const mutations = [
    [mf, read(mf).replace('usesCleartextTraffic="false"', 'usesCleartextTraffic="true"')],
    [mf, read(mf).replace('allowBackup="false"', 'allowBackup="true"')],
    [mf, read(mf).replace('</manifest>', '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" /></manifest>')],
    [mf, read(mf).replace('</application>', '<activity android:name=".UnsafeShortcut" /></application>')],
    [java, read(java).replace('TwaLauncher.CCT_FALLBACK_STRATEGY', 'TwaLauncher.WEBVIEW_FALLBACK_STRATEGY')],
    [java, read(java) + '\n// getIntent() untrusted URL regression'],
    [policy, read(policy).replace('https://01023978629.github.io/hyeonjang/"', 'http://untrusted.invalid/"')],
    ['app/build.gradle', read('app/build.gradle').replace('debuggable false', 'debuggable true')]
  ];
  for (const [file, value] of mutations) assert.throws(() => verify({[file]:value}), `Missed mutation: ${file}`);
  console.log('PASS Android safety mutations: ' + mutations.length);
}
console.log('PASS Galaxy Android package source guards');
