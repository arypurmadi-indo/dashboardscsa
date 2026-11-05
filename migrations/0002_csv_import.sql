CREATE TABLE IF NOT EXISTS import_batches (
 id TEXT PRIMARY KEY, course_key TEXT NOT NULL, course_name TEXT NOT NULL,
 uploaded_at INTEGER NOT NULL, profile_count INTEGER NOT NULL DEFAULT 0,
 progress_count INTEGER NOT NULL DEFAULT 0, matched_count INTEGER NOT NULL DEFAULT 0,
 unmatched_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'success',
 profile_filename TEXT, progress_filename TEXT
);
CREATE INDEX IF NOT EXISTS idx_batches_course_date ON import_batches(course_key, uploaded_at DESC);
CREATE TABLE IF NOT EXISTS imported_participants (
 batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
 email TEXT NOT NULL, fullname TEXT NOT NULL DEFAULT '', group_name TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(batch_id,email)
);
CREATE INDEX IF NOT EXISTS idx_participants_email ON imported_participants(email);
CREATE TABLE IF NOT EXISTS imported_activities (
 batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
 email TEXT NOT NULL, activity_key TEXT NOT NULL, activity_name TEXT NOT NULL,
 status TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(batch_id,email,activity_key)
);
CREATE INDEX IF NOT EXISTS idx_activities_batch_email ON imported_activities(batch_id,email);
CREATE TABLE IF NOT EXISTS imported_progress (
 batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
 email TEXT NOT NULL, activities_json TEXT NOT NULL,
 total_activities INTEGER NOT NULL DEFAULT 0, completed_activities INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(batch_id,email)
);
CREATE INDEX IF NOT EXISTS idx_progress_batch_email ON imported_progress(batch_id,email);
