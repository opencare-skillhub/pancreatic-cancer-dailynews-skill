# 胰腺癌医学新闻日报 - Pancreatic Cancer News Digest

> **版本**: v1.0 (2026-04-09)
> **作者**: 小胰宝 (胰腺癌患者社区2.0 CEO)
> **开源协议**: MIT License
> **项目主页**: https://github.com/PancrePal-xiaoyibao/pancreatic-cancer-news-digest

---

## 📖 项目介绍

**胰腺癌医学新闻日报**是一个自动化医学新闻聚合系统，专为胰腺癌患者、家属和医疗专业人士设计。系统每日从全球权威数据源抓取最新临床试验、研究进展和药企动态，生成结构化、患者友好的日报。

### 核心特性
- 🎯 **多数据源**: ClinicalTrials.gov、PubMed、药企IR、RSS订阅
- 🔬 **智能去重**: 基于历史记录自动过滤已发布内容
- 📊 **优先级排序**: Phase 3 > Phase 2 > Phase 1，RCT > meta > case
- 🏢 **企业监控**: 跟踪19家国内外药企（Revolution Medicine、君赛生物、康方生物等）
- 📱 **多渠道发布**: 自动推送飞书 Wiki 和群聊
- ⚙️ **配置驱动**: JSON 配置添加新数据源无需修改代码

---

## 🚀 快速开始

### 环境要求
- Python 3.10+
- 依赖包: `requests`, `feedparser`, `beautifulsoup4`

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/PancrePal-xiaoyibao/pancreatic-cancer-news-digest.git
cd pancreatic-cancer-news-digest

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置数据源（可选）
# 编辑 config/sources.json 添加/修改数据源
# 编辑 config/output.json 调整输出格式

# 4. 运行测试
python tests/test_fetch.py

