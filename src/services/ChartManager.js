/**
 * 图表管理器类
 * 负责创建和管理Chart.js图表
 */
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

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}