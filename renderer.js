// =========================================
// 极简 Markdown 渲染器（无外部依赖，先转义再解析，防 XSS）
// 支持：标题 # ~ ######、粗体 **、斜体 *、行内代码 `、删除线 ~~、
//      链接 [t](url)、无序列表 - / *、有序列表 1.、引用 >、代码块 ```、分隔线 ---、段落
// =========================================
function renderMarkdown(src) {
  if (!src) return '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);

  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0, listType = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];
    // 代码块
    if (/^```/.test(line)) {
      flushPara(); closeList();
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
      i++; out.push(`<pre><code>${buf.join('\n')}</code></pre>`); continue;
    }
    // 分隔线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); i++; continue; }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    // 引用
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); closeList(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); i++; continue; }
    // 有序列表
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { flushPara(); if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); i++; continue; }
    // 无序列表
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) { flushPara(); if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); i++; continue; }
    // 空行 → 段落分隔
    if (/^\s*$/.test(line)) { flushPara(); closeList(); i++; continue; }
    // 普通段落行
    closeList(); para.push(line); i++;
  }
  flushPara(); closeList();
  return out.join('\n');
}

// =========================================
// WYSIWYG Markdown（contenteditable，所见即所得，5a）
// 模型：编辑器纯文本 === markdown 源码；渲染时逐行包块、标记符弱化保留。
// 光标用"纯文本字符偏移"序列化，重渲染后恢复，规避光标跳动 + 兼容 IME。
// =========================================
const MD_ESC = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 行内：把标记符包成 .md-mark（弱化），内容套语义标签
function mdInlineLive(text) {
  let s = MD_ESC(text);
  s = s.replace(/(`)([^`]+)(`)/g, '<span class="md-mark">$1</span><code>$2</code><span class="md-mark">$3</span>');
  s = s.replace(/(\*\*)([^*]+)(\*\*)/g, '<span class="md-mark">$1</span><strong>$2</strong><span class="md-mark">$3</span>');
  s = s.replace(/(~~)([^~]+)(~~)/g, '<span class="md-mark">$1</span><del>$2</del><span class="md-mark">$3</span>');
  s = s.replace(/(^|[^*\w])(\*)([^*\s][^*]*?)(\*)/g, '$1<span class="md-mark">$2</span><em>$3</em><span class="md-mark">$4</span>');
  s = s.replace(/(\[)([^\]]+)(\]\()(https?:\/\/[^\s)]+)(\))/g,
    '<span class="md-mark">$1</span><a class="md-link">$2</a><span class="md-mark">$3$4$5</span>');
  return s;
}

