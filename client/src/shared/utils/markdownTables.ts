export const LANDSCAPE_TABLE_START_MARKER = '<!-- bibooks:landscape-table:start -->';
export const LANDSCAPE_TABLE_END_MARKER = '<!-- bibooks:landscape-table:end -->';

function splitTableCells(line: string) {
  let source = String(line || '').trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);
  return source.split('|').map((cell) => cell.trim());
}

function isTableRowLine(line: string) {
  return /^\s*\|.*\|\s*$/.test(String(line || ''));
}

function isDelimiterCell(cell: string) {
  return /^:?-{3,}:?$/.test(String(cell || '').trim());
}

function expandCompressedTableRows(headerLine: string, nextLine: string) {
  if (!isTableRowLine(headerLine) || !isTableRowLine(nextLine)) {
    return null;
  }
  const headerCells = splitTableCells(headerLine);
  const nextCells = splitTableCells(nextLine);
  const columnCount = headerCells.length;
  if (columnCount < 2 || nextCells.length <= columnCount) {
    return null;
  }
  const delimiterCells = nextCells.slice(0, columnCount);
  if (!delimiterCells.every(isDelimiterCell)) {
    return null;
  }
  const lines = [formatTableRow(headerCells, columnCount), formatTableRow(delimiterCells, columnCount)];
  const remainingCells = nextCells.slice(columnCount);
  while (remainingCells.length) {
    if (remainingCells.length > columnCount && !remainingCells[0] && remainingCells.length % columnCount !== 0) {
      remainingCells.shift();
      continue;
    }
    const rowCells = remainingCells.splice(0, columnCount);
    if (rowCells.some(Boolean)) {
      lines.push(formatTableRow(rowCells, columnCount));
    }
  }
  return lines;
}

function expandInlineTableRows(line: string) {
  const source = String(line || '');
  if (!/\|\s*:?-{3,}:?\s*\|/.test(source)) {
    return [source];
  }
  const firstPipeIndex = source.indexOf('|');
  if (firstPipeIndex < 0) {
    return [source];
  }
  const prefix = source.slice(0, firstPipeIndex);
  const tableText = source.slice(firstPipeIndex).trim();
  const tableRows = tableText
    .replace(/\|\s+\|/g, '|\n|')
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);
  if (/^\s*$/.test(prefix)) {
    return tableRows.map((row) => `${prefix}${row}`);
  }
  return [prefix.trimEnd(), ...tableRows];
}

function isTableCandidateLine(line: string) {
  const source = String(line || '').trim();
  if (!source.includes('|')) return false;
  if (/^[-:|\s]+$/.test(source)) return true;
  return splitTableCells(source).length >= 2;
}

function isDelimiterLine(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''));
}

function isBlankLine(line: string) {
  return !String(line || '').trim();
}

function hasNearbyDelimiter(lines: string[], start: number, direction: -1 | 1) {
  let cursor = start + direction;
  while (cursor >= 0 && cursor < lines.length) {
    const line = lines[cursor];
    if (isBlankLine(line)) {
      cursor += direction;
      continue;
    }
    if (!isTableCandidateLine(line) && !isDelimiterLine(line)) {
      return false;
    }
    if (isDelimiterLine(line)) {
      return true;
    }
    cursor += direction;
  }
  return false;
}

function compactLooseTableSpacing(lines: string[]) {
  return lines.filter((line, index) => {
    if (!isBlankLine(line)) return true;

    let previous = index - 1;
    while (previous >= 0 && isBlankLine(lines[previous])) previous -= 1;
    let next = index + 1;
    while (next < lines.length && isBlankLine(lines[next])) next += 1;

    if (previous < 0 || next >= lines.length) return true;
    const previousIsTableLine = isTableCandidateLine(lines[previous]) || isDelimiterLine(lines[previous]);
    const nextIsTableLine = isTableCandidateLine(lines[next]) || isDelimiterLine(lines[next]);
    if (!previousIsTableLine || !nextIsTableLine) return true;

    return !(hasNearbyDelimiter(lines, index, -1) || hasNearbyDelimiter(lines, index, 1));
  });
}