# 5. 生成日报
python scripts/fetch.py
```

### 输出文件
- **完整日报**: `data/reports/digest-YYYY-MM-DD.md` (420+行)
- **群聊摘要**: 自动提取前500字（适合手机阅读）
- **历史记录**: `data/history.json` (已发布项目追踪)

---

## 📁 项目结构

```
pancreatic-cancer-news-digest/
├── SKILL.md                    # 技能定义（OpenClaw集成用）
├── README.md                   # 用户文档（本文件）
├── DEPLOYMENT.md               # 部署指南（生产环境）
├── OPEN_SOURCE_README.md       # 开源说明（本文件）
├── quick-start.sh              # 快速启动脚本（5种命令）
├── requirements.txt            # Python依赖
├── config/
│   ├── sources.json            # v1.0 数据源配置（3个源）
│   ├── sources_v2.json         # v2.0 增强配置（支持ChiCTR）
│   ├── sources_v3.json         # v3.0 五模块架构
│   ├── sources_v4.json         # v4.0 企业监控（19家企业）
│   ├── output.json             # v1.0 输出配置
│   └── output_v2.json          # v2.0 输出配置（患者友好）
├── scripts/
│   ├── fetch.py                # v1.0 主抓取脚本（21KB）
│   ├── fetch_enhanced.py       # v2.0 增强版（多fetcher）
│   ├── fetch_v3.py             # v3.0 五模块架构
│   ├── fetch_v4.py             # v4.0 企业监控（独立脚本，废弃）
│   ├── fetchers_enhanced.py    # v2.0 共享fetcher库
│   ├── fetch_v3.py             # v3.0 五模块抓取
│   ├── publish_to_feishu.py    # 飞书发布工具
│   └── __pycache__/            # Python缓存（忽略）
├── templates/
│   ├── digest_template.md      # v1.0 模板
│   └── digest_template_enhanced.md  # v2.0+ 模板（患者友好）
├── tests/
│   └── test_fetch.py           # 单元测试
├── data/
│   ├── cache/                  # API响应缓存（6小时TTL）
│   ├── history.json            # 已发布ID追踪（去重）
│   └── reports/                # 生成的日报
│       ├── digest-2026-04-09.md
│       ├── digest-2026-04-09-enhanced.md
│       ├── digest-2026-04-09-v3.1.md
│       └── digest-2026-04-09-v4.0.md
└── .mcpjam/                    # MCP技能链接（可选）
```

---

## 🔧 配置说明

### 数据源配置 (sources_v4.json)

系统支持 **19个企业监控源**，分为3个Tier：

#### Tier 1: 全球领军（每日监控）
```json
{
  "revolution_medicines": {
    "enabled": true,
    "name": "Revolution Medicine - Daraxonrasib (RMC-6236)",
    "type": "web_search",
    "priority": 0,
    "config": {
      "search_terms": [
        "Revolution Medicine Daraxonrasib RMC-6236 pancreatic cancer phase 3 site:ir.revmed.com"
      ],
      "max_results": 10,
      "search_engine": "miaoda"
    }
  }
}
```

#### Tier 2: 国内创新（每日/每周监控）
```json
{
  "junsec": {
    "enabled": false,  // 设置为true启用
    "name": "君赛生物 - GC101/GC203 TIL疗法",
    "type": "web_search",
    "priority": 1,
    "config": {
      "search_terms": [
        "君赛生物 GC203 临床试验 胰腺癌 site:juncell.com",
        "君赛生物 GC101 2026 上市"
      ],
      "max_results": 10,
      "search_engine": "miaoda"
    }
  }
}
```

#### Tier 3: 国际大药企（每周监控）
```json
{
  "amgen": {
    "enabled": false,
    "name": "Amgen - AMG-410 KRAS G12C抑制剂",
    "type": "web_search",
    "priority": 4,
    "config": {
      "search_terms": ["Amgen AMG-410 KRAS G12C pancreatic cancer"],
      "max_results": 5,
      "search_engine": "miaoda"
    }
  }
}
```

### 输出配置 (output_v2.json)

```json
{
  "format": "enhanced_v3",
  "max_items": 80,
  "include_summary": true,
  "group_by_source": true,
  "sections": [
    "international_trials",    // 国际临床试验
    "domestic_china_trials",   // 国内临床试验
    "enterprise_news",         // 企业动态
    "academic_highlights"      // 学术 highlights
  ]
}
```

---

## 📊 版本历史

### v1.0 (2026-04-09 上午)
- ✅ 基础架构设计（12模块可扩展）
- ✅ 实现 ClinicalTrials.gov API 抓取
- ✅ 实现 PubMed E-utilities 抓取
- ✅ 实现 RSS Feeds 解析
- ✅ 智能去重（history.json）
- ✅ 优先级排序（Phase权重）
- ✅ Markdown 输出模板
- ✅ 飞书 Wiki 自动发布
- ✅ OpenClaw cron 定时任务
- 📊 **首次测试**: 79条资讯 → 421行完整报告

### v2.0 (2026-04-09 中午)
- 🔄 增强配置架构（sources_v2.json 独立）
- 🔄 多fetcher模块化（fetchers_enhanced.py）
- 🔄 患者友好输出格式（核心要点+可点击链接）
- 🔄 支持 ChiCTR 中国临床试验（待MCP解决反爬）
- 🔄 统计表自动生成
- 📊 **测试**: CT.gov 50条，ChiCTR 404（待解决）

### v3.0 (2026-04-09 下午)
- 🎯 五模块架构：临床试验+学术报道+病友热点+心理赋能+每日心语
- 🎯 AACR 2026 摘要集成（389个摘要 → 10个胰腺癌相关）
- 🎯 心理赋能语料库（126条语句+25个微行动）
- 🎯 2000字以内，5分钟读完
- 📊 **发布**: Wiki + 群聊双通道

### v3.1 (2026-04-09 傍晚)
- 🔍 搜索增强：用 miaoda-web-search 替代部分爬虫
- 🔧 修复 Revolution Medicine 网络超时问题
- ⏳ ChiCTR 滑块验证码待解决

### v4.0 (2026-04-09 晚上)
- 🏢 **企业监控特刊**：19家企业全覆盖
- 🏆 新增 Tier 分类（全球领军/国内创新/国际大药企）
- 🎯 新增 KRAS G12V TCR-T（新景智源）
- 🎯 扩展康方生物管线（AK104/AK112/AK154）
- 📊 发布：Wiki 详细版 + 群聊精简版
- 🚀 **架构锁定**: 采用 OpenClaw 会话内调用技能模式（方案A）

---

## 🔍 数据源说明

### 国际临床试验
- **ClinicalTrials.gov API** (NCT编号)
  - 频率: 每日
  - 格式: JSON API
  - 覆盖: 全球注册试验
  - 优先级: P0

### 中国临床试验
- **ChiCTR** (中国临床试验注册中心)
  - 频率: 每日
  - 挑战: 滑块验证码（需MCP或Playwright解决）
  - 状态: ⏳ 待集成

### 药企新闻
- **IR 官网** (Investor Relations)
  - Revolution Medicine: ir.revmed.com/press-releases
  - 君赛生物: juncell.com/news
  - 康方生物: 公告 + ClinicalTrials.gov
  - 新景智源: neowisebio.com/news
- **搜索方式**: miaoda-web-search (site限定)
- **频率**: Tier 1每日, Tier 2每周

### 学术文献
- **PubMed** (NCBI E-utilities)
  - 关键词: "pancreatic cancer", "KRAS", "CLDN18.2", "clinical trial"
  - 时间范围: 最近7天
  - 频率: 每日
- **会议摘要**: AACR, ASCO, ESMO (PDF解析)

---

## ⚙️ 高级配置

### 添加新企业监控

1. **编辑 `config/sources_v4.json`**
2. **在 `sources` 对象中添加新条目**：

```json
{
  "new_company": {
    "enabled": false,
    "name": "公司名 - 产品描述",
    "type": "web_search",
    "priority": 3,  // 0=最高, 6=最低
    "config": {
      "search_terms": [
        "公司名 产品代号 胰腺癌 临床试验",
        "公司英文名 product_code pancreatic cancer"
      ],
      "max_results": 8,
      "search_engine": "miaoda",
      "note": "可选说明"
    }
  }
}
```

3. **优先级映射**:
   - `0`: Tier 1 全球领军（每日监控）
   - `1`: TIL疗法头部企业（每日监控）
   - `2`: 双抗/疫苗重要企业（每日监控）
   - `3`: TCR-T等新技术（每周监控）
   - `4-6`: 其他企业（每周/每月监控）

4. **测试搜索**:
```bash
# 在OpenClaw会话中调用
miaoda_web_search("公司名 产品 胰腺癌 site:company.com")
```

5. **更新企业矩阵**（记忆系统记录）

### 自定义输出格式

编辑 `config/output_v2.json`：

```json
{
  "format": "enhanced_v3",     // 当前版本
  "max_items": 80,             // 最大条目数
  "include_summary": true,     // 包含摘要
  "group_by_source": true,     // 按来源分组
  "sections": [
    "international_trials",    // 国际试验
    "domestic_china_trials",   // 国内试验
    "enterprise_news",         // 企业新闻
    "academic_highlights"      // 学术亮点
  ]
}
```

**可用 sections**:
- `international_trials`: ClinicalTrials.gov
- `domestic_china_trials`: ChiCTR (待集成)
- `enterprise_news`: 药企IR新闻
- `academic_highlights`: PubMed + 会议摘要
- `patient_discussions`: 病友热点（待开发）
- `psychological_support`: 心理赋能（已集成v3.0）

---

## 🤝 贡献指南

### 报告问题
如遇以下情况，请提交 Issue：
- 数据源失效（网站改版、API变更）
- 解析错误（HTML结构变化）
- 去重失效（ID格式变化）
- 输出格式问题

### 提交 Pull Request
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/NewFeature`)
3. 提交更改 (`git commit -m 'Add some feature'`)
4. 推送到分支 (`git push origin feature/NewFeature`)
5. 开启 Pull Request

