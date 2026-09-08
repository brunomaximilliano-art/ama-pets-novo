// Autenticación sin estado en el servidor (sin "sesiones" guardadas en memoria):
// usa una cookie firmada con COOKIE_SECRET. Esto es necesario para que funcione
// en Vercel, donde cada request puede ejecutarse en una instancia distinta y una
// sesión en memoria se perdería de una request a otra.
const COOKIE_NAME = 'admin_session';

function requireAdmin(req, res, next) {
  if (req.signedCookies && req.signedCookies[COOKIE_NAME]) return next();
  return res.redirect('/admin/login');
}

function logIn(res, userId) {
  res.cookie(COOKIE_NAME, String(userId), {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  });
}

function logOut(res) {
  res.clearCookie(COOKIE_NAME);
}

module.exports = { requireAdmin, logIn, logOut, COOKIE_NAME };
