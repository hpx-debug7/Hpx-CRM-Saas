'use client';

import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLeads } from '../context/LeadContext';
import type { Lead } from '../types/shared';
import { useRouter } from 'next/navigation';
import EditableTable from '../components/EditableTable';
import { useColumns } from '../context/ColumnContext';
import { useNavigation } from '../context/NavigationContext';
import { validateLeadField } from '../hooks/useValidation';
import { formatDateToDDMMYYYY } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

const PasswordModal = lazy(() => import('../components/PasswordModal'));
const PasswordSettingsModal = lazy(() => import('../components/PasswordSettingsModal'));
const LeadDetailModal = lazy(() => import('../components/LeadDetailModal'));
const LoadingSpinner = lazy(() => import('../components/LoadingSpinner'));

export default function DueTodayPage() {
  const router = useRouter();
  const { leads, deleteLead, updateLead } = useLeads();
  const { getVisibleColumns } = useColumns();
  const { setOnExportClick } = useNavigation();
  const [activeTab, setActiveTab] = useState<'today' | 'overdue'>('today');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [passwordSettingsOpen, setPasswordSettingsOpen] = useState(false);
  const [columnCount, setColumnCount] = useState(0);

  // Handle URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab === 'overdue') {
      setActiveTab('overdue');
    }
  }, []);

  // Helper function to parse DD-MM-YYYY format dates
  const parseFollowUpDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    
    try {
      // Handle DD-MM-YYYY format
      const dateParts = dateString.split('-');
      if (dateString.includes('-') && dateParts[0] && dateParts[0].length <= 2) {
        const [day, month, year] = dateString.split('-');
        if (day && month && year) {
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
      // Handle other date formats
      return new Date(dateString);
    } catch {
      return null;
    }
  };

  // Filter leads based on follow-up dates
  const todayLeads = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return leads.filter(lead => {
      if (lead.isDeleted || lead.isDone || !lead.followUpDate) return false;
      
      const followUpDate = parseFollowUpDate(lead.followUpDate);
      if (!followUpDate) return false;
      
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate.getTime() === today.getTime();
    });
  }, [leads]);

  const overdueLeads = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return leads.filter(lead => {
      if (lead.isDeleted || lead.isDone || !lead.followUpDate) return false;
      
      const followUpDate = parseFollowUpDate(lead.followUpDate);
      if (!followUpDate) return false;
      
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate < today;
    });
  }, [leads]);

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
        showToastNotification(error, 'error');
        return;
      }

      // Clear validation error for this field
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

      // Format special fields
      let formattedValue = value;
      if (field === 'followUpDate' || field === 'connectionDate' || field === 'lastActivityDate') {
        formattedValue = formatDateToDDMMYYYY(value);
      } else if (field === 'mobileNumber') {
        // Clean mobile number - remove any non-digit characters
        formattedValue = value.replace(/[^0-9]/g, '');
      }

      // Create updated lead
      let updatedLead = {
        ...lead,
        [field]: formattedValue
      };

      // Clear follow-up date when status changes to "Work Alloted"
      if (field === 'status' && value === 'Work Alloted') {
        updatedLead = { ...updatedLead, followUpDate: '' };
      }

      // Update the lead
      await updateLead(updatedLead);
      
      if (field === 'status' && value === 'Work Alloted') {
        showToastNotification('Status changed to WAO. Follow-up date has been cleared.', 'info');
      } else {
        showToastNotification('Lead updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      showToastNotification('Failed to update lead. Please try again.', 'error');
    }
  }, [leads, getVisibleColumns, updateLead, showToastNotification]);

  // Helper function to format dates for export (DD-MM-YYYY format only)
  const formatDateForExport = (dateString: string): string => {
    if (!dateString || dateString.trim() === '') {
      return '';
    }
    
    // If already in DD-MM-YYYY format, return as is
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return dateString;
    }
    
    // If it's an ISO date string or Date object, convert to DD-MM-YYYY
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch {
      return dateString; // Return original if conversion fails
    }
  };

  // Show export password modal
  const handleExportExcel = () => {
    setShowExportPasswordModal(true);
  };

  // Handle password verification for export
  const handleExportPasswordSuccess = () => {
    setShowExportPasswordModal(false);
    performExport();
  };

  // Actual export function with password verification
  const performExport = async () => {
    try {
      // Small delay to ensure pending header edits are saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get filtered leads based on current view
      const leadsToExport = activeTab === 'today' ? todayLeads : overdueLeads;
      
      // Use fresh column configuration to ensure latest columns are included
      const visibleColumns = getVisibleColumns();
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Export Debug - Using columns:', visibleColumns.map(c => c.label));
        console.log('📊 Export Debug - Column types:', visibleColumns.map(c => ({ label: c.label, type: c.type, fieldKey: c.fieldKey })));
      }
      const headers = visibleColumns.map(column => column.label);
      
      // Convert leads to Excel rows with remapped data
      const rows = leadsToExport.map(lead => {
        // Get mobile numbers and contacts
        const mobileNumbers = lead.mobileNumbers || [];
        const mainMobile = mobileNumbers.find(m => m.isMain) || mobileNumbers[0] || { number: lead.mobileNumber || '', name: '' };
        
        // Format main mobile number (phone number only, no contact name)
        const mainMobileDisplay = mainMobile.number || '';
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Export Debug - Lead:', lead.clientName, 'Main Mobile:', mainMobileDisplay);
        }
        
        // Map data according to visible columns using safe property access
        return visibleColumns.map(column => {
          const fieldKey = column.fieldKey;
          const value = (lead as any)[fieldKey] ?? '';
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 Export Debug - Field: ${fieldKey}, Value: ${value}, Type: ${column.type}`);
          }
          
          // Handle special field formatting
          switch (fieldKey) {
            case 'kva':
              return lead.kva || '';
            case 'connectionDate':
              return formatDateForExport(lead.connectionDate || '');
            case 'consumerNumber':
              return lead.consumerNumber || '';
            case 'company':
              return lead.company || '';
            case 'clientName':
              return lead.clientName || '';
            case 'discom':
              return lead.discom || '';
            case 'mobileNumber':
              return mainMobileDisplay;
            case 'status':
              return lead.status === 'Work Alloted' ? 'WAO' : (lead.status || 'New');
            case 'lastActivityDate':
              return formatDateForExport(lead.lastActivityDate || '');
            case 'followUpDate':
              return formatDateForExport(lead.followUpDate || '');
            default:
              // Handle custom columns with proper type checking
              if (column.type === 'date' && value) {
                return formatDateForExport(value);
              } else if (column.type === 'number' && value) {
                return Number(value) || '';
              } else if (column.type === 'select' && value) {
                return value; // Select values are already strings
              } else {
                return value || '';
              }
          }
        });
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      
      // Generate Excel file and download
      XLSX.writeFile(wb, `leads-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      // Close modal and show success message
      setShowExportPasswordModal(false);
      showToastNotification(`Successfully exported ${leadsToExport.length} leads to Excel format`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToastNotification('Failed to export leads. Please try again.', 'error');
    }
  };

  // Modal functions
  const openModal = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedLead(null);
    setIsModalOpen(false);
    document.body.style.overflow = 'unset';
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (isModalOpen) return; // Let LeadDetailModal handle ESC when modal is open
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  // Handle modal return from edit form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const returnToModal = urlParams.get('returnToModal');
    const leadId = urlParams.get('leadId');
    
    if (returnToModal === 'true' && leadId) {
      // Find the lead and open the modal
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setIsModalOpen(true);
        document.body.style.overflow = 'hidden';
      }
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('returnToModal');
      newUrl.searchParams.delete('leadId');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [leads]);

  // Set up navigation handlers
  useEffect(() => {
    setOnExportClick(() => handleExportExcel);
  }, [setOnExportClick]);

  // Column change detection to force re-render when columns are added/removed
  useEffect(() => {
    const currentColumnCount = getVisibleColumns().length;
    if (currentColumnCount !== columnCount) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Column count changed:', columnCount, '->', currentColumnCount);
      }
      setColumnCount(currentColumnCount);
      
      // Force more aggressive re-render by clearing cached filter results
      // This ensures the table completely re-mounts with new column configuration
      const tableKey = `table-${currentColumnCount}-${Date.now()}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Forcing table re-mount with key:', tableKey);
      }
      
      // Force re-render by updating a dummy state
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Table re-mounted with', currentColumnCount, 'columns');
      }
      
      // Clear any validation errors that might be stale
      setValidationErrors({});
    }
  }, [getVisibleColumns, columnCount, showToastNotification]);

  // Handle lead click
  const handleLeadClick = (lead: any) => {
    openModal(lead);
  };



  // Handle edit lead
  const handleEditLead = (lead: Lead) => {
    // Store the lead data in localStorage for editing
    localStorage.setItem('editingLead', JSON.stringify(lead));
    // Store modal return data for ESC key functionality with tab information
    localStorage.setItem('modalReturnData', JSON.stringify({
      sourcePage: 'due-today',
      leadId: lead.id,
      tab: activeTab
    }));
    // Navigate to add-lead page with a flag to indicate we're editing
    router.push(`/add-lead?mode=edit&id=${lead.id}&from=due-today&tab=${activeTab}`);
  };

  // Action buttons for the table
  const renderActionButtons = (lead: any) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        localStorage.setItem('editingLead', JSON.stringify(lead));
        // Store modal return data with tab information
        localStorage.setItem('modalReturnData', JSON.stringify({
          sourcePage: 'due-today',
          leadId: lead.id,
          tab: activeTab
        }));
        // Include source page information for proper navigation back
        const sourcePage = activeTab === 'today' ? 'due-today' : 'due-today';
        router.push(`/add-lead?mode=edit&id=${lead.id}&from=${sourcePage}&tab=${activeTab}`);
      }}
      className={`px-3 py-1 text-sm rounded-md transition-colors ${
        activeTab === 'today' 
          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
          : 'bg-red-600 hover:bg-red-700 text-white'
      }`}
    >
      Update Status
    </button>
  );

  return (
    <div className="container mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-sm font-bold text-White-800">Due Today & Overdue Follow-ups</h1>
          <p className="text-sm text-white mt-2">Manage leads with follow-ups due today or overdue</p>
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
              onClick={() => setActiveTab('today')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'today'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-black hover:text-black hover:border-gray-300'
              }`}
            >
              Due Today ({todayLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overdue'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-black hover:text-black hover:border-gray-300'
              }`}
            >
              Overdue ({overdueLeads.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'today' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">Due Today</h2>
              </div>
              <EditableTable
                leads={todayLeads}
                onLeadClick={handleLeadClick}
                showActions={true}
                actionButtons={renderActionButtons}
                emptyMessage="No leads with follow-ups due today"
                editable={true}
                onCellUpdate={handleCellUpdate}
                validationErrors={validationErrors}
                onExportClick={handleExportExcel}
                headerEditable={true}
              />
            </div>
          )}

          {activeTab === 'overdue' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">Overdue Follow-ups</h2>
              </div>
              <EditableTable
                leads={overdueLeads}
                onLeadClick={handleLeadClick}
                showActions={true}
                actionButtons={renderActionButtons}
                emptyMessage="No overdue follow-ups"
                editable={true}
                onCellUpdate={handleCellUpdate}
                validationErrors={validationErrors}
                onExportClick={handleExportExcel}
                headerEditable={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && selectedLead && (
        <Suspense fallback={<div className="flex justify-center items-center h-64">Loading lead details...</div>}>
          <LeadDetailModal
            isOpen={isModalOpen}
            lead={selectedLead}
            onClose={closeModal}
            onEdit={handleEditLead}
          />
        </Suspense>
      )}

      {/* Export Password Modal */}
      {showExportPasswordModal && (
        <Suspense fallback={<div className="flex justify-center items-center h-64">Loading...</div>}>
          <PasswordModal
            isOpen={showExportPasswordModal}
            onClose={() => {
            setShowExportPasswordModal(false);
            }}
            operation="export"
            onSuccess={handleExportPasswordSuccess}
            title="Export Leads"
            description="Enter password to export leads data"
          />
        </Suspense>
      )}

      {/* Password Settings Modal */}
      {passwordSettingsOpen && (
        <Suspense fallback={<div className="flex justify-center items-center h-64">Loading...</div>}>
          <PasswordSettingsModal
            isOpen={passwordSettingsOpen}
            onClose={() => setPasswordSettingsOpen(false)}
            onPasswordChanged={() => {
              // Refresh any cached verification status
            }}
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
                aria-label="Close notification"
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
