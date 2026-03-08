// 最小化Electron应用测试
const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Electron app:', app);
console.log('app type:', typeof app);

if (!app) {
  console.error('ERROR: app is undefined!');
  console.error('This means Electron module is not loading correctly.');
  process.exit(1);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
  console.log('Window created successfully');
}

// 检查app.whenReady是否存在
if (app.whenReady) {
  app.whenReady().then(() => {
    console.log('App is ready');
    createWindow();
  });
} else {
  console.error('ERROR: app.whenReady is undefined!');
  console.error('app object:', app);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});