const pinyin = window.pinyinPro?.pinyin;
const addPinyinDict = window.pinyinPro?.addDict;
const customPinyin = window.pinyinPro?.customPinyin;
const PINYIN_DICT_VERSION_BASE = "pinyin-pro-3.28.1";
const COMPLETE_PINYIN_DICT_SRC = "./libs/pinyin-pro-complete-dict.js";
let completePinyinDictAdded = false;
let completePinyinDictLoadPromise = null;

if (customPinyin) {
  customPinyin({
    开心地: "kāi xīn de",
  });
}

const STORAGE_KEY = "pinyin-tianzige-settings-v1";
const AI_PINYIN_CACHE_KEY = "pinyin-tianzige-ai-pinyin-cache-v1";
const AI_PINYIN_CACHE_VERSION = "ai-pinyin-cache-v1";
const AI_PINYIN_CACHE_MAX_ENTRIES = 500;
const AI_PINYIN_PROMPT_VERSION = "context-pinyin-json-v1";
const USER_PINYIN_DICT_KEY = "pinyin-tianzige-user-pinyin-dict-v1";
const USER_PINYIN_DICT_VERSION = 1;

const els = {
  root: document.documentElement,
  pagesPreview: document.querySelector("#pagesPreview"),
  textInput: document.querySelector("#textInput"),
  pinyinInput: document.querySelector("#pinyinInput"),
  pinyinPairEditor: document.querySelector("#pinyinPairEditor"),
  textInputPinyin: document.querySelector("#textInputPinyin"),
  pinyinInputPinyin: document.querySelector("#pinyinInputPinyin"),
  pinyinPairEditorPinyin: document.querySelector("#pinyinPairEditorPinyin"),
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
  fillBlankPage: document.querySelector("#fillBlankPage"),
  useCompleteDict: document.querySelector("#useCompleteDict"),
  aiPinyinEnabled: document.querySelector("#aiPinyinEnabled"),
  aiOptionsBtn: document.querySelector("#aiOptionsBtn"),
  aiOptionsPanel: document.querySelector("#aiOptionsPanel"),
  aiOptionsCloseBtn: document.querySelector("#aiOptionsCloseBtn"),
  aiOptionsSaveBtn: document.querySelector("#aiOptionsSaveBtn"),
  aiApiUrl: document.querySelector("#aiApiUrl"),
  aiToken: document.querySelector("#aiToken"),
  aiModel: document.querySelector("#aiModel"),
  aiDebugVisible: document.querySelector("#aiDebugVisible"),
  aiDebugBox: document.querySelector("#aiDebugBox"),
  aiDebugRequest: document.querySelector("#aiDebugRequest"),
  aiDebugResponse: document.querySelector("#aiDebugResponse"),
  retryAiBtn: document.querySelector("#retryAiBtn"),
  clearAiCacheBtn: document.querySelector("#clearAiCacheBtn"),
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
  exportUserDictBtn: document.querySelector("#exportUserDictBtn"),
  importUserDictBtn: document.querySelector("#importUserDictBtn"),
  importUserDictFile: document.querySelector("#importUserDictFile"),
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
  "fillBlankPage",
  "useCompleteDict",
  "aiPinyinEnabled",
  "aiApiUrl",
  "aiToken",
  "aiModel",
  "aiDebugVisible",
  "sheetTitle",
];

let isRestoring = false;
let pages = [];
let activePageIndex = 0;
const aiPinyinRequestIds = new WeakMap();
const pinyinManualVersions = new WeakMap();
let aiPinyinDebounceTimer = 0;
let aiPinyinCache = loadAiPinyinCache();
let userPinyinDict = loadUserPinyinDict();
let activeAiTextTarget = null;

function setStatus(message, kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function setAiDebug(request, response = "") {
  els.aiDebugRequest.value = typeof request === "string" ? request : prettyJson(request);
  els.aiDebugResponse.value = typeof response === "string" ? response : prettyJson(response);
}

function setAiOptionsOpen(open) {
  els.aiOptionsPanel.hidden = !open;
}

function updateAiDebugVisibility() {
  els.aiDebugBox.hidden = !els.aiDebugVisible.checked;
}

function pinyinDictVersion() {
  return `${PINYIN_DICT_VERSION_BASE}-${els.aiPinyinEnabled.checked ? "ai" : "local"}-${els.useCompleteDict.checked ? "complete" : "default"}-custom-de-1`;
}

function registerCompletePinyinDict() {
  if (completePinyinDictAdded) {
    return;
  }
  if (!addPinyinDict || !window.PinyinProCompleteDict) {
    throw new Error("完整拼音词典未加载。");
  }
  addPinyinDict(window.PinyinProCompleteDict, "complete");
  completePinyinDictAdded = true;
}

function loadCompletePinyinDict() {
  if (!els.useCompleteDict.checked) {
    return Promise.resolve(false);
  }
  if (completePinyinDictAdded) {
    return Promise.resolve(true);
  }
  if (window.PinyinProCompleteDict) {
    registerCompletePinyinDict();
    return Promise.resolve(true);
  }
  if (!completePinyinDictLoadPromise) {
    completePinyinDictLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = COMPLETE_PINYIN_DICT_SRC;
      script.onload = () => {
        try {
          registerCompletePinyinDict();
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error("完整拼音词典加载失败。"));
      document.head.appendChild(script);
    });
  }
  return completePinyinDictLoadPromise;
}

function loadAiPinyinCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(AI_PINYIN_CACHE_KEY) || "{}");
    if (cache.version === AI_PINYIN_CACHE_VERSION && cache.entries && typeof cache.entries === "object") {
      return cache;
    }
  } catch {
    // Ignore malformed cache and start fresh.
  }
  return { version: AI_PINYIN_CACHE_VERSION, entries: {} };
}

function saveAiPinyinCache() {
  const entries = Object.entries(aiPinyinCache.entries);
  if (entries.length > AI_PINYIN_CACHE_MAX_ENTRIES) {
    entries
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
      .slice(AI_PINYIN_CACHE_MAX_ENTRIES)
      .forEach(([key]) => delete aiPinyinCache.entries[key]);
  }
  localStorage.setItem(AI_PINYIN_CACHE_KEY, JSON.stringify(aiPinyinCache));
}

function clearAiPinyinCache() {
  aiPinyinCache = { version: AI_PINYIN_CACHE_VERSION, entries: {} };
  localStorage.removeItem(AI_PINYIN_CACHE_KEY);
}

function loadUserPinyinDict() {
  try {
    const dict = JSON.parse(localStorage.getItem(USER_PINYIN_DICT_KEY) || "{}");
    if (dict.version === USER_PINYIN_DICT_VERSION && dict.entries && typeof dict.entries === "object") {
      return dict;
    }
  } catch {
    // Ignore malformed user dictionaries and start fresh.
  }
  return { version: USER_PINYIN_DICT_VERSION, entries: {} };
}

function saveUserPinyinDict() {
  localStorage.setItem(USER_PINYIN_DICT_KEY, JSON.stringify(userPinyinDict));
}

function chineseWordSegments(text) {
  const segments = [];
  let raw = "";
  let chinese = "";
  let chineseStart = 0;
  let chineseCount = 0;
  let chineseSeen = 0;

  function pushSegment() {
    if (chineseCount > 0) {
      segments.push({
        raw,
        key: chinese,
        chineseStart,
        chineseCount,
      });
    }
    raw = "";
    chinese = "";
    chineseCount = 0;
  }

  for (const char of text) {
    if (isSpace(char)) {
      pushSegment();
      continue;
    }
    raw += char;
    if (isChinese(char)) {
      if (chineseCount === 0) {
        chineseStart = chineseSeen;
      }
      chinese += char;
      chineseCount += 1;
      chineseSeen += 1;
    }
  }
  pushSegment();
  return segments;
}

function userDictTokensForText(text) {
  const tokens = Array(chineseCharsFromText(text).length).fill("");
  for (const segment of chineseWordSegments(text)) {
    const entry = userPinyinDict.entries[segment.key];
    if (!entry || !Array.isArray(entry.tokens) || entry.tokens.length !== segment.chineseCount) {
      continue;
    }
    entry.tokens.forEach((token, offset) => {
      tokens[segment.chineseStart + offset] = token;
    });
  }
  return tokens;
}

function applyUserDictTokens(text, tokens) {
  const output = [...tokens];
  const dictTokens = userDictTokensForText(text);
  dictTokens.forEach((token, index) => {
    if (token) {
      output[index] = token;
    }
  });
  return output;
}

function saveUserDictForChineseIndex(text, pinyinText, chineseIndex) {
  const segment = chineseWordSegments(text).find((item) => (
    chineseIndex >= item.chineseStart &&
    chineseIndex < item.chineseStart + item.chineseCount
  ));
  if (!segment || segment.chineseCount < 1) {
    return false;
  }

  const tokens = pinyinTokens(pinyinText).slice(segment.chineseStart, segment.chineseStart + segment.chineseCount);
  if (tokens.length !== segment.chineseCount || tokens.some((token) => !token)) {
    return false;
  }

  userPinyinDict.entries[segment.key] = {
    word: segment.key,
    tokens,
    updatedAt: new Date().toISOString(),
  };
  saveUserPinyinDict();
  return true;
}

function aiTargets() {
  return [
    { text: els.textInput, py: els.pinyinInput, label: "看拼音写汉字" },
    { text: els.textInputPinyin, py: els.pinyinInputPinyin, label: "看汉字写拼音" },
  ];
}

function currentAiTarget() {
  const focused = aiTargets().find(({ text }) => text === document.activeElement);
  return focused || activeAiTextTarget || aiTargets()[0];
}

function markManualPinyinEdit(pyEl) {
  pinyinManualVersions.set(pyEl, (pinyinManualVersions.get(pyEl) || 0) + 1);
}

function hasCompletePinyin(text, pinyinText) {
  const chineseCount = chineseCharsFromText(text).length;
  if (chineseCount === 0) {
    return false;
  }
  return pinyinTokens(pinyinText).length >= chineseCount;
}

