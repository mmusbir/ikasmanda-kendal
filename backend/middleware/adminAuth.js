const AdminModel = require('../models/adminModel');
const { hashToken } = require('../utils/auth');
const { clearSessionCookie, readSessionTokenFromRequest } = require('../utils/adminSession');

async function requireAdminAuth(req, res, next) {
  try {
    const sessionToken = readSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Silakan login admin terlebih dahulu.',
      });
    }

    const tokenHash = hashToken(sessionToken);
    const session = await AdminModel.findSessionWithAdminByTokenHash(tokenHash);

    if (!session) {
      clearSessionCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak valid. Silakan login ulang.',
      });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await AdminModel.deleteSessionByTokenHash(tokenHash);
      clearSessionCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Sesi telah berakhir. Silakan login ulang.',
      });
    }

    req.admin = {
      id: session.admin_id,
      name: session.admin_name,
      email: session.admin_email,
    };
    req.adminSession = {
      id: session.session_id,
      tokenHash,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdminAuth };
