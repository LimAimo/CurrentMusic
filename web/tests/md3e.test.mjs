// MD3E / Web 能力专项回归。真实设备触摸与私有后端联调仍需额外验收。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const src = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('平台能力：普通浏览器绝不误判为 Android App', async () => {
  const { isAndroidApp, canNativeDownload, canDlna, canInstallApk } = await import('../src/platform.js');
  const old = globalThis.window;
  try {
    globalThis.window = {};
    assert.equal(isAndroidApp(), false);
    assert.equal(canNativeDownload(), false);
    assert.equal(canDlna(), false);
    globalThis.window = { NativeApi: { versionCode: () => 117, download: () => {}, dlnaDiscover: () => {}, downloadApk: () => {} } };
    assert.equal(isAndroidApp(), true);
    assert.equal(canNativeDownload(), true);
    assert.equal(canDlna(), true);
    assert.equal(canInstallApk(), true);
  } finally { globalThis.window = old; }
});

test('Web 不显示 APK 宣传、下载目录、原生 DLNA 和 WebView 更新入口', async () => {
  const [main, settings, user, player, cast] = await Promise.all([
    src('src/main.js'), src('src/pages/settings.js'), src('src/pages/user.js'), src('src/player-ui.js'), src('src/cast.js'),
  ]);
  assert.doesNotMatch(main, /dlApkTop/);
  assert.doesNotMatch(user, /cm-auth-apk/);
  assert.match(settings, /\$\{isApp \? `<div class="cm-setting" id="dlDir"/);
  assert.match(settings, /\$\{isApp \? `<div class="cm-setting" id="engine"/);
  assert.match(player, /isAndroidApp\(\) \? '下载到本机' : '浏览器下载'/);
  assert.match(cast, /castSupported = canDlna/);
});

test('所有常规 mdui.dialog 都通过统一滚动容器；蓝色浏览器点击高亮禁用', async () => {
  const [md, ui, css] = await Promise.all([src('src/md.js'), src('src/ui.js'), src('src/ui-overhaul.css')]);
  assert.match(md, /body: `<div class="cm-dialog-scroll">\$\{body\}<\/div>`/);
  assert.match(md, /dialog: adaptiveDialog/);
  assert.match(css, /cm-adaptive-dialog::part\(panel\)/);
  assert.match(css, /100dvh/);
  assert.match(css, /-webkit-tap-highlight-color: transparent !important/);
  assert.match(css + await src('src/expressive.css'), /:focus:not\(:focus-visible\)/); // 自定义键盘焦点，触摸无蓝框
  assert.doesNotMatch(ui, /appendChild\(rip\)/);
  assert.match(ui, /Math\.hypot\(e\.clientX - pressing\.x/);
});

test('Web 检查部署的 JS 指纹，刷新时保留 hash 路由，不使用 APK 下载源', async () => {
  const update = await src('src/update.js');
  assert.match(update, /function deployedWebStamp/);
  assert.match(update, /cache: 'no-store'/);
  assert.match(update, /isAndroidApp\(\)\) return checkWebUpdate\(silent\)/);
  assert.match(update, /url\.searchParams\.set\('cm_refresh'/);
  assert.match(update, /刷新并应用/);
});

test('MD3E 有深色暗压、波浪进度、变形加载及 reduced-motion 退化', async () => {
  const [css, expressive, player, preset] = await Promise.all([
    src('src/expressive.css'), src('src/expressive.js'), src('src/player-ui.js'), src('src/uipreset.js'),
  ]);
  for (const token of ['--cm-e-pressure', '.mdui-theme-dark:not([data-ui-preset])', '@keyframes cm-morph', '.cm-wavy-track', '@media (prefers-reduced-motion: reduce)']) assert.ok(css.includes(token), token);
  assert.match(expressive, /mountWavyTrack\(bar, seek, player\)/);
  assert.match(player, /mountWavyTrack\(ov\.querySelector\('#plSeekbar'\), seek, player\)/);
  assert.match(preset, /name: 'Material 3 Expressive'/);
});

test('MD3E 顶栏初始与页面同色，滚动连续插值，小屏安全高度包含 visualViewport', async () => {
  const [main, css, modal] = await Promise.all([src('src/main.js'), src('src/expressive.css'), src('src/ui-overhaul.css')]);
  assert.match(main, /\(outEl\.scrollTop - 2\) \/ 28/);
  assert.match(main, /window\.visualViewport\.addEventListener\('resize'/);
  assert.match(css, /--cm-header-blur/);
  assert.match(modal, /var\(--cm-vvh, 100dvh\)/);
});
