const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Weather Service for Concrete Pouring Recommendations
 * Integrates OpenWeatherMap API to provide:
 * - Optimal pouring windows
 * - Slump loss predictions
 * - Durability risk assessment
 */

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Get weather forecast for a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather forecast data
 */
async function getWeatherForecast(lat, lon) {
  try {
    const response = await axios.get(`${BASE_URL}/forecast`, {
      params: {
        lat,
        lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric'
      }
    });

    return response.data;
  } catch (err) {
    logger.error('Weather API error', { error: err.message });
    throw new Error('Unable to fetch weather data');
  }
}

/**
 * Geocode a location string to coordinates
 * @param {string} location - City name, address, or coordinates
 * @returns {Promise<Object>} { lat, lon, name }
 */
async function geocodeLocation(location) {
  try {
    const response = await axios.get(`http://api.openweathermap.org/geo/1.0/direct`, {
      params: {
        q: location,
        limit: 1,
        appid: OPENWEATHER_API_KEY
      }
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('Location not found');
    }

    const { lat, lon, name, country } = response.data[0];
    return { lat, lon, name: `${name}, ${country}` };
  } catch (err) {
    logger.error('Geocoding error', { error: err.message, location });
    throw new Error('Unable to geocode location');
  }
}

/**
 * Analyze weather conditions for concrete pouring
 * @param {Object} forecast - Weather forecast data
 * @param {Object} mixDesign - Mix design parameters
 * @returns {Object} Analysis with recommendations
 */
function analyzeConcreteConditions(forecast, mixDesign = {}) {
  const analysis = {
    optimal_windows: [],
    caution_windows: [],
    unsuitable_windows: [],
    slump_loss_predictions: [],
    durability_risks: [],
    recommendations: []
  };

  forecast.list.forEach((item) => {
    const temp = item.main.temp;
    const humidity = item.main.humidity;
    const wind = item.wind.speed;
    const rain = item.rain?.['3h'] || 0;
    const time = new Date(item.dt * 1000);

    const conditions = assessConditions(temp, humidity, wind, rain);
    const slumpLoss = calculateSlumpLoss(temp, humidity, wind);

    const window = {
      date: time.toLocaleDateString('en-GB'),
      time: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      timestamp: item.dt,
      temperature: Math.round(temp),
      humidity,
      wind_speed: wind,
      precipitation: rain,
      conditions: conditions.category,
      slump_loss_rate: slumpLoss,
      score: conditions.score
    };

    // Categorize windows
    if (conditions.category === 'OPTIMAL') {
      analysis.optimal_windows.push(window);
    } else if (conditions.category === 'CAUTION') {
      analysis.caution_windows.push(window);
    } else {
      analysis.unsuitable_windows.push(window);
    }

    // Track slump loss
    analysis.slump_loss_predictions.push({
      timestamp: item.dt,
      time: window.time,
      date: window.date,
      slump_loss_per_hour: slumpLoss,
      temperature: temp,
      explanation: getSlumpLossExplanation(temp, humidity, wind)
    });
  });

  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis, mixDesign);
  analysis.durability_risks = assessDurabilityRisks(forecast.list);

  return analysis;
}

/**
 * Assess concrete pouring conditions
 */
function assessConditions(temp, humidity, wind, rain) {
  let score = 100;
  let category = 'OPTIMAL';
  const issues = [];

  // Temperature assessment
  if (temp < 5) {
    score -= 50;
    category = 'UNSUITABLE';
    issues.push('Too cold - risk of freezing');
  } else if (temp < 10) {
    score -= 20;
    category = 'CAUTION';
    issues.push('Cold weather - slow strength gain');
  } else if (temp > 32) {
    score -= 30;
    category = 'CAUTION';
    issues.push('Hot weather - rapid slump loss');
  } else if (temp > 38) {
    score -= 50;
    category = 'UNSUITABLE';
    issues.push('Extreme heat - severe slump loss');
  }

  // Humidity assessment
  if (humidity < 30 && temp > 25) {
    score -= 20;
    category = category === 'OPTIMAL' ? 'CAUTION' : category;
    issues.push('Low humidity - rapid evaporation');
  }

  // Wind assessment
  if (wind > 8) {
    score -= 15;
    category = category === 'OPTIMAL' ? 'CAUTION' : category;
    issues.push('High wind - increased evaporation');
  }

  // Rain assessment
  if (rain > 0.5) {
    score -= 40;
    category = 'UNSUITABLE';
    issues.push('Rain expected - unsuitable for pouring');
  }

  return { score, category, issues };
}

/**
 * Calculate slump loss rate (mm per hour)
 */
function calculateSlumpLoss(temp, humidity, wind) {
  // Base slump loss at 20°C, 60% humidity, no wind
  let baseLoss = 25; // mm/hr

  // Temperature factor (increases exponentially with heat)
  const tempFactor = temp > 20 ? 1 + (temp - 20) * 0.08 : 1 - (20 - temp) * 0.02;

  // Humidity factor (lower humidity = faster loss)
  const humidityFactor = 1 + (60 - humidity) * 0.01;

  // Wind factor
  const windFactor = 1 + wind * 0.05;

  const slumpLoss = baseLoss * tempFactor * humidityFactor * windFactor;

  return Math.round(slumpLoss);
}

