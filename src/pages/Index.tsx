import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, parseWordList, setPlayerId } from "@/lib/gameUtils";
import { Crown, Users } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const [topic, setTopic] = useState("");
  const [boardSize, setBoardSize] = useState("5");
  const [winCondition, setWinCondition] = useState("1");
  const [endCondition, setEndCondition] = useState("1");
  const [wordListEnabled, setWordListEnabled] = useState(false);
  const [wordListInput, setWordListInput] = useState("");
  const [hostName, setHostName] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  const handleCreate = async () => {
    if (!hostName.trim()) { toast.error("닉네임을 입력해주세요"); return; }
    if (!topic.trim()) { toast.error("빙고 주제를 입력해주세요"); return; }

    const size = parseInt(boardSize);
    let wordList: string[] = [];
    if (wordListEnabled) {
      wordList = parseWordList(wordListInput);
      if (wordList.length < size * size) {
        toast.error(`단어가 최소 ${size * size}개 필요합니다 (현재 ${wordList.length}개)`);
        return;
      }
      const unique = new Set(wordList);
      if (unique.size !== wordList.length) {
        toast.error("단어 목록에 중복된 단어가 있습니다");
        return;
      }
    }

    setCreating(true);
    try {
      const roomCode = generateRoomCode();
      const playerId = crypto.randomUUID();

      const { error: roomError } = await supabase.from('game_rooms').insert({
        room_code: roomCode,
        topic: topic.trim(),
        board_size: size,
        win_condition: parseInt(winCondition),
        end_condition: parseInt(endCondition),
        word_list_enabled: wordListEnabled,
        word_list: wordList,
      } as any);

      if (roomError) throw roomError;

      const { data: room } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();

      if (!room) throw new Error("방 생성 실패");

      const { error: playerError } = await supabase.from('game_players').insert({
        id: playerId,
        room_id: (room as any).id,
        player_name: hostName.trim(),
        is_host: true,
      } as any);

      if (playerError) throw playerError;

      setPlayerId(roomCode, playerId);
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      toast.error("방 생성 실패: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinName.trim()) { toast.error("닉네임을 입력해주세요"); return; }
    if (!joinCode.trim()) { toast.error("방 코드를 입력해주세요"); return; }

    setJoining(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const { data: room } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', code)
        .single();

      if (!room) { toast.error("존재하지 않는 방 코드입니다"); setJoining(false); return; }
      if ((room as any).status !== 'waiting') { toast.error("이미 시작된 게임입니다"); setJoining(false); return; }

      const { data: existingPlayers } = await supabase
        .from('game_players')
        .select('player_name')
        .eq('room_id', (room as any).id);

      if (existingPlayers?.some((p: any) => p.player_name === joinName.trim())) {
        toast.error("이미 사용 중인 닉네임입니다");
        setJoining(false);
        return;
      }

      const playerId = crypto.randomUUID();
      const { error } = await supabase.from('game_players').insert({
        id: playerId,
        room_id: (room as any).id,
        player_name: joinName.trim(),
        is_host: false,
      } as any);

      if (error) throw error;

      setPlayerId(code, playerId);
      navigate(`/room/${code}`);
    } catch (err: any) {
      toast.error("참여 실패: " + err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">🎯 도전 빙고왕!</h1>
          <p className="text-muted-foreground">친구들과 함께 즐기는 실시간 빙고 게임</p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="gap-2"><Crown className="w-4 h-4" />방 만들기</TabsTrigger>
            <TabsTrigger value="join" className="gap-2"><Users className="w-4 h-4" />참여하기</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div>
              <Label>닉네임</Label>
              <Input placeholder="호스트 닉네임" value={hostName} onChange={e => setHostName(e.target.value)} />
            </div>
            <div>
              <Label>빙고 주제</Label>
              <Input placeholder="예: 음식, 영화, K-POP" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>빙고판 크기</Label>
                <Select value={boardSize} onValueChange={setBoardSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3×3</SelectItem>
                    <SelectItem value="4">4×4</SelectItem>
                    <SelectItem value="5">5×5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>우승 빙고 수</Label>
                <Select value={winCondition} onValueChange={setWinCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}줄</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>종료 우승자 수</Label>
                <Select value={endCondition} onValueChange={setEndCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}명</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={wordListEnabled} onCheckedChange={setWordListEnabled} />
              <Label>단어 목록 제공</Label>
            </div>
            {wordListEnabled && (
              <div>
                <Label>단어 목록 (쉼표/줄바꿈 구분 또는 숫자 범위 예: 1-25)</Label>
                <Textarea
                  placeholder="사과, 바나나, 포도... 또는 1-25"
                  value={wordListInput}
                  onChange={e => setWordListInput(e.target.value)}
                  rows={4}
                />
              </div>
            )}
            <Button onClick={handleCreate} disabled={creating} className="w-full" size="lg">
              {creating ? "생성 중..." : "방 만들기"}
            </Button>
          </TabsContent>

          <TabsContent value="join" className="space-y-4 mt-4">
            <div>
              <Label>닉네임</Label>
              <Input placeholder="게임에서 사용할 닉네임" value={joinName} onChange={e => setJoinName(e.target.value)} />
            </div>
            <div>
              <Label>방 코드</Label>
              <Input placeholder="6자리 방 코드" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} />
            </div>
            <Button onClick={handleJoin} disabled={joining} className="w-full" size="lg">
              {joining ? "참여 중..." : "참여하기"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
