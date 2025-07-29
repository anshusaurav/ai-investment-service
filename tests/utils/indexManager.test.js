const fs = require('fs');
const path = require('path');
const { IndexManager, IndexNotFoundError, IndexCorruptedError, StorageError } = require('../../src/utils/indexManager');

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('IndexManager', () => {
    let indexManager;
    let testBaseDir;

    beforeEach(() => {
        // Create a temporary directory for tests
        testBaseDir = path.join(__dirname, 'test_indexes');
        indexManager = new IndexManager(testBaseDir);
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testBaseDir)) {
            fs.rmSync(testBaseDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create base directory if it does not exist', () => {
            expect(fs.existsSync(testBaseDir)).toBe(true);
        });

        it('should use default directory if none provided', () => {
            const defaultManager = new IndexManager();
            expect(defaultManager.baseDir).toBe('./indexes');
        });
    });

    describe('getCompanyDir', () => {
        it('should return correct company directory path', () => {
            const companyDir = indexManager.getCompanyDir('AAPL');
            expect(companyDir).toBe(path.join(testBaseDir, 'AAPL'));
        });

        it('should sanitize company code', () => {
            const companyDir = indexManager.getCompanyDir('TEST/COMPANY');
            expect(companyDir).toBe(path.join(testBaseDir, 'TEST_COMPANY'));
        });

        it('should throw error for invalid company code', () => {
            expect(() => indexManager.getCompanyDir('')).toThrow();
            expect(() => indexManager.getCompanyDir(null)).toThrow();
            expect(() => indexManager.getCompanyDir(123)).toThrow();
        });
    });

    describe('hasCompanyIndex', () => {
        it('should return false for non-existent index', async () => {
            const exists = await indexManager.hasCompanyIndex('NONEXISTENT');
            expect(exists).toBe(false);
        });

        it('should return true for existing complete index', async () => {
            // Create mock index files
            const companyCode = 'TEST';
            const paths = indexManager.getCompanyFilePaths(companyCode);
            
            fs.mkdirSync(paths.dir, { recursive: true });
            fs.writeFileSync(paths.metadata, '{}');
            fs.writeFileSync(paths.documents, '{}');
            fs.writeFileSync(paths.vectors, '{}');

            const exists = await indexManager.hasCompanyIndex(companyCode);
            expect(exists).toBe(true);
        });

        it('should return false for incomplete index', async () => {
            // Create only some files
            const companyCode = 'INCOMPLETE';
            const paths = indexManager.getCompanyFilePaths(companyCode);
            
            fs.mkdirSync(paths.dir, { recursive: true });
            fs.writeFileSync(paths.metadata, '{}');
            // Missing documents.json and vectors.json

            const exists = await indexManager.hasCompanyIndex(companyCode);
            expect(exists).toBe(false);
        });
    });

    describe('saveCompanyIndex', () => {
        it('should save company index successfully', async () => {
            const companyCode = 'AAPL';
            const documents = [
                { id: '1', name: 'doc1.pdf', url: 'http://example.com/doc1.pdf', content: 'content1' },
                { id: '2', name: 'doc2.pdf', url: 'http://example.com/doc2.pdf', content: 'content2' }
            ];
            
            // Mock vector store
            const mockVectorStore = {
                memoryVectors: [
                    { content: 'chunk1', embedding: [0.1, 0.2, 0.3], metadata: { source: 'doc1' } },
                    { content: 'chunk2', embedding: [0.4, 0.5, 0.6], metadata: { source: 'doc2' } }
                ]
            };

            const result = await indexManager.saveCompanyIndex(companyCode, documents, mockVectorStore);

            expect(result.success).toBe(true);
            expect(result.companyCode).toBe(companyCode);
            expect(result.documentCount).toBe(2);

            // Verify files were created
            const paths = indexManager.getCompanyFilePaths(companyCode);
            expect(fs.existsSync(paths.metadata)).toBe(true);
            expect(fs.existsSync(paths.documents)).toBe(true);
            expect(fs.existsSync(paths.vectors)).toBe(true);
            expect(fs.existsSync(paths.config)).toBe(true);
        });

        it('should handle metadata correctly', async () => {
            const companyCode = 'TEST';
            const documents = [{ id: '1', name: 'test.pdf' }];
            const mockVectorStore = { memoryVectors: [] };
            const customMetadata = { customField: 'customValue' };

            await indexManager.saveCompanyIndex(companyCode, documents, mockVectorStore, customMetadata);

            const paths = indexManager.getCompanyFilePaths(companyCode);
            const savedMetadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));
            
            expect(savedMetadata.companyCode).toBe(companyCode);
            expect(savedMetadata.documentCount).toBe(1);
            expect(savedMetadata.customField).toBe('customValue');
            expect(savedMetadata.createdAt).toBeDefined();
            expect(savedMetadata.updatedAt).toBeDefined();
        });
    });

    describe('loadCompanyIndex', () => {
        it('should throw IndexNotFoundError for non-existent index', async () => {
            await expect(indexManager.loadCompanyIndex('NONEXISTENT'))
                .rejects.toThrow(IndexNotFoundError);
        });

        it('should load company index successfully', async () => {
            const companyCode = 'AAPL';
            const documents = [{ id: '1', name: 'test.pdf', content: 'test content' }];
            const mockVectorStore = {
                memoryVectors: [
                    { content: 'chunk1', embedding: [0.1, 0.2], metadata: { source: 'test.pdf' } }
                ]
            };

            // First save an index
            await indexManager.saveCompanyIndex(companyCode, documents, mockVectorStore);

            // Then load it
            const loadedIndex = await indexManager.loadCompanyIndex(companyCode);

            expect(loadedIndex.metadata.companyCode).toBe(companyCode);
            expect(loadedIndex.documents).toHaveLength(1);
            expect(loadedIndex.documents[0].name).toBe('test.pdf');
            expect(loadedIndex.vectorData.documents).toHaveLength(1);
            expect(loadedIndex.loadedAt).toBeDefined();
        });

        it('should throw IndexCorruptedError for invalid JSON', async () => {
            const companyCode = 'CORRUPTED';
            const paths = indexManager.getCompanyFilePaths(companyCode);
            
            fs.mkdirSync(paths.dir, { recursive: true });
            fs.writeFileSync(paths.metadata, 'invalid json');
            fs.writeFileSync(paths.documents, '{}');
            fs.writeFileSync(paths.vectors, '{}');

            await expect(indexManager.loadCompanyIndex(companyCode))
                .rejects.toThrow(IndexCorruptedError);
        });

        it('should throw IndexCorruptedError for invalid data structure', async () => {
            const companyCode = 'INVALID_STRUCTURE';
            const paths = indexManager.getCompanyFilePaths(companyCode);
            
            fs.mkdirSync(paths.dir, { recursive: true });
            fs.writeFileSync(paths.metadata, '{}');
            fs.writeFileSync(paths.documents, '{"invalid": "structure"}'); // Missing documents array
            fs.writeFileSync(paths.vectors, '{}');

            await expect(indexManager.loadCompanyIndex(companyCode))
                .rejects.toThrow(IndexCorruptedError);
        });
    });

    describe('deleteCompanyIndex', () => {
        it('should delete existing company index', async () => {
            const companyCode = 'DELETE_TEST';
            const documents = [{ id: '1', name: 'test.pdf' }];
            const mockVectorStore = { memoryVectors: [] };

            // Create index
            await indexManager.saveCompanyIndex(companyCode, documents, mockVectorStore);
            expect(await indexManager.hasCompanyIndex(companyCode)).toBe(true);

            // Delete index
            const result = await indexManager.deleteCompanyIndex(companyCode);
            
            expect(result.success).toBe(true);
            expect(result.companyCode).toBe(companyCode);
            expect(await indexManager.hasCompanyIndex(companyCode)).toBe(false);
        });

        it('should throw IndexNotFoundError for non-existent index', async () => {
            await expect(indexManager.deleteCompanyIndex('NONEXISTENT'))
                .rejects.toThrow(IndexNotFoundError);
        });
    });

    describe('getCompanyStats', () => {
        it('should return stats for existing company', async () => {
            const companyCode = 'STATS_TEST';
            const documents = [
                { id: '1', name: 'doc1.pdf', url: 'http://example.com/doc1.pdf' },
                { id: '2', name: 'doc2.pdf', url: 'http://example.com/doc2.pdf' }
            ];
            const mockVectorStore = {
                memoryVectors: [
                    { content: 'chunk1', embedding: [0.1, 0.2] },
                    { content: 'chunk2', embedding: [0.3, 0.4] },
                    { content: 'chunk3', embedding: [0.5, 0.6] }
                ]
            };

            await indexManager.saveCompanyIndex(companyCode, documents, mockVectorStore);
            
            const stats = await indexManager.getCompanyStats(companyCode);
            
            expect(stats.companyCode).toBe(companyCode);
            expect(stats.documentCount).toBe(2);
            expect(stats.totalChunks).toBe(3);
            expect(stats.urls).toHaveLength(2);
            expect(stats.createdAt).toBeDefined();
            expect(stats.updatedAt).toBeDefined();
        });

        it('should return null for non-existent company', async () => {
            const stats = await indexManager.getCompanyStats('NONEXISTENT');
            expect(stats).toBeNull();
        });
    });

    describe('getAllCompanies', () => {
        it('should return empty array when no companies exist', async () => {
            const companies = await indexManager.getAllCompanies();
            expect(companies).toEqual([]);
        });

        it('should return all indexed companies', async () => {
            // Create multiple company indexes
            const companies = ['AAPL', 'GOOGL', 'MSFT'];
            const documents = [{ id: '1', name: 'test.pdf' }];
            const mockVectorStore = { memoryVectors: [{ content: 'test', embedding: [0.1] }] };

            for (const company of companies) {
                await indexManager.saveCompanyIndex(company, documents, mockVectorStore);
            }

            const allCompanies = await indexManager.getAllCompanies();
            
            expect(allCompanies).toHaveLength(3);
            expect(allCompanies.map(c => c.companyCode).sort()).toEqual(['AAPL', 'GOOGL', 'MSFT']);
        });
    });

    describe('getStorageStats', () => {
        it('should return storage statistics', async () => {
            // Create some test data
            const documents = [{ id: '1', name: 'test.pdf' }];
            const mockVectorStore = { memoryVectors: [{ content: 'test', embedding: [0.1] }] };

            await indexManager.saveCompanyIndex('AAPL', documents, mockVectorStore);
            await indexManager.saveCompanyIndex('GOOGL', documents, mockVectorStore);

            const stats = await indexManager.getStorageStats();

            expect(stats.totalCompanies).toBe(2);
            expect(stats.totalDocuments).toBe(2);
            expect(stats.totalChunks).toBe(2);
            expect(stats.storageLocation).toBe(testBaseDir);
            expect(stats.companies).toHaveLength(2);
        });
    });

    describe('serializeVectorStore', () => {
        it('should serialize vector store data', async () => {
            const mockVectorStore = {
                memoryVectors: [
                    { content: 'chunk1', embedding: [0.1, 0.2, 0.3], metadata: { source: 'doc1' } },
                    { content: 'chunk2', embedding: [0.4, 0.5, 0.6], metadata: { source: 'doc2' } }
                ]
            };

            const serialized = await indexManager.serializeVectorStore(mockVectorStore);

            expect(serialized.documents).toHaveLength(2);
            expect(serialized.embeddings).toHaveLength(2);
            expect(serialized.metadatas).toHaveLength(2);
            expect(serialized.config.dimensions).toBe(3);
        });

        it('should handle empty vector store', async () => {
            const serialized = await indexManager.serializeVectorStore(null);
            
            expect(serialized.documents).toEqual([]);
            expect(serialized.embeddings).toEqual([]);
            expect(serialized.metadatas).toEqual([]);
        });
    });
});