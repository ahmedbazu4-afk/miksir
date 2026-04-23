const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { success, created, error, serverError, conflict, validationError } = require('../utils/response');
const { validate, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

// POST /auth/signup
router.post('/signup', validate(signupSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Create user via Supabase Auth (handles password hashing)
    const { data, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr) {
      if (authErr.message?.includes('already registered') || authErr.code === 'email_exists') {
        return conflict(res, 'Email already registered');
      }
      logger.error('Signup error', { error: authErr.message });
      return serverError(res);
    }

    // Upsert profile in public.users table
    await supabase.from('users').upsert({
      id: data.user.id,
      email,
      name,
      preferences: { code_standard: 'EN_206', unit_preference: 'metric' },
    });

    // Sign in to get tokens
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      logger.error('Post-signup sign-in error', { error: signInErr.message });
      return serverError(res);
    }

    return created(res, {
      user: { id: data.user.id, email, name, created_at: data.user.created_at },
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_in: session.session.expires_in,
      },
    }, 'Account created successfully');
  } catch (err) {
    logger.error('Signup handler error', { error: err.message });
    return serverError(res);
  }
});

// POST /auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      return error(res, 'Invalid email or password', 'INVALID_CREDENTIALS', null, 401);
    }

    // Fetch profile
    const { data: profile } = await supabase.from('users').select('name, avatar_url').eq('id', data.user.id).single();

    return success(res, {
      user: { id: data.user.id, email: data.user.email, name: profile?.name, avatar_url: profile?.avatar_url },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    }, 'Login successful');
  } catch (err) {
    logger.error('Login handler error', { error: err.message });
    return serverError(res);
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    // Always return the same message (don't confirm user existence)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });
    return success(res, {}, 'If an account with that email exists, a password reset link has been sent.');
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    return success(res, {}, 'If an account with that email exists, a password reset link has been sent.');
  }
});

// POST /auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, new_password } = req.body;

    // Exchange the recovery token for a session, then update password
    const { data: sessionData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(token);
    if (exchangeErr) {
      return error(res, 'Invalid or expired reset token', 'INVALID_TOKEN', null, 400);
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(sessionData.user.id, { password: new_password });
    if (updateErr) {
      logger.error('Reset password update error', { error: updateErr.message });
      return serverError(res);
    }

    return success(res, {}, 'Password reset successful');
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    return serverError(res);
  }
});

// POST /auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req, res) => {
  try {
    const { refresh_token } = req.body;

    const { data, error: refreshErr } = await supabase.auth.refreshSession({ refresh_token });
    if (refreshErr || !data.session) {
      return error(res, 'Invalid or expired refresh token', 'UNAUTHORIZED', null, 401);
    }

    return success(res, {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
    });
  } catch (err) {
    logger.error('Refresh error', { error: err.message });
    return serverError(res);
  }
});

// POST /auth/google — Supabase OAuth redirect
router.post('/google', async (req, res) => {
  try {
    const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.FRONTEND_URL}/auth/callback` },
    });
    if (oauthErr) return serverError(res);
    return success(res, { url: data.url }, 'Redirect to Google OAuth');
  } catch (err) {
    logger.error('Google OAuth error', { error: err.message });
    return serverError(res);
  }
});

module.exports = router;
