# 我的读书记录桌面应用

基于Electron开发的书籍记录桌面应用，支持记录阅读书籍、管理读书笔记和评分系统。

## 功能特点

### 第一阶段（已完成）
- 记录书名、作者、开始阅读时间、结束阅读时间
- 设置阅读状态（未开始、阅读中、已读完）
- 书籍列表展示，支持卡片式布局
- 多种排序方式：按书名、开始时间、结束时间排序
- 添加、编辑、删除书籍功能
- 数据持久化存储（本地JSON文件）

### 第二阶段（待开发）
- 读书笔记导入功能
- 支持文本文件和Markdown文件导入
- 笔记管理和搜索功能

### 第三阶段（待开发）
- 评分系统集成
- 复用现有的评分系统界面和算法
- 为每本书添加评分功能

### 第四阶段（待开发）
- 增强排序功能（多字段排序）
- 数据导入导出功能
- 阅读统计图表

## 项目结构

```
MyBook/
├── main.js                 # Electron主进程
├── preload.js              # 预加载脚本（安全通信）
├── renderer.js             # 渲染进程主逻辑
├── index.html              # 主界面
├── styles.css              # 主样式
├── package.json            # 项目配置
├── src/                    # 源代码
│   ├── models/Book.js      # 书籍数据模型
│   ├── services/           # 服务层
│   │   ├── StorageService.js # 数据存储服务
│   │   └── SortService.js  # 排序服务
│   └── components/         # UI组件（后续添加）
└── data/books.json         # 书籍数据存储文件
```

## 快速开始

### 1. 安装依赖
由于网络问题，可能需要使用淘宝镜像安装Electron：

```bash
# 切换到项目目录
cd D:\学习\MyBook

# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 安装依赖
npm install

# 如果安装失败，可以尝试使用cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 2. 运行应用

```bash
npm start
```

或者在开发模式下运行：

```bash
npm run dev
```

### 3. 打包应用（可选）

```bash
npm run build
```

## 使用说明

### 添加书籍
1. 点击"添加书籍"按钮
2. 填写书名、作者、阅读日期等信息
3. 选择阅读状态
4. 点击保存

### 编辑书籍
1. 在书籍卡片上点击"编辑"按钮
2. 修改书籍信息
3. 点击保存

### 删除书籍
1. 在书籍卡片上点击"删除"按钮
2. 确认删除操作

### 排序书籍
1. 使用顶部的排序下拉框选择排序字段
2. 选择升序或降序排列
3. 书籍列表会实时更新排序结果

## 数据存储

应用数据存储在 `data/books.json` 文件中，格式为JSON。建议定期备份此文件。

## 开发说明

### 第一阶段已完成的功能
- [x] Electron应用基础框架
- [x] 书籍数据模型和验证
- [x] 数据存储服务（支持Electron API和localStorage回退）
- [x] 排序服务（支持多种排序方式）
- [x] 响应式UI界面
- [x] 完整的CRUD操作
- [x] 表单验证和日期处理

### 后续开发计划

#### 第二阶段：读书笔记功能
- 扩展Book模型，添加notes字段
- 创建笔记导入组件
- 实现文件上传和文本编辑功能
- 添加笔记管理界面

#### 第三阶段：评分系统集成
- 分析现有评分系统HTML文件
- 提取样式和逻辑到独立组件
- 集成到主应用中作为标签页
- 实现评分数据绑定

#### 第四阶段：高级功能
- 多字段排序和过滤
- 数据导入导出
- 统计图表展示
- 快捷键支持

## 故障排除

### Electron安装失败
如果安装Electron时出现网络超时错误，可以尝试以下方法：

1. **使用淘宝镜像**：
   ```bash
   npm config set electron_mirror https://npmmirror.com/mirrors/electron/
   npm install electron --save-dev
   ```

2. **使用代理**（如果有）：
   ```bash
   npm config set proxy http://your-proxy:port
   npm config set https-proxy http://your-proxy:port
   ```

3. **手动下载**：
   从Electron官网下载对应版本的二进制文件，放在项目目录中。

### 应用无法启动
1. 检查Node.js版本（建议v18+）
2. 检查依赖是否完整安装
3. 查看控制台错误信息

### 数据不保存
1. 检查`data`目录的写入权限
2. 检查磁盘空间
3. 查看控制台错误日志

## 技术栈

- **前端**：HTML5、CSS3、JavaScript (ES6+)
- **桌面框架**：Electron 28+
- **数据存储**：JSON文件
- **构建工具**：npm脚本
- **代码规范**：ESLint（待添加）

## 贡献指南

1. Fork本仓库
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过项目issue反馈。

---

**第一阶段开发已完成** 🎉

应用现已具备基本的书籍记录和管理功能。接下来可以按照计划逐步添加笔记、评分和高级功能。