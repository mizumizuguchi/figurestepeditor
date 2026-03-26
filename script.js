const STATES = [
  ["LFO", "左足フォアアウト"],
  ["LFI", "左足フォアイン"],
  ["RFO", "右足フォアアウト"],
  ["RFI", "右足フォアイン"],
  ["LBO", "左足バックアウト"],
  ["LBI", "左足バックイン"],
  ["RBO", "右足バックアウト"],
  ["RBI", "右足バックイン"],
];
const BASE_GRID_ROWS = 12;
const BASE_GRID_COLS = 12;
const FIXED_RADIUS = 72;
const GRID_PADDING = 32;
const MIN_CANVAS_WIDTH = 720;
const MIN_CANVAS_HEIGHT = 720;
const STATE_LABELS = Object.fromEntries(STATES);
const EDGE_CODES = STATES.map(([code]) => code);
const TURN_LABELS = {
  Three: "スリーターン",
  Bracket: "ブラケット",
  Loop: "ループ",
  Mohawk: "モホーク",
  ChangeFoot: "チェンジフット",
  ChangeFootSwitch: "円切替チェンジフット",
  ChangeEdge: "チェンジエッジ",
  Rocker: "ロッカー",
  Counter: "カウンター",
  Choctaw: "チョクトー",
  Skating: "スケーティング",
};
const TURN_TOKENS = {
  Three: "THREE",
  Bracket: "BRACKET",
  Loop: "LOOP",
  Mohawk: "MOHAWK",
  ChangeFoot: "CHANGE_FOOT",
  ChangeFootSwitch: "CHANGE_FOOT_SWITCH",
  ChangeEdge: "CHANGE_EDGE",
  Rocker: "ROCKER",
  Counter: "COUNTER",
  Choctaw: "CHOCTAW",
  Skating: "SKATING",
};
const TOKEN_TURNS = Object.fromEntries(
  Object.entries(TURN_TOKENS).map(([turnName, token]) => [token, turnName])
);
const RANDOM_START_STATE = "RANDOM";
const RANDOM_CIRCLE_SIZE = "RANDOM";
const TURN_FEATURE_UNIT = FIXED_RADIUS;
function turnLabelJP(turnName) {
  return TURN_LABELS[turnName] ?? turnName;
}

function turnToken(turnName) {
  return TURN_TOKENS[turnName] ?? turnName.toUpperCase();
}

function stateToCode(state) {
  if (!state) return "-";
  return `${state.foot}${state.fb}${state.edge}`;
}

function stateLabelJPFromState(state) {
  const code = stateToCode(state);
  return STATE_LABELS[code] ?? code;
}

function isEdgeCode(code) {
  return EDGE_CODES.includes(code);
}

let gridRows = BASE_GRID_ROWS;
let gridCols = BASE_GRID_COLS;
const TURN_CANDIDATES = {
  "same-same": ["Three", "Bracket", "Loop", "Mohawk", "ChangeFoot"],
  "switch-switch": ["ChangeEdge", "ChangeFootSwitch", "Rocker", "Counter", "Choctaw"],
  "same-switch": ["ChangeEdge"],
  "switch-same": ["Skating"],
};
/*
  mode 縺ｮ諢丞袖縺ｯ縲悟・繧貞､峨∴繧九°縺ｩ縺・°縲阪↓邨ｱ荳縺吶ｋ
  same   = 蜀・ｒ螟峨∴縺ｪ縺・
  switch = 蜀・ｒ螟峨∴繧・
*/
const SAME_TURNS = ["Three", "Bracket", "Loop", "Mohawk", "ChangeFoot", "Skating"];
const SWITCH_TURNS = ["ChangeEdge", "ChangeFootSwitch", "Rocker", "Counter", "Choctaw"];
const ANIMATION_SPEED = 0.2; // px per ms
const TURN_SLOWDOWN_MULTIPLIER = 2.35;
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasViewportEl = document.getElementById("canvasViewport");
const sequenceEl = document.getElementById("sequence");
const sequenceInputEl = document.getElementById("sequenceInput");
const copySequenceButton = document.getElementById("copySequence");
const shareSequenceButton = document.getElementById("shareSequence");
const clearSequenceInputButton = document.getElementById("clearSequenceInput");
const startStateEl = document.getElementById("startState");
const circleSizeEl = document.getElementById("circleSize");
const manualStartStateEl = document.getElementById("manualStartState");
const countEl = document.getElementById("count");
const sCurveFixedEl = document.getElementById("sCurveFixed");
const countDownButton = document.getElementById("countDown");
const countUpButton = document.getElementById("countUp");
const checkAllTurnsButton = document.getElementById("checkAllTurns");
const clearAllTurnsButton = document.getElementById("clearAllTurns");
const manualTurnListEl = document.getElementById("manualTurnList");
const addManualTurnButton = document.getElementById("addManualTurn");
const tabRandomButton = document.getElementById("tabRandom");
const tabManualButton = document.getElementById("tabManual");
const panelRandomEl = document.getElementById("panelRandom");
const panelManualEl = document.getElementById("panelManual");
const inputPanelBodyEl = document.getElementById("inputPanelBody");
const toggleInputPanelButton = document.getElementById("toggleInputPanel");

const LEFT_FOOT_COLOR = "#2aa8ff";
const RIGHT_FOOT_COLOR = "#22c55e";

let circles = [];
let radius = 0;
let modes = [];
let turns = [];
let stepInfos = [];
let stepStates = [];
let currentStartStateCode = STATES[0][0];

// 蜀咲函蛻ｶ蠕｡
let animationFrameId = null;
let animationToken = 0;
let lastConfirmedData = null;

const ANIMATION_POINT_STEPS = 24;
const SETTINGS_COOKIE_NAME = "stepmaker_settings";
const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const INPUT_MODES = {
  RANDOM: "random",
  MANUAL: "manual",
};
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 3.5;
let activeInputMode = INPUT_MODES.RANDOM;
let canvasZoom = 1;
let pinchState = null;
let currentCircleSize = 1;
const mixedHornTuning = {
  sameToSwitch: {
    clipOffset: 0.30,
    hornDepth: 0.23,
    bend: 0.10,
  },
  switchToSame: {
    clipOffset: 0.30,
    hornDepth: 0.23,
    bend: 0.27,
  },
};

/* =========================
   UI
========================= */
function fillStates() {
  startStateEl.innerHTML = STATES.map(
    ([c, j]) => `<option value="${c}">${c} - ${j}</option>`
  ).join("");
  startStateEl.insertAdjacentHTML(
    "afterbegin",
    `<option value="${RANDOM_START_STATE}">ランダム</option>`
  );

  if (manualStartStateEl) {
    manualStartStateEl.innerHTML = STATES.map(
      ([c, j]) => `<option value="${c}">${c} - ${j}</option>`
    ).join("");
  }
}

function getAllTurnNames() {
  return [...new Set(Object.values(TURN_CANDIDATES).flat())];
}

function getCircleRadiusScale() {
  return 1 + (currentCircleSize - 1) * 0.5;
}

function resolveCircleSize(value) {
  if (value === RANDOM_CIRCLE_SIZE) {
    return pick([1, 2, 3]);
  }
  const size = Number(value);
  return [1, 2, 3].includes(size) ? size : 1;
}

function getCircleSegments() {
  return currentCircleSize * 2 + 2;
}

function getCircleStepAngle() {
  return (Math.PI * 2) / getCircleSegments();
}

function normalizeAngle(angle) {
  let value = angle;
  while (value <= -Math.PI) value += Math.PI * 2;
  while (value > Math.PI) value -= Math.PI * 2;
  return value;
}

function getInitialPlacement(startStateCode) {
  const centerRow = Math.floor(gridRows / 2);
  const centerCol = Math.floor(gridCols / 2);
  const base = {
    LFI: { row: centerRow, col: centerCol, vertex: "L", dir: "cw" },
    RFO: { row: centerRow, col: centerCol, vertex: "L", dir: "cw" },
    LBI: { row: centerRow, col: centerCol, vertex: "L", dir: "ccw" },
    RBO: { row: centerRow, col: centerCol, vertex: "L", dir: "ccw" },
    LFO: { row: centerRow, col: centerCol - 1, vertex: "R", dir: "ccw" },
    RFI: { row: centerRow, col: centerCol - 1, vertex: "R", dir: "ccw" },
    LBO: { row: centerRow, col: centerCol - 1, vertex: "R", dir: "cw" },
    RBI: { row: centerRow, col: centerCol - 1, vertex: "R", dir: "cw" },
  };
  const placement = base[startStateCode] ?? base.LFO;
  return {
    row: placement.row,
    col: placement.col,
    vertex: getVertexAngle(placement.vertex),
    dir: placement.dir,
  };
}

function setCookie(name, value, maxAgeSeconds = SETTINGS_COOKIE_MAX_AGE) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
}

