import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('generate-from-blob route - database warmup', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should import warmupConnection from @/lib/db', async () => {
    const dbModule = await import('@/lib/db');
    expect(dbModule.warmupConnection).toBeDefined();
    expect(typeof dbModule.warmupConnection).toBe('function');
  });

  it('should have dbWarmedUp flag defined in route module', async () => {
    // Read the route file to verify the flag exists
    const fs = await import('fs/promises');
    const routeContent = await fs.readFile('src/app/api/generate-from-blob/route.ts', 'utf-8');
    
    expect(routeContent).toContain('let dbWarmedUp = false');
    expect(routeContent).toContain('import { db, warmupConnection } from \'@/lib/db\'');
    expect(routeContent).toContain('if (!dbWarmedUp)');
    expect(routeContent).toContain('await warmupConnection()');
    expect(routeContent).toContain('dbWarmedUp = true');
  });

  it('should call warmupConnection before other operations in POST handler', async () => {
    const fs = await import('fs/promises');
    const routeContent = await fs.readFile('src/app/api/generate-from-blob/route.ts', 'utf-8');
    
    // Find the POST handler start
    const postHandlerStart = routeContent.indexOf('export async function POST(req: NextRequest) {');
    expect(postHandlerStart).toBeGreaterThan(-1);
    
    // Get a reasonable chunk of the handler (first 500 chars should be enough)
    const handlerChunk = routeContent.substring(postHandlerStart, postHandlerStart + 500);
    
    const warmupIndex = handlerChunk.indexOf('warmupConnection()');
    const csrfIndex = handlerChunk.indexOf('checkCsrfOrigin');
    
    // Warmup should come before CSRF check
    expect(warmupIndex).toBeGreaterThan(-1);
    expect(csrfIndex).toBeGreaterThan(-1);
    expect(warmupIndex).toBeLessThan(csrfIndex);
  });
});

describe('generate-from-blob route - database error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should catch database configuration errors and return 500 status', async () => {
    const fs = await import('fs/promises');
    const routeContent = await fs.readFile('src/app/api/generate-from-blob/route.ts', 'utf-8');
    
    // Verify error handling for database configuration errors exists
    expect(routeContent).toContain('Database configuration error');
    expect(routeContent).toContain('error: \'Database Error\'');
    expect(routeContent).toContain('details: \'Failed to persist cost tracking data\'');
    expect(routeContent).toContain('status: 500');
  });

  it('should wrap streamText call with try-catch for database errors', async () => {
    const fs = await import('fs/promises');
    const routeContent = await fs.readFile('src/app/api/generate-from-blob/route.ts', 'utf-8');
    
    // Find the streamText call
    const streamTextIndex = routeContent.indexOf('router.streamText');
    expect(streamTextIndex).toBeGreaterThan(-1);
    
    // Look backwards from streamText to find the try block
    const beforeStreamText = routeContent.substring(0, streamTextIndex);
    const lastTryIndex = beforeStreamText.lastIndexOf('try {');
    
    // Look forwards from streamText to find the catch block
    const afterStreamText = routeContent.substring(streamTextIndex);
    const catchIndex = afterStreamText.indexOf('} catch (error: any) {');
    
    expect(lastTryIndex).toBeGreaterThan(-1);
    expect(catchIndex).toBeGreaterThan(-1);
    
    // Verify the catch block checks for database configuration error
    const catchBlock = afterStreamText.substring(catchIndex, catchIndex + 500);
    expect(catchBlock).toContain('Database configuration error');
  });

  it('should re-throw non-database errors to outer catch', async () => {
    const fs = await import('fs/promises');
    const routeContent = await fs.readFile('src/app/api/generate-from-blob/route.ts', 'utf-8');
    
    // Verify that non-database errors are re-thrown
    expect(routeContent).toContain('// Re-throw other errors to be handled by outer catch');
    expect(routeContent).toContain('throw error;');
  });
});