function createPage(
  textInput = "",
  textInputPinyin = "",
  pinyinInput = "",
  pinyinInputPinyin = "",
  textInputQuestions = null,
  textInputPinyinQuestions = null
) {
  const pinyinToHanzi = normalizeQuestionField(textInput, textInputQuestions);
  const hanziToPinyin = normalizeQuestionField(textInputPinyin, textInputPinyinQuestions);
  return {
    textInput: pinyinToHanzi.text,
    textInputPinyin: hanziToPinyin.text,
    pinyinInput,
    pinyinInputPinyin,
    textInputQuestions: pinyinToHanzi.questions,
    textInputPinyinQuestions: hanziToPinyin.questions,
  };
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
    pinyinDictVersion: pinyinDictVersion(),
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
    const shouldRefreshPinyinCache = state.pinyinDictVersion !== pinyinDictVersion();
    pages = state.pages.map((page) => createPage(
      page.textInput || "",
      page.textInputPinyin || "",
      shouldRefreshPinyinCache ? autoPinyinText(page.textInput || "") : page.pinyinInput || autoPinyinText(page.textInput || ""),
      shouldRefreshPinyinCache ? autoPinyinText(page.textInputPinyin || "") : page.pinyinInputPinyin || autoPinyinText(page.textInputPinyin || ""),
      page.textInputQuestions,
      page.textInputPinyinQuestions
    ));
    activePageIndex = Math.min(Math.max(Number(state.activePageIndex) || 0, 0), pages.length - 1);
  } else {
    const textInput = state.textInput ?? els.textInput.value;
    const textInputPinyin = state.textInputPinyin ?? els.textInputPinyin.value;
    pages = [createPage(textInput, textInputPinyin, autoPinyinText(textInput), autoPinyinText(textInputPinyin))];
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
  pages[activePageIndex].pinyinInput = els.pinyinInput.value;
  pages[activePageIndex].pinyinInputPinyin = els.pinyinInputPinyin.value;
  pages[activePageIndex].textInputQuestions ||= [];
  pages[activePageIndex].textInputPinyinQuestions ||= [];
}

function loadActivePageToInputs() {
  const page = pages[activePageIndex] || createPage();
  els.textInput.value = page.textInput;
  els.textInputPinyin.value = page.textInputPinyin;
  els.pinyinInput.value = page.pinyinInput || autoPinyinText(page.textInput || "");
  els.pinyinInputPinyin.value = page.pinyinInputPinyin || autoPinyinText(page.textInputPinyin || "");
  renderPinyinPairEditors();
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
const commonVerbChars = new Set("走跑跳爬看说讲读写听唱笑哭吃喝拿放坐站来去回进出做");

function getPinyinList(text, toneType = els.toneType.value) {
  if (!pinyin || !shouldUsePinyinPro()) {
    return [];
  }

  return pinyin(text, {
    type: "array",
    toneType,
    nonZh: "removed",
  });
}

function parseQuestionText(text, selectedChineseIndexes = null) {
  const chars = [];
  let question = false;
  let chineseIndex = 0;
  const selected = Array.isArray(selectedChineseIndexes)
    ? new Set(selectedChineseIndexes.map(Number).filter((index) => Number.isInteger(index) && index >= 0))
    : null;

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
    const char = text[i];
    const chinese = isChinese(char);
    chars.push({
      char,
      question: chinese && (selected ? selected.has(chineseIndex) : question),
      chineseIndex: chinese ? chineseIndex : undefined,
    });
    if (chinese) {
      chineseIndex += 1;
    }
  }

  return chars;
}

function normalizeQuestionField(text, savedQuestions = null) {
  const chars = parseQuestionText(text);
  const cleanText = chars.map(({ char }) => char).join("");
  const chineseCount = chars.filter(({ char }) => isChinese(char)).length;
  const questions = Array.isArray(savedQuestions)
    ? savedQuestions
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < chineseCount)
    : chars
      .filter(({ char, question }) => isChinese(char) && question)
      .map(({ chineseIndex }) => chineseIndex);

  return { text: cleanText, questions: [...new Set(questions)] };
}