/**
 * Explain slump loss factors
 */
function getSlumpLossExplanation(temp, humidity, wind) {
  const factors = [];
  
  if (temp > 25) factors.push('High temperature accelerates evaporation');
  if (humidity < 50) factors.push('Low humidity increases water loss');
  if (wind > 5) factors.push('Wind accelerates surface drying');
  
  return factors.length > 0 
    ? factors.join('. ') + '.'
    : 'Favorable conditions with minimal slump loss.';
}

/**
 * Assess durability risks based on weather patterns
 */
function assessDurabilityRisks(forecastList) {
  const risks = [];

  // Check for freeze-thaw cycles
  const freezeThawCycles = forecastList.filter((item, i) => {
    if (i === 0) return false;
    const prev = forecastList[i - 1];
    return (prev.main.temp > 0 && item.main.temp < 0) ||
           (prev.main.temp < 0 && item.main.temp > 0);
  });

  if (freezeThawCycles.length > 0) {
    risks.push({
      type: 'FREEZE_THAW',
      severity: 'HIGH',
      description: `${freezeThawCycles.length} freeze-thaw cycles detected in forecast period`,
      recommendation: 'Use air-entrained concrete and ensure proper curing before first freeze'
    });
  }

  // Check for extreme temperature swings
  const temps = forecastList.map(item => item.main.temp);
  const tempRange = Math.max(...temps) - Math.min(...temps);
  
  if (tempRange > 20) {
    risks.push({
      type: 'THERMAL_STRESS',
      severity: 'MEDIUM',
      description: `Large temperature variation (${Math.round(tempRange)}°C) may cause thermal stress`,
      recommendation: 'Consider insulated curing blankets and gradual temperature changes'
    });
  }

  // Check for prolonged high temperatures
  const hotDays = forecastList.filter(item => item.main.temp > 30).length;
  if (hotDays > 8) {
    risks.push({
      type: 'HOT_WEATHER',
      severity: 'HIGH',
      description: 'Extended hot weather period detected',
      recommendation: 'Use retarding admixtures, increase curing water, consider night pours'
    });
  }

  return risks;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(analysis, mixDesign) {
  const recommendations = [];

  // Best pouring times
  if (analysis.optimal_windows.length > 0) {
    const best = analysis.optimal_windows
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    recommendations.push({
      category: 'TIMING',
      priority: 'HIGH',
      title: 'Optimal Pouring Windows',
      description: `Best times: ${best.map(w => `${w.date} ${w.time}`).join(', ')}`,
      details: best.map(w => 
        `${w.date} ${w.time}: ${w.temperature}°C, ${w.humidity}% humidity (Score: ${w.score}/100)`
      )
    });
  }

  // Slump loss warnings
  const highSlumpLoss = analysis.slump_loss_predictions
    .filter(p => p.slump_loss_per_hour > 50);
  
  if (highSlumpLoss.length > 0) {
    recommendations.push({
      category: 'WORKABILITY',
      priority: 'HIGH',
      title: 'High Slump Loss Expected',
      description: `Slump loss rates up to ${Math.max(...highSlumpLoss.map(p => p.slump_loss_per_hour))} mm/hr detected`,
      details: [
        'Consider adding retarding admixtures',
        'Plan for faster placement',
        'Keep concrete covered during transport',
        'Increase water slightly if allowed by code'
      ]
    });
  }

  // Weather-specific advice
  if (analysis.unsuitable_windows.length > analysis.optimal_windows.length) {
    recommendations.push({
      category: 'SCHEDULING',
      priority: 'CRITICAL',
      title: 'Limited Suitable Windows',
      description: 'Weather conditions are mostly unfavorable in the forecast period',
      details: [
        'Consider postponing pour if possible',
        'Prepare additional weather protection measures',
        'Have backup equipment ready (heaters/coolers, tarps)',
        'Coordinate closely with ready-mix supplier'
      ]
    });
  }

  return recommendations;
}

/**
 * Get concrete pouring advisory
 * Main entry point for the weather service
 */
async function getConcreteAdvisory(location, mixDesign = {}) {
  try {
    // Geocode location
    const coords = await geocodeLocation(location);
    
    // Get forecast
    const forecast = await getWeatherForecast(coords.lat, coords.lon);
    
    // Analyze conditions
    const analysis = analyzeConcreteConditions(forecast, mixDesign);
    
    return {
      location: coords.name,
      coordinates: { lat: coords.lat, lon: coords.lon },
      forecast_period: {
        start: new Date(forecast.list[0].dt * 1000).toISOString(),
        end: new Date(forecast.list[forecast.list.length - 1].dt * 1000).toISOString(),
        intervals: forecast.list.length
      },
      ...analysis
    };
  } catch (err) {
    logger.error('Concrete advisory error', { error: err.message });
    throw err;
  }
}

module.exports = {
  getConcreteAdvisory,
  getWeatherForecast,
  geocodeLocation,
  analyzeConcreteConditions
};
