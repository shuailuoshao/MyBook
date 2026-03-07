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

    if (!['未开始', '阅读中', '已读完'].includes(this.status)) {
      errors.push('状态必须是未开始、阅读中或已读完');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 更新书籍信息
  update(updates) {
    const allowedFields = ['title', 'author', 'startDate', 'endDate', 'status', 'notes', 'rating', 'tags'];

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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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