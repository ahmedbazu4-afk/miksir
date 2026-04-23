const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, updateProfileSchema, changePasswordSchema } = require('../middleware/validation');
const { success, serverError, notFound } = require('../utils/response');
const logger = require('../utils/logger');

// All routes require authentication
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, preferences, created_at, updated_at')
      .eq('id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return notFound(res, 'User');

    return success(res, data);
  } catch (err) {
    logger.error('Get profile error', { error: err.message, userId: req.user.id });
    return serverError(res);
  }
});

// PUT /api/users/profile
router.put('/profile', validate(updateProfileSchema), async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      logger.error('Update profile error', { error: error.message, userId: req.user.id });
      return serverError(res);
    }

    return success(res, data, 'Profile updated');
  } catch (err) {
    logger.error('Update profile handler error', { error: err.message });
    return serverError(res);
  }
});

// POST /api/users/change-password
router.post('/change-password', validate(changePasswordSchema), async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    // Verify old password by attempting sign-in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: old_password,
    });

    if (signInErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    // Update password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: new_password,
    });

    if (updateErr) {
      logger.error('Change password error', { error: updateErr.message, userId: req.user.id });
      return serverError(res);
    }

    return success(res, {}, 'Password changed successfully');
  } catch (err) {
    logger.error('Change password handler error', { error: err.message });
    return serverError(res);
  }
});

// DELETE /api/users/profile  (soft delete)
router.delete('/profile', async (req, res) => {
  try {
    // Soft-delete user record
    await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', req.user.id);

    // Disable Supabase Auth account
    await supabase.auth.admin.updateUserById(req.user.id, { ban_duration: '876600h' });

    return success(res, {}, 'Account deleted');
  } catch (err) {
    logger.error('Delete account error', { error: err.message, userId: req.user.id });
    return serverError(res);
  }
});

module.exports = router;
