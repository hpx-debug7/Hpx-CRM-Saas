import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { logAuditEvent, safeAuditLog, logAuditEvents } from '../src/lib/auditLogger';
import { prisma } from '@/lib/server/db';
import { AUDIT_EVENTS } from '../src/lib/auditEvents';

describe('logAuditEvent & enhancements', () => {
  const company1Id = 'test-company-1-' + Date.now();
  const company2Id = 'test-company-2-' + Date.now();

  beforeAll(async () => {
    // Create test companies
    await prisma.company.createMany({
      data: [
        { id: company1Id, name: company1Id + '-1', slug: company1Id + '-1' },
        { id: company2Id, name: company2Id + '-2', slug: company2Id + '-2' },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    // Cleanup records bound to test companies
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [company1Id, company2Id] } },
    });
    // This will also delete any users associated with company1Id because of cascade deletion if set up
    await prisma.company.deleteMany({
      where: { id: { in: [company1Id, company2Id] } },
    });
  });
  
  beforeEach(async () => {
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [company1Id, company2Id] } }
    });
    // Need to reset the companies' audit hashes since we blew out their logs
    await prisma.company.updateMany({
      where: { id: { in: [company1Id, company2Id] } },
      data: { lastAuditHash: null }
    });
  });

  it('throws an error if required fields are missing', async () => {
    await expect(logAuditEvent({
      companyId: '',
      actionType: 'TEST',
      description: 'test'
    })).rejects.toThrow('companyId is required');

    await expect(logAuditEvent({
      companyId: company1Id,
      actionType: '',
      description: 'test'
    })).rejects.toThrow('actionType is required');

    await expect(logAuditEvent({
      companyId: company1Id,
      actionType: 'TEST',
      description: ''
    })).rejects.toThrow('description is required');
  });

  it('1. Basic event creation', async () => {
    const result = await logAuditEvent({
      companyId: company1Id,
      actionType: AUDIT_EVENTS.LOGIN_SUCCESS,
      description: 'A basic test event',
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.companyId).toBe(company1Id);
    expect(result.actionType).toBe(AUDIT_EVENTS.LOGIN_SUCCESS);
    expect(result.description).toBe('A basic test event');

    // Confirm a record is inserted
    const dbRecord = await prisma.auditLog.findUnique({ where: { id: result.id } });
    expect(dbRecord).toBeDefined();
    expect(dbRecord?.actionType).toBe(AUDIT_EVENTS.LOGIN_SUCCESS);
    
    // Check that the company lastAuditHash is updated properly
    const co = await prisma.company.findUnique({ where: { id: company1Id } });
    expect(co?.lastAuditHash).toBe(result.hash);
  });

  it('2. Optional fields, relation safety, record returned', async () => {
    const performedById = 'user-test-' + Date.now();
    
    // Create test user required for foreign key connect to succeed
    await prisma.user.create({
      data: {
        id: performedById,
        companyId: company1Id,
        name: 'Test User',
        email: 'test' + Date.now() + '@example.com',
        username: 'testuser' + Date.now(),
        password: 'password_hash',
      }
    });

    const result = await logAuditEvent({
      companyId: company1Id,
      actionType: 'OPTIONAL_EVENT',
      description: 'Event with optional fields',
      entityType: 'LEAD',
      entityId: 'lead-123',
      performedById,
      performedByName: 'Test User',
    });

    expect(result.entityType).toBe('LEAD');
    expect(result.entityId).toBe('lead-123');
    expect(result.performedById).toBe(performedById);
    expect(result.performedByName).toBe('Test User');
    
    // Add relation safety test: Verify that when performedById is passed, the relation exists in the database.
    const dbRecord = await prisma.auditLog.findUnique({
      where: { id: result.id },
      include: { performedBy: true }
    });
    expect(dbRecord?.performedBy?.id).toBe(performedById);
    expect(dbRecord?.id).toBe(result.id);
    
    await prisma.user.delete({ where: { id: performedById } });
  });

  it('3. Improve serialization tests', async () => {
    const stringVal = 'simple string';
    const nullVal = null;
    const objVal = { status: 'OLD' };

    const result1 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'BEFORE_VAL_STRING',
      description: 'String',
      beforeValue: stringVal,
    });
    expect(result1.beforeValue).toBe(stringVal);
    const dbRecord1 = await prisma.auditLog.findUnique({ where: { id: result1.id } });
    expect(dbRecord1?.id).toBe(result1.id);

    const result2 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'BEFORE_VAL_NULL',
      description: 'Null',
      beforeValue: nullVal,
    });
    expect(result2.beforeValue).toBe('null');
    const dbRecord2 = await prisma.auditLog.findUnique({ where: { id: result2.id } });
    expect(dbRecord2?.id).toBe(result2.id);

    const result3 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'BEFORE_VAL_OBJ',
      description: 'Object',
      beforeValue: objVal,
    });
    expect(result3.beforeValue).toBe(JSON.stringify(objVal));
    const dbRecord3 = await prisma.auditLog.findUnique({ where: { id: result3.id } });
    expect(dbRecord3?.id).toBe(result3.id);
  });

  it('4. Metadata verification', async () => {
    const metadata = { environment: 'test', version: 1 };

    const result = await logAuditEvent({
      companyId: company1Id,
      actionType: 'METADATA_EVENT',
      description: 'Test metadata',
      metadata,
    });

    // Verify metadata is stored and parseable to original JSON object
    const storedMetadata = result.metadata ? JSON.parse(result.metadata) : null;
    expect(storedMetadata).toEqual(metadata);
    
    const dbRecord = await prisma.auditLog.findUnique({ where: { id: result.id } });
    expect(dbRecord?.id).toBe(result.id);
  });

  it('5. Tenant isolation', async () => {
    const result1 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'TENANT_EVENT_1',
      description: 'Tenant 1 event',
    });

    const result2 = await logAuditEvent({
      companyId: company2Id,
      actionType: 'TENANT_EVENT_2',
      description: 'Tenant 2 event',
    });

    const tenant1Logs = await prisma.auditLog.findMany({ where: { companyId: company1Id } });
    const tenant2Logs = await prisma.auditLog.findMany({ where: { companyId: company2Id } });

    expect(tenant1Logs.length).toBe(1);
    expect(tenant1Logs[0].actionType).toBe('TENANT_EVENT_1');
    expect(tenant2Logs.length).toBe(1);
    expect(tenant2Logs[0].actionType).toBe('TENANT_EVENT_2');
    
    const dbRecord = await prisma.auditLog.findUnique({ where: { id: result1.id } });
    expect(dbRecord?.id).toBe(result1.id);
  });

  it('6. Database integrity', async () => {
    const result = await logAuditEvent({
      companyId: company1Id,
      actionType: 'INTEGRITY_EVENT',
      description: 'Check returned record',
    });

    expect(result).toHaveProperty('id');
    const dbRecord = await prisma.auditLog.findUnique({ where: { id: result.id } });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.id).toBe(result.id);
  });

  it('7. Hash chain generation', async () => {
    // create two events
    const e1 = await logAuditEvent({
       companyId: company1Id,
       actionType: AUDIT_EVENTS.LOGIN_SUCCESS,
       description: 'first'
    });
    const e2 = await logAuditEvent({
       companyId: company1Id,
       actionType: AUDIT_EVENTS.LOGIN_SUCCESS,
       description: 'second'
    });

    expect(e1.previousHash).toBeNull();
    expect(e1.hash).not.toBeNull();
    expect(e2.previousHash).toBe(e1.hash);
    expect(e2.hash).not.toBeNull();
  });

  it('8. Context injection', async () => {
    const e = await logAuditEvent({
       companyId: company1Id,
       actionType: AUDIT_EVENTS.LOGIN_SUCCESS,
       description: 'context test',
       context: {
         ipAddress: '192.168.1.1',
         userAgent: 'Mozilla',
         sessionId: 'sess_123',
         requestId: 'req_xyz'
       }
    });

    expect(e.ipAddress).toBe('192.168.1.1');
    expect(e.userAgent).toBe('Mozilla');
    expect(e.sessionId).toBe('sess_123');
    
    expect(e.metadata).toBeDefined();
    const meta = JSON.parse(e.metadata!);
    expect(meta.requestId).toBe('req_xyz');
  });

  it('9. Batch logging function', async () => {
    await logAuditEvents([
      { companyId: company2Id, actionType: 'BATCH_1', description: 'b1' },
      { companyId: company2Id, actionType: 'BATCH_2', description: 'b2' }
    ]);

    const logs = await prisma.auditLog.findMany({
      where: { companyId: company2Id, actionType: { in: ['BATCH_1', 'BATCH_2'] } },
      orderBy: { createdAt: 'asc' }
    });

    expect(logs.length).toBe(2);
    expect(logs[0].hash).toBeDefined();
    expect(logs[1].previousHash).toBe(logs[0].hash);
    
    // Verify Company's lastAuditHash got updated correctly
    const co = await prisma.company.findUnique({ where: { id: company2Id } });
    expect(co?.lastAuditHash).toBe(logs[1].hash);
  });

  it('10. safeAuditLog not throwing on failure', async () => {
    // Provide invalid data, missing required fields so logAuditEvent rejects
    expect(() => {
      // safeAuditLog doesn't throw synchronously
      safeAuditLog({
        companyId: '',
        actionType: '',
        description: ''
      } as any);
    }).not.toThrow();

    // Small delay to ensure unhandled rejection doesn't bubble up in test unexpectedly
    await new Promise(r => setTimeout(r, 50));
  });

  it('11. Metadata limit enforcement', async () => {
    const largeString = 'a'.repeat(9990);
    const metadata = { largeKey: largeString };
    
    // Check if it's over 10K. The JSON overhead makes it slightly over 10K
    await expect(logAuditEvent({
      companyId: company1Id,
      actionType: 'METADATA_LIMIT_TEST',
      description: 'Testing large metadata',
      metadata,
    })).rejects.toThrow('Audit metadata too large');
  });

  it('12. Hash changes when audit payload changes', async () => {
    const parentEvent = await logAuditEvent({
      companyId: company1Id,
      actionType: 'PAYLOAD_TEST_ROOT',
      description: 'init base event'
    });

    // Add branch 1
    const eventA1 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'EVENT_A',
      description: 'same description',
      metadata: { num: 1 }
    });
    
    // Reset back to parent manually
    await prisma.auditLog.delete({ where: { id: eventA1.id } });
    await prisma.company.update({
      where: { id: company1Id },
      data: { lastAuditHash: parentEvent.hash }
    });

    // Add branch 2 - mostly identical properties
    const eventA2 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'EVENT_A',
      description: 'same description',
      metadata: { num: 2 } // this differs!
    });

    // Event hashes should definitely be different.
    expect(eventA1.previousHash).toEqual(eventA2.previousHash);
    expect(eventA1.hash).not.toEqual(eventA2.hash);
  });

  it('13. Hash payload stability', async () => {
    // Generate root event to act as previous state
    const parentEvent = await logAuditEvent({
      companyId: company1Id,
      actionType: 'BASELINE',
      description: 'baseline'
    });

    const event1 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'STABLE_PAYLOAD',
      description: 'static properties',
      entityId: '123'
    });
    
    // Check Hash matches 
    await prisma.auditLog.delete({ where: { id: event1.id } });
    await prisma.company.update({
      where: { id: company1Id },
      data: { lastAuditHash: parentEvent.hash }
    });

    const event2 = await logAuditEvent({
      companyId: company1Id,
      actionType: 'STABLE_PAYLOAD',
      description: 'static properties',
      entityId: '123'
    });

    expect(event1.hash).toEqual(event2.hash);
  });
});
