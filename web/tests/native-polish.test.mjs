import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWavyPath } from '../src/expressive.js';
const src = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('进度波浪在暂停时回归直线，播放时随像素宽度生成路径', () => {
  assert.equal(buildWavyPath(300, 0, 5), '');
  assert.equal(buildWavyPath(300, .5, 0).endsWith('L 150.0 12'), true);
  assert.ok(buildWavyPath(300, .5, 5).includes('L 15.0'));
  assert.ok(buildWavyPath(300, 2, 5).endsWith('L 300.0 12'));
});

test('移动弹窗使用纯透明度动画、28px 圆角和正文滚动', async () => {
  const [css, md, compact] = await Promise.all([src('expressive.css'), src('md.js'), src('ui-overhaul.css')]);
  assert.match(css, /@keyframes cm-dialog-fade-in/);
  assert.match(css, /transform: none !important/);
  assert.match(css, /border: 0; border-radius: 28px/);
  assert.match(compact, /\.cm-dialog-scroll/);
  assert.match(md, /cm-dialog-long/);
});

test('歌词提示仅一次、可点击关闭、不会永久占据歌词', async () => {
  const player = await src('player-ui.js');
  assert.match(player, /let lyricHintShown = false/);
  assert.match(player, /hint\.onclick = close/);
  assert.match(player, /setTimeout\(close, 5000\)/);
  assert.doesNotMatch(player, /<span>点击歌词跳转 · 长按或点此摘录<\/span>/);
});

test('MD3E 仅显示本主题设置、玻璃变量不跨主题生效', async () => {
  const [settings, customize] = await Promise.all([src('pages/settings.js'), src('customize.js')]);
  assert.match(settings, /const isGlass = uiPresetKey\(\) === 'frost'/);
  assert.match(settings, /\$\{isGlass \? `<div class="cm-setting" id="bgImage"/);
  assert.match(customize, /const glassMode = \['frost', 'glass'\]/);
  assert.match(customize, /document\.addEventListener\('cm-uipreset'/);
});

test('频谱开关与波浪进度共用偏好，小屏播放操作等距紧凑', async () => {
  const [css, prefs, player] = await Promise.all([src('expressive.css'), src('customize.js'), src('player-ui.js')]);
  assert.match(css, /data-cm-wave-off/);
  assert.match(css, /justify-content: space-evenly/);
  assert.match(prefs, /cm\.waveEnabled/);
  assert.match(player, /id="mWave"/);
});
