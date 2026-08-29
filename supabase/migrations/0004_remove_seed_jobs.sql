-- Remove the mock job postings (example.com seed data). Jobs are now fetched
-- live from Remotive in src/lib/jobs.ts, so the placeholder rows are obsolete.
delete from public.job_postings where source = 'seed';
