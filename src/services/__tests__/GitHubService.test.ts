import { GitHubIssuesClient } from '../GitHubService';

// Simple mock for fetch
const mockFetch = (data: any, ok = true) => {
    return jest.fn().mockImplementation(() =>
        Promise.resolve({
            ok,
            json: () => Promise.resolve(data),
            statusText: ok ? 'OK' : 'Error'
        })
    );
};

describe('GitHubIssuesClient', () => {
    const options = {
        owner: 'Allecpu',
        repo: 'UpdateLens',
        token: 'test-token',
        isWeb: false
    };

    it('should list issues correctly in local mode', async () => {
        const mockIssues = [{ id: 1, title: 'Test Issue' }];
        global.fetch = mockFetch(mockIssues);

        const client = new GitHubIssuesClient(options);
        const issues = await client.listIssues();

        expect(issues).toEqual(mockIssues);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/issues?state=open'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-token'
                })
            })
        );
    });

    it('should use proxy in web mode', async () => {
        const mockIssues = [{ id: 1, title: 'Test Issue' }];
        global.fetch = mockFetch(mockIssues);

        const client = new GitHubIssuesClient({ ...options, isWeb: true });
        const issues = await client.listIssues();

        expect(issues).toEqual(mockIssues);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/github/issues'),
            expect.objectContaining({
                headers: expect.not.objectContaining({
                    'Authorization': 'Bearer test-token'
                })
            })
        );
    });
});
