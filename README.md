# CanvAssist

Chrome extension designed to assist QUT students with their studies by integrating AI-powered tools directly into Canvas LMS. The extension reads real student data from Canvas, assignments, rubrics, grades, and weekly materials, and uses AI to decode what markers actually want, summarise weekly content, and help students plan their study effectively.

## Getting Started

1. Clone this repository to your local machine.
2. Run `npm install`
3. Create a `.env` file in the project root and add your OpenAI key: `VITE_OPENAI_API_KEY=your-key-here`
4. Run `npm run dev`
5. Open Chrome and go to `chrome://extensions/`
6. Enable **Developer mode** in the top right corner
7. Click **Load unpacked** and select the `dist/` folder
8. Open Canvas at `canvas.qut.edu.au` and make sure you are logged in
9. Click the CanvAssist icon in the Chrome toolbar to open the side panel
10. Click **↻** to sync your Canvas data and enjoy!

## Features

### 1. AI Rubric Decoder

Automatically decodes Canvas rubric criteria into plain language bullet points explaining exactly what markers are looking for, what separates a Distinction from a Pass, and the easiest ways to lose marks.

### 2. Study Dashboard

Displays all active units in one place with current grades, urgency indicators, and upcoming assessment counts — giving students a clear picture of where to focus their effort.

### 3. Assessment Tracker

Lists all assessments per unit sorted by due date, with urgency bars, submission status, and days remaining. Assessments with decoded rubrics are clearly flagged.

### 4. Weekly Materials Checklist

Shows all weekly Canvas modules with AI-generated summaries of what each week covers. Students can tick off weeks as they complete them, with a progress bar tracking coverage.

### 5. Grade What-If Calculator

Interactive slider on each assessment that lets students calculate their projected overall grade based on a hypothetical score — showing whether they are on track to pass or at risk.

### 6. Zero-Setup Authentication

CanvAssist piggybacks on the student's existing Canvas browser session — no API tokens, no OAuth, no login screen. Works the moment the extension is installed.

### 7. AI Study Assistant (Chatbot)

A built-in study assistant that answers questions based on the student's real Canvas data. Unlike a generic AI chatbot, CanvAssist's assistant already knows the student's current grades, upcoming deadlines, and decoded rubric criteria — so answers are personalised to their actual situation. Students can ask things like "what do I need to focus on for my CAB302 milestone?" and receive specific, actionable advice rather than generic study tips.
