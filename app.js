const pinyin = window.pinyinPro?.pinyin;
const STORAGE_KEY = "pinyin-tianzige-settings-v1";

const els = {
  root: document.documentElement,
  pagesPreview: document.querySelector("#pagesPreview"),
  textInput: document.querySelector("#textInput"),
  textInputPinyin: document.querySelector("#textInputPinyin"),
  gridColor: document.querySelector("#gridColor"),
  textColor: document.querySelector("#textColor"),
  pinyinColor: document.querySelector("#pinyinColor"),
  cellSize: document.querySelector("#cellSize"),
  columns: document.querySelector("#columns"),
  rowGap: document.querySelector("#rowGap"),
  hanziScale: document.querySelector("#hanziScale"),
  pinyinScale: document.querySelector("#pinyinScale"),
  toneType: document.querySelector("#toneType"),
  answerPlacement: document.querySelector("#answerPlacement"),
  showPunctuation: document.querySelector("#showPunctuation"),
  showGuides: document.querySelector("#showGuides"),
  includeAnswers: document.querySelector("#includeAnswers"),
  sheetTitle: document.querySelector("#sheetTitle"),
  status: document.querySelector("#status"),
  printBtn: document.querySelector("#printBtn"),
  exportPdfBtn: document.querySelector("#exportPdfBtn"),
  prevPageBtn: document.querySelector("#prevPageBtn"),
  nextPageBtn: document.querySelector("#nextPageBtn"),
  newPageBtn: document.querySelector("#newPageBtn"),
  deletePageBtn: document.querySelector("#deletePageBtn"),
  exportTextBtn: document.querySelector("#exportTextBtn"),
  importTextBtn: document.querySelector("#importTextBtn"),
  importTextFile: document.querySelector("#importTextFile"),
  flipMarkersBtn: document.querySelector("#flipMarkersBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  pageIndicator: document.querySelector("#pageIndicator"),
};

const savedFields = [
  "gridColor",
  "textColor",
  "pinyinColor",
  "cellSize",
  "columns",
  "rowGap",
  "hanziScale",
  "pinyinScale",
  "toneType",
  "answerPlacement",
  "showPunctuation",
  "showGuides",
  "includeAnswers",
  "sheetTitle",
];

let isRestoring = false;
let pages = [];
let activePageIndex = 0;

function createPage(textInput = "", textInputPinyin = "") {
  return { textInput, textInputPinyin };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState() {
  if (isRestoring) {
    return;
  }

  syncActivePageFromInputs();
  const state = {
    pages,
    activePageIndex,
  };
  for (const key of savedFields) {
    const el = els[key];
    state[key] = el.type === "checkbox" ? el.checked : el.value;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  const state = loadState();
  isRestoring = true;

  if (Array.isArray(state.pages) && state.pages.length > 0) {
    pages = state.pages.map((page) => createPage(page.textInput || "", page.textInputPinyin || ""));
    activePageIndex = Math.min(Math.max(Number(state.activePageIndex) || 0, 0), pages.length - 1);
  } else {
    pages = [createPage(state.textInput ?? els.textInput.value, state.textInputPinyin ?? els.textInputPinyin.value)];
    activePageIndex = 0;
  }

  for (const key of savedFields) {
    const el = els[key];
    if (!el || state[key] === undefined) {
      continue;
    }
    if (el.type === "checkbox") {
      el.checked = Boolean(state[key]);
    } else {
      el.value = state[key];
    }
  }

  isRestoring = false;
  loadActivePageToInputs();
}

function syncActivePageFromInputs() {
  if (!pages[activePageIndex]) {
    pages[activePageIndex] = createPage();
  }
  pages[activePageIndex].textInput = els.textInput.value;
  pages[activePageIndex].textInputPinyin = els.textInputPinyin.value;
}

function loadActivePageToInputs() {
  const page = pages[activePageIndex] || createPage();
  els.textInput.value = page.textInput;
  els.textInputPinyin.value = page.textInputPinyin;
  updatePageControls();
}

function updatePageControls() {
  els.pageIndicator.textContent = `第 ${activePageIndex + 1} 页 / 共 ${pages.length} 页`;
  els.prevPageBtn.disabled = activePageIndex === 0;
  els.nextPageBtn.disabled = activePageIndex >= pages.length - 1;
}

const isChinese = (char) => /\p{Script=Han}/u.test(char);
const isPunctuation = (char) => /[\s，。！？；：“”‘’、,.!?;:"'（）()《》<>]/u.test(char);
const isSpace = (char) => char === " " || char === "\t";
const commonVerbChars = new Set("走跑跳看说讲读写听唱笑哭吃喝拿放坐站来去回进出做");

function getPinyinList(text) {
  if (!pinyin) {
    return [];
  }

  return pinyin(text, {
    type: "array",
    toneType: els.toneType.value,
    nonZh: "removed",
  });
}

function parseQuestionText(text) {
  const chars = [];
  let question = false;

  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith("[[", i)) {
      question = true;
      i += 1;
      continue;
    }
    if (text.startsWith("]]", i)) {
      question = false;
      i += 1;
      continue;
    }
    chars.push({ char: text[i], question });
  }

  return chars;
}

function flipQuestionMarkers(text) {
  const chars = parseQuestionText(text);
  let output = "";
  let marking = false;

  for (const { char, question } of chars) {
    const shouldMark = !question && char !== "\n";
    if (shouldMark && !marking) {
      output += "[[";
      marking = true;
    }
    if (!shouldMark && marking) {
      output += "]]";
      marking = false;
    }
    output += char;
  }

  if (marking) {
    output += "]]";
  }
  return output;
}

function pinyinDe() {
  if (els.toneType.value === "num") {
    return "de5";
  }
  return "de";
}

function nearestChinese(chars, start, step) {
  for (let i = start; i >= 0 && i < chars.length; i += step) {
    const char = chars[i].char;
    if (isChinese(char)) {
      return char;
    }
    if (char === "\n" || (char.trim() && !isPunctuation(char))) {
      return "";
    }
  }
  return "";
}

function isAdverbialDe(chars, index) {
  const prev = nearestChinese(chars, index - 1, -1);
  const next = nearestChinese(chars, index + 1, 1);
  const prevPrev = nearestChinese(chars, index - 2, -1);

  if (!prev || !next) {
    return false;
  }

  return prev === prevPrev || commonVerbChars.has(next);
}

function buildItems(chars, pinyinList) {
  let pyIndex = 0;

  return chars.filter(({ char }) => char !== "\r").map(({ char, question }, index, filteredChars) => {
    if (char === "\n") {
      return { char: "", py: "", lineBreak: true };
    }

    if (isChinese(char)) {
      let py = pinyinList[pyIndex] || "";
      if (char === "地" && isAdverbialDe(filteredChars, index)) {
        py = pinyinDe();
      }
      pyIndex += 1;
      return { char, py, punctuation: false, question };
    }

    return {
      char: char.trim() ? char : "",
      py: "",
      punctuation: isPunctuation(char),
      space: isSpace(char),
      question,
    };
  });
}

function render() {
  syncActivePageFromInputs();
  const columns = Number(els.columns.value) || 10;

  els.root.style.setProperty("--grid-color", els.gridColor.value);
  els.root.style.setProperty("--text-color", els.textColor.value);
  els.root.style.setProperty("--pinyin-color", els.pinyinColor.value);
  els.root.style.setProperty("--cell-size", `${els.cellSize.value}mm`);
  els.root.style.setProperty("--row-gap", `${Number(els.rowGap.value) || 0}mm`);
  els.root.style.setProperty("--hanzi-scale", (Number(els.hanziScale.value) || 100) / 100);
  els.root.style.setProperty("--pinyin-scale", (Number(els.pinyinScale.value) || 100) / 100);
  els.root.style.setProperty("--columns", columns);
  els.pagesPreview.replaceChildren();
  updatePageControls();

  function appendSectionLabel(worksheet, text) {
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = text;
    label.style.gridColumn = `1 / span ${columns}`;
    worksheet.append(label);
  }

  function makeCell(item, gridIndex, visibility) {
    const classes = [
      "cell",
      item.punctuation ? "punctuation" : "",
      gridIndex % columns === columns - 1 ? "row-end" : "",
    ].filter(Boolean);
    const cell = document.createElement("div");
    cell.className = classes.join(" ");
    const questionChar = isChinese(item.char) && item.question;
    const highlightable = questionChar;

    const py = document.createElement("div");
    const showPinyin = questionChar ? visibility.showPinyin : true;
    py.className = [
      "pinyin-box",
      showPinyin ? "" : "is-hidden",
      visibility.highlightPinyin && highlightable ? "answer-highlight" : "",
    ].filter(Boolean).join(" ");
    py.textContent = item.py;

    const hanzi = document.createElement("div");
    const showChar = item.punctuation
      ? els.showPunctuation.checked
      : questionChar ? visibility.showHanzi : true;
    hanzi.className = [
      "hanzi-box",
      showChar ? "" : "is-hidden",
      visibility.highlightHanzi && highlightable ? "answer-highlight" : "",
    ].filter(Boolean).join(" ");
    hanzi.textContent = item.char;

    cell.append(py, hanzi);
    return cell;
  }

  function renderTextSection(worksheet, label, text, visibility) {
    if (!text) {
      return 0;
    }

    appendSectionLabel(worksheet, label);
    const chars = parseQuestionText(text);
    const cleanText = chars.map(({ char }) => char).join("");
    const list = getPinyinList(cleanText);
    const items = buildItems(chars, list);
    let sectionUsed = 0;
    let gridIndex = 0;
    let lastCell = null;

    function appendCell(item = { char: "", py: "", punctuation: false }) {
      const cell = makeCell(item, gridIndex, visibility);
      worksheet.append(cell);
      gridIndex += 1;
      lastCell = cell;
      return cell;
    }

    function fillRow() {
      if (gridIndex === 0) {
        return;
      }

      while (gridIndex % columns !== 0) {
        appendCell();
      }
    }

    for (const item of items) {
      if (item.lineBreak) {
        fillRow();
        gridIndex = 0;
        lastCell = null;
        continue;
      }
      if (item.punctuation && !item.space && !els.showPunctuation.checked) {
        continue;
      }

      appendCell(item);
      sectionUsed += isChinese(item.char) ? 1 : 0;
    }

    fillRow();
    if (lastCell) {
      lastCell.classList.add("last-cell");
    }
    return sectionUsed;
  }

  function createPaper(answerMode = false) {
    const paper = document.createElement("div");
    paper.className = `paper${answerMode ? " answer-paper" : ""}`;
    paper.classList.toggle("no-guides", !els.showGuides.checked);
    const worksheet = document.createElement("div");
    worksheet.className = "worksheet";
    paper.append(worksheet);
    els.pagesPreview.append(paper);
    return worksheet;
  }

  function renderPage(worksheet, page, answerMode = false) {
    worksheet.replaceChildren();
    let pageUsed = 0;
    const pinyinToHanziText = (page.textInput || "").trim();
    const hanziToPinyinText = (page.textInputPinyin || "").trim();

    pageUsed += renderTextSection(
      worksheet,
      answerMode ? "答案：看拼音写汉字" : "看拼音写汉字",
      pinyinToHanziText,
      answerMode
        ? { showPinyin: true, showHanzi: true, highlightHanzi: true }
        : { showPinyin: true, showHanzi: false }
    );
    pageUsed += renderTextSection(
      worksheet,
      answerMode ? "答案：看汉字写拼音" : "看汉字写拼音",
      hanziToPinyinText,
      answerMode
        ? { showPinyin: true, showHanzi: true, highlightPinyin: true }
        : { showPinyin: false, showHanzi: true }
    );

    return pageUsed;
  }

  let used = 0;
  pages.forEach((page) => {
    used += renderPage(createPaper(false), page, false);
    if (els.includeAnswers.checked && els.answerPlacement.value === "after-each") {
      renderPage(createPaper(true), page, true);
    }
  });
  if (els.includeAnswers.checked && els.answerPlacement.value === "after-all") {
    pages.forEach((page) => {
      renderPage(createPaper(true), page, true);
    });
  }

  els.status.textContent = pinyin
    ? `已生成 ${pages.length} 个编辑页，${used} 个汉字格${els.includeAnswers.checked ? "，含答案页" : ""}。`
    : "拼音库未加载，请联网后刷新，或改为本地离线库。";
}

[
  els.textInput,
  els.textInputPinyin,
  els.gridColor,
  els.textColor,
  els.pinyinColor,
  els.cellSize,
  els.columns,
  els.rowGap,
  els.hanziScale,
  els.pinyinScale,
  els.toneType,
  els.answerPlacement,
  els.showPunctuation,
  els.showGuides,
  els.includeAnswers,
  els.sheetTitle,
].forEach((el) => el.addEventListener("input", () => {
  render();
  saveState();
}));

els.prevPageBtn.addEventListener("click", () => {
  syncActivePageFromInputs();
  activePageIndex = Math.max(activePageIndex - 1, 0);
  loadActivePageToInputs();
  render();
  saveState();
});

els.nextPageBtn.addEventListener("click", () => {
  syncActivePageFromInputs();
  activePageIndex = Math.min(activePageIndex + 1, pages.length - 1);
  loadActivePageToInputs();
  render();
  saveState();
});

els.newPageBtn.addEventListener("click", () => {
  syncActivePageFromInputs();
  pages.splice(activePageIndex + 1, 0, createPage());
  activePageIndex += 1;
  loadActivePageToInputs();
  render();
  saveState();
});

els.deletePageBtn.addEventListener("click", () => {
  if (pages.length <= 1) {
    pages = [createPage()];
    activePageIndex = 0;
  } else {
    pages.splice(activePageIndex, 1);
    activePageIndex = Math.min(activePageIndex, pages.length - 1);
  }
  loadActivePageToInputs();
  render();
  saveState();
});

els.exportTextBtn.addEventListener("click", () => {
  syncActivePageFromInputs();
  const payload = {
    type: "pinyin-tianzige-pages",
    version: 1,
    exportedAt: new Date().toISOString(),
    pages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `pinyin-tianzige-pages-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  els.status.textContent = `已导出 ${pages.length} 页文字。`;
});

els.importTextBtn.addEventListener("click", () => {
  els.importTextFile.click();
});

els.importTextFile.addEventListener("change", async () => {
  const file = els.importTextFile.files?.[0];
  els.importTextFile.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    if (payload?.type !== "pinyin-tianzige-pages" || !Array.isArray(payload.pages)) {
      throw new Error("Invalid export file");
    }

    const importedPages = payload.pages.map((page) => createPage(page.textInput || "", page.textInputPinyin || ""));
    if (importedPages.length === 0) {
      throw new Error("Empty export file");
    }

    pages = importedPages;
    activePageIndex = 0;
    loadActivePageToInputs();
    render();
    saveState();
    els.status.textContent = `已导入 ${pages.length} 页文字。`;
  } catch {
    els.status.textContent = "导入失败，请选择本工具导出的 JSON 文件。";
  }
});

els.flipMarkersBtn.addEventListener("click", () => {
  els.textInput.value = flipQuestionMarkers(els.textInput.value);
  els.textInputPinyin.value = flipQuestionMarkers(els.textInputPinyin.value);
  syncActivePageFromInputs();
  render();
  saveState();
});

els.resetBtn.addEventListener("click", () => {
  pages = [createPage()];
  activePageIndex = 0;
  loadActivePageToInputs();
  render();
  saveState();
});

els.printBtn.addEventListener("click", () => window.print());

els.exportPdfBtn.addEventListener("click", async () => {
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    els.status.textContent = "PDF 导出库未加载，请联网后刷新，或先使用打印保存为 PDF。";
    return;
  }

  render();
  document.body.classList.add("pdf-rendering");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `pinyin-tianzige-${date}.pdf`;
  els.exportPdfBtn.disabled = true;
  els.status.textContent = "正在导出 PDF...";

  try {
    const pdf = new window.jspdf.jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });
    const papers = [...els.pagesPreview.querySelectorAll(".paper")];

    for (let i = 0; i < papers.length; i += 1) {
      const canvas = await window.html2canvas(papers[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: papers[i].offsetWidth,
        height: papers[i].offsetHeight,
        windowWidth: papers[i].scrollWidth,
        windowHeight: papers[i].scrollHeight,
      });
      const img = canvas.toDataURL("image/jpeg", 0.98);
      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }
      pdf.addImage(img, "JPEG", 0, 0, 210, 297);
    }

    pdf.save(fileName);
    els.status.textContent = `已导出 ${fileName}`;
  } catch {
    els.status.textContent = "PDF 导出失败，请先用打印保存为 PDF。";
  } finally {
    document.body.classList.remove("pdf-rendering");
    els.exportPdfBtn.disabled = false;
  }
});

restoreState();
render();
