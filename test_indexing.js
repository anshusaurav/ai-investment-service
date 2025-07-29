const DocumentService = require('./src/services/documentService');

async function testIndexing() {
    const docService = DocumentService;

    console.log('=== Testing Document Indexing ===\n');

    const companyCode = 'TEST_COMPANY';
    const testUrls = ['https://example.com/test.pdf']; // This will fail but shows the logic

    // Test 1: Check if company has documents (should be false initially)
    console.log('1. Checking if company has indexed documents...');
    const hasDocuments = await docService.hasCompanyDocuments(companyCode);
    console.log(`Company ${companyCode} has indexed documents: ${hasDocuments}\n`);

    // Test 2: Try to generate response without documents
    console.log('2. Trying to generate response without documents...');
    try {
        const response = await docService.generateResponse('What is the revenue?', companyCode);
        console.log('Response:', response.text);
        console.log('Error:', response.error || 'None');
    } catch (error) {
        console.log('Error:', error.message);
    }
    console.log();

    // Test 3: Try to process URLs (will fail due to invalid URL but shows indexing logic)
    console.log('3. Attempting to process URLs (will show indexing behavior)...');
    try {
        const result = await docService.processUrls(testUrls, companyCode);
        console.log('Process result:', result);
    } catch (error) {
        console.log('Expected error (invalid URL):', error.message);
    }
    console.log();

    // Test 4: Get all indexed companies
    console.log('4. Getting all indexed companies...');
    const companies = await docService.getAllIndexedCompanies();
    console.log('Indexed companies:', companies.length);
    companies.forEach(company => {
        console.log(`- ${company.companyCode}: ${company.documentCount} documents`);
    });

    console.log('\n=== Test Complete ===');
}

// Run the test
testIndexing().catch(console.error);