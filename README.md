# 定向越野图例训练系统

一个基于Web的定向越野图例认知训练系统，用于训练用户对定向越野图例（ISSprOM2019-2 / ISOM2017-2 / ISCD 共约390个符号）的视觉秒认能力与长期记忆稳定性。

## 功能特点

### 三种训练模式

1. **选择题模式（Recognition Test）**
   - 显示SVG图例，4选1
   - 5秒限时，超时自动错误
   - 基于混淆矩阵生成干扰项

2. **翻转卡模式（Recall Test）**
   - 显示SVG图例，用户心里回答
   - 点击翻转显示答案
   - 用户自评：完全正确/模糊记得/完全不会

3. **闪卡模式（Speed Recognition Test）**
   - 显示SVG图例，0.8秒后消失
   - 训练秒认能力
   - 记录反应时间

### 核心系统

- **混淆矩阵系统**：自动记录用户错误，生成混淆关系
- **记忆状态系统**：跟踪每个图例的识别/回忆/自动化能力
- **智能调度系统**：基于优先级算法推荐训练内容
- **学习路径分层**：未掌握→模糊→熟练→自动化

### 数据来源

集成自 [O-legend](../O-legend/) 图例库：
- ISOM 2017-2（112条）
- ISSprOM 2019-2（106条）
- ISCD 2018（172条）

## 技术栈

- 纯前端实现（HTML + CSS + JavaScript）
- 本地存储（LocalStorage）
- 零依赖，可直接部署到 GitHub Pages

## 快速开始

1. 克隆或下载本项目
2. 直接在浏览器中打开 `index.html`
3. 或部署到任意静态文件服务器

## 部署到 GitHub Pages

1. 创建 GitHub 仓库
2. 推送代码到仓库
3. 在仓库设置中启用 GitHub Pages
4. 选择 `main` 分支作为源

## 项目结构

```
training-system/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── data.js         # 图例数据
│   ├── storage.js      # 本地存储管理
│   ├── confusion.js    # 混淆矩阵引擎
│   ├── scheduler.js    # 调度算法
│   ├── training.js     # 训练模式
│   └── app.js          # 主应用逻辑
└── images/             # 图例图片
    ├── isom2017img/
    ├── issprom2019-2/
    └── iscd2018/
```

## 核心算法

### 优先级调度公式

```
Priority = 
  0.35 × confusion_risk +
  0.30 × uncertainty +
  0.25 × (1 - speed_score) +
  0.10 × (1 - recall_score)
```

### 混淆权重计算

```
confusion(A,B) = 
  wrong(A→B) + wrong(B→A)
  ─────────────────────────
  total_seen(A) + total_seen(B)
```

## 许可证

MIT License