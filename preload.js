const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍操作
  saveBooks: (books) => ipcRenderer.invoke('save-books', books),
  loadBooks: () => ipcRenderer.invoke('load-books'),
  deleteBook: (bookId) => ipcRenderer.invoke('delete-book', bookId),

  // 灵感操作
  saveInspirations: (inspirations) => ipcRenderer.invoke('save-inspirations', inspirations),
  loadInspirations: () => ipcRenderer.invoke('load-inspirations'),

  // 评分标准
  loadRatingCriteria: () => ipcRenderer.invoke('load-rating-criteria'),

  // V3.0: 评分体系版本历史
  loadRatingCriteriaHistory: () => ipcRenderer.invoke('load-rating-criteria-history'),
  saveRatingCriteriaHistory: (history) => ipcRenderer.invoke('save-rating-criteria-history', history),

  // V3.0: 对比项目
  loadComparisons: () => ipcRenderer.invoke('load-comparisons'),
  saveComparisons: (comparisons) => ipcRenderer.invoke('save-comparisons', comparisons),

  // V3.0: 数据 schema 元信息
  loadMeta: () => ipcRenderer.invoke('load-meta'),

  // 工具函数
  showMessage: (title, message) => ipcRenderer.send('show-message', { title, message }),

  // 文件操作（后续阶段使用）
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  // 导入/导出操作
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  exportData: ({ format, data, filePath }) => ipcRenderer.invoke('export-data', { format, data, filePath }),
  importData: ({ filePath }) => ipcRenderer.invoke('import-data', { filePath }),

  // 开发者工具
  openDevTools: () => ipcRenderer.send('open-devtools')
});

// 监听主进程发送的消息
ipcRenderer.on('app-notification', (event, message) => {
  console.log('收到应用通知:', message);
});