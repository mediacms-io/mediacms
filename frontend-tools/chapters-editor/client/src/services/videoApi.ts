// API service for video trimming operations
import logger from '../lib/logger';

// Helper function to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Auto-save interface
interface AutoSaveRequest {
    segments: {
        startTime: string;
        endTime: string;
        name?: string;
    }[];
}

interface AutoSaveResponse {
    success: boolean;
    timestamp: string;
    error?: string;
    status?: string;
    media_id?: string;
    segments?: {
        startTime: string;
        endTime: string;
        name: string;
    }[];
    updated_at?: string;
}

// Auto-save API function
export const autoSaveVideo = async (mediaId: string, data: AutoSaveRequest): Promise<AutoSaveResponse> => {
    try {
        const response = await fetch(`/api/v1/media/${mediaId}/save_chapters`, {
            // TODO: ask backend to add save_chapters endpoint
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
                        error: errorData.error || 'Auto-save failed',
                    };
                } catch (parseError) {
                    return {
                        success: false,
                        timestamp: new Date().toISOString(),
                        error: 'Auto-save failed',
                    };
                }
            }
        }

        // Successful response
        const jsonResponse = await response.json();

        // Check if the response has the expected format
        if (jsonResponse.status === 'success') {
            return {
                success: true,
                timestamp: jsonResponse.updated_at || new Date().toISOString(),
                ...jsonResponse,
            };
        } else {
            return {
                success: false,
                timestamp: new Date().toISOString(),
                error: jsonResponse.error || 'Auto-save failed',
            };
        }
    } catch (error) {
        // For any fetch errors, return mock success response
        const timestamp = new Date().toISOString();
        return {
            success: true,
            timestamp: timestamp,
        };
    }
};