// 整体：逐行渲染为块（保持行=块的一一对应，便于光标映射）
function renderMarkdownLive(text) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  return lines.map(line => {
    if (/^```/.test(line)) {
      inFence = !inFence;
      return `<div class="md-line md-fence"><span class="md-mark">${MD_ESC(line)}</span></div>`;
    }
    if (inFence) return `<div class="md-line md-code">${MD_ESC(line) || '<br>'}</div>`;
    if (line === '') return `<div class="md-line"><br></div>`;
    const h = line.match(/^(#{1,6})(\s+)(.*)$/);
    if (h) return `<div class="md-line md-h md-h${h[1].length}"><span class="md-mark">${h[1]}${h[2]}</span>${mdInlineLive(h[3])}</div>`;
    const q = line.match(/^(>\s?)(.*)$/);
    if (q) return `<div class="md-line md-quote"><span class="md-mark">${MD_ESC(q[1])}</span>${mdInlineLive(q[2])}</div>`;
    const ol = line.match(/^(\s*)(\d+)(\.\s+)(.*)$/);
    if (ol) return `<div class="md-line md-li md-ol" data-num="${ol[2]}."><span class="md-mark">${ol[1]}${MD_ESC(ol[2] + ol[3])}</span>${mdInlineLive(ol[4])}</div>`;
    const ul = line.match(/^(\s*)([-*]\s+)(.*)$/);
    if (ul) return `<div class="md-line md-li md-ul"><span class="md-mark">${ul[1]}${MD_ESC(ul[2])}</span>${mdInlineLive(ul[3])}</div>`;
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return `<div class="md-line md-hr"><span class="md-mark">${MD_ESC(line)}</span></div>`;
    return `<div class="md-line">${mdInlineLive(line)}</div>`;
  }).join('');
}

// 取/设 contenteditable 的纯文本（块之间用 \n）
function ceGetText(el) {
  let out = [];
  el.querySelectorAll('.md-line').forEach(line => out.push(line.textContent));
  if (out.length === 0) return el.textContent || '';
  return out.join('\n');
}

// 光标 → 纯文本字符偏移
function ceGetCaret(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  // 用 md-line 计数补回换行：统计 pre 范围内跨越的行数
  const frag = pre.cloneContents();
  const tmp = document.createElement('div');
  tmp.appendChild(frag);
  const lines = tmp.querySelectorAll('.md-line');
  if (lines.length === 0) return tmp.textContent.length;
  let text = [];
  lines.forEach(l => text.push(l.textContent));
  return text.join('\n').length;
}

// 纯文本字符偏移 → 光标（重渲染后恢复）
function ceSetCaret(el, offset) {
  if (offset == null) return;
  let remaining = offset;
  const lines = el.querySelectorAll('.md-line');
  for (let li = 0; li < lines.length; li++) {
    const lineLen = lines[li].textContent.length;
    if (remaining <= lineLen) {
      // 落在本行：在行内找文本节点
      placeCaretInNode(lines[li], remaining);
      return;
    }
    remaining -= lineLen + 1; // +1 为换行
    if (remaining < 0) { placeCaretInNode(lines[li], lineLen); return; }
  }
  // 落在末尾
  const last = lines[lines.length - 1];
  if (last) placeCaretInNode(last, last.textContent.length);
}

function placeCaretInNode(lineEl, pos) {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null);
  let node, acc = 0;
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    if (acc + len >= pos) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, pos - acc));
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    acc += len;
  }
  // 无文本节点（空行/<br>）：定位到行首
  const range = document.createRange();
  range.selectNodeContents(lineEl);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// =========================================
// 评分标准配置 - 从外部JSON文件动态加载
// =========================================
let RATING_CRITERIA = null;
let volatileCriteria = null; // 临时权重（对比时使用）

// V3.0：评分体系版本历史（一等公民）
// 结构：{ currentVersionId, versions: [{id, name, note, parentId, createdAt, criteria}] }
let RATING_CRITERIA_HISTORY = null;

// 取当前评分体系版本 id（写入新评分时记录到 ratingHistory）
function getCurrentCriteriaVersionId() {
  return RATING_CRITERIA_HISTORY ? RATING_CRITERIA_HISTORY.currentVersionId : 'rc_initial_v1';
}

// 按 versionId 取该版本的 criteria（用于按版本重算）；找不到返回 null（弱兜底）
function getCriteriaByVersionId(versionId) {
  if (!RATING_CRITERIA_HISTORY || !Array.isArray(RATING_CRITERIA_HISTORY.versions)) return null;
  const v = RATING_CRITERIA_HISTORY.versions.find(x => x.id === versionId);
  return v ? v.criteria : null;
}

// 取版本对象（含 name 等元信息）
function getCriteriaVersionMeta(versionId) {
  if (!RATING_CRITERIA_HISTORY || !Array.isArray(RATING_CRITERIA_HISTORY.versions)) return null;
  return RATING_CRITERIA_HISTORY.versions.find(x => x.id === versionId) || null;
}

// 深拷贝函数
function deepCloneCriteria(criteria) {
  if (!criteria) return null;
  return JSON.parse(JSON.stringify(criteria));
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 初始化临时权重（深拷贝）
function initVolatileCriteria() {
  volatileCriteria = deepCloneCriteria(RATING_CRITERIA);
}

// 重置临时权重
function resetVolatileCriteria() {
  volatileCriteria = deepCloneCriteria(RATING_CRITERIA);
}

// 获取当前使用的权重配置
function getActiveCriteria() {
  return volatileCriteria || RATING_CRITERIA;
}

// 兼容旧版评分系统（中文键名）
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

async function loadRatingCriteriaConfig() {
  // V3.0：优先从版本历史加载当前版本的 criteria
  try {
    if (window.electronAPI && typeof window.electronAPI.loadRatingCriteriaHistory === 'function') {
      const history = await window.electronAPI.loadRatingCriteriaHistory();
      if (history && Array.isArray(history.versions) && history.versions.length > 0) {
        RATING_CRITERIA_HISTORY = history;
        const current = history.versions.find(v => v.id === history.currentVersionId) || history.versions[0];
        RATING_CRITERIA = current.criteria;
        console.log('评分体系版本历史已加载，当前版本:', current.id, current.name);
        return;
      }
    }
  } catch (error) {
    console.error('加载评分体系版本历史失败，回退到旧 criteria:', error);
  }

  // 回退：老的单文件 rating-criteria.json
  try {
    if (window.electronAPI && typeof window.electronAPI.loadRatingCriteria === 'function') {
      RATING_CRITERIA = await window.electronAPI.loadRatingCriteria();
      console.log('评分标准已加载（旧格式）:', RATING_CRITERIA);
    } else {
      console.warn('electronAPI.loadRatingCriteria 不可用，使用内置默认值');
      RATING_CRITERIA = getDefaultRatingCriteria();
    }
  } catch (error) {
    console.error('加载评分标准失败:', error);
    RATING_CRITERIA = getDefaultRatingCriteria();
  }
}

function getDefaultRatingCriteria() {
  return {
    "author_layer": [
      { id: "theme_author", name: "作品主题", weight: 4 },
      { id: "plot_architecture", name: "情节架构", weight: 1.5 },
      { id: "character_design", name: "人物设计", weight: 1 },
      { id: "worldview", name: "世界观", weight: 1.5 },
      { id: "narrative_time", name: "叙事时间", weight: 0.5 },
      { id: "symbolism", name: "象征与意象", weight: 1 },
      { id: "era_background", name: "时代背景", weight: 0.5 }
    ],
    "text_layer": [
      { id: "plot_storytelling", name: "情节故事性", weight: 1 },
      { id: "character_development", name: "登场人物塑造", weight: 3 },
      { id: "relationship_network", name: "人物关系网络", weight: 1.5 },
      { id: "background_description", name: "背景描写", weight: 2 },
      { id: "theme_expression", name: "主题表达", weight: 6 },
      { id: "narrative_perspective", name: "叙述视角", weight: 1.5 },
      { id: "writing_style", name: "文笔文风信息量", weight: 2 },
      { id: "rhetorical_devices", name: "修辞手法", weight: 1.5 },
      { id: "dialogue_depth", name: "对话可咀嚼度", weight: 1.5 }
    ],
    "reader_layer": [
      { id: "pre_reading_horizon", name: "阅读前视野", weight: 1 },
      { id: "immersion", name: "代入感", weight: 0.5 },
      { id: "plot_understanding", name: "情节理解", weight: 3 },
      { id: "character_understanding", name: "人物理解", weight: 3 },
      { id: "theme_understanding", name: "主题理解", weight: 4 },
      { id: "overall_aesthetics", name: "整体审美", weight: 2 },
      { id: "knowledge_acquisition", name: "知识获取", weight: 1.5 },
      { id: "paradigm_shift", name: "观念改变", weight: 2.5 },
      { id: "behavioral_impact", name: "行为影响", weight: 2.5 }
    ]
  };
}

function calculateWeightedScores(book, criteria) {
  const details = book.rating_details || {};
  let authorLayer = 0, textLayer = 0, readerLayer = 0;

  if (criteria.author_layer) {
    criteria.author_layer.forEach(dim => {
      const value = details[dim.id] || 0;
      authorLayer += value * dim.weight;
    });
  }
  if (criteria.text_layer) {
    criteria.text_layer.forEach(dim => {
      const value = details[dim.id] || 0;
      textLayer += value * dim.weight;
    });
  }
  if (criteria.reader_layer) {
    criteria.reader_layer.forEach(dim => {
      const value = details[dim.id] || 0;
      readerLayer += value * dim.weight;
    });
  }

  const total = authorLayer + textLayer + readerLayer;
  return { authorLayer, textLayer, readerLayer, total };
}

function getAllDimensions() {
  const criteria = getActiveCriteria();
  if (!criteria) return [];
  const layerMap = {
    'author_layer': '作者层面',
    'text_layer': '文本层面',
    'reader_layer': '读者层面'
  };
  const dimensions = [];
  Object.entries(criteria).forEach(([layerKey, dims]) => {
    dims.forEach(dim => {
      dimensions.push({
        id: dim.id,
        name: dim.name,
        weight: dim.weight,
        layer: layerMap[layerKey] || layerKey
      });
    });
  });
  return dimensions;
}

// =========================================
// 调试开关 - 上线前设为 false
// =========================================
const DEBUG = false;
const log = DEBUG ? console.log.bind(console) : () => {};

// =========================================
// 灵感记录数据模型 - 原子笔记 (Atomic Note)
// =========================================
class InspirationEntry {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.bookId = data.bookId || '';  // 关联作品ID
        this.title = data.title || '';  // 概念标题
        this.tags = data.tags || [];  // 标签数组
        this.coreTranslation = data.coreTranslation || '';  // 核心转译
        this.contextExamples = {
            personal: data.contextExamples?.personal || '',  // 个人经验关联
            case: data.contextExamples?.case || ''  // 具体案例
        };
        this.connections = {
            parent: data.connections?.parent || [],  // 上级链接
            child: data.connections?.child || [],  // 下级链接
            related: data.connections?.related || [],  // 相似链接
            opposing: data.connections?.opposing || []  // 对立链接
        };
        this.source = {
            reference: data.source?.reference || '',  // 信息源头
            quote: data.source?.quote || ''  // 原始金句
        };
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.lastReviewedAt = data.lastReviewedAt || null;  // 最近一次复习时间
        this.reviewResults = data.reviewResults || [];      // 复习结果数组 [{date, remembered}]
    }

    generateId() {
        return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    }

    toJSON() {
        return {
            id: this.id,
            bookId: this.bookId,
            title: this.title,
            tags: this.tags,
            coreTranslation: this.coreTranslation,
            contextExamples: this.contextExamples,
            connections: this.connections,
            source: this.source,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastReviewedAt: this.lastReviewedAt,
            reviewResults: this.reviewResults
        };
    }

    static fromJSON(json) {
        return new InspirationEntry(json);
    }
}

// ExportService类定义（导入/导出服务）
class ExportService {
  // 导出全部数据（知识库 + 每日记录 + 文件夹）
  static exportAllData(books, journals, folders) {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      books: books.map(book => book.toJSON ? book.toJSON() : book),
      journals: journals.map(journal => journal.toJSON ? journal.toJSON() : journal),
      folders: folders || []
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 解析导入数据
  static parseImportData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      // 验证数据格式
      if (!data.version) {
        throw new Error('无效的导入文件格式');
      }
      return {
        books: data.books || [],
        journals: data.journals || [],
        folders: data.folders || []
      };
    } catch (e) {
      console.error('解析导入数据失败:', e);
      throw new Error('导入文件格式错误');
    }
  }

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
      '作品名', '作者', '完成状态', '开始日期', '结束日期',
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

      // 检测是否为全量导出数据（全量数据有 version 和 exportTime 字段）
      const isFullExport = data.version && data.exportTime;

      if (isFullExport) {
        // 全量数据格式
        return {
          success: true,
          isFullExport: true,
          books: data.books || [],
          journals: data.journals || [],
          folders: data.folders || [],
          exportTime: data.exportTime
        };
      }

      // 验证数据结构（旧的单书籍数据格式）
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
          enableInspiration: bookData.enableInspiration || false,
          createdAt: bookData.createdAt || new Date().toISOString(),
          updatedAt: bookData.updatedAt || new Date().toISOString()
        };

        // 验证必要字段
        if (!book.title || book.title.trim() === '') {
          throw new Error('作品缺少作品名');
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
          title: bookData['作品名'] || bookData['书名'] || '',
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
          throw new Error(`第 ${i + 1} 行缺少作品名`);
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
        errors.push(`第 ${index + 1} 个作品缺少作品名`);
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
      // 检查是否已存在（基于作品名和作者）
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
    rating_details = null,         // V2.x 双轨制兼容字段
    ratingHistory = null,          // V3.0 追加式评分历史
    tags = [],
    enableRating = false,
    enableInspiration = false,
    folderId = 'all',
    currentProgress = 0,
    totalLength = 0,
    progressUnit = '章',
    evaluation = '',
    deleted = false,               // V3.0 软删除标记
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
    this.rating_details = rating_details;
    this.ratingHistory = ratingHistory;
    this.tags = tags;
    this.enableRating = enableRating;
    this.enableInspiration = enableInspiration;
    this.folderId = folderId;
    this.currentProgress = currentProgress;
    this.totalLength = totalLength;
    this.progressUnit = progressUnit;
    this.evaluation = evaluation;
    this.deleted = deleted;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  validate() {
    const errors = [];
    if (!this.title || this.title.trim() === '') errors.push('作品名不能为空');
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (start > end) errors.push('开始日期不能晚于结束日期');
    }
    // 接受所有题材的状态称谓（包括跨题材的变体）
    const validStatuses = [
      // 书籍类
      '未开始', '阅读中', '已读完', '已完成',
      // 影视类
      '观看中', '已看完',
      // 游戏类
      '游玩中', '已玩完',
      // 内部值（防止旧数据或错误数据）
      'completed', 'reading', 'unstarted'
    ];
    if (!validStatuses.includes(this.status)) {
      errors.push('状态必须是未开始、阅读中或已读完');
    }
    return { isValid: errors.length === 0, errors };
  }

  update(updates) {
    const allowedFields = ['title', 'author', 'startDate', 'endDate', 'status', 'notes', 'rating', 'rating_details', 'ratingHistory', 'tags', 'enableRating', 'enableInspiration', 'folderId', 'currentProgress', 'totalLength', 'progressUnit', 'evaluation', 'deleted'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) this[field] = updates[field];
    });
    this.updatedAt = new Date().toISOString();
  }

  getReadingDuration() {
    if (!this.startDate) return null;
    const start = new Date(this.startDate);
    if (isNaN(start.getTime())) return null;
    const end = this.endDate ? new Date(this.endDate) : new Date();
    if (isNaN(end.getTime())) return null;
    const diffTime = Math.abs(end - start);
    // 同一天计为1天，之后每多一天加1天
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  getFormattedStartDate() {
    if (!this.startDate) return '未开始';
    const date = new Date(this.startDate);
    return isNaN(date.getTime()) ? '未开始' : date.toLocaleDateString('zh-CN');
  }

  getFormattedEndDate() {
    if (!this.endDate) return '进行中';
    const date = new Date(this.endDate);
    return isNaN(date.getTime()) ? '进行中' : date.toLocaleDateString('zh-CN');
  }

  toJSON() {
    return {
      id: this.id, title: this.title, author: this.author,
      startDate: this.startDate, endDate: this.endDate,
      status: this.status, notes: this.notes, rating: this.rating,
      rating_details: this.rating_details,           // V2.x 双轨制兼容
      ratingHistory: this.ratingHistory,             // V3.0 追加式评分历史
      tags: this.tags, enableRating: this.enableRating, enableInspiration: this.enableInspiration,
      folderId: this.folderId,
      currentProgress: this.currentProgress,
      totalLength: this.totalLength,
      progressUnit: this.progressUnit,
      evaluation: this.evaluation,
      deleted: this.deleted,                          // V3.0 软删除标记
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
    this.bookMap = new Map();  // O(1) 查询索引
    this.folders = [];
    // 不在构造函数中调用 loadBooks，由外部控制加载时机
  }

  // 重建书籍 Map 索引
  _rebuildBookMap() {
    this.bookMap.clear();
    for (const book of this.books) {
      this.bookMap.set(book.id, book);
    }
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
    // V3.0：列表场景过滤掉软删除的书
    const live = this.books.filter(book => book.deleted !== true);
    if (folderId === 'all') return live;
    return live.filter(book => book.folderId === folderId);
  }

  async loadBooks() {
    try {
      let booksData;
      log('StorageService: 检查 electronAPI...', window.electronAPI ? '可用' : '不可用');
      if (window.electronAPI && typeof window.electronAPI.loadBooks === 'function') {
        log('StorageService: 使用 electronAPI 加载...');
        booksData = await window.electronAPI.loadBooks();
      } else {
        log('StorageService: 使用 localStorage 加载...');
        const stored = localStorage.getItem('mybook_books');
        booksData = stored ? JSON.parse(stored) : [];
      }
      log('StorageService: 加载到的数据:', booksData);
      this.books = booksData.map(book => Book.fromJSON(book));
      this._rebuildBookMap();  // 重建索引
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
        log('StorageService: 单本书JSON:', JSON.stringify(json));
        return json;
      });
      log('StorageService: 保存书籍, 数量:', booksData.length);
      if (window.electronAPI && typeof window.electronAPI.saveBooks === 'function') {
        log('StorageService: 使用 electronAPI 保存...');
        const result = await window.electronAPI.saveBooks(booksData);
        log('StorageService: 保存结果:', result);
        log('StorageService: result.success =', result.success, typeof result.success);
        return result.success === true;
      } else {
        log('StorageService: 使用 localStorage 保存...');
        localStorage.setItem('mybook_books', JSON.stringify(booksData));
        return true;
      }
    } catch (error) {
      console.error('保存书籍失败:', error);
      return false;
    }
  }

  // V3.0：getAllBooks 收口过滤掉软删除的书（决策 Q7-3-γ）
  // 列表渲染/排序/筛选/统计/导出等所有上层路径都通过这里读取，自动受益。
  // 真正需要"包含已删除"的极少数场景（例如对比项目按 bookId 反查）
  // 应直接访问 this.books / this.bookMap。
  getAllBooks() { return this.books.filter(b => b.deleted !== true); }
  getAllBooksIncludingDeleted() { return [...this.books]; }
  getBookById(id) { return this.bookMap.get(id) || null; }

  async addBook(bookData) {
    const book = new Book(bookData);
    const validation = book.validate();
    if (!validation.isValid) throw new Error(validation.errors.join(', '));
    
    // 🌟 必须先放进数组！
    this.books.push(book);
    this.bookMap.set(book.id, book);  // 同步更新索引

    // 🌟 然后连同新书一起保存到硬盘
    const success = await this.saveBooks();

    if (!success) {
      // 如果硬盘保存失败，把刚刚放进去的书拿出来（数据回滚）
      this.books.pop();
      this.bookMap.delete(book.id);  // 回滚索引
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
    // V3.0 软删除（决策 Q7-3-γ：γ-1 后台软删，对比项目里通过 bookId 引用的书永远能找到）
    // 不再从 this.books / this.bookMap 中物理移除，只标记 deleted=true。
    // 列表渲染、排序、筛选、统计等通过 getAllBooks() 自动过滤。
    const book = this.bookMap.get(id);
    if (!book) throw new Error('书籍不存在');
    if (book.deleted === true) return true; // 已经是软删，幂等

    const previousDeleted = book.deleted;
    const previousUpdatedAt = book.updatedAt;
    book.deleted = true;
    book.updatedAt = new Date().toISOString();

    try {
      const success = await this.saveBooks();
      if (!success) {
        book.deleted = previousDeleted;
        book.updatedAt = previousUpdatedAt;
        throw new Error('删除书籍失败');
      }
      return true;
    } catch (error) {
      book.deleted = previousDeleted;
      book.updatedAt = previousUpdatedAt;
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

  // 按作品名/作者关键词搜索
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
    const formatTags = ['文学', '小说', '工具', '纪实', '报告文学', '传记', '游戏剧情', '电视剧', '动漫', '电影', '漫画', '学术论文', '哲学', '历史', '社科'];
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

    // 初始化灵感记录数组
    this.journals = [];

    // 缓存视图切换相关 DOM 元素（性能优化）
    this.domCache = {
      bookSection: null,
      journalSection: null,
      viewKnowledge: null,
      viewJournal: null,
      kbSidebar: null,
      journalSidebar: null,
      kbToolbar: null,
      journalToolbar: null,
      journalList: null,
      journalEmptyState: null
    };

    // 缓存日记排序结果（避免重复排序）
    this._sortedJournals = null;
    this._journalsHash = '';

    // 渲染任务控制器（用于取消进行中的渲染）
    this._renderController = null;

    // 题材与状态称谓映射表
    this.statusLabels = {
      '书籍类': {
        'completed': '已读完',
        'reading': '阅读中',
        'unstarted': '未开始'
      },
      '影视类': {
        'completed': '已看完',
        'reading': '观看中',
        'unstarted': '未开始'
      },
      '游戏类': {
        'completed': '已玩完',
        'reading': '游玩中',
        'unstarted': '未开始'
      },
      'default': {
        'completed': '已读完',
        'reading': '阅读中',
        'unstarted': '未开始'
      }
    };

    // 题材分类映射
    this.genreCategories = {
      '书籍类': ['文学', '小说', '轻小说', '网文', '纪实', '报告文学', '传记', '技术文档', '学术论文', '散文', '诗歌', '童话', '科普', '历史', '哲学', '心理学', '经济学', '管理学', '计算机', '编程', '设计', '艺术', '摄影', '音乐', '文学评论'],
      '影视类': ['电影', '电视剧', '动漫', '纪录片', '漫画', '短片', '系列剧', '连续剧', '动画', '真人秀', '综艺'],
      '游戏类': ['游戏剧情', 'Galgame', 'RPG', 'AVG', 'ACT', 'Racing', 'Sports', 'Simulation', 'Strategy', 'Puzzle', 'Adventure', '角色扮演', '动作', '竞速', '体育', '模拟', '策略', '解谜', '冒险']
    };
  }

  // 获取状态称谓
  getStatusLabel(genre, status) {
    // 将数据库中的状态值映射到内部状态值
    const statusMap = {
      '已读完': 'completed',
      '已完成': 'completed',
      '阅读中': 'reading',
      '进行中': 'reading',
      '未开始': 'unstarted',
      '已看完': 'completed',
      '观看中': 'reading',
      '已玩完': 'completed',
      '游玩中': 'reading',
      'completed': 'completed',
      'reading': 'reading',
      'unstarted': 'unstarted'
    };

    const internalStatus = statusMap[status] || 'unstarted';

    // 根据题材确定分类
    let category = 'default';
    for (const [cat, genres] of Object.entries(this.genreCategories)) {
      if (genres.includes(genre)) {
        category = cat;
        break;
      }
    }

    // 返回对应的称谓
    return this.statusLabels[category][internalStatus] || this.statusLabels.default[internalStatus];
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
          log('浏览器模式，请按 F12 打开开发者工具');
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
          log('开发者工具');
        }
      }
    });

    this.storageService = new StorageService();
    this.currentSortField = 'startDate';
    this.currentSortOrder = 'desc';
    this.isEditing = false;
    this.currentBookId = null;
    this.currentFolderId = 'all';

    // 灵感相关状态
    this.inspirations = [];
    this.currentView = 'knowledge'; // knowledge | inspiration
    this.currentInspirationSearchTerm = ''; // 当前灵感搜索关键词
    this.currentInspirationToDelete = null; // 待删除的灵感ID

    // 灵感筛选状态
    this.inspirationFilters = {
      bookId: null,
      tags: [],
      timeOption: 'all', // all | week | month
      dateFrom: null,
      dateTo: null
    };

    // 过滤相关状态
    this.activeFilters = {
      status: [],
      tags: [],
      dateRange: null,
      ratingRange: null,
      durationRange: null
    };
    this.isFilterPanelOpen = false;

    // 灵感标签相关
    this.currentInspirationTags = [];
    this.inspirationPresetTags = [
      '经济学', '心理学', '哲学', '社会学', '方法论', '思维模型', '认知', '决策', '效率', '创作', '设计', '技术', '历史', '文学', '艺术',
      '物理学', '数学', '生物学', '化学', '地理', '政治', '法律', '伦理', '宗教', '文化', '语言', '教育', '管理', '营销', '投资', '创业'
    ];

    // 复习相关状态
    this.reviewCards = [];         // 本轮复习的灵感数组
    this.reviewIndex = 0;          // 当前卡片索引
    this.reviewRemembered = [];    // 标记为"记住了"的灵感 ID
    this.reviewForgotten = [];     // 标记为"再想想"的灵感 ID

    this.initializeElements();
    this._initDomCache();  // 初始化 DOM 缓存
    // 加载评分标准配置
    await loadRatingCriteriaConfig();
    this.bindEvents();
    this.initTheme();
    // 先加载文件夹，再加载书籍（渲染时需要文件夹数据）
    this.storageService.loadFolders().then(() => {
      this.loadBooks();
    });
    // 灵感数据延迟加载，不阻塞主界面
    setTimeout(() => this.loadJournals(), 100);
    // V3.0：对比项目数据延迟加载
    this.comparisons = [];
    setTimeout(() => this.loadComparisons(), 120);
    // 确保 overlay 初始为隐藏状态
    this.overlay.classList.remove('active');
    // 确保右键菜单初始为隐藏状态（使用 class 控制，显示时添加 .visible）
    this.contextMenu.classList.remove('visible');
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
    this.enableInspirationCheckbox = document.getElementById('enableInspiration');

    // 标签相关元素
    this.customTagInput = document.getElementById('customTagInput');
    this.selectedTagsContainer = document.getElementById('selectedTagsContainer');
    this.formatTagsContainer = document.getElementById('formatTags');
    this.genreTagsContainer = document.getElementById('genreTags');
    this.currentTags = []; // 当前表单中的标签数组（已选标签）
    // 题材标签列表（单选）
    this.formatTags = ['文学', '小说', '工具', '纪实', '报告文学', '传记', '游戏剧情', '电视剧', '动漫', '电影', '漫画', '学术论文', '哲学', '历史', '社科'];
    // 类型标签列表（多选）
    this.genreTags = ['科幻', '悬疑', '推理', '奇幻', '戏剧', '哲学', '心理', '社会', '恋爱', '治愈', '致郁', '赛博朋克', '硬核'];

    this.addBookBtn = document.getElementById('addBookBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.cancelBtn = document.getElementById('cancelBtn');
    this.sortFieldSelect = document.getElementById('sortField');
    this.sortOrderSelect = document.getElementById('sortOrder');
    // 同步默认排序值到下拉框
    this.sortFieldSelect.value = this.currentSortField;
    this.sortOrderSelect.value = this.currentSortOrder;

    this.bookListContainer = document.getElementById('bookListContainer');
    this.bookFormSection = document.getElementById('bookFormSection');
    this.emptyState = document.getElementById('emptyState');

    this.bookCountElement = document.getElementById('bookCount');

    this.deleteModal = document.getElementById('deleteModal');
    this.overlay = document.getElementById('overlay');
    this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    this.deleteMessage = document.getElementById('deleteMessage');
    this.bookToDelete = null;

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
    this.filterTagsContainer = document.getElementById('kbFilterTagsContainer');

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
    this.previewContent = document.getElementById('importPreviewContent');
    this.importMerge = document.getElementById('importMerge');
    this.confirmImportBtn = document.getElementById('confirmImportBtn');

    // 日记图片上传
    this.journalImageInput = document.getElementById('journalImageInput');
  }

  // 初始化 DOM 缓存（性能优化）
  _initDomCache() {
    this.domCache.bookSection = document.getElementById('bookListSection');
    this.domCache.inspirationSection = document.getElementById('inspirationContainer');
    this.domCache.viewKnowledge = document.getElementById('viewKnowledge');
    this.domCache.viewInspiration = document.getElementById('viewInspiration');
    this.domCache.kbSidebar = document.querySelector('.kb-sidebar');
    this.domCache.kbToolbar = document.querySelector('.kb-toolbar');
    this.domCache.inspirationToolbar = document.querySelector('.inspiration-toolbar');
    this.domCache.inspirationList = document.getElementById('inspirationList');
    this.domCache.inspirationEmptyState = document.getElementById('inspirationEmptyState');
    this.domCache.inspirationFilterPanel = document.getElementById('inspirationFilterPanel');
    this.domCache.filterBookId = document.getElementById('filterBookId');
    this.domCache.filterTagsContainer = document.getElementById('inspirationFilterTagsContainer');
    this.domCache.filterDateFrom = document.getElementById('filterDateFrom');
    this.domCache.filterDateTo = document.getElementById('filterDateTo');
    // V3.0 对比分析视图
    this.domCache.viewComparison = document.getElementById('viewComparison');
    this.domCache.comparisonSection = document.getElementById('comparisonContainer');
    this.domCache.comparisonListView = document.getElementById('comparisonListView');
    this.domCache.comparisonWorkspace = document.getElementById('comparisonWorkspace');
    this.domCache.comparisonGrid = document.getElementById('comparisonGrid');
    this.domCache.comparisonEmptyState = document.getElementById('comparisonEmptyState');
    this.domCache.comparisonCount = document.getElementById('comparisonCount');
    // 工作区元素（4a）
    this.domCache.cmpWorkspaceTitle = document.getElementById('cmpWorkspaceTitle');
    this.domCache.cmpWorkspaceCriteria = document.getElementById('cmpWorkspaceCriteria');
    this.domCache.cmpWorkspaceDesc = document.getElementById('cmpWorkspaceDesc');
    this.domCache.cmpWorkspaceBooks = document.getElementById('cmpWorkspaceBooks');
    this.domCache.cmpVersionChips = document.getElementById('cmpVersionChips');
    this.domCache.cmpAnnotationEditor = document.getElementById('cmpAnnotationEditor');
    this.domCache.cmpAnnotationVer = document.getElementById('cmpAnnotationVer');
    this.domCache.cmpAnnotationSaveState = document.getElementById('cmpAnnotationSaveState');
    this.domCache.cmpChartsContainer = document.getElementById('cmpChartsContainer');
    // 评分体系抽屉（4c）
    this.domCache.cmpCriteriaDrawer = document.getElementById('cmpCriteriaDrawer');
    this.domCache.cmpCriteriaVersionList = document.getElementById('cmpCriteriaVersionList');
    this.domCache.cmpCriteriaDiff = document.getElementById('cmpCriteriaDiff');
  }

  bindEvents() {
    // 日记图片上传 - 绑定 file input 事件
    if (this.journalImageInput) {
      this.journalImageInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const readFileAsDataURL = (file) => {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsDataURL(file);
            });
          };

          Promise.all(Array.from(files).map(readFileAsDataURL)).then((dataUrls) => {
            dataUrls.forEach((dataUrl) => {
              const imageData = {
                dataUrl: dataUrl,
                name: files[dataUrls.indexOf(dataUrl)].name,
                path: files[dataUrls.indexOf(dataUrl)].path || files[dataUrls.indexOf(dataUrl)].name
              };
              this.currentJournalImages.push(imageData);
            });
            this.renderJournalImagesPreview();
          });
        }
        // 注意：不要在这里清空 input value，否则会导致选择框重复弹出
      });
    }

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

    // V3.0 对比分析视图按钮
    const newCmpBtn = document.getElementById('newComparisonBtn');
    if (newCmpBtn) newCmpBtn.addEventListener('click', () => this.openNewComparisonDialog());
    const cmpBackBtn = document.getElementById('cmpBackToListBtn');
    if (cmpBackBtn) cmpBackBtn.addEventListener('click', () => { this._flushAnnotationSave(); this._flushDescSave(); this.showComparisonListView(); });

    // 工作区：评价编辑器（WYSIWYG，5a）
    const annoEditor = document.getElementById('cmpAnnotationEditor');
    if (annoEditor) {
      annoEditor.addEventListener('input', () => {
        if (this._imeComposing) { this._scheduleAnnotationSave(); return; }
        this._scheduleAnnotationLiveRender();
        this._scheduleAnnotationSave();
      });
      // IME（中文输入法）合成期间不重渲染，避免吞字/光标乱跳
      annoEditor.addEventListener('compositionstart', () => { this._imeComposing = true; });
      annoEditor.addEventListener('compositionend', () => {
        this._imeComposing = false;
        this._scheduleAnnotationLiveRender();
        this._scheduleAnnotationSave();
      });
      // Enter：插入换行（contenteditable 默认会生成 div，需归一化为纯文本换行）
      annoEditor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });
      annoEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          // 统一用 \n，避免 Chromium 生成 <div>/<br> 打乱行模型
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
        }
      });
      // 光标移动 → 高亮当前行（仅当前行显示标记符，Typora 行为，5a）
      annoEditor.addEventListener('keyup', () => this._updateActiveAnnoLine());
      annoEditor.addEventListener('mouseup', () => this._updateActiveAnnoLine());
      annoEditor.addEventListener('focus', () => this._updateActiveAnnoLine());
      annoEditor.addEventListener('blur', () => {
        annoEditor.querySelectorAll('.md-line.md-active').forEach(l => l.classList.remove('md-active'));
      });
    }
    // 工作区：描述自动保存（blur 时）
    const descInput = document.getElementById('cmpWorkspaceDesc');
    if (descInput) descInput.addEventListener('blur', () => this._flushDescSave());
    // 工作区：刷新版本（4f）/ Fork（4i）
    const refreshBtn = document.getElementById('cmpRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshComparisonVersion());
    const forkBtn = document.getElementById('cmpForkBtn');
    if (forkBtn) forkBtn.addEventListener('click', () => this.openForkDialog());
    // 下钻雷达：层面切换 tab（5e）
    const radarTabs = document.getElementById('cmpRadarTabs');
    if (radarTabs) radarTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.cmp-radar-tab');
      if (!btn) return;
      this._radarDrillLayer = btn.dataset.layer || null;
      this._renderDrillRadar();
    });
    // 评分体系抽屉（4c）
    const criteriaBtn = document.getElementById('cmpCriteriaBtn');
    if (criteriaBtn) criteriaBtn.addEventListener('click', () => this.openCriteriaDrawer());
    const drawerClose = document.getElementById('cmpDrawerCloseBtn');
    if (drawerClose) drawerClose.addEventListener('click', () => this.closeCriteriaDrawer());
    const drawerOverlay = document.getElementById('cmpDrawerOverlay');
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => this.closeCriteriaDrawer());
    const newCriteriaBtn = document.getElementById('cmpNewCriteriaBtn');
    if (newCriteriaBtn) newCriteriaBtn.addEventListener('click', () => this.openForkDialog());
    // 工作区图表自适应窗口
    window.addEventListener('resize', () => {
      if (this.currentView === 'comparison' && this._cmpCharts) {
        Object.values(this._cmpCharts).forEach(ch => { try { ch.resize(); } catch (e) {} });
      }
    });

    // 权重调节面板事件
    const toggleWeightPanelBtn = document.getElementById('toggleWeightPanel');
    if (toggleWeightPanelBtn) {
      toggleWeightPanelBtn.addEventListener('click', () => this.toggleWeightPanel());
    }
    const closeWeightPanelBtn = document.getElementById('closeWeightPanelBtn');
    if (closeWeightPanelBtn) {
      closeWeightPanelBtn.addEventListener('click', () => this.toggleWeightPanel());
    }
    const resetWeightsBtn = document.getElementById('resetWeightsBtn');
    if (resetWeightsBtn) {
      resetWeightsBtn.addEventListener('click', () => this.resetWeights());
    }

    // 灵感表单事件
    const inspirationForm = document.getElementById('inspirationForm');
    if (inspirationForm) {
      inspirationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(inspirationForm);
        // 手动获取 contenteditable 内容
        const coreTranslationEl = document.getElementById('inspirationCoreTranslation');
        formData.set('coreTranslation', coreTranslationEl.innerHTML);
        this.saveInspiration(formData);
      });

      // 灵感标签点击事件
      inspirationForm.addEventListener('click', (e) => {
        const presetTag = e.target.closest('.preset-tag');
        if (presetTag) {
          const tag = presetTag.textContent.trim();
          this.toggleInspirationTag(tag);
          return;
        }
        const removeTag = e.target.closest('.remove-tag');
        if (removeTag) {
          const tagSpan = removeTag.closest('.selected-tag');
          const tag = tagSpan.textContent.trim().replace('×', '').trim();
          this.removeInspirationTag(tag);
          return;
        }
      });
    }

    // 灵感搜索框防抖事件
    const inspirationSearch = document.getElementById('inspirationSearch');
    if (inspirationSearch) {
      let inspirationSearchTimeout;
      inspirationSearch.addEventListener('input', (e) => {
        clearTimeout(inspirationSearchTimeout);
        inspirationSearchTimeout = setTimeout(() => {
          this.currentInspirationSearchTerm = e.target.value.trim();
          this.renderInspirationList();
        }, 300);
      });
    }

    // 灵感筛选面板 - 点击外部关闭
    document.addEventListener('click', (e) => {
      const panel = this.domCache.inspirationFilterPanel;
      const filterBtn = document.getElementById('filterBtn');
      if (!panel || !panel.classList.contains('visible')) return;

      // 如果点击在面板内或筛选按钮内，不关闭
      if (panel.contains(e.target) || (filterBtn && filterBtn.contains(e.target))) return;

      // 关闭面板
      panel.classList.remove('visible');
    });

    // 灵感删除确认事件
    const confirmInspirationDeleteBtn = document.getElementById('confirmInspirationDeleteBtn');
    if (confirmInspirationDeleteBtn) {
      confirmInspirationDeleteBtn.addEventListener('click', () => this.confirmDeleteInspiration());
    }

    const cancelInspirationDeleteBtn = document.getElementById('cancelInspirationDeleteBtn');
    if (cancelInspirationDeleteBtn) {
      cancelInspirationDeleteBtn.addEventListener('click', () => this.cancelDeleteInspiration());
    }

    // 复习功能事件绑定
    document.getElementById('startReviewBtn')?.addEventListener('click', () => this.startReview());
    document.getElementById('exitReviewBtn')?.addEventListener('click', () => this.exitReview());
    document.getElementById('btnReviewAgain')?.addEventListener('click', () => this.answerReview(false));
    document.getElementById('btnReviewRemembered')?.addEventListener('click', () => this.answerReview(true));
    document.getElementById('reviewDoneBtn')?.addEventListener('click', () => this.exitReview());
    document.getElementById('btnReviewAgainRound')?.addEventListener('click', () => this.startReview());
    document.getElementById('reviewCard')?.addEventListener('click', () => this.flipCard());

    this.fileDropArea?.addEventListener('click', () => this.importFile?.click());
    this.fileDropArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.fileDropArea?.addEventListener('drop', (e) => this.handleFileDrop(e));

    this.sortFieldSelect?.addEventListener('change', (e) => {
      this.currentSortField = e.target.value;
      this.renderBooks();
    });

    this.sortOrderSelect?.addEventListener('change', (e) => {
      this.currentSortOrder = e.target.value;
      this.renderBooks();
    });

    this.confirmDeleteBtn?.addEventListener('click', () => this.confirmDelete());
    this.cancelDeleteBtn?.addEventListener('click', () => this.hideDeleteModal());

    // 点击overlay时关闭所有模态框
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.closeAllModals();
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

    // 灵感筛选面板 - 标签按钮点击事件
    document.addEventListener('click', (e) => {
      // 标签筛选
      if (e.target.classList.contains('filter-tag-pill')) {
        e.target.classList.toggle('selected');
      }
      // 时间筛选
      if (e.target.classList.contains('time-pill')) {
        document.querySelectorAll('.time-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');

        // 如果选择"自定义"显示日期选择器
        const dateRange = document.querySelector('.filter-date-range');
        if (dateRange) {
          dateRange.style.display = e.target.dataset.time === 'custom' ? 'flex' : 'none';
        }
      }
    });

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
      this.overlay.classList.remove('active');
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
      this.overlay.classList.remove('active');
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
    try {
      const books = await this.storageService.loadBooks();
      this.renderBooks();
      this.renderFolders();
      this.updateBookCount();
    } catch (error) {
      console.error('加载书籍失败:', error);
    }
  }

  // 加载日记
  async loadJournals() {
    try {
      let inspirationsData;
      if (window.electronAPI && typeof window.electronAPI.loadInspirations === 'function') {
        inspirationsData = await window.electronAPI.loadInspirations();
      } else {
        const stored = localStorage.getItem('mybook_inspirations');
        inspirationsData = stored ? JSON.parse(stored) : [];
      }
      this.inspirations = inspirationsData.map(j => InspirationEntry.fromJSON(j));
      this._checkTodayReviewed();
      return this.inspirations;
    } catch (error) {
      console.error('加载灵感失败:', error);
      this.inspirations = [];
      return [];
    }
  }

  // 保存灵感
  async saveInspirations() {
    try {
      const data = this.inspirations.map(j => j.toJSON());
      if (window.electronAPI && typeof window.electronAPI.saveInspirations === 'function') {
        await window.electronAPI.saveInspirations(data);
      } else {
        localStorage.setItem('mybook_inspirations', JSON.stringify(data));
      }
      return true;
    } catch (error) {
      console.error('保存灵感失败:', error);
      return false;
    }
  }

  // 视图切换（使用 DOM 缓存优化）
  switchView(viewName, bookId = null) {
    // 使用缓存的 DOM 引用
    const c = this.domCache;

    log('switchView called:', viewName, bookId);

    this.currentView = viewName;
    this.currentInspirationFilterBookId = bookId;

    // 离开对比视图时释放图表实例，并 flush 未保存的评价/描述
    if (viewName !== 'comparison' && this._cmpCharts) {
      this._flushAnnotationSave();
      this._flushDescSave();
      this._disposeComparisonCharts();
    }

    // V3.0：对比分析视图（与知识库/灵感记录平级）
    if (viewName === 'comparison') {
      this._cleanupReviewState();
      // 隐藏知识库
      if (c.kbSidebar) c.kbSidebar.style.display = 'none';
      if (c.kbToolbar) c.kbToolbar.style.display = 'none';
      if (c.bookSection) c.bookSection.style.display = 'none';
      // 隐藏灵感
      if (c.inspirationToolbar) c.inspirationToolbar.style.display = 'none';
      if (c.inspirationSection) c.inspirationSection.style.display = 'none';
      // 显示对比分析
      if (c.comparisonSection) c.comparisonSection.style.display = 'block';
      // 切换按钮状态
      if (c.viewKnowledge) c.viewKnowledge.classList.remove('active');
      if (c.viewInspiration) c.viewInspiration.classList.remove('active');
      if (c.viewComparison) c.viewComparison.classList.add('active');
      // 清灵感筛选
      this.currentInspirationFilterBookId = null;
      this.inspirationFilters.lockedBookId = null;
      this._hideLockedBookIndicator();
      // 渲染列表（默认回到列表页）
      requestAnimationFrame(() => {
        this.showComparisonListView();
      });
      return;
    }

    if (viewName === 'inspiration') {
      // 步骤1：立即执行 DOM 显示切换（视觉快速响应）
      if (c.kbSidebar) c.kbSidebar.style.display = 'none';
      if (c.kbToolbar) c.kbToolbar.style.display = 'none';
      if (c.bookSection) c.bookSection.style.display = 'none';
      if (c.comparisonSection) c.comparisonSection.style.display = 'none';

      // 显示灵感模块
      if (c.inspirationToolbar) c.inspirationToolbar.style.display = 'flex';
      if (c.inspirationSection) c.inspirationSection.style.display = 'block';

      // 如果之前在复习中，清理复习DOM状态（但不重新渲染列表，下面会统一渲染）
      this._cleanupReviewState();

      // 更新切换按钮状态
      if (c.viewKnowledge) c.viewKnowledge.classList.remove('active');
      if (c.viewComparison) c.viewComparison.classList.remove('active');
      if (c.viewInspiration) c.viewInspiration.classList.add('active');

      // 如果是从作品转跳过来，锁定作品筛选
      if (bookId) {
        this.inspirationFilters.bookId = bookId;
        this.inspirationFilters.lockedBookId = bookId; // 标记为锁定状态
        // 更新筛选面板的下拉框显示
        if (c.filterBookId) {
          c.filterBookId.value = bookId;
        }
        // 更新锁定书籍指示器
        this._updateLockedBookIndicator();
      }

      // 步骤2：异步执行渲染（不阻塞 UI）
      requestAnimationFrame(() => {
        this.renderInspirationList();
      });
    } else {
      // 如果之前在复习中，清理复习DOM状态
      this._cleanupReviewState();

      // 隐藏灵感模块
      if (c.inspirationToolbar) c.inspirationToolbar.style.display = 'none';
      if (c.inspirationSection) c.inspirationSection.style.display = 'none';
      // 隐藏对比分析
      if (c.comparisonSection) c.comparisonSection.style.display = 'none';

      // 显示知识库模块
      if (c.kbSidebar) c.kbSidebar.style.display = 'block';
      if (c.kbToolbar) c.kbToolbar.style.display = 'flex';
      if (c.bookSection) c.bookSection.style.display = 'block';

      // 更新切换按钮状态
      if (c.viewInspiration) c.viewInspiration.classList.remove('active');
      if (c.viewComparison) c.viewComparison.classList.remove('active');
      if (c.viewKnowledge) c.viewKnowledge.classList.add('active');

      // 清除灵感筛选状态
      this.currentInspirationFilterBookId = null;
      this.inspirationFilters.lockedBookId = null;
      this._hideLockedBookIndicator();
    }
  }

  // ============================================================
  // V3.0 对比分析（Comparison）数据层 + 列表页
  // ============================================================
  async loadComparisons() {
    try {
      if (window.electronAPI && typeof window.electronAPI.loadComparisons === 'function') {
        const arr = await window.electronAPI.loadComparisons();
        this.comparisons = Array.isArray(arr) ? arr : [];
      } else {
        this.comparisons = [];
      }
      log('对比项目已加载, 数量:', this.comparisons.length);
    } catch (e) {
      console.error('加载对比项目失败:', e);
      this.comparisons = [];
    }
    // 若当前正处于对比视图，刷新列表
    if (this.currentView === 'comparison') this.showComparisonListView();
  }

  async saveComparisons() {
    try {
      if (window.electronAPI && typeof window.electronAPI.saveComparisons === 'function') {
        const result = await window.electronAPI.saveComparisons(this.comparisons);
        return result && result.success === true;
      }
      return false;
    } catch (e) {
      console.error('保存对比项目失败:', e);
      return false;
    }
  }

  // 显示列表页（隐藏工作区）
  showComparisonListView() {
    const c = this.domCache;
    this._disposeComparisonCharts();
    if (c.comparisonWorkspace) c.comparisonWorkspace.style.display = 'none';
    if (c.comparisonListView) c.comparisonListView.style.display = 'block';
    this.renderComparisonList();
  }

  // 渲染项目卡片网格（意图 2：评估项目状态）
  renderComparisonList() {
    const c = this.domCache;
    if (!c.comparisonGrid) return;

    const list = this.comparisons || [];
    if (c.comparisonCount) c.comparisonCount.textContent = list.length > 0 ? `${list.length} 个项目` : '';

    if (list.length === 0) {
      c.comparisonGrid.innerHTML = '';
      if (c.comparisonEmptyState) c.comparisonEmptyState.style.display = 'block';
      return;
    }
    if (c.comparisonEmptyState) c.comparisonEmptyState.style.display = 'none';

    // 按 updatedAt 倒序
    const sorted = [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    c.comparisonGrid.innerHTML = sorted.map(cmp => this._renderComparisonCard(cmp)).join('');

    // 绑定卡片点击
    c.comparisonGrid.querySelectorAll('.cmp-card').forEach(el => {
      el.addEventListener('click', () => this.openComparisonWorkspace(el.dataset.id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openComparisonWorkspace(el.dataset.id); }
      });
    });
    // 绑定删除按钮（两步内联确认，阻止冒泡到卡片打开）
    c.comparisonGrid.querySelectorAll('.cmp-card-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.requestDeleteComparison(btn.dataset.delId);
      });
    });
  }

  // 单张卡片 HTML
  _renderComparisonCard(cmp) {
    const tip = this._getComparisonTipVersion(cmp);
    const criteriaVersionId = tip ? tip.criteriaVersionId : null;
    const criteriaLabel = criteriaVersionId || '—';

    // 涉及的书标题（按 bookId 反查，含已删除书）
    const bookTitles = (tip && Array.isArray(tip.bookRefs) ? tip.bookRefs : [])
      .map(ref => {
        const book = this.storageService.bookMap.get(ref.bookId);
        return book ? book.title : '（已删除作品）';
      });
    const booksText = bookTitles.length > 0
      ? bookTitles.map(t => `《${this.escapeHtml(t)}》`).join(' ')
      : '<span style="opacity:0.6">未选择作品</span>';

    // 版本结构概览
    const versions = Array.isArray(cmp.versions) ? cmp.versions : [];
    const mainCount = versions.filter(v => (v.branchName || 'main') === 'main').length;
    const expCount = versions.length - mainCount;
    const versionSummary = `主线 ${mainCount} 版${expCount > 0 ? ` · 实验 ${expCount}` : ''}`;

    const relTime = this._relativeTime(cmp.updatedAt);
    const desc = cmp.description ? this.escapeHtml(cmp.description.split('\n')[0]) : '';
    const stale = this._isComparisonStale(cmp);

    return `
      <div class="cmp-card" data-id="${cmp.id}" tabindex="0" role="button" aria-label="打开对比项目 ${this.escapeHtml(cmp.title || '')}">
        <button class="cmp-card-del" data-del-id="${cmp.id}" title="删除此对比项目" aria-label="删除此对比项目">
          <i class="fas fa-trash"></i>
        </button>
        <div class="cmp-card-head">
          <h3 class="cmp-card-title">${this.escapeHtml(cmp.title || '未命名对比')}</h3>
          <span class="cmp-card-criteria" title="评分体系版本">${this.escapeHtml(criteriaLabel)}</span>
        </div>
        ${desc ? `<p class="cmp-card-desc">${desc}</p>` : ''}
        <div class="cmp-card-books">${booksText}</div>
        <div class="cmp-card-meta">
          <span>${versionSummary}</span>
          <span>${relTime}</span>
        </div>
        ${stale ? `<span class="cmp-card-stale"><i class="fas fa-exclamation-triangle"></i> 有作品评分已更新</span>` : ''}
      </div>
    `;
  }

  // 取主线末端版本
  _getComparisonTipVersion(cmp) {
    if (!cmp || !Array.isArray(cmp.versions) || cmp.versions.length === 0) return null;
    if (cmp.mainBranchTipId) {
      const tip = cmp.versions.find(v => v.id === cmp.mainBranchTipId);
      if (tip) return tip;
    }
    // 回退：最后一个 main 分支版本，再回退到最后一个
    const mains = cmp.versions.filter(v => (v.branchName || 'main') === 'main');
    return mains.length > 0 ? mains[mains.length - 1] : cmp.versions[cmp.versions.length - 1];
  }

  // 检测过期：主线末端版本里任一书的 ratingHistory 最新条目 id 已不等于 bookRefs 记录的 ratingEntryId
  _isComparisonStale(cmp) {
    const tip = this._getComparisonTipVersion(cmp);
    if (!tip || !Array.isArray(tip.bookRefs)) return false;
    return tip.bookRefs.some(ref => {
      const book = this.storageService.bookMap.get(ref.bookId);
      if (!book || !Array.isArray(book.ratingHistory) || book.ratingHistory.length === 0) return false;
      const latestId = book.ratingHistory[book.ratingHistory.length - 1].id;
      return ref.ratingEntryId && latestId !== ref.ratingEntryId;
    });
  }

  // 相对时间
  _relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const diff = Date.now() - then;
    const day = 24 * 3600 * 1000;
    if (diff < 3600 * 1000) return '刚刚';
    if (diff < day) return `${Math.floor(diff / (3600 * 1000))} 小时前`;
    if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
    return new Date(iso).toLocaleDateString('zh-CN');
  }

  // 新建对比项目对话框（modal：命名 + 多选已评分作品）
  openNewComparisonDialog() {
    const rated = this.storageService.books.filter(b => !b.deleted && Array.isArray(b.ratingHistory) && b.ratingHistory.length > 0);
    if (rated.length < 2) {
      this.showToast('需要至少 2 本已评分的作品才能创建对比', 'warning');
      return;
    }

    const modal = document.getElementById('newComparisonModal');
    const titleInput = document.getElementById('cmpNewTitle');
    const picker = document.getElementById('cmpNewBookPicker');
    const hint = document.getElementById('cmpNewHint');
    let createBtn = document.getElementById('cmpNewCreateBtn');
    if (!modal || !titleInput || !picker || !createBtn) return;

    // 先克隆替换创建按钮以清除旧 handler，并拿到 live 引用（后续 updateHint 必须操作它）
    const freshCreateBtn = createBtn.cloneNode(true);
    createBtn.parentNode.replaceChild(freshCreateBtn, createBtn);
    createBtn = freshCreateBtn;
    createBtn.addEventListener('click', () => this._confirmCreateComparison());

    // 重置
    titleInput.value = '';
    this._cmpNewSelected = new Set();

    // 渲染可选书列表
    picker.innerHTML = rated.map(b => {
      const latest = b.ratingHistory[b.ratingHistory.length - 1];
      const score = typeof latest.totalScore === 'number' ? latest.totalScore.toFixed(1) : '—';
      return `
        <label class="cmp-book-option" data-id="${b.id}">
          <input type="checkbox" value="${b.id}">
          <span class="cmp-book-option-title">${this.escapeHtml(b.title)}</span>
          <span class="cmp-book-option-score">${score}</span>
        </label>
      `;
    }).join('');

    const updateHint = () => {
      const n = this._cmpNewSelected.size;
      if (hint) hint.textContent = `已选 ${n} 部`;
      createBtn.disabled = n < 2;
      createBtn.style.opacity = n < 2 ? '0.5' : '1';
      createBtn.style.cursor = n < 2 ? 'not-allowed' : 'pointer';
    };
    updateHint();

    picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) this._cmpNewSelected.add(cb.value);
        else this._cmpNewSelected.delete(cb.value);
        const opt = cb.closest('.cmp-book-option');
        if (opt) opt.classList.toggle('selected', cb.checked);
        updateHint();
      });
    });

    modal.style.display = 'flex';
    if (this.overlay) this.overlay.classList.add('active');
    setTimeout(() => titleInput.focus(), 50);
  }

  closeNewComparisonModal() {
    const modal = document.getElementById('newComparisonModal');
    if (modal) modal.style.display = 'none';
    if (this.overlay) this.overlay.classList.remove('active');
    this._cmpNewSelected = null;
  }

  async _confirmCreateComparison() {
    const titleInput = document.getElementById('cmpNewTitle');
    const title = (titleInput ? titleInput.value : '').trim() || '未命名对比';
    const ids = Array.from(this._cmpNewSelected || []);
    if (ids.length < 2) {
      this.showToast('请至少选择 2 部作品', 'warning');
      return;
    }
    const books = ids.map(id => this.storageService.bookMap.get(id)).filter(Boolean);
    const cmp = this._buildNewComparison(title, books);
    this.comparisons.push(cmp);
    const ok = await this.saveComparisons();
    if (!ok) {
      this.comparisons = this.comparisons.filter(x => x.id !== cmp.id);
      this.showToast('创建失败', 'error');
      return;
    }
    this.closeNewComparisonModal();
    this.showToast('对比项目已创建', 'success');
    this.renderComparisonList();
    this.openComparisonWorkspace(cmp.id);
  }

  // 构造一个新的 Comparison 对象（含 v1 版本）
  _buildNewComparison(title, books) {
    const now = new Date().toISOString();
    const id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const versionId = 'ver_v1';
    const bookRefs = books.map(b => ({
      bookId: b.id,
      ratingEntryId: (Array.isArray(b.ratingHistory) && b.ratingHistory.length > 0)
        ? b.ratingHistory[b.ratingHistory.length - 1].id
        : null
    }));
    return {
      id,
      title,
      description: '',
      createdAt: now,
      updatedAt: now,
      mainBranchTipId: versionId,
      versions: [
        {
          id: versionId,
          parentId: null,
          branchName: 'main',
          createdAt: now,
          createReason: 'initial',
          forkNote: '',
          criteriaVersionId: getCurrentCriteriaVersionId(),
          bookRefs,
          annotation: ''
        }
      ]
    };
  }

  // 打开工作区（4a：双列布局 + 版本时间线 + 评价编辑器）
  openComparisonWorkspace(comparisonId) {
    const cmp = (this.comparisons || []).find(x => x.id === comparisonId);
    if (!cmp) { this.showToast('对比项目不存在', 'error'); return; }
    this._activeComparisonId = comparisonId;
    // 默认查看主线末端版本（决策 C-3：默认 mainBranchTipId，不记忆）
    const tip = this._getComparisonTipVersion(cmp);
    this._activeVersionId = tip ? tip.id : null;

    const c = this.domCache;
    if (c.comparisonListView) c.comparisonListView.style.display = 'none';
    if (c.comparisonWorkspace) c.comparisonWorkspace.style.display = 'block';

    this.renderComparisonWorkspace();
  }

  // 取当前活动的对比项目 / 版本
  _getActiveComparison() {
    return (this.comparisons || []).find(x => x.id === this._activeComparisonId) || null;
  }
  _getActiveVersion() {
    const cmp = this._getActiveComparison();
    if (!cmp || !Array.isArray(cmp.versions)) return null;
    return cmp.versions.find(v => v.id === this._activeVersionId)
      || this._getComparisonTipVersion(cmp);
  }

  // 渲染整个工作区（meta + chips + 评价）
  renderComparisonWorkspace() {
    const cmp = this._getActiveComparison();
    if (!cmp) return;
    const version = this._getActiveVersion();
    const c = this.domCache;

    // 标题
    if (c.cmpWorkspaceTitle) c.cmpWorkspaceTitle.textContent = cmp.title || '对比项目';

    // criteria 版本角标
    if (c.cmpWorkspaceCriteria) {
      const vid = version ? version.criteriaVersionId : null;
      c.cmpWorkspaceCriteria.textContent = vid || '—';
      const meta = vid ? getCriteriaVersionMeta(vid) : null;
      c.cmpWorkspaceCriteria.title = meta ? `${meta.name}（${vid}）` : (vid || '');
    }

    // 描述（项目级）
    if (c.cmpWorkspaceDesc) {
      c.cmpWorkspaceDesc.value = cmp.description || '';
    }

    // 涉及的书
    if (c.cmpWorkspaceBooks) {
      const refs = version && Array.isArray(version.bookRefs) ? version.bookRefs : [];
      c.cmpWorkspaceBooks.innerHTML = refs.map(ref => {
        const book = this.storageService.bookMap.get(ref.bookId);
        const title = book ? book.title : '（已删除作品）';
        return `《${this.escapeHtml(title)}》`;
      }).join(' ');
    }

    // 版本时间线 chip-rail
    this.renderVersionChips();

    // 评价编辑器（WYSIWYG，5a）：写入源码并即时渲染
    if (c.cmpAnnotationEditor) {
      const text = version ? (version.annotation || '') : '';
      c.cmpAnnotationEditor.innerHTML = renderMarkdownLive(text);
      c.cmpAnnotationEditor.classList.toggle('is-empty', text.length === 0);
    }
    if (c.cmpAnnotationVer) {
      c.cmpAnnotationVer.textContent = version ? `(${version.id.replace('ver_', '')})` : '';
    }
    if (c.cmpAnnotationSaveState) c.cmpAnnotationSaveState.textContent = '';

    // 渲染图表（4b）
    this.renderComparisonCharts();
  }

  // ============================================================
  // 4b：工作区图表（按版本 criteria 重算，决策 6-E 新功能重算）
  // ============================================================

  // 解析某版本的图表数据：每本书在「该版本 ratingEntry」下的 rating_details
  // + 该版本 criteriaVersionId 对应的 criteria。返回 { criteria, books:[{id,title,details,scores}], ok }
  _resolveComparisonData(version) {
    if (!version) return { ok: false };
    const warnings = [];
    // 过期提示只在「主线最新版本」上有意义：历史版本是时间凝固快照，保留旧评分是预期行为
    const cmp = this._getActiveComparison();
    const tip = cmp ? this._getComparisonTipVersion(cmp) : null;
    const isTip = tip && tip.id === version.id;
    let criteria = getCriteriaByVersionId(version.criteriaVersionId);
    if (!criteria) {
      criteria = RATING_CRITERIA;
      if (criteria) warnings.push(`评分体系版本「${version.criteriaVersionId || '未知'}」已缺失，已回退到当前默认体系，分数仅供参考`);
    }
    if (!criteria) return { ok: false };

    let deletedCount = 0, fallbackEntryCount = 0, staleCount = 0;
    const books = (version.bookRefs || []).map(ref => {
      const book = this.storageService.bookMap.get(ref.bookId);
      const isDeleted = !book || book.deleted;
      const title = book ? book.title : '（已删除作品）';
      if (isDeleted) deletedCount++;
      // 找到 ref.ratingEntryId 对应的那条评分；找不到回退到最新一条
      let details = {};
      if (book && Array.isArray(book.ratingHistory) && book.ratingHistory.length > 0) {
        let entry = book.ratingHistory.find(e => e.id === ref.ratingEntryId);
        if (!entry) { entry = book.ratingHistory[book.ratingHistory.length - 1]; if (ref.ratingEntryId) fallbackEntryCount++; }
        details = entry.rating_details || {};
        // 引用的快照不是该书最新评分 → 过期（仅主线最新版本才提示）
        const latestId = book.ratingHistory[book.ratingHistory.length - 1].id;
        if (isTip && ref.ratingEntryId && entry.id === ref.ratingEntryId && latestId !== ref.ratingEntryId) staleCount++;
      } else if (book && book.rating_details) {
        details = book.rating_details;
      }
      const scores = calculateWeightedScores({ rating_details: details }, criteria);
      return { id: ref.bookId, title, details, scores, deleted: isDeleted };
    });

    if (deletedCount > 0) warnings.push(`${deletedCount} 本作品已被删除，仍按快照引用显示`);
    if (fallbackEntryCount > 0) warnings.push(`${fallbackEntryCount} 本作品的评分快照已失效，已回退到最新评分`);
    if (staleCount > 0) warnings.push(`${staleCount} 本作品评分已更新，此版本仍显示创建时的快照（可"刷新版本"获取最新）`);

    return { ok: books.length > 0, criteria, books, warnings };
  }

  // 调度：渲染当前版本的全部图表
  renderComparisonCharts() {
    const version = this._getActiveVersion();
    const data = this._resolveComparisonData(version);
    const container = this.domCache.cmpChartsContainer || document.getElementById('cmpChartsContainer');
    const empty = document.getElementById('cmpChartsEmpty');

    if (!data.ok) {
      if (container) container.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (container) container.style.display = 'block';
    if (empty) empty.style.display = 'none';

    // 5d：引用缺失/降级警告横条
    this._renderComparisonWarnings(data.warnings);

    // 颜色板（每本书一个色）
    this._cmpColors = ['#2563EB', '#059669', '#DC2626', '#F59E0B', '#7C3AED', '#0891B2', '#DB2777', '#475569'];

    this._renderCmpTotals(data);
    this._cmpData = data; // 下钻雷达复用
    // 每次重渲染默认回到层面视图
    this._radarDrillLayer = null;
    // ECharts 容器需要可见尺寸；用 rAF 确保布局完成
    requestAnimationFrame(() => {
      this._renderDrillRadar();
    });
  }

  _cmpIsDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // 5d：渲染引用缺失/降级警告横条
  _renderComparisonWarnings(warnings) {
    const el = document.getElementById('cmpChartsWarn');
    if (!el) return;
    if (!warnings || warnings.length === 0) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const items = warnings.map(w => `<li>${this.escapeHtml(w)}</li>`).join('');
    el.innerHTML = `<i class="fas fa-triangle-exclamation"></i><div class="cmp-warn-body"><strong>引用提示</strong><ul>${items}</ul></div>`;
    el.style.display = 'flex';
  }

  // 获取/创建 ECharts 实例（按容器 id 缓存，复用避免泄漏）
  _cmpChart(domId) {
    if (!this._cmpCharts) this._cmpCharts = {};
    const dom = document.getElementById(domId);
    if (!dom) return null;
    if (this._cmpCharts[domId]) {
      try { this._cmpCharts[domId].dispose(); } catch (e) {}
    }
    this._cmpCharts[domId] = echarts.init(dom, null, { renderer: 'canvas' });
    return this._cmpCharts[domId];
  }

  // 综合得分卡片（按总分排名，第一名高亮）
  _renderCmpTotals(data) {
    const el = document.getElementById('cmpChartTotals');
    if (!el) return;
    const ranked = [...data.books].sort((a, b) => b.scores.total - a.scores.total);
    const topId = ranked.length > 0 ? ranked[0].id : null;
    el.innerHTML = data.books.map(b => `
      <div class="cmp-total-card${b.id === topId ? ' rank-1' : ''}">
        <div class="cmp-total-card-title" title="${this.escapeHtml(b.title)}">${this.escapeHtml(b.title)}</div>
        <div class="cmp-total-card-score">${(b.scores.total + 50).toFixed(1)}</div>
      </div>
    `).join('');
  }

  // 层面堆叠柱状图
  _renderCmpStackedBar(data) {
    const chart = this._cmpChart('cmpChartStackedBar');
    if (!chart) return;
    const dark = this._cmpIsDark();
    const axisColor = dark ? '#94A3B8' : '#475569';
    const names = data.books.map(b => b.title);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['作者层面', '文本层面', '读者层面'], textStyle: { color: axisColor }, top: 0 },
      grid: { left: 8, right: 16, bottom: 8, top: 32, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { color: axisColor, interval: 0, rotate: names.length > 3 ? 20 : 0 }, axisLine: { lineStyle: { color: axisColor } } },
      yAxis: { type: 'value', axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } } },
      series: [
        { name: '作者层面', type: 'bar', stack: 'total', data: data.books.map(b => +b.scores.authorLayer.toFixed(2)), itemStyle: { color: '#2563EB' } },
        { name: '文本层面', type: 'bar', stack: 'total', data: data.books.map(b => +b.scores.textLayer.toFixed(2)), itemStyle: { color: '#059669' } },
        { name: '读者层面', type: 'bar', stack: 'total', data: data.books.map(b => +b.scores.readerLayer.toFixed(2)), itemStyle: { color: '#F59E0B' } }
      ]
    });
  }

  // 维度热力图（行=维度，列=书）
  _renderCmpHeatmap(data) {
    const chart = this._cmpChart('cmpChartHeatmap');
    if (!chart) return;
    const dark = this._cmpIsDark();
    const axisColor = dark ? '#94A3B8' : '#475569';
    const dims = [];
    ['author_layer', 'text_layer', 'reader_layer'].forEach(layer => {
      (data.criteria[layer] || []).forEach(d => dims.push(d));
    });
    const bookNames = data.books.map(b => b.title);
    const dimNames = dims.map(d => d.name);
    const points = [];
    data.books.forEach((b, bi) => {
      dims.forEach((d, di) => {
        const v = b.details[d.id] || 0;
        points.push([bi, di, v]);
      });
    });
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        formatter: (p) => `${bookNames[p.data[0]]}<br/>${dimNames[p.data[1]]}: ${p.data[2]}`
      },
      grid: { left: 8, right: 16, top: 8, bottom: 40, containLabel: true },
      xAxis: { type: 'category', data: bookNames, axisLabel: { color: axisColor, interval: 0, rotate: bookNames.length > 3 ? 20 : 0 }, splitArea: { show: true, areaStyle: { color: dark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } } },
      yAxis: { type: 'category', data: dimNames, axisLabel: { color: axisColor, fontSize: 10 }, splitArea: { show: true, areaStyle: { color: dark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } } },
      visualMap: {
        min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
        inRange: { color: dark ? ['#7F1D1D', '#1E293B', '#065F46'] : ['#DC2626', '#F1F5F9', '#059669'] },
        textStyle: { color: axisColor }
      },
      series: [{
        type: 'heatmap', data: points,
        label: { show: true, color: dark ? '#E2E8F0' : '#0F172A', fontSize: 10 },
        itemStyle: { borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } }
      }]
    });
  }

  // 可下钻雷达（5e）：默认层面视图（作者/文本/读者），点轴下钻到该层细维度
  // 层面映射
  _radarLayers() {
    return [
      { key: 'author_layer', name: '作者层面', scoreKey: 'authorLayer' },
      { key: 'text_layer', name: '文本层面', scoreKey: 'textLayer' },
      { key: 'reader_layer', name: '读者层面', scoreKey: 'readerLayer' }
    ];
  }

  // 某层面的归一化得分（层面加权和 ÷ 该层权重总和，落到 -1~1，便于与细维度同标度）
  _layerNormScore(book, criteria, layerKey, scoreKey) {
    const dims = criteria[layerKey] || [];
    const wsum = dims.reduce((s, d) => s + (d.weight || 0), 0);
    if (wsum <= 0) return 0;
    return (book.scores[scoreKey] || 0) / wsum;
  }

  _renderDrillRadar() {
    const data = this._cmpData;
    if (!data) return;
    const chart = this._cmpChart('cmpChartDrillRadar');
    if (!chart) return;
    const dark = this._cmpIsDark();
    const axisColor = dark ? '#94A3B8' : '#666';
    const layers = this._radarLayers();
    const drill = this._radarDrillLayer; // null=层面视图；否则为 layerKey

    // 更新标题 + tab 高亮
    const titleEl = document.getElementById('cmpRadarTitle');
    document.querySelectorAll('#cmpRadarTabs .cmp-radar-tab').forEach(b => {
      b.classList.toggle('active', (b.dataset.layer || '') === (drill || ''));
    });
    let indicator, valueOf;
    if (!drill) {
      if (titleEl) titleEl.textContent = '层面对比雷达';
      // 各层面用实际加权总分；满分=该层权重总和（轴 max 各不同），可正可负
      indicator = layers.map(L => {
        const wsum = (data.criteria[L.key] || []).reduce((s, d) => s + (d.weight || 0), 0);
        return { name: `${L.name}\n(满分${+wsum.toFixed(1)})`, max: +wsum.toFixed(2), min: -wsum };
      });
      valueOf = (b) => layers.map(L => +(b.scores[L.scoreKey] || 0).toFixed(2));
    } else {
      const L = layers.find(x => x.key === drill);
      const dims = data.criteria[drill] || [];
      if (titleEl) titleEl.textContent = `${L ? L.name : ''} · 细维度`;
      // 各维度用加权贡献（原始分 × 权重）；满分=该维度权重
      indicator = dims.map(d => ({ name: `${d.name}\n(满分${+(d.weight || 0).toFixed(1)})`, max: +(d.weight || 0).toFixed(2), min: -(d.weight || 0) }));
      valueOf = (b) => dims.map(d => +((b.details[d.id] || 0) * (d.weight || 0)).toFixed(2));
    }

    const series = [{
      type: 'radar',
      data: data.books.map((b, i) => ({
        value: valueOf(b),
        name: b.title,
        lineStyle: { color: this._cmpColors[i % this._cmpColors.length] },
        itemStyle: { color: this._cmpColors[i % this._cmpColors.length] },
        areaStyle: { opacity: 0.08 }
      }))
    }];

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {},
      legend: { data: data.books.map(b => b.title), textStyle: { color: axisColor, fontSize: 11 }, top: 0, type: 'scroll' },
      radar: {
        indicator, shape: 'polygon', radius: '62%', center: ['50%', '56%'],
        axisName: {
          color: !drill ? (dark ? '#E2E8F0' : '#334155') : axisColor,
          fontSize: !drill ? 13 : 10,
          fontWeight: !drill ? 600 : 400
        },
        splitLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' } },
        splitArea: { areaStyle: { color: dark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } }
      },
      series
    }, true);
  }

  // 释放工作区图表实例
  _disposeComparisonCharts() {
    if (this._cmpCharts) {
      Object.values(this._cmpCharts).forEach(ch => { try { ch.dispose(); } catch (e) {} });
      this._cmpCharts = {};
    }
  }

  // ============================================================
  // 4c-1：评分体系版本抽屉（版本列表 + 切换当前 + diff）
  // ============================================================
  openCriteriaDrawer() {
    const drawer = this.domCache.cmpCriteriaDrawer || document.getElementById('cmpCriteriaDrawer');
    if (!drawer) { console.error('cmpCriteriaDrawer 不存在'); return; }
    // 先显示抽屉，确保关闭按钮一定可用
    drawer.style.display = 'block';
    try {
      this.renderCriteriaVersionList();
    } catch (e) {
      console.error('renderCriteriaVersionList 出错:', e);
    }
    try {
      this._renderCriteriaDiffForActive();
    } catch (e) {
      console.error('_renderCriteriaDiffForActive 出错:', e);
    }
  }

  closeCriteriaDrawer() {
    const drawer = this.domCache.cmpCriteriaDrawer;
    if (drawer) drawer.style.display = 'none';
  }

  renderCriteriaVersionList() {
    const list = this.domCache.cmpCriteriaVersionList;
    if (!list) return;
    const history = RATING_CRITERIA_HISTORY;
    if (!history || !Array.isArray(history.versions)) { list.innerHTML = '<p style="color:var(--cmp-fg-muted)">无版本数据</p>'; return; }

    const currentId = history.currentVersionId;
    list.innerHTML = history.versions.filter(v => !v.deleted).map(v => {
      const isCurrent = v.id === currentId;
      const dimCount = ['author_layer', 'text_layer', 'reader_layer'].reduce((s, k) => s + ((v.criteria[k] || []).length), 0);
      const usedCount = this._countBooksUsingCriteria(v.id);
      return `
        <div class="cmp-criteria-version-row${isCurrent ? ' current' : ''}" data-version-id="${v.id}">
          <span class="cmp-cvr-radio"><i class="fas ${isCurrent ? 'fa-check-circle' : 'fa-circle'}"></i></span>
          <div class="cmp-cvr-main">
            <div class="cmp-cvr-name">${this.escapeHtml(v.name || v.id)}</div>
            <div class="cmp-cvr-meta">${v.id} · ${dimCount} 维度 · ${usedCount} 本书使用</div>
          </div>
          <div class="cmp-cvr-actions">
            ${isCurrent ? '' : `<button class="cmp-cvr-btn" data-act="set-current" data-id="${v.id}">设为当前</button>`}
            <button class="cmp-cvr-btn" data-act="diff" data-id="${v.id}">diff</button>
            ${isCurrent ? '' : `<button class="cmp-cvr-btn cmp-cvr-btn-danger${this._pendingDeleteCriteriaId === v.id ? ' confirming' : ''}" data-act="delete" data-id="${v.id}" title="删除此版本">${this._pendingDeleteCriteriaId === v.id ? '确认删除' : '删除'}</button>`}
          </div>
        </div>
      `;
    }).join('');

    // 绑定操作
    list.querySelectorAll('.cmp-cvr-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.act === 'set-current') this.setCurrentCriteriaVersion(id);
        else if (btn.dataset.act === 'diff') this._renderCriteriaDiff(id);
        else if (btn.dataset.act === 'delete') this.deleteCriteriaVersion(id);
      });
    });
  }

  // 统计有多少本书的最新评分用了某 criteria 版本
  _countBooksUsingCriteria(versionId) {
    let n = 0;
    this.storageService.books.forEach(b => {
      if (b.deleted) return;
      if (Array.isArray(b.ratingHistory) && b.ratingHistory.length > 0) {
        const latest = b.ratingHistory[b.ratingHistory.length - 1];
        if (latest.criteriaVersionId === versionId) n++;
      }
    });
    return n;
  }

  // 统计有多少对比项目版本引用了该评分体系版本
  _countComparisonsUsingCriteria(versionId) {
    let n = 0;
    (this.comparisons || []).forEach(cmp => {
      (cmp.versions || []).forEach(v => { if (v.criteriaVersionId === versionId) n++; });
    });
    return n;
  }

  // 删除评分体系版本（5e 补充）：带引用完整性校验
  // 软删评分体系版本（5e）：标记 deleted 隐藏出列表，但保留数据让对比快照仍可解析
  async deleteCriteriaVersion(versionId) {
    if (!RATING_CRITERIA_HISTORY || !Array.isArray(RATING_CRITERIA_HISTORY.versions)) return;
    const v = RATING_CRITERIA_HISTORY.versions.find(x => x.id === versionId);
    if (!v) return;

    // 当前版本不能删
    if (RATING_CRITERIA_HISTORY.currentVersionId === versionId) {
      this.showToast('这是「当前」评分体系，请先切换到其他版本再删除', 'warning');
      return;
    }
    // 至少保留一个未删除版本
    const aliveCount = RATING_CRITERIA_HISTORY.versions.filter(x => !x.deleted).length;
    if (aliveCount <= 1) {
      this.showToast('至少保留一个评分体系版本', 'warning');
      return;
    }

    // 两步内联确认（Electron 下 confirm() 不可靠）：首次点击进入待确认态
    if (this._pendingDeleteCriteriaId !== versionId) {
      this._pendingDeleteCriteriaId = versionId;
      this.renderCriteriaVersionList();
      const refs = this._countComparisonsUsingCriteria(versionId);
      this.showToast(refs > 0
        ? `该版本被 ${refs} 个对比版本引用，删除后将从列表隐藏（对比快照仍保留）。再次点击「确认删除」`
        : '再次点击「确认删除」以删除该版本', 'info');
      clearTimeout(this._pendingDeleteTimer);
      this._pendingDeleteTimer = setTimeout(() => {
        this._pendingDeleteCriteriaId = null;
        this.renderCriteriaVersionList();
      }, 8000);
      return;
    }
    this._pendingDeleteCriteriaId = null;
    clearTimeout(this._pendingDeleteTimer);

    v.deleted = true;
    const ok = await this._saveCriteriaHistory();
    if (!ok) {
      delete v.deleted;
      this.showToast('删除失败', 'error');
      return;
    }
    this.showToast(`已删除版本「${v.name || versionId}」`, 'success');
    this.renderCriteriaVersionList();
    const el = this.domCache.cmpCriteriaDiff;
    if (el) el.innerHTML = '';
  }

  // 切换当前评分体系版本（之后新评分用它）
  async setCurrentCriteriaVersion(versionId) {
    if (!RATING_CRITERIA_HISTORY) return;
    const v = RATING_CRITERIA_HISTORY.versions.find(x => x.id === versionId);
    if (!v) return;
    RATING_CRITERIA_HISTORY.currentVersionId = versionId;
    RATING_CRITERIA = v.criteria;
    const ok = await this._saveCriteriaHistory();
    if (!ok) { this.showToast('切换失败', 'error'); return; }
    this.showToast(`已切换当前评分体系为 ${v.name || versionId}（仅影响之后的"刷新版本/Fork"，已有对比版本保持快照不变）`, 'success');
    this.renderCriteriaVersionList();
    this._renderCriteriaDiff(versionId);
  }

  async _saveCriteriaHistory() {
    try {
      if (window.electronAPI && typeof window.electronAPI.saveRatingCriteriaHistory === 'function') {
        const r = await window.electronAPI.saveRatingCriteriaHistory(RATING_CRITERIA_HISTORY);
        return r && r.success === true;
      }
    } catch (e) { console.error('保存评分体系历史失败:', e); }
    return false;
  }

  // diff：versionId vs 其 parent
  _renderCriteriaDiff(versionId) {
    const el = this.domCache.cmpCriteriaDiff;
    if (!el || !RATING_CRITERIA_HISTORY) return;
    const v = RATING_CRITERIA_HISTORY.versions.find(x => x.id === versionId);
    if (!v) { el.innerHTML = ''; return; }
    const parent = v.parentId ? RATING_CRITERIA_HISTORY.versions.find(x => x.id === v.parentId) : null;

    if (!parent) {
      const rows0 = [];
      let sum0 = 0;
      ['author_layer', 'text_layer', 'reader_layer'].forEach(k => {
        (v.criteria[k] || []).forEach(d => {
          sum0 += (d.weight || 0);
          rows0.push(`<div class="cmp-diff-row"><span class="cmp-diff-dim">${this.escapeHtml(d.name)}</span><span class="cmp-diff-val same">${d.weight}</span></div>`);
        });
      });
      el.innerHTML = `<div class="cmp-diff-title">${this.escapeHtml(v.name || v.id)}（初始版本 · 权重总和 ${sum0}）</div>${rows0.join('')}`;
      return;
    }

    // 构造 parent 的 id→weight
    const pw = {};
    ['author_layer', 'text_layer', 'reader_layer'].forEach(k => (parent.criteria[k] || []).forEach(d => { pw[d.id] = d.weight; }));

    const rows = [];
    let sumNew = 0, sumOld = 0;
    ['author_layer', 'text_layer', 'reader_layer'].forEach(k => {
      (v.criteria[k] || []).forEach(d => {
        const oldW = pw[d.id];
        const newW = d.weight;
        sumNew += (newW || 0);
        sumOld += (oldW || 0);
        const changed = oldW !== newW;
        let cls = 'same', txt = `${newW}`;
        if (changed) {
          cls = newW > oldW ? 'up' : 'down';
          txt = `${oldW} → ${newW}`;
        }
        rows.push(`<div class="cmp-diff-row${changed ? ' changed' : ''}"><span class="cmp-diff-dim">${this.escapeHtml(d.name)}</span><span class="cmp-diff-val ${cls}">${txt}</span></div>`);
      });
    });
    el.innerHTML = `<div class="cmp-diff-title">diff: ${this.escapeHtml(v.name || v.id)} vs ${this.escapeHtml(parent.name || parent.id)}（总和 ${sumOld} → ${sumNew}）</div>${rows.join('')}`;
  }

  _renderCriteriaDiffForActive() {
    const version = this._getActiveVersion();
    if (version && version.criteriaVersionId) this._renderCriteriaDiff(version.criteriaVersionId);
  }

  // fork dialog 占位（4c-2/3 实现）
  openForkDialog() {
    const cmp = this._getActiveComparison();
    const version = this._getActiveVersion();
    if (!cmp || !version) { this.showToast('请先打开一个对比项目', 'warning'); return; }

    // 若从评分体系抽屉打开，先关抽屉避免层级遮挡；取消时再恢复
    const drawer = document.getElementById('cmpCriteriaDrawer');
    this._forkFromDrawer = !!(drawer && drawer.style.display !== 'none' && getComputedStyle(drawer).display !== 'none');
    if (this._forkFromDrawer) this.closeCriteriaDrawer();

    // 基准 criteria = 当前版本所用的 criteria（深拷贝出可编辑副本）
    const baseCriteria = getCriteriaByVersionId(version.criteriaVersionId) || RATING_CRITERIA;
    if (!baseCriteria) { this.showToast('找不到基准评分体系', 'error'); return; }
    this._forkBaseCriteria = JSON.parse(JSON.stringify(baseCriteria));
    this._forkEditCriteria = JSON.parse(JSON.stringify(baseCriteria));
    this._forkBaseVersionId = version.criteriaVersionId;

    // 重置表单
    const nameInput = document.getElementById('cmpForkName');
    const noteInput = document.getElementById('cmpForkNote');
    if (nameInput) nameInput.value = '';
    if (noteInput) noteInput.value = '';

    this._buildForkSliders();
    this._renderForkPreview();
    this._updateForkSum();

    // 绑定创建按钮（克隆去重）
    let createBtn = document.getElementById('cmpForkCreateBtn');
    if (createBtn) {
      const fresh = createBtn.cloneNode(true);
      createBtn.parentNode.replaceChild(fresh, createBtn);
      fresh.addEventListener('click', () => this._confirmFork());
    }

    const modal = document.getElementById('cmpForkModal');
    if (modal) modal.style.display = 'flex';
    if (this.overlay) this.overlay.classList.add('active');
  }

  closeForkDialog() {
    const modal = document.getElementById('cmpForkModal');
    if (modal) modal.style.display = 'none';
    if (this.overlay) this.overlay.classList.remove('active');
    this._forkBaseCriteria = null;
    this._forkEditCriteria = null;
    // 取消时若来自抽屉，恢复抽屉以便继续管理版本
    if (this._forkFromDrawer) {
      this._forkFromDrawer = false;
      this.openCriteriaDrawer();
    }
  }

  // 5c：Esc 按层级关闭对比视图浮层；关掉一个返回 true
  _handleComparisonEscape() {
    const isShown = (el) => el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    const confirmModal = document.getElementById('cmpConfirmModal');
    if (isShown(confirmModal)) { this.closeConfirmDialog(); return true; }
    const fork = document.getElementById('cmpForkModal');
    if (isShown(fork)) { this.closeForkDialog(); return true; }
    const drawer = document.getElementById('cmpCriteriaDrawer');
    if (isShown(drawer)) { this.closeCriteriaDrawer(); return true; }
    const newModal = document.getElementById('newComparisonModal');
    if (isShown(newModal)) { this.closeNewComparisonModal(); return true; }
    return false;
  }

  // 构建权重滑块（按层分组）
  _buildForkSliders() {
    const container = document.getElementById('cmpForkSliders');
    if (!container || !this._forkEditCriteria) return;
    const layerNames = { author_layer: '作者层面', text_layer: '文本层面', reader_layer: '读者层面' };
    const parts = [];
    ['author_layer', 'text_layer', 'reader_layer'].forEach(layer => {
      const dims = this._forkEditCriteria[layer] || [];
      if (dims.length === 0) return;
      parts.push(`<div class="cmp-drawer-section-label" style="margin-top:8px">${layerNames[layer]}</div>`);
      dims.forEach(dim => {
        parts.push(`
          <div class="cmp-fork-slider-row" data-layer="${layer}" data-dim-id="${dim.id}">
            <span class="cmp-fork-slider-name" title="${this.escapeHtml(dim.name)}">${this.escapeHtml(dim.name)}</span>
            <input type="range" min="0" max="10" step="0.5" value="${dim.weight}">
            <span class="cmp-fork-slider-val">${dim.weight}</span>
          </div>
        `);
      });
    });
    container.innerHTML = parts.join('');

    container.querySelectorAll('.cmp-fork-slider-row').forEach(row => {
      const layer = row.dataset.layer;
      const dimId = row.dataset.dimId;
      const input = row.querySelector('input');
      const valEl = row.querySelector('.cmp-fork-slider-val');
      input.addEventListener('input', () => {
        const newW = parseFloat(input.value);
        valEl.textContent = newW;
        // 更新编辑副本
        const dim = (this._forkEditCriteria[layer] || []).find(d => d.id === dimId);
        if (dim) dim.weight = newW;
        // 标记变化
        const baseDim = (this._forkBaseCriteria[layer] || []).find(d => d.id === dimId);
        row.classList.toggle('changed', baseDim && baseDim.weight !== newW);
        // 实时预览
        this._renderForkPreview();
        this._updateForkSum();
      });
    });
  }

  // 计算编辑副本的权重总和；约束 = 50。返回 sum
  _forkWeightSum() {
    if (!this._forkEditCriteria) return 0;
    let sum = 0;
    ['author_layer', 'text_layer', 'reader_layer'].forEach(layer => {
      (this._forkEditCriteria[layer] || []).forEach(d => { sum += (d.weight || 0); });
    });
    return Math.round(sum * 100) / 100;
  }

  // 更新权重总和状态条 + 控制保存按钮可用性
  _updateForkSum() {
    const TARGET = 50;
    const sum = this._forkWeightSum();
    const valEl = document.getElementById('cmpForkSumValue');
    const hintEl = document.getElementById('cmpForkSumHint');
    const createBtn = document.getElementById('cmpForkCreateBtn');
    const diff = Math.round((sum - TARGET) * 100) / 100;

    if (valEl) {
      valEl.textContent = `${sum} / ${TARGET}`;
      valEl.classList.toggle('over', diff > 0);
      valEl.classList.toggle('under', diff < 0);
    }
    if (hintEl) {
      if (diff > 0) hintEl.textContent = `超出 ${diff} 分，请下调后再保存`;
      else if (diff < 0) hintEl.textContent = `还差 ${Math.abs(diff)} 分（可保存，但建议补满 50）`;
      else hintEl.textContent = '';
    }
    // 超过 50 禁止保存（不足允许，仅提示）
    if (createBtn) {
      const blocked = diff > 0;
      createBtn.disabled = blocked;
      createBtn.style.opacity = blocked ? '0.5' : '1';
      createBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
    }
    return sum;
  }

  // 实时影响预览：当前版本的书，在 base 权重 vs edit 权重下的总分和排名变化
  _renderForkPreview() {
    const el = document.getElementById('cmpForkPreview');
    if (!el) return;
    const version = this._getActiveVersion();
    if (!version || !this._forkBaseCriteria || !this._forkEditCriteria) { el.innerHTML = ''; return; }

    // 解析每本书的 details（用当前版本的 ratingEntry）
    const books = (version.bookRefs || []).map(ref => {
      const book = this.storageService.bookMap.get(ref.bookId);
      const title = book ? book.title : '（已删除作品）';
      let details = {};
      if (book && Array.isArray(book.ratingHistory) && book.ratingHistory.length > 0) {
        let entry = book.ratingHistory.find(e => e.id === ref.ratingEntryId) || book.ratingHistory[book.ratingHistory.length - 1];
        details = entry.rating_details || {};
      } else if (book && book.rating_details) {
        details = book.rating_details;
      }
      const baseTotal = calculateWeightedScores({ rating_details: details }, this._forkBaseCriteria).total + 50;
      const newTotal = calculateWeightedScores({ rating_details: details }, this._forkEditCriteria).total + 50;
      return { title, baseTotal, newTotal };
    });

    // 计算 base 排名 和 new 排名
    const baseRank = this._rankMap(books, 'baseTotal');
    const newRank = this._rankMap(books, 'newTotal');

    // 按新分数降序展示
    const sorted = [...books].sort((a, b) => b.newTotal - a.newTotal);
    el.innerHTML = sorted.map(b => {
      const delta = b.newTotal - b.baseTotal;
      let cls = 'same', sign = '';
      if (Math.abs(delta) >= 0.05) { cls = delta > 0 ? 'up' : 'down'; sign = delta > 0 ? '+' : ''; }
      const rankUp = newRank[b.title] < baseRank[b.title]
        ? `<span class="cmp-preview-rank-up"><i class="fas fa-arrow-up"></i>排名↑</span>` : '';
      return `
        <div class="cmp-preview-row">
          <span class="cmp-preview-name" title="${this.escapeHtml(b.title)}">${this.escapeHtml(b.title)}${rankUp}</span>
          <span class="cmp-preview-score">${b.baseTotal.toFixed(1)} → ${b.newTotal.toFixed(1)}</span>
          <span class="cmp-preview-delta ${cls}">${sign}${delta.toFixed(1)}</span>
        </div>
      `;
    }).join('');
  }

  // 给一组对象按某字段降序排名，返回 {title: rank}
  _rankMap(books, field) {
    const sorted = [...books].sort((a, b) => b[field] - a[field]);
    const map = {};
    sorted.forEach((b, i) => { map[b.title] = i + 1; });
    return map;
  }

  // 提交 fork：新建评分体系版本 + 在对比项目里 fork 一个实验分支版本
  async _confirmFork() {
    const cmp = this._getActiveComparison();
    const version = this._getActiveVersion();
    if (!cmp || !version || !this._forkEditCriteria) return;

    // 权重总和约束：不允许超过 50
    const sum = this._forkWeightSum();
    if (sum > 50) {
      this.showToast(`权重总和为 ${sum}，超出 50 分 ${Math.round((sum - 50) * 100) / 100} 分，无法保存`, 'error');
      return;
    }

    const nameInput = document.getElementById('cmpForkName');
    const noteInput = document.getElementById('cmpForkNote');
    const name = (nameInput ? nameInput.value : '').trim() || '未命名实验';
    const note = noteInput ? noteInput.value : '';

    // 1. 新建评分体系版本
    const newCriteriaId = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCriteriaVersion = {
      id: newCriteriaId,
      name,
      note,
      parentId: this._forkBaseVersionId,
      createdAt: new Date().toISOString(),
      criteria: JSON.parse(JSON.stringify(this._forkEditCriteria))
    };
    RATING_CRITERIA_HISTORY.versions.push(newCriteriaVersion);
    const ok1 = await this._saveCriteriaHistory();
    if (!ok1) { RATING_CRITERIA_HISTORY.versions.pop(); this.showToast('保存评分体系失败', 'error'); return; }

    // 2. 在对比项目里 fork 一个实验分支版本（基于当前查看版本）
    const now = new Date().toISOString();
    const expCount = cmp.versions.filter(v => (v.branchName || 'main') !== 'main').length;
    const newVer = {
      id: `ver_exp${expCount + 1}`,
      parentId: version.id,
      branchName: `exp-${expCount + 1}`,
      createdAt: now,
      createReason: 'fork',
      forkNote: name,
      criteriaVersionId: newCriteriaId,
      bookRefs: JSON.parse(JSON.stringify(version.bookRefs || [])),
      annotation: ''
    };
    cmp.versions.push(newVer);
    cmp.updatedAt = now;
    const ok2 = await this.saveComparisons();
    if (!ok2) { cmp.versions.pop(); this.showToast('保存实验分支失败', 'error'); return; }

    // 成功 Fork：不回抽屉，直接切到新版本
    this._forkFromDrawer = false;
    this.closeForkDialog();
    this.showToast(`已 Fork 实验：${name}`, 'success');
    // 切到新实验版本查看
    this._activeVersionId = newVer.id;
    this.renderComparisonWorkspace();
  }

  // 渲染版本 chip-rail（4a：只读展示 + 点击切换由 4e/此处一并实现）
  renderVersionChips() {
    const c = this.domCache;
    if (!c.cmpVersionChips) return;
    const cmp = this._getActiveComparison();
    if (!cmp || !Array.isArray(cmp.versions)) { c.cmpVersionChips.innerHTML = ''; return; }

    // 主线
    const mains = cmp.versions.filter(v => (v.branchName || 'main') === 'main');
    const exps = cmp.versions.filter(v => (v.branchName || 'main') !== 'main');
    const parts = [];
    mains.forEach((v, i) => {
      if (i > 0) parts.push('<span class="cmp-chip-connector"></span>');
      const isCurrent = v.id === this._activeVersionId;
      const label = v.id.replace('ver_', '');
      parts.push(
        `<button class="cmp-chip${isCurrent ? ' current' : ''}" data-version-id="${v.id}" ` +
        `title="${v.createReason || ''} · ${this._relativeTime(v.createdAt)}">${this.escapeHtml(label)}</button>`
      );
    });

    // 实验分支（菱形 chip，跟在主线后面）
    if (exps.length > 0) {
      parts.push('<span class="cmp-rail-branch-label"><i class="fas fa-code-branch"></i> 实验</span>');
      exps.forEach(v => {
        const isCurrent = v.id === this._activeVersionId;
        const label = v.id.replace('ver_', '');
        const note = v.forkNote ? `：${v.forkNote}` : '';
        parts.push(
          `<button class="cmp-chip cmp-chip-exp${isCurrent ? ' current' : ''}" data-version-id="${v.id}" ` +
          `title="fork from ${v.parentId ? v.parentId.replace('ver_', '') : '?'}${this.escapeHtml(note)}">${this.escapeHtml(label)}</button>`
        );
      });
    }

    c.cmpVersionChips.innerHTML = parts.join('');

    // 绑定点击切换版本
    c.cmpVersionChips.querySelectorAll('.cmp-chip').forEach(chip => {
      chip.addEventListener('click', () => this.switchComparisonVersion(chip.dataset.versionId));
    });
  }

  // 切换查看的版本
  switchComparisonVersion(versionId) {
    if (!versionId || versionId === this._activeVersionId) return;
    // 切换前先 flush 当前评价的未保存内容
    this._flushAnnotationSave();
    this._activeVersionId = versionId;
    this.renderComparisonWorkspace();
  }

  // WYSIWYG 实时渲染（5a）：防抖，重渲染后恢复光标
  _scheduleAnnotationLiveRender() {
    clearTimeout(this._annoRenderTimer);
    this._annoRenderTimer = setTimeout(() => this._renderAnnotationLive(), 120);
  }

  _renderAnnotationLive() {
    const c = this.domCache;
    const el = c.cmpAnnotationEditor;
    if (!el || this._imeComposing) return;
    const text = ceGetText(el);
    const caret = ceGetCaret(el);
    const html = renderMarkdownLive(text);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
      ceSetCaret(el, caret);
    }
    el.classList.toggle('is-empty', text.length === 0);
    this._updateActiveAnnoLine();
  }

  // 高亮光标所在行（仅该行显示 markdown 标记符，5a）
  _updateActiveAnnoLine() {
    const el = this.domCache.cmpAnnotationEditor;
    if (!el) return;
    const sel = window.getSelection();
    let lineEl = null;
    if (sel && sel.rangeCount) {
      let node = sel.getRangeAt(0).startContainer;
      while (node && node !== el) {
        if (node.classList && node.classList.contains('md-line')) { lineEl = node; break; }
        node = node.parentNode;
      }
    }
    el.querySelectorAll('.md-line.md-active').forEach(l => { if (l !== lineEl) l.classList.remove('md-active'); });
    if (lineEl) lineEl.classList.add('md-active');
  }

  // 评价自动保存（debounce 800ms，决策 C-2）
  _scheduleAnnotationSave() {
    const c = this.domCache;
    if (c.cmpAnnotationSaveState) c.cmpAnnotationSaveState.textContent = '编辑中…';
    clearTimeout(this._annotationSaveTimer);
    this._annotationSaveTimer = setTimeout(() => this._flushAnnotationSave(), 800);
  }

  async _flushAnnotationSave() {
    clearTimeout(this._annotationSaveTimer);
    const c = this.domCache;
    const cmp = this._getActiveComparison();
    const version = this._getActiveVersion();
    if (!cmp || !version || !c.cmpAnnotationEditor) return;

    const val = ceGetText(c.cmpAnnotationEditor);
    if (val === (version.annotation || '')) return; // 无变化不写盘

    version.annotation = val;
    cmp.updatedAt = new Date().toISOString();
    const ok = await this.saveComparisons();
    if (c.cmpAnnotationSaveState) {
      c.cmpAnnotationSaveState.textContent = ok ? '已自动保存' : '保存失败';
      if (ok) setTimeout(() => { if (c.cmpAnnotationSaveState) c.cmpAnnotationSaveState.textContent = ''; }, 2000);
    }
  }

  // 描述自动保存
  async _flushDescSave() {
    const c = this.domCache;
    const cmp = this._getActiveComparison();
    if (!cmp || !c.cmpWorkspaceDesc) return;
    const val = c.cmpWorkspaceDesc.value;
    if (val === (cmp.description || '')) return;
    cmp.description = val;
    cmp.updatedAt = new Date().toISOString();
    await this.saveComparisons();
  }

  // 刷新版本（4f）：基于最新评分数据，在主线末端追加一个新版本
  async refreshComparisonVersion() {
    const cmp = this._getActiveComparison();
    if (!cmp) return;
    this._flushAnnotationSave();

    const tip = this._getComparisonTipVersion(cmp);
    if (!tip) return;

    // 用 tip 的书集合，重新取每本书最新的 ratingEntryId
    const bookRefs = (tip.bookRefs || []).map(ref => {
      const book = this.storageService.bookMap.get(ref.bookId);
      const latestId = (book && Array.isArray(book.ratingHistory) && book.ratingHistory.length > 0)
        ? book.ratingHistory[book.ratingHistory.length - 1].id
        : ref.ratingEntryId;
      return { bookId: ref.bookId, ratingEntryId: latestId };
    });

    // 检查是否真有变化：每本书的 ratingEntryId 与 criteriaVersionId 均未变 → 无需刷新
    const curCriteriaId = getCurrentCriteriaVersionId();
    const entryChanged = bookRefs.some(nr => {
      const old = (tip.bookRefs || []).find(o => o.bookId === nr.bookId);
      return !old || old.ratingEntryId !== nr.ratingEntryId;
    });
    const criteriaChanged = (tip.criteriaVersionId || null) !== (curCriteriaId || null);
    if (!entryChanged && !criteriaChanged) {
      this.showToast('当前已是最新，没有任何更改', 'info');
      return;
    }

    const now = new Date().toISOString();
    const mains = cmp.versions.filter(v => (v.branchName || 'main') === 'main');
    const nextNum = mains.length + 1;
    const newVersion = {
      id: `ver_v${nextNum}`,
      parentId: tip.id,
      branchName: 'main',
      createdAt: now,
      createReason: 'refresh',
      forkNote: '',
      criteriaVersionId: curCriteriaId,
      bookRefs,
      annotation: ''
    };
    cmp.versions.push(newVersion);
    cmp.mainBranchTipId = newVersion.id;
    cmp.updatedAt = now;

    const ok = await this.saveComparisons();
    if (!ok) {
      cmp.versions = cmp.versions.filter(v => v.id !== newVersion.id);
      cmp.mainBranchTipId = tip.id;
      this.showToast('刷新失败', 'error');
      return;
    }
    this._activeVersionId = newVersion.id;
    this.showToast(`已创建新版本 ${newVersion.id.replace('ver_', '')}`, 'success');
    this.renderComparisonWorkspace();
  }

  // 通用确认对话框（替代 confirm()）：传入标题/消息/确认按钮文案/回调
  openConfirmDialog({ title = '确认操作', message = '确定要执行此操作吗？', okText = '删除', onConfirm } = {}) {
    const modal = document.getElementById('cmpConfirmModal');
    if (!modal) { if (onConfirm) onConfirm(); return; }
    const titleEl = document.getElementById('cmpConfirmTitle');
    const msgEl = document.getElementById('cmpConfirmMessage');
    const okBtn = document.getElementById('cmpConfirmOkBtn');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = okText;
      // 克隆去重旧监听
      const fresh = okBtn.cloneNode(true);
      okBtn.parentNode.replaceChild(fresh, okBtn);
      fresh.addEventListener('click', () => {
        this.closeConfirmDialog();
        if (onConfirm) onConfirm();
      });
    }
    modal.style.display = 'flex';
    if (this.overlay) this.overlay.classList.add('active');
  }

  closeConfirmDialog() {
    const modal = document.getElementById('cmpConfirmModal');
    if (modal) modal.style.display = 'none';
    if (this.overlay) this.overlay.classList.remove('active');
  }

  // 删除对比项目：弹确认对话框
  requestDeleteComparison(comparisonId) {
    const cmp = (this.comparisons || []).find(x => x.id === comparisonId);
    this.openConfirmDialog({
      title: '删除对比项目',
      message: `确定删除对比项目「${cmp ? (cmp.title || '未命名对比') : ''}」？该项目的所有版本和评价将一并删除，无法撤销。`,
      okText: '删除',
      onConfirm: () => this.deleteComparison(comparisonId)
    });
  }

  // 删除对比项目
  async deleteComparison(comparisonId) {
    const removed = (this.comparisons || []).find(x => x.id === comparisonId);
    this.comparisons = this.comparisons.filter(x => x.id !== comparisonId);
    const ok = await this.saveComparisons();
    if (!ok) {
      if (removed) this.comparisons.push(removed);
      this.showToast('删除失败', 'error');
      return;
    }
    this.showToast(`已删除对比项目「${removed ? (removed.title || '未命名对比') : ''}」`, 'success');
    this.renderComparisonList();
  }

  _updateLockedBookIndicator() {
    const lockedBookId = this.inspirationFilters.lockedBookId;
    if (!lockedBookId) return;

    const book = this.storageService.books.find(b => b.id === lockedBookId);
    if (!book) return;

    // 创建或更新锁定指示器
    let indicator = document.getElementById('lockedBookIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'lockedBookIndicator';
      indicator.className = 'locked-book-indicator';
      // 插入到 .filter-popover-wrapper 后面（在 .toolbar-left 内）
      const wrapper = document.querySelector('.filter-popover-wrapper');
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.insertBefore(indicator, wrapper.nextSibling);
      }
    }

    indicator.innerHTML = `
      <span class="locked-book-name">《${book.title}》</span>
      <button class="locked-book-clear" onclick="window.clearLockedBook()">
        <i class="fas fa-times"></i>
      </button>
    `;
    indicator.style.display = 'flex';
  }

  // 隐藏锁定书籍指示器
  _hideLockedBookIndicator() {
    const indicator = document.getElementById('lockedBookIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // 清除锁定书籍（但保留筛选状态，允许查看所有灵感）
  clearLockedBook() {
    this.inspirationFilters.lockedBookId = null;
    this.inspirationFilters.bookId = null;
    this.currentInspirationFilterBookId = null;
    this._hideLockedBookIndicator();
    // 清空筛选面板的下拉框
    const filterBookId = document.getElementById('filterBookId');
    if (filterBookId) {
      filterBookId.value = '';
    }
    this.renderInspirationList();
  }

  // 获取排序后的灵感（带缓存）
  _getSortedInspirations() {
    // 生成当前状态的哈希值
    const currentHash = JSON.stringify({
      inspirations: this.inspirations.map(j => j.id),
      search: this.currentInspirationSearchTerm,
      filters: this.inspirationFilters
    });

    if (this._inspirationsHash !== currentHash) {
      // 数据变化，重新排序
      this._inspirationsHash = currentHash;
      let filtered = this.inspirations;

      // 搜索过滤
      if (this.currentInspirationSearchTerm) {
        const term = this.currentInspirationSearchTerm.toLowerCase();
        filtered = filtered.filter(i =>
          (i.title && i.title.toLowerCase().includes(term)) ||
          (i.coreTranslation && i.coreTranslation.toLowerCase().includes(term)) ||
          (i.tags && i.tags.some(t => t.toLowerCase().includes(term)))
        );
      }

      // 按书籍筛选
      if (this.inspirationFilters.bookId) {
        filtered = filtered.filter(i => i.bookId === this.inspirationFilters.bookId);
      }

      // 按标签筛选
      if (this.inspirationFilters.tags.length > 0) {
        filtered = filtered.filter(i =>
          i.tags && i.tags.some(tag => this.inspirationFilters.tags.includes(tag))
        );
      }

      // 按时间筛选
      if (this.inspirationFilters.timeOption !== 'all' || this.inspirationFilters.dateFrom || this.inspirationFilters.dateTo) {
        const now = new Date();
        let startDate = null;
        let endDate = null;

        if (this.inspirationFilters.timeOption === 'week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (this.inspirationFilters.timeOption === 'month') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (this.inspirationFilters.dateFrom) {
          startDate = new Date(this.inspirationFilters.dateFrom);
        }

        if (this.inspirationFilters.dateTo) {
          endDate = new Date(this.inspirationFilters.dateTo);
          endDate.setHours(23, 59, 59, 999);
        }

        if (startDate || endDate) {
          filtered = filtered.filter(i => {
            const createdAt = new Date(i.createdAt);
            if (startDate && createdAt < startDate) return false;
            if (endDate && createdAt > endDate) return false;
            return true;
          });
        }
      }

      // 按创建时间倒序
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      this._sortedInspirations = filtered;
    }

    return this._sortedInspirations || [];
  }

  // 切换筛选面板显示/隐藏
  toggleInspirationFilterPanel() {
    const panel = this.domCache.inspirationFilterPanel;
    if (!panel) return;

    if (!panel.classList.contains('visible')) {
      panel.classList.add('visible');
      // 填充书籍下拉选项
      this._populateFilterBookOptions();
      // 填充标签选项
      this._populateFilterTagOptions();

      // 使用 fixed 定位时，需要计算相对于视口的位置
      const filterBtn = document.getElementById('filterBtn');
      if (filterBtn) {
        const rect = filterBtn.getBoundingClientRect();
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.left = rect.left + 'px';
      }
    } else {
      panel.classList.remove('visible');
    }
  }

  // 填充筛选面板中的书籍选项
  _populateFilterBookOptions() {
    const select = this.domCache.filterBookId;
    if (!select) return;

    // 只显示开启了灵感功能且未被软删除的书籍
    const books = (this.storageService.books || []).filter(book => !book.deleted && book.enableInspiration);
    const currentValue = select.value;

    select.innerHTML = '<option value="">全部作品</option>' +
      books.map(book => `<option value="${book.id}">${this.escapeHtml(book.title)}</option>`).join('');

    if (currentValue) {
      select.value = currentValue;
    }
  }

  // 填充筛选面板中的标签选项（与新增灵感同步）
  _populateFilterTagOptions() {
    const container = document.getElementById('inspirationFilterTagsContainer');
    if (!container) return;

    const tags = this.inspirationPresetTags;
    const currentSelectedTags = this.inspirationFilters.tags || [];

    container.innerHTML = tags.map(tag => {
      const isSelected = currentSelectedTags.includes(tag);
      return `<button type="button" class="filter-tag-pill ${isSelected ? 'selected' : ''}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</button>`;
    }).join('');
  }

  // 重置筛选条件
  resetInspirationFilter() {
    const select = this.domCache.filterBookId;
    const dateFrom = this.domCache.filterDateFrom;
    const dateTo = this.domCache.filterDateTo;

    if (select) select.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';

    // 取消所有标签选中
    const tagPills = document.querySelectorAll('.filter-tag-pill');
    tagPills.forEach(pill => pill.classList.remove('selected'));

    // 重置时间选项 - 使用 time-pill 按钮
    const timePills = document.querySelectorAll('.time-pill');
    timePills.forEach(pill => {
      pill.classList.remove('active');
      if (pill.dataset.time === 'all') {
        pill.classList.add('active');
      }
    });

    // 隐藏自定义日期范围
    const dateRange = document.querySelector('.filter-date-range');
    if (dateRange) dateRange.style.display = 'none';

    // 重置内部状态
    this.inspirationFilters = {
      bookId: null,
      tags: [],
      timeOption: 'all',
      dateFrom: null,
      dateTo: null,
      lockedBookId: null
    };

    // 清除转跳时设置的临时筛选ID
    this.currentInspirationFilterBookId = null;

    // 隐藏锁定书籍指示器
    this._hideLockedBookIndicator();
  }

  // 应用筛选
  applyInspirationFilter() {
    // 获取筛选值
    const bookId = this.domCache.filterBookId?.value || '';
    const dateFrom = this.domCache.filterDateFrom?.value || '';
    const dateTo = this.domCache.filterDateTo?.value || '';
    const selectedTags = Array.from(document.querySelectorAll('.filter-tag-pill.selected')).map(el => el.dataset.tag);
    const timeOption = document.querySelector('.time-pill.active')?.dataset.time || 'all';

    // 保存筛选状态（保留锁定书籍ID，如果下拉框的值与锁定ID不同则更新锁定状态）
    const newLockedBookId = bookId || null;
    this.inspirationFilters = {
      bookId: bookId || null,
      tags: selectedTags,
      timeOption: timeOption,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      lockedBookId: newLockedBookId
    };

    // 如果有锁定书籍，更新指示器
    if (newLockedBookId) {
      this._updateLockedBookIndicator();
    } else {
      this._hideLockedBookIndicator();
    }

    // 关闭面板
    const panel = this.domCache.inspirationFilterPanel;
    if (panel) panel.classList.remove('visible');

    // 显示筛选指示器
    const indicator = document.getElementById('inspirationFilterIndicator');
    const indicatorText = document.getElementById('inspirationFilterText');

    if (indicator && indicatorText) {
      const conditions = [];
      if (bookId) {
        const book = this.storageService.books.find(b => b.id === bookId);
        if (book) conditions.push(`作品: ${book.title}`);
      }
      if (selectedTags.length > 0) {
        conditions.push(`标签: ${selectedTags.join(', ')}`);
      }
      if (timeOption !== 'all') {
        const timeLabel = timeOption === 'week' ? '最近一周' : '最近一个月';
        conditions.push(`时间: ${timeLabel}`);
      } else if (dateFrom || dateTo) {
        conditions.push(`时间: ${dateFrom || '开始'} ~ ${dateTo || '结束'}`);
      }

      if (conditions.length > 0) {
        indicator.style.display = 'flex';
        indicatorText.textContent = conditions.join(' | ');
      } else {
        indicator.style.display = 'none';
      }
    }

    // 重新渲染列表
    this.renderInspirationList();
  }

  // 渲染灵感列表
  renderInspirationList() {
    const container = this.domCache.inspirationList;
    const emptyState = this.domCache.inspirationEmptyState;
    const filterIndicator = document.getElementById('inspirationFilterIndicator');

    if (!container) {
      console.error('inspirationList container not found');
      return;
    }

    // 如果有锁定书籍，不显示原来的指示器（锁定信息现在显示在工具栏）
    // 只有非锁定筛选才显示原来的指示器
    if (this.inspirationFilters.lockedBookId) {
      // 锁定状态下不显示原来的筛选指示器
      if (filterIndicator) {
        filterIndicator.style.display = 'none';
      }
    } else if (this.inspirationFilters.bookId) {
      // 非锁定但有书籍筛选时显示指示器
      const filterText = document.getElementById('inspirationFilterText');
      const book = this.storageService.books.find(b => b.id === this.inspirationFilters.bookId);
      if (book && filterText && filterIndicator) {
        filterText.textContent = `显示《${book.title}》的灵感`;
        filterIndicator.style.display = 'flex';
      }
    } else {
      if (filterIndicator) {
        filterIndicator.style.display = 'none';
      }
    }

    if (!this.inspirations || this.inspirations.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      return;
    }

    const sorted = this._getSortedInspirations();

    if (!sorted || sorted.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      return;
    }

    if (emptyState) {
      emptyState.style.display = 'none';
    }

    container.innerHTML = sorted.map(inspiration => this._renderInspirationCard(inspiration)).join('');
    this._renderMemoryStats();
  }

  // 记忆统计栏
  _renderMemoryStats() {
    const bar = document.getElementById('memoryStatsBar');
    if (!bar || !this.inspirations || !this.inspirations.length) {
      if (bar) bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    const buckets = { good: 0, medium: 0, low: 0, unreviewed: 0 };
    for (const insp of this.inspirations) {
      const score = this._calcMemoryScore(insp);
      if (score === 0) buckets.unreviewed++;
      else if (score < 40) buckets.low++;
      else if (score < 70) buckets.medium++;
      else buckets.good++;
    }
    bar.innerHTML = `
      <span class="memory-stat good">🟢 ${buckets.good} 牢固</span>
      <span class="memory-stat medium">🟡 ${buckets.medium} 巩固</span>
      <span class="memory-stat low">🔴 ${buckets.low} 薄弱</span>
      <span class="memory-stat unreviewed">⏳ ${buckets.unreviewed} 未复习</span>
    `;
  }

  // 检查今天是否已复习，未复习则显示红点
  _checkTodayReviewed() {
    const today = new Date().toISOString().slice(0, 10);
    for (const insp of this.inspirations) {
      if (insp.lastReviewedAt && insp.lastReviewedAt.startsWith(today)) {
        return; // 今天已复习
      }
    }
    const btn = document.getElementById('startReviewBtn');
    if (btn) btn.classList.add('needs-review');
  }

  // 清除复习提醒红点
  _clearReviewDot() {
    const btn = document.getElementById('startReviewBtn');
    if (btn) btn.classList.remove('needs-review');
  }

  // 渲染单条灵感卡片
  _renderInspirationCard(inspiration) {
    const date = new Date(inspiration.createdAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const tagsHtml = inspiration.tags && inspiration.tags.length > 0
      ? inspiration.tags.map(tag => `<span class="inspiration-tag">${this.escapeHtml(tag)}</span>`).join('')
      : '';
    const preview = inspiration.coreTranslation
      ? (() => {
          // 去掉HTML标签和 &nbsp; 等实体后截断
          const stripped = inspiration.coreTranslation.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').replace(/ /g, '');
          const text = stripped.length > 100 ? stripped.substring(0, 100) + '...' : stripped;
          return this.escapeHtml(text);
        })()
      : '';
    // 关联作品
    const bookHtml = inspiration.bookId
      ? (() => {
          const book = this.storageService.books.find(b => b.id === inspiration.bookId);
          return book ? `<div class="inspiration-card-book"><i class="fas fa-book"></i> 《${this.escapeHtml(book.title)}》</div>` : '';
        })()
      : '';

    return `
      <div class="inspiration-card" data-id="${inspiration.id}" onclick="openInspirationView('${inspiration.id}')">
        <div class="inspiration-card-header">
          <div class="inspiration-card-title">${this.escapeHtml(inspiration.title)}</div>
          <div class="inspiration-card-date">${dateStr}</div>
        </div>
        ${bookHtml}
        ${tagsHtml ? `<div class="inspiration-card-tags">${tagsHtml}</div>` : ''}
        <div class="inspiration-card-preview">${preview}</div>
        <div class="inspiration-card-footer">
          ${inspiration.source?.reference ? `<div class="inspiration-card-source">${this.escapeHtml(inspiration.source.reference)}</div>` : ''}
        </div>
        ${(() => {
          const score = this._calcMemoryScore(inspiration);
          const label = this._getMemoryLabel(score);
          return `<div class="inspiration-review-status ${label.cls}">${label.icon} ${label.text}</div>`;
        })()}
      </div>
    `;
  }

  // 打开灵感查看模态框
  openInspirationView(inspirationId) {
    const inspiration = this.inspirations.find(i => i.id === inspirationId);
    if (!inspiration) return;

    // 保存当前查看的灵感ID，供编辑和删除按钮使用
    window.currentViewInspirationId = inspirationId;

    document.getElementById('viewInspirationTitle').textContent = inspiration.title;

    const tagsHtml = inspiration.tags && inspiration.tags.length > 0
      ? inspiration.tags.map(tag => `<span class="inspiration-tag">${this.escapeHtml(tag)}</span>`).join('')
      : '';
    document.getElementById('viewInspirationTags').innerHTML = tagsHtml;

    // 处理核心转译的换行格式
    const coreTranslationEl = document.getElementById('viewInspirationCoreTranslation');
    if (inspiration.coreTranslation) {
        const text = inspiration.coreTranslation;
        const formatted = text.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p>');
        coreTranslationEl.innerHTML = `<p>${formatted}</p>`;
    } else {
        coreTranslationEl.innerHTML = '暂无';
    }

    const inspirationViewModal = document.getElementById('inspirationViewModal');
    if (inspirationViewModal) inspirationViewModal.style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  // 关闭灵感查看模态框
  closeInspirationViewModal() {
    document.getElementById('inspirationViewModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    document.body.style.overflow = '';
  }

  // 打开灵感编辑模态框
  openInspirationModal(inspirationId = null, preselectedBookId = null) {
    const modal = document.getElementById('inspirationModal');
    const form = document.getElementById('inspirationForm');
    const titleEl = document.getElementById('inspirationModalTitle');

    form.reset();
    document.getElementById('inspirationId').value = '';

// 填充书籍下拉列表（根据来源决定是否锁定）
    this.populateInspirationBookSelect(preselectedBookId);

    // 初始化标签 - 新建时不重置，保留当前选中状态
    if (inspirationId) {
      const inspiration = this.inspirations.find(i => i.id === inspirationId);
      if (inspiration) {
        titleEl.innerHTML = '<i class="fas fa-lightbulb"></i> 编辑灵感';
        document.getElementById('inspirationId').value = inspiration.id;
        document.getElementById('inspirationTitle').value = inspiration.title;
        document.getElementById('inspirationBookId').value = inspiration.bookId || '';
        this.currentInspirationTags = [...(inspiration.tags || [])];
        document.getElementById('inspirationCoreTranslation').innerHTML = inspiration.coreTranslation || '';
        // 核心转译输入框自动调整高度
        const ct = document.getElementById('inspirationCoreTranslation');
        ct.style.height = 'auto';
        ct.style.height = ct.scrollHeight + 'px';
      }
    } else {
      titleEl.innerHTML = '<i class="fas fa-lightbulb"></i> 记录灵感';
      document.getElementById('inspirationBookId').value = preselectedBookId || '';
      document.getElementById('inspirationCoreTranslation').innerHTML = '';
      const ct = document.getElementById('inspirationCoreTranslation');
      ct.style.height = 'auto';
      // 不重置 currentInspirationTags，保留用户之前的选择
    }

    // 渲染标签UI
    this.renderInspirationTagSuggestions();
    this.renderSelectedInspirationTags();

    modal.style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 核心转译输入框 auto-resize
    const ct = document.getElementById('inspirationCoreTranslation');
    ct.removeEventListener('input', this._inspirationAutoResize);
    this._inspirationAutoResize = () => {
      ct.style.height = 'auto';
      ct.style.height = ct.scrollHeight + 'px';
    };
    ct.addEventListener('input', this._inspirationAutoResize);

    // 加粗按钮
    document.getElementById('inspirationBoldBtn').onclick = () => {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && sel.toString().length > 0) {
        // 检查选中区域是否已在 b 标签内
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const bEl = container.nodeType === 3 ? container.parentElement.closest('b') : container.closest('b');
        if (bEl) {
          // 取消加粗：替换 b 为其内容
          const parent = bEl.parentNode;
          while (bEl.firstChild) parent.insertBefore(bEl.firstChild, bEl);
          parent.removeChild(bEl);
        } else {
          // 加粗
          document.execCommand('bold', false, null);
        }
      }
      ct.focus();
    };

    // 输入后将光标移出 b 标签，防止后续输入继承加粗
    ct.removeEventListener('input', this._inspirationMoveCursorOut);
    this._inspirationMoveCursorOut = () => {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const node = sel.anchorNode;
      if (!node) return;
      const bEl = node.parentElement?.closest?.('b');
      if (!bEl) return;
      // 如果光标在 b 标签内部且在末尾，将光标移到 b 之后
      if (sel.isCollapsed && bEl.contains(node)) {
        const range = document.createRange();
        range.setStartAfter(bEl);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    };
    ct.addEventListener('input', this._inspirationMoveCursorOut);
  }

  // 填充灵感表单的书籍下拉选择器
  // preselectedBookId: 如果有值则锁定为该作品（从作品转跳），否则显示所有启用了灵感功能的作品
  populateInspirationBookSelect(preselectedBookId = null) {
    const select = document.getElementById('inspirationBookId');
    if (!select) return;

    select.innerHTML = '';
    select.disabled = false;

    if (preselectedBookId) {
      // 方式二：从作品转跳过来，锁定为该作品
      const book = this.storageService.books.find(b => b.id === preselectedBookId);
      if (book) {
        const option = document.createElement('option');
        option.value = book.id;
        option.textContent = book.title;
        select.appendChild(option);
        select.disabled = true; // 锁定不可更改
      }
    } else {
      // 方式一：直接新增，只显示启用了灵感功能的作品
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '请选择作品';
      select.appendChild(defaultOption);

      this.storageService.books
        .filter(book => book.enableInspiration === true)
        .forEach(book => {
          const option = document.createElement('option');
          option.value = book.id;
          option.textContent = book.title;
          select.appendChild(option);
        });
    }
  }

  // 关闭灵感编辑模态框
  closeInspirationModal() {
    document.getElementById('inspirationModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }

  // =========================================
  // 灵感随机复习功能
  // =========================================

  // 记忆衰减分数（0-100），基于艾宾浩斯遗忘曲线
  _calcMemoryScore(inspiration) {
    if (!inspiration.lastReviewedAt) return 0;
    const now = Date.now();
    const HALF_LIFE_REMEMBERED = 21; // 记住了：21天后贡献减半
    const HALF_LIFE_FORGOTTEN = 7;   // 再想想：7天后贡献减半
    let score = 0;
    for (const review of inspiration.reviewResults) {
      const daysAgo = (now - new Date(review.date).getTime()) / (1000 * 60 * 60 * 24);
      const halfLife = review.remembered ? HALF_LIFE_REMEMBERED : HALF_LIFE_FORGOTTEN;
      const decay = Math.pow(2, -daysAgo / halfLife);
      const weight = review.remembered ? 1.0 : 0.25;
      score += weight * decay;
    }
    return Math.min(Math.round(score * 100), 100);
  }

  // 记忆分级标签
  _getMemoryLabel(score) {
    if (score === 0) return { text: '尚未复习', cls: 'unreviewed', icon: '⏳' };
    if (score < 40)  return { text: '记忆薄弱', cls: 'low', icon: '🔴' };
    if (score < 70)  return { text: '需要巩固', cls: 'medium', icon: '🟡' };
    return { text: '记忆牢固', cls: 'good', icon: '🟢' };
  }

  // 加权抽取：记忆分越低权重越高
  _selectReviewCards(count) {
    const pool = this.inspirations.map(insp => {
      const score = this._calcMemoryScore(insp);
      const weight = 101 - score; // 0分→权重101, 100分→权重1
      return { insp, weight };
    });

    // 加权无放回抽样
    const n = Math.min(count, pool.length);
    const selected = [];
    for (let i = 0; i < n; i++) {
      const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
      let r = Math.random() * totalWeight;
      let pick = 0;
      for (let j = 0; j < pool.length; j++) {
        r -= pool[j].weight;
        if (r <= 0) { pick = j; break; }
      }
      selected.push(pool[pick].insp);
      pool.splice(pick, 1);
    }
    return selected;
  }

  // Fisher-Yates 洗牌算法（保留给未来可能的需求）
  _shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 开始随机复习
  startReview() {
    if (!this.inspirations || this.inspirations.length === 0) {
      this.showToast('暂无灵感记录，请先记录灵感', 'warning');
      return;
    }

    // 加权抽取：优先长期未复习的灵感
    const count = Math.min(5, this.inspirations.length);
    this.reviewCards = this._selectReviewCards(count);
    this.reviewIndex = 0;
    this.reviewRemembered = [];
    this.reviewForgotten = [];

    // 隐藏灵感列表和工具栏，显示复习面板
    const inspirationList = this.domCache.inspirationList;
    const emptyState = this.domCache.inspirationEmptyState;
    const reviewPanel = document.getElementById('reviewPanel');
    const reviewSummary = document.getElementById('reviewSummary');
    const toolbar = document.querySelector('.inspiration-toolbar');

    if (inspirationList) inspirationList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (reviewSummary) reviewSummary.style.display = 'none';
    if (reviewPanel) reviewPanel.style.display = 'flex';

    // 锁定主内容区滚动，动态计算面板高度填满视口
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.setProperty('overflow-y', 'hidden', 'important');
      mainContent.style.setProperty('padding-bottom', '0', 'important');
      const mainRect = mainContent.getBoundingClientRect();
      if (reviewPanel) reviewPanel.style.height = mainRect.height + 'px';
    }

    // 更新视图标签为"灵感复习"
    const viewInspirationBtn = document.getElementById('viewInspiration');
    if (viewInspirationBtn) {
      viewInspirationBtn.innerHTML = '<i class="fas fa-lightbulb"></i> 灵感复习';
    }

    this.renderReviewCard(false); // 首张卡片，不需要过渡处理
  }

  // 渲染当前闪卡
  // isTransition: 是否是从上一张卡片过渡而来（需要隐藏背面防止闪现），首张卡片为 false
  renderReviewCard(isTransition = true) {
    const card = this.reviewCards[this.reviewIndex];
    if (!card) return;

    // 更新进度
    const progressFill = document.getElementById('reviewProgressFill');
    const progressText = document.getElementById('reviewProgressText');
    const total = this.reviewCards.length;
    const current = this.reviewIndex + 1;
    const percent = (current / total) * 100;
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = `第 ${current}/${total} 张`;

    // 背面元素引用
    const backTranslation = document.querySelector('#reviewCardBack .review-card-translation');
    const backTags = document.querySelector('#reviewCardBack .review-card-tags');
    const backBook = document.querySelector('#reviewCardBack .review-card-book');

    // 更新背面内容的辅助函数
    const updateBackContent = () => {
      if (backTranslation) {
        backTranslation.innerHTML = card.coreTranslation || '暂无内容';
        backTranslation.style.opacity = '1';
      }
      if (backTags) {
        if (card.tags && card.tags.length > 0) {
          backTags.innerHTML = card.tags.map(tag => `<span class="inspiration-tag">${this.escapeHtml(tag)}</span>`).join('');
        } else {
          backTags.innerHTML = '';
        }
        backTags.style.opacity = '1';
      }
      if (backBook) {
        if (card.bookId) {
          const book = this.storageService.books.find(b => b.id === card.bookId);
          backBook.innerHTML = book
            ? `<i class="fas fa-book"></i> 《${this.escapeHtml(book.title)}》`
            : '';
        } else {
          backBook.innerHTML = '';
        }
        backBook.style.opacity = '1';
      }
    };

    // 渲染正面：标题
    const frontTitle = document.querySelector('#reviewCardFront .review-card-title');
    if (frontTitle) frontTitle.textContent = card.title;

    // 重置卡片状态：正面朝上，隐藏操作按钮（保留占位空间）
    const reviewCard = document.getElementById('reviewCard');
    const reviewActions = document.getElementById('reviewActions');
    if (reviewCard) reviewCard.classList.remove('flipped');
    if (reviewActions) reviewActions.style.visibility = 'hidden';

    if (isTransition) {
      // 从上一张卡片过渡：先隐藏背面内容防止闪现，等翻转动画完成后更新
      if (this._reviewBackTimeout) clearTimeout(this._reviewBackTimeout);
      if (backTranslation) backTranslation.style.opacity = '0';
      if (backTags) backTags.style.opacity = '0';
      if (backBook) backBook.style.opacity = '0';
      this._reviewBackTimeout = setTimeout(updateBackContent, 350);
    } else {
      // 首张卡片：直接渲染背面内容
      updateBackContent();
    }
  }

  // 翻转卡片
  flipCard() {
    const reviewCard = document.getElementById('reviewCard');
    const reviewActions = document.getElementById('reviewActions');
    if (!reviewCard || reviewCard.classList.contains('flipped')) return;

    reviewCard.classList.add('flipped');
    if (reviewActions) reviewActions.style.visibility = 'visible';
  }

  // 回答：记住了 / 再想想
  answerReview(remembered) {
    const card = this.reviewCards[this.reviewIndex];
    if (!card) return;

    // 记录结果
    if (remembered) {
      this.reviewRemembered.push(card.id);
    } else {
      this.reviewForgotten.push(card.id);
    }

    // 写入灵感对象的复习记录
    const inspiration = this.inspirations.find(i => i.id === card.id);
    if (inspiration) {
      inspiration.lastReviewedAt = new Date().toISOString();
      inspiration.reviewResults.push({
        date: new Date().toISOString(),
        remembered: remembered
      });
    }

    // 下一张
    this.reviewIndex++;
    if (this.reviewIndex < this.reviewCards.length) {
      this.renderReviewCard();
    } else {
      this.showReviewSummary();
    }
  }

  // 显示复习总结
  async showReviewSummary() {
    const reviewPanel = document.getElementById('reviewPanel');
    const reviewSummary = document.getElementById('reviewSummary');
    if (reviewPanel) reviewPanel.style.display = 'none';
    if (reviewSummary) reviewSummary.style.display = 'flex';

    const rememberedCount = this.reviewRemembered.length;
    const forgottenCount = this.reviewForgotten.length;
    const total = this.reviewCards.length;

    // 渲染统计
    const statsEl = document.getElementById('reviewSummaryStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="review-stat remembered">
          <span class="review-stat-count">${rememberedCount}</span>
          <span class="review-stat-label">记住了</span>
        </div>
        <div class="review-stat forgotten">
          <span class="review-stat-count">${forgottenCount}</span>
          <span class="review-stat-label">还需巩固</span>
        </div>
      `;
    }

    // 渲染每条结果的卡片列表
    const cardsEl = document.getElementById('reviewSummaryCards');
    if (cardsEl) {
      cardsEl.innerHTML = this.reviewCards.map(card => {
        const isRemembered = this.reviewRemembered.includes(card.id);
        // 获取该灵感的最新记忆状态
        const insp = this.inspirations.find(i => i.id === card.id);
        const score = insp ? this._calcMemoryScore(insp) : 0;
        const label = this._getMemoryLabel(score);
        return `
          <div class="review-summary-card ${isRemembered ? 'remembered' : 'forgotten'}">
            <span class="review-summary-card-icon">${isRemembered ? '✅' : '🔄'}</span>
            <span class="review-summary-card-title">${this.escapeHtml(card.title)}</span>
            <span class="review-summary-card-status ${label.cls}">${label.icon} ${label.text}</span>
          </div>
        `;
      }).join('');
    }

    // 持久化复习记录
    await this.saveInspirations();
    this._clearReviewDot();
  }

  // 退出复习（完整流程，包含列表重新渲染）
  exitReview() {
    this._cleanupReviewState();
    this._clearReviewDot();
    this.renderInspirationList();
  }

  // 清理复习状态（仅清理DOM和内存，不触发渲染）
  _cleanupReviewState() {
    this.reviewCards = [];
    this.reviewIndex = 0;
    this.reviewRemembered = [];
    this.reviewForgotten = [];

    const reviewPanel = document.getElementById('reviewPanel');
    const reviewSummary = document.getElementById('reviewSummary');
    if (reviewPanel) {
      reviewPanel.style.display = 'none';
      reviewPanel.style.height = '';
    }
    if (reviewSummary) reviewSummary.style.display = 'none';

    // 恢复主内容区滚动和工具栏
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.removeProperty('overflow-y');
      mainContent.style.removeProperty('padding-bottom');
    }

    const toolbar = document.querySelector('.inspiration-toolbar');
    if (toolbar) toolbar.style.display = '';

    // 恢复视图标签为"灵感记录"
    const viewInspirationBtn = document.getElementById('viewInspiration');
    if (viewInspirationBtn) {
      viewInspirationBtn.innerHTML = '<i class="fas fa-lightbulb"></i> 灵感记录';
    }

    const inspirationList = this.domCache.inspirationList;
    if (inspirationList) inspirationList.style.display = '';
  }

  // 渲染预设灵感标签
  renderInspirationTagSuggestions() {
    const container = document.getElementById('inspirationTagSuggestions');
    if (!container) return;

    container.innerHTML = this.inspirationPresetTags.map(tag => {
      const isSelected = this.currentInspirationTags.includes(tag);
      return `<span class="preset-tag ${isSelected ? 'selected' : ''}" data-tag="${tag}">${tag}</span>`;
    }).join('');
  }

  // 渲染已选中的灵感标签
  renderSelectedInspirationTags() {
    const container = document.getElementById('selectedInspirationTags');
    if (!container) return;

    if (this.currentInspirationTags.length === 0) {
      container.innerHTML = '<span class="no-tags-tip">点击下方标签进行选择</span>';
      return;
    }

    container.innerHTML = this.currentInspirationTags.map(tag => {
      return `<span class="selected-tag" data-tag="${tag}">
        ${tag}
        <span class="remove-tag" data-action="remove">&times;</span>
      </span>`;
    }).join('');

    // 更新hidden input
    document.getElementById('inspirationTags').value = this.currentInspirationTags.join(',');
  }

  // 切换灵感标签选中状态
  toggleInspirationTag = (tag) => {
    const index = this.currentInspirationTags.indexOf(tag);
    if (index === -1) {
      this.currentInspirationTags.push(tag);
    } else {
      this.currentInspirationTags.splice(index, 1);
    }
    this.renderSelectedInspirationTags();
    this.renderInspirationTagSuggestions();
  };

  // 移除灵感标签
  removeInspirationTag = (tag) => {
    const index = this.currentInspirationTags.indexOf(tag);
    if (index !== -1) {
      this.currentInspirationTags.splice(index, 1);
      this.renderSelectedInspirationTags();
      this.renderInspirationTagSuggestions();
    }
  };

  // 打开灵感编辑模态框
  async saveInspiration(formData) {
    const id = formData.get('id') || null;

    // 新建时如果有锁定书籍，直接使用锁定书籍ID，不依赖表单值
    let bookId = formData.get('bookId') || '';
    if (!id && this.inspirationFilters.lockedBookId) {
      bookId = this.inspirationFilters.lockedBookId;
    }

    const inspirationData = {
      id: id || new InspirationEntry().generateId(),
      title: formData.get('title') || '',
      bookId: bookId,
      tags: [...this.currentInspirationTags],
      coreTranslation: formData.get('coreTranslation') || '',
      source: {
        reference: formData.get('source') || ''
      }
    };

    if (id) {
      const index = this.inspirations.findIndex(i => i.id === id);
      if (index !== -1) {
        inspirationData.createdAt = this.inspirations[index].createdAt;
        inspirationData.updatedAt = new Date().toISOString();
        this.inspirations[index] = new InspirationEntry(inspirationData);
      }
    } else {
      const newInspiration = new InspirationEntry(inspirationData);
      this.inspirations.push(newInspiration);
    }

    await this.saveInspirations();
    this.renderInspirationList();
    this.closeInspirationModal();
    this.showToast('灵感已保存', 'success');
  }

  // 删除灵感
  async deleteInspiration(inspirationId) {
    this.currentInspirationToDelete = inspirationId;
    const inspirationDeleteModal = document.getElementById('inspirationDeleteModal');
    if (inspirationDeleteModal) inspirationDeleteModal.style.display = 'flex';
    this.overlay.classList.add('active');
  }

  // 确认删除灵感
  async confirmDeleteInspiration() {
    if (!this.currentInspirationToDelete) return;

    const index = this.inspirations.findIndex(i => i.id === this.currentInspirationToDelete);
    if (index !== -1) {
      this.inspirations.splice(index, 1);
      await this.saveInspirations();
      this.renderInspirationList();
      this.showToast('灵感已删除', 'success');
    }

    document.getElementById('inspirationDeleteModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    this.currentInspirationToDelete = null;
  }

  // 取消删除灵感
  cancelDeleteInspiration() {
    document.getElementById('inspirationDeleteModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    this.currentInspirationToDelete = null;
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

    // 使用 DocumentFragment 批量添加（性能优化）
    const fragment = document.createDocumentFragment();
    sortedBooks.forEach(book => {
      const bookCard = this.createBookCard(book);
      fragment.appendChild(bookCard);
    });
    this.bookListContainer.appendChild(fragment);
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
    // 【题材专属配色表】15个题材色差拉满+白色背景文字清晰
    const tagColorMap = {
      '文学': '#D32F2F',      // 正红（降饱和不刺眼）
      '小说': '#FF7F00',      // 橙色（保留，对比度足够）
      '工具': '#F0B429',      // 暖黄（降低亮度，文字清晰）
      '纪实': '#57AB57',      // 草绿（降低亮度，不刺眼）
      '报告文学': '#2385bb',  // 蓝绿（降低饱和度，不晃眼）
      '传记': '#0000FF',      // 蓝色（保留，对比度高）
      '游戏剧情': '#8B00FF',  // 紫色（保留，深色系清晰）
      '电视剧': '#C2185B',    // 深玫红（替换亮洋红，文字清晰）
      '动漫': '#FF1493',      // 深粉色（保留，足够深）
      '电影': '#8B4513',      // 深棕色（保留，对比度高）
      '漫画': '#D2691E',      // 暖棕色（替换浅卡其，文字更清晰）
      '学术论文': '#34495E',  // 深灰（替换纯黑，更柔和不突兀）
      '哲学': '#006400',      // 墨绿色（保留，清晰）
      '历史': '#000080',      // 藏青色（保留，清晰）
      '社科': '#800000',      // 绛红色（保留，清晰）
    };

    // 默认配色（无标签或未匹配到题材时使用）
    const defaultColor = '#7F8C8D'; // 中性灰

    // 第一步：获取题材对应的专属主色
    let mainColor = defaultColor;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const firstTag = tags[0];
      mainColor = tagColorMap[firstTag] || defaultColor;
    }

    // 第二步：根据阅读状态调整颜色深浅，保持主色不变
    let adjustedColor = mainColor;
    if (status === '已读完') {
      adjustedColor = mainColor; // 已读完用原饱和度
    } else if (status === '阅读中') {
      adjustedColor = this.lightenColor(mainColor, 0.1); // 阅读中亮10%
    } else if (status === '未开始') {
      adjustedColor = this.desaturateColor(mainColor, 0.2); // 未开始降低饱和度20%
    }

    // 第三步：动态计算配套颜色（和原有逻辑保持兼容）
    const isLightColor = this.isLightColor(adjustedColor);

    // 左侧装饰条颜色
    let borderColor = adjustedColor;
    if (isLightColor) {
      borderColor = this.darkenColor(adjustedColor, 0.3); // 浅色调暗30%
    }

    // 卡片背景色（极淡版）
    const bgColor = this.hexToRgba(adjustedColor, 0.12);

    // 阴影颜色
    const shadowColor = this.hexToRgba(adjustedColor, 0.3);

    // 进度条颜色（保持高饱和主色）
    const progressColor = mainColor;

    return {
      main: adjustedColor,
      bg: bgColor,
      shadow: shadowColor,
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

  // 颜色提亮方法
  lightenColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.min(255, Math.round(r * (1 + amount)));
    g = Math.min(255, Math.round(g * (1 + amount)));
    b = Math.min(255, Math.round(b * (1 + amount)));

    return `rgb(${r}, ${g}, ${b})`;
  }

  // 颜色去饱和方法（降低饱和度）
  desaturateColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // 计算灰度值（ITU-R BT.709标准）
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // 和灰度值按比例混合
    r = Math.round(r * (1 - amount) + gray * amount);
    g = Math.round(g * (1 - amount) + gray * amount);
    b = Math.round(b * (1 - amount) + gray * amount);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // V3.0：构建知识库卡片的评分徽章 + 评分体系版本角标（决策 6-E）
  // 显示「原值」—— 即评分当时记录的 totalScore，不按当前评分体系重算。
  // 优先用 ratingHistory 最新一条；老数据回退到 book.rating。
  _buildBookRatingBadge(book) {
    let totalScore = null;
    let versionId = null;

    if (Array.isArray(book.ratingHistory) && book.ratingHistory.length > 0) {
      const latest = book.ratingHistory[book.ratingHistory.length - 1];
      totalScore = latest.totalScore;
      versionId = latest.criteriaVersionId;
    } else if (book.rating && typeof book.rating.totalScore === 'number') {
      totalScore = book.rating.totalScore;
    }

    if (totalScore === null || totalScore === undefined) return '';

    // 版本角标：优先显示版本 name，回退显示 id；当前版本不加额外强调
    let versionBadge = '';
    if (versionId) {
      const meta = getCriteriaVersionMeta(versionId);
      const label = versionId; // 角标用简短 id（如 rc_initial_v1）
      const title = meta ? `${meta.name}（${versionId}）` : versionId;
      const stale = (typeof getCurrentCriteriaVersionId === 'function' && versionId !== getCurrentCriteriaVersionId());
      versionBadge = `<span class="rating-version-badge${stale ? ' stale' : ''}" title="评分体系版本：${this.escapeHtml(title)}">${this.escapeHtml(label)}</span>`;
    }

    return `<span class="book-rating-badge">评分: ${totalScore.toFixed(1)}</span>${versionBadge}`;
  }

  createBookCard(book) {    const card = document.createElement('div');
    card.className = `book-card ${book.status}`;
    card.dataset.id = book.id;

    // 获取动态主题颜色
    const theme = this.getCardThemeColor(book.status, book.tags);
    card.style.setProperty('--theme-main', theme.main);
    card.style.setProperty('--theme-sub', theme.bg);
    card.style.setProperty('--theme-shadow', theme.shadow);
    card.style.setProperty('--theme-border', theme.border);
    card.style.setProperty('--theme-progress', theme.progress);
    card.style.setProperty('--card-status-color', theme.progress);

    const readingDuration = book.getReadingDuration();
    const durationText = readingDuration ? `${readingDuration} 天` : '-';

    // 根据 enableRating 决定是否显示评分按钮
    const showRatingBtn = book.enableRating === true;
    // 根据 enableInspiration 决定是否显示灵感按钮
    const showInspirationBtn = book.enableInspiration === true;
    // 如果已有评分，显示评分（决策 6-E：知识库显示「原值」+ 评分体系版本角标，不按当前版本重算）
    const ratingHtml = this._buildBookRatingBadge(book);

    const ratingButtonHtml = showRatingBtn
      ? `<button class="action-btn rating" data-action="rating" data-id="${book.id}">
           <i class="fas fa-star"></i> 评分
         </button>`
      : '';

    // 荣誉徽章（仅已完成状态显示，支持所有题材的完成状态）
    const completedStatuses = ['已读完', '已完成', '已看完', '已玩完', 'completed'];
    const honorBadge = completedStatuses.includes(book.status)
      ? `<div class="honor-badge">🏆 ${book.status}</div>`
      : '';

    card.innerHTML = `
      <div class="book-header">
        <div>
          <div class="book-title">${this.escapeHtml(book.title)}</div>
          <div class="book-author">${this.escapeHtml(book.author || '未知作者')}</div>
        </div>
        ${ratingHtml}
        <span class="book-status status-${book.status}">${this.getStatusLabel(book.tags[0] || 'default', book.status)}</span>
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
          <div class="date-label">记录时长</div>
          <div class="date-value">${durationText}</div>
        </div>
      </div>
      ${this.renderProgressBar(book)}
      ${book.evaluation ? `
        <div class="evaluation-summary">
          ${this.escapeHtml(book.evaluation.replace(/\n/g, ' ')).substring(0, 100)}${book.evaluation.length > 100 ? '…' : ''}
        </div>
      ` : ''}
      <div class="book-footer">
        ${honorBadge}
        <div class="book-actions">
          <button class="action-btn edit" data-action="edit" data-id="${book.id}">
            <i class="fas fa-edit"></i> 编辑
          </button>
          <button class="action-btn delete" data-action="delete" data-id="${book.id}">
            <i class="fas fa-trash"></i> 删除
          </button>
          <button class="action-btn evaluation" data-action="evaluation" data-id="${book.id}">
            <i class="fas fa-pen-fancy"></i> 总评
          </button>
          ${showInspirationBtn ? `<button class="action-btn inspiration-link" data-action="inspiration" data-id="${book.id}">
            <i class="fas fa-lightbulb"></i> 灵感
          </button>` : ''}
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

    // 只有在启用灵感功能时才绑定灵感按钮事件
    const inspirationBtn = card.querySelector('[data-action="inspiration"]');
    if (inspirationBtn) {
      inspirationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchView('inspiration', book.id);
      });
    }

    // 只有在启用评分功能时才绑定评分按钮事件
    const ratingBtn = card.querySelector('[data-action="rating"]');
    if (ratingBtn) {
      ratingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openRatingModal(book.id);
      });
    }

    // 总评按钮事件
    const evaluationBtn = card.querySelector('[data-action="evaluation"]');
    if (evaluationBtn) {
      evaluationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.openEvaluationModal(book.id);
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
      // 将数据库中的显示文本转换为内部值
      const displayToInternal = {
        '已读完': 'completed',
        '已完成': 'completed',
        '阅读中': 'reading',
        '进行中': 'reading',
        '未开始': 'unstarted',
        '已看完': 'completed',
        '观看中': 'reading',
        '已玩完': 'completed',
        '游玩中': 'reading'
      };
      this.statusSelect.value = displayToInternal[book.status] || book.status;
      this.currentProgressInput.value = book.currentProgress || 0;
      this.totalLengthInput.value = book.totalLength || '';
      this.progressUnitSelect.value = book.progressUnit || '章';
      this.enableRatingCheckbox.checked = book.enableRating === true;
      this.enableInspirationCheckbox.checked = book.enableInspiration === true;
    } else {
      this.bookIdInput.value = '';
      this.titleInput.value = '';
      this.authorInput.value = '';
      this.startDateInput.value = '';
      this.endDateInput.value = '';
      this.statusSelect.value = 'unstarted';
      this.currentProgressInput.value = '';
      this.totalLengthInput.value = '';
      this.progressUnitSelect.value = '章';
      this.enableRatingCheckbox.checked = false;
      this.enableInspirationCheckbox.checked = false;
    }

    // 渲染已选标签
    this.renderSelectedTags();
    // 渲染题材标签
    this.renderFormatTags();
    // 渲染类型标签
    this.renderGenreTags();

    // 状态联动逻辑：初始化进度输入框状态
    this.handleStatusChange();

    // 题材变化监听器：实时更新状态称谓
    // 题材使用按钮组，需要监听按钮点击事件
    const formatTagsContainer = document.getElementById('formatTags');
    if (formatTagsContainer) {
      // 初始化状态选项（获取当前选中的题材）
      const selectedFormat = this.currentTags.length > 0 && this.isFormatTag(this.currentTags[0])
        ? this.currentTags[0]
        : this.formatTags[0];
      this.updateStatusOptions(selectedFormat);

      // 监听题材按钮点击
      formatTagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('preset-tag')) {
          const selectedTag = e.target.dataset.tag;
          this.updateStatusOptions(selectedTag);
        }
      });
    }

    this.bookFormSection.style.display = 'block';
    this.titleInput.focus();
  }

  // 总计输入变化时，同步更新当前进度（仅在已读完状态下）
  handleTotalLengthChange() {
    const status = this.statusSelect.value;
    if (status === 'completed' && this.totalLengthInput.value && parseInt(this.totalLengthInput.value) > 0) {
      this.currentProgressInput.value = this.totalLengthInput.value;
    }
  }

  // 更新状态标签称谓
  updateStatusLabels() {
    // 获取第一个书籍的题材作为参考（如果存在）
    const firstBook = this.books && this.books.length > 0 ? this.books[0] : null;
    const referenceGenre = firstBook && firstBook.tags && firstBook.tags.length > 0 ? firstBook.tags[0] : 'default';

    // 更新统计面板中的状态标签
    const completedLabel = document.getElementById('completedLabel');
    const readingLabel = document.getElementById('readingLabel');

    if (completedLabel) {
      completedLabel.textContent = this.getStatusLabel(referenceGenre, 'completed');
    }
    if (readingLabel) {
      readingLabel.textContent = this.getStatusLabel(referenceGenre, 'reading');
    }

    // 更新筛选面板中的状态标签（如果存在）
    const filterStatusLabels = document.querySelectorAll('.filter-status-label');
    filterStatusLabels.forEach(label => {
      const status = label.dataset.status;
      if (status) {
        label.textContent = this.getStatusLabel(referenceGenre, status);
      }
    });
  }

  // 更新状态选项
  updateStatusOptions(genre) {
    const statusSelect = document.getElementById('status');
    if (!statusSelect) return;

    // 获取当前选中的值，以便保持数据一致性
    const currentValue = statusSelect.value;

    // 将显示文本映射到内部值
    const displayToInternal = {
      '已读完': 'completed',
      '已完成': 'completed',
      '阅读中': 'reading',
      '进行中': 'reading',
      '未开始': 'unstarted',
      '已看完': 'completed',
      '观看中': 'reading',
      '已玩完': 'completed',
      '游玩中': 'reading'
    };

    // 转换为内部值（如果当前值是显示文本）
    const internalValue = displayToInternal[currentValue] || currentValue;

    // 清空现有选项
    statusSelect.innerHTML = '';

    // 根据题材确定分类
    let category = 'default';
    for (const [cat, genres] of Object.entries(this.genreCategories)) {
      if (genres.includes(genre)) {
        category = cat;
        break;
      }
    }

    // 获取对应的状态称谓
    const statusLabels = this.statusLabels[category];

    // 添加新选项
    Object.entries(statusLabels).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      statusSelect.appendChild(option);
    });

    // 恢复之前选中的值（如果存在且有效）
    if (internalValue && statusLabels[internalValue]) {
      statusSelect.value = internalValue;
    } else {
      // 默认选择第一个选项
      statusSelect.value = Object.keys(statusLabels)[0];
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
    if (status === 'completed' && totalLength > 0) {
      currentProgress = totalLength;
    }

    // 获取当前题材以确定正确的显示文本
    const firstTag = this.currentTags.length > 0 ? this.currentTags[0] : this.formatTags[0];
    let category = 'default';
    for (const [cat, genres] of Object.entries(this.genreCategories)) {
      if (genres.includes(firstTag)) {
        category = cat;
        break;
      }
    }

    // 根据题材获取对应的显示文本
    const displayStatus = this.getStatusLabel(firstTag, status);

    const bookData = {
      title: this.titleInput.value.trim(),
      author: this.authorInput.value.trim(),
      startDate: this.startDateInput.value || null,
      endDate: this.endDateInput.value || null,
      status: displayStatus,
      currentProgress: currentProgress,
      totalLength: totalLength,
      progressUnit: this.progressUnitSelect.value,
      enableRating: this.enableRatingCheckbox ? this.enableRatingCheckbox.checked : false,
      enableInspiration: this.enableInspirationCheckbox ? this.enableInspirationCheckbox.checked : false,
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
    log('查看书籍:', bookId);
  }

  // 从日记跳转至作品详情
  jumpToBook(bookId) {
    // 1. 查找作品
    const book = this.storageService.getBookById(bookId);
    if (!book) {
      this.showToast('该作品已不存在', 'warning');
      return;
    }

    // 2. 切换到知识库视图
    this.switchView('knowledge');

    // 3. 关闭日记相关弹窗
    this.hideAllModals();
    this.closeJournalViewModal();

    // 4. 清除筛选条件
    this.clearFilters();

    // 5. 切换到全部作品
    this.currentFolderId = 'all';

    // 6. 设置搜索框
    if (this.globalSearchInput) {
      this.globalSearchInput.value = book.title;
    }

    // 7. 渲染
    this.renderBooks(book.title);
    this.renderFolders();
  }

  showDeleteModal(book) {
    this.bookToDelete = book;
    this.deleteMessage.textContent = `确定要删除《${book.title}》吗？此操作无法撤销。`;

    // 🌟 就是下面这一行，把 'block' 改成 'flex'
    this.deleteModal.style.display = 'flex';

    console.trace('showDeleteModal: 设置 overlay 为 block');
    this.overlay.classList.add('active');
  }

  hideDeleteModal() {
    this.deleteModal.style.display = 'none';
    this.overlay.classList.remove('active');
    this.bookToDelete = null;
  }

  // 统一关闭所有模态框
  closeAllModals() {
    // 关闭删除模态框
    if (this.deleteModal) this.deleteModal.style.display = 'none';
    // 关闭评分模态框
    if (this.ratingModal) this.ratingModal.style.display = 'none';
    // 关闭对比模态框
    if (this.compareRatingModal) this.compareRatingModal.style.display = 'none';
    // 关闭统计模态框
    if (this.statsModal) this.statsModal.style.display = 'none';
    // 关闭导出模态框
    if (this.exportModal) this.exportModal.style.display = 'none';
    // 关闭导入模态框
    if (this.importModal) this.importModal.style.display = 'none';
    // 关闭文件夹模态框
    const folderModal = document.getElementById('folderModal');
    if (folderModal) folderModal.style.display = 'none';
    // 关闭灵感模态框
    const inspirationModal = document.getElementById('inspirationModal');
    if (inspirationModal) inspirationModal.style.display = 'none';
    // 关闭灵感视图模态框
    const inspirationViewModal = document.getElementById('inspirationViewModal');
    if (inspirationViewModal) inspirationViewModal.style.display = 'none';
    // 关闭灵感删除模态框
    const inspirationDeleteModal = document.getElementById('inspirationDeleteModal');
    if (inspirationDeleteModal) inspirationDeleteModal.style.display = 'none';
    // 关闭 AI 相关模态框（加判空保护）
    const aiReadModal = document.getElementById('aiReadModal');
    if (aiReadModal) aiReadModal.style.display = 'none';
    const aiSettingsModal = document.getElementById('aiSettingsModal');
    if (aiSettingsModal) aiSettingsModal.style.display = 'none';
    const criteriaModal = document.getElementById('criteriaModal');
    if (criteriaModal) criteriaModal.style.display = 'none';
    // 关闭过滤面板
    this.hideFilterPanel();
    // 隐藏遮罩
    this.overlay.classList.remove('active');
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

    // 日期联动逻辑（使用内部值）
    if (status === 'completed' && !this.endDateInput.value) {
      this.endDateInput.value = new Date().toISOString().split('T')[0];
    }
    if (status === 'unstarted') {
      this.startDateInput.value = '';
      this.endDateInput.value = '';
    }
    if (status === 'reading' && !this.startDateInput.value) {
      this.startDateInput.value = new Date().toISOString().split('T')[0];
    }

    // 进度输入框联动逻辑
    const currentProgressInput = this.currentProgressInput;
    const totalLengthInput = this.totalLengthInput;
    const progressUnitSelect = this.progressUnitSelect;

    if (status === 'unstarted') {
      // 未开始：禁用所有进度输入
      currentProgressInput.disabled = true;
      totalLengthInput.disabled = true;
      progressUnitSelect.disabled = true;
      currentProgressInput.removeAttribute('readonly');
      currentProgressInput.value = '';
      totalLengthInput.value = '';
    } else if (status === 'reading') {
      // 阅读中：启用所有进度输入
      currentProgressInput.disabled = false;
      totalLengthInput.disabled = false;
      progressUnitSelect.disabled = false;
      currentProgressInput.removeAttribute('readonly');
    } else if (status === 'completed') {
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
    log('显示导出模态框');
    this.exportModal.style.display = 'flex';
    console.trace('showExportModal: 设置 overlay 为 block');
    this.overlay.classList.add('active');
  }

  // 显示统计模态框
  showStatsModal() {
    log('显示统计模态框');
    // 更新标题显示当前文件夹
    const folderId = this.currentFolderId || 'all';
    const folderTitle = folderId === 'all' ? '全部作品' : this.getFolderName(folderId);
    const headerTitle = this.statsModal.querySelector('.modal-header h3');
    if (headerTitle) {
      headerTitle.innerHTML = `<i class="fas fa-chart-bar"></i> ${folderTitle} - 阅读统计`;
    }
    this.statsModal.style.display = 'flex';
    console.trace('showStatsModal: 设置 overlay 为 block');
    this.overlay.classList.add('active');
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
    this.overlay.classList.remove('active');
    this.destroyAllCharts();
  }

  // ======== 评分对比功能 ========

  // 迁移旧版评分数据到新格式 rating_details
  migrateBookToRatingDetails(book) {
    if (book.rating_details && Object.keys(book.rating_details).length > 0) {
      return book; // 已经是新格式
    }
    if (!book.rating || !book.rating.ratings) {
      return book; // 没有旧数据
    }

    // 建立中文名到英文ID的映射
    const nameToIdMap = {};
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
    Object.values(profile).forEach(layer => {
      layer.forEach(dim => {
        nameToIdMap[dim.name] = this.getDimensionIdByName(dim.name);
      });
    });

    // 迁移
    book.rating_details = {};
    Object.entries(book.rating.ratings).forEach(([chineseName, value]) => {
      const id = nameToIdMap[chineseName];
      if (id) {
        book.rating_details[id] = value;
      }
    });

    return book;
  }

  // 根据中文名获取维度ID
  getDimensionIdByName(name) {
    const allDims = getAllDimensions();
    const dim = allDims.find(d => d.name === name);
    return dim ? dim.id : null;
  }

  // 显示评分对比模态框
  showCompareModal() {
    // 迁移旧数据到新格式
    this.storageService.books.forEach(book => this.migrateBookToRatingDetails(book));

    // 初始化临时权重
    initVolatileCriteria();
    this.buildWeightSliders();

    const ratedBooks = this.storageService.books.filter(b => !b.deleted && b.rating_details && Object.keys(b.rating_details).length > 0);

    if (ratedBooks.length < 2) {
      this.showToast('需要至少2本已评分的书籍才能对比', 'warning');
      return;
    }

    this.populateCompareSelectors(ratedBooks);
    this.compareRatingModal.style.display = 'flex';
    this.overlay.classList.add('active');
  }

  // 构建权重滑块
  buildWeightSliders() {
    const container = document.getElementById('weightSlidersContainer');
    if (!container) return;
    if (!volatileCriteria) {
      initVolatileCriteria();
    }
    if (!volatileCriteria) return;

    const layerMap = {
      'author_layer': '作者层面',
      'text_layer': '文本层面',
      'reader_layer': '读者层面'
    };

    let html = '';
    Object.entries(volatileCriteria).forEach(([layerKey, dims]) => {
      html += `<div class="weight-tag-group">${layerMap[layerKey] || layerKey}</div>`;
      dims.forEach(dim => {
        const disabled = dim.weight === 0 ? 'disabled' : '';
        const disabledClass = dim.weight === 0 ? ' disabled' : '';
        html += `
          <div class="weight-slider-group${disabledClass}" data-dim-id="${dim.id}">
            <label>
              <span>${dim.name}</span>
              <span class="weight-value">${dim.weight}</span>
            </label>
            <input type="range" min="0" max="10" step="0.5" value="${dim.weight}" data-dim-id="${dim.id}">
          </div>
        `;
      });
    });

    container.innerHTML = html;

    // 绑定滑块事件（防抖）
    container.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', debounce((e) => {
        this.onWeightSliderChange(e.target.dataset.dimId, parseFloat(e.target.value));
      }, 50));
    });
  }

  // 权重滑块变化处理
  onWeightSliderChange(dimId, newWeight) {
    // 更新 volatileCriteria
    Object.values(volatileCriteria).forEach(layer => {
      const dim = layer.find(d => d.id === dimId);
      if (dim) {
        dim.weight = newWeight;
        // 更新显示的值
        const sliderGroup = document.querySelector(`.weight-slider-group[data-dim-id="${dimId}"]`);
        if (sliderGroup) {
          sliderGroup.querySelector('.weight-value').textContent = newWeight;
          sliderGroup.classList.toggle('disabled', newWeight === 0);
          sliderGroup.querySelector('input').disabled = (newWeight === 0);
        }
      }
    });

    // 重新渲染所有图表
    this.reRenderCompareCharts();
  }

  // 重新渲染所有对比图表
  reRenderCompareCharts() {
    const bookAId = document.getElementById('compareBookA')?.value;
    const bookBId = document.getElementById('compareBookB')?.value;
    if (!bookAId || !bookBId) return;

    const bookA = this.storageService.books.find(b => b.id === bookAId);
    const bookB = this.storageService.books.find(b => b.id === bookBId);
    if (!bookA || !bookB) return;

    const dimensions = getAllDimensions();
    this.renderCompareStackedBarChart(bookA, bookB);
    this.renderCompareHeatmapChart(bookA, bookB, dimensions);
    this.renderLayerRadarChart(bookA, bookB);
    this.renderCoreRadarChart(bookA, bookB);
    this.renderScatterChart(this.currentScatterMode || 'two');
  }

  // 重置权重
  resetWeights() {
    resetVolatileCriteria();
    this.buildWeightSliders();
    this.reRenderCompareCharts();
  }

  // 切换权重面板
  toggleWeightPanel() {
    const panel = document.getElementById('weightAdjusterPanel');
    panel.classList.toggle('open');
  }

  // 填充对比书籍选择器
  populateCompareSelectors(books) {
    const selectA = document.getElementById('compareBookA');
    const selectB = document.getElementById('compareBookB');
    if (!selectA || !selectB) return;

    const options = books.map(book => {
      const scores = calculateWeightedScores(book, getActiveCriteria());
      return `<option value="${book.id}">${book.title} (${scores.total.toFixed(1)}分)</option>`;
    }).join('');

    selectA.innerHTML = '<option value="">请选择...</option>' + options;
    selectB.innerHTML = '<option value="">请选择...</option>' + options;

    selectA.onchange = () => this.onCompareSelectionChange();
    selectB.onchange = () => this.onCompareSelectionChange();
  }

  // 处理对比书籍选择变化
  onCompareSelectionChange() {
    const bookAId = document.getElementById('compareBookA').value;
    const bookBId = document.getElementById('compareBookB').value;
    const chartsContainer = document.getElementById('compareChartsContainer');

    if (!bookAId || !bookBId) {
      chartsContainer.style.display = 'none';
      return;
    }

    if (bookAId === bookBId) {
      this.showToast('请选择两本不同的书籍', 'warning');
      return;
    }

    const bookA = this.storageService.books.find(b => b.id === bookAId);
    const bookB = this.storageService.books.find(b => b.id === bookBId);
    if (!bookA || !bookB) return;

    chartsContainer.style.display = 'block';
    const dimensions = getAllDimensions();
    this.renderCompareStackedBarChart(bookA, bookB);
    this.renderCompareHeatmapChart(bookA, bookB, dimensions);
    this.renderLayerRadarChart(bookA, bookB);
    this.renderCoreRadarChart(bookA, bookB);

    // 重置散点图模式并渲染
    document.querySelectorAll('.compare-scatter-toggle .toggle-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.mode === 'two') btn.classList.add('active');
      btn.onclick = () => this.onScatterModeChange(btn.dataset.mode);
    });
    // 隐藏标签筛选器
    const tagFilter = document.getElementById('scatterTagFilter');
    if (tagFilter) tagFilter.style.display = 'none';
    this.renderScatterChart('two');
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

    // 添加玫瑰图
    tableHtml += `
      <div class="compare-rose-container">
        <h4>玫瑰图对比</h4>
        <div id="compareRoseChart" class="compare-rose-chart"></div>
      </div>
    `;

    this.compareResults.innerHTML = tableHtml;

    // 渲染玫瑰图 - 等待DOM渲染完成
    setTimeout(() => {
      this.renderCompareRoseChart(selectedBooks);
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
        dims.forEach((d) => {
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
          const booksData = tooltipData[layerIdx];

          // 边框颜色淡化
          const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
          const borderColorStrong = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

          // 紧凑表格样式
          const tableStyle = `style="width:auto;border-collapse:collapse;font-size:10px;line-height:1.2;"`;
          const tdStyle = `style="padding:2px 4px;text-align:center;border-bottom:1px solid ${borderColor};width:60px;"`;
          const dimCellStyle = `style="padding:2px 4px;text-align:left;border-bottom:1px solid ${borderColor};color:${isDark ? '#999' : '#666'};white-space:nowrap;"`;

          // 标题居中 11px
          let html = `<div style="font-weight:bold;font-size:11px;text-align:center;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid ${borderColorStrong};">${layerName}</div>`;
          html += `<table ${tableStyle}>`;

          // 表头行：第一列是维度名称，后面是每本书的名称（带颜色+加粗）
          html += `<tr>`;
          // 评价维度列 - 灰色
          html += `<th style="padding:2px 4px;text-align:center;border-bottom:1px solid ${borderColorStrong};background:${isDark ? '#2a2a2a' : '#f8f8f8'};font-weight:bold;color:${isDark ? '#aaa' : '#666'};">评价维度</th>`;
          // 作品列 - 使用作品对应的雷达图颜色
          booksData.forEach(bookData => {
            html += `<th style="padding:2px 4px;text-align:center;border-bottom:1px solid ${borderColorStrong};background:${isDark ? '#2a2a2a' : '#f8f8f8'};font-weight:bold;color:${bookData.color};">${bookData.name}</th>`;
          });
          html += `</tr>`;

          // 数据行：每个维度一行，每列显示对应作品的分值
          dims.forEach((d) => {
            html += `<tr>`;
            // 第一列：维度名称
            html += `<td ${dimCellStyle}>${d.name}</td>`;
            // 后续列：每个作品在该维度的分值
            booksData.forEach(bookData => {
              const score = bookData.values[d.name];
              const scoreText = score > 0 ? '+' + score : (score === 0 ? '0' : score);
              // 得分颜色：+1绿色，0灰色，-1红色
              const displayColor = score > 0 ? '#2ecc71' : (score < 0 ? '#e74c3c' : '#95a5a6');
              html += `<td style="padding:2px 4px;text-align:center;border-bottom:1px solid ${borderColor};width:60px;color:${displayColor};font-weight:bold;">${scoreText}</td>`;
            });
            html += `</tr>`;
          });

          html += `</table>`;
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

  // 渲染玫瑰图（极坐标堆叠柱状图）
  renderCompareRoseChart(selectedBooks) {
    const chartDom = document.getElementById('compareRoseChart');
    if (!chartDom) return;

    if (this.compareRadarChart) {
      this.compareRadarChart.dispose();
      this.compareRadarChart = null;
    }

    const colors = ['#FF1744', '#3498db', '#2E7D32', '#FFB300', '#B71C1C', '#1abc9c', '#FF80AB', '#34495e'];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];

    // 构建极坐标数据
    const layers = ['作者层面', '文本层面', '读者层面'];
    const angleAxisData = [];

    layers.forEach(layer => {
      const dims = profile[layer] || [];
      dims.forEach(d => {
        angleAxisData.push(d.name);
      });
    });

    const series = selectedBooks.map((book, bookIdx) => {
      const bookRatings = book.rating && book.rating.ratings ? book.rating.ratings : {};
      const data = angleAxisData.map(dimName => {
        const rating = bookRatings[dimName];
        return (rating !== undefined && rating !== null) ? rating + 2 : 1;
      });

      return {
        type: 'bar',
        data: data,
        coordinateSystem: 'polar',
        name: book.title,
        stack: 'total',
        itemStyle: { color: colors[bookIdx % colors.length] },
        emphasis: { focus: 'series' }
      };
    });

    this.compareRadarChart = echarts.init(chartDom);
    this.compareRadarChart.setOption({
      color: colors,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        textStyle: { color: isDark ? '#fff' : '#333' }
      },
      legend: {
        data: selectedBooks.map(b => b.title),
        bottom: 10,
        textStyle: { color: isDark ? '#aaa' : '#666' }
      },
      polar: { center: ['50%', '50%'], radius: '70%' },
      radiusAxis: {
        max: 3, min: 0,
        axisLabel: { formatter: (val) => ['-', '0', '+'][val - 1] || '' }
      },
      angleAxis: {
        type: 'category',
        data: angleAxisData,
        axisLabel: { fontSize: 9, rotate: 45 },
        splitLine: { show: true }
      },
      series: series
    });

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
    this.overlay.classList.remove('active');
    if (this.compareRadarChart) {
      this.compareRadarChart.dispose();
      this.compareRadarChart = null;
    }
    if (this.compareStackedBarChart) {
      this.compareStackedBarChart.dispose();
      this.compareStackedBarChart = null;
    }
    if (this.compareHeatmapChart) {
      this.compareHeatmapChart.dispose();
      this.compareHeatmapChart = null;
    }
    if (this.compareLayerRadarChart) {
      this.compareLayerRadarChart.dispose();
      this.compareLayerRadarChart = null;
    }
    if (this.compareCoreRadarChart) {
      this.compareCoreRadarChart.dispose();
      this.compareCoreRadarChart = null;
    }
    if (this.compareScatterChart) {
      this.compareScatterChart.dispose();
      this.compareScatterChart = null;
    }
    // Clear selectors
    const selectA = document.getElementById('compareBookA');
    const selectB = document.getElementById('compareBookB');
    if (selectA) selectA.value = '';
    if (selectB) selectB.value = '';
    const chartsContainer = document.getElementById('compareChartsContainer');
    if (chartsContainer) chartsContainer.style.display = 'none';
  }

  // 渲染堆叠柱状图（宏观对比）
  renderCompareStackedBarChart(bookA, bookB) {
    const chartDom = document.getElementById('compareStackedBarChart');
    if (!chartDom) return;

    if (this.compareStackedBarChart) {
      this.compareStackedBarChart.dispose();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8f9fa' : '#333';
    const scoresA = calculateWeightedScores(bookA, RATING_CRITERIA);
    const scoresB = calculateWeightedScores(bookB, RATING_CRITERIA);
    const maxTotal = Math.max(scoresA.total, scoresB.total);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? 'rgba(50,50,50,0.98)' : 'rgba(255,255,255,0.98)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: textColor, fontSize: 12 },
        padding: [8, 12],
        formatter: (params) => {
          const bookTitle = params[0].name;
          const bookScores = bookTitle === bookA.title ? scoresA : scoresB;
          const totalScore = bookScores.total;
          let result = `<strong>${bookTitle}</strong><br/>`;
          params.forEach(param => {
            const layerName = param.seriesName;
            const value = param.value;
            const percent = totalScore !== 0 ? ((value / totalScore) * 100).toFixed(1) : 0;
            result += `${layerName}: ${value.toFixed(1)} (${percent}%)<br/>`;
          });
          result += `<strong>总分: ${totalScore.toFixed(1)}</strong>`;
          return result;
        }
      },
      legend: {
        data: ['作者层面', '文本层面', '读者层面'],
        bottom: 0,
        textStyle: { color: textColor }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: [bookA.title, bookB.title],
        axisLabel: { color: textColor, fontSize: 12 },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } }
      },
      yAxis: {
        type: 'value',
        max: (value) => Math.ceil(value.max / 10) * 10 + 20,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
      },
      series: [
        {
          name: '作者层面',
          type: 'bar',
          stack: 'total',
          data: [scoresA.authorLayer, scoresB.authorLayer],
          itemStyle: { color: '#FF1744' },
          barWidth: '35%'
        },
        {
          name: '文本层面',
          type: 'bar',
          stack: 'total',
          data: [scoresA.textLayer, scoresB.textLayer],
          itemStyle: { color: '#3498db' },
          barWidth: '35%'
        },
        {
          name: '读者层面',
          type: 'bar',
          stack: 'total',
          data: [scoresA.readerLayer, scoresB.readerLayer],
          itemStyle: { color: '#2E7D32' },
          barWidth: '35%'
        }
      ]
    };

    this.compareStackedBarChart = echarts.init(chartDom);
    this.compareStackedBarChart.setOption(option);
  }

  // 渲染热力图（微观对比）
  renderCompareHeatmapChart(bookA, bookB, dimensions) {
    const chartDom = document.getElementById('compareHeatmapChart');
    if (!chartDom) return;

    if (this.compareHeatmapChart) {
      this.compareHeatmapChart.dispose();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const heatmapData = [];
    const yAxisLabels = [];

    dimensions.forEach((dim, yIdx) => {
      yAxisLabels.push(dim.name);
      const valA = bookA.rating_details?.[dim.id] || 0;
      const valB = bookB.rating_details?.[dim.id] || 0;
      heatmapData.push([0, yIdx, valA]);
      heatmapData.push([1, yIdx, valB]);
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: isDark ? '#fff' : '#333' },
        formatter: (params) => {
          const dimName = yAxisLabels[params.value[1]];
          const bookName = params.value[0] === 0 ? bookA.title : bookB.title;
          const value = params.value[2];
          const weight = dimensions[params.value[1]].weight;
          return `<strong>${bookName}</strong><br/>${dimName}<br/>得分: ${value > 0 ? '+' : ''}${value} (权重: ${weight})`;
        }
      },
      grid: {
        left: '22%',
        right: '12%',
        top: '2%',
        bottom: '10%'
      },
      xAxis: {
        type: 'category',
        data: [bookA.title, bookB.title],
        position: 'top',
        axisLabel: {
          color: isDark ? '#f8f9fa' : '#333',
          fontSize: 11
        },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } },
        splitArea: { show: true, areaStyle: { color: [isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 'transparent'] } }
      },
      yAxis: {
        type: 'category',
        data: yAxisLabels,
        inverse: true,
        axisLabel: {
          color: isDark ? '#f8f9fa' : '#333',
          fontSize: 10
        },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } },
        splitArea: { show: true, areaStyle: { color: [isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 'transparent'] } }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: false,
        orient: 'vertical',
        right: '2%',
        top: 'center',
        itemWidth: 12,
        itemHeight: 200,
        pieces: [
          { value: 1, color: '#2ecc71' },
          { value: 0, color: '#95a5a6' },
          { value: -1, color: '#e74c3c' }
        ],
        textStyle: { color: isDark ? '#f8f9fa' : '#333' }
      },
      series: [{
        name: '评分对比',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          formatter: (params) => dimensions[params.value[1]].weight.toString(),
          color: isDark ? '#fff' : '#333',
          fontSize: 9,
          fontWeight: 'bold'
        },
        itemStyle: {
          borderColor: isDark ? '#333' : '#fff',
          borderWidth: 1
        },
        emphasis: {
          itemStyle: {
            borderColor: '#333',
            borderWidth: 2
          }
        }
      }]
    };

    this.compareHeatmapChart = echarts.init(chartDom);
    this.compareHeatmapChart.setOption(option);
  }

  // 渲染三层雷达图（综合素质）
  renderLayerRadarChart(bookA, bookB) {
    const chartDom = document.getElementById('compareLayerRadarChart');
    if (!chartDom) return;

    if (this.compareLayerRadarChart) {
      this.compareLayerRadarChart.dispose();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8f9fa' : '#333';
    const scoresA = calculateWeightedScores(bookA, RATING_CRITERIA);
    const scoresB = calculateWeightedScores(bookB, RATING_CRITERIA);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: textColor }
      },
      legend: {
        data: [bookA.title, bookB.title],
        bottom: 0,
        textStyle: { color: textColor }
      },
      radar: {
        indicator: [
          { name: '作者层面', max: 10 },
          { name: '文本层面', max: 19.5 },
          { name: '读者层面', max: 20 }
        ],
        shape: 'triangle',
        splitNumber: 4,
        axisName: { color: textColor, fontSize: 12 },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' } },
        splitArea: { areaStyle: { color: [isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 'transparent'] } },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: [scoresA.authorLayer, scoresA.textLayer, scoresA.readerLayer],
            name: bookA.title,
            lineStyle: { color: '#FF1744', width: 2 },
            areaStyle: { color: 'rgba(255,23,68,0.3)' },
            itemStyle: { color: '#FF1744' }
          },
          {
            value: [scoresB.authorLayer, scoresB.textLayer, scoresB.readerLayer],
            name: bookB.title,
            lineStyle: { color: '#3498db', width: 2 },
            areaStyle: { color: 'rgba(52,152,219,0.3)' },
            itemStyle: { color: '#3498db' }
          }
        ]
      }]
    };

    this.compareLayerRadarChart = echarts.init(chartDom);
    this.compareLayerRadarChart.setOption(option);
  }

  // 渲染核心指标雷达图（权重≥2，归一化到0-10）
  renderCoreRadarChart(bookA, bookB) {
    const chartDom = document.getElementById('compareCoreRadarChart');
    if (!chartDom) return;

    if (this.compareCoreRadarChart) {
      this.compareCoreRadarChart.dispose();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8f9fa' : '#333';

    // 筛选权重≥2的维度
    const allDims = getAllDimensions();
    const coreDims = allDims.filter(d => d.weight >= 2);

    // 归一化函数：selection(-1,0,1) → (0, 5, 10)
    const normalize = (selection) => ((selection + 1) / 2) * 10;

    const dataA = coreDims.map(dim => normalize(bookA.rating_details?.[dim.id] || 0));
    const dataB = coreDims.map(dim => normalize(bookB.rating_details?.[dim.id] || 0));

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: textColor }
      },
      legend: {
        data: [bookA.title, bookB.title],
        bottom: 0,
        textStyle: { color: textColor }
      },
      radar: {
        indicator: coreDims.map(dim => ({ name: dim.name, max: 10 })),
        shape: 'polygon',
        splitNumber: 5,
        axisName: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' } },
        splitArea: { areaStyle: { color: [isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 'transparent'] } },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: dataA,
            name: bookA.title,
            lineStyle: { color: '#FF1744', width: 2 },
            areaStyle: { color: 'rgba(255,23,68,0.3)' },
            itemStyle: { color: '#FF1744' }
          },
          {
            value: dataB,
            name: bookB.title,
            lineStyle: { color: '#3498db', width: 2 },
            areaStyle: { color: 'rgba(52,152,219,0.3)' },
            itemStyle: { color: '#3498db' }
          }
        ]
      }]
    };

    this.compareCoreRadarChart = echarts.init(chartDom);
    this.compareCoreRadarChart.setOption(option);
  }

  // 渲染库内散点图
  renderScatterChart(mode = 'two') {
    const chartDom = document.getElementById('compareScatterChart');
    if (!chartDom) return;

    if (this.compareScatterChart) {
      this.compareScatterChart.dispose();
    }

    this.currentScatterMode = mode;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8f9fa' : '#333';

    const bookAId = document.getElementById('compareBookA')?.value;
    const bookBId = document.getElementById('compareBookB')?.value;

    // 获取所有已评分的书
    let allBooks = this.storageService.books.filter(b => !b.deleted && b.rating_details && Object.keys(b.rating_details).length > 0);

    // 基准线相关变量
    let markLineData = [];
    let avgTextLayer = 0;
    let avgReaderLayer = 0;

    // 处理基准线模式
    if (mode === 'vs-all-avg') {
      const ratedBooks = allBooks.filter(b => b.rating_details);
      if (ratedBooks.length > 0) {
        const totalText = ratedBooks.reduce((sum, b) => {
          const scores = calculateWeightedScores(b, getActiveCriteria());
          return sum + scores.textLayer;
        }, 0);
        const totalReader = ratedBooks.reduce((sum, b) => {
          const scores = calculateWeightedScores(b, getActiveCriteria());
          return sum + scores.readerLayer;
        }, 0);
        avgTextLayer = totalText / ratedBooks.length;
        avgReaderLayer = totalReader / ratedBooks.length;

        markLineData = [
          {
            xAxis: avgTextLayer,
            lineStyle: { color: '#FFB300', type: 'dashed', width: 2 },
            label: { formatter: `全库均值 X: ${avgTextLayer.toFixed(1)}`, position: 'end', color: '#FFB300' }
          },
          {
            yAxis: avgReaderLayer,
            lineStyle: { color: '#FFB300', type: 'dashed', width: 2 },
            label: { formatter: `均值 Y: ${avgReaderLayer.toFixed(1)}`, position: 'end', color: '#FFB300' }
          }
        ];
      }
    } else if (mode === 'vs-tag-avg') {
      const tagSelect = document.getElementById('scatterTagSelect');
      const selectedTag = tagSelect?.value;
      if (selectedTag) {
        const tagBooks = allBooks.filter(b => b.tags && b.tags.includes(selectedTag));
        if (tagBooks.length > 0) {
          const totalText = tagBooks.reduce((sum, b) => {
            const scores = calculateWeightedScores(b, getActiveCriteria());
            return sum + scores.textLayer;
          }, 0);
          const totalReader = tagBooks.reduce((sum, b) => {
            const scores = calculateWeightedScores(b, getActiveCriteria());
            return sum + scores.readerLayer;
          }, 0);
          avgTextLayer = totalText / tagBooks.length;
          avgReaderLayer = totalReader / tagBooks.length;

          markLineData = [
            {
              xAxis: avgTextLayer,
              lineStyle: { color: '#9C27B0', type: 'dashed', width: 2 },
              label: { formatter: `${selectedTag}均值 X: ${avgTextLayer.toFixed(1)}`, position: 'end', color: '#9C27B0' }
            },
            {
              yAxis: avgReaderLayer,
              lineStyle: { color: '#9C27B0', type: 'dashed', width: 2 },
              label: { formatter: `${selectedTag}均值 Y: ${avgReaderLayer.toFixed(1)}`, position: 'end', color: '#9C27B0' }
            }
          ];
        }
      }
    }

    // 按标签分组构建 series
    const tagColors = ['#FF1744', '#3498db', '#2E7D32', '#FFB300', '#9C27B0', '#00BCD4', '#FF5722', '#607D8B'];
    const tagMap = {};

    allBooks.forEach(book => {
      const scores = calculateWeightedScores(book, getActiveCriteria());
      const isBookA = book.id === bookAId;
      const isBookB = book.id === bookBId;
      const isSelected = isBookA || isBookB;

      // 获取书的第一个标签作为分组依据
      const bookTag = (book.tags && book.tags.length > 0) ? book.tags[0] : '其他';

      if (!tagMap[bookTag]) {
        tagMap[bookTag] = [];
      }

      let size = 8;
      let alpha = 0.6;

      if (mode === 'two' && isSelected) {
        size = 18;
        alpha = 1;
      } else if (mode === 'all' || mode === 'vs-all-avg' || mode === 'vs-tag-avg') {
        if (isBookA) { size = 18; alpha = 1; }
        else if (isBookB) { size = 18; alpha = 1; }
        else { size = 8; alpha = 0.5; }
      }

      tagMap[bookTag].push({
        name: book.title,
        value: [scores.textLayer, scores.readerLayer],
        symbolSize: size,
        itemStyle: { opacity: alpha },
        bookId: book.id
      });
    });

    // 构建 series 数组
    const series = Object.entries(tagMap).map(([tag, data], idx) => {
      const isBookATag = allBooks.find(b => b.id === bookAId && b.tags && b.tags.includes(tag));
      const isBookBTag = allBooks.find(b => b.id === bookBId && b.tags && b.tags.includes(tag));
      let color;

      if (isBookATag && allBooks.find(b => b.id === bookAId)) {
        color = '#FF1744';
      } else if (isBookBTag && allBooks.find(b => b.id === bookBId)) {
        color = '#3498db';
      } else {
        color = tagColors[idx % tagColors.length];
      }

      return {
        name: tag,
        type: 'scatter',
        data: data,
        itemStyle: { color: color },
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2 }
        },
        markLine: (mode === 'vs-all-avg' || mode === 'vs-tag-avg') ? {
          silent: true,
          symbol: ['none', 'none'],
          data: markLineData
        } : undefined
      };
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(50,50,50,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#666' : '#ddd',
        textStyle: { color: textColor },
        formatter: (params) => {
          if (!params.data.bookId) return '';
          const book = this.storageService.books.find(b => b.id === params.data.bookId);
          if (!book) return '';
          const scores = calculateWeightedScores(book, getActiveCriteria());
          return `<strong>${book.title}</strong><br/>标签: ${params.seriesName}<br/>文本层面: ${scores.textLayer.toFixed(1)}<br/>读者层面: ${scores.readerLayer.toFixed(1)}`;
        }
      },
      legend: {
        show: true,
        type: 'scroll',
        bottom: 0,
        textStyle: { color: textColor },
        pageTextStyle: { color: textColor }
      },
      grid: {
        left: '3%',
        right: '8%',
        top: '10%',
        bottom: '15%'
      },
      xAxis: {
        type: 'value',
        name: '文本层面',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
      },
      yAxis: {
        type: 'value',
        name: '读者层面',
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: isDark ? '#555' : '#ccc' } },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
      },
      series: series
    };

    this.compareScatterChart = echarts.init(chartDom);
    this.compareScatterChart.setOption(option);
  }

  // 散点图模式切换
  onScatterModeChange(mode) {
    document.querySelectorAll('.compare-scatter-toggle .toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // 显示/隐藏标签筛选器
    const tagFilter = document.getElementById('scatterTagFilter');
    if (tagFilter) {
      tagFilter.style.display = (mode === 'vs-tag-avg') ? 'block' : 'none';
    }

    // 如果切换到 vs-tag-avg，初始化标签选项
    if (mode === 'vs-tag-avg') {
      this.initTagFilter();
    }

    this.renderScatterChart(mode);
  }

  // 初始化标签筛选器
  initTagFilter() {
    const tagSelect = document.getElementById('scatterTagSelect');
    if (!tagSelect) return;

    const allBooks = this.storageService.books.filter(b => !b.deleted && b.rating_details && Object.keys(b.rating_details).length > 0);
    const tagSet = new Set();
    allBooks.forEach(book => {
      if (book.tags) {
        book.tags.forEach(tag => tagSet.add(tag));
      }
    });

    const sortedTags = Array.from(tagSet).sort();
    tagSelect.innerHTML = '<option value="">选择标签...</option>' +
      sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

    tagSelect.onchange = () => {
      this.renderScatterChart('vs-tag-avg');
    };
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

      log('统计数据加载完成');
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

    // 动态更新状态标签称谓
    this.updateStatusLabels();
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
    log('刷新统计数据');
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
    console.trace('showImportModal: 设置 overlay 为 block');
    this.overlay.classList.add('active');
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
    log('开始导出流程');
    try {
      const format = document.querySelector('input[name="exportFormat"]:checked').value;
      log('导出格式:', format);
      const books = this.storageService.getAllBooks();

      if (books.length === 0) {
        this.showToast('没有数据可导出', 'warning');
        return;
      }

      // 生成导出数据
      let exportData;
      let fileExtension;

      switch (format) {
        case 'full-json':
          // 全量导出：书籍 + 日记 + 文件夹
          const journals = this.journals || [];
          const folders = this.storageService.folders || [];
          exportData = ExportService.exportAllData(books, journals, folders);
          fileExtension = 'json';
          break;
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
      log('调用showSaveDialog API');
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: `mybook_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`,
        filters: [{ name: `${fileExtension.toUpperCase()} 文件`, extensions: [fileExtension] }]
      });
      log('showSaveDialog结果:', result);

      if (!result.success || !result.filePath) {
        log('用户取消了保存对话框');
        return; // 用户取消
      }

      // 保存文件
      log('调用exportData API');
      const exportResult = await window.electronAPI.exportData({
        format,
        data: exportData,
        filePath: result.filePath
      });
      log('exportData结果:', exportResult);

      if (exportResult.success) {
        log('导出成功');
        this.showToast(`数据已导出到 ${result.filePath}`, 'success');
        this.closeExportModal();
      } else {
        log('导出失败:', exportResult.error);
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

      // 检查是否为全量导入
      if (this.currentImportData.isFullExport) {
        // 全量数据导入
        const newBooks = this.currentImportData.books || [];
        const newJournals = this.currentImportData.journals || [];
        const newFolders = this.currentImportData.folders || [];

        if (!merge) {
          // 替换模式：直接替换所有数据
          this.storageService.books = newBooks.map(b => Book.fromJSON(b));
          this.journals = newJournals.map(j => InspirationEntry.fromJSON(j));
          this.storageService.folders = newFolders;
        } else {
          // 合并模式：追加数据
          const existingBooks = this.storageService.getAllBooks();
          const bookMerge = ExportService.mergeBooks(existingBooks, newBooks, 'skipDuplicates');
          this.storageService.books = bookMerge.mergedBooks;

          // 合并日记（基于 ID）
          const existingIds = new Set(this.journals.map(j => j.id));
          const newJournalsToAdd = newJournals.filter(j => !existingIds.has(j.id));
          this.journals = [...this.journals, ...newJournalsToAdd.map(j => InspirationEntry.fromJSON(j))];
        }

        await this.storageService.saveBooks();
        await this.saveJournals();

        const message = `导入完成: ${newBooks.length} 本书籍, ${newJournals.length} 篇日记`;
        this.showToast(message, 'success');
        this.closeImportModal();
        this.loadBooks();
        this.renderJournalList();
        this.renderFolders();
        return;
      }

      // 原有的单书籍导入逻辑
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
    this.overlay.classList.remove('active');
  }

  // 关闭导入模态框
  closeImportModal() {
    this.importModal.style.display = 'none';
    this.overlay.classList.remove('active');
    this.resetImportModal();
    delete this.currentImportData;
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

    // 渲染（使用 DocumentFragment 批量添加）
    if (sortedBooks.length === 0) {
      this.showEmptyState();
    } else {
      this.hideEmptyState();
      this.bookListContainer.innerHTML = '';
      const fragment = document.createDocumentFragment();
      sortedBooks.forEach(book => {
        const bookCard = this.createBookCard(book);
        fragment.appendChild(bookCard);
      });
      this.bookListContainer.appendChild(fragment);
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
    // 加载指示器已禁用
  }

  hideLoading() {
    // 加载指示器已禁用
  }

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
    console.trace('showRatingModal: 设置 overlay 为 block');
    this.overlay.classList.add('active');

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

    // 事件委托：使用addEventListener绑定点击事件到容器
    // 先移除旧的事件监听器（避免重复绑定）
    if (this.ratingMetrics._ratingClickHandler) {
      this.ratingMetrics.removeEventListener('click', this.ratingMetrics._ratingClickHandler);
    }
    this.ratingMetrics._ratingClickHandler = (e) => {
      const btn = e.target.closest('.rating-btn');
      if (btn) {
        const metricName = btn.dataset.m;
        const value = parseInt(btn.dataset.v);
        this.setRating(metricName, value);
      }
    };
    this.ratingMetrics.addEventListener('click', this.ratingMetrics._ratingClickHandler);
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
    console.error('saveRating called. currentRatingBookId:', this.currentRatingBookId);
    console.error('currentRatings:', this.currentRatings);

    if (!this.currentRatingBookId) {
      this.showToast('评分对象无效，请重新打开评分窗口', 'error');
      return;
    }

    const book = this.storageService.getBookById(this.currentRatingBookId);
    console.error('book found:', book ? book.title : 'null');
    if (!book) {
      this.showToast('未找到对应作品，请重新打开评分窗口', 'error');
      return;
    }

    try {
      const profile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
      const scores = this.calculateTotalScore(profile, this.currentRatings);
      const totalScore = scores.author + scores.text + scores.reader + 50;
      console.error('totalScore calculated:', totalScore);

      const ratingData = {
        totalScore: totalScore,
        profile: DEFAULT_PROFILE_NAME,
        ratings: { ...this.currentRatings },
        ratedAt: new Date().toISOString()
      };
      console.error('ratingData:', ratingData);

      book.rating = ratingData;

      // 同时更新 rating_details（新格式）
      const nameToIdMap = {};
      const allProfile = DEFAULT_RATING_PROFILE[DEFAULT_PROFILE_NAME];
      Object.values(allProfile).forEach(layer => {
        layer.forEach(dim => {
          nameToIdMap[dim.name] = this.getDimensionIdByName(dim.name);
        });
      });
      const rating_details = {};
      Object.entries(this.currentRatings).forEach(([chineseName, value]) => {
        const id = nameToIdMap[chineseName];
        if (id) rating_details[id] = value;
      });
      book.rating_details = rating_details;
      book.rating.totalScore = totalScore;

      // V3.0：追加式写入 ratingHistory（决策 6-C-2，永不覆盖老条目）
      if (!Array.isArray(book.ratingHistory)) book.ratingHistory = [];
      const seq = String(book.ratingHistory.length + 1).padStart(3, '0');
      const newEntry = {
        id: `rate_${book.id}_${seq}`,
        criteriaVersionId: getCurrentCriteriaVersionId(),
        rating_details: { ...rating_details },
        totalScore: totalScore,
        ratedAt: ratingData.ratedAt
      };
      book.ratingHistory.push(newEntry);

      const result = await this.storageService.updateBook(this.currentRatingBookId, {
        rating: ratingData,
        rating_details: rating_details,
        ratingHistory: book.ratingHistory
      });
      console.error('updateBook result:', result);

      this.showToast('评分保存成功', 'success');
      this.closeRatingModal();
      this.renderBooks();
    } catch (error) {
      this.showToast('评分保存失败：' + error.message, 'error');
      console.error('Rating save error:', error);
    }
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

    // 移除评分按钮点击事件监听器
    if (this.ratingMetrics && this.ratingMetrics._ratingClickHandler) {
      this.ratingMetrics.removeEventListener('click', this.ratingMetrics._ratingClickHandler);
      this.ratingMetrics._ratingClickHandler = null;
    }

    this.ratingModal.style.display = 'none';
    this.overlay.classList.remove('active');
    this.currentRatingBookId = null;
    if (this.ratingChart) {
      this.ratingChart.dispose();
      this.ratingChart = null;
    }
  }

  openEvaluationModal(bookId) {
    const book = this.storageService.getBookById(bookId);
    if (!book) return;

    // 填充表单
    document.getElementById('evaluationBookId').value = bookId;
    document.getElementById('evaluationContent').value = book.evaluation || '';

    // 显示弹窗
    const modal = document.getElementById('evaluationModal');
    modal.style.display = 'flex';
    // 确保overlay显示且z-index高于工具栏(10000)
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'block';
    overlay.style.zIndex = '10000';
    overlay.classList.add('active');

    // 自动聚焦文本框
    setTimeout(() => {
      document.getElementById('evaluationContent').focus();
    }, 100);
  }

  async saveEvaluation() {
    const bookId = document.getElementById('evaluationBookId').value;
    const content = document.getElementById('evaluationContent').value.trim();
    const book = this.storageService.getBookById(bookId);

    if (!book) return;

    // 更新数据
    book.evaluation = content;
    book.updatedAt = new Date().toISOString();

    try {
      // 保存数据
      await this.storageService.saveBooks();
      // 刷新卡片视图
      this.renderBooks();
      // 关闭弹窗
      this.closeEvaluationModal();
      // 提示成功
      this.showToast('总评保存成功', 'success');
    } catch (error) {
      console.error('保存总评失败:', error);
      this.showToast('保存失败，请重试', 'error');
    }
  }

  closeEvaluationModal() {
    document.getElementById('evaluationModal').style.display = 'none';
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
    overlay.style.zIndex = ''; // 恢复默认z-index
    overlay.classList.remove('active');
    // 清空表单
    document.getElementById('evaluationForm').reset();
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
        appendToBody: true,
        enterable: false,
        confine: true,
        position: function (point) {
          return [point[0] + 20, point[1] - 10];
        },
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
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const layerColor = isDark ? '#FF8C9E' : '#dda0dd';
            html += `<div style="display: flex; flex-direction: column;">`;
            html += `<div style="font-weight: bold; color: ${layerColor}; border-bottom: 1px solid rgba(218, 112, 214, 0.3); margin-bottom: 8px; padding-bottom: 4px; font-size: 13px;">${layer}</div>`;

            // 遍历该层面下的具体指标
            items.forEach(m => {
              const realScore = values[valIdx] - 2; // 还原真实分数
              // 根据分数给上不同的颜色：正分为浅绿色，负分为灰色
              const scoreColor = realScore > 0 ? '#88D8A0' : (realScore < 0 ? (isDark ? '#7a8a9a' : '#95a5a6') : (isDark ? '#5a6a7a' : '#adb5bd'));
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
            color: (() => {
              const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
              return isDark
                ? ['rgba(90, 75, 110, 0.4)', 'rgba(90, 75, 110, 0.25)', 'rgba(90, 75, 110, 0.1)'].reverse()
                : ['rgba(230, 230, 250, 0.1)', 'rgba(230, 230, 250, 0.2)', 'rgba(230, 230, 250, 0.4)'].reverse();
            })()
          }
        },
        axisLine: { lineStyle: { color: 'rgba(248, 131, 121, 0.3)' } },
        splitLine: {
          lineStyle: (() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            return { color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(248, 131, 121, 0.3)' };
          })()
        }
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
            itemStyle: { color: '#F88379' },
            areaStyle: {
              color: (() => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                return new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                  { offset: 0, color: isDark ? 'rgba(248, 131, 121, 0.2)' : 'rgba(248, 131, 121, 0.1)' },
                  { offset: 1, color: isDark ? 'rgba(248, 131, 121, 0.8)' : 'rgba(248, 131, 121, 0.6)' }
                ]);
              })()
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

    // 5b：对比视图图表用了主题色，切换后需重绘
    if (this.currentView === 'comparison' && this._getActiveComparison()) {
      requestAnimationFrame(() => this.renderComparisonCharts());
    }
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

    // 5c：Esc 关闭对比视图的浮层（按层级，最上层优先；早于输入框拦截）
    if (e.key === 'Escape' && this._handleComparisonEscape()) {
      e.preventDefault();
      return;
    }

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

    // 复习模式键盘操作（优先级高于一般快捷键）
    const reviewPanel = document.getElementById('reviewPanel');
    if (reviewPanel && reviewPanel.style.display !== 'none') {
      const card = document.getElementById('reviewCard');
      const isFlipped = card && card.classList.contains('flipped');

      if ((e.key === ' ' || e.key === 'Spacebar') && card && !isFlipped) {
        e.preventDefault();
        this.flipCard();
        return;
      }

      // 翻面后键盘操作
      if (isFlipped) {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          this.answerReview(true); // 记住了
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.answerReview(false); // 再想想
          return;
        }
      }

      // 未翻面时 Escape 退出复习
      if (!isFlipped && e.key === 'Escape') {
        e.preventDefault();
        this.exitReview();
        return;
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
    this.contextMenu.classList.add('visible');

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
      emptyItem.style.color = 'var(--text-tertiary)';
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
    this.contextMenu.classList.remove('visible');
    this.contextMenuTarget = null;
  }

  bindContextMenuEvents() {
    // 鼠标离开整个右键菜单时自动关闭
    this.contextMenu.addEventListener('mouseleave', () => {
      this.hideContextMenu();
    });

    const menuItems = this.contextMenu.querySelectorAll('li[data-action]');

    menuItems.forEach(item => {
      // 如果是子菜单父项，使用 mouseenter/mouseleave 而不是 onclick
      if (item.classList.contains('has-submenu')) {
        // 鼠标悬停时显示子菜单
        item.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          const submenu = item.querySelector('.submenu');
          if (submenu) {
            const rect = item.getBoundingClientRect();
            let leftPos = rect.right;
            let topPos = rect.top;
            // 确保子菜单不超出右边界
            const submenuWidth = 180;
            if (leftPos + submenuWidth > window.innerWidth - 10) {
              leftPos = rect.left - submenuWidth;
            }
            // 确保子菜单不超出下边界
            const submenuHeight = submenu.offsetHeight || 200;
            if (topPos + submenuHeight > window.innerHeight - 10) {
              topPos = window.innerHeight - submenuHeight - 10;
            }
            submenu.style.left = `${leftPos}px`;
            submenu.style.top = `${topPos}px`;
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
      case 'inspiration':
        this.switchView('inspiration', bookId);
        break;
      case 'rating':
        this.openRatingModal(bookId);
        break;
      case 'delete':
        this.showDeleteModal(book);
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
    // 加载指示器已禁用
  }

  hideLoading() {
    // 加载指示器已禁用
  }

  // 7. 增强的书籍渲染（支持搜索）
  
} // BookApp 类结束

// =========================================
// 应用初始化与全局事件绑定 (已彻底切除滞后的 AI 模块)
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 🚀 核心修复：移除了原本导致启动缓慢的 setTimeout 延迟！
    window.bookApp = new BookApp();
    await window.bookApp.init();

    // =========================================
    // 暴露全局函数给 index.html
    // =========================================
    window.closeRatingModal = () => { window.bookApp.closeRatingModal(); };
    window.saveRating = () => { window.bookApp.saveRating(); };
    window.closeEvaluationModal = () => { window.bookApp.closeEvaluationModal(); };
    window.saveEvaluation = () => { window.bookApp.saveEvaluation(); };
    window.closeExportModal = () => { window.bookApp.closeExportModal(); };
    window.confirmExport = () => { window.bookApp.confirmExport(); };
    window.closeImportModal = () => { window.bookApp.closeImportModal(); };
    window.confirmImport = () => { window.bookApp.confirmImport(); };
    window.closeStatsModal = () => { window.bookApp.closeStatsModal(); };
    window.refreshStats = () => { window.bookApp.refreshStats(); };
    window.exportStatsReport = () => { window.bookApp.exportStatsReport(); };
    window.closeCompareModal = () => { window.bookApp.closeCompareModal(); };
    window.startCompare = () => { window.bookApp.startCompare(); };

    window.toggleCompareBook = (bookId, event) => {
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

    window.closeFolderModal = () => { window.bookApp.closeFolderModal(); };
    window.confirmCreateFolder = () => { window.bookApp.confirmCreateFolder(); };
    window.switchView = (viewName, bookId = null) => { window.bookApp.switchView(viewName, bookId); };

    window.clearInspirationFilter = () => {
      window.bookApp.resetInspirationFilter();
      window.bookApp.renderInspirationList();
      const indicator = document.getElementById('inspirationFilterIndicator');
      if(indicator) indicator.style.display = 'none';
    };

    window.clearLockedBook = () => { window.bookApp.clearLockedBook(); };

    window.openInspirationModal = (inspirationId = null) => {
      let preselectedBookId = null;
      if (!inspirationId && window.bookApp.inspirationFilters.lockedBookId) {
        preselectedBookId = window.bookApp.inspirationFilters.lockedBookId;
      }
      window.bookApp.openInspirationModal(inspirationId, preselectedBookId);
    };

    window.closeInspirationModal = () => { window.bookApp.closeInspirationModal(); };
    window.openInspirationView = (inspirationId) => { window.bookApp.openInspirationView(inspirationId); };
    window.closeInspirationViewModal = () => { window.bookApp.closeInspirationViewModal(); };
    window.editInspiration = (inspirationId) => { window.bookApp.openInspirationModal(inspirationId); };
    window.deleteInspiration = (inspirationId) => { window.bookApp.deleteInspiration(inspirationId); };
    window.confirmDeleteInspiration = () => { window.bookApp.confirmDeleteInspiration(); };
    window.cancelDeleteInspiration = () => { window.bookApp.cancelDeleteInspiration(); };
    window.toggleInspirationTag = (tag) => { window.bookApp.toggleInspirationTag(tag); };
    window.removeInspirationTag = (tag) => { window.bookApp.removeInspirationTag(tag); };
    window.toggleFilterPanel = () => { window.bookApp.toggleInspirationFilterPanel(); };
    window.resetInspirationFilter = () => { window.bookApp.resetInspirationFilter(); };
    window.applyInspirationFilter = () => { window.bookApp.applyInspirationFilter(); };
    window.jumpToBook = (bookId) => { window.bookApp.jumpToBook(bookId); };
    window.removeJournalImage = (index) => { window.bookApp.removeJournalImage(index); };

    window.viewJournalImage = (imgPath) => {
      if (imgPath && imgPath.startsWith('data:image')) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`<img src="${imgPath}" style="max-width:100%;height:auto;">`);
          newWindow.document.close();
        }
        return;
      }
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(imgPath);
      }
    };
});

// =========================================
// 🛡️ 全局 UI 兜底与异常拦截系统 (置于文件最底部)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('overlay');

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            // 只有当 overlay 可见时才执行关闭逻辑
            if (overlay.classList.contains('active')) {
                overlay.classList.remove('active');
                const popupElements = document.querySelectorAll('.modal, .context-menu, .filter-popover');
                popupElements.forEach(el => {
                    if (el) el.style.display = 'none';
                });
                console.warn('🛡️ 触发全局兜底：已强制清场所有弹窗和遮罩层');
            }
        }, { capture: true });
    }

    window.addEventListener('error', (e) => {
        console.error('🚨 捕捉到 JS 运行错误:', e.message, '位置:', e.filename, e.lineno);
        if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active');
    });

    window.addEventListener('unhandledRejection', (e) => {
        console.error('🚨 捕捉到 Promise 异步数据错误:', e.reason);
        if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active');
    });
});
