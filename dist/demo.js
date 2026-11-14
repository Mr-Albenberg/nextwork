const DEMO_PROFILE={name:'Jordan Rivera',email:'jordan.rivera@example.com',education:'Northbridge University (fictional)',degree:'BS Computer Science',graduation:'2026',location:'Portland · Pacific Time',field:'Development',role:'Frontend developer',skills:'React, TypeScript, JavaScript, SQL, Git, Jest, Accessibility, Figma',availability:'20–30 hours',engagement:'Both projects and full-time',workstyle:'Remote',portfolio:'https://example.com/jordan-demo',bio:'Recent computer science graduate who enjoys turning complex workflows into accessible, useful interfaces. I have built community-focused web projects, worked in small student teams, and am looking for a paid project where I can own a clear deliverable and learn from thoughtful feedback.'};
const DEMO_RESUME=`Jordan Rivera
jordan.rivera@example.com | Portland, Oregon | Portfolio: https://example.com/jordan-demo
FICTIONAL DEMO RESUME — all people, institutions, achievements, and results below are illustrative.

SUMMARY
Computer science graduate focused on accessible frontend development. Experience building React dashboards and responsive booking flows, testing reusable components, and communicating technical decisions within small project teams. Seeking paid startup projects with clear deliverables and collaborative code review.

EDUCATION
Northbridge University (fictional) — BS Computer Science, May 2026
Relevant coursework: Software Engineering, Human-Computer Interaction, Databases, Statistics, Web Accessibility.

TECHNICAL SKILLS
React, TypeScript, JavaScript, HTML, CSS, Node.js, REST API integration, SQL, Python, Git, GitHub pull requests, Jest unit tests, Figma, responsive components, WCAG accessibility, data visualization.

PROJECTS
Community Space Booking Platform — Student team project | Jan–Apr 2026
- Built a responsive React and TypeScript reservation flow with accessible forms, keyboard navigation, clear validation, and reusable components.
- Collaborated with a team of four using Git pull requests, issue tracking, and weekly feedback sessions.
- Added 28 Jest unit tests for booking validation and component states; documented installation and component usage for handoff.
- Conducted a small usability study with eight consenting student volunteers; revised the onboarding flow after identifying confusing availability messages.

Campus Volunteer Dashboard — Academic capstone | Sep–Dec 2025
- Developed a React dashboard with data visualization and charts to coordinate 40 student volunteers across six events.
- Used SQL queries to summarize attendance and created a reproducible Python notebook to validate and clean duplicate records.
- Presented findings and implementation tradeoffs to a campus advisory group; wrote a short technical handoff for future student maintainers.
- Applied accessibility checks and responsive CSS so the dashboard worked with keyboard navigation and small screens.

EXPERIENCE
Student Web Team — Volunteer developer | Sep 2024–May 2026
- Maintained a student resource directory with HTML, CSS, and JavaScript; collaborated with organizers to prioritize useful changes.
- Worked with a student designer in Figma to improve search filters and document consistent interface states.
- Helped test REST API integration in a sandbox and documented error states for the next contributor.

ADDITIONAL EXPERIENCE
Peer study-group facilitator — organized weekly sessions on Git, testing, and introductory SQL.
Interested in climate tools, community services, and software that reduces everyday administrative work.
`;
function writeDemo(){localStorage.removeItem('proof-demo-dismissed');localStorage.setItem('proof-profile',JSON.stringify(DEMO_PROFILE));for(const k of ['name','education','portfolio','bio'])localStorage.setItem('lp-'+k,DEMO_PROFILE[k]);localStorage.setItem('lp-saved',JSON.stringify([2,7,11]));localStorage.setItem('lp-apps','[]');localStorage.setItem('proof-applications','[]');sessionStorage.setItem('proof-resume',DEMO_RESUME);sessionStorage.setItem('proof-demo-active','true')}
function initializeDemoProfile(){if(localStorage.getItem('proof-demo-dismissed')==='true')return;if(!localStorage.getItem('proof-profile')&&!localStorage.getItem('lp-name')&&!sessionStorage.getItem('proof-resume'))writeDemo();else if((sessionStorage.getItem('proof-demo-active')==='true'||localStorage.getItem('proof-profile')?.includes('jordan.rivera@example.com'))&&!sessionStorage.getItem('proof-resume'))sessionStorage.setItem('proof-resume',DEMO_RESUME)}
function loadDemoProfile(){if(sessionStorage.getItem('proof-demo-active')!=='true'){const local={};for(const k of ['proof-profile','lp-name','lp-education','lp-portfolio','lp-bio','lp-saved','lp-apps','proof-applications'])local[k]=localStorage.getItem(k);sessionStorage.setItem('proof-demo-backup',JSON.stringify({local,resume:sessionStorage.getItem('proof-resume')}))}writeDemo();saved=[2,7,11];applications=[];sort='match';resumeReport=null;profileStep=0;render();toast('Fictional demo profile and resume loaded')}
function restoreDemoProfile(){const raw=sessionStorage.getItem('proof-demo-backup');if(raw){const b=JSON.parse(raw);for(const[k,v]of Object.entries(b.local))v===null?localStorage.removeItem(k):localStorage.setItem(k,v);b.resume===null?sessionStorage.removeItem('proof-resume'):sessionStorage.setItem('proof-resume',b.resume);sessionStorage.removeItem('proof-demo-backup')}else{for(const k of ['proof-profile','lp-name','lp-education','lp-portfolio','lp-bio','lp-saved','lp-apps','proof-applications'])localStorage.removeItem(k);sessionStorage.removeItem('proof-resume')}sessionStorage.removeItem('proof-demo-active');localStorage.setItem('proof-demo-dismissed','true');saved=JSON.parse(localStorage.getItem('lp-saved')||'[]');applications=JSON.parse(localStorage.getItem('lp-apps')||'[]');resumeReport=null;render();toast('Demo closed; your previous profile restored')}
function demoBanner(){return `<div class="demo-toolbar"><span>${sessionStorage.getItem('proof-demo-active')==='true'?'Fictional demo · Jordan Rivera · resume loaded':'Explore with a complete sample graduate profile'}</span><div><button onclick="loadDemoProfile()">${sessionStorage.getItem('proof-demo-active')==='true'?'Reset demo':'Load demo profile'}</button>${sessionStorage.getItem('proof-demo-active')==='true'?'<button onclick="restoreDemoProfile()">Exit demo</button>':''}</div></div>`}
