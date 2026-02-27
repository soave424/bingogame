import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId, checkBingos } from "@/lib/gameUtils";
import { GameRoom, GamePlayer, CalledWord, WordRequest } from "@/lib/gameTypes";
import BingoBoard from "@/components/BingoBoard";
import WordRequestPanel from "@/components/WordRequestPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Volume2 } from "lucide-react";

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = getPlayerId(roomCode || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [calledWords, setCalledWords] = useState<CalledWord[]>([]);
  const [wordRequests, setWordRequests] = useState<WordRequest[]>([]);

  const myPlayer = players.find(p => p.id === playerId);
  const isHost = myPlayer?.is_host || false;
  const currentTurnPlayerId = room ? (room.turn_order[room.current_turn_index] || null) : null;
  const isMyTurn = currentTurnPlayerId === playerId;
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);

  const fetchAll = useCallback(async () => {
    if (!roomCode) return;
    const { data: r } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single();
    if (!r) return;
    setRoom(r as unknown as GameRoom);

    const [playersRes, wordsRes, reqsRes] = await Promise.all([
      supabase.from('game_players').select('*').eq('room_id', (r as any).id).order('created_at'),
      supabase.from('called_words').select('*').eq('room_id', (r as any).id).order('turn_number'),
      supabase.from('word_requests').select('*').eq('room_id', (r as any).id).eq('status', 'pending'),
    ]);

    if (playersRes.data) setPlayers(playersRes.data as unknown as GamePlayer[]);
    if (wordsRes.data) setCalledWords(wordsRes.data as unknown as CalledWord[]);
    if (reqsRes.data) setWordRequests(reqsRes.data as unknown as WordRequest[]);
  }, [roomCode]);

  useEffect(() => {
    if (!playerId || !roomCode) { navigate('/'); return; }
    fetchAll();

    const channel = supabase.channel(`game-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'called_words' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'word_requests' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode, playerId, navigate, fetchAll]);

  useEffect(() => {
    if (room?.status === 'finished') {
      navigate(`/result/${roomCode}`);
    }
  }, [room?.status, roomCode, navigate]);

  const markWordForAllPlayers = async (word: string) => {
    if (!room) return;
    const updates: (() => Promise<any>)[] = [];
    let winnersCount = 0;

    for (const player of players) {
      const boardData = player.board_data as string[];
      const markedCells = [...(player.marked_cells as boolean[])];
      let changed = false;

      boardData.forEach((w, idx) => {
        if (w === word && !markedCells[idx]) {
          markedCells[idx] = true;
          changed = true;
        }
      });

      if (changed) {
        const { count: bingoCount } = checkBingos(markedCells, room.board_size);
        const prevBingo = player.bingo_count;
        const updateData: any = { marked_cells: markedCells, bingo_count: bingoCount };

        if (bingoCount > prevBingo) {
          updateData.last_bingo_at = new Date().toISOString();
        }
        if (bingoCount >= room.win_condition && player.rank === null) {
          // Count existing winners
          const existingWinners = players.filter(p => p.rank !== null).length;
          updateData.rank = existingWinners + 1;
          winnersCount = existingWinners + 1;
        }

        updates.push(
          async () => { await supabase.from('game_players').update(updateData).eq('id', player.id); }
        );
      }
    }

    await Promise.all(updates.map(fn => fn()));

    // Check end condition
    const totalWinners = players.filter(p => p.rank !== null).length + winnersCount;
    if (totalWinners >= room.end_condition) {
      await supabase.from('game_rooms').update({ status: 'finished' } as any).eq('id', room.id);
    }
  };

  const handleCellClick = async (playerIdx: number, cellIdx: number) => {
    const targetPlayer = players[playerIdx];
    if (!targetPlayer || !room || !myPlayer) return;

    const word = (targetPlayer.board_data as string[])[cellIdx];
    if (!word) return;

    // My turn: call the word (only on own board)
    if (isMyTurn && targetPlayer.id === playerId) {
      // Insert called word
      await supabase.from('called_words').insert({
        room_id: room.id,
        word,
        called_by: playerId,
        turn_number: calledWords.length,
      } as any);

      // Mark for all players
      await markWordForAllPlayers(word);

      // Advance turn
      const nextIndex = (room.current_turn_index + 1) % room.turn_order.length;
      await supabase.from('game_rooms').update({ current_turn_index: nextIndex } as any).eq('id', room.id);

      toast.success(`"${word}" 발표!`);
    }
    // Not my turn, on my own board: request approval
    else if (!isMyTurn && targetPlayer.id === playerId) {
      const lastCalledWord = calledWords[calledWords.length - 1]?.word || '';
      if (!lastCalledWord) { toast.error("아직 발표된 단어가 없습니다"); return; }

      // Check if already requested
      const existing = wordRequests.find(r => r.word === word && r.status === 'pending');
      if (existing) { toast.info("이미 요청된 단어입니다"); return; }

      await supabase.from('word_requests').insert({
        room_id: room.id,
        requester_id: playerId,
        requester_name: myPlayer.player_name,
        word,
        called_word: lastCalledWord,
      } as any);

      toast.success(`"${word}" 인정 요청을 보냈습니다`);
    }
  };

  const handleApprove = async (request: WordRequest) => {
    await supabase.from('word_requests').update({ status: 'approved' } as any)
      .eq('word', request.word)
      .eq('called_word', request.called_word)
      .eq('status', 'pending');

    await markWordForAllPlayers(request.word);
    toast.success(`"${request.word}" 인정!`);
  };

  const handleReject = async (request: WordRequest) => {
    await supabase.from('word_requests').update({ status: 'rejected' } as any)
      .eq('word', request.word)
      .eq('called_word', request.called_word)
      .eq('status', 'pending');
    toast.info(`"${request.word}" 거절됨`);
  };

  if (!room || !myPlayer) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-primary">🎯 도전 빙고왕!</h1>
          <span className="text-sm text-muted-foreground">주제: {room.topic}</span>
        </div>

        {/* Turn indicator */}
        <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            <span className="font-bold">
              {isMyTurn ? "🎉 내 차례!" : `${currentTurnPlayer?.player_name || ''}의 차례`}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            우승 조건: {room.win_condition}빙고 | 종료: {room.end_condition}명 우승 시
          </div>
        </div>

        {/* Called words */}
        {calledWords.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <span className="text-xs font-bold text-muted-foreground mb-2 block">📢 발표된 단어</span>
            <div className="flex flex-wrap gap-1.5">
              {calledWords.map((w, i) => (
                <span key={w.id} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                  {i + 1}. {w.word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Word request panel (host only) */}
        {isHost && (
          <WordRequestPanel
            requests={wordRequests}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {/* Bingo boards grid */}
        <div className={`grid gap-4 ${
          players.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
          players.length <= 4 ? 'grid-cols-2' :
          'grid-cols-2 lg:grid-cols-3'
        }`}>
          {players.map((player, playerIdx) => (
            <BingoBoard
              key={player.id}
              size={room.board_size}
              boardData={player.board_data as string[]}
              markedCells={player.marked_cells as boolean[]}
              isOwn={player.id === playerId}
              isHost={isHost}
              isClickable={
                (isMyTurn && player.id === playerId) ||
                (!isMyTurn && player.id === playerId)
              }
              highlight={player.id === currentTurnPlayerId}
              playerName={`${player.is_host ? '👑 ' : ''}${player.player_name}${player.rank ? ` 🏆${player.rank}위` : ''}`}
              bingoCount={player.bingo_count}
              onCellClick={(cellIdx) => handleCellClick(playerIdx, cellIdx)}
            />
          ))}
        </div>

        {/* Player ranking summary */}
        <div className="bg-card border border-border rounded-xl p-3">
          <span className="text-xs font-bold text-muted-foreground mb-2 block">🏆 현황</span>
          <div className="flex flex-wrap gap-3">
            {players
              .sort((a, b) => b.bingo_count - a.bingo_count)
              .map(p => (
                <div key={p.id} className="text-sm">
                  <span className="font-medium">{p.player_name}</span>
                  <span className="text-primary ml-1 font-bold">{p.bingo_count}빙고</span>
                  {p.rank && <span className="ml-1 text-primary">🏆{p.rank}위</span>}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
