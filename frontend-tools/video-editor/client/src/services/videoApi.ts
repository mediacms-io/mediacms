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

// For now, we'll use a mock API that returns a promise
// This can be replaced with actual API calls later
export const trimVideo = async (
  mediaId: string, 
  data: TrimVideoRequest
): Promise<TrimVideoResponse> => {
  // In a real app, this would be an actual fetch call:
  // return fetch(`/api/v1/media/${mediaId}/trim_video`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // }).then(res => res.json())
  
  // Mock implementation that simulates network latency
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        msg: "Video is processing for trim",
        url_redirect: `./view?m=${mediaId}`
      });
    }, 1500); // Simulate 1.5 second server delay
  });
};