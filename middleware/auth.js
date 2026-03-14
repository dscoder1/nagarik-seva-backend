const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access only' });
    next();
  });
};

const supervisorMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!['admin', 'supervisor'].includes(req.user.role))
      return res.status(403).json({ message: 'Supervisor access only' });
    next();
  });
};

module.exports = { authMiddleware, adminMiddleware, supervisorMiddleware };
