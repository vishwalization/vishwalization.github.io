// Sticky bar: show the name once the big heading has scrolled away,
// and mark the section currently on screen in the nav.
(function () {
  "use strict";
  const head = document.querySelector(".site-head");
  const h1 = document.querySelector("h1");
  if (!head || !("IntersectionObserver" in window)) return;

  if (h1) {
    head.classList.add("at-top");
    new IntersectionObserver(
      ([entry]) => head.classList.toggle("at-top", entry.isIntersecting),
      { rootMargin: "-48px 0px 0px 0px" }
    ).observe(h1);
  }

  const links = new Map();
  head.querySelectorAll('nav a[href^="#"]').forEach((a) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) links.set(target, a);
  });
  if (!links.size) return;

  const visible = new Set();
  const update = () => {
    let current = null;
    for (const section of links.keys()) if (visible.has(section)) { current = section; break; }
    links.forEach((a, section) => {
      if (section === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  // A section counts as current while it crosses a line a third of the way down the screen.
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      update();
    },
    { rootMargin: "-33% 0px -66% 0px" }
  );
  links.forEach((_, section) => io.observe(section));
})();
