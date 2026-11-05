const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...cors
  }
});

const fail = (m, s = 400) => json({ error: m }, s);
const now = () => Math.floor(Date.now() / 1000);
const norm = x => String(x ?? "").trim();

async function hash(p, s) {
  const e = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw", e.encode(p), "PBKDF2", false, ["deriveBits"]
  );

  const b = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: e.encode(s),
    iterations: 100000,
    hash: "SHA-256"
  }, k, 256);

  return [...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function sha(x) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(x)
  );

  return [...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function current(req, env) {
  const c = req.headers.get("Cookie") || "";
  const t = c.match(/scsa_session=([^;]+)/)?.[1];

  if (!t) return null;

  return await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'"
  ).bind(await sha(decodeURIComponent(t)), now()).first();
}

const setCookie = (v, a) =>
  `scsa_session=${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${a}`;

async function role(req, env) {
  const u = await current(req, env);
  return u && u.role === "manager" ? u : null;
}

/* =========================================
   DAFTAR 13 COURSE SCSA
========================================= */

const COURSE_LIST = [
  ["intuisi-bilangan", "Intuisi Bilangan"],
  ["koneksi", "Koneksi"],
  ["nilai-tempat-makna-bilangan", "Nilai Tempat dan Makna Bilangan"],
  ["pecahan", "Pecahan"],
  ["pedagogi-pembelajaran-matematika", "Pedagogi Pembelajaran Matematika"],
  ["pembelajaran-matematika-bermakna", "Pembelajaran Matematika Bermakna"],
  ["pemecahan-masalah", "Pemecahan Masalah"],
  ["penalaran-pembuktian", "Penalaran dan Pembuktian"],
  ["pengenalan-elemen-proses-matematika", "Pengenalan Elemen Proses Matematika"],
  ["penjumlahan-pengurangan", "Penjumlahan dan Pengurangan"],
  ["perkalian-pembagian", "Perkalian dan Pembagian"],
  ["pola-dasar-penalaran-matematis", "Pola sebagai Dasar Penalaran Matematis"],
  ["representasi-matematis", "Representasi Matematis"]
];

/* =========================================
   PEMBACA CSV
========================================= */

