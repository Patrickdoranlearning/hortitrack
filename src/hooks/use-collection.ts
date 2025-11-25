"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCollection<T = any>(table: string, initialData?: T[]) {
    const [data, setData] = useState<T[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<Error | null>(null);

    const supabase = createClient();

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                const { data: result, error } = await supabase.from(table).select("*");
                if (error) throw error;
                if (mounted) {
                    // Map snake_case to camelCase if needed? 
                    // For now, assuming the types match or we accept snake_case in components.
                    // Ideally we should map. Let's assume the components might expect camelCase if they were using Firebase + custom mapping.
                    // But Supabase returns what's in DB.
                    // Let's return raw data for now and see if we need mapping.
                    // Actually, looking at previous files, mapping was done manually.
                    // Let's just return the data.
                    setData(result as unknown as T[]);
                    setError(null);
                }
            } catch (err: any) {
                if (mounted) setError(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        // Realtime subscription could be added here
        // const channel = supabase.channel(table).on(...)

        return () => {
            mounted = false;
        };
    }, [table]);

    const forceRefresh = async () => {
        const { data: result, error } = await supabase.from(table).select("*");
        if (!error && result) {
            setData(result as unknown as T[]);
        }
    };

    return { data, loading, error, forceRefresh };
}
