const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { success, serverError, error: apiError } = require('../utils/response');
const { getConcreteAdvisory } = require('../services/weatherService');
const logger = require('../utils/logger');

router.use(authenticate);

/**
 * POST /api/weather/advisory
 * Get weather-based concrete pouring recommendations
 * 
 * Body:
 * {
 *   "location": "Istanbul, Turkey",
 *   "mix_design": { ... } // optional
 * }
 */
router.post('/advisory', async (req, res) => {
  try {
    const { location, mix_design } = req.body;
    
    if (!location) {
      return apiError(res, 'Location is required', 'VALIDATION_ERROR', null, 400);
    }
    
    logger.info('Weather advisory request', { 
      userId: req.user.id, 
      location 
    });
    
    const advisory = await getConcreteAdvisory(location, mix_design);
    
    return success(res, advisory, 'Weather advisory generated successfully');
    
  } catch (err) {
    logger.error('Weather advisory error', { 
      error: err.message,
      userId: req.user.id 
    });
    
    if (err.message === 'Location not found') {
      return apiError(res, 'Could not find the specified location', 'LOCATION_NOT_FOUND', null, 404);
    }
    
    if (err.message === 'Unable to fetch weather data') {
      return apiError(res, 'Weather service temporarily unavailable', 'WEATHER_SERVICE_ERROR', null, 503);
    }
    
    return serverError(res);
  }
});

/**
 * POST /api/weather/pour-schedule
 * Get optimal pouring schedule for a project
 * 
 * Body:
 * {
 *   "location": "Istanbul, Turkey",
 *   "pour_volume": 50, // m³
 *   "start_date": "2026-05-15",
 *   "duration_days": 7
 * }
 */
router.post('/pour-schedule', async (req, res) => {
  try {
    const { location, pour_volume, start_date, duration_days = 7 } = req.body;
    
    if (!location) {
      return apiError(res, 'Location is required', 'VALIDATION_ERROR', null, 400);
    }
    
    const advisory = await getConcreteAdvisory(location);
    
    // Filter optimal windows and calculate schedule
    const schedule = generatePourSchedule(advisory, {
      pour_volume,
      start_date,
      duration_days
    });
    
    return success(res, {
      location: advisory.location,
      schedule,
      summary: {
        total_optimal_windows: schedule.optimal_days.length,
        total_caution_windows: schedule.caution_days.length,
        recommended_pour_days: schedule.recommended_days,
        weather_risks: advisory.durability_risks
      }
    }, 'Pour schedule generated successfully');
    
  } catch (err) {
    logger.error('Pour schedule error', { 
      error: err.message,
      userId: req.user.id 
    });
    
    return serverError(res);
  }
});

/**
 * Helper: Generate pouring schedule from weather advisory
 */
function generatePourSchedule(advisory, options) {
  const { optimal_windows, caution_windows, unsuitable_windows } = advisory;
  
  // Group by date
  const byDate = {};
  
  optimal_windows.forEach(window => {
    if (!byDate[window.date]) {
      byDate[window.date] = { optimal: [], caution: [], unsuitable: [] };
    }
    byDate[window.date].optimal.push(window);
  });
  
  caution_windows.forEach(window => {
    if (!byDate[window.date]) {
      byDate[window.date] = { optimal: [], caution: [], unsuitable: [] };
    }
    byDate[window.date].caution.push(window);
  });
  
  unsuitable_windows.forEach(window => {
    if (!byDate[window.date]) {
      byDate[window.date] = { optimal: [], caution: [], unsuitable: [] };
    }
    byDate[window.date].unsuitable.push(window);
  });
  
  // Categorize days
  const optimal_days = [];
  const caution_days = [];
  const unsuitable_days = [];
  const recommended_days = [];
  
  Object.entries(byDate).forEach(([date, windows]) => {
    const optimalCount = windows.optimal.length;
    const cautionCount = windows.caution.length;
    const unsuitableCount = windows.unsuitable.length;
    
    const dayInfo = {
      date,
      windows: windows.optimal.concat(windows.caution),
      optimal_count: optimalCount,
      caution_count: cautionCount,
      unsuitable_count: unsuitableCount,
      score: (optimalCount * 3 + cautionCount * 1 - unsuitableCount * 2)
    };
    
    if (optimalCount >= 3) {
      optimal_days.push(dayInfo);
      recommended_days.push(date);
    } else if (optimalCount + cautionCount >= 3) {
      caution_days.push(dayInfo);
    } else {
      unsuitable_days.push(dayInfo);
    }
  });
  
  return {
    optimal_days: optimal_days.sort((a, b) => b.score - a.score),
    caution_days: caution_days.sort((a, b) => b.score - a.score),
    unsuitable_days,
    recommended_days: recommended_days.slice(0, 3),
    best_day: optimal_days.length > 0 ? optimal_days[0] : null
  };
}

module.exports = router;
