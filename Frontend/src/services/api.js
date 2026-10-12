const API_URL = "";

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },

      credentials: "include",
    }
  );

  // ========================================
  // SESSION EXPIRED / NOT AUTHENTICATED
  // ========================================

  const skipAuthRedirect =
    options.skipAuthRedirect === true;

  if (
    response.status === 401 &&
    endpoint !== "/login" &&
    !skipAuthRedirect
  ) {
    window.location.href = "/login";
  }

  return response;
}

export default apiRequest;