// =========================================
// 评分系统默认配置 - 25指标权重
// =========================================
const DEFAULT_RATING_PROFILE = {
  "标准配置": {
    "作者层面": [
      { name: "作品主题", w: 4 }, { name: "情节架构", w: 1.5 }, { name: "人物设计", w: 1 },
      { name: "世界观", w: 1.5 }, { name: "叙事时间", w: 0.5 }, { name: "象征与意象", w: 1 }, { name: "时代背景", w: 0.5 }
    ],
    "文本层面": [
      { name: "情节故事性", w: 1 }, { name: "登场人物塑造", w: 3 }, { name: "人物关系网络", w: 1.5 },
      { name: "背景描写", w: 2 }, { name: "主题表达", w: 6 }, { name: "叙述视角", w: 1.5 },
      { name: "文笔文风信息量", w: 2 }, { name: "修辞手法", w: 1.5 }, { name: "对话可咀嚼度", w: 1.5 }
    ],
    "读者层面": [
      { name: "阅读前视野", w: 1 }, { name: "代入感", w: 0.5 }, { name: "情节理解", w: 3 },
      { name: "人物理解", w: 3 }, { name: "主题理解", w: 4 }, { name: "整体审美", w: 2 },
      { name: "知识获取", w: 1.5 }, { name: "观念改变", w: 2.5 }, { name: "行为影响", w: 2.5 }
    ]
  }
};
const DEFAULT_PROFILE_NAME = "标准配置";

// =========================================
// 日记数据模型
// =========================================
class JournalEntry {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.content = data.content || '';
        this.mood = data.mood || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    generateId() {
        return 'journal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            date: this.date,
            content: this.content,
            mood: this.mood,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(json) {
        return new JournalEntry(json);
    }
}

// =========================================
// 评分相关全局函数（在class外，供HTML onclick调用）
// =========================================
let ratingApp = null;


// ExportService类定义（导入/导出服务）
class ExportService {
  // 导出为 JSON（完整数据）
  static exportToJSON(books) {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      count: books.length,
      books: books.map(book => {
        // 深拷贝书籍对象，确保不修改原数据
        const bookCopy = { ...book };
        // 确保 notes 是数组
        if (bookCopy.notes && !Array.isArray(bookCopy.notes)) {
          bookCopy.notes = [];
        }
        // 确保 tags 是数组
        if (bookCopy.tags && !Array.isArray(bookCopy.tags)) {
          bookCopy.tags = [];
        }
        return bookCopy;
      })
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 导出为 JSON（含评分详情）
  static exportToJSONWithRatingDetails(books) {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      count: books.length,
      books: books.map(book => {
        const bookCopy = { ...book };
        // 添加评分详情统计
        if (bookCopy.rating && bookCopy.rating.ratings) {
          const ratings = bookCopy.rating.ratings;
          const ratingStats = {
            totalScore: bookCopy.rating.totalScore || 0,
            ratedAt: bookCopy.rating.ratedAt || null,
            profile: bookCopy.rating.profile || '标准配置',
            ratings: ratings,
            ratingCount: Object.keys(ratings).length
          };
          bookCopy.ratingDetails = ratingStats;
        }
        return bookCopy;
      })
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 导出为 CSV
  static exportToCSV(books) {
    const headers = [
      '书名', '作者', '阅读状态', '开始日期', '结束日期',
      '阅读时长(天)', '综合评分', '标签', '笔记数量', '创建时间', '更新时间'
    ];

    const rows = books.map(book => {
      const readingDuration = book.getReadingDuration ? (book.getReadingDuration() || 0) : 0;
      const ratingScore = book.rating && book.rating.totalScore ? book.rating.totalScore : '';
      const tags = book.tags && book.tags.length > 0 ? book.tags.join(';') : '';
      const notesCount = book.notes ? book.notes.length : 0;

      return [
        this.escapeCSV(book.title || ''),
        this.escapeCSV(book.author || ''),
        book.status || '未开始',
        book.startDate || '',
        book.endDate || '',
        readingDuration,
        ratingScore,
        this.escapeCSV(tags),
        notesCount,
        book.createdAt || '',
        book.updatedAt || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  // 从 JSON 导入数据
  static importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      // 验证数据结构
      if (!data.books || !Array.isArray(data.books)) {
        throw new Error('无效的数据格式：缺少 books 数组');
      }

      // 转换数据为 Book 对象格式
      const importedBooks = data.books.map(bookData => {
        // 确保必要字段存在
        const book = {
          id: bookData.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title: bookData.title || '',
          author: bookData.author || '',
          startDate: bookData.startDate || null,
          endDate: bookData.endDate || null,
          status: bookData.status || '未开始',
          notes: bookData.notes || [],
          rating: bookData.rating || null,
          tags: bookData.tags || [],
          enableRating: bookData.enableRating || false,
          createdAt: bookData.createdAt || new Date().toISOString(),
          updatedAt: bookData.updatedAt || new Date().toISOString()
        };

        // 验证必要字段
        if (!book.title || book.title.trim() === '') {
          throw new Error('书籍缺少书名');
        }

        if (!['未开始', '阅读中', '已读完'].includes(book.status)) {
          book.status = '未开始';
        }

        return book;
      });

      return {
        success: true,
        books: importedBooks,
        count: importedBooks.length,
        version: data.version || '未知版本',
        exportDate: data.exportDate || '未知日期'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        books: []
      };
    }
  }

  // 从 CSV 导入数据
  static importFromCSV(csvString) {
    try {
      const lines = csvString.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error('CSV 文件至少需要标题行和数据行');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const importedBooks = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          console.warn(`第 ${i + 1} 行列数不匹配，跳过`);
          continue;
        }

        const bookData = {};
        for (let j = 0; j < headers.length; j++) {
          bookData[headers[j]] = values[j];
        }

        // 转换 CSV 数据为 Book 格式
        const book = {
          id: Date.now().toString() + i + Math.random().toString(36).substring(2, 9),
          title: bookData['书名'] || '',
          author: bookData['作者'] || '',
          startDate: bookData['开始日期'] || null,
          endDate: bookData['结束日期'] || null,
          status: bookData['阅读状态'] || '未开始',
          notes: [],
          rating: bookData['综合评分'] ? { totalScore: parseFloat(bookData['综合评分']) } : null,
          tags: bookData['标签'] ? bookData['标签'].split(';').filter(tag => tag.trim() !== '') : [],
          enableRating: !!bookData['综合评分'],
          createdAt: bookData['创建时间'] || new Date().toISOString(),
          updatedAt: bookData['更新时间'] || new Date().toISOString()
        };

        // 验证必要字段
        if (!book.title || book.title.trim() === '') {
          throw new Error(`第 ${i + 1} 行缺少书名`);
        }

        importedBooks.push(book);
      }

      return {
        success: true,
        books: importedBooks,
        count: importedBooks.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        books: []
      };
    }
  }

  // 验证导入数据
  static validateImportData(data) {
    const errors = [];
    const warnings = [];

    if (!data.books || !Array.isArray(data.books)) {
      errors.push('数据格式错误：缺少 books 数组');
      return { isValid: false, errors, warnings };
    }

    data.books.forEach((book, index) => {
      // 检查必要字段
      if (!book.title || book.title.trim() === '') {
        errors.push(`第 ${index + 1} 本书缺少书名`);
      }

      // 检查状态有效性
      if (book.status && !['未开始', '阅读中', '已读完'].includes(book.status)) {
        warnings.push(`第 ${index + 1} 本书状态 "${book.status}" 无效，将设置为"未开始"`);
      }

      // 检查日期逻辑
      if (book.startDate && book.endDate) {
        const start = new Date(book.startDate);
        const end = new Date(book.endDate);
        if (start > end) {
          warnings.push(`第 ${index + 1} 本书开始日期晚于结束日期`);
        }
      }

      // 检查评分范围
      if (book.rating && book.rating.totalScore) {
        const score = book.rating.totalScore;
        if (score < 0 || score > 100) {
          warnings.push(`第 ${index + 1} 本书评分 ${score} 超出正常范围(0-100)`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      bookCount: data.books.length
    };
  }

  // 合并书籍数据（避免重复）
  static mergeBooks(existingBooks, newBooks, mergeStrategy = 'skipDuplicates') {
    const mergedBooks = [...existingBooks];
    const addedBooks = [];
    const skippedBooks = [];

    newBooks.forEach(newBook => {
      // 检查是否已存在（基于书名和作者）
      const isDuplicate = existingBooks.some(existingBook =>
        existingBook.title === newBook.title &&
        existingBook.author === newBook.author
      );

      if (isDuplicate) {
        if (mergeStrategy === 'skipDuplicates') {
          skippedBooks.push(newBook);
          return;
        } else if (mergeStrategy === 'overwrite') {
          // 移除重复项，添加新项
          const index = mergedBooks.findIndex(book =>
            book.title === newBook.title && book.author === newBook.author
          );
          if (index !== -1) {
            mergedBooks.splice(index, 1);
          }
        }
      }

      mergedBooks.push(newBook);
      addedBooks.push(newBook);
    });

    return {
      mergedBooks,
      addedCount: addedBooks.length,
      skippedCount: skippedBooks.length,
      totalCount: mergedBooks.length
    };
  }

  // CSV 转义处理
  static escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  // 解析 CSV 行（处理引号和逗号）
  static parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // 双引号转义
          currentValue += '"';
          i++; // 跳过下一个引号
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue);
    return values;
  }
}

// Book类定义
class Book {
  constructor({
    id = Date.now().toString(),
    title = '',
    author = '',
    startDate = null,
    endDate = null,
    status = '未开始',
    notes = [],
    rating = null,
    tags = [],
    enableRating = false,
    folderId = 'all',
    currentProgress = 0,
    totalLength = 0,
    progressUnit = '章',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  } = {}) {
    this.id = id;
    this.title = title;
    this.author = author;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.notes = notes;
    this.rating = rating;
    this.tags = tags;
    this.enableRating = enableRating;
    this.folderId = folderId;
    this.currentProgress = currentProgress;
    this.totalLength = totalLength;
    this.progressUnit = progressUnit;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  validate() {
    const errors = [];
    if (!this.title || this.title.trim() === '') errors.push('书名不能为空');
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (start > end) errors.push('开始日期不能晚于结束日期');
    }
    if (!['未开始', '阅读中', '已读完'].includes(this.status)) {
      errors.push('状态必须是未开始、阅读中或已读完');
    }
    return { isValid: errors.length === 0, errors };
  }

  update(updates) {
    const allowedFields = ['title', 'author', 'startDate', 'endDate', 'status', 'notes', 'rating', 'tags', 'enableRating', 'folderId', 'currentProgress', 'totalLength', 'progressUnit'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) this[field] = updates[field];
    });
    this.updatedAt = new Date().toISOString();
  }

  getReadingDuration() {
    if (!this.startDate) return null;
    const start = new Date(this.startDate);
    const end = this.endDate ? new Date(this.endDate) : new Date();
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getFormattedStartDate() {
    return this.startDate ? new Date(this.startDate).toLocaleDateString('zh-CN') : '未开始';
  }

  getFormattedEndDate() {
    return this.endDate ? new Date(this.endDate).toLocaleDateString('zh-CN') : '进行中';
  }

  toJSON() {
    return {
      id: this.id, title: this.title, author: this.author,
      startDate: this.startDate, endDate: this.endDate,
      status: this.status, notes: this.notes, rating: this.rating,
      tags: this.tags, enableRating: this.enableRating,
      folderId: this.folderId,
      currentProgress: this.currentProgress,
      totalLength: this.totalLength,
      progressUnit: this.progressUnit,
      createdAt: this.createdAt, updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Book(json);
  }
}

// StorageService类定义
class StorageService {
  constructor() {
    this.books = [];
    this.folders = [];
    // 不在构造函数中调用 loadBooks，由外部控制加载时机
  }

  // 加载文件夹数据
  async loadFolders() {
    try {
      let foldersData;
      if (window.electronAPI && typeof window.electronAPI.loadFolders === 'function') {
        foldersData = await window.electronAPI.loadFolders();
      } else {
        const stored = localStorage.getItem('mybook_folders');
        foldersData = stored ? JSON.parse(stored) : this.getDefaultFolders();
      }
      this.folders = foldersData;
      return this.folders;
    } catch (error) {
      console.error('加载文件夹失败:', error);
      this.folders = this.getDefaultFolders();
      return this.folders;
    }
  }

  // 获取默认文件夹
  getDefaultFolders() {
    return [
      { id: 'all', name: '全部作品', createdAt: new Date().toISOString() }
    ];
  }

  // 获取所有文件夹
  getFolders() {
    return [...this.folders];
  }

  // 保存文件夹数据
  async saveFolders() {
    try {
      const foldersData = this.folders;
      if (window.electronAPI && typeof window.electronAPI.saveFolders === 'function') {
        await window.electronAPI.saveFolders(foldersData);
      } else {
        localStorage.setItem('mybook_folders', JSON.stringify(foldersData));
      }
      return true;
    } catch (error) {
      console.error('保存文件夹失败:', error);
      return false;
    }
  }

  getAllFolders() {
    return [...this.folders];
  }

  getBooksByFolder(folderId) {
    if (folderId === 'all') return this.books;
    return this.books.filter(book => book.folderId === folderId);
  }

  async loadBooks() {
    try {
      let booksData;
      console.log('StorageService: 检查 electronAPI...', window.electronAPI ? '可用' : '不可用');
      if (window.electronAPI && typeof window.electronAPI.loadBooks === 'function') {
        console.log('StorageService: 使用 electronAPI 加载...');
        booksData = await window.electronAPI.loadBooks();
      } else {
        console.log('StorageService: 使用 localStorage 加载...');
        const stored = localStorage.getItem('mybook_books');
        booksData = stored ? JSON.parse(stored) : [];
      }
      console.log('StorageService: 加载到的数据:', booksData);
      this.books = booksData.map(book => Book.fromJSON(book));
      return this.books;
    } catch (error) {
      console.error('加载书籍失败:', error);
      // 保留原有数据，不清空
      return this.books;
    }
  }

  async saveBooks() {
    try {
      const booksData = this.books.map(book => {
        const json = book.toJSON();
        console.log('StorageService: 单本书JSON:', JSON.stringify(json));
        return json;
      });
      console.log('StorageService: 保存书籍, 数量:', booksData.length);
      if (window.electronAPI && typeof window.electronAPI.saveBooks === 'function') {
        console.log('StorageService: 使用 electronAPI 保存...');
        const result = await window.electronAPI.saveBooks(booksData);
        console.log('StorageService: 保存结果:', result);
        console.log('StorageService: result.success =', result.success, typeof result.success);
        return result.success === true;
      } else {
        console.log('StorageService: 使用 localStorage 保存...');
        localStorage.setItem('mybook_books', JSON.stringify(booksData));
        return true;
      }
    } catch (error) {
      console.error('保存书籍失败:', error);
      return false;
    }
  }

  getAllBooks() { return [...this.books]; }
  getBookById(id) { return this.books.find(book => book.id === id); }

  async addBook(bookData) {
    const book = new Book(bookData);
    const validation = book.validate();
    if (!validation.isValid) throw new Error(validation.errors.join(', '));
    
    // 🌟 必须先放进数组！
    this.books.push(book);
    
    // 🌟 然后连同新书一起保存到硬盘
    const success = await this.saveBooks();
    
    if (!success) {
      // 如果硬盘保存失败，把刚刚放进去的书拿出来（数据回滚）
      this.books.pop();
      console.error('addBook: 保存失败，书籍已从内存中移除');
      throw new Error('本地保存失败，请检查文件权限或数据格式');
    }
    
    return book;
  }

  async updateBook(id, updates) {
    const book = this.getBookById(id);
    if (!book) throw new Error('书籍不存在');
    const originalBook = { ...book.toJSON() };
    try {
      book.update(updates);
      const validation = book.validate();
      if (!validation.isValid) {
        Object.assign(book, originalBook);
        throw new Error(validation.errors.join(', '));
      }
      // 先保存，保存成功后再更新
      const success = await this.saveBooks();
      if (!success) {
        Object.assign(book, originalBook);
        throw new Error('本地保存失败');
      }
      return book;
    } catch (error) {
      Object.assign(book, originalBook);
      throw error;
    }
  }

  async deleteBook(id) {
    const bookIndex = this.books.findIndex(book => book.id === id);
    if (bookIndex === -1) throw new Error('书籍不存在');
    const deletedBook = this.books[bookIndex];
    this.books.splice(bookIndex, 1);
    try {
      const success = await this.saveBooks();
      if (!success) {
        this.books.splice(bookIndex, 0, deletedBook);
        throw new Error('删除书籍失败');
      }
      return true;
    } catch (error) {
      this.books.splice(bookIndex, 0, deletedBook);
      throw error;
    }
  }

  searchBooks(query) {
    const searchTerm = query.toLowerCase();
    return this.books.filter(book =>
      book.title.toLowerCase().includes(searchTerm) ||
      (book.author && book.author.toLowerCase().includes(searchTerm))
    );
  }
}

// SortService类定义
class SortService {
  // 计算评分维度得分
  static calculateDimensionScore(book, dimension) {
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    const layerMap = {
      'rating.authorScore': '作者层面',
      'rating.textScore': '文本层面',
      'rating.readerScore': '读者层面'
    };

    const layer = layerMap[dimension];
    if (!layer || !profile || !profile[layer]) return 0;

    let score = 0;
    if (book.rating && book.rating.ratings) {
      profile[layer].forEach(m => {
        const rating = book.rating.ratings[m.name] || 0;
        score += rating * m.w;
      });
    }
    return score;
  }

  static sortBooks(books, field, order = 'asc') {
    if (!books || !Array.isArray(books)) return [];
    const sortedBooks = [...books];
    sortedBooks.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];

      switch (field) {
        case 'title':
        case 'author':
          valueA = valueA ? valueA.toLowerCase() : '';
          valueB = valueB ? valueB.toLowerCase() : '';
          break;
        case 'startDate':
        case 'endDate':
        case 'createdAt':
        case 'updatedAt':
          valueA = valueA ? new Date(valueA).getTime() : 0;
          valueB = valueB ? new Date(valueB).getTime() : 0;
          break;
        case 'status':
          const statusOrder = { '未开始': 0, '阅读中': 1, '已读完': 2 };
          valueA = statusOrder[valueA] || 0;
          valueB = statusOrder[valueB] || 0;
          break;
        case 'rating':
          valueA = a.rating && a.rating.totalScore ? a.rating.totalScore : 0;
          valueB = b.rating && b.rating.totalScore ? b.rating.totalScore : 0;
          break;
        case 'rating.authorScore':
        case 'rating.textScore':
        case 'rating.readerScore':
          valueA = this.calculateDimensionScore(a, field);
          valueB = this.calculateDimensionScore(b, field);
          break;
        case 'tags':
          valueA = a.tags && a.tags.length > 0 ? a.tags[0].toLowerCase() : '';
          valueB = b.tags && b.tags.length > 0 ? b.tags[0].toLowerCase() : '';
          break;
        case 'readingDuration':
          valueA = a.getReadingDuration ? (a.getReadingDuration() || 0) : 0;
          valueB = b.getReadingDuration ? (b.getReadingDuration() || 0) : 0;
          break;
      }

      if (valueA == null) return order === 'asc' ? 1 : -1;
      if (valueB == null) return order === 'asc' ? -1 : 1;
      if (valueA < valueB) return order === 'asc' ? -1 : 1;
      if (valueA > valueB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedBooks;
  }

  static applyCurrentSort(books, sortField, sortOrder) {
    return this.sortBooks(books, sortField, sortOrder);
  }
}

// FilterService类定义
class FilterService {
  // 按状态过滤（支持多选）
  static filterByStatus(books, statuses) {
    if (!statuses || statuses.length === 0) return books;
    return books.filter(book => statuses.includes(book.status));
  }

  // 按标签过滤（支持多选）
  // matchAll: true=必须包含所有选中标签, false=包含任一标签即可
  static filterByTags(books, tags, matchAll = false) {
    if (!tags || tags.length === 0) return books;

    return books.filter(book => {
      if (!book.tags || book.tags.length === 0) return false;

      if (matchAll) {
        return tags.every(tag => book.tags.includes(tag));
      } else {
        return tags.some(tag => book.tags.includes(tag));
      }
    });
  }

  // 按时间范围过滤
  static filterByDateRange(books, startDate, endDate, dateField = 'startDate') {
    if (!startDate && !endDate) return books;

    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    return books.filter(book => {
      if (!book[dateField]) return false;
      const bookDate = new Date(book[dateField]).getTime();
      return bookDate >= start && bookDate <= end;
    });
  }

  // 按评分范围过滤
  static filterByRatingRange(books, minScore, maxScore) {
    if (minScore === null && maxScore === null) return books;

    return books.filter(book => {
      const score = book.rating && book.rating.totalScore ? book.rating.totalScore : 0;
      if (minScore !== null && score < minScore) return false;
      if (maxScore !== null && score > maxScore) return false;
      return true;
    });
  }

  // 按阅读时长范围过滤（天）
  static filterByReadingDuration(books, minDays, maxDays) {
    if (minDays === null && maxDays === null) return books;

    return books.filter(book => {
      const duration = book.getReadingDuration ? (book.getReadingDuration() || 0) : 0;
      if (minDays !== null && duration < minDays) return false;
      if (maxDays !== null && duration > maxDays) return false;
      return true;
    });
  }

  // 按书名/作者关键词搜索
  static filterByKeyword(books, keyword) {
    if (!keyword || keyword.trim() === '') return books;

    const searchTerm = keyword.toLowerCase().trim();
    return books.filter(book => {
      const titleMatch = book.title && book.title.toLowerCase().includes(searchTerm);
      const authorMatch = book.author && book.author.toLowerCase().includes(searchTerm);
      return titleMatch || authorMatch;
    });
  }

  // 综合过滤
  static applyFilters(books, filterOptions) {
    let result = [...books];

    // 按关键词过滤
    if (filterOptions.keyword) {
      result = this.filterByKeyword(result, filterOptions.keyword);
    }

    // 按状态过滤
    if (filterOptions.status && filterOptions.status.length > 0) {
      result = this.filterByStatus(result, filterOptions.status);
    }

    // 按标签过滤
    if (filterOptions.tags && filterOptions.tags.length > 0) {
      result = this.filterByTags(result, filterOptions.tags, filterOptions.tagsMatchAll || false);
    }

    // 按时间范围过滤
    if (filterOptions.dateRange) {
      const { startDate, endDate, dateField = 'startDate' } = filterOptions.dateRange;
      if (startDate || endDate) {
        result = this.filterByDateRange(result, startDate, endDate, dateField);
      }
    }

    // 按评分范围过滤
    if (filterOptions.ratingRange) {
      const { min, max } = filterOptions.ratingRange;
      if (min !== null || max !== null) {
        result = this.filterByRatingRange(result, min, max);
      }
    }

    // 按阅读时长过滤
    if (filterOptions.durationRange) {
      const { minDays, maxDays } = filterOptions.durationRange;
      if (minDays !== null || maxDays !== null) {
        result = this.filterByReadingDuration(result, minDays, maxDays);
      }
    }

    return result;
  }

  // 获取所有可用的标签
  static getAllTags(books) {
    const tagSet = new Set();
    books.forEach(book => {
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }

  // 获取所有标签（按分类）
  static getAllTagsByCategory(books) {
    const formatSet = new Set();
    const genreSet = new Set();
    const unknownSet = new Set();

    // 题材标签列表
    const formatTags = ['文学', '小说', '轻小说', '网文', '纪实', '报告文学', '传记', '游戏剧情', 'Galgame', '电视剧', '动漫', '电影', '漫画', '技术文档', '学术论文'];
    // 类型标签列表
    const genreTags = ['科幻', '悬疑', '推理', '奇幻', '戏剧', '哲学', '心理', '社会', '恋爱', '治愈', '致郁', '赛博朋克', '硬核'];

    books.forEach(book => {
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach(tag => {
          if (formatTags.includes(tag)) {
            formatSet.add(tag);
          } else if (genreTags.includes(tag)) {
            genreSet.add(tag);
          } else {
            unknownSet.add(tag); // 自定义标签或其他
          }
        });
      }
    });

    return {
      format: Array.from(formatSet).sort(),
      genre: Array.from(genreSet).sort(),
      unknown: Array.from(unknownSet).sort()
    };
  }
}

// StatsService类定义（统计服务）
class StatsService {
  /**
   * 构造函数
   * @param {StorageService} storageService 存储服务实例
   */
  constructor(storageService) {
    this.storageService = storageService;
  }

  /**
   * 获取所有书籍的统计概览
   * @param {string} folderId - 文件夹ID，传入则只统计该文件夹下的书籍
   * @returns {Object} 统计概览数据
   */
  getOverviewStats(folderId = null) {
    let books = this.storageService.getAllBooks();

    // 根据文件夹过滤
    if (folderId && folderId !== 'all') {
      books = books.filter(book => book.folderId === folderId);
    }

    return {
      totalBooks: books.length,
      readingStats: this.getReadingStatusStats(books),
      ratingStats: this.getRatingStats(books),
      monthlyStats: this.getMonthlyStats(books),
      tagStats: this.getTagStats(books),
      readingTimeStats: this.getReadingTimeStats(books)
    };
  }

  /**
   * 获取阅读状态统计
   * @param {Array} books 书籍列表
   * @returns {Object} 阅读状态统计
   */
  getReadingStatusStats(books) {
    const stats = {
      '未开始': 0,
      '阅读中': 0,
      '已读完': 0
    };

    books.forEach(book => {
      if (stats.hasOwnProperty(book.status)) {
        stats[book.status]++;
      }
    });

    return {
      labels: Object.keys(stats),
      data: Object.values(stats),
      colors: ['#FF1744', '#FFB300', '#2E7D32'] // 红色系(金读完)、金色系(阅读中)、绿色系(未开始)
    };
  }

  /**
   * 获取评分统计
   * @param {Array} books 书籍列表
   * @returns {Object} 评分统计
   */
  getRatingStats(books) {
    // 0-100 分制划分为5个区间
    const ratingRanges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    };

    books.forEach(book => {
      // 只统计已启用评分且有评分的书籍
      if (book.rating && book.enableRating) {
        const rating = book.rating.totalScore || 0;
        if (rating >= 0 && rating <= 20) ratingRanges['0-20']++;
        else if (rating > 20 && rating <= 40) ratingRanges['21-40']++;
        else if (rating > 40 && rating <= 60) ratingRanges['41-60']++;
        else if (rating > 60 && rating <= 80) ratingRanges['61-80']++;
        else if (rating > 80 && rating <= 100) ratingRanges['81-100']++;
      }
    });

    return {
      labels: Object.keys(ratingRanges),
      data: Object.values(ratingRanges),
      colors: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'] // 红色到绿色渐变
    };
  }

  /**
   * 获取月度统计
   * @param {Array} books 书籍列表
   * @returns {Object} 月度统计
   */
  getMonthlyStats(books) {
    const monthlyData = {};
    const currentYear = new Date().getFullYear();

    // 初始化最近12个月的数据
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[yearMonth] = 0;
    }

    // 统计每月完成的书籍
    books.forEach(book => {
      if (book.status === '已读完' && book.endDate) {
        try {
          const endDate = new Date(book.endDate);
          const yearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

          if (monthlyData.hasOwnProperty(yearMonth)) {
            monthlyData[yearMonth]++;
          }
        } catch (error) {
          console.warn('解析结束日期失败:', book.endDate);
        }
      }
    });

    const labels = Object.keys(monthlyData);
    const data = Object.values(monthlyData);

    return {
      labels,
      data,
      colors: labels.map((_, index) => {
        // 渐变色：从浅蓝到深蓝
        const hue = 210; // 蓝色
        const saturation = 70;
        const lightness = 50 + (index * 20 / labels.length);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      })
    };
  }

  /**
   * 获取标签统计
   * @param {Array} books 书籍列表
   * @param {number} limit 限制返回的标签数量
   * @returns {Object} 标签统计
   */
  getTagStats(books, limit = 10) {
    const tagCounts = {};

    books.forEach(book => {
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // 按使用频率排序
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return {
      labels: sortedTags.map(([tag]) => tag),
      data: sortedTags.map(([, count]) => count),
      colors: this.generateColors(sortedTags.length)
    };
  }

  /**
   * 获取阅读时间统计
   * @param {Array} books 书籍列表
   * @returns {Object} 阅读时间统计
   */
  getReadingTimeStats(books) {
    const timeRanges = {
      '1周内': 0,
      '1个月内': 0,
      '3个月内': 0,
      '6个月内': 0,
      '1年内': 0,
      '1年以上': 0
    };

    const now = new Date();

    books.forEach(book => {
      if (book.startDate) {
        try {
          const startDate = new Date(book.startDate);
          const diffTime = Math.abs(now - startDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 7) timeRanges['1周内']++;
          else if (diffDays <= 30) timeRanges['1个月内']++;
          else if (diffDays <= 90) timeRanges['3个月内']++;
          else if (diffDays <= 180) timeRanges['6个月内']++;
          else if (diffDays <= 365) timeRanges['1年内']++;
          else timeRanges['1年以上']++;
        } catch (error) {
          console.warn('解析开始日期失败:', book.startDate);
        }
      }
    });

    return {
      labels: Object.keys(timeRanges),
      data: Object.values(timeRanges),
      colors: this.generateColors(Object.keys(timeRanges).length)
    };
  }

  /**
   * 生成颜色数组
   * @param {number} count 颜色数量
   * @returns {Array} 颜色数组
   */
  generateColors(count) {
    const colors = [];
    const hueStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const hue = (i * hueStep) % 360;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }

    return colors;
  }

  /**
   * 获取详细的统计报告
   * @returns {Object} 详细统计报告
   */
  getDetailedReport(folderId = null) {
    let books = this.storageService.getAllBooks();

    // 根据文件夹过滤
    if (folderId && folderId !== 'all') {
      books = books.filter(book => book.folderId === folderId);
    }

    const completedBooks = books.filter(book => book.status === '已读完');

    return {
      totalBooks: books.length,
      completedBooks: completedBooks.length,
      readingBooks: books.filter(book => book.status === '阅读中').length,
      unreadBooks: books.filter(book => book.status === '未开始').length,

      averageRating: this.calculateAverageRating(books),
      averageReadingTime: this.calculateAverageReadingTime(completedBooks),

      mostUsedTags: this.getTagStats(books, 5),
      readingTrend: this.getReadingTrend(completedBooks),

      recentActivity: this.getRecentActivity(books)
    };
  }

  /**
   * 计算平均评分
   * @param {Array} books 书籍列表
   * @returns {number} 平均评分（0-100分制）
   */
  calculateAverageRating(books) {
    // 只统计已启用评分且有评分的书籍
    const ratedBooks = books.filter(book =>
      book.enableRating &&
      book.rating &&
      book.rating.totalScore > 0
    );

    if (ratedBooks.length === 0) return 0;

    const totalRating = ratedBooks.reduce((sum, book) => {
      const rating = book.rating.totalScore || 0;
      return sum + rating;
    }, 0);

    return parseFloat((totalRating / ratedBooks.length).toFixed(1));
  }

  /**
   * 计算平均阅读时间
   * @param {Array} books 已完成的书籍列表
   * @returns {number} 平均阅读天数
   */
  calculateAverageReadingTime(books) {
    const booksWithDates = books.filter(book =>
      book.startDate && book.endDate
    );

    if (booksWithDates.length === 0) return 0;

    const totalDays = booksWithDates.reduce((sum, book) => {
      try {
        const startDate = new Date(book.startDate);
        const endDate = new Date(book.endDate);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      } catch (error) {
        return sum;
      }
    }, 0);

    return Math.round(totalDays / booksWithDates.length);
  }

  /**
   * 获取阅读趋势
   * @param {Array} books 已完成的书籍列表
   * @returns {Object} 阅读趋势数据
   */
  getReadingTrend(books) {
    const monthlyTrend = {};

    books.forEach(book => {
      if (book.endDate) {
        try {
          const endDate = new Date(book.endDate);
          const yearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
          monthlyTrend[yearMonth] = (monthlyTrend[yearMonth] || 0) + 1;
        } catch (error) {
          // 忽略无效日期
        }
      }
    });

    return monthlyTrend;
  }

  /**
   * 获取最近活动
   * @param {Array} books 书籍列表
   * @param {number} limit 限制返回的数量
   * @returns {Array} 最近活动列表
   */
  getRecentActivity(books, limit = 10) {
    const activities = [];

    books.forEach(book => {
      if (book.endDate) {
        activities.push({
          type: 'completed',
          bookTitle: book.title,
          date: book.endDate,
          rating: book.rating
        });
      } else if (book.startDate) {
        activities.push({
          type: 'started',
          bookTitle: book.title,
          date: book.startDate
        });
      }
    });

    // 按日期排序（最近的在前）
    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
}

// ChartManager类定义（图表管理器）
class ChartManager {
  /**
   * 构造函数
   */
  constructor() {
    this.charts = new Map();
  }

  /**
   * 创建饼图
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {Object} data 图表数据
   * @param {Object} options 图表选项
   * @returns {Chart} Chart.js实例
   */
  createPieChart(canvas, data, options = {}) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 12
            },
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    const chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.data,
          backgroundColor: data.colors,
          borderColor: '#fff',
          borderWidth: 2,
          hoverOffset: 15
        }]
      },
      options: { ...defaultOptions, ...options }
    });

