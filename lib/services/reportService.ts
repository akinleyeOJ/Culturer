import { supabase } from '../supabase';

export interface Report {
    id: string;
    reporter_id: string;
    reported_user_id: string;
    content_id?: string;
    reason: string;
    details?: string;
    status: 'pending' | 'reviewed' | 'resolved';
    created_at: string;
    reporter?: {
        full_name: string;
        username: string;
        avatar_url: string;
    };
    reported_user?: {
        full_name: string;
        username: string;
        avatar_url: string;
    };
}

export const fetchAllReports = async () => {
    const { data, error } = await supabase
        .from('reports' as any)
        .select(`
            *,
            reporter:reporter_id(full_name, username, avatar_url),
            reported_user:reported_user_id(full_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all reports:', error);
        return { success: false, error };
    }

    return { success: true, data: data as unknown as Report[] };
};

export const updateReportStatus = async (reportId: string, status: 'pending' | 'reviewed' | 'resolved') => {
    const { error } = await supabase
        .from('reports' as any)
        .update({ status })
        .eq('id', reportId);

    if (error) {
        console.error('Error updating report status:', error);
        return { success: false, error };
    }

    return { success: true };
};
