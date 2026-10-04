// ============================================================
// 返回键消费栈
//
// 背景：Capacitor 8 不再接管安卓返回键（BridgeActivity 里没有 onBackPressed），
// 系统默认行为是直接 finish()，于是用户在设置子页或详情弹窗里按返回就退出整个 App。
//
// 原生侧（MainActivity）按下返回时先执行 window.__pfdHandleBack()：
// Web 层有人要这次返回（弹窗、抽屉）就返回 true，原生什么都不做；
// 返回 false 时原生才退回 WebView 历史，历史到底再退出 App。
//
// 这里只放纯逻辑：谁最后注册谁先被消费（弹窗叠弹窗时先关最上面那层）。
// ============================================================

export type BackHandler = () => void;

const handlers: BackHandler[] = [];

/** 注册一个「吃掉返回键」的处理器，返回注销函数 */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** 消费一次返回：栈顶处理器存在则执行它并返回 true（原生据此不再往下走） */
export function consumeBack(): boolean {
  const handler = handlers[handlers.length - 1];
  if (!handler) return false;
  handler();
  return true;
}

/** 当前注册了几层（调试与测试用） */
export function backHandlerCount(): number {
  return handlers.length;
}

/**
 * 清空所有处理器。
 * 只给测试用：应用里每一层（弹窗）都在自己的卸载流程里注销，
 * 而且 consumeBack 故意不弹出处理器——弹窗没关掉时，下一次返回还该找它。
 */
export function clearBackHandlers(): void {
  handlers.length = 0;
}
