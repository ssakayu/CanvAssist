export default async function getActiveCourses() {
  try {
    const res = await fetch(
      "https://canvas.qut.edu.au/api/v1/courses?enrollment_state=active&per_page=10",
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

    console.log("status:", res.status);
    console.log("ok:", res.ok);

    if (!res.ok) {
      const text = await res.text();
      console.log("error response:", text);
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("courses data:", data);
    return data;
  } catch (error) {
    console.error("getActiveCourses error:", error);
    throw error;
  }
}