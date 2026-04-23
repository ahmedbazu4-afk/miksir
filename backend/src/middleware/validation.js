const Joi = require('joi');

// ─── Auth ────────────────────────────────────────────────────────

const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      'any.required': 'Password is required',
    }),
  name: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Name is required',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  new_password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    }),
});

const changePasswordSchema = Joi.object({
  old_password: Joi.string().required(),
  new_password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  avatar_url: Joi.string().uri().allow('', null),
  preferences: Joi.object({
    code_standard: Joi.string(),
    default_exposure_class: Joi.string(),
    unit_preference: Joi.string().valid('metric', 'imperial'),
  }),
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

// ─── Chat ────────────────────────────────────────────────────────

const createChatSchema = Joi.object({
  title: Joi.string().max(200).allow('', null),
});

const updateChatSchema = Joi.object({
  title: Joi.string().max(200).required(),
});

const postMessageSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required(),
  role: Joi.string().valid('user').required(),
});

// ─── Mix Design ──────────────────────────────────────────────────

const generateDesignSchema = Joi.object({
  chat_id: Joi.string().uuid().allow(null),
  project_context: Joi.object({
    structure_type: Joi.string().required(),
    exposure_class: Joi.string().required(),
    location: Joi.string().allow('', null),
    code_standard: Joi.string().valid('ACI_211', 'BS_8500', 'EN_206', 'TS_500').required(),
  }).required(),
  strength_requirements: Joi.object({
    target_strength: Joi.string().required(),     // e.g. "C35" or "25 MPa"
    strength_age: Joi.number().integer().min(1).max(90).default(28),
    durability_rating: Joi.string().valid('low', 'moderate', 'high', 'very_high').required(),
  }).required(),
  materials: Joi.object({
    cement_type: Joi.string().required(),
    cement_specific_gravity: Joi.number().min(2.8).max(3.5).default(3.15),
    coarse_aggregate_size: Joi.number().valid(9.5, 12.5, 19, 25, 37.5, 50, 75).required(),
    coarse_aggregate_unit_weight: Joi.number().min(1000).max(2000).default(1600), // kg/m³ dry-rodded
    coarse_aggregate_bulk_sg_ssd: Joi.number().min(2.0).max(3.0).default(2.68),
    coarse_aggregate_absorption: Joi.number().min(0).max(10).default(0.5),        // %
    coarse_aggregate_moisture: Joi.number().min(0).max(20).default(2.0),          // %
    fine_aggregate_fineness_modulus: Joi.number().min(2.0).max(3.5).default(2.6),
    fine_aggregate_bulk_sg_ssd: Joi.number().min(2.0).max(3.0).default(2.62),
    fine_aggregate_absorption: Joi.number().min(0).max(10).default(1.0),          // %
    fine_aggregate_moisture: Joi.number().min(0).max(20).default(5.0),            // %
    admixtures: Joi.array().items(Joi.string()).default([]),
    air_entrained: Joi.boolean().default(false),
  }).required(),
  workability: Joi.object({
    slump: Joi.number().min(25).max(200).required(),  // mm
    placement_method: Joi.string().valid('pump', 'bucket', 'chute', 'conveyor', 'manual').default('bucket'),
  }).required(),
});

// ─── Validation helper ───────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
  }
  req.body = value;
  next();
};

module.exports = {
  validate,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  refreshTokenSchema,
  createChatSchema,
  updateChatSchema,
  postMessageSchema,
  generateDesignSchema,
};
