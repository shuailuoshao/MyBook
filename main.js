const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 数据文件路径 - 开发环境使用项目目录，打包后使用userData目录
let DATA_DIR, BOOKS_FILE, INSPIRATIONS_FILE;
let META_FILE, RATING_CRITERIA_FILE, RATING_CRITERIA_HISTORY_FILE, COMPARISONS_FILE;
let dataDirectoryInitialized = false;

// 当前数据 schema 版本
const CURRENT_SCHEMA_VERSION = 3;

// 初始化路径（在app ready后调用）
function initDataPaths() {
  // 开发环境使用项目根目录的data文件夹
  const isDev = !app.isPackaged;
  if (isDev) {
    // 开发模式：使用项目目录
    DATA_DIR = path.join(__dirname, 'data');
  } else {
    // 打包模式：使用用户数据目录
    const userDataPath = app.getPath('userData');
    DATA_DIR = path.join(userDataPath, 'data');
  }
  BOOKS_FILE = path.join(DATA_DIR, 'books.json');
  INSPIRATIONS_FILE = path.join(DATA_DIR, 'inspirations.json');
  META_FILE = path.join(DATA_DIR, '_meta.json');
  RATING_CRITERIA_FILE = path.join(DATA_DIR, 'rating-criteria.json');
  RATING_CRITERIA_HISTORY_FILE = path.join(DATA_DIR, 'rating-criteria-history.json');
  COMPARISONS_FILE = path.join(DATA_DIR, 'comparisons.json');
  console.log('数据目录:', DATA_DIR);
}

