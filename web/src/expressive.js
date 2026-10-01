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

// Canvas 不参与：用 SVG 路径叠加在真实 range 下面，拖动期间自动收敛为直线，
// 媒体进度和触摸目标仍由原生 range 负责。
export function mountWavyTrack(bar, seek, player) {
  if (!bar || !seek || bar.querySelector('.cm-wavy-track')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 24');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('cm-wavy-track');
  const path = document.createElementNS(ns, 'path');
  svg.appendChild(path);
  bar.appendChild(svg);
  let phase = 0, last = 0, frame = 0;
  function draw(ts) {
    if (!bar.isConnected) return;
    frame = requestAnimationFrame(draw);
    const playing = player?.isPlaying?.() && document.visibilityState === 'visible';
    if (ts - last < (playing ? 42 : 250)) return; // 播放 ~24fps；暂停/后台 4fps。
    last = ts;
    const amount = Math.max(0, Math.min(1, Number(seek.value || 0) / 100));
    const end = Math.max(0, amount * 1000);
    const amp = !active() || reduced() || seek.dataset.drag ? 0 : 3.1;
    if (active() && !reduced() && playing && !seek.dataset.drag) phase += .16;
    const steps = Math.max(1, Math.ceil(end / 8));
    let d = 'M 0 12';
    for (let i = 1; i <= steps; i++) {
      const x = end * i / steps;
      d += ' L ' + x.toFixed(1) + ' ' + (12 + Math.sin(x * .068 - phase) * amp).toFixed(2);
    }
    path.setAttribute('d', d);
  }
  frame = requestAnimationFrame(draw);
  svg.addEventListener('remove', () => cancelAnimationFrame(frame), { once: true });
}
