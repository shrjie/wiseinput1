const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 920,
    frame: false, // 隱藏標題列，使用我們自定義的玻璃質感標題
    transparent: true, // 支援透明背景
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile('index.html');

  // 註冊全域快速鍵：Alt + Space
  globalShortcut.register('Alt+Space', () => {
    mainWindow.webContents.send('toggle-record');
  });

  // 監聽自動貼上請求
  ipcMain.on('auto-paste', (event, text) => {
    // 這裡可以擴展更複雜的貼上邏輯
    console.log("Auto-paste requested for:", text);
  });

  // 讓連結在外部瀏覽器開啟
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
