import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId } from "@/lib/gameUtils";
import { GameRoom, GamePlayer, CalledWord } from "@/lib/gameTypes";
import { Trophy, Medal, Home, BarChart3, Clock, Target } from "lucide-react";

export default function ResultPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = getPlayerId(roomCode || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [calledWords, setCalledWords] = useState<CalledWord[]>([]);

  useEffect(() => {
    if (!roomCode) return;
    const fetchData = async () => {
      const { data: r } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
      if (r) {
        setRoom(r as unknown as GameRoom);
        const roomId = (r as any).id;
        const [{ data: p }, { data: cw }] = await Promise.all([
          supabase.from('game_players').select('*').eq('room_id', roomId).order('created_at'),
          supabase.from('called_words').select('*').eq('room_id', roomId).order('turn_number'),
        ]);
        if (p) setPlayers(p as unknown as GamePlayer[]);
        if (cw) setCalledWords(cw as unknown as CalledWord[]);
      }
    };
    fetchData();
  }, [roomCode]);

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    if (b.bingo_count !== a.bingo_count) return b.bingo_count - a.bingo_count;
    if (a.last_bingo_at && b.last_bingo_at) return new Date(a.last_bingo_at).getTime() - new Date(b.last_bingo_at).getTime();
    return 0;
  });

  // --- 인기 단어 TOP 5 ---
  const wordCounts: Record<string, number> = {};
  players.forEach(p => {
    const board = (p.board_data || []) as string[];
    board.forEach(w => {
      if (w) wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // --- 플레이어별 매칭률 ---
  const calledWordSet = new Set(calledWords.map(cw => cw.word));
  const playerMatchRates = players.map(p => {
    const board = (p.board_data || []) as string[];
    const total = board.filter(w => w).length;
    const matched = board.filter(w => calledWordSet.has(w)).length;
    return { name: p.player_name, id: p.id, matched, total, rate: total > 0 ? Math.round((matched / total) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate);

  // --- 타임라인: 호출자 이름 매핑 ---
  const playerMap = new Map(players.map(p => [p.id, p.player_name]));

  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="text-center">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-black text-primary">게임 종료!</h1>
          <p className="text-muted-foreground mt-1">{room?.topic}</p>
        </div>

        {/* 순위 */}
        <div className="space-y-3">
          {sortedPlayers.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                player.id === playerId ? 'bg-primary/5 border-primary' : 'bg-card border-border'
              }`}
            >
              <span className="text-2xl w-10 text-center">
                {player.rank ? (rankIcons[player.rank - 1] || `${player.rank}위`) : `${idx + 1}`}
              </span>
              <div className="flex-1">
                <div className="font-bold">
                  {player.is_host ? '👑 ' : ''}{player.player_name}
                  {player.id === playerId && <span className="text-primary text-xs ml-1">(나)</span>}
                </div>
                <div className="text-sm text-muted-foreground">빙고 {player.bingo_count}줄</div>
              </div>
              {player.rank && player.rank <= 3 && (
                <Medal className="w-6 h-6 text-primary" />
              )}
            </div>
          ))}
        </div>

        {/* 분석 섹션 */}
        <div className="space-y-4 pt-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> 게임 분석
          </h2>

          {/* 인기 단어 TOP 5 */}
          {topWords.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                🔥 인기 단어 TOP {topWords.length}
              </h3>
              <div className="space-y-1.5">
                {topWords.map(([word, count], i) => (
                  <div key={word} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 bg-muted rounded-full h-7 relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded-full"
                        style={{ width: `${(count / players.length) * 100}%` }}
                      />
                      <span className="relative z-10 px-3 text-sm leading-7 font-medium">{word}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{count}명</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 불린 단어 타임라인 */}
          {calledWords.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> 불린 단어 타임라인
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {calledWords.map((cw, i) => (
                  <div key={cw.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}.</span>
                    <span className="font-medium flex-1">{cw.word}</span>
                    <span className="text-xs text-muted-foreground">
                      {playerMap.get(cw.called_by) || '?'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 플레이어별 매칭률 */}
          {playerMatchRates.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4" /> 플레이어별 매칭률
              </h3>
              <div className="space-y-2">
                {playerMatchRates.map(pm => (
                  <div key={pm.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {pm.name}
                        {pm.id === playerId && <span className="text-primary text-xs ml-1">(나)</span>}
                      </span>
                      <span className="text-muted-foreground">{pm.matched}/{pm.total} ({pm.rate}%)</span>
                    </div>
                    <div className="bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pm.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button onClick={() => navigate('/')} className="w-full" size="lg">
          <Home className="w-4 h-4 mr-2" /> 처음으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
