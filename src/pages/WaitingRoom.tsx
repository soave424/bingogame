import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId, shuffleArray, checkBingos } from "@/lib/gameUtils";
import { GameRoom, GamePlayer } from "@/lib/gameTypes";
import BingoBoard from "@/components/BingoBoard";
import { Copy, Check, Users, Sparkles, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default function WaitingRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = getPlayerId(roomCode || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [boardData, setBoardData] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const myPlayer = players.find(p => p.id === playerId);
  const isHost = myPlayer?.is_host || false;

  const fetchData = useCallback(async () => {
    if (!roomCode) return;
    const { data: r } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
    if (r) setRoom(r as unknown as GameRoom);
    const { data: p } = await supabase.from('game_players').select('*').eq('room_id', (r as any)?.id).order('created_at');
    if (p) {
      setPlayers(p as unknown as GamePlayer[]);
      const me = p.find((pl: any) => pl.id === playerId) as any;
      if (me && (me.board_data as string[]).length > 0) {
        setBoardData(me.board_data as string[]);
      }
    }
  }, [roomCode, playerId]);

  useEffect(() => {
    if (!playerId || !roomCode) { navigate('/'); return; }
    fetchData();

    const channel = supabase.channel(`room-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode, playerId, navigate, fetchData]);

  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${roomCode}`);
    }
  }, [room?.status, roomCode, navigate]);

  const size = room?.board_size || 5;
  const totalCells = size * size;

  useEffect(() => {
    if (boardData.length === 0 && totalCells > 0) {
      setBoardData(Array(totalCells).fill(''));
    }
  }, [totalCells, boardData.length]);

  const handleCellEdit = (idx: number, value: string) => {
    const newData = [...boardData];
    newData[idx] = value;
    setBoardData(newData);
  };

  const handleRandomFill = () => {
    if (!room?.word_list_enabled || !room.word_list.length) return;
    const shuffled = shuffleArray([...room.word_list]).slice(0, totalCells);
    setBoardData(shuffled);
  };

  const handleAiSuggest = async () => {
    if (!room) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-words', {
        body: { topic: room.topic, count: totalCells },
      });
      if (error) throw error;
      if (data?.words && Array.isArray(data.words) && data.words.length >= totalCells) {
        setBoardData(data.words.slice(0, totalCells));
        toast.success("AI가 추천한 단어로 채웠습니다!");
      } else {
        toast.error("AI 추천 결과가 부족합니다. 다시 시도해주세요.");
      }
    } catch (err: any) {
      toast.error("AI 추천 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (boardData.some(w => !w.trim())) {
      toast.error("모든 칸을 채워주세요");
      return;
    }
    // Check duplicates
    const trimmed = boardData.map(w => w.trim());
    const unique = new Set(trimmed);
    if (unique.size !== trimmed.length) {
      toast.error("중복된 단어가 있습니다");
      return;
    }

    const { error } = await supabase.from('game_players').update({
      board_data: trimmed,
      marked_cells: Array(totalCells).fill(false),
      is_ready: true,
    } as any).eq('id', playerId);

    if (error) toast.error("제출 실패");
    else toast.success("빙고판 제출 완료!");
  };

  const handleStart = async () => {
    if (!room) return;
    const allReady = players.every(p => p.is_ready);
    if (!allReady) { toast.error("모든 참가자가 준비 완료해야 합니다"); return; }
    if (players.length < 2) { toast.error("최소 2명이 필요합니다"); return; }

    const turnOrder = shuffleArray(players.map(p => p.id));

    await supabase.from('game_rooms').update({
      status: 'playing',
      turn_order: turnOrder,
      current_turn_index: 0,
    } as any).eq('id', room.id);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-primary">🎯 도전 빙고왕!</h1>
          <p className="text-muted-foreground mt-1">주제: {room.topic}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">방 코드</span>
              <div className="text-2xl font-mono font-bold tracking-widest">{roomCode}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCode}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "복사됨" : "복사"}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Maximize2 className="w-4 h-4" />
                    크게 보기
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex flex-col items-center justify-center py-16">
                  <span className="text-sm text-muted-foreground mb-2">방 코드</span>
                  <div className="text-6xl font-mono font-black tracking-[0.3em] text-primary">{roomCode}</div>
                  <p className="text-muted-foreground mt-4 text-sm">이 코드를 친구들에게 알려주세요!</p>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" />
            <span className="font-bold text-sm">참가자 ({players.length}명)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <div key={p.id} className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                p.is_ready ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {p.is_host ? '👑 ' : ''}{p.player_name}
                {p.is_ready ? ' ✅' : ' ⏳'}
              </div>
            ))}
          </div>
        </div>

        {!myPlayer?.is_ready && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-bold">빙고판 채우기 ({size}×{size})</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleAiSuggest} disabled={aiLoading}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  {aiLoading ? "추천 중..." : "AI 추천"}
                </Button>
                {room.word_list_enabled && (
                  <Button variant="outline" size="sm" onClick={handleRandomFill}>
                    🎲 자동 채우기
                  </Button>
                )}
              </div>
            </div>
            <BingoBoard
              size={size}
              boardData={boardData}
              markedCells={Array(totalCells).fill(false)}
              isOwn={true}
              isHost={true}
              isEditable={true}
              playerName={myPlayer?.player_name || ""}
              bingoCount={0}
              onCellEdit={handleCellEdit}
            />
            <Button onClick={handleSubmit} className="w-full" size="lg">제출하기</Button>
          </div>
        )}

        {myPlayer?.is_ready && (
          <div className="text-center py-8">
            <p className="text-lg font-bold text-primary">✅ 준비 완료!</p>
            <p className="text-muted-foreground text-sm mt-1">다른 참가자를 기다리는 중...</p>
          </div>
        )}

        {isHost && (
          <Button
            onClick={handleStart}
            disabled={!players.every(p => p.is_ready) || players.length < 2}
            className="w-full"
            size="lg"
          >
            🚀 게임 시작 ({players.filter(p => p.is_ready).length}/{players.length} 준비)
          </Button>
        )}
      </div>
    </div>
  );
}
