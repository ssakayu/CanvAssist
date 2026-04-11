import { useEffect } from "react";
import Header from "../header/Header";
import UnitCard from "../overview/UnitCard";
import getActiveCourses from "../../api/getActiveCourses";
import { useGlobal } from "../../context/GlobalContext";

/* STATIC VALUES - REMOVE ONCE YOU HAVE THE API */
const UNITS = [
    {
        code: 'CAB302',
        name: 'Agile Software Engineering',
        badge: '2 due soon',
        badgeVariant: 'soon',
        grade: 62,
        footerRight: 'Need 50%+ to pass',
        progress: 62,
        barVariant: 'green',
    },
    {
        code: 'IFB220',
        name: 'Introduction to AI',
        badge: 'On track',
        badgeVariant: 'ok',
        grade: 74,
        footerRight: 'Distinction range',
        progress: 75,
        barVariant: 'green',
    },
    {
        code: 'CAB420',
        name: 'Machine Learning',
        badge: 'At risk',
        badgeVariant: 'risk',
        grade: 48,
        footerRight: 'Need 58%+ to pass',
        progress: 48,
        barVariant: 'red',
    },
    {
        code: 'SCB300',
        name: 'WIL Placement',
        badge: 'On track',
        badgeVariant: 'ok',
        grade: 90,
        footerRight: 'Looking good',
        progress: 90,
        barVariant: 'green',
    },
];

export default function Overview() {

    const {activeCourses, setActiveCourses} = useGlobal();

    useEffect(() => {

        async function loadCourses() {
            try {
                const courses = await getActiveCourses();
                console.log(courses);
                setActiveCourses(courses);
            }
            catch (err) {
                if (!cancelled) {
                    console.error(err);
                }
            }
        }

        loadCourses();

    }, []);


    return (
        
        <>
            <div className="canvAssist-stats">
                <div className="canvAssist-stat">
                    <span className="canvAssist-stat-value canvAssist-stat-value--red">3</span>
                    <span className="canvAssist-stat-label">Due this week</span>
                </div>
                <div className="canvAssist-stat">
                    <span className="canvAssist-stat-value canvAssist-stat-value--amber">2</span>
                    <span className="canvAssist-stat-label">Days to urgent</span>
                </div>
                <div className="canvAssist-stat">
                    <span className="canvAssist-stat-value canvAssist-stat-value--white">4</span>
                    <span className="canvAssist-stat-label">Active units</span>
                </div>
            </div>

            <p className="canvAssist-section-label">YOUR UNITS</p>
            <ul className="canvAssist-units">
            {activeCourses.map((course) => (
                <UnitCard
                key={course.id}
                code={course.code}
                friendlyName={course.friendlyName}
                unitId={course.id}
                />
            ))}
            </ul>
        </>
          
    );
}