### 代码规范
- 遵循 PEP 8（Python）
- 添加注释说明复杂逻辑
- 更新测试用例（`tests/` 目录）
- 更新文档（`README.md` 或 `DEPLOYMENT.md`）

---

## 📜 开源协议

MIT License

Copyright (c) 2026 PancrePal-xiaoyibao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 📞 联系方式

- **项目维护**: 小胰宝 (Pancreatic Cancer Patient Community 2.0 CEO)
- **社区地址**: https://github.com/PancrePal-xiaoyibao
- **知识库**: https://uei55ql5ok.feishu.cn/wiki/QtIXwuGf4iAfVskGfj8cjxfYnmf
- **问题反馈**: https://github.com/PancrePal-xiaoyibao/pancreatic-cancer-news-digest/issues

---

## 🙏 致谢

- **OpenClaw 社区**: 提供 Agent 框架和技能系统
- **米岛 AI (miaoda)**: 提供 web-search 技能支持
- **飞书 (Feishu)**: 提供协作平台和 API
- **胰腺癌患者社区**: 持续反馈和需求输入

---

**最后更新**: 2026-04-09  
**版本**: v1.0 (Open Source Release)  
**状态**: ✅ 生产就绪

---

*本工具仅供信息参考，不构成医疗建议。所有临床试验信息请以官方注册平台为准。*
