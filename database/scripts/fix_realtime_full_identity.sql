-- Set replica identity to full to ensure all columns are sent in realtime payloads
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Double check that the table is in the publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;
