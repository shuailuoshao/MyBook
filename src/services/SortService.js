class SortService {
  // 排序书籍数组
  static sortBooks(books, field, order = 'asc') {
    if (!books || !Array.isArray(books)) {
      return [];
    }

    // 创建副本以避免修改原数组
    const sortedBooks = [...books];

    sortedBooks.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];

      // 处理特殊字段
      switch (field) {
        case 'title':
        case 'author':
          // 字符串排序（不区分大小写）
          valueA = valueA ? valueA.toLowerCase() : '';
          valueB = valueB ? valueB.toLowerCase() : '';
          break;

        case 'startDate':
        case 'endDate':
        case 'createdAt':
        case 'updatedAt':
          // 日期排序
          valueA = valueA ? new Date(valueA).getTime() : 0;
          valueB = valueB ? new Date(valueB).getTime() : 0;
          break;

        case 'status':
          // 状态排序：未开始(0), 阅读中(1), 已读完(2)
          const statusOrder = { '未开始': 0, '阅读中': 1, '已读完': 2 };
          valueA = statusOrder[valueA] || 0;
          valueB = statusOrder[valueB] || 0;
          break;

        case 'readingDuration':
          // 阅读时长排序
          valueA = a.getReadingDuration ? a.getReadingDuration() : 0;
          valueB = b.getReadingDuration ? b.getReadingDuration() : 0;
          break;

        default:
          // 默认按原始值排序
          break;
      }

      // 处理空值
      if (valueA == null) return order === 'asc' ? 1 : -1;
      if (valueB == null) return order === 'asc' ? -1 : 1;

      // 比较逻辑
      if (valueA < valueB) return order === 'asc' ? -1 : 1;
      if (valueA > valueB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sortedBooks;
  }

  // 多字段排序（主排序 + 次排序）
  static multiSort(books, sortConfigs) {
    if (!books || !Array.isArray(books) || !sortConfigs || !Array.isArray(sortConfigs)) {
      return [];
    }

    const sortedBooks = [...books];

    sortedBooks.sort((a, b) => {
      for (const config of sortConfigs) {
        const { field, order = 'asc' } = config;
        const comparison = this.compareValues(a, b, field, order);

        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    });

    return sortedBooks;
  }

  // 比较两个书籍对象的特定字段值
  static compareValues(a, b, field, order = 'asc') {
    let valueA = a[field];
    let valueB = b[field];

    // 处理特殊字段
    switch (field) {
      case 'title':
      case 'author':
        valueA = valueA ? valueA.toLowerCase() : '';
        valueB = valueB ? valueB.toLowerCase() : '';
        break;

      case 'startDate':
      case 'endDate':
        valueA = valueA ? new Date(valueA).getTime() : 0;
        valueB = valueB ? new Date(valueB).getTime() : 0;
        break;

      case 'status':
        const statusOrder = { '未开始': 0, '阅读中': 1, '已读完': 2 };
        valueA = statusOrder[valueA] || 0;
        valueB = statusOrder[valueB] || 0;
        break;
    }

    // 处理空值
    if (valueA == null) return order === 'asc' ? 1 : -1;
    if (valueB == null) return order === 'asc' ? -1 : 1;

    // 比较逻辑
    if (valueA < valueB) return order === 'asc' ? -1 : 1;
    if (valueA > valueB) return order === 'asc' ? 1 : -1;
    return 0;
  }

  // 获取可用的排序字段
  static getAvailableSortFields() {
    return [
      { value: 'title', label: '书名', type: 'string' },
      { value: 'author', label: '作者', type: 'string' },
      { value: 'startDate', label: '开始时间', type: 'date' },
      { value: 'endDate', label: '结束时间', type: 'date' },
      { value: 'status', label: '阅读状态', type: 'status' },
      { value: 'createdAt', label: '创建时间', type: 'date' },
      { value: 'updatedAt', label: '更新时间', type: 'date' }
    ];
  }

  // 获取默认排序配置
  static getDefaultSortConfig() {
    return [
      { field: 'status', order: 'desc' },  // 先按状态排序
      { field: 'updatedAt', order: 'desc' } // 再按更新时间排序
    ];
  }

  // 应用当前排序设置
  static applyCurrentSort(books, sortField, sortOrder) {
    if (!sortField) {
      // 如果没有指定排序字段，使用默认的多字段排序
      return this.multiSort(books, this.getDefaultSortConfig());
    }

    return this.sortBooks(books, sortField, sortOrder);
  }
}

module.exports = SortService;