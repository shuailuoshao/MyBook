const electron = require('electron');
console.log('electron:', electron);

const { app, BrowserWindow } = electron;
console.log('app:', app);

app.whenReady().then(() => {
  console.log('App is ready!');
  app.quit();
});
