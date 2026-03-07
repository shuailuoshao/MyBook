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
    const allowedFields = ['title', 'author', 'startDate', 'endDate', 'status', 'notes', 'rating', 'tags', 'enableRating'];
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
    // 不在构造函数中调用 loadBooks，由外部控制加载时机
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
      const booksData = this.books.map(book => book.toJSON());
      console.log('StorageService: 保存书籍, 数据:', booksData);
      if (window.electronAPI && typeof window.electronAPI.saveBooks === 'function') {
        console.log('StorageService: 使用 electronAPI 保存...');
        const result = await window.electronAPI.saveBooks(booksData);
        console.log('StorageService: 保存结果:', result);
        return result.success;
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
      throw new Error('本地保存失败，请检查文件权限');
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
   * @returns {Object} 统计概览数据
   */
  getOverviewStats() {
    const books = this.storageService.getAllBooks();

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
      colors: ['#e74c3c', '#f39c12', '#2ecc71'] // 红色、橙色、绿色
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
  getDetailedReport() {
    const books = this.storageService.getAllBooks();
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
    await this.loadBooks();
  }

  initializeElements() {
    this.bookForm = document.getElementById('bookForm');
    this.bookIdInput = document.getElementById('bookId');
    this.titleInput = document.getElementById('title');
    this.authorInput = document.getElementById('author');
    this.startDateInput = document.getElementById('startDate');
    this.endDateInput = document.getElementById('endDate');
    this.statusSelect = document.getElementById('status');
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

    this.closeNotesModalBtn.addEventListener('click', () => this.hideNotesModal());
    this.importNotesBtn.addEventListener('click', () => this.importNotes());
    this.noteSearchInput.addEventListener('input', () => this.handleNoteSearch());
    this.saveNoteBtn.addEventListener('click', () => this.saveNote());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hideNotesModal();
    });

    this.startDateInput.addEventListener('change', () => this.handleDateChange());
    this.endDateInput.addEventListener('change', () => this.handleDateChange());
    this.statusSelect.addEventListener('change', () => this.handleStatusChange());

    // 新增事件监听器
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.globalSearchInput.addEventListener('input', () => this.handleGlobalSearch());
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
    document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
  }

  async loadBooks() {
    this.showLoading();
    console.log('开始加载书籍...');
    console.log('electronAPI 可用:', !!window.electronAPI);
    try {
      const books = await this.storageService.loadBooks();
      console.log('书籍加载完成, 数量:', books.length);
      this.renderBooks();
      this.updateBookCount();
    } catch (error) {
      console.error('加载书籍失败:', error);
      this.showToast('加载书籍失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 就是这个函数被 Claude 搞丢了！现在它回来了。
  renderBooks(searchTerm = '') {
    let books = this.storageService.getAllBooks();

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

  createBookCard(book) {
    const card = document.createElement('div');
    card.className = `book-card ${book.status}`;
    card.dataset.id = book.id;

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
    document.getElementById('formTitle').textContent = this.isEditing ? '编辑书籍' : '添加书籍';

    // 初始化标签数组
    this.currentTags = book && book.tags ? [...book.tags] : [];

    if (book) {
      this.bookIdInput.value = book.id;
      this.titleInput.value = book.title;
      this.authorInput.value = book.author || '';
      this.startDateInput.value = book.startDate ? book.startDate.split('T')[0] : '';
      this.endDateInput.value = book.endDate ? book.endDate.split('T')[0] : '';
      this.statusSelect.value = book.status;
      this.enableRatingCheckbox.checked = book.enableRating === true;
    } else {
      this.bookIdInput.value = '';
      this.titleInput.value = '';
      this.authorInput.value = '';
      this.startDateInput.value = '';
      this.endDateInput.value = '';
      this.statusSelect.value = '未开始';
      this.enableRatingCheckbox.checked = false;
    }

    // 渲染已选标签
    this.renderSelectedTags();
    // 渲染题材标签
    this.renderFormatTags();
    // 渲染类型标签
    this.renderGenreTags();

    this.bookFormSection.style.display = 'block';
    this.titleInput.focus();
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
    const bookData = {
      title: this.titleInput.value.trim(),
      author: this.authorInput.value.trim(),
      startDate: this.startDateInput.value || null,
      endDate: this.endDateInput.value || null,
      status: this.statusSelect.value,
      enableRating: this.enableRatingCheckbox ? this.enableRatingCheckbox.checked : false,
      tags: [...this.currentTags]
    };

    try {
      if (this.isEditing && this.currentBookId) {
        await this.storageService.updateBook(this.currentBookId, bookData);
        // 🌟 修复为右上角弹窗 showToast
        this.showToast('书籍更新成功', 'success'); 
      } else {
        await this.storageService.addBook(bookData);
        // 🌟 修复为右上角弹窗 showToast
        this.showToast('书籍添加成功', 'success'); 
      }
      
      // 彻底成功后，隐藏表单并刷新列表
      this.hideBookForm();
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
    this.statsModal.style.display = 'flex';
    this.overlay.style.display = 'block';
    this.loadStatsData();
  }

  // 关闭统计模态框
  closeStatsModal() {
    this.statsModal.style.display = 'none';
    this.overlay.style.display = 'none';
    this.destroyAllCharts();
  }

  // 加载统计数据
  async loadStatsData() {
    try {
      // 先重新加载书籍数据，确保获取最新数据
      await this.storageService.loadBooks();

      // 获取统计数据
      const overviewStats = this.statsService.getOverviewStats();
      const detailedReport = this.statsService.getDetailedReport();

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
        const rating = activity.rating.overall || activity.rating;
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
      const report = this.statsService.getDetailedReport();
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

  updateBookCount() {
    const count = this.storageService.getAllBooks().length;
    this.bookCountElement.textContent = `${count} 本书`;
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

  showToast(message, type = 'info') {
    this.statusMessageElement.textContent = message;
    const typeClasses = { 
      success: 'text-success', 
      error: 'text-danger', 
      warning: 'text-warning', 
      info: 'text-muted' 
    };
    this.statusMessageElement.className = typeClasses[type] || 'text-muted';
    setTimeout(() => {
      if (this.statusMessageElement.textContent === message) {
        this.statusMessageElement.textContent = '就绪';
        this.statusMessageElement.className = 'text-muted';
      }
    }, 3000);
  }

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

  hideContextMenu() {
    this.contextMenu.style.display = 'none';
    this.contextMenuTarget = null;
  }

  bindContextMenuEvents() {
    const menuItems = this.contextMenu.querySelectorAll('li[data-action]');

    menuItems.forEach(item => {
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
    if (!this.contextMenu.contains(e.target)) {
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
  }, 100);
});