function getCookie(name) {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function setActiveInputMode(mode) {
  activeInputMode = mode === INPUT_MODES.MANUAL ? INPUT_MODES.MANUAL : INPUT_MODES.RANDOM;

  const isRandom = activeInputMode === INPUT_MODES.RANDOM;
  tabRandomButton?.classList.toggle("active", isRandom);
  tabManualButton?.classList.toggle("active", !isRandom);

  if (panelRandomEl) panelRandomEl.hidden = !isRandom;
  if (panelManualEl) panelManualEl.hidden = isRandom;

  if (circleSizeEl) {
    const randomOption = circleSizeEl.querySelector(`option[value="${RANDOM_CIRCLE_SIZE}"]`);
    if (randomOption) {
      randomOption.hidden = !isRandom;
    }
    if (!isRandom && circleSizeEl.value === RANDOM_CIRCLE_SIZE) {
      circleSizeEl.value = "1";
      currentCircleSize = 1;
      syncSequenceInputFromManualBuilder();
    }
  }
}

function setInputPanelCollapsed(collapsed) {
  if (!inputPanelBodyEl || !toggleInputPanelButton) return;

  inputPanelBodyEl.hidden = collapsed;
  toggleInputPanelButton.textContent = collapsed ? "展開" : "折り畳み";
}

function redrawCurrentView() {
  if (animationFrameId !== null) {
    playAnimation();
    return;
  }

  resetCanvas();
  drawSteps();
}

function createManualTurnSelect(turnName = "Three") {
  return `
    <select class="manual-turn-select">
      ${getAllTurnNames()
        .map(name => `<option value="${name}"${name === turnName ? " selected" : ""}>${turnLabelJP(name)}</option>`)
        .join("")}
    </select>
  `;
}

function getManualTurnNames() {
  return [...(manualTurnListEl?.querySelectorAll(".manual-turn-select") ?? [])]
    .map(el => el.value)
    .filter(Boolean);
}

function buildSequenceTextFromParts(startStateCode, turnNames, circleSize = currentCircleSize) {
  if (!startStateCode || !turnNames.length) return "";

  return [
    `${circleSize}|${startStateCode}:${turnToken(turnNames[0])}`,
    ...turnNames.slice(1).map(turnName => turnToken(turnName)),
  ].join("→");
}

function syncSequenceInputFromManualBuilder() {
  if (!sequenceInputEl || !manualStartStateEl) return;

  const startStateCode = manualStartStateEl.value;
  const turnNames = getManualTurnNames();
  sequenceInputEl.value = buildSequenceTextFromParts(startStateCode, turnNames);
}

function renderManualTurnList(turnNames = []) {
  if (!manualTurnListEl) return;

  if (!turnNames.length) {
    manualTurnListEl.innerHTML = `
      <div class="manual-empty">ターンを追加するとここに並びます</div>
    `;
    return;
  }

  manualTurnListEl.innerHTML = turnNames
    .map(
      (turnName, index) => `
        <div class="manual-turn-row" data-manual-index="${index}">
          ${createManualTurnSelect(turnName)}
          <button class="secondary mini-button manual-turn-remove" type="button">削除</button>
        </div>
      `
    )
    .join("");
}

function setManualBuilder(startStateCode, turnNames) {
  if (manualStartStateEl && isEdgeCode(startStateCode)) {
    manualStartStateEl.value = startStateCode;
  }

  renderManualTurnList(turnNames);
  syncSequenceInputFromManualBuilder();
}

function edgeToggleIcon(expanded) {
  return `
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style="display:block; transform:rotate(${expanded ? 180 : 0}deg); transition:transform 160ms ease;"
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function fillTurnCheckboxes() {
  const el = document.getElementById("turnCheckboxes");
  if (!el) return;

  const allTurns = [...new Set(Object.values(TURN_CANDIDATES).flat())];

  el.innerHTML = allTurns
    .map(
      turn => `
        <div
          class="turn-filter-card"
          data-turn="${turn}"
          style="
          border:1px solid #2a365f;
          border-radius:10px;
          background:#202643;
          overflow:hidden;
        ">
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:2px;
            padding:8px 10px;
          ">
            <label style="
              display:flex;
              align-items:center;
              gap:2px;
              min-width:0;
              flex:1;
              cursor:pointer;
              font-size:12px;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
              padding-right:4px;
            ">
              <input
                type="checkbox"
                class="turn-filter"
                data-turn="${turn}"
                checked
                style="width:auto;"
              />
              <span>${turnLabelJP(turn)}</span>
            </label>
            <button
              type="button"
              class="edge-toggle"
              data-turn="${turn}"
              aria-expanded="false"
              aria-label="${turnLabelJP(turn)}のエッジを展開"
              title="${turnLabelJP(turn)}のエッジを展開"
              style="
                width:32px;
                min-width:32px;
                height:32px;
                flex:0 0 32px;
                padding:0;
                display:grid;
                place-items:center;
                border-radius:999px;
                border:1px solid #3c4b78;
                background:#283153;
                color:#eef3ff;
              "
            >${edgeToggleIcon(false)}</button>
          </div>
          <div
            class="edge-filter-panel"
            data-turn-panel="${turn}"
            hidden
            style="
              padding:0 10px 10px 34px;
              border-top:1px solid rgba(255,255,255,0.08);
            "
          >
            <div style="
              display:grid;
              grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
              gap:6px;
              padding-top:10px;
            ">
              ${EDGE_CODES.map(
                code => `
                  <label style="
                    display:flex;
                    align-items:center;
                    gap:2px;
                    padding:6px 8px;
                    border:1px solid #33416a;
                    border-radius:8px;
                    background:#1a213b;
                    cursor:pointer;
                    font-size:12px;
                  ">
                    <input
                      type="checkbox"
                      class="edge-filter"
                      data-turn="${turn}"
                      value="${code}"
                      checked
                      style="width:auto;"
                    />
                    <span>${code} ${STATE_LABELS[code] ?? code}</span>
                  </label>
                `
              ).join("")}
            </div>
          </div>
        </div>
      `
    )
    .join("");

  if (!el.dataset.boundTurnFilters) {
    el.addEventListener("change", handleTurnFilterChange);
    el.addEventListener("click", handleTurnFilterClick);
    el.dataset.boundTurnFilters = "true";
  }

  syncTurnFilterParents();
}

function handleTurnFilterClick(event) {
  const button = event.target.closest(".edge-toggle");
  if (!button) return;

  const turn = button.dataset.turn;
  const panel = document.querySelector(`[data-turn-panel="${turn}"]`);
  if (!panel) return;

  const willExpand = panel.hidden;
  panel.hidden = !willExpand;
  button.setAttribute("aria-expanded", String(willExpand));
  button.setAttribute(
    "aria-label",
    `${turnLabelJP(turn)}のエッジを${willExpand ? "折り畳み" : "展開"}`
  );
  button.setAttribute(
    "title",
    `${turnLabelJP(turn)}のエッジを${willExpand ? "折り畳み" : "展開"}`
  );
  button.innerHTML = edgeToggleIcon(willExpand);
}

function handleTurnFilterChange(event) {
  const target = event.target;

  if (target.classList.contains("turn-filter")) {
    const turn = target.dataset.turn;
    setTurnEdgeCheckboxes(turn, target.checked);
    updateTurnParentCheckbox(turn);
    saveSettingsToCookie();
    return;
  }

  if (target.classList.contains("edge-filter")) {
    updateTurnParentCheckbox(target.dataset.turn);
  }

  saveSettingsToCookie();
}

function getTurnEdgeCheckboxes(turn) {
  return [
    ...document.querySelectorAll(`.edge-filter[data-turn="${turn}"]`)
  ];
}

function setTurnEdgeCheckboxes(turn, checked) {
  for (const input of getTurnEdgeCheckboxes(turn)) {
    input.checked = checked;
  }
}

function updateTurnParentCheckbox(turn) {
  const parent = document.querySelector(`.turn-filter[data-turn="${turn}"]`);
  const children = getTurnEdgeCheckboxes(turn);
  if (!parent || !children.length) return;

  const checkedCount = children.filter(input => input.checked).length;
  parent.checked = checkedCount === children.length;
  parent.indeterminate = checkedCount > 0 && checkedCount < children.length;
}

function syncTurnFilterParents() {
  const allTurns = [...new Set(Object.values(TURN_CANDIDATES).flat())];
  for (const turn of allTurns) {
    updateTurnParentCheckbox(turn);
  }
}

function setAllTurnEdges(checked) {
  for (const code of [...new Set(Object.values(TURN_CANDIDATES).flat())]) {
    setTurnEdgeCheckboxes(code, checked);
  }
  syncTurnFilterParents();
  saveSettingsToCookie();
}

function getEnabledTurnEdgeMap() {
  const map = new Map();
  const allTurns = [...new Set(Object.values(TURN_CANDIDATES).flat())];

  for (const turn of allTurns) {
    const enabledEdges = new Set(
      getTurnEdgeCheckboxes(turn)
        .filter(input => input.checked)
        .map(input => input.value)
    );

    map.set(turn, enabledEdges);
  }

  return map;
}

function collectSettings() {
  return {
    startState: startStateEl?.value ?? RANDOM_START_STATE,
    circleSize: circleSizeEl?.value ?? RANDOM_CIRCLE_SIZE,
    count: countEl?.value ?? "10",
    sCurveFixed: Boolean(sCurveFixedEl?.checked),
    activeInputMode,
    inputPanelCollapsed: inputPanelBodyEl?.hidden ?? false,
    sequenceInput: sequenceInputEl?.value ?? "",
    manualStartState: manualStartStateEl?.value ?? STATES[0][0],
    manualTurns: getManualTurnNames(),
    turnEdges: Object.fromEntries(
      [...getEnabledTurnEdgeMap().entries()].map(([turn, edges]) => [
        turn,
        [...edges],
      ])
    ),
  };
}

function saveSettingsToCookie() {
  try {
    setCookie(SETTINGS_COOKIE_NAME, JSON.stringify(collectSettings()));
  } catch (error) {
    console.warn("settings cookie save failed", error);
  }
}

function applySavedTurnEdges(turnEdges) {
  if (!turnEdges || typeof turnEdges !== "object") return;

  for (const [turn, edgeCodes] of Object.entries(turnEdges)) {
    const allowed = new Set(
      Array.isArray(edgeCodes) ? edgeCodes.filter(code => isEdgeCode(code)) : []
    );

    for (const input of getTurnEdgeCheckboxes(turn)) {
      input.checked = allowed.has(input.value);
    }
  }

  syncTurnFilterParents();
}

function restoreSettingsFromCookie() {
  const raw = getCookie(SETTINGS_COOKIE_NAME);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    if (
      saved.startState &&
      (isEdgeCode(saved.startState) || saved.startState === RANDOM_START_STATE)
    ) {
      startStateEl.value = saved.startState;
    }

    if (saved.count != null) {
      countEl.value = String(saved.count);
    }

    if (typeof saved.sCurveFixed === "boolean" && sCurveFixedEl) {
      sCurveFixedEl.checked = saved.sCurveFixed;
    }

    if (saved.circleSize != null && circleSizeEl) {
      const size = Number(saved.circleSize);
      if ([1, 2, 3].includes(size)) {
        circleSizeEl.value = String(size);
        currentCircleSize = size;
      } else if (saved.circleSize === RANDOM_CIRCLE_SIZE) {
        circleSizeEl.value = RANDOM_CIRCLE_SIZE;
      }
    }

    if (typeof saved.sequenceInput === "string" && sequenceInputEl) {
      sequenceInputEl.value = saved.sequenceInput;
    }

    if (saved.manualStartState && isEdgeCode(saved.manualStartState) && manualStartStateEl) {
      manualStartStateEl.value = saved.manualStartState;
    }

    renderManualTurnList(
      Array.isArray(saved.manualTurns)
        ? saved.manualTurns.filter(turnName => getAllTurnNames().includes(turnName))
        : []
    );

    setActiveInputMode(saved.activeInputMode);
    setInputPanelCollapsed(Boolean(saved.inputPanelCollapsed));

    applySavedTurnEdges(saved.turnEdges);
  } catch (error) {
    console.warn("settings cookie restore failed", error);
  }
}

function getEnabledTurns() {
  const enabledMap = getEnabledTurnEdgeMap();
  return new Set(
    [...enabledMap.entries()]
      .filter(([, edges]) => edges.size > 0)
      .map(([turn]) => turn)
  );
}

function isTurnEnabledForState(turn, skateState, enabledMap = getEnabledTurnEdgeMap()) {
  return enabledMap.get(turn)?.has(stateToCode(skateState)) ?? false;
}

function getCandidateTurnsForModes(a, b, skateState, enabledMap = getEnabledTurnEdgeMap()) {
  let preferred = [];
  let fallback = [];

  if (a === "same" && b === "same") {
    preferred = SAME_TURNS;
  } else if (a === "same" && b === "switch") {
    preferred = ["ChangeEdge"];
    fallback = SWITCH_TURNS;
  } else if (a === "switch" && b === "same") {
    preferred = ["Skating"];
    fallback = SAME_TURNS;
  } else if (a === "switch" && b === "switch") {
    preferred = SWITCH_TURNS;
  }

  const preferredCandidates = preferred.filter(turn =>
    isTurnEnabledForState(turn, skateState, enabledMap)
  );

  if (preferredCandidates.length > 0) {
    return preferredCandidates;
  }

  return fallback.filter(turn =>
    isTurnEnabledForState(turn, skateState, enabledMap)
  );
}

function buildSequenceText() {
  return buildSequenceTextFromParts(stateToCode(stepStates[0]), turns, currentCircleSize);
}

function buildShareUrl(sequenceText) {
  const url = new URL(window.location.href);
  if (sequenceText) {
    url.searchParams.set("sequence", sequenceText);
  } else {
    url.searchParams.delete("sequence");
  }
  return url.toString();
}

async function shareCurrentSequence() {
  const text = buildSequenceText();
  if (!text) return;

  if (sequenceInputEl) {
    sequenceInputEl.value = text;
  }

  const url = buildShareUrl(text);
  if (navigator.share) {
    try {
      await navigator.share({
        title: "ステップお題作成ツール",
        text: "ステップのシークエンスを共有します",
        url,
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  await navigator.clipboard.writeText(url);
}

function parseSequenceText(text) {
  const normalized = (text || "").trim();
  if (!normalized) return null;

  const segments = normalized
    .split(/\s*(?:→|->)\s*/)
    .map(segment => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    throw new Error("シークエンス入力が空です。");
  }

  const firstSegment = segments[0].match(/^([123])\|([LR][FB][OI]):([A-Z_]+)$/i);
  if (!firstSegment) {
    throw new Error(`1個目の形式が不正です: ${segments[0]}`);
  }

  const circleSize = Number(firstSegment[1]);
  const startStateCode = firstSegment[2].toUpperCase();
  if (!isEdgeCode(startStateCode)) {
    throw new Error(`開始エッジが不正です: ${startStateCode}`);
  }

  const turnNames = segments.map((segment, index) => {
    const token = index === 0
      ? firstSegment[3].toUpperCase()
      : (() => {
          if (/^[A-Z_]+$/i.test(segment)) return segment.toUpperCase();
          throw new Error(`${index + 1}個目の形式が不正です: ${segment}`);
        })();

    const turnName = TOKEN_TURNS[token];
    if (!turnName) {
      throw new Error(`${index + 1}個目のターンが不正です: ${token}`);
    }
    return turnName;
  });

  let currentState = parseStateCode(startStateCode);
  for (const turnName of turnNames) {
    currentState = applyTurnState(currentState, turnName);
  }

  return {
    circleSize,
    startStateCode,
    turnNames,
  };
}

function resolveStartStateCode(selectedValue) {
  if (selectedValue === RANDOM_START_STATE) {
    return pick(EDGE_CODES);
  }

  return isEdgeCode(selectedValue) ? selectedValue : STATES[0][0];
}

function getModesFromTurnSequence(turnNames) {
  if (!turnNames.length) return ["same"];

  const getModeFamily = turnName => {
    if (SAME_TURNS.includes(turnName)) return "same";
    if (SWITCH_TURNS.includes(turnName)) return "switch";
    return null;
  };

  const firstMode = getModeFamily(turnNames[0]);
  if (!firstMode) return null;

  const modes = [firstMode];

  for (const turnName of turnNames) {
    const nextMode = getModeFamily(turnName);
    if (!nextMode) return null;
    modes.push(nextMode);
  }

  return modes;
}

/* =========================
   繧ｰ繝ｪ繝・ラ
========================= */
function buildGrid(rows = gridRows, cols = gridCols) {
  gridRows = rows;
  gridCols = cols;
  circles = [];

  radius = FIXED_RADIUS * getCircleRadiusScale();

  const offsetX = GRID_PADDING + radius;
  const offsetY = GRID_PADDING + radius;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      circles.push({
        row: r,
        col: c,
        cx: offsetX + c * 2 * radius,
        cy: offsetY + r * 2 * radius,
      });
    }
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(2, TURN_FEATURE_UNIT * 0.04);
  ctx.shadowBlur = 0;

  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function prepareStrokeStyle(color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(5, TURN_FEATURE_UNIT * 0.085);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = ctx.lineWidth * 1.2;
}

function footColor(foot) {
  return foot === "R" ? RIGHT_FOOT_COLOR : LEFT_FOOT_COLOR;
}

/* =========================
   蟷ｾ菴・
========================= */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getCircle(r, c) {
  return circles.find(x => x.row === r && x.col === c);
}

function nextVertex(v, dir) {
  const angle = getVertexAngle(v);
  return normalizeAngle(angle + (dir === "cw" ? 1 : -1) * getCircleStepAngle());
}

function flipDir(d) {
  return d === "cw" ? "ccw" : "cw";
}

function vertexPos(circle, v) {
  return pointOnCircle(circle, getVertexAngle(v));
}

function pointOnCircle(circle, angle) {
  return {
    x: circle.cx + radius * Math.cos(angle),
    y: circle.cy + radius * Math.sin(angle),
  };
}

function neighbor(r, c, v) {
  const angle = normalizeAngle(getVertexAngle(v));
  const base = {
    U: -Math.PI / 2,
    R: 0,
    D: Math.PI / 2,
    L: Math.PI,
  };
  const epsilon = 0.0001;

  if (Math.abs(normalizeAngle(angle - base.R)) < epsilon && c < gridCols - 1) {
    return { row: r, col: c + 1, enter: base.L };
  }
  if (Math.abs(normalizeAngle(angle - base.L)) < epsilon && c > 0) {
    return { row: r, col: c - 1, enter: base.R };
  }
  if (Math.abs(normalizeAngle(angle - base.U)) < epsilon && r > 0) {
    return { row: r - 1, col: c, enter: base.D };
  }
  if (Math.abs(normalizeAngle(angle - base.D)) < epsilon && r < gridRows - 1) {
    return { row: r + 1, col: c, enter: base.U };
  }
  return null;
}

function getStartGeometry(state) {
  const placement = getInitialPlacement(state);
  return { vertex: placement.vertex, dir: placement.dir };
}

function getVertexAngle(v) {
  if (typeof v === "number") {
    return normalizeAngle(v);
  }
  const base = { U: -Math.PI / 2, R: 0, D: Math.PI / 2, L: Math.PI };
  return base[v] ?? base.U;
}

/* =========================
   迥ｶ諷狗ｮ｡逅・ｼ郁ｶｳ繝ｻ蜑榊ｾ後・繧､繝ｳ繧｢繧ｦ繝茨ｼ・
========================= */
function parseStateCode(code) {
  return {
    foot: code[0],
    fb: code[1],
    edge: code[2],
  };
}

function restoreSequenceFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const sharedSequence = params.get("sequence");
  if (!sharedSequence || !sequenceInputEl) return false;

  try {
    const parsed = parseSequenceText(sharedSequence);
    sequenceInputEl.value = sharedSequence;
    if (circleSizeEl) {
      circleSizeEl.value = String(parsed.circleSize);
    }
    currentCircleSize = parsed.circleSize;
    if (manualStartStateEl) {
      manualStartStateEl.value = parsed.startStateCode;
    }
    setManualBuilder(parsed.startStateCode, parsed.turnNames);
    setActiveInputMode(INPUT_MODES.MANUAL);
    return true;
  } catch (error) {
    console.warn("shared sequence restore failed", error);
    return false;
  }
}

function flipEdgeInCode(code) {
  if (!isEdgeCode(code)) return code;
  return `${code[0]}${code[1]}${flipEdge(code[2])}`;
}

function flipFoot(foot) {
  return foot === "L" ? "R" : "L";
}

function flipFB(fb) {
  return fb === "F" ? "B" : "F";
}

function flipEdge(edge) {
  return edge === "O" ? "I" : "O";
}

function cloneSkateState(s) {
  return { foot: s.foot, fb: s.fb, edge: s.edge };
}

function applyTurnState(prev, turnName) {
  const next = cloneSkateState(prev);

  switch (turnName) {
    case "Three":
      next.edge = flipEdge(next.edge);
      next.fb = flipFB(next.fb);
      break;

    case "Bracket":
    case "Rocker":
    case "Counter":
      next.fb = flipFB(next.fb);
      break;

    case "Mohawk":
      next.foot = flipFoot(next.foot);
      next.fb = flipFB(next.fb);
      break;

    case "Choctaw":
      next.foot = flipFoot(next.foot);
      next.fb = flipFB(next.fb);
      next.edge = flipEdge(next.edge);
      break;

    case "ChangeFoot":
      next.foot = flipFoot(next.foot);
      next.edge = flipEdge(next.edge);
      break;

    case "ChangeFootSwitch":
      next.foot = flipFoot(next.foot);
      break;

    case "ChangeEdge":
      next.edge = flipEdge(next.edge);
      break;

    default:
      break;
  }

  return next;
}

function buildStepStates(startStateCode) {
  stepStates = [];
  if (!stepInfos.length) return;

  stepStates.push(parseStateCode(startStateCode));

  for (let i = 0; i < turns.length; i++) {
    stepStates.push(applyTurnState(stepStates[i], turns[i]));
  }

  while (stepStates.length < stepInfos.length) {
    stepStates.push(cloneSkateState(stepStates[stepStates.length - 1]));
  }
}

/* =========================
   same / switch 逕滓・
========================= */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hasEnabledSameTurn(skateState, enabledMap = getEnabledTurnEdgeMap()) {
  return SAME_TURNS.some(turn => isTurnEnabledForState(turn, skateState, enabledMap));
}

function hasEnabledSwitchTurn(skateState, enabledMap = getEnabledTurnEdgeMap()) {
  return SWITCH_TURNS.some(turn => isTurnEnabledForState(turn, skateState, enabledMap));
}

function getAllowedModesFromState(state, skateState, enabledMap = getEnabledTurnEdgeMap()) {
  const available = [];
  const nb = neighbor(state.row, state.col, state.vertex);

  const canStartSame =
    getCandidateTurnsForModes("same", "same", skateState, enabledMap).length > 0 ||
    getCandidateTurnsForModes("same", "switch", skateState, enabledMap).length > 0;

  const canStartSwitch =
    getCandidateTurnsForModes("switch", "same", skateState, enabledMap).length > 0 ||
    getCandidateTurnsForModes("switch", "switch", skateState, enabledMap).length > 0;

  if (canStartSame) {
    available.push("same");
  }

  if (nb && canStartSwitch) {
    available.push("switch");
  }

  return available;
}

function getAllowedModesAfterMode(state, prevMode, skateState, enabledMap = getEnabledTurnEdgeMap()) {
  const available = [];
  const nb = neighbor(state.row, state.col, state.vertex);

  if (hasEnabledSameTurn(skateState, enabledMap)) {
    available.push("same");
  }

  if (nb && hasEnabledSwitchTurn(skateState, enabledMap)) {
    available.push("switch");
  }

  return available.filter(mode =>
    getCandidateTurnsForModes(prevMode, mode, skateState, enabledMap).length > 0
  );
}

/* =========================
   繧ｿ繝ｼ繝ｳ蛻､螳・
========================= */
function detectTurns(modes) {
  const result = [];
  const enabled = getEnabledTurns();

  for (let i = 0; i < modes.length - 1; i++) {
    const a = modes[i];
    const b = modes[i + 1];
    let candidates = [];

    if (a === "same" && b === "same") {
      candidates = SAME_TURNS.filter(turn => enabled.has(turn));
    } else if (a === "same" && b === "switch") {
      candidates = ["ChangeEdge"].filter(turn => enabled.has(turn));
    } else if (a === "switch" && b === "same") {
      candidates = ["Skating"].filter(turn => enabled.has(turn));
    } else if (a === "switch" && b === "switch") {
      candidates = ["ChangeEdge", "ChangeFootSwitch", "Rocker", "Counter", "Choctaw"]
        .filter(turn => enabled.has(turn));
    }

    result.push(candidates.length ? pick(candidates) : "(隧ｲ蠖薙↑縺・");
  }

  return result;
}

function resolveTurnForModes(prevMode, nextMode, skateState, enabledMap = getEnabledTurnEdgeMap()) {
  if (sCurveFixedEl?.checked) {
    let candidates = [];

    if (prevMode === "same" && nextMode === "same") {
      candidates = SAME_TURNS;
    } else if (prevMode === "same" && nextMode === "switch") {
      candidates = SWITCH_TURNS;
    } else if (prevMode === "switch" && nextMode === "same") {
      candidates = SAME_TURNS;
    } else if (prevMode === "switch" && nextMode === "switch") {
      candidates = SWITCH_TURNS;
    }

    const enabledCandidates = candidates.filter(turn =>
      isTurnEnabledForState(turn, skateState, enabledMap)
    );
    if (enabledCandidates.length > 0) {
      return pick(enabledCandidates);
    }
  }

  const candidates = getCandidateTurnsForModes(
    prevMode,
    nextMode,
    skateState,
    enabledMap
  );

  return candidates.length ? pick(candidates) : null;
}

function buildStepInfosFromTurns(startStateCode, turnNames) {
  const importedModes = getModesFromTurnSequence(turnNames);

  if (!importedModes?.length) {
    throw new Error("シークエンスからモードを復元できませんでした。");
  }

  const geometryStartStateCode =
    importedModes[0] === "switch"
      ? flipEdgeInCode(startStateCode)
      : startStateCode;
  let state = getInitialPlacement(geometryStartStateCode);

  modes = [];
  turns = [];
  stepInfos = [];
  stepStates = [parseStateCode(startStateCode)];

  const buildModeStep = (mode, isLastStep = false) => {
    const circle = getCircle(state.row, state.col);
    if (mode === "same") {
      const nv = nextVertex(state.vertex, state.dir);
      stepInfos.push(createArcStep(circle, state.vertex, nv, state.dir));
      modes.push("same");
      state.vertex = nv;
      return;
    }

    const nb = neighbor(state.row, state.col, state.vertex);
    if (!nb) {
      throw new Error("シークエンスを配置できませんでした。");
    }

    const nc = getCircle(nb.row, nb.col);
    const nd = flipDir(state.dir);
    const nv = nextVertex(nb.enter, nd);
    stepInfos.push(
      createSwitchStep(circle, state.vertex, nc, nb.enter, nv, nd, 0.18, isLastStep ? 0 : 0.18)
    );
    modes.push("switch");
    state.row = nb.row;
    state.col = nb.col;
    state.vertex = nv;
    state.dir = nd;
  };

  buildModeStep(importedModes[0], importedModes.length === 1);

  for (let i = 0; i < turnNames.length; i++) {
    const turnName = turnNames[i];
    const targetMode = importedModes[i + 1];

    while (targetMode === "switch" && !neighbor(state.row, state.col, state.vertex)) {
      turns.push("Skating");
      stepStates.push(applyTurnState(stepStates[stepStates.length - 1], "Skating"));
      buildModeStep("same", false);
    }

    turns.push(turnName);
    stepStates.push(applyTurnState(stepStates[stepStates.length - 1], turnName));
    buildModeStep(targetMode, i === turnNames.length - 1);
  }
}
/* =========================
   繧ｹ繝・ャ繝玲ュ蝣ｱ
========================= */
function createArcStep(circle, fromVertex, toVertex, dir) {
  let a0 = getVertexAngle(fromVertex);
  let a1 = getVertexAngle(toVertex);

  if (dir === "cw") {
    while (a1 < a0) a1 += Math.PI * 2;
  } else {
    while (a1 > a0) a1 -= Math.PI * 2;
  }

  const startAngle = a0;
  const endAngle = a1;

  return {
    mode: "same",
    row: circle.row,
    col: circle.col,
    circle,
    fromVertex,
    toVertex,
    dir,
    startAngle,
    endAngle,
    startPoint: pointOnCircle(circle, startAngle),
    endPoint: pointOnCircle(circle, endAngle),
  };
}

function createSwitchStep(
  fromCircle,
  fromVertex,
  toCircle,
  enterVertex,
  exitVertex,
  dir,
  startTrim = 0.18,
  endTrim = 0.18
) {
  const p0 = vertexPos(fromCircle, fromVertex);
  const p1 = vertexPos(toCircle, enterVertex);

  const bridgeStart = {
    x: lerp(p0.x, p1.x, startTrim),
    y: lerp(p0.y, p1.y, startTrim),
  };

  let a0 = getVertexAngle(enterVertex);
  let a1 = getVertexAngle(exitVertex);

  if (dir === "cw") {
    while (a1 < a0) a1 += Math.PI * 2;
  } else {
    while (a1 > a0) a1 -= Math.PI * 2;
  }

  const arcStartAngle = lerp(a0, a1, startTrim);
  const arcEndAngle = lerp(a0, a1, 1 - endTrim);

  const arcStartPoint = pointOnCircle(toCircle, arcStartAngle);
  const arcEndPoint = pointOnCircle(toCircle, arcEndAngle);

  return {
    mode: "switch",
    fromRow: fromCircle.row,
    fromCol: fromCircle.col,
    toRow: toCircle.row,
    toCol: toCircle.col,
    fromCircle,
    toCircle,
    fromVertex,
    enterVertex,
    exitVertex,
    dir,
    startTrim,
    endTrim,
    bridgeStart,
    bridgeEnd: arcStartPoint,
    arcStartAngle,
    arcEndAngle,
    arcStartPoint,
    arcEndPoint,
  };
}

function getUsedGridBounds() {
  if (!stepInfos.length) {
    return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
  }

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const step of stepInfos) {
    if (step.mode === "same") {
      minRow = Math.min(minRow, step.row);
      maxRow = Math.max(maxRow, step.row);
      minCol = Math.min(minCol, step.col);
      maxCol = Math.max(maxCol, step.col);
    } else {
      minRow = Math.min(minRow, step.fromRow, step.toRow);
      maxRow = Math.max(maxRow, step.fromRow, step.toRow);
      minCol = Math.min(minCol, step.fromCol, step.toCol);
      maxCol = Math.max(maxCol, step.fromCol, step.toCol);
    }
  }

  return { minRow, maxRow, minCol, maxCol };
}

function relayoutStepInfos(minRow, minCol) {
  stepInfos = stepInfos.map(step => {
    if (step.mode === "same") {
      const circle = getCircle(step.row - minRow, step.col - minCol);
      return createArcStep(circle, step.fromVertex, step.toVertex, step.dir);
    }

    const fromCircle = getCircle(step.fromRow - minRow, step.fromCol - minCol);
    const toCircle = getCircle(step.toRow - minRow, step.toCol - minCol);

    return createSwitchStep(
      fromCircle,
      step.fromVertex,
      toCircle,
      step.enterVertex,
      step.exitVertex,
      step.dir,
      step.startTrim,
      step.endTrim
    );
  });
}

function fitGridToContent() {
  if (!stepInfos.length) return;

  const { minRow, maxRow, minCol, maxCol } = getUsedGridBounds();
  const visibleRows = maxRow - minRow + 1;
  const visibleCols = maxCol - minCol + 1;

  canvas.width = visibleCols * radius * 2 + GRID_PADDING * 2;
  canvas.height = visibleRows * radius * 2 + GRID_PADDING * 2;

  buildGrid(visibleRows, visibleCols);
  relayoutStepInfos(minRow, minCol);
  expandCanvasForStartLabel();
  applyCanvasZoom();
}

function getStartLabelText() {
  return `(${currentStartStateCode}) ${STATE_LABELS[currentStartStateCode] ?? currentStartStateCode}`;
}

function expandCanvasForStartLabel() {
  const segments = buildRenderSegments();
  const point = segments[0]?.points?.[0];
  if (!point) return;

  const offsetX = TURN_FEATURE_UNIT * 0.28;
  const padding = TURN_FEATURE_UNIT * 0.18;
  const fontSize = Math.max(14, TURN_FEATURE_UNIT * 0.2);

  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  const metrics = ctx.measureText(getStartLabelText());
  ctx.restore();

  const textWidth = metrics.width;
  const rightEdge = point.x + offsetX + textWidth + padding;

  if (rightEdge > canvas.width) {
    canvas.width = Math.ceil(rightEdge);
  }
}

function ensureScrollableCanvas() {
  const wrap = canvasViewportEl ?? canvas.parentElement;
  if (!wrap) return;

  wrap.style.overflow = "auto";
  wrap.style.maxWidth = "100%";
  wrap.style.maxHeight = "75vh";
}

function clampCanvasZoom(value) {
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
}

function applyCanvasZoom() {
  canvas.style.width = `${Math.round(canvas.width * canvasZoom)}px`;
  canvas.style.height = `${Math.round(canvas.height * canvasZoom)}px`;
}

function setCanvasZoom(nextZoom, anchorClientX, anchorClientY) {
  const viewport = canvasViewportEl;
  const clampedZoom = clampCanvasZoom(nextZoom);
  if (!viewport || !Number.isFinite(clampedZoom)) {
    canvasZoom = clampedZoom;
    applyCanvasZoom();
    return;
  }

  const previousZoom = canvasZoom;
  if (Math.abs(clampedZoom - previousZoom) < 0.001) {
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const offsetX =
    typeof anchorClientX === "number"
      ? anchorClientX - viewportRect.left
      : viewport.clientWidth / 2;
  const offsetY =
    typeof anchorClientY === "number"
      ? anchorClientY - viewportRect.top
      : viewport.clientHeight / 2;
  const contentX = (viewport.scrollLeft + offsetX) / previousZoom;
  const contentY = (viewport.scrollTop + offsetY) / previousZoom;

  canvasZoom = clampedZoom;
  applyCanvasZoom();

  viewport.scrollLeft = contentX * canvasZoom - offsetX;
  viewport.scrollTop = contentY * canvasZoom - offsetY;
}

function getTouchDistance(touchA, touchB) {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

function getTouchMidpoint(touchA, touchB) {
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2,
  };
}

function beginPinchZoom(touches) {
  if (touches.length !== 2) return;

  const [touchA, touchB] = touches;
  pinchState = {
    startDistance: getTouchDistance(touchA, touchB),
    startZoom: canvasZoom,
  };
}

function endPinchZoom() {
  pinchState = null;
}

function setupCanvasViewportInteractions() {
  if (!canvasViewportEl) return;

  canvasViewportEl.addEventListener(
    "touchstart",
    event => {
      if (event.touches.length === 2) {
        beginPinchZoom(event.touches);
      }
    },
    { passive: true }
  );

  canvasViewportEl.addEventListener(
    "touchmove",
    event => {
      if (event.touches.length !== 2 || !pinchState) return;

      const [touchA, touchB] = event.touches;
      const distance = getTouchDistance(touchA, touchB);
      if (!distance || !pinchState.startDistance) return;

      const midpoint = getTouchMidpoint(touchA, touchB);
      const nextZoom = pinchState.startZoom * (distance / pinchState.startDistance);
      setCanvasZoom(nextZoom, midpoint.x, midpoint.y);
      event.preventDefault();
    },
    { passive: false }
  );

  canvasViewportEl.addEventListener("touchend", event => {
    if (event.touches.length < 2) {
      endPinchZoom();
    } else if (event.touches.length === 2) {
      beginPinchZoom(event.touches);
    }
  });

  canvasViewportEl.addEventListener("touchcancel", () => {
    endPinchZoom();
  });
}

function buildStepInfos(stepCount, startStateCode) {
  const enabledMap = getEnabledTurnEdgeMap();
  let state = getInitialPlacement(startStateCode);
  let skateState = parseStateCode(startStateCode);
  let sameStreak = 0;

  modes = [];
  stepInfos = [];
  turns = [];
  stepStates = [cloneSkateState(skateState)];

  for (let i = 0; i < stepCount; i++) {
    let candidateModes;
    if (i === 0) {
      candidateModes = getAllowedModesFromState(state, skateState, enabledMap);
    } else {
      candidateModes = getAllowedModesAfterMode(
        state,
        modes[modes.length - 1],
        skateState,
        enabledMap
      );
    }

    if (candidateModes.length === 0) {
      break;
    }

    let mode = pick(candidateModes);
    if (sCurveFixedEl?.checked) {
      const targetSameCount = currentCircleSize;
      if (sameStreak >= targetSameCount && candidateModes.includes("switch")) {
        mode = "switch";
      } else if (sameStreak < targetSameCount && candidateModes.includes("same")) {
        mode = "same";
      } else if (candidateModes.includes("switch")) {
        mode = "switch";
      } else if (candidateModes.includes("same")) {
        mode = "same";
      }
    }

    if (i === 0 && mode === "switch") {
      state = getInitialPlacement(flipEdgeInCode(startStateCode));
    }

    const circle = getCircle(state.row, state.col);

    if (i > 0) {
      const turn = resolveTurnForModes(
        modes[modes.length - 1],
        mode,
        skateState,
        enabledMap
      );

      if (!turn) {
        break;
      }

      turns.push(turn);
      skateState = applyTurnState(skateState, turn);
      stepStates.push(cloneSkateState(skateState));
    }

    if (mode === "same") {
      const nv = nextVertex(state.vertex, state.dir);
      stepInfos.push(createArcStep(circle, state.vertex, nv, state.dir));
      modes.push("same");
      state.vertex = nv;
      sameStreak++;
      continue;
    }

    const nb = neighbor(state.row, state.col, state.vertex);

    if (!nb) {
      break;
    }

    const nc = getCircle(nb.row, nb.col);
    const nd = flipDir(state.dir);
    const nv = nextVertex(nb.enter, nd);

    const startTrim = 0.18;
    const endTrim = i === stepCount - 1 ? 0 : 0.18;

    stepInfos.push(
      createSwitchStep(circle, state.vertex, nc, nb.enter, nv, nd, startTrim, endTrim)
    );
    modes.push("switch");

    state.row = nb.row;
    state.col = nb.col;
    state.vertex = nv;
    state.dir = nd;
    sameStreak = 0;
  }
}

/* =========================
   繝代せ驛ｨ蜩・/ 繝昴Μ繝ｩ繧､繝ｳ
========================= */
function pathArcTo(ctx, circle, startAngle, endAngle, dir) {
  ctx.arc(circle.cx, circle.cy, radius, startAngle, endAngle, dir === "ccw");
}

function pathBridgeTo(ctx, step) {
  ctx.bezierCurveTo(
    lerp(step.bridgeStart.x, step.bridgeEnd.x, 0.3), step.bridgeStart.y,
    lerp(step.bridgeStart.x, step.bridgeEnd.x, 0.7), step.bridgeEnd.y,
    step.bridgeEnd.x, step.bridgeEnd.y
  );
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function tangentUnit(dir, angle) {
  const sign = dir === "cw" ? 1 : -1;
  return {
    x: -Math.sin(angle) * sign,
    y: Math.cos(angle) * sign,
  };
}

function quadraticPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function sampleLinePoints(p0, p1, steps = ANIMATION_POINT_STEPS) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: lerp(p0.x, p1.x, t),
      y: lerp(p0.y, p1.y, t),
    });
  }
  return pts;
}

function sampleArcPoints(circle, startAngle, endAngle, dir, steps = ANIMATION_POINT_STEPS) {
  const pts = [];
  let a0 = startAngle;
  let a1 = endAngle;

  if (dir === "cw") {
    while (a1 < a0) a1 += Math.PI * 2;
  } else {
    while (a1 > a0) a1 -= Math.PI * 2;
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = lerp(a0, a1, t);
    pts.push(pointOnCircle(circle, a));
  }
  return pts;
}

function sampleBridgePoints(step, steps = ANIMATION_POINT_STEPS) {
  const p0 = step.bridgeStart;
  const p3 = step.bridgeEnd;
  const p1 = {
    x: lerp(step.bridgeStart.x, step.bridgeEnd.x, 0.3),
    y: step.bridgeStart.y,
  };
  const p2 = {
    x: lerp(step.bridgeStart.x, step.bridgeEnd.x, 0.7),
    y: step.bridgeEnd.y,
  };

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(cubicPoint(p0, p1, p2, p3, t));
  }
  return pts;
}

function sampleQuadraticCurvePoints(p0, p1, p2, steps = ANIMATION_POINT_STEPS) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(quadraticPoint(p0, p1, p2, t));
  }
  return pts;
}

function sampleLoopCirclePoints(center, loopRadius, startAngle, dir, steps = ANIMATION_POINT_STEPS * 2) {
  const pts = [];
  const sign = dir === "cw" ? 1 : -1;

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + sign * ((Math.PI * 2 * i) / steps);
    pts.push({
      x: center.x + loopRadius * Math.cos(angle),
      y: center.y + loopRadius * Math.sin(angle),
    });
  }

  return pts;
}

function getPolylineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return len;
}

function buildCumulativeLengths(points) {
  if (!points?.length) return [0];

  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  }
  return cumulative;
}

function drawPolylinePartial(points, progress, foot) {
  if (!points || points.length < 2) return;
  const cumulative = buildCumulativeLengths(points);
  const totalLength = cumulative[cumulative.length - 1] || 0;
  const targetLength = totalLength * Math.max(0, Math.min(1, progress));

  prepareStrokeStyle(footColor(foot));
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  let segmentIndex = 1;
  while (
    segmentIndex < points.length &&
    cumulative[segmentIndex] <= targetLength
  ) {
    ctx.lineTo(points[segmentIndex].x, points[segmentIndex].y);
    segmentIndex++;
  }

  if (segmentIndex < points.length && targetLength > 0) {
    const prev = points[segmentIndex - 1];
    const next = points[segmentIndex];
    const segmentStart = cumulative[segmentIndex - 1];
    const segmentLength = cumulative[segmentIndex] - segmentStart;
    const localT = segmentLength
      ? (targetLength - segmentStart) / segmentLength
      : 0;

    ctx.lineTo(
      lerp(prev.x, next.x, localT),
      lerp(prev.y, next.y, localT)
    );
  } else if (progress >= 1) {
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  } else if (targetLength <= 0) {
    ctx.lineTo(points[0].x, points[0].y);
  }

  ctx.stroke();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildConstantStateSamples(points, state) {
  return (points || []).map(() => cloneSkateState(state));
}

function buildTransitionStateSamples(points, startState, endState, pivot = 0.5) {
  if (!points || !points.length) return [];

  const splitIndex = Math.max(
    0,
    Math.min(points.length - 1, Math.round((points.length - 1) * pivot))
  );

  return points.map((_, i) =>
    cloneSkateState(i < splitIndex ? startState : endState)
  );
}

function getInterpolatedPoint(points, progress) {
  if (!points?.length) {
    return { x: 0, y: 0, scaledIndex: 0 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, scaledIndex: 0 };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const cumulative = buildCumulativeLengths(points);
  const totalLength = cumulative[cumulative.length - 1] || 0;
  const targetLength = totalLength * clamped;

  let segmentIndex = 1;
  while (
    segmentIndex < points.length &&
    cumulative[segmentIndex] < targetLength
  ) {
    segmentIndex++;
  }

  const prevIndex = Math.max(0, segmentIndex - 1);
  const nextIndex = Math.min(points.length - 1, segmentIndex);
  const prev = points[prevIndex];
  const next = points[nextIndex];
  const segmentStart = cumulative[prevIndex];
  const segmentLength = cumulative[nextIndex] - segmentStart;
  const localT = segmentLength
    ? (targetLength - segmentStart) / segmentLength
    : 0;

  return {
    x: lerp(prev.x, next.x, localT),
    y: lerp(prev.y, next.y, localT),
    scaledIndex: prevIndex + localT,
  };
}

function getTangentAngle(points, progress) {
  if (!points?.length || points.length === 1) return 0;

  const clamped = Math.max(0, Math.min(1, progress));
  const cumulative = buildCumulativeLengths(points);
  const totalLength = cumulative[cumulative.length - 1] || 0;
  const targetLength = totalLength * clamped;

  let segmentIndex = 1;
  while (
    segmentIndex < points.length &&
    cumulative[segmentIndex] < targetLength
  ) {
    segmentIndex++;
  }

  const prev = points[Math.max(0, segmentIndex - 1)];
  const next = points[Math.min(points.length - 1, segmentIndex)];

  return Math.atan2(next.y - prev.y, next.x - prev.x);
}

function getSegmentStateAtProgress(segment, progress) {
  if (!segment.stateSamples?.length) {
    return { foot: segment.foot || "L", fb: "F", edge: "O" };
  }

  const maxIndex = Math.max(0, segment.stateSamples.length - 1);
  const index = Math.max(
    0,
    Math.min(maxIndex, Math.round(progress * maxIndex))
  );

  return segment.stateSamples[index];
}

function getMarkerPose(segment, progress) {
  const point = getInterpolatedPoint(segment.points, progress);
  const travelAngle = getTangentAngle(segment.points, progress);
  const state = getSegmentStateAtProgress(segment, progress);
  const headingAngle = state.fb === "B" ? travelAngle + Math.PI : travelAngle;

  return {
    x: point.x,
    y: point.y,
    headingAngle,
    state,
  };
}

function drawFootMarker(pose) {
  const length = TURN_FEATURE_UNIT * 0.34;
  const width = TURN_FEATURE_UNIT * 0.22;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.headingAngle);

  const color = footColor(pose.state.foot);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(1.5, TURN_FEATURE_UNIT * 0.03);
  ctx.shadowColor = color;
  ctx.shadowBlur = TURN_FEATURE_UNIT * 0.16;

  ctx.beginPath();
  ctx.moveTo(length * 0.68, 0);
  ctx.lineTo(-length * 0.34, -width * 0.56);
  ctx.lineTo(-length * 0.08, 0);
  ctx.lineTo(-length * 0.34, width * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-length * 0.02, 0);
  ctx.lineTo(length * 0.34, 0);
  ctx.stroke();

  ctx.restore();
}

function drawStartStar(point) {
  if (!point) return;

  const outerRadius = TURN_FEATURE_UNIT * 0.18;
  const innerRadius = outerRadius * 0.48;

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = "#ffd84d";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = Math.max(1.5, TURN_FEATURE_UNIT * 0.025);
  ctx.shadowColor = "#ffd84d";
  ctx.shadowBlur = TURN_FEATURE_UNIT * 0.18;

  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStartStateLabel(point) {
  if (!point) return;

  const label = getStartLabelText();

  ctx.save();
  ctx.font = `${Math.max(14, TURN_FEATURE_UNIT * 0.2)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eef3ff";
  ctx.strokeStyle = "rgba(11,16,32,0.92)";
  ctx.lineWidth = Math.max(3, TURN_FEATURE_UNIT * 0.05);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = TURN_FEATURE_UNIT * 0.08;
  ctx.strokeText(label, point.x + TURN_FEATURE_UNIT * 0.28, point.y);
  ctx.fillText(label, point.x + TURN_FEATURE_UNIT * 0.28, point.y);
  ctx.restore();
}

function getTurnAnnotationText(turn) {
  if (turn === "Mohawk") return "M";
  if (turn === "Choctaw") return "C";
  return "";
}

function getTurnAnnotationPoint(turnIndex, segments) {
  const labeledSegment = segments.find(segment =>
    segment.turnIndex === turnIndex &&
    segment.turn &&
    segment.points?.length
  );
  if (labeledSegment) {
    return getInterpolatedPoint(labeledSegment.points, 0.5);
  }

  const currentStep = stepInfos[turnIndex];
  const nextStep = stepInfos[turnIndex + 1];
  if (!currentStep || !nextStep) return null;

  if (nextStep.mode === "same") {
    return nextStep.startPoint;
  }

  if (currentStep.mode === "switch") {
    return currentStep.arcEndPoint;
  }

  return currentStep.endPoint;
}

function drawTurnAnnotations(segments) {
  if (!segments?.length || !turns?.length) return;

  for (let i = 0; i < turns.length; i++) {
    const label = getTurnAnnotationText(turns[i]);
    if (!label) continue;

    const point = getTurnAnnotationPoint(i, segments);
    if (!point) continue;

    ctx.save();
    ctx.font = `700 ${Math.max(14, TURN_FEATURE_UNIT * 0.22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd84d";
    ctx.strokeStyle = "rgba(11,16,32,0.92)";
    ctx.lineWidth = Math.max(3, TURN_FEATURE_UNIT * 0.05);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = TURN_FEATURE_UNIT * 0.08;
    ctx.strokeText(label, point.x, point.y);
    ctx.fillText(label, point.x, point.y);
    ctx.restore();
  }
}

function getTurnPopupLabel(turnIndex) {
  const turn = turns[turnIndex];
  if (!turn || turn === "Skating") return "";

  const state = stepStates[turnIndex] || parseStateCode(currentStartStateCode);
  return `(${stateToCode(state)}) ${turnLabelJP(turn)}`;
}

function hasDedicatedTurnSegment(turnIndex, segments) {
  return segments.some(segment =>
    segment.turnIndex === turnIndex &&
    segment.type !== "step" &&
    segment.points?.length
  );
}

function getPopupTurnIndex(segment, segments) {
  if (!segment) return -1;

  if (segment.type !== "step") {
    return segment.turnIndex ?? -1;
  }

  const stepIndex = segment.stepIndex ?? -1;
  if (stepIndex <= 0) return -1;

  const previousTurnIndex = stepIndex - 1;
  if (hasDedicatedTurnSegment(previousTurnIndex, segments)) {
    return -1;
  }

  return previousTurnIndex;
}

function drawTurnPopup(segment, progress, segments) {
  if (
    !segment?.points?.length ||
    progress >= 0.5
  ) {
    return;
  }

  const popupTurnIndex = getPopupTurnIndex(segment, segments);
  const label = getTurnPopupLabel(popupTurnIndex);
  if (!label) return;

  const point = getInterpolatedPoint(segment.points, 0.5);
  const popupProgress = segment.type === "step"
    ? Math.min(1, progress / 0.5)
    : progress / 0.5;
  const normalized = Math.max(0, Math.min(1, popupProgress));
  const alpha = normalized < 0.2
    ? normalized / 0.2
    : Math.max(0, 1 - (normalized - 0.2) / 0.8);

  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${Math.max(15, TURN_FEATURE_UNIT * 0.22)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(11,16,32,0.9)";
  ctx.lineWidth = Math.max(3, TURN_FEATURE_UNIT * 0.045);
  ctx.shadowColor = "rgba(255,255,255,0.18)";
  ctx.shadowBlur = TURN_FEATURE_UNIT * 0.12;
  ctx.strokeText(label, point.x, point.y - TURN_FEATURE_UNIT * 0.18);
  ctx.fillText(label, point.x, point.y - TURN_FEATURE_UNIT * 0.18);
  ctx.restore();
}

/* =========================
   迚ｹ谿翫ち繝ｼ繝ｳ・医ヤ繝趣ｼ・
========================= */
function getSwitchHornGeometry(step, nextStep, outward = false) {
  const circle = step.toCircle;
  const joint = vertexPos(circle, step.exitVertex);
  const inward = normalize(circle.cx - joint.x, circle.cy - joint.y);

  const normal = outward
    ? { x: -inward.x, y: -inward.y }
    : inward;

  const hornDepth = TURN_FEATURE_UNIT * 0.22;
  const enterOffset = TURN_FEATURE_UNIT * 0.40;

  const centerAngle = getVertexAngle(step.exitVertex);

  const enterAngle =
    step.dir === "cw"
      ? centerAngle - enterOffset / radius
      : centerAngle + enterOffset / radius;

  const enterPoint = pointOnCircle(circle, enterAngle);
  const exitPoint = nextStep.bridgeStart;

  const tip = {
    x: joint.x + normal.x * hornDepth,
    y: joint.y + normal.y * hornDepth,
  };

  return {
    tip,
    enterPoint,
    exitPoint,
    enterAngle,
  };
}

function getHornGeometry(step, nextStep, outward = false) {
  const px = step.endPoint.x;
  const py = step.endPoint.y;

  const inward = normalize(step.circle.cx - px, step.circle.cy - py);
  const normal = outward
    ? { x: -inward.x, y: -inward.y }
    : inward;

  const hornDepth = TURN_FEATURE_UNIT * 0.22;
  const enterOffset = TURN_FEATURE_UNIT * 0.30;
  const exitOffset = TURN_FEATURE_UNIT * 0.30;

  const centerAngle = Math.atan2(py - step.circle.cy, px - step.circle.cx);

  let enterAngle, exitAngle;

  if (step.dir === "cw") {
    enterAngle = centerAngle - enterOffset / radius;
    exitAngle = centerAngle + exitOffset / radius;
  } else {
    enterAngle = centerAngle + enterOffset / radius;
    exitAngle = centerAngle - exitOffset / radius;
  }

  const enterPoint = pointOnCircle(step.circle, enterAngle);
  const exitPoint = pointOnCircle(step.circle, exitAngle);

  const tip = {
    x: px + normal.x * hornDepth,
    y: py + normal.y * hornDepth,
  };

  return {
    tip,
    enterPoint,
    exitPoint,
    enterAngle,
    exitAngle,
  };
}

function getThreeHornCurvePoints(step, nextStep, turnName, steps = ANIMATION_POINT_STEPS) {
  const horn = getHornGeometry(step, nextStep, turnName === "Bracket");
  const enterTan = tangentUnit(step.dir, horn.enterAngle);
  const exitTan = tangentUnit(nextStep.dir, horn.exitAngle);

  const enterBend = TURN_FEATURE_UNIT * 0.24;
  const exitBend = TURN_FEATURE_UNIT * 0.24;

  const c1 = {
    x: horn.enterPoint.x + enterTan.x * enterBend,
    y: horn.enterPoint.y + enterTan.y * enterBend,
  };

  const c2 = {
    x: horn.exitPoint.x - exitTan.x * exitBend,
    y: horn.exitPoint.y - exitTan.y * exitBend,
  };

  const pts = [];
  const half = Math.floor(steps / 2);

  for (let i = 0; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(horn.enterPoint, c1, horn.tip, t));
  }
  for (let i = 1; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(horn.tip, c2, horn.exitPoint, t));
  }

  return { horn, points: pts };
}

function getLoopGeometry(step) {
  const joint = step.endPoint;
  const inward = normalize(step.circle.cx - joint.x, step.circle.cy - joint.y);
  const tangent = tangentUnit(step.dir, step.endAngle);
  const centerAngle = Math.atan2(joint.y - step.circle.cy, joint.x - step.circle.cx);
  const clipOffset = TURN_FEATURE_UNIT * 0.22;
  const loopRadius = TURN_FEATURE_UNIT * 0.22;

  let enterAngle;
  let exitAngle;

  if (step.dir === "cw") {
    enterAngle = centerAngle - clipOffset / radius;
    exitAngle = centerAngle + clipOffset / radius;
  } else {
    enterAngle = centerAngle + clipOffset / radius;
    exitAngle = centerAngle - clipOffset / radius;
  }

  const enterPoint = pointOnCircle(step.circle, enterAngle);
  const exitPoint = pointOnCircle(step.circle, exitAngle);
  const loopCenter = {
    x: joint.x + inward.x * loopRadius * 1.08 + tangent.x * loopRadius * 0.16,
    y: joint.y + inward.y * loopRadius * 1.08 + tangent.y * loopRadius * 0.16,
  };
  const loopStartAngle = Math.atan2(
    joint.y - loopCenter.y,
    joint.x - loopCenter.x
  );

  return {
    joint,
    enterAngle,
    exitAngle,
    enterPoint,
    exitPoint,
    loopCenter,
    loopRadius,
    loopStartAngle,
  };
}

function getLoopCurvePoints(step, steps = ANIMATION_POINT_STEPS) {
  const loop = getLoopGeometry(step);
  const enterMid = {
    x: lerp(loop.enterPoint.x, loop.joint.x, 0.5),
    y: lerp(loop.enterPoint.y, loop.joint.y, 0.5),
  };
  const exitMid = {
    x: lerp(loop.joint.x, loop.exitPoint.x, 0.5),
    y: lerp(loop.joint.y, loop.exitPoint.y, 0.5),
  };

  const bridgeIn = sampleQuadraticCurvePoints(loop.enterPoint, enterMid, loop.joint, steps);
  const loopCircle = sampleLoopCirclePoints(
    loop.loopCenter,
    loop.loopRadius,
    loop.loopStartAngle,
    step.dir,
    steps * 2
  );
  const bridgeOut = sampleQuadraticCurvePoints(loop.joint, exitMid, loop.exitPoint, steps);

  return {
    loop,
    points: [
      ...bridgeIn,
      ...loopCircle.slice(1),
      ...bridgeOut.slice(1),
    ],
  };
}

function getLoopStartGeometry(step) {
  const joint = step.startPoint;
  const inward = normalize(step.circle.cx - joint.x, step.circle.cy - joint.y);
  const tangent = tangentUnit(step.dir, step.startAngle);
  const centerAngle = Math.atan2(joint.y - step.circle.cy, joint.x - step.circle.cx);
  const clipOffset = TURN_FEATURE_UNIT * mixedHornTuning.switchToSame.clipOffset;
  const loopRadius = TURN_FEATURE_UNIT * 0.22;

  let enterAngle;
  let exitAngle;

  if (step.dir === "cw") {
    enterAngle = centerAngle - clipOffset / radius;
    exitAngle = centerAngle + clipOffset / radius;
  } else {
    enterAngle = centerAngle + clipOffset / radius;
    exitAngle = centerAngle - clipOffset / radius;
  }

  const enterPoint = pointOnCircle(step.circle, enterAngle);
  const exitPoint = pointOnCircle(step.circle, exitAngle);
  const loopCenter = {
    x: joint.x + inward.x * loopRadius * 1.08 - tangent.x * loopRadius * 0.16,
    y: joint.y + inward.y * loopRadius * 1.08 - tangent.y * loopRadius * 0.16,
  };
  const loopStartAngle = Math.atan2(
    joint.y - loopCenter.y,
    joint.x - loopCenter.x
  );

  return {
    joint,
    enterAngle,
    exitAngle,
    enterPoint,
    exitPoint,
    loopCenter,
    loopRadius,
    loopStartAngle,
  };
}

function getLoopStartCurvePoints(step, steps = ANIMATION_POINT_STEPS) {
  const loop = getLoopStartGeometry(step);
  const enterMid = {
    x: lerp(loop.enterPoint.x, loop.joint.x, 0.5),
    y: lerp(loop.enterPoint.y, loop.joint.y, 0.5),
  };
  const exitMid = {
    x: lerp(loop.joint.x, loop.exitPoint.x, 0.5),
    y: lerp(loop.joint.y, loop.exitPoint.y, 0.5),
  };

  const bridgeIn = sampleQuadraticCurvePoints(loop.enterPoint, enterMid, loop.joint, steps);
  const loopCircle = sampleLoopCirclePoints(
    loop.loopCenter,
    loop.loopRadius,
    loop.loopStartAngle,
    step.dir,
    steps * 2
  );
  const bridgeOut = sampleQuadraticCurvePoints(loop.joint, exitMid, loop.exitPoint, steps);

  return {
    loop,
    points: [
      ...bridgeIn,
      ...loopCircle.slice(1),
      ...bridgeOut.slice(1),
    ],
  };
}

function getSwitchHornCurvePoints(step, nextStep, turnName, steps = ANIMATION_POINT_STEPS) {
  const horn = getSwitchHornGeometry(step, nextStep, turnName === "Counter");
  const enterTan = tangentUnit(step.dir, horn.enterAngle);
  const exitDir = normalize(
    nextStep.bridgeEnd.x - nextStep.bridgeStart.x,
    nextStep.bridgeEnd.y - nextStep.bridgeStart.y
  );

  const enterBend = TURN_FEATURE_UNIT * 0.24;
  const exitBend = TURN_FEATURE_UNIT * 0.20;

  const c1 = {
    x: horn.enterPoint.x + enterTan.x * enterBend,
    y: horn.enterPoint.y + enterTan.y * enterBend,
  };

  const c2 = {
    x: horn.exitPoint.x - exitDir.x * exitBend,
    y: horn.exitPoint.y - exitDir.y * exitBend,
  };

  const pts = [];
  const half = Math.floor(steps / 2);

  for (let i = 0; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(horn.enterPoint, c1, horn.tip, t));
  }
  for (let i = 1; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(horn.tip, c2, horn.exitPoint, t));
  }

  return { horn, points: pts };
}

function getSameToSwitchHornCurvePoints(step, nextStep, turnName, steps = ANIMATION_POINT_STEPS) {
  const clipOffset = TURN_FEATURE_UNIT * mixedHornTuning.sameToSwitch.clipOffset;
  const enterAngle =
    step.dir === "cw"
      ? step.endAngle - clipOffset / radius
      : step.endAngle + clipOffset / radius;
  const startPoint = pointOnCircle(step.circle, enterAngle);
  const joint = step.endPoint;
  const inward = normalize(step.circle.cx - joint.x, step.circle.cy - joint.y);
  const normal = turnName === "Counter"
    ? { x: -inward.x, y: -inward.y }
    : inward;
  const endPoint = nextStep.bridgeStart;
  const enterTan = tangentUnit(step.dir, enterAngle);
  const exitDir = normalize(
    nextStep.bridgeEnd.x - nextStep.bridgeStart.x,
    nextStep.bridgeEnd.y - nextStep.bridgeStart.y
  );
  const hornDepth = TURN_FEATURE_UNIT * mixedHornTuning.sameToSwitch.hornDepth;
  const bend = TURN_FEATURE_UNIT * mixedHornTuning.sameToSwitch.bend;
  const c1 = {
    x: startPoint.x + enterTan.x * bend,
    y: startPoint.y + enterTan.y * bend,
  };
  const c2 = {
    x: endPoint.x - exitDir.x * bend,
    y: endPoint.y - exitDir.y * bend,
  };
  const tip = {
    x: joint.x + normal.x * hornDepth,
    y: joint.y + normal.y * hornDepth,
  };

  const pts = [];
  const half = Math.max(1, Math.floor(steps / 2));
  for (let i = 0; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(startPoint, c1, tip, t));
  }
  for (let i = 1; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(tip, c2, endPoint, t));
  }

  return {
    sameEndAngle: enterAngle,
    points: pts,
  };
}

function getSwitchToSameHornCurvePoints(step, nextStep, turnName, steps = ANIMATION_POINT_STEPS) {
  const clipOffset = TURN_FEATURE_UNIT * mixedHornTuning.switchToSame.clipOffset;
  const centerAngle = nextStep.startAngle;
  const enterAngle =
    step.dir === "cw"
      ? centerAngle - clipOffset / radius
      : centerAngle + clipOffset / radius;
  const exitAngle =
    nextStep.dir === "cw"
      ? centerAngle + clipOffset / radius
      : centerAngle - clipOffset / radius;
  const startPoint = pointOnCircle(step.toCircle, enterAngle);
  const joint = nextStep.startPoint;
  const inward = normalize(nextStep.circle.cx - joint.x, nextStep.circle.cy - joint.y);
  const normal = turnName === "Bracket"
    ? { x: -inward.x, y: -inward.y }
    : inward;
  const endPoint = pointOnCircle(nextStep.circle, exitAngle);
  const enterTan = tangentUnit(step.dir, enterAngle);
  const exitTan = tangentUnit(nextStep.dir, exitAngle);
  const hornDepth = TURN_FEATURE_UNIT * mixedHornTuning.switchToSame.hornDepth;
  const bend = TURN_FEATURE_UNIT * mixedHornTuning.switchToSame.bend;
  const c1 = {
    x: startPoint.x + enterTan.x * bend,
    y: startPoint.y + enterTan.y * bend,
  };
  const c2 = {
    x: endPoint.x - exitTan.x * bend,
    y: endPoint.y - exitTan.y * bend,
  };
  const tip = {
    x: joint.x + normal.x * hornDepth,
    y: joint.y + normal.y * hornDepth,
  };

  const pts = [];
  const half = Math.max(1, Math.floor(steps / 2));
  for (let i = 0; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(startPoint, c1, tip, t));
  }
  for (let i = 1; i <= half; i++) {
    const t = i / half;
    pts.push(quadraticPoint(tip, c2, endPoint, t));
  }

  return {
    switchEndAngle: enterAngle,
    sameStartAngle: exitAngle,
    points: pts,
  };
}

function getMixedHornCurvePoints(step, nextStep, turnName, steps = ANIMATION_POINT_STEPS) {
  if (step.mode === "same" && nextStep.mode === "switch") {
    return getSameToSwitchHornCurvePoints(step, nextStep, turnName, steps);
  }

  if (step.mode === "switch" && nextStep.mode === "same") {
    return getSwitchToSameHornCurvePoints(step, nextStep, turnName, steps);
  }

  return { points: [] };
}

function isSameToSwitchSpecialTurn(turn) {
  return turn === "Rocker" || turn === "Counter";
}

function isSwitchToSameSpecialTurn(turn) {
  return turn === "Three" || turn === "Bracket" || turn === "Loop";
}

function isPlainSwitchToSameTurn(turn) {
  return turn === "Mohawk" || turn === "ChangeFoot" || turn === "Skating";
}

function changeCountBy(delta) {
  if (!countEl) return;

  const min = Number(countEl.min || 1);
  const max = Number(countEl.max || 50);
  const current = Number(countEl.value || min);
  const next = Math.max(min, Math.min(max, current + delta));
  countEl.value = String(next);
  saveSettingsToCookie();
}

/* =========================
   謠冗判逕ｨ繧ｻ繧ｰ繝｡繝ｳ繝域ｧ狗ｯ・
   謚縺ｯ step 縺ｨ step 縺ｮ髢薙↓逋ｺ逕溘☆繧・
   special turn 縺ｧ繧・nextStep 繧呈ｶ郁ｲｻ縺励↑縺・
========================= */
function getFullStepPoints(step) {
  if (step.mode === "same") {
    return sampleArcPoints(step.circle, step.startAngle, step.endAngle, step.dir);
  }

  return [
    ...sampleBridgePoints(step),
    ...sampleArcPoints(step.toCircle, step.arcStartAngle, step.arcEndAngle, step.dir).slice(1),
  ];
}

function getClippedSameStepPoints(step, startAngle, endAngle) {
  return sampleArcPoints(
    step.circle,
    startAngle ?? step.startAngle,
    endAngle ?? step.endAngle,
    step.dir
  );
}

function getClippedSwitchStepPoints(step, endAngle) {
  if (endAngle == null) {
    return getFullStepPoints(step);
  }

  return [
    ...sampleBridgePoints(step),
    ...sampleArcPoints(step.toCircle, step.arcStartAngle, endAngle, step.dir).slice(1),
  ];
}

function buildRenderSegments() {
  const segments = [];
  if (!stepInfos.length) return segments;

  const sameStartClipAngles = Array(stepInfos.length).fill(null);
  const sameEndClipAngles = Array(stepInfos.length).fill(null);
  const switchEndClipAngles = Array(stepInfos.length).fill(null);
  const boundarySegments = Array(Math.max(0, stepInfos.length - 1)).fill(null);

  for (let i = 0; i < turns.length; i++) {
    const step = stepInfos[i];
    const nextStep = stepInfos[i + 1];
    const turn = turns[i];
    const startState = stepStates[i] || parseStateCode("LFO");
    const endState = stepStates[i + 1] || startState;

    const sameSpecial =
      (turn === "Three" || turn === "Bracket" || turn === "Loop") &&
      nextStep &&
      step.mode === "same" &&
      nextStep.mode === "same" &&
      nextStep.circle === step.circle;

    if (sameSpecial) {
      const sameData = turn === "Loop"
        ? getLoopCurvePoints(step)
        : getThreeHornCurvePoints(step, nextStep, turn);

      sameEndClipAngles[i] = sameData.loop?.enterAngle ?? sameData.horn.enterAngle;
      sameStartClipAngles[i + 1] = sameData.loop?.exitAngle ?? sameData.horn.exitAngle;

      boundarySegments[i] = {
        type: "special-same",
        turn,
        turnIndex: i,
        foot: startState.foot,
        points: sameData.points,
        stateSamples: turn === "Loop"
          ? buildConstantStateSamples(sameData.points, startState)
          : buildTransitionStateSamples(
              sameData.points,
              startState,
              endState,
              0.5
            ),
      };
      continue;
    }

    const switchSpecial =
      (turn === "Rocker" || turn === "Counter") &&
      nextStep &&
      step.mode === "switch" &&
      nextStep.mode === "switch" &&
      step.toCircle === nextStep.fromCircle;

    if (switchSpecial) {
      const hornData = getSwitchHornCurvePoints(step, nextStep, turn);
      switchEndClipAngles[i] = hornData.horn.enterAngle;

      boundarySegments[i] = {
        type: "special-switch",
        turn,
        turnIndex: i,
        foot: startState.foot,
        points: hornData.points,
        stateSamples: buildTransitionStateSamples(
          hornData.points,
          startState,
          endState,
          0.5
        ),
      };
      continue;
    }

    const sameToSwitchSpecial =
      nextStep &&
      step.mode === "same" &&
      nextStep.mode === "switch" &&
      isSameToSwitchSpecialTurn(turn);

    if (sameToSwitchSpecial) {
      const hornData = getMixedHornCurvePoints(step, nextStep, turn);
      if (hornData.sameEndAngle != null) {
        sameEndClipAngles[i] = hornData.sameEndAngle;
      }
      boundarySegments[i] = {
        type: "special-mixed",
        turn,
        turnIndex: i,
        foot: startState.foot,
        points: hornData.points,
        stateSamples: buildTransitionStateSamples(
          hornData.points,
          startState,
          endState,
          0.5
        ),
      };
      continue;
    }

    const switchToSameSpecial =
      nextStep &&
      step.mode === "switch" &&
      nextStep.mode === "same" &&
      isSwitchToSameSpecialTurn(turn);

    if (switchToSameSpecial) {
      const boundaryData = turn === "Loop"
        ? getLoopStartCurvePoints(nextStep)
        : getSwitchToSameHornCurvePoints(step, nextStep, turn);
      if (turn === "Loop") {
        switchEndClipAngles[i] = boundaryData.loop.enterAngle;
        sameStartClipAngles[i + 1] = boundaryData.loop.exitAngle;
      } else {
        switchEndClipAngles[i] = boundaryData.switchEndAngle;
        sameStartClipAngles[i + 1] = boundaryData.sameStartAngle;
      }

      boundarySegments[i] = {
        type: "special-mixed",
        turn,
        turnIndex: i,
        foot: startState.foot,
        points: boundaryData.points,
        stateSamples: buildTransitionStateSamples(
          boundaryData.points,
          startState,
          endState,
          0.5
        ),
      };
      continue;
    }

    const plainSwitchToSame =
      nextStep &&
      step.mode === "switch" &&
      nextStep.mode === "same" &&
      isPlainSwitchToSameTurn(turn);

    if (plainSwitchToSame) {
      switchEndClipAngles[i] = nextStep.startAngle;
      continue;
    }
  }

  const clippedStepPoints = stepInfos.map((step, i) => {
    if (step.mode === "same") {
      return getClippedSameStepPoints(
        step,
        sameStartClipAngles[i],
        sameEndClipAngles[i]
      );
    }

    return getClippedSwitchStepPoints(step, switchEndClipAngles[i]);
  });

  for (let i = 0; i < stepInfos.length; i++) {
    const state = stepStates[i] || parseStateCode("LFO");
    segments.push({
      type: "step",
      stepIndex: i,
      turnIndex: Math.min(i, Math.max(0, turns.length - 1)),
      foot: state.foot,
      points: clippedStepPoints[i],
      stateSamples: buildConstantStateSamples(clippedStepPoints[i], state),
    });

    if (i >= stepInfos.length - 1) continue;

    const boundary = boundarySegments[i];
    if (boundary) {
      segments.push(boundary);
      continue;
    }

    const a = clippedStepPoints[i][clippedStepPoints[i].length - 1];
    const b = clippedStepPoints[i + 1][0];
    const currentStep = stepInfos[i];
    const nextStep = stepInfos[i + 1];
    const turn = turns[i];
    const currentState = stepStates[i] || state;
    const nextState = stepStates[i + 1] || currentState;
    if (a && b && distance(a, b) >= 0.5) {
      const connectorPoints = sampleLinePoints(a, b);

      segments.push({
        type: "connector",
        turn,
        turnIndex: i,
        foot: nextState.foot,
        points: connectorPoints,
        stateSamples: buildConstantStateSamples(connectorPoints, nextState),
      });
    }
  }

  return segments;
}

/* =========================
   蜈ｨ菴灘叉譎よ緒逕ｻ
========================= */
function drawSteps() {
  if (!stepInfos.length) return;

  const segments = buildRenderSegments();
  for (const seg of segments) {
    drawPolylinePartial(seg.points, 1, seg.foot);
  }
  drawTurnAnnotations(segments);
  drawStartStar(segments[0]?.points?.[0]);
  drawStartStateLabel(segments[0]?.points?.[0]);
}

function getSegmentDurationMultiplier(segment) {
  if (!segment?.turn) return 1;
  if (segment.turn === "Skating" || segment.turn === "ChangeEdge") return 1;
  return TURN_SLOWDOWN_MULTIPLIER;
}

/* =========================
   繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ
========================= */
function stopAnimation() {
  animationToken++;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function resetCanvas() {
  buildGrid(gridRows, gridCols);
  applyCanvasZoom();
  drawGrid();
}

function playAnimation() {
  if (!lastConfirmedData || !lastConfirmedData.stepInfos.length) {
    return;
  }

  stopAnimation();

  stepInfos = lastConfirmedData.stepInfos;
  turns = lastConfirmedData.turns;
  stepStates = lastConfirmedData.stepStates;
  modes = lastConfirmedData.modes;
  currentStartStateCode = lastConfirmedData.startStateCode ?? stateToCode(stepStates[0]);

  resetCanvas();

  const segments = buildRenderSegments();
  const token = ++animationToken;

  function animateSegment(index) {
    if (token !== animationToken) return;

    if (index >= segments.length) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        resetCanvas();
        for (const seg of segments) {
          drawPolylinePartial(seg.points, 1, seg.foot);
        }
        drawTurnAnnotations(segments);
        drawStartStar(segments[0]?.points?.[0]);
        drawStartStateLabel(segments[0]?.points?.[0]);
        drawFootMarker(getMarkerPose(lastSegment, 1));
      }
      highlightSequenceStep(turns.length - 1);
      animationFrameId = null;
      return;
    }

    const segment = segments[index];
    highlightSequenceStep(segment.turnIndex ?? -1);
    const startedAt = performance.now();

    function tick(now) {
      if (token !== animationToken) return;

      const segmentLength = Math.max(1, getPolylineLength(segment.points));
      const segmentDuration =
        (segmentLength / ANIMATION_SPEED) * getSegmentDurationMultiplier(segment);

      const elapsed = now - startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / segmentDuration));
      resetCanvas();

      for (let i = 0; i < index; i++) {
        drawPolylinePartial(segments[i].points, 1, segments[i].foot);
      }

      drawPolylinePartial(segment.points, progress, segment.foot);
      drawTurnAnnotations(segments);
      drawStartStar(segments[0]?.points?.[0]);
      drawStartStateLabel(segments[0]?.points?.[0]);
      drawTurnPopup(segment, progress, segments);
      drawFootMarker(getMarkerPose(segment, progress));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        animateSegment(index + 1);
      }
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  animateSegment(0);
}

/* =========================
   螳溯｡・
========================= */
function confirmRun() {
  stopAnimation();
  currentCircleSize = resolveCircleSize(circleSizeEl?.value);

  const turnCount = Math.max(
    1,
    Math.min(49, Number(document.getElementById("count").value) || 1)
  );
  let sequenceText = sequenceInputEl?.value.trim() ?? "";
  let startState = startStateEl.value;

  const baseRadius = FIXED_RADIUS * getCircleRadiusScale();
  canvas.width = BASE_GRID_COLS * baseRadius * 2 + GRID_PADDING * 2;
  canvas.height = BASE_GRID_ROWS * baseRadius * 2 + GRID_PADDING * 2;
  applyCanvasZoom();
  buildGrid(BASE_GRID_ROWS, BASE_GRID_COLS);

  try {
    if (activeInputMode === INPUT_MODES.MANUAL) {
      if (!sequenceText) {
        sequenceText = buildSequenceTextFromParts(
          manualStartStateEl?.value ?? STATES[0][0],
          getManualTurnNames()
        );
        if (sequenceInputEl) {
          sequenceInputEl.value = sequenceText;
        }
      }

      if (!sequenceText) {
        throw new Error("じぶんでつくるにはターンを1つ以上入れてください。");
      }

      const parsed = parseSequenceText(sequenceText);
      currentCircleSize = parsed.circleSize;
      if (circleSizeEl) {
        circleSizeEl.value = String(parsed.circleSize);
      }
      canvas.width = BASE_GRID_COLS * radius * 2 + GRID_PADDING * 2;
      canvas.height = BASE_GRID_ROWS * radius * 2 + GRID_PADDING * 2;
      applyCanvasZoom();
      buildGrid(BASE_GRID_ROWS, BASE_GRID_COLS);
      startState = parsed.startStateCode;
      if (manualStartStateEl) {
        manualStartStateEl.value = startState;
      }
      setManualBuilder(startState, parsed.turnNames);
      buildStepInfosFromTurns(startState, parsed.turnNames);
    } else {
      const stepCount = turnCount + 1;
      startState = resolveStartStateCode(startState);
      buildStepInfos(stepCount, startState);
    }
  } catch (error) {
    alert(error.message || "シークエンス入力を読み込めませんでした。");
    return;
  }

  currentStartStateCode = startState;

  fitGridToContent();

  lastConfirmedData = {
    startStateCode: currentStartStateCode,
    stepInfos,
    turns,
    stepStates,
    modes,
  };

  drawGrid();
  drawSteps();
  renderSequence();
  highlightSequenceStep(-1);
  saveSettingsToCookie();
}

/* =========================
   陦ｨ遉ｺ
========================= */
function renderSequence() {
  sequenceEl.innerHTML = turns
    .map((t, i) => {
      const s0 = stepStates[i];
      const code = stateToCode(s0);
      const edgeLabel = stateLabelJPFromState(s0);
      const turnLabel = turnLabelJP(t);

      return `
        <div class="step sequence-step" data-sequence-index="${i}" style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.08); transition:background 140ms ease, border-color 140ms ease;">
          <div class="step-title" style="font-weight:700;">${i + 1}. (${code})${edgeLabel} ${turnLabel}</div>
        </div>
      `;
    })
    .join("");
}

function highlightSequenceStep(index) {
  for (const el of sequenceEl.querySelectorAll(".sequence-step")) {
    const isActive = Number(el.dataset.sequenceIndex) === index;
    el.style.background = isActive ? "rgba(91, 134, 255, 0.22)" : "transparent";
    el.style.borderColor = isActive ? "rgba(109, 213, 237, 0.38)" : "rgba(255,255,255,0.08)";
  }

  if (index < 0) return;

  const activeEl = sequenceEl.querySelector(`.sequence-step[data-sequence-index="${index}"]`);
  activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function copyCurrentSequence() {
  const text = buildSequenceText();
  if (!text) {
    alert("コピーできるシークエンスがありません。");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    if (sequenceInputEl) {
      sequenceInputEl.value = text;
      sequenceInputEl.focus();
      sequenceInputEl.select();
    }
    alert("クリップボードに直接コピーできなかったので、入力欄に入れました。");
    return;
  }

  if (sequenceInputEl) {
    sequenceInputEl.value = text;
  }
  setManualBuilder(stateToCode(stepStates[0]), turns);
  saveSettingsToCookie();
}

/* =========================
   init
========================= */
document.getElementById("run").addEventListener("click", confirmRun);
document.getElementById("play").addEventListener("click", playAnimation);
copySequenceButton?.addEventListener("click", () => {
  copyCurrentSequence();
});
shareSequenceButton?.addEventListener("click", async () => {
  try {
    await shareCurrentSequence();
  } catch (error) {
    alert("共有リンクを作れませんでした。");
  }
});
clearSequenceInputButton?.addEventListener("click", () => {
  if (!sequenceInputEl) return;
  sequenceInputEl.value = "";
  renderManualTurnList([]);
  saveSettingsToCookie();
});
checkAllTurnsButton?.addEventListener("click", () => {
  setAllTurnEdges(true);
});
clearAllTurnsButton?.addEventListener("click", () => {
  setAllTurnEdges(false);
});
tabRandomButton?.addEventListener("click", () => {
  setActiveInputMode(INPUT_MODES.RANDOM);
  saveSettingsToCookie();
});
tabManualButton?.addEventListener("click", () => {
  setActiveInputMode(INPUT_MODES.MANUAL);
  saveSettingsToCookie();
});
toggleInputPanelButton?.addEventListener("click", () => {
  setInputPanelCollapsed(!(inputPanelBodyEl?.hidden ?? false));
  saveSettingsToCookie();
});
manualStartStateEl?.addEventListener("change", () => {
  syncSequenceInputFromManualBuilder();
  saveSettingsToCookie();
});
addManualTurnButton?.addEventListener("click", () => {
  renderManualTurnList([...getManualTurnNames(), "Three"]);
  syncSequenceInputFromManualBuilder();
  saveSettingsToCookie();
});
manualTurnListEl?.addEventListener("change", event => {
  if (!event.target.classList.contains("manual-turn-select")) return;
  syncSequenceInputFromManualBuilder();
  saveSettingsToCookie();
});
manualTurnListEl?.addEventListener("click", event => {
  const button = event.target.closest(".manual-turn-remove");
  if (!button) return;

  const row = button.closest(".manual-turn-row");
  const index = Number(row?.dataset.manualIndex ?? -1);
  const turnNames = getManualTurnNames();
  if (index < 0 || index >= turnNames.length) return;

  turnNames.splice(index, 1);
  renderManualTurnList(turnNames);
  syncSequenceInputFromManualBuilder();
  saveSettingsToCookie();
});
startStateEl?.addEventListener("change", saveSettingsToCookie);
circleSizeEl?.addEventListener("change", () => {
  currentCircleSize = resolveCircleSize(circleSizeEl.value);
  syncSequenceInputFromManualBuilder();
  saveSettingsToCookie();
});
sCurveFixedEl?.addEventListener("change", saveSettingsToCookie);
countEl?.addEventListener("input", saveSettingsToCookie);
countDownButton?.addEventListener("click", () => {
  changeCountBy(-1);
});
countUpButton?.addEventListener("click", () => {
  changeCountBy(1);
});
sequenceInputEl?.addEventListener("input", saveSettingsToCookie);

fillStates();
fillTurnCheckboxes();
renderManualTurnList([]);
setActiveInputMode(INPUT_MODES.RANDOM);
setInputPanelCollapsed(false);
restoreSettingsFromCookie();
restoreSequenceFromQuery();
currentCircleSize = resolveCircleSize(circleSizeEl?.value);
ensureScrollableCanvas();
applyCanvasZoom();
setupCanvasViewportInteractions();
confirmRun();

