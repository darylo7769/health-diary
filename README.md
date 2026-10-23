# 每日健康 · 健康记账 PWA

> 像记账一样记录每天的 **体重 / 心率 / 血压**

**在线使用:** https://darylo7769.github.io/health-diary/

## 功能

| 模块 | 说明 |
|------|------|
| 首页 | 三项指标最新值卡片、较上次变化、BMI / 心率状态 / 血压分级、连续记录天数、今日记录 |
| 记一笔 | 底部弹层快速录入,支持自定义时间和备注;点击任意记录可编辑/删除 |
| 趋势 | 7 / 30 / 90 天折线图(血压为双线图),最新/平均/最高/区间变化统计 |
| 明细 | 按日期分组的历史记录,支持按类型筛选 |
| 我的 | 身高(用于 BMI)、目标体重、导出 CSV / JSON、导入备份、清空数据 |
| PWA | 可添加到主屏幕,Service Worker 离线缓存,无网络也能用 |

## 安装到手机

1. 手机浏览器打开 https://darylo7769.github.io/health-diary/
2. iPhone:分享 →「添加到主屏幕」;安卓:菜单 →「安装应用」

## 本地运行

```bash
cd 项目目录
python3 -m http.server 8765
# 打开 http://127.0.0.1:8765
```

## 技术实现

- **纯前端**:原生 HTML / CSS / JavaScript,零依赖、零框架
- **数据**:localStorage 本地存储,隐私性好;不跨设备
- **图表**:Canvas 手绘折线图(保证离线可用)
- **健康标准**:血压分级、心率区间、BMI 分级内置医学参考值
- **换肤**:CSS 变量控制主题色,图标由 `tools/make_icons.py`(PIL)生成

### 数据模型

```js
{ id, type: 'weight'|'heart'|'bp', ts, note, value }      // 体重/心率
{ id, type: 'bp', ts, note, sys, dia }                    // 血压
```

### 文件结构

```
index.html            页面结构(首页/趋势/明细/我的 + 记一笔弹层)
styles.css            样式(淡粉主题,CSS 变量)
app.js                业务逻辑(存储/渲染/图表/导入导出)
manifest.webmanifest  PWA 清单
sw.js                 Service Worker 离线缓存
icons/                应用图标(PIL 生成)
tools/make_icons.py   图标生成脚本
```

## 部署

托管于 **GitHub Pages**(免费):push 到 `main` 分支后自动发布,1~2 分钟生效。

```bash
git add -A && git commit -m "更新" && git push
```

## 数据迁移

旧设备:「我的 → 导出 JSON 备份」→ 新设备:「我的 → 导入 JSON 备份」。