    this.charts.set(canvas.id, chart);
    return chart;
  }

  /**
   * 创建柱状图
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {Object} data 图表数据
   * @param {Object} options 图表选项
   * @returns {Chart} Chart.js实例
   */
  createBarChart(canvas, data, options = {}) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    };

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.label || '数量',
          data: data.data,
          backgroundColor: data.colors,
          borderColor: data.colors.map(color => this.darkenColor(color, 20)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: { ...defaultOptions, ...options }
    });

    this.charts.set(canvas.id, chart);
    return chart;
  }

  /**
   * 创建折线图
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {Object} data 图表数据
   * @param {Object} options 图表选项
   * @returns {Chart} Chart.js实例
   */
  createLineChart(canvas, data, options = {}) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      elements: {
        line: {
          tension: 0.4
        },
        point: {
          radius: 5,
          hoverRadius: 8
        }
      }
    };

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.label || '数量',
          data: data.data,
          backgroundColor: this.lightenColor(data.color || '#3498db', 30),
          borderColor: data.color || '#3498db',
          borderWidth: 3,
          fill: true
        }]
      },
      options: { ...defaultOptions, ...options }
    });

    this.charts.set(canvas.id, chart);
    return chart;
  }

  /**
   * 创建环形图
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {Object} data 图表数据
   * @param {Object} options 图表选项
   * @returns {Chart} Chart.js实例
   */
  createDoughnutChart(canvas, data, options = {}) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 12
            },
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.data,
          backgroundColor: data.colors,
          borderColor: '#fff',
          borderWidth: 2,
          hoverOffset: 15
        }]
      },
      options: { ...defaultOptions, ...options }
    });

    this.charts.set(canvas.id, chart);
    return chart;
  }

  /**
   * 创建水平柱状图
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {Object} data 图表数据
   * @param {Object} options 图表选项
   * @returns {Chart} Chart.js实例
   */
  createHorizontalBarChart(canvas, data, options = {}) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    };

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.label || '数量',
          data: data.data,
          backgroundColor: data.colors,
          borderColor: data.colors.map(color => this.darkenColor(color, 20)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: { ...defaultOptions, ...options }
    });

    this.charts.set(canvas.id, chart);
    return chart;
  }

  /**
   * 更新图表数据
   * @param {string} chartId 图表ID
   * @param {Object} newData 新数据
   */
  updateChart(chartId, newData) {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.data.labels = newData.labels;
      chart.data.datasets[0].data = newData.data;
      if (newData.colors) {
        chart.data.datasets[0].backgroundColor = newData.colors;
      }
      chart.update();
    }
  }

  /**
   * 销毁图表
   * @param {string} chartId 图表ID
   */
  destroyChart(chartId) {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.destroy();
      this.charts.delete(chartId);
    }
  }

  /**
   * 销毁所有图表
   */
  destroyAllCharts() {
    this.charts.forEach((chart, chartId) => {
      chart.destroy();
    });
    this.charts.clear();
  }

  /**
   * 使颜色变暗
   * @param {string} color 颜色值
   * @param {number} percent 变暗百分比
   * @returns {string} 变暗后的颜色
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;

    return '#' + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }

  /**
   * 使颜色变亮
   * @param {string} color 颜色值
   * @param {number} percent 变亮百分比
   * @returns {string} 变亮后的颜色
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (
      0x1000000 +
      (R > 255 ? 255 : R) * 0x10000 +
      (G > 255 ? 255 : G) * 0x100 +
      (B > 255 ? 255 : B)
    ).toString(16).slice(1);
  }

  /**
   * 调整颜色透明度
   * @param {string} color 颜色值
   * @param {number} alpha 透明度 (0-1)
   * @returns {string} 调整后的颜色
   */
  adjustAlpha(color, alpha) {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return color;
  }
}

// 主渲染进程逻辑
class BookApp {
  constructor() {
    // 构造函数为空，初始化在 init() 方法中完成
  }

