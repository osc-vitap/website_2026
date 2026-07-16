# OSC VIT-AP Website (2026 Edition)

Welcome to the official repository for the Open Source Community (OSC) VIT-AP website. This project is built with React, Vite, Tailwind CSS, Framer Motion, and Lucide React to deliver a premium, lightweight, and blazing-fast experience.

---

## 🚀 Quick Start (Development)

To get this project up and running on your local machine:

1. **Install Dependencies**
   Ensure you have Node.js and npm installed. Run the following command in the project root:
   ```bash
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   This will start the local Vite server. Open `http://localhost:5173` to view it in the browser.

3. **Build for Production**
   ```bash
   npm run build
   ```

---

## 🛠️ Content Management Guide

The entire website is data-driven, which means you do not need to touch the React components to update content. Everything is centralized in the `src/data/` directory.

### 1. Updating the Top Announcement Banner
The top banner (announcing upcoming events/registrations) can be controlled via `src/data/config.ts`.
- Open `src/data/config.ts`.
- Inside `config.topBanner`, change `visible` to `true` or `false` to toggle the banner.
- Update `text`, `ctaText`, and `ctaLink` as needed.

### 2. Managing Events
Events are populated dynamically on the Home and Events pages.
- Open `src/data/eventsData.ts`.
- To add a new event, simply append a new object to the `eventsData` array.
- **Note:** Set `isUpcoming: true` for future events (these get a "Register Now" button), and `isUpcoming: false` for past events.

### 3. Adding Projects
To add new open-source projects built by the community:
- Open `src/data/projectsData.ts`.
- Append a new object following the `Project` interface. You can specify the `techStack`, `repoUrl`, `liveUrl` (optional), and avatar URLs of contributors.

### 4. Updating Team Members (2026 Roster)
The team is categorized into "Core Leadership", "Technical Leads", and "Executive Members".
- Open `src/data/teamData.ts`.
- Append a new object following the `TeamMember` interface.
- Ensure the `tier` strictly matches one of the three predefined categories so it renders correctly on the Team page.

---

## 🖼️ Handling Images & Static Assets

For future iterations, when replacing the placeholder image URLs with actual assets:

1. **Where to place images:** 
   Place all your static image assets inside the `/public` directory (e.g., `/public/team/`, `/public/events/`).
   
2. **How to reference them:** 
   When adding the path in the `src/data/` files, use an absolute path from the root. 
   - Example: If you place an image at `/public/team/alex.jpg`, use `"/team/alex.jpg"` as the value for the `image` property in the data file.

---

*Designed and Developed by OSC VIT-AP.*
