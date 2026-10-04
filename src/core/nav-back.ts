// ============================================================
// 页面头部返回箭头的落点
//
// 原来直接 navigate(backTo)：每次点返回都再压一条父页历史，
// 「看板 → 设置 → 外观」点一次返回箭头，历史就成了「设置 → 外观 → 设置」，
// 再用系统返回键会在两页之间来回弹。
//
// 从父页点进来的（location.state.from）就真回退；其余情况（深链、刷新、
// 从别处进来）替换到父页——替换而不是新增，才不会留下回不去的死路。
// ============================================================

export type BackAction = { type: 'pop' } | { type: 'replace'; to: string };

export function resolveBackAction(from: string | undefined, backTo: string): BackAction {
  return from && from === backTo ? { type: 'pop' } : { type: 'replace', to: backTo };
}
