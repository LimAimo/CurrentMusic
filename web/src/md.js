// mdui 函数统一出口：import 'mdui' 注册全部 Web Components，函数从各子模块取。
import 'mdui';
import 'mdui/locales/zh-cn.js';
import { snackbar } from 'mdui/functions/snackbar.js';
import { dialog } from 'mdui/functions/dialog.js';
import { alert } from 'mdui/functions/alert.js';
import { confirm } from 'mdui/functions/confirm.js';
import { prompt } from 'mdui/functions/prompt.js';
import { setColorScheme } from 'mdui/functions/setColorScheme.js';
import { getColorFromImage } from 'mdui/functions/getColorFromImage.js';
import { setTheme } from 'mdui/functions/setTheme.js';
import { setLocale } from 'mdui/functions/setLocale.js';

try { setLocale('zh-CN'); } catch { /* locale 包缺失时静默 */ }

// 给所有从 mdui.dialog() 创建的模态框统一加安全滚动容器；不改变已有调用方或按钮语义。
export function adaptiveDialog(options = {}) {
  const body = options.body == null ? '' : String(options.body);
  const diag = dialog({ ...options,
    body: `<div class="cm-dialog-scroll">${body}</div>`,
  });
  diag.classList.add('cm-adaptive-dialog');
  // 等 Web Component 布局完成后检测正文高度；长内容手机端自动停靠到底部。
  const updateLayout = () => {
    if (!diag.isConnected) return;
    const viewport = window.visualViewport?.height || window.innerHeight;
    const scroll = diag.querySelector('.cm-dialog-scroll');
    if (scroll) diag.classList.toggle('cm-dialog-long', scroll.scrollHeight > Math.min(420, viewport * .56));
  };
  requestAnimationFrame(() => requestAnimationFrame(updateLayout));
  diag.addEventListener('open', updateLayout);
  return diag;
}
export const mdui = { snackbar, dialog: adaptiveDialog, alert, confirm, prompt, setColorScheme, setTheme, getColorFromImage };
