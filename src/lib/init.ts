/**
 * Application Initialization
 * 
 * This module runs startup validation and initialization tasks.
 * Import this file at the top of your application entry point.
 */
import { logStartupValidation } from './startup-validator';

// Run startup validation
if (typeof window === 'undefined') {
  // Only run on server-side
  logStartupValidation();
}