function csvRows(text) {
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  const first = input.split(/\r?\n/, 1)[0] || "";

  const delim =
    (first.match(/;/g) || []).length >
    (first.match(/,/g) || []).length ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));

      if (row.some(v => v.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  row.push(field.replace(/\r$/, ""));

  if (row.some(v => v.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

const key = s => String(s ?? "")
  .replace(/^\uFEFF/, "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

/* =========================================
   PARSER PROFIL PESERTA
========================================= */

function parseProfile(text) {
  const rows = csvRows(text);

  if (rows.length < 2) {
    throw new Error(
      "CSV profil kosong atau tidak memiliki baris peserta."
    );
  }

  const h = rows[0].map(key);

  const ixEmail = h.indexOf("email address");
  const ixFirst = h.indexOf("first name");
  const ixLast = h.indexOf("last name");
  const ixGroup = h.indexOf("groups");

  if (
    ixEmail < 0 ||
    ixFirst < 0 ||
    ixLast < 0 ||
    ixGroup < 0
  ) {
    throw new Error(
      "Kolom CSV profil tidak sesuai. Wajib ada: First name, Last name, Email address, Groups."
    );
  }

  const people = new Map();

  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const email = norm(r[ixEmail]).toLowerCase();

    if (!email) continue;

    const fullname = [
      norm(r[ixFirst]),
      norm(r[ixLast])
    ].filter(x => x && x !== "-").join(" ").trim();

    const group = norm(r[ixGroup]);
    const old = people.get(email);

    if (!old) {
      people.set(email, {
        email,
        fullname,
        group
      });
    } else {
      if (!old.group && group) {
        old.group = group;

        if (fullname) {
          old.fullname = fullname;
        }
      } else if (
        (!old.fullname || old.fullname === "-") &&
        fullname
      ) {
        old.fullname = fullname;
      }
    }
  }

  if (!people.size) {
    throw new Error(
      "Tidak ada email peserta yang valid pada CSV profil."
    );
  }

  return [...people.values()];
}

/* =========================================
   PARSER PROGRESS AKTIVITAS
========================================= */

function parseProgress(text) {
  const rows = csvRows(text);

  if (rows.length < 2) {
    throw new Error(
      "CSV progress kosong atau tidak memiliki baris peserta."
    );
  }

  const h = rows[0].map(x => norm(x));

  const emailIx = h.findIndex(
    x => key(x) === "email address"
  );

  if (emailIx < 0) {
    throw new Error(
      "Kolom Email address tidak ditemukan pada CSV progress."
    );
  }

  const activityCols = [];

  for (let i = emailIx + 1; i < h.length; i++) {
    const name = norm(h[i]);

    if (!name) continue;

    const next =
      i + 1 < h.length ? norm(h[i + 1]) : "";

    activityCols.push({
      index: i,
      name,
      completedAtIndex:
        next === "" && i + 1 < h.length ? i + 1 : -1
    });
  }

  if (!activityCols.length) {
    throw new Error(
      "Tidak ditemukan kolom aktivitas setelah Email address."
    );
  }

  const byEmail = new Map();

  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const email = norm(r[emailIx]).toLowerCase();

    if (!email) continue;

    let items = byEmail.get(email);

    if (!items) {
      items = new Map();
      byEmail.set(email, items);
    }

    for (const c of activityCols) {
      const status =
        norm(r[c.index]) || "Not completed";

      const completed_at =
        c.completedAtIndex >= 0
          ? norm(r[c.completedAtIndex])
          : "";

      items.set(c.name, {
        activity: c.name,
        status,
        completed_at
      });
    }
  }

  const out = [];

  for (const [email, m] of byEmail) {
    for (const item of m.values()) {
      out.push({
        email,
        ...item
      });
    }
  }

  return out;
}

/* =========================================
   SIMPAN DATA DALAM BATCH
========================================= */

async function insertChunks(
  db,
  items,
  makeStmt,
  chunkSize = 80
) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = items.slice(i, i + chunkSize);

    await db.batch(
      batch.map(makeStmt)
    );
  }
}

/* =========================================
   API UTAMA SCSA
========================================= */

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const path = new URL(req.url).pathname;

    try {

      /* HEALTH CHECK */

      if (path === "/api/health") {
        return json({
          ok: true,
          product: "SCSA Monitoring Dashboard CSV",
          build: "CSV-PARSER-FIX-20261105"
        });
      }

      /* LOGIN */

      if (
        path === "/api/auth/login" &&
        req.method === "POST"
      ) {
        const b = await req.json();

        const id = norm(b.identity).toLowerCase();
        const pw = String(b.password || "");

        const u = await env.DB.prepare(
          "SELECT * FROM users WHERE lower(email)=? OR lower(username)=?"
        ).bind(id, id).first();

        if (
          !u ||
          u.role !== "manager" ||
          u.status !== "active" ||
          await hash(pw, u.password_salt) !== u.password_hash
        ) {
          return fail(
            "Username/email atau password tidak valid.",
            401
          );
        }

        const t =
          crypto.randomUUID() + crypto.randomUUID();

        await env.DB.prepare(
          "INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)"
        ).bind(
          crypto.randomUUID(),
          u.id,
          await sha(t),
          now() + 43200,
          now()
        ).run();

        return new Response(
          JSON.stringify({ ok: true }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": setCookie(t, 43200),
              ...cors
            }
          }
        );
      }

      /* LOGOUT */

      if (
        path === "/api/auth/logout" &&
        req.method === "POST"
      ) {
        const c = req.headers.get("Cookie") || "";
        const t = c.match(/scsa_session=([^;]+)/)?.[1];

        if (t) {
          await env.DB.prepare(
            "DELETE FROM sessions WHERE token_hash=?"
          ).bind(
            await sha(decodeURIComponent(t))
          ).run();
        }

        return new Response(
          JSON.stringify({ ok: true }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": setCookie("", 0),
              ...cors
            }
          }
        );
      }

      /* CEK SESSION */

      if (path === "/api/auth/me") {
        const u = await current(req, env);

        return u
          ? json({ user: u })
          : fail("Belum login.", 401);
      }

      /* BOOTSTRAP MANAGER */

      if (
        path === "/api/manager/bootstrap" &&
        req.method === "POST"
      ) {
        if (
          !env.BOOTSTRAP_SECRET ||
          req.headers.get("X-Bootstrap-Secret") !==
            env.BOOTSTRAP_SECRET
        ) {
          return fail("Tidak diizinkan.", 403);
        }

        const b = await req.json();

        if (
          !b.name ||
          !b.email ||
          !b.username ||
          !b.password ||
          String(b.password).length < 12
        ) {
          return fail(
            "Lengkapi data. Password minimal 12 karakter."
          );
        }

        const id = crypto.randomUUID();
        const salt = crypto.randomUUID();
        const ph = await hash(b.password, salt);

        try {
          await env.DB.prepare(
            "INSERT INTO users(id,name,email,username,password_salt,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,'manager','active',?)"
          ).bind(
            id,
            b.name,
            b.email,
            b.username,
            salt,
            ph,
            now()
          ).run();
        } catch {
          return fail(
            "Email atau username sudah digunakan."
          );
        }

        return json({
          ok: true,
          message: "Akun Manager Dashboard dibuat."
        });
      }

      /* =========================================
         API DASHBOARD PUBLIK (TANPA LOGIN)
         Hanya mengirim data agregat, tanpa email/nama peserta.
      ========================================= */

      if (path === "/api/public/overview" && req.method === "GET") {
        const d = await env.DB.prepare(
          "SELECT p.email,p.group_name,COALESCE(a.total_activities,0) total,COALESCE(a.completed_activities,0) completed FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at JOIN imported_participants p ON p.batch_id=b.id LEFT JOIN imported_progress a ON a.batch_id=p.batch_id AND a.email=p.email"
        ).all();

        const participants = new Set();
        const districts = new Set();
        let total = 0;
        let completed = 0;

        for (const r of d.results || []) {
          if (r.email) participants.add(r.email);
          const group = norm(r.group_name);
          if (group) districts.add(group);
          total += Number(r.total || 0);
          completed += Number(r.completed || 0);
        }

        const uploaded = await env.DB.prepare(
          "SELECT COUNT(DISTINCT course_key) n FROM import_batches"
        ).first();

        return json({
          metrics: {
            participants: participants.size,
            courses: Number(uploaded?.n || 0),
            totalCourses: COURSE_LIST.length,
            districts: districts.size,
            completion: total ? Math.round(completed * 100 / total) : 0,
            completed,
            total
          },
          lastSync: await env.DB.prepare(
            "SELECT created_at,message FROM sync_logs WHERE source='csv-import' ORDER BY created_at DESC LIMIT 1"
          ).first()
        });
      }

      if (path === "/api/public/courses" && req.method === "GET") {
        const latest = await env.DB.prepare(
          "SELECT b.* FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at"
        ).all();
        const byCourse = new Map((latest.results || []).map(b => [b.course_key, b]));
        const courses = [];

        for (const [course_key, course_name] of COURSE_LIST) {
          const b = byCourse.get(course_key);
          if (!b) {
            courses.push({ course_key, course_name, uploaded: false, profile_count: 0, total: 0, completed: 0, completion: 0 });
            continue;
          }
          const a = await env.DB.prepare(
            "SELECT COALESCE(SUM(total_activities),0) total,COALESCE(SUM(completed_activities),0) completed FROM imported_progress WHERE batch_id=?"
          ).bind(b.id).first();
          const total = Number(a?.total || 0);
          const completed = Number(a?.completed || 0);
          courses.push({
            course_key, course_name, uploaded: true,
            profile_count: Number(b.profile_count || 0),
            total, completed,
            completion: total ? Math.round(completed * 100 / total) : 0
          });
        }
        return json({ courses });
      }

      if (path === "/api/public/groups" && req.method === "GET") {
        const selectedCourse = norm(new URL(req.url).searchParams.get("course"));
        let sql = "SELECT p.email,p.group_name,COALESCE(a.total_activities,0) total,COALESCE(a.completed_activities,0) completed FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at JOIN imported_participants p ON p.batch_id=b.id LEFT JOIN imported_progress a ON a.batch_id=p.batch_id AND a.email=p.email";
        const params = [];
        if (selectedCourse) { sql += " WHERE b.course_key=?"; params.push(selectedCourse); }
        const d = await env.DB.prepare(sql).bind(...params).all();
        const grouped = new Map();

        for (const r of d.results || []) {
          const name = norm(r.group_name) || "Belum Terpetakan";
          if (!grouped.has(name)) grouped.set(name, { name, emails: new Set(), total: 0, completed: 0 });
          const g = grouped.get(name);
          if (r.email) g.emails.add(r.email);
          g.total += Number(r.total || 0);
          g.completed += Number(r.completed || 0);
        }

        const groups = [...grouped.values()].map(g => ({
          name: g.name,
          participants: g.emails.size,
          total: g.total,
          completed: g.completed,
          completion: g.total ? Math.round(g.completed * 100 / g.total) : 0
        })).sort((a,b) => a.name.localeCompare(b.name, "id"));
        return json({ groups });
      }

      /* OTORISASI MANAGER */

      const u = await role(req, env);

      if (!u) {
        return fail(
          "Akses hanya untuk akun Manager Dashboard.",
          403
        );
      }

      /* DIAGNOSTIK D1: MEMBANDINGKAN READ DEFAULT DAN PRIMARY
         Endpoint ini hanya untuk Manager dan tidak mengirim data pribadi.
      */
      if (path === "/api/manager/diagnostic-batch" && req.method === "GET") {
        const targetId = "de8073e2-19bd-41d8-8c06-c82438eb1813";

        const defaultBatch = await env.DB.prepare(
          "SELECT id,course_key,course_name,uploaded_at,profile_count,progress_count FROM import_batches WHERE id=?"
        ).bind(targetId).first();

        const primary = env.DB.withSession("first-primary");
        const primaryBatch = await primary.prepare(
          "SELECT id,course_key,course_name,uploaded_at,profile_count,progress_count FROM import_batches WHERE id=?"
        ).bind(targetId).first();

        const primaryCounts = await primary.prepare(
          "SELECT (SELECT COUNT(*) FROM import_batches WHERE course_key='intuisi-bilangan') AS batch_count, (SELECT COUNT(*) FROM imported_participants WHERE batch_id=?) AS participant_count, (SELECT COUNT(*) FROM imported_progress WHERE batch_id=?) AS progress_count"
        ).bind(targetId, targetId).first();

        return json({
          diagnostic: "D1 read consistency",
          default_read: defaultBatch || null,
          primary_read: primaryBatch || null,
          primary_counts: primaryCounts || null,
          checked_at: new Date().toISOString()
        });
      }

      /* DAFTAR COURSE */

      if (path === "/api/courses") {
        const out = [];

        for (const [course_key, name] of COURSE_LIST) {
          const b = await env.DB.prepare(
            "SELECT id,uploaded_at,profile_count,progress_count,matched_count,unmatched_count,status FROM import_batches WHERE course_key=? ORDER BY uploaded_at DESC LIMIT 1"
          ).bind(course_key).first();

          out.push({
            course_key,
            name,
            ...(b || {})
          });
        }

        return json({ courses: out });
      }

      /* IMPORT CSV */

      if (
        path === "/api/import" &&
        req.method === "POST"
      ) {
        const form = await req.formData();

        const course_key =
          String(form.get("course_key") || "");

        const profile = form.get("profile");
        const progress = form.get("progress");

        const course = COURSE_LIST.find(
          x => x[0] === course_key
        );

        if (!course) {
          return fail("Course tidak dikenali.");
        }

        if (
          !(profile instanceof File) ||
          !(progress instanceof File)
        ) {
          return fail(
            "Unggah kedua file: profil peserta dan progress."
          );
        }

        if (
          profile.size > 8 * 1024 * 1024 ||
          progress.size > 12 * 1024 * 1024
        ) {
          return fail(
            "Ukuran file terlalu besar. Maksimum profil 8 MB dan progress 12 MB."
          );
        }

        const people = parseProfile(
          await profile.text()
        );

        const activities = parseProgress(
          await progress.text()
        );

        const emails = new Set(
          people.map(x => x.email)
        );

        const matched = new Set(
          activities
            .filter(x => emails.has(x.email))
            .map(x => x.email)
        );

        const unmatched = new Set(
          activities
            .filter(x => !emails.has(x.email))
            .map(x => x.email)
        );

        const grouped = new Map();

        for (const a of activities) {
          if (!grouped.has(a.email)) {
            grouped.set(a.email, []);
          }

          grouped.get(a.email).push(a);
        }

        const batch = crypto.randomUUID();
        const ts = now();

        await env.DB.prepare(
          "INSERT INTO import_batches(id,course_key,course_name,uploaded_at,profile_count,progress_count,matched_count,unmatched_count,status,profile_filename,progress_filename) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(
          batch,
          course_key,
          course[1],
          ts,
          people.length,
          activities.length,
          matched.size,
          unmatched.size,
          "success",
          profile.name,
          progress.name
        ).run();

        await insertChunks(
          env.DB,
          people,
          x => env.DB.prepare(
            "INSERT INTO imported_participants(batch_id,email,fullname,group_name) VALUES(?,?,?,?)"
          ).bind(
            batch,
            x.email,
            x.fullname,
            x.group
          )
        );

        const progressRows = [...grouped].map(
          ([email, items]) => ({
            email,
            items,
            total: items.length,
            completed: items.filter(
              x => /^completed/i.test(x.status)
            ).length
          })
        );

        await insertChunks(
          env.DB,
          progressRows,
          x => env.DB.prepare(
            "INSERT INTO imported_progress(batch_id,email,activities_json,total_activities,completed_activities) VALUES(?,?,?,?,?)"
          ).bind(
            batch,
            x.email,
            JSON.stringify(x.items),
            x.total,
            x.completed
          ),
          60
        );

        await env.DB.prepare(
          "INSERT INTO sync_logs(id,source,status,message,created_at) VALUES(?,'csv-import','success',?,?)"
        ).bind(
          crypto.randomUUID(),
          `Impor ${course[1]}: ${people.length} profil, ${activities.length} status aktivitas.`,
          ts
        ).run();

        return json({
          ok: true,
          batch_id: batch,
          course: course[1],
          profile_count: people.length,
          progress_count: activities.length,
          matched_count: matched.size,
          unmatched_count: unmatched.size,
          unmapped_count: people.filter(
            x => !x.group
          ).length,
          message:
            `Data ${course[1]} berhasil diimpor. ${people.length} profil dan ${activities.length} status aktivitas.`
        });
      }

      /* DASHBOARD RINGKASAN */

      if (path === "/api/dashboard/overview") {
        const latest = await env.DB.prepare(
          "SELECT b.* FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at"
        ).all();

        const batches = (latest.results || [])
          .map(x => x.id);

        let participants = new Set();
        let groups = new Map();
        let total = 0;
        let done = 0;
        let uploaded = 0;

        for (const id of batches) {
          const ps = await env.DB.prepare(
            "SELECT email,group_name FROM imported_participants WHERE batch_id=?"
          ).bind(id).all();

          for (const p of ps.results || []) {
            participants.add(p.email);

            const g =
              p.group_name || "Belum Terpetakan";

            groups.set(
              g,
              (groups.get(g) || 0) + 1
            );
          }

          const ac = await env.DB.prepare(
            "SELECT COALESCE(SUM(total_activities),0) total,COALESCE(SUM(completed_activities),0) completed FROM imported_progress WHERE batch_id=?"
          ).bind(id).first();

          total += Number(ac.total || 0);
          done += Number(ac.completed || 0);
          uploaded++;
        }

        return json({
          metrics: {
            participants: participants.size,
            courses: uploaded,
            completion: total
              ? Math.round(done * 100 / total)
              : 0,
            completed: done,
            total
          },

          districts: [...groups].map(
            ([name, count]) => ({
              name,
              participants: count
            })
          ).sort(
            (a, b) => a.name.localeCompare(b.name)
          ),

          lastSync: await env.DB.prepare(
            "SELECT created_at,message FROM sync_logs WHERE source='csv-import' ORDER BY created_at DESC LIMIT 1"
          ).first()
        });
      }

      /* DASHBOARD PER COURSE */

      if (path === "/api/dashboard/courses") {
        const d = await env.DB.prepare(
          "SELECT b.* FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at"
        ).all();

        const latest = new Map(
          (d.results || []).map(
            x => [x.course_key, x]
          )
        );

        const out = [];

        for (const [course_key, name] of COURSE_LIST) {
          const b = latest.get(course_key);

          if (!b) {
            out.push({
              course_key,
              course_name: name,
              uploaded: false,
              profile_count: 0,
              progress_count: 0,
              total: 0,
              completed: 0,
              completion: 0
            });

            continue;
          }

          const a = await env.DB.prepare(
            "SELECT COALESCE(SUM(total_activities),0) total,COALESCE(SUM(completed_activities),0) completed FROM imported_progress WHERE batch_id=?"
          ).bind(b.id).first();

          out.push({
            ...b,
            uploaded: true,
            total: a.total || 0,
            completed: a.completed || 0,
            completion: a.total
              ? Math.round(
                  a.completed * 100 / a.total
                )
              : 0
          });
        }

        return json({ courses: out });
      }

      /* DASHBOARD PER KABUPATEN / GROUP */

      if (path === "/api/dashboard/groups") {
        const d = await env.DB.prepare(
          "SELECT b.id,b.course_name,p.group_name,COUNT(DISTINCT p.email) participants,COALESCE(SUM(a.total_activities),0) total,COALESCE(SUM(a.completed_activities),0) completed FROM import_batches b JOIN (SELECT course_key,MAX(uploaded_at) t FROM import_batches GROUP BY course_key) x ON x.course_key=b.course_key AND x.t=b.uploaded_at JOIN imported_participants p ON p.batch_id=b.id LEFT JOIN imported_progress a ON a.batch_id=p.batch_id AND a.email=p.email GROUP BY b.id,p.group_name ORDER BY p.group_name,b.course_name"
        ).all();

        return json({
          groups: (d.results || []).map(x => ({
            ...x,
            district:
              x.group_name || "Belum Terpetakan",
            completion: x.total
              ? Math.round(
                  x.completed * 100 / x.total
                )
              : 0
          }))
        });
      }

      /* RIWAYAT UPLOAD */

      if (path === "/api/dashboard/history") {
        const d = await env.DB.prepare(
          "SELECT id,course_name,uploaded_at,profile_count,progress_count,matched_count,unmatched_count,status,profile_filename,progress_filename FROM import_batches ORDER BY uploaded_at DESC LIMIT 100"
        ).all();

        return json({
          history: d.results || []
        });
      }

      return fail("Endpoint tidak ditemukan.", 404);

    } catch (e) {
      return fail(
        e.message || "Terjadi kesalahan server.",
        500
      );
    }
  }
};
