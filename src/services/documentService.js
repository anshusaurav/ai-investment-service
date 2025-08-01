const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { QdrantClient } = require("@qdrant/js-client-rest");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class DocumentService {
  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-embedding-001",
    });
    // Temporary directory for processing files (can be cleaned up after processing)
    this.uploadDir = process.env.UPLOAD_DIR || "./uploads";
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Collection name for Qdrant
    this.collectionName = "documents";

    // Initialize Qdrant client
    this.client = new QdrantClient({ url: "http://127.0.0.1:6333" });

    // Initialize collection (immediately invoked)
    (async () => {
      try {
        await this.initializeCollection();
      } catch (error) {
        console.error("Failed to initialize Qdrant:", error);
      }
    })();
  }

  async initializeCollection() {
    try {
      // First check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        // Create collection if it doesn't exist
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 3072, // Dimension size for Gemini embeddings
            distance: "Cosine",
          },
          // Add optimizers config
          optimizers_config: {
            default_segment_number: 2,
          },
          // Add on-disk storage
          on_disk: true,
        });
        console.log(`Collection ${this.collectionName} created successfully`);
      } else {
        console.log(`Collection ${this.collectionName} already exists`);
      }
    } catch (error) {
      console.error("Failed to initialize collection:", error);
      // Throw error to prevent processing without proper initialization
      throw new Error(
        `Failed to initialize Qdrant collection: ${error.message}`
      );
    }
  }

  async processUrls(urls, company) {
    // this.clearVectorStore();
    try {
      const processedUrls = [];
      for (const url of urls) {
        if (!this.isValidUrl(url)) {
          console.warn(`Invalid URL: ${url}`);
          continue;
        }
        try {
          const response = await axios.get(url, {
            responseType: "arraybuffer",
          });
          const contentType = response.headers["content-type"] || "";
          const fileName = `url_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          let filePath = "";
          let docs = [];

          if (contentType.includes("pdf")) {
            filePath = path.join(this.uploadDir, `${fileName}.pdf`);
            await fs.promises.writeFile(filePath, response.data);
            const loader = new PDFLoader(filePath);
            docs = await loader.load();
          } else if (
            contentType.includes("text/plain") ||
            contentType.includes("text/html") ||
            contentType.includes("application/json")
          ) {
            filePath = path.join(this.uploadDir, `${fileName}.txt`);
            await fs.promises.writeFile(filePath, response.data);
            const loader = new TextLoader(filePath);
            docs = await loader.load();
          } else {
            console.warn(
              `Unsupported content type for URL ${url}: ${contentType}`
            );
            continue;
          }

          if (docs.length > 0) {
            const textSplitter = new RecursiveCharacterTextSplitter({
              chunkSize: 1000,
              chunkOverlap: 200,
            });

            const splitDocs = await textSplitter.splitDocuments(docs);

            // Instead of using MemoryVectorStore, store in Qdrant
            for (const doc of splitDocs) {
              const embedding = await this.embeddings.embedQuery(
                doc.pageContent
              );

              await this.client.upsert(this.collectionName, {
                points: [
                  {
                    id: uuidv4(),
                    vector: embedding,
                    payload: {
                      content: doc.pageContent,
                      metadata: { ...doc.metadata, companyMetaData: { ...company, link: url } },
                    },
                  },
                ],
              });
            }

            processedUrls.push(url);

            // Clean up temporary file after processing
            try {
              await fs.promises.unlink(filePath);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temporary file ${filePath}:`, cleanupError);
            }
          }
        } catch (error) {
          console.error(`Error processing URL ${url}:`, error);
        }
      }
      return {
        success: true,
        processedCount: processedUrls.length,
        processedUrls,
      };
    } catch (error) {
      console.error("Error processing URLs:", error);
      throw new Error(`Failed to process URLs: ${error.message}`);
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async searchDocuments(query, k = 3, filterOptions = {}) {
    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      console.log("Query embedding:", JSON.stringify(queryEmbedding));

      // Build filter conditions based on provided options
      let filter = null;
      if (Object.keys(filterOptions).length > 0) {
        const conditions = [];
        const validFields = [
          "companyCode",
          "nseCode",
          "bseCode",
          "industryLink",
          "name",
        ];

        for (const field of validFields) {
          if (filterOptions[field]) {
            conditions.push({
              key: `metadata.companyMetaData.${field}`,
              match: {
                value: filterOptions[field],
              },
            });
          }
        }

        if (conditions.length > 0) {
          filter = {
            must: conditions,
          };
        }
      }

      const searchResults = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: k,
        filter: filter,
      });
      console.log("Search results:", searchResults);

      return searchResults.map((result) => {
        return {
          content: result.payload.content,
          metadata: {
            ...result.payload.metadata,
            sourceName: result.payload.metadata?.companyMetaData?.link || "Document",
            sourceType: "url",
            sourceUrl: result.payload.metadata?.companyMetaData?.link,
            company: result.payload.metadata?.companyMetaData || {},
          },
        };
      });
    } catch (error) {
      console.error("Error searching documents:", error);
      throw new Error("Failed to search documents");
    }
  }

  async generateResponse(query, filterOptions) {
    try {
      const relevantDocs = await this.searchDocuments(query, 3, filterOptions);
      if (relevantDocs.length === 0) {
        return {
          text: "I couldn't find any relevant information in the document to answer your question.",
          sources: [],
        };
      }

      const context = relevantDocs.map((doc) => doc.content).join("\n\n");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are a helpful assistant that answers questions based on the provided context. 
        Answer the question based on the context below. If you can't find the answer, say so.

        Context: ${context}

        Question: ${query}

        Answer:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const sources = [
        ...new Set(
          relevantDocs.map((doc) => doc.metadata?.source || "Document")
        ),
      ];

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error("Error generating response:", error);
      throw new Error("Failed to generate response");
    }
  }

  async generateTransformedPrompt(query) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating transformed prompt:", error);
      throw new Error("Failed to transform prompt");
    }
  }

  async getDocuments() {
    try {
      // Get documents from Qdrant instead of local array
      const scrollResult = await this.client.scroll(this.collectionName, {
        limit: 100,
        with_payload: true,
        with_vector: false,
      });

      // Extract unique documents based on company metadata
      const uniqueDocuments = new Map();

      scrollResult.points.forEach(point => {
        const companyData = point.payload.metadata?.companyMetaData;
        if (companyData && companyData.link) {
          const key = `${companyData.companyCode}_${companyData.link}`;
          if (!uniqueDocuments.has(key)) {
            uniqueDocuments.set(key, {
              id: point.id,
              name: companyData.link,
              type: "url",
              company: companyData,
              processedAt: new Date().toISOString(), // We don't have the original timestamp
            });
          }
        }
      });

      return Array.from(uniqueDocuments.values());
    } catch (error) {
      console.error("Error getting documents from Qdrant:", error);
      return [];
    }
  }

  async generateTransformedResponse(query, filterOptions) {
    try {
      // First, transform the prompt
      const transformedPrompt = await this.generateTransformedPrompt(query);

      // Then use the transformed prompt to generate response
      const relevantDocs = await this.searchDocuments(transformedPrompt, 3, filterOptions);
      if (relevantDocs.length === 0) {
        return {
          text: "I couldn't find any relevant information in the document to answer your question.",
          sources: [],
          sourceDetails: [],
          transformedPrompt,
        };
      }

      // Create numbered context with source references
      const contextWithSources = relevantDocs.map((doc, index) => {
        return `[SOURCE_${index}] ${doc.content}`;
      }).join("\n\n");

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.0,
        },
      });

      // Enhanced prompt that asks for citations
      const finalPrompt = `${transformedPrompt}

        Context: ${contextWithSources}

        FORMATTING REQUIREMENTS:
        1. Use proper markdown formatting in your response (bold text with **, bullet points, numbered lists, etc.)
        2. Structure your response with clear headings and subheadings using ## and ###
        3. Use bullet points and numbered lists where appropriate
        4. Make key information stand out with **bold** formatting

        CITATION REQUIREMENTS:
        When you reference information from the context, include the source reference (e.g., [SOURCE_0], [SOURCE_1]) at the end of each sentence or claim that uses that information. This will help map your response back to the original documents.

        Example: "The company reported **strong revenue growth** [SOURCE_0]. However, there are concerns about market conditions [SOURCE_1].

        ## Key Financial Metrics
        1. **Revenue**: $1.2B showing 15% growth [SOURCE_0]
        2. **Cash Flow**: Improved by 8% [SOURCE_2]"`;

      const result = await model.generateContent(finalPrompt);
      const response = result.response;
      const text = response.text();

      // Extract unique sources for backward compatibility
      const sources = [
        ...new Set(
          relevantDocs.map((doc) => doc.metadata?.companyMetaData?.link || "Document")
        ),
      ];

      // Create detailed source mapping for frontend highlighting
      const sourceDetails = relevantDocs.map((doc, index) => ({
        id: `SOURCE_${index}`,
        sourceRef: `[SOURCE_${index}]`,
        link: doc.metadata?.companyMetaData?.link,
        pageNumber: doc.metadata?.loc?.pageNumber,
        lines: doc.metadata?.loc?.lines,
        content: doc.content,
        company: doc.metadata?.companyMetaData,
        // Add a snippet preview for the frontend
        contentPreview: doc.content.length > 200
          ? doc.content.substring(0, 200) + "..."
          : doc.content
      }));

      return {
        text,
        sources,
        sourceDetails,
        transformedPrompt,
      };
    } catch (error) {
      console.error("Error generating transformed response:", error);
      throw new Error("Failed to generate transformed response");
    }
  }

  async clearVectorStore() {
    try {
      // Delete the entire collection and recreate it
      await this.client.deleteCollection(this.collectionName);
      await this.initializeCollection();

      console.log("Vector store cleared successfully");
      return true;
    } catch (error) {
      console.error("Error clearing vector store:", error);
      throw new Error("Failed to clear vector store");
    }
  }
}

module.exports = new DocumentService();

/*
I also want to save an object for companyCode, name, industryLink, bseCode, nseCode in metadata. I will send these details in the route of '/ingest-urls'. 
*/
