/**
 * 统计服务类
 * 负责生成阅读数据的统计信息
 */
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
      '未读': 0,
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
    const ratingRanges = {
      '0-1': 0,
      '1-2': 0,
      '2-3': 0,
      '3-4': 0,
      '4-5': 0
    };

    books.forEach(book => {
      if (book.rating !== undefined) {
        const rating = book.rating.overall || book.rating;
        if (rating >= 0 && rating < 1) ratingRanges['0-1']++;
        else if (rating >= 1 && rating < 2) ratingRanges['1-2']++;
        else if (rating >= 2 && rating < 3) ratingRanges['2-3']++;
        else if (rating >= 3 && rating < 4) ratingRanges['3-4']++;
        else if (rating >= 4 && rating <= 5) ratingRanges['4-5']++;
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
      unreadBooks: books.filter(book => book.status === '未读').length,

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
   * @returns {number} 平均评分
   */
  calculateAverageRating(books) {
    const ratedBooks = books.filter(book =>
      book.rating !== undefined &&
      (book.rating.overall !== undefined || typeof book.rating === 'number')
    );

    if (ratedBooks.length === 0) return 0;

    const totalRating = ratedBooks.reduce((sum, book) => {
      const rating = book.rating.overall || book.rating;
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

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsService;
}