import { cn } from "@/lib/utils";
import { checkBingos } from "@/lib/gameUtils";
import { HelpCircle, Check } from "lucide-react";

interface BingoBoardProps {
  size: number;
  boardData: string[];
  markedCells: boolean[];
  isOwn: boolean;
  isHost: boolean;
  isEditable?: boolean;
  isClickable?: boolean;
  highlight?: boolean;
  playerName: string;
  bingoCount: number;
  onCellClick?: (index: number) => void;
  onCellEdit?: (index: number, value: string) => void;
}

export default function BingoBoard({
  size,
  boardData,
  markedCells,
  isOwn,
  isHost,
  isEditable = false,
  isClickable = false,
  highlight = false,
  playerName,
  bingoCount,
  onCellClick,
  onCellEdit,
}: BingoBoardProps) {
  const { lines: bingoLines } = checkBingos(markedCells, size);
  const bingoIndices = new Set(bingoLines.flat());
  const canSeeContent = isOwn || isHost;

  return (
    <div className={cn(
      "rounded-xl p-3 transition-all",
      highlight ? "ring-4 ring-primary shadow-lg shadow-primary/20 bg-primary/5" : "bg-card border border-border"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm truncate">{playerName}</span>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          빙고 {bingoCount}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {Array.from({ length: size * size }).map((_, idx) => {
          const word = boardData[idx] || '';
          const marked = markedCells[idx] || false;
          const isBingoCell = bingoIndices.has(idx);

          if (isEditable) {
            return (
              <input
                key={idx}
                type="text"
                inputMode="text"
                value={word}
                onChange={(e) => onCellEdit?.(idx, e.target.value)}
                className={cn(
                  "aspect-square flex items-center justify-center text-center font-medium rounded-lg border-2 border-dashed border-muted-foreground/30 bg-background p-1 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors",
                  size >= 5 ? "text-xs min-h-[40px]" : "text-sm min-h-[48px]"
                )}
                placeholder={`${idx + 1}`}
              />
            );
          }

          return (
            <button
              key={idx}
              disabled={!isClickable || marked}
              onClick={() => isClickable && !marked && onCellClick?.(idx)}
              className={cn(
                "aspect-square flex items-center justify-center text-center rounded-lg font-medium transition-all relative overflow-hidden",
                size >= 5 ? "text-[10px] p-0.5" : "text-xs p-1",
                marked && isBingoCell && "bg-primary text-primary-foreground scale-105 shadow-md",
                marked && !isBingoCell && "bg-primary/70 text-primary-foreground",
                !marked && "bg-muted/50 hover:bg-muted",
                isClickable && !marked && "cursor-pointer hover:scale-105 hover:shadow-sm",
                !isClickable && "cursor-default"
              )}
            >
              {canSeeContent ? (
                <span className="break-all leading-tight">{word}</span>
              ) : marked ? (
                <Check className="w-4 h-4" />
              ) : isBingoCell ? (
                <Check className="w-4 h-4" />
              ) : (
                <HelpCircle className="w-4 h-4 opacity-40" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
