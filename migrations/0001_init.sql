PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 username TEXT NOT NULL UNIQUE,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role='manager'),
 status TEXT NOT NULL DEFAULT 'active',
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
CREATE TABLE IF NOT EXISTS courses(
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 shortname TEXT NOT NULL UNIQUE,
 source TEXT NOT NULL DEFAULT 'moodle',
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS course_groups(
 id INTEGER PRIMARY KEY,
 course_id INTEGER NOT NULL REFERENCES courses(id),
 group_name TEXT NOT NULL,
 source_type TEXT NOT NULL DEFAULT 'group',
 updated_at INTEGER NOT NULL,
 UNIQUE(course_id,group_name)
);
CREATE TABLE IF NOT EXISTS group_members(
 group_id INTEGER NOT NULL REFERENCES course_groups(id),
 moodle_user_id INTEGER NOT NULL,
 fullname TEXT,
 email TEXT,
 PRIMARY KEY(group_id,moodle_user_id)
);
CREATE TABLE IF NOT EXISTS activity_completion(
 id TEXT PRIMARY KEY,
 course_id INTEGER NOT NULL REFERENCES courses(id),
 group_id INTEGER REFERENCES course_groups(id),
 moodle_user_id INTEGER NOT NULL,
 activity_id INTEGER NOT NULL,
 activity_name TEXT NOT NULL,
 completion_state INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(course_id,moodle_user_id,activity_id)
);
CREATE TABLE IF NOT EXISTS sync_logs(
 id TEXT PRIMARY KEY,
 source TEXT NOT NULL,
 status TEXT NOT NULL,
 message TEXT,
 created_at INTEGER NOT NULL
);
