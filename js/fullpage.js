// 풀페이지 스크롤: 휠·터치·키보드·오른쪽 점으로 한 화면씩 넘김
(() => {
  const track = document.getElementById("fp-track");
  const dotsNav = document.getElementById("fp-dots");
  const sections = Array.from(track.children);
  const last = sections.length - 1;

  const WHEEL_MIN = 30;      // 한 번의 휠 동작에서 이만큼 움직여야 넘어감 (트랙패드 살짝 닿음 무시)
  const WHEEL_GAP = 200;     // 휠 입력이 이 시간(ms) 끊기면 새 동작으로 봄
  const TOUCH_MIN = 50;      // 손가락으로 이만큼 밀어야 넘어감

  let index = 0;
  let moving = false;
  let unlockTimer = 0;

  // 오른쪽 점 만들기
  const dots = sections.map((section, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "fp-dot";
    dot.setAttribute("aria-label", `${i + 1}번째 화면: ${section.getAttribute("aria-label")}`);
    dot.addEventListener("click", () => go(i));
    dotsNav.appendChild(dot);
    return dot;
  });

  function duration() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--dur").trim();
    return parseFloat(v) || 0;
  }

  function render(animate) {
    if (!animate) track.style.transition = "none";
    track.style.transform = `translate3d(0, ${-100 * index}%, 0)`;
    if (!animate) {
      void track.offsetHeight;         // 위치를 바로 적용한 뒤 다시 애니메이션 켜기
      track.style.transition = "";
    }
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    dotsNav.dataset.theme = sections[index].dataset.theme || "dark";
    sections.forEach((section, i) => section.setAttribute("aria-hidden", i === index ? "false" : "true"));
  }

  function go(next) {
    next = Math.max(0, Math.min(last, next));
    if (next === index) return;
    index = next;
    moving = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { moving = false; }, duration() + 80);
    render(true);
    history.replaceState(null, "", `#${sections[index].id}`);
  }

  // 주소 끝 #이름으로 들어오면 그 화면부터
  const start = sections.findIndex((s) => `#${s.id}` === location.hash);
  if (start > 0) index = start;
  render(false);

  // ---------- 휠 (마우스 휠은 한 칸에 한 화면, 트랙패드 관성은 무시) ----------
  let samples = [];
  let lastWheel = 0;
  let gesture = 0;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  window.addEventListener("wheel", (e) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    if (Math.abs(dy) < Math.abs(e.deltaX) || dy === 0) return;

    const now = performance.now();
    if (now - lastWheel > WHEEL_GAP) {
      samples = [];
      gesture = 0;
    }
    lastWheel = now;
    samples.push(Math.abs(dy));
    if (samples.length > 30) samples.shift();
    if (Math.sign(gesture) !== Math.sign(dy)) gesture = 0;
    gesture += dy;

    if (moving) return;
    // 점점 약해지는 입력(관성)이면 넘기지 않음
    const accelerating = avg(samples.slice(-4)) >= avg(samples.slice(-16)) * 0.95;
    if (!accelerating || Math.abs(gesture) < WHEEL_MIN) return;
    gesture = 0;
    go(index + (dy > 0 ? 1 : -1));
  }, { passive: false });

  // ---------- 터치 ----------
  let touchY = null;
  let touchX = null;

  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { touchY = null; return; }
    touchY = e.touches[0].clientY;
    touchX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (touchY === null) return;
    e.preventDefault();
    const dy = touchY - e.touches[0].clientY;
    const dx = touchX - e.touches[0].clientX;
    if (moving || Math.abs(dy) < TOUCH_MIN || Math.abs(dy) < Math.abs(dx)) return;
    touchY = null;
    go(index + (dy > 0 ? 1 : -1));
  }, { passive: false });

  window.addEventListener("touchend", () => { touchY = null; }, { passive: true });

  // ---------- 키보드 ----------
  window.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let next = null;
    switch (e.key) {
      case "ArrowDown":
      case "PageDown":
        next = index + 1; break;
      case "ArrowUp":
      case "PageUp":
        next = index - 1; break;
      case " ":
        next = index + (e.shiftKey ? -1 : 1); break;
      case "Home":
        next = 0; break;
      case "End":
        next = last; break;
      default:
        return;
    }
    e.preventDefault();
    if (!moving || e.key === "Home" || e.key === "End") go(next);
  });

  // 주소의 #이름이 바뀌면(뒤로 가기 등) 그 화면으로
  window.addEventListener("hashchange", () => {
    const i = sections.findIndex((s) => `#${s.id}` === location.hash);
    if (i >= 0) go(i);
  });
})();
