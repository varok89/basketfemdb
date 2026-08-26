import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
export const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function fetchAll(table, opts = {}) {
  const { order = "id", ascending = true, select = "*", filter = null } = opts;
  let all = [], from = 0;
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(select).order(order, { ascending }).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return { data: all };
}
