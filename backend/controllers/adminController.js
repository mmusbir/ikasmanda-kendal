const { parse } = require('csv-parse/sync');
const db = require('../config/db');
const { uploadPublicAsset, removePublicAsset } = require('../config/supabase');
const AdminModel = require('../models/adminModel');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  getSessionTtlSeconds,
} = require('../utils/auth');
const {
  setSessionCookie,
  clearSessionCookie,
  readSessionTokenFromRequest,
} = require('../utils/adminSession');

function sanitizeString(value, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function parseBooleanValue(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'ya', 'yes', 'y'].includes(normalized);
}

function normalizeImportedRow(row = {}) {
  return {
    nama: sanitizeString(row.nama, 150),
    angkatan: sanitizeString(row.angkatan, 10),
    tempat_lahir: sanitizeString(row.tempat_lahir, 100),
    tanggal_lahir: sanitizeString(row.tanggal_lahir, 20),
    gender: sanitizeString(row.gender, 20) || 'Laki-laki',
    email: sanitizeString(row.email, 150)?.toLowerCase(),
    phone: sanitizeString(row.phone, 20),
    profesi: sanitizeString(row.profesi, 100),
    punya_usaha: parseBooleanValue(row.punya_usaha),
    nama_usaha: sanitizeString(row.nama_usaha, 150),
    kategori_usaha: sanitizeString(row.kategori_usaha, 100),
    provinsi: sanitizeString(row.provinsi, 100),
    kota: sanitizeString(row.kota, 100),
    alamat: sanitizeString(row.alamat, 1000),
  };
}

function validateImportedRow(row) {
  const errors = [];
  if (!row.nama) errors.push('nama lengkap wajib diisi');
  if (!row.angkatan) errors.push('angkatan wajib diisi');
  if (!row.email) errors.push('email wajib diisi');
  if (!row.phone) errors.push('No. HP wajib diisi');
  if (!['Laki-laki', 'Perempuan'].includes(row.gender)) {
    errors.push('gender harus Laki-laki atau Perempuan');
  }
  if (row.punya_usaha && (!row.nama_usaha || !row.kategori_usaha)) {
    errors.push('nama_usaha dan kategori_usaha wajib diisi jika punya_usaha=true');
  }
  return errors;
}

function normalizeAdminAlumniPayload(body = {}) {
  const isVerified = parseBooleanValue(body.is_verified ?? true);
  const profesi = sanitizeString(body.profesi, 100);
  const punyaUsaha = profesi === 'Wirausaha' || parseBooleanValue(body.punya_usaha);
  const namaUsaha = sanitizeString(body.nama_usaha, 150);
  const kategoriUsaha = sanitizeString(body.kategori_usaha, 100);
  return {
    nama: sanitizeString(body.nama, 150),
    angkatan: sanitizeString(body.angkatan, 10),
    tempat_lahir: sanitizeString(body.tempat_lahir, 100),
    tanggal_lahir: sanitizeString(body.tanggal_lahir, 20),
    gender: sanitizeString(body.gender, 20) || 'Laki-laki',
    email: sanitizeString(body.email, 150)?.toLowerCase(),
    phone: sanitizeString(body.phone, 20),
    profesi,
    punya_usaha: punyaUsaha ? 1 : 0,
    nama_usaha: punyaUsaha ? namaUsaha : null,
    kategori_usaha: punyaUsaha ? kategoriUsaha : null,
    provinsi: sanitizeString(body.provinsi, 100),
    kota: sanitizeString(body.kota, 100),
    alamat: sanitizeString(body.alamat, 1000),
    is_verified: isVerified ? 1 : 0,
    verified_at: isVerified ? new Date() : null,
  };
}

function validateAdminAlumniPayload(payload) {
  const errors = [];
  if (!payload.nama) errors.push('nama lengkap wajib diisi');
  if (!payload.angkatan) errors.push('angkatan wajib diisi');
  if (!payload.email) errors.push('email wajib diisi');
  if (!payload.phone) errors.push('No. HP wajib diisi');
  if (!['Laki-laki', 'Perempuan'].includes(payload.gender)) {
    errors.push('gender harus Laki-laki atau Perempuan');
  }
  if (payload.punya_usaha && (!payload.nama_usaha || !payload.kategori_usaha)) {
    errors.push('nama usaha dan kategori usaha wajib diisi untuk alumni wirausaha');
  }
  return errors;
}