  async init() {
    // 添加快捷键 Ctrl+Shift+I 打开开发者工具
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (window.electronAPI) {
          window.electronAPI.openDevTools();
        } else {
          // 浏览器模式
          console.log('浏览器模式，请按 F12 打开开发者工具');
        }
      }
      // F12 快捷键
      if (e.key === 'F12') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.openDevTools) {
          window.electronAPI.openDevTools();
        } else if (window.openDevTools) {
          window.openDevTools();
        } else {
          // 尝试浏览器方式
          console.log('开发者工具');
        }
      }
    });

    this.storageService = new StorageService();
    this.currentSortField = 'title';
    this.currentSortOrder = 'asc';
    this.isEditing = false;
    this.currentBookId = null;
    this.currentFolderId = 'all';

    // 日记相关状态
    this.journals = [];
    this.currentView = 'knowledge'; // knowledge | journal
    this.currentMoodFilter = null; // 当前心情筛选
    this.currentJournalToDelete = null; // 待删除的日记ID
    this.statsCurrentPage = 0; // 统计模态框当前页码
    this._statsWheelHandler = null; // 滚轮事件处理函数

    // 过滤相关状态
    this.activeFilters = {
      status: [],
      tags: [],
      dateRange: null,
      ratingRange: null,
      durationRange: null
    };
    this.isFilterPanelOpen = false;

    this.initializeElements();
    this.bindEvents();
    this.initTheme();
    await this.storageService.loadFolders();
    this.renderFolders();
    await this.loadBooks();
    await this.loadJournals();
  }

  initializeElements() {
    this.bookForm = document.getElementById('bookForm');
    this.bookIdInput = document.getElementById('bookId');
    this.titleInput = document.getElementById('title');
    this.authorInput = document.getElementById('author');
    this.startDateInput = document.getElementById('startDate');
    this.endDateInput = document.getElementById('endDate');
    this.statusSelect = document.getElementById('status');
    this.currentProgressInput = document.getElementById('currentProgress');
    this.totalLengthInput = document.getElementById('totalLength');
    this.progressUnitSelect = document.getElementById('progressUnit');
    this.enableRatingCheckbox = document.getElementById('enableRating');

    // 标签相关元素
    this.customTagInput = document.getElementById('customTagInput');
    this.selectedTagsContainer = document.getElementById('selectedTagsContainer');
    this.formatTagsContainer = document.getElementById('formatTags');
    this.genreTagsContainer = document.getElementById('genreTags');
    this.currentTags = []; // 当前表单中的标签数组（已选标签）
    // 题材标签列表（单选）
    this.formatTags = ['文学', '小说', '轻小说', '网文', '纪实', '报告文学', '传记', '游戏剧情', 'Galgame', '电视剧', '动漫', '电影', '漫画', '技术文档', '学术论文'];
    // 类型标签列表（多选）
    this.genreTags = ['科幻', '悬疑', '推理', '奇幻', '戏剧', '哲学', '心理', '社会', '恋爱', '治愈', '致郁', '赛博朋克', '硬核'];

    this.addBookBtn = document.getElementById('addBookBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.cancelBtn = document.getElementById('cancelBtn');
    this.sortFieldSelect = document.getElementById('sortField');
    this.sortOrderSelect = document.getElementById('sortOrder');

    this.bookListContainer = document.getElementById('bookListContainer');
    this.bookFormSection = document.getElementById('bookFormSection');
    this.emptyState = document.getElementById('emptyState');

    this.bookCountElement = document.getElementById('bookCount');
    this.statusMessageElement = document.getElementById('statusMessage');

    this.deleteModal = document.getElementById('deleteModal');
    this.overlay = document.getElementById('overlay');
    this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    this.deleteMessage = document.getElementById('deleteMessage');
    this.bookToDelete = null;

    this.notesModal = document.getElementById('notesModal');
    this.closeNotesModalBtn = document.getElementById('closeNotesModalBtn');
    this.currentBookTitle = document.getElementById('currentBookTitle');
    this.currentBookAuthor = document.getElementById('currentBookAuthor');
    this.notesListContainer = document.getElementById('notesListContainer');
    this.notesCount = document.getElementById('notesCount');
    this.importNotesBtn = document.getElementById('importNotesBtn');
    this.newNoteContent = document.getElementById('newNoteContent');
    this.saveNoteBtn = document.getElementById('saveNoteBtn');
    this.currentNotesBookId = null;
    this.noteSearchInput = document.getElementById('noteSearchInput');
    this.editingNoteId = null;

    // 评分模态框相关元素
    this.ratingModal = document.getElementById('ratingModal');
    this.ratingBookTitle = document.getElementById('ratingBookTitle');
    this.ratingTotalScore = document.getElementById('ratingTotalScore');
    this.ratingMetrics = document.getElementById('ratingMetrics');
    this.currentRatingBookId = null;
    this.currentRatings = {}; // 存储当前评分数据
    this.ratingChart = null; // 图表实例
    this.resizeHandler = null; // 存储窗口 resize 监听器引用
    this.searchDebounceTimer = null; // 搜索防抖定时器

    // 过滤面板相关元素
    this.toggleFilterBtn = document.getElementById('toggleFilterBtn');
    this.filterPanel = document.getElementById('filterPanel');
    this.closeFilterPanelBtn = document.getElementById('closeFilterPanelBtn');
    this.applyFilterBtn = document.getElementById('applyFilterBtn');
    this.clearFilterBtn = document.getElementById('clearFilterBtn');
    this.activeFilterCount = document.getElementById('activeFilterCount');
    this.filterTagsContainer = document.getElementById('filterTagsContainer');

    // 导入/导出相关元素
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.exportModal = document.getElementById('exportModal');
    this.importModal = document.getElementById('importModal');
    this.importFile = document.getElementById('importFile');
    this.fileDropArea = document.getElementById('fileDropArea');

    // 统计相关元素
    this.statsBtn = document.getElementById('statsBtn');
    this.statsModal = document.getElementById('statsModal');

    // 统计服务
    this.statsService = new StatsService(this.storageService);

    // 新增元素
    this.globalSearchInput = document.getElementById('globalSearch');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.toastContainer = document.getElementById('toastContainer');
    this.contextMenu = document.getElementById('contextMenu');
    this.contextMenuTarget = null;

    // 键盘快捷键状态
    this.keyboardShortcuts = new Map();
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.chartManager = new ChartManager();
    this.activeCharts = new Map();
    this.importPreview = document.getElementById('importPreview');
    this.previewContent = document.getElementById('previewContent');
    this.importMerge = document.getElementById('importMerge');
    this.confirmImportBtn = document.getElementById('confirmImportBtn');
  }

  bindEvents() {
    // 滚动监听 - Header 粘性效果增强
    window.addEventListener('scroll', () => {
      const header = document.querySelector('.app-header');
      if (header) {
        if (window.scrollY > 10) {
          header.classList.add('stuck');
        } else {
          header.classList.remove('stuck');
        }
      }
    });

    this.bookForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.addBookBtn.addEventListener('click', () => this.showBookForm());
    this.refreshBtn.addEventListener('click', () => this.loadBooks());
    this.cancelBtn.addEventListener('click', () => this.hideBookForm());

    // 标签输入事件 - 自定义标签输入框回车添加
    if (this.customTagInput) {
      this.customTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tagValue = this.customTagInput.value.trim();
          if (tagValue) {
            this.addTag(tagValue);
            this.customTagInput.value = '';
          }
        }
      });
    }

    // 过滤面板事件
    this.toggleFilterBtn.addEventListener('click', () => this.toggleFilterPanel());
    this.closeFilterPanelBtn.addEventListener('click', () => this.hideFilterPanel());
    this.applyFilterBtn.addEventListener('click', () => this.applyFilters());
    this.clearFilterBtn.addEventListener('click', () => this.clearFilters());

    // 导入/导出事件
    this.exportBtn.addEventListener('click', () => this.showExportModal());
    this.importBtn.addEventListener('click', () => this.showImportModal());
    this.importFile.addEventListener('change', (e) => this.handleFileSelect(e));

    // 统计事件
    this.statsBtn.addEventListener('click', () => this.showStatsModal());

    // 评分对比事件
    this.compareRatingBtn = document.getElementById('compareRatingBtn');
    this.compareRatingModal = document.getElementById('compareRatingModal');
    this.compareBookList = document.getElementById('compareBookList');
    this.compareResults = document.getElementById('compareResults');
    this.compareRatingBtn.addEventListener('click', () => this.showCompareModal());

    // 日记表单事件
    const journalForm = document.getElementById('journalForm');
    journalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveJournalFromForm();
    });

    // 心情选择器事件
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('journalMood').value = btn.dataset.mood;
      });
    });

    // 心情筛选按钮事件（侧边栏）
    document.querySelectorAll('.mood-filter .mood-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const mood = btn.dataset.mood;
        if (this.currentMoodFilter === mood) {
          // 取消筛选
          this.currentMoodFilter = null;
          btn.classList.remove('active');
        } else {
          // 应用筛选
          this.currentMoodFilter = mood;
          document.querySelectorAll('.mood-filter .mood-tag').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        this.renderJournalList();
      });
    });

    // 日记统计按钮事件
    const journalStatsBtn = document.getElementById('journalStatsBtn');
    if (journalStatsBtn) {
      journalStatsBtn.addEventListener('click', () => this.showJournalStats());
    }

    this.fileDropArea.addEventListener('click', () => this.importFile.click());
    this.fileDropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.fileDropArea.addEventListener('drop', (e) => this.handleFileDrop(e));

    this.sortFieldSelect.addEventListener('change', (e) => {
      this.currentSortField = e.target.value;
      this.renderBooks();
    });

    this.sortOrderSelect.addEventListener('change', (e) => {
      this.currentSortOrder = e.target.value;
      this.renderBooks();
    });

    this.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
    this.cancelDeleteBtn.addEventListener('click', () => this.hideDeleteModal());

    // 日记删除确认按钮事件绑定
    const confirmJournalDeleteBtn = document.getElementById('confirmJournalDeleteBtn');
    const cancelJournalDeleteBtn = document.getElementById('cancelJournalDeleteBtn');
    if (confirmJournalDeleteBtn) {
      confirmJournalDeleteBtn.addEventListener('click', () => this.confirmDeleteJournal());
    }
    if (cancelJournalDeleteBtn) {
      cancelJournalDeleteBtn.addEventListener('click', () => this.hideJournalDeleteModal());
    }

    // 日记阅读模态框关闭按钮事件绑定
    const closeJournalViewBtn = document.getElementById('closeJournalViewBtn');
    if (closeJournalViewBtn) {
      closeJournalViewBtn.addEventListener('click', () => this.closeJournalViewModal());
    }

    this.closeNotesModalBtn.addEventListener('click', () => this.hideNotesModal());
    this.importNotesBtn.addEventListener('click', () => this.importNotes());
    this.noteSearchInput.addEventListener('input', () => this.handleNoteSearch());
    this.saveNoteBtn.addEventListener('click', () => this.saveNote());
    // 点击overlay时关闭所有模态框
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hideNotesModal();
        this.closeJournalModal();
        this.closeJournalStatsModal();
        this.hideJournalDeleteModal();
        this.closeJournalViewModal();
        this.hideFilterPanel();
        this.hideCompareModal();
        // 隐藏overlay
        this.overlay.style.display = 'none';
      }
    });

    this.startDateInput.addEventListener('change', () => this.handleDateChange());
    this.endDateInput.addEventListener('change', () => this.handleDateChange());
    this.statusSelect.addEventListener('change', () => this.handleStatusChange());
    this.totalLengthInput.addEventListener('input', () => this.handleTotalLengthChange());

    // 新增事件监听器
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.globalSearchInput.addEventListener('input', () => this.handleGlobalSearch());
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
    document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));

    // 文件夹事件绑定
    this.initFolderEvents();
  }

  // 初始化文件夹相关事件
  initFolderEvents() {
    // 新建文件夹按钮
    const addFolderBtn = document.querySelector('.sidebar-add-btn');
    if (addFolderBtn) {
      addFolderBtn.addEventListener('click', () => this.createFolder());
    }

    // 右键删除文件夹
    document.addEventListener('contextmenu', (e) => {
      const folderItem = e.target.closest('.sidebar-item');
      if (folderItem && !folderItem.classList.contains('default')) {
        e.preventDefault();
        const folderId = folderItem.dataset.folderId;
        this.deleteFolder(folderId);
      }
    });
  }

  // 新建文件夹 - 显示模态框
  createFolder() {
    const folderModal = document.getElementById('folderModal');
    const folderNameInput = document.getElementById('folderNameInput');
    folderNameInput.value = '';
    folderModal.style.display = 'flex';

    // 隐藏 overlay，避免遮挡输入框
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }

    folderNameInput.focus();
  }

  // 确认创建文件夹
  async confirmCreateFolder() {
    const folderNameInput = document.getElementById('folderNameInput');
    const name = folderNameInput.value.trim();

    if (!name) {
      this.showToast('请输入文件夹名称', 'warning');
      return;
    }

    const newFolder = {
      id: 'folder_' + Date.now(),
      name: name,
      createdAt: new Date().toISOString()
    };

    this.storageService.folders.push(newFolder);
    await this.storageService.saveFolders();
    this.renderFolders();
    this.showToast('文件夹创建成功', 'success');

    // 关闭模态框
    document.getElementById('folderModal').style.display = 'none';
  }

  // 关闭文件夹模态框
  closeFolderModal() {
    document.getElementById('folderModal').style.display = 'none';
    // 隐藏 overlay
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  // 删除文件夹
  async deleteFolder(folderId) {
    if (folderId === 'all') return;

    // 获取该文件夹下的作品数量
    const booksInFolder = this.storageService.getBooksByFolder(folderId);
    let confirmMessage = `确定要删除文件夹"${this.storageService.folders.find(f => f.id === folderId)?.name}"吗？`;

    if (booksInFolder.length > 0) {
      confirmMessage += `\n\n该文件夹下有 ${booksInFolder.length} 部作品，删除后这些作品将被移至"未分类"。`;
    }

    if (!confirm(confirmMessage)) return;

    // 将该文件夹下的作品移至未分类
    const allBooks = this.storageService.getAllBooks();
    for (const book of allBooks) {
      if (book.folderId === folderId) {
        await this.storageService.updateBook(book.id, { folderId: 'uncategorized' });
      }
    }

    // 删除文件夹
    this.storageService.folders = this.storageService.folders.filter(f => f.id !== folderId);
    await this.storageService.saveFolders();

    // 如果当前选中的文件夹被删除，切换到全部作品
    if (this.currentFolderId === folderId) {
      this.currentFolderId = 'all';
    }

    this.renderFolders();
    this.loadBooks();
    this.showToast('文件夹已删除', 'success');
  }

  async loadBooks() {
    this.showLoading();
    console.log('开始加载书籍...');
    console.log('electronAPI 可用:', !!window.electronAPI);
    try {
      const books = await this.storageService.loadBooks();
      console.log('书籍加载完成, 数量:', books.length);
      this.renderBooks();
      this.renderFolders();
      this.updateBookCount();
    } catch (error) {
      console.error('加载书籍失败:', error);
      this.showToast('加载书籍失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 加载日记
  async loadJournals() {
    try {
      let journalsData;
      if (window.electronAPI && typeof window.electronAPI.loadJournals === 'function') {
        journalsData = await window.electronAPI.loadJournals();
      } else {
        const stored = localStorage.getItem('mybook_journals');
        journalsData = stored ? JSON.parse(stored) : [];
      }
      this.journals = journalsData.map(j => JournalEntry.fromJSON(j));
      return this.journals;
    } catch (error) {
      console.error('加载日记失败:', error);
      this.journals = [];
      return [];
    }
  }

  // 保存日记
  async saveJournals() {
    try {
      const data = this.journals.map(j => j.toJSON());
      if (window.electronAPI && typeof window.electronAPI.saveJournals === 'function') {
        await window.electronAPI.saveJournals(data);
      } else {
        localStorage.setItem('mybook_journals', JSON.stringify(data));
      }
      return true;
    } catch (error) {
      console.error('保存日记失败:', error);
      return false;
    }
  }

  // 视图切换
  switchView(viewName) {
    const bookSection = document.getElementById('bookListSection');
    const journalSection = document.getElementById('journalContainer');
    const viewKnowledge = document.getElementById('viewKnowledge');
    const viewJournal = document.getElementById('viewJournal');
    const kbSidebar = document.querySelector('.kb-sidebar');
    const journalSidebar = document.getElementById('journalSidebar');
    const kbToolbar = document.querySelector('.kb-toolbar');
    const journalToolbar = document.querySelector('.journal-toolbar');

    console.log('switchView called:', viewName, { kbSidebar, journalSidebar, kbToolbar, journalToolbar });

    this.currentView = viewName;

    if (viewName === 'journal') {
      // 隐藏知识库模块
      if (kbSidebar) kbSidebar.style.display = 'none';
      if (kbToolbar) kbToolbar.style.display = 'none';
      if (bookSection) bookSection.style.display = 'none';

      // 显示日记模块
      if (journalSidebar) journalSidebar.style.display = 'block';
      if (journalToolbar) journalToolbar.style.display = 'flex';
      if (journalSection) journalSection.style.display = 'block';

      // 更新切换按钮状态
      if (viewKnowledge) viewKnowledge.classList.remove('active');
      if (viewJournal) viewJournal.classList.add('active');

      this.renderJournalList();
    } else {
      // 隐藏日记模块
      if (journalSidebar) journalSidebar.style.display = 'none';
      if (journalToolbar) journalToolbar.style.display = 'none';
      if (journalSection) journalSection.style.display = 'none';

      // 显示知识库模块
      if (kbSidebar) kbSidebar.style.display = 'block';
      if (kbToolbar) kbToolbar.style.display = 'flex';
      if (bookSection) bookSection.style.display = 'block';

      // 更新切换按钮状态
      if (viewJournal) viewJournal.classList.remove('active');
      if (viewKnowledge) viewKnowledge.classList.add('active');
    }
  }

  // 渲染日记列表
  renderJournalList() {
    const container = document.getElementById('journalList');
    const emptyState = document.getElementById('journalEmptyState');

    console.log('renderJournalList called, journals:', this.journals.length, 'moodFilter:', this.currentMoodFilter);

    // 强制确保container存在
    if (!container) {
      console.error('journalList container not found');
      return;
    }

    // 如果没有日记数据，直接显示空状态
    if (!this.journals || this.journals.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      return;
    }

    // 按心情严格筛选
    let filteredJournals = this.journals;
    if (this.currentMoodFilter) {
      filteredJournals = this.journals.filter(j => j.mood === this.currentMoodFilter);
      console.log('Filtered journals:', filteredJournals.length);
    }

    // 筛选后为空，显示空状态提示
    if (!filteredJournals || filteredJournals.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      return;
    }

    // 隐藏空状态元素
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // 按日期倒序排列
    const sorted = [...filteredJournals].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(journal => {
      const date = new Date(journal.date);
      const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${this.getWeekday(date)}`;
      const moodEmoji = this.getMoodEmoji(journal.mood);

      return `
        <div class="journal-card" data-id="${journal.id}" onclick="openJournalView('${journal.id}')">
          <div class="journal-header">
            <span class="journal-date">${dateStr}</span>
            <span class="journal-mood ${journal.mood}">${moodEmoji} ${journal.mood}</span>
          </div>
          <div class="journal-preview">${this.escapeHtml(journal.content)}</div>
          <div class="journal-actions">
            <button onclick="event.stopPropagation(); editJournal('${journal.id}')"><i class="fas fa-edit"></i> 编辑</button>
            <button class="delete" onclick="event.stopPropagation(); deleteJournal('${journal.id}')"><i class="fas fa-trash"></i> 删除</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 获取星期几
  getWeekday(date) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  }

  // 获取心情Emoji
  getMoodEmoji(mood) {
    const emojis = {
      '完美': '🌟', '充实': '😊', '平淡': '😐',
      '疲惫': '😮‍💨', '糟糕': '🌧️'
    };
    return emojis[mood] || '😐';
  }

  // 显示日记统计
  showJournalStats() {
    const total = this.journals.length;
    if (total === 0) {
      this.showToast('暂无日记记录', 'warning');
      return;
    }

    // 统计各心情数量
    const moodCounts = {};
    let totalChars = 0;
    this.journals.forEach(j => {
      if (j.mood) {
        moodCounts[j.mood] = (moodCounts[j.mood] || 0) + 1;
      }
      if (j.content) {
        totalChars += j.content.length;
      }
    });

    // 找出最常心情
    let maxMood = null;
    let maxCount = 0;
    Object.entries(moodCounts).forEach(([mood, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxMood = mood;
      }
    });

    // 更新DOM元素
    document.getElementById('journalTotalDays').textContent = total;
    document.getElementById('journalTotalChars').textContent = totalChars;
    document.getElementById('journalTopMood').textContent = this.getMoodEmoji(maxMood) + ' ' + maxMood;

    // 显示模态框
    const modal = document.getElementById('journalStatsModal');
    modal.style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';

    // 重置到第一页
    this.resetStatsPage();

    // 绑定滚轮切换事件
    this.bindStatsWheelEvent();

    // ===== 修复：确保模态框完全显示后再渲染图表 =====
    // 饼图渲染 - 延迟150ms确保DOM已撑开
    setTimeout(() => {
      const chartDom = document.getElementById('journalMoodChart');
      if (!chartDom || this.journalStatsChart) return;

      // 获取当前心情统计数据（确保在正确作用域内）
      const currentMoodCounts = {};
      let currentTotalChars = 0;
      this.journals.forEach(j => {
        if (j.mood) {
          currentMoodCounts[j.mood] = (currentMoodCounts[j.mood] || 0) + 1;
        }
        if (j.content) {
          currentTotalChars += j.content.length;
        }
      });

      const moodColors = {
        '完美': '#f1c40f',
        '充实': '#27ae60',
        '平淡': '#95a5a6',
        '疲惫': '#e67e22',
        '糟糕': '#e74c3c'
      };

      const chartData = Object.entries(currentMoodCounts).map(([mood, count]) => ({
        name: this.getMoodEmoji(mood) + ' ' + mood,
        value: count,
        itemStyle: { color: moodColors[mood] || '#999' }
      }));

      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c}次 ({d}%)'
        },
        legend: {
          bottom: 0,
          data: chartData.map(d => d.name)
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: chartData,
          label: {
            show: true,
            formatter: '{b}: {c}'
          }
        }]
      };

      this.journalStatsChart = echarts.init(chartDom);
      this.journalStatsChart.setOption(option);

      // 修复：强制resize确保在display:block后能正确渲染
      this.journalStatsChart.resize();
    }, 100);

    // 渲染热力图 - 延迟350ms确保模态框完全显示并过渡动画完成
    // 保存journals引用确保在正确作用域内
    const journalsForHeatmap = this.journals;
    setTimeout(() => {
      const heatmapDom = document.getElementById('journalHeatmap');
      if (!heatmapDom || !journalsForHeatmap.length) return;

      // 销毁已存在的热力图
      if (this.journalHeatmapChart) {
        this.journalHeatmapChart.dispose();
      }

      // ===== 第一步：修复日期格式 =====
      // 确保日期为严格的 YYYY-MM-DD 格式
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 处理热力图数据：[日期字符串YYYY-MM-DD, 字数, 心情, ID]
      const heatmapData = journalsForHeatmap.map(j => {
        const charCount = j.content ? j.content.length : 0;
        // 确保日期格式正确
        const formattedDate = formatDate(j.date || j.createdAt || new Date().toISOString());
        return [formattedDate, charCount, j.mood, j.id];
      }).filter(item => item[0] && item[0] !== 'NaN-NaN-NaN');

      console.log('Heatmap data:', heatmapData);

      // 获取当前年份
      const currentYear = new Date().getFullYear();

      // 心情emoji映射
      const moodEmojiMap = {
        '完美': '🌟',
        '充实': '😊',
        '平淡': '😐',
        '疲惫': '😮‍💨',
        '糟糕': '😢'
      };

      // 计算最大字数用于visualMap
      const maxCharCount = Math.max(...heatmapData.map(d => d[1]), 100);

      // ===== 第二步：重构 ECharts 视觉配置 =====
      const heatmapOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#ddd',
          borderWidth: 1,
          padding: [10, 14],
          textStyle: {
            color: '#333'
          },
          formatter: function(params) {
            if (!params.data) return '';
            const [date, charCount, mood, id] = params.data;
            const emoji = moodEmojiMap[mood] || '📝';
            return `<div style="font-size: 13px; line-height: 1.8;">
                      <b style="font-size: 14px;">${date}</b><br/>
                      <span style="margin-right: 4px;">${emoji}</span> 心情: ${mood || '未记录'}<br/>
                      <span style="margin-right: 4px;">📝</span> 字数: <b>${charCount}</b> 字
                    </div>`;
          }
        },
        visualMap: {
          type: 'continuous',
          min: 0,
          max: maxCharCount,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          inRange: {
            color: ['#f3e5f5', '#ce93d8', '#ab47bc', '#8e24aa', '#6a1b9a']
          },
          textStyle: {
            color: '#666'
          }
        },
        calendar: {
          range: [String(currentYear - 1) + '-12-31', String(currentYear) + '-12-31'],
          top: 35,
          left: 45,
          right: 20,
          bottom: 55,
          cellSize: ['auto', 16],
          yearLabel: { show: false },
          monthLabel: {
            nameMap: 'zh-CN',
            color: '#666',
            fontSize: 11
          },
          dayLabel: {
            nameMap: 'zh-CN',
            firstDay: 1,
            color: '#666',
            fontSize: 10
          },
          itemStyle: {
            color: '#f5f5f5',
            borderColor: '#ffffff',
            borderWidth: 2
          },
          splitLine: {
            show: false
          }
        },
        series: [{
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: heatmapData,
          label: {
            show: false
          },
          itemStyle: {
            color: function(params) {
              const charCount = params.data[1];
              if (charCount === 0) return '#f5f5f5';
              if (charCount < 30) return '#f3e5f5';
              if (charCount < 60) return '#e1bee7';
              if (charCount < 100) return '#ce93d8';
              if (charCount < 150) return '#ba68c8';
              return '#ab47bc';
            }
          }
        }]
      };

      this.journalHeatmapChart = echarts.init(heatmapDom);
      this.journalHeatmapChart.setOption(heatmapOption);

      // 修复：强制resize确保渲染正确
      this.journalHeatmapChart.resize();

      // ===== 第三步：打通点击跳转逻辑 =====
      // 先清除可能重复绑定的事件
      this.journalHeatmapChart.off('click');

      // 绑定点击事件：跳转到对应日记
      this.journalHeatmapChart.on('click', (params) => {
        if (!params || !params.value || !params.value[3]) return;
        const journalId = params.value[3];
        if (journalId) {
          // 1. 重置翻页状态到第一页
          this.resetStatsPage();
          // 2. 关闭统计模态框和遮罩
          this.closeJournalStatsModal();
          // 3. 打开日记阅读视图
          this.openJournalView(journalId);
        }
      });
    }, 350);
  }

  // 重置统计页面到第一页
  resetStatsPage() {
    const track = document.getElementById('statsTrack');
    const dots = document.querySelectorAll('.pagination-dot');
    if (track) {
      track.style.transform = 'translateY(0)';
    }
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === 0);
    });
    this.statsCurrentPage = 0;
  }

  // 绑定滚轮切换事件
  bindStatsWheelEvent() {
    const viewport = document.getElementById('statsViewport');
    const track = document.getElementById('statsTrack');
    const dots = document.querySelectorAll('.pagination-dot');

    if (!viewport) return;

    // 移除之前的事件监听器，防止重复绑定
    viewport.removeEventListener('wheel', this._statsWheelHandler);

    // 创建带防抖的滚动处理函数
    this._statsWheelHandler = (e) => {
      // 防止默认滚动
      e.preventDefault();

      if (e.deltaY > 0 && this.statsCurrentPage === 0) {
        // 向下滚动，从第一页切到第二页
        this.statsCurrentPage = 1;
        if (track) track.style.transform = 'translateY(-480px)';
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === 1);
        });
        // 切换到第二页后，调用resize确保热力图正确渲染
        setTimeout(() => {
          if (this.journalHeatmapChart) {
            this.journalHeatmapChart.resize();
          }
        }, 350);
      } else if (e.deltaY < 0 && this.statsCurrentPage === 1) {
        // 向上滚动，从第二页切回第一页
        this.statsCurrentPage = 0;
        if (track) track.style.transform = 'translateY(0)';
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === 0);
        });
        // 切回第一页后，调用resize确保饼图正确渲染
        setTimeout(() => {
          if (this.journalStatsChart) {
            this.journalStatsChart.resize();
          }
        }, 350);
      }
    };

    // 添加事件监听器
    viewport.addEventListener('wheel', this._statsWheelHandler, { passive: false });

    // 绑定分页指示器点击事件
    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        this.statsCurrentPage = page;
        if (track) track.style.transform = `translateY(-${page * 480}px)`;
        dots.forEach((d, index) => {
          d.classList.toggle('active', index === page);
        });
        // 切换到第二页时调用resize
        if (page === 1 && this.journalHeatmapChart) {
          setTimeout(() => {
            this.journalHeatmapChart.resize();
          }, 350);
        }
        // 切换回第一页时调用resize
        if (page === 0 && this.journalStatsChart) {
          setTimeout(() => {
            this.journalStatsChart.resize();
          }, 350);
        }
      });
    });
  }

  // 关闭日记统计模态框
  closeJournalStatsModal() {
    document.getElementById('journalStatsModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';

    // 移除滚轮事件监听器
    const viewport = document.getElementById('statsViewport');
    if (viewport && this._statsWheelHandler) {
      viewport.removeEventListener('wheel', this._statsWheelHandler);
      this._statsWheelHandler = null;
    }

    // 重置页面状态
    this.resetStatsPage();
    this.statsCurrentPage = 0;

    // 销毁热力图实例，防止内存泄漏
    if (this.journalHeatmapChart) {
      this.journalHeatmapChart.dispose();
      this.journalHeatmapChart = null;
    }
  }

  // 打开日记阅读模态框（只读模式）
  openJournalView(journalId) {
    const journal = this.journals.find(j => j.id === journalId);
    if (!journal) return;

    const date = new Date(journal.date);
    const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${this.getWeekday(date)}`;
    const moodEmoji = this.getMoodEmoji(journal.mood);

    document.getElementById('viewJournalDate').textContent = dateStr;
    document.getElementById('viewJournalMood').textContent = `${moodEmoji} ${journal.mood}`;
    document.getElementById('viewJournalText').textContent = journal.content;

    document.getElementById('journalViewModal').style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
  }

  // 关闭日记阅读模态框
  closeJournalViewModal() {
    document.getElementById('journalViewModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }

  // 显示日记删除确认模态框
  showJournalDeleteModal(journalId) {
    this.currentJournalToDelete = journalId;
    document.getElementById('journalDeleteModal').style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
  }

  // 隐藏日记删除确认模态框
  hideJournalDeleteModal() {
    this.currentJournalToDelete = null;
    document.getElementById('journalDeleteModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }

  // 执行确认删除日记
  async confirmDeleteJournal() {
    if (!this.currentJournalToDelete) return;

    const journalId = this.currentJournalToDelete;
    const index = this.journals.findIndex(j => j.id === journalId);

    if (index !== -1) {
      this.journals.splice(index, 1);
      try {
        await this.saveJournals();
      } catch (e) {
        console.error('Save journals error:', e);
      }

      // 清理可能的遮罩层残留
      const overlay = document.getElementById('overlay');
      if (overlay) overlay.style.display = 'none';

      // 清理textarea状态
      const contentInput = document.getElementById('journalContent');
      if (contentInput) {
        contentInput.disabled = false;
        contentInput.readOnly = false;
        contentInput.style.pointerEvents = 'auto';
      }

      this.renderJournalList();
      this.showToast('日记已删除', 'success');
    }

    // 隐藏模态框
    this.hideJournalDeleteModal();
  }

  // 打开日记模态框
  openJournalModal(journalId = null) {
    const modal = document.getElementById('journalModal');
    const form = document.getElementById('journalForm');
    const idInput = document.getElementById('journalId');
    const dateInput = document.getElementById('journalDate');
    const contentInput = document.getElementById('journalContent');
    const moodInput = document.getElementById('journalMood');
    const title = document.getElementById('journalModalTitle');

    // ====== BUG修复：强制重置textarea状态，防止无法输入 ======
    if (contentInput) {
      contentInput.readOnly = false;
      contentInput.disabled = false;
      contentInput.style.pointerEvents = 'auto';
      contentInput.style.cursor = 'text';
      // 先blur再focus，确保焦点正确
      contentInput.blur();
    }

    // 强制隐藏所有可能的遮罩层残留
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.style.display = 'none';

    // 重置心情按钮选择状态
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));

    if (journalId) {
      // 编辑模式
      const journal = this.journals.find(j => j.id === journalId);
      if (!journal) return;

      title.innerHTML = '<i class="fas fa-edit"></i> 编辑日记';
      idInput.value = journal.id;
      dateInput.value = journal.date;
      contentInput.value = journal.content;
      moodInput.value = journal.mood;

      // 选中对应的心情按钮
      const moodBtn = document.querySelector(`.mood-btn[data-mood="${journal.mood}"]`);
      if (moodBtn) moodBtn.classList.add('selected');
    } else {
      // 新建模式
      title.innerHTML = '<i class="fas fa-pen"></i> 写日记';
      form.reset();
      idInput.value = '';
      dateInput.value = new Date().toISOString().split('T')[0];
      moodInput.value = '';
      if (contentInput) {
        contentInput.value = '';
      }
    }

    modal.style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';

    // 延迟设置焦点，确保modal完全渲染后再聚焦
    setTimeout(() => {
      if (contentInput) {
        contentInput.focus();
      }
    }, 100);
  }

  // 关闭日记模态框
  closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }

  // 保存日记
  async saveJournalFromForm() {
    console.log('saveJournalFromForm called');
    const id = document.getElementById('journalId').value;
    const date = document.getElementById('journalDate').value;
    const content = document.getElementById('journalContent').value;
    const mood = document.getElementById('journalMood').value;
    console.log('Form data:', { id, date, content, mood });

    if (!date || !mood) {
      this.showToast('请选择日期和心情', 'warning');
      return;
    }

    if (id) {
      // 更新现有日记
      const journal = this.journals.find(j => j.id === id);
      if (journal) {
        journal.date = date;
        journal.content = content;
        journal.mood = mood;
        journal.updatedAt = new Date().toISOString();
      }
    } else {
      // 创建新日记
      const newJournal = new JournalEntry({
        date,
        content,
        mood
      });
      this.journals.push(newJournal);
    }

    console.log('Journals array:', this.journals);
    await this.saveJournals();
    this.closeJournalModal();
    this.renderJournalList();
    this.showToast('日记保存成功', 'success');
  }

  // 删除日记
  async deleteJournal(journalId) {
    const index = this.journals.findIndex(j => j.id === journalId);
    if (index !== -1) {
      this.journals.splice(index, 1);
      console.log('After delete, journals count:', this.journals.length);
      try {
        await this.saveJournals();
      } catch (e) {
        console.error('Save journals error:', e);
      }

      // ====== BUG修复：彻底清理遮罩层和焦点 ======
      // 1. 强制隐藏overlay，防止遮挡
      const overlay = document.getElementById('overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }

      // 2. 强制重置textarea状态，防止无法输入
      const contentInput = document.getElementById('journalContent');
      if (contentInput) {
        contentInput.disabled = false;
        contentInput.readOnly = false;
        contentInput.style.pointerEvents = 'auto';
        contentInput.style.cursor = 'text';
      }

      // 3. 渲染列表
      this.renderJournalList();

      // 4. 恢复焦点到输入框（如果有打开的日记表单）
      const journalModal = document.getElementById('journalModal');
      if (journalModal && journalModal.style.display === 'block' && contentInput) {
        // 先blur再focus，确保焦点正确恢复
        contentInput.blur();
        setTimeout(() => {
          contentInput.focus();
        }, 50);
      }

      this.showToast('日记已删除', 'success');
    }
  }

  // 就是这个函数被 Claude 搞丢了！现在它回来了。
  renderBooks(searchTerm = '') {
    let books = this.storageService.getAllBooks();

    // 根据当前文件夹过滤
    if (this.currentFolderId && this.currentFolderId !== 'all') {
      books = books.filter(book => book.folderId === this.currentFolderId);
    }

    // 构建过滤选项，包含搜索关键词
    const filterOptions = {
      ...this.activeFilters,
      keyword: searchTerm
    };

    // 应用过滤（包含搜索关键词和筛选面板条件）
    if (searchTerm || this.hasActiveFilters()) {
      books = FilterService.applyFilters(books, filterOptions);
    }

    const sortedBooks = SortService.applyCurrentSort(
      books,
      this.currentSortField,
      this.currentSortOrder
    );

    if (sortedBooks.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();
    this.bookListContainer.innerHTML = '';

    sortedBooks.forEach(book => {
      const bookCard = this.createBookCard(book);
      this.bookListContainer.appendChild(bookCard);
    });
  }

  // 检查是否有活动的过滤条件
  hasActiveFilters() {
    const f = this.activeFilters;
    return (
      (f.status && f.status.length > 0) ||
      (f.tags && f.tags.length > 0) ||
      (f.dateRange && (f.dateRange.startDate || f.dateRange.endDate)) ||
      (f.ratingRange && (f.ratingRange.min !== null || f.ratingRange.max !== null)) ||
      (f.durationRange && (f.durationRange.minDays !== null || f.durationRange.maxDays !== null))
    );
  }

  // 切换过滤面板显示
  toggleFilterPanel() {
    if (this.isFilterPanelOpen) {
      this.hideFilterPanel();
    } else {
      this.showFilterPanel();
    }
  }

  // 显示过滤面板
  showFilterPanel() {
    this.loadFilterTags();
    this.filterPanel.style.display = 'block';
    this.isFilterPanelOpen = true;
  }

  // 隐藏过滤面板
  hideFilterPanel() {
    this.filterPanel.style.display = 'none';
    this.isFilterPanelOpen = false;
  }

  // 加载可用的标签
  loadFilterTags() {
    const allBooks = this.storageService.getAllBooks();
    const categorizedTags = FilterService.getAllTagsByCategory(allBooks);

    const hasAnyTags = categorizedTags.format.length > 0 || categorizedTags.genre.length > 0 || categorizedTags.unknown.length > 0;

    if (!hasAnyTags) {
      this.filterTagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
      return;
    }

    let html = '';

    // 第一行：题材标签区域
    if (categorizedTags.format.length > 0) {
      html += '<div class="filter-tag-category-row"><span class="filter-tag-category">题材：</span>';
      categorizedTags.format.forEach(tag => {
        const isChecked = this.activeFilters.tags && this.activeFilters.tags.includes(tag);
        html += `
          <label class="filter-tag-item tag-format-label">
            <input type="checkbox" name="filterFormatTag" value="${this.escapeHtml(tag)}" ${isChecked ? 'checked' : ''}>
            <span class="tag-name">${this.escapeHtml(tag)}</span>
          </label>
        `;
      });
      html += '</div>';
    }

    // 第二行：类型和其他标签区域
    if (categorizedTags.genre.length > 0 || categorizedTags.unknown.length > 0) {
      html += '<div class="filter-tag-category-row"><span class="filter-tag-category">类型：</span>';

      // 类型标签
      categorizedTags.genre.forEach(tag => {
        const isChecked = this.activeFilters.tags && this.activeFilters.tags.includes(tag);
        html += `
          <label class="filter-tag-item">
            <input type="checkbox" name="filterGenreTag" value="${this.escapeHtml(tag)}" ${isChecked ? 'checked' : ''}>
            <span class="tag-name">${this.escapeHtml(tag)}</span>
          </label>
        `;
      });

      // 其他标签（如果有的话）
      if (categorizedTags.unknown.length > 0) {
        html += '<span class="filter-tag-category" style="margin-left: 20px;">其他：</span>';
        categorizedTags.unknown.forEach(tag => {
          const isChecked = this.activeFilters.tags && this.activeFilters.tags.includes(tag);
          html += `
            <label class="filter-tag-item">
              <input type="checkbox" name="filterUnknownTag" value="${this.escapeHtml(tag)}" ${isChecked ? 'checked' : ''}>
              <span class="tag-name">${this.escapeHtml(tag)}</span>
            </label>
          `;
        });
      }

      html += '</div>';
    }

    this.filterTagsContainer.innerHTML = html;
  }

  // 应用过滤条件
  applyFilters() {
    // 获取选中的状态
    const statusCheckboxes = document.querySelectorAll('input[name="filterStatus"]:checked');
    this.activeFilters.status = Array.from(statusCheckboxes).map(cb => cb.value);

    // 获取选中的标签（题材、类型、其他均为多选，OR逻辑）
    const selectedTags = [];

    // 题材标签 - 多选（checkbox）
    const formatCheckboxes = document.querySelectorAll('input[name="filterFormatTag"]:checked');
    selectedTags.push(...Array.from(formatCheckboxes).map(cb => cb.value));

    // 类型标签 - 多选（checkbox）
    const genreCheckboxes = document.querySelectorAll('input[name="filterGenreTag"]:checked');
    selectedTags.push(...Array.from(genreCheckboxes).map(cb => cb.value));

    // 其他/自定义标签 - 多选
    const unknownCheckboxes = document.querySelectorAll('input[name="filterUnknownTag"]:checked');
    selectedTags.push(...Array.from(unknownCheckboxes).map(cb => cb.value));

    this.activeFilters.tags = selectedTags.length > 0 ? selectedTags : null;

    // 获取时间范围
    const startDateFrom = document.getElementById('filterStartDateFrom').value;
    const startDateTo = document.getElementById('filterStartDateTo').value;
    if (startDateFrom || startDateTo) {
      this.activeFilters.dateRange = { startDate: startDateFrom || null, endDate: startDateTo || null };
    } else {
      this.activeFilters.dateRange = null;
    }

    // 获取评分范围
    const ratingMin = document.getElementById('filterRatingMin').value;
    const ratingMax = document.getElementById('filterRatingMax').value;
    if (ratingMin || ratingMax) {
      this.activeFilters.ratingRange = {
        min: ratingMin ? parseFloat(ratingMin) : null,
        max: ratingMax ? parseFloat(ratingMax) : null
      };
    } else {
      this.activeFilters.ratingRange = null;
    }

    // 获取阅读时长范围
    const durationMin = document.getElementById('filterDurationMin').value;
    const durationMax = document.getElementById('filterDurationMax').value;
    if (durationMin || durationMax) {
      this.activeFilters.durationRange = {
        minDays: durationMin ? parseInt(durationMin) : null,
        maxDays: durationMax ? parseInt(durationMax) : null
      };
    } else {
      this.activeFilters.durationRange = null;
    }

    this.hideFilterPanel();
    this.updateFilterBadge();
    this.renderBooks();
    this.showToast('筛选已应用', 'success');
  }

  // 清除过滤条件
  clearFilters() {
    // 重置状态
    this.activeFilters = {
      status: [],
      tags: [],
      dateRange: null,
      ratingRange: null,
      durationRange: null
    };

    // 重置 UI - 状态复选框
    document.querySelectorAll('input[name="filterStatus"]').forEach(cb => cb.checked = false);
    // 重置 UI - 标签复选框（题材、类型、其他）
    document.querySelectorAll('input[name="filterFormatTag"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="filterGenreTag"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="filterUnknownTag"]').forEach(cb => cb.checked = false);
    // 重置 UI - 其他筛选条件
    document.getElementById('filterStartDateFrom').value = '';
    document.getElementById('filterStartDateTo').value = '';
    document.getElementById('filterRatingMin').value = '';
    document.getElementById('filterRatingMax').value = '';
    document.getElementById('filterDurationMin').value = '';
    document.getElementById('filterDurationMax').value = '';

    this.updateFilterBadge();
    this.renderBooks();
    this.showToast('筛选已清除', 'success');
  }

  // 更新过滤计数徽章
  updateFilterBadge() {
    const count = this.countActiveFilters();
    if (count > 0) {
      this.activeFilterCount.textContent = count;
      this.activeFilterCount.style.display = 'inline-block';
    } else {
      this.activeFilterCount.style.display = 'none';
    }
  }

  // 计算活动过滤条件数量
  countActiveFilters() {
    let count = 0;
    const f = this.activeFilters;
    if (f.status && f.status.length > 0) count++;
    if (f.tags && f.tags.length > 0) count++;
    if (f.dateRange && (f.dateRange.startDate || f.dateRange.endDate)) count++;
    if (f.ratingRange && (f.ratingRange.min !== null || f.ratingRange.max !== null)) count++;
    if (f.durationRange && (f.durationRange.minDays !== null || f.durationRange.maxDays !== null)) count++;
    return count;
  }

  // 获取书籍卡片主题颜色
  getCardThemeColor(status, tags) {
    // 定义极限色差红色系库（8种剧烈视觉反差的色值）
    const colorPalettes = {
      '已读完': [
        { main: '#FF0000', bg: 'rgba(255, 0, 0, 0.12)', name: '大红' },          // 最正的视觉中心
        { main: '#680000', bg: 'rgba(104, 0, 0, 0.08)', name: '深酒红' },       // 极深，适合严肃题材
        { main: '#FF69B4', bg: 'rgba(255, 105, 180, 0.15)', name: '热力粉' },   // 高饱和冷调粉
        { main: '#FF4500', bg: 'rgba(255, 69, 0, 0.1)', name: '橘红' },         // 极暖调，偏向橘色
        { main: '#C71585', bg: 'rgba(199, 21, 133, 0.12)', name: '梅紫红' },    // 带紫调的深粉
        { main: '#FF7F50', bg: 'rgba(255, 127, 80, 0.15)', name: '珊瑚色' },    // 明亮的浅暖红
        { main: '#DC143C', bg: 'rgba(220, 20, 60, 0.1)', name: '绯红' },       // 经典的高质感红
        { main: '#FFB6C1', bg: 'rgba(255, 182, 193, 0.2)', name: '浅玫瑰' }     // 极浅的粉色，形成明度反差
      ],
      '阅读中': [
        { main: '#FFB300', bg: 'rgba(255, 179, 0, 0.12)', name: '琥珀金' },     // 琥珀金
        { main: '#FFF176', bg: 'rgba(255, 241, 118, 0.25)', name: '柠檬黄' },  // 柠檬黄
        { main: '#F57C00', bg: 'rgba(245, 124, 0, 0.1)', name: '深橙金' },      // 深橙金
        { main: '#FFE082', bg: 'rgba(255, 224, 130, 0.2)', name: '香槟金' },    // 香槟金
        { main: '#FFD54F', bg: 'rgba(255, 213, 79, 0.15)', name: '暖黄色' }    // 暖黄色
      ],
      '未开始': [
        { main: '#2E7D32', bg: 'rgba(46, 125, 50, 0.1)', name: '森林绿' },      // 森林绿
        { main: '#A5D6A7', bg: 'rgba(165, 214, 167, 0.2)', name: '薄荷绿' },   // 薄荷绿
        { main: '#00C853', bg: 'rgba(0, 200, 83, 0.1)', name: '翡翠绿' },       // 翡翠绿
        { main: '#C8E6C9', bg: 'rgba(200, 230, 201, 0.2)', name: '浅草绿' },   // 浅草绿
        { main: '#8BC34A', bg: 'rgba(139, 195, 74, 0.12)', name: '青柠色' }    // 青柠色
      ]
    };

    // 默认色板（未开始）
    const defaultPalette = colorPalettes['未开始'];

    // 获取对应状态的色系
    const palette = colorPalettes[status] || defaultPalette;

    // 如果没有标签，使用默认第一个颜色
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      const theme = palette[0];
      return {
        main: theme.main,
        bg: theme.bg,
        shadow: this.hexToRgba(theme.main, 0.3),
        border: this.darkenColor(theme.main, 0.3)
      };
    }

    // 提取第一个标签
    const firstTag = tags[0];
    // 使用hash函数计算稳定索引（8种颜色，更分散）
    const hash = this.hashString(firstTag);
    const colorIndex = hash % 8; // 8种颜色

    const theme = palette[colorIndex];

    // 动态计算配套颜色
    const mainColor = theme.main;
    const isLightColor = this.isLightColor(mainColor);

    // 计算左侧装饰条颜色（带立体感）
    let borderColor = mainColor;
    if (isLightColor) {
      borderColor = this.darkenColor(mainColor, 0.3); // 浅色调暗30%
    }

    // 计算右上角标签背景色（极淡版本）
    const bgColor = this.hexToRgba(mainColor, 0.12);

    // 计算进度条颜色（高饱和度）
    const progressColor = mainColor;

    return {
      main: mainColor,
      bg: bgColor,
      shadow: this.hexToRgba(mainColor, 0.3),
      border: borderColor,
      progress: progressColor
    };
  }

  // 判断颜色是否为浅色
  isLightColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  }

  // Hash函数：将字符串转换为均匀分布的数字
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  // Hex转RGBA
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // 颜色变暗
  darkenColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.round(r * (1 - amount));
    g = Math.round(g * (1 - amount));
    b = Math.round(b * (1 - amount));

    return `rgb(${r}, ${g}, ${b})`;
  }

  createBookCard(book) {
    const card = document.createElement('div');
    card.className = `book-card ${book.status}`;
    card.dataset.id = book.id;

    // 获取动态主题颜色
    const theme = this.getCardThemeColor(book.status, book.tags);
    card.style.setProperty('--theme-main', theme.main);
    card.style.setProperty('--theme-sub', theme.bg);
    card.style.setProperty('--theme-shadow', theme.shadow);
    card.style.setProperty('--theme-border', theme.border);
    card.style.setProperty('--theme-progress', theme.progress);

    const readingDuration = book.getReadingDuration();
    const durationText = readingDuration ? `${readingDuration} 天` : '-';

    // 根据 enableRating 决定是否显示评分按钮
    const showRatingBtn = book.enableRating === true;
    // 如果已有评分，显示评分
    const ratingHtml = (book.rating && book.rating.totalScore)
      ? `<span class="book-rating-badge">评分: ${book.rating.totalScore.toFixed(1)}</span>`
      : '';

    const ratingButtonHtml = showRatingBtn
      ? `<button class="action-btn rating" data-action="rating" data-id="${book.id}">
           <i class="fas fa-star"></i> 评分
         </button>`
      : '';

    // 荣誉徽章（仅已读完状态显示）
    const honorBadge = book.status === '已读完'
      ? `<div class="honor-badge">🏆 已读完</div>`
      : '';

    card.innerHTML = `
      <div class="book-header">
        <div>
          <div class="book-title">${this.escapeHtml(book.title)}</div>
          <div class="book-author">${this.escapeHtml(book.author || '未知作者')}</div>
        </div>
        <span class="book-status status-${book.status}">${book.status}</span>
        ${ratingHtml}
      </div>
      <div class="book-dates">
        <div class="date-item">
          <div class="date-label">开始时间</div>
          <div class="date-value">${book.getFormattedStartDate()}</div>
        </div>
        <div class="date-item">
          <div class="date-label">结束时间</div>
          <div class="date-value">${book.getFormattedEndDate()}</div>
        </div>
        <div class="date-item">
          <div class="date-label">阅读时长</div>
          <div class="date-value">${durationText}</div>
        </div>
      </div>
      ${this.renderProgressBar(book)}
      <div class="book-footer">
        ${honorBadge}
        <div class="book-actions">
          <button class="action-btn edit" data-action="edit" data-id="${book.id}">
            <i class="fas fa-edit"></i> 编辑
          </button>
          <button class="action-btn delete" data-action="delete" data-id="${book.id}">
            <i class="fas fa-trash"></i> 删除
          </button>
          <button class="action-btn notes" data-action="notes" data-id="${book.id}">
            <i class="fas fa-sticky-note"></i> 笔记
          </button>
          ${ratingButtonHtml}
        </div>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.editBook(book.id);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showDeleteModal(book);
    });

    card.querySelector('[data-action="notes"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showNotesModal(book);
    });

    // 只有在启用评分功能时才绑定评分按钮事件
    const ratingBtn = card.querySelector('[data-action="rating"]');
    if (ratingBtn) {
      ratingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openRatingModal(book.id);
      });
    }

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.action-btn')) {
        this.viewBook(book.id);
      }
    });

    return card;
  }

  showBookForm(book = null) {
    this.isEditing = !!book;
    this.currentBookId = book ? book.id : null;
    document.getElementById('formTitle').textContent = this.isEditing ? '编辑作品' : '添加作品';

    // 初始化标签数组
    this.currentTags = book && book.tags ? [...book.tags] : [];

    if (book) {
      this.bookIdInput.value = book.id;
      this.titleInput.value = book.title;
      this.authorInput.value = book.author || '';
      this.startDateInput.value = book.startDate ? book.startDate.split('T')[0] : '';
      this.endDateInput.value = book.endDate ? book.endDate.split('T')[0] : '';
      this.statusSelect.value = book.status;
      this.currentProgressInput.value = book.currentProgress || 0;
      this.totalLengthInput.value = book.totalLength || '';
      this.progressUnitSelect.value = book.progressUnit || '章';
      this.enableRatingCheckbox.checked = book.enableRating === true;
    } else {
      this.bookIdInput.value = '';
      this.titleInput.value = '';
      this.authorInput.value = '';
      this.startDateInput.value = '';
      this.endDateInput.value = '';
      this.statusSelect.value = '未开始';
      this.currentProgressInput.value = '';
      this.totalLengthInput.value = '';
      this.progressUnitSelect.value = '章';
      this.enableRatingCheckbox.checked = false;
    }

    // 渲染已选标签
    this.renderSelectedTags();
    // 渲染题材标签
    this.renderFormatTags();
    // 渲染类型标签
    this.renderGenreTags();

    // 状态联动逻辑：初始化进度输入框状态
    this.handleStatusChange();

    this.bookFormSection.style.display = 'block';
    this.titleInput.focus();
  }

  // 总计输入变化时，同步更新当前进度（仅在已读完状态下）
  handleTotalLengthChange() {
    const status = this.statusSelect.value;
    if (status === '已读完' && this.totalLengthInput.value && parseInt(this.totalLengthInput.value) > 0) {
      this.currentProgressInput.value = this.totalLengthInput.value;
    }
  }

  hideBookForm() {
    this.bookFormSection.style.display = 'none';
    this.bookForm.reset();
    this.isEditing = false;
    this.currentBookId = null;
    this.currentTags = [];
    this.renderSelectedTags();
  }

  // 判断是否为题材标签
  isFormatTag(tagName) {
    return this.formatTags.includes(tagName);
  }

  // 添加标签（单选题材+多选类型逻辑）
  addTag(tagName, tagType = null) {
    if (!tagName) return;

    // 判断标签类型：如果指定了类型则使用指定类型，否则根据是否在题材列表中判断
    const isFormat = tagType === 'format' || this.isFormatTag(tagName);

    if (isFormat) {
      // 题材类：单选，先移除所有题材标签，再添加新题材
      this.currentTags = this.currentTags.filter(t => !this.isFormatTag(t));
      this.currentTags.unshift(tagName); // 添加到数组首位
    } else {
      // 类型类：多选，增量添加（排除重复）
      if (this.currentTags.includes(tagName)) return;
      this.currentTags.push(tagName);
    }

    this.renderSelectedTags();
    this.renderFormatTags();
    this.renderGenreTags();
  }

  // 移除标签
  removeTag(tagName) {
    this.currentTags = this.currentTags.filter(t => t !== tagName);
    this.renderSelectedTags();
    this.renderFormatTags();
    this.renderGenreTags();
  }

  // 渲染已选标签（带删除按钮）
  renderSelectedTags() {
    if (!this.selectedTagsContainer) return;
    if (this.currentTags.length === 0) {
      this.selectedTagsContainer.innerHTML = '<span class="no-tags-tip">暂无标签</span>';
      return;
    }

    this.selectedTagsContainer.innerHTML = this.currentTags.map((tag, index) => {
      // 数组第一位（题材标签）使用特殊样式，其他为类型标签
      const isFormat = index === 0 && this.isFormatTag(tag);
      const tagClass = isFormat ? 'selected-tag tag-format-active' : 'selected-tag tag-genre-item';
      return `
        <span class="${tagClass}">
          ${tag}
          <span class="remove-tag" onclick="window.bookApp.removeTag('${tag}')">&times;</span>
        </span>
      `;
    }).join('');
  }

  // 渲染题材标签（无删除按钮，点击添加到已选）
  renderFormatTags() {
    const container = this.formatTagsContainer;
    if (!container) return;

    // 获取当前已选中的题材标签（数组第一位）
    const selectedFormat = this.currentTags.length > 0 && this.isFormatTag(this.currentTags[0])
      ? this.currentTags[0]
      : null;

    container.innerHTML = this.formatTags.map(tag => {
      const isSelected = tag === selectedFormat;
      const activeClass = isSelected ? 'preset-tag active' : 'preset-tag';
      return `<button type="button" class="${activeClass}" data-tag="${tag}">${tag}</button>`;
    }).join('');

    container.querySelectorAll('.preset-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addTag(btn.dataset.tag, 'format');
      });
    });
  }

  // 渲染类型标签（无删除按钮，点击添加到已选）
  renderGenreTags() {
    const container = this.genreTagsContainer;
    if (!container) return;

    // 获取当前已选中的所有类型标签
    const selectedGenres = this.currentTags.filter(t => !this.isFormatTag(t));

    container.innerHTML = this.genreTags.map(tag => {
      const isSelected = selectedGenres.includes(tag);
      const activeClass = isSelected ? 'preset-tag active' : 'preset-tag';
      return `<button type="button" class="${activeClass}" data-tag="${tag}">${tag}</button>`;
    }).join('');

    container.querySelectorAll('.preset-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addTag(btn.dataset.tag, 'genre');
      });
    });
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    // 获取现有书籍数据（如果是编辑模式）
    let existingBook = null;
    if (this.isEditing && this.currentBookId) {
      existingBook = this.storageService.getBookById(this.currentBookId);
    }

    // 处理进度数据
    let currentProgress = parseInt(this.currentProgressInput.value) || 0;
    let totalLength = parseInt(this.totalLengthInput.value) || 0;
    const status = this.statusSelect.value;

    // 已读完状态：确保当前进度等于总计
    if (status === '已读完' && totalLength > 0) {
      currentProgress = totalLength;
    }

    const bookData = {
      title: this.titleInput.value.trim(),
      author: this.authorInput.value.trim(),
      startDate: this.startDateInput.value || null,
      endDate: this.endDateInput.value || null,
      status: status,
      currentProgress: currentProgress,
      totalLength: totalLength,
      progressUnit: this.progressUnitSelect.value,
      enableRating: this.enableRatingCheckbox ? this.enableRatingCheckbox.checked : false,
      folderId: (this.currentFolderId && this.currentFolderId !== 'all') ? this.currentFolderId : 'uncategorized',
      tags: [...this.currentTags],
      // 保留原有字段
      notes: existingBook ? (existingBook.notes || []) : [],
      rating: existingBook ? existingBook.rating : null,
      createdAt: existingBook ? existingBook.createdAt : new Date().toISOString()
    };

    try {
      if (this.isEditing && this.currentBookId) {
        await this.storageService.updateBook(this.currentBookId, bookData);
        // 🌟 修复为右上角弹窗 showToast
        this.showToast('作品更新成功', 'success');
      } else {
        await this.storageService.addBook(bookData);
        // 🌟 修复为右上角弹窗 showToast
        this.showToast('作品添加成功', 'success');
      }

      // 彻底成功后，隐藏表单并刷新列表
      this.hideBookForm();
      this.renderFolders();
      this.loadBooks(); 
      
    } catch (error) {
      console.error('表单提交失败:', error);
      // 失败后只弹红框报错，绝对不调用 loadBooks() 清空数据
      this.showToast(`保存失败: ${error.message}`, 'error');
    }
  }

  async editBook(bookId) {
    const book = this.storageService.getBookById(bookId);
    if (book) this.showBookForm(book);
  }

  viewBook(bookId) {
    console.log('查看书籍:', bookId);
  }

  showNotesModal(book) {
    this.currentNotesBookId = book.id;

    // 从存储服务获取最新的书籍对象，如果获取失败则使用传入的book对象
    const latestBook = this.storageService.getBookById(book.id) || book;
    if (!latestBook) return;

    this.currentBookTitle.textContent = latestBook.title;
    this.currentBookAuthor.textContent = latestBook.author || '未知作者';
    this.notesModal.style.display = 'flex';
    this.overlay.style.display = 'block';
    this.renderNotes(latestBook);  // 使用获取到的书籍对象
  }

  // 🌟 这是我们精心打磨的终极版笔记渲染逻辑！包含图片、视频和超长防爆处理
  renderNotes(book, searchTerm = '') {
    // 确保使用最新的书籍对象
    const latestBook = this.storageService.getBookById(book.id) || book;
    const notes = latestBook.notes || [];
    let filteredNotes = notes;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredNotes = notes.filter(note =>
        note.content && note.content.toLowerCase().includes(term)
      );
    }
    const totalCount = notes.length;
    const filteredCount = filteredNotes.length;
    this.notesCount.textContent = searchTerm.trim() ? `${filteredCount}/${totalCount} 条笔记` : `${totalCount} 条笔记`;

    if (!notes || notes.length === 0) {
      this.notesListContainer.innerHTML = `
        <div class="empty-notes" style="text-align: center; padding: 40px 20px; color: #999; font-size: 1rem;">
          <i class="fas fa-sticky-note" style="font-size: 3rem; margin-bottom: 15px; color: #adb5bd;"></i>
          <p>暂无笔记，快来添加第一条吧~</p>
        </div>
      `;
      return;
    }

    this.notesListContainer.innerHTML = '';

    filteredNotes.forEach(note => {
      const noteElement = document.createElement('div');
      noteElement.className = 'note-item';

      const noteContent = note.content || '[内容为空]';
      const contentStr = noteContent.trim();
      let contentHtml = '';

      const isShortPath = contentStr.length < 500; 
      const isImage = isShortPath && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(contentStr);
      const isVideo = isShortPath && /\.(mp4|webm|ogg|avi|mov|mkv|wmv)$/i.test(contentStr);

      if (isImage) {
        let imgSrc = contentStr;
        // URL解码处理%7B等编码字符
        try { imgSrc = decodeURIComponent(imgSrc); } catch(e) {}
        // 转换Windows路径为file URL
        if (/^[a-zA-Z]:\\/.test(imgSrc)) {
            imgSrc = `file:///${imgSrc.replace(/\\/g, '/')}`;
        }
        contentHtml = `<img src="${imgSrc}" alt="笔记图片" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto;">`;
      } else if (isVideo) {
        let vidSrc = contentStr;
        // URL解码处理%7B等编码字符
        try { vidSrc = decodeURIComponent(vidSrc); } catch(e) {}
        // 转换Windows路径为file URL
        if (/^[a-zA-Z]:\\/.test(vidSrc)) {
            vidSrc = `file:///${vidSrc.replace(/\\/g, '/')}`;
        }
        contentHtml = `<video src="${vidSrc}" controls style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto;"></video>`;
      } else {
        contentHtml = `<div class="note-content" style="white-space: pre-wrap; word-break: break-all;">${this.escapeHtml(contentStr)}</div>`;
      }

      const sourceInfo = note.sourceFile ? `<span class="note-source">来源: ${note.sourceFile}</span>` : '';

      // 添加删除按钮和编辑按钮
      const deleteBtn = `<button class="note-delete-btn" data-note-id="${note.id}" title="删除笔记">
        <i class="fas fa-trash"></i>
      </button>`;
      const editBtn = `<button class="note-edit-btn" data-note-id="${note.id}" title="编辑笔记">
        <i class="fas fa-edit"></i>
      </button>`;

      noteElement.innerHTML = `
        ${contentHtml}
        <div class="note-meta" style="margin-top: 10px; border-top: 1px dashed #eee; padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="note-date">${new Date(note.createdAt).toLocaleString('zh-CN')}</span>
            ${sourceInfo}
          </div>
          ${deleteBtn}${editBtn}
        </div>
      `;

      // 绑定删除按钮事件
      noteElement.querySelector('.note-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这条笔记吗？')) {
          await this.deleteNote(note.id);
        }
      });

      // 绑定编辑按钮事件
      noteElement.querySelector('.note-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.editNote(note);
      });

      this.notesListContainer.appendChild(noteElement);
    });
  }

  // 处理笔记搜索（带防抖）
  handleNoteSearch() {
    if (!this.currentNotesBookId) return;
    this.resetEditState();

    // 清除之前的防抖定时器
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // 300ms 防抖
    this.searchDebounceTimer = setTimeout(() => {
      const searchTerm = this.noteSearchInput.value;
      const book = this.storageService.getBookById(this.currentNotesBookId);
      if (book) {
        this.renderNotes(book, searchTerm);
      }
    }, 300);
  }

  // 编辑笔记（填充到文本框）
  editNote(note) {
    this.newNoteContent.value = note.content || '';
    this.editingNoteId = note.id;
    this.saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> 更新笔记';
    this.newNoteContent.focus();
  }

  // 删除笔记
  async deleteNote(noteId) {
    if (!this.currentNotesBookId) return;

    try {
      const book = this.storageService.getBookById(this.currentNotesBookId);
      if (!book) return;

      // 过滤掉要删除的笔记
      book.notes = book.notes.filter(note => note.id !== noteId);

      await this.storageService.updateBook(this.currentNotesBookId, { notes: book.notes });

      // 重新渲染
      const updatedBook = this.storageService.getBookById(this.currentNotesBookId);
      if (updatedBook) {
        this.renderNotes(updatedBook);
      }

      this.showToast('笔记删除成功', 'success');
    } catch (error) {
      this.showToast(`删除失败: ${error.message}`, 'error');
    }
  }

  showDeleteModal(book) {
    this.bookToDelete = book;
    this.deleteMessage.textContent = `确定要删除《${book.title}》吗？此操作无法撤销。`;
    
    // 🌟 就是下面这一行，把 'block' 改成 'flex'
    this.deleteModal.style.display = 'flex'; 
    
    this.overlay.style.display = 'block';
  }

  hideDeleteModal() {
    this.deleteModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.bookToDelete = null;
  }

  hideNotesModal() {
    this.notesModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.currentNotesBookId = null;
    this.newNoteContent.value = '';
    this.resetEditState();
  }

  async confirmDelete() {
    if (!this.bookToDelete) return;
    try {
      await this.storageService.deleteBook(this.bookToDelete.id);
      this.showToast('书籍删除成功', 'success');
      this.loadBooks();
    } catch (error) {
      this.showToast(`删除失败: ${error.message}`, 'error');
    } finally {
      this.hideDeleteModal();
    }
  }

  async saveNote() {
    const content = this.newNoteContent.value.trim();
    if (!content) {
      this.showToast('请输入笔记内容', 'warning');
      return;
    }
    if (!this.currentNotesBookId) return;

    try {
      const book = this.storageService.getBookById(this.currentNotesBookId);
      if (!book) return;

      if (this.editingNoteId) {
        // 更新现有笔记
        const noteIndex = book.notes.findIndex(note => note.id === this.editingNoteId);
        if (noteIndex >= 0) {
          book.notes[noteIndex].content = content;
          book.notes[noteIndex].updatedAt = new Date().toISOString();
          await this.storageService.updateBook(this.currentNotesBookId, { notes: book.notes });
          this.showToast('笔记更新成功', 'success');
        }
      } else {
        // 创建新笔记
        const newNote = {
          id: this.generateId(),
          content: content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceFile: null,
          tags: []
        };

        if (!book.notes) book.notes = [];
        book.notes.push(newNote);
        await this.storageService.updateBook(this.currentNotesBookId, { notes: book.notes });
        this.showToast('笔记保存成功', 'success');
      }

      this.newNoteContent.value = '';
      this.resetEditState();

      // 重新从存储服务获取最新书籍对象并渲染
      const updatedBook = this.storageService.getBookById(this.currentNotesBookId);
      if (updatedBook) {
        this.renderNotes(updatedBook);
      }
    } catch (error) {
      this.showToast(`保存失败: ${error.message}`, 'error');
    }
  }

  // 重置编辑状态
  resetEditState() {
    this.editingNoteId = null;
    this.saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> 保存笔记';
  }

  handleDateChange() {
    const startDate = this.startDateInput.value;
    const endDate = this.endDateInput.value;
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      this.showToast('开始日期不能晚于结束日期', 'warning');
      this.endDateInput.value = '';
    }
  }

  handleStatusChange() {
    const status = this.statusSelect.value;

    // 日期联动逻辑
    if (status === '已读完' && !this.endDateInput.value) {
      this.endDateInput.value = new Date().toISOString().split('T')[0];
    }
    if (status === '未开始') {
      this.startDateInput.value = '';
      this.endDateInput.value = '';
    }
    if (status === '阅读中' && !this.startDateInput.value) {
      this.startDateInput.value = new Date().toISOString().split('T')[0];
    }

    // 进度输入框联动逻辑
    const currentProgressInput = this.currentProgressInput;
    const totalLengthInput = this.totalLengthInput;
    const progressUnitSelect = this.progressUnitSelect;

    if (status === '未开始') {
      // 未开始：禁用所有进度输入
      currentProgressInput.disabled = true;
      totalLengthInput.disabled = true;
      progressUnitSelect.disabled = true;
      currentProgressInput.removeAttribute('readonly');
      currentProgressInput.value = '';
      totalLengthInput.value = '';
    } else if (status === '阅读中') {
      // 阅读中：启用所有进度输入
      currentProgressInput.disabled = false;
      totalLengthInput.disabled = false;
      progressUnitSelect.disabled = false;
      currentProgressInput.removeAttribute('readonly');
    } else if (status === '已读完') {
      // 已读完：禁用当前进度，保持总计可用
      currentProgressInput.disabled = true;
      currentProgressInput.setAttribute('readonly', true);
      totalLengthInput.disabled = false;
      progressUnitSelect.disabled = false;

      // 如果填写了总计，自动将当前进度设为等于总计
      if (totalLengthInput.value && parseInt(totalLengthInput.value) > 0) {
        currentProgressInput.value = totalLengthInput.value;
      }
    }
  }

  // ==================== 导入/导出方法 ====================

  // 显示导出模态框
  showExportModal() {
    console.log('显示导出模态框');
    this.exportModal.style.display = 'flex';
    this.overlay.style.display = 'block';
  }

  // 显示统计模态框
  showStatsModal() {
    console.log('显示统计模态框');
    // 更新标题显示当前文件夹
    const folderId = this.currentFolderId || 'all';
    const folderTitle = folderId === 'all' ? '全部作品' : this.getFolderName(folderId);
    const headerTitle = this.statsModal.querySelector('.modal-header h3');
    if (headerTitle) {
      headerTitle.innerHTML = `<i class="fas fa-chart-bar"></i> ${folderTitle} - 阅读统计`;
    }
    this.statsModal.style.display = 'flex';
    this.overlay.style.display = 'block';
    this.loadStatsData();
  }

  // 获取文件夹名称
  getFolderName(folderId) {
    const folders = this.storageService.getFolders();
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : '未知文件夹';
  }

  // 关闭统计模态框
  closeStatsModal() {
    this.statsModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.destroyAllCharts();
  }

  // ======== 评分对比功能 ========

  // 显示评分对比模态框
  showCompareModal() {
    const ratedBooks = this.storageService.books.filter(b => b.rating && b.rating.ratings);

    if (ratedBooks.length < 2) {
      this.showToast('需要至少2本已评分的书籍才能对比', 'warning');
      return;
    }

    this.compareResults.innerHTML = '';
    this.renderCompareBookSelector(ratedBooks);
    this.compareRatingModal.style.display = 'flex';
    this.overlay.style.display = 'block';
  }

  // 渲染书籍选择列表
  renderCompareBookSelector(books) {
    this.compareBookList.innerHTML = books.map(book => `
      <div class="compare-book-item" data-id="${book.id}" onclick="toggleCompareBook('${book.id}', event)">
        <input type="checkbox" class="compare-book-checkbox" value="${book.id}" onchange="handleCompareCheckboxChange(this)">
        <span class="compare-book-title">${book.title}</span>
        <span class="compare-book-author">${book.author || '未知作者'}</span>
        <span class="compare-book-score">${book.rating.totalScore.toFixed(1)}分</span>
      </div>
    `).join('');

    // 初始化按钮状态
    this.toggleCompareBookSelection();
  }

  // 更新书籍项的选中样式
  updateCompareBookItemStyle(checkbox) {
    const bookItem = checkbox.closest('.compare-book-item');
    if (bookItem) {
      if (checkbox.checked) {
        bookItem.classList.add('selected');
      } else {
        bookItem.classList.remove('selected');
      }
    }
  }

  // 切换书籍选中状态
  toggleCompareBookSelection() {
    const checkboxes = document.querySelectorAll('.compare-book-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const btn = document.getElementById('startCompareBtn');

    if (selectedIds.length < 2) {
      btn.disabled = true;
      btn.title = '请至少选择2本书';
    } else {
      btn.disabled = false;
      btn.title = '开始对比';
    }
  }

  // 开始对比
  startCompare() {
    const checkboxes = document.querySelectorAll('.compare-book-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length < 2) {
      this.showToast('请至少选择2本书进行对比', 'warning');
      return;
    }

    const selectedBooks = selectedIds.map(id => this.storageService.books.find(b => b.id === id));
    this.renderCompareResults(selectedBooks);
  }

  // 渲染对比结果
  renderCompareResults(selectedBooks) {
    const allDimensions = this.getAllRatingDimensions();
    const layers = ['作者层面', '文本层面', '读者层面'];

    // 计算每个维度的差异
    const dimensionStats = allDimensions.map(dim => {
      const values = selectedBooks.map(book => book.rating.ratings[dim.name] || 0);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const diff = max - min;
      return { ...dim, max, min, diff, values };
    });

    // 渲染表格
    let tableHtml = `
      <div class="compare-total-scores">
        ${selectedBooks.map(book => `
          <div class="compare-total-item">
            <span class="compare-total-title">${book.title}</span>
            <span class="compare-total-score">${book.rating.totalScore.toFixed(1)}分</span>
          </div>
        `).join('')}
      </div>
      <table class="compare-table">
        <thead>
          <tr>
            <th>评分维度</th>
            ${selectedBooks.map(book => `<th>${book.title}</th>`).join('')}
            <th>差值</th>
          </tr>
        </thead>
        <tbody>
    `;

    // 按层面分组渲染
    layers.forEach(layer => {
      const layerDims = dimensionStats.filter(d => d.layer === layer);
      if (layerDims.length > 0) {
        tableHtml += `<tr class="compare-layer-row"><td colspan="${selectedBooks.length + 2}" class="compare-layer-header">${layer}</td></tr>`;

        layerDims.forEach(dim => {
          const isHighlight = dim.diff >= 1;
          tableHtml += `
            <tr class="${isHighlight ? 'diff-highlight' : ''}">
              <td>${dim.name}</td>
              ${dim.values.map((val, idx) => {
                const isMax = val === dim.max && dim.diff >= 1;
                const isMin = val === dim.min && dim.diff >= 1;
                return `<td class="${isMax ? 'diff-positive' : ''} ${isMin ? 'diff-negative' : ''}">${val > 0 ? '+' : ''}${val}</td>`;
              }).join('')}
              <td class="${dim.diff >= 1 ? 'diff-highlight-cell' : ''}">${dim.diff}</td>
            </tr>
          `;
        });
      }
    });

    tableHtml += '</tbody></table>';

    // 添加雷达图
    tableHtml += `
      <div class="compare-radar-container">
        <h4>雷达图对比</h4>
        <div class="radar-layers">
          <div class="radar-layer-title">作者层面</div>
          <div class="radar-layer-title">文本层面</div>
          <div class="radar-layer-title">读者层面</div>
        </div>
        <div id="compareRadarChart" class="compare-radar-chart"></div>
      </div>
    `;

    this.compareResults.innerHTML = tableHtml;

    // 渲染雷达图 - 等待DOM渲染完成
    setTimeout(() => {
      const chartDom = document.getElementById('compareRadarChart');
      if (chartDom) {
        // 确保容器可见且有尺寸
        chartDom.style.display = 'block';
        chartDom.style.visibility = 'visible';
        this.renderCompareRadarChart(selectedBooks, allDimensions);
      }
    }, 150);
  }

  // 获取所有评分维度
  getAllRatingDimensions() {
    const dimensions = [];
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];

    if (profile) {
      Object.entries(profile).forEach(([layer, dims]) => {
        dims.forEach(dim => {
          dimensions.push({ name: dim.name, weight: dim.w, layer });
        });
      });
    }

    return dimensions;
  }

  // 渲染对比雷达图
  renderCompareRadarChart(selectedBooks, allDimensions) {
    const chartDom = document.getElementById('compareRadarChart');
    if (!chartDom) {
      console.error('Radar chart container not found');
      return;
    }

    // 确保容器有尺寸
    const container = chartDom.parentElement;
    if (!container.offsetWidth || !container.offsetHeight) {
      console.warn('Chart container has no dimensions, retrying...');
      setTimeout(() => this.renderCompareRadarChart(selectedBooks, allDimensions), 200);
      return;
    }

    // 销毁已存在的图表实例
    if (this.compareRadarChart) {
      this.compareRadarChart.dispose();
    }

    const colors = ['#FF1744', '#3498db', '#2E7D32', '#FFB300', '#B71C1C', '#1abc9c', '#FF80AB', '#34495e'];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const layers = ['作者层面', '文本层面', '读者层面'];

    // 按层面分组获取指标和数据
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    const layerData = {};

    layers.forEach((layer, idx) => {
      const dims = profile[layer] || [];
      layerData[layer] = {
        indicators: dims.map(d => ({ name: d.name, max: 3, min: -1 })),
        books: selectedBooks.map(book => {
          const bookRatings = book.rating && book.rating.ratings ? book.rating.ratings : {};
          return {
            value: dims.map(d => {
              const rating = bookRatings[d.name];
              return (rating !== undefined && rating !== null) ? rating + 2 : 1;
            }),
            name: book.title
          };
        })
      };
    });

    // 配置三个雷达图
    const radarConfig = layers.map((layer, idx) => ({
      indicator: layerData[layer].indicators,
      shape: 'polygon',
      splitNumber: 4,
      radius: '60%',
      center: [(idx * 33.33 + 16.67) + '%', '50%'],
      axisName: { color: isDark ? '#aaa' : '#666', fontSize: 9 },
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' } },
      splitArea: { show: true, areaStyle: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' } }
    }));

    // 构建系列数据：每个层面一个系列，每个系列包含所有书的该层面数据
    const series = layers.map((layer, layerIdx) => ({
      name: layer,
      type: 'radar',
      radarIndex: layerIdx,
      symbol: 'circle',
      symbolSize: 5,
      data: selectedBooks.map((book, bookIdx) => ({
        value: layerData[layer].books[bookIdx].value,
        name: book.title,
        lineStyle: { width: 2, color: colors[bookIdx % colors.length] },
        areaStyle: { opacity: 0.15, color: colors[bookIdx % colors.length] },
        itemStyle: { color: colors[bookIdx % colors.length] }
      }))
    }));

    // 预计算每本书每个维度的真实分数
    const tooltipData = {};
    layers.forEach((layer, layerIdx) => {
      tooltipData[layerIdx] = selectedBooks.map((book, bookIdx) => {
        const bookRatings = book.rating && book.rating.ratings ? book.rating.ratings : {};
        const dims = profile[layer] || [];
        const values = {};
        dims.forEach((d, i) => {
          const rating = bookRatings[d.name];
          values[d.name] = (rating !== undefined && rating !== null) ? rating : 0;
        });
        return { name: book.title, color: colors[bookIdx % colors.length], values };
      });
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: isDark ? '#fff' : '#333', fontSize: 11 },
        formatter: (params) => {
          const layerIdx = params.seriesIndex;
          const layerName = layers[layerIdx];
          const dims = profile[layerName] || [];

          let html = `<div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #ddd;padding-bottom:3px;">${layerName}</div>`;

          // 为每本书生成一列数据
          tooltipData[layerIdx].forEach(bookData => {
            const scoreColor = bookData.color;
            html += `<div style="margin-bottom:8px;">`;
            html += `<div style="color:${scoreColor};font-weight:bold;margin-bottom:3px;">${bookData.name}</div>`;
            dims.forEach((d, i) => {
              const score = bookData.values[d.name];
              const scoreText = score > 0 ? '+' + score : score;
              const displayColor = score > 0 ? '#28a745' : (score < 0 ? '#dc3545' : '#6c757d');
              html += `<div style="display:flex;justify-content:space-between;gap:15px;margin:2px 0;">
                <span style="opacity:0.8;">${d.name}</span>
                <span style="color:${displayColor};font-weight:bold;">${scoreText}</span>
              </div>`;
            });
            html += `</div>`;
          });

          return html;
        }
      },
      legend: {
        data: selectedBooks.map(b => b.title),
        bottom: 0,
        textStyle: { color: isDark ? '#fff' : '#333' }
      },
      radar: radarConfig,
      series: series
    };

    this.compareRadarChart = echarts.init(chartDom);
    this.compareRadarChart.setOption(option);

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
      if (this.compareRadarChart) {
        this.compareRadarChart.resize();
      }
    });
  }

  // 关闭对比模态框
  closeCompareModal() {
    this.compareRatingModal.style.display = 'none';
    this.overlay.style.display = 'none';
    if (this.compareRadarChart) {
      this.compareRadarChart.dispose();
      this.compareRadarChart = null;
    }
  }

  // ======== 评分对比功能结束 ========

  // 加载统计数据
  async loadStatsData() {
    try {
      // 获取当前文件夹ID
      const folderId = this.currentFolderId || 'all';

      // 直接获取当前已有的书籍数据进行统计，不需要重新加载
      const overviewStats = this.statsService.getOverviewStats(folderId);
      const detailedReport = this.statsService.getDetailedReport(folderId);

      // 更新概览卡片
      this.updateOverviewCards(detailedReport);

      // 创建图表
      this.createCharts(overviewStats);

      // 更新详细报告
      this.updateDetailedReport(detailedReport);

      console.log('统计数据加载完成');
    } catch (error) {
      console.error('加载统计数据失败:', error);
      this.showToast('加载统计数据失败', 'error');
    }
  }

  // 更新概览卡片
  updateOverviewCards(report) {
    document.getElementById('totalBooks').textContent = report.totalBooks;
    document.getElementById('completedBooks').textContent = report.completedBooks;
    document.getElementById('readingBooks').textContent = report.readingBooks;
    document.getElementById('avgRating').textContent = report.averageRating.toFixed(1);
    document.getElementById('avgReadingTime').textContent = report.averageReadingTime;

    // 计算完成率
    const completionRate = report.totalBooks > 0
      ? Math.round((report.completedBooks / report.totalBooks) * 100)
      : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
  }

  // 创建图表
  // 创建图表
  createCharts(stats) {
    // 销毁现有图表
    this.destroyAllCharts();

    // 🌟 终极修复：动态配置 Chart.js 全局字体和网格线颜色，适配深色模式！
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e9ecef' : '#666'; // 深色模式用亮白，浅色用深灰
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    if (window.Chart) {
      Chart.defaults.color = textColor;
      Chart.defaults.borderColor = gridColor;
      if (Chart.defaults.scale) {
        Chart.defaults.scale.grid.color = gridColor;
        Chart.defaults.scale.ticks.color = textColor;
      }
    }

    // 阅读状态分布 - 环形图
    const readingStatusCanvas = document.getElementById('readingStatusChart');
    if (readingStatusCanvas) {
      const chart = this.chartManager.createDoughnutChart(readingStatusCanvas, stats.readingStats);
      this.activeCharts.set('readingStatusChart', chart);
    }

    // 月度阅读趋势 - 折线图
    const monthlyTrendCanvas = document.getElementById('monthlyTrendChart');
    if (monthlyTrendCanvas) {
      const lineData = {
        ...stats.monthlyStats,
        label: '完成数量',
        color: '#3498db'
      };
      const chart = this.chartManager.createLineChart(monthlyTrendCanvas, lineData);
      this.activeCharts.set('monthlyTrendChart', chart);
    }

    // 评分分布 - 柱状图 (0-100分制)
    const ratingDistributionCanvas = document.getElementById('ratingDistributionChart');
    if (ratingDistributionCanvas) {
      const ratingOptions = {
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              autoSkip: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      };
      const chart = this.chartManager.createBarChart(ratingDistributionCanvas, stats.ratingStats, ratingOptions);
      this.activeCharts.set('ratingDistributionChart', chart);
    }

    // 热门标签 - 水平柱状图
    const tagDistributionCanvas = document.getElementById('tagDistributionChart');
    if (tagDistributionCanvas) {
      const chart = this.chartManager.createHorizontalBarChart(tagDistributionCanvas, stats.tagStats);
      this.activeCharts.set('tagDistributionChart', chart);
    }

    // 阅读时间分布 - 饼图
    const readingTimeCanvas = document.getElementById('readingTimeChart');
    if (readingTimeCanvas) {
      const chart = this.chartManager.createPieChart(readingTimeCanvas, stats.readingTimeStats);
      this.activeCharts.set('readingTimeChart', chart);
    }

    // 阅读完成趋势 - 柱状图（使用月度数据）
    const completionTrendCanvas = document.getElementById('completionTrendChart');
    if (completionTrendCanvas) {
      const chart = this.chartManager.createBarChart(completionTrendCanvas, stats.monthlyStats);
      this.activeCharts.set('completionTrendChart', chart);
    }
  }

  // 更新详细报告
  updateDetailedReport(report) {
    // 更新最近活动
    this.updateRecentActivities(report.recentActivity);
  }

  // 更新最近活动列表
  updateRecentActivities(activities) {
    const container = document.getElementById('recentActivities');
    if (!container) return;

    container.innerHTML = '';

    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无最近活动</div>';
      return;
    }

    activities.forEach(activity => {
      const activityElement = document.createElement('div');
      activityElement.className = `activity-item ${activity.type}`;

      const iconClass = activity.type === 'completed' ? 'fa-check-circle' : 'fa-play-circle';
      const iconColor = activity.type === 'completed' ? '#2ecc71' : '#f39c12';
      const typeText = activity.type === 'completed' ? '完成阅读' : '开始阅读';

      const date = new Date(activity.date);
      const formattedDate = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      let ratingHtml = '';
      if (activity.type === 'completed' && activity.rating) {
        const rating = Number(activity.rating.overall || activity.rating);
        ratingHtml = `
          <div class="activity-rating">
            <i class="fas fa-star"></i>
            <span>${rating.toFixed(1)}</span>
          </div>
        `;
      }

      activityElement.innerHTML = `
        <div class="activity-icon ${activity.type}" style="background: ${iconColor};">
          <i class="fas ${iconClass}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.bookTitle}</div>
          <div class="activity-meta">
            <div class="activity-date">
              <i class="far fa-calendar"></i>
              <span>${formattedDate}</span>
            </div>
            <div class="activity-type">${typeText}</div>
            ${ratingHtml}
          </div>
        </div>
      `;

      container.appendChild(activityElement);
    });
  }

  // 销毁所有图表
  destroyAllCharts() {
    this.chartManager.destroyAllCharts();
    this.activeCharts.clear();
  }

  // 刷新统计
  refreshStats() {
    console.log('刷新统计数据');
    this.loadStatsData();
    this.showToast('统计数据已刷新', 'success');
  }

  // 导出统计报告
  exportStatsReport() {
    try {
      const folderId = this.currentFolderId || 'all';
      const report = this.statsService.getDetailedReport(folderId);
      const reportData = {
        title: '阅读统计报告',
        generatedAt: new Date().toISOString(),
        ...report
      };

      // 转换为JSON字符串
      const jsonData = JSON.stringify(reportData, null, 2);

      // 创建Blob并下载
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `阅读统计报告_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('统计报告已导出', 'success');
    } catch (error) {
      console.error('导出统计报告失败:', error);
      this.showToast('导出统计报告失败', 'error');
    }
  }

  // 显示导入模态框
  showImportModal() {
    this.importModal.style.display = 'flex';
    this.overlay.style.display = 'block';
    this.resetImportModal();
  }

  // 重置导入模态框
  resetImportModal() {
    this.importFile.value = '';
    this.importPreview.style.display = 'none';
    this.previewContent.textContent = '';
    this.confirmImportBtn.disabled = true;
    this.fileDropArea.classList.remove('drag-over');
  }

  // 处理文件选择
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      await this.previewImportFile(file);
    }
  }

  // 处理拖放
  handleDragOver(event) {
    event.preventDefault();
    this.fileDropArea.classList.add('drag-over');
  }

  // 处理文件拖放
  async handleFileDrop(event) {
    event.preventDefault();
    this.fileDropArea.classList.remove('drag-over');

    const file = event.dataTransfer.files[0];
    if (file) {
      // 设置文件输入框的值
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      this.importFile.files = dataTransfer.files;
      await this.previewImportFile(file);
    }
  }

  // 预览导入文件
  async previewImportFile(file) {
    try {
      // 检查文件类型
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.json') && !fileName.endsWith('.csv')) {
        this.showToast('仅支持 JSON 和 CSV 格式', 'error');
        return;
      }

      // 检查文件大小（最大 5MB）
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('文件过大（最大 5MB）', 'error');
        return;
      }

      // 读取文件内容
      const content = await this.readFileAsText(file);

      // 解析并验证数据
      let importResult;
      if (fileName.endsWith('.json')) {
        importResult = ExportService.importFromJSON(content);
      } else {
        importResult = ExportService.importFromCSV(content);
      }

      if (!importResult.success) {
        this.showToast(`文件解析失败: ${importResult.error}`, 'error');
        return;
      }

      // 验证数据
      const validation = ExportService.validateImportData({ books: importResult.books });

      // 显示预览
      this.previewContent.textContent = `找到 ${importResult.books.length} 本书籍\n`;

      if (validation.errors.length > 0) {
        this.previewContent.textContent += `错误: ${validation.errors.join(', ')}\n`;
      }

      if (validation.warnings.length > 0) {
        this.previewContent.textContent += `警告: ${validation.warnings.join(', ')}\n`;
      }

      // 显示前几本书的信息
      const previewBooks = importResult.books.slice(0, 3);
      previewBooks.forEach((book, index) => {
        this.previewContent.textContent += `\n${index + 1}. ${book.title} - ${book.author || '未知作者'} (${book.status})`;
      });

      if (importResult.books.length > 3) {
        this.previewContent.textContent += `\n... 还有 ${importResult.books.length - 3} 本书籍`;
      }

      this.importPreview.style.display = 'block';
      this.confirmImportBtn.disabled = validation.errors.length > 0;
      this.currentImportData = importResult;

    } catch (error) {
      this.showToast(`读取文件失败: ${error.message}`, 'error');
    }
  }

  // 读取文件为文本
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }

  // 确认导出
  async confirmExport() {
    console.log('开始导出流程');
    try {
      const format = document.querySelector('input[name="exportFormat"]:checked').value;
      console.log('导出格式:', format);
      const books = this.storageService.getAllBooks();

      if (books.length === 0) {
        this.showToast('没有数据可导出', 'warning');
        return;
      }

      // 生成导出数据
      let exportData;
      let fileExtension;

      switch (format) {
        case 'json':
          exportData = ExportService.exportToJSON(books);
          fileExtension = 'json';
          break;
        case 'json-detailed':
          exportData = ExportService.exportToJSONWithRatingDetails(books);
          fileExtension = 'json';
          break;
        case 'csv':
          exportData = ExportService.exportToCSV(books);
          fileExtension = 'csv';
          break;
        default:
          throw new Error('未知的导出格式');
      }

      // 显示保存对话框
      console.log('调用showSaveDialog API');
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: `mybook_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`,
        filters: [{ name: `${fileExtension.toUpperCase()} 文件`, extensions: [fileExtension] }]
      });
      console.log('showSaveDialog结果:', result);

      if (!result.success || !result.filePath) {
        console.log('用户取消了保存对话框');
        return; // 用户取消
      }

      // 保存文件
      console.log('调用exportData API');
      const exportResult = await window.electronAPI.exportData({
        format,
        data: exportData,
        filePath: result.filePath
      });
      console.log('exportData结果:', exportResult);

      if (exportResult.success) {
        console.log('导出成功');
        this.showToast(`数据已导出到 ${result.filePath}`, 'success');
        this.closeExportModal();
      } else {
        console.log('导出失败:', exportResult.error);
        this.showToast(`导出失败: ${exportResult.error}`, 'error');
      }

    } catch (error) {
      this.showToast(`导出失败: ${error.message}`, 'error');
    }
  }

  // 确认导入
  async confirmImport() {
    try {
      if (!this.currentImportData || !this.currentImportData.success) {
        this.showToast('请先选择有效的导入文件', 'warning');
        return;
      }

      const merge = this.importMerge.checked;
      const existingBooks = this.storageService.getAllBooks();
      const newBooks = this.currentImportData.books;

      // 合并数据
      const mergeResult = ExportService.mergeBooks(
        existingBooks,
        newBooks,
        merge ? 'skipDuplicates' : 'overwrite'
      );

      // 保存数据
      if (!merge) {
        // 替换全部数据
        this.storageService.books = mergeResult.mergedBooks;
      } else {
        // 合并数据
        this.storageService.books = mergeResult.mergedBooks;
      }

      await this.storageService.saveBooks();

      // 显示导入结果
      let message = `导入完成: 新增 ${mergeResult.addedCount} 本书籍`;
      if (mergeResult.skippedCount > 0) {
        message += `, 跳过 ${mergeResult.skippedCount} 本重复书籍`;
      }
      if (!merge) {
        message = `导入完成: 替换全部数据，共 ${mergeResult.totalCount} 本书籍`;
      }

      this.showToast(message, 'success');
      this.closeImportModal();
      this.loadBooks();

    } catch (error) {
      this.showToast(`导入失败: ${error.message}`, 'error');
    }
  }

  // 关闭导出模态框
  closeExportModal() {
    this.exportModal.style.display = 'none';
    this.overlay.style.display = 'none';
  }

  // 关闭导入模态框
  closeImportModal() {
    this.importModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.resetImportModal();
    delete this.currentImportData;
  }

  async importNotes() {
    if (!this.currentNotesBookId) return;

    try {
      // 支持图片、视频和文本的文件选择器
      const result = await window.electronAPI.openFileDialog({
        filters: [
          { name: '所有支持的媒体', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv', 'txt', 'md'] },
          { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
          { name: '视频', extensions: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv'] },
          { name: '文本', extensions: ['txt', 'md'] }
        ]
      });
      if (!result.success || !result.filePath) return;

      const filePath = result.filePath;
      const ext = filePath.split('.').pop().toLowerCase();
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
      const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv'];

      let content = filePath; // 对于图片/视频，存储文件路径
      let noteType = 'text';

      // 文本文件需要读取内容
      if (!imageExts.includes(ext) && !videoExts.includes(ext)) {
        const fileResult = await window.electronAPI.readFile(filePath);
        if (!fileResult.success) {
          this.showToast(`读取文件失败: ${fileResult.error}`, 'error');
          return;
        }
        content = fileResult.content;
      } else if (imageExts.includes(ext)) {
        noteType = 'image';
      } else if (videoExts.includes(ext)) {
        noteType = 'video';
      }

      const book = this.storageService.getBookById(this.currentNotesBookId);
      if (!book) return;

      const newNote = {
        id: this.generateId(),
        content: content, // 图片/视频存储路径，文本存储内容
        type: noteType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceFile: filePath,
        tags: []
      };

      if (!book.notes) book.notes = [];
      book.notes.push(newNote);

      await this.storageService.updateBook(this.currentNotesBookId, { notes: book.notes });

      // 重新从存储服务获取最新书籍对象并渲染
      const updatedBook = this.storageService.getBookById(this.currentNotesBookId);
      if (updatedBook) {
        this.renderNotes(updatedBook);
      }

      const typeName = noteType === 'image' ? '图片' : (noteType === 'video' ? '视频' : '笔记');
      this.showToast(`成功导入${typeName}`, 'success');
    } catch (error) {
      this.showToast(`导入失败: ${error.message}`, 'error');
    }
  }

  // 渲染侧边栏文件夹列表
  renderFolders() {
    const sidebarMenu = document.querySelector('.sidebar-menu');
    if (!sidebarMenu) return;

    const folders = this.storageService.getAllFolders();
    const books = this.storageService.getAllBooks();

    sidebarMenu.innerHTML = '';
    folders.forEach(folder => {
      const isDefault = folder.id === 'all';
      const bookCount = isDefault
        ? books.length
        : books.filter(book => book.folderId === folder.id).length;

      const li = document.createElement('li');
      li.className = `sidebar-item${folder.id === this.currentFolderId ? ' active' : ''}${isDefault ? ' default' : ''}`;
      li.dataset.folderId = folder.id;
      li.innerHTML = `
        <i class="fas fa-folder"></i>
        <span>${folder.name}</span>
        <span class="folder-count">${bookCount}</span>
      `;
      li.addEventListener('click', () => this.selectFolder(folder.id));
      sidebarMenu.appendChild(li);
    });
  }

  // 选择文件夹
  selectFolder(folderId) {
    this.currentFolderId = folderId;
    this.renderFolders();

    // 根据文件夹筛选书籍
    let books = this.storageService.getAllBooks();
    if (folderId !== 'all') {
      books = books.filter(book => book.folderId === folderId);
    }

    // 应用搜索和筛选
    const searchTerm = document.getElementById('globalSearch')?.value || '';
    if (searchTerm || this.hasActiveFilters()) {
      const filterOptions = { ...this.activeFilters, keyword: searchTerm };
      books = FilterService.applyFilters(books, filterOptions);
    }

    // 排序
    const sortedBooks = SortService.applyCurrentSort(books, this.currentSortField, this.currentSortOrder);

    // 渲染
    if (sortedBooks.length === 0) {
      this.showEmptyState();
    } else {
      this.hideEmptyState();
      this.bookListContainer.innerHTML = '';
      sortedBooks.forEach(book => {
        const bookCard = this.createBookCard(book);
        this.bookListContainer.appendChild(bookCard);
      });
    }

    this.updateBookCount();
  }

  updateBookCount() {
    let count;
    if (this.currentFolderId === 'all') {
      count = this.storageService.getAllBooks().length;
    } else {
      count = this.storageService.getBooksByFolder(this.currentFolderId).length;
    }
    this.bookCountElement.textContent = `${count} 本`;
  }

  showEmptyState() {
    this.emptyState.style.display = 'block';
    this.bookListContainer.innerHTML = '';
  }

  hideEmptyState() {
    this.emptyState.style.display = 'none';
  }

  showLoading() {
    this.statusMessageElement.textContent = '加载中...';
    this.statusMessageElement.className = 'text-muted';
  }

  hideLoading() {}

  // =========================================
  // 评分系统方法
  // =========================================
  openRatingModal(bookId) {
    const book = this.storageService.getBookById(bookId);
    if (!book) return;

    this.currentRatingBookId = bookId;
    this.ratingBookTitle.textContent = book.title;

    if (book.rating && book.rating.ratings) {
      this.currentRatings = { ...book.rating.ratings };
    } else {
      this.currentRatings = {};
    }

    this.renderRatingMetrics();
    this.updateRatingScore();
    
    // 🌟 1. 先让弹窗显示出来，撑开 CSS 布局
    this.ratingModal.style.display = 'flex';
    this.overlay.style.display = 'block';

    // 🌟 2. 稍微等 50 毫秒再画图，并强制重算大小
    setTimeout(() => {
      this.initRatingChart();
      if (this.ratingChart) {
        this.ratingChart.resize(); // 强制 ECharts 铺满父容器
      }
    }, 50);
  }

  renderRatingMetrics() {
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    let html = '';

    for (const [layer, items] of Object.entries(profile)) {
      html += `<div class="rating-layer">
        <h4 class="rating-layer-title">${layer}</h4>
        <div class="rating-metrics-grid">`;

      items.forEach(m => {
        const currentValue = this.currentRatings[m.name] || 0;
        html += `
          <div class="rating-metric-box">
            <div class="metric-name">${m.name}<span class="w-label">权重 ${m.w}</span></div>
            <div class="rating-btn-group">
              <button class="rating-btn ${currentValue === -1 ? 'active' : ''}" data-m="${m.name}" data-v="-1">-1</button>
              <button class="rating-btn ${currentValue === 0 ? 'active' : ''}" data-m="${m.name}" data-v="0">0</button>
              <button class="rating-btn ${currentValue === 1 ? 'active' : ''}" data-m="${m.name}" data-v="1">+1</button>
            </div>
          </div>`;
      });

      html += `</div></div>`;
    }

    this.ratingMetrics.innerHTML = html;

    // 事件委托：绑定点击事件到容器
    this.ratingMetrics.onclick = (e) => {
      const btn = e.target.closest('.rating-btn');
      if (btn) {
        const metricName = btn.dataset.m;
        const value = parseInt(btn.dataset.v);
        this.setRating(metricName, value);
      }
    };
  }

  setRating(metricName, value) {
    this.currentRatings[metricName] = value;
    // 更新UI
    const buttons = document.querySelectorAll(`.rating-btn[data-m="${metricName}"]`);
    buttons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.v) === value);
    });
    this.updateRatingScore();
    this.updateRatingChart();
  }

  updateRatingScore() {
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    const scores = this.calculateTotalScore(profile, this.currentRatings);
    const totalScore = scores.author + scores.text + scores.reader + 50;
    this.ratingTotalScore.textContent = totalScore.toFixed(1);
  }

  calculateTotalScore(profile, ratings) {
    let author = 0, text = 0, reader = 0;

    profile["作者层面"].forEach(m => author += (ratings[m.name] || 0) * m.w);
    profile["文本层面"].forEach(m => text += (ratings[m.name] || 0) * m.w);
    profile["读者层面"].forEach(m => reader += (ratings[m.name] || 0) * m.w);

    return { author, text, reader };
  }

  async saveRating() {
    if (!this.currentRatingBookId) return;

    const book = this.storageService.getBookById(this.currentRatingBookId);
    if (!book) return;

    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    const scores = this.calculateTotalScore(profile, this.currentRatings);
    const totalScore = scores.author + scores.text + scores.reader + 50;

    const ratingData = {
      totalScore: totalScore,
      profile: DEFAULT_PROFILE_NAME,
      ratings: { ...this.currentRatings },
      ratedAt: new Date().toISOString()
    };

    book.rating = ratingData;
    await this.storageService.updateBook(this.currentRatingBookId, { rating: ratingData });

    this.showToast('评分保存成功', 'success');
    this.closeRatingModal();
    this.renderBooks();
  }

  // =========================================
  // 评分系统 - 模态框与图表控制补充
  // =========================================

  closeRatingModal() {
    // 移除 resize 监听器以防止内存泄漏
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.ratingModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.currentRatingBookId = null;
    if (this.ratingChart) {
      this.ratingChart.dispose();
      this.ratingChart = null;
    }
  }

  initRatingChart() {
    const chartDom = document.getElementById('ratingChart');
    if (!chartDom) return;

    if (!this.ratingChart) {
      this.ratingChart = echarts.init(chartDom);

      // 存储 resize 监听器引用，以便后续可以移除（防止内存泄漏）
      this.resizeHandler = () => {
        if (this.ratingModal.style.display !== 'none' && this.ratingChart) {
          this.ratingChart.resize();
        }
      };
      window.addEventListener('resize', this.resizeHandler);
    }
    this.updateRatingChart();
  }

  updateRatingChart() {
    if (!this.ratingChart) return;
    
    // 提取当前25项指标的得分（+2是为了让-1分也能在雷达图/玫瑰图上显示出形状）
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    const indicatorData = [];
    const scoreData = [];

    // 遍历三大层面获取数据
    for (const [layer, items] of Object.entries(profile)) {
      items.forEach(m => {
        indicatorData.push({ name: m.name, max: 3 }); // max为3，因为实际值(-1,0,1)加上偏移量2后最大为3
        const rawScore = this.currentRatings[m.name] || 0;
        scoreData.push(rawScore + 2); // 偏移处理
      });
    }

    const option = {
      tooltip: {
        trigger: 'item',
        // 让提示框背景色也适配深色/浅色模式
        backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(30, 32, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(218, 112, 214, 0.3)',
        borderWidth: 1,
        textStyle: {
          color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#f8f9fa' : '#333'
        },
        formatter: (params) => {
          const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
          const values = params.value; // 这是加了2偏移量的数据
          let valIdx = 0;

          // 开启弹性盒子布局，横向排列三列
          let html = `<div style="display: flex; gap: 25px; padding: 5px;">`;

          // 遍历三大层面（作者、文本、读者）
          for (const [layer, items] of Object.entries(profile)) {
            html += `<div style="display: flex; flex-direction: column;">`;
            html += `<div style="font-weight: bold; color: #dda0dd; border-bottom: 1px solid rgba(218, 112, 214, 0.3); margin-bottom: 8px; padding-bottom: 4px; font-size: 13px;">${layer}</div>`;
            
            // 遍历该层面下的具体指标
            items.forEach(m => {
              const realScore = values[valIdx] - 2; // 还原真实分数
              // 根据分数给上不同的颜色：正分为粉红，负分为灰色
              let scoreColor = realScore > 0 ? '#F88379' : (realScore < 0 ? '#95a5a6' : '#adb5bd');
              let scoreText = realScore > 0 ? '+' + realScore : realScore;
              
              html += `<div style="font-size: 12px; margin-bottom: 4px; display: flex; justify-content: space-between; gap: 15px;">
                         <span style="opacity: 0.9;">${m.name}</span>
                         <span style="color: ${scoreColor}; font-weight: bold; font-family: monospace;">${scoreText}</span>
                       </div>`;
              valIdx++;
            });
            html += `</div>`; // 结束当前列
          }
          
          html += `</div>`; // 结束整个弹性盒子
          return html;
        }
      },
      radar: {
        indicator: indicatorData,
        shape: 'circle',
        splitNumber: 3,
        radius: '80%', 
        // 🌟 改回绝对居中，不留任何偏移
        center: ['50%', '50%'], 
        
        axisName: {
          show: false 
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(230, 230, 250, 0.1)', 'rgba(230, 230, 250, 0.2)', 'rgba(230, 230, 250, 0.4)'].reverse()
          }
        },
        // ... 后面的保持不变 ...
        // ... 后面的保持不变 ...
        axisLine: { lineStyle: { color: 'rgba(248, 131, 121, 0.3)' } }, 
        splitLine: { lineStyle: { color: 'rgba(248, 131, 121, 0.3)' } }
      },
      series: [{
        name: '评分分布',
        type: 'radar',
        data: [
          {
            value: scoreData,
            name: '当前书籍评分',
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#F88379' }, // 珊瑚粉数据点
            areaStyle: {
              color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                { offset: 0, color: 'rgba(248, 131, 121, 0.1)' },
                { offset: 1, color: 'rgba(248, 131, 121, 0.6)' }
              ])
            }
          }
        ]
      }]
    };
    this.ratingChart.setOption(option);
  }

  // =========================================
  // 通用工具方法
  // =========================================

  // 渲染进度条
  renderProgressBar(book) {
    // "未开始"状态：显示空进度条
    if (book.status === '未开始') {
      return `
        <div class="book-progress not-started">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">尚未开始</span>
        </div>
      `;
    }

    // 对"阅读中"和"已读完"状态显示进度条
    if (!book.currentProgress || book.currentProgress <= 0) {
      return `
        <div class="book-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">- / -</span>
        </div>
      `;
    }

    const currentProgress = book.currentProgress || 0;
    const totalLength = book.totalLength;
    const progressUnit = book.progressUnit || '章';
    const isCompleted = book.status === '已读完';

    // 已读完状态：强制100%，显示"已完成"
    let progressPercent = 0;
    let progressText = '';
    if (isCompleted) {
      progressPercent = 100;
      progressText = totalLength > 0 ? `已完成 ${totalLength} ${progressUnit}` : `已完成`;
    } else if (totalLength && totalLength > 0) {
      progressPercent = Math.min(100, Math.round((currentProgress / totalLength) * 100));
      progressText = `${currentProgress}/${totalLength} ${progressUnit} (${progressPercent}%)`;
    } else {
      progressText = `${currentProgress} ${progressUnit}`;
    }

    return `
      <div class="book-progress ${isCompleted ? 'completed' : ''}">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%; background-color: var(--theme-progress)"></div>
        </div>
        <span class="progress-text">${progressText}</span>
      </div>
    `;
  }

  // =========================================

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 工具方法：生成唯一ID
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }

  // =========================================
  // 新增用户体验功能
  // =========================================

  // 1. Toast 通知系统
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${this.getToastIcon(type)}"></i>
      <span>${message}</span>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    this.toastContainer.appendChild(toast);

    // 添加关闭事件
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    });

    // 自动关闭
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.classList.add('toast-out');
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }

    return toast;
  }

  getToastIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  // 2. 深色模式切换
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // 更新图标
    this.themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    this.showToast(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}模式`, 'info');
  }

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  // 3. 全局搜索
  handleGlobalSearch() {
    const searchTerm = this.globalSearchInput.value.trim().toLowerCase();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.renderBooks(searchTerm);
    }, 300);
  }

  // 4. 键盘快捷键
  handleKeydown(e) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // 防止在输入框中触发快捷键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl/Cmd + N: 添加新书籍
    if (isCtrlOrCmd && e.key === 'n') {
      e.preventDefault();
      this.showBookForm();
      this.showToast('打开添加书籍表单', 'info');
    }

    // Ctrl/Cmd + F: 聚焦搜索框
    if (isCtrlOrCmd && e.key === 'f') {
      e.preventDefault();
      this.globalSearchInput.focus();
      this.showToast('聚焦搜索框', 'info');
    }

    // Ctrl/Cmd + S: 保存当前表单
    if (isCtrlOrCmd && e.key === 's') {
      e.preventDefault();
      if (this.bookFormSection.style.display !== 'none') {
        this.bookForm.dispatchEvent(new Event('submit'));
        this.showToast('保存书籍', 'success');
      }
    }

    // Escape: 关闭模态框
    if (e.key === 'Escape') {
      this.hideAllModals();
      this.hideContextMenu();
    }

    // Delete: 删除选中的书籍
    if (e.key === 'Delete' && this.contextMenuTarget) {
      this.showDeleteModal(this.contextMenuTarget);
    }
  }

  hideAllModals() {
    this.hideBookForm();
    this.hideNotesModal();
    this.hideDeleteModal();
    this.hideFilterPanel();
    this.hideContextMenu();
  }

  // 5. 右键菜单
  handleContextMenu(e) {
    // 检查是否点击在书籍卡片上
    const bookCard = e.target.closest('.book-card');
    if (bookCard) {
      e.preventDefault();
      this.showContextMenu(e, bookCard);
    }
  }

  showContextMenu(e, target) {
    this.contextMenuTarget = target;
    this.contextMenu.style.display = 'block';

    // 获取书籍信息用于过滤文件夹
    const bookId = target.getAttribute('data-id');
    const book = this.storageService.getBookById(bookId);
    const currentFolderId = book ? book.folderId : null;

    // 生成文件夹子菜单
    this.renderFolderSubmenu(currentFolderId);

    // 设置菜单位置
    const menuWidth = this.contextMenu.offsetWidth;
    const menuHeight = this.contextMenu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = e.clientX;
    let top = e.clientY;

    // 防止菜单超出窗口边界
    if (left + menuWidth > windowWidth) {
      left = windowWidth - menuWidth - 10;
    }
    if (top + menuHeight > windowHeight) {
      top = windowHeight - menuHeight - 10;
    }

    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;

    // 添加菜单项点击事件
    this.bindContextMenuEvents();
  }

  // 渲染文件夹子菜单
  renderFolderSubmenu(excludeFolderId = null) {
    const submenu = document.getElementById('folderSubmenu');
    if (!submenu) return;

    const folders = this.storageService.getAllFolders();
    submenu.innerHTML = '';

    // 只显示用户创建的文件夹，排除当前书籍所在的文件夹
    folders.forEach(folder => {
      if (folder.id === 'all' || folder.id === excludeFolderId) return;
      const item = document.createElement('li');
      item.setAttribute('data-folder-id', folder.id);
      item.innerHTML = `<i class="fas fa-folder"></i> ${folder.name}`;
      submenu.appendChild(item);
    });

    // 如果没有可移动的文件夹，显示提示
    if (submenu.children.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.style.color = '#999';
      emptyItem.style.cursor = 'default';
      emptyItem.innerHTML = '<i class="fas fa-folder"></i> 无其他文件夹';
      submenu.appendChild(emptyItem);
      return;
    }

    // 绑定子菜单项点击事件
    submenu.querySelectorAll('li').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const targetFolderId = item.getAttribute('data-folder-id');
        if (targetFolderId) {
          this.moveBookToFolder(targetFolderId);
          this.hideContextMenu();
        }
      };
    });
  }

  // 移动书籍到指定文件夹
  async moveBookToFolder(targetFolderId) {
    if (!this.contextMenuTarget) return;

    const bookId = this.contextMenuTarget.getAttribute('data-id');
    const book = this.storageService.getBookById(bookId);
    if (!book) {
      this.showToast('书籍不存在', 'error');
      return;
    }

    // 获取目标文件夹名称
    const folder = this.storageService.folders.find(f => f.id === targetFolderId);
    const folderName = folder ? folder.name : targetFolderId;

    try {
      // 直接更新书籍的 folderId 属性
      book.folderId = targetFolderId;
      book.updatedAt = new Date().toISOString();

      // 保存数据
      const success = await this.storageService.saveBooks();
      if (!success) {
        throw new Error('保存失败');
      }

      this.showToast(`已移动到 "${folderName}"`, 'success');

      // 刷新视图
      this.renderFolders();
      this.renderBooks();

      // 如果当前在某个文件夹中，需要刷新当前视图
      if (this.currentFolderId && this.currentFolderId !== 'all') {
        this.selectFolder(this.currentFolderId);
      }
    } catch (error) {
      console.error('移动书籍失败:', error);
      this.showToast('移动失败: ' + error.message, 'error');
    }
  }

  hideContextMenu() {
    this.contextMenu.style.display = 'none';
    this.contextMenuTarget = null;
  }

  bindContextMenuEvents() {
    const menuItems = this.contextMenu.querySelectorAll('li[data-action]');

    menuItems.forEach(item => {
      // 如果是子菜单父项，使用 mouseenter/mouseleave 而不是 onclick
      if (item.classList.contains('has-submenu')) {
        // 鼠标悬停时显示子菜单
        item.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          const submenu = item.querySelector('.submenu');
          if (submenu) {
            submenu.style.display = 'block';
          }
        });

        // 鼠标离开时隐藏子菜单
        item.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          const submenu = item.querySelector('.submenu');
          if (submenu) {
            submenu.style.display = 'none';
          }
        });

        // 点击时不执行任何操作（让子菜单处理点击）
        item.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
        };
        return;
      }

      // 普通菜单项点击处理
      item.onclick = (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        this.handleContextMenuAction(action);
        this.hideContextMenu();
      };
    });
  }

  handleContextMenuAction(action) {
    if (!this.contextMenuTarget) return;

    const bookId = this.contextMenuTarget.getAttribute('data-id');
    const book = this.storageService.getBookById(bookId);

    if (!book) return;

    switch (action) {
      case 'edit':
        this.editBook(bookId);
        break;
      case 'notes':
        this.showNotesModal(bookId);
        break;
      case 'rating':
        this.openRatingModal(bookId);
        break;
      case 'delete':
        this.showDeleteModal(bookId);
        break;
    }
  }

  handleDocumentClick(e) {
    // 点击文档其他地方时隐藏右键菜单
    // 使用 closest 确保子菜单点击也被识别为在菜单内
    if (!this.contextMenu.contains(e.target) && !e.target.closest('.submenu')) {
      this.hideContextMenu();
    }
  }

  // 6. 加载指示器
  showLoading() {
    this.statusMessageElement.textContent = '加载中...';
    this.statusMessageElement.classList.add('loading');
  }

  hideLoading() {
    this.statusMessageElement.textContent = '就绪';
    this.statusMessageElement.classList.remove('loading');
  }

  // 7. 增强的书籍渲染（支持搜索）
  
} // BookApp 类结束

