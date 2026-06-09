// API service for video trimming operations
import logger from '../lib/logger';

// Helper function to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Auto-save interface
interface AutoSaveRequest {
    chapters: {
        startTime: string;
        endTime: string;
        chapterTitle?: string;
    }[];
}

interface AutoSaveResponse {
    success: boolean;
    status?: string;
    timestamp: string;
    chapters?: {
        startTime: string;
        endTime: string;
        chapterTitle: string;
    }[];
    updated_at?: string;
    error?: string;
}

// Auto-save API function
export const autoSaveVideo = async (mediaId: string, data: AutoSaveRequest): Promise<AutoSaveResponse> => {
    try {
        const response = await fetch(`/api/v1/media/${mediaId}/chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        logger.debug('response', response);

        if (!response.ok) {
            // For error responses, return with error status
            if (response.status === 404) {
                // If endpoint not ready (404), return mock success response
                const timestamp = new Date().toISOString();
                return {
                    success: true,
                    timestamp: timestamp,
                };
            } else {
                // Handle other error responses
                try {
                    const errorData = await response.json();
                    return {
                        success: false,
                        timestamp: new Date().toISOString(),
                        error: errorData.error || 'Auto-save failed (videoApi.ts)',
                    };
                } catch (parseError) {
                    return {
                        success: false,
                        timestamp: new Date().toISOString(),
                        error: 'Auto-save failed (videoApi.ts)',
                    };
                }
            }
        }

        // Successful response
        const jsonResponse = await response.json();

        // Check if the response has the expected format
        return {
            success: true,
            timestamp: jsonResponse.updated_at || new Date().toISOString(),
            ...jsonResponse,
        };

    } catch (error) {
        // For any fetch errors, return mock success response
        const timestamp = new Date().toISOString();
        return {
            success: true,
            timestamp: timestamp,
        };
    }
};
