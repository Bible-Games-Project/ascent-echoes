DROP FUNCTION IF EXISTS public.submit_score(uuid, text, integer, integer);

GRANT INSERT, UPDATE ON public.leaderboard TO anon, authenticated;

CREATE POLICY "Anyone can insert leaderboard rows"
  ON public.leaderboard FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update leaderboard rows"
  ON public.leaderboard FOR UPDATE
  USING (true) WITH CHECK (true);