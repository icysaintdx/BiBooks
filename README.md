# BiBooks - 自动标书生成系统

基于 OpenBidKit 二次开发的智能标书生成桌面应用，实现从招标文件解析到投标文件自动生成的全流程自动化。

## 核心特性

- **招标文件解析**: 自动提取评分标准、资质要求、技术需求等 16 项结构化信息
- **智能目录生成**: 支持自由模式和对齐模式两种目录生成方式
- **正文自动生成**: 7 阶段流水线生成高质量投标文件正文
- **标书查重**: 多维度重复检测（元数据、大纲、正文、图片）
- **废标检查**: 自动检测可能导致废标的问题项
- **知识库管理**: 构建企业知识库，为 AI 生成提供参考素材
- **本地 AI 部署**: 支持 Ollama + 7B 量化模型的完全离线部署

## 技术栈

- **前端**: React + TypeScript + Vite
- **桌面框架**: Electron
- **数据库**: SQLite (better-sqlite3)
- **AI**: OpenAI 兼容 API（支持 6 种模型提供商）
- **文档导出**: Markdown → DOCX 转换

## 开发

```bash
cd client
npm install
npm run dev
```

## 构建

```bash
cd client
npm run dist:win   # Windows
npm run dist:mac   # macOS
```

## 项目结构

```
BiBooks/
├── client/                    # 主应用
│   ├── src/                   # React 前端
│   │   ├── features/          # 功能模块
│   │   ├── shared/            # 共享组件和工具
│   │   └── app/               # 路由和布局
│   ├── electron/              # Electron 主进程
│   │   ├── services/          # 核心业务服务
│   │   ├── ipc/               # IPC 通信处理
│   │   └── utils/             # 工具函数
│   └── package.json
├── docs/                      # 项目文档
├── reference/                 # 参考资料
│   └── BiaoShu-SKILL/         # 流水线参考标准
├── CHANGELOG.md
├── VERSION.json
└── README.md
```

## 二开说明

本项目基于 [OpenBidKit_Yibiao](https://github.com/FB208/OpenBidKit_Yibiao) 二次开发，已完成以下改造：

- 移除所有埋点和遥测代码
- 移除远程公告和自动更新检查
- 移除原始品牌标识
- 数据库名称和协议标识已更新

## 许可证

二次开发项目，原始项目遵循 AGPL-3.0 许可证。
