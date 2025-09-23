// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' // Use relative URLs in production (same domain)
  : 'http://localhost:5000'; // Use localhost in development

export default API_BASE_URL;
