export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function parseWordList(input: string): string[] {
  const trimmed = input.trim();
  // Check for numeric range pattern like "1-25"
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    const words: string[] = [];
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
      words.push(String(i));
    }
    return words;
  }
  // Split by comma or newline
  return trimmed
    .split(/[,\n]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

export function checkBingos(markedCells: boolean[], size: number): { count: number; lines: number[][] } {
  const lines: number[][] = [];

  // Rows
  for (let r = 0; r < size; r++) {
    const line: number[] = [];
    let complete = true;
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      line.push(idx);
      if (!markedCells[idx]) complete = false;
    }
    if (complete) lines.push(line);
  }

  // Columns
  for (let c = 0; c < size; c++) {
    const line: number[] = [];
    let complete = true;
    for (let r = 0; r < size; r++) {
      const idx = r * size + c;
      line.push(idx);
      if (!markedCells[idx]) complete = false;
    }
    if (complete) lines.push(line);
  }

  // Diagonal top-left to bottom-right
  {
    const line: number[] = [];
    let complete = true;
    for (let i = 0; i < size; i++) {
      const idx = i * size + i;
      line.push(idx);
      if (!markedCells[idx]) complete = false;
    }
    if (complete) lines.push(line);
  }

  // Diagonal top-right to bottom-left
  {
    const line: number[] = [];
    let complete = true;
    for (let i = 0; i < size; i++) {
      const idx = i * size + (size - 1 - i);
      line.push(idx);
      if (!markedCells[idx]) complete = false;
    }
    if (complete) lines.push(line);
  }

  return { count: lines.length, lines };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getPlayerId(roomCode: string): string | null {
  return localStorage.getItem(`bingo_player_${roomCode}`);
}

export function setPlayerId(roomCode: string, id: string) {
  localStorage.setItem(`bingo_player_${roomCode}`, id);
}
