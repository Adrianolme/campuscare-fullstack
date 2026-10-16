'use strict';
// Contraseñas y tokens con el módulo "crypto" de Node (no requiere instalar nada)
const crypto = require('crypto');

// Guarda la contraseña como  scrypt$<sal>$<hash>  (nunca en texto plano)
function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

function verificarPassword(password, guardado) {
  const [alg, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const calculado = crypto.scryptSync(String(password), sal, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === calculado.length && crypto.timingSafeEqual(original, calculado);
}

// Token de sesión: al usuario se le da el token; en la BD solo se guarda su SHA-256
function nuevoToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = { hashPassword, verificarPassword, nuevoToken, hashToken };