// =========================================
// 应用初始化与全局事件绑定
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 确保 electronAPI 加载完成后再初始化
  setTimeout(async () => {
    window.bookApp = new BookApp();
    await window.bookApp.init();
    
    // 🌟 将 BookApp 内部的方法暴露为全局函数，以便 index.html 中的 onclick 能直接调用
    window.closeRatingModal = () => {
      window.bookApp.closeRatingModal();
    };
    
    window.saveRating = () => {
      window.bookApp.saveRating();
    };

    // 导入/导出全局函数
    window.closeExportModal = () => {
      window.bookApp.closeExportModal();
    };

    window.confirmExport = () => {
      window.bookApp.confirmExport();
    };

    window.closeImportModal = () => {
      window.bookApp.closeImportModal();
    };

    window.confirmImport = () => {
      window.bookApp.confirmImport();
    };

    // 统计全局函数
    window.closeStatsModal = () => {
      window.bookApp.closeStatsModal();
    };

    window.refreshStats = () => {
      window.bookApp.refreshStats();
    };

    window.exportStatsReport = () => {
      window.bookApp.exportStatsReport();
    };

    // 评分对比全局函数
    window.closeCompareModal = () => {
      window.bookApp.closeCompareModal();
    };

    window.startCompare = () => {
      window.bookApp.startCompare();
    };

    window.toggleCompareBook = (bookId, event) => {
      // 防止点击checkbox时触发两次
      if (event && event.target.tagName === 'INPUT') return;

      const checkbox = document.querySelector(`.compare-book-checkbox[value="${bookId}"]`);
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        window.bookApp.updateCompareBookItemStyle(checkbox);
        window.bookApp.toggleCompareBookSelection();
      }
    };

    window.handleCompareCheckboxChange = (checkbox) => {
      window.bookApp.updateCompareBookItemStyle(checkbox);
      window.bookApp.toggleCompareBookSelection();
    };

    // 文件夹全局函数
    window.closeFolderModal = () => {
      window.bookApp.closeFolderModal();
    };

    window.confirmCreateFolder = () => {
      window.bookApp.confirmCreateFolder();
    };

    // 日记全局函数
    window.switchView = (viewName) => {
      window.bookApp.switchView(viewName);
    };

    window.openJournalModal = (journalId = null) => {
      window.bookApp.openJournalModal(journalId);
    };

    window.closeJournalModal = () => {
      window.bookApp.closeJournalModal();
    };

    window.closeJournalStatsModal = () => {
      window.bookApp.closeJournalStatsModal();
    };

    window.editJournal = (journalId) => {
      window.bookApp.openJournalModal(journalId);
    };

    window.openJournalView = (journalId) => {
      window.bookApp.openJournalView(journalId);
    };

    window.deleteJournal = (journalId) => {
      // 显示自定义确认模态框，不再使用原生confirm
      window.bookApp.showJournalDeleteModal(journalId);
    };
  }, 100);
});
