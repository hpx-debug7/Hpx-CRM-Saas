'use client';

import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useLeads } from '../context/LeadContext';
import type { Lead } from '../types/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import EditableTable from '../components/EditableTable';
import { validateLeadField } from '../hooks/useValidation';
import { useColumns } from '../context/ColumnContext';

const LeadDetailModal = lazy(() => import('../components/LeadDetailModal'));
const LoadingSpinner = lazy(() => import('../components/LoadingSpinner'));

export default function FollowUpMandatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { leads, deleteLead, updateLead, addActivity } = useLeads();
  const { getVisibleColumns } = useColumns();
  const [activeTab, setActiveTab] = useState<'pending' | 'signed'>('pending');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Show toast notification
  const showToastNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }, []);

  // Handle URL parameters to set the correct tab when returning from add-lead form
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'signed' || tab === 'mandate-sent') {
      setActiveTab('signed');
    } else if (tab === 'pending' || tab === 'documentation') {
      setActiveTab('pending');
    }
  }, [searchParams]);

  // Filter leads based on status
  const documentation = leads.filter(lead => 
    !lead.isDeleted && lead.status === 'Documentation' && !lead.isDone
  );

  const mandateSent = leads.filter(lead => 
    !lead.isDeleted && lead.status === 'Mandate Sent' && !lead.isDone
  );

  // Modal functions
  const openModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedLead(null);
    setShowLeadModal(false);
    document.body.style.overflow = 'unset';
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showLeadModal) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLeadModal]);

  // Handle modal return from edit form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const returnToModal = urlParams.get('returnToModal');
    const leadId = urlParams.get('leadId');
    
    if (returnToModal === 'true' && leadId) {
      // Ensure tab is set correctly first
      const tab = urlParams.get('tab');
      if (tab === 'signed' || tab === 'mandate-sent') {
        setActiveTab('signed');
      } else if (tab === 'pending' || tab === 'documentation') {
        setActiveTab('pending');
      }
      
      // Find the lead and open the modal
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setShowLeadModal(true);
        document.body.style.overflow = 'hidden';
      }
      
      // Clean up URL parameters while preserving tab parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('returnToModal');
      newUrl.searchParams.delete('leadId');
      // Preserve the tab parameter if it exists
      if (tab) {
        newUrl.searchParams.set('tab', tab);
      }
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [leads]);

  // Handle lead click
  const handleLeadClick = (lead: any) => {
    openModal(lead);
  };


  // Handle cell update
  const handleCellUpdate = useCallback(async (leadId: string, field: string, value: string) => {
    try {
      // Find the lead
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Get current column configuration to validate dynamic fields
      const visibleColumns = getVisibleColumns();
      const columnConfig = visibleColumns.find(col => col.fieldKey === field);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Cell update debug:', { leadId, field, value, columnConfig });
      }
      
      // Validate the field (including custom columns)
      const error = validateLeadField(field as keyof Lead, value, lead, columnConfig);
      
      if (error) {
        // Set validation error
        setValidationErrors(prev => ({
          ...prev,
          [leadId]: {
            ...prev[leadId],
            [field]: error
          }
        }));
        throw new Error(error);
      }

      // Clear validation error if validation passes
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[leadId]) {
          const leadErrors = { ...newErrors[leadId] };
          delete leadErrors[field];
          if (Object.keys(leadErrors).length === 0) {
            delete newErrors[leadId];
          } else {
            newErrors[leadId] = leadErrors;
          }
        }
        return newErrors;
      });

      // Handle special formatting for different field types
      let formattedValue = value;
      
      // Handle mobileNumbers field (JSON string)
      if (field === 'mobileNumbers' && value) {
        try {
          const parsed = JSON.parse(value);
          formattedValue = JSON.stringify(parsed);
        } catch (e) {
          throw new Error('Invalid mobile numbers format');
        }
      } else if (columnConfig?.type === 'date' && value) {
        // Format date fields consistently
        const formatDateToDDMMYYYY = (dateStr: string) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return date.toLocaleDateString('en-GB');
        };
        formattedValue = formatDateToDDMMYYYY(value);
      }

      // Update the lead with proper field access using safe property assignment
      let updatedLead = {
        ...lead,
        [field]: formattedValue,
        lastActivityDate: new Date().toLocaleDateString('en-GB') // DD-MM-YYYY format
      } as Lead & Record<string, any>; // Allow dynamic properties

      // Clear follow-up date when status changes to "Work Alloted"
      if (field === 'status' && value === 'Work Alloted') {
        updatedLead = { ...updatedLead, followUpDate: '' };
      }

      // Only touch activity for important field changes
      const shouldTouchActivity = ['status', 'followUpDate', 'notes'].includes(field);
      await updateLead(updatedLead, { touchActivity: shouldTouchActivity });
      
      // Auto-log status changes
      if (field === 'status') {
        const oldStatus = lead.status;
        addActivity(leadId, `Status changed from ${oldStatus} to ${value}`, {
          activityType: 'status_change',
          metadata: { oldStatus, newStatus: value }
        });

        if (value === 'Work Alloted') {
          showToastNotification('Status changed to WAO. Follow-up date has been automatically cleared.', 'info');
          return; // Prevent generic success toast
        }
      }
      
      showToastNotification('Lead updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating cell:', error);
      showToastNotification(error instanceof Error ? error.message : 'Failed to update lead', 'error');
      throw error;
    }
  }, [leads, updateLead, showToastNotification, getVisibleColumns, addActivity]);


  // Handle edit lead
  const handleEditLead = (lead: Lead) => {
    // Store the lead data in localStorage for editing
    localStorage.setItem('editingLead', JSON.stringify(lead));
    // Store modal return data for ESC key functionality
    const sourcePage = activeTab === 'pending' ? 'documentation' : 'mandate-sent';
    localStorage.setItem('modalReturnData', JSON.stringify({
      sourcePage: sourcePage,
      leadId: lead.id
    }));
    // Navigate to add-lead page with a flag to indicate we're editing
    router.push(`/add-lead?mode=edit&id=${lead.id}&from=${sourcePage}`);
  };


  return (
    <div className="container mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-sm font-bold text-White-800">Follow-up Mandate & Documentation</h1>
          <p className="text-sm text-white mt-2">Manage mandate status and document tracking</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Back to Dashboard
        </button>
      </div>


      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-black hover:text-black hover:border-gray-300'
              }`}
            >
              Documentation ({documentation.length})
            </button>
            <button
              onClick={() => setActiveTab('signed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'signed'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-black hover:text-black hover:border-gray-300'
              }`}
            >
              Mandate Sent ({mandateSent.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'pending' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">Documentation</h2>
              </div>
              <EditableTable
                leads={documentation}
                onLeadClick={handleLeadClick}
                editable={true}
                onCellUpdate={handleCellUpdate}
                validationErrors={validationErrors}
                headerEditable={false}
                emptyMessage="No leads waiting for documents"
              />
            </div>
          )}

          {activeTab === 'signed' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">Mandate Sent</h2>
              </div>
              <EditableTable
                leads={mandateSent}
                onLeadClick={handleLeadClick}
                editable={true}
                onCellUpdate={handleCellUpdate}
                validationErrors={validationErrors}
                headerEditable={false}
                emptyMessage="No leads with mandate sent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showLeadModal && selectedLead && (
        <Suspense fallback={<LoadingSpinner text="Loading..." />}>
          <LeadDetailModal
            isOpen={showLeadModal}
            onClose={() => {
              setShowLeadModal(false);
              document.body.style.overflow = 'unset';
            }}
            lead={selectedLead}
            onEdit={handleEditLead}
          />
        </Suspense>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-4 rounded-lg shadow-lg text-white font-medium ${
            toastType === 'success' ? 'bg-green-600' :
            toastType === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}>
            <div className="flex items-center space-x-3">
              {toastType === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toastType === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {toastType === 'info' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{toastMessage}</span>
              <button
                onClick={() => setShowToast(false)}
                className="ml-4 text-white hover:text-gray-200"
                title="Close notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
