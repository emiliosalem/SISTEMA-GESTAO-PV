import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chaveAnonima) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas em .env.local"
  );
}

export const supabase = createClient(url, chaveAnonima);
