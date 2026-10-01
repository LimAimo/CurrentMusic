// Expressive 交互：DOM 轻量增强。动画只在 Material 3 Expressive 预设下启用。
const active = () => !document.documentElement.hasAttribute('data-ui-preset');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function upgradeProgress(root) {
  const targets = root?.matches?.('mdui-circular-progress') ? [root] : (root?.querySelectorAll?.('mdui-circular-progress') || []);
  for (const el of targets) {
    if (el.nextElementSibling?.classList.contains('cm-morph-loader')) continue;
    const shape = document.createElement('span');
    shape.className = 'cm-morph-loader';
    shape.setAttribute('aria-hidden', 'true');
    el.insertAdjacentElement('afterend', shape);
  }
}

export function initExpressive() {
  upgradeProgress(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && !node.classList?.contains('cm-morph-loader')) upgradeProgress(node);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// 波形始终按 CSS 像素计算周期，避免伸缩 SVG viewBox 时被拉成模糊长波。
export function buildWavyPath(width, progress, amplitude, phase = 0) {
  const end = Math.max(0, Math.min(width, width * progress));
  if (end <= 0) return '';
  const step = 3; // 高 DPI 下采样足够细，但不让低端手机每帧产生几千个点
  let path = 'M 0 12';
  for (let x = step; x < end; x += step) {
    const taper = Math.min(1, x / 12, (end - x) / 12);
    path += ` L ${x.toFixed(1)} ${(12 + Math.sin(x * Math.PI / 15 - phase) * amplitude * taper).toFixed(2)}`;
  }
  path += ` L ${end.toFixed(1)} 12`;
  return path;
}

// Canvas 不参与：SVG 只画已播放的波浪；暂停、拖动和无障碍模式恢复直线。
export function mountWavyTrack(bar, seek, player) {
  if (!bar || !seek || bar.querySelector('.cm-wavy-track')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('cm-wavy-track');
  const path = document.createElementNS(ns, 'path');
  svg.appendChild(path);
  bar.appendChild(svg);
  let phase = 0, last = 0, frame = 0, width = 0;
  const measure = () => {
    width = Math.max(1, bar.clientWidth);
    svg.setAttribute('viewBox', `0 0 ${width} 24`);
  };
  measure();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
  observer?.observe(bar);
  function draw(ts) {
    if (!bar.isConnected) { observer?.disconnect(); cancelAnimationFrame(frame); return; }
    frame = requestAnimationFrame(draw);
    const playing = !!player?.isPlaying?.() && document.visibilityState === 'visible';
    if (ts - last < (playing ? 33 : 125)) return;
    last = ts;
    const amount = Math.max(0, Math.min(1, Number(seek.value || 0) / 100));
    const animated = active() && !reduced() && !seek.dataset.drag && playing && !document.documentElement.hasAttribute('data-cm-wave-off');
    const amp = animated ? 4.8 : 0;
    if (animated) phase += .18;
    path.setAttribute('d', buildWavyPath(width, amount, amp, phase));
  }
  frame = requestAnimationFrame(draw);
}
