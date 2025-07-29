import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { WebPDFLoader } from 'langchain/document_loaders/web/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from "dotenv";

dotenv.config();

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Document processor class
class DocumentProcessor {
    constructor() {
        this.vectorStore = null;
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            model: 'models/embedding-003',
        });
        this.documents = [];
        this.uploadDir = process.env.UPLOAD_DIR || './uploads';
        
        // Create upload directory if it doesn't exist
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    // Process and store multiple documents
    async processDocuments(filePaths) {
        try {
            const allDocs = [];
            
            for (const filePath of filePaths) {
                let docs;
                
                // Handle local file paths
                if (fs.existsSync(filePath)) {
                    const fileExt = path.extname(filePath).toLowerCase();
                    let loader;
                    
                    if (fileExt === '.pdf') {
                        loader = new PDFLoader(filePath);
                    } else if (fileExt === '.txt') {
                        loader = new TextLoader(filePath);
                    } else {
                        console.warn(`Skipping unsupported file type: ${filePath}`);
                        continue;
                    }
                    
                    docs = await loader.load();
                } 
                // Handle URLs (skipping for now as we'll handle them separately)
                else if (this.isValidUrl(filePath)) {
                    continue;
                }
                
                if (docs && docs.length > 0) {
                    allDocs.push(...docs);
                }
            }
            
            if (allDocs.length === 0) {
                throw new Error('No valid documents were processed');
            }
            
            // Split documents into chunks
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            
            const splitDocs = await textSplitter.splitDocuments(allDocs);
            
            // Create or update vector store
            if (this.vectorStore) {
                await this.vectorStore.addDocuments(splitDocs);
            } else {
                this.vectorStore = await MemoryVectorStore.fromDocuments(
                    splitDocs,
                    this.embeddings
                );
            }
            
            // Store document metadata
            this.documents.push(...filePaths.map(filePath => ({
                id: uuidv4(),
                name: path.basename(filePath),
                path: filePath,
                type: 'file',
                processedAt: new Date().toISOString()
            })));
            
            return { 
                success: true, 
                docCount: splitDocs.length,
                documentIds: this.documents.map(doc => doc.id)
            };
        } catch (error) {
            console.error('Error processing documents:', error);
            throw new Error(`Failed to process documents: ${error.message}`);
        }
    }
    
    // Process URLs
    async processUrls(urls) {
        try {
            const processedUrls = [];
            
            for (const url of urls) {
                if (!this.isValidUrl(url)) {
                    console.warn(`Invalid URL: ${url}`);
                    continue;
                }
                
                try {
                    // Download and process the URL content
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const contentType = response.headers['content-type'] || '';
                    const fileName = `url_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    let filePath = '';
                    let docs = [];
                    
                    if (contentType.includes('pdf')) {
                        filePath = path.join(this.uploadDir, `${fileName}.pdf`);
                        await fs.promises.writeFile(filePath, response.data);
                        const loader = new PDFLoader(filePath);
                        docs = await loader.load();
                    } else if (contentType.includes('text/plain') || 
                              contentType.includes('text/html') ||
                              contentType.includes('application/json')) {
                        filePath = path.join(this.uploadDir, `${fileName}.txt`);
                        await fs.promises.writeFile(filePath, response.data);
                        const loader = new TextLoader(filePath);
                        docs = await loader.load();
                    } else {
                        console.warn(`Unsupported content type for URL ${url}: ${contentType}`);
                        continue;
                    }
                    
                    if (docs.length > 0) {
                        // Add to vector store
                        const textSplitter = new RecursiveCharacterTextSplitter({
                            chunkSize: 1000,
                            chunkOverlap: 200,
                        });
                        
                        const splitDocs = await textSplitter.splitDocuments(docs);
                        
                        if (this.vectorStore) {
                            await this.vectorStore.addDocuments(splitDocs);
                        } else {
                            this.vectorStore = await MemoryVectorStore.fromDocuments(
                                splitDocs,
                                this.embeddings
                            );
                        }
                        
                        // Store URL metadata
                        this.documents.push({
                            id: uuidv4(),
                            name: url,
                            path: filePath,
                            type: 'url',
                            url: url,
                            processedAt: new Date().toISOString()
                        });
                        
                        processedUrls.push(url);
                    }
                } catch (error) {
                    console.error(`Error processing URL ${url}:`, error);
                    // Continue with next URL
                }
            }
            
            return {
                success: true,
                processedCount: processedUrls.length,
                processedUrls
            };
        } catch (error) {
            console.error('Error processing URLs:', error);
            throw new Error(`Failed to process URLs: ${error.message}`);
        }
    }
    
    // Helper to validate URLs
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Search for relevant documents
    async searchDocuments(query, k = 3) {
        if (!this.vectorStore) {
            throw new Error('No documents have been processed yet');
        }

        const results = await this.vectorStore.similaritySearch(query, k);
        return results.map(doc => {
            // Find the original document metadata
            const docPath = doc.metadata?.source;
            const sourceDoc = this.documents.find(d => 
                d.path === docPath || docPath?.includes(d.path)
            );
            
            return {
                content: doc.pageContent,
                metadata: {
                    ...doc.metadata,
                    sourceName: sourceDoc?.name || 'Document',
                    sourceType: sourceDoc?.type || 'file',
                    sourceUrl: sourceDoc?.url
                }
            };
        });
    }

    // Generate response using RAG
    async generateResponse(query) {
        try {
            // Get relevant documents
            const relevantDocs = await this.searchDocuments(query);
            
            if (relevantDocs.length === 0) {
                return {
                    text: "I couldn't find any relevant information in the document to answer your question.",
                    sources: []
                };
            }

            // Prepare context from relevant documents
            const context = relevantDocs.map(doc => doc.content).join('\n\n');
            
            // Generate response using Gemini
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
            
            const prompt = `You are a helpful assistant that answers questions based on the provided context. 
            Answer the question based on the context below. If you can't find the answer, say so.
            
            Context: ${context}
            
            Question: ${query}
            
            Answer:`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Get sources
            const sources = [...new Set(relevantDocs.map(doc => 
                doc.metadata?.source || 'Document'
            ))];
            
            return {
                text,
                sources
            };
            
        } catch (error) {
            console.error('Error generating response:', error);
            throw new Error('Failed to generate response');
        }
    }

    async generateTransformedPrompt(query) {
        try {
            // Get relevant documents

            // Generate response using Gemini
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

            const prompt = `# ROLE: AI Financial Analyst & Research Synthesizer
# GOAL: To transform a user's query into a comprehensive [ANALYSIS PROMPT] that directs an LLM to perform a deep, multi-document analysis, synthesizing qualitative and quantitative data to create an exhaustive and insightful response.

# INSTRUCTIONS:
1.  **Analyze the [RAW PROMPT TO BE TRANSFORMED] below the separator:**
    * **Identify Core Intent:** What is the user's fundamental goal? (e.g., assessing risk, understanding competitive position).

2.  **Construct the [ANALYSIS PROMPT]:**
    * Generate a new prompt containing the four sections below.

    * **[PRIMARY DIRECTIVE]:**
        * "You are an expert document analysis AI. Your only function is to answer the user's question based **exclusively** on the information contained within the provided source documents. Do not use outside knowledge. Your answer must be a comprehensive synthesis of all relevant information found across all provided documents."

    * **[FILTERS & FOCUS]:**
        * "This is a critical rule: You must differentiate between substantive business content and procedural noise.
        * **YOU MUST IGNORE:** Standard boilerplate text, including forward-looking statement disclaimers, moderator scripts, and introductions. Ignore all document metadata like filenames or cover letter dates.
        * **YOU MUST FOCUS ON:** The direct statements, commentary, data, and Q&A involving company management (CEO, CFO, COO) and market analysts."

    * **[ANALYST'S PLAYBOOK]:**
        * "To generate your answer, you must follow this exact thought process:
        * **1. Comprehensive Data Sweep:** First, perform a full review of ALL provided documents. Extract all key quantitative metrics (e.g., revenues, profits/losses, debt, cash surplus, sales bookings, GDV, collections) and critical qualitative statements (e.g., management's outlook on the market, strategic ambitions, concerns, analyst questions).
        * **2. Cross-Document Trend Analysis:** Your most important task is to compare information across different time periods (i.e., across the different documents/earnings calls). **Identify changes and trends.** For example: Has the net cash surplus increased or decreased between quarters? Is management's tone about market conditions (e.g., 'pricing growth,' 'sales velocity') more or less optimistic than in previous calls?
        * **3. Exhaustive Synthesis for the User's Query:** Use the complete set of information from the steps above to answer the user's specific query. **Do not stop after finding one piece of evidence.** Your goal is to provide a complete, synthesized list of all relevant points.
            * **If asked for 'Risks' or 'Red Flags':** Compile an exhaustive list of every potential business concern. This includes: financial losses (even marginal ones), **declining metrics over time (like a reduction in net cash surplus)**, cautionary statements from management about market moderation or competition, risky strategies (like acquiring 'stuck' projects), structural issues (like accounting timing mismatches or lower JDA margins), and specific concerns raised by analysts in their questions.
            * **If asked for 'Market Share' or 'Competitive Position':** Clearly state that a specific market share percentage is not provided. Then, construct a complete narrative of the company's competitive standing using **all** available evidence, including: their stated ambitions (e.g., 'aiming for top 2'), their growth rates and sales performance, their claims of pricing power (e.g., commanding a 'premium'), and their physical scale (e.g., leased area, development pipeline)."

    * **[USER QUERY]:**
        * "With these instructions and playbook, analyze the provided documents to answer the following user query: ${query}"

3.  **Generate Final Output:**
    * Your output should be ONLY the text for the newly constructed [ANALYSIS PROMPT].
`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return {text}

        } catch (error) {
            console.error('Error generating transformed prompt:', error);
            throw new Error('Failed to transform prompt');
        }
    }

}

export default new DocumentProcessor();
