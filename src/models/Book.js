// 笔记对象类
class Note {
  constructor({
    id = Date.now().toString(),
    content = '',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
    sourceFile = null, // 来源文件路径（如果是导入的笔记）
    tags = []
  } = {}) {
    this.id = id;
    this.content = content;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.sourceFile = sourceFile;
    this.tags = tags;
  }

  // 验证笔记数据
  validate() {
    const errors = [];
    if (!this.id || typeof this.id !== 'string') {
      errors.push('笔记ID无效');
    }
    if (!this.content || typeof this.content !== 'string') {
      errors.push('笔记内容无效');
    }
    if (!Array.isArray(this.tags)) {
      errors.push('标签必须是数组');
    }
    return { isValid: errors.length === 0, errors };
  }

  // 更新笔记内容
  update(content) {
    this.content = content;
    this.updatedAt = new Date().toISOString();
  }

  // 转换为JSON
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      sourceFile: this.sourceFile,
      tags: this.tags
    };
  }

  // 从JSON创建Note实例
  static fromJSON(json) {
    return new Note(json);
  }
}

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
    enableInspiration = false,
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
    this.enableInspiration = enableInspiration;
    this.folderId = folderId;
    this.currentProgress = currentProgress;
    this.totalLength = totalLength;
    this.progressUnit = progressUnit;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // 验证书籍数据
  validate() {
    const errors = [];

    if (!this.title || this.title.trim() === '') {
      errors.push('书名不能为空');
    }

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (start > end) {
        errors.push('开始日期不能晚于结束日期');
      }
    }

    // 支持多种状态值（跨题材兼容）
    const validStatuses = [
      '未开始', '阅读中', '已读完', '已完成',
      '观看中', '已看完', '游玩中', '已玩完',
      'completed', 'reading', 'unstarted'
    ];
    if (!validStatuses.includes(this.status)) {
      errors.push('状态无效');
    }

    // 验证 notes 是数组
    if (!Array.isArray(this.notes)) {
      errors.push('笔记必须是数组');
    } else {
      // 验证每个 note
      for (const note of this.notes) {
        const n = note instanceof Note ? note : new Note(note);
        const noteValidation = n.validate();
        if (!noteValidation.isValid) {
          errors.push(...noteValidation.errors);
        }
      }
    }

    // 验证 tags 是数组
    if (!Array.isArray(this.tags)) {
      errors.push('标签必须是数组');
    }

    // 验证进度数值
    if (typeof this.currentProgress !== 'number' || this.currentProgress < 0) {
      errors.push('当前进度必须是非负数');
    }
    if (typeof this.totalLength !== 'number' || this.totalLength < 0) {
      errors.push('总长度必须是非负数');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 更新书籍信息
  update(updates) {
    const allowedFields = ['title', 'author', 'startDate', 'endDate', 'status', 'notes', 'rating', 'tags', 'enableRating', 'enableInspiration', 'folderId', 'currentProgress', 'totalLength', 'progressUnit'];
    // 注意：notes 更新要谨慎，应该通过专门的笔记操作方法

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }

  // 计算阅读时长（天）
  getReadingDuration() {
    if (!this.startDate) return null;

    const start = new Date(this.startDate);
    const end = this.endDate ? new Date(this.endDate) : new Date();
    const diffTime = Math.abs(end - start);
    // 同一天计为1天，之后每多一天加1天
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // 获取格式化日期
  getFormattedStartDate() {
    return this.startDate ? new Date(this.startDate).toLocaleDateString('zh-CN') : '未开始';
  }

  getFormattedEndDate() {
    return this.endDate ? new Date(this.endDate).toLocaleDateString('zh-CN') : '进行中';
  }

  // 转换为JSON
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      notes: this.notes,
      rating: this.rating,
      tags: this.tags,
      enableRating: this.enableRating,
      enableInspiration: this.enableInspiration,
      folderId: this.folderId,
      currentProgress: this.currentProgress,
      totalLength: this.totalLength,
      progressUnit: this.progressUnit,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // 从JSON创建Book实例
  static fromJSON(json) {
    return new Book(json);
  }
}

module.exports = Book;
module.exports.Note = Note;
