'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    PermissionKey,
    RolePreset,
    ALL_PERMISSION_KEYS,
    PERMISSION_CATEGORIES,
    PERMISSION_LABELS,
    BASE_ROLE_DEFAULTS,
} from '../utils/permissions';

// ============================================================================
// PRESET BUILDER MODAL
// ============================================================================

interface PresetBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    preset?: RolePreset | null; // null = create mode, set = edit mode
    onSave: () => void;
    createPreset: (data: { name: string; description?: string; permissions: string }) => Promise<{ success: boolean; message: string }>;
    updatePreset: (id: string, data: { name?: string; description?: string; permissions?: string }) => Promise<{ success: boolean; message: string }>;
}

export default function PresetBuilderModal({
    isOpen,
    onClose,
    preset,
    onSave,
    createPreset,
    updatePreset,
}: PresetBuilderModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
        { ...BASE_ROLE_DEFAULTS['SALES_EXECUTIVE'] }
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Initialize from preset when editing
    useEffect(() => {
        if (preset) {
            setName(preset.name);
            setDescription(preset.description || '');
            try {
                const parsed = JSON.parse(preset.permissions) as Record<PermissionKey, boolean>;
                setPermissions({ ...BASE_ROLE_DEFAULTS['SALES_EXECUTIVE'], ...parsed });
            } catch {
                setPermissions({ ...BASE_ROLE_DEFAULTS['SALES_EXECUTIVE'] });
            }
        } else {
            setName('');
            setDescription('');
            setPermissions({ ...BASE_ROLE_DEFAULTS['SALES_EXECUTIVE'] });
        }
        setError('');
    }, [preset, isOpen]);

    const togglePermission = useCallback((key: PermissionKey) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const enableAllInCategory = useCallback((keys: PermissionKey[]) => {
        setPermissions(prev => {
            const next = { ...prev };
            keys.forEach(k => { next[k] = true; });
            return next;
        });
    }, []);

    const disableAllInCategory = useCallback((keys: PermissionKey[]) => {
        setPermissions(prev => {
            const next = { ...prev };
            keys.forEach(k => { next[k] = false; });
            return next;
        });
    }, []);

    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            setError('Preset name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const permissionsJson = JSON.stringify(permissions);
            let result;

            if (preset) {
                result = await updatePreset(preset.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    permissions: permissionsJson,
                });
            } else {
                result = await createPreset({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    permissions: permissionsJson,
                });
            }

            if (result.success) {
                onSave();
                onClose();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('Failed to save preset');
        } finally {
            setSaving(false);
        }
    }, [name, description, permissions, preset, createPreset, updatePreset, onSave, onClose]);

    if (!isOpen) return null;

    const enabledCount = ALL_PERMISSION_KEYS.filter(k => permissions[k]).length;
    const totalCount = ALL_PERMISSION_KEYS.length;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {preset ? 'Edit Preset' : 'Create Permission Preset'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {enabledCount}/{totalCount} permissions enabled
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name & Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Preset Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-black"
                                placeholder="e.g., Senior Sales Agent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-black"
                                placeholder="Brief description of this preset"
                            />
                        </div>
                    </div>

                    {/* Permission Toggle Grid */}
                    <div className="space-y-5">
                        {PERMISSION_CATEGORIES.map(category => (
                            <div key={category.label} className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                                        {category.label}
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => enableAllInCategory(category.keys)}
                                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                        >
                                            Enable All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => disableAllInCategory(category.keys)}
                                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                        >
                                            Disable All
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {category.keys.map(key => (
                                        <label
                                            key={key}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${permissions[key]
                                                    ? 'bg-green-50 border border-green-200'
                                                    : 'bg-white border border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={permissions[key]}
                                                    onChange={() => togglePermission(key)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-8 h-4 rounded-full transition-colors ${permissions[key] ? 'bg-green-500' : 'bg-gray-300'
                                                    }`}>
                                                    <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform ${permissions[key] ? 'translate-x-4' : 'translate-x-0.5'
                                                        } mt-[1px]`} />
                                                </div>
                                            </div>
                                            <span className={`text-sm ${permissions[key] ? 'text-green-800 font-medium' : 'text-gray-600'}`}>
                                                {PERMISSION_LABELS[key]}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                    >
                        {saving ? 'Saving...' : preset ? 'Update Preset' : 'Save Preset'}
                    </button>
                </div>
            </div>
        </div>
    );
}
