// ============================================================
// 备份文件落地 - 浏览器直接下载，原生端写文件后走系统分享
//
// 为什么原生端不能沿用浏览器那套：安卓 WebView 不支持 `<a download>` + blob:，
// 而 Capacitor 的 Android 端根本没有接管下载（没有 DownloadListener），
// 点了会静默无反应，界面却照样显示"已导出"——数据安全功能形同虚设。
// 所以原生端改为：Filesystem 写入应用缓存 → Share 面板让用户选保存位置。
// 分享面板里的「保存到文件」由系统文件管理器提供，不需要申请存储权限。
// ============================================================

import { Capacitor } from '@capacitor/core';
import { downloadJsonFile, toJsonText } from './download';

export type BackupSaveResult = 'downloaded' | 'shared' | 'canceled';

/**
 * 判断这次失败是不是"用户自己取消了分享"。
 *
 * Share 插件在用户退出分享面板时以 reject 的形式抛出（原文 "Share canceled"），
 * 这不该提示成导出失败——用户只是不想导。
 */
export function isShareCanceled(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.trim() !== '' && message.toLowerCase().includes('cancel');
}

/**
 * 把 JSON 存成文件。
 *
 * - 网页：沿用浏览器下载（落到下载目录）
 * - 原生：写入缓存目录再拉起系统分享面板，用户选「保存到文件」落到手机里
 */
export async function saveJsonFile(
  filename: string,
  data: unknown,
): Promise<BackupSaveResult> {
  if (!Capacitor.isNativePlatform()) {
    downloadJsonFile(filename, data);
    return 'downloaded';
  }

  // 按需加载：网页版永远不会下载这两个插件
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: toJsonText(data),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });

  try {
    // file:// 由应用的 FileProvider 转成可分享的 URI
    // （android/app/src/main/res/xml/file_paths.xml 已把 cache-path 暴露出去）
    await Share.share({ title: filename, files: [uri] });
  } catch (e) {
    if (isShareCanceled(e)) return 'canceled';
    throw e;
  }

  return 'shared';
}
