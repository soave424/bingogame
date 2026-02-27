export interface GameRoom {
  id: string;
  room_code: string;
  topic: string;
  board_size: number;
  win_condition: number;
  end_condition: number;
  word_list_enabled: boolean;
  word_list: string[];
  status: 'waiting' | 'playing' | 'finished';
  current_turn_index: number;
  turn_order: string[];
  created_at: string;
}

export interface GamePlayer {
  id: string;
  room_id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  board_data: string[];
  marked_cells: boolean[];
  bingo_count: number;
  last_bingo_at: string | null;
  rank: number | null;
  created_at: string;
}

export interface CalledWord {
  id: string;
  room_id: string;
  word: string;
  called_by: string;
  turn_number: number;
  created_at: string;
}

export interface WordRequest {
  id: string;
  room_id: string;
  requester_id: string;
  requester_name: string;
  word: string;
  called_word: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
