import { type Request, type Response, type NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    name: string;
  };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const userName = req.headers['x-user-name'];
  const userUsername = req.headers['x-user-username'];

  if (!userId || !userRole) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  req.user = {
    id: Number(userId),
    username: String(userUsername || ''),
    role: String(userRole),
    name: String(userName || ''),
  };
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    next();
  };
};
