'use client';

import { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import { useRouter } from 'next/navigation';

export default function ReminderSystem() {
  const { leads } = useLeads();
  const router = useRouter();
  const [notifications, setNotifications] = useState<{ id: string; message: string; leadId: string }[]>([]);
  
  // Check for due and overdue follow-ups
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueLeads = leads.filter(lead => {
      if (lead.isDone) return false;
      
      const followUpDate = new Date(lead.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      
      return followUpDate.getTime() <= today.getTime();
    });
    
    // Create notifications for due leads
    const newNotifications = dueLeads.map(lead => {
      const followUpDate = new Date(lead.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      
      const isOverdue = followUpDate.getTime() < today.getTime();
      
      return {
        id: crypto.randomUUID(),
                message: isOverdue
          ? `OVERDUE: Follow-up with ${lead.kva} from ${lead.company} was due on ${new Date(lead.followUpDate).toLocaleDateString()}`
          : `Follow-up with ${lead.kva} from ${lead.company} is due today`,
        leadId: lead.id
      };
    });
    
    setNotifications(newNotifications);
  }, [leads]);
  
  // Dismiss notification
  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };
  
  // Navigate to lead detail
  const goToLead = (leadId: string) => {
    router.push(`/lead/${leadId}`);
  };
  
  if (notifications.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className="bg-white rounded-lg shadow-lg p-4 mb-2 border-l-4 border-yellow-500 flex justify-between items-start"
        >
          <div className="flex-1">
            <p className="text-gray-800">{notification.message}</p>
            <div className="mt-2 flex space-x-2">
              <button 
                onClick={() => goToLead(notification.leadId)}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                View Lead
              </button>
              <button 
                onClick={() => dismissNotification(notification.id)}
                className="text-sm px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button 
            onClick={() => dismissNotification(notification.id)}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}