let homeMotionPaused = false;
function homepageScene() {
  const j = jobs.find((j) => j.id === 7) || jobs[0];
  return `<div class="home-career-scene" role="group" aria-label="From your resume to meaningful project work and a stronger portfolio"><div class="scene-grid" aria-hidden="true"></div><div class="scene-orbit orbit-one" aria-hidden="true"></div><div class="scene-orbit orbit-two" aria-hidden="true"></div><svg class="scene-connections" viewBox="0 0 600 600" fill="none" aria-hidden="true"><path class="scene-path-base" d="M160 145C400 145 140 300 370 300S390 480 205 480"/><path class="scene-path-moving" d="M160 145C400 145 140 300 370 300S390 480 205 480"/><circle cx="290" cy="257" r="8"/><circle cx="373" cy="411" r="6"/></svg><div class="scene-caption"><span><i></i> THE NEXTWORK EFFECT</span><button class="motion-toggle" aria-label="${homeMotionPaused ? "Play" : "Pause"} homepage animations" aria-pressed="${homeMotionPaused}" onclick="toggleHomeMotion()">${icon(homeMotionPaused ? "play" : "pause", 15)} ${homeMotionPaused ? "Play" : "Pause"}</button><small class="reduced-motion-note">Reduced motion</small></div><div class="scene-resume scene-float"><span class="scene-step">01 / YOUR STARTING POINT</span><div class="scene-resume-title"><span>${icon("resume", 23)}</span><div><b>Your experience</b><small>More potential than you think.</small></div></div><div class="scene-paper-lines" aria-hidden="true"><i></i><i></i><i></i></div><div class="scene-tags"><span>Projects</span><span>Skills</span><span>Education</span></div></div><a class="scene-opportunity scene-float" href="#project/${j.id}"><span class="scene-step">02 / YOUR NEXT OPPORTUNITY</span><div class="scene-company">${logo(j)}<span><b>${esc(j.c)}</b><small>${esc(j.cat)} · ${esc(j.location || "Remote")}</small></span>${icon("arrow", 19)}</div><h3>${esc(j.title)}</h3><div class="scene-opportunity-bottom"><b>$${j.pay.toLocaleString()}</b><span>${esc(j.weeks)}<small>Clear scope. Real deliverables.</small></span></div></a><div class="scene-portfolio scene-float"><div class="scene-portfolio-icon">${icon("briefcase", 22)}</div><div><span class="scene-step">03 / SOMETHING TO SHOW</span><b>Your work speaks for you.</b><p>A finished project. A stronger story.</p></div><span class="scene-complete-mark">${icon("check", 17)}</span></div><div class="scene-brand-hub" aria-hidden="true"><img src="assets/brand/nextwork-icon.png" alt=""><span></span></div><span class="scene-footnote">Your next chapter starts with one connection.</span></div>`;
}
function toggleHomeMotion() {
  homeMotionPaused = !homeMotionPaused;
  const root = document.querySelector(".home-redesign");
  if (!root) return;
  root.dataset.motion = homeMotionPaused ? "paused" : "playing";
  const button = root.querySelector(".motion-toggle");
  if (button) {
    button.setAttribute(
      "aria-label",
      (homeMotionPaused ? "Play" : "Pause") + " homepage animations",
    );
    button.setAttribute("aria-pressed", String(homeMotionPaused));
    button.innerHTML =
      icon(homeMotionPaused ? "play" : "pause", 15) +
      " " +
      (homeMotionPaused ? "Play" : "Pause");
  }
}
let annualPricing = false;
function planFeatures(features) {
  return `<ul class="plan-features">${features.map((t) => `<li>${icon("check", 16)}<span>${t}</span></li>`).join("")}</ul>`;
}
function homepage() {
  const signed = typeof Account !== "undefined" && Boolean(Account.user),
    start = signed ? "overview" : "signup",
    featured = jobs.filter((j) => j.demoCreator).slice(0, 3);
  return `<div id="landing" class="home-redesign" data-motion="${homeMotionPaused ? "paused" : "playing"}"><div class="home-nav"><a class="landing-brand" href="#home"><img src="assets/brand/nextwork-icon.png" alt="">nextwork</a><nav><a href="#explore">Find work</a><a href="#organization">For organizations</a><a href="#pricing">Free membership</a></nav><div>${signed ? `<a class="primary" href="#overview">Open workspace ${icon("arrow", 16)}</a>` : `<a class="home-login" href="#login">Log in</a><a class="primary" href="#signup">Join Nextwork ${icon("arrow", 16)}</a>`}</div></div><section class="home-hero"><div class="home-hero-copy"><span class="hero-eyebrow"><span></span> YOUR NEXT CHAPTER STARTS HERE</span><h1>Real work.<br>Real experience.<br><em>Your next move.</em></h1><div class="hero-heading-accent" aria-hidden="true"><svg viewBox="0 0 330 20" fill="none"><path d="M4 13C85 2 240 1 325 11M40 17c73-7 169-7 243-3"/></svg></div><p>Connect with startups and small teams. Take on meaningful projects and build experience that opens doors.</p><div class="home-hero-actions"><a class="primary" href="#${start}">${signed ? "Open your workspace" : "Find your first opportunity"} ${icon("arrow", 18)}</a><a class="home-hero-secondary" href="#organization">Looking to hire? ${icon("arrow", 16)}</a></div><small>Free to join. Free to apply. No card required.</small></div>${homepageScene()}</section><div class="home-value-strip"><span>${icon("briefcase", 20)} Paid, scoped opportunities</span><span>${icon("resume", 20)} Resume matching that makes sense</span><span>${icon("message", 20)} Direct conversations</span><span>${icon("spark", 20)} Room to build and grow</span></div><section class="home-section" id="how-it-works"><div class="home-section-heading"><div><span class="section-label">FROM POTENTIAL TO PROOF</span><h2>Your first step shouldn’t<br>be the hardest one.</h2></div><p>A simple way to find work, show what you can do, and move your career forward.</p></div><div class="home-how-grid">${[
    [
      "01",
      "user",
      "Show what you bring",
      "Create a profile and add your resume. Help teams understand your experience.",
    ],
    [
      "02",
      "briefcase",
      "Find the right work",
      "Explore opportunities with clear expectations and see how your resume fits.",
    ],
    [
      "03",
      "arrow",
      "Make your contribution",
      "Meet the team, take on a project, and build something you can talk about.",
    ],
  ]
    .map(
      ([n, i, t, d]) =>
        `<article><div class="home-step-graphic" data-step="${n}" aria-hidden="true"><span>${n}</span><div class="home-step-mini">${icon(i, 28)}<i></i><i></i><i></i></div></div><h3>${t}</h3><p>${d}</p></article>`,
    )
    .join(
      "",
    )}</div></section><section class="home-section home-featured"><div class="home-section-heading"><div><span class="section-label">SMALL TEAMS. REAL POSSIBILITIES.</span><h2>Good work starts<br>with a good opportunity.</h2></div><a class="outline" href="#explore">Explore opportunities ${icon("arrow", 16)}</a></div><div class="home-featured-grid">${featured
    .map(
      (j) =>
        `<a class="home-featured-job" href="#project/${j.id}"><div>${logo(j)}<span>${esc(j.c)}<small>${esc(j.sector)}</small></span></div><h3>${esc(j.title)}</h3><p>${esc(j.desc)}</p><div class="tags">${j.tags
          .slice(0, 2)
          .map((t) => `<span class="tag">${esc(t)}</span>`)
          .join(
            "",
          )}</div><footer><b>$${j.pay.toLocaleString()}</b><span>${esc(j.weeks)} ${icon("arrow", 16)}</span></footer></a>`,
    )
    .join(
      "",
    )}</div></section><section class="home-membership" id="pricing"><div><span class="hero-eyebrow">ONE PLAN. MORE POSSIBILITY.</span><h2>Everything you need.<br>One free membership.</h2><p>Finding your next step should be about your potential, not your subscription.</p><a class="primary" href="#${start}">${signed ? "Open workspace" : "Create your free account"} ${icon("arrow", 17)}</a></div><ul>${["Browse and apply to projects", "Match your resume to a role", "Get practical project ideas", "Connect with people and teams"].map((x) => `<li>${icon("check", 18)} ${x}</li>`).join("")}<li class="home-membership-price"><strong>$0</strong><span>Free for everyone.<br>No hidden upgrade.</span></li></ul></section><section class="home-section home-faq"><div><span class="section-label">A FEW THINGS TO KNOW</span><h2>Before you make<br>your next move.</h2></div><div>${[
    [
      "Is Nextwork free?",
      "Yes. Every tool is included in one free plan. No payment card is required.",
    ],
    [
      "What kind of opportunities can I find?",
      "Projects, contracts, and roles at startups and small teams. Check each listing for scope, compensation, and requirements.",
    ],
    [
      "Will a project lead to a full-time job?",
      "It can start a working relationship, but future employment depends on the team and a separate hiring decision.",
    ],
    [
      "How does resume matching work?",
      "We compare resume evidence with the listing’s criteria and field foundations. Missing evidence is a chance to improve your resume, not proof that you lack a skill.",
    ],
  ]
    .map(
      ([q, a]) =>
        `<details><summary>${q}<span>+</span></summary><p>${a}</p></details>`,
    )
    .join(
      "",
    )}</div></section><section class="home-final"><span class="section-label">YOUR NEXT CHAPTER</span><h2>Start with what you can do.<br>Discover what comes next.</h2><a class="primary" href="#${start}">${signed ? "Open workspace" : "Get started free"} ${icon("arrow", 17)}</a></section><div class="home-footer"><a class="landing-brand" href="#home"><img src="assets/brand/nextwork-icon.png" alt="">nextwork</a><span>Meaningful work. A stronger next step.</span><a href="#organization">For organizations</a></div></div>`;
}

function scrollLanding(id) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function setPricing(annual) {
  annualPricing = annual;
  render();
  scrollLanding("pricing");
}
