import { describe, it, expect } from 'vitest';
import { parsePaperclipContext } from '../src/detector';

describe('parsePaperclipContext', () => {
  it('parses valid response with company and agent', () => {
    const data = {
      status: 'ok',
      company: {
        id: 'company-123',
        name: 'TechCorp',
      },
      agent: {
        id: 'agent-456',
        role: 'orchestrator',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toEqual({
      companyId: 'company-123',
      companyName: 'TechCorp',
      agentId: 'agent-456',
      agentRole: 'orchestrator',
    });
  });

  it('returns null for invalid status', () => {
    const data = {
      status: 'error',
      company: {
        id: 'company-123',
        name: 'TechCorp',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toBeNull();
  });

  it('returns null for empty response', () => {
    const result = parsePaperclipContext({});

    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    const result = parsePaperclipContext(null);

    expect(result).toBeNull();
  });

  it('returns null for undefined input', () => {
    const result = parsePaperclipContext(undefined);

    expect(result).toBeNull();
  });

  it('returns null for non-object input', () => {
    const result = parsePaperclipContext('not an object');

    expect(result).toBeNull();
  });

  it('handles missing agent fields gracefully', () => {
    const data = {
      status: 'ok',
      company: {
        id: 'company-123',
        name: 'TechCorp',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toEqual({
      companyId: 'company-123',
      companyName: 'TechCorp',
      agentId: '',
      agentRole: '',
    });
  });

  it('handles missing agent.id gracefully', () => {
    const data = {
      status: 'ok',
      company: {
        id: 'company-123',
        name: 'TechCorp',
      },
      agent: {
        role: 'orchestrator',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toEqual({
      companyId: 'company-123',
      companyName: 'TechCorp',
      agentId: '',
      agentRole: 'orchestrator',
    });
  });

  it('handles missing agent.role gracefully', () => {
    const data = {
      status: 'ok',
      company: {
        id: 'company-123',
        name: 'TechCorp',
      },
      agent: {
        id: 'agent-456',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toEqual({
      companyId: 'company-123',
      companyName: 'TechCorp',
      agentId: 'agent-456',
      agentRole: '',
    });
  });

  it('returns null for missing company', () => {
    const data = {
      status: 'ok',
    };

    const result = parsePaperclipContext(data);

    expect(result).toBeNull();
  });

  it('returns null for missing company.id', () => {
    const data = {
      status: 'ok',
      company: {
        name: 'TechCorp',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toBeNull();
  });

  it('returns null for missing company.name', () => {
    const data = {
      status: 'ok',
      company: {
        id: 'company-123',
      },
    };

    const result = parsePaperclipContext(data);

    expect(result).toBeNull();
  });
});
