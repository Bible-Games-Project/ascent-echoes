
CREATE TABLE public.leaderboard (
  player_id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leaderboard_best_score_desc_idx
  ON public.leaderboard (best_score DESC, updated_at ASC);

GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT ALL ON public.leaderboard TO service_role;

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard is publicly readable"
  ON public.leaderboard
  FOR SELECT
  USING (true);

-- Submit a score; only updates when the new score beats the current best.
CREATE OR REPLACE FUNCTION public.submit_score(
  p_player_id uuid,
  p_name text,
  p_score integer
)
RETURNS TABLE (best_score integer, rank integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_best integer;
  v_rank integer;
BEGIN
  IF p_player_id IS NULL OR p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  v_name := btrim(coalesce(p_name, ''));
  IF char_length(v_name) < 1 THEN
    v_name := 'Player';
  END IF;
  IF char_length(v_name) > 24 THEN
    v_name := substr(v_name, 1, 24);
  END IF;

  INSERT INTO public.leaderboard (player_id, name, best_score, updated_at)
  VALUES (p_player_id, v_name, p_score, now())
  ON CONFLICT (player_id) DO UPDATE
    SET best_score = GREATEST(public.leaderboard.best_score, EXCLUDED.best_score),
        name = EXCLUDED.name,
        updated_at = CASE
          WHEN EXCLUDED.best_score > public.leaderboard.best_score THEN now()
          ELSE public.leaderboard.updated_at
        END;

  SELECT l.best_score INTO v_best
  FROM public.leaderboard l
  WHERE l.player_id = p_player_id;

  SELECT count(*) + 1 INTO v_rank
  FROM public.leaderboard l
  WHERE l.best_score > v_best;

  RETURN QUERY SELECT v_best, v_rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_score(uuid, text, integer) TO anon, authenticated;

-- Get world rank for an arbitrary score.
CREATE OR REPLACE FUNCTION public.get_rank(p_score integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int + 1
  FROM public.leaderboard
  WHERE best_score > coalesce(p_score, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_rank(integer) TO anon, authenticated;
