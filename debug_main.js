console.log('开始加载Electron模块...');
try {
  const electron = require('electron');
  console.log('Electron模块加载成功:', electron);
  console.log('app:', electron.app);
  console.log('BrowserWindow:', electron.BrowserWindow);
  console.log('ipcMain:', electron.ipcMain);

  const { app, BrowserWindow } = electron;

  console.log('app变量:', app);
  console.log('app.whenReady:', app ? app.whenReady : 'app is undefined');

  if (app && app.whenReady) {
    app.whenReady().then(() => {
      console.log('Electron应用准备就绪');
      const win = new BrowserWindow({ width: 800, height: 600 });
      win.loadFile('index.html');
      console.log('窗口创建成功');
    });
  } else {
    console.error('app或app.whenReady不可用');
  }
} catch (error) {
  console.error('加载Electron模块失败:', error);
}