-- Rebuild leaderboard from scratch
DROP FUNCTION IF EXISTS public.get_rank(integer);
DROP FUNCTION IF EXISTS public.submit_score(uuid, text, integer);
DROP TABLE IF EXISTS public.leaderboard;

CREATE TABLE public.leaderboard (
  player_id uuid PRIMARY KEY,
  player_name text NOT NULL,
  best_score integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT ALL ON public.leaderboard TO service_role;

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard is publicly readable"
  ON public.leaderboard FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.submit_score(
  p_player_id uuid,
  p_player_name text,
  p_score integer,
  p_level integer
)
RETURNS TABLE(best_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_best integer;
BEGIN
  IF p_player_id IS NULL OR p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;
  v_name := btrim(coalesce(p_player_name, ''));
  IF char_length(v_name) < 1 THEN v_name := 'Player'; END IF;
  IF char_length(v_name) > 24 THEN v_name := substr(v_name, 1, 24); END IF;

  INSERT INTO public.leaderboard (player_id, player_name, best_score, level, updated_at)
  VALUES (p_player_id, v_name, p_score, coalesce(p_level, 1), now())
  ON CONFLICT (player_id) DO UPDATE
    SET best_score = GREATEST(public.leaderboard.best_score, EXCLUDED.best_score),
        level = CASE WHEN EXCLUDED.best_score > public.leaderboard.best_score
                     THEN EXCLUDED.level ELSE public.leaderboard.level END,
        player_name = EXCLUDED.player_name,
        updated_at = CASE WHEN EXCLUDED.best_score > public.leaderboard.best_score
                          THEN now() ELSE public.leaderboard.updated_at END;

  SELECT l.best_score INTO v_best FROM public.leaderboard l WHERE l.player_id = p_player_id;
  RETURN QUERY SELECT v_best;
END;
$$;