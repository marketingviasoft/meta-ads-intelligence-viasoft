declare module "@/lib/supabaseClient.js" {
  type SupabaseSelectChain = {
    eq: (...args: unknown[]) => SupabaseSelectChain;
    gte: (...args: unknown[]) => SupabaseSelectChain;
    lte: (...args: unknown[]) => SupabaseSelectChain;
    order: (...args: unknown[]) => SupabaseSelectChain;
    range: (...args: unknown[]) => Promise<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
    limit: (...args: unknown[]) => SupabaseSelectChain;
    maybeSingle: () => Promise<{
      data: unknown | null;
      error: { message: string } | null;
    }>;
  };

  export const supabase: {
    from: (table: string) => {
      select: (...args: unknown[]) => SupabaseSelectChain;
      upsert: (...args: unknown[]) => Promise<{ error: { message: string } | null }>;
    };
  };
}
