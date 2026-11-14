(function (root) {
  // Curated role families used when live job-posting data is unavailable and as the
  // vocabulary for live analysis. Skill tiers (core / common / emerging) are an authored
  // BASELINE ESTIMATE, not measured market data. Live percentages come from real postings
  // fetched by lib/market.js and are labeled as such in the interface.
  const families = [
    {
      id: "frontend",
      label: "Frontend / web development",
      field: "Development",
      strong: ["frontend", "front end", "front-end", "web developer", "web engineer", "ui engineer", "react developer", "javascript developer", "web dev"],
      weak: ["developer", "engineer"],
      titles: "front[- ]?end|ui engineer|web (developer|engineer)|react|javascript",
      query: "frontend developer",
      skills: [["JavaScript", "core"], ["React", "core"], ["TypeScript", "core"], ["HTML", "core"], ["CSS", "core"], ["Git", "common"], ["Testing", "common"], ["Accessibility", "common"], ["REST API", "common"], ["Next.js", "common"], ["GraphQL", "emerging"], ["CI/CD", "emerging"]],
      templates: [
        { title: "Accessible job-application tracker", pitch: "A responsive web app where job seekers track applications, deadlines, and follow-ups, built keyboard-first and checked against WCAG.", build: ["Typed React components on a small design-token layer", "Keyboard and screen-reader support, audited with axe", "Unit tests for the filtering and reminder logic", "A CI pipeline that tests and deploys on every push"], deliverables: ["Deployed app with a public repository", "Short accessibility audit write-up", "Test coverage report"], skills: ["React", "TypeScript", "Accessibility", "Testing", "CI/CD", "CSS", "HTML"], hours: 40 },
        { title: "Live data dashboard on a public API", pitch: "A dashboard that pulls from a public API (transit, weather, or GitHub), caches responses, and stays fast on slow connections.", build: ["Fetch layer with caching and error states", "Interactive charts and filters", "Responsive layout for phone and desktop", "Deploy with environment-based configuration"], deliverables: ["Live demo link", "README with architecture notes", "Lighthouse performance report"], skills: ["JavaScript", "REST API", "React", "Next.js", "Git", "CSS"], hours: 35 },
        { title: "Reusable component library with docs", pitch: "A small, typed component library with accessible primitives, tests, and a documentation site other developers could adopt.", build: ["Button, input, dialog, and menu components", "Keyboard and focus management", "Component tests and visual states", "Published docs site"], deliverables: ["Package-ready repository", "Documentation site", "Accessibility notes per component"], skills: ["TypeScript", "React", "CSS", "Testing", "Accessibility", "Git"], hours: 45 },
        { title: "Content site backed by a GraphQL API", pitch: "A fast content site that reads from a GraphQL backend and demonstrates server rendering and caching decisions.", build: ["GraphQL schema and queries", "Server-rendered pages with caching", "Semantic, accessible markup", "Typed data layer"], deliverables: ["Deployed site", "Schema documentation", "Write-up on rendering trade-offs"], skills: ["Next.js", "GraphQL", "TypeScript", "HTML", "CSS", "REST API"], hours: 40 }
      ]
    },
    {
      id: "fullstack",
      label: "Software engineering (backend / full stack)",
      field: "Development",
      strong: ["full stack", "fullstack", "full-stack", "backend", "back end", "back-end", "api developer", "platform engineer"],
      weak: ["software engineer", "software developer", "swe", "programmer", "developer", "engineer"],
      titles: "software (engineer|developer)|back[- ]?end|full[- ]?stack|platform engineer|api",
      query: "software engineer",
      skills: [["Python", "core"], ["JavaScript", "core"], ["SQL", "core"], ["Git", "core"], ["REST API", "core"], ["Node.js", "common"], ["PostgreSQL", "common"], ["Docker", "common"], ["AWS", "common"], ["Testing", "common"], ["TypeScript", "common"], ["CI/CD", "emerging"]],
      templates: [
        { title: "Campus marketplace API and web client", pitch: "A small marketplace service with accounts, listings, and search, built like a production service rather than a tutorial.", build: ["Relational schema and migrations", "REST endpoints with validation and auth", "Integration tests against a test database", "Dockerized local setup"], deliverables: ["Public repository with setup instructions", "API documentation", "Test report"], skills: ["Node.js", "PostgreSQL", "REST API", "Docker", "Git", "Testing", "SQL", "JavaScript"], hours: 50 },
        { title: "Event-driven notification service on the cloud", pitch: "A service that queues events and sends notifications reliably, deployed with automated checks.", build: ["Queue-backed worker with retries", "Idempotent processing and logging", "Container image and deployment script", "Automated test and deploy pipeline"], deliverables: ["Deployed service", "Architecture diagram", "Short reliability write-up"], skills: ["Python", "AWS", "Docker", "CI/CD", "Testing", "REST API"], hours: 45 },
        { title: "URL shortener with click analytics", pitch: "A compact service that stores links, redirects quickly, and reports analytics, with attention to data modeling and tests.", build: ["Typed API and database schema", "Redirect path optimized with indexing", "Analytics queries in SQL", "Unit and integration tests"], deliverables: ["Deployed service", "Schema and query documentation", "Test suite"], skills: ["TypeScript", "SQL", "PostgreSQL", "REST API", "Git", "Testing"], hours: 30 },
        { title: "Containerized service with monitoring", pitch: "Take a small service from laptop to cloud: containerize it, deploy it, and add health checks and basic monitoring.", build: ["Dockerfile and compose setup", "Cloud deployment with a pipeline", "Health checks, logs, and alerts", "Load test and a short results summary"], deliverables: ["Live service", "Pipeline configuration", "Runbook"], skills: ["Docker", "AWS", "CI/CD", "Node.js", "Git", "Testing"], hours: 40 }
      ]
    },
    {
      id: "mlai",
      label: "Machine learning / AI",
      field: "Data & Analytics",
      strong: ["machine learning", "ml engineer", "ai engineer", "data scientist", "deep learning", "computer vision", "nlp", "llm", "artificial intelligence", "research engineer", "applied scientist", "ai developer"],
      weak: [],
      titles: "machine learning|ml engineer|ai engineer|data scientist|applied scientist|research (engineer|scientist)|computer vision|nlp",
      query: "machine learning engineer",
      skills: [["Python", "core"], ["Machine Learning", "core"], ["PyTorch", "core"], ["SQL", "common"], ["TensorFlow", "common"], ["Data Analysis", "common"], ["Computer Vision", "common"], ["Statistics", "common"], ["Docker", "common"], ["AWS", "common"], ["Git", "common"], ["LLMs", "emerging"], ["MLOps", "emerging"]],
      templates: [
        { title: "Image classifier with a reproducible pipeline", pitch: "Fine-tune a vision model on a public dataset and document the pipeline so someone else can reproduce your numbers.", build: ["Data loading and augmentation", "Fine-tuning with tracked experiments", "Error analysis on misclassified examples", "Containerized training and evaluation"], deliverables: ["Repository with a one-command run", "Evaluation report with failure cases", "Model card"], skills: ["Python", "PyTorch", "Machine Learning", "Computer Vision", "Git", "Docker"], hours: 45 },
        { title: "Document Q&A with an evaluation harness", pitch: "A question-answering app over a document set, with a small test suite that measures answer quality instead of guessing.", build: ["Document chunking and retrieval", "Prompted generation with citations", "Hand-labeled evaluation set and scoring script", "Simple web or CLI interface"], deliverables: ["Working demo", "Evaluation results and discussion", "Public repository"], skills: ["Python", "LLMs", "Machine Learning", "Git", "Data Analysis"], hours: 40 },
        { title: "Predictive model with honest evaluation", pitch: "Build a predictive model on public data and report how it performs on data it has not seen, including where it fails.", build: ["Exploratory analysis and cleaning", "Baseline and improved models", "Cross-validation and error breakdown", "Written limitations section"], deliverables: ["Notebook or report", "Reproducible repository", "One-page summary for non-experts"], skills: ["Python", "SQL", "Statistics", "Machine Learning", "Data Analysis", "TensorFlow"], hours: 35 },
        { title: "Model serving API with monitoring", pitch: "Wrap a trained model in an API, containerize it, deploy it, and track its latency and input drift.", build: ["Inference API with input validation", "Container image and cloud deployment", "Latency and drift dashboard", "Load test results"], deliverables: ["Deployed endpoint", "Monitoring screenshots", "Operations notes"], skills: ["Python", "Docker", "AWS", "MLOps", "Git", "Machine Learning"], hours: 40 }
      ]
    },
    {
      id: "data",
      label: "Data analytics and engineering",
      field: "Data & Analytics",
      strong: ["data analyst", "data analytics", "business intelligence", "bi analyst", "analytics engineer", "data engineer", "bi developer", "reporting analyst", "insights analyst"],
      weak: ["analyst"],
      titles: "data (analyst|engineer)|analytics engineer|business intelligence|bi (analyst|developer)|insights analyst",
      query: "data analyst",
      skills: [["SQL", "core"], ["Python", "core"], ["Data Analysis", "core"], ["Data Visualization", "core"], ["Excel", "common"], ["Tableau", "common"], ["Power BI", "common"], ["Statistics", "common"], ["A/B Testing", "common"], ["dbt", "emerging"], ["Airflow", "emerging"], ["Looker", "emerging"]],
      templates: [
        { title: "Public-dataset analysis with a published dashboard", pitch: "Pick a real public dataset, ask a sharp question, and publish both the analysis and a dashboard a stakeholder could use.", build: ["Cleaning steps documented in code", "SQL and Python analysis answering one clear question", "Interactive dashboard", "A findings summary written for non-technical readers"], deliverables: ["Public repository", "Live dashboard link", "One-page findings memo"], skills: ["SQL", "Python", "Data Analysis", "Data Visualization", "Tableau"], hours: 30 },
        { title: "Analytics pipeline with scheduled refresh", pitch: "Build a small pipeline that ingests data, transforms it with tested models, and refreshes on a schedule.", build: ["Ingestion script and raw tables", "Transformations with data tests", "Scheduled runs", "A simple reporting layer"], deliverables: ["Repository with run instructions", "Data model diagram", "Data quality test results"], skills: ["SQL", "dbt", "Airflow", "Python", "Data Analysis"], hours: 40 },
        { title: "A/B test design and analysis case study", pitch: "Design an experiment, simulate or collect results, and analyze them with proper statistics and clear caveats.", build: ["Hypothesis, metric, and sample-size plan", "Analysis script with confidence intervals", "Sensitivity and limitations discussion", "Recommendation memo"], deliverables: ["Reproducible notebook", "Decision memo", "Public repository"], skills: ["A/B Testing", "Statistics", "Python", "SQL", "Data Analysis"], hours: 25 },
        { title: "Executive KPI report in Power BI", pitch: "Turn a messy spreadsheet into a trustworthy KPI report with documented definitions and clean visuals.", build: ["Data cleaning and model in Excel or Power Query", "KPI definitions written down", "Report with filters and drill-through", "Short walkthrough video or notes"], deliverables: ["Report file or published link", "KPI definitions sheet", "Walkthrough"], skills: ["Excel", "Power BI", "Data Visualization", "Statistics", "Looker"], hours: 25 }
      ]
    },
    {
      id: "design",
      label: "Product and UX design",
      field: "Design",
      strong: ["product designer", "ux designer", "ui designer", "ui/ux", "ux/ui", "user experience", "interaction design", "visual designer", "ux researcher", "ux", "design systems"],
      weak: ["designer", "design"],
      titles: "designer|ux|ui/ux|user experience|design systems|interaction design",
      query: "product designer",
      skills: [["Figma", "core"], ["User Research", "core"], ["Prototyping", "core"], ["Design Systems", "common"], ["Accessibility", "common"], ["Usability Testing", "common"], ["Interaction Design", "common"], ["Wireframing", "common"], ["Visual Design", "common"]],
      templates: [
        { title: "Onboarding redesign backed by research", pitch: "Pick a real app with a rough first-run experience, interview users, and redesign the flow with evidence.", build: ["Five or more user interviews with a synthesis", "Wireframes and a clickable prototype", "Usability test on the new flow", "Before/after comparison"], deliverables: ["Case study", "Figma prototype", "Research notes"], skills: ["User Research", "Usability Testing", "Figma", "Prototyping", "Wireframing"], hours: 35 },
        { title: "Mini design system with accessibility specs", pitch: "A small, documented design system: tokens, components, and accessibility guidance a developer could implement.", build: ["Color, type, and spacing tokens", "Core components with states", "Contrast and focus specifications", "Usage documentation"], deliverables: ["Figma library", "Documentation page", "Accessibility checklist"], skills: ["Design Systems", "Figma", "Accessibility", "Visual Design"], hours: 40 },
        { title: "App concept from research to tested prototype", pitch: "Take one idea end to end: discover the problem, design the interaction, and test it with real people.", build: ["Problem framing from interviews", "User flows and interaction patterns", "High-fidelity prototype", "Usability findings and revisions"], deliverables: ["Case study", "Prototype link", "Test summary"], skills: ["Interaction Design", "Prototyping", "Figma", "User Research", "Usability Testing"], hours: 45 },
        { title: "Accessibility audit for a local nonprofit site", pitch: "Audit a real site for accessibility barriers and deliver a prioritized fix list with design recommendations.", build: ["Manual and tool-based audit", "Prioritized issue list with screenshots", "Redesigned key screens", "Handoff notes for the site owner"], deliverables: ["Audit report", "Redesign mockups", "Fix-list with priorities"], skills: ["Accessibility", "Usability Testing", "Visual Design", "Wireframing", "User Research"], hours: 25 }
      ]
    },
    {
      id: "marketing",
      label: "Marketing and growth",
      field: "Marketing",
      strong: ["marketing", "growth", "seo", "social media", "brand", "copywriter", "community manager", "demand generation", "content strategist", "content marketing"],
      weak: ["content"],
      titles: "marketing|growth|seo|social media|brand|copywriter|community manager|content",
      query: "marketing associate",
      skills: [["SEO", "core"], ["Analytics", "core"], ["Content Strategy", "core"], ["Social Media", "core"], ["Copywriting", "common"], ["Email Marketing", "common"], ["Google Analytics", "common"], ["A/B Testing", "common"], ["HubSpot", "common"], ["Paid Advertising", "common"], ["Marketing Automation", "emerging"]],
      templates: [
        { title: "Content and SEO growth experiment", pitch: "Pick a real small site, run a four-to-eight week content and SEO experiment, and report what moved.", build: ["Keyword research and a content plan", "Publish and optimize several pieces", "Track traffic and engagement", "Results write-up with lessons"], deliverables: ["Experiment report with real metrics", "Published content samples", "Next-steps plan"], skills: ["SEO", "Content Strategy", "Analytics", "Google Analytics", "Copywriting"], hours: 35 },
        { title: "Four-week social campaign with measured results", pitch: "Plan and run a short campaign for a real local business or creator, with clear goals and honest reporting.", build: ["Audience and goal definition", "Content calendar and assets", "Weekly measurement and adjustments", "Final results report"], deliverables: ["Campaign plan", "Asset samples", "Results report"], skills: ["Social Media", "Analytics", "Content Strategy", "Copywriting", "A/B Testing"], hours: 30 },
        { title: "Lifecycle email sequence with A/B tests", pitch: "Design and test an onboarding or win-back email sequence and report which variants performed better.", build: ["Sequence map and segmentation", "Copy for each email", "A/B tests on subject lines or offers", "Analysis of opens, clicks, and conversions"], deliverables: ["Sequence documentation", "Test results", "Recommendations"], skills: ["Email Marketing", "A/B Testing", "Marketing Automation", "HubSpot", "Copywriting"], hours: 30 },
        { title: "Small-budget paid acquisition test", pitch: "Run a small, real or sandboxed paid test, document the setup, and report cost and conversion honestly.", build: ["Audience and creative variants", "Tracking and conversion setup", "Budget and bid decisions", "Cost-per-result analysis"], deliverables: ["Test plan", "Results report", "What-I-would-do-next memo"], skills: ["Paid Advertising", "Google Analytics", "Analytics", "A/B Testing"], hours: 30 }
      ]
    },
    {
      id: "product",
      label: "Product, strategy, and operations",
      field: "Business",
      strong: ["product manager", "product management", "business analyst", "strategy", "operations", "consulting", "chief of staff", "program manager", "project manager", "bizops", "associate product manager"],
      weak: ["analyst", "associate"],
      titles: "product manager|business analyst|strategy|operations|consultant|program manager|project manager|chief of staff",
      query: "product manager",
      skills: [["Product Management", "core"], ["Roadmapping", "core"], ["Stakeholder Management", "core"], ["Agile", "core"], ["User Research", "common"], ["SQL", "common"], ["Excel", "common"], ["Jira", "common"], ["Data Analysis", "common"], ["Strategy", "common"], ["A/B Testing", "emerging"]],
      templates: [
        { title: "Product teardown and prioritized roadmap", pitch: "Take a real app, diagnose its biggest problems with evidence, and propose a prioritized roadmap with trade-offs.", build: ["User feedback and usage-signal review", "Opportunity sizing with stated assumptions", "Prioritization framework applied transparently", "Roadmap and rationale memo"], deliverables: ["Written teardown", "Roadmap document", "Assumptions list"], skills: ["Product Management", "Roadmapping", "User Research", "Strategy", "Stakeholder Management"], hours: 25 },
        { title: "Customer discovery sprint", pitch: "Interview ten real people about a problem and turn what you hear into an opportunity brief.", build: ["Interview guide and recruiting", "Synthesis into themes", "Opportunity brief with evidence", "Recommendation presented to a mentor or peer"], deliverables: ["Interview synthesis", "Opportunity brief", "Presentation"], skills: ["User Research", "Strategy", "Stakeholder Management", "Data Analysis"], hours: 30 },
        { title: "Funnel and metrics model in SQL and Excel", pitch: "Model a product funnel from a public or synthetic dataset and recommend where to focus.", build: ["Event data cleaning", "Funnel and retention queries", "Scenario model in Excel", "Recommendation with caveats"], deliverables: ["Workbook and queries", "Findings memo", "Public repository or sheet"], skills: ["SQL", "Excel", "Data Analysis", "A/B Testing"], hours: 30 },
        { title: "Run a small project with agile rituals", pitch: "Lead a real mini-project with a few teammates using lightweight agile practices and document how it went.", build: ["Backlog and sprint plan", "Weekly check-ins and a retro", "Stakeholder updates", "Outcome report"], deliverables: ["Project board export", "Retro notes", "Outcome summary"], skills: ["Agile", "Jira", "Stakeholder Management", "Product Management", "Roadmapping"], hours: 30 }
      ]
    },
    {
      id: "embedded",
      label: "Embedded systems and robotics",
      field: "Development",
      strong: ["embedded", "robotics", "firmware", "hardware", "autonomy", "controls engineer", "drone", "uav", "mechatronics", "computer engineer", "electrical engineer", "autonomous"],
      weak: [],
      titles: "embedded|firmware|robotics|autonomy|controls|hardware|mechatronics|uav|drone",
      query: "embedded software engineer",
      skills: [["C/C++", "core"], ["Python", "core"], ["Linux", "core"], ["ROS", "common"], ["RTOS", "common"], ["Computer Vision", "common"], ["Sensor Integration", "common"], ["Control Systems", "common"], ["PCB Design", "common"], ["Simulation", "common"], ["Git", "common"], ["Docker", "emerging"]],
      templates: [
        { title: "Sensor-fusion rover with an autonomy stack", pitch: "A small rover that fuses sensors to navigate, with logging and tests you can show in a demo video.", build: ["Sensor drivers and a fused state estimate", "Basic control loop", "ROS nodes for perception and navigation", "Logged test runs with analysis"], deliverables: ["Demo video", "Repository with build notes", "Test-run analysis"], skills: ["C/C++", "ROS", "Linux", "Sensor Integration", "Control Systems", "Git"], hours: 60 },
        { title: "Real-time object detection on edge hardware", pitch: "Run an object detector on an edge device and measure the real trade-offs between accuracy, speed, and power.", build: ["Model selection and optimization", "Camera pipeline on the device", "Benchmarks for latency and accuracy", "Containerized setup"], deliverables: ["Demo video", "Benchmark table", "Repository"], skills: ["Python", "Computer Vision", "Linux", "Docker", "Git"], hours: 45 },
        { title: "RTOS firmware for a multi-sensor logger", pitch: "A firmware project with concurrent tasks, careful timing, and a small PCB or breadboard build.", build: ["Task design and scheduling", "Sensor drivers over standard buses", "Data logging with failure handling", "Schematic and test results"], deliverables: ["Firmware repository", "Schematic", "Timing and test notes"], skills: ["C/C++", "RTOS", "PCB Design", "Sensor Integration", "Git"], hours: 45 },
        { title: "Simulated robot navigation with reproducible tests", pitch: "Build a navigation system in simulation and write tests that make its behavior repeatable.", build: ["Simulated environment and robot model", "Planner and controller", "Scenario tests with pass/fail criteria", "Results summary"], deliverables: ["Repository with simulation setup", "Scenario test report", "Short write-up"], skills: ["ROS", "Simulation", "Python", "Linux", "Control Systems", "Git"], hours: 40 }
      ]
    }
  ];
  const api = { families, snapshotNote: "Authored baseline estimate, not measured market data.", MIN_LIVE_POSTINGS: 15 };
  if (typeof module !== "undefined") module.exports = api;
  else root.MarketData = api;
})(typeof window !== "undefined" ? window : globalThis);
