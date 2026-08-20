-- Seed mock job postings, matched by min_level_index (the roadmap level a candidate must reach)
insert into public.job_postings (title, company, url, min_level_index, source)
values
  ('Junior Frontend Developer', 'Acme Corp', 'https://example.com/jobs/junior-frontend', 0, 'seed'),
  ('Frontend Developer', 'Globex', 'https://example.com/jobs/frontend', 1, 'seed'),
  ('Frontend Engineer II', 'Initech', 'https://example.com/jobs/fe-ii', 2, 'seed'),
  ('Senior Frontend Engineer', 'Hooli', 'https://example.com/jobs/senior-fe', 3, 'seed'),
  ('Staff Frontend Engineer', 'Umbrella', 'https://example.com/jobs/staff-fe', 4, 'seed'),
  ('Engineering Manager, Web', 'Stark Industries', 'https://example.com/jobs/em-web', 5, 'seed');
