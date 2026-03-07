// 过滤服务类
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
        // 必须包含所有选中的标签
        return tags.every(tag => book.tags.includes(tag));
      } else {
        // 包含任一标签即可
        return tags.some(tag => book.tags.includes(tag));
      }
    });
  }

  // 按时间范围过滤
  // dateField: startDate, endDate, createdAt, updatedAt
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

  // 按书名/作者/标签关键词搜索
  static filterByKeyword(books, keyword) {
    if (!keyword || keyword.trim() === '') return books;

    const searchTerm = keyword.toLowerCase().trim();
    return books.filter(book => {
      const titleMatch = book.title && book.title.toLowerCase().includes(searchTerm);
      const authorMatch = book.author && book.author.toLowerCase().includes(searchTerm);
      // 搜索标签数组（题材和类型）
      const tagsMatch = book.tags && book.tags.some(tag =>
        tag.toLowerCase().includes(searchTerm)
      );
      return titleMatch || authorMatch || tagsMatch;
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

  // 获取过滤统计信息
  static getFilterStats(books) {
    return {
      total: books.length,
      byStatus: {
        未开始: books.filter(b => b.status === '未开始').length,
        阅读中: books.filter(b => b.status === '阅读中').length,
        已读完: books.filter(b => b.status === '已读完').length
      },
      tags: this.getAllTags(books),
      avgRating: this.calculateAverageRating(books)
    };
  }

  // 计算平均评分
  static calculateAverageRating(books) {
    const ratedBooks = books.filter(b => b.rating && b.rating.totalScore);
    if (ratedBooks.length === 0) return 0;
    const sum = ratedBooks.reduce((acc, b) => acc + b.rating.totalScore, 0);
    return (sum / ratedBooks.length).toFixed(1);
  }
}

module.exports = FilterService;