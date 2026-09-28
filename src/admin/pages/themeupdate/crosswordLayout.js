// Crossword layout generator (ported from layout_generator.js)

function distance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function weightedAverage(weights, values) {
  let temp = 0;
  for (let k = 0; k < weights.length; k++) {
    temp += weights[k] * values[k];
  }
  return temp;
}

function computeScore1(connections, word) {
  return connections / (word.length / 2);
}

function computeScore2(rows, cols, i, j) {
  return 1 - distance(rows / 2, cols / 2, i, j) / (rows / 2 + cols / 2);
}

function computeScore3(a, b, verticalCount, totalCount) {
  if (verticalCount > totalCount / 2) return a;
  if (verticalCount < totalCount / 2) return b;
  return 0.5;
}

function computeScore4(val, word) {
  return word.length / val;
}

function addWord(best, words, table) {
  const word = best[1];
  const index = best[2];
  const bestI = best[3];
  const bestJ = best[4];
  const bestO = best[5];

  words[index].startx = bestJ + 1;
  words[index].starty = bestI + 1;

  if (bestO === 0) {
    for (let k = 0; k < word.length; k++) {
      table[bestI][bestJ + k] = word.charAt(k);
    }
    words[index].orientation = "across";
  } else {
    for (let k = 0; k < word.length; k++) {
      table[bestI + k][bestJ] = word.charAt(k);
    }
    words[index].orientation = "down";
  }
}

function assignPositions(words) {
  const positions = {};
  for (const index in words) {
    const word = words[index];
    if (word.orientation !== "none") {
      const tempStr = `${word.starty},${word.startx}`;
      if (tempStr in positions) {
        word.position = positions[tempStr];
      } else {
        positions[tempStr] = Object.keys(positions).length + 1;
        word.position = positions[tempStr];
      }
    }
  }
}

function computeDimension(words, factor) {
  let temp = 0;
  for (let i = 0; i < words.length; i++) {
    if (temp < words[i].answer.length) {
      temp = words[i].answer.length;
    }
  }
  return temp * factor;
}

function initTable(rows, cols) {
  const table = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (j === 0) {
        table[i] = ["-"];
      } else {
        table[i][j] = "-";
      }
    }
  }
  return table;
}

function isConflict(table, isVertical, character, i, j) {
  if (character !== table[i][j] && table[i][j] !== "-") {
    return true;
  }
  if (table[i][j] === "-" && !isVertical && i + 1 in table && table[i + 1][j] !== "-") {
    return true;
  }
  if (table[i][j] === "-" && !isVertical && i - 1 in table && table[i - 1][j] !== "-") {
    return true;
  }
  if (table[i][j] === "-" && isVertical && j + 1 in table[i] && table[i][j + 1] !== "-") {
    return true;
  }
  if (table[i][j] === "-" && isVertical && j - 1 in table[i] && table[i][j - 1] !== "-") {
    return true;
  }
  return false;
}

function attemptToInsert(rows, cols, table, weights, verticalCount, totalCount, word, index) {
  let bestI = 0;
  let bestJ = 0;
  let bestO = 0;
  let bestScore = -1;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols - word.length + 1; j++) {
      let isValid = true;
      let atleastOne = false;
      let connections = 0;
      let prevFlag = false;

      for (let k = 0; k < word.length; k++) {
        if (isConflict(table, false, word.charAt(k), i, j + k)) {
          isValid = false;
          break;
        }
        if (table[i][j + k] === "-") {
          prevFlag = false;
          atleastOne = true;
        } else if (prevFlag) {
          isValid = false;
          break;
        } else {
          prevFlag = true;
          connections += 1;
        }
      }

      if (j - 1 in table[i] && table[i][j - 1] !== "-") isValid = false;
      else if (j + word.length in table[i] && table[i][j + word.length] !== "-") isValid = false;

      if (isValid && atleastOne && word.length > 1) {
        const tempScore = weightedAverage(weights, [
          computeScore1(connections, word),
          computeScore2(rows, cols, i, j + word.length / 2),
          computeScore3(1, 0, verticalCount, totalCount),
          computeScore4(rows, word),
        ]);
        if (tempScore > bestScore) {
          bestScore = tempScore;
          bestI = i;
          bestJ = j;
          bestO = 0;
        }
      }
    }
  }

  for (let i = 0; i < rows - word.length + 1; i++) {
    for (let j = 0; j < cols; j++) {
      let isValid = true;
      let atleastOne = false;
      let connections = 0;
      let prevFlag = false;

      for (let k = 0; k < word.length; k++) {
        if (isConflict(table, true, word.charAt(k), i + k, j)) {
          isValid = false;
          break;
        }
        if (table[i + k][j] === "-") {
          prevFlag = false;
          atleastOne = true;
        } else if (prevFlag) {
          isValid = false;
          break;
        } else {
          prevFlag = true;
          connections += 1;
        }
      }

      if (i - 1 in table && table[i - 1][j] !== "-") isValid = false;
      else if (i + word.length in table && table[i + word.length][j] !== "-") isValid = false;

      if (isValid && atleastOne && word.length > 1) {
        const tempScore = weightedAverage(weights, [
          computeScore1(connections, word),
          computeScore2(rows, cols, i + word.length / 2, j),
          computeScore3(0, 1, verticalCount, totalCount),
          computeScore4(rows, word),
        ]);
        if (tempScore > bestScore) {
          bestScore = tempScore;
          bestI = i;
          bestJ = j;
          bestO = 1;
        }
      }
    }
  }

  if (bestScore > -1) {
    return [bestScore, word, index, bestI, bestJ, bestO];
  }
  return [-1];
}

