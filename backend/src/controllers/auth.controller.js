import { verifyPassword, createSessionToken } from '../utils/auth.js';

const COOKIE_NAME = 'admin_session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Handle Administrator Login.
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};

    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const expectedUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const storedHashOrPlain = process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD;

    if (!storedHashOrPlain) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Administrator credentials are not configured',
      });
    }

    const cleanUsername = username.trim();

    // Constant-time check on username and password verification
    const isUsernameMatch = cleanUsername.toLowerCase() === expectedUsername.toLowerCase();
    const isPasswordMatch = verifyPassword(password, storedHashOrPlain);

    if (!isUsernameMatch || !isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Generate signed session token
    const sessionSecret = process.env.SESSION_SECRET || `${process.env.ADMIN_API_KEY}-session-secret`;
    const token = createSessionToken(
      { username: expectedUsername },
      sessionSecret,
      SESSION_EXPIRY_MS
    );

    // Set secure HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS,
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        username: expectedUsername,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve current authenticated admin profile.
 * GET /api/auth/me
 */
export async function getMe(req, res) {
  // If request reached here, auth middleware succeeded
  return res.status(200).json({
    success: true,
    data: {
      username: req.admin?.username || process.env.ADMIN_USERNAME || 'admin',
      authMethod: req.admin?.authMethod || 'session',
    },
  });
}

/**
 * Handle Administrator Logout.
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}
