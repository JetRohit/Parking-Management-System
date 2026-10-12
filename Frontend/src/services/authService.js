import apiRequest from "./api";


export async function login(username, password) {
  const response = await apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Login failed"
    );
  }

  return data;
}


export async function getCurrentUser() {
  const response = await apiRequest("/me", {
    skipAuthRedirect: true,
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}


export async function logout() {
  const response = await apiRequest("/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }

  return await response.json();
}