function normalizeAdminUsahaPayload(body = {}) {
  const isVerified = parseBooleanValue(body.is_verified ?? true);
  const pemilikId = parseInt(body.pemilik_id, 10);
  return {
    nama_usaha: sanitizeString(body.nama_usaha, 150),
    kategori: sanitizeString(body.kategori, 100),
    pemilik_id: Number.isInteger(pemilikId) && pemilikId > 0 ? pemilikId : null,
    is_verified: isVerified ? 1 : 0,
    verified_at: isVerified ? new Date() : null,
  };
}

function validateAdminUsahaPayload(payload) {
  const errors = [];
  if (!payload.nama_usaha) errors.push('nama usaha wajib diisi');
  if (!payload.kategori) errors.push('kategori usaha wajib diisi');
  if (!payload.pemilik_id) errors.push('pemilik alumni wajib dipilih');
  return errors;
}

const adminController = {
  async login(req, res) {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const admin = await AdminModel.findByEmail(email);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password tidak valid',
        });
      }

      const isValidPassword = await verifyPassword(password, admin.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password tidak valid',
        });
      }

      const rawToken = generateSessionToken();
      const tokenHash = hashToken(rawToken);
      const ttlSeconds = getSessionTtlSeconds();
      const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));

      await AdminModel.deleteExpiredSessions();
      await AdminModel.createSession({
        adminId: admin.id,
        tokenHash,
        expiresAt,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
      });

      setSessionCookie(req, res, rawToken, ttlSeconds);

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          },
          expiresAt,
        },
      });
    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async logout(req, res) {
    try {
      const sessionToken = readSessionTokenFromRequest(req);
      if (sessionToken) {
        const tokenHash = hashToken(sessionToken);
        await AdminModel.deleteSessionByTokenHash(tokenHash);
      }

      clearSessionCookie(req, res);
      return res.json({
        success: true,
        message: 'Logout berhasil',
      });
    } catch (err) {
      console.error('Admin logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async me(req, res) {
    return res.json({
      success: true,
      data: {
        admin: req.admin,
      },
    });
  },

  async getDashboard(req, res) {
    try {
      const [stats, recentAlumni, recentUsaha] = await Promise.all([
        AdminModel.getDashboardStats(),
        AdminModel.getRecentAlumni(5),
        AdminModel.getRecentUsaha(5),
      ]);

      return res.json({
        success: true,
        data: {
          admin: req.admin,
          stats,
          recentAlumni,
          recentUsaha,
        },
      });
    } catch (err) {
      console.error('Admin dashboard error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getAdminUsers(_req, res) {
    try {
      const rows = await AdminModel.getAdminUsers();
      return res.json({
        success: true,
        data: rows,
      });
    } catch (err) {
      console.error('Admin users list error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async createAdminUser(req, res) {
    try {
      const name = sanitizeString(req.body.name, 120);
      const email = sanitizeString(req.body.email, 150)?.toLowerCase();
      const password = String(req.body.password || '').trim();

      if (!name || !email || password.length < 6) {
        return res.status(422).json({
          success: false,
          message: 'Nama, email valid, dan password minimal 6 karakter wajib diisi',
        });
      }

      const passwordHash = await hashPassword(password);
      const id = await AdminModel.create({ name, email, passwordHash });
      const users = await AdminModel.getAdminUsers();

      return res.status(201).json({
        success: true,
        message: 'Pengguna admin berhasil ditambahkan',
        data: { id, users },
      });
    } catch (err) {
      console.error('Create admin user error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Email admin sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateAdminUser(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const name = sanitizeString(req.body.name, 120);
      const email = sanitizeString(req.body.email, 150)?.toLowerCase();
      const rawPassword = String(req.body.password || '').trim();

      if (!id || id < 1 || !name || !email) {
        return res.status(422).json({
          success: false,
          message: 'ID, nama, dan email valid wajib diisi',
        });
      }

      if (rawPassword && rawPassword.length < 6) {
        return res.status(422).json({
          success: false,
          message: 'Password baru minimal 6 karakter',
        });
      }

      const passwordHash = rawPassword ? await hashPassword(rawPassword) : null;
      const updated = await AdminModel.updateAdminUser({ id, name, email, passwordHash });
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna admin tidak ditemukan',
        });
      }

      const users = await AdminModel.getAdminUsers();
      return res.json({
        success: true,
        message: 'Pengguna admin berhasil diperbarui',
        data: users,
      });
    } catch (err) {
      console.error('Update admin user error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Email admin sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async deleteAdminUser(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID pengguna admin tidak valid',
        });
      }

      if (req.admin?.id === id) {
        return res.status(409).json({
          success: false,
          message: 'Anda tidak bisa menghapus akun yang sedang dipakai login',
        });
      }

      const totalAdmins = await AdminModel.countAdminUsers();
      if (totalAdmins <= 1) {
        return res.status(409).json({
          success: false,
          message: 'Admin terakhir tidak bisa dihapus',
        });
      }

      const deleted = await AdminModel.deleteAdminUser(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna admin tidak ditemukan',
        });
      }

      const users = await AdminModel.getAdminUsers();
      return res.json({
        success: true,
        message: 'Pengguna admin berhasil dihapus',
        data: users,
      });
    } catch (err) {
      console.error('Delete admin user error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getAlumni(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const result = await AdminModel.getAlumniList({
        page,
        search: req.query.search,
        angkatan: req.query.angkatan,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error('Admin alumni list error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getAlumniOptions(_req, res) {
    try {
      const rows = await AdminModel.getAlumniOptions();
      return res.json({
        success: true,
        data: rows,
      });
    } catch (err) {
      console.error('Admin alumni options error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async createAlumni(req, res) {
    try {
      const payload = normalizeAdminAlumniPayload(req.body);
      const errors = validateAdminAlumniPayload(payload);

      if (errors.length) {
        return res.status(422).json({
          success: false,
          message: errors.join(', '),
        });
      }

      const id = await AdminModel.createAdminAlumni(payload);
      return res.status(201).json({
        success: true,
        message: 'Data alumni berhasil ditambahkan',
        data: { id },
      });
    } catch (err) {
      console.error('Admin create alumni error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Email atau No. HP sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateAlumni(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID alumni tidak valid',
        });
      }

      const existing = await AdminModel.getAlumniById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Data alumni tidak ditemukan',
        });
      }

      const payload = normalizeAdminAlumniPayload(req.body);
      const errors = validateAdminAlumniPayload(payload);
      if (errors.length) {
        return res.status(422).json({
          success: false,
          message: errors.join(', '),
        });
      }

      if (existing.is_verified && payload.is_verified) {
        payload.verified_at = existing.verified_at || new Date();
      }

      const updated = await AdminModel.updateAdminAlumni(id, payload);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Data alumni tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        message: 'Data alumni berhasil diperbarui',
      });
    } catch (err) {
      console.error('Admin update alumni error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Email atau No. HP sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getUsaha(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const result = await AdminModel.getUsahaList({
        page,
        search: req.query.search,
        kategori: req.query.kategori,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error('Admin usaha list error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async createUsaha(req, res) {
    try {
      const payload = normalizeAdminUsahaPayload(req.body);
      const errors = validateAdminUsahaPayload(payload);
      if (errors.length) {
        return res.status(422).json({
          success: false,
          message: errors.join(', '),
        });
      }

      const id = await AdminModel.createAdminUsaha(payload);
      return res.status(201).json({
        success: true,
        message: 'Data usaha berhasil ditambahkan',
        data: { id },
      });
    } catch (err) {
      console.error('Admin create usaha error:', err);
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(422).json({
          success: false,
          message: 'Pemilik alumni tidak ditemukan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateUsaha(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID usaha tidak valid',
        });
      }

      const existing = await AdminModel.getUsahaById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Data usaha tidak ditemukan',
        });
      }

      const payload = normalizeAdminUsahaPayload(req.body);
      const errors = validateAdminUsahaPayload(payload);
      if (errors.length) {
        return res.status(422).json({
          success: false,
          message: errors.join(', '),
        });
      }

      if (existing.is_verified && payload.is_verified) {
        payload.verified_at = existing.verified_at || new Date();
      }

      const updated = await AdminModel.updateAdminUsaha(id, payload);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Data usaha tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        message: 'Data usaha berhasil diperbarui',
      });
    } catch (err) {
      console.error('Admin update usaha error:', err);
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(422).json({
          success: false,
          message: 'Pemilik alumni tidak ditemukan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async verifyAlumni(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID alumni tidak valid',
        });
      }

      const alumni = await AdminModel.getAlumniById(id);
      if (!alumni) {
        return res.status(404).json({
          success: false,
          message: 'Data alumni tidak ditemukan',
        });
      }

      if (alumni.is_verified) {
        return res.json({
          success: true,
          message: 'Data alumni sudah terverifikasi',
        });
      }

      await AdminModel.verifyAlumniById(id);
      return res.json({
        success: true,
        message: 'Data alumni berhasil diverifikasi',
      });
    } catch (err) {
      console.error('Admin verify alumni error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async verifyUsaha(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID usaha tidak valid',
        });
      }

      const usaha = await AdminModel.getUsahaById(id);
      if (!usaha) {
        return res.status(404).json({
          success: false,
          message: 'Data usaha tidak ditemukan',
        });
      }

      if (usaha.is_verified) {
        return res.json({
          success: true,
          message: 'Data usaha sudah terverifikasi',
        });
      }

      await AdminModel.verifyUsahaById(id);
      return res.json({
        success: true,
        message: 'Data usaha berhasil diverifikasi',
      });
    } catch (err) {
      console.error('Admin verify usaha error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async deleteAlumni(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID alumni tidak valid',
        });
      }

      const deleted = await AdminModel.deleteAlumniById(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Data alumni tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        message: 'Data alumni berhasil dihapus',
      });
    } catch (err) {
      console.error('Admin delete alumni error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async deleteUsaha(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID usaha tidak valid',
        });
      }

      const deleted = await AdminModel.deleteUsahaById(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Data usaha tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        message: 'Data usaha berhasil dihapus',
      });
    } catch (err) {
      console.error('Admin delete usaha error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getSiteSettings(_req, res) {
    try {
      const settings = await AdminModel.getSiteSettings();
      return res.json({
        success: true,
        data: settings,
      });
    } catch (err) {
      console.error('Get admin site settings error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateSiteSettings(req, res) {
    let faviconUpload = null;
    let logoUpload = null;
    let heroUpload = null;

    try {
      const currentSettings = await AdminModel.getSiteSettings();
      if (!currentSettings) {
        return res.status(404).json({
          success: false,
          message: 'Site settings belum tersedia',
        });
      }

      const uploadedFavicon = req.files?.favicon_file?.[0];
      const uploadedLogo = req.files?.logo_file?.[0];
      const uploadedHero = req.files?.hero_file?.[0];
      const shouldDeleteFavicon = parseBooleanValue(req.body.delete_favicon_file);
      const shouldDeleteLogo = parseBooleanValue(req.body.delete_logo_file);
      const shouldDeleteHero = parseBooleanValue(req.body.delete_hero_file);

      faviconUpload = uploadedFavicon
        ? await uploadPublicAsset(uploadedFavicon, 'site-settings')
        : null;
      logoUpload = uploadedLogo
        ? await uploadPublicAsset(uploadedLogo, 'site-settings')
        : null;
      heroUpload = uploadedHero
        ? await uploadPublicAsset(uploadedHero, 'site-settings')
        : null;

      const nextFaviconUrl = faviconUpload
        ? faviconUpload.publicUrl
        : (shouldDeleteFavicon ? null : currentSettings.favicon_url);
      const nextLogoUrl = logoUpload
        ? logoUpload.publicUrl
        : (shouldDeleteLogo ? null : currentSettings.logo_image_url);
      const nextHeroUrl = heroUpload
        ? heroUpload.publicUrl
        : (shouldDeleteHero ? null : currentSettings.hero_background_url);

      const merged = {
        ...currentSettings,
        logo_text: sanitizeString(req.body.logo_text, 120) || currentSettings.logo_text,
        hide_logo_text_on_index: req.body.hide_logo_text_on_index === undefined
          ? currentSettings.hide_logo_text_on_index
          : parseBooleanValue(req.body.hide_logo_text_on_index),
        logo_image_url: nextLogoUrl,
        favicon_url: nextFaviconUrl,
        hero_title: sanitizeString(req.body.hero_title, 255) || currentSettings.hero_title,
        hero_subtitle: sanitizeString(req.body.hero_subtitle, 1000) || currentSettings.hero_subtitle,
        hero_primary_text: sanitizeString(req.body.hero_primary_text, 100) || currentSettings.hero_primary_text,
        hero_primary_link: sanitizeString(req.body.hero_primary_link, 255) || currentSettings.hero_primary_link,
        hero_secondary_text: sanitizeString(req.body.hero_secondary_text, 100) || currentSettings.hero_secondary_text,
        hero_secondary_link: sanitizeString(req.body.hero_secondary_link, 255) || currentSettings.hero_secondary_link,
        hero_background_url: nextHeroUrl,
      };

      await AdminModel.updateSiteSettings(merged);
      if (currentSettings.favicon_url && currentSettings.favicon_url !== nextFaviconUrl) {
        await removePublicAsset(currentSettings.favicon_url);
      }
      if (currentSettings.logo_image_url && currentSettings.logo_image_url !== nextLogoUrl) {
        await removePublicAsset(currentSettings.logo_image_url);
      }
      if (currentSettings.hero_background_url && currentSettings.hero_background_url !== nextHeroUrl) {
        await removePublicAsset(currentSettings.hero_background_url);
      }
      const updatedSettings = await AdminModel.getSiteSettings();

      return res.json({
        success: true,
        message: 'Pengaturan halaman depan berhasil diperbarui',
        data: updatedSettings,
      });
    } catch (err) {
      const cleanupTasks = [faviconUpload, logoUpload, heroUpload]
        .filter(Boolean)
        .map((upload) => removePublicAsset(upload.publicUrl).catch((_cleanupErr) => {}));

      if (cleanupTasks.length) {
        await Promise.all(cleanupTasks);
      }

      console.error('Update site settings error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getPublicSiteSettings(_req, res) {
    try {
      const settings = await AdminModel.getSiteSettings();
      return res.json({
        success: true,
        data: settings,
      });
    } catch (err) {
      console.error('Get public site settings error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async downloadAlumniImportTemplate(_req, res) {
    const template = [
      'nama,angkatan,tempat_lahir,tanggal_lahir,gender,email,phone,profesi,punya_usaha,nama_usaha,kategori_usaha,provinsi,kota,alamat',
      'Budi Santoso,2005,Kendal,1987-01-10,Laki-laki,budi@example.com,081234567890,Swasta,false,,,Jawa Tengah,Semarang,"Jl. Pandanaran No. 1"',
      'Siti Aminah,2008,Semarang,1990-08-21,Perempuan,siti@example.com,081298765432,Wirausaha,true,Kopi Alumni,Kuliner,Jawa Tengah,Kendal,"Jl. Raya Kendal No. 2"',
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-alumni.csv"');
    return res.send(template);
  },

  async importAlumni(req, res) {
    const csvFile = req.file;
    if (!csvFile) {
      return res.status(400).json({
        success: false,
        message: 'File CSV wajib diunggah',
      });
    }

    let connection;
    try {
      const content = csvFile.buffer.toString('utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (!records.length) {
        return res.status(400).json({
          success: false,
          message: 'File CSV tidak berisi data',
        });
      }

      connection = await db.getConnection();
      const summary = {
        totalRows: records.length,
        imported: 0,
        skipped: 0,
        errors: [],
      };

      for (let index = 0; index < records.length; index += 1) {
        const rowNumber = index + 2;
        const normalized = normalizeImportedRow(records[index]);
        const rowErrors = validateImportedRow(normalized);

        if (rowErrors.length) {
          summary.skipped += 1;
          summary.errors.push(`Baris ${rowNumber}: ${rowErrors.join(', ')}`);
          continue;
        }

        try {
          await connection.beginTransaction();
          await AdminModel.createAlumniWithOptionalUsaha(connection, normalized);
          await connection.commit();
          summary.imported += 1;
        } catch (err) {
          await connection.rollback();
          summary.skipped += 1;
          if (err.code === 'ER_DUP_ENTRY') {
            summary.errors.push(`Baris ${rowNumber}: email atau No. HP sudah terdaftar`);
          } else {
            summary.errors.push(`Baris ${rowNumber}: ${err.message}`);
          }
        }
      }

      return res.json({
        success: true,
        message: `Import selesai. ${summary.imported} data berhasil dimasukkan.`,
        data: summary,
      });
    } catch (err) {
      console.error('Import alumni error:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengimpor file CSV',
      });
    } finally {
      if (connection) connection.release();
    }
  },

  async getLapakCategories(_req, res) {
    try {
      const rows = await AdminModel.getLapakCategories();
      return res.json({
        success: true,
        data: rows,
      });
    } catch (err) {
      console.error('Get lapak categories error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async createLapakCategory(req, res) {
    try {
      const name = sanitizeString(req.body.name, 100);
      if (!name) {
        return res.status(422).json({
          success: false,
          message: 'Nama kategori wajib diisi',
        });
      }

      const id = await AdminModel.createLapakCategory(name);
      const rows = await AdminModel.getLapakCategories();
      return res.status(201).json({
        success: true,
        message: 'Kategori lapak berhasil ditambahkan',
        data: {
          id,
          categories: rows,
        },
      });
    } catch (err) {
      console.error('Create lapak category error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Nama kategori sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateLapakCategory(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const name = sanitizeString(req.body.name, 100);
      if (!id || id < 1 || !name) {
        return res.status(422).json({
          success: false,
          message: 'ID dan nama kategori wajib valid',
        });
      }

      const updated = await AdminModel.updateLapakCategory(id, name);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Kategori tidak ditemukan',
        });
      }

      const rows = await AdminModel.getLapakCategories();
      return res.json({
        success: true,
        message: 'Kategori lapak berhasil diperbarui',
        data: rows,
      });
    } catch (err) {
      console.error('Update lapak category error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Nama kategori sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async deleteLapakCategory(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID kategori tidak valid',
        });
      }

      const category = await AdminModel.getLapakCategoryById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Kategori tidak ditemukan',
        });
      }

      const usageCount = await AdminModel.getLapakCategoryUsageCount(category.name);
      if (usageCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Kategori sedang dipakai data lapak dan tidak bisa dihapus',
        });
      }

      await AdminModel.deleteLapakCategory(id);
      const rows = await AdminModel.getLapakCategories();
      return res.json({
        success: true,
        message: 'Kategori lapak berhasil dihapus',
        data: rows,
      });
    } catch (err) {
      console.error('Delete lapak category error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async getProvinces(_req, res) {
    try {
      const rows = await AdminModel.getProvinces();
      return res.json({
        success: true,
        data: rows,
      });
    } catch (err) {
      console.error('Get provinces error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async createProvince(req, res) {
    try {
      const name = sanitizeString(req.body.name, 100);
      if (!name) {
        return res.status(422).json({
          success: false,
          message: 'Nama provinsi wajib diisi',
        });
      }

      const id = await AdminModel.createProvince(name);
      const rows = await AdminModel.getProvinces();
      return res.status(201).json({
        success: true,
        message: 'Provinsi berhasil ditambahkan',
        data: {
          id,
          provinces: rows,
        },
      });
    } catch (err) {
      console.error('Create province error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Nama provinsi sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async updateProvince(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const name = sanitizeString(req.body.name, 100);
      if (!id || id < 1 || !name) {
        return res.status(422).json({
          success: false,
          message: 'ID dan nama provinsi wajib valid',
        });
      }

      const updated = await AdminModel.updateProvince(id, name);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Provinsi tidak ditemukan',
        });
      }

      const rows = await AdminModel.getProvinces();
      return res.json({
        success: true,
        message: 'Provinsi berhasil diperbarui',
        data: rows,
      });
    } catch (err) {
      console.error('Update province error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Nama provinsi sudah digunakan',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },

  async deleteProvince(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'ID provinsi tidak valid',
        });
      }

      const province = await AdminModel.getProvinceById(id);
      if (!province) {
        return res.status(404).json({
          success: false,
          message: 'Provinsi tidak ditemukan',
        });
      }

      const usageCount = await AdminModel.getProvinceUsageCount(province.name);
      if (usageCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Provinsi sedang dipakai data alumni dan tidak bisa dihapus',
        });
      }

      await AdminModel.deleteProvince(id);
      const rows = await AdminModel.getProvinces();
      return res.json({
        success: true,
        message: 'Provinsi berhasil dihapus',
        data: rows,
      });
    } catch (err) {
      console.error('Delete province error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
      });
    }
  },
};

module.exports = adminController;
