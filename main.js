const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');

// 确保数据目录存在
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // 如果数据文件不存在，创建空数组
    try {
      await fs.access(BOOKS_FILE);
    } catch {
      await fs.writeFile(BOOKS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('创建数据目录失败:', error);
  }
}

// 原子写入文件
async function atomicWrite(filePath, data) {
  console.log('atomicWrite: 写入文件:', filePath);
  const tempPath = filePath + '.tmp';
  await fs.writeFile(tempPath, data, 'utf-8');
  console.log('atomicWrite: 临时文件写入完成');
  await fs.rename(tempPath, filePath);
  console.log('atomicWrite: 文件重命名完成');
}

// 验证书籍数据
function validateBooksData(books) {
  if (!Array.isArray(books)) {
    return { valid: false, error: '书籍数据必须是数组' };
  }

  for (const book of books) {
    if (!book.id || typeof book.id !== 'string') {
      return { valid: false, error: '书籍ID无效' };
    }
    if (!book.title || typeof book.title !== 'string') {
      return { valid: false, error: '书籍标题无效' };
    }
  }

  return { valid: true };
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // 开发工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('createWindow: 页面加载失败:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('createWindow: 渲染进程崩溃:', details.reason);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 设置IPC处理器
function setupIPCHandlers() {
  // 书籍数据操作
  ipcMain.handle('save-books', async (event, books) => {
    try {
      console.log('main.js: 收到保存书籍请求, 数量:', books ? books.length : 0);

      // 输入验证
      const validation = validateBooksData(books);
      if (!validation.valid) {
        console.log('main.js: 验证失败:', validation.error);
        return { success: false, error: validation.error };
      }

      // 打印第一本书的数据用于调试
      if (books.length > 0) {
        console.log('main.js: 第一本书数据:', JSON.stringify(books[0]));
      }

      console.log('main.js: 验证通过，准备写入文件');
      console.log('main.js: 数据目录:', DATA_DIR);
      console.log('main.js: 文件路径:', BOOKS_FILE);
      await ensureDataDirectory();
      await atomicWrite(BOOKS_FILE, JSON.stringify(books, null, 2));
      console.log('main.js: 文件写入成功');
      return { success: true };
    } catch (error) {
      console.error('main.js: 保存书籍数据失败:', error);
      console.error('main.js: 错误堆栈:', error.stack);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-books', async () => {
    try {
      await ensureDataDirectory();
      const content = await fs.readFile(BOOKS_FILE, 'utf-8');
      const books = JSON.parse(content);
      const validation = validateBooksData(books);
      if (!validation.valid) {
        console.error('书籍数据验证失败:', validation.error);
        return [];
      }
      return books;
    } catch (error) {
      console.error('加载书籍数据失败:', error);
      return [];
    }
  });

  ipcMain.handle('delete-book', async (event, bookId) => {
    try {
      await ensureDataDirectory();
      const content = await fs.readFile(BOOKS_FILE, 'utf-8');
      const books = JSON.parse(content);
      const filteredBooks = books.filter(book => book.id !== bookId);
      await atomicWrite(BOOKS_FILE, JSON.stringify(filteredBooks, null, 2));
      return { success: true };
    } catch (error) {
      console.error('删除书籍失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 工具函数
  ipcMain.on('show-message', (event, { title, message }) => {
    if (mainWindow) {
      mainWindow.webContents.send('app-notification', { title, message });
    }
  });

  // 打开开发者工具
  ipcMain.on('open-devtools', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 文件操作
  ipcMain.handle('open-file-dialog', async (event, options = {}) => {
    try {
      const defaultOptions = {
        title: '选择文件',
        properties: ['openFile'],
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: 'CSV 文件', extensions: ['csv'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      };

      const dialogOptions = { ...defaultOptions, ...options };
      const result = await dialog.showOpenDialog(mainWindow || null, dialogOptions);

      if (result.canceled) {
        return { success: false, filePaths: [] };
      }

      return { success: true, filePaths: result.filePaths };
    } catch (error) {
      console.error('打开文件对话框失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      // 增强路径安全检查（防止目录遍历）
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: '无效的文件路径' };
      }

      const normalizedPath = path.normalize(filePath);
      // 检查目录遍历
      if (normalizedPath.includes('..')) {
        return { success: false, error: '无效的文件路径' };
      }

      // 获取文件统计信息，检查文件大小（限制为 10MB）
      const stats = await fs.stat(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        return { success: false, error: '文件过大' };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('读取文件失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 导入/导出相关 IPC 处理器
  ipcMain.handle('show-save-dialog', async (event, options = {}) => {
    console.log('收到show-save-dialog请求，选项:', options);
    try {
      const defaultOptions = {
        title: '保存文件',
        defaultPath: `mybook_export_${new Date().toISOString().split('T')[0]}`,
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: 'CSV 文件', extensions: ['csv'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      };

      const dialogOptions = { ...defaultOptions, ...options };
      console.log('显示保存对话框，选项:', dialogOptions);
      const result = await dialog.showSaveDialog(mainWindow || null, dialogOptions);
      console.log('保存对话框结果:', result);

      if (result.canceled) {
        console.log('用户取消了保存对话框');
        return { success: false, filePath: null };
      }

      console.log('用户选择了文件:', result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('显示保存对话框失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-data', async (event, { format, data, filePath }) => {
    console.log('收到export-data请求，格式:', format, '文件路径:', filePath, '数据长度:', data?.length);
    try {
      if (!filePath) {
        console.log('错误：未指定保存路径');
        return { success: false, error: '未指定保存路径' };
      }

      // 确保目录存在
      const dir = path.dirname(filePath);
      console.log('创建目录:', dir);
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      console.log('写入文件:', filePath);
      await fs.writeFile(filePath, data, 'utf-8');
      console.log('文件写入成功');
      return { success: true, filePath };
    } catch (error) {
      console.error('导出数据失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-data', async (event, { filePath }) => {
    try {
      if (!filePath) {
        return { success: false, error: '未指定文件路径' };
      }

      // 读取文件
      const content = await fs.readFile(filePath, 'utf-8');

      // 尝试解析JSON
      try {
        const data = JSON.parse(content);
        return { success: true, data, format: 'json' };
      } catch (jsonError) {
        // 如果不是JSON，尝试解析CSV
        try {
          const lines = content.split('\n').filter(line => line.trim());
          if (lines.length === 0) {
            throw new Error('CSV文件为空');
          }

          const headers = lines[0].split(',').map(h => h.trim());
          const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = values[index] || '';
            });
            return obj;
          });

          return { success: true, data, format: 'csv' };
        } catch (csvError) {
          return { success: false, error: '无法解析文件格式，请确保是有效的JSON或CSV文件' };
        }
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(() => {
  // 禁用系统菜单栏，让UI更纯粹
  Menu.setApplicationMenu(null);

  createWindow();
  setupIPCHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupIPCHandlers();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前的清理工作
app.on('before-quit', async (event) => {
  console.log('应用即将退出，进行清理...');
  // 确保数据已保存
  try {
    console.log('清理完成');
  } catch (error) {
    console.error('退出前清理失败:', error);
  }
});

// 全局异常处理器
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 记录错误到日志文件
  const logPath = path.join(DATA_DIR, 'error.log');
  const logMessage = `[${new Date().toISOString()}] 未捕获异常: ${error.stack || error.message}\n`;
  fs.appendFile(logPath, logMessage).catch(() => {});
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  const logPath = path.join(DATA_DIR, 'error.log');
  const logMessage = `[${new Date().toISOString()}] 未处理拒绝: ${reason}\n`;
  fs.appendFile(logPath, logMessage).catch(() => {});
});