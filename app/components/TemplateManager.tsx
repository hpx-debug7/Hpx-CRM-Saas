'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Template {
  id: string;
  name: string;
  content: {
    overview: string;
  };
}

export interface TemplateManagerHook {
  templates: Template[];
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  createTemplate: (name: string) => string;
  deleteTemplate: (id: string) => Promise<boolean>;
  renameTemplate: (id: string, newName: string) => boolean;
  updateTemplateContent: (id: string, content: Template['content']) => void;
  getTemplateById: (id: string) => Template | null;
}

const TEMPLATES_STORAGE_KEY = 'quickBenefitTemplates';
const ACTIVE_TEMPLATE_KEY = 'activeTemplateId';

export const useTemplates = (): TemplateManagerHook => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Initialize templates on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // First, migrate old templates before creating defaults
      const migrationFlag = localStorage.getItem('templates_migrated');
      if (migrationFlag !== 'true') {
        const oldTemplates: Template[] = [];
        const oldCategories = ['general', 'category1', 'category2', 'category3'];

        oldCategories.forEach((category, index) => {
          try {
            const saved = localStorage.getItem(`quickBenefitTemplate_${category}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              const template: Template = {
                id: `migrated_${category}`,
                name: category === 'general' ? 'General Template' : `Category ${index}`,
                content: parsed
              };
              oldTemplates.push(template);
            }
          } catch (error) {
            console.warn(`Error migrating template for ${category}:`, error);
          }
        });

        if (oldTemplates.length > 0) {
          // Load existing templates first
          const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
          let existingTemplates: Template[] = [];
          
          if (savedTemplates) {
            existingTemplates = JSON.parse(savedTemplates);
          }

          let hasChanges = false;
          const updated = [...existingTemplates];
          
          // Map migrated IDs to canonical default IDs
          const idMapping: Record<string, string> = {
            'migrated_general': 'general',
            'migrated_category1': 'category1', 
            'migrated_category2': 'category2',
            'migrated_category3': 'category3'
          };

          oldTemplates.forEach(oldTemplate => {
            const canonicalId = idMapping[oldTemplate.id];
            if (canonicalId) {
              const existingIndex = updated.findIndex(t => t.id === canonicalId);
              if (existingIndex !== -1) {
                // Merge content into existing default template
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  content: oldTemplate.content
                };
                hasChanges = true;
              } else {
                // Add as new template if canonical doesn't exist
                updated.push({
                  ...oldTemplate,
                  id: canonicalId
                });
                hasChanges = true;
              }
            }
          });
          
          if (hasChanges) {
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
            // Mark migration as completed only if changes were applied
            localStorage.setItem('templates_migrated', 'true');
          }
        }
      }

      // Load templates after migration
      const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      let parsedTemplates: Template[] = [];
      
      if (savedTemplates) {
        parsedTemplates = JSON.parse(savedTemplates);
        // Remove duplicates by name, keeping the first occurrence
        const cleanTemplates = parsedTemplates.filter((template, index, arr) => 
          arr.findIndex(t => t.name === template.name) === index
        );
        parsedTemplates = cleanTemplates;
        // Save cleaned templates back to localStorage
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(cleanTemplates));
      }

      // Load active template ID
      const savedActiveId = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
      const activeId = savedActiveId;

      // If no templates exist after migration, create default ones
      if (parsedTemplates.length === 0) {
        parsedTemplates = createDefaultTemplates();
        setTemplates(parsedTemplates);
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(parsedTemplates));
      } else {
        setTemplates(parsedTemplates);
      }

      // Set active template
      if (activeId && parsedTemplates.find(t => t.id === activeId)) {
        setActiveTemplateId(activeId);
      } else {
        // Default to first template if no valid active ID
        const firstTemplateId = parsedTemplates[0]?.id;
        if (firstTemplateId) {
          setActiveTemplateId(firstTemplateId);
          localStorage.setItem(ACTIVE_TEMPLATE_KEY, firstTemplateId);
        }
      }
    } catch (error) {
      console.error('Error initializing templates:', error);
      // Fallback to default templates
      const defaultTemplates = createDefaultTemplates();
      setTemplates(defaultTemplates);
      setActiveTemplateId(defaultTemplates[0]?.id || null);
    }
  }, []);

  // Persist active template ID changes
  useEffect(() => {
    if (activeTemplateId) {
      localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateId);
    }
  }, [activeTemplateId]);

  const createTemplate = useCallback((name: string): string => {
    const trimmedName = name.trim();
    if (!trimmedName) return '';

    // Check if name already exists
    const existingTemplate = templates.find(t => t.name === trimmedName);
    if (existingTemplate) {
      alert('A template with this name already exists.');
      return existingTemplate.id; // Return existing ID instead of creating duplicate
    }

    const newTemplate: Template = {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      content: {
        overview: ''
      }
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    
    // Save to localStorage
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    } catch (error) {
      console.error('Error saving templates:', error);
    }

    return newTemplate.id;
  }, [templates]);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmMessage = `Are you sure you want to delete this template? This action cannot be undone.`;
      const confirmed = window.confirm(confirmMessage);
      
      if (!confirmed) {
        resolve(false);
        return;
      }

      const updatedTemplates = templates.filter(t => t.id !== id);
      
      // If deleting the active template, switch to the first available template
      let newActiveId = activeTemplateId;
      if (activeTemplateId === id) {
        newActiveId = updatedTemplates[0]?.id || null;
      }

      setTemplates(updatedTemplates);
      setActiveTemplateId(newActiveId);

      // Save to localStorage
      try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
        if (newActiveId) {
          localStorage.setItem(ACTIVE_TEMPLATE_KEY, newActiveId);
        } else {
          localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
        }
        resolve(true);
      } catch (error) {
        console.error('Error deleting template:', error);
        resolve(false);
      }
    });
  }, [templates, activeTemplateId]);

  const renameTemplate = useCallback((id: string, newName: string): boolean => {
    const trimmedName = newName.trim();
    if (!trimmedName) return false;

    // Check if name already exists
    if (templates.some(t => t.id !== id && t.name === trimmedName)) {
      alert('A template with this name already exists.');
      return false;
    }

    const updatedTemplates = templates.map(t => 
      t.id === id ? { ...t, name: trimmedName } : t
    );
    
    setTemplates(updatedTemplates);

    // Save to localStorage
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
      return true;
    } catch (error) {
      console.error('Error renaming template:', error);
      return false;
    }
  }, [templates]);

  const updateTemplateContent = useCallback((id: string, content: Template['content']) => {
    const updatedTemplates = templates.map(t => 
      t.id === id ? { ...t, content } : t
    );
    
    setTemplates(updatedTemplates);

    // Save to localStorage
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    } catch (error) {
      console.error('Error updating template content:', error);
    }
  }, [templates]);

  const getTemplateById = useCallback((id: string): Template | null => {
    return templates.find(t => t.id === id) || null;
  }, [templates]);

  return {
    templates,
    activeTemplateId,
    setActiveTemplateId,
    createTemplate,
    deleteTemplate,
    renameTemplate,
    updateTemplateContent,
    getTemplateById
  };
};

// Helper function to create default templates
const createDefaultTemplates = (): Template[] => {
  return [
    {
      id: 'general',
      name: 'General Template',
      content: {
        overview: ''
      }
    },
    {
      id: 'category1',
      name: 'Category 1',
      content: {
        overview: ''
      }
    },
    {
      id: 'category2',
      name: 'Category 2',
      content: {
        overview: ''
      }
    },
    {
      id: 'category3',
      name: 'Category 3',
      content: {
        overview: ''
      }
    }
  ];
};

// Helper function to map resolved category to template ID
export const mapCategoryToTemplateId = (category: 'I' | 'II' | 'III'): string => {
  const mapping: Record<'I' | 'II' | 'III', string> = {
    'I': 'category1',
    'II': 'category2',
    'III': 'category3'
  };
  return mapping[category];
};
