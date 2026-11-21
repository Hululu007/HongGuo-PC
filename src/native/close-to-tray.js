// 关闭按钮去留决策：hide=收进系统托盘，quit=继续退出流程（应用层负责 app.quit），
// destroy=放行销毁窗口。主进程 close 事件按该结果分支，保证设置与真实退出互不干扰。
function resolveCloseAction({ platform = 'win32', quitReady = false, isQuitting = false, closeToTray = true } = {}) {
  // macOS 关闭主窗口本就只关窗口不退出应用，维持原行为。
  if (platform === 'darwin') return 'destroy';
  // 真正退出流程（before-quit 置 quitReady，或托盘「退出应用」置 isQuitting）放行销毁。
  if (quitReady || isQuitting) return 'destroy';
  if (closeToTray) return 'hide';
  return 'quit';
}

module.exports = { resolveCloseAction };