function generateTable(table, rows, cols, words, weights) {
  let verticalCount = 0;
  let totalCount = 0;

  for (const outerIndex in words) {
    let best = [-1];
    for (const innerIndex in words) {
      if ("answer" in words[innerIndex] && !("startx" in words[innerIndex])) {
        const temp = attemptToInsert(
          rows,
          cols,
          table,
          weights,
          verticalCount,
          totalCount,
          words[innerIndex].answer,
          innerIndex
        );
        if (temp[0] > best[0]) {
          best = temp;
        }
      }
    }

    if (best[0] === -1) {
      break;
    }
    addWord(best, words, table);
    if (best[5] === 1) verticalCount += 1;
    totalCount += 1;
  }

  for (const index in words) {
    if (!("startx" in words[index])) {
      words[index].orientation = "none";
    }
  }

  return { table, result: words };
}

function removeIsolatedWords(data) {
  const oldTable = data.table;
  const words = data.result;
  const rows = oldTable.length;
  const cols = oldTable[0].length;
  let newTable = initTable(rows, cols);

  for (const wordIndex in words) {
    const word = words[wordIndex];
    if (word.orientation === "across") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        if (newTable[i][j + k] === "-") newTable[i][j + k] = "O";
        else if (newTable[i][j + k] === "O") newTable[i][j + k] = "X";
      }
    } else if (word.orientation === "down") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        if (newTable[i + k][j] === "-") newTable[i + k][j] = "O";
        else if (newTable[i + k][j] === "O") newTable[i + k][j] = "X";
      }
    }
  }

  for (const wordIndex in words) {
    const word = words[wordIndex];
    let isIsolated = true;
    if (word.orientation === "across") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        if (newTable[i][j + k] === "X") {
          isIsolated = false;
          break;
        }
      }
    } else if (word.orientation === "down") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        if (newTable[i + k][j] === "X") {
          isIsolated = false;
          break;
        }
      }
    }
    if (word.orientation !== "none" && isIsolated) {
      delete words[wordIndex].startx;
      delete words[wordIndex].starty;
      delete words[wordIndex].position;
      words[wordIndex].orientation = "none";
    }
  }

  newTable = initTable(rows, cols);
  for (const wordIndex in words) {
    const word = words[wordIndex];
    if (word.orientation === "across") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        newTable[i][j + k] = word.answer.charAt(k);
      }
    } else if (word.orientation === "down") {
      const i = word.starty - 1;
      const j = word.startx - 1;
      for (let k = 0; k < word.answer.length; k++) {
        newTable[i + k][j] = word.answer.charAt(k);
      }
    }
  }

  return { table: newTable, result: words };
}

function trimTable(data) {
  const table = data.table;
  const rows = table.length;
  const cols = table[0].length;

  let leftMost = cols;
  let topMost = rows;
  let rightMost = -1;
  let bottomMost = -1;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (table[i][j] !== "-") {
        if (j < leftMost) leftMost = j;
        if (j > rightMost) rightMost = j;
        if (i < topMost) topMost = i;
        if (i > bottomMost) bottomMost = i;
      }
    }
  }

  const trimmedTable = initTable(bottomMost - topMost + 1, rightMost - leftMost + 1);
  for (let i = topMost; i < bottomMost + 1; i++) {
    for (let j = leftMost; j < rightMost + 1; j++) {
      trimmedTable[i - topMost][j - leftMost] = table[i][j];
    }
  }

  const words = data.result;
  for (const entry in words) {
    if ("startx" in words[entry]) {
      words[entry].startx -= leftMost;
      words[entry].starty -= topMost;
    }
  }

  return {
    table: trimmedTable,
    result: words,
    rows: Math.max(bottomMost - topMost + 1, 0),
    cols: Math.max(rightMost - leftMost + 1, 0),
  };
}

function generateSimpleTable(words) {
  const rows = computeDimension(words, 3);
  const cols = rows;
  const blankTable = initTable(rows, cols);
  const table = generateTable(blankTable, rows, cols, words, [0.7, 0.15, 0.1, 0.05]);
  const newTable = removeIsolatedWords(table);
  const finalTable = trimTable(newTable);
  assignPositions(finalTable.result);
  return finalTable;
}

/** @param {Array<{answer: string, clue: string, orientation?: string}>} wordsInput */
export function generateLayout(wordsInput) {
  const words = wordsInput.map((w) => ({
    answer: String(w.answer || "").toLowerCase(),
    clue: String(w.clue || ""),
    orientation: w.orientation || "none",
  }));
  return generateSimpleTable(words);
}

export function getWordStartPositions(words) {
  const positions = {};
  let count = 1;
  for (const word of words) {
    if (word.orientation === "none" || !word.startx || !word.starty) continue;
    const key = `${word.starty},${word.startx}`;
    if (!positions[key]) {
      positions[key] = count++;
    }
  }
  return positions;
}

export function buildWordsFromPairs(pairs) {
  return pairs
    .filter((p) => p.question.trim() && p.answer.trim())
    .map((p) => ({
      answer: p.answer.trim().toLowerCase(),
      clue: p.question.trim(),
      orientation: "none",
    }));
}

export function serializeCrosswordLayout(layout) {
  if (!layout?.table?.length) return null;
  const placedWords = Object.values(layout.result || {}).filter(
    (w) => w.orientation && w.orientation !== "none"
  );
  return {
    rows: layout.rows,
    cols: layout.cols,
    table: layout.table,
    words: placedWords.map((w) => ({
      answer: w.answer,
      clue: w.clue,
      orientation: w.orientation,
      startx: w.startx,
      starty: w.starty,
      position: w.position,
    })),
  };
}
