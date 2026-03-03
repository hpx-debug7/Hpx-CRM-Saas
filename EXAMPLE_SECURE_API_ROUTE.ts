/**
 * EXAMPLE: Protected Multi-Tenant API Route
 *
 * This example demonstrates the correct way to implement protected endpoints
 * that enforce strict tenant isolation.
 *
 * Location: app/api/example/leads/route.ts
 *
 * Key Security Principles:
 * 1. Always use secureHandler to wrap the endpoint
 * 2. Never trust companyId from request body - use session.companyId
 * 3. Always scope Prisma queries with tenantScope(companyId)
 * 4. Use composite keys where applicable (e.g., (id, companyId))
 */

'use server';

import { NextRequest, NextResponse } from 'next/server';
import { secureHandler } from '@/lib/secureHandler';
import { tenantScope } from '@/lib/tenantScope';

// ============================================================================
// GET /api/leads - List all leads for the current company
// ============================================================================

export const GET = secureHandler(
    async (req, { userId, companyId, role }) => {
        // Safely parse query parameters (never trust user input directly)
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const assignedToId = searchParams.get('assignedToId');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = 20;

        // Build where clause with user-provided filters
        // ONLY include filters that are safe - don't expose internal queries
        const where: any = {
            // companyId is automatically added by tenantScope
        };

        if (status) {
            where.status = status;
        }
        if (assignedToId) {
            // SECURITY: assignedToId must be scoped to user's company
            // Verify the assignedTo user belongs to this company
            const assignedToUser = await tenantScope(companyId).user.findUnique({
                where: { id: assignedToId },
            });
            if (!assignedToUser) {
                return NextResponse.json(
                    { error: 'Invalid assignedToId' },
                    { status: 400 },
                );
            }
            where.assignedToId = assignedToId;
        }

        // Use tenantScope to enforce companyId on all queries
        const [leads, total] = await Promise.all([
            tenantScope(companyId).lead.findMany({
                where,
                take: pageSize,
                skip: (page - 1) * pageSize,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    status: true,
                    assignedToId: true,
                    createdAt: true,
                },
            }),
            tenantScope(companyId).lead.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: leads,
            pagination: {
                page,
                pageSize,
                total,
                pages: Math.ceil(total / pageSize),
            },
        });
    },
    {
        methods: ['GET'],
    },
);

// ============================================================================
// POST /api/leads - Create a new lead for the current company
// ============================================================================

export const POST = secureHandler(
    async (req, { userId, companyId, role }) => {
        try {
            const body = await req.json();

            // Validate required fields
            if (!body.firstName || !body.lastName || !body.email) {
                return NextResponse.json(
                    { error: 'Missing required fields: firstName, lastName, email' },
                    { status: 400 },
                );
            }

            // CRITICAL: Never trust companyId from request body
            // Always use the user's companyId from the validated session
            const newLead = await tenantScope(companyId).lead.create({
                data: {
                    firstName: body.firstName.trim(),
                    lastName: body.lastName.trim(),
                    email: body.email.toLowerCase().trim(),
                    phone: body.phone?.trim() || null,
                    source: body.source || 'MANUAL',
                    status: body.status || 'NEW_LEAD',
                    // companyId is automatically included by tenantScope
                    createdById: userId,
                    assignedToId: body.assignedToId || null,
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    companyId: true,
                    createdAt: true,
                },
            });

            // Log the action for audit trail
            // Note: In real code, also use tenantScope for auditLog
            await tenantScope(companyId).auditLog.create({
                data: {
                    actionType: 'LEAD_CREATED',
                    entityType: 'lead',
                    entityId: newLead.id,
                    performedById: userId,
                    description: `Lead "${newLead.firstName} ${newLead.lastName}" created`,
                    // companyId is automatically included by tenantScope
                },
            });

            return NextResponse.json(
                {
                    success: true,
                    message: 'Lead created successfully',
                    data: newLead,
                },
                { status: 201 },
            );
        } catch (error) {
            console.error('[SECURITY] Lead creation error:', error);
            return NextResponse.json(
                { error: 'Failed to create lead' },
                { status: 500 },
            );
        }
    },
    {
        methods: ['POST'],
        requiredRoles: ['ADMIN', 'SALES_MANAGER'], // Restrict to specific roles
    },
);

// ============================================================================
// PUT /api/leads/{id} - Update a lead (scoped to company)
// ============================================================================

export const PUT = secureHandler(
    async (req, { userId, companyId, role }) => {
        try {
            const { searchParams } = new URL(req.url);
            const leadId = searchParams.get('id');

            if (!leadId) {
                return NextResponse.json(
                    { error: 'Missing lead ID' },
                    { status: 400 },
                );
            }

            // CRITICAL: Verify the lead belongs to the user's company
            const existingLead = await tenantScope(companyId).lead.findUnique({
                where: { id: leadId },
            });

            if (!existingLead) {
                return NextResponse.json(
                    { error: 'Lead not found' },
                    { status: 404 },
                );
            }

            const body = await req.json();

            // Update the lead (companyId is enforced by tenantScope)
            const updatedLead = await tenantScope(companyId).lead.update({
                where: { id: leadId },
                data: {
                    firstName: body.firstName?.trim() || existingLead.firstName,
                    lastName: body.lastName?.trim() || existingLead.lastName,
                    email: body.email?.toLowerCase().trim() || existingLead.email,
                    phone: body.phone?.trim() || existingLead.phone,
                    status: body.status || existingLead.status,
                    // Note: Never allow direct companyId change
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true,
                    updatedAt: true,
                },
            });

            return NextResponse.json({
                success: true,
                message: 'Lead updated successfully',
                data: updatedLead,
            });
        } catch (error) {
            console.error('[SECURITY] Lead update error:', error);
            return NextResponse.json(
                { error: 'Failed to update lead' },
                { status: 500 },
            );
        }
    },
    {
        methods: ['PUT'],
    },
);

// ============================================================================
// DELETE /api/leads/{id} - Delete a lead (scoped to company)
// ============================================================================

export const DELETE = secureHandler(
    async (req, { userId, companyId, role }) => {
        try {
            const { searchParams } = new URL(req.url);
            const leadId = searchParams.get('id');

            if (!leadId) {
                return NextResponse.json(
                    { error: 'Missing lead ID' },
                    { status: 400 },
                );
            }

            // Verify lead exists and belongs to company
            const lead = await tenantScope(companyId).lead.findUnique({
                where: { id: leadId },
            });

            if (!lead) {
                return NextResponse.json(
                    { error: 'Lead not found' },
                    { status: 404 },
                );
            }

            // Delete the lead
            await tenantScope(companyId).lead.delete({
                where: { id: leadId },
            });

            return NextResponse.json({
                success: true,
                message: 'Lead deleted successfully',
            });
        } catch (error) {
            console.error('[SECURITY] Lead deletion error:', error);
            return NextResponse.json(
                { error: 'Failed to delete lead' },
                { status: 500 },
            );
        }
    },
    {
        methods: ['DELETE'],
        requiredRoles: ['ADMIN'], // Only admins can delete
    },
);
