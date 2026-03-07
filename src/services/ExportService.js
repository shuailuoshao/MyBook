// 导入/导出服务类
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

  // 获取导出选项
  static getExportOptions() {
    return [
      { id: 'json', label: 'JSON (完整数据)', description: '导出所有书籍数据，包括笔记和评分' },
      { id: 'json-detailed', label: 'JSON (含评分详情)', description: '导出完整数据，包含详细的评分指标' },
      { id: 'csv', label: 'CSV (表格)', description: '导出为表格格式，适合在 Excel 中查看' }
    ];
  }

  // 获取导入选项
  static getImportOptions() {
    return [
      { id: 'json', label: 'JSON 文件', extensions: ['.json'] },
      { id: 'csv', label: 'CSV 文件', extensions: ['.csv'] }
    ];
  }
}

module.exports = ExportService;