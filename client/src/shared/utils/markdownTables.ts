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

export function normalizeMarkdownTables(markdown: string) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n').flatMap(expandInlineTableRows);
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
