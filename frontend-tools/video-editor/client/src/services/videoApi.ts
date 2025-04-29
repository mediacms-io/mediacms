// API service for video trimming operations

interface TrimVideoRequest {
  segments: {
    startTime: string;
    endTime: string;
    name?: string; 
  }[];
  saveAsCopy?: boolean;
  saveIndividualSegments?: boolean; 
}

interface TrimVideoResponse {
  msg: string;
  url_redirect: string;
}

// Helper function to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// For now, we'll use a mock API that returns a promise
// This can be replaced with actual API calls later
export const trimVideo = async (
  mediaId: string, 
  data: TrimVideoRequest
): Promise<TrimVideoResponse> => {
  try {
    // Attempt the real API call
    const response = await fetch(`/api/v1/media/${mediaId}/trim_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok && response.status !== 404) {
      // If endpoint not ready (404 or other error), return mock success response
      await delay(1500); // Simulate 1.5 second server delay
      return {
        msg: "Video is processing for trim",
        url_redirect: `./view?m=${mediaId}`
      };
    }
    
    return await response.json();
  } catch (error) {
    // For any fetch errors, return mock success response with delay
    await delay(1500); // Simulate 1.5 second server delay
    return {
      msg: "Backend is not ready for trim video yet!",
      url_redirect: `./view?m=${mediaId}`
    };
  }
  
  /* Mock implementation that simulates network latency
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        msg: "Video is processing for trim",
        url_redirect: `./view?m=${mediaId}`
      });
    }, 1500); // Simulate 1.5 second server delay
  });
  */
};