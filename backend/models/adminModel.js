const db = require('../config/db');

const ITEMS_PER_PAGE = 10;

const AdminModel = {
  async findByEmail(email) {
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash FROM admin_users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, name, email, created_at FROM admin_users WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async getAdminUsers() {
    const [rows] = await db.execute(
      `SELECT id, name, email, created_at, updated_at
       FROM admin_users
       ORDER BY created_at ASC`,
    );
    return rows;
  },

  async countAdminUsers() {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM admin_users');
    return rows[0]?.total || 0;
  },

  async create({ name, email, passwordHash }) {
    const [result] = await db.execute(
      'INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    );
    return result.insertId;
  },

  async updateAdminUser({ id, name, email, passwordHash }) {
    if (passwordHash) {
      const [result] = await db.execute(
        `UPDATE admin_users
         SET name = ?, email = ?, password_hash = ?
         WHERE id = ?`,
        [name, email, passwordHash, id],
      );
      return result.affectedRows > 0;
    }

    const [result] = await db.execute(
      `UPDATE admin_users
       SET name = ?, email = ?
       WHERE id = ?`,
      [name, email, id],
    );
    return result.affectedRows > 0;
  },

  async deleteAdminUser(id) {
    const [result] = await db.execute('DELETE FROM admin_users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async createSession({ adminId, tokenHash, expiresAt, userAgent, ipAddress }) {
    const [result] = await db.execute(
      `INSERT INTO admin_sessions
       (admin_id, token_hash, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, tokenHash, userAgent || null, ipAddress || null, expiresAt],
    );
    return result.insertId;
  },

  async findSessionWithAdminByTokenHash(tokenHash) {
    const [rows] = await db.execute(
      `SELECT
         s.id AS session_id,
         s.admin_id,
         s.expires_at,
         a.name AS admin_name,
         a.email AS admin_email
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_id
       WHERE s.token_hash = ?
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  },

  async deleteSessionByTokenHash(tokenHash) {
    await db.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
  },

  async deleteExpiredSessions() {
    await db.execute('DELETE FROM admin_sessions WHERE expires_at < NOW()');
  },

    async getDashboardStats() {
      const [alumniResult, usahaResult, todayAlumniResult] = await Promise.all([
        db.execute('SELECT COUNT(*) AS total FROM alumni'),
        db.execute('SELECT COUNT(*) AS total FROM usaha'),
        db.execute(
          'SELECT COUNT(*) AS total FROM alumni WHERE DATE(created_at) = CURRENT_DATE',
        ),
      ]);
    const alumniRows = alumniResult[0];
    const usahaRows = usahaResult[0];
    const todayRows = todayAlumniResult[0];

    return {
      totalAlumni: alumniRows[0]?.total || 0,
      totalUsaha: usahaRows[0]?.total || 0,
      alumniHariIni: todayRows[0]?.total || 0,
    };
  },

  async getRecentAlumni(limit = 5) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const [rows] = await db.execute(
      `SELECT id, nama, angkatan, email, phone, kota, created_at
       FROM alumni
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
    );
    return rows;
  },

  async getRecentUsaha(limit = 5) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const [rows] = await db.execute(
      `SELECT u.id, u.nama_usaha, u.kategori, a.nama AS pemilik, u.created_at
       FROM usaha u
       JOIN alumni a ON a.id = u.pemilik_id
       ORDER BY u.created_at DESC
       LIMIT ${safeLimit}`,
    );
    return rows;
  },

  async getAlumniList({ page = 1, search, angkatan } = {}) {
    const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const params = [];
    const conditions = [];

    if (angkatan) {
      conditions.push('angkatan = ?');
      params.push(angkatan);
    }

    if (search) {
      conditions.push('(nama LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM alumni ${where}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    const [rows] = await db.execute(
      `SELECT id, nama, angkatan, tempat_lahir, tanggal_lahir, gender, email, phone,
              profesi, punya_usaha, nama_usaha, kategori_usaha,
              provinsi, kota, alamat, created_at, is_verified, verified_at
       FROM alumni
       ${where}
       ORDER BY created_at DESC
       LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
      params,
    );

    return {
      data: rows,
      total,
      page: currentPage,
      totalPages: Math.ceil(total / ITEMS_PER_PAGE),
    };
  },

  async getUsahaList({ page = 1, search, kategori } = {}) {
    const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const params = [];
    const conditions = [];

    if (kategori) {
      conditions.push('u.kategori = ?');
      params.push(kategori);
    }

    if (search) {
      conditions.push('(u.nama_usaha LIKE ? OR a.nama LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM usaha u
       JOIN alumni a ON a.id = u.pemilik_id
       ${where}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    const [rows] = await db.execute(
      `SELECT u.id, u.nama_usaha, u.kategori, u.pemilik_id, a.nama AS pemilik,
              u.created_at, u.is_verified, u.verified_at
       FROM usaha u
       JOIN alumni a ON a.id = u.pemilik_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
      params,
    );

    return {
      data: rows,
      total,
      page: currentPage,
      totalPages: Math.ceil(total / ITEMS_PER_PAGE),
    };
  },

  async deleteAlumniById(id) {
    const [result] = await db.execute('DELETE FROM alumni WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getAlumniOptions() {
    const [rows] = await db.execute(
      `SELECT id, nama, angkatan, profesi, kota
       FROM alumni
       ORDER BY nama ASC`,
    );
    return rows;
  },

  async getAlumniById(id) {
    const [rows] = await db.execute(
      `SELECT id, nama, angkatan, tempat_lahir, tanggal_lahir, gender, email, phone,
              profesi, punya_usaha, nama_usaha, kategori_usaha,
              provinsi, kota, alamat, is_verified, verified_at
       FROM alumni
       WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async createAdminAlumni(data) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO alumni
          (nama, angkatan, tempat_lahir, tanggal_lahir, gender,
           email, phone, profesi, punya_usaha, nama_usaha, kategori_usaha,
           provinsi, kota, alamat, is_verified, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.nama,
          data.angkatan,
          data.tempat_lahir || null,
          data.tanggal_lahir || null,
          data.gender,
          data.email,
          data.phone,
          data.profesi || null,
          data.punya_usaha ? 1 : 0,
          data.nama_usaha || null,
          data.kategori_usaha || null,
          data.provinsi || null,
          data.kota || null,
          data.alamat || null,
          data.is_verified,
          data.verified_at,
        ],
      );

      if (data.punya_usaha && data.nama_usaha && data.kategori_usaha) {
        await connection.execute(
          `INSERT INTO usaha (nama_usaha, kategori, pemilik_id, is_verified, verified_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            data.nama_usaha,
            data.kategori_usaha,
            result.insertId,
            data.is_verified,
            data.verified_at,
          ],
        );
      }

      await connection.commit();
      return result.insertId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async updateAdminAlumni(id, data) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.execute(
        `SELECT punya_usaha, nama_usaha, kategori_usaha
         FROM alumni
         WHERE id = ?
         LIMIT 1`,
        [id],
      );
      const existing = existingRows[0] || null;
      if (!existing) {
        await connection.rollback();
        return false;
      }

      const [result] = await connection.execute(
        `UPDATE alumni
         SET nama = ?,
             angkatan = ?,
             tempat_lahir = ?,
             tanggal_lahir = ?,
             gender = ?,
             email = ?,
             phone = ?,
             profesi = ?,
             punya_usaha = ?,
             nama_usaha = ?,
             kategori_usaha = ?,
             provinsi = ?,
             kota = ?,
             alamat = ?,
             is_verified = ?,
             verified_at = ?
         WHERE id = ?`,
        [
          data.nama,
          data.angkatan,
          data.tempat_lahir || null,
          data.tanggal_lahir || null,
          data.gender,
          data.email,
          data.phone,
          data.profesi || null,
          data.punya_usaha ? 1 : 0,
          data.nama_usaha || null,
          data.kategori_usaha || null,
          data.provinsi || null,
          data.kota || null,
          data.alamat || null,
          data.is_verified,
          data.verified_at,
          id,
        ],
      );

      if (!result.affectedRows) {
        await connection.rollback();
        return false;
      }

      const usahaVerificationDate = data.verified_at || null;
      const [linkedUsahaRows] = await connection.execute(
        `SELECT id
         FROM usaha
         WHERE pemilik_id = ?
           AND nama_usaha <=> ?
           AND kategori <=> ?
         LIMIT 1`,
        [id, existing.nama_usaha || null, existing.kategori_usaha || null],
      );
      const linkedUsaha = linkedUsahaRows[0] || null;

      if (data.punya_usaha && data.nama_usaha && data.kategori_usaha) {
        if (linkedUsaha) {
          await connection.execute(
            `UPDATE usaha
             SET nama_usaha = ?,
                 kategori = ?,
                 is_verified = ?,
                 verified_at = ?
             WHERE id = ?`,
            [
              data.nama_usaha,
              data.kategori_usaha,
              data.is_verified,
              usahaVerificationDate,
              linkedUsaha.id,
            ],
          );
        } else {
          await connection.execute(
            `INSERT INTO usaha (nama_usaha, kategori, pemilik_id, is_verified, verified_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              data.nama_usaha,
              data.kategori_usaha,
              id,
              data.is_verified,
              usahaVerificationDate,
            ],
          );
        }
      } else if (linkedUsaha) {
        await connection.execute('DELETE FROM usaha WHERE id = ?', [linkedUsaha.id]);
      }

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async verifyAlumniById(id) {
    const [result] = await db.execute(
      `UPDATE alumni
       SET is_verified = 1,
           verified_at = COALESCE(verified_at, NOW())
       WHERE id = ? AND is_verified = 0`,
      [id],
    );
    return result.affectedRows > 0;
  },

  async deleteUsahaById(id) {
    const [result] = await db.execute('DELETE FROM usaha WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getUsahaById(id) {
    const [rows] = await db.execute(
      `SELECT id, nama_usaha, kategori, pemilik_id, is_verified, verified_at
       FROM usaha
       WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async createAdminUsaha(data) {
    const [result] = await db.execute(
      `INSERT INTO usaha (nama_usaha, kategori, pemilik_id, is_verified, verified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.nama_usaha,
        data.kategori,
        data.pemilik_id,
        data.is_verified,
        data.verified_at,
      ],
    );
    return result.insertId;
  },

  async updateAdminUsaha(id, data) {
    const [result] = await db.execute(
      `UPDATE usaha
       SET nama_usaha = ?,
           kategori = ?,
           pemilik_id = ?,
           is_verified = ?,
           verified_at = ?
       WHERE id = ?`,
      [
        data.nama_usaha,
        data.kategori,
        data.pemilik_id,
        data.is_verified,
        data.verified_at,
        id,
      ],
    );
    return result.affectedRows > 0;
  },

  async verifyUsahaById(id) {
    const [result] = await db.execute(
      `UPDATE usaha
       SET is_verified = 1,
           verified_at = COALESCE(verified_at, NOW())
       WHERE id = ? AND is_verified = 0`,
      [id],
    );
    return result.affectedRows > 0;
  },

  async createAlumniWithOptionalUsaha(connection, data) {
    const verifiedAt = new Date();
    const [alumniResult] = await connection.execute(
      `INSERT INTO alumni
        (nama, angkatan, tempat_lahir, tanggal_lahir, gender,
         email, phone, profesi, punya_usaha, nama_usaha,
         kategori_usaha, provinsi, kota, alamat, is_verified, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nama,
        data.angkatan,
        data.tempat_lahir || null,
        data.tanggal_lahir || null,
        data.gender || 'Laki-laki',
        data.email,
        data.phone,
        data.profesi || null,
        data.punya_usaha ? 1 : 0,
        data.nama_usaha || null,
        data.kategori_usaha || null,
        data.provinsi || null,
        data.kota || null,
        data.alamat || null,
        1,
        verifiedAt,
      ],
    );

    if (data.punya_usaha && data.nama_usaha && data.kategori_usaha) {
      await connection.execute(
        `INSERT INTO usaha (nama_usaha, kategori, pemilik_id, is_verified, verified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [data.nama_usaha, data.kategori_usaha, alumniResult.insertId, 1, verifiedAt],
      );
    }

    return alumniResult.insertId;
  },

  async getSiteSettings() {
    const [rows] = await db.execute(
      `SELECT
         id,
         logo_text,
         hide_logo_text_on_index,
         logo_image_url,
         favicon_url,
         hero_title,
         hero_subtitle,
         hero_primary_text,
         hero_primary_link,
         hero_secondary_text,
         hero_secondary_link,
         hero_background_url,
         updated_at
       FROM site_settings
       WHERE id = 1
       LIMIT 1`,
    );

    return rows[0] || null;
  },

  async updateSiteSettings(data) {
    await db.execute(
      `UPDATE site_settings
       SET
        logo_text = ?,
        hide_logo_text_on_index = ?,
        logo_image_url = ?,
        favicon_url = ?,
        hero_title = ?,
        hero_subtitle = ?,
         hero_primary_text = ?,
         hero_primary_link = ?,
         hero_secondary_text = ?,
         hero_secondary_link = ?,
         hero_background_url = ?
       WHERE id = 1`,
      [
        data.logo_text,
        data.hide_logo_text_on_index ? 1 : 0,
        data.logo_image_url,
        data.favicon_url,
        data.hero_title,
        data.hero_subtitle,
        data.hero_primary_text,
        data.hero_primary_link,
        data.hero_secondary_text,
        data.hero_secondary_link,
        data.hero_background_url,
      ],
    );
  },

  async getLapakCategories() {
    const [rows] = await db.execute(
      `SELECT id, name, created_at, updated_at
       FROM lapak_categories
       ORDER BY name ASC`,
    );
    return rows;
  },

  async createLapakCategory(name) {
    const [result] = await db.execute(
      'INSERT INTO lapak_categories (name) VALUES (?)',
      [name],
    );
    return result.insertId;
  },

  async updateLapakCategory(id, name) {
    const [result] = await db.execute(
      'UPDATE lapak_categories SET name = ? WHERE id = ?',
      [name, id],
    );
    return result.affectedRows > 0;
  },

  async getLapakCategoryById(id) {
    const [rows] = await db.execute(
      'SELECT id, name FROM lapak_categories WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async getLapakCategoryUsageCount(name) {
    const [usahaRows] = await db.execute(
      'SELECT COUNT(*) AS total FROM usaha WHERE kategori = ?',
      [name],
    );
    const [alumniRows] = await db.execute(
      'SELECT COUNT(*) AS total FROM alumni WHERE kategori_usaha = ?',
      [name],
    );
    return (usahaRows[0]?.total || 0) + (alumniRows[0]?.total || 0);
  },

  async deleteLapakCategory(id) {
    const [result] = await db.execute(
      'DELETE FROM lapak_categories WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  },

  async getProvinces() {
    const [rows] = await db.execute(
      `SELECT id, name, created_at, updated_at
       FROM provinces
       ORDER BY name ASC`,
    );
    return rows;
  },

  async createProvince(name) {
    const [result] = await db.execute(
      'INSERT INTO provinces (name) VALUES (?)',
      [name],
    );
    return result.insertId;
  },

  async updateProvince(id, name) {
    const [result] = await db.execute(
      'UPDATE provinces SET name = ? WHERE id = ?',
      [name, id],
    );
    return result.affectedRows > 0;
  },

  async getProvinceById(id) {
    const [rows] = await db.execute(
      'SELECT id, name FROM provinces WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async getProvinceUsageCount(name) {
    const [rows] = await db.execute(
      'SELECT COUNT(*) AS total FROM alumni WHERE provinsi = ?',
      [name],
    );
    return rows[0]?.total || 0;
  },

  async deleteProvince(id) {
    const [result] = await db.execute(
      'DELETE FROM provinces WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  },
};

module.exports = AdminModel;
