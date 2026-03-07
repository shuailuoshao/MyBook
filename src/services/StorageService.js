const Book = require('../models/Book');

class StorageService {
  constructor() {
    this.books = [];
    this.loadBooks();
  }

  // 加载书籍数据
  async loadBooks() {
    try {
      let booksData;
      if (window.electronAPI && typeof window.electronAPI.loadBooks === 'function') {
        booksData = await window.electronAPI.loadBooks();
      } else {
        // 使用localStorage作为后备
        const stored = localStorage.getItem('mybook_books');
        booksData = stored ? JSON.parse(stored) : [];
        console.log('使用localStorage加载书籍数据');
      }
      this.books = booksData.map(book => Book.fromJSON(book));
      return this.books;
    } catch (error) {
      console.error('加载书籍失败:', error);
      this.books = [];
      return [];
    }
  }

  // 保存书籍数据
  async saveBooks() {
    try {
      const booksData = this.books.map(book => book.toJSON());
      if (window.electronAPI && typeof window.electronAPI.saveBooks === 'function') {
        const result = await window.electronAPI.saveBooks(booksData);
        return result.success;
      } else {
        // 使用localStorage作为后备
        localStorage.setItem('mybook_books', JSON.stringify(booksData));
        console.log('使用localStorage保存书籍数据');
        return true;
      }
    } catch (error) {
      console.error('保存书籍失败:', error);
      return false;
    }
  }

  // 获取所有书籍
  getAllBooks() {
    return [...this.books];
  }

  // 根据ID获取书籍
  getBookById(id) {
    return this.books.find(book => book.id === id);
  }

  // 添加书籍
  async addBook(bookData) {
    const book = new Book(bookData);

    // 验证数据
    const validation = book.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    this.books.push(book);
    const success = await this.saveBooks();

    if (!success) {
      // 如果保存失败，回滚
      this.books = this.books.filter(b => b.id !== book.id);
      throw new Error('保存书籍失败');
    }

    return book;
  }

  // 更新书籍
  async updateBook(id, updates) {
    const book = this.getBookById(id);
    if (!book) {
      throw new Error('书籍不存在');
    }

    const originalBook = { ...book.toJSON() };

    try {
      book.update(updates);

      // 验证更新后的数据
      const validation = book.validate();
      if (!validation.isValid) {
        // 恢复原始数据
        Object.assign(book, originalBook);
        throw new Error(validation.errors.join(', '));
      }

      const success = await this.saveBooks();
      if (!success) {
        // 如果保存失败，恢复原始数据
        Object.assign(book, originalBook);
        throw new Error('保存更新失败');
      }

      return book;
    } catch (error) {
      // 恢复原始数据
      Object.assign(book, originalBook);
      throw error;
    }
  }

  // 删除书籍
  async deleteBook(id) {
    const bookIndex = this.books.findIndex(book => book.id === id);
    if (bookIndex === -1) {
      throw new Error('书籍不存在');
    }

    const deletedBook = this.books[bookIndex];
    this.books.splice(bookIndex, 1);

    try {
      const success = await this.saveBooks();
      if (!success) {
        // 如果保存失败，恢复删除
        this.books.splice(bookIndex, 0, deletedBook);
        throw new Error('删除书籍失败');
      }

      return true;
    } catch (error) {
      // 恢复删除
      this.books.splice(bookIndex, 0, deletedBook);
      throw error;
    }
  }

  // 搜索书籍
  searchBooks(query) {
    const searchTerm = query.toLowerCase();
    return this.books.filter(book =>
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm) ||
      book.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // 根据状态筛选书籍
  filterByStatus(status) {
    return this.books.filter(book => book.status === status);
  }

  // 获取统计信息
  getStats() {
    const total = this.books.length;
    const notStarted = this.filterByStatus('未开始').length;
    const reading = this.filterByStatus('阅读中').length;
    const finished = this.filterByStatus('已读完').length;

    const totalReadingDays = this.books
      .filter(book => book.startDate)
      .reduce((sum, book) => sum + (book.getReadingDuration() || 0), 0);

    return {
      total,
      notStarted,
      reading,
      finished,
      totalReadingDays,
      averageReadingDays: finished > 0 ? totalReadingDays / finished : 0
    };
  }
}

module.exports = StorageService;