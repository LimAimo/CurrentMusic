// 在线更新：启动自动检测 + MD3 更新弹窗（默认服务器源，可手动切换 + 下载进度 + 自动拉起安装器）
import { mdui } from './md.js';
import { call, settings } from './api.js';
import { esc, toast } from './ui.js';
import { currentVersion, isNewer } from './version.js';
import { isAndroidApp } from './platform.js';

const SKIP_KEY = 'cm.updateSkip';         // 本会话跳过的版本（避免反复打扰）
const GH_REPO = 'backrooms-yrc/CurrentMusic';

const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

/** 拉取最新版本信息：服务器优先，不可达时回退 GitHub Releases API。 */
export async function fetchLatest() {
  try {
    const d = await call('GET', '/version/latest');
    // 兼容旧发布脚本 bug：changelog 曾被写成字面 '-'（stdin 未实现）——视为无更新说明
    if (d.changelog === '-') d.changelog = '';
    d.sources = (d.sources || []).map(s => ({ ...s, url: s.path ? `${settings.base}/${s.path}` : s.url }));
    return d;
  } catch (e) {
    return await fetchFromGithub();
  }
}

async function fetchFromGithub() {
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`);
  if (!r.ok) throw new Error('无法获取版本信息');
  const d = await r.json();
  const version = String(d.tag_name || '').replace(/^v/, '');
  const asset = (d.assets || []).find(a => a.name && a.name.endsWith('.apk'));
  return {
    version,
    versionCode: 0,
    changelog: d.body || '',
    publishedAt: d.published_at ? Math.floor(new Date(d.published_at).getTime() / 1000) : 0,
    sources: asset ? [{ key: 'github', label: 'GitHub Releases', url: asset.browser_download_url }] : [],
  };
}

// 网页只比较已部署的资源指纹，绝不拿 APK 版本冒充网页更新。
// 首次加载的 app.js?v=... 来自构建脚本；检查时用 no-store 请求部署端 index.html。
function currentWebStamp() {
  const src = document.querySelector('script[src*="app.js"]')?.getAttribute('src') || '';
  return /[?&]v=([a-z0-9]+)/i.exec(src)?.[1] || '';
}
function deployedWebStamp(html) {
  return /src=["'][^"']*app\.js\?v=([a-z0-9]+)/i.exec(html)?.[1] || '';
}
function refreshWeb() {
  const url = new URL(location.href);
  url.searchParams.set('cm_refresh', Date.now().toString(36));
  // 保留 hash 路由与登录状态，不碰站点 storage；新 index.html 加载带指纹的资源。
  location.replace(url.toString());
}
async function checkWebUpdate(silent) {
  try {
    const r = await fetch(new URL('./index.html?check=' + Date.now(), location.href), { cache: 'no-store' });
    if (!r.ok) throw new Error('无法获取网页版本');
    const deployed = deployedWebStamp(await r.text());
    const active = currentWebStamp();
    if (!deployed || !active) {
      if (!silent) toast('当前部署未提供资源指纹，可尝试刷新网页');
      return;
    }
    if (deployed === active) {
      if (!silent) toast('网页已是最新版本');
      return;
    }
    if (silent && sessionStorage.getItem('cm.webSkip') === deployed) return;
    const diag = mdui.dialog({
      headline: '发现网页新版本',
      body: `<div class="cm-web-update"><div class="cm-web-update-hero"><span class="material-icons-outlined" aria-hidden="true">refresh</span></div><p>网站已发布新的界面或功能。刷新后会应用最新版，当前账号不会退出。</p><p class="cm-more-s">正在播放的歌曲会暂停；未提交的输入请先保存。</p></div>`,
      actions: [{ text: '稍后', onClick: () => { sessionStorage.setItem('cm.webSkip', deployed); } },
                { text: '刷新并应用', onClick: refreshWeb }],
    });
    return diag;
  } catch (e) {
    if (!silent) toast('检查网页更新失败：' + e.message);
  }
}

/** 启动时自动检测（silent=不弹"已是最新"提示）。 */
export async function checkUpdate({ silent = true } = {}) {
  if (!isAndroidApp()) return checkWebUpdate(silent);
  const cur = currentVersion();
  let latest;
  try {
    latest = await fetchLatest();
  } catch (e) {
    if (!silent) toast('检查更新失败：' + e.message);
    return;
  }
  if (!latest || !latest.version || (latest.sources || []).length === 0) {
    if (!silent) toast('暂无可用更新包');
    return;
  }
  if (!isNewer(latest, cur)) {
    if (!silent) toast(`已是最新版本 v${cur.name}`);
    return;
  }
  if (silent && sessionStorage.getItem(SKIP_KEY) === String(latest.versionCode || latest.version)) return;
  showUpdateDialog(latest, cur);
}

function showUpdateDialog(latest, cur) {
  let picked = null;
  let downloading = false;

  const diag = mdui.dialog({
    headline: `发现新版本 v${latest.version}`,
    body: `<div class="upd">
      <div class="upd-ver">
        <span>当前 <b>v${esc(cur.name)}</b></span>
        <span class="material-icons-outlined">arrow_forward</span>
        <span>最新 <b class="upd-new">v${esc(latest.version)}</b></span>
        ${latest.size ? `<span class="upd-size">${fmtSize(latest.size)}</span>` : ''}
      </div>
      ${latest.changelog ? `<div class="upd-log">${esc(latest.changelog).slice(0, 1200)}</div>` : ''}
      <div class="upd-sec">下载源<span class="upd-tip">默认服务器直连，可点击切换</span></div>
      <div class="upd-srcs" id="updSrcs">
        ${latest.sources.map(s => `
          <div class="upd-src" data-key="${s.key}">
            <span class="material-icons-outlined upd-radio">radio_button_unchecked</span>
            <div class="upd-src-main"><div>${esc(s.label)}</div><div class="upd-src-url">${esc(s.url.replace(/^https?:\/\//, '').slice(0, 46))}</div></div>
          </div>`).join('')}
      </div>
      <div class="upd-prog" id="updProg" hidden>
        <mdui-linear-progress id="updBar"></mdui-linear-progress>
        <div class="upd-prog-txt" id="updProgTxt">准备下载…</div>
      </div>
    </div>`,
    actions: [{ text: '稍后再说' }, { text: '立即更新', onClick: () => startDownload() }],
  });

  const setPicked = key => {
    picked = key;
    diag.querySelectorAll('.upd-src').forEach(el => {
      const on = el.dataset.key === key;
      el.classList.toggle('on', on);
      el.querySelector('.upd-radio').textContent = on ? 'radio_button_checked' : 'radio_button_unchecked';
    });
  };

  diag.querySelectorAll('.upd-src').forEach(el => {
    el.onclick = () => setPicked(el.dataset.key);
  });

  // 默认服务器直连；无服务器源（如仅 GitHub 兜底）时选第一个
  const serverSrc = latest.sources.find(s => s.key === 'server');
  if (serverSrc) setPicked('server');
  else if (latest.sources.length) setPicked(latest.sources[0].key);

  // 原生回调
  window.__cmUpdateProgress = (pct, done, total) => {
    const box = diag.querySelector('#updProg');
    const bar = diag.querySelector('#updBar');
    const txt = diag.querySelector('#updProgTxt');
    if (!box) return;
    box.hidden = false;
    if (bar) bar.value = pct / 100;
    if (txt) txt.textContent = total > 0 ? `下载中 ${pct}%（${fmtSize(done)} / ${fmtSize(total)}）` : `下载中 ${pct}%`;
  };
  window.__cmUpdateInstall = () => {
    const txt = diag.querySelector('#updProgTxt');
    if (txt) txt.textContent = '下载完成，正在拉起安装器…';
    toast('下载完成，请在系统安装界面完成安装');
    setTimeout(() => { diag.open = false; cleanHandlers(); }, 1200);
  };
  window.__cmUpdateFailed = msg => {
    downloading = false;
    const btn = [...diag.querySelectorAll('mdui-button')].find(b => b.textContent.includes('立即更新'));
    if (btn) btn.loading = false;
    const txt = diag.querySelector('#updProgTxt');
    if (txt) txt.textContent = String(msg);
    toast(String(msg));
  };

  function cleanHandlers() {
    delete window.__cmUpdateProgress;
    delete window.__cmUpdateInstall;
    delete window.__cmUpdateFailed;
  }

  function startDownload() {
    if (downloading) return false;
    const src = latest.sources.find(s => s.key === picked) || latest.sources[0];
    if (!src) { toast('没有可用的下载源'); return false; }
    const fileName = latest.fileName || `CurrentMusic-v${latest.version}.apk`;
    downloading = true;
    const box = diag.querySelector('#updProg');
    if (box) box.hidden = false;
    if (window.NativeApi && window.NativeApi.downloadApk) {
      window.NativeApi.downloadApk(src.url, fileName);
      toast('已开始下载更新…');
      return false;   // 保持弹窗展示进度
    }
    // 浏览器模式：直接跳转下载
    window.open(src.url, '_blank');
    toast('已在新窗口打开下载');
    return true;
  }

  diag.addEventListener('closed', () => {
    if (!downloading) {
      sessionStorage.setItem(SKIP_KEY, String(latest.versionCode || latest.version));
    }
    cleanHandlers();
  }, { once: true });
}