function flipQuestionMarkers(text) {
  const chars = parseQuestionText(text);
  let output = "";
  let marking = false;

  for (const { char, question } of chars) {
    const shouldMark = !question && isChinese(char);
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

function pinyinDe(toneType = els.toneType.value) {
  if (toneType === "num") {
    return "de5";
  }
  return "de";
}

function autoPinyinText(text) {
  if (!shouldUsePinyinPro()) {
    return userDictTokensForText(text).join(" ");
  }
  const chars = parseQuestionText(text);
  const cleanText = chars.map(({ char }) => char).join("");
  const list = getPinyinList(cleanText, "num");
  const items = buildItems(chars, list, "num");
  const tokens = items
    .filter((item) => isChinese(item.char))
    .map((item) => item.py);
  return applyUserDictTokens(cleanText, tokens).join(" ");
}

function pinyinTokens(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function aiConfig() {
  return {
    enabled: els.aiPinyinEnabled.checked,
    apiUrl: els.aiApiUrl.value.trim().replace(/\/+$/, ""),
    token: els.aiToken.value.trim(),
    model: els.aiModel.value.trim(),
  };
}

function canUseAiPinyin() {
  const config = aiConfig();
  return Boolean(config.enabled && config.apiUrl && config.token && config.model);
}

function shouldUsePinyinPro() {
  return !els.aiPinyinEnabled.checked;
}

function extractJsonArray(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return null;
    }
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function normalizeAiPinyinToken(token) {
  return String(token || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/ü/g, "v")
    .replace(/u:/g, "v");
}

function splitChineseSegments(text) {
  const segments = [];
  let current = "";
  for (const char of text) {
    if (isChinese(char)) {
      current += char;
    } else if (current) {
      segments.push(current);
      current = "";
    }
  }
  if (current) {
    segments.push(current);
  }
  return segments;
}

function aiPinyinCacheKey(config, segment) {
  return [
    AI_PINYIN_PROMPT_VERSION,
    config.apiUrl,
    config.model,
    segment,
  ].join("\u001f");
}

function readAiPinyinCache(text, config) {
  const segments = splitChineseSegments(text);
  if (!segments.length || segments.some((segment) => segment.length < 2)) {
    return null;
  }

  const tokens = [];
  for (const segment of segments) {
    const entry = aiPinyinCache.entries[aiPinyinCacheKey(config, segment)];
    if (!entry || !Array.isArray(entry.tokens) || entry.tokens.length !== segment.length) {
      return null;
    }
    entry.updatedAt = Date.now();
    tokens.push(...entry.tokens);
  }
  saveAiPinyinCache();
  return tokens;
}

function writeAiPinyinCache(text, tokens, config) {
  const segments = splitChineseSegments(text);
  let tokenIndex = 0;
  let changed = false;

  for (const segment of segments) {
    const segmentTokens = tokens.slice(tokenIndex, tokenIndex + segment.length);
    tokenIndex += segment.length;
    if (segment.length < 2 || segmentTokens.length !== segment.length || segmentTokens.some((token) => !token)) {
      continue;
    }
    aiPinyinCache.entries[aiPinyinCacheKey(config, segment)] = {
      tokens: segmentTokens,
      updatedAt: Date.now(),
    };
    changed = true;
  }

  if (changed) {
    saveAiPinyinCache();
  }
}

async function fetchAiPinyinTokens(text, label, options = {}) {
  const { skipCache = false } = options;
  const config = aiConfig();
  const chars = chineseCharsFromText(text);
  if (chars.length === 0) {
    return { tokens: [], cached: false };
  }

  const cachedTokens = skipCache ? null : readAiPinyinCache(text, config);
  if (cachedTokens) {
    setAiDebug(
      {
        source: "cache",
        apiUrl: config.apiUrl,
        model: config.model,
        label,
        text,
      },
      {
        cached: true,
        tokens: cachedTokens,
      }
    );
    return { tokens: cachedTokens, cached: true };
  }

  const requestBody = {
    model: config.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "你是汉语拼音正音助手。",
          "请按上下文判断多音字和轻声。",
          "只返回 JSON 字符串数组，不要解释。",
          "数组长度必须等于输入文本中的汉字数量，忽略标点、空格和换行。",
          "每个元素使用数字声调拼音，例如 zhong1、qing4、de5。轻声必须用 5。",
        ].join("\n"),
      },
      {
        role: "user",
        content: `任务：${label}\n文本：${text}\n汉字序列：${chars.join("")}`,
      },
    ],
  };
  setAiDebug({
    url: `${config.apiUrl}/chat/completions`,
    method: "POST",
    skipCache,
    body: requestBody,
  }, "等待响应...");

  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }
  setAiDebug({
    url: `${config.apiUrl}/chat/completions`,
    method: "POST",
    skipCache,
    body: requestBody,
  }, {
    status: response.status,
    ok: response.ok,
    body: payload || responseText,
  });

  if (!response.ok) {
    throw new Error(`AI 请求失败：${response.status}`);
  }

  if (!payload) {
    throw new Error("AI 返回内容不是 JSON。");
  }
  const content = payload?.choices?.[0]?.message?.content || "";
  const tokens = extractJsonArray(content)?.map(normalizeAiPinyinToken);
  if (!tokens || tokens.length !== chars.length || tokens.some((token) => !token)) {
    throw new Error("AI 返回的拼音数量和汉字数量不一致");
  }
  writeAiPinyinCache(text, tokens, config);
  return { tokens, cached: false };
}

async function updatePinyinWithAi(textEl, pyEl, label, options = {}) {
  const { force = false } = options;
  if (!canUseAiPinyin()) {
    if (force) {
      setStatus("请先打开 AI 正音，并填写 API URL、Token 和 Model。", "error");
    }
    return;
  }

  if (!force && hasCompletePinyin(textEl.value, pyEl.value)) {
    setStatus(`已保留手动拼音：${label}。需要覆盖时请点“重试当前AI”。`, "success");
    return;
  }

  const requestId = (aiPinyinRequestIds.get(textEl) || 0) + 1;
  aiPinyinRequestIds.set(textEl, requestId);
  const text = textEl.value;
  const pinyinBeforeRequest = pyEl.value;
  const manualVersionBeforeRequest = pinyinManualVersions.get(pyEl) || 0;
  setStatus(`AI 正在生成拼音：${label}...`, "pending");

  try {
    const result = await fetchAiPinyinTokens(text, label, options);
    if (requestId !== aiPinyinRequestIds.get(textEl) || textEl.value !== text) {
      return;
    }
    if (!force && (
      pyEl.value !== pinyinBeforeRequest ||
      (pinyinManualVersions.get(pyEl) || 0) !== manualVersionBeforeRequest
    )) {
      setStatus(`AI 结果已跳过：${label} 的拼音已被手动修改。`, "success");
      return;
    }
    const { tokens, cached } = result;
    pyEl.value = applyUserDictTokens(text, tokens).join(" ");
    render();
    renderPinyinPairEditors();
    saveState();
    setStatus(`${cached ? "AI 已从缓存更新拼音" : "AI 已更新拼音"}：${label}`, "success");
  } catch (error) {
    if (requestId === aiPinyinRequestIds.get(textEl)) {
      setStatus(error.message || "AI 正音失败，已保留本地拼音。", "error");
    }
  }
}

function scheduleAiPinyinRefresh(delay = 500) {
  clearTimeout(aiPinyinDebounceTimer);
  if (!canUseAiPinyin()) {
    return;
  }
  aiPinyinDebounceTimer = window.setTimeout(() => {
    updatePinyinWithAi(els.textInput, els.pinyinInput, "看拼音写汉字");
    updatePinyinWithAi(els.textInputPinyin, els.pinyinInputPinyin, "看汉字写拼音");
  }, delay);
}

