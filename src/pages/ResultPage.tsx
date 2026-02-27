import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId } from "@/lib/gameUtils";
import { GameRoom, GamePlayer } from "@/lib/gameTypes";
import { Trophy, Medal, Home } from "lucide-react";

export default function ResultPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = getPlayerId(roomCode || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);

  useEffect(() => {
    if (!roomCode) return;
    const fetch = async () => {
      const { data: r } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
      if (r) {
        setRoom(r as unknown as GameRoom);
        const { data: p } = await supabase.from('game_players').select('*').eq('room_id', (r as any).id).order('created_at');
        if (p) setPlayers(p as unknown as GamePlayer[]);
      }
    };
    fetch();
  }, [roomCode]);

  // Sort players: winners by rank, then by bingo count desc, then by last_bingo_at asc
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    if (b.bingo_count !== a.bingo_count) return b.bingo_count - a.bingo_count;
    if (a.last_bingo_at && b.last_bingo_at) return new Date(a.last_bingo_at).getTime() - new Date(b.last_bingo_at).getTime();
    return 0;
  });

  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-black text-primary">게임 종료!</h1>
          <p className="text-muted-foreground mt-1">{room?.topic}</p>
        </div>

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

        <Button onClick={() => navigate('/')} className="w-full" size="lg">
          <Home className="w-4 h-4 mr-2" /> 처음으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
