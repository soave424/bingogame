
-- Game rooms table
CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  topic text NOT NULL DEFAULT '',
  board_size int NOT NULL DEFAULT 5,
  win_condition int NOT NULL DEFAULT 1,
  end_condition int NOT NULL DEFAULT 1,
  word_list_enabled boolean NOT NULL DEFAULT false,
  word_list jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'waiting',
  current_turn_index int NOT NULL DEFAULT 0,
  turn_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Game players table
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE NOT NULL,
  player_name text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  is_ready boolean NOT NULL DEFAULT false,
  board_data jsonb DEFAULT '[]'::jsonb,
  marked_cells jsonb DEFAULT '[]'::jsonb,
  bingo_count int NOT NULL DEFAULT 0,
  last_bingo_at timestamptz,
  rank int,
  created_at timestamptz DEFAULT now()
);

-- Called words table
CREATE TABLE public.called_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE NOT NULL,
  word text NOT NULL,
  called_by uuid REFERENCES public.game_players(id),
  turn_number int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Word approval requests table
CREATE TABLE public.word_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES public.game_players(id) ON DELETE CASCADE NOT NULL,
  requester_name text NOT NULL DEFAULT '',
  word text NOT NULL,
  called_word text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.called_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_requests ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for this game)
CREATE POLICY "Allow all on game_rooms" ON public.game_rooms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_players" ON public.game_players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on called_words" ON public.called_words FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on word_requests" ON public.word_requests FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable realtime for all game tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.called_words;
ALTER PUBLICATION supabase_realtime ADD TABLE public.word_requests;
