CREATE OR REPLACE FUNCTION public.enforce_article_owner_insert_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND public.current_user_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only owner can insert published articles';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER enforce_article_owner_insert_guard
BEFORE INSERT ON public.articles FOR EACH ROW
EXECUTE FUNCTION public.enforce_article_owner_insert_guard();