function formatTableRow(cells: string[], columnCount: number) {
  const normalized = cells.slice(0, columnCount);
  while (normalized.length < columnCount) normalized.push('');
  return `| ${normalized.map((cell) => cell.trim()).join(' | ')} |`;
}

function normalizeTableBlock(headerLine: string, bodyLines: string[]) {
  const rows = [headerLine, ...bodyLines].map(splitTableCells);
  const columnCount = Math.max(2, ...rows.map((row) => row.length));
  return [
    formatTableRow(rows[0], columnCount),
    formatTableRow(Array.from({ length: columnCount }, () => '---'), columnCount),
    ...rows.slice(1).filter((row) => row.some(Boolean)).map((row) => formatTableRow(row, columnCount)),
  ];
}

function splitLooseRow(line: string) {
  const source = String(line || '').trim();
  if (!source) return [];
  if (source.includes('|')) {
    return splitTableCells(source);
  }
  if (source.includes('\t')) {
    return source.split('\t').map((cell) => cell.trim());
  }
  if (source.includes('，')) {
    return source.split('，').map((cell) => cell.trim());
  }
  if (source.includes(',')) {
    return source.split(',').map((cell) => cell.trim());
  }
  return source.split(/\s{2,}/).map((cell) => cell.trim());
}

export function convertSelectionToMarkdownTable(selection: string) {
  const rows = String(selection || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isDelimiterLine(line))
    .map(splitLooseRow)
    .filter((cells) => cells.length >= 2 && cells.some(Boolean));

  if (!rows.length) {
    return '';
  }

  const columnCount = Math.max(2, ...rows.map((row) => row.length));
  return [
    formatTableRow(rows[0], columnCount),
    formatTableRow(Array.from({ length: columnCount }, () => '---'), columnCount),
    ...rows.slice(1).map((row) => formatTableRow(row, columnCount)),
  ].join('\n');
}

export function wrapMarkdownAsLandscapeTable(markdown: string) {
  const content = String(markdown || '').trim();
  if (!content) return '';
  return `${LANDSCAPE_TABLE_START_MARKER}\n${normalizeMarkdownTables(content)}\n${LANDSCAPE_TABLE_END_MARKER}`;
}

export function normalizeMarkdownTables(markdown: string) {
  const lines = compactLooseTableSpacing(String(markdown || '').replace(/\r\n?/g, '\n').split('\n').flatMap(expandInlineTableRows));
  const output: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] || '';
    const compressed = expandCompressedTableRows(line, next);

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (compressed) {
      output.push(...compressed);
      index += 1;
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    if (isTableCandidateLine(line) && isDelimiterLine(next)) {
      const bodyLines: string[] = [];
      let cursor = index + 2;
      while (cursor < lines.length && isTableCandidateLine(lines[cursor]) && !isDelimiterLine(lines[cursor])) {
        bodyLines.push(lines[cursor]);
        cursor += 1;
      }
      output.push(...normalizeTableBlock(line, bodyLines));
      index = cursor - 1;
      continue;
    }

    if (isDelimiterLine(line)) {
      const tableLines: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && isTableCandidateLine(lines[cursor]) && !isDelimiterLine(lines[cursor])) {
        tableLines.push(lines[cursor]);
        cursor += 1;
      }
      if (tableLines.length) {
        const [headerLine, ...bodyLines] = tableLines;
        output.push(...normalizeTableBlock(headerLine, bodyLines));
        index = cursor - 1;
        continue;
      }
    }

    if (isTableCandidateLine(line) && isTableCandidateLine(next) && !isDelimiterLine(next)) {
      const bodyLines: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && isTableCandidateLine(lines[cursor]) && !isDelimiterLine(lines[cursor])) {
        bodyLines.push(lines[cursor]);
        cursor += 1;
      }
      output.push(...normalizeTableBlock(line, bodyLines));
      index = cursor - 1;
      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}
