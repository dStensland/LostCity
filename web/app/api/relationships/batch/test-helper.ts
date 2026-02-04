/**
 * Test Helper for Batch Relationships API
 *
 * This file provides utility functions for testing the batch relationships endpoint.
 * Use these in your development environment to verify the API works correctly.
 *
 * Usage:
 * 1. Import this file in your test component or script
 * 2. Call testBatchRelationshipsAPI() with test user IDs
 * 3. Check console for results
 */

import type { RelationshipStatus } from './route';

export type BatchRelationshipsResponse = {
  relationships: Record<string, RelationshipStatus>;
};

/**
 * Test the batch relationships API endpoint
 *
 * @param userIds - Array of user IDs to test with
 * @param options - Optional configuration
 * @returns Test results and timing information
 */
export async function testBatchRelationshipsAPI(
  userIds: string[],
  options?: {
    verbose?: boolean;
    compareWithIndividual?: boolean;
  }
) {
  const verbose = options?.verbose ?? true;
  const results = {
    success: false,
    batchTime: 0,
    individualTime: 0,
    speedup: 0,
    relationships: {} as Record<string, RelationshipStatus>,
    errors: [] as string[],
  };

  if (verbose) {
    console.log('🧪 Testing Batch Relationships API');
    console.log(`📊 User IDs: ${userIds.length}`);
    console.log('---');
  }

  try {
    // Test 1: Batch request
    const batchStart = performance.now();

    const batchResponse = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userIds }),
    });

    const batchEnd = performance.now();
    results.batchTime = batchEnd - batchStart;

    if (!batchResponse.ok) {
      throw new Error(`Batch request failed: ${batchResponse.status}`);
    }

    const batchData: BatchRelationshipsResponse = await batchResponse.json();
    results.relationships = batchData.relationships;

    if (verbose) {
      console.log('✅ Batch Request Success');
      console.log(`⏱️  Time: ${results.batchTime.toFixed(2)}ms`);
      console.log(`📦 Relationships returned: ${Object.keys(results.relationships).length}`);
      console.log('---');
    }

    // Test 2: Compare with individual requests (optional)
    if (options?.compareWithIndividual && userIds.length > 0 && userIds.length <= 10) {
      const individualStart = performance.now();

      // Note: This assumes /api/users/[id] exists
      const individualPromises = userIds.slice(0, 5).map(async (id) => {
        try {
          const res = await fetch(`/api/users/${id}`);
          if (res.ok) {
            const data = await res.json();
            return { id, relationship: data.relationship || 'none' };
          }
        } catch {
          // Ignore individual errors
        }
        return { id, relationship: 'none' };
      });

      await Promise.all(individualPromises);

      const individualEnd = performance.now();
      results.individualTime = individualEnd - individualStart;
      results.speedup = results.individualTime / results.batchTime;

      if (verbose) {
        console.log('📊 Comparison (first 5 users):');
        console.log(`  Individual requests: ${results.individualTime.toFixed(2)}ms`);
        console.log(`  Batch request: ${results.batchTime.toFixed(2)}ms`);
        console.log(`  Speedup: ${results.speedup.toFixed(2)}x faster`);
        console.log('---');
      }
    }

    // Test 3: Validate response structure
    const validStatuses: RelationshipStatus[] = [
      'none',
      'friends',
      'following',
      'followed_by',
      'request_sent',
      'request_received',
    ];

    for (const [userId, status] of Object.entries(results.relationships)) {
      if (!validStatuses.includes(status)) {
        results.errors.push(`Invalid status for ${userId}: ${status}`);
      }
    }

    // Test 4: Check all requested IDs are present
    for (const userId of userIds) {
      if (!(userId in results.relationships)) {
        results.errors.push(`Missing relationship for user: ${userId}`);
      }
    }

    if (results.errors.length === 0) {
      results.success = true;

      if (verbose) {
        console.log('✅ All validations passed');
        console.log('📊 Relationship breakdown:');

        const breakdown = userIds.reduce((acc, id) => {
          const status = results.relationships[id];
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        for (const [status, count] of Object.entries(breakdown)) {
          console.log(`  ${status}: ${count}`);
        }
      }
    } else {
      if (verbose) {
        console.error('❌ Validation errors:');
        results.errors.forEach(err => console.error(`  - ${err}`));
      }
    }

  } catch (error) {
    results.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.errors.push(errorMessage);

    if (verbose) {
      console.error('❌ Test failed:', errorMessage);
    }
  }

  if (verbose) {
    console.log('---');
    console.log(`🎯 Result: ${results.success ? 'PASS' : 'FAIL'}`);
  }

  return results;
}

