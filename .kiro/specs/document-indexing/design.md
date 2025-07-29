# Design Document

## Overview

The document indexing system extends the existing DocumentService to provide persistent storage and retrieval of processed documents by company code. This design implements a caching layer that stores vector embeddings, document metadata, and content in a structured format that can be quickly loaded and used for subsequent queries.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Layer     │    │  DocumentService │    │  IndexManager   │
│                 │───▶│                  │───▶│                 │
│ processUrls()   │    │ Enhanced methods │    │ Storage Layer   │
│ generateResp()  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Vector Store    │
                       │  (Memory/Persist)│
                       └──────────────────┘
```

### Storage Structure

```
indexes/
├── {companyCode}/
│   ├── metadata.json          # Company and document metadata
│   ├── documents.json         # Document content and metadata
│   ├── vectors/               # Vector embeddings
│   │   ├── embeddings.json    # Serialized embeddings
│   │   └── index.faiss        # Optional: FAISS index file
│   └── config.json           # Processing configuration used
```

## Components and Interfaces

### 1. IndexManager Class

```javascript
class IndexManager {
    constructor(baseDir = './indexes')
    
    // Core operations
    async saveCompanyIndex(companyCode, documents, vectorStore, metadata)
    async loadCompanyIndex(companyCode)
    async hasCompanyIndex(companyCode)
    async deleteCompanyIndex(companyCode)
    
    // Utility methods
    async getCompanyStats(companyCode)
    async getAllCompanies()
    async getStorageStats()
}
```

### 2. Enhanced DocumentService Methods

```javascript
class DocumentService {
    // Enhanced processUrls with indexing
    async processUrls(urls, companyCode = null)
    
    // Enhanced generateResponse with index support
    async generateResponse(query, companyCode = null)
    
    // New indexing methods
    async loadFromIndex(companyCode)
    async saveToIndex(companyCode)
    async refreshIndex(companyCode, urls)
}
```

### 3. Storage Interface

```javascript
interface StorageAdapter {
    async save(path, data)
    async load(path)
    async exists(path)
    async delete(path)
    async list(path)
}
```

## Data Models

### Company Index Metadata

```javascript
{
    companyCode: string,
    createdAt: string,
    updatedAt: string,
    documentCount: number,
    totalChunks: number,
    urls: string[],
    processingConfig: {
        chunkSize: number,
        chunkOverlap: number,
        embeddingModel: string
    },
    version: string
}
```

### Document Storage Format

```javascript
{
    documents: [
        {
            id: string,
            name: string,
            url: string,
            content: string,
            metadata: object,
            chunks: [
                {
                    content: string,
                    metadata: object,
                    embedding: number[] // Optional: store embeddings
                }
            ]
        }
    ]
}
```

### Vector Store Serialization

```javascript
{
    embeddings: {
        vectors: number[][],
        documents: string[],
        metadatas: object[]
    },
    config: {
        model: string,
        dimensions: number
    }
}
```

## Error Handling

### Error Types

1. **IndexNotFoundError**: When requested company index doesn't exist
2. **IndexCorruptedError**: When index files are corrupted or incomplete
3. **StorageError**: When storage operations fail
4. **SerializationError**: When serializing/deserializing data fails

### Error Handling Strategy

```javascript
try {
    const index = await indexManager.loadCompanyIndex(companyCode);
} catch (error) {
    if (error instanceof IndexNotFoundError) {
        // Proceed with normal processing
        return await this.processUrls(urls);
    } else if (error instanceof IndexCorruptedError) {
        // Log error and reprocess
        logger.warn(`Corrupted index for ${companyCode}, reprocessing`);
        await indexManager.deleteCompanyIndex(companyCode);
        return await this.processUrls(urls, companyCode);
    } else {
        // Handle other storage errors
        throw new Error(`Failed to load index: ${error.message}`);
    }
}
```

## Testing Strategy

### Unit Tests

1. **IndexManager Tests**
   - Test saving and loading company indexes
   - Test index existence checks
   - Test index deletion
   - Test error handling for corrupted data

2. **DocumentService Integration Tests**
   - Test processUrls with and without company codes
   - Test generateResponse with indexed documents
   - Test fallback behavior when indexes are unavailable

3. **Storage Adapter Tests**
   - Test file system operations
   - Test error handling for storage failures
   - Test concurrent access scenarios

### Integration Tests

1. **End-to-End Workflow Tests**
   - Process documents → Save index → Load index → Generate response
   - Test with multiple companies
   - Test index refresh scenarios

2. **Performance Tests**
   - Compare response times with and without indexing
   - Test memory usage with large document sets
   - Test concurrent access performance

### Test Data

```javascript
const testCompanies = [
    {
        code: 'AAPL',
        urls: ['https://example.com/aapl-earnings.pdf'],
        expectedDocCount: 1
    },
    {
        code: 'GOOGL',
        urls: ['https://example.com/googl-10k.pdf', 'https://example.com/googl-earnings.pdf'],
        expectedDocCount: 2
    }
];
```

## Implementation Phases

### Phase 1: Core Indexing Infrastructure
- Implement IndexManager class
- Create file system storage adapter
- Add basic save/load functionality

### Phase 2: DocumentService Integration
- Enhance processUrls method
- Enhance generateResponse method
- Add index management methods

### Phase 3: Advanced Features
- Add index refresh functionality
- Implement storage statistics
- Add concurrent access handling

### Phase 4: Optimization & Monitoring
- Add performance monitoring
- Implement index compression
- Add cleanup utilities

## Security Considerations

1. **Access Control**: Ensure company indexes are properly isolated
2. **Data Validation**: Validate company codes and sanitize file paths
3. **Storage Security**: Implement proper file permissions for index directories
4. **Memory Safety**: Prevent memory leaks when loading large indexes

## Performance Considerations

1. **Lazy Loading**: Load only necessary parts of indexes
2. **Compression**: Compress stored embeddings and documents
3. **Caching**: Cache frequently accessed indexes in memory
4. **Cleanup**: Implement automatic cleanup of old or unused indexes

## Monitoring and Observability

1. **Metrics**: Track index hit/miss rates, storage usage, response times
2. **Logging**: Log index operations, errors, and performance metrics
3. **Health Checks**: Monitor index integrity and storage availability
4. **Alerts**: Alert on index corruption, storage failures, or performance degradation