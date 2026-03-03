/**
 * Employee Storage Utility
 * 
 * Handles employee identity management and work session tracking using localStorage.
 * This module provides simple storage for individual employee work tracking.
 */

import { WorkSession, WorkStats, Lead, Activity } from '../types/shared';

// ============================================================================
// CONSTANTS
// ============================================================================

const EMPLOYEE_NAME_KEY = 'employeeName';
const WORK_SESSIONS_KEY = 'workSessions';

// ============================================================================
// EMPLOYEE IDENTITY FUNCTIONS
// ============================================================================

/**
 * Get current employee name from localStorage
 */
export function getEmployeeName(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(EMPLOYEE_NAME_KEY);
  } catch (error) {
    console.error('Error getting employee name from localStorage:', error);
    return null;
  }
}

/**
 * Save employee name to localStorage
 */
export function setEmployeeName(name: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(EMPLOYEE_NAME_KEY, name);
  } catch (error) {
    console.error('Error saving employee name to localStorage:', error);
  }
}

/**
 * Check if employee name is set
 */
export function hasEmployeeName(): boolean {
  const name = getEmployeeName();
  return name !== null && name.trim() !== '';
}

// ============================================================================
// WORK SESSION FUNCTIONS
// ============================================================================

/**
 * Load work sessions from localStorage
 */
export function getWorkSessions(): WorkSession[] {
  try {
    if (typeof window === 'undefined') return [];
    const sessionsJson = localStorage.getItem(WORK_SESSIONS_KEY);
    if (!sessionsJson) return [];
    return JSON.parse(sessionsJson);
  } catch (error) {
    console.error('Error loading work sessions from localStorage:', error);
    return [];
  }
}

/**
 * Save work sessions to localStorage
 */
export function saveWorkSessions(sessions: WorkSession[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WORK_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving work sessions to localStorage:', error);
  }
}

/**
 * Generate a simple UUID for session IDs
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Start a new work session
 */
export function startWorkSession(leadId: string, leadName: string): WorkSession {
  const employeeName = getEmployeeName() || 'Unknown';
  const newSession: WorkSession = {
    id: generateUUID(),
    leadId,
    leadName,
    startTime: new Date().toISOString(),
    employeeName
  };
  
  const sessions = getWorkSessions();
  sessions.push(newSession);
  saveWorkSessions(sessions);
  
  return newSession;
}

/**
 * End a work session
 */
export function endWorkSession(sessionId: string): WorkSession | null {
  try {
    const sessions = getWorkSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    const endTime = new Date().toISOString();
    const startTime = new Date(session.startTime);
    const duration = Math.round((new Date(endTime).getTime() - startTime.getTime()) / 60000); // minutes
    
    session.endTime = endTime;
    session.duration = duration;
    
    sessions[sessionIndex] = session;
    saveWorkSessions(sessions);
    
    return session;
  } catch (error) {
    console.error('Error ending work session:', error);
    return null;
  }
}

/**
 * Get active work session for a specific lead
 */
export function getActiveWorkSession(leadId: string): WorkSession | null {
  try {
    const sessions = getWorkSessions();
    return sessions.find(s => s.leadId === leadId && !s.endTime) || null;
  } catch (error) {
    console.error('Error getting active work session:', error);
    return null;
  }
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

/**
 * Calculate work statistics for a given date range
 */
export function calculateWorkStats(startDate: Date, endDate: Date, leads: Lead[]): WorkStats {
  const employeeName = getEmployeeName() || '';
  
  // Initialize stats
  const stats: WorkStats = {
    totalActivities: 0,
    totalLeadsTouched: 0,
    totalTimeSpent: 0,
    activitiesByType: {},
    lastActivityDate: '',
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString()
  };
  
  try {
    const uniqueLeadIds = new Set<string>();
    let lastActivityTimestamp = 0;
    
    // Process activities from all leads
    leads.forEach(lead => {
      if (!lead.activities) return;
      
      lead.activities.forEach((activity: Activity) => {
        const activityDate = new Date(activity.timestamp);
        
        // Check if activity is in date range and by current employee
        if (activityDate >= startDate && activityDate <= endDate) {
          // Filter by employee name if available
          if (activity.employeeName && activity.employeeName !== employeeName) {
            return;
          }
          
          stats.totalActivities++;
          uniqueLeadIds.add(activity.leadId);
          
          // Count by type
          const type = activity.activityType || 'other';
          stats.activitiesByType[type] = (stats.activitiesByType[type] || 0) + 1;
          
          // Track last activity date
          if (activityDate.getTime() > lastActivityTimestamp) {
            lastActivityTimestamp = activityDate.getTime();
            stats.lastActivityDate = activity.timestamp;
          }
        }
      });
    });
    
    stats.totalLeadsTouched = uniqueLeadIds.size;
    
    // Calculate total time from work sessions
    const sessions = getWorkSessions();
    sessions.forEach(session => {
      const sessionStart = new Date(session.startTime);
      
      // Check if session is in date range and by current employee
      if (sessionStart >= startDate && sessionStart <= endDate && session.employeeName === employeeName) {
        if (session.duration) {
          stats.totalTimeSpent += session.duration;
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating work stats:', error);
  }
  
  return stats;
}