function stripToneMarks(value) {
  const toneMap = {
    ā: "a", á: "a", ǎ: "a", à: "a",
    ē: "e", é: "e", ě: "e", è: "e",
    ī: "i", í: "i", ǐ: "i", ì: "i",
    ō: "o", ó: "o", ǒ: "o", ò: "o",
    ū: "u", ú: "u", ǔ: "u", ù: "u",
    ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü",
  };
  return [...value].map((char) => toneMap[char] || char).join("");
}

function convertPinyinToken(token, toneType = els.toneType.value) {
  const match = token.match(/^([a-züv:]+)([0-5])$/i);
  if (!match) {
    return toneType === "none" ? stripToneMarks(token).replace(/[0-5]$/, "") : token;
  }

  const rawBase = match[1].replace(/u:/gi, "ü").replace(/v/gi, "ü");
  const tone = Number(match[2]);
  if (toneType === "num") {
    return `${rawBase}${tone}`;
  }
  if (toneType === "none" || tone === 0 || tone === 5) {
    return rawBase;
  }

  const toneMarks = {
    a: ["ā", "á", "ǎ", "à"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    o: ["ō", "ó", "ǒ", "ò"],
    u: ["ū", "ú", "ǔ", "ù"],
    "ü": ["ǖ", "ǘ", "ǚ", "ǜ"],
  };
  const chars = [...rawBase];
  let markIndex = chars.findIndex((char) => char === "a");
  if (markIndex === -1) markIndex = chars.findIndex((char) => char === "e");
  if (markIndex === -1) markIndex = rawBase.includes("ou") ? chars.findIndex((char) => char === "o") : -1;
  if (markIndex === -1) {
    for (let i = chars.length - 1; i >= 0; i -= 1) {
      if ("ioüu".includes(chars[i])) {
        markIndex = i;
        break;
      }
    }
  }
  if (markIndex === -1) {
    return rawBase;
  }
  chars[markIndex] = toneMarks[chars[markIndex]]?.[tone - 1] || chars[markIndex];
  return chars.join("");
}

function convertPinyinList(tokens, toneType = els.toneType.value) {
  return tokens.map((token) => convertPinyinToken(token, toneType));
}

function mergedPinyinTokens(text, pinyinText) {
  const manual = pinyinTokens(pinyinText);
  const userDict = userDictTokensForText(text);
  const automatic = pinyinTokens(autoPinyinText(text));
  const length = Math.max(chineseCharsFromText(text).length, manual.length, userDict.length, automatic.length);
  return Array.from({ length }, (_, index) => manual[index] || userDict[index] || automatic[index] || "");
}

function chineseCharsFromText(text) {
  return parseQuestionText(text)
    .filter(({ char }) => isChinese(char))
    .map(({ char }) => char);
}

function mapChineseIndexesByLcs(oldChars, newChars) {
  const dp = Array.from(
    { length: oldChars.length + 1 },
    () => Array(newChars.length + 1).fill(0)
  );

  for (let i = oldChars.length - 1; i >= 0; i -= 1) {
    for (let j = newChars.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldChars[i] === newChars[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const map = new Map();
  let i = 0;
  let j = 0;
  while (i < oldChars.length && j < newChars.length) {
    if (oldChars[i] === newChars[j]) {
      map.set(j, i);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return map;
}

function preservePinyinAfterTextEdit(oldText, newText, oldPinyinText) {
  if (oldText === newText) {
    return oldPinyinText;
  }

  const oldChars = chineseCharsFromText(oldText);
  const newChars = chineseCharsFromText(newText);
  const oldTokens = pinyinTokens(oldPinyinText);
  const automatic = pinyinTokens(autoPinyinText(newText));
  const oldIndexByNewIndex = mapChineseIndexesByLcs(oldChars, newChars);

  return newChars
    .map((_, newIndex) => {
      const oldIndex = oldIndexByNewIndex.get(newIndex);
      return oldIndex !== undefined && oldTokens[oldIndex]
        ? oldTokens[oldIndex]
        : automatic[newIndex] || "";
    })
    .join(" ");
}

function preserveQuestionIndexesAfterTextEdit(oldText, newText, oldQuestionIndexes = []) {
  const oldChars = chineseCharsFromText(oldText);
  const newChars = chineseCharsFromText(newText);
  const oldIndexByNewIndex = mapChineseIndexesByLcs(oldChars, newChars);
  const selected = new Set(oldQuestionIndexes);

  return newChars
    .map((_, newIndex) => ({ newIndex, oldIndex: oldIndexByNewIndex.get(newIndex) }))
    .filter(({ oldIndex }) => oldIndex !== undefined && selected.has(oldIndex))
    .map(({ newIndex }) => newIndex);
}

function toggleQuestionIndex(questionIndexes, index) {
  const selected = new Set(questionIndexes || []);
  if (selected.has(index)) {
    selected.delete(index);
  } else {
    selected.add(index);
  }
  return [...selected].sort((a, b) => a - b);
}

function invertQuestionIndexes(text, questionIndexes = []) {
  const selected = new Set(questionIndexes);
  return chineseCharsFromText(text)
    .map((_, index) => index)
    .filter((index) => !selected.has(index));
}

function pinyinTokensForEditor(text, pinyinText) {
  const chars = chineseCharsFromText(text);
  const manual = pinyinTokens(pinyinText);
  const userDict = userDictTokensForText(text);
  const automatic = pinyinTokens(autoPinyinText(text));
  return chars.map((_, index) => manual[index] || userDict[index] || automatic[index] || "");
}

function renderPinyinPairEditor(container, text, pinyinText, questionIndexes = []) {
  container.replaceChildren();
  const chars = parseQuestionText(text, questionIndexes);
  const hasEditableChars = chars.some(({ char }) => isChinese(char));
  if (!hasEditableChars) {
    return;
  }

  const tokens = pinyinTokensForEditor(text, pinyinText);
  const fragment = document.createDocumentFragment();
  let tokenIndex = 0;
  let lastWasSpace = false;

  chars.forEach(({ char, question, chineseIndex }) => {
    if (isSpace(char)) {
      if (!lastWasSpace) {
        const spacer = document.createElement("span");
        spacer.className = "pinyin-pair-space";
        fragment.append(spacer);
      }
      lastWasSpace = true;
      return;
    }
    if (!isChinese(char)) {
      lastWasSpace = false;
      return;
    }
    lastWasSpace = false;

    const pair = document.createElement("div");
    pair.className = "pinyin-pair";
    pair.classList.toggle("is-selected", question);

    const charBox = document.createElement("button");
    charBox.className = "pinyin-pair-char";
    charBox.type = "button";
    charBox.textContent = char;
    charBox.dataset.index = String(chineseIndex);
    charBox.setAttribute("aria-pressed", question ? "true" : "false");

    const input = document.createElement("input");
    input.className = "pinyin-pair-input";
    input.type = "text";
    input.value = tokens[tokenIndex] || "";
    input.dataset.index = String(chineseIndex);
    input.autocomplete = "off";
    input.spellcheck = false;

    pair.append(input, charBox);
    fragment.append(pair);
    tokenIndex += 1;
  });

  container.append(fragment);
}

function renderPinyinPairEditors() {
  const page = pages[activePageIndex] || createPage();
  const pinyinExpanded = els.pinyinPairEditor.classList.contains("is-expanded");
  const pinyinPinyinExpanded = els.pinyinPairEditorPinyin.classList.contains("is-expanded");
  renderPinyinPairEditor(els.pinyinPairEditor, els.textInput.value, els.pinyinInput.value, page.textInputQuestions);
  renderPinyinPairEditor(
    els.pinyinPairEditorPinyin,
    els.textInputPinyin.value,
    els.pinyinInputPinyin.value,
    page.textInputPinyinQuestions
  );
  els.pinyinPairEditor.classList.toggle("is-expanded", pinyinExpanded);
  els.pinyinPairEditorPinyin.classList.toggle("is-expanded", pinyinPinyinExpanded);
}

function syncPinyinInputFromPairEditor(container, pinyinInput, text) {
  const automatic = pinyinTokens(autoPinyinText(text));
  const tokens = [...container.querySelectorAll(".pinyin-pair-input")]
    .map((input, index) => input.value.replace(/\s+/g, "") || automatic[index] || "");
  pinyinInput.value = tokens.join(" ");
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

function buildItems(chars, pinyinList, toneType = els.toneType.value) {
  let pyIndex = 0;

  return chars.filter(({ char }) => char !== "\r").map(({ char, question }, index, filteredChars) => {
    if (char === "\n") {
      return { char: "", py: "", lineBreak: true };
    }

    if (isChinese(char)) {
      let py = pinyinList[pyIndex] || "";
      if (char === "地" && isAdverbialDe(filteredChars, index)) {
        py = pinyinDe(toneType);
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

  function renderTextSection(worksheet, label, text, pinyinText, questionIndexes, visibility) {
    if (!text) {
      return 0;
    }

    appendSectionLabel(worksheet, label);
    const chars = parseQuestionText(text, questionIndexes);
    const list = convertPinyinList(mergedPinyinTokens(text, pinyinText), els.toneType.value);
    const items = buildItems(chars, list, els.toneType.value);
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
      if (item.space && gridIndex % columns === 0) {
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

  function renderBlankPageGrid(worksheet) {
    const cellSize = Number(els.cellSize.value) || 18;
    const rowGap = Number(els.rowGap.value) || 0;
    const contentHeight = 297 - 28;
    const rowHeight = cellSize * 1.42;
    const rows = Math.max(1, Math.floor((contentHeight + rowGap) / (rowHeight + rowGap)));
    const totalCells = rows * columns;

    let lastCell = null;
    for (let i = 0; i < totalCells; i += 1) {
      const cell = makeCell({ char: "", py: "", punctuation: false }, i, { showPinyin: true, showHanzi: true });
      worksheet.append(cell);
      lastCell = cell;
    }
    if (lastCell) {
      lastCell.classList.add("last-cell");
    }
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
    const pinyinToHanziPinyin = page.pinyinInput || autoPinyinText(page.textInput || "");
    const hanziToPinyinPinyin = page.pinyinInputPinyin || autoPinyinText(page.textInputPinyin || "");
    const isBlankPage = !pinyinToHanziText && !hanziToPinyinText;

    if (!answerMode && isBlankPage && els.fillBlankPage.checked) {
      renderBlankPageGrid(worksheet);
      return 0;
    }

    pageUsed += renderTextSection(
      worksheet,
      answerMode ? "答案：看拼音写汉字" : "看拼音写汉字",
      pinyinToHanziText,
      pinyinToHanziPinyin,
      page.textInputQuestions,
      answerMode
        ? { showPinyin: true, showHanzi: true, highlightHanzi: true }
        : { showPinyin: true, showHanzi: false }
    );
    pageUsed += renderTextSection(
      worksheet,
      answerMode ? "答案：看汉字写拼音" : "看汉字写拼音",
      hanziToPinyinText,
      hanziToPinyinPinyin,
      page.textInputPinyinQuestions,
      answerMode
        ? { showPinyin: true, showHanzi: true, highlightPinyin: true }
        : { showPinyin: false, showHanzi: true }
    );

    return pageUsed;
  }

  let used = 0;
  pages.forEach((page) => {
    used += renderPage(createPaper(false), page, false);
    const pageHasText = (page.textInput || "").trim() || (page.textInputPinyin || "").trim();
    if (pageHasText && els.includeAnswers.checked && els.answerPlacement.value === "after-each") {
      renderPage(createPaper(true), page, true);
    }
  });
  if (els.includeAnswers.checked && els.answerPlacement.value === "after-all") {
    pages.forEach((page) => {
      const pageHasText = (page.textInput || "").trim() || (page.textInputPinyin || "").trim();
      if (pageHasText) {
        renderPage(createPaper(true), page, true);
      }
    });
  }

  setStatus(
    pinyin
      ? `已生成 ${pages.length} 个编辑页，${used} 个汉字格${els.includeAnswers.checked ? "，含答案页" : ""}。`
      : "拼音库未加载，请联网后刷新，或改为本地离线库。",
    pinyin ? "success" : "error"
  );
}

function refreshPinyinBoxesFromText() {
  els.pinyinInput.value = autoPinyinText(els.textInput.value);
  els.pinyinInputPinyin.value = autoPinyinText(els.textInputPinyin.value);
}

[
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
  els.fillBlankPage,
  els.sheetTitle,
].forEach((el) => el.addEventListener("input", () => {
  render();
  saveState();
}));

els.useCompleteDict.addEventListener("input", () => {
  saveState();
  setStatus(
    els.useCompleteDict.checked
      ? "已打开完整拼音词典，正在刷新并加载词典..."
      : "已关闭完整拼音词典，正在刷新并恢复默认词典...",
    "pending"
  );
  window.setTimeout(() => window.location.reload(), 120);
});

[
  els.aiPinyinEnabled,
  els.aiApiUrl,
  els.aiToken,
  els.aiModel,
  els.aiDebugVisible,
].forEach((el) => el.addEventListener("input", () => {
  if (el === els.aiPinyinEnabled) {
    refreshPinyinBoxesFromText();
    renderPinyinPairEditors();
    render();
  }
  if (el === els.aiDebugVisible) {
    updateAiDebugVisibility();
  }
  saveState();
  scheduleAiPinyinRefresh(0);
}));

els.aiOptionsBtn.addEventListener("click", () => {
  setAiOptionsOpen(true);
});

els.aiOptionsCloseBtn.addEventListener("click", () => {
  setAiOptionsOpen(false);
});

els.aiOptionsSaveBtn.addEventListener("click", () => {
  updateAiDebugVisibility();
  saveState();
  setAiOptionsOpen(false);
  setStatus("AI 选项已保存。", "success");
});

els.aiOptionsPanel.addEventListener("click", (event) => {
  if (event.target === els.aiOptionsPanel) {
    setAiOptionsOpen(false);
  }
});

aiTargets().forEach((target) => {
  target.text.addEventListener("focus", () => {
    activeAiTextTarget = target;
  });
});

els.retryAiBtn.addEventListener("click", () => {
  const target = currentAiTarget();
  updatePinyinWithAi(target.text, target.py, target.label, {
    skipCache: true,
    force: true,
  });
});

els.clearAiCacheBtn.addEventListener("click", () => {
  clearAiPinyinCache();
  setAiDebug(
    { action: "clearAiPinyinCache" },
    { cached: false, message: "AI 缓存已清空。" }
  );
  setStatus("AI 缓存已清空，下次会重新请求 AI。", "success");
});

[els.pinyinInput, els.pinyinInputPinyin].forEach((el) => el.addEventListener("input", () => {
  markManualPinyinEdit(el);
  render();
  renderPinyinPairEditors();
  saveState();
}));

[
  { editor: els.pinyinPairEditor, text: els.textInput, py: els.pinyinInput },
  { editor: els.pinyinPairEditorPinyin, text: els.textInputPinyin, py: els.pinyinInputPinyin },
].forEach(({ editor, text, py }) => editor.addEventListener("input", (event) => {
  if (!event.target.classList.contains("pinyin-pair-input")) {
    return;
  }
  event.target.value = event.target.value.replace(/\s+/g, "");
  syncPinyinInputFromPairEditor(editor, py, text.value);
  markManualPinyinEdit(py);
  const chineseIndex = Number(event.target.dataset.index);
  if (Number.isInteger(chineseIndex) && saveUserDictForChineseIndex(text.value, py.value, chineseIndex)) {
    setStatus("已保存到用户拼音辞典。", "success");
  }
  render();
  saveState();
}));

[
  { editor: els.pinyinPairEditor, key: "textInputQuestions" },
  { editor: els.pinyinPairEditorPinyin, key: "textInputPinyinQuestions" },
].forEach(({ editor, key }) => editor.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target === editor) {
    editor.classList.toggle("is-expanded");
    return;
  }
  if (!event.target.classList.contains("pinyin-pair-char")) {
    return;
  }
  const page = pages[activePageIndex] || createPage();
  const index = Number(event.target.dataset.index);
  page[key] = toggleQuestionIndex(page[key], index);
  renderPinyinPairEditors();
  render();
  saveState();
}));

document.addEventListener("click", (event) => {
  [els.pinyinPairEditor, els.pinyinPairEditorPinyin].forEach((editor) => {
    if (!editor.contains(event.target)) {
      editor.classList.remove("is-expanded");
    }
  });
});

[
  { text: els.textInput, py: els.pinyinInput, key: "textInputQuestions" },
  { text: els.textInputPinyin, py: els.pinyinInputPinyin, key: "textInputPinyinQuestions" },
].forEach(({ text, py, key }) => text.addEventListener("input", () => {
  const page = pages[activePageIndex] || createPage();
  const oldText = text === els.textInput ? page.textInput : page.textInputPinyin;
  const rawText = text.value;
  const hadMarkers = rawText.includes("[[") || rawText.includes("]]");
  const normalized = normalizeQuestionField(rawText);
  text.value = normalized.text;
  py.value = preservePinyinAfterTextEdit(oldText, normalized.text, py.value);
  page[key] = hadMarkers
    ? normalized.questions
    : preserveQuestionIndexesAfterTextEdit(oldText, normalized.text, page[key]);
  render();
  renderPinyinPairEditors();
  saveState();
  scheduleAiPinyinRefresh();
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
  setStatus(`已导出 ${pages.length} 页文字。`, "success");
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

    const importedPages = payload.pages.map((page) => createPage(
      page.textInput || "",
      page.textInputPinyin || "",
      page.pinyinInput || autoPinyinText(page.textInput || ""),
      page.pinyinInputPinyin || autoPinyinText(page.textInputPinyin || ""),
      page.textInputQuestions,
      page.textInputPinyinQuestions
    ));
    if (importedPages.length === 0) {
      throw new Error("Empty export file");
    }

    pages = importedPages;
    activePageIndex = 0;
    loadActivePageToInputs();
    render();
    saveState();
    setStatus(`已导入 ${pages.length} 页文字。`, "success");
  } catch {
    setStatus("导入失败，请选择本工具导出的 JSON 文件。", "error");
  }
});

els.exportUserDictBtn.addEventListener("click", () => {
  const payload = {
    type: "pinyin-tianzige-user-dict",
    version: USER_PINYIN_DICT_VERSION,
    exportedAt: new Date().toISOString(),
    entries: userPinyinDict.entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `pinyin-user-dict-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`已导出用户辞典 ${Object.keys(userPinyinDict.entries).length} 条。`, "success");
});

els.importUserDictBtn.addEventListener("click", () => {
  els.importUserDictFile.click();
});

els.importUserDictFile.addEventListener("change", async () => {
  const file = els.importUserDictFile.files?.[0];
  els.importUserDictFile.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    if (payload?.type !== "pinyin-tianzige-user-dict" || !payload.entries || typeof payload.entries !== "object") {
      throw new Error("Invalid user dictionary");
    }

    let imported = 0;
    for (const [word, entry] of Object.entries(payload.entries)) {
      const key = String(entry?.word || word || "").trim();
      const tokens = Array.isArray(entry?.tokens) ? entry.tokens.map(normalizeAiPinyinToken).filter(Boolean) : [];
      if (!key || chineseCharsFromText(key).length !== tokens.length) {
        continue;
      }
      userPinyinDict.entries[key] = {
        word: key,
        tokens,
        updatedAt: entry?.updatedAt || new Date().toISOString(),
      };
      imported += 1;
    }

    saveUserPinyinDict();
    refreshPinyinBoxesFromText();
    render();
    renderPinyinPairEditors();
    saveState();
    setStatus(`已导入用户辞典 ${imported} 条。`, "success");
  } catch {
    setStatus("用户辞典导入失败，请选择本工具导出的 JSON 文件。", "error");
  }
});

els.flipMarkersBtn.addEventListener("click", () => {
  const page = pages[activePageIndex] || createPage();
  page.textInputQuestions = invertQuestionIndexes(els.textInput.value, page.textInputQuestions);
  page.textInputPinyinQuestions = invertQuestionIndexes(els.textInputPinyin.value, page.textInputPinyinQuestions);
  syncActivePageFromInputs();
  renderPinyinPairEditors();
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
    setStatus("PDF 导出库未加载，请联网后刷新，或先使用打印保存为 PDF。", "error");
    return;
  }

  render();
  document.body.classList.add("pdf-rendering");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `pinyin-tianzige-${date}.pdf`;
  els.exportPdfBtn.disabled = true;
  setStatus("正在导出 PDF...", "pending");

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
    setStatus(`已导出 ${fileName}`, "success");
  } catch {
    setStatus("PDF 导出失败，请先用打印保存为 PDF。", "error");
  } finally {
    document.body.classList.remove("pdf-rendering");
    els.exportPdfBtn.disabled = false;
  }
});

async function initializeApp() {
  const startupState = loadState();
  if (startupState.aiPinyinEnabled !== undefined) {
    els.aiPinyinEnabled.checked = Boolean(startupState.aiPinyinEnabled);
  }
  if (startupState.useCompleteDict !== undefined) {
    els.useCompleteDict.checked = Boolean(startupState.useCompleteDict);
  }

  let startupDictError = "";
  if (els.useCompleteDict.checked && shouldUsePinyinPro()) {
    setStatus("正在加载完整拼音词典...", "pending");
    try {
      await loadCompletePinyinDict();
    } catch (error) {
      startupDictError = error.message || "完整拼音词典加载失败，已改用默认词典。";
      els.useCompleteDict.checked = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...startupState,
        useCompleteDict: false,
      }));
    }
  }

  restoreState();
  updateAiDebugVisibility();
  render();
  if (startupDictError) {
    setStatus(startupDictError, "error");
  }
  scheduleAiPinyinRefresh(0);
}

initializeApp();
