# 开发文档

## 项目概览

这是一个纯前端的田字格拼音练习生成器。项目不需要构建步骤，直接在浏览器打开 `index.html` 即可运行。

主要文件：

- `index.html`：页面结构、控制面板、外部 CDN 脚本引用。
- `styles.css`：A4 预览、右侧工具栏、小格编辑区、打印样式。
- `app.js`：页面状态、拼音生成、逐字拼音编辑、预览渲染、导入导出、PDF 导出。

拼音转换依赖放在本地：

- `libs/pinyin-pro.js`：`pinyin-pro@3.28.1` 浏览器脚本，用于汉字转拼音。
- `libs/pinyin-pro-complete-dict.js`：`@pinyin-pro/data@1.3.1` 的完整词典浏览器包装，用于提高多音字和词语识别准确率。

PDF 导出依赖也放在本地：

- `libs/html2canvas.min.js`：PDF 导出时把预览页渲染为图片。
- `libs/jspdf.umd.min.js`：生成 PDF 文件。

## 运行方式

直接用浏览器打开：

```text
index.html
```

如果浏览器或安全策略限制本地文件访问，可以在项目目录启动任意静态文件服务器。

## 状态模型

状态保存在 `localStorage`，键名为：

```js
pinyin-tianzige-settings-v1
```

核心状态结构：

```js
{
  pages: [
    {
      textInput: "",
      textInputPinyin: "",
      pinyinInput: "",
      pinyinInputPinyin: "",
      textInputQuestions: [],
      textInputPinyinQuestions: []
    }
  ],
  activePageIndex: 0
}
```

字段说明：

- `textInput`：看拼音写汉字区域的原文。
- `textInputPinyin`：看汉字写拼音区域的原文。
- `pinyinInput` / `pinyinInputPinyin`：隐藏的拼音源文本，仍用于保存、导入导出和小格同步。
- `textInputQuestions` / `textInputPinyinQuestions`：被选为题目隐藏项的汉字序号数组，只按汉字计数，不包含空格和标点。
- `pinyinDictVersion`：当前拼音词典版本。版本变化时会刷新旧的隐藏拼音缓存，避免旧词典结果继续覆盖新词典结果。

设置项如颜色、格子大小、拼音格式、答案页位置等也一起保存在同一个状态对象中。

## 关键流程

### 文字到拼音

页面加载时会先注册完整词典：

```js
addPinyinDict(window.PinyinProCompleteDict, "complete");
```

`autoPinyinText(text)` 使用 `pinyin-pro` 生成数字声调拼音，并按汉字项输出空格分隔的拼音 token。

### 手动拼音保留

用户修改文字时，不会整段覆盖已有拼音。流程是：

1. `preservePinyinAfterTextEdit(oldText, newText, oldPinyinText)` 提取新旧文本中的汉字序列。
2. `mapChineseIndexesByLcs()` 用 LCS 对齐旧汉字和新汉字。
3. 对齐成功的汉字保留旧拼音，新插入的汉字使用自动拼音。

题目选中状态也使用同样思路，由 `preserveQuestionIndexesAfterTextEdit()` 跟随文本编辑迁移。

### 逐字小格编辑区

`renderPinyinPairEditor()` 生成每个汉字对应的编辑小格：

- 汉字按钮：点击切换题目选中状态。
- 拼音输入框：编辑该字拼音，并同步回隐藏的长拼音输入框。
- 空格：显示为一条高亮分割线；连续多个空格只显示一条线。
- 标点：不生成小格。

点击小格区域空白处会切换容器展开状态 `is-expanded`，只扩大容器宽高，不放大内部内容。点击容器外会取消展开。

### 题目隐藏与答案页

预览渲染入口是 `render()`。

`renderTextSection()` 接收 `questionIndexes`，再通过 `parseQuestionText(text, questionIndexes)` 标记哪些汉字是题目。题目页按不同模式隐藏拼音或汉字；答案页会显示完整内容并高亮答案。

旧格式 `[[...]]` 仍可迁移：`normalizeQuestionField()` 会清除文本中的标记，只保留其中汉字的选中序号。空格不会被记为题目。

## 导入导出

“导出文字”导出 JSON：

```json
{
  "type": "pinyin-tianzige-pages",
  "version": 1,
  "exportedAt": "...",
  "pages": []
}
```

导入时要求 `type` 为 `pinyin-tianzige-pages`，并且 `pages` 是数组。导入旧数据时会自动补齐拼音和题目状态。

## 打印和 PDF

- 打印：直接调用 `window.print()`。
- PDF：使用 `html2canvas` 渲染每张 `.paper`，再用 `jspdf` 输出 A4 PDF。

打印样式在 `@media print` 中定义，纸张尺寸由 `@page` 和 `.paper` 控制。

## 修改注意事项

- 不要删除隐藏的 `#pinyinInput` 和 `#pinyinInputPinyin`，它们仍是内部拼音数据源。
- 如果调整小格 DOM 结构，要同步检查事件监听：
  - `.pinyin-pair-input`：拼音输入。
  - `.pinyin-pair-char`：题目选中切换。
  - `.pinyin-pair-editor` 空白处：展开/收起。
- 如果改变文本解析规则，要确认空格、标点、换行、旧 `[[...]]` 标记的兼容行为。
- 改动后至少运行：

```bash
node --check app.js
```