// 确保数据目录存在
async function ensureDataDirectory() {
  // 如果已经初始化过，直接返回，避免重复检查文件
  if (dataDirectoryInitialized) {
    return;
  }
  dataDirectoryInitialized = true;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // 打包模式下，如果数据文件为空或不存在，从打包目录复制现有数据
    if (!app.isPackaged) {
      // 开发模式：直接使用项目目录的数据
      try {
        await fs.access(BOOKS_FILE);
      } catch {
        await fs.writeFile(BOOKS_FILE, JSON.stringify([], null, 2), 'utf-8');
      }
    } else {
      // 打包模式：检查用户数据目录是否有数据，如果没有则从打包目录复制
      // 获取应用根目录（兼容 electron-packager 和 electron-builder）
      const appPath = app.getAppPath();
      const packagedDataDir = path.join(appPath, 'data');

      // 检查并初始化 books.json
      try {
        await fs.access(BOOKS_FILE);
        // 文件已存在，检查是否为空
        const content = await fs.readFile(BOOKS_FILE, 'utf-8');
        if (!content || content.trim() === '' || content.trim() === '[]') {
          // 尝试从打包目录复制
          try {
            const srcBooksFile = path.join(packagedDataDir, 'books.json');
            await fs.access(srcBooksFile);
            await fs.copyFile(srcBooksFile, BOOKS_FILE);
            console.log('已从打包目录复制 books.json');
          } catch (e) {
            // 打包目录没有数据文件，创建空文件
            await fs.writeFile(BOOKS_FILE, JSON.stringify([], null, 2), 'utf-8');
          }
        }
      } catch {
        // 文件不存在，尝试复制或创建
        try {
          const srcBooksFile = path.join(packagedDataDir, 'books.json');
          await fs.access(srcBooksFile);
          await fs.copyFile(srcBooksFile, BOOKS_FILE);
          console.log('已从打包目录复制 books.json');
        } catch (e) {
          await fs.writeFile(BOOKS_FILE, JSON.stringify([], null, 2), 'utf-8');
        }
      }
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

// =========================================
// 数据迁移：v2 → v3
//   - data/_meta.json 引入 schemaVersion
//   - rating-criteria.json → rating-criteria-history.json（包成版本历史）
//   - 每本书生成 ratingHistory，旧 rating / rating_details 字段保留兼容
//   - comparisons.json 不存在则创建为 []
//   - 备份 books.json → books.json.bak.<timestamp>
// =========================================

// 默认评分标准（兜底，与 renderer.js 内 getDefaultRatingCriteria() 保持一致）
function getDefaultRatingCriteria() {
  return {
    "author_layer": [
      { id: "theme_author", name: "作品主题", weight: 4 },
      { id: "plot_architecture", name: "情节架构", weight: 1.5 },
      { id: "character_design", name: "人物设计", weight: 1 },
      { id: "worldview", name: "世界观", weight: 1.5 },
      { id: "narrative_time", name: "叙事时间", weight: 0.5 },
      { id: "symbolism", name: "象征与意象", weight: 1 },
      { id: "era_background", name: "时代背景", weight: 0.5 }
    ],
    "text_layer": [
      { id: "plot_storytelling", name: "情节故事性", weight: 1 },
      { id: "character_development", name: "登场人物塑造", weight: 3 },
      { id: "relationship_network", name: "人物关系网络", weight: 1.5 },
      { id: "background_description", name: "背景描写", weight: 2 },
      { id: "theme_expression", name: "主题表达", weight: 6 },
      { id: "narrative_perspective", name: "叙述视角", weight: 1.5 },
      { id: "writing_style", name: "文笔文风信息量", weight: 2 },
      { id: "rhetorical_devices", name: "修辞手法", weight: 1.5 },
      { id: "dialogue_depth", name: "对话可咀嚼度", weight: 1.5 }
    ],
    "reader_layer": [
      { id: "pre_reading_horizon", name: "阅读前视野", weight: 1 },
      { id: "immersion", name: "代入感", weight: 0.5 },
      { id: "plot_understanding", name: "情节理解", weight: 3 },
      { id: "character_understanding", name: "人物理解", weight: 3 },
      { id: "theme_understanding", name: "主题理解", weight: 4 },
      { id: "overall_aesthetics", name: "整体审美", weight: 2 },
      { id: "knowledge_acquisition", name: "知识获取", weight: 1.5 },
      { id: "paradigm_shift", name: "观念改变", weight: 2.5 },
      { id: "behavioral_impact", name: "行为影响", weight: 2.5 }
    ]
  };
}

// 从 criteria 构造 中文 name → id 的映射
function buildNameToIdMap(criteria) {
  const map = {};
  Object.values(criteria).forEach(layer => {
    if (Array.isArray(layer)) {
      layer.forEach(dim => { if (dim.name && dim.id) map[dim.name] = dim.id; });
    }
  });
  return map;
}

// 读 _meta.json，返回 { schemaVersion } 或 null
async function readMeta() {
  try {
    const content = await fs.readFile(META_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// 备份 books.json
async function backupBooks() {
  try {
    await fs.access(BOOKS_FILE);
  } catch {
    return null; // 没有 books.json，无需备份
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bakPath = `${BOOKS_FILE}.bak.${ts}`;
  await fs.copyFile(BOOKS_FILE, bakPath);
  console.log('已备份 books.json →', bakPath);
  return bakPath;
}

// 加载或创建 rating-criteria-history.json
async function ensureCriteriaHistory() {
  // 已存在则直接返回
  try {
    const content = await fs.readFile(RATING_CRITERIA_HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {}

  // 不存在 → 从老 rating-criteria.json 包装；老的也没有就用默认
  let criteria;
  try {
    const content = await fs.readFile(RATING_CRITERIA_FILE, 'utf-8');
    criteria = JSON.parse(content);
  } catch {
    criteria = getDefaultRatingCriteria();
  }

  const initialVersion = {
    id: 'rc_initial_v1',
    name: '标准配置 (initial)',
    note: '从 V2.x 自动迁移生成的初始版本',
    parentId: null,
    createdAt: new Date().toISOString(),
    criteria
  };
  const history = {
    currentVersionId: initialVersion.id,
    versions: [initialVersion]
  };
  await atomicWrite(RATING_CRITERIA_HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('已创建 rating-criteria-history.json，初始版本:', initialVersion.id);
  return history;
}

// 给一本书生成 ratingHistory（如果它有 rating 但没有 ratingHistory）
function generateRatingHistoryForBook(book, nameToIdMap, initialVersionId) {
  // 已有 ratingHistory 则不动
  if (Array.isArray(book.ratingHistory) && book.ratingHistory.length > 0) return false;
  // 没有 rating 也跳过
  if (!book.rating || !book.rating.ratings) return false;

  // 把中文键转 id 键
  const rating_details = {};
  Object.entries(book.rating.ratings).forEach(([chineseName, value]) => {
    const id = nameToIdMap[chineseName];
    if (id) rating_details[id] = value;
  });

  const entry = {
    id: `rate_${book.id}_001`,
    criteriaVersionId: initialVersionId,
    rating_details,
    totalScore: typeof book.rating.totalScore === 'number' ? book.rating.totalScore : 0,
    ratedAt: book.rating.ratedAt || book.updatedAt || new Date().toISOString()
  };
  book.ratingHistory = [entry];

  // 同时补齐 rating_details（如果没有）
  if (!book.rating_details) {
    book.rating_details = { ...rating_details };
  }
  return true;
}

// 主迁移入口
async function migrateIfNeeded() {
  await ensureDataDirectory();

  const meta = await readMeta();
  if (meta && meta.schemaVersion >= CURRENT_SCHEMA_VERSION) {
    console.log('migrateIfNeeded: 已是最新 schema 版本，跳过');
    return { migrated: false };
  }

  console.log('migrateIfNeeded: 开始迁移到 schema v' + CURRENT_SCHEMA_VERSION);

  // 1. 备份 books.json
  const backupPath = await backupBooks();

  // 2. rating-criteria-history.json
  const history = await ensureCriteriaHistory();
  const initialVersion = history.versions[0];
  const nameToIdMap = buildNameToIdMap(initialVersion.criteria);

  // 3. 改造 books.json：每本生成 ratingHistory；缺 deleted 字段补 false
  let booksUpdated = 0;
  try {
    const content = await fs.readFile(BOOKS_FILE, 'utf-8');
    const books = JSON.parse(content);
    if (Array.isArray(books)) {
      books.forEach(book => {
        if (typeof book.deleted !== 'boolean') book.deleted = false;
        if (generateRatingHistoryForBook(book, nameToIdMap, initialVersion.id)) booksUpdated++;
      });
      await atomicWrite(BOOKS_FILE, JSON.stringify(books, null, 2));
      console.log(`migrateIfNeeded: 已更新 ${booksUpdated} / ${books.length} 本书的 ratingHistory`);
    }
  } catch (err) {
    console.error('migrateIfNeeded: 改造 books.json 失败', err);
  }

  // 4. comparisons.json 不存在则创建空
  try {
    await fs.access(COMPARISONS_FILE);
  } catch {
    await atomicWrite(COMPARISONS_FILE, JSON.stringify([], null, 2));
    console.log('migrateIfNeeded: 已创建空 comparisons.json');
  }

  // 5. 写 _meta.json
  const newMeta = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migratedAt: new Date().toISOString(),
    previousVersion: meta ? meta.schemaVersion : 2,
    backupPath: backupPath || null,
    booksUpdated
  };
  await atomicWrite(META_FILE, JSON.stringify(newMeta, null, 2));
  console.log('migrateIfNeeded: 迁移完成', newMeta);

  return { migrated: true, ...newMeta };
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
  // 初始化数据路径
  initDataPaths();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    title: 'MyBook',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  // 开发工具 - 默认打开（启动时自动打开控制台，已注释）
  // mainWindow.webContents.openDevTools();

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
      // 软删除：标记 deleted=true 而不是物理删除（决策 Q7-3-γ：γ-1 后台软删，无回收站）
      // 这保证对比项目里通过 bookId 引用的书永远能找到
      let touched = false;
      const next = books.map(book => {
        if (book.id === bookId) {
          touched = true;
          return { ...book, deleted: true, updatedAt: new Date().toISOString() };
        }
        return book;
      });
      if (!touched) {
        return { success: false, error: '书籍不存在' };
      }
      await atomicWrite(BOOKS_FILE, JSON.stringify(next, null, 2));
      return { success: true };
    } catch (error) {
      console.error('删除书籍失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 灵感数据操作
  ipcMain.handle('save-inspirations', async (event, inspirations) => {
    try {
      await ensureDataDirectory();
      await atomicWrite(INSPIRATIONS_FILE, JSON.stringify(inspirations, null, 2));
      return { success: true };
    } catch (error) {
      console.error('保存灵感失败:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-inspirations', async () => {
    try {
      await ensureDataDirectory();
      const content = await fs.readFile(INSPIRATIONS_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载灵感失败:', error);
      return [];
    }
  });

  // 评分标准数据操作
  ipcMain.handle('load-rating-criteria', async () => {
    try {
      await ensureDataDirectory();
      const criteriaPath = path.join(DATA_DIR, 'rating-criteria.json');
      const content = await fs.readFile(criteriaPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载评分标准失败:', error);
      return null;
    }
  });

  // ========== V3.0 新增：评分体系版本历史 ==========
  ipcMain.handle('load-rating-criteria-history', async () => {
    try {
      await ensureDataDirectory();
      const content = await fs.readFile(RATING_CRITERIA_HISTORY_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载评分体系版本历史失败:', error);
      return null;
    }
  });

  ipcMain.handle('save-rating-criteria-history', async (event, history) => {
    try {
      if (!history || !Array.isArray(history.versions)) {
        return { success: false, error: '版本历史数据无效' };
      }
      await ensureDataDirectory();
      await atomicWrite(RATING_CRITERIA_HISTORY_FILE, JSON.stringify(history, null, 2));
      return { success: true };
    } catch (error) {
      console.error('保存评分体系版本历史失败:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== V3.0 新增：对比项目 ==========
  ipcMain.handle('load-comparisons', async () => {
    try {
      await ensureDataDirectory();
      const content = await fs.readFile(COMPARISONS_FILE, 'utf-8');
      const arr = JSON.parse(content);
      return Array.isArray(arr) ? arr : [];
    } catch (error) {
      console.error('加载对比项目失败:', error);
      return [];
    }
  });

  ipcMain.handle('save-comparisons', async (event, comparisons) => {
    try {
      if (!Array.isArray(comparisons)) {
        return { success: false, error: '对比项目数据必须是数组' };
      }
      await ensureDataDirectory();
      await atomicWrite(COMPARISONS_FILE, JSON.stringify(comparisons, null, 2));
      return { success: true };
    } catch (error) {
      console.error('保存对比项目失败:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== V3.0 新增：返回 _meta 供 renderer 显示迁移状态 ==========
  ipcMain.handle('load-meta', async () => {
    return await readMeta();
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

  // F12 快捷键打开开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
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

app.whenReady().then(async () => {
  // 禁用系统菜单栏，让UI更纯粹
  Menu.setApplicationMenu(null);

  // V3.0：先初始化路径，再做数据迁移，最后才创建窗口
  initDataPaths();
  try {
    const result = await migrateIfNeeded();
    if (result.migrated) {
      console.log('app.whenReady: 数据迁移已完成', result);
    }
  } catch (err) {
    console.error('app.whenReady: 数据迁移失败（继续启动，使用旧数据）', err);
  }

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
  const logDir = DATA_DIR || path.join(app.getPath('userData'), 'data');
  const logPath = path.join(logDir, 'error.log');
  const logMessage = `[${new Date().toISOString()}] 未捕获异常: ${error.stack || error.message}\n`;
  fs.appendFile(logPath, logMessage).catch(() => {});
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  const logDir = DATA_DIR || path.join(app.getPath('userData'), 'data');
  const logPath = path.join(logDir, 'error.log');
  const logMessage = `[${new Date().toISOString()}] 未处理拒绝: ${reason}\n`;
  fs.appendFile(logPath, logMessage).catch(() => {});
});