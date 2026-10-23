# 每日健康 · 健康记账 PWA

> 像记账一样记录每天的 **体重 / 心率 / 血压**

- **在线使用:** https://darylo7769.github.io/health-diary/
- **仓库地址:** https://github.com/darylo7769/health-diary

## 功能

| 模块 | 说明 |
|------|------|
| 首页 | 三项指标最新值卡片、较上次变化、BMI / 心率状态 / 血压分级标签、连续记录天数、今日记录、三个快捷"记一笔"入口 |
| 记一笔 | 底部弹层快速录入,大数字输入,支持自定义时间与备注;点击任意历史记录可编辑 / 删除 |
| 趋势 | 7 / 30 / 90 天折线图(血压为高压+低压双线图),含最新 / 平均 / 最高 / 区间变化统计,可设目标体重参考线 |
| 明细 | 按日期分组的历史记录,支持按类型筛选 |
| 我的 | 身高设置(用于 BMI)、目标体重、导出 CSV / JSON、导入 JSON 备份、示例数据、清空数据 |
| PWA | 可添加到主屏幕,Service Worker 离线缓存,断网也能打开和记录 |

## 安装到手机

1. 手机浏览器打开 https://darylo7769.github.io/health-diary/
2. iPhone:Safari → 分享 →「添加到主屏幕」
3. 安卓:Chrome → 菜单 →「安装应用 / 添加到主屏幕」

安装后从主屏幕图标打开即为全屏 App 体验,数据保存在本机,离线可用。

## 本地运行

```bash
cd 项目目录
python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765
```

## 技术实现

- **纯前端**:原生 HTML / CSS / JavaScript,零依赖、零框架
- **数据存储**:localStorage(本机),隐私性好,支持导出备份;不跨设备同步
- **图表**:Canvas 手绘折线图(保证离线可用,不依赖外部 CDN)
- **健康标准**:内置血压分级(<120/80 正常,≥140/90 偏高等)、心率区间、BMI 分级参考值
- **主题换肤**:CSS 变量控制主题色(当前为淡粉主题),图标由 `tools/make_icons.py`(Python PIL)生成
- **趋势聚合**:同一天多条记录取平均,无数据日期自动断点

### 数据模型

```js
// 体重 / 心率
{ id, type: 'weight' | 'heart', ts, note, value }
// 血压
{ id, type: 'bp', ts, note, sys, dia }
```

### 文件结构

```
index.html            页面结构(首页 / 趋势 / 明细 / 我的 + 记一笔弹层)
styles.css            样式(淡粉主题,CSS 变量驱动)
app.js                业务逻辑(存储 / 渲染 / 图表 / 导入导出)
manifest.webmanifest  PWA 清单
sw.js                 Service Worker 离线缓存
icons/                应用图标(线上实际引用)
tools/make_icons.py   图标生成脚本(PIL)
tools/icons/          脚本输出目录(本地产物,不入库)
.gitignore            忽略 .idea/、.DS_Store 等
```

## 部署

托管于 **GitHub Pages**(公开仓库免费),仓库 `main` 分支根目录即网站内容:

```bash
git add -A && git commit -m "更新" && git push
```

push 后 1~2 分钟自动生效,网址不变,手机端自动更新(必要时刷新两次绕过旧缓存)。

> 直连 github.com 不稳时,也可通过 `api.github.com` 的 Contents API 上传单个文件完成更新。

## 数据迁移

旧设备:「我的 → 导出 JSON 备份」→ 传到新设备 →「我的 → 导入 JSON 备份」。

## 边界与规划

- ✅ 无限人数使用、免费、离线可用
- ⚠️ 数据仅存各用户本机,多人之间不共享
- 🔧 如需多设备同步 / 家庭共享,可后接 Supabase 等免费后端
