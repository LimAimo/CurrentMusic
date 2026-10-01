// 所有 Web/Android 专属入口以能力检测为准；不要仅因浏览器跑在 Android 上就显示 App 功能。
export function isAndroidApp() {
  try { return typeof window.NativeApi?.versionCode === 'function' && Number(window.NativeApi.versionCode()) > 0; }
  catch { return false; }
}
export const canNativeDownload = () => isAndroidApp() && typeof window.NativeApi?.download === 'function';
export const canInstallApk = () => isAndroidApp() && typeof window.NativeApi?.downloadApk === 'function';
export const canDlna = () => isAndroidApp() && typeof window.NativeApi?.dlnaDiscover === 'function';
export const canNativeInsets = () => isAndroidApp() && typeof window.NativeApi?.insets === 'function';
export function platformName() { return isAndroidApp() ? 'Android App' : 'Web'; }