/**
 * Validate batch request payload
 */
export function validateBatchRequest(userIds: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if userIds is an array
  if (!Array.isArray(userIds)) {
    errors.push('userIds must be an array');
    return { valid: false, errors };
  }

  // Check max size
  if (userIds.length > 100) {
    errors.push('Maximum 100 user IDs allowed');
  }

  // Check each ID
  userIds.forEach((id, index) => {
    if (typeof id !== 'string') {
      errors.push(`userIds[${index}] must be a string`);
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      errors.push(`userIds[${index}] is not a valid UUID: ${id}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate mock user IDs for testing
 */
export function generateMockUserIds(count: number): string[] {
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate a valid UUID v4
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    ids.push(uuid);
  }

  return ids;
}

/**
 * Example test scenarios
 */
export const testScenarios = {
  // Test empty array
  empty: async () => {
    console.log('🧪 Test: Empty array');
    const response = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [] }),
    });
    const data = await response.json();
    console.log('Response:', data);
    console.log('Expected: { relationships: {} }');
  },

  // Test invalid UUIDs
  invalidUUIDs: async () => {
    console.log('🧪 Test: Invalid UUIDs');
    const response = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: ['not-a-uuid', '123', '', 'invalid'],
      }),
    });
    const data = await response.json();
    console.log('Response:', data);
    console.log('Expected: { relationships: {} } (all invalid IDs filtered)');
  },

  // Test max batch size
  maxBatchSize: async () => {
    console.log('🧪 Test: Max batch size (101 IDs)');
    const userIds = generateMockUserIds(101);
    const response = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    });
    const data = await response.json();
    console.log('Response:', data);
    console.log('Expected: 400 error - Maximum 100 user IDs allowed');
  },

  // Test duplicate removal
  duplicates: async () => {
    console.log('🧪 Test: Duplicate removal');
    const mockId = generateMockUserIds(1)[0];
    const response = await fetch('/api/relationships/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: [mockId, mockId, mockId], // Same ID 3 times
      }),
    });
    const data = await response.json();
    console.log('Response:', data);
    console.log(`Expected: Only 1 entry for ${mockId}`);
  },

  // Run all test scenarios
  runAll: async () => {
    console.log('🧪 Running all test scenarios\n');

    await testScenarios.empty();
    console.log('\n---\n');

    await testScenarios.invalidUUIDs();
    console.log('\n---\n');

    await testScenarios.maxBatchSize();
    console.log('\n---\n');

    await testScenarios.duplicates();
    console.log('\n---\n');

    console.log('✅ All scenarios complete');
  },
};

/**
 * Quick test function for use in browser console
 */
export function quickTest() {
  // Generate 10 mock user IDs
  const mockIds = generateMockUserIds(10);

  console.log('🚀 Quick Test - Batch Relationships API');
  console.log('Generated mock user IDs:', mockIds);
  console.log('Note: These are fake IDs, so all relationships will be "none"');
  console.log('---\n');

  return testBatchRelationshipsAPI(mockIds, {
    verbose: true,
    compareWithIndividual: false,
  });
}

/**
 * Browser console helpers
 *
 * Usage in browser console:
 * ```
 * // Run quick test
 * quickTest()
 *
 * // Run all test scenarios
 * testScenarios.runAll()
 *
 * // Test with specific IDs
 * testBatchRelationshipsAPI(['uuid-1', 'uuid-2'])
 * ```
 */
if (typeof window !== 'undefined') {
   
  const win = window as unknown as Record<string, unknown>;
  win.testBatchRelationships = testBatchRelationshipsAPI;
  win.quickTest = quickTest;
  win.testScenarios = testScenarios;
  win.generateMockUserIds = generateMockUserIds;
}
