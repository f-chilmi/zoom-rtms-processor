import fetch from "node-fetch";

const API_BASE_URL = process.env.BACKEND_API_URL || "http://localhost:3001";
const API_KEY = process.env.ZOOM_SERVICE_API_KEY;

if (!API_KEY) {
  throw new Error("ZOOM_SERVICE_API_KEY environment variable is required");
}

const apiHeaders = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
};

export const upsertUser = async (
  zoomId,
  accessToken,
  refreshToken,
  expiredAt
) => {
  try {
    console.log(`Syncing Zoom user: ${zoomId}`);

    const response = await fetch(`${API_BASE_URL}/zoom-meetings/users/sync`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        zoomId,
        accessToken,
        refreshToken,
        expiredAt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 404) {
        throw new Error(
          `User with Zoom ID ${zoomId} not found in database. Please register first.`
        );
      }
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${
          errorData?.message || "Unknown error"
        }`
      );
    }

    const result = await response.json();
    console.log(`Successfully synced Zoom user: ${zoomId}`);

    return {
      id: result.data.id,
      accessToken: result.data.zoomAccessToken,
      refreshToken: result.data.zoomRefreshToken,
      expired_at: expiredAt,
    };
  } catch (error) {
    console.error(`Error syncing Zoom user ${zoomId}:`, error.message);
    throw error;
  }
};

export const getUser = async (zoomId) => {
  try {
    console.log(`Getting Zoom user: ${zoomId}`);

    const response = await fetch(
      `${API_BASE_URL}/zoom-meetings/users/${zoomId}`,
      {
        method: "GET",
        headers: apiHeaders,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User with Zoom ID ${zoomId} not found`);
      }
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${
          errorData?.message || "Unknown error"
        }`
      );
    }

    const result = await response.json();

    return {
      id: result.data.id,
      accessToken: result.data.zoomAccessToken,
      refreshToken: result.data.zoomRefreshToken,
      expired_at: null, // You might want to add expiration tracking
    };
  } catch (error) {
    console.error(`Error getting Zoom user ${zoomId}:`, error.message);
    throw error;
  }
};

export const updateUser = async (zoomId, updates) => {
  try {
    console.log(`Updating Zoom user: ${zoomId}`);

    // Map the updates to match the API expectations
    const updateData = {
      zoomId,
      accessToken: updates.accessToken,
      refreshToken: updates.refreshToken,
      expiredAt: updates.expired_at || Date.now() + 3600000, // Default to 1 hour if not provided
    };

    const response = await fetch(`${API_BASE_URL}/zoom-meetings/users/tokens`, {
      method: "PUT",
      headers: apiHeaders,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User with Zoom ID ${zoomId} not found`);
      }
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${
          errorData?.message || "Unknown error"
        }`
      );
    }

    const result = await response.json();
    console.log(`Successfully updated Zoom user: ${zoomId}`);

    return {
      id: result.data.id,
      accessToken: result.data.zoomAccessToken,
      refreshToken: result.data.zoomRefreshToken,
      expired_at: updateData.expiredAt,
    };
  } catch (error) {
    console.error(`Error updating Zoom user ${zoomId}:`, error.message);
    throw error;
  }
};

export const deleteUser = async (zoomId) => {
  try {
    console.log(`Deleting Zoom user tokens: ${zoomId}`);

    // For deletion, we'll just clear the tokens by updating them to null
    const response = await fetch(`${API_BASE_URL}/zoom-meetings/users/tokens`, {
      method: "PUT",
      headers: apiHeaders,
      body: JSON.stringify({
        zoomId,
        accessToken: null,
        refreshToken: null,
        expiredAt: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          `User with Zoom ID ${zoomId} not found, considering as deleted`
        );
        return true;
      }
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${
          errorData?.message || "Unknown error"
        }`
      );
    }

    console.log(`Successfully cleared Zoom tokens for user: ${zoomId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting Zoom user ${zoomId}:`, error.message);
    throw error;
  }
};
