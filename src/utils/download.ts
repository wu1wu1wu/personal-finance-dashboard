// ============================================================
// 下载工具 - 把 JSON 存成文件
// ============================================================

/** 备份文件的文本格式：两个空格缩进，保证网页与原生两条路径产出的文件一致 */
export function toJsonText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** 触发浏览器下载一份 JSON 文件（文件名默认带日期） */
export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([toJsonText(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 形如 记账备份_2026-09-16.json */
export function backupFilename(prefix: string, now = new Date()): string {
  const date = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
  return `${prefix}_${date}.json`;
}
