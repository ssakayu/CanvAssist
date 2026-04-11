export default async function getActiveCourses() {
    const res = await fetch('https://canvas.qut.edu.au/api/v1/courses?enrollment_state=active&per_page=10', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
    });

    return await res.json();
}


