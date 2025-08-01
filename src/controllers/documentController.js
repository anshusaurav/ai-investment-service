const documentService = require("../services/documentService");
const ApiResponse = require("../utils/responses");
const logger = require("../utils/logger");

class DocumentController {
  async ingestDocuments(req, res) {
    try {
      const { filePaths } = req.body;
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        return ApiResponse.validationError(res, [
          "At least one file path is required",
        ]);
      }
      const result = await documentService.processDocuments(filePaths);
      return ApiResponse.success(
        res,
        {
          documentIds: result.documentIds,
          totalProcessed: result.docCount,
        },
        `Processed ${result.docCount} document(s) successfully`
      );
    } catch (error) {
      logger.error("Error in ingestDocuments controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to process documents",
        500
      );
    }
  }

  async ingestUrls(req, res) {
    try {
      const { urls, company } = req.body;
      const { companyCode, name, industryLink, bseCode, nseCode } = company;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return ApiResponse.validationError(res, [
          "At least one URL is required",
        ]);
      }
      const result = await documentService.processUrls(urls, {
        companyCode,
        name,
        industryLink,
        bseCode,
        nseCode,
      });
      return ApiResponse.success(
        res,
        {
          processedUrls: result.processedUrls,
          totalProcessed: result.processedCount,
        },
        `Processed ${result.processedCount} URL(s) successfully`
      );
    } catch (error) {
      logger.error("Error in ingestUrls controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to process URLs",
        500
      );
    }
  }

  async listDocuments(req, res) {
    try {
      const documents = await documentService.getDocuments();
      return ApiResponse.success(
        res,
        { documents },
        "Documents retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in listDocuments controller:", error);
      return ApiResponse.error(res, "Failed to retrieve documents", 500);
    }
  }

  async chat(req, res) {
    try {
      const { message, filterOptions } = req.body;
      if (!message) {
        return ApiResponse.validationError(res, ["Message is required"]);
      }
      const response = await documentService.generateResponse(
        message,
        filterOptions
      );
      console.log(response);
      return ApiResponse.success(
        res,
        response,
        "Response generated successfully"
      );
    } catch (error) {
      logger.error("Error in chat controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to process chat message",
        500
      );
    }
  }

  async transformPrompt(req, res) {
    try {
      const { message } = req.body;
      if (!message) {
        return ApiResponse.validationError(res, ["Message is required"]);
      }
      const result = await documentService.generateTransformedPrompt(message);
      return ApiResponse.success(
        res,
        result,
        "Prompt transformed successfully"
      );
    } catch (error) {
      logger.error("Error in transformPrompt controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to transform prompt",
        500
      );
    }
  }

  async transformAndChat(req, res) {
    try {
      const { message, filterOptions } = req.body;
      if (!message) {
        return ApiResponse.validationError(res, ["Message is required"]);
      }
      const response = await documentService.generateTransformedResponse(
        message,
        filterOptions
      );
      console.log(response);
      return ApiResponse.success(
        res,
        response,
        "Transformed response generated successfully"
      );
    } catch (error) {
      logger.error("Error in transformAndChat controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to process transformed chat message",
        500
      );
    }
  }

  async getStatus(req, res) {
    try {
      const documents = await documentService.getDocuments();
      const status = {
        totalDocuments: documents.length,
        hasQdrantConnection: true, // Since we're using Qdrant now
        lastProcessed:
          documents.length > 0
            ? Math.max(
              ...documents.map((d) => new Date(d.processedAt).getTime())
            )
            : null,
      };
      return ApiResponse.success(
        res,
        status,
        "Service status retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getStatus controller:", error);
      return ApiResponse.error(
        res,
        error.message || "Failed to get service status",
        500
      );
    }
  }
}

module.exports = new DocumentController();
